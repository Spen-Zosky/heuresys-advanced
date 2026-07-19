/**
 * apps/api/src/modules/approvals/repository.ts
 * 3.3 slice-D — raw parameterized SQL for the generic approval runtime.
 *
 * Tenant isolation is pinned on approval_request_tenant_id / approval_step_tenant_id
 * (I5, NEVER RLS): PLATFORM_ADMIN sees all tenants; everyone else is pinned to their
 * own. The request's tenant is derived from its approvers (all approvers share one
 * tenant — enforced in the service). All multi-row writes run inside withTransaction.
 */
import type { PoolClient } from "pg";
import { pool } from "../../db/client.js";

export type DbConnector = typeof pool | PoolClient;

/** Tenant scope: PLATFORM_ADMIN is cross-tenant; everyone else pinned to own. */
export interface ScopeFilter {
  isPlatform: boolean;
  tenantId: string | null;
  /**
   * F4 (#24, ADR-0027): the FUNCTIONAL allow-list — creators whose requests this actor may
   * see (self + the members of the teams/processes they lead). Absent for platform and
   * HR-mandated actors, who keep the tenant-wide view.
   *
   * `actorUserId` is applied ALONGSIDE it, never instead: a request you were asked to
   * approve is yours to see even when its creator is outside your functional scope —
   * otherwise the approval inbox would hide the very items awaiting your decision.
   */
  visibleCreatorUserIds?: string[];
  actorUserId?: string;
}

/** SQL fragment for the F4 functional restriction; empty when the actor is unrestricted. */
function functionalClause(scope: ScopeFilter, params: unknown[], alias = "r"): string {
  if (!scope.visibleCreatorUserIds) return "";
  params.push(scope.visibleCreatorUserIds);
  const creators = params.length;
  params.push(scope.actorUserId ?? null);
  const actor = params.length;
  return ` AND (${alias}.created_by = ANY($${creators}::uuid[])
                OR EXISTS (SELECT 1 FROM sys.sys_approval_steps s2
                            WHERE s2.approval_step_request_id = ${alias}.approval_request_id
                              AND s2.approval_step_approver_user_id = $${actor}))`;
}

export interface ApprovalRequestRow {
  approvalRequestId: string;
  tenantId: string;
  title: string;
  body: string | null;
  resourceType: string | null;
  resourceId: string | null;
  status: string;
  decisionPolicy: string;
  priority: string;
  metadata: Record<string, unknown>;
  resolvedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
}

