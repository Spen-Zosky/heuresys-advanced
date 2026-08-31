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

/**
 * ⚠ QUESTO STRUMENTO DICHIARAVA «FALLITO» UN LOGIN PERFETTAMENTE SANO (corretto 2026-08-31).
 *
 * Il criterio era `ok.step === 2`, cioe' pretendeva che il secondo fattore venisse chiesto.
 * Ma in produzione `MFA_ENFORCEMENT_ENABLED` e' **false** per decisione di Enzo (S1029): il
 * login si conclude al passo 1, e lo strumento bocciava un accesso riuscito. Misurato oggi su
 * `federica.marchetti@rtl-bank.org`: password derivata -> 200 al passo 1, password errata ->
 * 401. Tutto giusto, verdetto «FALLITO».
 *
 * E' lo stesso difetto dei due casi MFA di `#219` F1, e si cura allo stesso modo: **si osserva
 * il comportamento invece di pretendere una configurazione**. Cio' che questo strumento deve
 * garantire e' una cosa sola, e non dipende dall'MFA — *entra chi ha la password, e viene
 * respinto chi non ce l'ha*. Se poi il secondo fattore viene chiesto, allora dev'essere
 * superato: quel caso resta controllato, ma solo quando esiste.
 */
const secondoFattoreChiesto = ok.step === 2;
const entra = ok.status === 200;
const respinto = ko.status === 401;

// Il rate-limit non e' ne' un successo ne' un fallimento delle credenziali: e' il presidio
// anti-tentativi che ha fatto il suo mestiere dopo prove ravvicinate. Dichiararlo «FALLITO»
// farebbe sospettare le credenziali; dichiararlo «OK» sarebbe peggio. Non si e' potuto
// guardare, e si dice — exit 4, la convenzione del cieco dichiarato usata dal guardiano.
if (ok.status === 429 || ko.status === 429) {
  console.log("  ESITO: NON MISURABILE — il presidio anti-tentativi ha risposto 429.");
  console.log("         Non e' un giudizio sulle credenziali: si riprova fra qualche minuto.\n");
  process.exit(4);
}

const pass = entra && respinto;
if (pass) {
  console.log(`  secondo fattore ................ ${secondoFattoreChiesto ? "richiesto, e superato" : "non richiesto (MFA spento su questo ambiente)"}`);
  console.log("  ESITO: OK — entra chi ha la password, viene respinto chi non ce l'ha\n");
} else {
  const perche = !entra
    ? `chi HA la password non entra (HTTP ${ok.status} al passo ${ok.step})`
    : `chi NON ha la password non viene respinto (HTTP ${ko.status}, atteso 401)`;
  console.log(`  ESITO: FALLITO — ${perche}\n`);
}
process.exit(pass ? 0 : 1);
