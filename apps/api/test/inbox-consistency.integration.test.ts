/**
 * apps/api/test/inbox-consistency.integration.test.ts — D-54 (S1018).
 *
 * sys_inbox_notifications references resources polymorphically (no FK): a hard
 * delete must purge the notifications pointing at the resource IN the same
 * transaction (lib/notifications/cleanup.ts), keeping the validation view
 * sys.v_inbox_resource_consistency at 0. This suite proves the KPI and
 * LEARNING_MODULE delete paths (the only live hard-delete sites) live on the
 * real DB, and pins the view-at-zero invariant as the regression net.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { emitNotification } from "../src/lib/notifications/emit.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_D54_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

async function orphanCount(): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.v_inbox_resource_consistency`,
  );
  return Number(r.rows[0]!.n);
}

async function notificationCountFor(resourceType: string, resourceId: string): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_inbox_notifications
      WHERE notification_resource_type = $1 AND notification_resource_id = $2`,
    [resourceType, resourceId],
  );
  return Number(r.rows[0]!.n);
}

let suite: TestApp;
let tenantS: S;
let federicaUserId: string;
let federicaTenantId: string;

describe("D-54 inbox orphan prevention (v_inbox_resource_consistency = 0)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    const u = await pool.query<{ user_id: string; user_tenant_id: string }>(
      `SELECT user_id, user_tenant_id FROM sys.sys_users WHERE user_email = $1`,
      ["federica.marchetti@rtl-bank.org"],
    );
    federicaUserId = u.rows[0]!.user_id;
    federicaTenantId = u.rows[0]!.user_tenant_id;
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("baseline: the validation view is clean on the live DB", async () => {
    expect(await orphanCount()).toBe(0);
  });

  it("KPI hard delete purges its inbox notifications in the same transaction", async () => {
    // 1. create a KPI (real API, TENANT_ADMIN)
    const created = await suite.app.inject({
      method: "POST", url: "/v1/kpi-definitions",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_KPI`, name: "D-54 KPI" },
    });
    expect(created.statusCode).toBe(201);
    const { kpiDefinitionId } = created.json() as { kpiDefinitionId: string };

    // 2. emit a notification referencing it (producer-side entry point)
    const nid = await emitNotification(pool, {
      tenantId: federicaTenantId,
      userId: federicaUserId,
      type: "SYSTEM",
      subject: "D-54 fixture — KPI reference",
      resourceType: "KPI",
      resourceId: kpiDefinitionId,
    });
    expect(nid).not.toBeNull();
    expect(await notificationCountFor("KPI", kpiDefinitionId)).toBe(1);

    // 3. hard-delete the KPI via the real route
    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/kpi-definitions/${kpiDefinitionId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);

    // 4. the notification is gone WITH the resource — zero orphans
    expect(await notificationCountFor("KPI", kpiDefinitionId)).toBe(0);
    expect(await orphanCount()).toBe(0);
  });

  it("LEARNING_MODULE hard delete purges its inbox notifications too", async () => {
    const created = await suite.app.inject({
      method: "POST", url: "/v1/learning-modules",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_LM`, title: "D-54 module" },
    });
    expect(created.statusCode).toBe(201);
    const { learningModuleId } = created.json() as { learningModuleId: string };

    const nid = await emitNotification(pool, {
      tenantId: federicaTenantId,
      userId: federicaUserId,
      type: "TRAINING_DEADLINE",
      subject: "D-54 fixture — module reference",
      resourceType: "LEARNING_MODULE",
      resourceId: learningModuleId,
    });
    expect(nid).not.toBeNull();

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/learning-modules/${learningModuleId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);

    expect(await notificationCountFor("LEARNING_MODULE", learningModuleId)).toBe(0);
    expect(await orphanCount()).toBe(0);
  });
});