export interface ApprovalStepRow {
  approvalStepId: string;
  requestId: string;
  tenantId: string;
  approverUserId: string;
  ordinal: number;
  levelPolicy: string | null;
  status: string;
  decisionComment: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalStepDetailRow extends ApprovalStepRow {
  approverEmail: string | null;
  approverName: string | null;
}

export interface ApproverIdentity {
  userId: string;
  tenantId: string | null;
  email: string;
  name: string;
}

const iso = (d: unknown): string => (d as Date).toISOString();
const isoN = (d: unknown): string | null => (d == null ? null : (d as Date).toISOString());

const REQ_COLS = `approval_request_id, approval_request_tenant_id, approval_request_title,
  approval_request_body, approval_request_resource_type, approval_request_resource_id,
  approval_request_status, approval_request_decision_policy, approval_request_priority,
  approval_request_metadata, approval_request_resolved_at, approval_request_applied_at,
  created_at, created_by, updated_at`;

const STEP_COLS = `approval_step_id, approval_step_request_id, approval_step_tenant_id,
  approval_step_approver_user_id, approval_step_ordinal, approval_step_level_policy,
  approval_step_status, approval_step_decision_comment, approval_step_decided_at,
  approval_step_decided_by, approval_step_metadata, created_at, updated_at`;
// Same columns prefixed with the step alias — required whenever the query joins
// sys_users (which also has created_at/updated_at → otherwise an ambiguous reference).
const STEP_COLS_S = STEP_COLS.split(",").map((c) => "s." + c.trim()).join(", ");

function mapRequest(r: Record<string, unknown>): ApprovalRequestRow {
  return {
    approvalRequestId: r.approval_request_id as string,
    tenantId: r.approval_request_tenant_id as string,
    title: r.approval_request_title as string,
    body: (r.approval_request_body as string | null) ?? null,
    resourceType: (r.approval_request_resource_type as string | null) ?? null,
    resourceId: (r.approval_request_resource_id as string | null) ?? null,
    status: r.approval_request_status as string,
    decisionPolicy: r.approval_request_decision_policy as string,
    priority: r.approval_request_priority as string,
    metadata: (r.approval_request_metadata as Record<string, unknown>) ?? {},
    resolvedAt: isoN(r.approval_request_resolved_at),
    appliedAt: isoN(r.approval_request_applied_at),
    createdAt: iso(r.created_at),
    createdBy: (r.created_by as string | null) ?? null,
    updatedAt: iso(r.updated_at),
  };
}

function mapStep(r: Record<string, unknown>): ApprovalStepRow {
  return {
    approvalStepId: r.approval_step_id as string,
    requestId: r.approval_step_request_id as string,
    tenantId: r.approval_step_tenant_id as string,
    approverUserId: r.approval_step_approver_user_id as string,
    ordinal: Number(r.approval_step_ordinal),
    levelPolicy: (r.approval_step_level_policy as string | null) ?? null,
    status: r.approval_step_status as string,
    decisionComment: (r.approval_step_decision_comment as string | null) ?? null,
    decidedAt: isoN(r.approval_step_decided_at),
    decidedBy: (r.approval_step_decided_by as string | null) ?? null,
    metadata: (r.approval_step_metadata as Record<string, unknown>) ?? {},
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

/** Resolve the approver user ids to their identity (+ tenant) for tenant derivation. */
export async function resolveApprovers(q: DbConnector, userIds: readonly string[]): Promise<ApproverIdentity[]> {
  const res = await q.query(
    `SELECT user_id, user_tenant_id, user_email, user_display_name
       FROM sys.sys_users WHERE user_id = ANY($1::uuid[])`,
    [userIds],
  );
  return res.rows.map((r: Record<string, unknown>) => ({
    userId: r.user_id as string,
    tenantId: (r.user_tenant_id as string | null) ?? null,
    email: r.user_email as string,
    name: r.user_display_name as string,
  }));
}

export interface InsertRequestInput {
  tenantId: string;
  title: string;
  body: string | null;
  resourceType: string | null;
  resourceId: string | null;
  decisionPolicy: string;
  priority: string;
  /** Free-form payload the apply-effect handler reads (B3 #34). Defaults to {}. */
  metadata?: Record<string, unknown>;
  createdBy: string | null;
}

/** INSERT the request row. */
export async function insertRequest(client: PoolClient, input: InsertRequestInput): Promise<ApprovalRequestRow> {
  const res = await client.query(
    `INSERT INTO sys.sys_approval_requests
       (approval_request_tenant_id, approval_request_title, approval_request_body,
        approval_request_resource_type, approval_request_resource_id,
        approval_request_decision_policy, approval_request_priority,
        approval_request_metadata, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING ${REQ_COLS}`,
    [
      input.tenantId, input.title, input.body, input.resourceType, input.resourceId,
      input.decisionPolicy, input.priority,
      // B3 (#34): apply-effect handlers read their parameters from here (e.g. the
      // archetypeKey of a TENANT_MATERIALIZATION). The column and the read schema
      // already existed; only the write path dropped it, so a request could never
      // carry the payload its own effect needed.
      JSON.stringify(input.metadata ?? {}),
      input.createdBy,
    ],
  );
  return mapRequest(res.rows[0]!);
}

export interface StepInput {
  approverUserId: string;
  ordinal: number;
  levelPolicy: string | null;
}

/** Set-based INSERT of the materialized steps (per-level ordinal + policy). One round-trip.
 *  slice-1 callers pass all steps at ordinal=1, levelPolicy=null. */
export async function insertSteps(
  client: PoolClient,
  requestId: string,
  tenantId: string,
  steps: readonly StepInput[],
): Promise<ApprovalStepRow[]> {
  const res = await client.query(
    `INSERT INTO sys.sys_approval_steps
       (approval_step_request_id, approval_step_tenant_id, approval_step_approver_user_id,
        approval_step_ordinal, approval_step_level_policy)
     SELECT $1, $2, t.uid, t.ord, t.pol
       FROM unnest($3::uuid[], $4::int[], $5::varchar[]) AS t(uid, ord, pol)
     RETURNING ${STEP_COLS}`,
    [
      requestId,
      tenantId,
      steps.map((s) => s.approverUserId),
      steps.map((s) => s.ordinal),
      steps.map((s) => s.levelPolicy),
    ],
  );
  return res.rows.map(mapStep);
}

function scopeClause(scope: ScopeFilter, col: string, params: unknown[]): string {
  if (scope.isPlatform) return "";
  params.push(scope.tenantId);
  return ` AND ${col} = $${params.length}`;
}

/** A single request, tenant-scoped (404/no-leak when out of scope). */
export async function findRequestScoped(q: DbConnector, scope: ScopeFilter, id: string): Promise<ApprovalRequestRow | null> {
  const params: unknown[] = [id];
  const clause = scopeClause(scope, "approval_request_tenant_id", params);
  // F4: same functional restriction as the list, so a request that is invisible in the
  // list cannot be fetched by guessing its id (404, no existence leak).
  const functional = functionalClause(scope, params, "r");
  const res = await q.query(
    `SELECT ${REQ_COLS} FROM sys.sys_approval_requests r WHERE r.approval_request_id = $1${clause}${functional}`,
    params,
  );
  return res.rows[0] ? mapRequest(res.rows[0]) : null;
}

/** Request + its step ledger (with approver identity) + creator email. */
export async function findRequestDetail(
  q: DbConnector,
  scope: ScopeFilter,
  id: string,
): Promise<{ request: ApprovalRequestRow; createdByEmail: string | null; steps: ApprovalStepDetailRow[] } | null> {
  const request = await findRequestScoped(q, scope, id);
  if (!request) return null;
  const stepRes = await q.query(
    `SELECT ${STEP_COLS_S}, u.user_email AS approver_email, u.user_display_name AS approver_name
       FROM sys.sys_approval_steps s
       LEFT JOIN sys.sys_users u ON u.user_id = s.approval_step_approver_user_id
      WHERE s.approval_step_request_id = $1
      ORDER BY s.approval_step_ordinal, s.created_at`,
    [id],
  );
  const steps: ApprovalStepDetailRow[] = stepRes.rows.map((r: Record<string, unknown>) => ({
    ...mapStep(r),
    approverEmail: (r.approver_email as string | null) ?? null,
    approverName: (r.approver_name as string | null) ?? null,
  }));
  const creatorRes = request.createdBy
    ? await q.query(`SELECT user_email FROM sys.sys_users WHERE user_id = $1`, [request.createdBy])
    : { rows: [] as Record<string, unknown>[] };
  return { request, createdByEmail: (creatorRes.rows[0]?.user_email as string | null) ?? null, steps };
}

export interface ListFilter {
  status?: string;
  resourceType?: string;
  limit: number;
}

export interface ApprovalRequestListRow extends ApprovalRequestRow {
  stepCount: number;
  pendingStepCount: number;
}

/** Tenant-filtered request list + derived step counts (LIMIT-capped). */
export async function listRequests(q: DbConnector, scope: ScopeFilter, filter: ListFilter): Promise<ApprovalRequestListRow[]> {
  const params: unknown[] = [];
  let where = "WHERE 1=1";
  if (!scope.isPlatform) { params.push(scope.tenantId); where += ` AND r.approval_request_tenant_id = $${params.length}`; }
  if (filter.status) { params.push(filter.status); where += ` AND r.approval_request_status = $${params.length}`; }
  if (filter.resourceType) { params.push(filter.resourceType); where += ` AND r.approval_request_resource_type = $${params.length}`; }
  where += functionalClause(scope, params);
  params.push(filter.limit);
  const limitPos = params.length;
  const res = await q.query(
    `SELECT ${REQ_COLS},
       (SELECT count(*) FROM sys.sys_approval_steps s WHERE s.approval_step_request_id = r.approval_request_id) AS step_count,
       (SELECT count(*) FROM sys.sys_approval_steps s WHERE s.approval_step_request_id = r.approval_request_id AND s.approval_step_status = 'PENDING') AS pending_step_count
     FROM sys.sys_approval_requests r
     ${where}
     ORDER BY r.created_at DESC
     LIMIT $${limitPos}`,
    params,
  );
  return res.rows.map((r: Record<string, unknown>) => ({
    ...mapRequest(r),
    stepCount: Number(r.step_count),
    pendingStepCount: Number(r.pending_step_count),
  }));
}

/** Load a step joined to its request (policy/status/tenant), tenant-scoped. */
export async function findStepWithRequest(
  client: PoolClient,
  scope: ScopeFilter,
  requestId: string,
  stepId: string,
): Promise<{ step: ApprovalStepRow; requestPolicy: string; requestStatus: string } | null> {
  const params: unknown[] = [requestId, stepId];
  const clause = scopeClause(scope, "r.approval_request_tenant_id", params);
  const res = await client.query(
    `SELECT ${STEP_COLS_S},
            r.approval_request_decision_policy, r.approval_request_status
       FROM sys.sys_approval_steps s
       JOIN sys.sys_approval_requests r ON r.approval_request_id = s.approval_step_request_id
      WHERE s.approval_step_request_id = $1 AND s.approval_step_id = $2${clause}`,
    params,
  );
  const row = res.rows[0];
  if (!row) return null;
  return { step: mapStep(row), requestPolicy: row.approval_request_decision_policy as string, requestStatus: row.approval_request_status as string };
}

/** State-guarded decide: only flips a PENDING step. rowCount=0 ⇒ already decided. */
export async function decideStepGuarded(
  client: PoolClient,
  stepId: string,
  newStatus: "APPROVED" | "REJECTED",
  comment: string | null,
  deciderUserId: string,
): Promise<ApprovalStepRow | null> {
  const res = await client.query(
    `UPDATE sys.sys_approval_steps
        SET approval_step_status = $2, approval_step_decision_comment = $3,
            approval_step_decided_at = now(), approval_step_decided_by = $4
      WHERE approval_step_id = $1 AND approval_step_status = 'PENDING'
      RETURNING ${STEP_COLS}`,
    [stepId, newStatus, comment, deciderUserId],
  );
  return res.rows[0] ? mapStep(res.rows[0]) : null;
}

/** All steps of a request (to re-derive request status). */
export async function loadSteps(client: PoolClient, requestId: string): Promise<ApprovalStepRow[]> {
  const res = await client.query(`SELECT ${STEP_COLS} FROM sys.sys_approval_steps WHERE approval_step_request_id = $1`, [requestId]);
  return res.rows.map(mapStep);
}

/** Skip PENDING steps at ordinal >= `ordinal` (reject cascade: the failed level + all higher;
 *  ordinal=1 → skip every PENDING step, used when the request reaches APPROVED). */
export async function skipPendingGte(client: PoolClient, requestId: string, ordinal: number): Promise<void> {
  await client.query(
    `UPDATE sys.sys_approval_steps SET approval_step_status = 'SKIPPED'
      WHERE approval_step_request_id = $1 AND approval_step_status = 'PENDING' AND approval_step_ordinal >= $2`,
    [requestId, ordinal],
  );
}

/** Skip PENDING steps at ordinal < `ordinal` (satisfied lower ANY_OF siblings once a higher level opens). */
export async function skipPendingLt(client: PoolClient, requestId: string, ordinal: number): Promise<void> {
  await client.query(
    `UPDATE sys.sys_approval_steps SET approval_step_status = 'SKIPPED'
      WHERE approval_step_request_id = $1 AND approval_step_status = 'PENDING' AND approval_step_ordinal < $2`,
    [requestId, ordinal],
  );
}

/** The active level = MIN ordinal among PENDING steps (null = none pending → request is terminal). */
export async function activePendingOrdinal(client: PoolClient, requestId: string): Promise<number | null> {
  const res = await client.query(
    `SELECT min(approval_step_ordinal) AS m FROM sys.sys_approval_steps
      WHERE approval_step_request_id = $1 AND approval_step_status = 'PENDING'`,
    [requestId],
  );
  const m = res.rows[0]?.m;
  return m == null ? null : Number(m);
}

/** Re-derive: set the request to a terminal status (+ resolved_at). */
export async function setRequestStatus(client: PoolClient, requestId: string, status: "APPROVED" | "REJECTED"): Promise<ApprovalRequestRow> {
  const res = await client.query(
    `UPDATE sys.sys_approval_requests
        SET approval_request_status = $2, approval_request_resolved_at = now()
      WHERE approval_request_id = $1
      RETURNING ${REQ_COLS}`,
    [requestId, status],
  );
  return mapRequest(res.rows[0]!);
}

/** APPROVED → APPLIED (state-guarded). rowCount=0 ⇒ not in APPROVED state. */
export async function markApplied(client: PoolClient, requestId: string): Promise<ApprovalRequestRow | null> {
  const res = await client.query(
    `UPDATE sys.sys_approval_requests
        SET approval_request_status = 'APPLIED', approval_request_applied_at = now()
      WHERE approval_request_id = $1 AND approval_request_status = 'APPROVED'
      RETURNING ${REQ_COLS}`,
    [requestId],
  );
  return res.rows[0] ? mapRequest(res.rows[0]) : null;
}

/** Mark the approver's inbox task READ once their step is decided. */
export async function markInboxReadForStep(client: PoolClient, stepId: string, userId: string): Promise<void> {
  await client.query(
    `UPDATE sys.sys_inbox_notifications
        SET notification_status = 'READ', notification_read_at = now()
      WHERE notification_resource_type = 'APPROVAL_STEP'
        AND notification_resource_id = $1
        AND notification_user_id = $2
        AND notification_status = 'UNREAD'`,
    [stepId, userId],
  );
}
