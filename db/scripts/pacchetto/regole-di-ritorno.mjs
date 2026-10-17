// Le regole del contratto v0.3 che MARCANO senza rifiutare (V3-01, V3-03, V3-06): la lettura di ritorno le conta sulle righe e le riporta, senza fermarsi.
// Non cambia l'esito di `rileggi`: un pacchetto con regole marcate e' un pacchetto, e chi lo riceve vede che cosa manca e dove (come nel datastore).
//   q(sql, params) -> righe; versionId = la versione di variante caricata.
export const MASSIMO_PRIORITA = 5; // al piu' cinque priorita' (strategia.priorita) e al piu' cinque obiettivi d'impresa (R24, V3-01)

export async function regoleMarcano(q, versionId) {
  const N = async (sql) => Number((await q(sql, [versionId]))[0].n);
  const priorita = await N("SELECT count(*) n FROM sys.sys_blueprint_content_strategy_items WHERE blueprint_content_strategy_item_version_id = $1 AND blueprint_content_strategy_item_kind = 'PRIORITA'");
  const impresa = await N("SELECT count(*) n FROM sys.sys_blueprint_content_goals WHERE blueprint_content_goal_version_id = $1 AND blueprint_content_goal_level = 'IMPRESA'");
  // un solo DECIDE per decisione
  const dec = await q(`SELECT d.blueprint_content_decision_code AS code, count(r.blueprint_content_decision_right_id) FILTER (WHERE r.blueprint_content_decision_right_right = 'DECIDE') AS decide
    FROM sys.sys_blueprint_content_decisions d LEFT JOIN sys.sys_blueprint_content_decision_rights r ON r.blueprint_content_decision_right_version_id = d.blueprint_content_decision_version_id AND r.blueprint_content_decision_right_decision_code = d.blueprint_content_decision_code
    WHERE d.blueprint_content_decision_version_id = $1 GROUP BY d.blueprint_content_decision_code`, [versionId]);
  const senza = dec.filter((d) => Number(d.decide) === 0).length;
  const piu = dec.filter((d) => Number(d.decide) > 1).length;
  // ore per posizione: la somma delle ore settimanali sui processi contro le ore settimanali del contratto del suo livello (stessa regola di V3-06)
  const pos = await q(`SELECT p.blueprint_content_position_code AS code, p.blueprint_content_position_ccnl_level_code AS livello, p.blueprint_content_position_ccnl_code AS ccnl, sum(pp.blueprint_content_position_process_weekly_hours) AS somma
    FROM sys.sys_blueprint_content_positions p JOIN sys.sys_blueprint_content_position_processes pp ON pp.blueprint_content_position_process_version_id = p.blueprint_content_position_version_id AND pp.blueprint_content_position_process_position_code = p.blueprint_content_position_code
    WHERE p.blueprint_content_position_version_id = $1 AND pp.blueprint_content_position_process_weekly_hours IS NOT NULL GROUP BY 1, 2, 3`, [versionId]);
  const liv = await q("SELECT blueprint_content_ccnl_level_ccnl_code AS ccnl, blueprint_content_ccnl_level_code AS code FROM sys.sys_blueprint_content_ccnl_levels WHERE blueprint_content_ccnl_level_version_id = $1 ORDER BY 1", [versionId]);
  const ist = await q("SELECT blueprint_content_ccnl_institute_ccnl_code AS ccnl, blueprint_content_ccnl_institute_value AS valore FROM sys.sys_blueprint_content_ccnl_institutes WHERE blueprint_content_ccnl_institute_version_id = $1 AND blueprint_content_ccnl_institute_kind = 'ORE_SETTIMANALI' AND blueprint_content_ccnl_institute_value IS NOT NULL ORDER BY blueprint_content_ccnl_institute_ccnl_code, blueprint_content_ccnl_institute_ordinal", [versionId]);
  let oltre = 0, indecidibili = 0, fragili = 0;
  for (const x of pos) {
    const cand = [...new Set(liv.filter((l) => x.livello !== null && l.code === x.livello && (x.ccnl === null || l.ccnl === x.ccnl)).map((l) => l.ccnl))];
    const tetto = cand.length ? (ist.find((i) => i.ccnl === cand[0])?.valore ?? null) : null;
    if (cand.length > 1 && x.ccnl === null) fragili++;
    if (tetto === null) indecidibili++; else if (Number(x.somma) > Number(tetto)) oltre++;
  }
  const r = {
    priorita: { voci: priorita, massimo: MASSIMO_PRIORITA, oltre_il_massimo: Math.max(0, priorita - MASSIMO_PRIORITA) },
    obiettivi_d_impresa: { voci: impresa, massimo: MASSIMO_PRIORITA, oltre_il_massimo: Math.max(0, impresa - MASSIMO_PRIORITA) },
    decisioni: { controllate: dec.length, senza_decide: senza, con_piu_di_un_decide: piu },
    ore_per_posizione: { controllate: pos.length, oltre_il_contratto: oltre, non_decidibili: indecidibili, fragili },
  };
  r.marcate = r.priorita.oltre_il_massimo + r.obiettivi_d_impresa.oltre_il_massimo + senza + piu + oltre;
  return r;
}
