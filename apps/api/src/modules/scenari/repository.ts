/**
 * apps/api/src/modules/scenari/repository.ts — SQL del motore degli scenari (000515), voce F3b-1.
 *
 * Scrive SOLO nelle tabelle degli scenari e della struttura ombra; delle tabelle di business legge
 * soltanto (le tavole di successione e le persone del tenant). Tutte le funzioni ricevono il client
 * della transazione del servizio: uno scenario si salva tutto o niente.
 */
import type { PoolClient } from "pg";
import type { PosizioneOmbra, Prontezza, Successore, TitolareOmbra } from "./calcolatori/successione.js";

export interface NuovoScenario {
  tenantId: string;
  title: string;
  question: string;
  family: string;
  domain: string;
  catalogCode: string | null;
  ownerUserId: string | null;
  actorUserId: string | null;
}

export async function inserisciScenario(c: PoolClient, s: NuovoScenario): Promise<string> {
  const r = await c.query<{ id: string }>(
    `INSERT INTO sys.sys_scenarios
       (scenario_tenant_id, scenario_title, scenario_question, scenario_family, scenario_domain,
        scenario_catalog_code, scenario_owner_user_id, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) RETURNING scenario_id AS id`,
    [s.tenantId, s.title, s.question, s.family, s.domain, s.catalogCode, s.ownerUserId, s.actorUserId],
  );
  return r.rows[0]!.id;
}

export async function inserisciVersione(c: PoolClient, scenarioId: string, tenantId: string, notes: string, actorUserId: string | null): Promise<string> {
  const r = await c.query<{ id: string }>(
    `INSERT INTO sys.sys_scenario_versions
       (scenario_version_scenario_id, scenario_version_tenant_id, scenario_version_number, scenario_version_notes, created_by)
     VALUES ($1, $2, 1, $3, $4) RETURNING scenario_version_id AS id`,
    [scenarioId, tenantId, notes, actorUserId],
  );
  return r.rows[0]!.id;
}

export interface Fotografia {
  units: number;
  positions: number;
  assignments: number;
  digest: string;
}

export async function fotografa(c: PoolClient, versionId: string): Promise<Fotografia> {
  const r = await c.query<{ unita: number; posizioni: number; assegnazioni: number; impronta: string }>(
    `SELECT unita, posizioni, assegnazioni, impronta FROM sys.sys_scenario_fotografa($1)`,
    [versionId],
  );
  const x = r.rows[0]!;
  return { units: x.unita, positions: x.posizioni, assignments: x.assegnazioni, digest: x.impronta.trim() };
}

export interface TitolareOmbraCompleto extends TitolareOmbra {
  fte: number;
}

export interface PosizioneOmbraConUnita extends PosizioneOmbra {
  /** l'unità ombra della posizione */
  unitaId: string | null;
}

/** Le unità della fotografia (senza opzione): id ombra e nome, per dire quali unità cedono. */
export async function leggiUnitaOmbra(c: PoolClient, versionId: string): Promise<Map<string, string>> {
  const r = await c.query<{ id: string; name: string }>(
    `SELECT shadow_unit_id AS id, shadow_unit_name AS name FROM sys.sys_scenario_shadow_units
      WHERE shadow_unit_version_id = $1 AND shadow_unit_option_id IS NULL`,
    [versionId],
  );
  return new Map(r.rows.map((x) => [x.id, x.name]));
}

export async function leggiOmbra(
  c: PoolClient,
  versionId: string,
): Promise<{ posizioni: PosizioneOmbraConUnita[]; titolari: TitolareOmbraCompleto[] }> {
  const p = await c.query<{ id: string; source_id: string | null; code: string; title: string; criticality: string | null; unit_id: string | null }>(
    `SELECT shadow_position_id AS id, shadow_position_source_id AS source_id, shadow_position_code AS code,
            shadow_position_title AS title, shadow_position_criticality AS criticality, shadow_position_unit_id AS unit_id
       FROM sys.sys_scenario_shadow_positions
      WHERE shadow_position_version_id = $1 AND shadow_position_option_id IS NULL`,
    [versionId],
  );
  const a = await c.query<{ id: string; position_id: string; user_id: string | null; kind: string; fte: string }>(
    `SELECT shadow_assignment_id AS id, shadow_assignment_position_id AS position_id,
            shadow_assignment_user_id AS user_id, shadow_assignment_kind AS kind, shadow_assignment_fte AS fte
       FROM sys.sys_scenario_shadow_assignments
      WHERE shadow_assignment_version_id = $1 AND shadow_assignment_option_id IS NULL`,
    [versionId],
  );
  return {
    posizioni: p.rows.map((r) => ({ id: r.id, sourceId: r.source_id, codice: r.code, titolo: r.title, criticita: r.criticality, unitaId: r.unit_id })),
    titolari: a.rows.map((r) => ({ id: r.id, posizioneId: r.position_id, userId: r.user_id, tipo: r.kind, fte: Number(r.fte) })),
  };
}

