/**
 * #251 F5 — DIMOSTRAZIONE LIVE del contatore di persone distinte (Definition of Done).
 *
 * Non un mock, non un test: login vero di una persona reale col secondo fattore, letture vere
 * su `/v1` con la sua sessione, dati veri, e il DIARIO del gate letto da disco alla fine. Il
 * verdetto si legge dal diario, non dalla prosa di questo script.
 *
 * DUE PARTI, e sono diverse di proposito:
 *
 *  ① LA CATENA VERA, TUTTA INTERA — risolutore dei perimetri di PRODUZIONE (l'atlante
 *    generato), catalogo di PRODUZIONE (`DEFAULT_TOOL_ALLOWLIST`), strumento generico
 *    `hrx_entity_query` sui concetti **oggi aperti**. Dimostra che gate → strumento → `/v1` →
 *    contatore → diario funziona end-to-end senza toccare niente.
 *    ⚠ E dimostra anche il buco: i sedici perimetri aperti sono stati scelti perché parlano
 *    POCO di persone, e nonostante questo una sola conversazione ne tocca già decine.
 *
 *  ② LE QUATTRO AMPIEZZE DELLA DOTTRINA — 1 · 7 · 38 · 160 persone distinte in UNA
 *    conversazione, per letture ANNIDATE (`/v1/users?limit=N`, `ORDER BY user_email`: ogni
 *    insieme contiene il precedente, quindi il cumulato è esattamente 1, 7, 38, 160). Sono le
 *    letture che LA PERSONA è autorizzata a fare (TENANT_ADMIN del tenant): è esattamente ciò
 *    che R1 di ADR-0040 consegnerà all'agente con `#254`.
 *    ⚠ QUI UNA COSA È INIETTATA, E VA DETTA: il risolutore che dichiara `users` come lettura.
 *    Oggi `users` non è un concetto aperto (misurato: 16 concetti in `agent-operations.json`,
 *    `users` non è fra loro) e il generatore non lo emette. L'iniezione non finge un permesso
 *    — la lettura passa perché la SESSIONE della persona ha `user:read` — dichiara soltanto al
 *    gate che quell'operazione è una GET. È ciò che `#254` renderà permanente.
 *
 * Uso (dalla radice, con l'API su :3001 e il tunnel su):
 *   cd apps/agent-gateway && pnpm exec tsx scripts/live-persone-distinte.ts
 *
 * ⚠ SOLE LETTURE. Nessuna `POST`/`PATCH`/`DELETE`, nessuna scrittura sul database. Il diario
 * si scrive in un file NUOVO per ogni corsa (`.data/251-live-<istante>.jsonl`): niente si
 * sovrascrive e niente si cancella.
 */
import { existsSync, readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { join } from "node:path";
import { FIXTURE_TOTP_SECRETS } from "../../api/test/helpers/mfa-fixture-secrets.js";
import { passwordFor } from "../../api/test/helpers/personas.js";
import { AtlasOperationResolver } from "../src/atlas-resolver.js";
import {
  FileAuditSink,
  RAGIONE_CHIUSURA,
  registraChiusuraConversazione,
  type AuditEntry,
} from "../src/audit-sink.js";
import { HeuresysClient } from "../src/heuresys-client.js";
import { DEFAULT_TOOL_ALLOWLIST } from "../src/mcp-tool-names.js";
import { ContatorePersone } from "../src/persone-distinte.js";
import { caricaSoglie } from "../src/soglie-persone.js";
import { makeCanUseTool, type OperationResolver } from "../src/write-gate.js";

const API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");
const EMAIL = process.env.ACC_EMAIL ?? "federica.marchetti@rtl-bank.org";
const RADICE = join(process.cwd(), "..", "..");
const ISTANTE = new Date().toISOString().replace(/[:.]/g, "-");
const DIARIO = process.env.AGENT_GATEWAY_AUDIT_PATH ?? join(process.cwd(), ".data", `251-live-${ISTANTE}.jsonl`);
const STRUMENTO = "mcp__heuresys__hrx_entity_query";

/* ── login vero, col secondo fattore ─────────────────────────────────────────────────── */

function base32Decode(s: string): Buffer {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bit = "";
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const v = alfabeto.indexOf(ch);
    if (v >= 0) bit += v.toString(2).padStart(5, "0");
  }
  const byte: number[] = [];
  for (let i = 0; i + 8 <= bit.length; i += 8) byte.push(parseInt(bit.slice(i, i + 8), 2));
  return Buffer.from(byte);
}

