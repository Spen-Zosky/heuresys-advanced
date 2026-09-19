/**
 * apps/api/test/r5-blueprint-manager-tenant-admin.integration.test.ts — mandato K, R-5
 * (D9=B, mig. 000430).
 *
 * BLUEPRINT_MANAGER: tenant_blueprint:read/write, MAI approve, perimetro = clienti
 * assegnati (R-0, D9=B). TENANT_ADMIN: tenant_blueprint:read/approve, MAI write,
 * perimetro = il proprio tenant. Entrambi passano da `perimetroClienti(actor)` (I-G).
 *
 * Isolamento transazionale per file (D-52): il fascicolo di prova fuori perimetro
 * nasce qui e viene rollbackato a fine file.
 */
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";

const PREFIX = `IT_R5_${randomUUID().slice(0, 8).toUpperCase()}`;
const BM_EMAIL = "blueprint-manager@collaudo.invalid";
const PLATFORM_ADMIN_EMAIL = "enzo.spenuso@heuresys.com";
const TENANT_ADMIN_RTL_EMAIL = "federica.marchetti@rtl-bank.org";

interface Auth {
  cookies: Map<string, string>;
  csrfToken: string;
}
const cookieHeader = (c: Map<string, string>) =>
  [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
async function login(t: TestApp, email: string, password: string): Promise<Auth> {
  const r = await loginRaw(t.app, email, password);
  if (r.statusCode !== 200) throw new Error(`login ${email} -> ${r.statusCode}: ${r.body}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
const headers = (a: Auth) => ({ cookie: cookieHeader(a.cookies), "x-csrf-token": a.csrfToken });

describe("mandato K, R-5 — BLUEPRINT_MANAGER e TENANT_ADMIN sui fascicoli", () => {
  let suite: TestApp;
  let bm: Auth;
  let platformAdmin: Auth;
  let tenantAdminRtl: Auth;
  let fascicoloRtl: string;
  let fascicoloFuori: string;

  beforeAll(async () => {
    suite = await buildTestApp();
    const key = readCollaudoKey();
    bm = await login(suite, BM_EMAIL, deriveCollaudoPassword(key, BM_EMAIL));
    platformAdmin = await login(suite, PLATFORM_ADMIN_EMAIL, TEST_PERSONA_PASSWORD);
    tenantAdminRtl = await login(suite, TENANT_ADMIN_RTL_EMAIL, TEST_PERSONA_PASSWORD);

    const rtl = await pool.query<{ id: string }>(
      `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`,
    );
    const rtlTenantId = rtl.rows[0]!.id;
    const heu = await pool.query<{ id: string }>(
      `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'HEURESYS'`,
    );
    const heuTenantId = heu.rows[0]!.id;
    const bmUser = await pool.query<{ id: string }>(
      `SELECT user_id AS id FROM sys.sys_users WHERE user_email = $1`,
      [BM_EMAIL],
    );

    // R-0 SUL VIVO: BLUEPRINT_MANAGER assegnato SOLO a RTL Bank.
    const assign = await suite.app.inject({
      method: "POST",
      url: "/v1/platform-tenant-assignments",
      headers: headers(platformAdmin),
      payload: { userId: bmUser.rows[0]!.id, tenantId: rtlTenantId },
    });
    expect(assign.statusCode).toBe(201);

    // Un fascicolo REALE di RTL (il dominio dei fascicoli non e' vuoto in produzione).
    const rtlB = await pool.query<{ id: string }>(
      `SELECT tenant_blueprint_id AS id FROM sys.sys_tenant_blueprints
        WHERE tenant_blueprint_tenant_id = $1 LIMIT 1`,
      [rtlTenantId],
    );
    fascicoloRtl = rtlB.rows[0]!.id;

    // Un fascicolo di prova FUORI dal perimetro di BLUEPRINT_MANAGER (HEURESYS, mai
    // assegnato a lui): rollbackato a fine file.
    const fuori = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_tenant_blueprints
         (tenant_blueprint_code, tenant_blueprint_name, tenant_blueprint_tenant_id, tenant_blueprint_status)
       VALUES ($1, 'Fascicolo di prova FUORI (R-5)', $2, 'ARCHIVED')
       RETURNING tenant_blueprint_id AS id`,
      [`${PREFIX}_FUORI`, heuTenantId],
    );
    fascicoloFuori = fuori.rows[0]!.id;
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("BLUEPRINT_MANAGER legge il fascicolo DENTRO il suo perimetro (RTL) -> 200", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/tenant-blueprints/${fascicoloRtl}`,
      headers: headers(bm),
    });
    expect(r.statusCode).toBe(200);
  });

  it("BLUEPRINT_MANAGER su un fascicolo FUORI dal suo perimetro -> 404 (mandato R-5)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/tenant-blueprints/${fascicoloFuori}`,
      headers: headers(bm),
    });
    expect(r.statusCode).toBe(404);
  });

  it("Controprova: PLATFORM_ADMIN vede il fascicolo fuori dal perimetro di BLUEPRINT_MANAGER -> 200", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/tenant-blueprints/${fascicoloFuori}`,
      headers: headers(platformAdmin),
    });
    expect(r.statusCode).toBe(200);
  });

  it("TENANT_ADMIN (RTL) legge il proprio fascicolo -> 200", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/tenant-blueprints/${fascicoloRtl}`,
      headers: headers(tenantAdminRtl),
    });
    expect(r.statusCode).toBe(200);
  });

  it("TENANT_ADMIN NON ha tenant_blueprint:write -> PATCH sul fascicolo 403 FORBIDDEN (E1/E3)", async () => {
    const r = await suite.app.inject({
      method: "PATCH",
      url: `/v1/tenant-blueprints/${fascicoloRtl}`,
      headers: headers(tenantAdminRtl),
      payload: { name: "tentativo vietato" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });
});
