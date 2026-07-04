import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

// T2.5 — org-unit ↔ business-process RACI assignment (/v1/organization-unit-processes/*).
// Real login + live DB. Writes = organization_unit_processes:create/delete (PLATFORM/TENANT_ADMIN/
// HRMS_MANAGER); reads = organization_unit_processes:read (6 HRMS roles). The assignment is owned
// by the org-unit's tenant (I5). Tests pin to 2 real RTL_BANK OUs + 2 real global processes;
// afterAll deletes every assignment created on those OUs (live-data isolation, writes to RTL test
// tenant only — NEVER HEURESYS).

const PWD = TEST_PERSONA_PASSWORD;
const RTL = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0";
const ZERO = "00000000-0000-0000-0000-000000000000";

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
function jhdr(s: S) { return { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" }; }
function chdr(s: S) { return { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken }; }

let suite: TestApp;
let admin: S;     // PLATFORM_ADMIN (HEURESYS) — cross-tenant
let author: S;    // TENANT_ADMIN (RTL) — create/delete
let manager: S;   // MANAGER (RTL) — read yes, create/delete NO
let plainUser: S; // USER (RTL) — no org-unit-process perms
let ou0: string;  // a real RTL org unit
let ou1: string;  // a second RTL org unit (isolation)
let proc0: string; // a real global blueprint process step
let proc1: string; // a second one (reverse lookup)
// D-23 snapshot-restore: the approved S1002 RACI seed (54_raci_*) assigns DIR-AML /
// DIR-BACKOFF (the 2 OUs this suite pins to) as owners. Capture their seeded rows
// before the pristine-start wipe and restore them in afterAll so the production
// mapping survives the suite (never blanket-delete real config — D-23).
let ouProcSnapshot: Array<Record<string, unknown>> = [];

async function assign(s: S, ouId: string, processId: string, role?: string): Promise<{ orgUnitProcessId: string; role: string }> {
  const payload: Record<string, unknown> = { ouId, processId };
  if (role) payload.role = role;
  const r = await suite.app.inject({ method: "POST", url: "/v1/organization-unit-processes", headers: jhdr(s), payload });
  if (r.statusCode !== 200) throw new Error(`assign: ${r.statusCode} ${r.body}`);
  return r.json() as { orgUnitProcessId: string; role: string };
}

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  author = await login(suite, "federica.marchetti@rtl-bank.org");
  manager = await login(suite, "paolo.caputo@rtl-bank.org");
  plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");

  const ous = await pool.query<{ organization_unit_id: string }>(
    `SELECT organization_unit_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id = $1 ORDER BY organization_unit_code LIMIT 2`,
    [RTL],
  );
  if (ous.rows.length < 2) throw new Error("need ≥2 RTL org units");
  ou0 = ous.rows[0]!.organization_unit_id;
  ou1 = ous.rows[1]!.organization_unit_id;

  const pr = await pool.query<{ blueprint_process_id: string }>(
    `SELECT blueprint_process_id FROM sys.sys_blueprint_process_registry ORDER BY blueprint_process_ordinal LIMIT 2`,
  );
  if (pr.rows.length < 2) throw new Error("need ≥2 blueprint processes");
  proc0 = pr.rows[0]!.blueprint_process_id;
  proc1 = pr.rows[1]!.blueprint_process_id;

  // D-23: snapshot the seeded RACI rows on the test OUs BEFORE wiping, then pristine-start.
  const snap = await pool.query(
    `SELECT organization_unit_process_id, org_unit_process_tenant_id, org_unit_process_org_unit_id,
            org_unit_process_blueprint_process_id, org_unit_process_role, org_unit_process_metadata,
            created_at, updated_at
       FROM sys.sys_organization_unit_processes WHERE org_unit_process_org_unit_id = ANY($1)`,
    [[ou0, ou1]],
  );
  ouProcSnapshot = snap.rows;
  await pool.query("DELETE FROM sys.sys_organization_unit_processes WHERE org_unit_process_org_unit_id = ANY($1)", [[ou0, ou1]]);
});

