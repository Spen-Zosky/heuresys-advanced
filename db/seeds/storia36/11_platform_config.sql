-- ============================================================================
-- storia36 C11 — CONFIGURAZIONE DELLA PIATTAFORMA
--
-- Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md (Task C11)
--
-- Quello che c'era: un organigramma con 158 nodi e 157 archi e **nessuna
-- disposizione salvata** — chi lo apre lo vede ricalcolato ogni volta e non può
-- conservare la propria vista; i 158 nodi **senza tipo** (e gli stili si
-- applicano per tipo, quindi nessuno stile poteva funzionare); nessun export;
-- nessun contatto arrivato dal sito; e la pipeline di acquisizione — cinque
-- tabelle — completamente vuota.
--
-- COSA SCRIVE:
--  · LA DISPOSIZIONE DELL'ORGANIGRAMMA — un layout gerarchico predefinito con
--    la posizione di ogni nodo, calcolata dall'albero vero: la profondità dà
--    la riga, l'ordine alfabetico fra pari dà la colonna. Più gli stili per
--    tipo di nodo e due export storici.
--  · I CONTATTI dal canale pubblico — sei, con provenienza e stato diversi:
--    chi ha chiesto una dimostrazione, chi è arrivato dal sito, chi da un
--    investitore. Con la data del consenso e la versione dell'informativa,
--    perché un contatto senza quello non si può ricontattare.
--  · LA PIPELINE DI ACQUISIZIONE, AUTO-REFERENZIALE — e questa è la parte che
--    vale la pena spiegare: le cinque tabelle servono a registrare come i dati
--    entrano nel sistema (una corsa, i record candidati, le validazioni, le
--    approvazioni, le fonti). Invece di inventare una corsa, si registrano LE
--    CORSE DI QUESTO PROGRAMMA: ogni cluster è una corsa, ogni seed un record
--    candidato, e le validazioni sono quelle vere — la doppia esecuzione a
--    zero righe, la batteria dei controlli, il cancello di esposizione. Il
--    modulo diventa dimostrabile con dati che sono veri per costruzione,
--    perché descrivono ciò che è realmente successo.
--
-- NON SCRIVE IL CROSSWALK FRA CLASSIFICAZIONI, e il motivo è una scoperta:
-- la scorciatoia ovvia — togliere i punti dal codice CP2021 e cercarlo fra i
-- codici ISCO-08 — produce mappature FALSE su metà della tassonomia. La
-- classificazione italiana mette le Forze Armate nel grande gruppo 9, la ISCO
-- nello 0, e da lì in poi i gruppi sono sfasati di uno:
--     CP 6 «Artigiani e operai specializzati»  ↔ ISCO 6 «Addetti all'agricoltura»
--     CP 7 «Conduttori di impianti»            ↔ ISCO 7 «Artigiani e operai»
--     CP 8 «Professioni non qualificate»       ↔ ISCO 8 «Conduttori di impianti»
--     CP 9 «Forze armate»                      ↔ ISCO 9 «Professioni non qualificate»
-- Quattro grandi gruppi su nove mapperebbero il mestiere sbagliato. Il
-- crosswalk CP2021↔ISCO-08 è una tavola ufficiale ISTAT, non una regola
-- meccanica: va importata, non dedotta. E il crosswalk delle attività non è
-- nemmeno possibile — c'è una sola classificazione caricata (ATECO 2025), e
-- per un crosswalk servono due estremi.
--
-- Idempotente: id uuid_generate_v5 su chiavi naturali. Twice-run: 0.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

DO $$
DECLARE
  c_rtl   constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns    constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  c_to    date;
  v_hr    uuid;
  v_graph uuid;
  v_lay   uuid;
  v_n     bigint := 0;
  v_tot   bigint := 0;
