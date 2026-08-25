/**
 * apps/api/scripts/verify-collaudo-login.mjs
 * #169 F2 — la prova che la via d'ingresso di collaudo FUNZIONA, e che la
 * separazione delle chiavi e' REALE. Tre asserzioni, e la terza e' il cuore
 * della voce #169:
 *
 *   1. la password di collaudo ENTRA, in un passo solo (SERVICE + esenzione
 *      MFA: nessun secondo fattore, nessun mfa_required)
 *   2. una password sbagliata e' respinta (401) — senza il caso negativo
 *      staremmo provando "sono entrato", non "chi non ha la chiave resta fuori"
 *   3. la password DERIVATA DALLA CHIAVE MADRE e' respinta (401): chi ha la
 *      chiave madre delle persone non ottiene NULLA sulle utenze di collaudo
 *
 *   node scripts/verify-collaudo-login.mjs [baseUrl]
 */
import { readMaster, derivePassword } from "./derive-access.mjs";
import { readCollaudoKey, deriveCollaudoPassword, COLLAUDO_IDENTITIES } from "./collaudo-access.mjs";

const base = process.argv[2] ?? "http://localhost:3001";
const key = readCollaudoKey();

async function login(email, pw) {
  const r = await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: pw }),
  });
  const b = await r.json().catch(() => ({}));
  return { status: r.status, mfa: b.status === "mfa_required",
           cookies: r.headers.getSetCookie?.().length ?? 0 };
}

let tutteOk = true;
for (const c of COLLAUDO_IDENTITIES) {
  const ok = await login(c.email, deriveCollaudoPassword(key, c.email));
  const ko = await login(c.email, "password-sbagliata-di-proposito");
  let madre = { status: "n/a" };
  try {
    madre = await login(c.email, derivePassword(readMaster(), c.email));
  } catch {
    madre = { status: "chiave madre non disponibile qui: caso non eseguibile" };
  }
  const pass = ok.status === 200 && !ok.mfa && ok.cookies > 0
            && ko.status === 401
            && (madre.status === 401 || typeof madre.status === "string");
  tutteOk = tutteOk && pass && madre.status === 401;
  console.log(`
  ${c.email}  (${c.roleCode} su ${c.tenantCode})
    password di COLLAUDO ........ HTTP ${ok.status}, mfa_required=${ok.mfa}, cookie=${ok.cookies}
    password ERRATA ............. HTTP ${ko.status}
    password da CHIAVE MADRE .... HTTP ${madre.status}   <- la separazione, misurata
    ${pass ? "OK" : "FALLITA"}`);
}

console.log(tutteOk
  ? "\nESITO: OK — il collaudo entra in un passo, la chiave madre non apre niente\n"
  : "\nESITO: FALLITO — attesi 200 senza MFA col collaudo, 401 con errata e con chiave madre\n");
process.exit(tutteOk ? 0 : 1);
