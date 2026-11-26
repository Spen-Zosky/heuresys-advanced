import { describe, it, expect, beforeAll } from "vitest";
import { pool } from "../src/db/client.js";
import { calcolaScenarioUscite, METODO_EQUITA_PROVVISORIO } from "../src/modules/scenari/service.js";
import { CALCOLATORE_SUCCESSIONE, PROFONDITA_CASCATA } from "../src/modules/scenari/calcolatori/successione.js";

/**
 * F3b-1 del piano Heuresys AI-driven (ADR-0063 D5): lo scenario di uscita calcolato su RTL.
 *
 * Sceglie dai dati di RTL una persona titolare PRIMARY di una posizione che ha una tavola di
 * successione attiva con un candidato pronto, a sua volta titolare di una posizione: è il caso in
 * cui effetto diretto e cascata si separano. Poi verifica che:
 *   1. la versione è CALCOLATA con le opzioni attese e i risultati del calcolatore, ognuno con le fonti;
 *   2. le tabelle vere (unità, posizioni, assegnazioni, tavole di successione) non cambiano;
 *   3. chi sposta persone dichiara l'equità come non ancora calcolata e nessuna opzione è raccomandata;
 *   4. la struttura ombra dell'opzione chiude l'assegnazione di chi esce e apre quella di chi copre;
 *   5. una persona di un altro tenant è rifiutata.
 * Il file gira in una transazione annullata alla fine (tx-isolation): nessun residuo.
 */

let tenantId = "";
let uscente = "";
let successore = "";

async function impronteVere(): Promise<string> {
  const r = await pool.query<{ x: string }>(
    `SELECT concat_ws('|',
       (SELECT md5(string_agg(t::text, '|' ORDER BY organization_unit_id)) FROM sys.sys_organization_units t WHERE organization_unit_tenant_id = $1),
       (SELECT md5(string_agg(t::text, '|' ORDER BY position_id)) FROM sys.sys_positions t WHERE position_tenant_id = $1),
       (SELECT md5(string_agg(t::text, '|' ORDER BY user_position_assignment_id)) FROM sys.sys_user_position_assignments t WHERE user_position_assignment_tenant_id = $1),
       (SELECT md5(string_agg(t::text, '|' ORDER BY succession_pool_id)) FROM sys.sys_succession_pools t WHERE succession_pool_tenant_id = $1),
       (SELECT md5(string_agg(t::text, '|' ORDER BY successor_candidate_id)) FROM sys.sys_successor_candidates t WHERE successor_candidate_tenant_id = $1)) AS x`,
    [tenantId],
  );
  return r.rows[0]!.x;
}

async function risultati(optionId: string): Promise<Record<string, number>> {
  const r = await pool.query<{ code: string; value: string; by: string; fonti: number }>(
    `SELECT r.scenario_result_metric_code AS code, r.scenario_result_value AS value, r.scenario_result_computed_by AS by,
            (SELECT count(*)::int FROM sys.sys_scenario_sources s WHERE s.scenario_source_result_id = r.scenario_result_id) AS fonti
       FROM sys.sys_scenario_results r WHERE r.scenario_result_option_id = $1`,
    [optionId],
  );
  for (const x of r.rows) {
    expect(x.by).toBe(CALCOLATORE_SUCCESSIONE);
    expect(x.fonti, `fonti di ${x.code}`).toBeGreaterThan(0);
  }
  return Object.fromEntries(r.rows.map((x) => [x.code, Number(x.value)]));
}

