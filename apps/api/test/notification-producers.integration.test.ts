/**
 * apps/api/test/notification-producers.integration.test.ts
 * 3.4 Slice B — event-driven notification producers, against the live OCI DB.
 * Each producer is exercised through the real code path that triggers it, then
 * the emitted rows are asserted in sys_inbox_notifications.
 *
 * D-23 hygiene: every producer uses a stable, recognisable subject string;
 * afterAll deletes exactly those rows (best-effort) so the inbox is not polluted.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, closePool } from "../src/db/client.js";
import { insightsService } from "../src/modules/insights/service.js";

// Subjects emitted by the producers under test (kept in sync with the services).
const SUBJECTS = ["Gap di competenze da colmare"];

describe("3.4 notification producers (live)", () => {
  let adminId: string;

  beforeAll(async () => {
    const u = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE user_email = $1`,
      ["admin@heuresys.com"],
    );
    adminId = u.rows[0]!.user_id;
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM sys.sys_inbox_notifications WHERE notification_subject = ANY($1)`,
      [SUBJECTS],
    );
    await closePool();
  });

  it("insights recomputeSkillGap → emits GAP_CLOSURE_DUE for high-gap subjects", async () => {
    await insightsService.recomputeSkillGap({ userId: adminId, tenantId: null, roles: ["PLATFORM_ADMIN"] });
    const r = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_inbox_notifications
        WHERE notification_type = 'GAP_CLOSURE_DUE' AND notification_subject = 'Gap di competenze da colmare'`,
    );
    expect(r.rows[0]!.n).toBeGreaterThan(0);

    // dedupe: a second recompute must not add more UNREAD GAP_CLOSURE_DUE rows.
    const before = r.rows[0]!.n;
    await insightsService.recomputeSkillGap({ userId: adminId, tenantId: null, roles: ["PLATFORM_ADMIN"] });
    const r2 = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_inbox_notifications
        WHERE notification_type = 'GAP_CLOSURE_DUE' AND notification_subject = 'Gap di competenze da colmare'`,
    );
    expect(r2.rows[0]!.n).toBe(before);
  });
});
