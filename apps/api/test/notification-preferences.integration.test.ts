/**
 * apps/api/test/notification-preferences.integration.test.ts
 * 3.4 Slice A — notification preferences API + emitNotification() against the live
 * OCI DB. Covers GET defaults, PATCH upsert/partial, validation, RBAC, and the
 * emitter (preference opt-out suppression + dedupe + inbox delivery).
 *
 * D-23 hygiene: this test writes persistent config (preferences) + inbox rows for
 * the employee persona — afterAll deletes exactly what it created (marked subjects
 * + that user's preference rows) so it never poisons the seed.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { emitNotification } from "../src/lib/notifications/emit.js";

const PWD = "Admin#PassW0rd!";
const MARK = "E2E-3.4 test notification";

function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

let suite: TestApp;
let empCookies: Map<string, string>;
let empId: string;
let empTenant: string | null;

describe("3.4 notification preferences + emitter (live)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const r = await loginRaw(suite.app, "tommaso.fiore@rtl-bank.org", PWD);
    empCookies = new Map();
    for (const c of r.cookies) empCookies.set(c.name, c.value);
    const u = await pool.query<{ user_id: string; user_tenant_id: string | null }>(
      `SELECT user_id, user_tenant_id FROM sys.sys_users WHERE user_email = $1`,
      ["tommaso.fiore@rtl-bank.org"],
    );
    empId = u.rows[0]!.user_id;
    empTenant = u.rows[0]!.user_tenant_id;
  });

  afterAll(async () => {
    // restore: remove only what this suite created.
    await pool.query(`DELETE FROM sys.sys_inbox_notifications WHERE notification_user_id = $1 AND notification_subject = $2`, [empId, MARK]);
    await pool.query(`DELETE FROM sys.sys_notification_preferences WHERE preference_user_id = $1`, [empId]);
    await suite.app.close();
    await closePool();
  });

  it("GET preferences: all nine types, default-on in-app / default-off email", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/notification-preferences", headers: { cookie: ch(empCookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { notificationType: string; inAppEnabled: boolean; emailEnabled: boolean }[]; total: number };
    // 9 = NotificationType enum size (S997 added APPROVAL_REMINDER + APPROVAL_OVERDUE for the BPM SLA scheduler).
    expect(body.total).toBe(9);
    expect(body.items.every((i) => i.inAppEnabled === true && i.emailEnabled === false)).toBe(true);
    expect(body.items.map((i) => i.notificationType).sort()).toContain("SYSTEM");
  });

  it("unauthenticated → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/notification-preferences" });
    expect(r.statusCode).toBe(401);
  });

  it("PATCH with no channel field → 400 (refine)", async () => {
    const csrf = empCookies.get("hrx_csrf");
    const r = await suite.app.inject({
      method: "PATCH",
      url: "/v1/me/notification-preferences",
      headers: { cookie: ch(empCookies), "x-csrf-token": csrf ?? "" },
      payload: { notificationType: "SYSTEM" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("PATCH opt-out then re-enable email persists (partial upsert)", async () => {
    const csrf = empCookies.get("hrx_csrf") ?? "";
    // opt out of SYSTEM in-app
    let r = await suite.app.inject({
      method: "PATCH", url: "/v1/me/notification-preferences",
      headers: { cookie: ch(empCookies), "x-csrf-token": csrf },
      payload: { notificationType: "SYSTEM", inAppEnabled: false },
    });
    expect(r.statusCode).toBe(200);
    let body = r.json() as { items: { notificationType: string; inAppEnabled: boolean; emailEnabled: boolean }[] };
    let sys = body.items.find((i) => i.notificationType === "SYSTEM")!;
    expect(sys.inAppEnabled).toBe(false);
    expect(sys.emailEnabled).toBe(false);

    // partial: enable email only — in-app stays false (COALESCE keeps it)
    r = await suite.app.inject({
      method: "PATCH", url: "/v1/me/notification-preferences",
      headers: { cookie: ch(empCookies), "x-csrf-token": csrf },
      payload: { notificationType: "SYSTEM", emailEnabled: true },
    });
    body = r.json() as { items: { notificationType: string; inAppEnabled: boolean; emailEnabled: boolean }[] };
    sys = body.items.find((i) => i.notificationType === "SYSTEM")!;
    expect(sys.inAppEnabled).toBe(false);
    expect(sys.emailEnabled).toBe(true);
  });

  it("emitNotification delivers to the inbox, respects opt-out, and dedupes", async () => {
    // default-on type (TRAINING_DEADLINE) → delivered
    const id1 = await emitNotification(pool, {
      tenantId: empTenant, userId: empId, type: "TRAINING_DEADLINE", subject: MARK, priority: "INFO",
    });
    expect(id1).not.toBeNull();
    const inbox = await suite.app.inject({ method: "GET", url: "/v1/me/inbox", headers: { cookie: ch(empCookies) } });
    const items = (inbox.json() as { items: { subject: string }[] }).items;
    expect(items.some((i) => i.subject === MARK)).toBe(true);

    // SYSTEM is opted out in-app (set above) → suppressed (null)
    const id2 = await emitNotification(pool, {
      tenantId: empTenant, userId: empId, type: "SYSTEM", subject: MARK,
    });
    expect(id2).toBeNull();

    // dedupe: same (user,type,resource) UNREAD → second emit suppressed
    const res = "11111111-1111-1111-1111-111111111111";
    const a = await emitNotification(pool, { tenantId: empTenant, userId: empId, type: "GAP_CLOSURE_DUE", subject: MARK, resourceId: res, dedupe: true });
    const b = await emitNotification(pool, { tenantId: empTenant, userId: empId, type: "GAP_CLOSURE_DUE", subject: MARK, resourceId: res, dedupe: true });
    expect(a).not.toBeNull();
    expect(b).toBeNull();
  });
});
