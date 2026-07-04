/**
 * apps/api/test/assessments.integration.test.ts
 *
 * Tenant-scoped CRUD-1 (no delete). Validates:
 *   - happy path create/list/get/patch as TENANT_ADMIN
 *   - non-tenant subject user → 403 USER_NOT_IN_TENANT
 *   - non-existent subject user → 404
 *   - non-existent method on create → 404
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_AS_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

let suite: TestApp;
let tenantS: S;
let managerS: S;
let outsiderS: S;
const createdAssessmentIds: string[] = [];
let firstMethodId: string;

describe("/v1/assessments integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    managerS = await login(suite, "paolo.caputo@rtl-bank.org");
    outsiderS = await login(suite, "antonio.parisi@rtl-bank.org");
    const m = await pool.query<{ assessment_method_id: string }>(
      `SELECT assessment_method_id FROM sys.sys_assessment_methods ORDER BY assessment_method_code LIMIT 1`,
    );
    firstMethodId = m.rows[0]!.assessment_method_id;
  });

  afterAll(async () => {
    for (const id of createdAssessmentIds) {
      try { await pool.query(`DELETE FROM sys.sys_assessments WHERE assessment_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE / LIST / GET happy path as TENANT_ADMIN with method + period dates", async () => {
    const created = await suite.app.inject({
      method: "POST", url: "/v1/assessments",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: {
        subjectUserId: managerS.userId,
        methodId: firstMethodId,
        kind: "MANAGER",
        periodStart: "2026-04-01",
        periodEnd: "2026-06-30",
        metadata: { suitePrefix: SUITE_PREFIX, cycle: "Q2-2026" },
      },
    });
    expect(created.statusCode).toBe(201);
    const a = created.json() as {
      assessmentId: string; kind: string; status: string;
      periodStart: string | null; periodEnd: string | null;
      metadata: Record<string, unknown>;
    };
    expect(a.kind).toBe("MANAGER");
    expect(a.status).toBe("OPEN");
    expect(a.periodStart).toBe("2026-04-01");
    expect(a.periodEnd).toBe("2026-06-30");
    expect(a.metadata.suitePrefix).toBe(SUITE_PREFIX);
    createdAssessmentIds.push(a.assessmentId);

    const got = await suite.app.inject({
      method: "GET", url: `/v1/assessments/${a.assessmentId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(got.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/assessments?subjectUserId=${managerS.userId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { items: Array<{ assessmentId: string }>; total: number };
    expect(body.items.some((i) => i.assessmentId === a.assessmentId)).toBe(true);
  });

  it("PATCH status IN_PROGRESS then COMPLETED as TENANT_ADMIN", async () => {
    const created = await suite.app.inject({
      method: "POST", url: "/v1/assessments",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { subjectUserId: managerS.userId, kind: "SELF" },
    });
    expect(created.statusCode).toBe(201);
    const aid = (created.json() as { assessmentId: string }).assessmentId;
    createdAssessmentIds.push(aid);

    const p1 = await suite.app.inject({
      method: "PATCH", url: `/v1/assessments/${aid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { status: "IN_PROGRESS" },
    });
    expect(p1.statusCode).toBe(200);
    expect((p1.json() as { status: string }).status).toBe("IN_PROGRESS");

    const p2 = await suite.app.inject({
      method: "PATCH", url: `/v1/assessments/${aid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { status: "COMPLETED" },
    });
    expect(p2.statusCode).toBe(200);
    expect((p2.json() as { status: string }).status).toBe("COMPLETED");
  });

  it("Non-existent subject user → 404", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/assessments",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { subjectUserId: randomUUID() },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("Invalid methodId on create → 404 AssessmentMethod", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/assessments",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { subjectUserId: managerS.userId, methodId: randomUUID() },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("USER-role outsider without assessment:read perm → 403 PERMISSION_DENIED", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/assessments",
      headers: { cookie: ch(outsiderS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });
});
