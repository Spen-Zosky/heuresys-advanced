/**
 * apps/api/test/helpers/login.ts
 * S983 WS-E — shared DUAL-MODE login for the integration suite.
 *
 * Every per-file `login()` helper used to inject POST /v1/auth/login and
 * assert a 200. With the mandatory-MFA policy live that response is a state
 * machine: `success` | `mfa_required` (verified factor → TOTP step-2) |
 * `mfa_enrollment_required` (in-scope, factor-less). `loginRaw` absorbs the
 * machine and ALWAYS returns the final full-session response, so the
 * per-file cookie/csrf/user extraction keeps working unchanged on BOTH a
 * policy-OFF and a policy-ON database (the E2 gate proves the suite green on
 * an unmutated DB before any flip).
 *
 *   success                  → returned as-is (policy OFF / out-of-scope)
 *   mfa_required             → step-2 with the fixture TOTP → final response
 *   mfa_enrollment_required  → throw LOUD: the fixture factor is missing —
 *                              run `pnpm db:seed-test-admin` (E4 seeder).
 */
import * as OTPAuth from "otpauth";
import type { Pool } from "pg";
import { E2E_FIXTURE_LABEL, FIXTURE_TOTP_SECRETS } from "./mfa-fixture-secrets.js";
import { passwordFor, TEST_PERSONA_PASSWORD } from "./personas.js";
import { contaLoginVero, leggiSessione, salvaSessione } from "./session-cache.js";

/** Anything with a Fastify-style inject() (the TestApp's instance). */
interface Injectable {
  inject(opts: {
    method: "POST";
    url: string;
    payload: Record<string, unknown>;
  }): Promise<InjectResponse>;
}
interface InjectResponse {
  statusCode: number;
  body: string;
  cookies: Array<{ name: string; value: string }>;
  headers: Record<string, string | string[] | number | undefined>;
  json(): unknown;
}

/**
 * Z-251 F2 — ricostruisce la forma di una risposta `inject` da una sessione salvata.
 * I 190 file che passano di qui leggono `statusCode`, `cookies`, `headers` e `json()`:
 * l'oggetto deve offrirli tutti e quattro, o il riuso si vedrebbe come un guasto altrove.
 * `json()` ri-analizza il body a ogni chiamata, esattamente come fa Fastify.
 */
function rispostaDaCache(s: {
  statusCode: number;
  body: string;
  cookies: Array<{ name: string; value: string }>;
  headers: Record<string, string | string[] | number | undefined>;
}): InjectResponse {
  return {
    statusCode: s.statusCode,
    body: s.body,
    cookies: s.cookies,
    headers: s.headers,
    json: () => JSON.parse(s.body) as unknown,
  };
}