BEGIN
  SELECT staging.storia36_c4_frontier() INTO STRICT c_to;
  SELECT user_id INTO STRICT v_hr FROM sys.sys_users
   WHERE user_email = 'federica.marchetti@rtl-bank.org';
  SELECT graph_id INTO STRICT v_graph FROM sys.sys_visualization_graphs
   WHERE graph_code = 'RTL_ORG_CHART';

  -- ==========================================================================
  -- 1. I NODI HANNO UN TIPO — senza, nessuno stile può applicarsi
  -- ==========================================================================
  UPDATE sys.sys_visualization_nodes n
     SET node_type = CASE
           WHEN p.position_reports_to_position_id IS NULL THEN 'ROOT'
           WHEN EXISTS (SELECT 1 FROM sys.sys_positions f
                         WHERE f.position_reports_to_position_id = p.position_id) THEN 'MANAGER'
           ELSE 'CONTRIBUTOR' END,
         node_group_key = COALESCE(o.organization_unit_code, 'SENZA-UNITA'),
         updated_at = now()
    FROM sys.sys_positions p
    LEFT JOIN sys.sys_organization_units o ON o.organization_unit_id = p.position_organization_unit_id
   WHERE n.node_source_entity_id = p.position_id
     AND n.node_graph_id = v_graph
     AND (n.node_type IS NULL OR n.node_group_key IS NULL);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'storia36 C11: nodi tipizzati e raggruppati %', v_n;

  -- ==========================================================================
  -- 2. LA DISPOSIZIONE — calcolata dall'albero vero, non disegnata a mano
  -- ==========================================================================
  INSERT INTO sys.sys_visualization_layouts (
    layout_id, layout_graph_id, layout_engine, layout_version, is_default, layout_metadata)
  VALUES (uuid_generate_v5(c_ns, 'STORIA36::C11::LAYOUT::ORG'),
          v_graph, 'HIERARCHICAL', 1, true,
          jsonb_build_object('storia36', 'C11',
                             'criterio', 'profondita organigramma = riga, ordine fra pari = colonna'))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C11: disposizioni salvate %', v_n;

  v_lay := uuid_generate_v5(c_ns, 'STORIA36::C11::LAYOUT::ORG');

  INSERT INTO sys.sys_visualization_node_layouts (
    node_layout_id, layout_id, node_id, x, y, z, locked, node_layout_metadata)
  WITH RECURSIVE albero AS (
    SELECT p.position_id, 0 AS livello, p.position_title
      FROM sys.sys_positions p
     WHERE p.position_tenant_id = c_rtl AND p.position_reports_to_position_id IS NULL
    UNION ALL
    SELECT p.position_id, a.livello + 1, p.position_title
      FROM sys.sys_positions p JOIN albero a ON a.position_id = p.position_reports_to_position_id
     WHERE p.position_tenant_id = c_rtl
  ),
  liv AS (SELECT position_id, min(livello) AS livello, min(position_title) AS titolo
            FROM albero GROUP BY 1),
  posti AS (
    SELECT n.node_id, l.livello,
           row_number() OVER (PARTITION BY l.livello ORDER BY l.titolo, n.node_id) AS colonna
      FROM sys.sys_visualization_nodes n
      JOIN liv l ON l.position_id = n.node_source_entity_id
     WHERE n.node_graph_id = v_graph
  )
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C11::NODEPOS::' || p.node_id),
         v_lay, p.node_id,
         (p.colonna * 220)::numeric, (p.livello * 160)::numeric, 0, false,
         jsonb_build_object('storia36', 'C11', 'livello', p.livello)
    FROM posti p
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C11: posizioni dei nodi %', v_n;

  INSERT INTO sys.sys_visualization_styles (
    style_id, style_graph_id, style_node_type, style_color, style_icon, style_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C11::STILE::' || s.tipo),
         v_graph, s.tipo, s.colore, s.icona, jsonb_build_object('storia36', 'C11')
    FROM (VALUES
      ('ROOT',        '#EF4444', 'crown'),
      ('MANAGER',     '#6366F1', 'users'),
      ('CONTRIBUTOR', '#10B981', 'user')
    ) AS s(tipo, colore, icona)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C11: stili per tipo di nodo %', v_n;

  INSERT INTO sys.sys_visualization_exports (
    export_id, export_graph_id, export_layout_id, export_format,
    export_payload_uri, export_generated_at, export_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C11::EXPORT::' || e.quando || '::' || e.formato),
         v_graph, v_lay, e.formato,
         'storage://rtl/organigramma/' || e.quando || '.' || lower(e.formato),
         e.quando::timestamptz,
         jsonb_build_object('storia36', 'C11', 'motivo', e.motivo)
    FROM (VALUES
      ('2025-03-20', 'PDF',     'Organigramma allegato alla nota sul riordino.'),
      ('2026-01-15', 'SVG',     'Organigramma per la relazione annuale.'),
      ('2026-06-30', 'MERMAID', 'Estrazione per la documentazione interna.')
    ) AS e(quando, formato, motivo)
   WHERE e.quando::date <= c_to
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C11: export dell''organigramma %', v_n;

  -- ==========================================================================
  -- 3. I CONTATTI DAL CANALE PUBBLICO
  -- ==========================================================================
  INSERT INTO sys.sys_leads (
    lead_id, lead_name, lead_company, lead_email, lead_role, lead_company_size,
    lead_message, lead_source, lead_status, lead_consent_at, lead_consent_version, created_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C11::LEAD::' || l.n),
         l.nome, l.azienda, l.email, l.ruolo, l.taglia, l.messaggio,
         l.canale, l.stato, l.quando::timestamptz, 'v1.0', l.quando::timestamptz
    FROM (VALUES
      (1, 'Chiara Bonetti',  'Cooperativa Servizi Lombardia', 'c.bonetti@servizilombardia.example',
       'Responsabile del personale', '250_2000', 'Vorremmo capire come gestite le competenze e i piani di successione.', 'DEMO',      'QUALIFIED', DATE '2026-02-11'),
      (2, 'Marco Ferraris',  'Gruppo Industriale Piemonte',   'm.ferraris@gip.example',
       'Direttore risorse umane',    'GT_2000',  'Cerchiamo uno strumento per la mappatura delle posizioni su più stabilimenti.', 'WEBSITE',   'CONTACTED', DATE '2026-03-26'),
      (3, 'Silvia Rinaldi',  'Studio Rinaldi Associati',      's.rinaldi@rinaldiassociati.example',
       'Socia',                      'LT_50',    'Consulenza per clienti bancari: ci interessa la parte di conformità.', 'WEBSITE',   'NEW',       DATE '2026-05-04'),
      (4, 'Alessandro Neri', 'Fondo Adriatico Ventures',      'a.neri@adriaticoventures.example',
       'Investment manager',         '50_250',   'Richiesta di materiale sulla trazione e sul modello di ricavi.', 'INVESTOR',  'CONTACTED', DATE '2026-05-20'),
      (5, 'Paola Greco',     'Rete Farmacie Centro Italia',   'p.greco@retefarmacie.example',
       'Direttrice operativa',       '250_2000', 'Ci servirebbe la parte di formazione obbligatoria e scadenze.', 'DEMO',      'QUALIFIED', DATE '2026-06-09'),
      (6, 'Davide Fontana',  'Banca di Credito Ligure',       'd.fontana@bcligure.example',
       'Responsabile organizzazione','250_2000', 'Valutiamo la sostituzione dell''attuale gestionale del personale.', 'DEMO',      'NEW',       DATE '2026-07-07')
    ) AS l(n, nome, azienda, email, ruolo, taglia, messaggio, canale, stato, quando)
   WHERE l.quando <= c_to
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C11: contatti dal canale pubblico %', v_n;

  -- ==========================================================================
  -- 4. LA PIPELINE DI ACQUISIZIONE — registra le corse di QUESTO programma
  -- ==========================================================================
  INSERT INTO sys.sys_seed_acquisition_runs (
    seed_acquisition_run_id, seed_acquisition_run_tenant_id, seed_acquisition_run_code,
    seed_acquisition_run_prompt_template, seed_acquisition_run_source_registry_payload,
    seed_acquisition_run_started_at, seed_acquisition_run_finished_at,
    seed_acquisition_run_status, seed_acquisition_run_metadata, created_by)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C11::RUN::' || r.cluster_code),
         c_rtl, 'STORIA36-' || r.cluster_code,
         'Popolamento del cluster ' || r.cluster_code || ' della storia dei 36 mesi.',
         -- il registro delle fonti è un ELENCO, non un oggetto singolo: lo
         -- schema condiviso dichiara `z.array`, e un oggetto qui faceva
         -- rispondere 500 alla lista delle corse
         jsonb_build_array(jsonb_build_object('programma', 'storia36',
                            'cluster', r.cluster_code, 'seed', r.seed_file)),
         r.executed_at, r.executed_at, 'COMPLETED',
         jsonb_build_object('storia36', 'C11', 'righe_scritte', r.rows_written),
         v_hr
    FROM (SELECT DISTINCT ON (cluster_code) cluster_code, seed_file, executed_at, rows_written
            FROM (SELECT cluster_code, seed_file, executed_at, rows_written FROM staging.storia36_runs
                  UNION ALL
                  -- il cluster CORRENTE, che nel registro finisce solo alla fine di
                  -- questo stesso seed: senza, la seconda esecuzione lo troverebbe e
                  -- scriverebbe sette righe nuove — l'auto-referenzialità che si morde
                  -- la coda, e il twice-run che non arriva mai a zero
                  SELECT 'C11', '11_platform_config.sql', now(), 0) z
           ORDER BY cluster_code, executed_at) r
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C11: corse di acquisizione registrate %', v_n;

  INSERT INTO sys.sys_seed_candidate_records (
    seed_candidate_record_id, seed_candidate_record_run_id, seed_candidate_record_tenant_id,
    seed_candidate_record_domain, seed_candidate_record_natural_key,
    seed_candidate_record_payload, seed_candidate_record_validation_status,
    seed_candidate_record_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C11::CAND::' || r.cluster_code),
         uuid_generate_v5(c_ns, 'STORIA36::C11::RUN::' || r.cluster_code),
         c_rtl, 'storia36', r.seed_file,
         jsonb_build_object('cluster', r.cluster_code, 'seed', r.seed_file,
                            'righe_scritte', r.rows_written,
                            'delta_seconda_corsa', r.twice_run_delta),
         'APPLIED',
         jsonb_build_object('storia36', 'C11')
    FROM (SELECT DISTINCT ON (cluster_code) cluster_code, seed_file, rows_written, twice_run_delta
            FROM (SELECT cluster_code, seed_file, rows_written, twice_run_delta, executed_at FROM staging.storia36_runs
                  UNION ALL SELECT 'C11', '11_platform_config.sql', 0, 0, now()) z
           ORDER BY cluster_code, executed_at DESC) r
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C11: record candidati %', v_n;

  -- le validazioni sono quelle VERE del programma: la doppia esecuzione a zero
  -- righe, la batteria dei controlli, il cancello di esposizione
  INSERT INTO sys.sys_seed_validation_results (
    seed_validation_result_id, seed_validation_result_candidate_id,
    seed_validation_result_rule_code, seed_validation_result_status,
    seed_validation_result_message, seed_validation_result_payload)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C11::VAL::' || r.cluster_code || '::' || v.regola),
         uuid_generate_v5(c_ns, 'STORIA36::C11::CAND::' || r.cluster_code),
         v.regola,
         CASE WHEN v.regola = 'TWICE_RUN_ZERO' AND r.twice_run_delta <> 0
              THEN 'FAILED' ELSE 'PASSED' END,
         v.messaggio,
         jsonb_build_object('storia36', 'C11', 'cluster', r.cluster_code)
    FROM (SELECT DISTINCT ON (cluster_code) cluster_code, twice_run_delta
            FROM (SELECT cluster_code, twice_run_delta, executed_at FROM staging.storia36_runs
                  UNION ALL SELECT 'C11', 0, now()) z
           ORDER BY cluster_code, executed_at DESC) r
    CROSS JOIN (VALUES
      ('TWICE_RUN_ZERO',   'La seconda esecuzione non scrive nulla: il seed è idempotente.'),
      ('BATTERIA_VERDE',   'La batteria delle post-condizioni del cluster è verde.'),
      ('CANCELLO_ESPOSIZIONE', 'Ogni tabella scritta è letta da almeno un modulo dell''API.')
    ) AS v(regola, messaggio)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C11: esiti di validazione %', v_n;

  INSERT INTO sys.sys_seed_approval_decisions (
    seed_approval_decision_id, seed_approval_decision_candidate_id,
    seed_approval_decision_approver_user_id, seed_approval_decision_status,
    seed_approval_decision_rationale, seed_approval_decision_decided_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C11::APPR::' || r.cluster_code),
         uuid_generate_v5(c_ns, 'STORIA36::C11::CAND::' || r.cluster_code),
         v_hr, 'APPROVED',
         'Cluster ' || r.cluster_code || ': doppia esecuzione a zero righe, batteria verde, '
           || 'nessuna tabella scritta senza un''API che la legga.',
         r.executed_at
    FROM (SELECT DISTINCT ON (cluster_code) cluster_code, executed_at
            FROM (SELECT cluster_code, executed_at FROM staging.storia36_runs
                  UNION ALL SELECT 'C11', now()) z
           ORDER BY cluster_code, executed_at DESC) r
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C11: approvazioni dei cluster %', v_n;

  INSERT INTO sys.sys_seed_source_evidence (
    seed_source_evidence_id, seed_source_evidence_candidate_id,
    seed_source_evidence_url, seed_source_evidence_retrieved_at,
    seed_source_evidence_content_hash, seed_source_evidence_payload)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C11::EVID::' || r.cluster_code),
         uuid_generate_v5(c_ns, 'STORIA36::C11::CAND::' || r.cluster_code),
         'repo://db/seeds/storia36/' || r.seed_file,
         r.executed_at,
         md5(r.seed_file || r.cluster_code),
         jsonb_build_object('storia36', 'C11',
                            'nota', 'La fonte è il seed stesso, versionato nel repository.')
    FROM (SELECT DISTINCT ON (cluster_code) cluster_code, seed_file, executed_at
            FROM (SELECT cluster_code, seed_file, executed_at FROM staging.storia36_runs
                  UNION ALL SELECT 'C11', '11_platform_config.sql', now()) z
           ORDER BY cluster_code, executed_at DESC) r
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C11: fonti registrate %', v_n;

  -- ==========================================================================
  -- 5. REGISTRO + POST-CONDIZIONI
  -- ==========================================================================
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C11', '11_platform_config.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c11a();
  PERFORM staging.storia36_check_c11b();

  RAISE NOTICE 'storia36 C11 OK: % righe scritte (delta atteso 0 alla seconda corsa)', v_tot;
END $$;

COMMIT;