/** Le tavole di successione attive del tenant: candidati non ritirati, con la loro prontezza. */
export async function leggiSuccessori(c: PoolClient, tenantId: string): Promise<Successore[]> {
  const r = await c.query<{ position_id: string; user_id: string; readiness: string | null; status: string }>(
    `SELECT sp.succession_pool_position_id AS position_id, sc.successor_candidate_user_id AS user_id,
            sc.successor_candidate_readiness_level AS readiness, sc.successor_candidate_status AS status
       FROM sys.sys_successor_candidates sc
       JOIN sys.sys_succession_pools sp ON sp.succession_pool_id = sc.successor_candidate_pool_id
      WHERE sc.successor_candidate_tenant_id = $1
        AND sp.succession_pool_tenant_id = $1
        AND sp.succession_pool_status = 'ACTIVE'
        AND sc.successor_candidate_status IN ('CANDIDATE', 'CONFIRMED')`,
    [tenantId],
  );
  return r.rows.map((x) => ({
    posizioneSourceId: x.position_id,
    userId: x.user_id,
    prontezza: (x.readiness as Prontezza | null) ?? null,
    confermato: x.status === "CONFIRMED",
  }));
}

/** Le persone del tenant fra quelle chieste: l'API filtra per tenant (I5). */
export async function personeDelTenant(c: PoolClient, tenantId: string, userIds: readonly string[]): Promise<Map<string, string>> {
  const r = await c.query<{ user_id: string; nome: string }>(
    `SELECT user_id, trim(concat_ws(', ', nullif(user_last_name, ''), nullif(user_first_name, ''))) AS nome
       FROM sys.sys_users WHERE user_tenant_id = $1 AND user_id = ANY($2::uuid[])`,
    [tenantId, [...userIds]],
  );
  return new Map(r.rows.map((x) => [x.user_id, x.nome]));
}

export interface NuovaOpzione {
  versionId: string;
  tenantId: string;
  code: string;
  label: string;
  description: string;
  isBaseline: boolean;
  touchesPeople: boolean;
  ordinal: number;
}

export async function inserisciOpzione(c: PoolClient, o: NuovaOpzione): Promise<string> {
  const r = await c.query<{ id: string }>(
    `INSERT INTO sys.sys_scenario_options
       (scenario_option_version_id, scenario_option_tenant_id, scenario_option_code, scenario_option_label,
        scenario_option_description, scenario_option_is_baseline, scenario_option_touches_people, scenario_option_ordinal)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING scenario_option_id AS id`,
    [o.versionId, o.tenantId, o.code, o.label, o.description, o.isBaseline, o.touchesPeople, o.ordinal],
  );
  return r.rows[0]!.id;
}

export async function inserisciLeva(
  c: PoolClient,
  l: { optionId: string; tenantId: string; kind: string; targetType: string; targetId: string | null; parameters: Record<string, unknown>; ordinal: number },
): Promise<void> {
  await c.query(
    `INSERT INTO sys.sys_scenario_levers
       (scenario_lever_option_id, scenario_lever_tenant_id, scenario_lever_kind, scenario_lever_target_type,
        scenario_lever_target_id, scenario_lever_parameters, scenario_lever_ordinal)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [l.optionId, l.tenantId, l.kind, l.targetType, l.targetId, JSON.stringify(l.parameters), l.ordinal],
  );
}

export interface Fonte {
  kind: string;
  ref: string;
  label: string;
}

export async function inserisciIpotesi(
  c: PoolClient,
  a: {
    versionId: string; tenantId: string; kind: string; statement: string; ordinal: number; fonti: readonly Fonte[];
    /** il numero dell'ipotesi e, per una STIMA, la sua banda (CHECK della 000515) */
    value?: number | null; unit?: string | null; low?: number | null; high?: number | null;
  },
): Promise<void> {
  const r = await c.query<{ id: string }>(
    `INSERT INTO sys.sys_scenario_assumptions
       (scenario_assumption_version_id, scenario_assumption_tenant_id, scenario_assumption_kind,
        scenario_assumption_statement, scenario_assumption_ordinal,
        scenario_assumption_value, scenario_assumption_unit, scenario_assumption_low, scenario_assumption_high)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING scenario_assumption_id AS id`,
    [a.versionId, a.tenantId, a.kind, a.statement, a.ordinal, a.value ?? null, a.unit ?? null, a.low ?? null, a.high ?? null],
  );
  for (const f of a.fonti) {
    await c.query(
      `INSERT INTO sys.sys_scenario_sources
         (scenario_source_version_id, scenario_source_tenant_id, scenario_source_assumption_id,
          scenario_source_kind, scenario_source_ref, scenario_source_label)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [a.versionId, a.tenantId, r.rows[0]!.id, f.kind, f.ref, f.label],
    );
  }
}

