/**
 * apps/api/test/approvals-sla.integration.test.ts
 * 3.3 BPM approval-flow slice-3b — live SLA/escalation scanner against the real DB
 * (RTL_BANK personas). Proves: an overdue PENDING step reminds the approver in-app +
 * bumps reminder_count; once reminder_count reaches ESCALATE_AFTER the request creator
 * gets an APPROVAL_OVERDUE escalation (once). No mocks — real rows, cleaned up after.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "../src/db/client.js";
import { runApprovalSla, ESCALATE_AFTER } from "../src/modules/approvals/sla.js";

const APPROVER_EMAIL = "paolo.caputo@rtl-bank.org";
const CREATOR_EMAIL = "federica.marchetti@rtl-bank.org";

describe("approval SLA/escalation scanner (3.3 slice-3b)", () => {
  let tenantId: string;
  let approverId: string;
  let creatorId: string;
  let requestId: string;
  let stepId: string;

  beforeAll(async () => {
    const u = await pool.query<{ user_id: string; tenant: string; email: string }>(
      `SELECT user_id, user_tenant_id AS tenant, lower(user_email) AS email
         FROM sys.sys_users
        WHERE lower(user_email) IN ($1, $2)`,
      [APPROVER_EMAIL, CREATOR_EMAIL],
    );
    const approver = u.rows.find((r) => r.email === APPROVER_EMAIL);
    const creator = u.rows.find((r) => r.email === CREATOR_EMAIL);
    if (!approver || !creator) throw new Error("RTL_BANK SLA test personas not seeded");
    approverId = approver.user_id;
    creatorId = creator.user_id;
    tenantId = approver.tenant;

    const r = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_approval_requests
         (approval_request_tenant_id, approval_request_title, approval_request_status, created_by)
       VALUES ($1, 'E2E SLA test request (slice-3b)', 'PENDING', $2)
       RETURNING approval_request_id AS id`,
      [tenantId, creatorId],
    );
    requestId = r.rows[0]!.id;
    // Overdue PENDING step: due 2h ago.
    const s = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_approval_steps
         (approval_step_request_id, approval_step_tenant_id, approval_step_approver_user_id,
          approval_step_status, approval_step_due_at)
       VALUES ($1, $2, $3, 'PENDING', now() - interval '2 hours')
       RETURNING approval_step_id AS id`,
      [requestId, tenantId, approverId],
    );
    stepId = s.rows[0]!.id;
  });

  afterAll(async () => {
    // Clean up the throwaway rows (CASCADE removes the step; remove the inbox events).
    if (stepId) {
      await pool
        .query(`DELETE FROM sys.sys_inbox_notifications WHERE notification_resource_id = $1`, [stepId])
        .catch(() => {});
    }
    if (requestId) {
      await pool
        .query(`DELETE FROM sys.sys_approval_requests WHERE approval_request_id = $1`, [requestId])
        .catch(() => {});
    }
    // NOTE: do NOT closePool — shared across the singleThread suite.
  });

  it("reminds the approver in-app + bumps reminder_count on an overdue pending step", async () => {
    const res = await runApprovalSla(pool);
    expect(res.stepsScanned).toBeGreaterThanOrEqual(1);
    expect(res.remindersEmitted).toBeGreaterThanOrEqual(1);

    const inbox = await pool.query(
      `SELECT 1 FROM sys.sys_inbox_notifications
        WHERE notification_user_id = $1 AND notification_type = 'APPROVAL_REMINDER'
          AND notification_resource_id = $2`,
      [approverId, stepId],
    );
    expect(inbox.rowCount).toBeGreaterThanOrEqual(1);

    const step = await pool.query<{ c: number }>(
      `SELECT approval_step_reminder_count AS c FROM sys.sys_approval_steps WHERE approval_step_id = $1`,
      [stepId],
    );
    expect(step.rows[0]!.c).toBe(1);
  });

  it("escalates to the request creator once reminder_count reaches ESCALATE_AFTER", async () => {
    // One cycle already ran in the previous test; run until the threshold.
    for (let i = 1; i < ESCALATE_AFTER; i++) {
      await runApprovalSla(pool);
    }

    const step = await pool.query<{ c: number; esc: string | null }>(
      `SELECT approval_step_reminder_count AS c, approval_step_escalated_at::text AS esc
         FROM sys.sys_approval_steps WHERE approval_step_id = $1`,
      [stepId],
    );
    expect(step.rows[0]!.c).toBeGreaterThanOrEqual(ESCALATE_AFTER);
    expect(step.rows[0]!.esc).not.toBeNull();

    const esc = await pool.query(
      `SELECT 1 FROM sys.sys_inbox_notifications
        WHERE notification_user_id = $1 AND notification_type = 'APPROVAL_OVERDUE'
          AND notification_resource_id = $2`,
      [creatorId, stepId],
    );
    expect(esc.rowCount).toBeGreaterThanOrEqual(1);

    // Escalation is once: a further run must NOT add a second escalated_at / overdue.
    const escAtBefore = step.rows[0]!.esc;
    await runApprovalSla(pool);
    const step2 = await pool.query<{ esc: string | null }>(
      `SELECT approval_step_escalated_at::text AS esc FROM sys.sys_approval_steps WHERE approval_step_id = $1`,
      [stepId],
    );
    expect(step2.rows[0]!.esc).toBe(escAtBefore);
  });
});