/** Current TOTP code for a fixture persona (server validates with ±1 window). */
export function totpFor(email: string): string {
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (!secret) {
    throw new Error(`No fixture TOTP secret for ${email} — add it to helpers/mfa-fixture-secrets.ts`);
  }
  return new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

/**
 * Dual-mode login → the FINAL full-session response (status "success", with
 * ACCESS+REFRESH+CSRF cookies and the user payload). Throws loud on anything
 * that is not a completable login.
 */
export async function loginRaw<A extends Injectable>(
  app: A,
  email: string,
  // Z-262: la password non è più UNA condivisa da variabile d'ambiente. Se il
  // chiamante non la passa, si deriva DALL'EMAIL — è ciò che permette ai 161
  // file che passano di qui di impersonare qualunque utente senza cambiare una
  // riga. Passarne una esplicita resta possibile (test di password errata).
  password?: string,
): Promise<Awaited<ReturnType<A["inject"]>>> {
  // Z-262: assente o segnaposto → si deriva dall'email dell'utente che stiamo
  // autenticando. Una password esplicita e diversa passa invariata: i test che
  // verificano il RIFIUTO di una password sbagliata devono continuare a farlo.
  const derivata = password === undefined || password === TEST_PERSONA_PASSWORD;
  const pw = derivata ? passwordFor(email) : password;

  // Z-251 F2: la sessione condivisa. Solo per la password DERIVATA — con una password
  // esplicita il chiamante sta provando il comportamento del login, non usandolo per
  // arrivare altrove, e servirgli una sessione già pronta risponderebbe a una domanda
  // diversa da quella posta. L'access token è un JWT stateless: resta valido anche dopo
  // il rollback della transazione del file che lo ha ottenuto (D-52).
  if (derivata) {
    const salvata = leggiSessione(email);
    if (salvata) return rispostaDaCache(salvata) as Awaited<ReturnType<A["inject"]>>;
  }
  if (derivata) contaLoginVero(email);

  const r1 = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: pw } });
  if (r1.statusCode !== 200) throw new Error(`login ${email}: ${r1.statusCode}`);
  const b1 = r1.json() as { status?: string; challengeToken?: string };
  if (b1.status === "success" || b1.status === undefined) {
    if (derivata) salvaSessione(email, r1);
    return r1 as Awaited<ReturnType<A["inject"]>>;
  }
  if (b1.status === "mfa_required") {
    const r2 = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: pw, challengeToken: b1.challengeToken, mfaCode: totpFor(email) },
    });
    const b2 = r2.json() as { status?: string };
    if (r2.statusCode !== 200 || b2.status !== "success") {
      // D-55 instrumentation: il flake intermittente è un 500 INTERNAL_ERROR il
      // cui stack VIVE nel log server (`errorHandler` → "Unhandled error"). Il
      // request-id collega questo throw alla riga di log giusta nel run.
      const reqId = r2.headers["x-request-id"];
      throw new Error(
        `login ${email}: TOTP step-2 failed (${r2.statusCode} ${JSON.stringify(b2)}; x-request-id=${String(reqId)} — per il 500 intermittente D-55 cerca "Unhandled error" con questo reqId nel log del run)`,
      );
    }
    if (derivata) salvaSessione(email, r2);
    return r2 as Awaited<ReturnType<A["inject"]>>;
  }
  if (b1.status === "mfa_enrollment_required") {
    throw new Error(
      `login ${email}: mfa_enrollment_required — the fixture TOTP factor is missing. ` +
        "Run `pnpm db:seed-test-admin` (idempotent) to seed the e2e-fixture factors.",
    );
  }
  throw new Error(`login ${email}: unexpected login status "${b1.status}"`);
}

/**
 * Idempotent fixture-factor seeding (check-before-insert keyed on the
 * metadata label — there is NO unique on (user,kind)). Used by suites that
 * wipe a persona's factors and must restore the fixture in afterAll. The
 * inserted factor is verified=true with the SINGLE-SOURCE base32 secret, so
 * the login step-2 in loginRaw validates against it (multi-TOTP is safe: the
 * login path validates the code against ALL verified factors).
 */
export async function ensureFixtureTotpFactor(pool: Pool, email: string): Promise<void> {
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (!secret) throw new Error(`No fixture TOTP secret for ${email}`);
  await pool.query(
    `INSERT INTO sys.sys_auth_mfa_factors
       (auth_mfa_factor_user_id, auth_mfa_factor_kind, auth_mfa_factor_secret,
        auth_mfa_factor_metadata, auth_mfa_factor_verified)
     SELECT u.user_id, 'TOTP', $2, jsonb_build_object('label', $3::text), true
       FROM sys.sys_users u
      WHERE lower(u.user_email) = lower($1)
        AND NOT EXISTS (
          SELECT 1 FROM sys.sys_auth_mfa_factors f
           WHERE f.auth_mfa_factor_user_id = u.user_id
             AND f.auth_mfa_factor_kind = 'TOTP'
             AND f.auth_mfa_factor_metadata->>'label' = $3
        )`,
    [email, secret, E2E_FIXTURE_LABEL],
  );
}
