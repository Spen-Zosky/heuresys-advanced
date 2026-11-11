#!/usr/bin/env python3
"""Genera R_formazione_obiettivi.sql: formazione, obiettivi e metriche della corsa p20261010010521tjb applicati a RTL (voce 4 del coordinatore, 2026-11-11).
Legge corsa.json dell'estratto CONFRONTO_TJB_RTL_20261110 (datastore, sola lettura). Lo SQL generato contiene i dati ed e' idempotente (codici e chiavi naturali).
Uso: python3 genera_R_corsa.py <corsa.json> > R_formazione_obiettivi.sql
"""
import json
import sys

TEN = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0"
UNITA = {"days": "giorni", "day": "giorni", "calls": "chiamate", "contacts": "contatti", "dollari": "dollari USD", "DWE": "equivalenti a tempo pieno", "N": "numero"}
KIND = {"CORSO": "COURSE", "CERTIFICAZIONE": "CERTIFICATION_PREP", "AFFIANCAMENTO": "COACHING"}
DELIVERY = {"IN_AULA": "INSTRUCTOR_LED", "ONLINE": "SELF_PACED", "SUL_CAMPO": "ON_THE_JOB"}
POLARITA = {"AUMENTARE": "HIGHER_IS_BETTER", "RIDURRE": "LOWER_IS_BETTER", "MANTENERE": "TARGET_RANGE"}
CATEGORIA = {"CONFORMITA": "conformità", "COSTO": "costi", "CRESCITA": "crescita", "EFFICIENZA": "efficienza", "QUALITA": "qualità", "SERVIZIO": "servizio"}
DIFF = {"CRESCITA": "STRETCH", "COSTO": "HARD", "CONFORMITA": "MEDIUM", "EFFICIENZA": "MEDIUM", "QUALITA": "MEDIUM", "SERVIZIO": "MEDIUM"}


