/**
 * Agent gateway HTTP server (#9 WI-B.2) — READ-LIVE service port.
 *
 * POST /agent          → Server-Sent Events stream of the Agent SDK run (runHrAgent).
 *   Auth: the caller's heuresys session cookies (hrx_access + hrx_csrf) are used ONCE per
 *   request to ask /v1 for an AGENT TOKEN (L9, A-1/A-2/A-3, ADR-0050 D6): the agent then calls
 *   with that token — the API knows it is an agent acting for that person, the perimeter is the
 *   person's without mandates, and the token expires without refresh. No service account.
 *   Write gate (M-2): every write triggers a human-in-the-loop round-trip. The stream
 *   emits an `approval_required` event carrying an `approvalId` + the REDACTED tool/args;
 *   a human resolves it via POST /agent/approve. DENY-BY-DEFAULT on timeout / unknown id.
 *   Reads auto-allow (write-gate.ts). EVERY decision is audited (audit-sink.ts).
 * POST /agent/approve   → { approvalId, decision:'allow'|'deny' } resolves a pending write — only for the
 *   person who opened it (ADR-0056 T3: the API says who is pressing, from their own cookies).
 *   Limits (ADR-0056 T3, limiti.ts): concurrent conversations per person and in total (429),
 *   turns, duration (SSE `limit` event); the model is fixed by name (AGENT_GATEWAY_MODEL).
 *   ADR-0056 D4 (piano T6b): body `{ prompt, conversationId? }`. La conversazione, il giro, ciò che
 *   la persona vede e le proposte si scrivono nel database attraverso `/v1/agent-conversations`
 *   (giro.ts, conversazione.ts); il giro continua a finestra chiusa fino a un limite (durata,
 *   gettone, giri) e una conversazione si riprende (sessione dell'SDK e contatore delle persone).
 *   `/agent/approve` porta anche `reason` (obbligatorio quando si scarta) e l'intestazione
 *   `x-csrf-token`: la decisione si registra nell'API prima di sbloccare il giro.
 * GET  /healthz         → liveness.
 *
 * Node http only (no framework dep). HEURESYS_API defaults to the dev API on :3001.
 */
// DEVE restare il primo import: neutralizza le credenziali API prima che
// qualunque altro modulo del grafo (incl. l'SDK) possa leggerle.
import "./subscription-auth.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ApprovalRegistry, type ApprovalDecision } from "./approval-bridge.js";
import { DbAuditSink, FileAuditSink, type AuditSink } from "./audit-sink.js";
import { auditPool } from "./db-pool.js";
import { HeuresysClient, chiSei, chiediGettoneAgente, registraDecisione } from "./heuresys-client.js";
import { ConversazioneNonTrovata, ConversazioneOccupata, RegistroConversazione } from "./conversazione.js";
import { eseguiGiro } from "./giro.js";
import { ContatorePersone } from "./persone-distinte.js";
import { caricaSoglie } from "./soglie-persone.js";
import { ConversazioniAperte, leggiLimiti, modelloAgenti, personeAmmesse } from "./limiti.js";
import { DbRegistroCapacita } from "./capacita.js";
import { runHrAgent } from "./sdk-agent.js";
import { servi, type RichiestaProposta } from "./research-propose.js";
import { giudica, LottoNonValido } from "./consolidation-propose.js";
import type { GatePrincipal } from "./write-gate.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PORT = Number(process.env.AGENT_GATEWAY_PORT ?? 8790);
/** Il codice con cui l'assistente si presenta all'API (gettone e superficie). */
const AGENTE_ASSISTENTE = "assistente-hr";
const HEURESYS_API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");
// S1099 (#159 F2) — L'ORIGINE DEL WEB. La console dell'agente sta su un'altra porta del
// browser (il web su :3000, il gateway su :8790): senza le intestazioni CORS il browser
// non consegna nemmeno la richiesta, e la pagina mostra «Failed to fetch» — misurato con
// la prima prova E2E della pagina, che fino a quel giorno non era mai stata fatta.
// UNA sola origine ammessa, dichiarata; i cookie viaggiano (credentials) e per questo
// l'origine non puo' essere `*`. Gli script da terminale non passano di qui.
const WEB_ORIGIN = (process.env.AGENT_GATEWAY_WEB_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
function cors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  if (origin !== WEB_ORIGIN) return false;
  res.setHeader("access-control-allow-origin", WEB_ORIGIN);
  res.setHeader("access-control-allow-credentials", "true");
  res.setHeader("vary", "origin");
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-csrf-token",
      "access-control-max-age": "600",
    });
    res.end();
    return true;
  }
  return false;
}
const APPROVAL_TIMEOUT_MS = Number(process.env.AGENT_GATEWAY_APPROVAL_TIMEOUT_MS ?? 120_000);
// #132 F4h — il segreto condiviso con l'API per l'endpoint di proposta. Se non c'e',
// l'endpoint NON esiste: un servizio in ascolto senza autenticazione «perche' tanto e'
// locale» e' un servizio che puo' chiamare qualcun altro.
const RESEARCH_TOKEN = process.env.AGENT_GATEWAY_RESEARCH_TOKEN ?? "";
/** AC-6: il segreto condiviso con l'API per il giudice del consolidamento. Assente = rotta spenta. */
const CONSOLIDATION_TOKEN = process.env.AGENT_GATEWAY_CONSOLIDATION_TOKEN ?? "";

