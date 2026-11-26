import { describe, it, expect, beforeAll } from "vitest";
import { pool } from "../src/db/client.js";
import {
  SCENARIO_FAMILY_VALUES,
  SCENARIO_DOMAIN_VALUES,
  SCENARIO_STATUS_VALUES,
  SCENARIO_ORIGIN_VALUES,
  SCENARIO_VERSION_STATUS_VALUES,
  SCENARIO_LEVER_KIND_VALUES,
  SCENARIO_TARGET_TYPE_VALUES,
  SCENARIO_ASSUMPTION_KIND_VALUES,
  SCENARIO_SOURCE_KIND_VALUES,
  SCENARIO_EQUITY_TRAIT_VALUES,
  SCENARIO_EQUITY_OUTCOME_VALUES,
  SHADOW_ASSIGNMENT_KIND_VALUES,
  ScenarioSnapshotSchema,
} from "@heuresys/shared";

/**
 * F3a del piano Heuresys AI-driven (ADR-0063 D5, D6) — lo schema del motore degli scenari (000515).
 *
 *  1. gli elenchi chiusi dello schema condiviso coincidono con i CHECK del database;
 *  2. la fotografia di RTL copia unità, posizioni e assegnazioni attive nella struttura ombra e
 *     NON scrive sulle tabelle vere (post-condizione: impronta delle tre tabelle prima e dopo);
 *  3. le guardie G1-G3: almeno due opzioni, fonti, equità dichiarata, versione calcolata congelata.
 *
 * Il file gira in una transazione annullata alla fine (tx-isolation): nessun residuo.
 */

let tenantId = "";
let ownerId = "";

/** I valori ammessi da un CHECK della forma `col IN (...)`, letti da pg_constraint. */
async function valoriDelCheck(tabella: string, vincolo: string): Promise<string[]> {
  const r = await pool.query<{ def: string }>(
    `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'sys' AND t.relname = $1 AND c.conname = $2`,
    [tabella, vincolo],
  );
  const def = r.rows[0]?.def;
  if (!def) throw new Error(`vincolo ${vincolo} assente su sys.${tabella}`);
  // solo la prima lista ARRAY[...] o IN (...) del vincolo
  const lista = /ARRAY\[([^\]]*)\]/.exec(def)?.[1] ?? "";
  return [...lista.matchAll(/'([^']+)'/g)].map((m) => m[1]!).sort();
}

/** Impronta delle tre tabelle vere che la fotografia legge. */
async function impronteVere(): Promise<string> {
  const r = await pool.query<{ u: string; p: string; a: string }>(
    `SELECT
       (SELECT md5(string_agg(t::text, '|' ORDER BY organization_unit_id)) FROM sys.sys_organization_units t WHERE organization_unit_tenant_id = $1) AS u,
       (SELECT md5(string_agg(t::text, '|' ORDER BY position_id)) FROM sys.sys_positions t WHERE position_tenant_id = $1) AS p,
       (SELECT md5(string_agg(t::text, '|' ORDER BY user_position_assignment_id)) FROM sys.sys_user_position_assignments t WHERE user_position_assignment_tenant_id = $1) AS a`,
    [tenantId],
  );
  const x = r.rows[0]!;
  return `${x.u}|${x.p}|${x.a}`;
}

async function nuovaVersione(titolo: string): Promise<string> {
  const s = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_scenarios (scenario_tenant_id, scenario_title, scenario_question, scenario_family, scenario_domain, scenario_catalog_code, scenario_owner_user_id)
     VALUES ($1, $2, 'Che cosa succede se esce il titolare della posizione?', 'CASCATA', 'TALENTI', 'S-T2', $3) RETURNING scenario_id AS id`,
    [tenantId, titolo, ownerId],
  );
  const v = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_scenario_versions (scenario_version_scenario_id, scenario_version_tenant_id, scenario_version_number)
     VALUES ($1, $2, 1) RETURNING scenario_version_id AS id`,
    [s.rows[0]!.id, tenantId],
  );
  return v.rows[0]!.id;
}

async function opzione(versionId: string, code: string, extra: { baseline?: boolean; people?: boolean } = {}): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_scenario_options (scenario_option_version_id, scenario_option_tenant_id, scenario_option_code, scenario_option_label, scenario_option_is_baseline, scenario_option_touches_people)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING scenario_option_id AS id`,
    [versionId, tenantId, code, `Opzione ${code}`, extra.baseline ?? false, extra.people ?? false],
  );
  return r.rows[0]!.id;
}

async function risultato(versionId: string, optionId: string, valore: number, conFonte = true): Promise<void> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_scenario_results (scenario_result_option_id, scenario_result_tenant_id, scenario_result_metric_code, scenario_result_metric_label, scenario_result_value, scenario_result_unit, scenario_result_computed_by)
     VALUES ($1, $2, 'posizioni_scoperte', 'Posizioni scoperte', $3, 'posizioni', 'cascata@0.1.0') RETURNING scenario_result_id AS id`,
    [optionId, tenantId, valore],
  );
  if (conFonte) {
    await pool.query(
      `INSERT INTO sys.sys_scenario_sources (scenario_source_version_id, scenario_source_tenant_id, scenario_source_result_id, scenario_source_kind, scenario_source_ref, scenario_source_label)
       VALUES ($1, $2, $3, 'PAGINA', '/organigramma', 'Organigramma')`,
      [versionId, tenantId, r.rows[0]!.id],
    );
  }
}

