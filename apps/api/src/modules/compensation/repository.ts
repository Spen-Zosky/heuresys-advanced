/**
 * apps/api/src/modules/compensation/repository.ts
 * Raw SQL for sys.sys_compensation_*, sys.sys_reward_*, sys.sys_payroll_handoff_records.
 */

import type { Pool, PoolClient } from "pg";
import type {
  CompensationProfile,
  RewardGate,
  RewardGateResult,
  CompensationRecommendation,
  CreateCompensationRecommendationBody,
  PayrollHandoffRecord,
  CreatePayrollHandoffRecordBody,
  RewardGatesListQuery,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

// -------------------------------------------------------------------
// Compensation profile
// -------------------------------------------------------------------

interface ProfileRow {
  position_compensation_profile_id: string;
  position_id: string;
  position_compensation_profile_tenant_id: string;
  compensation_band_id: string | null;
  band_tenant_id: string | null;
  band_code: string | null;
  band_name: string | null;
  band_min_eur: string | null;
  band_mid_eur: string | null;
  band_max_eur: string | null;
  band_is_global: boolean | null;
  band_metadata: Record<string, unknown> | null;
  economic_weight: string | null;
  reward_gates_applied: unknown[];
  position_compensation_profile_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export async function findCompensationProfileByPositionId(
  q: DbConnector,
  positionId: string,
): Promise<CompensationProfile | null> {
  const res = await q.query<ProfileRow>(
    `SELECT
       p.position_compensation_profile_id,
       p.position_id,
       p.position_compensation_profile_tenant_id,
       p.compensation_band_id,
       b.compensation_band_tenant_id AS band_tenant_id,
       b.compensation_band_code      AS band_code,
       b.compensation_band_name      AS band_name,
       b.compensation_band_min_eur::text AS band_min_eur,
       b.compensation_band_mid_eur::text AS band_mid_eur,
       b.compensation_band_max_eur::text AS band_max_eur,
       b.compensation_band_is_global AS band_is_global,
       b.compensation_band_metadata  AS band_metadata,
       p.economic_weight::text AS economic_weight,
       p.reward_gates_applied,
       p.position_compensation_profile_metadata,
       p.created_at,
       p.updated_at
     FROM sys.sys_position_compensation_profiles p
     LEFT JOIN sys.sys_compensation_bands b ON b.compensation_band_id = p.compensation_band_id
     WHERE p.position_id = $1`,
    [positionId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    positionCompensationProfileId: r.position_compensation_profile_id,
    positionId: r.position_id,
    tenantId: r.position_compensation_profile_tenant_id,
    band: r.compensation_band_id
      ? {
          compensationBandId: r.compensation_band_id,
          tenantId: r.band_tenant_id,
          code: r.band_code ?? "",
          name: r.band_name ?? "",
          minEur: r.band_min_eur,
          midEur: r.band_mid_eur,
          maxEur: r.band_max_eur,
          isGlobal: r.band_is_global ?? false,
          metadata: r.band_metadata ?? {},
        }
      : null,
    economicWeight: r.economic_weight,
    rewardGatesApplied: r.reward_gates_applied ?? [],
    metadata: r.position_compensation_profile_metadata ?? {},
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

// -------------------------------------------------------------------
// Reward gates
// -------------------------------------------------------------------

interface GateRow {
  reward_gate_id: string;
  reward_gate_tenant_id: string;
  reward_gate_user_id: string | null;
  reward_gate_position_id: string | null;
  reward_gate_catalog_id: string;
  catalog_code: string;
  catalog_name: string;
  catalog_is_blocking: boolean;
  reward_gate_period_start: Date;
  reward_gate_period_end: Date;
  reward_gate_payload: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  // Latest result columns (LEFT JOIN LATERAL)
  result_id: string | null;
  result_status: string | null;
  result_score: string | null;
  result_evaluator_user_id: string | null;
  result_override_reason: string | null;
  result_payload: Record<string, unknown> | null;
  result_recorded_at: Date | null;
}

function toGate(r: GateRow): RewardGate {
  const latestResult: RewardGateResult | null = r.result_id
    ? {
        rewardGateResultId: r.result_id,
        rewardGateId: r.reward_gate_id,
        tenantId: r.reward_gate_tenant_id,
        status: r.result_status as RewardGateResult["status"],
        score: r.result_score,
        evaluatorUserId: r.result_evaluator_user_id,
        overrideReason: r.result_override_reason,
        payload: r.result_payload ?? {},
        recordedAt: r.result_recorded_at!.toISOString(),
      }
    : null;
  return {
    rewardGateId: r.reward_gate_id,
    tenantId: r.reward_gate_tenant_id,
    userId: r.reward_gate_user_id,
    positionId: r.reward_gate_position_id,
    catalogId: r.reward_gate_catalog_id,
    catalogCode: r.catalog_code,
    catalogName: r.catalog_name,
    isBlocking: r.catalog_is_blocking,
    periodStart: r.reward_gate_period_start.toISOString().slice(0, 10),
    periodEnd: r.reward_gate_period_end.toISOString().slice(0, 10),
    payload: r.reward_gate_payload,
    latestResult,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listRewardGates(
  q: DbConnector,
  filter: { tenantId: string | undefined; query: RewardGatesListQuery },
): Promise<{ items: RewardGate[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`g.reward_gate_tenant_id = $${params.length}`);
  }
  if (filter.query.periodStart) {
    params.push(filter.query.periodStart);
    where.push(`g.reward_gate_period_end >= $${params.length}`);
  }
  if (filter.query.periodEnd) {
    params.push(filter.query.periodEnd);
    where.push(`g.reward_gate_period_start <= $${params.length}`);
  }
  if (filter.query.userId) {
    params.push(filter.query.userId);
    where.push(`g.reward_gate_user_id = $${params.length}`);
  }
  if (filter.query.positionId) {
    params.push(filter.query.positionId);
    where.push(`g.reward_gate_position_id = $${params.length}`);
  }
  if (filter.query.status) {
    params.push(filter.query.status);
    where.push(`latest.reward_gate_result_status = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total
       FROM sys.sys_reward_gates g
       JOIN sys.sys_reward_gate_catalog c ON c.reward_gate_catalog_id = g.reward_gate_catalog_id
       LEFT JOIN LATERAL (
         SELECT * FROM sys.sys_reward_gate_results r
          WHERE r.reward_gate_result_gate_id = g.reward_gate_id
          ORDER BY r.reward_gate_result_recorded_at DESC LIMIT 1
       ) latest ON true
       ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const limIdx = params.length;
  params.push(filter.query.offset);
  const offIdx = params.length;

  const res = await q.query<GateRow>(
    `SELECT
       g.reward_gate_id,
       g.reward_gate_tenant_id,
       g.reward_gate_user_id,
       g.reward_gate_position_id,
       g.reward_gate_catalog_id,
       c.reward_gate_catalog_code AS catalog_code,
       c.reward_gate_catalog_name AS catalog_name,
       c.reward_gate_catalog_is_blocking AS catalog_is_blocking,
       g.reward_gate_period_start,
       g.reward_gate_period_end,
       g.reward_gate_payload,
       g.created_at,
       g.updated_at,
       latest.reward_gate_result_id      AS result_id,
       latest.reward_gate_result_status  AS result_status,
       latest.reward_gate_result_score::text AS result_score,
       latest.reward_gate_result_evaluator_user_id AS result_evaluator_user_id,
       latest.reward_gate_result_override_reason   AS result_override_reason,
       latest.reward_gate_result_payload AS result_payload,
       latest.reward_gate_result_recorded_at AS result_recorded_at
     FROM sys.sys_reward_gates g
     JOIN sys.sys_reward_gate_catalog c ON c.reward_gate_catalog_id = g.reward_gate_catalog_id
     LEFT JOIN LATERAL (
       SELECT * FROM sys.sys_reward_gate_results r
        WHERE r.reward_gate_result_gate_id = g.reward_gate_id
        ORDER BY r.reward_gate_result_recorded_at DESC LIMIT 1
     ) latest ON true
     ${whereClause}
     ORDER BY g.reward_gate_period_end DESC, g.reward_gate_id
     LIMIT $${limIdx} OFFSET $${offIdx}`,
    params,
  );
  return { items: res.rows.map(toGate), total };
}

// -------------------------------------------------------------------
// Compensation recommendations
// -------------------------------------------------------------------

interface RecRow {
  compensation_recommendation_id: string;
  compensation_recommendation_tenant_id: string;
  compensation_recommendation_user_id: string;
  compensation_recommendation_position_id: string | null;
  compensation_recommendation_period_start: Date;
  compensation_recommendation_period_end: Date;
  compensation_recommendation_signal: string;
  compensation_recommendation_amount_eur: string | null;
  compensation_recommendation_narrative: string | null;
  compensation_recommendation_payload: Record<string, unknown>;
  compensation_recommendation_computed_at: Date;
  created_at: Date;
}

function toRec(r: RecRow): CompensationRecommendation {
  return {
    compensationRecommendationId: r.compensation_recommendation_id,
    tenantId: r.compensation_recommendation_tenant_id,
    userId: r.compensation_recommendation_user_id,
    positionId: r.compensation_recommendation_position_id,
    periodStart: r.compensation_recommendation_period_start.toISOString().slice(0, 10),
    periodEnd: r.compensation_recommendation_period_end.toISOString().slice(0, 10),
    signal: r.compensation_recommendation_signal as CompensationRecommendation["signal"],
    amountEur: r.compensation_recommendation_amount_eur,
    narrative: r.compensation_recommendation_narrative,
    payload: r.compensation_recommendation_payload,
    computedAt: r.compensation_recommendation_computed_at.toISOString(),
    createdAt: r.created_at.toISOString(),
  };
}

export async function insertCompensationRecommendation(
  q: DbConnector,
  tenantId: string,
  body: CreateCompensationRecommendationBody,
): Promise<CompensationRecommendation> {
  const res = await q.query<RecRow>(
    `INSERT INTO sys.sys_compensation_recommendations (
        compensation_recommendation_tenant_id,
        compensation_recommendation_user_id,
        compensation_recommendation_position_id,
        compensation_recommendation_period_start,
        compensation_recommendation_period_end,
        compensation_recommendation_signal,
        compensation_recommendation_amount_eur,
        compensation_recommendation_narrative,
        compensation_recommendation_payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      RETURNING
        compensation_recommendation_id,
        compensation_recommendation_tenant_id,
        compensation_recommendation_user_id,
        compensation_recommendation_position_id,
        compensation_recommendation_period_start,
        compensation_recommendation_period_end,
        compensation_recommendation_signal,
        compensation_recommendation_amount_eur::text,
        compensation_recommendation_narrative,
        compensation_recommendation_payload,
        compensation_recommendation_computed_at,
        created_at`,
    [
      tenantId,
      body.userId,
      body.positionId ?? null,
      body.periodStart,
      body.periodEnd,
      body.signal,
      body.amountEur ?? null,
      body.narrative ?? null,
      JSON.stringify(body.payload ?? {}),
    ],
  );
  return toRec(res.rows[0]!);
}

// -------------------------------------------------------------------
// Payroll handoff records
// -------------------------------------------------------------------

interface HandoffRow {
  payroll_handoff_record_id: string;
  payroll_handoff_record_tenant_id: string;
  payroll_handoff_record_period_start: Date;
  payroll_handoff_record_period_end: Date;
  payroll_handoff_record_recipient_system: string;
  payroll_handoff_record_payload: Record<string, unknown>;
  payroll_handoff_record_handed_off_at: Date;
  payroll_handoff_record_status: string;
  created_at: Date;
}

function toHandoff(r: HandoffRow): PayrollHandoffRecord {
  return {
    payrollHandoffRecordId: r.payroll_handoff_record_id,
    tenantId: r.payroll_handoff_record_tenant_id,
    periodStart: r.payroll_handoff_record_period_start.toISOString().slice(0, 10),
    periodEnd: r.payroll_handoff_record_period_end.toISOString().slice(0, 10),
    recipientSystem: r.payroll_handoff_record_recipient_system,
    payload: r.payroll_handoff_record_payload,
    handedOffAt: r.payroll_handoff_record_handed_off_at.toISOString(),
    status: r.payroll_handoff_record_status as PayrollHandoffRecord["status"],
    createdAt: r.created_at.toISOString(),
  };
}

export async function insertPayrollHandoffRecord(
  q: DbConnector,
  tenantId: string,
  body: CreatePayrollHandoffRecordBody,
): Promise<PayrollHandoffRecord> {
  const res = await q.query<HandoffRow>(
    `INSERT INTO sys.sys_payroll_handoff_records (
        payroll_handoff_record_tenant_id,
        payroll_handoff_record_period_start,
        payroll_handoff_record_period_end,
        payroll_handoff_record_recipient_system,
        payroll_handoff_record_payload,
        payroll_handoff_record_status
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
      RETURNING
        payroll_handoff_record_id,
        payroll_handoff_record_tenant_id,
        payroll_handoff_record_period_start,
        payroll_handoff_record_period_end,
        payroll_handoff_record_recipient_system,
        payroll_handoff_record_payload,
        payroll_handoff_record_handed_off_at,
        payroll_handoff_record_status,
        created_at`,
    [
      tenantId,
      body.periodStart,
      body.periodEnd,
      body.recipientSystem,
      JSON.stringify(body.payload ?? {}),
      body.status,
    ],
  );
  return toHandoff(res.rows[0]!);
}

// -------------------------------------------------------------------
// Helpers for tenant scope sanity check
// -------------------------------------------------------------------

export async function findPositionTenantId(
  q: DbConnector,
  positionId: string,
): Promise<string | null> {
  const r = await q.query<{ position_tenant_id: string }>(
    `SELECT position_tenant_id FROM sys.sys_positions WHERE position_id = $1`,
    [positionId],
  );
  return r.rows[0]?.position_tenant_id ?? null;
}

export async function findUserTenantId(
  q: DbConnector,
  userId: string,
): Promise<string | null> {
  const r = await q.query<{ user_tenant_id: string | null }>(
    `SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`,
    [userId],
  );
  return r.rows[0]?.user_tenant_id ?? null;
}
