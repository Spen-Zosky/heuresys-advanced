/**
 * apps/api/src/modules/scenari/lettura.ts — la lettura di uno scenario per le rotte (voce F3b-2).
 *
 * Ricompone dalle tabelle della 000515 la forma del contratto condiviso `ScenarioDetailSchema`:
 * lo scenario e la sua versione più recente, con ipotesi, opzioni, leve, risultati, fonti e
 * controlli di equità. Sola lettura; ogni query filtra per tenant (I5).
 */
import type { ScenarioDetail, Scenario, ScenarioVersion, ScenarioSource } from "@heuresys/shared";
import { pool } from "../../db/client.js";

const iso = (d: Date | string | null): string | null => (d === null ? null : new Date(d).toISOString());
const num = (x: string | number | null): number | null => (x === null ? null : Number(x));

interface RigaScenario {
  scenario_id: string;
  scenario_tenant_id: string;
  scenario_title: string;
  scenario_question: string;
  scenario_family: Scenario["family"];
  scenario_domain: Scenario["domain"];
  scenario_catalog_code: string | null;
  scenario_status: Scenario["status"];
  scenario_origin: Scenario["origin"];
  scenario_agent_ref: string | null;
  scenario_owner_user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

function scenarioDa(r: RigaScenario): Scenario {
  return {
    id: r.scenario_id,
    tenantId: r.scenario_tenant_id,
    title: r.scenario_title,
    question: r.scenario_question,
    family: r.scenario_family,
    domain: r.scenario_domain,
    catalogCode: r.scenario_catalog_code,
    status: r.scenario_status,
    origin: r.scenario_origin,
    agentRef: r.scenario_agent_ref,
    ownerUserId: r.scenario_owner_user_id,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

const COLONNE_SCENARIO = `scenario_id, scenario_tenant_id, scenario_title, scenario_question, scenario_family,
  scenario_domain, scenario_catalog_code, scenario_status, scenario_origin, scenario_agent_ref,
  scenario_owner_user_id, created_at, updated_at`;

export async function elencoScenari(tenantId: string): Promise<Scenario[]> {
  const r = await pool.query<RigaScenario>(
    `SELECT ${COLONNE_SCENARIO} FROM sys.sys_scenarios WHERE scenario_tenant_id = $1
      ORDER BY updated_at DESC, scenario_id`,
    [tenantId],
  );
  return r.rows.map(scenarioDa);
}

export async function dettaglioScenario(tenantId: string, scenarioId: string): Promise<ScenarioDetail | null> {
  const s = await pool.query<RigaScenario>(
    `SELECT ${COLONNE_SCENARIO} FROM sys.sys_scenarios WHERE scenario_tenant_id = $1 AND scenario_id = $2`,
    [tenantId, scenarioId],
  );
  if (!s.rows[0]) return null;
  const v = await pool.query<{
    id: string; number: number; status: ScenarioVersion["status"]; notes: string | null;
    baseline_at: Date | null; baseline_digest: string | null; computed_at: Date | null;
  }>(
    `SELECT scenario_version_id AS id, scenario_version_number AS number, scenario_version_status AS status,
            scenario_version_notes AS notes, scenario_version_baseline_at AS baseline_at,
            scenario_version_baseline_digest AS baseline_digest, scenario_version_computed_at AS computed_at
       FROM sys.sys_scenario_versions
      WHERE scenario_version_tenant_id = $1 AND scenario_version_scenario_id = $2
      ORDER BY scenario_version_number DESC LIMIT 1`,
    [tenantId, scenarioId],
  );
  const riga = v.rows[0];
  if (!riga) return { scenario: scenarioDa(s.rows[0]), version: null };
  const versionId = riga.id;

  const fonti = await pool.query<{ id: string; kind: ScenarioSource["kind"]; ref: string; label: string; assumption_id: string | null; result_id: string | null }>(
    `SELECT scenario_source_id AS id, scenario_source_kind AS kind, scenario_source_ref AS ref, scenario_source_label AS label,
            scenario_source_assumption_id AS assumption_id, scenario_source_result_id AS result_id
       FROM sys.sys_scenario_sources WHERE scenario_source_tenant_id = $1 AND scenario_source_version_id = $2
      ORDER BY scenario_source_label, scenario_source_id`,
    [tenantId, versionId],
  );
  const fontiDi = (chiave: "assumption_id" | "result_id", id: string): ScenarioSource[] =>
    fonti.rows.filter((f) => f[chiave] === id).map((f) => ({ id: f.id, kind: f.kind, ref: f.ref, label: f.label }));

  const ipotesi = await pool.query<{ id: string; option_id: string | null; kind: "DATO" | "STIMA" | "VINCOLO" | "POLITICA"; statement: string; value: string | null; unit: string | null; low: string | null; high: string | null }>(
    `SELECT scenario_assumption_id AS id, scenario_assumption_option_id AS option_id, scenario_assumption_kind AS kind,
            scenario_assumption_statement AS statement, scenario_assumption_value AS value, scenario_assumption_unit AS unit,
            scenario_assumption_low AS low, scenario_assumption_high AS high
       FROM sys.sys_scenario_assumptions WHERE scenario_assumption_tenant_id = $1 AND scenario_assumption_version_id = $2
      ORDER BY scenario_assumption_ordinal, scenario_assumption_id`,
    [tenantId, versionId],
  );
  const opzioni = await pool.query<{ id: string; code: string; label: string; description: string | null; is_baseline: boolean; touches_people: boolean; recommended: boolean; ordinal: number }>(
    `SELECT scenario_option_id AS id, scenario_option_code AS code, scenario_option_label AS label,
            scenario_option_description AS description, scenario_option_is_baseline AS is_baseline,
            scenario_option_touches_people AS touches_people, scenario_option_recommended AS recommended,
            scenario_option_ordinal AS ordinal
       FROM sys.sys_scenario_options WHERE scenario_option_tenant_id = $1 AND scenario_option_version_id = $2
      ORDER BY scenario_option_ordinal, scenario_option_code`,
    [tenantId, versionId],
  );
  const idOpzioni = opzioni.rows.map((o) => o.id);
  const leve = await pool.query<{ id: string; option_id: string; kind: string; target_type: string; target_id: string | null; parameters: Record<string, unknown>; ordinal: number }>(
    `SELECT scenario_lever_id AS id, scenario_lever_option_id AS option_id, scenario_lever_kind AS kind,
            scenario_lever_target_type AS target_type, scenario_lever_target_id AS target_id,
            scenario_lever_parameters AS parameters, scenario_lever_ordinal AS ordinal
       FROM sys.sys_scenario_levers WHERE scenario_lever_tenant_id = $1 AND scenario_lever_option_id = ANY($2::uuid[])
      ORDER BY scenario_lever_ordinal, scenario_lever_id`,
    [tenantId, idOpzioni],
  );
  const risultati = await pool.query<{ id: string; option_id: string; metric_code: string; metric_label: string; value: string; unit: string; low: string | null; high: string | null; draws: number | null; horizon: number | null; computed_by: string; computed_at: Date }>(
    `SELECT scenario_result_id AS id, scenario_result_option_id AS option_id, scenario_result_metric_code AS metric_code,
            scenario_result_metric_label AS metric_label, scenario_result_value AS value, scenario_result_unit AS unit,
            scenario_result_low AS low, scenario_result_high AS high, scenario_result_draws AS draws,
            scenario_result_horizon_months AS horizon, scenario_result_computed_by AS computed_by,
            scenario_result_computed_at AS computed_at
       FROM sys.sys_scenario_results WHERE scenario_result_tenant_id = $1 AND scenario_result_option_id = ANY($2::uuid[])
      ORDER BY scenario_result_metric_code, scenario_result_id`,
    [tenantId, idOpzioni],
  );
  const equita = await pool.query<{ id: string; option_id: string; trait: string; groups: string; ratio: string | null; threshold: string; outcome: string; method: string; computed_at: Date }>(
    `SELECT scenario_equity_check_id AS id, scenario_equity_check_option_id AS option_id, scenario_equity_check_trait AS trait,
            scenario_equity_check_groups AS groups, scenario_equity_check_ratio AS ratio,
            scenario_equity_check_threshold AS threshold, scenario_equity_check_outcome AS outcome,
            scenario_equity_check_method AS method, scenario_equity_check_computed_at AS computed_at
       FROM sys.sys_scenario_equity_checks WHERE scenario_equity_check_tenant_id = $1 AND scenario_equity_check_option_id = ANY($2::uuid[])
      ORDER BY scenario_equity_check_trait`,
    [tenantId, idOpzioni],
  );

  const version = {
    id: versionId,
    number: riga.number,
    status: riga.status,
    notes: riga.notes,
    baselineAt: iso(riga.baseline_at),
    baselineDigest: riga.baseline_digest?.trim() ?? null,
    computedAt: iso(riga.computed_at),
    assumptions: ipotesi.rows.map((a) => ({
      id: a.id, optionId: a.option_id, kind: a.kind, statement: a.statement,
      value: num(a.value), unit: a.unit, low: num(a.low), high: num(a.high),
      sources: fontiDi("assumption_id", a.id),
    })),
    options: opzioni.rows.map((o) => ({
      id: o.id, code: o.code, label: o.label, description: o.description,
      isBaseline: o.is_baseline, touchesPeople: o.touches_people, recommended: o.recommended, ordinal: o.ordinal,
      levers: leve.rows.filter((l) => l.option_id === o.id).map((l) => ({
        id: l.id, kind: l.kind, targetType: l.target_type, targetId: l.target_id, parameters: l.parameters, ordinal: l.ordinal,
      })),
      results: risultati.rows.filter((x) => x.option_id === o.id).map((x) => ({
        id: x.id, metricCode: x.metric_code, metricLabel: x.metric_label, value: Number(x.value), unit: x.unit,
        low: num(x.low), high: num(x.high), draws: x.draws, horizonMonths: x.horizon,
        computedBy: x.computed_by, computedAt: iso(x.computed_at)!, sources: fontiDi("result_id", x.id),
      })),
      equityChecks: equita.rows.filter((e) => e.option_id === o.id).map((e) => ({
        id: e.id, trait: e.trait, groups: e.groups, ratio: num(e.ratio), threshold: Number(e.threshold),
        outcome: e.outcome, method: e.method, computedAt: iso(e.computed_at)!,
      })),
    })),
  } as ScenarioVersion;
  return { scenario: scenarioDa(s.rows[0]), version };
}
