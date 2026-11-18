/**
 * apps/api/src/modules/talent-review/repository.ts — A/L3 (#29).
 * Raw parameterized SQL over six dormant talent-intelligence tables. READ-only.
 * Org scoping (userIdAllowList) is applied by the service via resolveOrgReadScope;
 * this layer only receives the resolved tenant filter / allow-list. The catalog
 * tables (critical positions / coverage) carry no person rows → tenant filter only.
 */
import type { Pool, PoolClient } from "pg";
import { soloPersone } from "../../lib/scope/persone.js";
import { K_ANONIMATO_MINIMO } from "../engagement/repository.js";
import type {
  NineBoxRow, NineBoxListQuery,
  FitScore, FitScoreListQuery,
  ReadinessScore, ReadinessScoreListQuery,
  SuccessionScore, SuccessionScoreListQuery,
  CriticalPosition, CriticalPositionListQuery,
  CriticalCoverage, CriticalCoverageListQuery,
  TalentBand,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

/** SQL CASE bucketing a numeric axis into the documented LOW/MEDIUM/HIGH band
 *  (< 50 LOW, [50,75) MEDIUM, >= 75 HIGH; NULL → LOW). */
function bandCase(col: string): string {
  return `CASE WHEN ${col} IS NULL THEN 'LOW'
               WHEN ${col} < 50 THEN 'LOW'
               WHEN ${col} < 75 THEN 'MEDIUM'
               ELSE 'HIGH' END`;
}

function numOrNull(v: string | null): number | null {
  return v === null ? null : Number(v);
}

// ── 9-box (sys_talent_scores) ────────────────────────────────────────────────

interface NineBoxDbRow {
  talent_score_id: string;
  talent_score_user_id: string;
  subject_user_name: string | null;
  talent_score_potential: string | null;
  talent_score_performance: string | null;
  talent_score_band: string | null;
  potential_band: TalentBand;
  performance_band: TalentBand;
  talent_score_computed_at: Date;
}

const NINE_BOX_COLS = `talent_score_id, talent_score_user_id,
  (SELECT COALESCE(NULLIF(concat_ws(', ', NULLIF(trim(u.user_last_name), ''), NULLIF(trim(u.user_first_name), '')), ''), u.user_display_name) FROM sys.sys_users u WHERE u.user_id = talent_score_user_id) AS subject_user_name,
  talent_score_potential, talent_score_performance, talent_score_band,
  ${bandCase("talent_score_potential")} AS potential_band,
  ${bandCase("talent_score_performance")} AS performance_band,
  talent_score_computed_at`;

function toNineBox(r: NineBoxDbRow): NineBoxRow {
  return {
    talentScoreId: r.talent_score_id,
    userId: r.talent_score_user_id,
    subjectUserName: r.subject_user_name ?? null,
    potential: numOrNull(r.talent_score_potential),
    performance: numOrNull(r.talent_score_performance),
    band: r.talent_score_band,
    potentialBand: r.potential_band,
    performanceBand: r.performance_band,
    computedAt: r.talent_score_computed_at.toISOString(),
  };
}

export async function listNineBox(
  q: DbConnector,
  filter: { tenantId?: string; userIdAllowList?: string[]; query: NineBoxListQuery },
): Promise<{ items: NineBoxRow[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`talent_score_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    if (filter.userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(filter.userIdAllowList);
    where.push(`talent_score_user_id = ANY($${params.length}::uuid[])`);
  }
  if (filter.query.userId) {
    params.push(filter.query.userId);
    where.push(`talent_score_user_id = $${params.length}`);
  }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_talent_scores ${wc}`,
    params,
  );
  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<NineBoxDbRow>(
    `SELECT ${NINE_BOX_COLS} FROM sys.sys_talent_scores ${wc}
      ORDER BY talent_score_computed_at DESC, talent_score_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toNineBox) };
}

// ── Position fit (sys_employee_position_fit_scores) ──────────────────────────

interface FitDbRow {
  employee_position_fit_score_id: string;
  employee_position_fit_score_tenant_id: string;
  employee_position_fit_score_user_id: string;
  subject_user_name: string | null;
  employee_position_fit_score_position_id: string;
  position_title: string | null;
  employee_position_fit_score_dimension: string;
  employee_position_fit_score_score: string;
  employee_position_fit_score_payload: Record<string, unknown>;
  employee_position_fit_score_computed_at: Date;
  created_at: Date;
}

const FIT_COLS = `(SELECT p.position_title FROM sys.sys_positions p WHERE p.position_id = employee_position_fit_score_position_id) AS position_title,
  employee_position_fit_score_id, employee_position_fit_score_tenant_id,
  employee_position_fit_score_user_id,
  (SELECT COALESCE(NULLIF(concat_ws(', ', NULLIF(trim(u.user_last_name), ''), NULLIF(trim(u.user_first_name), '')), ''), u.user_display_name) FROM sys.sys_users u WHERE u.user_id = employee_position_fit_score_user_id) AS subject_user_name,
  employee_position_fit_score_position_id, employee_position_fit_score_dimension,
  employee_position_fit_score_score, employee_position_fit_score_payload,
  employee_position_fit_score_computed_at, created_at`;

function toFit(r: FitDbRow): FitScore {
  return {
    fitScoreId: r.employee_position_fit_score_id,
    tenantId: r.employee_position_fit_score_tenant_id,
    userId: r.employee_position_fit_score_user_id,
    subjectUserName: r.subject_user_name ?? null,
    positionId: r.employee_position_fit_score_position_id,
    positionTitle: r.position_title ?? null,
    dimension: r.employee_position_fit_score_dimension,
    score: Number(r.employee_position_fit_score_score),
    payload: r.employee_position_fit_score_payload ?? {},
    computedAt: r.employee_position_fit_score_computed_at.toISOString(),
    createdAt: r.created_at.toISOString(),
  };
}

export async function listFit(
  q: DbConnector,
  filter: { tenantId?: string; userIdAllowList?: string[]; query: FitScoreListQuery },
): Promise<{ items: FitScore[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`employee_position_fit_score_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    if (filter.userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(filter.userIdAllowList);
    where.push(`employee_position_fit_score_user_id = ANY($${params.length}::uuid[])`);
  }
  if (filter.query.userId) {
    params.push(filter.query.userId);
    where.push(`employee_position_fit_score_user_id = $${params.length}`);
  }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_employee_position_fit_scores ${wc}`,
    params,
  );
  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<FitDbRow>(
    `SELECT ${FIT_COLS} FROM sys.sys_employee_position_fit_scores ${wc}
      ORDER BY employee_position_fit_score_score DESC, employee_position_fit_score_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toFit) };
}

