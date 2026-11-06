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
import { HeuresysClient, chiSei, chiediGettoneAgente } from "./heuresys-client.js";
import { ConversazioniAperte, leggiLimiti, modelloAgenti } from "./limiti.js";
import { redact } from "./redact.js";
import { runHrAgent } from "./sdk-agent.js";
import { servi, type RichiestaProposta } from "./research-propose.js";
import { giudica, LottoNonValido } from "./consolidation-propose.js";
import type { ApprovalRequest, GatePrincipal } from "./write-gate.js";

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

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
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
      let parsed: { approvalId?: string; decision?: string };
      try {
        parsed = JSON.parse(body || "{}") as { approvalId?: string; decision?: string };
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
      const approvatore = parseCookies(req.headers.cookie)["hrx_access"];
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
      const cookieAccess = cookies["hrx_access"];
      const cookieCsrf = cookies["hrx_csrf"] ?? "";
      if (!cookieAccess) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "NO_SESSION", message: "forward hrx_access cookie" }));
        return;
      }
      const body = await readBody(req);
      const prompt = (JSON.parse(body || "{}") as { prompt?: string }).prompt;
      if (!prompt) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "NO_PROMPT" }));
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
      // `finally` qui sotto, comunque finisca la conversazione.
      const posto = conversazioni.entra(gettone.persona.userId);
      if (!posto.ok) {
        res.writeHead(429, { "content-type": "application/json" });
        res.end(JSON.stringify({
          error: posto.motivo === "PERSONA" ? "TOO_MANY_CONVERSATIONS_PERSON" : "TOO_MANY_CONVERSATIONS",
          limite: posto.motivo === "PERSONA" ? LIMITI.perPersona : LIMITI.totali,
        }));
        return;
      }
      const client = new HeuresysClient({
        baseUrl: HEURESYS_API,
        session: gettone.session,
        agente: AGENTE_ASSISTENTE,
      });

      // ADR-0056 T3: la conversazione si interrompe allo scadere della durata massima, o quando la
      // persona chiude la connessione (non c'è più nessuno a cui rispondere né chi approvi).
      const interrompi = new AbortController();
      let motivoStop: "DURATA" | "CHIUSA" | undefined;
      const timerDurata = setTimeout(() => {
        motivoStop = "DURATA";
        interrompi.abort();
      }, LIMITI.durataMs);
      res.on("close", () => {
        if (!res.writableEnded) {
          motivoStop ??= "CHIUSA";
          interrompi.abort();
        }
      });

      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });

      // M-2 HITL bridge: each write registers a pending approval, emits an
      // `approval_required` SSE event with the REDACTED tool/args, and awaits the
      // human's decision via POST /agent/approve (deny-by-default on timeout).
      //
      // #252 — e da qui non solo le scritture: anche una LETTURA oltre la soglia alta di
      // persone distinte passa da questo ponte. Perciò il payload porta `classe`,
      // `personeDistinte` e `livello`: senza quei tre campi il pannello direbbe «l'agente vuole
      // eseguire una scrittura» davanti a una lettura, cioè chiederebbe di approvare una cosa
      // raccontandone un'altra. Sono numeri e identificatori: niente da redigere, per requisito.
      // A-12: il diario e le soglie (A-6) sanno per conto di chi lavora l'agente e in quale
      // tenant: lo dice l'API nel gettone, non il corpo della richiesta.
      const principal: GatePrincipal = {
        principal: "user",
        subject: gettone.persona.userId,
        ...(gettone.persona.tenantCode ? { tenant: gettone.persona.tenantCode } : {}),
      };
      const approve = async (reqApprove: ApprovalRequest): Promise<boolean> => {
        const { approvalId, decided } = approvals.create(gettone.persona.userId);
        const payload = {
          approvalId,
          tool: redact(reqApprove.tool),
          input: redact(reqApprove.input),
          ...(reqApprove.classe !== undefined ? { classe: reqApprove.classe } : {}),
          ...(reqApprove.personeDistinte !== undefined
            ? { personeDistinte: reqApprove.personeDistinte }
            : {}),
          ...(reqApprove.livello !== undefined ? { livello: reqApprove.livello } : {}),
        };
        res.write(`event: approval_required\ndata: ${JSON.stringify(payload)}\n\n`);
        return decided; // resolves allow/deny; false on timeout / unknown id
      };

      try {
        for await (const event of runHrAgent(prompt, client, {
          approve,
          approvalTimeoutMs: APPROVAL_TIMEOUT_MS,
          audit: auditSink,
          principal,
          maxTurns: LIMITI.giri,
          abortController: interrompi,
        })) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (err) {
        // Un'interruzione voluta non è un errore: la si racconta qui sotto, una volta sola.
        if (motivoStop === undefined) {
          res.write(`event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`);
        }
      } finally {
        clearTimeout(timerDurata);
        posto.esci();
      }
      if (!res.writableEnded && motivoStop !== "CHIUSA") {
        if (motivoStop === "DURATA") {
          res.write(`event: limit\ndata: ${JSON.stringify({ limite: "DURATA", durataMs: LIMITI.durataMs })}\n\n`);
        }
        res.write("event: done\ndata: {}\n\n");
        res.end();
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