beforeAll(async () => {
  const t = await pool.query<{ tenant_id: string }>(`SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`);
  if (!t.rows[0]) throw new Error("il tenant RTL_BANK non c'è: il caso da provare non c'è");
  tenantId = t.rows[0].tenant_id;
  // il titolare di una posizione con un successore pronto che è a sua volta titolare di una posizione
  const c = await pool.query<{ uscente: string; successore: string }>(
    `SELECT a.user_position_assignment_user_id AS uscente, sc.successor_candidate_user_id AS successore
       FROM sys.sys_user_position_assignments a
       JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id AND p.position_is_active
       JOIN sys.sys_succession_pools sp ON sp.succession_pool_position_id = p.position_id AND sp.succession_pool_status = 'ACTIVE'
       JOIN sys.sys_successor_candidates sc ON sc.successor_candidate_pool_id = sp.succession_pool_id
        AND sc.successor_candidate_status IN ('CANDIDATE', 'CONFIRMED')
        AND sc.successor_candidate_readiness_level IN ('READY_NOW', 'READY_6_MONTHS', 'READY_1_YEAR', 'READY_2_YEARS')
       JOIN sys.sys_user_position_assignments b ON b.user_position_assignment_user_id = sc.successor_candidate_user_id
        AND b.user_position_assignment_kind = 'PRIMARY' AND b.user_position_assignment_status = 'ACTIVE'
        AND b.user_position_assignment_start_date <= current_date
        AND (b.user_position_assignment_end_date IS NULL OR b.user_position_assignment_end_date >= current_date)
      WHERE a.user_position_assignment_tenant_id = $1 AND a.user_position_assignment_kind = 'PRIMARY'
        AND a.user_position_assignment_status = 'ACTIVE' AND a.user_position_assignment_start_date <= current_date
        AND (a.user_position_assignment_end_date IS NULL OR a.user_position_assignment_end_date >= current_date)
        AND sc.successor_candidate_user_id <> a.user_position_assignment_user_id
        AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments o
                         WHERE o.user_position_assignment_position_id = p.position_id
                           AND o.user_position_assignment_user_id <> a.user_position_assignment_user_id
                           AND o.user_position_assignment_kind = 'PRIMARY' AND o.user_position_assignment_status = 'ACTIVE')
      ORDER BY p.position_code, sc.successor_candidate_user_id
      LIMIT 1`,
    [tenantId],
  );
  if (!c.rows[0]) throw new Error("in RTL non c'è una posizione con un successore pronto che sia titolare: il caso da provare non c'è");
  uscente = c.rows[0].uscente;
  successore = c.rows[0].successore;
});

