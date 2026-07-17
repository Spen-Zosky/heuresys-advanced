/**
 * apps/api/src/modules/time-off/repository.ts — A/L8 (#33).
 * Raw parameterized SQL over three dormant leave tables. READ-only.
 * Org scoping (userIdAllowList) is applied by the service via resolveOrgReadScope;
 * this layer only receives the resolved tenant filter / allow-list.
 */
import type { Pool, PoolClient } from "pg";
import type {
  TimeOffRequest,
  TimeOffRequestListQuery,
  LeaveAccrualRule,
  LeaveAccrualRuleListQuery,
  LeaveBalanceTransaction,
  LeaveBalanceTransactionListQuery,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

// ── requests ─────────────────────────────────────────────────────────────────

interface RequestRow {
  request_id: string;
  request_tenant_id: string;
  request_subject_user_id: string;
  subject_user_name: string | null;
  request_leave_type: string;
  request_start_date: string;
  request_end_date: string;
  request_days_requested: string;
  request_half_day_start: boolean;
  request_half_day_end: boolean;
  request_reason: string | null;
  request_status: string;
  request_approver_user_id: string | null;
  request_approved_at: Date | null;
  request_rejection_reason: string | null;
  request_overlap_approved: boolean;
  request_medical_cert_required: boolean;
  request_medical_cert_uploaded: boolean;
  request_cancellation_requested: boolean;
  request_cancellation_reason: string | null;
  request_cancelled_at: Date | null;
  request_cancelled_by_user_id: string | null;
  request_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const REQUEST_COLS = `request_id, request_tenant_id, request_subject_user_id,
  (SELECT u.user_display_name FROM sys.sys_users u WHERE u.user_id = request_subject_user_id) AS subject_user_name,
  request_leave_type, request_start_date::text AS request_start_date, request_end_date::text AS request_end_date,
  request_days_requested, request_half_day_start, request_half_day_end, request_reason, request_status,
  request_approver_user_id, request_approved_at, request_rejection_reason, request_overlap_approved,
  request_medical_cert_required, request_medical_cert_uploaded, request_cancellation_requested,
  request_cancellation_reason, request_cancelled_at, request_cancelled_by_user_id, request_metadata,
  created_at, updated_at`;

function toRequest(r: RequestRow): TimeOffRequest {
  return {
    requestId: r.request_id,
    tenantId: r.request_tenant_id,
    subjectUserId: r.request_subject_user_id,
    subjectUserName: r.subject_user_name ?? null,
    leaveType: r.request_leave_type,
    startDate: r.request_start_date,
    endDate: r.request_end_date,
    daysRequested: Number(r.request_days_requested),
    halfDayStart: r.request_half_day_start,
    halfDayEnd: r.request_half_day_end,
    reason: r.request_reason,
    status: r.request_status,
    approverUserId: r.request_approver_user_id,
    approvedAt: r.request_approved_at ? r.request_approved_at.toISOString() : null,
    rejectionReason: r.request_rejection_reason,
    overlapApproved: r.request_overlap_approved,
    medicalCertRequired: r.request_medical_cert_required,
    medicalCertUploaded: r.request_medical_cert_uploaded,
    cancellationRequested: r.request_cancellation_requested,
    cancellationReason: r.request_cancellation_reason,
    cancelledAt: r.request_cancelled_at ? r.request_cancelled_at.toISOString() : null,
    cancelledByUserId: r.request_cancelled_by_user_id,
    metadata: r.request_metadata ?? {},
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listRequests(
  q: DbConnector,
  filter: { tenantId?: string; userIdAllowList?: string[]; query: TimeOffRequestListQuery },
): Promise<{ items: TimeOffRequest[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`request_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    if (filter.userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(filter.userIdAllowList);
    where.push(`request_subject_user_id = ANY($${params.length}::uuid[])`);
  }
  if (filter.query.userId) {
    params.push(filter.query.userId);
    where.push(`request_subject_user_id = $${params.length}`);
  }
  if (filter.query.status) {
    params.push(filter.query.status);
    where.push(`request_status = $${params.length}`);
  }
  if (filter.query.leaveType) {
    params.push(filter.query.leaveType);
    where.push(`request_leave_type = $${params.length}`);
  }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_time_off_requests ${wc}`,
    params,
  );
  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<RequestRow>(
    `SELECT ${REQUEST_COLS} FROM sys.sys_time_off_requests ${wc}
      ORDER BY request_start_date DESC, request_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toRequest) };
}

/** ESS self view (I17) — the subject's own requests, no org gate. */
export async function listRequestsForUser(
  q: DbConnector,
  userId: string,
  query: TimeOffRequestListQuery,
): Promise<{ items: TimeOffRequest[]; total: number }> {
  return listRequests(q, { userIdAllowList: [userId], query });
}

// ── accrual rules (tenant policy — no person rows) ───────────────────────────

interface RuleRow {
  accrual_rule_id: string;
  accrual_rule_tenant_id: string;
  accrual_rule_leave_type: string;
  accrual_rule_name: string;
  accrual_rule_description: string | null;
  accrual_rule_method: string;
  accrual_rule_amount: string;
  accrual_rule_max_accrual: string | null;
  accrual_rule_allow_carryover: boolean;
  accrual_rule_max_carryover_days: string | null;
  accrual_rule_carryover_expiry_months: number | null;
  accrual_rule_min_tenure_months: number;
  accrual_rule_prorated_first_year: boolean;
  accrual_rule_ccnl_type: string | null;
  accrual_rule_is_ccnl_default: boolean;
  accrual_rule_is_active: boolean;
  accrual_rule_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const RULE_COLS = `accrual_rule_id, accrual_rule_tenant_id, accrual_rule_leave_type, accrual_rule_name,
  accrual_rule_description, accrual_rule_method, accrual_rule_amount, accrual_rule_max_accrual,
  accrual_rule_allow_carryover, accrual_rule_max_carryover_days, accrual_rule_carryover_expiry_months,
  accrual_rule_min_tenure_months, accrual_rule_prorated_first_year, accrual_rule_ccnl_type,
  accrual_rule_is_ccnl_default, accrual_rule_is_active, accrual_rule_metadata, created_at, updated_at`;

function toRule(r: RuleRow): LeaveAccrualRule {
  return {
    accrualRuleId: r.accrual_rule_id,
    tenantId: r.accrual_rule_tenant_id,
    leaveType: r.accrual_rule_leave_type,
    name: r.accrual_rule_name,
    description: r.accrual_rule_description,
    method: r.accrual_rule_method,
    amount: Number(r.accrual_rule_amount),
    maxAccrual: r.accrual_rule_max_accrual === null ? null : Number(r.accrual_rule_max_accrual),
    allowCarryover: r.accrual_rule_allow_carryover,
    maxCarryoverDays:
      r.accrual_rule_max_carryover_days === null ? null : Number(r.accrual_rule_max_carryover_days),
    carryoverExpiryMonths: r.accrual_rule_carryover_expiry_months,
    minTenureMonths: r.accrual_rule_min_tenure_months,
    proratedFirstYear: r.accrual_rule_prorated_first_year,
    ccnlType: r.accrual_rule_ccnl_type,
    isCcnlDefault: r.accrual_rule_is_ccnl_default,
    isActive: r.accrual_rule_is_active,
    metadata: r.accrual_rule_metadata ?? {},
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listAccrualRules(
  q: DbConnector,
  tenantId: string | undefined,
  query: LeaveAccrualRuleListQuery,
): Promise<{ items: LeaveAccrualRule[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (tenantId) {
    params.push(tenantId);
    where.push(`accrual_rule_tenant_id = $${params.length}`);
  }
  if (query.leaveType) {
    params.push(query.leaveType);
    where.push(`accrual_rule_leave_type = $${params.length}`);
  }
  if (query.ccnlType) {
    params.push(query.ccnlType);
    where.push(`accrual_rule_ccnl_type = $${params.length}`);
  }
  if (query.isActive !== undefined) {
    params.push(query.isActive);
    where.push(`accrual_rule_is_active = $${params.length}`);
  }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_leave_accrual_rules ${wc}`,
    params,
  );
  params.push(query.limit);
  const lim = params.length;
  params.push(query.offset);
  const off = params.length;
  const res = await q.query<RuleRow>(
    `SELECT ${RULE_COLS} FROM sys.sys_leave_accrual_rules ${wc}
      ORDER BY accrual_rule_leave_type, accrual_rule_name, accrual_rule_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toRule) };
}

// ── balance transactions (per-balance ledger — org-gated via balance) ────────

interface TxnRow {
  transaction_id: string;
  transaction_tenant_id: string;
  transaction_balance_id: string;
  balance_subject_user_id: string | null;
  transaction_type: string;
  transaction_days_amount: string;
  transaction_reference_type: string | null;
  transaction_reference_id: string | null;
  transaction_description: string | null;
  transaction_performed_by_user_id: string | null;
  transaction_metadata: Record<string, unknown>;
  created_at: Date;
}

const TXN_COLS = `t.transaction_id, t.transaction_tenant_id, t.transaction_balance_id,
  b.balance_subject_user_id, t.transaction_type, t.transaction_days_amount, t.transaction_reference_type,
  t.transaction_reference_id, t.transaction_description, t.transaction_performed_by_user_id,
  t.transaction_metadata, t.created_at`;

function toTxn(r: TxnRow): LeaveBalanceTransaction {
  return {
    transactionId: r.transaction_id,
    tenantId: r.transaction_tenant_id,
    balanceId: r.transaction_balance_id,
    subjectUserId: r.balance_subject_user_id,
    type: r.transaction_type,
    daysAmount: Number(r.transaction_days_amount),
    referenceType: r.transaction_reference_type,
    referenceId: r.transaction_reference_id,
    description: r.transaction_description,
    performedByUserId: r.transaction_performed_by_user_id,
    metadata: r.transaction_metadata ?? {},
    createdAt: r.created_at.toISOString(),
  };
}

export async function listBalanceTransactions(
  q: DbConnector,
  filter: {
    tenantId?: string;
    userIdAllowList?: string[];
    query: LeaveBalanceTransactionListQuery;
  },
): Promise<{ items: LeaveBalanceTransaction[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`t.transaction_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    if (filter.userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(filter.userIdAllowList);
    where.push(`b.balance_subject_user_id = ANY($${params.length}::uuid[])`);
  }
  if (filter.query.userId) {
    params.push(filter.query.userId);
    where.push(`b.balance_subject_user_id = $${params.length}`);
  }
  if (filter.query.balanceId) {
    params.push(filter.query.balanceId);
    where.push(`t.transaction_balance_id = $${params.length}`);
  }
  if (filter.query.type) {
    params.push(filter.query.type);
    where.push(`t.transaction_type = $${params.length}`);
  }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const from = `sys.sys_leave_balance_transactions t
    LEFT JOIN sys.sys_time_off_balances b ON b.balance_id = t.transaction_balance_id`;

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM ${from} ${wc}`,
    params,
  );
  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<TxnRow>(
    `SELECT ${TXN_COLS} FROM ${from} ${wc}
      ORDER BY t.created_at DESC, t.transaction_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toTxn) };
}
