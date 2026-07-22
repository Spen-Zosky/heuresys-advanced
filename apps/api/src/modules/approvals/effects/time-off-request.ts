/**
 * apps/api/src/modules/approvals/effects/time-off-request.ts — B3 (#34).
 *
 * Apply-effect for `TIME_OFF_REQUEST` — the first BUSINESS approval flow.
 * The employee's submission (POST /v1/me/time-off/requests) creates ONLY the
 * approval request; nothing exists in the leave tables until the manager
 * approves and the request is applied. This handler then, atomically inside
 * the apply transaction:
 *
 *   1. writes the sys_time_off_requests row APPROVED-at-birth
 *      (natural key = the approval id → double-apply is structurally impossible,
 *      on top of the APPROVED→APPLIED status guard);
 *   2. moves the balance (used += days), guarded so availability can never go
 *      negative even if it shrank between submission and apply;
 *   3. records the USAGE transaction referencing the new time-off row.
 *
 * A rejected approval therefore needs NO compensation: there is nothing to
 * clean up — the pending state lives entirely in the approvals runtime.
 */

import type { PoolClient } from "pg";
import { ConflictError } from "../../../errors/index.js";
import type { ApprovalRequestRow } from "../repository.js";
import {
  findBalanceAvailability,
  insertApprovedTimeOffRequest,
  applyUsageToBalance,
  insertUsageTransaction,
} from "../../time-off/repository.js";

export const TIME_OFF_REQUEST = "TIME_OFF_REQUEST";

interface TimeOffMetadata {
  subjectUserId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  halfDayStart: boolean;
  halfDayEnd: boolean;
  reason: string | null;
}

function fail(msg: string): never {
  throw new ConflictError(`TIME_OFF_REQUEST apply failed: ${msg}`, "APPLY_EFFECT_FAILED");
}

function parseMetadata(meta: Record<string, unknown>): TimeOffMetadata {
  const subjectUserId = meta["subjectUserId"];
  const leaveType = meta["leaveType"];
  const startDate = meta["startDate"];
  const endDate = meta["endDate"];
  const days = meta["days"];
  if (typeof subjectUserId !== "string" || subjectUserId.length === 0) fail("metadata.subjectUserId missing");
  if (typeof leaveType !== "string" || leaveType.length === 0) fail("metadata.leaveType missing");
  if (typeof startDate !== "string" || typeof endDate !== "string") fail("metadata.startDate/endDate missing");
  if (typeof days !== "number" || !Number.isFinite(days) || days <= 0) fail("metadata.days invalid");
  return {
    subjectUserId,
    leaveType,
    startDate,
    endDate,
    days,
    halfDayStart: meta["halfDayStart"] === true,
    halfDayEnd: meta["halfDayEnd"] === true,
    reason: typeof meta["reason"] === "string" ? meta["reason"] : null,
  };
}

export async function applyTimeOffRequest(client: PoolClient, request: ApprovalRequestRow): Promise<void> {
  const meta = parseMetadata(request.metadata);
  const tenantId = request.tenantId;
  if (!tenantId) fail("approval request has no tenant");

  // Who authorized it — the most recent APPROVED step's decider (audit-true approver).
  const approver = await client.query<{ decided_by: string | null }>(
    `SELECT approval_step_decided_by AS decided_by
       FROM sys.sys_approval_steps
      WHERE approval_step_request_id = $1 AND approval_step_status = 'APPROVED'
      ORDER BY approval_step_decided_at DESC NULLS LAST
      LIMIT 1`,
    [request.approvalRequestId],
  );
  const approverUserId = approver.rows[0]?.decided_by ?? null;

  const year = Number(meta.startDate.slice(0, 4));
  const balance = await findBalanceAvailability(
    client, tenantId, meta.subjectUserId, meta.leaveType, year, true,
  );
  if (!balance) fail(`no ${meta.leaveType} balance for subject in ${year}`);
  if (balance.availableDays < meta.days) {
    fail(`insufficient balance: ${balance.availableDays} available, ${meta.days} requested`);
  }

  const timeOffRequestId = await insertApprovedTimeOffRequest(client, {
    tenantId,
    subjectUserId: meta.subjectUserId,
    leaveType: meta.leaveType,
    startDate: meta.startDate,
    endDate: meta.endDate,
    daysRequested: meta.days,
    halfDayStart: meta.halfDayStart,
    halfDayEnd: meta.halfDayEnd,
    reason: meta.reason,
    approverUserId,
    approvalRequestId: request.approvalRequestId,
  });

  const moved = await applyUsageToBalance(client, balance.balanceId, meta.days);
  if (!moved) fail("balance moved concurrently below the requested days");

  await insertUsageTransaction(client, {
    tenantId,
    balanceId: balance.balanceId,
    daysAmount: meta.days,
    timeOffRequestId,
    approvalRequestId: request.approvalRequestId,
    performedByUserId: approverUserId ?? request.createdBy,
    description: `${meta.leaveType} ${meta.startDate} → ${meta.endDate} (${meta.days}g) — approval ${request.approvalRequestId}`,
  });
}
