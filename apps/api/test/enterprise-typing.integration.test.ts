/**
 * apps/api/test/enterprise-typing.integration.test.ts
 * Covers the full enterprise typing pipeline:
 *   ATECO class → mapping to NACE class → size band → operating model →
 *   typing profile upsert per tenant.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_ET_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
let atecoId: string;
let naceId: string;
let mappingId: string;
let sizeBandId: string;
let operatingModelId: string;
let profileId: string | null = null;

describe("/v1/enterprise-typing pipeline", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "tenant_admin_test@rtl-bank.test");
  });

  afterAll(async () => {
    if (profileId) {
      try { await pool.query(`DELETE FROM sys.sys_enterprise_typing_profiles WHERE enterprise_typing_profile_id = $1`, [profileId]); }
      catch { /* ignore */ }
    }
    if (mappingId) {
      try { await pool.query(`DELETE FROM sys.sys_activity_classification_mappings WHERE activity_class_mapping_id = $1`, [mappingId]); }
      catch { /* ignore */ }
    }
    for (const id of [atecoId, naceId]) {
      if (!id) continue;
      try { await pool.query(`DELETE FROM sys.sys_activity_classifications WHERE activity_classification_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    if (sizeBandId) {
      try { await pool.query(`DELETE FROM sys.sys_enterprise_size_bands WHERE enterprise_size_band_id = $1`, [sizeBandId]); }
      catch { /* ignore */ }
    }
    if (operatingModelId) {
      try { await pool.query(`DELETE FROM sys.sys_operating_model_catalog WHERE operating_model_id = $1`, [operatingModelId]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("PLATFORM_ADMIN creates two activity classifications and a mapping", async () => {
    const a = await suite.app.inject({
      method: "POST", url: "/v1/activity-classifications",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { scheme: "ATECO_2025", code: `${SUITE_PREFIX}_A`, name: "ATECO test class" },
    });
    expect(a.statusCode).toBe(201);
    atecoId = (a.json() as { activityClassificationId: string }).activityClassificationId;

    const n = await suite.app.inject({
      method: "POST", url: "/v1/activity-classifications",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { scheme: "NACE_REV_2_1", code: `${SUITE_PREFIX}_N`, name: "NACE test class" },
    });
    expect(n.statusCode).toBe(201);
    naceId = (n.json() as { activityClassificationId: string }).activityClassificationId;

    const m = await suite.app.inject({
      method: "POST", url: "/v1/activity-classification-mappings",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { sourceId: atecoId, targetId: naceId, kind: "EXACT", confidence: 0.95 },
    });
    expect(m.statusCode).toBe(201);
    mappingId = (m.json() as { activityClassMappingId: string }).activityClassMappingId;
  });

  it("TENANT_ADMIN cannot create classifications → 403", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/activity-classifications",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { scheme: "ATECO_2025", code: `${SUITE_PREFIX}_TEN`, name: "Tenant should fail" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("Duplicate (scheme, code) → 409 ACTIVITY_CLASSIFICATION_CONFLICT", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/activity-classifications",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { scheme: "ATECO_2025", code: `${SUITE_PREFIX}_A`, name: "Duplicate" },
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("ACTIVITY_CLASSIFICATION_CONFLICT");
  });

  it("PUT size band + PUT operating model (idempotent)", async () => {
    const sb = await suite.app.inject({
      method: "PUT", url: "/v1/enterprise-size-bands",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: "XL", name: "Extra Large (test)", minEmployees: 5000, description: "test" },
    });
    expect(sb.statusCode).toBe(200);
    sizeBandId = (sb.json() as { enterpriseSizeBandId: string }).enterpriseSizeBandId;

    const sb2 = await suite.app.inject({
      method: "PUT", url: "/v1/enterprise-size-bands",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: "XL", name: "Extra Large (test v2)", minEmployees: 4000 },
    });
    expect(sb2.statusCode).toBe(200);
    expect((sb2.json() as { enterpriseSizeBandId: string }).enterpriseSizeBandId).toBe(sizeBandId);
    expect((sb2.json() as { minEmployees: number | null }).minEmployees).toBe(4000);

    const om = await suite.app.inject({
      method: "PUT", url: "/v1/operating-models",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_OM`, name: "Test Operating Model" },
    });
    expect(om.statusCode).toBe(200);
    operatingModelId = (om.json() as { operatingModelId: string }).operatingModelId;
  });

  it("TENANT_ADMIN upserts typing profile and second PUT is idempotent on tenant", async () => {
    const p1 = await suite.app.inject({
      method: "PUT", url: "/v1/enterprise-typing-profiles",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: {
        industryClassId: atecoId, sizeBandId, operatingModelId,
        regulatoryIntensity: "HIGH", employeeCount: 1200, countryCode: "IT",
      },
    });
    expect(p1.statusCode).toBe(200);
    const r1 = p1.json() as { enterpriseTypingProfileId: string; regulatoryIntensity: string };
    expect(r1.regulatoryIntensity).toBe("HIGH");
    profileId = r1.enterpriseTypingProfileId;

    const p2 = await suite.app.inject({
      method: "PUT", url: "/v1/enterprise-typing-profiles",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { industryClassId: atecoId, sizeBandId, regulatoryIntensity: "EXTREME" },
    });
    expect(p2.statusCode).toBe(200);
    expect((p2.json() as { enterpriseTypingProfileId: string }).enterpriseTypingProfileId).toBe(profileId);
    expect((p2.json() as { regulatoryIntensity: string }).regulatoryIntensity).toBe("EXTREME");
  });
});
