/**
 * apps/api/test/positions.integration.test.ts
 * Integration tests for /v1/positions/* + PIP view + skills sub-resource.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const PLATFORM_EMAIL = "admin@heuresys.com";
const TENANT_ADMIN_EMAIL = "federica.marchetti@rtl-bank.org";
const MANAGER_EMAIL = "paolo.caputo@rtl-bank.org";
const EMPLOYEE_EMAIL = "tommaso.fiore@rtl-bank.org";

const SUITE_PREFIX = `IT_POS_${randomUUID().slice(0, 8).toUpperCase()}`;

interface Session {
  cookies: Map<string, string>;
  csrfToken: string;
  userId: string;
}
function cookieHeader(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<Session> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { user: { userId: string }; csrfToken: string };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

let suite: TestApp;
let platformS: Session;
let tenantS: Session;
let managerS: Session;
let employeeS: Session;
let rtlTenantId: string;
let mgrOwnedPositionId: string;
let testSkillId: string;
const createdPositionIds: string[] = [];

describe("/v1/positions/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, PLATFORM_EMAIL);
    tenantS = await login(suite, TENANT_ADMIN_EMAIL);
    managerS = await login(suite, MANAGER_EMAIL);
    employeeS = await login(suite, EMPLOYEE_EMAIL);

    const tenantRow = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`,
    );
    rtlTenantId = tenantRow.rows[0]!.tenant_id;

    // Manager's owned position (set up by extended seed-test-admin).
    const mgrPosRow = await pool.query<{ position_id: string }>(
      `SELECT position_id FROM sys.sys_positions
        WHERE position_tenant_id = $1 AND position_owner_user_id = (SELECT user_id FROM sys.sys_users WHERE lower(user_email) = 'paolo.caputo@rtl-bank.org')`,
      [rtlTenantId],
    );
    mgrOwnedPositionId = mgrPosRow.rows[0]!.position_id;

    // Insert a disposable test skill so we can exercise skill sub-resource
    // routes (skills table starts empty in the seed). Skip ON CONFLICT
    // because the unique index uses COALESCE(skill_tenant_id, zero-uuid)
    // which doesn't match a plain conflict target — do find-or-insert.
    const skillCode = `${SUITE_PREFIX}_SKILL`;
    const existing = await pool.query<{ skill_id: string }>(
      `SELECT skill_id FROM sys.sys_skills
        WHERE skill_tenant_id = $1 AND skill_code = $2`,
      [rtlTenantId, skillCode],
    );
    if (existing.rows.length > 0) {
      testSkillId = existing.rows[0]!.skill_id;
    } else {
      const ins = await pool.query<{ skill_id: string }>(
        `INSERT INTO sys.sys_skills (skill_tenant_id, skill_code, skill_name)
         VALUES ($1, $2, '[TEST] Disposable Skill')
         RETURNING skill_id`,
        [rtlTenantId, skillCode],
      );
      testSkillId = ins.rows[0]!.skill_id;
    }
  });

  afterAll(async () => {
    for (const id of createdPositionIds) {
      try {
        await pool.query(`DELETE FROM sys.sys_position_skill_requirements WHERE position_id = $1`, [id]);
        await pool.query(`DELETE FROM sys.sys_positions WHERE position_id = $1`, [id]);
      } catch {
        /* ignore */
      }
    }
    try {
      await pool.query(`DELETE FROM sys.sys_position_skill_requirements WHERE position_id = $1 AND skill_id = $2`, [
        mgrOwnedPositionId,
        testSkillId,
      ]);
      await pool.query(`DELETE FROM sys.sys_skills WHERE skill_id = $1`, [testSkillId]);
    } catch {
      /* ignore */
    }
    await suite.app.close();
    await closePool();
  });

  /* -------------------------------------------------- list / get */

  it("LIST: USER (any authenticated) can list positions in own tenant", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/positions?limit=200",
      headers: { cookie: cookieHeader(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { total: number; items: { tenantId: string }[] };
    expect(body.total).toBeGreaterThanOrEqual(158); // 158 real rtl positions (own tenant)
    const tenants = new Set(body.items.map((p) => p.tenantId));
    expect(tenants.size).toBe(1);
    expect([...tenants][0]).toBe(rtlTenantId);
  });

  it("GET :id reads a position in own tenant", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/positions/${mgrOwnedPositionId}`,
      headers: { cookie: cookieHeader(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { code: string };
    expect(body.code).toBeTruthy();
  });

  /* -------------------------------------------------- create */

  it("CREATE: TENANT_ADMIN → 201 + defaults; duplicate code → 409", async () => {
    const code = `${SUITE_PREFIX}_CREATE`;
    const first = await suite.app.inject({
      method: "POST",
      url: "/v1/positions",
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, title: "Created by Tenant Admin", criticality: "HIGH" },
    });
    expect(first.statusCode).toBe(201);
    const body = first.json() as { positionId: string; isActive: boolean; criticality: string };
    expect(body.isActive).toBe(true);
    expect(body.criticality).toBe("HIGH");
    createdPositionIds.push(body.positionId);

    const dup = await suite.app.inject({
      method: "POST",
      url: "/v1/positions",
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, title: "Dup attempt" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("POSITION_CODE_CONFLICT");
  });

  it("CREATE: MANAGER → 403 (no position:create per matrix)", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/positions",
      headers: {
        cookie: cookieHeader(managerS.cookies),
        "x-csrf-token": managerS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code: `${SUITE_PREFIX}_BLOCKED`, title: "Blocked" },
    });
    expect(r.statusCode).toBe(403);
  });

  /* -------------------------------------------------- update */

  it("UPDATE: MANAGER updates OWN position; 403 on a position not owned", async () => {
    const ok = await suite.app.inject({
      method: "PATCH",
      url: `/v1/positions/${mgrOwnedPositionId}`,
      headers: {
        cookie: cookieHeader(managerS.cookies),
        "x-csrf-token": managerS.csrfToken,
        "content-type": "application/json",
      },
      payload: { criticality: "CRITICAL" },
    });
    expect(ok.statusCode).toBe(200);

    // Find a synthetic RTL position that the manager does NOT own.
    const notMine = await pool.query<{ position_id: string }>(
      `SELECT position_id FROM sys.sys_positions
        WHERE position_tenant_id = $1
          AND (position_owner_user_id IS NULL OR position_owner_user_id <> $2)
        LIMIT 1`,
      [rtlTenantId, managerS.userId],
    );
    const otherId = notMine.rows[0]!.position_id;
    const blocked = await suite.app.inject({
      method: "PATCH",
      url: `/v1/positions/${otherId}`,
      headers: {
        cookie: cookieHeader(managerS.cookies),
        "x-csrf-token": managerS.csrfToken,
        "content-type": "application/json",
      },
      payload: { criticality: "LOW" },
    });
    expect(blocked.statusCode).toBe(403);
    expect((blocked.json() as { error: { code: string } }).error.code).toBe(
      "POSITION_UPDATE_FORBIDDEN",
    );
  });

  it("UPDATE: USER → 403 (no position:update perm)", async () => {
    const r = await suite.app.inject({
      method: "PATCH",
      url: `/v1/positions/${mgrOwnedPositionId}`,
      headers: {
        cookie: cookieHeader(employeeS.cookies),
        "x-csrf-token": employeeS.csrfToken,
        "content-type": "application/json",
      },
      payload: { criticality: "LOW" },
    });
    expect(r.statusCode).toBe(403);
  });

  /* -------------------------------------------------- delete */

  it("DELETE: PLATFORM_ADMIN soft-deletes a created position; 2nd DELETE → 409", async () => {
    const code = `${SUITE_PREFIX}_DEL`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/positions",
      headers: {
        cookie: cookieHeader(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, title: "Delete Target", tenantId: rtlTenantId },
    });
    expect(created.statusCode).toBe(201);
    const { positionId } = created.json() as { positionId: string };
    createdPositionIds.push(positionId);

    const del1 = await suite.app.inject({
      method: "DELETE",
      url: `/v1/positions/${positionId}`,
      headers: { cookie: cookieHeader(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(del1.statusCode).toBe(204);

    const after = await suite.app.inject({
      method: "GET",
      url: `/v1/positions/${positionId}`,
      headers: { cookie: cookieHeader(platformS.cookies) },
    });
    expect((after.json() as { isActive: boolean }).isActive).toBe(false);

    const del2 = await suite.app.inject({
      method: "DELETE",
      url: `/v1/positions/${positionId}`,
      headers: { cookie: cookieHeader(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(del2.statusCode).toBe(409);
    expect((del2.json() as { error: { code: string } }).error.code).toBe(
      "POSITION_ALREADY_INACTIVE",
    );
  });

  /* -------------------------------------------------- PIP view */

  it("GET /:id/intelligence-profile returns the PIP view payload (ADR-0008)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/positions/${mgrOwnedPositionId}/intelligence-profile`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      positionId: string;
      code: string;
      requiredSkills: unknown;
      requiredKpis: unknown;
    };
    expect(body.positionId).toBe(mgrOwnedPositionId);
    expect(body.code).toBeTruthy();
    // Aggregate fields exist (may be null/empty depending on dataset).
    expect("requiredSkills" in body).toBe(true);
    expect("requiredKpis" in body).toBe(true);
  });

  /* -------------------------------------------------- skill sub-resource */

  it("SKILLS: GET baseline; POST link → 201; GET → +1; DELETE → 204; GET → baseline", async () => {
    // The position may already carry DERIVED skill requirements (② Fase 3, mig 000096),
    // so assert RELATIVE to a baseline rather than an absolute empty list.
    const empty = await suite.app.inject({
      method: "GET",
      url: `/v1/positions/${mgrOwnedPositionId}/skills`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect(empty.statusCode).toBe(200);
    const baseline = (empty.json() as { items: unknown[] }).items.length;

    const link = await suite.app.inject({
      method: "POST",
      url: `/v1/positions/${mgrOwnedPositionId}/skills`,
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: {
        skillId: testSkillId,
        requiredProficiency: "PROFICIENT",
        weight: 2.5,
        criticality: "HIGH",
      },
    });
    expect(link.statusCode).toBe(201);
    const linkBody = link.json() as { skillId: string; requiredProficiency: string };
    expect(linkBody.skillId).toBe(testSkillId);
    expect(linkBody.requiredProficiency).toBe("PROFICIENT");

    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/positions/${mgrOwnedPositionId}/skills`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect((list.json() as { items: unknown[] }).items.length).toBe(baseline + 1);

    // Duplicate link → 409
    const dup = await suite.app.inject({
      method: "POST",
      url: `/v1/positions/${mgrOwnedPositionId}/skills`,
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { skillId: testSkillId, requiredProficiency: "EXPERT" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe(
      "POSITION_SKILL_DUPLICATE",
    );

    const del = await suite.app.inject({
      method: "DELETE",
      url: `/v1/positions/${mgrOwnedPositionId}/skills/${testSkillId}`,
      headers: { cookie: cookieHeader(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);

    const after = await suite.app.inject({
      method: "GET",
      url: `/v1/positions/${mgrOwnedPositionId}/skills`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect((after.json() as { items: unknown[] }).items.length).toBe(baseline);
  });

  /* -------------------------------------------------- kpi sub-resource (read-only) */

  it("KPIS: GET returns empty list for a freshly-created position", async () => {
    const code = `${SUITE_PREFIX}_KPI`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/positions",
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, title: "Kpi Target" },
    });
    const { positionId } = created.json() as { positionId: string };
    createdPositionIds.push(positionId);

    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/positions/${positionId}/kpis`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { items: unknown[] }).items.length).toBe(0);
  });

  /* -------------------------------------------------- kpi sub-resource WRITE (WI-D2) */

  it("KPIS WI-D2: POST ranked → GET ordered rank NULLS LAST,weight DESC; PIP carries rank; PATCH; dup 409; scope 403; DELETE", async () => {
    const code = `${SUITE_PREFIX}_KPIW`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/positions",
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, title: "Kpi Write Target" },
    });
    const { positionId } = created.json() as { positionId: string };
    createdPositionIds.push(positionId);

    // KPI definitions are GLOBAL (tenant-null); the FK only needs existence.
    const kpiRows = await pool.query<{ kpi_definition_id: string }>(
      `SELECT kpi_definition_id FROM sys.sys_kpi_definitions ORDER BY kpi_definition_code LIMIT 2`,
    );
    const kpiA = kpiRows.rows[0]!.kpi_definition_id;
    const kpiB = kpiRows.rows[1]!.kpi_definition_id;

    const postKpi = (s: Session, payload: Record<string, unknown>) =>
      suite.app.inject({
        method: "POST",
        url: `/v1/positions/${positionId}/kpis`,
        headers: { cookie: cookieHeader(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" },
        payload,
      });

    // kpiA rank 2 / weight 1, kpiB rank 1 / weight 5 → rank ordering must win.
    const a = await postKpi(tenantS, { kpiDefinitionId: kpiA, rank: 2, weight: 1 });
    expect(a.statusCode).toBe(201);
    expect((a.json() as { rank: number; kpiDefinitionId: string }).rank).toBe(2);
    const b = await postKpi(tenantS, { kpiDefinitionId: kpiB, rank: 1, weight: 5 });
    expect(b.statusCode).toBe(201);

    // GET /kpis ordered: rank 1 (kpiB) before rank 2 (kpiA).
    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/positions/${positionId}/kpis`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    const items = (list.json() as { items: { rank: number; kpiDefinitionId: string }[] }).items;
    expect(items.map((i) => i.rank)).toEqual([1, 2]);
    expect(items[0]!.kpiDefinitionId).toBe(kpiB);

    // PIP view projects rank, same ordering (requiredKpis is z.unknown() passthrough).
    const pip = await suite.app.inject({
      method: "GET",
      url: `/v1/positions/${positionId}/intelligence-profile`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    const reqKpis = (pip.json() as { requiredKpis: { rank: number; kpi_definition_id: string }[] }).requiredKpis;
    expect(reqKpis[0]!.rank).toBe(1);
    expect(reqKpis[0]!.kpi_definition_id).toBe(kpiB);

    // Duplicate (same kpi on same position) → 409.
    const dup = await postKpi(tenantS, { kpiDefinitionId: kpiA });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("POSITION_KPI_DUPLICATE");

    // PATCH rank 2 → 5.
    const patch = await suite.app.inject({
      method: "PATCH",
      url: `/v1/positions/${positionId}/kpis/${kpiA}`,
      headers: { cookie: cookieHeader(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { rank: 5 },
    });
    expect(patch.statusCode).toBe(200);
    expect((patch.json() as { rank: number }).rank).toBe(5);

    // USER (no position:update) → 403 at the permission gate.
    const userWrite = await postKpi(employeeS, { kpiDefinitionId: kpiB });
    expect(userWrite.statusCode).toBe(403);

    // MANAGER has position:update but does NOT own this position → 403 scope.
    const mgrWrite = await postKpi(managerS, { kpiDefinitionId: kpiB });
    expect(mgrWrite.statusCode).toBe(403);
    expect((mgrWrite.json() as { error: { code: string } }).error.code).toBe("POSITION_KPI_WRITE_FORBIDDEN");

    // DELETE kpiA → 204; list back to 1 (kpiB).
    const del = await suite.app.inject({
      method: "DELETE",
      url: `/v1/positions/${positionId}/kpis/${kpiA}`,
      headers: { cookie: cookieHeader(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);
    const after = await suite.app.inject({
      method: "GET",
      url: `/v1/positions/${positionId}/kpis`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect((after.json() as { items: unknown[] }).items.length).toBe(1);
  });
});