def q(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def main(path):
    c = json.load(open(path, encoding="utf-8"))["passi"]
    form = c["formazione"]["esito"]["moduli"]
    obi = {o["id"]: o for o in c["obiettivi"]["esito"]["obiettivi"]}
    pesi = c["derivati"]["esito"]["pesiObiettivi"]
    met = c["metriche"]["esito"]["metriche"]
    ber = c["bersagli"]["esito"]["bersagli"]
    out = []
    w = out.append
    w("-- Formazione, obiettivi e metriche della corsa p20261010010521tjb applicati a RTL (voce 4 del coordinatore, 2026-11-11). GENERATO da genera_R_corsa.py.")
    w("-- Moduli formativi del tenant, modelli di obiettivo per ruolo (solo ruoli con un posto RTL abbinato), indicatori con definizione di metrica e traguardi per posto.")
    w("-- Idempotente (codici e chiavi naturali). Giornale: staging.rtl_allinea_org_undo (righe inserite come 'ins:<tabella>').")
    w("\\set ON_ERROR_STOP on\nBEGIN;")
    w("CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));")
    # posto RTL rappresentante per codice della corsa
    w("CREATE TEMP TABLE rap ON COMMIT DROP AS SELECT DISTINCT ON (pc.codice) pc.codice, a.user_position_assignment_position_id pos, p.position_job_role_id ruolo")
    w(f"FROM staging.rtl_persona_corsa pc JOIN sys.sys_users u ON u.user_tenant_id='{TEN}' AND u.user_last_name||', '||u.user_first_name=pc.persona")
    w("JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_user_id=u.user_id AND a.user_position_assignment_status='ACTIVE' AND a.user_position_assignment_kind='PRIMARY'")
    w("JOIN sys.sys_positions p ON p.position_id=a.user_position_assignment_position_id ORDER BY pc.codice, a.user_position_assignment_position_id;")
    # --- formazione
    w("INSERT INTO sys.sys_learning_modules (learning_module_id, learning_module_tenant_id, learning_module_code, learning_module_title, learning_module_description, learning_module_kind, learning_module_delivery, learning_module_duration_minutes, learning_module_is_global, learning_module_metadata)")
    w("SELECT gen_random_uuid(), '" + TEN + "', v.cod, v.titolo, v.titolo, v.kind, v.delivery, v.durata, false, v.meta::jsonb FROM (VALUES")
    righe = []
    for m in form:
        meta = json.dumps({"corsa": "p20261010010521tjb", "obbligo": m.get("obbligoCodice"), "posti_corsa": m.get("posizioniCodici", []), "allinea": "R"}, ensure_ascii=False)
        righe.append(f"({q('TJB-' + m['codice'])},{q(m['titolo'])},{q(KIND.get(m['tipo'], 'COURSE'))},{q(DELIVERY.get(m['modalita'], 'SELF_PACED'))},{m['durataMinuti'] if m.get('durataMinuti') else 'NULL'}::int,{q(meta)})")
    w(",\n".join(righe))
    w(") v(cod,titolo,kind,delivery,durata,meta) WHERE NOT EXISTS (SELECT 1 FROM sys.sys_learning_modules x WHERE x.learning_module_code=v.cod AND x.learning_module_tenant_id='" + TEN + "');")
    w("INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_learning_modules', learning_module_id, '{}'::jsonb FROM sys.sys_learning_modules WHERE learning_module_metadata->>'allinea'='R' ON CONFLICT DO NOTHING;")
    # --- modelli di obiettivo per ruolo
    w("CREATE TEMP TABLE ob(ruolo_corsa text, id text, testo text, tipo text, orizzonte text, peso numeric) ON COMMIT DROP;")
    righe = []
    for p in pesi:
        o = obi.get(p["obiettivo"])
        if not o:
            continue
        righe.append(f"({q(p['ruolo'])},{q(o['id'])},{q(o['testo'])},{q(o['tipo'])},{q(o.get('orizzonte'))},{p['peso']})")
    w("INSERT INTO ob VALUES\n" + ",\n".join(righe) + ";")
    w("INSERT INTO sys.sys_goal_templates (template_id, template_tenant_id, template_role_id, template_natural_key, template_name, template_description, template_category, template_goal_type, template_suggested_duration_days, template_suggested_weight, template_difficulty_level, template_is_company_wide, template_is_active, template_metadata)")
    w("SELECT gen_random_uuid(), '" + TEN + "', r.ruolo, 'GOAL_TEMPLATE::" + TEN + "::TJB::'||o.ruolo_corsa||'::'||o.id, left(o.testo,250), o.testo,")
    cat = "CASE o.tipo " + " ".join(f"WHEN {q(k)} THEN {q(v)}" for k, v in CATEGORIA.items()) + " ELSE NULL END"
    dif = "CASE o.tipo " + " ".join(f"WHEN {q(k)} THEN {q(v)}" for k, v in DIFF.items()) + " ELSE 'MEDIUM' END"
    w(f"  {cat}, 'OBJECTIVE', 365, o.peso, {dif}, false, true, jsonb_build_object('corsa','p20261010010521tjb','ruolo_corsa',o.ruolo_corsa,'obiettivo',o.id,'allinea','R')")
    w("FROM ob o JOIN rap r ON r.codice=o.ruolo_corsa WHERE NOT EXISTS (SELECT 1 FROM sys.sys_goal_templates g WHERE g.template_natural_key='GOAL_TEMPLATE::" + TEN + "::TJB::'||o.ruolo_corsa||'::'||o.id);")
    w("INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_goal_templates', template_id, '{}'::jsonb FROM sys.sys_goal_templates WHERE template_metadata->>'allinea'='R' ON CONFLICT DO NOTHING;")
    # --- indicatori
    w("CREATE TEMP TABLE mt(id text, nome text, unita text, formula text, direzione text, obiettivo text) ON COMMIT DROP;")
    righe = []
    for m in met:
        u = m.get("unita")
        u = UNITA.get(u, u)
        righe.append(f"({q(m['id'])},{q(m['nome'])},{q(u)},{q(m.get('formula'))},{q(m.get('direzione'))},{q(m.get('obiettivo'))})")
    w("INSERT INTO mt VALUES\n" + ",\n".join(righe) + ";")
    pol = "CASE m.direzione " + " ".join(f"WHEN {q(k)} THEN {q(v)}" for k, v in POLARITA.items()) + " ELSE 'TARGET_RANGE' END"
    w("INSERT INTO sys.sys_kpi_definitions (kpi_definition_id, kpi_definition_tenant_id, kpi_definition_code, kpi_definition_name, kpi_definition_description, kpi_definition_formula, kpi_definition_unit, kpi_definition_polarity, kpi_definition_is_global, kpi_definition_metadata)")
    w(f"SELECT gen_random_uuid(), '{TEN}', 'TJB-'||m.id, left(m.nome,250), m.nome, m.formula, m.unita, {pol}, false, jsonb_build_object('corsa','p20261010010521tjb','obiettivo',m.obiettivo,'allinea','R')")
    w(f"FROM mt m WHERE NOT EXISTS (SELECT 1 FROM sys.sys_kpi_definitions k WHERE k.kpi_definition_code='TJB-'||m.id AND k.kpi_definition_tenant_id='{TEN}');")
    w("INSERT INTO sys.sys_kpi_metric_definitions (kpi_metric_definition_id, kpi_metric_definition_kpi_id, kpi_metric_definition_code, kpi_metric_definition_name, kpi_metric_definition_unit, kpi_metric_definition_aggregation, kpi_metric_definition_metadata)")
    w(f"SELECT gen_random_uuid(), k.kpi_definition_id, 'TJB-'||m.id||'-M', left(m.nome,250), m.unita, 'CUSTOM', '{{\"allinea\":\"R\"}}'::jsonb FROM mt m JOIN sys.sys_kpi_definitions k ON k.kpi_definition_code='TJB-'||m.id AND k.kpi_definition_tenant_id='{TEN}'")
    w("WHERE NOT EXISTS (SELECT 1 FROM sys.sys_kpi_metric_definitions d WHERE d.kpi_metric_definition_code='TJB-'||m.id||'-M');")
    w("INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_kpi_definitions', kpi_definition_id, '{}'::jsonb FROM sys.sys_kpi_definitions WHERE kpi_definition_metadata->>'allinea'='R' ON CONFLICT DO NOTHING;")
    w("INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_kpi_metric_definitions', kpi_metric_definition_id, '{}'::jsonb FROM sys.sys_kpi_metric_definitions WHERE kpi_metric_definition_metadata->>'allinea'='R' ON CONFLICT DO NOTHING;")
    # --- traguardi per posto (solo bersagli con un valore numerico, sui posti RTL dei ruoli che pesano quell'obiettivo)
    w("CREATE TEMP TABLE bs(metrica text, minimo numeric, massimo numeric, obiettivo numeric) ON COMMIT DROP;")
    righe = [f"({q(b['metrica'])},{b['minimo'] if b['minimo'] is not None else 'NULL'},{b['massimo'] if b['massimo'] is not None else 'NULL'},{b['obiettivo'] if b['obiettivo'] is not None else 'NULL'})"
             for b in ber if b["obiettivo"] is not None or b["minimo"] is not None]
    w("INSERT INTO bs VALUES\n" + ",\n".join(righe) + ";")
    w("INSERT INTO sys.sys_kpi_targets (kpi_target_id, kpi_target_tenant_id, kpi_target_kpi_id, kpi_target_position_id, kpi_target_period_start, kpi_target_period_end, kpi_target_target_value, kpi_target_minimum_value, kpi_target_stretch_value, kpi_target_unit, kpi_target_metadata)")
    w(f"SELECT gen_random_uuid(), '{TEN}', k.kpi_definition_id, r.pos, DATE '2026-01-01', DATE '2026-12-31', COALESCE(b.obiettivo, (b.minimo+b.massimo)/2, b.minimo, b.massimo), b.minimo, b.massimo, k.kpi_definition_unit, '{{\"allinea\":\"R\"}}'::jsonb")
    w(f"FROM bs b JOIN mt m ON m.id=b.metrica JOIN sys.sys_kpi_definitions k ON k.kpi_definition_code='TJB-'||m.id AND k.kpi_definition_tenant_id='{TEN}'")
    w("JOIN ob o ON o.id=m.obiettivo JOIN rap r ON r.codice=o.ruolo_corsa")
    w("WHERE NOT EXISTS (SELECT 1 FROM sys.sys_kpi_targets t WHERE t.kpi_target_kpi_id=k.kpi_definition_id AND t.kpi_target_position_id=r.pos AND t.kpi_target_period_start=DATE '2026-01-01');")
    w("INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_kpi_targets', kpi_target_id, '{}'::jsonb FROM sys.sys_kpi_targets WHERE kpi_target_metadata->>'allinea'='R' ON CONFLICT DO NOTHING;")
    w("COMMIT;")
    w("SELECT 'R ok' esito, (SELECT count(*) FROM sys.sys_learning_modules WHERE learning_module_metadata->>'allinea'='R') moduli, (SELECT count(*) FROM sys.sys_goal_templates WHERE template_metadata->>'allinea'='R') modelli_obiettivo, (SELECT count(*) FROM sys.sys_kpi_definitions WHERE kpi_definition_metadata->>'allinea'='R') indicatori, (SELECT count(*) FROM sys.sys_kpi_targets WHERE kpi_target_metadata->>'allinea'='R') traguardi;")
    print("\n".join(out))


main(sys.argv[1])
