import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { anIndustryCode } from "./helpers/industry.js";
import { getArchetype, archetypeUsers } from "../src/modules/tenant-materialization/blueprints.js";

// #4 WI-C — tenant materialization generator (/v1/tenant-materialization). Real login + live DB.
// PLATFORM_ADMIN-only; the target tenant must exist + be ACTIVE (M-1). Archetype codes are
// RBR-* (own namespace) so they never collide with a tenant's real seed data. Writes touch
// only the validated target tenant (I5). afterAll purges every RBR-* row + the temp tenant.
// Expected counts are DERIVED from the blueprint (the SoT of what materialize creates) plus
// the live pre-state: a tenant skill matching an archetype skill by natural key (code OR
// lower(trim(name)) — mig 000189/000196 unique index) is REUSED, not re-created.

const PWD = TEST_PERSONA_PASSWORD;
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

interface Counts { orgUnits: number; positions: number; users: number; assignments: number; skills: number; kpis: number; skillEvidence: number; kpiEvidence: number }
const C = (orgUnits: number, positions: number, users: number, assignments: number, skills: number, kpis: number, skillEvidence: number, kpiEvidence: number): Counts =>
  ({ orgUnits, positions, users, assignments, skills, kpis, skillEvidence, kpiEvidence });
interface Result {
  created: Counts;
  skipped: Counts;
  total: Counts;
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
  // Order matters (FK): synthetic skill/KPI evidence → assignments → users → catalog → positions → org-units.
  await pool.query(
    `DELETE FROM sys.sys_user_skill_evidence e USING sys.sys_users u
      WHERE e.user_skill_evidence_user_id = u.user_id
        AND u.user_tenant_id = $1 AND u.user_external_code LIKE 'SYN_RBR-%'`,
    [tenantId],
  );
  await pool.query(
    `DELETE FROM sys.sys_user_kpi_evidence e USING sys.sys_users u
      WHERE e.user_kpi_evidence_user_id = u.user_id
        AND u.user_tenant_id = $1 AND u.user_external_code LIKE 'SYN_RBR-%'`,
    [tenantId],
  );
  await pool.query(
    `DELETE FROM sys.sys_user_position_assignments a USING sys.sys_users u
      WHERE a.user_position_assignment_user_id = u.user_id
        AND u.user_tenant_id = $1 AND u.user_external_code LIKE 'SYN_RBR-%'`,
    [tenantId],
  );
  await pool.query(`DELETE FROM sys.sys_users WHERE user_tenant_id = $1 AND user_external_code LIKE 'SYN_RBR-%'`, [tenantId]);
  await pool.query(`DELETE FROM sys.sys_skills WHERE skill_tenant_id = $1 AND skill_code LIKE 'RBR-SK-%'`, [tenantId]);
  await pool.query(`DELETE FROM sys.sys_kpi_definitions WHERE kpi_definition_tenant_id = $1 AND kpi_definition_code LIKE 'RBR-KPI-%'`, [tenantId]);
  await pool.query(`DELETE FROM sys.sys_positions WHERE position_tenant_id = $1 AND position_code LIKE 'RBR-%'`, [tenantId]);
  await pool.query(`DELETE FROM sys.sys_organization_units WHERE organization_unit_tenant_id = $1 AND organization_unit_code LIKE 'RBR-%'`, [tenantId]);
}
// slice-2a: GENERATED_INCUMBENT placeholder incumbents (SYN_RBR-*) + their PRIMARY ACTIVE assignments.
async function countSyn(tenantId: string): Promise<{ users: number; assignments: number }> {
  const u = await pool.query<{ c: string }>(
    `SELECT count(*) AS c FROM sys.sys_users WHERE user_tenant_id = $1 AND user_external_code LIKE 'SYN_RBR-%'`,
    [tenantId],
  );
  const a = await pool.query<{ c: string }>(
    `SELECT count(*) AS c FROM sys.sys_user_position_assignments a
       JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
      WHERE u.user_tenant_id = $1 AND u.user_external_code LIKE 'SYN_RBR-%'
        AND a.user_position_assignment_kind = 'PRIMARY' AND a.user_position_assignment_status = 'ACTIVE'`,
    [tenantId],
  );
  return { users: Number(u.rows[0]!.c), assignments: Number(a.rows[0]!.c) };
}
// slice-2b: tenant-scoped synthetic skill/KPI catalog (RBR-SK-* / RBR-KPI-*) + per-incumbent evidence.
async function countCatalog(tenantId: string): Promise<{ skills: number; kpis: number }> {
  const s = await pool.query<{ c: string }>(
    `SELECT count(*) AS c FROM sys.sys_skills WHERE skill_tenant_id = $1 AND skill_code LIKE 'RBR-SK-%'`,
    [tenantId],
  );
  const k = await pool.query<{ c: string }>(
    `SELECT count(*) AS c FROM sys.sys_kpi_definitions WHERE kpi_definition_tenant_id = $1 AND kpi_definition_code LIKE 'RBR-KPI-%'`,
    [tenantId],
  );
  return { skills: Number(s.rows[0]!.c), kpis: Number(k.rows[0]!.c) };
}
async function countEvidence(tenantId: string): Promise<{ skillEvidence: number; kpiEvidence: number }> {
  const se = await pool.query<{ c: string }>(
    `SELECT count(*) AS c FROM sys.sys_user_skill_evidence e
       JOIN sys.sys_users u ON u.user_id = e.user_skill_evidence_user_id
      WHERE u.user_tenant_id = $1 AND u.user_external_code LIKE 'SYN_RBR-%'`,
    [tenantId],
  );
  const ke = await pool.query<{ c: string }>(
    `SELECT count(*) AS c FROM sys.sys_user_kpi_evidence e
       JOIN sys.sys_users u ON u.user_id = e.user_kpi_evidence_user_id
      WHERE u.user_tenant_id = $1 AND u.user_external_code LIKE 'SYN_RBR-%'`,
    [tenantId],
  );
  return { skillEvidence: Number(se.rows[0]!.c), kpiEvidence: Number(ke.rows[0]!.c) };
}

