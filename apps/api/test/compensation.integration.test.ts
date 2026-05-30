/**
 * apps/api/test/compensation.integration.test.ts
 * Integration tests for /v1/compensation/* (4 endpoints).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_COMP_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
let employeeS: S;

let testTenantId: string;
let testPositionId: string;
let testEmployeeUserId: string;

let bandId: string;
let profileId: string;
let catalogId: string;
let blueprintVariantId: string;
let gateId: string;

const cleanupIds: { kind: string; id: string }[] = [];

describe("/v1/compensation/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    employeeS = await login(suite, "tommaso.fiore@rtl-bank.org");

    // Resolve tenant + position + user from the seed.
    const t = await pool.query<{ user_tenant_id: string; user_id: string }>(
      `SELECT user_tenant_id, user_id FROM sys.sys_users
        WHERE lower(user_email) = lower('tommaso.fiore@rtl-bank.org') LIMIT 1`,
    );
    testTenantId = t.rows[0]!.user_tenant_id;
    testEmployeeUserId = t.rows[0]!.user_id;

    const p = await pool.query<{ position_id: string }>(
      `SELECT position_id FROM sys.sys_positions
        WHERE position_owner_user_id = (SELECT user_id FROM sys.sys_users WHERE lower(user_email) = 'paolo.caputo@rtl-bank.org') AND position_tenant_id = $1 LIMIT 1`,
      [testTenantId],
    );
    testPositionId = p.rows[0]!.position_id;

    // Seed: a compensation band + position compensation profile.
    const band = await pool.query<{ compensation_band_id: string }>(
      `INSERT INTO sys.sys_compensation_bands (
         compensation_band_tenant_id, compensation_band_code, compensation_band_name,
         compensation_band_min_eur, compensation_band_mid_eur, compensation_band_max_eur
       ) VALUES ($1, $2, $3, 30000, 45000, 60000)
       RETURNING compensation_band_id`,
      [testTenantId, `${SUITE_PREFIX}_BAND`, "Test Mid Band"],
    );
    bandId = band.rows[0]!.compensation_band_id;
    cleanupIds.push({ kind: "band", id: bandId });

    // Upsert profile for our test position. Use ON CONFLICT to handle prior reruns.
    const prof = await pool.query<{ position_compensation_profile_id: string }>(
      `INSERT INTO sys.sys_position_compensation_profiles (
         position_id, position_compensation_profile_tenant_id, compensation_band_id, economic_weight
       ) VALUES ($1, $2, $3, 1.25)
       ON CONFLICT (position_id) DO UPDATE
         SET compensation_band_id = EXCLUDED.compensation_band_id,
             economic_weight = EXCLUDED.economic_weight,
             updated_at = now()
       RETURNING position_compensation_profile_id`,
      [testPositionId, testTenantId, bandId],
    );
    profileId = prof.rows[0]!.position_compensation_profile_id;
    cleanupIds.push({ kind: "profile", id: profileId });

    // Seed a reward gate catalog row (under any existing blueprint variant of the tenant).
    const bp = await pool.query<{ blueprint_variant_id: string }>(
      `SELECT blueprint_variant_id FROM sys.sys_blueprint_variants LIMIT 1`,
    );
    if (!bp.rows[0]) {
      // No variants in seed → insert a minimal one for the suite (rare path).
      const f = await pool.query<{ blueprint_family_id: string }>(
        `INSERT INTO sys.sys_blueprint_families (blueprint_family_code, blueprint_family_name, blueprint_family_industry_code)
           VALUES ($1, $2, 'TEST') RETURNING blueprint_family_id`,
        [`${SUITE_PREFIX}_FAM`, "Test Family"],
      );
      const v = await pool.query<{ blueprint_variant_id: string }>(
        `INSERT INTO sys.sys_blueprint_variants (blueprint_family_id, blueprint_variant_code, blueprint_variant_name)
           VALUES ($1, $2, $3) RETURNING blueprint_variant_id`,
        [f.rows[0]!.blueprint_family_id, `${SUITE_PREFIX}_VAR`, "Test Variant"],
      );
      blueprintVariantId = v.rows[0]!.blueprint_variant_id;
      cleanupIds.push({ kind: "variant", id: blueprintVariantId });
      cleanupIds.push({ kind: "family", id: f.rows[0]!.blueprint_family_id });
    } else {
      blueprintVariantId = bp.rows[0]!.blueprint_variant_id;
    }

    const cat = await pool.query<{ reward_gate_catalog_id: string }>(
      `INSERT INTO sys.sys_reward_gate_catalog (
         reward_gate_catalog_blueprint_variant_id, reward_gate_catalog_code, reward_gate_catalog_name,
         reward_gate_catalog_description, reward_gate_catalog_is_blocking
       ) VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (reward_gate_catalog_blueprint_variant_id, reward_gate_catalog_code) DO UPDATE
         SET reward_gate_catalog_name = EXCLUDED.reward_gate_catalog_name,
             updated_at = now()
       RETURNING reward_gate_catalog_id`,
      [blueprintVariantId, `${SUITE_PREFIX}_GATE`, "Test Performance Gate", "Suite-only blocking gate"],
    );
    catalogId = cat.rows[0]!.reward_gate_catalog_id;
    cleanupIds.push({ kind: "catalog", id: catalogId });

    // Seed a reward gate + result for the employee over a known period.
    const gate = await pool.query<{ reward_gate_id: string }>(
      `INSERT INTO sys.sys_reward_gates (
         reward_gate_tenant_id, reward_gate_user_id, reward_gate_position_id,
         reward_gate_catalog_id, reward_gate_period_start, reward_gate_period_end
       ) VALUES ($1, $2, $3, $4, '2026-01-01', '2026-03-31')
       RETURNING reward_gate_id`,
      [testTenantId, testEmployeeUserId, testPositionId, catalogId],
    );
    gateId = gate.rows[0]!.reward_gate_id;
    cleanupIds.push({ kind: "gate", id: gateId });

    await pool.query(
      `INSERT INTO sys.sys_reward_gate_results (
         reward_gate_result_gate_id, reward_gate_result_tenant_id,
         reward_gate_result_status, reward_gate_result_score
       ) VALUES ($1, $2, 'PASSED', 0.92)`,
      [gateId, testTenantId],
    );
  });

  afterAll(async () => {
    // Reverse-order cleanup.
    for (const c of [...cleanupIds].reverse()) {
      try {
        if (c.kind === "gate") {
          await pool.query(`DELETE FROM sys.sys_reward_gates WHERE reward_gate_id = $1`, [c.id]);
        } else if (c.kind === "catalog") {
          await pool.query(`DELETE FROM sys.sys_reward_gate_catalog WHERE reward_gate_catalog_id = $1`, [c.id]);
        } else if (c.kind === "variant") {
          await pool.query(`DELETE FROM sys.sys_blueprint_variants WHERE blueprint_variant_id = $1`, [c.id]);
        } else if (c.kind === "family") {
          await pool.query(`DELETE FROM sys.sys_blueprint_families WHERE blueprint_family_id = $1`, [c.id]);
        } else if (c.kind === "profile") {
          await pool.query(`DELETE FROM sys.sys_position_compensation_profiles WHERE position_compensation_profile_id = $1`, [c.id]);
        } else if (c.kind === "band") {
          await pool.query(`DELETE FROM sys.sys_compensation_bands WHERE compensation_band_id = $1`, [c.id]);
        }
      } catch {
        /* ignore cleanup errors */
      }
    }
    // Recommendations + handoff records created in tests (cleanup by suite prefix).
    await pool.query(
      `DELETE FROM sys.sys_compensation_recommendations
        WHERE compensation_recommendation_narrative LIKE '%' || $1 || '%'`,
      [SUITE_PREFIX],
    );
    await pool.query(
      `DELETE FROM sys.sys_payroll_handoff_records
        WHERE payroll_handoff_record_recipient_system LIKE '%' || $1 || '%'`,
      [SUITE_PREFIX],
    );
    await suite.app.close();
    await closePool();
  });

  it("GET /profiles/:positionId as TENANT_ADMIN → 200 with band", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/compensation/profiles/${testPositionId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      positionId: string;
      tenantId: string;
      band: { code: string; midEur: string } | null;
    };
    expect(body.positionId).toBe(testPositionId);
    expect(body.tenantId).toBe(testTenantId);
    expect(body.band).not.toBeNull();
    expect(body.band!.code).toBe(`${SUITE_PREFIX}_BAND`);
    expect(body.band!.midEur).toBe("45000.00");
  });

  it("GET /profiles/:positionId as USER → 403 PERMISSION_DENIED", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/compensation/profiles/${testPositionId}`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("GET /reward-gates filtered by userId returns seeded gate with latest result", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/compensation/reward-gates?userId=${testEmployeeUserId}&periodStart=2026-01-01&periodEnd=2026-12-31`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      total: number;
      items: Array<{
        rewardGateId: string;
        catalogCode: string;
        isBlocking: boolean;
        latestResult: { status: string; score: string } | null;
      }>;
    };
    expect(body.total).toBeGreaterThanOrEqual(1);
    const ours = body.items.find((g) => g.rewardGateId === gateId);
    expect(ours).toBeDefined();
    expect(ours!.catalogCode).toBe(`${SUITE_PREFIX}_GATE`);
    expect(ours!.isBlocking).toBe(true);
    expect(ours!.latestResult).not.toBeNull();
    expect(ours!.latestResult!.status).toBe("PASSED");
  });

  it("POST /recommendations as TENANT_ADMIN → 201 with PROPOSED signal", async () => {
    const r = await suite.app.inject({
      method: "POST", url: `/v1/compensation/recommendations`,
      headers: {
        cookie: ch(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: {
        userId: testEmployeeUserId,
        positionId: testPositionId,
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        amountEur: "1500.00",
        narrative: `${SUITE_PREFIX} suite recommendation`,
      },
    });
    expect(r.statusCode).toBe(201);
    const body = r.json() as { signal: string; amountEur: string; tenantId: string };
    expect(body.signal).toBe("PROPOSED");
    expect(body.amountEur).toBe("1500.00");
    expect(body.tenantId).toBe(testTenantId);
  });

  it("POST /handoff-records as TENANT_ADMIN → 201 PENDING", async () => {
    const r = await suite.app.inject({
      method: "POST", url: `/v1/compensation/handoff-records`,
      headers: {
        cookie: ch(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: {
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        recipientSystem: `${SUITE_PREFIX}_PAYROLL_EXT`,
        payload: { batchId: SUITE_PREFIX },
      },
    });
    expect(r.statusCode).toBe(201);
    const body = r.json() as { status: string; recipientSystem: string };
    expect(body.status).toBe("PENDING");
    expect(body.recipientSystem).toBe(`${SUITE_PREFIX}_PAYROLL_EXT`);
  });

  it("POST /recommendations as USER → 403 PERMISSION_DENIED", async () => {
    const r = await suite.app.inject({
      method: "POST", url: `/v1/compensation/recommendations`,
      headers: {
        cookie: ch(employeeS.cookies),
        "x-csrf-token": employeeS.csrfToken,
        "content-type": "application/json",
      },
      payload: {
        userId: testEmployeeUserId,
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        signal: "PROPOSED",
      },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("GET /distribution as TENANT_ADMIN → 200 with PASSED bucket from seeded gate", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/compensation/distribution`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { total: number; items: Array<{ status: string; count: number }> };
    expect(body.total).toBeGreaterThanOrEqual(1);
    const passed = body.items.find((i) => i.status === "PASSED");
    expect(passed).toBeDefined();
    expect(passed!.count).toBeGreaterThanOrEqual(1);
    // total must equal the sum of bucket counts
    expect(body.items.reduce((s, i) => s + i.count, 0)).toBe(body.total);
  });

  it("GET /distribution as USER → 403 PERMISSION_DENIED", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/compensation/distribution`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("GET /profiles for non-existent position → 404", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/compensation/profiles/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
  });
});