// ── Readiness (sys_readiness_scores) ─────────────────────────────────────────

interface ReadinessDbRow {
  readiness_score_id: string;
  readiness_score_tenant_id: string;
  readiness_score_user_id: string;
  subject_user_name: string | null;
  readiness_score_position_id: string;
  position_title: string | null;
  readiness_score_horizon: string;
  readiness_score_value: string | null;
  readiness_score_payload: Record<string, unknown>;
  readiness_score_computed_at: Date;
  created_at: Date;
}

const READINESS_COLS = `(SELECT p.position_title FROM sys.sys_positions p WHERE p.position_id = readiness_score_position_id) AS position_title,
  readiness_score_id, readiness_score_tenant_id, readiness_score_user_id,
  (SELECT COALESCE(NULLIF(concat_ws(', ', NULLIF(trim(u.user_last_name), ''), NULLIF(trim(u.user_first_name), '')), ''), u.user_display_name) FROM sys.sys_users u WHERE u.user_id = readiness_score_user_id) AS subject_user_name,
  readiness_score_position_id, readiness_score_horizon, readiness_score_value,
  readiness_score_payload, readiness_score_computed_at, created_at`;

function toReadiness(r: ReadinessDbRow): ReadinessScore {
  return {
    readinessScoreId: r.readiness_score_id,
    tenantId: r.readiness_score_tenant_id,
    userId: r.readiness_score_user_id,
    subjectUserName: r.subject_user_name ?? null,
    positionId: r.readiness_score_position_id,
    positionTitle: r.position_title ?? null,
    horizon: r.readiness_score_horizon,
    value: numOrNull(r.readiness_score_value),
    payload: r.readiness_score_payload ?? {},
    computedAt: r.readiness_score_computed_at.toISOString(),
    createdAt: r.created_at.toISOString(),
  };
}

