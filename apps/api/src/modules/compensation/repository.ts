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
  PayoutCurve,
  CreatePayrollHandoffRecordBody,
  RewardGatesListQuery,
  VariablePayCalculation,
  VariablePayCalculationListQuery,
  CompensationRecommendationRow,
  CompensationRecommendationListQuery,
  BonusPool,
  BonusPoolListQuery,
  ObjectiveRewardRule,
  ObjectiveRewardRuleListQuery,
  PositionEconomicWeight,
  PositionEconomicWeightListQuery,
  PayrollHandoffRecordListQuery,
  CompensationBand,
} from "@heuresys/shared";
import { toDateOnly } from "../../lib/date-only.js";

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
    periodStart: toDateOnly(r.reward_gate_period_start)!,
    periodEnd: toDateOnly(r.reward_gate_period_end)!,
    payload: r.reward_gate_payload,
    latestResult,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listRewardGates(
  q: DbConnector,
  filter: { tenantId: string | undefined; userIdAllowList?: string[]; query: RewardGatesListQuery },
): Promise<{ items: RewardGate[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`g.reward_gate_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    // ADR-0027 F3 (D-50): restrict to the actor's org sub-tree. Empty list ⇒ nobody visible.
    if (filter.userIdAllowList.length === 0) {
      return { items: [], total: 0 };
    }
    params.push(filter.userIdAllowList);
    where.push(`g.reward_gate_user_id = ANY($${params.length}::uuid[])`);
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

/**
 * Reward-gate distribution by latest-result status (gates with no result are
 * bucketed as 'PENDING'). Used by the compensation-intelligence chart (F4).
 */
export async function getRewardGateStatusDistribution(
  q: DbConnector,
  tenantId: string | undefined,
): Promise<{ items: { status: string; count: number }[]; total: number }> {
  const params: unknown[] = [];
  let whereClause = "";
  if (tenantId) {
    params.push(tenantId);
    whereClause = `WHERE g.reward_gate_tenant_id = $1`;
  }
  const res = await q.query<{ status: string; count: string }>(
    `SELECT COALESCE(latest.reward_gate_result_status, 'PENDING') AS status,
            count(*)::text AS count
       FROM sys.sys_reward_gates g
       LEFT JOIN LATERAL (
         SELECT r.reward_gate_result_status
           FROM sys.sys_reward_gate_results r
          WHERE r.reward_gate_result_gate_id = g.reward_gate_id
          ORDER BY r.reward_gate_result_recorded_at DESC LIMIT 1
       ) latest ON true
       ${whereClause}
       GROUP BY COALESCE(latest.reward_gate_result_status, 'PENDING')
       ORDER BY count(*) DESC, status`,
    params,
  );
  const items = res.rows.map((r) => ({ status: r.status, count: Number(r.count) }));
  const total = items.reduce((sum, i) => sum + i.count, 0);
  return { items, total };
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
    periodStart: toDateOnly(r.compensation_recommendation_period_start)!,
    periodEnd: toDateOnly(r.compensation_recommendation_period_end)!,
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
    periodStart: toDateOnly(r.payroll_handoff_record_period_start)!,
    periodEnd: toDateOnly(r.payroll_handoff_record_period_end)!,
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

// ===================================================================
// A/L7 (#32) — read/list over six dormant compensation & reward tables.
// Org scoping (userIdAllowList) is resolved by the service via
// resolveOrgReadScope; this layer only receives the resolved filter.
// ===================================================================

// -------------------------------------------------------------------
// Variable-pay calculations (per-person — COMPENSATION, org-gated)
// -------------------------------------------------------------------

interface VariablePayRow {
  variable_pay_calculation_id: string;
  variable_pay_calculation_tenant_id: string;
  variable_pay_calculation_user_id: string;
  subject_user_name: string | null;
  variable_pay_calculation_position_id: string | null;
  variable_pay_calculation_period_start: string;
  variable_pay_calculation_period_end: string;
  variable_pay_calculation_signal_score: string | null;
  variable_pay_calculation_amount_eur: string | null;
  variable_pay_calculation_payload: Record<string, unknown> | null;
  variable_pay_calculation_computed_at: Date;
  created_at: Date;
}

const VARIABLE_PAY_COLS = `variable_pay_calculation_id, variable_pay_calculation_tenant_id,
  variable_pay_calculation_user_id,
  (SELECT u.user_display_name FROM sys.sys_users u WHERE u.user_id = variable_pay_calculation_user_id) AS subject_user_name,
  variable_pay_calculation_position_id,
  variable_pay_calculation_period_start::text AS variable_pay_calculation_period_start,
  variable_pay_calculation_period_end::text AS variable_pay_calculation_period_end,
  variable_pay_calculation_signal_score, variable_pay_calculation_amount_eur,
  variable_pay_calculation_payload, variable_pay_calculation_computed_at, created_at`;

function toVariablePay(r: VariablePayRow): VariablePayCalculation {
  return {
    variablePayCalculationId: r.variable_pay_calculation_id,
    tenantId: r.variable_pay_calculation_tenant_id,
    userId: r.variable_pay_calculation_user_id,
    subjectUserName: r.subject_user_name ?? null,
    positionId: r.variable_pay_calculation_position_id,
    periodStart: r.variable_pay_calculation_period_start,
    periodEnd: r.variable_pay_calculation_period_end,
    signalScore:
      r.variable_pay_calculation_signal_score === null
        ? null
        : Number(r.variable_pay_calculation_signal_score),
    amountEur:
      r.variable_pay_calculation_amount_eur === null
        ? null
        : Number(r.variable_pay_calculation_amount_eur),
    payload: r.variable_pay_calculation_payload ?? {},
    computedAt: r.variable_pay_calculation_computed_at.toISOString(),
    createdAt: r.created_at.toISOString(),
  };
}

export async function listVariablePay(
  q: DbConnector,
  filter: { tenantId?: string; userIdAllowList?: string[]; query: VariablePayCalculationListQuery },
): Promise<{ items: VariablePayCalculation[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`variable_pay_calculation_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    if (filter.userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(filter.userIdAllowList);
    where.push(`variable_pay_calculation_user_id = ANY($${params.length}::uuid[])`);
  }
  if (filter.query.userId) {
    params.push(filter.query.userId);
    where.push(`variable_pay_calculation_user_id = $${params.length}`);
  }
  if (filter.query.positionId) {
    params.push(filter.query.positionId);
    where.push(`variable_pay_calculation_position_id = $${params.length}`);
  }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_variable_pay_calculations ${wc}`,
    params,
  );
  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<VariablePayRow>(
    `SELECT ${VARIABLE_PAY_COLS} FROM sys.sys_variable_pay_calculations ${wc}
      ORDER BY variable_pay_calculation_period_end DESC, variable_pay_calculation_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toVariablePay) };
}