const calcola = (versionId: string) =>
  pool.query(
    `UPDATE sys.sys_scenario_versions SET scenario_version_status = 'CALCOLATA', scenario_version_computed_at = now() WHERE scenario_version_id = $1`,
    [versionId],
  );

beforeAll(async () => {
  const t = await pool.query<{ tenant_id: string }>(`SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`);
  if (!t.rows[0]) throw new Error("il tenant RTL_BANK non c'è: il caso da provare non c'è");
  tenantId = t.rows[0].tenant_id;
  const u = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM sys.sys_users WHERE user_tenant_id = $1 ORDER BY user_email LIMIT 1`,
    [tenantId],
  );
  ownerId = u.rows[0]!.user_id;
});

describe("000515 — lo schema del motore degli scenari", () => {
  it("gli elenchi chiusi dello schema condiviso coincidono con i CHECK del database", async () => {
    const casi: Array<[string, string, readonly string[]]> = [
      ["sys_scenarios", "sys_scenarios_family_check", SCENARIO_FAMILY_VALUES],
      ["sys_scenarios", "sys_scenarios_domain_check", SCENARIO_DOMAIN_VALUES],
      ["sys_scenarios", "sys_scenarios_status_check", SCENARIO_STATUS_VALUES],
      ["sys_scenarios", "sys_scenarios_origin_check", SCENARIO_ORIGIN_VALUES],
      ["sys_scenario_versions", "sys_scenario_versions_status_check", SCENARIO_VERSION_STATUS_VALUES],
      ["sys_scenario_levers", "sys_scenario_levers_kind_check", SCENARIO_LEVER_KIND_VALUES],
      ["sys_scenario_levers", "sys_scenario_levers_target_type_check", SCENARIO_TARGET_TYPE_VALUES],
      ["sys_scenario_assumptions", "sys_scenario_assumptions_kind_check", SCENARIO_ASSUMPTION_KIND_VALUES],
      ["sys_scenario_sources", "sys_scenario_sources_kind_check", SCENARIO_SOURCE_KIND_VALUES],
      ["sys_scenario_equity_checks", "sys_scenario_equity_checks_trait_check", SCENARIO_EQUITY_TRAIT_VALUES],
      ["sys_scenario_equity_checks", "sys_scenario_equity_checks_outcome_check", SCENARIO_EQUITY_OUTCOME_VALUES],
      ["sys_scenario_shadow_assignments", "sys_scenario_shadow_assignments_kind_check", SHADOW_ASSIGNMENT_KIND_VALUES],
    ];
    for (const [tabella, vincolo, attesi] of casi) {
      expect(await valoriDelCheck(tabella, vincolo), `${tabella}.${vincolo}`).toEqual([...attesi].sort());
    }
  });

  it("la fotografia di RTL riempie la struttura ombra e non tocca le tabelle vere", async () => {
    const prima = await impronteVere();
    const versionId = await nuovaVersione("Fotografia di prova");
    const r = await pool.query<{ unita: number; posizioni: number; assegnazioni: number; impronta: string }>(
      `SELECT * FROM sys.sys_scenario_fotografa($1)`,
      [versionId],
    );
    const f = ScenarioSnapshotSchema.parse({
      units: r.rows[0]!.unita,
      positions: r.rows[0]!.posizioni,
      assignments: r.rows[0]!.assegnazioni,
      digest: r.rows[0]!.impronta,
    });
    // le righe ombra sono quante le righe vere attive oggi
    const attese = await pool.query<{ u: number; p: number }>(
      `SELECT (SELECT count(*)::int FROM sys.sys_organization_units WHERE organization_unit_tenant_id = $1 AND organization_unit_is_active
                 AND organization_unit_effective_from <= current_date AND (organization_unit_effective_to IS NULL OR organization_unit_effective_to >= current_date)) AS u,
              (SELECT count(*)::int FROM sys.sys_positions WHERE position_tenant_id = $1 AND position_is_active
                 AND position_effective_from <= current_date AND (position_effective_to IS NULL OR position_effective_to >= current_date)) AS p`,
      [tenantId],
    );
    expect(f.units).toBe(attese.rows[0]!.u);
    expect(f.positions).toBe(attese.rows[0]!.p);
    expect(f.units).toBeGreaterThan(0);
    expect(f.assignments).toBeGreaterThan(0);
    const v = await pool.query<{ d: string }>(
      `SELECT scenario_version_baseline_digest AS d FROM sys.sys_scenario_versions WHERE scenario_version_id = $1`,
      [versionId],
    );
    expect(v.rows[0]!.d).toBe(f.digest);
    // post-condizione: nessuna scrittura sulle tabelle vere
    expect(await impronteVere()).toBe(prima);
    // una seconda fotografia della stessa versione è rifiutata
    await expect(pool.query(`SELECT * FROM sys.sys_scenario_fotografa($1)`, [versionId])).rejects.toThrow(/già la sua fotografia/);
  });

  it("le guardie: due opzioni, fonti, equità dichiarata, poi la versione è congelata", async () => {
    const versionId = await nuovaVersione("Guardie di prova");
    await pool.query(`SELECT * FROM sys.sys_scenario_fotografa($1)`, [versionId]);
    const a = await opzione(versionId, "A", { baseline: true });
    await risultato(versionId, a, 1);
    await expect(calcola(versionId)).rejects.toThrow(/almeno due/);

    const b = await opzione(versionId, "B", { people: true });
    await risultato(versionId, b, 0, false);
    await expect(calcola(versionId)).rejects.toThrow(/senza fonte cliccabile/);
    await pool.query(
      `INSERT INTO sys.sys_scenario_sources (scenario_source_version_id, scenario_source_tenant_id, scenario_source_result_id, scenario_source_kind, scenario_source_ref, scenario_source_label)
       SELECT $1, $2, scenario_result_id, 'DATO', '/v1/positions', 'Posizioni' FROM sys.sys_scenario_results WHERE scenario_result_option_id = $3`,
      [versionId, tenantId, b],
    );
    await expect(calcola(versionId)).rejects.toThrow(/controllo di equità/);

    // un numero senza calcolatore non entra (D5)
    await expect(
      pool.query(
        `INSERT INTO sys.sys_scenario_results (scenario_result_option_id, scenario_result_tenant_id, scenario_result_metric_code, scenario_result_metric_label, scenario_result_value, scenario_result_unit, scenario_result_computed_by)
         VALUES ($1, $2, 'costo', 'Costo', 10, 'euro', 'il modello')`,
        [b, tenantId],
      ),
    ).rejects.toThrow(/computed_by_check/);

    await pool.query(
      `INSERT INTO sys.sys_scenario_equity_checks (scenario_equity_check_option_id, scenario_equity_check_tenant_id, scenario_equity_check_trait, scenario_equity_check_groups, scenario_equity_check_ratio, scenario_equity_check_threshold, scenario_equity_check_outcome, scenario_equity_check_method)
       VALUES ($1, $2, 'GENERE', 'donne e uomini fra i successori proposti', 0.6, 0.8, 'NON_SUPERATO', 'quattro-quinti@0.1.0')`,
      [b, tenantId],
    );
    // E12: non si raccomanda con l'equità non superata
    await expect(
      pool.query(`UPDATE sys.sys_scenario_options SET scenario_option_recommended = true WHERE scenario_option_id = $1`, [b]),
    ).rejects.toThrow(/SUPERATI/);

    await calcola(versionId);
    // G1: congelata
    await expect(
      pool.query(`UPDATE sys.sys_scenario_results SET scenario_result_value = 99 WHERE scenario_result_option_id = $1`, [b]),
    ).rejects.toThrow(/non si modifica/);
    await expect(
      pool.query(`UPDATE sys.sys_scenario_versions SET scenario_version_notes = 'ritocco' WHERE scenario_version_id = $1`, [versionId]),
    ).rejects.toThrow(/ARCHIVIATA/);
    await pool.query(`UPDATE sys.sys_scenario_versions SET scenario_version_status = 'ARCHIVIATA' WHERE scenario_version_id = $1`, [versionId]);
    const s = await pool.query<{ s: string }>(`SELECT scenario_version_status AS s FROM sys.sys_scenario_versions WHERE scenario_version_id = $1`, [versionId]);
    expect(s.rows[0]!.s).toBe("ARCHIVIATA");
  });

  it("una riga di un altro tenant non entra in una versione (I5)", async () => {
    const versionId = await nuovaVersione("Confine di prova");
    const altro = await pool.query<{ tenant_id: string }>(`SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_id <> $1 LIMIT 1`, [tenantId]);
    const a = await opzione(versionId, "A");
    await expect(
      pool.query(
        `INSERT INTO sys.sys_scenario_levers (scenario_lever_option_id, scenario_lever_tenant_id, scenario_lever_kind, scenario_lever_target_type)
         VALUES ($1, $2, 'BUDGET_FORMAZIONE', 'TENANT')`,
        [a, altro.rows[0]!.tenant_id],
      ),
    ).rejects.toMatchObject({ code: "23503", constraint: "sys_scenario_levers_option_fk" }); // la lingua del messaggio dipende dal server
  });
});
