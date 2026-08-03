-- 000243_remove_foreign_industry_kpis.sql
--
-- Rimozione dei due KPI di industry estranea dal catalogo globale
-- (decisione di Enzo, 2026-08-03):
--   ENERGY-SAVINGS     Energy Savings Achieved (MWh)
--   HACCP-COMPLIANCE   HACCP Compliance Score
--
-- CORREZIONE DI UN CRITERIO, non solo di due righe. La 000242 li aveva
-- lasciati classificandoli come "materiale generativo perche' globali". La
-- distinzione giusta e' piu' fine, e la detta l'invariante I21: restano aperte
-- le **tassonomie e ontologie** — Industry, ESCO, ISCO, NACE, ATECO, modelli
-- operativi, CCNL — che sono classificazioni ufficiali e senza le quali non si
-- possono piu' creare blueprint, tenant, strutture o processi nuovi.
-- `sys_kpi_definitions` non e' una classificazione: e' **contenuto di
-- prodotto**. Un indicatore di conformita' HACCP non serve ne' a una banca ne'
-- a una societa' di consulenza direzionale, e nessuna tassonomia lo richiede
-- per esistere. "Globale" non basta a giustificare una riga: la domanda giusta
-- e' se sia una classificazione o un contenuto.
--
-- Le 37 competenze alimentari/energetiche NON seguono questi due: sono voci
-- ESCO, cioe' la tassonomia europea delle competenze, e cadono esattamente nel
-- perimetro che l'invariante tiene aperto.
--
-- Misurato prima: 0 misurazioni, 0 target, 0 esiti di valutazione, 0 template
-- di unita' o processo, 0 requisiti di posizione, 0 evidenze utente. Gli unici
-- riferimenti sono 2 definizioni di metrica e 2 traduzioni, rimosse qui con
-- l'entita' — la 000235 aveva lasciato 84 traduzioni orfane facendo altrimenti,
-- e la sentinella l'aveva scoperto.
BEGIN;

CREATE TEMP TABLE _kpi_estranei ON COMMIT DROP AS
SELECT kpi_definition_id FROM sys.sys_kpi_definitions
 WHERE kpi_definition_code IN ('ENERGY-SAVINGS', 'HACCP-COMPLIANCE');

DO $$
DECLARE v_uso bigint;
BEGIN
  SELECT (SELECT count(*) FROM sys.sys_kpi_measurements m JOIN _kpi_estranei k ON k.kpi_definition_id = m.kpi_measurement_kpi_id)
       + (SELECT count(*) FROM sys.sys_kpi_targets t JOIN _kpi_estranei k ON k.kpi_definition_id = t.kpi_target_kpi_id)
       + (SELECT count(*) FROM sys.sys_kpi_assessment_results r JOIN _kpi_estranei k ON k.kpi_definition_id = r.kpi_assessment_result_kpi_id)
       + (SELECT count(*) FROM sys.sys_position_kpi_requirements p JOIN _kpi_estranei k ON k.kpi_definition_id = p.kpi_definition_id)
       + (SELECT count(*) FROM sys.sys_organization_unit_kpi_templates o JOIN _kpi_estranei k ON k.kpi_definition_id = o.organization_unit_kpi_template_kpi_id)
       + (SELECT count(*) FROM sys.sys_process_kpi_templates pt JOIN _kpi_estranei k ON k.kpi_definition_id = pt.process_kpi_template_kpi_id)
       + (SELECT count(*) FROM sys.sys_user_kpi_evidence e JOIN _kpi_estranei k ON k.kpi_definition_id = e.user_kpi_evidence_kpi_id)
    INTO v_uso;
  IF v_uso > 0 THEN
    RAISE EXCEPTION
      'Rimozione interrotta: i due KPI risultano in uso (% riferimenti). '
      'Un indicatore misurato o assegnato non si cancella: si ritira.', v_uso;
  END IF;
END $$;

DELETE FROM sys.sys_reference_translations t
 USING _kpi_estranei k
 WHERE t.entity_table = 'sys_kpi_definitions' AND t.entity_id = k.kpi_definition_id;

DELETE FROM sys.sys_kpi_metric_definitions m
 USING _kpi_estranei k WHERE m.kpi_metric_definition_kpi_id = k.kpi_definition_id;

DELETE FROM sys.sys_kpi_definitions d
 USING _kpi_estranei k WHERE d.kpi_definition_id = k.kpi_definition_id;

COMMIT;
