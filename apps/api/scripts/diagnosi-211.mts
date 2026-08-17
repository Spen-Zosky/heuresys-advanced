/**
 * apps/api/scripts/diagnosi-211.mts — il triage di #211, misurato invece che dedotto.
 *
 * I casi E2E rossi dicono «element(s) not found» su elementi che NEL CODICE ESISTONO:
 * sono condizionali, e non compaiono quando i dati sotto sono vuoti. Questo script chiede
 * agli endpoint che alimentano quelle pagine quante righe restituiscono, con un login
 * reale. Un elenco vuoto qui spiega la pagina vuota là — e sposta la causa dal frontend
 * ai dati, che e' l'unica differenza che conta per decidere cosa correggere.
 *
 *   cd apps/api && pnpm exec tsx scripts/diagnosi-211.mts [http://localhost:3001]
 */
import * as OTPAuth from "otpauth";
import { passwordFor } from "../test/helpers/personas.js";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const ATTORE = process.env.DIAG_EMAIL ?? "enzo.spenuso@heuresys.com";

const ENDPOINT = [
  "/v1/insights/flight-risk",
  "/v1/insights/skill-gap",
  "/v1/insights/succession-readiness",
  "/v1/compensation/variable-pay",
  "/v1/compensation/reward-gates",
  "/v1/compensation/distribution",
];

function totp(email: string): string | null {
  const s = FIXTURE_TOTP_SECRETS[email];
  if (!s) return null;
  return new OTPAuth.TOTP({
    algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(s),
  }).generate();
}

async function accedi(email: string): Promise<string> {
  const password = passwordFor(email);
  const post = (p: Record<string, unknown>) =>
    fetch(`${BASE}/v1/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p),
    });
  type B = { status?: string; challengeToken?: string; csrfToken?: string };
  let r = await post({ email, password });
  let b = (await r.json()) as B;
  if (b.status === "mfa_required") {
    r = await post({ email, password, challengeToken: b.challengeToken, mfaCode: totp(email) });
    b = (await r.json()) as B;
  }
  if (!b.csrfToken) throw new Error(`login fallito: ${JSON.stringify(b)}`);
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

async function main(): Promise<void> {
  const cookie = await accedi(ATTORE);
  console.log(`# diagnosi #211 — ${BASE} — ${ATTORE} — ${new Date().toISOString()}\n`);
  let vuoti = 0;
  for (const ep of ENDPOINT) {
    const r = await fetch(`${BASE}${ep}`, { headers: { cookie } });
    let n = -1;
    let nota = "";
    try {
      const j = (await r.json()) as { items?: unknown[]; total?: number };
      if (Array.isArray(j)) n = j.length;
      else if (Array.isArray(j.items)) n = j.items.length;
      else if (typeof j.total === "number") n = j.total;
      else nota = " (forma non riconosciuta)";
    } catch { nota = " (corpo non JSON)"; }
    if (n === 0) vuoti += 1;
    console.log(`  ${String(r.status).padEnd(4)} ${ep.padEnd(45)} righe: ${n < 0 ? "?" : n}${nota}`);
  }
  console.log(`\n  endpoint che rispondono VUOTO: ${vuoti} su ${ENDPOINT.length}`);
  console.log(
    vuoti === 0
      ? "\nVERDETTO: i dati ci sono — la causa dei casi rossi NON e' un elenco vuoto"
      : "\nVERDETTO: alcuni elenchi sono vuoti — le pagine non hanno cosa mostrare, e i casi cercano elementi condizionali",
  );
}

main().catch((e) => {
  console.error("ERRORE:", e instanceof Error ? e.message : e);
  process.exit(2);
});