export async function listReadiness(
  q: DbConnector,
  filter: { tenantId?: string; userIdAllowList?: string[]; query: ReadinessScoreListQuery },
): Promise<{ items: ReadinessScore[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`readiness_score_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    if (filter.userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(filter.userIdAllowList);
    where.push(`readiness_score_user_id = ANY($${params.length}::uuid[])`);
  }
  if (filter.query.userId) {
    params.push(filter.query.userId);
    where.push(`readiness_score_user_id = $${params.length}`);
  }
  if (filter.query.horizon) {
    params.push(filter.query.horizon);
    where.push(`readiness_score_horizon = $${params.length}`);
  }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_readiness_scores ${wc}`,
    params,
  );
  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<ReadinessDbRow>(
    `SELECT ${READINESS_COLS} FROM sys.sys_readiness_scores ${wc}
      ORDER BY readiness_score_computed_at DESC, readiness_score_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toReadiness) };
}

// ── Succession (sys_succession_scores) ───────────────────────────────────────

interface SuccessionDbRow {
  succession_score_id: string;
  succession_score_tenant_id: string;
  succession_score_user_id: string;
  subject_user_name: string | null;
  succession_score_position_id: string;
  position_title: string | null;
  succession_score_value: string | null;
  succession_score_horizon: string | null;
  succession_score_payload: Record<string, unknown>;
  succession_score_computed_at: Date;
  created_at: Date;
}

const SUCCESSION_COLS = `(SELECT p.position_title FROM sys.sys_positions p WHERE p.position_id = succession_score_position_id) AS position_title,
  succession_score_id, succession_score_tenant_id, succession_score_user_id,
  (SELECT COALESCE(NULLIF(concat_ws(', ', NULLIF(trim(u.user_last_name), ''), NULLIF(trim(u.user_first_name), '')), ''), u.user_display_name) FROM sys.sys_users u WHERE u.user_id = succession_score_user_id) AS subject_user_name,
  succession_score_position_id, succession_score_value, succession_score_horizon,
  succession_score_payload, succession_score_computed_at, created_at`;

function toSuccession(r: SuccessionDbRow): SuccessionScore {
  return {
    successionScoreId: r.succession_score_id,
    tenantId: r.succession_score_tenant_id,
    userId: r.succession_score_user_id,
    subjectUserName: r.subject_user_name ?? null,
    positionId: r.succession_score_position_id,
    positionTitle: r.position_title ?? null,
    value: numOrNull(r.succession_score_value),
    horizon: r.succession_score_horizon,
    payload: r.succession_score_payload ?? {},
    computedAt: r.succession_score_computed_at.toISOString(),
    createdAt: r.created_at.toISOString(),
  };
}

export async function listSuccession(
  q: DbConnector,
  filter: { tenantId?: string; userIdAllowList?: string[]; query: SuccessionScoreListQuery },
): Promise<{ items: SuccessionScore[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`succession_score_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    if (filter.userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(filter.userIdAllowList);
    where.push(`succession_score_user_id = ANY($${params.length}::uuid[])`);
  }
  if (filter.query.userId) {
    params.push(filter.query.userId);
    where.push(`succession_score_user_id = $${params.length}`);
  }
  if (filter.query.horizon) {
    params.push(filter.query.horizon);
    where.push(`succession_score_horizon = $${params.length}`);
  }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_succession_scores ${wc}`,
    params,
  );
  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<SuccessionDbRow>(
    `SELECT ${SUCCESSION_COLS} FROM sys.sys_succession_scores ${wc}
      ORDER BY succession_score_computed_at DESC, succession_score_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toSuccession) };
}