// -------------------------------------------------------------------
// Compensation recommendations (read row — COMPENSATION, org-gated)
// -------------------------------------------------------------------

interface RecReadRow {
  compensation_recommendation_id: string;
  compensation_recommendation_tenant_id: string;
  compensation_recommendation_user_id: string;
  subject_user_name: string | null;
  compensation_recommendation_position_id: string | null;
  compensation_recommendation_period_start: string;
  compensation_recommendation_period_end: string;
  compensation_recommendation_signal: string;
  compensation_recommendation_amount_eur: string | null;
  compensation_recommendation_narrative: string | null;
  compensation_recommendation_payload: Record<string, unknown> | null;
  compensation_recommendation_computed_at: Date;
  created_at: Date;
}

const REC_READ_COLS = `compensation_recommendation_id, compensation_recommendation_tenant_id,
  compensation_recommendation_user_id,
  (SELECT u.user_display_name FROM sys.sys_users u WHERE u.user_id = compensation_recommendation_user_id) AS subject_user_name,
  compensation_recommendation_position_id,
  compensation_recommendation_period_start::text AS compensation_recommendation_period_start,
  compensation_recommendation_period_end::text AS compensation_recommendation_period_end,
  compensation_recommendation_signal, compensation_recommendation_amount_eur,
  compensation_recommendation_narrative, compensation_recommendation_payload,
  compensation_recommendation_computed_at, created_at`;

function toRecRead(r: RecReadRow): CompensationRecommendationRow {
  return {
    compensationRecommendationId: r.compensation_recommendation_id,
    tenantId: r.compensation_recommendation_tenant_id,
    userId: r.compensation_recommendation_user_id,
    subjectUserName: r.subject_user_name ?? null,
    positionId: r.compensation_recommendation_position_id,
    periodStart: r.compensation_recommendation_period_start,
    periodEnd: r.compensation_recommendation_period_end,
    signal: r.compensation_recommendation_signal,
    amountEur:
      r.compensation_recommendation_amount_eur === null
        ? null
        : Number(r.compensation_recommendation_amount_eur),
    narrative: r.compensation_recommendation_narrative,
    payload: r.compensation_recommendation_payload ?? {},
    computedAt: r.compensation_recommendation_computed_at.toISOString(),
    createdAt: r.created_at.toISOString(),
  };
}

