/**
 * apps/api/scripts/verify-collaudo-login.mjs
 * #169 F2 — la prova che la via d'ingresso di collaudo FUNZIONA, e che la
 * separazione delle chiavi e' REALE. Tre asserzioni, e la terza e' il cuore
 * della voce #169:
 *
 *   1. la password di collaudo ENTRA — in un passo solo se l'identita' e'
 *      esente (SERVICE + esenzione MFA), in due passi se non lo e' (#258:
 *      `mfaExempt: false` cammina la sfida vera, come le persone RTL)
 *   2. una password sbagliata e' respinta (401) — senza il caso negativo
 *      staremmo provando "sono entrato", non "chi non ha la chiave resta fuori"
 *   3. la password DERIVATA DALLA CHIAVE MADRE e' respinta (401): chi ha la
 *      chiave madre delle persone non ottiene NULLA sulle utenze di collaudo
 *
 *   node scripts/verify-collaudo-login.mjs [baseUrl]
 */
import { readMaster, derivePassword } from "./derive-access.mjs";
import { readCollaudoKey, deriveCollaudoPassword, COLLAUDO_IDENTITIES } from "./collaudo-access.mjs";
import { totpSecretFor, caricaSegretiTotp } from "../test/helpers/mfa-fixture-secrets.js";
import * as OTPAuth from "otpauth";

const base = process.argv[2] ?? "http://localhost:3001";
const key = readCollaudoKey();

function totpFor(email) {
  return new OTPAuth.TOTP({
    algorithm: "SHA1", digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(totpSecretFor(email)),
  }).generate();
}

async function login(email, pw, mfaCode, challengeToken) {
  const r = await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: pw, ...(mfaCode ? { mfaCode, challengeToken } : {}) }),
  });
  const b = await r.json().catch(() => ({}));
  return { status: r.status, mfa: b.status === "mfa_required", challengeToken: b.challengeToken,
           cookies: r.headers.getSetCookie?.().length ?? 0 };
}

await caricaSegretiTotp();

let tutteOk = true;
for (const c of COLLAUDO_IDENTITIES) {
  const esente = c.mfaExempt !== false;
  let ok = await login(c.email, deriveCollaudoPassword(key, c.email));
  let step2 = null;
  if (!esente && ok.mfa) {
    step2 = await login(c.email, deriveCollaudoPassword(key, c.email), totpFor(c.email), ok.challengeToken);
  }
  const ko = await login(c.email, "password-sbagliata-di-proposito");
  let madre = { status: "n/a" };
  try {
    madre = await login(c.email, derivePassword(readMaster(), c.email));
  } catch {
    madre = { status: "chiave madre non disponibile qui: caso non eseguibile" };
  }
  const esitoLogin = esente
    ? ok.status === 200 && !ok.mfa && ok.cookies > 0
    : ok.status === 200 && ok.mfa && step2?.status === 200 && step2.cookies > 0;
  const pass = esitoLogin && ko.status === 401 && madre.status === 401;
  tutteOk = tutteOk && pass;
  console.log(`
  ${c.email}  (${c.roleCode} su ${c.tenantCode}, ${esente ? "ESENTE" : "MFA VERA (#258)"})
    password di COLLAUDO ........ HTTP ${ok.status}, mfa_required=${ok.mfa}${step2 ? `, step2=HTTP ${step2.status} cookie=${step2.cookies}` : `, cookie=${ok.cookies}`}
    password ERRATA ............. HTTP ${ko.status}
    password da CHIAVE MADRE .... HTTP ${madre.status}   <- la separazione, misurata
    ${pass ? "OK" : "FALLITA"}`);
}

console.log(tutteOk
  ? "\nESITO: OK — il collaudo entra (esente in un passo, #258 in due), la chiave madre non apre niente\n"
  : "\nESITO: FALLITO — atteso 200 (senza MFA se esente, con MFA vera altrimenti), 401 con errata e con chiave madre\n");
process.exit(tutteOk ? 0 : 1);
