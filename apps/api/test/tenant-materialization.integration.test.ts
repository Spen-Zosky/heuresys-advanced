import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";

// #4 WI-C — tenant materialization generator (/v1/tenant-materialization). Real login + live DB.
// PLATFORM_ADMIN-only; the target tenant must exist + be ACTIVE (M-1). Archetype codes are
// RBR-* (own namespace) so they never collide with a tenant's real seed data. Writes touch
// only the validated target tenant (I5). afterAll purges every RBR-* row + the temp tenant.

const PWD = "Admin#PassW0rd!";
const RTL = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0";
const HEU = "8bc5bc59-f2d2-4a8a-882a-ea26ac367858";
const ARCHETYPE = "RETAIL_BANK_REFERENCE";

interface S { cookies: Map<string, string>; csrfToken: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
const jhdr = (s: S) => ({ cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" });

let suite: TestApp;
let admin: S, federica: S;
let suspendedTenantId: string;

interface Result {
  created: { orgUnits: number; positions: number };
  skipped: { orgUnits: number; positions: number };
  total: { orgUnits: number; positions: number };
  tenantId: string;
}
function materialize(s: S, tenantId: string, mode: "plan" | "apply") {
  return suite.app.inject({
    method: "POST", url: "/v1/tenant-materialization", headers: jhdr(s),
    payload: { tenantId, archetypeKey: ARCHETYPE, mode },
  });
}
async function countRbr(tenantId: string): Promise<{ ou: number; pos: number }> {
  const ou = await pool.query<{ c: string }>(
    `SELECT count(*) AS c FROM sys.sys_organization_units WHERE organization_unit_tenant_id = $1 AND organization_unit_code LIKE 'RBR-%'`,
    [tenantId],
  );
  const pos = await pool.query<{ c: string }>(
    `SELECT count(*) AS c FROM sys.sys_positions WHERE position_tenant_id = $1 AND position_code LIKE 'RBR-%'`,
    [tenantId],
  );
  return { ou: Number(ou.rows[0]!.c), pos: Number(pos.rows[0]!.c) };
}
async function purgeRbr(tenantId: string): Promise<void> {
  await pool.query(`DELETE FROM sys.sys_positions WHERE position_tenant_id = $1 AND position_code LIKE 'RBR-%'`, [tenantId]);
  await pool.query(`DELETE FROM sys.sys_organization_units WHERE organization_unit_tenant_id = $1 AND organization_unit_code LIKE 'RBR-%'`, [tenantId]);
}

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  federica = await login(suite, "federica.marchetti@rtl-bank.org");
  await purgeRbr(RTL);
  await purgeRbr(HEU);
  // A non-ACTIVE tenant for the M-1 status guard.
  const t = await pool.query<{ tenant_id: string }>(
    `INSERT INTO sys.sys_tenancies (tenant_code, tenant_name, tenant_status)
     VALUES ('TEST-MAT-SUSPENDED', '[TEST] Suspended Materialization Target', 'SUSPENDED')
     RETURNING tenant_id`,
  );
  suspendedTenantId = t.rows[0]!.tenant_id;
}, 60_000);

afterAll(async () => {
  await purgeRbr(RTL);
  await purgeRbr(HEU);
  await pool.query(`DELETE FROM sys.sys_tenancies WHERE tenant_id = $1`, [suspendedTenantId]);
  await suite.app.close();
});

describe("tenant materialization generator (#4 WI-C)", () => {
  it("GET /archetypes lists the RETAIL_BANK_REFERENCE archetype with its counts", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/tenant-materialization/archetypes", headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { items: { key: string; orgUnitCount: number; positionCount: number }[] };
    const a = b.items.find((x) => x.key === ARCHETYPE)!;
    expect(a.orgUnitCount).toBe(7);
    expect(a.positionCount).toBe(11);
  });

  it("plan mode writes nothing and reports the full would-create set", async () => {
    const before = await countRbr(RTL);
    expect(before).toEqual({ ou: 0, pos: 0 });
    const r = await materialize(admin, RTL, "plan");
    expect(r.statusCode).toBe(200);
    const b = r.json() as Result;
    expect(b.created).toEqual({ orgUnits: 7, positions: 11 });
    expect(b.total).toEqual({ orgUnits: 7, positions: 11 });
    // No writes happened.
    expect(await countRbr(RTL)).toEqual({ ou: 0, pos: 0 });
  });

  it("apply mode creates the org-units + positions, tagged to the target tenant", async () => {
    const r = await materialize(admin, RTL, "apply");
    expect(r.statusCode).toBe(200);
    const b = r.json() as Result;
    expect(b.tenantId).toBe(RTL);
    expect(b.created).toEqual({ orgUnits: 7, positions: 11 });
    expect(b.skipped).toEqual({ orgUnits: 0, positions: 0 });
    expect(await countRbr(RTL)).toEqual({ ou: 7, pos: 11 });
  });

  it("re-apply is idempotent (0 created, all skipped)", async () => {
    const r = await materialize(admin, RTL, "apply");
    const b = r.json() as Result;
    expect(b.created).toEqual({ orgUnits: 0, positions: 0 });
    expect(b.skipped).toEqual({ orgUnits: 7, positions: 11 });
    expect(await countRbr(RTL)).toEqual({ ou: 7, pos: 11 });
  });

  it("M-1 tenant isolation: a RTL materialization never touches HEURESYS", async () => {
    expect(await countRbr(HEU)).toEqual({ ou: 0, pos: 0 });
  });

  it("RBAC: a non-PLATFORM_ADMIN (TENANT_ADMIN) is denied → 403", async () => {
    const r = await materialize(federica, RTL, "apply");
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("TENANT_MATERIALIZE_ADMIN_ONLY");
  });

  it("M-1: a non-existent target tenant → 404", async () => {
    const r = await materialize(admin, "00000000-0000-0000-0000-000000000000", "apply");
    expect(r.statusCode).toBe(404);
  });

  it("M-1: a non-ACTIVE (SUSPENDED) target tenant → 403 TENANT_NOT_ACTIVE", async () => {
    const r = await materialize(admin, suspendedTenantId, "apply");
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("TENANT_NOT_ACTIVE");
    expect(await countRbr(suspendedTenantId)).toEqual({ ou: 0, pos: 0 });
  });

  it("an unknown archetype → 404", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/tenant-materialization", headers: jhdr(admin),
      payload: { tenantId: RTL, archetypeKey: "NOPE_NOT_REAL", mode: "plan" },
    });
    expect(r.statusCode).toBe(404);
  });
});