// Module-level singletons (one per server process):
//  - the HITL approval registry bridges the SSE stream ↔ POST /agent/approve;
//  - the audit sink leaves a tamper-evident trail of EVERY gate decision (M-4).
// #253 — il diario diventa interrogabile QUANDO c'e' un database configurato
// (`POSTGRES_HOST`): `DbAuditSink` scrive in `audit.agent_gateway_decisions`. Dove
// non c'e' (dev senza tunnel, un test che non lo imposta) si ricade sul file — la
// decisione presa in #253 ("il file resta come fallback"), non un errore silenzioso.
const approvals = new ApprovalRegistry({ approvalTimeoutMs: APPROVAL_TIMEOUT_MS });
// ADR-0056 T3: i limiti della conversazione e il modello per nome. `modelloAgenti()` qui, all'avvio,
// e non solo alla prima conversazione: un nome sbagliato nell'ambiente ferma il servizio subito,
// invece di scoprirsi davanti alla prima persona.
const LIMITI = leggiLimiti();
const MODELLO = modelloAgenti();
const conversazioni = new ConversazioniAperte(LIMITI);
const pool = auditPool();
const auditSink: AuditSink = pool ? new DbAuditSink(pool) : new FileAuditSink();
// ADR-0053 A3 (piano T3b): il registro delle capacità si legge dallo stesso database del diario.
// Senza database non c'è registro, e ogni scrittura passa dal ponte di approvazione come prima.
const registroCapacita = pool ? new DbRegistroCapacita(pool) : undefined;

// #9 §A.1 — subscription auth: with AGENT_GATEWAY_SUBSCRIPTION_AUTH=1 do NOT forward
// an ANTHROPIC_API_KEY to the SDK, so query() falls back to the machine's logged-in
// Claude credentials (the operator's Claude MAX subscription, zero marginal cost).
// This is SUFFICIENT for this platform: Heuresys owns it + RTL_BANK is the test tenant
// — there is NO customer-facing agent serving, so no separate API key is required.
// A real ANTHROPIC_API_KEY (or AWS Bedrock / GCP Vertex) would only be needed IF a
// customer-facing production serving is ever added. Verified live (S990): query()
// → "PONG" via the MAX subscription, is_error=false, no out_of_credits.
// La neutralizzazione vive in ./subscription-auth.js, importato PER PRIMO in cima a
// questo file: qui sarebbe troppo tardi, perche' gli import ESM sono hoisted e l'SDK
// risulterebbe gia' caricato (S1029).

