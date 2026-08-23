/**
 * #219 F3/F — RIPRODUZIONE della firma, prima di correggerla.
 *
 * LA FIRMA registrata dal triage di `#211` F4: «il locator `me-team-name` risolve a 14
 * elementi, e le squadre che si chiamano "CFO" nel database sono una: quindi non è un dato
 * ambiguo, è un testid ripetuto nella pagina».
 *
 * ⚠ MA `me-team-name` STA DENTRO UN `.map()`, uno per card (me/team/page.tsx:50): non è
 * ripetuto per errore, è uno per squadra. Quattordici elementi vogliono dire QUATTORDICI
 * CARD — cioè la pagina mostra quattordici squadre. E la persona del caso
 * (`antonio.parisi`, che il test descrive come «belongs to exactly one team») ne ha **1**
 * nel database, misurato. La domanda giusta non era quante squadre si chiamano CFO: era
 * quante ne ha LEI.
 *
 * Se `GET /v1/me/team` restituisce più della sua, non è un guasto estetico dei test — è un
 * guasto di PERIMETRO: una pagina `/me/*` che mostra squadre altrui a chi non ne fa parte.
 *
 * QUESTA PROVA DEVE POTER FALLIRE: se la rotta restituisse esattamente 1, l'ipotesi sarebbe
 * sbagliata e le 14 card verrebbero da altro (un rendering che duplica, un dato di test).
 *
 * Uso (con l'API su :3001):  cd apps/api && pnpm exec tsx scripts/prova-219-f-mie-squadre.mts
 */
import { createHmac } from "node:crypto";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";
import { passwordFor } from "../test/helpers/personas.js";

const API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");
const ATTORE = process.env.ATTORE ?? "antonio.parisi@rtl-bank.org";   // `outsider`

function base32Decode(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(ch);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(s: string): string {
  const key = base32Decode(s);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = createHmac("sha1", key).update(buf).digest();
  const o = h[h.length - 1]! & 0x0f;
  const code = ((h[o]! & 0x7f) << 24) | ((h[o + 1]! & 0xff) << 16) | ((h[o + 2]! & 0xff) << 8) | (h[o + 3]! & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}
async function login(email: string): Promise<string> {
  const password = passwordFor(email);
  const ck = (r: Response) => (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const r1 = await fetch(`${API}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j1 = (await r1.json()) as { status: string; challengeToken?: string };
  if (j1.status === "success") return ck(r1);
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (j1.status !== "mfa_required" || !j1.challengeToken || !secret) {
    throw new Error(`login inatteso: ${JSON.stringify(j1)}`);
  }
  const r2 = await fetch(`${API}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, challengeToken: j1.challengeToken, mfaCode: totp(secret) }),
  });
  const j2 = (await r2.json()) as { status: string };
  if (j2.status !== "success") throw new Error(`secondo fattore fallito: ${JSON.stringify(j2)}`);
  return ck(r2);
}

async function main(): Promise<void> {
  console.log(`=== #219 F3/F — quante squadre mostra /v1/me/team a chi ne ha UNA ===\n`);
  const cookies = await login(ATTORE);
  console.log(`[login] ${ATTORE}\n`);

  const r = await fetch(`${API}/v1/me/team`, { headers: { cookie: cookies } });
  const testo = await r.text();
  let squadre: Array<{ name?: string; code?: string }> = [];
  try {
    // La chiave è `teams`. La prima stesura leggeva `items` — la convenzione delle liste
    // `/v1/*` — e riportava «0 squadre»: un difetto della MISURA che si presentava come un
    // guasto del prodotto, e sarebbe passato per tale senza la stampa del corpo grezzo.
    const b = JSON.parse(testo) as { teams?: typeof squadre; items?: typeof squadre } | typeof squadre;
    squadre = Array.isArray(b) ? b : (b.teams ?? b.items ?? []);
  } catch { /* lasciato a `testo` qui sotto */ }

  console.log(`GET /v1/me/team → HTTP ${r.status} · ${squadre.length} squadre`);
  for (const s of squadre.slice(0, 20)) console.log(`   · ${s.code ?? "?"} — ${s.name ?? "?"}`);
  // Il corpo grezzo si stampa anche quando la risposta e' OK ma l'elenco esce vuoto: la
  // forma potrebbe non essere quella che questo script suppone, e «0 squadre» sarebbe un
  // difetto della MISURA travestito da difetto del prodotto.
  if (squadre.length === 0) console.log(`   corpo grezzo: ${testo.slice(0, 400)}`);

  const esiti: Array<[string, boolean]> = [
    ["la rotta risponde", r.ok],
    ["restituisce ESATTAMENTE le squadre di chi chiama (per antonio.parisi: 1)", squadre.length === 1],
  ];
  console.log("");
  let rossi = 0;
  for (const [che, ok] of esiti) { console.log(`  ${ok ? "[ok]" : "[NO]"} ${che}`); if (!ok) rossi += 1; }
  if (rossi > 0) {
    console.error(`\nESITO: ${rossi} rossi — la pagina mostra squadre che non sono di chi guarda.`);
    console.error(`Non e' un difetto dei test: e' il PERIMETRO di una pagina /me/*.`);
    process.exit(1);
  }
  console.log("\nESITO: la rotta e' corretta — le 14 card vengono da altro, e va cercato nella pagina.");
}

main().catch((e) => { console.error(`ERRORE: ${e instanceof Error ? e.message : String(e)}`); process.exit(1); });
