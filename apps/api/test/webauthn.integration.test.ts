/**
 * apps/api/test/webauthn.integration.test.ts
 *
 * WebAuthn / FIDO2 passkey MFA factor — API integration tests.
 *
 * Scope: the registration OPTIONS ceremony + the SECURITY-critical negative
 * paths (tampered attestation, missing CSRF / auth, invalid challenge token,
 * factor delete cascade). A full happy-path attestation requires a virtual
 * authenticator and is covered by a separate Playwright E2E — we do NOT forge a
 * full attestation blob here.
 *
 * Live DB: assumes seeded admin (admin@heuresys.com / <TEST_ADMIN_PASSWORD>). Each
 * test cleans the user's MFA factors so re-runs are deterministic; the
 * credential rows cascade via the FK ON DELETE CASCADE.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { E2E_FIXTURE_LABEL } from "./helpers/mfa-fixture-secrets.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const ADMIN_EMAIL = "admin@heuresys.com";
const ADMIN_PASSWORD = TEST_PERSONA_PASSWORD;

interface Bundle {
  cookies: Map<string, string>;
  csrf: string;
  userId: string;
}

function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function loginAdmin(t: TestApp): Promise<Bundle> {
  // Dual-mode (S983 WS-E): TOTP 2-step under the live policy, against the
  // preserved e2e-fixture factor (the cleanup below never deletes it).
  const r = await loginRaw(t.app, ADMIN_EMAIL, ADMIN_PASSWORD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { user: { userId: string }; csrfToken: string };
  return { cookies, csrf: body.csrfToken, userId: body.user.userId };
}

/** Scoped wipe: throwaway factors only — the e2e-fixture factor stays. */
const DELETE_THROWAWAY_FACTORS = `
  DELETE FROM sys.sys_auth_mfa_factors
   WHERE auth_mfa_factor_user_id = $1
     AND coalesce(auth_mfa_factor_metadata->>'label','') <> '${E2E_FIXTURE_LABEL}'`;