// Una Map e non un oggetto: il nome di un cookie lo sceglie chi chiama, e un nome come
// `__proto__` scritto come proprietà di un oggetto ne toccherebbe il prototipo (CodeQL).
function parseCookies(header: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  return out;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  try {
    if (cors(req, res)) return; // la sonda preliminare del browser: finisce qui
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "agent-gateway", api: HEURESYS_API }));
      return;
    }

    // HITL resolve route: a human allows/denies a pending write from the webapp.
    if (req.method === "POST" && req.url === "/agent/approve") {
      const body = await readBody(req);
      let parsed: { approvalId?: string; decision?: string; reason?: unknown };
      try {
        parsed = JSON.parse(body || "{}") as { approvalId?: string; decision?: string; reason?: unknown };
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "BAD_JSON" }));
        return;
      }
      const approvalId = parsed.approvalId;
      const decision = parsed.decision;
      if (!approvalId || (decision !== "allow" && decision !== "deny")) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "BAD_REQUEST", message: "approvalId + decision:'allow'|'deny'" }));
        return;
      }
      // ADR-0056 T3 — L'APPROVAZIONE È DI CHI HA CHIESTO. Chi decide lo dice l'API, dai cookie di
      // chi ha premuto, non il corpo della richiesta: senza sessione, o con la sessione di
      // un'altra persona, la richiesta resta in attesa e scade da sola (deny-by-default).
      const approvatore = parseCookies(req.headers.cookie).get("hrx_access");
      if (!approvatore) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "NO_SESSION", message: "forward hrx_access cookie" }));
        return;
      }
      const chi = await chiSei(HEURESYS_API, { cookieAccess: approvatore });
      if (!chi) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "SESSION_NOT_RECOGNISED" }));
        return;
      }
      // unknown / expired / already-resolved id → no-op (deny-by-default semantics).
      const prima = approvals.peek(approvalId, chi);
      if (prima === "not-owner") {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "APPROVER_NOT_REQUESTER", resolved: false }));
        return;
      }
      if (prima === "unknown") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, resolved: false }));
        return;
      }
      // ADR-0056 D4 (T6b): la decisione si scrive nel registro PRIMA di sbloccare il giro, con i
      // cookie di chi ha premuto (un gettone d'agente non decide). L'API pretende il motivo quando
      // si scarta e rifiuta una proposta scaduta: se rifiuta, il giro resta in attesa e scade.
      const reason = typeof parsed.reason === "string" ? parsed.reason : undefined;
      const registrata = await registraDecisione(HEURESYS_API, {
        cookieAccess: approvatore,
        cookieCsrf: parseCookies(req.headers.cookie).get("hrx_csrf") ?? "",
        csrfHeader: typeof req.headers["x-csrf-token"] === "string" ? req.headers["x-csrf-token"] : "",
      }, approvalId, decision === "allow" ? "APPROVATA" : "SCARTATA", reason);
      if (registrata.status === 422) {
        res.writeHead(422, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "REJECT_REASON_REQUIRED", resolved: false }));
        return;
      }
      if (registrata.status === 404 || registrata.status === 403) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "APPROVER_NOT_REQUESTER", resolved: false }));
        return;
      }
      if (!registrata.ok) {
        // 409 (scaduta o già decisa) e ogni altro rifiuto: nessuna decisione, il giro resta negato.
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, resolved: false, status: registrata.status }));
        return;
      }
      const esito = approvals.resolveAs(approvalId, decision as ApprovalDecision, chi);
      if (esito === "not-owner") {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "APPROVER_NOT_REQUESTER", resolved: false }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, resolved: esito === "resolved" }));
      return;
    }

    // #132 F4h — chi propone: riceve domande e testo di pagine gia' lette dall'API, e
    // restituisce JSON. Nessuno strumento, nessun accesso alla piattaforma, nessuna
    // decisione: e' la sola parte non deterministica della catena, e sta dietro un segreto.
    if (req.method === "POST" && req.url === "/research/propose") {
      if (!RESEARCH_TOKEN) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "RESEARCH_DISABLED", message: "AGENT_GATEWAY_RESEARCH_TOKEN non configurato" }));
        return;
      }
      if (req.headers["x-research-token"] !== RESEARCH_TOKEN) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "BAD_TOKEN" }));
        return;
      }
      const body = await readBody(req);
      let richiesta: RichiestaProposta;
      try {
        richiesta = JSON.parse(body || "{}") as RichiestaProposta;
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "BAD_JSON" }));
        return;
      }
      try {
        const esito = await servi(richiesta);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(esito));
      } catch (err) {
        // Un guasto qui e' un ESITO della corsa, non un guasto del gateway: l'API lo
        // registra come corsa FAILED col motivo, e la corsa resta nel registro.
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "PROPOSE_FAILED", message: String(err) }));
      }
      return;
    }

    // AC-6 — il giudice del consolidamento del tenant: riceve un lotto di voci strutturali e
    // restituisce proposte. Nessuno strumento, nessuna persona nel lotto, nessuna decisione.
    if (req.method === "POST" && req.url === "/consolidation/propose") {
      if (!CONSOLIDATION_TOKEN) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "CONSOLIDATION_DISABLED", message: "AGENT_GATEWAY_CONSOLIDATION_TOKEN non configurato" }));
        return;
      }
      if (req.headers["x-consolidation-token"] !== CONSOLIDATION_TOKEN) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "BAD_TOKEN" }));
        return;
      }
      let lotto: unknown;
      try {
        lotto = JSON.parse((await readBody(req)) || "{}");
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "BAD_JSON" }));
        return;
      }
      try {
        const esito = await giudica(lotto);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(esito));
      } catch (err) {
        // Il motivo di un lotto rifiutato è nostro e si dice; un guasto del modello resta nel log,
        // non nella risposta (CodeQL: nessuna traccia d'errore verso chi chiama).
        const rifiuto = err instanceof LottoNonValido;
        if (!rifiuto) console.error("[consolidation/propose]", err);
        res.writeHead(rifiuto ? 422 : 502, { "content-type": "application/json" });
        res.end(JSON.stringify(rifiuto ? { error: "BAD_BATCH", message: err.message } : { error: "PROPOSE_FAILED" }));
      }
      return;
    }

    if (req.method === "POST" && req.url === "/agent") {
      const cookies = parseCookies(req.headers.cookie);
      const cookieAccess = cookies.get("hrx_access");
      const cookieCsrf = cookies.get("hrx_csrf") ?? "";
      if (!cookieAccess) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "NO_SESSION", message: "forward hrx_access cookie" }));
        return;
      }
      // ADR-0056 D3: solo le persone nominate. Chi non è riconosciuto o non è nell'elenco non
      // arriva al modello (fail-closed: elenco vuoto = nessuno).
      const chiParla = await chiSei(HEURESYS_API, { cookieAccess });
      if (!chiParla) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "SESSION_NOT_RECOGNISED" }));
        return;
      }
      if (!personeAmmesse().has(chiParla)) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "PERSON_NOT_ADMITTED" }));
        return;
      }
      let corpo: { prompt?: unknown; conversationId?: unknown };
      try {
        corpo = JSON.parse((await readBody(req)) || "{}") as { prompt?: unknown; conversationId?: unknown };
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "BAD_JSON" }));
        return;
      }
      const prompt = typeof corpo.prompt === "string" ? corpo.prompt.trim() : "";
      if (!prompt) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "NO_PROMPT" }));
        return;
      }
      // ADR-0056 D4: una conversazione si riprende per identificativo. Se c'è, deve averne la forma.
      const conversationId = corpo.conversationId;
      if (conversationId !== undefined && (typeof conversationId !== "string" || !UUID.test(conversationId))) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "BAD_CONVERSATION_ID" }));
        return;
      }

      // L9, A-1/A-2/A-3: l'agente non usa i cookie della persona, ma un gettone suo, breve e
      // senza rinnovo, chiesto qui con quei cookie. Se l'API lo rifiuta, la risposta lo dice.
      const gettone = await chiediGettoneAgente(HEURESYS_API, { cookieAccess, cookieCsrf }, {
        agentCode: AGENTE_ASSISTENTE,
        task: "assistente HR: richiesta della persona dalla console",
      });
      if (!gettone.ok) {
        res.writeHead(gettone.status === 401 ? 401 : 403, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "AGENT_TOKEN_REFUSED", status: gettone.status, detail: gettone.corpo }));
        return;
      }
      // ADR-0056 T3: quante conversazioni insieme, per persona e in tutto il servizio. Il posto si
      // prende dopo il gettone, perché è il gettone a dire chi è la persona, e si libera nel
      // `finally` qui sotto quando il GIRO finisce, non quando si chiude la finestra (T6b).
      const posto = conversazioni.entra(gettone.persona.userId);
      if (!posto.ok) {
        res.writeHead(429, { "content-type": "application/json" });
        res.end(JSON.stringify({
          error: posto.motivo === "PERSONA" ? "TOO_MANY_CONVERSATIONS_PERSON" : "TOO_MANY_CONVERSATIONS",
          limite: posto.motivo === "PERSONA" ? LIMITI.perPersona : LIMITI.totali,
        }));
        return;
      }
      try {
        // Due client con lo stesso gettone: quello dell'agente alimenta il contatore delle persone,
        // quello del registro no (le risposte del registro non sono letture dell'agente).
        const client = new HeuresysClient({ baseUrl: HEURESYS_API, session: gettone.session, agente: AGENTE_ASSISTENTE });
        const clientRegistro = new HeuresysClient({ baseUrl: HEURESYS_API, session: gettone.session, agente: AGENTE_ASSISTENTE });

        // ADR-0056 D4 (T6b): la conversazione e il giro stanno nel database, attraverso l'API.
        // Se non si riesce a salvarli il giro non parte: una conversazione che la persona non
        // ritrova non è la conversazione che le abbiamo promesso.
        let registro: RegistroConversazione;
        try {
          registro = await RegistroConversazione.apri(clientRegistro, {
            ...(typeof conversationId === "string" ? { conversationId } : {}),
            agentCode: AGENTE_ASSISTENTE,
            prompt,
          });
        } catch (e) {
          const [stato, codice] = e instanceof ConversazioneNonTrovata
            ? [404, "CONVERSATION_NOT_FOUND"]
            : e instanceof ConversazioneOccupata
              ? [409, "CONVERSATION_BUSY"]
              : [502, "CONVERSATION_NOT_SAVED"];
          if (stato === 502) console.error(JSON.stringify({ level: "error", phase: "agent-gateway", msg: "conversazione non salvata", error: String(e) }));
          res.writeHead(stato, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: codice }));
          return;
        }

        // A-12: il diario e le soglie (A-6) sanno per conto di chi lavora l'agente e in quale
        // tenant: lo dice l'API nel gettone, non il corpo della richiesta.
        const principal: GatePrincipal = {
          principal: "user",
          subject: gettone.persona.userId,
          ...(gettone.persona.tenantCode ? { tenant: gettone.persona.tenantCode } : {}),
        };
        // ADR-0040 §4b e T6b: il contatore riparte dalle persone già lette in questa conversazione.
        const contatore = new ContatorePersone(
          caricaSoglie(undefined, gettone.persona.tenantCode ?? undefined),
          registro.conversazione.personsSeen,
        );

        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        // T6b: chiudere la finestra NON ferma il giro. Da quel momento non si scrive più verso la
        // finestra; il giro prosegue fino a un limite e lascia tutto nel registro.
        const scrivi = (pezzo: string) => {
          if (!res.writableEnded && !res.destroyed) res.write(pezzo);
        };

        await eseguiGiro({
          registro,
          contatore,
          approvals,
          owner: gettone.persona.userId,
          scadenzaGettone: Date.parse(gettone.expiresAt),
          durataMs: LIMITI.durataMs,
          approvalTimeoutMs: APPROVAL_TIMEOUT_MS,
          scrivi,
          esegui: (o) =>
            runHrAgent(prompt, client, {
              approve: o.approve,
              approvalTimeoutMs: APPROVAL_TIMEOUT_MS,
              audit: auditSink,
              principal,
              maxTurns: LIMITI.giri,
              abortController: o.abortController,
              contatore: o.contatore,
              conversationId: o.conversationId,
              ...(o.resume !== undefined ? { resume: o.resume } : {}),
              ...(registroCapacita ? { capacita: { registro: registroCapacita, agentCode: AGENTE_ASSISTENTE } } : {}),
            }),
        });
        if (!res.writableEnded && !res.destroyed) res.end();
      } finally {
        posto.esci();
      }
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "NOT_FOUND" }));
  } catch (err) {
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "INTERNAL", message: String(err) }));
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[agent-gateway] listening on :${PORT} → ${HEURESYS_API} (modello ${MODELLO})`);
});
