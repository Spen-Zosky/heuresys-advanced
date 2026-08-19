/**
 * apps/api/test/auth-mfa-mandatory.integration.test.ts
 *
 * Mandatory-MFA login gate (MVP-4 par.2.5 #4). Exercises the third /login
 * outcome end-to-end against the live DB:
 *
 *   policy OFF                    -> behaviour identical to pre-#4 (regression)
 *   policy ON, role out of scope  -> success unchanged (role scoping)
 *   policy ON, in scope, no factor-> 200 mfa_enrollment_required + RESTRICTED
 *                                    enr session (ACCESS+CSRF cookies, NO refresh)
 *   enr session                   -> MFA self-service reachable; every
 *                                    permission-gated route 403; refresh 401
 *   enroll TOTP via enr session   -> re-login becomes the regular mfa_required
 *                                    challenge -> full session
 *
 * Isolation: the policy is scoped to roleCodes ["READ_ONLY"] on the gated
 * actor's own tenant, and READ_ONLY is a role no other test file logs in with,
 * so a mid-run crash cannot gate the actors other files depend on. Cleanup in
 * afterAll removes the policy row + the throwaway factor.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as OTPAuth from "otpauth";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";
import { COOKIES } from "../src/config/constants.js";
import { passwordFor } from "./helpers/personas.js";
import { actorWithoutMfaFactor, tenantAdmin, type Actor } from "./helpers/actors.js";

import { senzaCacheDiSessione } from "./helpers/session-cache.js";

// Z-251 F2 — questo file esercita il FLUSSO di autenticazione (login, MFA, rotazione del
// refresh): una sessione presa da un altro file proverebbe qualcosa che il test non sta
// chiedendo. Qui i login sono veri, sempre.
senzaCacheDiSessione();

// Gli attori si scelgono per CARATTERISTICA (test/helpers/actors.ts), non per
// nome: a questo file serve "un utente col ruolo su cui la policy è scoped e
// senza secondo fattore" e "un utente dello STESSO tenant con un ruolo fuori
// scope". Nominarli fissava anche premesse mai verificate — ed è così che
// Z-262, assegnando un fattore MFA a tutti, ha reso rossi cinque test qui.

function genTotp(secretBase32: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: "Heuresys",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  return totp.generate();
}

describe("/v1/auth/login mandatory-MFA gate (#4)", () => {
  let app: TestApp;
  let rtlTenantId: string;
  let gatedUserId: string;
  /** L'utente su cui la policy è scoped (ruolo READ_ONLY), senza secondo fattore. */
  let gated: Actor;
  /** Stesso tenant, ruolo NON incluso nello scope della policy. */
  let outOfScope: Actor;

  async function login(payload: Record<string, unknown>) {
    return app.app.inject({ method: "POST", url: "/v1/auth/login", payload });
  }

  function cookieHeader(resp: { cookies: Array<{ name: string; value: string }> }): string {
    return resp.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  }

  async function setPolicy(enabled: boolean): Promise<void> {
    await pool.query(
      `INSERT INTO sys.sys_auth_mfa_policies
         (auth_mfa_policy_tenant_id, auth_mfa_policy_enabled, auth_mfa_policy_role_codes)
       VALUES ($1, $2, ARRAY['READ_ONLY'])
       ON CONFLICT (auth_mfa_policy_tenant_id) DO UPDATE SET
         auth_mfa_policy_enabled    = EXCLUDED.auth_mfa_policy_enabled,
         auth_mfa_policy_role_codes = EXCLUDED.auth_mfa_policy_role_codes`,
      [rtlTenantId, enabled],
    );
  }

  interface SavedPolicy {
    auth_mfa_policy_enabled: boolean;
    auth_mfa_policy_role_codes: string[] | null;
  }
  let savedPolicy: SavedPolicy | null = null;

  beforeAll(async () => {
    app = await buildTestApp();
    // La precondizione di TUTTO il file è che l'utente gated sia SENZA secondo
    // fattore: è ciò che distingue `mfa_enrollment_required` da `mfa_required`.
    // `actorWithoutMfaFactor` la GARANTISCE invece di sperare che il dato la
    // offra (l'isolamento transazionale D-52 annulla la rimozione a fine file).
    gated = await actorWithoutMfaFactor("READ_ONLY");
    gatedUserId = gated.userId;
    rtlTenantId = gated.tenantId;
    // Stesso tenant: un ruolo fuori scope preso altrove proverebbe l'isolamento
    // fra tenant, non lo scoping per ruolo della policy.
    outOfScope = await tenantAdmin({ tenantId: rtlTenantId });
    // Snapshot the pre-suite RTL policy (restored in afterAll — the live DB may
    // carry a REAL activation that a blanket delete would silently wipe, S982).
    savedPolicy =
      (
        await pool.query<SavedPolicy>(
          `SELECT auth_mfa_policy_enabled, auth_mfa_policy_role_codes
             FROM sys.sys_auth_mfa_policies WHERE auth_mfa_policy_tenant_id = $1`,
          [rtlTenantId],
        )
      ).rows[0] ?? null;
  });

  afterAll(async () => {
    // Snapshot-restore the policy FIRST (pre-suite state no matter what), then
    // drop the throwaway factor(s).
    await pool.query(`DELETE FROM sys.sys_auth_mfa_policies WHERE auth_mfa_policy_tenant_id = $1`, [
      rtlTenantId,
    ]);
    if (savedPolicy) {
      await pool.query(
        `INSERT INTO sys.sys_auth_mfa_policies
           (auth_mfa_policy_tenant_id, auth_mfa_policy_enabled, auth_mfa_policy_role_codes)
         VALUES ($1, $2, $3)`,
        [rtlTenantId, savedPolicy.auth_mfa_policy_enabled, savedPolicy.auth_mfa_policy_role_codes],
      );
    }
    await pool.query(`DELETE FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = $1`, [
      gatedUserId,
    ]);
    await app.app.close();
  });

  it("policy OFF: the in-scope persona logs in with a full session (pre-#4 regression)", async () => {
    // Arrange the precondition explicitly: since the REAL RTL activation
    // (S982) the ambient policy is ON — this test must not depend on it.
    // The pre-suite state is snapshot-restored in afterAll regardless.
    await setPolicy(false);
    const resp = await login({ email: gated.email, password: passwordFor(gated.email) });
    expect(resp.statusCode).toBe(200);
    expect((resp.json() as { status: string }).status).toBe("success");
  });

  it("policy ON: factor-less in-scope user gets mfa_enrollment_required — ACCESS+CSRF cookies, NO refresh", async () => {
    await setPolicy(true);
    const resp = await login({ email: gated.email, password: passwordFor(gated.email) });
    expect(resp.statusCode).toBe(200);
    const json = resp.json() as { status: string; csrfToken: string; allowedKinds: string[] };
    expect(json.status).toBe("mfa_enrollment_required");
    expect(json.csrfToken.length).toBeGreaterThan(0);
    // allowedKinds is provider-aware: the test app's InMemorySms IS production-
    // capable, so SMS_OTP appears here; in PROD without a real SMS provider the
    // list is TOTP/EMAIL_OTP/WEBAUTHN only (ConsoleSms is not capable).
    expect(json.allowedKinds).toEqual(["TOTP", "EMAIL_OTP", "WEBAUTHN", "SMS_OTP"]);
    const names = resp.cookies.map((c) => c.name);
    expect(names).toContain(COOKIES.ACCESS);
    expect(names).toContain(COOKIES.CSRF);
    expect(names).not.toContain(COOKIES.REFRESH);
  });

  it("policy ON: a user whose roles are OUT of scope (TENANT_ADMIN) is never ENROLLMENT-gated by it", async () => {
    // La password si deriva dall'attore che stiamo autenticando: dopo Z-262 ogni
    // utente ha la propria, e riusare quella di un altro dà 401.
    const resp = await login({ email: outOfScope.email, password: passwordFor(outOfScope.email) });
    expect(resp.statusCode).toBe(200);
    const status = (resp.json() as { status: string }).status;
    // Out-of-scope ⇒ this suite's ['READ_ONLY'] policy adds NOTHING for her:
    // plain success when the persona has no factor, the REGULAR factor-driven
    // challenge when the e2e-fixture factor is live (S983 WS-E) — never the
    // enrollment gate.
    expect(["success", "mfa_required"]).toContain(status);
  });

  it("the enr session is CONTAINED by the allowlist guard: everything outside mfa+login+logout is 401 MFA_ENROLLMENT_ONLY", async () => {
    const gate = await login({ email: gated.email, password: passwordFor(gated.email) });
    const cookies = cookieHeader(gate);
    const csrf = (gate.json() as { csrfToken: string }).csrfToken;

    // Review fix S981: containment is an explicit positive allowlist on the
    // `enr` claim, not just roles:[] — including the authenticated-only
    // routes WITHOUT requirePermission that used to leak through.
    for (const url of [
      "/v1/users", // permission-gated
      "/v1/auth/me", // authenticated-only, would expose REAL roles
      "/v1/auth/sessions/current", // authenticated-only
      "/v1/skill-categories", // authenticated-only global read
      "/v1/me/permissions", // authenticated-only
    ]) {
      const resp = await app.app.inject({ method: "GET", url, headers: { cookie: cookies } });
      expect(resp.statusCode, url).toBe(401);
      expect((resp.json() as { error: { code: string } }).error.code, url).toBe(
        "MFA_ENROLLMENT_ONLY",
      );
    }

    // No refresh cookie was issued -> the session cannot be extended.
    const refresh = await app.app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      headers: { cookie: cookies, "x-csrf-token": csrf },
    });
    expect(refresh.statusCode).toBe(401);

    // The MFA self-service surface IS reachable (the intended enrollment path).
    const factors = await app.app.inject({
      method: "GET",
      url: "/v1/auth/mfa/factors",
      headers: { cookie: cookies },
    });
    expect(factors.statusCode).toBe(200);
  });

  it("full loop: enroll+verify TOTP through the enr session, then re-login -> mfa_required -> success", async () => {
    // 1. Gate response = restricted session.
    const gate = await login({ email: gated.email, password: passwordFor(gated.email) });
    expect((gate.json() as { status: string }).status).toBe("mfa_enrollment_required");
    const cookies = cookieHeader(gate);
    const csrf = (gate.json() as { csrfToken: string }).csrfToken;

    // 2. Enroll a TOTP factor through the restricted session (CSRF-protected).
    const enroll = await app.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/enroll",
      headers: { cookie: cookies, "x-csrf-token": csrf, "content-type": "application/json" },
      payload: {},
    });
    expect(enroll.statusCode).toBe(201);
    const { factorId, secret } = enroll.json() as { factorId: string; secret: string };

    const verify = await app.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/verify-setup",
      headers: { cookie: cookies, "x-csrf-token": csrf, "content-type": "application/json" },
      payload: { factorId, code: genTotp(secret) },
    });
    expect(verify.statusCode).toBe(200);
    expect((verify.json() as { verified: boolean }).verified).toBe(true);

    // 3. Re-login from scratch: the user now HAS a verified factor -> regular challenge.
    const step1 = await login({ email: gated.email, password: passwordFor(gated.email) });
    expect((step1.json() as { status: string }).status).toBe("mfa_required");
    const challengeToken = (step1.json() as { challengeToken: string }).challengeToken;

    const step2 = await login({
      email: gated.email,
      password: passwordFor(gated.email),
      challengeToken,
      mfaCode: genTotp(secret),
    });
    expect(step2.statusCode).toBe(200);
    const done = step2.json() as { status: string; user: { userId: string } };
    expect(done.status).toBe("success");
    expect(done.user.userId).toBe(gatedUserId);
    const names = step2.cookies.map((c) => c.name);
    expect(names).toContain(COOKIES.ACCESS);
    expect(names).toContain(COOKIES.REFRESH);
    expect(names).toContain(COOKIES.CSRF);

    // 4. The gate audit event was recorded.
    const ev = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_auth_login_events
        WHERE auth_login_event_user_id = $1
          AND auth_login_event_type = 'LOGIN_MFA_ENROLLMENT_REQUIRED'`,
      [gatedUserId],
    );
    expect(Number(ev.rows[0]!.n)).toBeGreaterThanOrEqual(1);
  });
});