describe("/v1/auth/mfa/webauthn/* integration", () => {
  let suiteApp: TestApp;
  let adminUserId: string;

  beforeAll(async () => {
    suiteApp = await buildTestApp();
    const r = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE user_email = $1`,
      [ADMIN_EMAIL],
    );
    adminUserId = r.rows[0]!.user_id;
  });

  beforeEach(async () => {
    // Clean slate per test — credential rows cascade via FK ON DELETE CASCADE.
    // Scoped: the e2e-fixture TOTP factor is preserved (S983 WS-E).
    await pool.query(DELETE_THROWAWAY_FACTORS, [adminUserId]);
  });

  afterAll(async () => {
    await pool.query(DELETE_THROWAWAY_FACTORS, [adminUserId]);
    await suiteApp.app.close();
    await closePool();
  });

  it("registration/options returns factorId + a creation-options blob (challenge + rpID), creating an unverified WEBAUTHN factor", async () => {
    const bundle = await loginAdmin(suiteApp);
    const resp = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/webauthn/registration/options",
      headers: {
        cookie: cookieHeader(bundle.cookies),
        "x-csrf-token": bundle.csrf,
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(resp.statusCode).toBe(200);
    const body = resp.json() as {
      factorId: string;
      options: { challenge?: string; rp?: { id?: string }; user?: unknown };
    };
    expect(body.factorId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(typeof body.options.challenge).toBe("string");
    expect((body.options.challenge ?? "").length).toBeGreaterThan(0);
    // The configured rpID (default "localhost" in test) is echoed in options.rp.id.
    expect(body.options.rp?.id).toBe("localhost");

    // A new unverified WEBAUTHN factor now exists.
    const list = await suiteApp.app.inject({
      method: "GET",
      url: "/v1/auth/mfa/factors",
      headers: { cookie: cookieHeader(bundle.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const listBody = list.json() as {
      items: Array<{ factorId: string; kind: string; verified: boolean }>;
    };
    const webauthnFactor = listBody.items.find((f) => f.factorId === body.factorId);
    expect(webauthnFactor).toBeDefined();
    expect(webauthnFactor!.kind).toBe("WEBAUTHN");
    expect(webauthnFactor!.verified).toBe(false);
  });

  it("registration/verify with a tampered/bogus response is rejected (not 200, not verified)", async () => {
    const bundle = await loginAdmin(suiteApp);
    // First mint a real options + factor so a challenge is in flight.
    const opts = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/webauthn/registration/options",
      headers: {
        cookie: cookieHeader(bundle.cookies),
        "x-csrf-token": bundle.csrf,
        "content-type": "application/json",
      },
      payload: {},
    });
    const { factorId } = opts.json() as { factorId: string };

    // A structurally-shaped but cryptographically-bogus attestation response.
    const bogus = {
      id: "AAAAAAAAAAAAAAAAAAAAAA",
      rawId: "AAAAAAAAAAAAAAAAAAAAAA",
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: "eyJmYWtlIjoidGFtcGVyZWQifQ", // base64url junk
        attestationObject: "o2NmbXRkbm9uZQ", // base64url junk (not a valid CBOR attestation)
      },
    };

    const verify = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/webauthn/registration/verify",
      headers: {
        cookie: cookieHeader(bundle.cookies),
        "x-csrf-token": bundle.csrf,
        "content-type": "application/json",
      },
      payload: { factorId, response: bogus },
    });
    // Must NOT succeed; we surface a clean 400 WEBAUTHN_REGISTRATION_FAILED.
    expect(verify.statusCode).not.toBe(200);
    expect(verify.statusCode).toBe(400);
    const body = verify.json() as { error?: { code?: string }; verified?: unknown };
    expect(body.verified).not.toBe(true);
    expect(body.error?.code).toBe("WEBAUTHN_REGISTRATION_FAILED");
  });

  it("registration/options without CSRF returns 403; without auth returns 401", async () => {
    const bundle = await loginAdmin(suiteApp);

    // No CSRF header (but authenticated) -> 403.
    const noCsrf = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/webauthn/registration/options",
      headers: {
        cookie: cookieHeader(bundle.cookies),
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(noCsrf.statusCode).toBe(403);

    // No auth cookie at all -> 401 (CSRF double-submit also absent, but the
    // verifyCsrf preHandler fires first; either way it must not reach the handler
    // as an authenticated request). We assert it is NOT a success.
    const noAuth = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/webauthn/registration/options",
      headers: { "content-type": "application/json" },
      payload: {},
    });
    expect([401, 403]).toContain(noAuth.statusCode);
  });

  it("authentication/options with an invalid challengeToken returns 401 MFA_CHALLENGE_INVALID", async () => {
    const resp = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/webauthn/authentication/options",
      headers: { "content-type": "application/json" },
      payload: { challengeToken: "deadbeef".repeat(8) },
    });
    expect(resp.statusCode).toBe(401);
    const body = resp.json() as { error: { code: string } };
    expect(body.error.code).toBe("MFA_CHALLENGE_INVALID");
  });

  it("DELETE the WEBAUTHN factor returns 204 and removes it from the list (credential row cascades)", async () => {
    const bundle = await loginAdmin(suiteApp);
    const opts = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/webauthn/registration/options",
      headers: {
        cookie: cookieHeader(bundle.cookies),
        "x-csrf-token": bundle.csrf,
        "content-type": "application/json",
      },
      payload: {},
    });
    const { factorId } = opts.json() as { factorId: string };

    const del = await suiteApp.app.inject({
      method: "DELETE",
      url: `/v1/auth/mfa/factors/${factorId}`,
      headers: {
        cookie: cookieHeader(bundle.cookies),
        "x-csrf-token": bundle.csrf,
      },
    });
    expect(del.statusCode).toBe(204);

    const list = await suiteApp.app.inject({
      method: "GET",
      url: "/v1/auth/mfa/factors",
      headers: { cookie: cookieHeader(bundle.cookies) },
    });
    const listBody = list.json() as { items: Array<{ factorId: string }> };
    expect(listBody.items.find((f) => f.factorId === factorId)).toBeUndefined();

    // Belt-and-suspenders: no orphan credential row for this factor.
    const orphan = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_auth_mfa_webauthn_credentials
        WHERE auth_webauthn_cred_factor_id = $1`,
      [factorId],
    );
    expect(orphan.rows[0]!.n).toBe("0");
  });
});
