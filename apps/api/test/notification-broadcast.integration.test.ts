/**
 * apps/api/test/notification-broadcast.integration.test.ts
 * 3.4 Slice B4 — POST /v1/notifications SYSTEM broadcast (admin) against the
 * live OCI DB. Asserts the RBAC gate (notification:create), CSRF, the emit
 * count, inbox delivery, and the non-admin 403. D-23: afterAll deletes the rows.
 * #74 (ex D-70) — GET /v1/notifications/broadcasts: audit of sent broadcasts
 * (one row per event, recipients/readCount aggregated, I5 tenant scoping).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUBJECT = "E2E-3.4 broadcast";
const ANTONIO = "6e815bb9-81f3-46b5-b234-0d807fdbe518";

function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(app: TestApp["app"], email: string): Promise<Map<string, string>> {
  const r = await loginRaw(app, email, PWD);
  const m = new Map<string, string>();
  for (const c of r.cookies) m.set(c.name, c.value);
  return m;
}

let suite: TestApp;
let admin: Map<string, string>;
let employee: Map<string, string>;

describe("3.4 SYSTEM broadcast — POST /v1/notifications (live)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    admin = await login(suite.app, "enzo.spenuso@heuresys.com");
    employee = await login(suite.app, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM sys.sys_inbox_notifications WHERE notification_subject = $1`, [SUBJECT]);
    await suite.app.close();
    await closePool();
  });

  it("USER (no notification:create) → 403", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/notifications",
      headers: { cookie: ch(employee), "x-csrf-token": employee.get("hrx_csrf") ?? "" },
      payload: { userIds: [ANTONIO], subject: SUBJECT },
    });
    expect(r.statusCode).toBe(403);
  });

  it("PLATFORM_ADMIN broadcasts SYSTEM to a target user → delivered", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/notifications",
      headers: { cookie: ch(admin), "x-csrf-token": admin.get("hrx_csrf") ?? "" },
      payload: { userIds: [ANTONIO], subject: SUBJECT, body: "Manutenzione programmata", priority: "HIGH" },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { requested: number; emitted: number };
    expect(body.requested).toBe(1);
    expect(body.emitted).toBe(1);

    const n = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_inbox_notifications
        WHERE notification_type = 'SYSTEM' AND notification_subject = $1 AND notification_user_id = $2`,
      [SUBJECT, ANTONIO],
    );
    expect(n.rows[0]!.n).toBe(1);
  });

  it("#74 GET /broadcasts — USER (no notification:create) → 403", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/notifications/broadcasts",
      headers: { cookie: ch(employee) },
    });
    expect(r.statusCode).toBe(403);
  });

  it("#74 GET /broadcasts — the sent broadcast appears as ONE audit event", async () => {
    // second recipient in the same event: proves per-event aggregation (2 rows → 1 item)
    const tommaso = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE user_email = 'tommaso.fiore@rtl-bank.org'`,
    );
    const audited = `${SUBJECT} audit`;
    const post = await suite.app.inject({
      method: "POST",
      url: "/v1/notifications",
      headers: { cookie: ch(admin), "x-csrf-token": admin.get("hrx_csrf") ?? "" },
      payload: {
        userIds: [ANTONIO, tommaso.rows[0]!.user_id],
        subject: audited,
        body: "Audit trail broadcast",
        priority: "MEDIUM",
      },
    });
    expect(post.statusCode).toBe(200);
    expect((post.json() as { emitted: number }).emitted).toBe(2);

    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/notifications/broadcasts?limit=100",
      headers: { cookie: ch(admin) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      items: Array<{ subject: string; recipients: number; readCount: number; createdByEmail: string | null; priority: string }>;
      total: number;
    };
    const events = body.items.filter((i) => i.subject === audited);
    expect(events).toHaveLength(1); // one EVENT, not one row per recipient
    expect(events[0]!.recipients).toBe(2);
    expect(events[0]!.readCount).toBe(0);
    expect(events[0]!.priority).toBe("MEDIUM");
    expect(events[0]!.createdByEmail).toBe("enzo.spenuso@heuresys.com");
    expect(body.total).toBeGreaterThanOrEqual(1);

    // cleanup of this test's own event (D-23 idiom)
    await pool.query(`DELETE FROM sys.sys_inbox_notifications WHERE notification_subject = $1`, [audited]);
  });

  it("#74 GET /broadcasts — I5: TENANT_ADMIN sees only own-tenant recipients", async () => {
    const federica = await login(suite.app, "federica.marchetti@rtl-bank.org");
    // event reaching BOTH tenants: 1 RTL user + 1 HEURESYS user (derived live)
    const targets = await pool.query<{ user_id: string; user_email: string }>(
      `SELECT user_id, user_email FROM sys.sys_users
        WHERE user_email IN ('antonio.parisi@rtl-bank.org', 'enzo.spenuso@heuresys.com')`,
    );
    expect(targets.rows).toHaveLength(2);
    const crossSubject = `${SUBJECT} cross-tenant`;
    const post = await suite.app.inject({
      method: "POST",
      url: "/v1/notifications",
      headers: { cookie: ch(admin), "x-csrf-token": admin.get("hrx_csrf") ?? "" },
      payload: { userIds: targets.rows.map((t) => t.user_id), subject: crossSubject },
    });
    expect(post.statusCode).toBe(200);

    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/notifications/broadcasts?limit=100",
      headers: { cookie: ch(federica) },
    });
    expect(r.statusCode).toBe(200);
    const items = (r.json() as { items: Array<{ subject: string; recipients: number; tenants: number }> }).items;
    const ev = items.filter((i) => i.subject === crossSubject);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.recipients).toBe(1); // only the RTL recipient — never cross-tenant counts
    expect(ev[0]!.tenants).toBe(1);

    await pool.query(`DELETE FROM sys.sys_inbox_notifications WHERE notification_subject = $1`, [crossSubject]);
  });
});
