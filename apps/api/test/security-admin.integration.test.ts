/**
 * apps/api/test/security-admin.integration.test.ts — mandato K, R-7.
 *
 * SECURITY_ADMIN: ruolo di cliente (tenant-scoped, come TENANT_ADMIN) con i permessi di
 * `auth` (role_matrix:read, auth:sessions_read, auth:revoke_user), `mfa-policy`,
 * `delegations`, più `role:assign` — entra in `CAN_GRANT_ROLES` (mandati.ts) con lo
 * STESSO vincolo di TENANT_ADMIN su `grantRole`/`revokeRole`: non concede ruoli di
 * piattaforma, non esce dal proprio tenant. Nessun ritiro (D3 non si applica qui): i
 * permessi restano intatti a chi già li aveva.
 *
 * La prova principale è ESATTAMENTE `grantRole` (mandato, passo 54).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";

const SECURITY_ADMIN_EMAIL = "security-admin@collaudo.invalid";
const TEAM_LEADER_RTL = "alberto.serra@rtl-bank.org"; // controprova: NON è in CAN_GRANT_ROLES
const TARGET_RTL_NO_TL = "alberto.colombo@rtl-bank.org"; // RTL_BANK, senza TEAM_LEADER
const TARGET_HEURESYS = "platform-test-admin@collaudo.invalid"; // tenant B (Heuresys System)

interface Auth {
  cookies: Map<string, string>;
  csrfToken: string;
}
function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string, password: string): Promise<Auth> {
  const r = await loginRaw(t.app, email, password);
  if (r.statusCode !== 200) {
    throw new Error(`login ${email} -> ${r.statusCode}: ${r.body}`);
  }
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
function headers(a: Auth) {
  return {
    cookie: cookieHeader(a.cookies),
    "x-csrf-token": a.csrfToken,
    "content-type": "application/json",
  };
}

describe("mandato K, R-7 — SECURITY_ADMIN", () => {
  let suite: TestApp;
  let securityAdmin: Auth;
  let teamLeader: Auth;
  let targetRtlId: string;
  let targetHeuresysId: string;

  beforeAll(async () => {
    suite = await buildTestApp();
    const key = readCollaudoKey();
    securityAdmin = await login(suite, SECURITY_ADMIN_EMAIL, deriveCollaudoPassword(key, SECURITY_ADMIN_EMAIL));
    teamLeader = await login(suite, TEAM_LEADER_RTL, TEST_PERSONA_PASSWORD);

    const rtl = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
      [TARGET_RTL_NO_TL],
    );
    targetRtlId = rtl.rows[0]!.user_id;
    const heu = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
      [TARGET_HEURESYS],
    );
    targetHeuresysId = heu.rows[0]!.user_id;
  });
  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("SECURITY_ADMIN concede TEAM_LEADER a una persona del proprio tenant → 201", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: `/v1/users/${targetRtlId}/roles`,
      headers: headers(securityAdmin),
      payload: { roleCode: "TEAM_LEADER" },
    });
    expect(r.statusCode).toBe(201);
  });

  it("SECURITY_ADMIN NON può concedere un ruolo di piattaforma → 403", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: `/v1/users/${targetRtlId}/roles`,
      headers: headers(securityAdmin),
      payload: { roleCode: "PLATFORM_ADMIN" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("PLATFORM_GRANT_FORBIDDEN");
  });

  it("SECURITY_ADMIN NON esce dal proprio tenant → 404 (non 403: nasconde l'esistenza)", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: `/v1/users/${targetHeuresysId}/roles`,
      headers: headers(securityAdmin),
      payload: { roleCode: "TEAM_LEADER" },
    });
    expect(r.statusCode).toBe(404);
  });

  it("controprova — TEAM_LEADER (non in CAN_GRANT_ROLES) sullo stesso grant → 403", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: `/v1/users/${targetRtlId}/roles`,
      headers: headers(teamLeader),
      payload: { roleCode: "TEAM_MEMBER" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("SECURITY_ADMIN sui tre moduli concessi → 200 (role-permissions, mfa-policy, delegations)", async () => {
    const rp = await suite.app.inject({
      method: "GET", url: "/v1/auth/role-permissions", headers: headers(securityAdmin),
    });
    expect(rp.statusCode).toBe(200);

    const mfa = await suite.app.inject({
      method: "GET", url: "/v1/mfa-policy", headers: headers(securityAdmin),
    });
    expect(mfa.statusCode).toBe(200);

    const del = await suite.app.inject({
      method: "GET", url: "/v1/delegations", headers: headers(securityAdmin),
    });
    expect(del.statusCode).toBe(200);
  });

  it("SECURITY_ADMIN fuori dal proprio mandato: /v1/compensation/bands → 403 (I18/I20 intatti)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/bands", headers: headers(securityAdmin),
    });
    expect(r.statusCode).toBe(403);
  });
});
