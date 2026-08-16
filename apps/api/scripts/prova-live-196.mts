/**
 * apps/api/scripts/prova-live-196.mts — prova LIVE di #196 / E22 (S1066).
 *
 * Che cosa dimostra: la pagina «Catalogo KPI» mostrava UN numero solo. Un
 * indicatore pero' puo' essere DI PIATTAFORMA (catalogo comune, confrontabile fra
 * clienti) o DELL'AZIENDA (E22 — quelli di un'azienda sono suoi): sono due specie,
 * e sommarle da' una cifra plausibile che non dice di che cosa parla. Qui si
 * misurano i tre numeri sulla stessa API che alimenta la pagina.
 *
 * ⚠ Il caso e' CIECO finche' la seconda specie ha zero esemplari — e oggi li ha,
 * perche' nessuna azienda e' ancora stata costruita da un fascicolo. Uno zero qui
 * NON vuol dire «a posto»: vuol dire che la prova non ha ancora potuto fallire.
 * La verifica che puo' fallire adesso e' la COERENZA: piattaforma + azienda deve
 * fare esattamente il totale, o uno dei tre filtri sta mentendo.
 *
 *   pnpm exec tsx scripts/prova-live-196.mts [http://localhost:3001]
 */
import * as OTPAuth from "otpauth";
import { passwordFor } from "../test/helpers/personas.js";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const ADMIN = "enzo.spenuso@heuresys.com";

function totp(email: string): string {
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (!secret) throw new Error(`nessun secondo fattore di prova per ${email}`);
  return new OTPAuth.TOTP({
    algorithm: "SHA1", digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

const post = (payload: Record<string, unknown>): Promise<Response> =>
  fetch(`${BASE}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

async function main(): Promise<void> {
  const password = passwordFor(ADMIN);
  type Body = { status?: string; challengeToken?: string; csrfToken?: string };
  let r = await post({ email: ADMIN, password });
  let b = (await r.json()) as Body;
  if (b.status === "mfa_required") {
    r = await post({ email: ADMIN, password, challengeToken: b.challengeToken, mfaCode: totp(ADMIN) });
    b = (await r.json()) as Body;
  }
  if (!b.csrfToken) throw new Error(`login fallito: ${JSON.stringify(b)}`);
  const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

  const totale = async (q: string): Promise<number> =>
    ((await (await fetch(`${BASE}/v1/kpi-definitions?${q}`, { headers: { cookie } })).json()) as {
      total: number;
    }).total;

  const tot = await totale("limit=1");
  const azienda = await totale("isGlobal=false&limit=1");
  const piattaforma = await totale("isGlobal=true&limit=1");

  console.log(`# prova LIVE #196 (E22) — ${BASE} — ${new Date().toISOString()}`);
  console.log(`  totale (quello che la pagina mostrava da solo) : ${tot}`);
  console.log(`  di piattaforma                                 : ${piattaforma}`);
  console.log(`  dell'azienda                                   : ${azienda}`);
  console.log(`  la pagina ora dice: "${tot} KPI definiti — ${tot - azienda} di piattaforma, ${azienda} dell'azienda"`);

  const coerente = piattaforma + azienda === tot;
  console.log(`\n  coerenza piattaforma+azienda = totale : ${coerente ? "SI" : `NO — ${piattaforma}+${azienda} != ${tot}`}`);
  console.log(
    azienda === 0
      ? "  ⚠ CIECO sulla seconda specie: zero esemplari, nessuna azienda ancora costruita da un fascicolo"
      : "  la seconda specie ha esemplari: il numero unico era davvero misto",
  );
  console.log(`\nVERDETTO: ${coerente ? "le due specie sono dichiarate e la somma torna" : "INCOERENTE"}`);
  process.exit(coerente ? 0 : 1);
}

main().catch((e) => {
  console.error("ERRORE:", e instanceof Error ? e.message : e);
  process.exit(2);
});
