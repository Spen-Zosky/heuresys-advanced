/**
 * apps/api/test/notification-broadcast.integration.test.ts
 * 3.4 Slice B4 — POST /v1/notifications SYSTEM broadcast (admin) against the
 * live OCI DB. Asserts the RBAC gate (notification:create), CSRF, the emit
 * count, inbox delivery, and the non-admin 403. D-23: afterAll deletes the rows.
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
    admin = await login(suite.app, "admin@heuresys.com");
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
});