function totp(segretoBase32: string): string {
  const chiave = base32Decode(segretoBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = createHmac("sha1", chiave).update(buf).digest();
  const off = h[h.length - 1]! & 0x0f;
  const codice =
    ((h[off]! & 0x7f) << 24) | ((h[off + 1]! & 0xff) << 16) |
    ((h[off + 2]! & 0xff) << 8) | (h[off + 3]! & 0xff);
  return (codice % 1_000_000).toString().padStart(6, "0");
}

async function accedi(): Promise<{ access: string; csrf: string }> {
  const password = passwordFor(EMAIL);
  const biscotti = (r: Response): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const c of r.headers.getSetCookie?.() ?? []) {
      const [nome, valore] = c.split(";")[0]!.split("=");
      if (nome && valore) out[nome.trim()] = valore.trim();
    }
    return out;
  };
  const r1 = await fetch(`${API}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password }),
  });
  const j1 = (await r1.json()) as { status: string; challengeToken?: string };
  let cookies = biscotti(r1);
  if (j1.status !== "success") {
    const segreto = FIXTURE_TOTP_SECRETS[EMAIL];
    if (j1.status !== "mfa_required" || !j1.challengeToken || !segreto) {
      throw new Error(`login inatteso: ${JSON.stringify(j1)}`);
    }
    const r2 = await fetch(`${API}/v1/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password, challengeToken: j1.challengeToken, mfaCode: totp(segreto) }),
    });
    const j2 = (await r2.json()) as { status: string };
    if (j2.status !== "success") throw new Error(`secondo fattore fallito: ${JSON.stringify(j2)}`);
    cookies = biscotti(r2);
  }
  const access = cookies["hrx_access"];
  if (!access) throw new Error("nessun cookie di sessione dopo il login");
  return { access, csrf: cookies["hrx_csrf"] ?? "" };
}

/* ── il diario, letto da disco ───────────────────────────────────────────────────────── */

function diario(): AuditEntry[] {
  if (!existsSync(DIARIO)) return [];
  return readFileSync(DIARIO, "utf8").split("\n").filter(Boolean)
    .map((r) => JSON.parse(r) as AuditEntry);
}

/** Il risolutore iniettato della parte ②: dichiara `users` come LETTURA. Vedi l'intestazione. */
const RISOLUTORE_USERS: OperationResolver = {
  methodOf: (concetto, operazione) =>
    concetto === "users" && operazione === "get_list" ? "GET" : undefined,
};

