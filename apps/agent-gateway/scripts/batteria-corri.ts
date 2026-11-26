/**
 * Il corridore: pone ogni domanda all'assistente (gateway) con l'identità del profilo e confronta.
 *
 *   cd apps/agent-gateway && HEURESYS_API=http://127.0.0.1:8013 AGENT_GATEWAY=http://127.0.0.1:8790 \
 *     pnpm exec tsx scripts/batteria-corri.ts --registro <file.jsonl> [--domande <file>] [--solo <regex sugli id>] [--insieme 3]
 *
 * Si usa sul gemello: ogni domanda apre una conversazione della persona e scrive nel diario.
 * Le sole conferme che il corridore concede sono quelle di LETTURA (la soglia delle persone, che la
 * persona collegata confermerebbe per avere la sua risposta); ogni scrittura è negata.
 * Rilanciato sullo stesso registro riprende: le domande già poste (senza guasto) non si ripetono,
 * il confronto si ricalcola per tutte. Uscita: 0 sopra soglia, 1 sotto, 2 guasti di esecuzione.
 */
import { createHmac } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { caricaSegretiTotp, totpSecretFor } from "../../api/test/helpers/mfa-fixture-secrets.js";
import { pool } from "../../api/src/db/client.js";
import { passwordFor } from "../../api/test/helpers/personas.js";
import { confronta } from "../test/batteria/confronto.js";
import { PROFILI } from "../test/batteria/profili.js";
import { SOGLIA, type Batteria, type Domanda } from "../test/batteria/tipi.js";
import { BATTERIA } from "./batteria-db.js";
import { riassunto, type Riga } from "./batteria-esito.js";

const API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");
const GATEWAY = (process.env.AGENT_GATEWAY ?? "http://localhost:8790").replace(/\/$/, "");
const opzione = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

function totp(base32: string): string {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bit = "";
  for (const c of base32.replace(/=+$/, "").toUpperCase()) {
    const v = alfabeto.indexOf(c);
    if (v >= 0) bit += v.toString(2).padStart(5, "0");
  }
  const chiave: number[] = [];
  for (let i = 0; i + 8 <= bit.length; i += 8) chiave.push(parseInt(bit.slice(i, i + 8), 2));
  const passo = Buffer.alloc(8);
  passo.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = createHmac("sha1", Buffer.from(chiave)).update(passo).digest();
  const o = h[h.length - 1]! & 0x0f;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

interface Sessione { cookie: string; csrf: string; nata: number }

async function entra(email: string): Promise<Sessione> {
  const password = passwordFor(email);
  const passo = (corpo: object) =>
    fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, ...corpo }) });
  let r = await passo({});
  let j = (await r.json()) as { status?: string; challengeToken?: string; code?: string };
  if (j.status === "mfa_required" && j.challengeToken) {
    r = await passo({ challengeToken: j.challengeToken, mfaCode: totp(totpSecretFor(email)) });
    j = (await r.json()) as { status?: string; code?: string };
  }
  if (j.status !== "success") throw new Error(`login di ${email} fallito: HTTP ${r.status} ${j.status ?? j.code ?? ""}`);
  const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]!);
  const csrf = cookie.find((c) => c.startsWith("hrx_csrf="))?.slice("hrx_csrf=".length) ?? "";
  return { cookie: cookie.join("; "), csrf, nata: Date.now() };
}

// La conferma del secondo fattore vale 15 minuti (ADR-0050 D5): si rientra prima.
const sessioni = new Map<string, Promise<Sessione>>();
async function sessione(email: string): Promise<Sessione> {
  const c = sessioni.get(email);
  if (c) {
    const s = await c;
    if (Date.now() - s.nata < 10 * 60_000) return s;
    if (sessioni.get(email) !== c) return sessione(email);
  }
  const nuova = entra(email);
  nuova.catch(() => sessioni.delete(email));
  sessioni.set(email, nuova);
  return nuova;
}

