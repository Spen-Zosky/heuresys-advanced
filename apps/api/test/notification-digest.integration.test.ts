/**
 * apps/api/test/notification-digest.integration.test.ts
 * 3.4 Slice C — notification digest chassis against the live OCI DB. Opts a real
 * user into email for one type, gives them an UNREAD notification, runs the digest
 * with an InMemoryMailer, and asserts the user received a digest with their count.
 * Email delivery in PROD is SMTP-gated (blocked-on-Enzo: SMTP creds) — this proves
 * the aggregation + mailer wiring with the test mailer.
 *
 * D-23: afterAll deletes the preference + notification rows it created.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, closePool } from "../src/db/client.js";
import { runDigest } from "../src/lib/notifications/digest.js";
import { InMemoryMailer } from "../src/modules/auth/mailer.js";

const TOMMASO = "a5e1d8ab-192a-414d-9294-ccb69aeca7d3";
const TOMMASO_EMAIL = "tommaso.fiore@rtl-bank.org";
const RTL = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0";
const MARK = "E2E-3.4 digest source";

describe("3.4 notification digest (live)", () => {
  beforeAll(async () => {
    // opt tommaso into email for SYSTEM (digest is strictly opt-in)
    await pool.query(
      `INSERT INTO sys.sys_notification_preferences (preference_tenant_id, preference_user_id, preference_notification_type, preference_in_app_enabled, preference_email_enabled)
       VALUES ($1, $2, 'SYSTEM', true, true)
       ON CONFLICT (preference_user_id, preference_notification_type)
       DO UPDATE SET preference_email_enabled = true`,
      [RTL, TOMMASO],
    );
    // give them an UNREAD notification to be digested
    await pool.query(
      `INSERT INTO sys.sys_inbox_notifications (notification_tenant_id, notification_user_id, notification_type, notification_subject, notification_status)
       VALUES ($1, $2, 'SYSTEM', $3, 'UNREAD')`,
      [RTL, TOMMASO, MARK],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM sys.sys_inbox_notifications WHERE notification_subject = $1`, [MARK]);
    await pool.query(`DELETE FROM sys.sys_notification_preferences WHERE preference_user_id = $1 AND preference_notification_type = 'SYSTEM'`, [TOMMASO]);
    await closePool();
  });

  it("runDigest sends an opted-in user a digest with their unread count", async () => {
    const mailer = new InMemoryMailer();
    const r = await runDigest(pool, mailer);
    expect(r.recipients).toBeGreaterThan(0);
    const mine = mailer.sentDigests.find((d) => d.toEmail === TOMMASO_EMAIL);
    expect(mine).toBeDefined();
    expect(mine!.unreadCount).toBeGreaterThan(0);
  });
});