export async function listRecommendations(
  q: DbConnector,
  filter: { tenantId?: string; userIdAllowList?: string[]; query: CompensationRecommendationListQuery },
): Promise<{ items: CompensationRecommendationRow[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`compensation_recommendation_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    if (filter.userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(filter.userIdAllowList);
    where.push(`compensation_recommendation_user_id = ANY($${params.length}::uuid[])`);
  }
  if (filter.query.userId) {
    params.push(filter.query.userId);
    where.push(`compensation_recommendation_user_id = $${params.length}`);
  }
  if (filter.query.positionId) {
    params.push(filter.query.positionId);
    where.push(`compensation_recommendation_position_id = $${params.length}`);
  }
  if (filter.query.signal) {
    params.push(filter.query.signal);
    where.push(`compensation_recommendation_signal = $${params.length}`);
  }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_compensation_recommendations ${wc}`,
    params,
  );
  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<RecReadRow>(
    `SELECT ${REC_READ_COLS} FROM sys.sys_compensation_recommendations ${wc}
      ORDER BY compensation_recommendation_period_end DESC, compensation_recommendation_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toRecRead) };
}

// -------------------------------------------------------------------
// Bonus pools (tenant / OU pools — catalog, no person rows)
// -------------------------------------------------------------------

interface BonusPoolRow {
  bonus_pool_id: string;
  bonus_pool_tenant_id: string;
  bonus_pool_scope: string;
  bonus_pool_organization_unit_id: string | null;
  bonus_pool_period_start: string;
  bonus_pool_period_end: string;
  bonus_pool_total_eur: string | null;
  bonus_pool_payload: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

const BONUS_POOL_COLS = `bonus_pool_id, bonus_pool_tenant_id, bonus_pool_scope,
  bonus_pool_organization_unit_id,
  bonus_pool_period_start::text AS bonus_pool_period_start,
  bonus_pool_period_end::text AS bonus_pool_period_end,
  bonus_pool_total_eur, bonus_pool_payload, created_at, updated_at`;

function toBonusPool(r: BonusPoolRow): BonusPool {
  return {
    bonusPoolId: r.bonus_pool_id,
    tenantId: r.bonus_pool_tenant_id,
    scope: r.bonus_pool_scope,
    organizationUnitId: r.bonus_pool_organization_unit_id,
    periodStart: r.bonus_pool_period_start,
    periodEnd: r.bonus_pool_period_end,
    totalEur: r.bonus_pool_total_eur === null ? null : Number(r.bonus_pool_total_eur),
    payload: r.bonus_pool_payload ?? {},
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listBonusPools(
  q: DbConnector,
  tenantId: string | undefined,
  query: BonusPoolListQuery,
): Promise<{ items: BonusPool[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (tenantId) {
    params.push(tenantId);
    where.push(`bonus_pool_tenant_id = $${params.length}`);
  }
  if (query.scope) {
    params.push(query.scope);
    where.push(`bonus_pool_scope = $${params.length}`);
  }
  if (query.organizationUnitId) {
    params.push(query.organizationUnitId);
    where.push(`bonus_pool_organization_unit_id = $${params.length}`);
  }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_bonus_pools ${wc}`,
    params,
  );
  params.push(query.limit);
  const lim = params.length;
  params.push(query.offset);
  const off = params.length;
  const res = await q.query<BonusPoolRow>(
    `SELECT ${BONUS_POOL_COLS} FROM sys.sys_bonus_pools ${wc}
      ORDER BY bonus_pool_period_end DESC, bonus_pool_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toBonusPool) };
}

// -------------------------------------------------------------------
// Objective reward rules (tenant catalog)
// -------------------------------------------------------------------

interface ObjectiveRewardRuleRow {
  objective_reward_rule_id: string;
  objective_reward_rule_tenant_id: string;
  objective_reward_rule_code: string;
  objective_reward_rule_name: string;
  objective_reward_rule_payload: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

const OBJECTIVE_REWARD_RULE_COLS = `objective_reward_rule_id, objective_reward_rule_tenant_id,
  objective_reward_rule_code, objective_reward_rule_name, objective_reward_rule_payload,
  created_at, updated_at`;

function toObjectiveRewardRule(r: ObjectiveRewardRuleRow): ObjectiveRewardRule {
  return {
    objectiveRewardRuleId: r.objective_reward_rule_id,
    tenantId: r.objective_reward_rule_tenant_id,
    code: r.objective_reward_rule_code,
    name: r.objective_reward_rule_name,
    payload: r.objective_reward_rule_payload ?? {},
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listObjectiveRewardRules(
  q: DbConnector,
  tenantId: string | undefined,
  query: ObjectiveRewardRuleListQuery,
): Promise<{ items: ObjectiveRewardRule[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (tenantId) {
    params.push(tenantId);
    where.push(`objective_reward_rule_tenant_id = $${params.length}`);
  }
  if (query.code) {
    params.push(query.code);
    where.push(`objective_reward_rule_code = $${params.length}`);
  }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_objective_reward_rules ${wc}`,
    params,
  );
  params.push(query.limit);
  const lim = params.length;
  params.push(query.offset);
  const off = params.length;
  const res = await q.query<ObjectiveRewardRuleRow>(
    `SELECT ${OBJECTIVE_REWARD_RULE_COLS} FROM sys.sys_objective_reward_rules ${wc}
      ORDER BY objective_reward_rule_code, objective_reward_rule_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toObjectiveRewardRule) };
}

// -------------------------------------------------------------------
// Position economic weight (catalog)
// -------------------------------------------------------------------

interface PositionEconomicWeightRow {
  position_economic_weight_id: string;
  position_economic_weight_position_id: string;
  position_economic_weight_tenant_id: string;
  position_economic_weight_value: string;
  position_economic_weight_period_start: string | null;
  position_economic_weight_period_end: string | null;
  position_economic_weight_metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

const POSITION_ECONOMIC_WEIGHT_COLS = `position_economic_weight_id, position_economic_weight_position_id,
  position_economic_weight_tenant_id, position_economic_weight_value,
  position_economic_weight_period_start::text AS position_economic_weight_period_start,
  position_economic_weight_period_end::text AS position_economic_weight_period_end,
  position_economic_weight_metadata, created_at, updated_at`;

function toPositionEconomicWeight(r: PositionEconomicWeightRow): PositionEconomicWeight {
  return {
    positionEconomicWeightId: r.position_economic_weight_id,
    positionId: r.position_economic_weight_position_id,
    tenantId: r.position_economic_weight_tenant_id,
    value: Number(r.position_economic_weight_value),
    periodStart: r.position_economic_weight_period_start,
    periodEnd: r.position_economic_weight_period_end,
    metadata: r.position_economic_weight_metadata ?? {},
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listPositionEconomicWeight(
  q: DbConnector,
  tenantId: string | undefined,
  query: PositionEconomicWeightListQuery,
): Promise<{ items: PositionEconomicWeight[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (tenantId) {
    params.push(tenantId);
    where.push(`position_economic_weight_tenant_id = $${params.length}`);
  }
  if (query.positionId) {
    params.push(query.positionId);
    where.push(`position_economic_weight_position_id = $${params.length}`);
  }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_position_economic_weight ${wc}`,
    params,
  );
  params.push(query.limit);
  const lim = params.length;
  params.push(query.offset);
  const off = params.length;
  const res = await q.query<PositionEconomicWeightRow>(
    `SELECT ${POSITION_ECONOMIC_WEIGHT_COLS} FROM sys.sys_position_economic_weight ${wc}
      ORDER BY position_economic_weight_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toPositionEconomicWeight) };
}

// -------------------------------------------------------------------
// Payroll handoff records (list — catalog, no user column)
// -------------------------------------------------------------------

export async function listPayrollHandoffRecords(
  q: DbConnector,
  tenantId: string | undefined,
  query: PayrollHandoffRecordListQuery,
): Promise<{ items: PayrollHandoffRecord[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (tenantId) {
    params.push(tenantId);
    where.push(`payroll_handoff_record_tenant_id = $${params.length}`);
  }
  if (query.recipientSystem) {
    params.push(query.recipientSystem);
    where.push(`payroll_handoff_record_recipient_system = $${params.length}`);
  }
  if (query.status) {
    params.push(query.status);
    where.push(`payroll_handoff_record_status = $${params.length}`);
  }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_payroll_handoff_records ${wc}`,
    params,
  );
  params.push(query.limit);
  const lim = params.length;
  params.push(query.offset);
  const off = params.length;
  const res = await q.query<HandoffRow>(
    `SELECT
       payroll_handoff_record_id,
       payroll_handoff_record_tenant_id,
       payroll_handoff_record_period_start,
       payroll_handoff_record_period_end,
       payroll_handoff_record_recipient_system,
       payroll_handoff_record_payload,
       payroll_handoff_record_handed_off_at,
       payroll_handoff_record_status,
       created_at
     FROM sys.sys_payroll_handoff_records ${wc}
     ORDER BY payroll_handoff_record_period_end DESC, payroll_handoff_record_id
     LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toHandoff) };
}

/**
 * Le curve di payout del motore del premio variabile. Erano scritte e mai lette:
 * chi guardava un premio non poteva vedere la regola con cui era stato calcolato.
 * Visibilità: le curve globali più quelle del proprio tenant (stesso modello dei
 * cataloghi condivisi).
 */
export async function listPayoutCurves(
  q: DbConnector,
  tenantId: string | undefined,
): Promise<{ items: PayoutCurve[]; total: number }> {
  const res = await q.query<{
    payout_curve_id: string; payout_curve_tenant_id: string | null;
    payout_curve_code: string; payout_curve_name: string; payout_curve_kind: string;
    payout_curve_payload: Record<string, unknown>; payout_curve_is_global: boolean;
    created_at: Date;
  }>(
    `SELECT payout_curve_id, payout_curve_tenant_id, payout_curve_code, payout_curve_name,
            payout_curve_kind, payout_curve_payload, payout_curve_is_global, created_at
       FROM sys.sys_payout_curves
      WHERE ($1::uuid IS NULL OR payout_curve_is_global = true OR payout_curve_tenant_id = $1)
      ORDER BY payout_curve_is_global DESC, payout_curve_code`,
    [tenantId ?? null],
  );
  const items = res.rows.map((r) => ({
    payoutCurveId: r.payout_curve_id,
    tenantId: r.payout_curve_tenant_id,
    code: r.payout_curve_code,
    name: r.payout_curve_name,
    kind: r.payout_curve_kind,
    payload: r.payout_curve_payload ?? {},
    isGlobal: r.payout_curve_is_global,
    createdAt: r.created_at.toISOString(),
  }));
  return { items, total: items.length };
}

// ---------------------------------------------------------------------------
// #37 (B2) — dati per la valutazione di un singolo calcolo
// ---------------------------------------------------------------------------

export interface VariablePayCalcRow {
  variablePayCalculationId: string;
  tenantId: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  amountEur: number | null;
  payload: Record<string, unknown>;
}

/** Il calcolo da valutare, senza filtri di visibilità (li applica il service). */
export async function findVariablePayCalculationById(
  q: DbConnector,
  id: string,
): Promise<VariablePayCalcRow | null> {
  const res = await q.query<{
    variable_pay_calculation_id: string; variable_pay_calculation_tenant_id: string;
    variable_pay_calculation_user_id: string; period_start: string; period_end: string;
    amount: string | null; variable_pay_calculation_payload: Record<string, unknown>;
  }>(
    `SELECT variable_pay_calculation_id, variable_pay_calculation_tenant_id,
            variable_pay_calculation_user_id,
            variable_pay_calculation_period_start::text AS period_start,
            variable_pay_calculation_period_end::text   AS period_end,
            variable_pay_calculation_amount_eur::text   AS amount,
            variable_pay_calculation_payload
       FROM sys.sys_variable_pay_calculations
      WHERE variable_pay_calculation_id = $1`,
    [id],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    variablePayCalculationId: r.variable_pay_calculation_id,
    tenantId: r.variable_pay_calculation_tenant_id,
    userId: r.variable_pay_calculation_user_id,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    amountEur: r.amount === null ? null : Number(r.amount),
    payload: r.variable_pay_calculation_payload ?? {},
  };
}

export interface GateOutcomeRow {
  gateCode: string;
  gateName: string;
  isBlocking: boolean;
  status: string;
  overrideReason: string | null;
}

/**
 * Gli esiti dei cancelli che insistono sullo stesso periodo della persona.
 *
 * Di ogni cancello conta l'esito PIÙ RECENTE: un cancello rivalutato dopo una
 * deroga non deve continuare a comparire come bloccato. DISTINCT ON fa
 * esattamente questo, ordinando per data di registrazione decrescente.
 */
export async function listGateOutcomesForPeriod(
  q: DbConnector,
  userId: string,
  periodStart: string,
  periodEnd: string,
): Promise<GateOutcomeRow[]> {
  const res = await q.query<{
    code: string; name: string; blocking: boolean; status: string; reason: string | null;
  }>(
    `SELECT DISTINCT ON (g.reward_gate_id)
            c.reward_gate_catalog_code       AS code,
            c.reward_gate_catalog_name       AS name,
            c.reward_gate_catalog_is_blocking AS blocking,
            r.reward_gate_result_status      AS status,
            r.reward_gate_result_override_reason AS reason
       FROM sys.sys_reward_gates g
       JOIN sys.sys_reward_gate_catalog c
         ON c.reward_gate_catalog_id = g.reward_gate_catalog_id
       JOIN sys.sys_reward_gate_results r
         ON r.reward_gate_result_gate_id = g.reward_gate_id
      WHERE g.reward_gate_user_id = $1
        AND g.reward_gate_period_start <= $3::date
        AND g.reward_gate_period_end   >= $2::date
      ORDER BY g.reward_gate_id, r.reward_gate_result_recorded_at DESC`,
    [userId, periodStart, periodEnd],
  );
  return res.rows.map((r) => ({
    gateCode: r.code,
    gateName: r.name,
    isBlocking: r.blocking,
    status: r.status,
    overrideReason: r.reason,
  }));
}

/**
 * Catalogo delle fasce retributive del tenant (#53 E4).
 *
 * `withValueOnly` filtra le righe prive di importi: la tabella ne contiene ancora molte,
 * arrivate da un import che portò le chiavi e non i dati. `totalIncludingValueless` le
 * conta comunque, così chi legge sa che esistono invece di crederle inesistenti.
 */
export async function listCompensationBands(
  db: DbConnector,
  tenantId: string | null,
  q: { withValueOnly: boolean; q?: string; limit: number; offset: number },
): Promise<{ items: CompensationBand[]; total: number; totalIncludingValueless: number }> {
  const params: unknown[] = [tenantId];
  const where: string[] = ["($1::uuid IS NULL OR compensation_band_tenant_id = $1::uuid)"];
  if (q.withValueOnly) where.push("compensation_band_mid_eur IS NOT NULL");
  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`(compensation_band_name ILIKE $${params.length} OR compensation_band_code ILIKE $${params.length})`);
  }
  const whereSql = where.join(" AND ");

  const totals = await db.query<{ filtrate: string; tutte: string }>(
    `SELECT count(*) FILTER (WHERE ${whereSql})::text AS filtrate,
            count(*) FILTER (WHERE ($1::uuid IS NULL OR compensation_band_tenant_id = $1::uuid))::text AS tutte
       FROM sys.sys_compensation_bands`,
    params,
  );

  params.push(q.limit, q.offset);
  const res = await db.query<Record<string, unknown>>(
    `SELECT compensation_band_id, compensation_band_tenant_id, compensation_band_code,
            compensation_band_name, compensation_band_min_eur::text AS min_eur,
            compensation_band_mid_eur::text AS mid_eur, compensation_band_max_eur::text AS max_eur,
            compensation_band_is_global, compensation_band_metadata
       FROM sys.sys_compensation_bands
      WHERE ${whereSql}
      ORDER BY compensation_band_mid_eur DESC NULLS LAST, compensation_band_name
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    total: Number(totals.rows[0]?.filtrate ?? 0),
    totalIncludingValueless: Number(totals.rows[0]?.tutte ?? 0),
    items: res.rows.map((r) => ({
      compensationBandId: r.compensation_band_id as string,
      tenantId: r.compensation_band_tenant_id as string | null,
      code: r.compensation_band_code as string,
      name: r.compensation_band_name as string,
      minEur: (r.min_eur as string | null) ?? null,
      midEur: (r.mid_eur as string | null) ?? null,
      maxEur: (r.max_eur as string | null) ?? null,
      isGlobal: (r.compensation_band_is_global as boolean) ?? false,
      metadata: (r.compensation_band_metadata as Record<string, unknown>) ?? {},
    })),
  };
}
