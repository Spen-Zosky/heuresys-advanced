/**
 * apps/api/test/platform-tenant-assignments.integration.test.ts — mandato K, R-0 (D9=B).
 *
 * Le rotte che governano `sys.sys_platform_user_tenant_assignments` (mig `000421`): solo
 * `PLATFORM_ADMIN` le raggiunge oggi (nessun ruolo popola ancora
 * `PLATFORM_ASSIGNED_MANDATE_ROLES`). La prova SUL VIVO del filtro che questa tabella alimenta
 * (`perimetroClienti`) resta a R-9, la voce successiva del mandato.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const ADMIN_EMAIL = "platform-test-admin@collaudo.invalid";
const NON_ADMIN_EMAIL = "federica.marchetti@rtl-bank.org";

interface LoginResult { cookies: Map<string, string>; csrfToken: string }

function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function login(t: TestApp, email: string, password: string): Promise<LoginResult> {
  const r = await loginRaw(t.app, email, password);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string };
  return { cookies, csrfToken: body.csrfToken };
}

let t: TestApp;
let admin: LoginResult;
let nonAdmin: LoginResult;
let rtlTenantId = "";
let anotherUserId = "";

beforeAll(async () => {
  t = await buildTestApp();
  admin = await login(t, ADMIN_EMAIL, TEST_PERSONA_PASSWORD);
  nonAdmin = await login(t, NON_ADMIN_EMAIL, TEST_PERSONA_PASSWORD);
  const tenant = await pool.query<{ id: string }>(
    `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`,
  );
  rtlTenantId = tenant.rows[0]!.id;
  const user = await pool.query<{ id: string }>(
    `SELECT user_id AS id FROM sys.sys_users WHERE user_email = $1`,
    [NON_ADMIN_EMAIL],
  );
  anotherUserId = user.rows[0]!.id;
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("/v1/platform-tenant-assignments (mandato K, R-0)", () => {
  it("PLATFORM_ADMIN assegna un cliente, lo vede in elenco, lo revoca", async () => {
    const create = await t.app.inject({
      method: "POST",
      url: "/v1/platform-tenant-assignments",
      headers: { cookie: cookieHeader(admin.cookies), "x-csrf-token": admin.csrfToken },
      payload: { userId: anotherUserId, tenantId: rtlTenantId },
    });
    expect(create.statusCode).toBe(201);
    const creata = create.json() as { assignmentId: string; revokedAt: string | null };
    expect(creata.revokedAt).toBeNull();

    const list = await t.app.inject({
      method: "GET",
      url: `/v1/platform-tenant-assignments?userId=${anotherUserId}`,
      headers: { cookie: cookieHeader(admin.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const { items } = list.json() as { items: Array<{ assignmentId: string }> };
    expect(items.some((i) => i.assignmentId === creata.assignmentId)).toBe(true);

    const revoke = await t.app.inject({
      method: "POST",
      url: `/v1/platform-tenant-assignments/${creata.assignmentId}/revoke`,
      headers: { cookie: cookieHeader(admin.cookies), "x-csrf-token": admin.csrfToken },
    });
    expect(revoke.statusCode).toBe(200);
    expect((revoke.json() as { revokedAt: string | null }).revokedAt).not.toBeNull();
  });

  it("una seconda assegnazione attiva sulla stessa coppia utente/cliente è un conflitto", async () => {
    const prima = await t.app.inject({
      method: "POST",
      url: "/v1/platform-tenant-assignments",
      headers: { cookie: cookieHeader(admin.cookies), "x-csrf-token": admin.csrfToken },
      payload: { userId: anotherUserId, tenantId: rtlTenantId },
    });
    expect(prima.statusCode).toBe(201);

    const seconda = await t.app.inject({
      method: "POST",
      url: "/v1/platform-tenant-assignments",
      headers: { cookie: cookieHeader(admin.cookies), "x-csrf-token": admin.csrfToken },
      payload: { userId: anotherUserId, tenantId: rtlTenantId },
    });
    expect(seconda.statusCode).toBe(409);
  });

  it("un attore senza platform_tenant_assignment:manage → 403", async () => {
    const res = await t.app.inject({
      method: "GET",
      url: "/v1/platform-tenant-assignments",
      headers: { cookie: cookieHeader(nonAdmin.cookies) },
    });
    expect(res.statusCode).toBe(403);
  });

  it("revocare un'assegnazione inesistente → 404", async () => {
    const res = await t.app.inject({
      method: "POST",
      url: "/v1/platform-tenant-assignments/00000000-0000-0000-0000-000000000000/revoke",
      headers: { cookie: cookieHeader(admin.cookies), "x-csrf-token": admin.csrfToken },
    });
    expect(res.statusCode).toBe(404);
  });
});