// Blueprint-derived expected set + live pre-state (skills already present in the
// target tenant by natural key are reused by materialize, not created).
const arche = getArchetype(ARCHETYPE)!;
const A = {
  ou: arche.orgUnits.length,
  pos: arche.positions.length,
  users: archetypeUsers(arche).length,
  skills: arche.skills.length,
  kpis: arche.kpis.length,
};
let preexistingSkills = 0;
const FULL = () =>
  C(A.ou, A.pos, A.users, A.pos, A.skills, A.kpis, A.users * A.skills, A.users * A.kpis);
const CREATED_FIRST = () =>
  C(A.ou, A.pos, A.users, A.pos, A.skills - preexistingSkills, A.kpis, A.users * A.skills, A.users * A.kpis);
const SKIPPED_FIRST = () =>
  C(0, 0, 0, 0, preexistingSkills, 0, 0, 0);

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "enzo.spenuso@heuresys.com");
  federica = await login(suite, "federica.marchetti@rtl-bank.org");
  await purgeRbr(RTL);
  await purgeRbr(HEU);
  const pre = await pool.query<{ c: string }>(
    `SELECT count(*) AS c FROM sys.sys_skills
      WHERE skill_tenant_id = $1
        AND (skill_code = ANY($2::text[]) OR lower(trim(skill_name)) = ANY($3::text[]))`,
    [RTL, arche.skills.map((s) => s.code), arche.skills.map((s) => s.name.trim().toLowerCase())],
  );
  preexistingSkills = Number(pre.rows[0]!.c);
  // A non-ACTIVE tenant for the M-1 status guard.
  const t = await pool.query<{ tenant_id: string }>(
    `INSERT INTO sys.sys_tenancies (tenant_code, tenant_name, tenant_status, tenant_industry_code)
     VALUES ('TEST-MAT-SUSPENDED', '[TEST] Suspended Materialization Target', 'SUSPENDED', $1)
     RETURNING tenant_id`,
    [await anIndustryCode()],
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
    expect(a.orgUnitCount).toBe(A.ou);
    expect(a.positionCount).toBe(A.pos);
  });

  it("plan mode writes nothing and reports the full would-create set", async () => {
    const before = await countRbr(RTL);
    expect(before).toEqual({ ou: 0, pos: 0 });
    const r = await materialize(admin, RTL, "plan");
    expect(r.statusCode).toBe(200);
    const b = r.json() as Result;
    expect(b.created).toEqual(CREATED_FIRST());
    expect(b.total).toEqual(FULL());
    // No writes happened.
    expect(await countRbr(RTL)).toEqual({ ou: 0, pos: 0 });
    expect(await countSyn(RTL)).toEqual({ users: 0, assignments: 0 });
    expect(await countCatalog(RTL)).toEqual({ skills: 0, kpis: 0 });
    expect(await countEvidence(RTL)).toEqual({ skillEvidence: 0, kpiEvidence: 0 });
  });

  it("apply mode creates the org-units + positions, tagged to the target tenant", async () => {
    const r = await materialize(admin, RTL, "apply");
    expect(r.statusCode).toBe(200);
    const b = r.json() as Result;
    expect(b.tenantId).toBe(RTL);
    expect(b.created).toEqual(CREATED_FIRST());
    expect(b.skipped).toEqual(SKIPPED_FIRST());
    expect(await countRbr(RTL)).toEqual({ ou: A.ou, pos: A.pos });
    // slice-2a: each position now has a GENERATED_INCUMBENT incumbent + a PRIMARY ACTIVE assignment.
    expect(await countSyn(RTL)).toEqual({ users: A.users, assignments: A.pos });
    // slice-2b: tenant skill/KPI catalog + per-incumbent evidence. Only the RBR-coded
    // skills are NEW rows (natural-key matches are reused); evidence covers ALL skills.
    expect(await countCatalog(RTL)).toEqual({ skills: A.skills - preexistingSkills, kpis: A.kpis });
    expect(await countEvidence(RTL)).toEqual({ skillEvidence: A.users * A.skills, kpiEvidence: A.users * A.kpis });
  });

  it("re-apply is idempotent (0 created, all skipped)", async () => {
    const r = await materialize(admin, RTL, "apply");
    const b = r.json() as Result;
    expect(b.created).toEqual(C(0, 0, 0, 0, 0, 0, 0, 0));
    expect(b.skipped).toEqual(FULL());
    expect(await countRbr(RTL)).toEqual({ ou: A.ou, pos: A.pos });
    expect(await countSyn(RTL)).toEqual({ users: A.users, assignments: A.pos });
    expect(await countCatalog(RTL)).toEqual({ skills: A.skills - preexistingSkills, kpis: A.kpis });
    expect(await countEvidence(RTL)).toEqual({ skillEvidence: A.users * A.skills, kpiEvidence: A.users * A.kpis });
  });

  it("M-1 tenant isolation: a RTL materialization never touches HEURESYS", async () => {
    expect(await countRbr(HEU)).toEqual({ ou: 0, pos: 0 });
    expect(await countSyn(HEU)).toEqual({ users: 0, assignments: 0 });
    expect(await countCatalog(HEU)).toEqual({ skills: 0, kpis: 0 });
    expect(await countEvidence(HEU)).toEqual({ skillEvidence: 0, kpiEvidence: 0 });
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
    expect(await countSyn(suspendedTenantId)).toEqual({ users: 0, assignments: 0 });
    expect(await countCatalog(suspendedTenantId)).toEqual({ skills: 0, kpis: 0 });
    expect(await countEvidence(suspendedTenantId)).toEqual({ skillEvidence: 0, kpiEvidence: 0 });
  });

  it("an unknown archetype → 404", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/tenant-materialization", headers: jhdr(admin),
      payload: { tenantId: RTL, archetypeKey: "NOPE_NOT_REAL", mode: "plan" },
    });
    expect(r.statusCode).toBe(404);
  });
});