// ── Critical positions (sys_critical_positions — catalog, no person rows) ────

interface CriticalPositionDbRow {
  critical_position_id: string;
  critical_position_tenant_id: string;
  critical_position_position_id: string;
  position_title: string | null;
  critical_position_rationale: string | null;
  critical_position_business_impact_score: string | null;
  critical_position_flagged_at: Date;
  critical_position_metadata: Record<string, unknown>;
  created_at: Date;
  created_by: string | null;
}

const CRITICAL_POSITION_COLS = `(SELECT p.position_title FROM sys.sys_positions p WHERE p.position_id = critical_position_position_id) AS position_title,
  critical_position_id, critical_position_tenant_id,
  critical_position_position_id, critical_position_rationale, critical_position_business_impact_score,
  critical_position_flagged_at, critical_position_metadata, created_at, created_by`;

function toCriticalPosition(r: CriticalPositionDbRow): CriticalPosition {
  return {
    criticalPositionId: r.critical_position_id,
    tenantId: r.critical_position_tenant_id,
    positionId: r.critical_position_position_id,
    positionTitle: r.position_title ?? null,
    rationale: r.critical_position_rationale,
    businessImpactScore: numOrNull(r.critical_position_business_impact_score),
    flaggedAt: r.critical_position_flagged_at.toISOString(),
    metadata: r.critical_position_metadata ?? {},
    createdAt: r.created_at.toISOString(),
    createdBy: r.created_by,
  };
}

export async function listCriticalPositions(
  q: DbConnector,
  tenantId: string | undefined,
  query: CriticalPositionListQuery,
): Promise<{ items: CriticalPosition[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (tenantId) {
    params.push(tenantId);
    where.push(`critical_position_tenant_id = $${params.length}`);
  }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_critical_positions ${wc}`,
    params,
  );
  params.push(query.limit);
  const lim = params.length;
  params.push(query.offset);
  const off = params.length;
  const res = await q.query<CriticalPositionDbRow>(
    `SELECT ${CRITICAL_POSITION_COLS} FROM sys.sys_critical_positions ${wc}
      ORDER BY critical_position_business_impact_score DESC NULLS LAST, critical_position_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toCriticalPosition) };
}

// ── Critical-role coverage (derivata dal vivo sulle posizioni critiche) ───────
//
// D3 (forense frontend 2026-11-15): `sys_critical_role_coverage_status` era un rollup scritto da uno
// script su posizioni DIVERSE da `sys_critical_positions` (intersezione vuota, 5 righe su 8 senza
// punteggio). Una copertura dei ruoli critici si calcola sui ruoli critici: una riga per posizione
// critica, con i candidati dei suoi bacini di successione per orizzonte di prontezza. La tabella
// vecchia resta com'e' (ritirare non e' cancellare, ADR-0035) ma non e' piu' la fonte.
// `overallScore` resta nullo: nessun modello lo calcola oggi, e la pagina dice «non calcolata».

interface CriticalCoverageDbRow {
  critical_position_id: string;
  critical_position_tenant_id: string;
  critical_position_position_id: string;
  position_title: string | null;
  ready_now: string;
  ready_6mo: string;
  ready_1y: string;
  ready_2y: string;
  candidati: string;
  created_at: Date;
}