describe("F3b-1 — lo scenario di uscita calcolato su RTL", () => {
  it("cascata (S-T2): tre opzioni calcolate, tabelle vere intatte, equità dichiarata", async () => {
    const prima = await impronteVere();
    const s = await calcolaScenarioUscite({ tenantId, actorUserId: null, userIds: [uscente], family: "CASCATA" });
    expect(await impronteVere()).toBe(prima);

    const v = await pool.query<{ status: string; digest: string | null; catalog: string; family: string }>(
      `SELECT v.scenario_version_status AS status, v.scenario_version_baseline_digest AS digest,
              sc.scenario_catalog_code AS catalog, sc.scenario_family AS family
         FROM sys.sys_scenario_versions v JOIN sys.sys_scenarios sc ON sc.scenario_id = v.scenario_version_scenario_id
        WHERE v.scenario_version_id = $1`,
      [s.versionId],
    );
    expect(v.rows[0]).toMatchObject({ status: "CALCOLATA", catalog: "S-T2", family: "CASCATA" });
    expect(v.rows[0]!.digest?.trim()).toBe(s.fotografia.digest);
    expect(s.opzioni.map((o) => [o.code, o.profondita])).toEqual([["A", 0], ["B", 1], ["C", PROFONDITA_CASCATA]]);

    const [a, b, c] = s.opzioni;
    const ra = await risultati(a!.optionId);
    const rb = await risultati(b!.optionId);
    const rc = await risultati(c!.optionId);
    // A: nessuno copre, tutto ciò che si libera resta scoperto
    expect(ra.posizioni_liberate).toBeGreaterThan(0);
    expect(ra.posizioni_coperte).toBe(0);
    expect(ra.posizioni_scoperte).toBe(ra.posizioni_liberate);
    expect(ra.mesi_alla_copertura).toBeUndefined();
    // B: il successore pronto copre; la sua posizione resta scoperta
    expect(rb.posizioni_coperte).toBeGreaterThan(0);
    expect(rb.persone_spostate).toBe(rb.posizioni_coperte);
    expect(rb.lunghezza_catena).toBe(1);
    // C: la cascata non lascia più scoperto di B e non si ferma prima
    expect(rc.posizioni_coperte).toBeGreaterThanOrEqual(rb.posizioni_coperte!);
    expect(rc.lunghezza_catena).toBeGreaterThanOrEqual(1);
    // i numeri salvati sono quelli dell'esito del calcolatore
    expect(rc.posizioni_scoperte).toBe(c!.esito.scoperte.length);
    expect(rc.persone_spostate).toBe(c!.esito.spostati.length);

    const eq = await pool.query<{ code: string; outcome: string; method: string; recommended: boolean; touches: boolean }>(
      `SELECT o.scenario_option_code AS code, e.scenario_equity_check_outcome AS outcome, e.scenario_equity_check_method AS method,
              o.scenario_option_recommended AS recommended, o.scenario_option_touches_people AS touches
         FROM sys.sys_scenario_options o
         LEFT JOIN sys.sys_scenario_equity_checks e ON e.scenario_equity_check_option_id = o.scenario_option_id
        WHERE o.scenario_option_version_id = $1 ORDER BY o.scenario_option_code`,
      [s.versionId],
    );
    expect(eq.rows.map((x) => [x.code, x.touches, x.outcome])).toEqual([
      ["A", false, null],
      ["B", true, "DATI_INSUFFICIENTI"],
      ["C", true, "DATI_INSUFFICIENTI"],
    ]);
    expect(eq.rows.every((x) => !x.recommended)).toBe(true);
    expect(eq.rows.filter((x) => x.method).every((x) => x.method === METODO_EQUITA_PROVVISORIO)).toBe(true);

    // la struttura ombra di B: chiusa l'assegnazione di chi esce, nuova quella di chi copre
    const ombra = await pool.query<{ user_id: string; change: string }>(
      `SELECT shadow_assignment_user_id AS user_id, shadow_assignment_change AS change
         FROM sys.sys_scenario_shadow_assignments WHERE shadow_assignment_option_id = $1`,
      [b!.optionId],
    );
    expect(ombra.rows).toContainEqual({ user_id: uscente, change: "CHIUSA" });
    expect(ombra.rows.filter((x) => x.change === "NUOVA")).toHaveLength(rb.posizioni_coperte!);
    expect(b!.esito.spostati).toContain(successore);

    // G1: la versione calcolata è congelata
    await expect(
      pool.query(`UPDATE sys.sys_scenario_results SET scenario_result_value = 99 WHERE scenario_result_option_id = $1`, [b!.optionId]),
    ).rejects.toThrow(/non si modifica/);
  });

  it("effetto diretto (S-T1): due opzioni", async () => {
    const s = await calcolaScenarioUscite({ tenantId, actorUserId: null, userIds: [uscente], family: "EFFETTO_DIRETTO" });
    expect(s.opzioni.map((o) => o.code)).toEqual(["A", "B"]);
    const cat = await pool.query<{ c: string }>(`SELECT scenario_catalog_code AS c FROM sys.sys_scenarios WHERE scenario_id = $1`, [s.scenarioId]);
    expect(cat.rows[0]!.c).toBe("S-T1");
  });

  it("rifiuta una persona di un altro tenant e un elenco vuoto", async () => {
    const altro = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE user_tenant_id IS DISTINCT FROM $1 LIMIT 1`,
      [tenantId],
    );
    await expect(
      calcolaScenarioUscite({ tenantId, actorUserId: null, userIds: [altro.rows[0]!.user_id], family: "CASCATA" }),
    ).rejects.toMatchObject({ code: "SCENARIO_PEOPLE_NOT_IN_TENANT" });
    await expect(calcolaScenarioUscite({ tenantId, actorUserId: null, userIds: [], family: "CASCATA" })).rejects.toMatchObject({
      code: "SCENARIO_NO_EXITS",
    });
  });
});