export async function inserisciRisultato(
  c: PoolClient,
  x: {
    versionId: string; optionId: string; tenantId: string; metricCode: string; metricLabel: string; value: number; unit: string; computedBy: string; fonti: readonly Fonte[];
    /** banda, numero di estrazioni e orizzonte, per i risultati simulati (famiglia NEL_TEMPO) */
    low?: number | null; high?: number | null; draws?: number | null; horizonMonths?: number | null;
  },
): Promise<void> {
  const r = await c.query<{ id: string }>(
    `INSERT INTO sys.sys_scenario_results
       (scenario_result_option_id, scenario_result_tenant_id, scenario_result_metric_code, scenario_result_metric_label,
        scenario_result_value, scenario_result_unit, scenario_result_computed_by,
        scenario_result_low, scenario_result_high, scenario_result_draws, scenario_result_horizon_months)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING scenario_result_id AS id`,
    [x.optionId, x.tenantId, x.metricCode, x.metricLabel, x.value, x.unit, x.computedBy,
     x.low ?? null, x.high ?? null, x.draws ?? null, x.horizonMonths ?? null],
  );
  for (const f of x.fonti) {
    await c.query(
      `INSERT INTO sys.sys_scenario_sources
         (scenario_source_version_id, scenario_source_tenant_id, scenario_source_result_id,
          scenario_source_kind, scenario_source_ref, scenario_source_label)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [x.versionId, x.tenantId, r.rows[0]!.id, f.kind, f.ref, f.label],
    );
  }
}

export async function inserisciEquita(
  c: PoolClient,
  e: { optionId: string; tenantId: string; trait: string; groups: string; ratio: number | null; threshold: number; outcome: string; method: string },
): Promise<void> {
  await c.query(
    `INSERT INTO sys.sys_scenario_equity_checks
       (scenario_equity_check_option_id, scenario_equity_check_tenant_id, scenario_equity_check_trait,
        scenario_equity_check_groups, scenario_equity_check_ratio, scenario_equity_check_threshold,
        scenario_equity_check_outcome, scenario_equity_check_method)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [e.optionId, e.tenantId, e.trait, e.groups, e.ratio, e.threshold, e.outcome, e.method],
  );
}

/** Una riga ombra di assegnazione dell'opzione: lo stato dopo le leve (CHIUSA o NUOVA). */
export async function inserisciAssegnazioneOmbra(
  c: PoolClient,
  a: { versionId: string; tenantId: string; optionId: string; sourceId: string | null; positionId: string; userId: string; kind: string; fte: number; change: "CHIUSA" | "NUOVA" },
): Promise<void> {
  await c.query(
    `INSERT INTO sys.sys_scenario_shadow_assignments
       (shadow_assignment_version_id, shadow_assignment_tenant_id, shadow_assignment_option_id, shadow_assignment_source_id,
        shadow_assignment_position_id, shadow_assignment_user_id, shadow_assignment_kind, shadow_assignment_fte, shadow_assignment_change)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [a.versionId, a.tenantId, a.optionId, a.sourceId, a.positionId, a.userId, a.kind, a.fte, a.change],
  );
}

export async function segnaCalcolata(c: PoolClient, versionId: string): Promise<void> {
  await c.query(
    `UPDATE sys.sys_scenario_versions
        SET scenario_version_status = 'CALCOLATA', scenario_version_computed_at = now()
      WHERE scenario_version_id = $1 AND scenario_version_status = 'BOZZA'`,
    [versionId],
  );
}