function toCriticalCoverage(r: CriticalCoverageDbRow): CriticalCoverage {
  return {
    criticalRoleCoverageStatusId: r.critical_position_id,
    tenantId: r.critical_position_tenant_id,
    positionId: r.critical_position_position_id,
    positionTitle: r.position_title ?? null,
    // I conteggi per orizzonte sono dati di valutazione di persone (EVALUATION): sotto la soglia
    // di anonimato (come engagement) una cella con 1..K-1 candidati identificherebbe chi e' pronto,
    // quindi i conteggi si tolgono e i loro nomi si dichiarano in `masked`. Zero candidati non
    // identifica nessuno e resta.
    // La soglia vale anche per ogni orizzonte: una cella con 1..K-1 persone toglie tutti e tre i
    // conteggi (soppressione complementare), così una cella nascosta non si ricava dalle altre.
    ...(() => {
      const n = Number(r.candidati);
      const celle = [Number(r.ready_now), Number(r.ready_6mo), Number(r.ready_1y)];
      const piccola = (c: number) => c > 0 && c < K_ANONIMATO_MINIMO;
      if (piccola(n) || celle.some(piccola)) return { masked: ["ready1yCount", "ready6moCount", "readyNowCount"] };
      return {
        readyNowCount: Number(r.ready_now),
        ready6moCount: Number(r.ready_6mo),
        ready1yCount: Number(r.ready_1y),
      };
    })(),
    overallScore: null,
    payload: { source: "successor_candidates" },
    computedAt: new Date().toISOString(),
    createdAt: r.created_at.toISOString(),
  };
}

export async function listCriticalCoverage(
  q: DbConnector,
  tenantId: string | undefined,
  query: CriticalCoverageListQuery,
  /** Il perimetro di chi guarda (sottoalbero o se' stesso): vuoto/assente = tutti i candidati del tenant. */
  userIdAllowList?: string[],
): Promise<{ items: CriticalCoverage[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (tenantId) {
    params.push(tenantId);
    where.push(`cp.critical_position_tenant_id = $${params.length}`);
  }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_critical_positions cp ${wc}`,
    params,
  );
  params.push(userIdAllowList ?? null);
  const allow = params.length;
  params.push(query.limit);
  const lim = params.length;
  params.push(query.offset);
  const off = params.length;
  const res = await q.query<CriticalCoverageDbRow>(
    `SELECT cp.critical_position_id, cp.critical_position_tenant_id, cp.critical_position_position_id,
            (SELECT p.position_title FROM sys.sys_positions p WHERE p.position_id = cp.critical_position_position_id) AS position_title,
            count(DISTINCT sc.successor_candidate_user_id) FILTER (WHERE sc.successor_candidate_readiness_level = 'READY_NOW')::text AS ready_now,
            count(DISTINCT sc.successor_candidate_user_id) FILTER (WHERE sc.successor_candidate_readiness_level = 'READY_6_MONTHS')::text AS ready_6mo,
            count(DISTINCT sc.successor_candidate_user_id) FILTER (WHERE sc.successor_candidate_readiness_level = 'READY_1_YEAR')::text AS ready_1y,
            count(DISTINCT sc.successor_candidate_user_id) FILTER (WHERE sc.successor_candidate_readiness_level = 'READY_2_YEARS')::text AS ready_2y,
            count(DISTINCT sc.successor_candidate_user_id)::text AS candidati,
            cp.created_at
       FROM sys.sys_critical_positions cp
       LEFT JOIN sys.sys_succession_pools sp
              ON sp.succession_pool_position_id = cp.critical_position_position_id
             AND sp.succession_pool_tenant_id = cp.critical_position_tenant_id
       LEFT JOIN sys.sys_successor_candidates sc
              ON sc.successor_candidate_pool_id = sp.succession_pool_id
             AND ($${allow}::uuid[] IS NULL OR sc.successor_candidate_user_id = ANY($${allow}::uuid[]))
             AND EXISTS (SELECT 1 FROM sys.sys_users su
                          WHERE su.user_id = sc.successor_candidate_user_id AND ${soloPersone("su")})
       ${wc}
      GROUP BY cp.critical_position_id, cp.critical_position_tenant_id, cp.critical_position_position_id, cp.created_at
      ORDER BY count(DISTINCT sc.successor_candidate_user_id) DESC, 4, cp.critical_position_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toCriticalCoverage) };
}