async function poni(d: Domanda): Promise<Omit<Riga, "giusta" | "motivo">> {
  const inizio = Date.now();
  const base = { id: d.id, categoria: d.categoria, profilo: d.profilo, domanda: d.testo, alle: new Date().toISOString(), impronta: d.impronta };
  const strumenti: string[] = [];
  const letture: string[] = [];
  let risposta = "";
  let ultimoTesto = "";
  let conversazione = "";
  let guasto: string | undefined;
  try {
    const s = await sessione(PROFILI[d.profilo]!.email);
    const r = await fetch(`${GATEWAY}/agent`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: s.cookie },
      body: JSON.stringify({ prompt: d.testo, lingua: "it" }),
      signal: AbortSignal.timeout(8 * 60_000),
    });
    if (!r.ok || !r.body) throw new Error(`gateway HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const lettore = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let fatto = false;
    while (!fatto) {
      const { done, value } = await lettore.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const blocchi = buf.split("\n\n");
      buf = blocchi.pop() ?? "";
      for (const b of blocchi) {
        const nome = /^event: (\S+)/m.exec(b)?.[1];
        const dati = b.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
        const j = JSON.parse(dati || "{}") as Record<string, any>;
        if (nome === "conversation") conversazione = String(j.conversationId);
        else if (nome === "done") fatto = true;
        else if (nome === "error") guasto = String(j.message).slice(0, 300);
        else if (nome === "limit") guasto = `limite ${j.limite}`;
        else if (nome === "rifiuto") risposta = String(j.testo);
        else if (nome === "approval_required") {
          const decisione = j.classe === "read" ? "allow" : "deny";
          letture.push(`${decisione} ${j.classe} ${j.tool}`);
          // Senza attendere: lo stream deve restare in lettura mentre il gateway registra la decisione.
          void fetch(`${GATEWAY}/agent/approve`, {
            method: "POST",
            headers: { "content-type": "application/json", cookie: s.cookie, "x-csrf-token": s.csrf },
            body: JSON.stringify({ approvalId: j.approvalId, decision: decisione, ...(decisione === "deny" ? { reason: "batteria: nessuna scrittura" } : {}) }),
          }).catch(() => {});
        } else if (!nome) {
          if (j.type === "assistant") {
            for (const x of j.message?.content ?? []) {
              if (x.type === "tool_use") strumenti.push(`${String(x.name).replace("mcp__heuresys__", "")} ${JSON.stringify(x.input).slice(0, 200)}`);
              if (x.type === "text" && x.text?.trim()) ultimoTesto = x.text;
            }
          } else if (j.type === "result") {
            if (j.is_error) guasto = `modello: ${String(j.subtype)} ${String(j.result ?? "").slice(0, 200)}`;
            // Il messaggio fisso del gateway prende il posto della risposta del modello.
            else if (!risposta) risposta = String(j.result ?? "");
          }
        }
      }
    }
    if (!fatto && !guasto) guasto = "stream chiuso senza fine";
  } catch (e) {
    guasto = String(e).slice(0, 400);
  }
  return { ...base, risposta: risposta || ultimoTesto, strumenti, conferme: letture, conversazione, durataMs: Date.now() - inizio, ...(guasto ? { guasto } : {}) };
}

async function main(): Promise<void> {
  const registro = opzione("registro");
  if (!registro) throw new Error("serve --registro <file.jsonl>");
  const b = JSON.parse(readFileSync(opzione("domande") ?? BATTERIA, "utf8")) as Batteria;
  const solo = new RegExp(opzione("solo") ?? ".");
  const scelte = b.domande.filter((d) => solo.test(d.id));
  const fatte = new Map<string, Riga>();
  if (existsSync(registro)) {
    for (const l of readFileSync(registro, "utf8").split("\n").filter(Boolean)) {
      const r = JSON.parse(l) as Riga;
      if (!r.guasto) fatte.set(r.id, r);
    }
  }
  // Si ripone anche la domanda di cui è cambiato il testo, non solo la query o l'attesa.
  const valida = (d: Domanda) => fatte.get(d.id)?.impronta === d.impronta && fatte.get(d.id)?.domanda === d.testo;
  const coda = scelte.filter((d) => !valida(d));
  const insieme = Number(opzione("insieme") ?? 3);
  console.log(`=== batteria: ${scelte.length} domande (${coda.length} da porre), ${insieme} insieme, API ${API}, gateway ${GATEWAY}, ${new Date().toISOString()}`);
  // I secondi fattori di prova si leggono una volta dal database; poi la connessione si chiude.
  await caricaSegretiTotp();
  await pool.end();
  let n = 0;
  await Promise.all(
    Array.from({ length: insieme }, async () => {
      for (let d = coda.shift(); d; d = coda.shift()) {
        let r = await poni(d);
        if (r.guasto) r = await poni(d); // un guasto si ritenta una volta; una risposta sbagliata no
        const riga: Riga = { ...r, ...(r.guasto ? { giusta: false, motivo: `guasto: ${r.guasto}` } : confronta(d.atteso, r.risposta)) };
        appendFileSync(registro, `${JSON.stringify(riga)}\n`);
        fatte.set(d.id, riga);
        console.log(`[${++n}] ${d.id} ${riga.giusta ? "GIUSTA" : "SBAGLIATA"} ${Math.round(riga.durataMs / 1000)}s ${riga.motivo}`);
      }
    }),
  );
  const righe = scelte.map((d) => {
    const r = fatte.get(d.id)!;
    return { ...r, ...(r.guasto ? {} : confronta(d.atteso, r.risposta)) };
  });
  const e = riassunto(righe);
  console.log(`\n${e.testo}\n(${new Date().toISOString()}, soglia ${SOGLIA * 100}%)`);
  process.exitCode = righe.some((r) => r.guasto) ? 2 : e.quota >= SOGLIA ? 0 : 1;
}

await main();
