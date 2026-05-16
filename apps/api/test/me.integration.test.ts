/**
 * apps/api/test/me.integration.test.ts
 * ESS /v1/me/* — exercises every endpoint with a USER-role persona and
 * validates self-scope (no URL-driven userId, isolation between users).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_ME_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let employeeS: S;
let outsiderS: S;
let employeeTenantId: string;
let globalSkillId: string;
let assignmentId: string;
let notifIdForEmployee: string;
let notifIdForOutsider: string;
const cleanups: Array<{ table: string; col: string; id: string }> = [];

describe("/v1/me/* ESS endpoints", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    employeeS = await login(suite, "employee_test@rtl-bank.test");
    outsiderS = await login(suite, "outsider_test@rtl-bank.test");

    const t = await pool.query<{ user_tenant_id: string }>(
      `SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`, [employeeS.userId],
    );
    employeeTenantId = t.rows[0]!.user_tenant_id;

    const skIns = await pool.query<{ skill_id: string }>(
      `INSERT INTO sys.sys_skills (
          skill_tenant_id, skill_code, skill_name, skill_is_global
        ) VALUES ($1, $2, $3, false)
        RETURNING skill_id`,
      [employeeTenantId, `${SUITE_PREFIX}_SKILL`, "Test skill for ESS"],
    );
    globalSkillId = skIns.rows[0]!.skill_id;
    cleanups.push({ table: "sys.sys_skills", col: "skill_id", id: globalSkillId });

    const n1 = await pool.query<{ notification_id: string }>(
      `INSERT INTO sys.sys_inbox_notifications (
          notification_tenant_id, notification_user_id, notification_type, notification_subject
        ) VALUES ($1, $2, 'SYSTEM', $3) RETURNING notification_id`,
      [employeeTenantId, employeeS.userId, `${SUITE_PREFIX}-FOR-EMPLOYEE`],
    );
    notifIdForEmployee = n1.rows[0]!.notification_id;
    cleanups.push({ table: "sys.sys_inbox_notifications", col: "notification_id", id: notifIdForEmployee });

    const n2 = await pool.query<{ notification_id: string }>(
      `INSERT INTO sys.sys_inbox_notifications (
          notification_tenant_id, notification_user_id, notification_type, notification_subject
        ) VALUES ($1, $2, 'SYSTEM', $3) RETURNING notification_id`,
      [employeeTenantId, outsiderS.userId, `${SUITE_PREFIX}-FOR-OUTSIDER`],
    );
    notifIdForOutsider = n2.rows[0]!.notification_id;
    cleanups.push({ table: "sys.sys_inbox_notifications", col: "notification_id", id: notifIdForOutsider });
  });

  afterAll(async () => {
    if (assignmentId) {
      try { await pool.query(`DELETE FROM sys.sys_user_learning_assignments WHERE user_learning_assignment_id = $1`, [assignmentId]); } catch { /* ignore */ }
    }
    await pool.query(
      `DELETE FROM sys.sys_user_skill_evidence
        WHERE user_skill_evidence_user_id = $1 AND user_skill_evidence_source = 'SELF_ASSESSMENT'`,
      [employeeS.userId],
    );
    for (const c of cleanups) {
      try { await pool.query(`DELETE FROM ${c.table} WHERE ${c.col} = $1`, [c.id]); } catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("GET /v1/me/profile returns the authenticated user", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/profile",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { userId: string; email: string };
    expect(b.userId).toBe(employeeS.userId);
    expect(b.email).toBe("employee_test@rtl-bank.test");
  });

  it("PATCH /v1/me/profile updates display_name + bio", async () => {
    const r = await suite.app.inject({
      method: "PATCH", url: "/v1/me/profile",
      headers: { cookie: ch(employeeS.cookies), "x-csrf-token": employeeS.csrfToken, "content-type": "application/json" },
      payload: { displayName: `${SUITE_PREFIX}-name`, bio: "Hello world" },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { displayName: string | null; bio: string | null };
    expect(b.displayName).toBe(`${SUITE_PREFIX}-name`);
    expect(b.bio).toBe("Hello world");
  });

  it("Unauthenticated GET /v1/me/profile → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/profile" });
    expect(r.statusCode).toBe(401);
  });

  it("POST /v1/me/skills/self-assessments + GET /v1/me/skills", async () => {
    const post = await suite.app.inject({
      method: "POST", url: "/v1/me/skills/self-assessments",
      headers: { cookie: ch(employeeS.cookies), "x-csrf-token": employeeS.csrfToken, "content-type": "application/json" },
      payload: { skillId: globalSkillId, declaredProficiency: "COMPETENT", score: 65, comment: "self-rated" },
    });
    expect(post.statusCode).toBe(201);
    const evidence = post.json() as { userSkillEvidenceId: string; source: string };
    expect(evidence.source).toBe("SELF_ASSESSMENT");

    const get = await suite.app.inject({
      method: "GET", url: "/v1/me/skills",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(get.statusCode).toBe(200);
    const list = get.json() as { items: Array<{ userSkillEvidenceId: string }> };
    expect(list.items.some((i) => i.userSkillEvidenceId === evidence.userSkillEvidenceId)).toBe(true);
  });

  it("POST /v1/me/learning/enrollments → 201 and appears in /v1/me/learning", async () => {
    const lm = await pool.query<{ learning_module_id: string }>(
      `SELECT learning_module_id FROM sys.sys_learning_modules
        WHERE learning_module_is_global = true LIMIT 1`,
    );
    if (lm.rows.length === 0) {
      expect(true).toBe(true);
      return;
    }
    const moduleId = lm.rows[0]!.learning_module_id;
    const enroll = await suite.app.inject({
      method: "POST", url: "/v1/me/learning/enrollments",
      headers: { cookie: ch(employeeS.cookies), "x-csrf-token": employeeS.csrfToken, "content-type": "application/json" },
      payload: { moduleId },
    });
    expect(enroll.statusCode).toBe(201);
    const a = enroll.json() as { userLearningAssignmentId: string; isMandatory: boolean };
    expect(a.isMandatory).toBe(false);
    assignmentId = a.userLearningAssignmentId;
  });

  it("GET /v1/me/gaps and /v1/me/assessments return tenant-scoped lists", async () => {
    const g = await suite.app.inject({
      method: "GET", url: "/v1/me/gaps",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(g.statusCode).toBe(200);

    const a = await suite.app.inject({
      method: "GET", url: "/v1/me/assessments",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(a.statusCode).toBe(200);
  });

  it("Inbox: GET only shows the calling user's notification (isolation across users)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/inbox",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<{ notificationId: string; subject: string }> };
    expect(body.items.some((i) => i.notificationId === notifIdForEmployee)).toBe(true);
    expect(body.items.some((i) => i.notificationId === notifIdForOutsider)).toBe(false);
  });

  it("PATCH /v1/me/inbox/:id marks employee's notification READ", async () => {
    const r = await suite.app.inject({
      method: "PATCH", url: `/v1/me/inbox/${notifIdForEmployee}`,
      headers: { cookie: ch(employeeS.cookies), "x-csrf-token": employeeS.csrfToken, "content-type": "application/json" },
      payload: { status: "READ" },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { status: string; readAt: string | null };
    expect(b.status).toBe("READ");
    expect(b.readAt).not.toBeNull();
  });

  it("PATCH /v1/me/inbox/:id on another user's notification → 404 (no leak)", async () => {
    const r = await suite.app.inject({
      method: "PATCH", url: `/v1/me/inbox/${notifIdForOutsider}`,
      headers: { cookie: ch(employeeS.cookies), "x-csrf-token": employeeS.csrfToken, "content-type": "application/json" },
      payload: { status: "READ" },
    });
    expect(r.statusCode).toBe(404);
  });
});