afterAll(async () => {
  await pool.query("DELETE FROM sys.sys_organization_unit_processes WHERE org_unit_process_org_unit_id = ANY($1)", [[ou0, ou1]]);
  // D-23 restore: faithfully re-insert the snapshot captured in beforeAll (incl. PK +
  // metadata + timestamps) so the approved RACI mapping is not destroyed by this suite.
  for (const r of ouProcSnapshot) {
    await pool.query(
      `INSERT INTO sys.sys_organization_unit_processes
         (organization_unit_process_id, org_unit_process_tenant_id, org_unit_process_org_unit_id,
          org_unit_process_blueprint_process_id, org_unit_process_role, org_unit_process_metadata, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
      [r.organization_unit_process_id, r.org_unit_process_tenant_id, r.org_unit_process_org_unit_id,
       r.org_unit_process_blueprint_process_id, r.org_unit_process_role,
       JSON.stringify(r.org_unit_process_metadata ?? {}), r.created_at, r.updated_at],
    );
  }
  await suite.app.close();
});

describe("org-unit ↔ business-process assignment API (T2.5)", () => {
  it("create → 200 (role defaults to 'OWNER') + by-ou returns the denormalized process", async () => {
    const r = await suite.app.inject({ method: "POST", url: "/v1/organization-unit-processes", headers: jhdr(author), payload: { ouId: ou0, processId: proc0 } });
    expect(r.statusCode).toBe(200);
    const created = r.json() as { orgUnitProcessId: string; role: string; tenantId: string; orgUnitId: string };
    expect(created.role).toBe("OWNER");
    expect(created.tenantId).toBe(RTL);
    expect(created.orgUnitId).toBe(ou0);

    const byOu = await suite.app.inject({ method: "GET", url: `/v1/organization-unit-processes/by-ou/${ou0}`, headers: { cookie: ch(author.cookies) } });
    expect(byOu.statusCode).toBe(200);
    const items = (byOu.json() as { items: { orgUnitProcessId: string; blueprintProcessId: string; blueprintProcessName: string; blueprintVariantName: string }[]; total: number }).items;
    expect(items).toHaveLength(1);
    expect(items[0]!.blueprintProcessId).toBe(proc0);
    expect(items[0]!.blueprintProcessName).toBeTruthy();
    expect(items[0]!.blueprintVariantName).toBeTruthy();
  });

  it("non-default RACI role round-trips (CONTRIBUTOR)", async () => {
    const created = await assign(author, ou1, proc0, "CONTRIBUTOR");
    expect(created.role).toBe("CONTRIBUTOR");
  });

  it("dup-prevent: re-assigning the same (ou, process) → 409 DUPLICATE_OU_PROCESS", async () => {
    await assign(author, ou0, proc1);
    const dup = await suite.app.inject({ method: "POST", url: "/v1/organization-unit-processes", headers: jhdr(author), payload: { ouId: ou0, processId: proc1 } });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("DUPLICATE_OU_PROCESS");
  });

  it("RBAC: plain USER cannot create (403); MANAGER can read but not create/delete", async () => {
    expect((await suite.app.inject({ method: "POST", url: "/v1/organization-unit-processes", headers: jhdr(plainUser), payload: { ouId: ou0, processId: proc0 } })).statusCode).toBe(403);
    expect((await suite.app.inject({ method: "GET", url: `/v1/organization-unit-processes/by-ou/${ou0}`, headers: { cookie: ch(manager.cookies) } })).statusCode).toBe(200);
    expect((await suite.app.inject({ method: "POST", url: "/v1/organization-unit-processes", headers: jhdr(manager), payload: { ouId: ou0, processId: proc0 } })).statusCode).toBe(403);
  });

  it("CSRF: create without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/organization-unit-processes",
      headers: { cookie: ch(author.cookies), "content-type": "application/json" },
      payload: { ouId: ou0, processId: proc0 },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });

  it("404: assign to a non-existent process or a non-existent/out-of-scope org unit", async () => {
    expect((await suite.app.inject({ method: "POST", url: "/v1/organization-unit-processes", headers: jhdr(author), payload: { ouId: ou0, processId: ZERO } })).statusCode).toBe(404);
    expect((await suite.app.inject({ method: "POST", url: "/v1/organization-unit-processes", headers: jhdr(author), payload: { ouId: ZERO, processId: proc0 } })).statusCode).toBe(404);
  });

  it("I5: by-ou for an out-of-scope OU → 404 (no leak); PLATFORM_ADMIN sees across tenants", async () => {
    // (ou0, proc0) was already assigned by the first test — reuse it (do not re-create → 409).
    // author querying a non-existent/out-of-scope OU → 404 (parent scope-check)
    expect((await suite.app.inject({ method: "GET", url: `/v1/organization-unit-processes/by-ou/${ZERO}`, headers: { cookie: ch(author.cookies) } })).statusCode).toBe(404);
    // PLATFORM_ADMIN (HEURESYS, cross-tenant) sees the RTL OU's assignments
    const adminView = await suite.app.inject({ method: "GET", url: `/v1/organization-unit-processes/by-ou/${ou0}`, headers: { cookie: ch(admin.cookies) } });
    expect(adminView.statusCode).toBe(200);
    expect((adminView.json() as { total: number }).total).toBeGreaterThanOrEqual(1);
  });

  it("reverse lookup (by-process) returns the assigned org unit", async () => {
    const byProc = await suite.app.inject({ method: "GET", url: `/v1/organization-unit-processes/by-process/${proc0}`, headers: { cookie: ch(author.cookies) } });
    expect(byProc.statusCode).toBe(200);
    const items = (byProc.json() as { items: { orgUnitId: string; orgUnitName: string }[] }).items;
    expect(items.some((i) => i.orgUnitId === ou0)).toBe(true);
    expect(items.find((i) => i.orgUnitId === ou0)!.orgUnitName).toBeTruthy();
  });

  it("DELETE assignment → 200 then by-ou no longer lists it", async () => {
    const { orgUnitProcessId } = await assign(author, ou1, proc1);
    const del = await suite.app.inject({ method: "DELETE", url: `/v1/organization-unit-processes/${orgUnitProcessId}`, headers: chdr(author) });
    expect(del.statusCode).toBe(200);
    expect((del.json() as { deleted: boolean }).deleted).toBe(true);
    const after = await suite.app.inject({ method: "GET", url: `/v1/organization-unit-processes/by-ou/${ou1}`, headers: { cookie: ch(author.cookies) } });
    expect((after.json() as { items: { orgUnitProcessId: string }[] }).items.some((i) => i.orgUnitProcessId === orgUnitProcessId)).toBe(false);
  });
});
