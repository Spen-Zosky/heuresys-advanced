/**
 * apps/api/src/modules/seed-approval-decisions/repository.ts
 * Append-only approval ledger. Tenant inherited from candidate.
 */
import type { Pool, PoolClient } from "pg";
import type {
  SeedApprovalDecision, SeedApprovalStatus,
  SeedApprovalDecisionListQuery, CreateSeedApprovalDecisionBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  seed_approval_decision_id: string;
  seed_approval_decision_candidate_id: string;
  seed_approval_decision_approver_user_id: string | null;
  seed_approval_decision_status: SeedApprovalStatus;
  seed_approval_decision_rationale: string | null;
  seed_approval_decision_decided_at: Date;
  created_at: Date;
}

const COLS = `seed_approval_decision_id, seed_approval_decision_candidate_id,
  seed_approval_decision_approver_user_id, seed_approval_decision_status,
  seed_approval_decision_rationale, seed_approval_decision_decided_at, created_at`;

function toDec(r: Row): SeedApprovalDecision {
  return {
    seedApprovalDecisionId: r.seed_approval_decision_id,
    candidateId: r.seed_approval_decision_candidate_id,
    approverUserId: r.seed_approval_decision_approver_user_id,
    status: r.seed_approval_decision_status,
    rationale: r.seed_approval_decision_rationale,
    decidedAt: r.seed_approval_decision_decided_at.toISOString(),
    createdAt: r.created_at.toISOString(),
  };
}

export async function listDecisions(
  q: DbConnector, filter: { tenantId?: string; query: SeedApprovalDecisionListQuery },
): Promise<{ items: SeedApprovalDecision[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`c.seed_candidate_record_tenant_id = $${params.length}`);
  }
  if (filter.query.candidateId) { params.push(filter.query.candidateId); where.push(`d.seed_approval_decision_candidate_id = $${params.length}`); }
  if (filter.query.status) { params.push(filter.query.status); where.push(`d.seed_approval_decision_status = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_seed_approval_decisions d
       JOIN sys.sys_seed_candidate_records c ON c.seed_candidate_record_id = d.seed_approval_decision_candidate_id ${w}`,
    params,
  );
  params.push(filter.query.limit); const lim = params.length;
  params.push(filter.query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS.split(",").map(c => `d.${c.trim()}`).join(", ")}
       FROM sys.sys_seed_approval_decisions d
       JOIN sys.sys_seed_candidate_records c ON c.seed_candidate_record_id = d.seed_approval_decision_candidate_id
       ${w} ORDER BY d.seed_approval_decision_decided_at DESC LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toDec), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findDecisionById(q: DbConnector, id: string): Promise<SeedApprovalDecision | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_seed_approval_decisions WHERE seed_approval_decision_id = $1`, [id]);
  return res.rows[0] ? toDec(res.rows[0]) : null;
}

export async function getCandidateTenant(q: DbConnector, candidateId: string): Promise<string | null> {
  const res = await q.query<{ t: string }>(
    `SELECT seed_candidate_record_tenant_id AS t FROM sys.sys_seed_candidate_records WHERE seed_candidate_record_id = $1`,
    [candidateId],
  );
  return res.rows[0]?.t ?? null;
}

export async function insertDecision(
  q: DbConnector, body: CreateSeedApprovalDecisionBody, approverId: string,
): Promise<SeedApprovalDecision> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_seed_approval_decisions (
        seed_approval_decision_candidate_id, seed_approval_decision_approver_user_id,
        seed_approval_decision_status, seed_approval_decision_rationale
      ) VALUES ($1, $2, $3, $4) RETURNING ${COLS}`,
    [body.candidateId, approverId, body.status, body.rationale ?? null],
  );
  return toDec(res.rows[0]!);
}
