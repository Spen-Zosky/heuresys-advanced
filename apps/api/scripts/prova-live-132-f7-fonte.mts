/**
 * apps/api/scripts/prova-live-132-f7-fonte.mts
 * #132 F7 — LA PRIMA FONTE APPROVATA DEL REGISTRO.
 *
 * L'approvazione e' una decisione di Enzo (richiesta esplicita del 2026-08-05:
 * «l'elenco delle fonti ammesse non lo scrive nessuno a mano: nasce da una
 * ricerca e lo approva Enzo»), data il 2026-08-25 su `bancaditalia.it`. Questo
 * script la ESEGUE passando dalle rotte reali, non dal database:
 *
 *   1. login reale (utenza di collaudo, #169 F2)
 *   2. POST /v1/seed-candidate-records/:id/decision   la decisione motivata
 *   3. POST .../versions/:n/apply-research            il ponte: la fonte nel registro
 *   4. la lettura che verifica: la fonte e' APPROVED, con approvatore e data
 *
 * ⚠ La rotta della decisione e' quella sul CANDIDATO, non `/v1/seed-approval-
 * decisions` (che e' il ledger append-only e NON promuove lo stato della
 * proposta): `apply-research` cerca candidati con `validation_status='APPROVED'`,
 * e solo `researchService.decidi` lo scrive. Scritto qui perche' e' l'errore che
 * ho fatto eseguendo, e dal fuori le due rotte si somigliano.
 *
 * La prova PUO' fallire: se il registro non cambia, o la fonte resta senza
 * approvatore, esce 1.
 *
 *   node --experimental-strip-types scripts/prova-live-132-f7-fonte.mts [baseUrl]
 */
import { Client } from "pg";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";
import { readCollaudoKey, deriveCollaudoPassword } from "./collaudo-access.mjs";

dotenvConfig({ path: resolve(process.cwd(), "..", "..", ".env"), quiet: true });

/**
 * ⚠ Il registro delle fonti NON ha una rotta di lettura (verificato: `app.ts`
 * non registra alcun `/v1/research-sources`). La verifica finale legge quindi
 * il DATABASE, e lo dichiara invece di far credere che passi da un'API. La
 * scrittura, che e' cio' che questa prova deve dimostrare, passa dalle rotte.
 */
async function registro(): Promise<Array<{ host: string; stato: string; chi: string | null; quando: string | null }>> {
  const db = new Client({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5433),
    user: process.env.POSTGRES_USER ?? "heuresys",
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB ?? "heuresys_advanced",
  });
  await db.connect();
  try {
    const r = await db.query(
      `SELECT research_source_host_suffix AS host, research_source_status AS stato,
              research_source_approved_by::text AS chi, research_source_approved_at::text AS quando
         FROM sys.sys_research_sources ORDER BY created_at`);
    return r.rows;
  } finally { await db.end(); }
}

const BASE = process.argv[2] ?? "http://localhost:3001";
const ATTORE = "piattaforma@collaudo.invalid";
const CANDIDATO = "2f161c21-d38c-4554-b336-ff46c2edc071";
const MOTIVAZIONE =
  "APPROVATA da Enzo il 2026-08-25 (S1081): fonte istituzionale della banca centrale, " +
  "autorevole per il dominio bancario di RTL Bank (ATECO 64.19). Prima fonte del registro.";

function cookieHeader(setCookie: string[]): string {
  return setCookie.map((c) => c.split(";")[0]).join("; ");
}
/** Il cookie e' `hrx_csrf` e l'header `x-csrf-token` (COOKIES/HEADERS in
 *  config/constants.ts): i nomi si leggono da li', non si indovinano. */
function csrfFrom(cookie: string): string {
  return cookie.match(/hrx_csrf=([^;]+)/)?.[1] ?? "";
}

const r1 = await fetch(`${BASE}/v1/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: ATTORE, password: deriveCollaudoPassword(readCollaudoKey(), ATTORE) }),
});
if (r1.status !== 200) { console.error(`login fallito: HTTP ${r1.status}`); process.exit(1); }
const cookie = cookieHeader(r1.headers.getSetCookie?.() ?? []);
const csrf = csrfFrom(cookie);
console.log(`  1. login ${ATTORE} .............. HTTP ${r1.status}`);

const prima = await registro();

const H = { "content-type": "application/json", cookie, "x-csrf-token": csrf };
const r2 = await fetch(`${BASE}/v1/seed-candidate-records/${CANDIDATO}/decision`, {
  method: "POST", headers: H,
  body: JSON.stringify({ decisione: "APPROVED", motivazione: MOTIVAZIONE }),
});
const b2 = await r2.json().catch(() => ({}));
console.log(`  2. decisione APPROVED ........... HTTP ${r2.status}${r2.status >= 400 ? ` ${JSON.stringify(b2).slice(0, 200)}` : ""}`);

// la versione del fascicolo su cui gira il ponte: la porta la corsa della proposta
const versione = process.argv[3] ?? "";
let r3status = 0, b3: Record<string, unknown> = {};
if (versione) {
  const [fascicolo, numero] = versione.split("#");
  // `apply-research` non ha body: senza `{}` Fastify rifiuta la richiesta
  // per content-type json e corpo vuoto (FST_ERR_CTP_EMPTY_JSON_BODY).
  const r3 = await fetch(`${BASE}/v1/tenant-blueprints/${fascicolo}/versions/${numero}/apply-research`, {
    method: "POST", headers: H, body: "{}",
  });
  r3status = r3.status;
  b3 = (await r3.json().catch(() => ({}))) as Record<string, unknown>;
  console.log(`  3. apply-research ............... HTTP ${r3status} ${JSON.stringify(b3).slice(0, 220)}`);
} else {
  console.log("  3. apply-research ............... NON ESEGUITO (manca <fascicoloId>#<n> come 2° argomento)");
}

const dopo = await registro();
console.log(`  4. registro fonti (letto dal DB: nessuna rotta lo espone) — prima ${prima.length} · dopo ${dopo.length}`);
for (const f of dopo) {
  console.log(`       ${f.host} · ${f.stato} · approvata da ${f.chi ?? "(nessuno)"} il ${(f.quando ?? "").slice(0, 10)}`);
}

const decisa = r2.status === 200 || r2.status === 201;
const registrata = dopo.some((f) => f.host === "bancaditalia.it" && f.stato === "APPROVED" && f.chi !== null);
console.log(decisa && registrata
  ? "\n  ESITO: OK — la fonte e' decisa E registrata, con approvatore e data\n"
  : `\n  ESITO: INCOMPLETO — decisa=${decisa} registrata=${registrata}\n`);
process.exit(decisa && registrata ? 0 : 1);
