/**
 * apps/api/scripts/verify-derived-login.mjs
 * Z-262 — prova che l'accesso derivato FUNZIONA e che il controllo ESISTE.
 *
 * Due asserzioni, e la seconda è quella che conta: senza il caso negativo si
 * starebbe verificando "sono riuscito a entrare", non "chi non ha la password
 * viene respinto".
 *
 *   node scripts/verify-derived-login.mjs <email> [baseUrl]
 */
import * as OTPAuth from "otpauth";
import { readMaster, derivePassword, deriveTotpSecret } from "./derive-access.mjs";

const email = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3001";
if (!email) {
  console.error("uso: node scripts/verify-derived-login.mjs <email> [baseUrl]");
  process.exit(1);
}

const master = readMaster();
const password = derivePassword(master, email);
const secret = deriveTotpSecret(master, email);
const code = () =>
  new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();

async function login(pw) {
  const r1 = await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: pw }),
  });
  const b1 = await r1.json().catch(() => ({}));
  if (r1.status !== 200) return { step: 1, status: r1.status, body: b1 };
  if (b1.status !== "mfa_required") return { step: 1, status: r1.status, body: b1 };

  const r2 = await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: pw, challengeToken: b1.challengeToken, mfaCode: code() }),
  });
  return { step: 2, status: r2.status, cookies: r2.headers.getSetCookie?.().length ?? 0 };
}

const ok = await login(password);
const ko = await login("password-sbagliata-di-proposito");

console.log(`
  utente                 ${email}
  login con password DERIVATA .... passo ${ok.step}, HTTP ${ok.status}${ok.cookies !== undefined ? `, cookie ricevuti: ${ok.cookies}` : ""}
  login con password ERRATA ...... passo ${ko.step}, HTTP ${ko.status}
`);

const pass = ok.status === 200 && ok.step === 2 && ko.status === 401;
console.log(pass ? "  ESITO: OK — entra chi ha la password, viene respinto chi non ce l'ha\n"
                 : "  ESITO: FALLITO — attesi 200 al passo 2 e 401 con password errata\n");
process.exit(pass ? 0 : 1);