async function main(): Promise<void> {
  console.log(`=== #251 F5 — dimostrazione LIVE del contatore di persone distinte ===`);
  console.log(`API ${API} · persona ${EMAIL} · diario ${DIARIO}`);

  const soglie = caricaSoglie();
  if (!soglie) throw new Error("soglie non misurate: rigenera docs/kb/agent-soglie-persone.json");
  console.log(`soglie ri-derivate: bassa ${soglie.bassa} · alta ${soglie.alta} ` +
    `(tenant ${soglie.provenienza.tenant}, misurato ${soglie.provenienza.misuratoIl})`);

  const { access, csrf } = await accedi();
  console.log(`[login] sessione reale acquisita (secondo fattore incluso)`);

  const sink = new FileAuditSink(DIARIO);
  const rifiuti: string[] = [];

  /* ── ① la catena vera, sui concetti oggi aperti ─────────────────────────────────── */
  const clientA = new HeuresysClient({ baseUrl: API, session: { cookieAccess: access, cookieCsrf: csrf, csrf } });
  const contatoreA = new ContatorePersone(soglie);
  clientA.collegaContatore(contatoreA);
  const atlante = AtlasOperationResolver.load();
  const gateA = makeCanUseTool(async () => false, {
    audit: sink, persone: contatoreA, operations: atlante, allowlist: DEFAULT_TOOL_ALLOWLIST,
    principal: { principal: "user", tenant: "RTL_BANK" },
  });

  // I PERCORSI si leggono dall'atlante generato, non si indovinano: e' la stessa mappa da cui
  // il gate ricava il metodo, quindi il concetto e la rotta non possono divergere.
  const mappa = JSON.parse(readFileSync(join(RADICE, "docs", "kb", "atlas", "agent-operations.json"), "utf8")) as {
    concepts: Record<string, { operations: Record<string, { method: string; path: string }> }>;
  };
  const apertiDaProvare = ["positions", "organization-units", "job-roles", "content"];
  let righeA = 0;
  for (const concetto of apertiDaProvare) {
    const op = mappa.concepts[concetto]?.operations["get"];
    if (!op || !atlante.methodOf(concetto, "get")) {
      console.log(`  (1) ${concetto}: non aperto o senza operazione di elenco - salto`);
      continue;
    }
    const esito = await gateA(STRUMENTO, { conceptId: concetto, operationId: "get" });
    if (esito.behavior !== "allow") { rifiuti.push(`(1) ${concetto} negato: ${esito.message}`); continue; }
    let righe = 0;
    try {
      const rotta = `/${concetto}${op.path === "/" ? "" : op.path}`;
      const risposta = await clientA.call<{ items?: unknown[] }>(op.method, `${rotta}?limit=100`);
      righe = Array.isArray(risposta.items) ? risposta.items.length : 0;
    } catch (e) {
      rifiuti.push(`(1) ${concetto} lettura fallita: ${String(e)}`);
      continue;
    }
    righeA += righe;
    console.log(`  (1) ${concetto} (/${concetto}): ${righe} righe -> persone distinte cumulate ${contatoreA.conta()} (${contatoreA.livello()})`);
  }
  await registraChiusuraConversazione(sink, { principal: "user", tenant: "RTL_BANK" }, contatoreA);
  console.log(`  ① TOTALE: ${righeA} righe lette, ${contatoreA.conta()} persone distinte, livello ${contatoreA.livello()}`);

  /* ── ② le quattro ampiezze della dottrina, in UNA conversazione ─────────────────── */
  const clientB = new HeuresysClient({ baseUrl: API, session: { cookieAccess: access, cookieCsrf: csrf, csrf } });
  const contatoreB = new ContatorePersone(soglie);
  clientB.collegaContatore(contatoreB);
  const gateB = makeCanUseTool(async () => false, {
    audit: sink, persone: contatoreB, operations: RISOLUTORE_USERS, allowlist: DEFAULT_TOOL_ALLOWLIST,
    principal: { principal: "user", tenant: "RTL_BANK" },
  });

  const AMPIEZZE = [1, 7, 38, 160];
  const misurate: Array<{ chieste: number; persone: number; livello: string }> = [];
  for (const quante of AMPIEZZE) {
    const esito = await gateB(STRUMENTO, { conceptId: "users", operationId: "get_list" });
    if (esito.behavior !== "allow") { rifiuti.push(`② limit=${quante} negato: ${esito.message}`); continue; }
    const risposta = await clientB.call<{ items?: unknown[] }>("GET", `/users?limit=${quante}&offset=0`);
    const righe = Array.isArray(risposta.items) ? risposta.items.length : 0;
    misurate.push({ chieste: quante, persone: contatoreB.conta(), livello: contatoreB.livello() });
    console.log(`  ② limit=${quante}: ${righe} righe → ${contatoreB.conta()} persone distinte, livello ${contatoreB.livello()}`);
  }
  await registraChiusuraConversazione(sink, { principal: "user", tenant: "RTL_BANK" }, contatoreB);

  /* ── il verdetto, letto dal DIARIO ──────────────────────────────────────────────── */
  await new Promise((r) => setTimeout(r, 300)); // il gate scrive il diario in `void`: si attende
  const voci = diario();
  const chiusure = voci.filter((v) => v.reason === RAGIONE_CHIUSURA);
  const numeriNelDiario = new Set(voci.map((v) => v.personeDistinte).filter((n): n is number => n !== undefined));

  console.log(`\n--- DIARIO (${DIARIO}) — ${voci.length} voci ---`);
  for (const v of voci) {
    console.log(`  ${v.ts} ${v.decision.padEnd(5)} ${(v.concept ?? v.tool).padEnd(22)} ` +
      `persone=${v.personeDistinte ?? "—"} livello=${v.livelloPersone ?? "—"} ${v.reason}`);
  }

  const criteri: Array<[string, boolean, string]> = [
    ["① la catena vera legge e conta su un perimetro aperto",
      contatoreA.conta() > 0,
      `${contatoreA.conta()} persone distinte su ${righeA} righe`],
    ["① conta PERSONE, non righe (il conto è molto minore delle righe)",
      righeA > 0 && contatoreA.conta() < righeA,
      `${contatoreA.conta()} < ${righeA}`],
    ["② le quattro ampiezze danno esattamente 1 · 7 · 38 · 160",
      AMPIEZZE.every((n, i) => misurate[i]?.persone === n),
      misurate.map((m) => m.persone).join(" · ")],
    ["② i livelli attraversano silenzioso → dichiarato → confermato",
      misurate[0]?.livello === "silenzioso" && misurate[1]?.livello === "silenzioso" &&
      misurate[2]?.livello === "dichiarato" && misurate[3]?.livello === "confermato",
      misurate.map((m) => m.livello).join(" → ")],
    ["il diario porta i quattro numeri della dottrina",
      [1, 7, 38, 160].every((n) => numeriNelDiario.has(n)),
      [...numeriNelDiario].sort((a, b) => a - b).join(",")],
    ["le due voci di chiusura portano il totale finale",
      chiusure.length === 2 && chiusure.at(-1)?.personeDistinte === 160 &&
      chiusure.at(-1)?.livelloPersone === "confermato",
      chiusure.map((c) => `${c.personeDistinte}/${c.livelloPersone}`).join(" ")],
    ["nessuna lettura è stata rifiutata dal gate",
      rifiuti.length === 0,
      rifiuti.join(" | ") || "nessun rifiuto"],
  ];

  console.log(`\n--- VERDETTO ---`);
  let rossi = 0;
  for (const [nome, ok, dettaglio] of criteri) {
    if (!ok) rossi += 1;
    console.log(`  [${ok ? "ok " : "ROSSO"}] ${nome} → ${dettaglio}`);
  }
  console.log(rossi === 0 ? `\n#251 F5 — VERDE (${criteri.length} criteri)` : `\n#251 F5 — ROSSO (${rossi} criteri)`);
  // `process.exitCode`, non `process.exit()`: dentro una catena di fetch su Windows
  // `process.exit()` aborta Node con UV_HANDLE_CLOSING e l'uscita si legge come un guasto.
  process.exitCode = rossi === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error("DIMOSTRAZIONE FALLITA:", e);
  process.exitCode = 1;
});
