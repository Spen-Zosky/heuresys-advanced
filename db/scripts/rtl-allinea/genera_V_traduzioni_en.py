#!/usr/bin/env python3
"""Genera V_traduzioni_en.sql: traduzioni inglesi (sys_reference_translations) delle righe create da R, Q, D1 (copertura EN, migrazione 000255).
Le traduzioni vengono dalla corsa p20261010010521tjb (passo «traduzioni» del datastore, 2.239 testi); i pochi testi che la corsa non ha sono qui, a mano.
Uso: python3 genera_V_traduzioni_en.py <corsa.json> > V_traduzioni_en.sql"""
import json, sys
TEN = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0"
MANUALI = {
 "Tasso di recupero (reverse ratio) dei crediti deteriorati": "Recovery rate (reverse ratio) on non-performing loans",
 "Riduzione dello stock di NPL rispetto all'anno precedente": "Reduction of the NPL stock compared with the previous year",
 "Liquidity Coverage Ratio (LCR)": "Liquidity Coverage Ratio (LCR)",
 "Numero di sforamenti non autorizzati dei limiti di rischio finanziario/liquidità": "Number of unauthorised breaches of financial and liquidity risk limits",
 "Tempo di determinazione della posizione di liquidità giornaliera (daily cash position)": "Time to determine the daily liquidity position (daily cash position)",
 "Percentuale di giorni con posizione di liquidità determinata entro l'orario operativo": "Percentage of days with the liquidity position determined within operating hours",
 "Superamenti non autorizzati dei limiti di rischio (VaR e posizione)": "Unauthorised breaches of risk limits (VaR and position)",
 "Percentuale di utilizzo del limite VaR assegnato": "Utilisation of the assigned VaR limit (%)",
 "Numero di valute estere coinvolte nel programma di hedging per miliardo di $ di ricavi": "Number of foreign currencies in the hedging programme per billion dollars of revenue",
 "Sforamenti dei limiti di rischio operativo segnalati tempestivamente alla Direzione": "Operational risk limit breaches reported promptly to Senior Management",
 "Tempestività della riconciliazione front office/back office": "Timeliness of front office / back office reconciliation",
 "Tasso di settlement fails su operazioni in titoli regolate T+2": "Settlement fail rate on securities transactions settled T+2",
 "Discrepanze irrisolte nei conti titoli a fine giornata": "Unresolved discrepancies in securities accounts at end of day",
 "Tempestività della reportistica giornaliera del VaR alla Direzione": "Timeliness of daily VaR reporting to Senior Management",
 "VaR del portafoglio a 1 giorno (intervallo di confidenza 99%)": "1-day portfolio VaR (99% confidence level)",
 "Esecuzione degli stress test periodici secondo il calendario definito": "Execution of periodic stress tests according to the defined calendar",
 "Tempestività di presentazione del piano strategico HR annuale al vertice": "Timeliness of presenting the annual HR strategic plan to the top management",
}
def q(v): return "'" + str(v).replace("'", "''") + "'"
with open(sys.argv[1], encoding="utf-8") as f:
    c = json.load(f)["passi"]
t = {k: v["en"] for k, v in c["traduzioni"]["esito"]["testi"].items()}
t.update(MANUALI)
met = c["metriche"]["esito"]["metriche"]; obi = {o["id"]: o for o in c["obiettivi"]["esito"]["obiettivi"]}; pesi = c["derivati"]["esito"]["pesiObiettivi"]
rows = []  # (tabella, chiave, campo, en, fonte)
for m in met:
    en = t.get(m["nome"])
    if not en: raise SystemExit("manca la traduzione di " + m["nome"])
    src = "MANUAL" if m["nome"] in MANUALI else "LLM"
    rows.append(("kpi", "TJB-" + m["id"], "name", en, src)); rows.append(("kpi", "TJB-" + m["id"], "description", en, src))
for p in pesi:
    o = obi.get(p["obiettivo"]);
    if not o: continue
    en = t.get(o["testo"])
    if not en: raise SystemExit("manca la traduzione dell'obiettivo " + o["id"])
    k = f"GOAL_TEMPLATE::{TEN}::TJB::{p['ruolo']}::{o['id']}"
    rows.append(("goal", k, "name", en[:250], "LLM")); rows.append(("goal", k, "description", en, "LLM"))
rows += [("skill", "gestione del rischio", "name", "risk management", "MANUAL")]
out = ["-- Traduzioni inglesi delle righe create dall'allineamento RTL (copertura EN, 000255). GENERATO da genera_V_traduzioni_en.py. Idempotente.",
       "\\set ON_ERROR_STOP on", "BEGIN;",
       "CREATE TEMP TABLE tr(k text, chiave text, campo text, en text, fonte text) ON COMMIT DROP;",
       "INSERT INTO tr VALUES"]
out.append(",\n".join(f"({q(a)},{q(b)},{q(c_)},{q(d)},{q(e)})" for a, b, c_, d, e in rows) + ";")
out += ["INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)",
 "SELECT 'sys_kpi_definitions', d.kpi_definition_id, tr.campo, 'en', tr.en, tr.fonte FROM tr JOIN sys.sys_kpi_definitions d ON tr.k='kpi' AND d.kpi_definition_code=tr.chiave AND d.kpi_definition_tenant_id='" + TEN + "' ON CONFLICT DO NOTHING;",
 "INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)",
 "SELECT 'sys_goal_templates', g.template_id, tr.campo, 'en', tr.en, tr.fonte FROM tr JOIN sys.sys_goal_templates g ON tr.k='goal' AND g.template_natural_key=tr.chiave ON CONFLICT DO NOTHING;",
 "INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)",
 "SELECT 'sys_skills', s.skill_id, tr.campo, 'en', tr.en, tr.fonte FROM tr JOIN sys.sys_skills s ON tr.k='skill' AND s.skill_name=tr.chiave ON CONFLICT DO NOTHING;",
 "COMMIT;",
 "SELECT 'V ok' esito, (SELECT coalesce(sum(missing),0) FROM sys.v_reference_translation_coverage) mancanti;"]
print("\n".join(out))
