/**
 * apps/api/src/modules/approvals/sla.ts — 3.3 BPM approval-flow slice-3b.
 *
 * The SLA/escalation scanner for the approval runtime (000132 + 000141). Detects
 * PENDING approval steps whose due_at has passed and:
 *   - emits an APPROVAL_REMINDER in-app notification to the approver (dedupe → at
 *     most one UNREAD reminder per step at a time, no spam),
 *   - bumps reminder_count each cycle,
 *   - once reminder_count reaches ESCALATE_AFTER and the step has not been
 *     escalated yet, emits an APPROVAL_OVERDUE escalation to the request creator
 *     and stamps escalated_at (once).
 *
 * Mirrors the digest scheduler (lib/notifications/digest.ts): invoked by a systemd
 * timer via the CLI (approvals:sla), NEVER by the serving API. Best-effort per row
 * — a single bad step must not abort the scheduled run. In-app is fully functional
 * without SMTP (escalation email would ride the digest, which is SMTP-gated).
 */
import type { Pool, PoolClient } from "pg";
import { emitNotification } from "../../lib/notifications/emit.js";

export type DbConnector = Pool | PoolClient;

/** Reminders before the step escalates to the request creator. */
export const ESCALATE_AFTER = 3;

interface OverdueStep {
  stepId: string;
  approverUserId: string;
  tenantId: string;
  reminderCount: number;
  escalatedAt: string | null;
  requestId: string;
  requestTitle: string;
  createdBy: string | null;
}

/** Pending steps, at an open level, whose due_at has elapsed on a still-pending request. */
export async function findOverdueSteps(db: DbConnector): Promise<OverdueStep[]> {
  const res = await db.query<{
    step_id: string;
    approver: string;
    tenant_id: string;
    reminder_count: number;
    escalated_at: string | null;
    request_id: string;
    title: string;
    created_by: string | null;
  }>(
    `SELECT s.approval_step_id AS step_id,
            s.approval_step_approver_user_id AS approver,
            s.approval_step_tenant_id AS tenant_id,
            s.approval_step_reminder_count AS reminder_count,
            s.approval_step_escalated_at AS escalated_at,
            r.approval_request_id AS request_id,
            r.approval_request_title AS title,
            r.created_by
       FROM sys.sys_approval_steps s
       JOIN sys.sys_approval_requests r
         ON r.approval_request_id = s.approval_step_request_id
      WHERE s.approval_step_status = 'PENDING'
        -- #168: un passo orfano (approvatore rimosso, FK SET NULL) non ha
        -- nessuno da sollecitare ne' da scalare.
        AND s.approval_step_approver_user_id IS NOT NULL
        AND s.approval_step_due_at IS NOT NULL
        AND s.approval_step_due_at < now()
        AND r.approval_request_status = 'PENDING'`,
  );
  return res.rows.map((r) => ({
    stepId: r.step_id,
    approverUserId: r.approver,
    tenantId: r.tenant_id,
    reminderCount: r.reminder_count,
    escalatedAt: r.escalated_at,
    requestId: r.request_id,
    requestTitle: r.title,
    createdBy: r.created_by,
  }));
}

export interface SlaRunResult {
  stepsScanned: number;
  remindersEmitted: number;
  escalated: number;
}

/** Scan overdue steps, remind approvers, escalate past the threshold. */
export async function runApprovalSla(db: DbConnector): Promise<SlaRunResult> {
  const overdue = await findOverdueSteps(db);
  let remindersEmitted = 0;
  let escalated = 0;

  for (const step of overdue) {
    try {
      // Bump the cycle counter regardless of dedupe (counts overdue cycles).
      const upd = await db.query<{ count: number }>(
        `UPDATE sys.sys_approval_steps
            SET approval_step_reminder_count = approval_step_reminder_count + 1
          WHERE approval_step_id = $1
          RETURNING approval_step_reminder_count AS count`,
        [step.stepId],
      );
      const newCount = upd.rows[0]?.count ?? step.reminderCount + 1;

      // Remind the approver (dedupe → no spam while a reminder stays unread).
      const emitted = await emitNotification(db, {
        tenantId: step.tenantId,
        userId: step.approverUserId,
        type: "APPROVAL_REMINDER",
        subject: `Approvazione in attesa: ${step.requestTitle}`,
        body: "Una richiesta di approvazione assegnata a te ha superato la scadenza. Aprila per decidere.",
        priority: "HIGH",
        resourceType: "APPROVAL_STEP",
        resourceId: step.stepId,
        actionUrl: "/approvals",
        dedupe: true,
      });
      if (emitted) remindersEmitted++;

      // Escalate once, after the threshold, to the request creator.
      if (newCount >= ESCALATE_AFTER && step.escalatedAt === null && step.createdBy) {
        await emitNotification(db, {
          tenantId: step.tenantId,
          userId: step.createdBy,
          type: "APPROVAL_OVERDUE",
          subject: `Approvazione scaduta: ${step.requestTitle}`,
          body: `Una richiesta che hai aperto è ferma da ${newCount} cicli senza decisione dell'approvatore.`,
          priority: "CRITICAL",
          resourceType: "APPROVAL_STEP",
          resourceId: step.stepId,
          actionUrl: "/approvals",
          dedupe: true,
        });
        await db.query(
          `UPDATE sys.sys_approval_steps SET approval_step_escalated_at = now() WHERE approval_step_id = $1`,
          [step.stepId],
        );
        escalated++;
      }
    } catch {
      /* best-effort: one bad step must not abort the scheduled run */
    }
  }

  return { stepsScanned: overdue.length, remindersEmitted, escalated };
}
