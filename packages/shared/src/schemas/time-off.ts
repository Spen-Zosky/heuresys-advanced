/**
 * @heuresys/shared — Time-off / leave read schemas. A/L8 (#33).
 *
 * Backs /v1/time-off/* over three dormant `sys.*` tables (all populated, never
 * read by any module until now):
 *   - sys_time_off_requests        (leave requests — PERSONAL, org-gated)
 *   - sys_leave_accrual_rules      (tenant leave policy — catalog, no person rows)
 *   - sys_leave_balance_transactions (per-balance ledger — PERSONAL, org-gated via balance)
 * READ-only (consultation). ESS submission stays out (Series E-E3). Balances
 * (sys_time_off_balances) are already exposed by the `me` module — not here.
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";

// ── Time-off requests ────────────────────────────────────────────────────────

/** Mirrors the DB CHECK `sys_tor_status_check` (mig 000040). Drives the web filter
 *  dropdown; the Response `status` field stays `z.string()` so a future DB value can
 *  never 500 a read (deterministic-seed lesson). */
export const TimeOffRequestStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
]);
export type TimeOffRequestStatus = z.infer<typeof TimeOffRequestStatusEnum>;

export const TimeOffRequestSchema = z.object({
  requestId: z.uuid(),
  tenantId: z.uuid(),
  subjectUserId: z.uuid(),
  /** Resolved display name of the subject user (null if the user row is gone). */
  subjectUserName: z.string().nullable(),
  leaveType: z.string(),
  startDate: z.string(), // date (YYYY-MM-DD)
  endDate: z.string(),
  daysRequested: z.number(),
  halfDayStart: z.boolean(),
  halfDayEnd: z.boolean(),
  reason: z.string().nullable(),
  status: z.string(),
  approverUserId: z.uuid().nullable(),
  approvedAt: z.iso.datetime().nullable(),
  rejectionReason: z.string().nullable(),
  overlapApproved: z.boolean(),
  medicalCertRequired: z.boolean(),
  medicalCertUploaded: z.boolean(),
  cancellationRequested: z.boolean(),
  cancellationReason: z.string().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  cancelledByUserId: z.uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type TimeOffRequest = z.infer<typeof TimeOffRequestSchema>;

export const TimeOffRequestListQuerySchema = z.object({
  userId: z.uuid().optional(),
  status: z.string().max(32).optional(),
  leaveType: z.string().max(64).optional(),
  ...paginationFields(200, 50),
});
export type TimeOffRequestListQuery = z.infer<typeof TimeOffRequestListQuerySchema>;

export const TimeOffRequestListResponseSchema = z.object({
  items: z.array(TimeOffRequestSchema),
  total: z.number().int().min(0),
});
export type TimeOffRequestListResponse = z.infer<typeof TimeOffRequestListResponseSchema>;

// ── Leave accrual rules (tenant policy — catalog) ────────────────────────────

export const LeaveAccrualRuleSchema = z.object({
  accrualRuleId: z.uuid(),
  tenantId: z.uuid(),
  leaveType: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  method: z.string(),
  amount: z.number(),
  maxAccrual: z.number().nullable(),
  allowCarryover: z.boolean(),
  maxCarryoverDays: z.number().nullable(),
  carryoverExpiryMonths: z.number().int().nullable(),
  minTenureMonths: z.number().int(),
  proratedFirstYear: z.boolean(),
  ccnlType: z.string().nullable(),
  isCcnlDefault: z.boolean(),
  isActive: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type LeaveAccrualRule = z.infer<typeof LeaveAccrualRuleSchema>;

export const LeaveAccrualRuleListQuerySchema = z.object({
  leaveType: z.string().max(64).optional(),
  ccnlType: z.string().max(64).optional(),
  isActive: z.coerce.boolean().optional(),
  ...paginationFields(200, 50),
});
export type LeaveAccrualRuleListQuery = z.infer<typeof LeaveAccrualRuleListQuerySchema>;

export const LeaveAccrualRuleListResponseSchema = z.object({
  items: z.array(LeaveAccrualRuleSchema),
  total: z.number().int().min(0),
});
export type LeaveAccrualRuleListResponse = z.infer<typeof LeaveAccrualRuleListResponseSchema>;

// ── Leave balance transactions (per-balance ledger — org-gated via balance) ──

export const LeaveBalanceTransactionSchema = z.object({
  transactionId: z.uuid(),
  tenantId: z.uuid(),
  balanceId: z.uuid(),
  /** Subject user of the balance the transaction belongs to (join). */
  subjectUserId: z.uuid().nullable(),
  type: z.string(),
  daysAmount: z.number(),
  referenceType: z.string().nullable(),
  referenceId: z.uuid().nullable(),
  description: z.string().nullable(),
  performedByUserId: z.uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type LeaveBalanceTransaction = z.infer<typeof LeaveBalanceTransactionSchema>;

export const LeaveBalanceTransactionListQuerySchema = z.object({
  userId: z.uuid().optional(),
  balanceId: z.uuid().optional(),
  type: z.string().max(32).optional(),
  ...paginationFields(200, 50),
});
export type LeaveBalanceTransactionListQuery = z.infer<typeof LeaveBalanceTransactionListQuerySchema>;

export const LeaveBalanceTransactionListResponseSchema = z.object({
  items: z.array(LeaveBalanceTransactionSchema),
  total: z.number().int().min(0),
});
export type LeaveBalanceTransactionListResponse = z.infer<
  typeof LeaveBalanceTransactionListResponseSchema
>;
