/**
 * apps/api/scripts/prova-live-124-d4.mts — prova LIVE di #124 D4 (S1054).
 *
 * Definition of Done del progetto: nessuno step si chiude su green-test. Questa
 * prova non usa `app.inject()`: parla HTTP con l'API in esecuzione, con login
 * reale di due persone (password derivata + secondo fattore), e confronta LA
 * STESSA RIGA letta dai due attori.
 *
 *   pnpm exec tsx scripts/prova-live-124-d4.mts [http://localhost:3001]
 */
import * as OTPAuth from "otpauth";
import { passwordFor } from "../test/helpers/personas.js";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const PLATFORM = "enzo.spenuso@heuresys.com";
const HR = "federica.marchetti@rtl-bank.org";

function totp(email: string): string {
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (!secret) throw new Error(`nessun secondo fattore di prova per ${email}`);
  return new OTPAuth.TOTP({
    algorithm: "SHA1", digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

/** Login HTTP reale, secondo fattore compreso. Ritorna l'header Cookie. */
async function login(email: string): Promise<string> {
  const password = passwordFor(email);
  const post = async (payload: Record<string, unknown>) =>
    fetch(`${BASE}/v1/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

  let r = await post({ email, password });
  let body = (await r.json()) as { status?: string; challengeToken?: string };
  if (body.status === "mfa_required") {
    r = await post({ email, password, challengeToken: body.challengeToken, mfaCode: totp(email) });
    body = (await r.json()) as { status?: string };
  }
  if (r.status !== 200 || (body.status !== "success" && body.status !== undefined)) {
    throw new Error(`login ${email}: ${r.status} ${JSON.stringify(body)}`);
  }
  const cookies = (r.headers as unknown as { getSetCookie(): string[] }).getSetCookie();
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

async function get(cookie: string, path: string): Promise<{ raw: string; items: Record<string, unknown>[] }> {
  const r = await fetch(`${BASE}${path}`, { headers: { cookie } });
  const raw = await r.text();
  if (r.status !== 200) throw new Error(`GET ${path}: ${r.status} ${raw.slice(0, 200)}`);
  const j = JSON.parse(raw) as { items?: Record<string, unknown>[] };
  return { raw, items: j.items ?? [] };
}

let difformi = 0;
function verifica(ok: boolean, testo: string): void {
  if (!ok) difformi++;
  console.log(`  [${ok ? "OK " : "DIFFORME"}] ${testo}`);
}

const CASI = [
  { path: "/v1/predictions?limit=200", campi: ["confidence", "details", "label", "value"],
    resta: "subjectUserId", spie: ["salary_percentile", "performance_rating", "is_high_potential"] },
  { path: "/v1/talent-review/nine-box?limit=200",
    campi: ["band", "performance", "performanceBand", "potential", "potentialBand"],
    resta: "subjectUserName", spie: [] },
  { path: "/v1/talent-review/fit?limit=200", campi: ["payload", "score"], resta: "dimension", spie: [] },
  { path: "/v1/talent-review/readiness?limit=200", campi: ["payload", "value"], resta: "horizon", spie: [] },
  { path: "/v1/talent-review/succession?limit=200", campi: ["payload", "value"], resta: "positionId", spie: [] },
];

console.log(`PROVA LIVE #124 D4 — ${BASE} — ${new Date().toISOString()}`);
const cPlatform = await login(PLATFORM);
const cHr = await login(HR);
console.log(`login reali: ${PLATFORM} (mandato piattaforma) · ${HR} (mandato HR)\n`);

for (const caso of CASI) {
  console.log(`── ${caso.path}`);
  const p = await get(cPlatform, caso.path);
  const h = await get(cHr, caso.path);
  verifica(p.items.length > 0 && h.items.length > 0,
    `righe viste: platform ${p.items.length}, HR ${h.items.length} (la RIGA resta visibile a entrambi)`);

  const senzaMask = p.items.filter((r) => JSON.stringify(r["masked"]) !== JSON.stringify([...caso.campi].sort()));
  verifica(senzaMask.length === 0, `tutte le ${p.items.length} righe dichiarano masked=[${caso.campi.join(", ")}]`);

  const presenti = p.items.filter((r) => caso.campi.some((f) => Object.hasOwn(r, f)));
  verifica(presenti.length === 0, `nessun campo di giudizio presente per il platform (${presenti.length} righe difformi)`);

  verifica(p.items.every((r) => Object.hasOwn(r, caso.resta)), `«${caso.resta}» RESTA per il platform`);
  verifica(h.items.every((r) => r["masked"] === undefined), "l'HR legge in chiaro (I20)");
  verifica(h.items.some((r) => Object.hasOwn(r, caso.campi[0]!)),
    `l'HR vede «${caso.campi[0]}» — senza questo il confronto sarebbe cieco`);

  for (const spia of caso.spie) {
    verifica(!p.raw.includes(spia), `«${spia}» assente dal corpo grezzo del platform`);
    verifica(h.raw.includes(spia), `«${spia}» presente per l'HR (controprova)`);
  }
}

console.log(`\nESITO: ${difformi === 0 ? "VERDE" : `ROSSO (${difformi} difformi)`}`);
process.exit(difformi === 0 ? 0 : 1);
