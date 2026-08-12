-- 000304_gdpr_registry_covers_belonging_not_prefix.sql
-- #183 — il registro GDPR era cieco su 27 tabelle di appartenenza.
--
-- MISURATO (2026-08-12): delle 71 FK di APPARTENENZA verso `sys.sys_users`
-- (ON DELETE CASCADE / RESTRICT / NO ACTION), **27 non erano nel registro**
-- `sys.sys_gdpr_data_map`. Conseguenza concreta, e non teorica: la riga radice
-- `sys_users` e' ANONYMIZE e non viene mai cancellata, quindi ne' CASCADE ne'
-- RESTRICT scattano mai da soli — una tabella fuori dal registro **non viene
-- toccata dalla cancellazione, non compare nel rendiconto, e non entra nel
-- fascicolo dell'art. 15**. Dentro quelle 27 tabelle, oggi: 7.567 check-in
-- obiettivi, 2.105 richieste di ferie, 1.886 saldi, 948 assegnazioni sondaggio,
-- 845 partecipazioni a processo, 301 obiettivi KPI, 270 lacune formative,
-- 237 evidenze, 178 straordinari, 174 appartenenze a squadra, di persone reali.
--
-- PERCHE' NESSUNO SE N'E' ACCORTO: il controllo anti-drift
-- (`apps/api/test/gdpr.integration.test.ts`) filtrava `LIKE 'sys.sys_user\_%'`,
-- cioe' guardava solo le tabelle col prefisso. Nessuna delle 27 ce l'ha: era
-- verde, e sarebbe rimasto verde con qualunque numero di tabelle scoperte.
-- Corretto nello stesso ciclo — il predicato ora e' l'APPARTENENZA, e prima di
-- questa migrazione lo si e' **visto rosso** con l'elenco dei 27 nomi.
--
-- LE CLASSIFICAZIONI NON SONO NUOVE: applicano la dottrina gia' scritta
-- nell'intestazione di `000186_gdpr_tooling.sql` — FINANCIAL_LEGAL (retribuzione,
-- ferie: sono crediti del lavoratore) e EVALUATION (giudizi: difesa in giudizio)
-- restano; PERSONAL e DERIVED (preferenze, notifiche, punteggi algoritmici) si
-- cancellano; AUTH_SECURITY si cancella tranne cio' che e' registro di
-- accountability, come gia' per `login_events` e `user_auth_roles`.
--
-- QUATTRO DECISIONI CHE VALE LA PENA NOMINARE, perche' non discendono dal nome:
--  1. `audit.user_self_service_actions` -> RETAIN. Porta `action_ip` e
--     `action_user_agent`: e' il registro di CHI ha cambiato cosa. Cancellarlo
--     insieme alla persona toglierebbe la prova a chi dovesse contestarne le
--     azioni. Stessa logica di `login_events` (D-59).
--  2. `sys_survey_assignments` -> DELETE. L'assegnazione **non contiene la
--     risposta**; conservarla su una persona cancellata non difende nulla e, se
--     le risposte sono anonime, un'assegnazione superstite ne indebolisce
--     l'anonimato. E' il solo punto in cui ci si discosta da «engagement ->
--     RETAIN» di 000186, e lo si dichiara qui.
--  3. `sys_successor_candidates` -> DELETE. E' un piano non deliberato, non un
--     fatto avvenuto: coerente con la decisione di non renderlo visibile
--     nemmeno all'interessato.
--  4. `sys_reward_gates` -> RETAIN. Il carico utile decide una componente della
--     retribuzione variabile: e' FINANCIAL_LEGAL come le buste paga.
--
-- NON si tocca NESSUNA delle 262 FK. Misurato: **0 utenti su 161** superano oggi
-- il controllo di cancellabilita' (ognuno ha almeno un'assegnazione di posizione).
-- Convertire le 9 RESTRICT + 1 NO ACTION a SET NULL non sbloccherebbe alcun caso
-- d'uso reale: **toglierebbe la sola protezione** che impedisce di cancellare una
-- persona con storia. Restano come sono, e sono l'applicazione della policy.
--
-- ROLLBACK DICHIARATO (elenco esplicito, mai un carattere jolly):
--   DELETE FROM sys.sys_gdpr_data_map
--    WHERE (gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk) IN (
--      ('audit','user_self_service_actions','action_user_id'),
--      ('sys','sys_auth_mfa_exemption_audit','auth_mfa_exemption_audit_user_id'),
--      ('sys','sys_auth_mfa_exemption_eligible_users','auth_mfa_eligible_user_id'),
--      ('sys','sys_calibration_discussions','calibration_discussion_subject_user_id'),
--      ('sys','sys_calibration_participants','calibration_participant_user_id'),
--      ('sys','sys_gap_closure_plans','gap_closure_plan_user_id'),
--      ('sys','sys_goal_check_ins','check_in_subject_user_id'),
--      ('sys','sys_inbox_notifications','notification_user_id'),
--      ('sys','sys_kpi_assessment_results','kpi_assessment_result_user_id'),
--      ('sys','sys_kpi_measurements','kpi_measurement_user_id'),
--      ('sys','sys_kpi_targets','kpi_target_user_id'),
--      ('sys','sys_learning_gaps','learning_gap_user_id'),
--      ('sys','sys_notification_preferences','preference_user_id'),
--      ('sys','sys_overtime','overtime_subject_user_id'),
--      ('sys','sys_person_evidence_records','person_evidence_record_user_id'),
--      ('sys','sys_process_participants','process_participant_user_id'),
--      ('sys','sys_readiness_scores','readiness_score_user_id'),
--      ('sys','sys_reward_gates','reward_gate_user_id'),
--      ('sys','sys_skill_gap_scores','skill_gap_score_user_id'),
--      ('sys','sys_succession_readiness_scores','succession_readiness_score_user_id'),
--      ('sys','sys_succession_scores','succession_score_user_id'),
--      ('sys','sys_successor_candidates','successor_candidate_user_id'),
--      ('sys','sys_survey_assignments','survey_assignment_user_id'),
--      ('sys','sys_talent_scores','talent_score_user_id'),
--      ('sys','sys_team_members','team_member_user_id'),
--      ('sys','sys_time_off_balances','balance_subject_user_id'),
--      ('sys','sys_time_off_requests','request_subject_user_id'));
--
-- Idempotente: ON CONFLICT sulla chiave naturale del registro, DO UPDATE (come
-- 000233) cosi' una correzione futura della classificazione si propaga alla
-- ri-applicazione della catena invece di essere ignorata.

INSERT INTO sys.sys_gdpr_data_map (
  gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk,
  gdpr_map_data_class, gdpr_map_erasure_strategy, gdpr_map_reference_kind,
  gdpr_map_legal_basis
) VALUES
  -- ---- conservati: retribuzione e crediti del lavoratore -------------------
  ('sys','sys_overtime','overtime_subject_user_id',
   'FINANCIAL_LEGAL','RETAIN','SUBJECT',
   'Lavoro straordinario: ore, maggiorazione e compenso. Retribuzione — prescrizione civile decennale.'),
  ('sys','sys_time_off_balances','balance_subject_user_id',
   'FINANCIAL_LEGAL','RETAIN','SUBJECT',
   'Saldi di ferie e permessi: le ferie maturate e non godute sono un credito del lavoratore.'),
  ('sys','sys_time_off_requests','request_subject_user_id',
   'FINANCIAL_LEGAL','RETAIN','SUBJECT',
   'Registro di assenze e approvazioni: prova dell''adempimento su ferie e permessi.'),
  ('sys','sys_reward_gates','reward_gate_user_id',
   'FINANCIAL_LEGAL','RETAIN','SUBJECT',
   'Cancelli di accesso al premio: determinano una componente della retribuzione variabile.'),

  -- ---- conservati: giudizi, a difesa in giudizio ---------------------------
  ('sys','sys_calibration_discussions','calibration_discussion_subject_user_id',
   'EVALUATION','RETAIN','SUBJECT',
   'Valutazione originale e calibrata della persona — difesa di diritti in giudizio.'),
  ('sys','sys_calibration_participants','calibration_participant_user_id',
   'EVALUATION','RETAIN','SUBJECT',
   'Partecipazione alla sessione di calibrazione — tracciabilita'' del processo valutativo.'),
  ('sys','sys_goal_check_ins','check_in_subject_user_id',
   'EVALUATION','RETAIN','SUBJECT',
   'Avanzamento sugli obiettivi con note e impedimenti — record di prestazione.'),
  ('sys','sys_kpi_assessment_results','kpi_assessment_result_user_id',
   'EVALUATION','RETAIN','SUBJECT',
   'Esito della valutazione su indicatore — record di prestazione.'),
  ('sys','sys_kpi_measurements','kpi_measurement_user_id',
   'EVALUATION','RETAIN','SUBJECT',
   'Misure di indicatore riferite alla persona — record di prestazione.'),
  ('sys','sys_kpi_targets','kpi_target_user_id',
   'EVALUATION','RETAIN','SUBJECT',
   'Obiettivi assegnati alla persona — termine di paragone di ogni valutazione successiva.'),
  ('sys','sys_person_evidence_records','person_evidence_record_user_id',
   'EVALUATION','RETAIN','SUBJECT',
   'Registro di evidenze sulla persona — difesa di diritti in giudizio.'),
  ('sys','sys_talent_scores','talent_score_user_id',
   'EVALUATION','RETAIN','SUBJECT',
   'Potenziale e prestazione (griglia a nove caselle) — record di prestazione.'),

  -- ---- conservati: registri di accountability ------------------------------
  ('audit','user_self_service_actions','action_user_id',
   'AUTH_SECURITY','RETAIN','SUBJECT',
   'Registro delle azioni compiute dall''interessato, con indirizzo e dispositivo: prova di chi ha modificato cosa.'),
  ('sys','sys_auth_mfa_exemption_audit','auth_mfa_exemption_audit_user_id',
   'AUTH_SECURITY','RETAIN','SUBJECT',
   'Registro delle deroghe al secondo fattore, con motivo e autore — tracciabilita'' delle decisioni di sicurezza.'),

  -- ---- cancellati: accesso, preferenze, comunicazioni ----------------------
  ('sys','sys_auth_mfa_exemption_eligible_users','auth_mfa_eligible_user_id',
   'AUTH_SECURITY','DELETE','SUBJECT',
   'Idoneita'' alla deroga: configurazione di accesso, priva di valore una volta cessata la persona. La DECISIONE resta nel registro di cui sopra.'),
  ('sys','sys_notification_preferences','preference_user_id',
   'PERSONAL','DELETE','SUBJECT',
   'Preferenze di notifica scelte dalla persona.'),
  ('sys','sys_inbox_notifications','notification_user_id',
   'PERSONAL','DELETE','SUBJECT',
   'Comunicazioni indirizzate alla persona.'),

  -- ---- cancellati: appartenenze funzionali correnti ------------------------
  ('sys','sys_team_members','team_member_user_id',
   'OPERATIONAL','DELETE','SUBJECT',
   'Appartenenza a una squadra: fotografia corrente, non storia di impiego (quella e'' in sys_user_position_assignments, conservata).'),
  ('sys','sys_process_participants','process_participant_user_id',
   'OPERATIONAL','DELETE','SUBJECT',
   'Ruolo in un processo organizzativo: assegnazione funzionale corrente, non record di impiego.'),
  ('sys','sys_survey_assignments','survey_assignment_user_id',
   'OPERATIONAL','DELETE','SUBJECT',
   'Assegnazione di un sondaggio: non contiene la risposta. Conservarla non difende alcun diritto e, se le risposte sono anonime, ne indebolisce l''anonimato.'),
  ('sys','sys_gap_closure_plans','gap_closure_plan_user_id',
   'OPERATIONAL','DELETE','SUBJECT',
   'Piano di colmatura delle lacune: proposta di sviluppo, non prova di formazione svolta (quella e'' in sys_user_learning_evidence, conservata).'),

  -- ---- cancellati: elaborazioni algoritmiche derivate ----------------------
  ('sys','sys_learning_gaps','learning_gap_user_id',
   'DERIVED','DELETE','SUBJECT',
   'Lacuna formativa calcolata per differenza fra richiesto e posseduto.'),
  ('sys','sys_skill_gap_scores','skill_gap_score_user_id',
   'DERIVED','DELETE','SUBJECT',
   'Punteggio di scostamento fra competenze possedute e richieste — prodotto di un modello.'),
  ('sys','sys_readiness_scores','readiness_score_user_id',
   'DERIVED','DELETE','SUBJECT',
   'Punteggio di prontezza su una posizione — prodotto di un modello.'),
  ('sys','sys_succession_scores','succession_score_user_id',
   'DERIVED','DELETE','SUBJECT',
   'Punteggio di successione — prodotto di un modello.'),
  ('sys','sys_succession_readiness_scores','succession_readiness_score_user_id',
   'DERIVED','DELETE','SUBJECT',
   'Punteggio di prontezza alla successione — prodotto di un modello.'),
  ('sys','sys_successor_candidates','successor_candidate_user_id',
   'DERIVED','DELETE','SUBJECT',
   'Candidatura in un bacino di successione: piano non deliberato, non un fatto avvenuto.')
ON CONFLICT (gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk) DO UPDATE
SET gdpr_map_data_class       = EXCLUDED.gdpr_map_data_class,
    gdpr_map_erasure_strategy = EXCLUDED.gdpr_map_erasure_strategy,
    gdpr_map_reference_kind   = EXCLUDED.gdpr_map_reference_kind,
    gdpr_map_legal_basis      = EXCLUDED.gdpr_map_legal_basis,
    updated_at                = now();

-- ============================================================================
-- POST-CONDIZIONI — la migrazione verifica se stessa e fallisce forte.
-- Proteggono anche cio' che NON doveva cambiare, non solo cio' che doveva.
-- ============================================================================
DO $$
DECLARE
  v_scoperte   integer;
  v_totale     integer;
  v_radice     text;
  v_aggiunte   integer;
BEGIN
  -- (a) CIO' CHE DOVEVA CAMBIARE: nessuna FK di appartenenza resta fuori.
  SELECT count(*) INTO v_scoperte
    FROM (
      SELECT n.nspname AS sch, src.relname AS tbl, att.attname AS col
        FROM pg_constraint con
        JOIN pg_class src        ON src.oid = con.conrelid
        JOIN pg_namespace n      ON n.oid = src.relnamespace
        JOIN pg_class tgt        ON tgt.oid = con.confrelid
        JOIN pg_namespace tn     ON tn.oid = tgt.relnamespace
        JOIN unnest(con.conkey) WITH ORDINALITY k(attnum, ord) ON true
        JOIN pg_attribute att    ON att.attrelid = src.oid AND att.attnum = k.attnum
       WHERE con.contype = 'f' AND tgt.relname = 'sys_users' AND tn.nspname = 'sys'
         AND con.confdeltype IN ('c','r','a')
    ) b
    LEFT JOIN sys.sys_gdpr_data_map m
      ON m.gdpr_map_table_schema = b.sch
     AND m.gdpr_map_table_name   = b.tbl
     AND m.gdpr_map_subject_fk   = b.col
   WHERE m.gdpr_data_map_id IS NULL
     AND b.col !~ '(^|_)(created_by|updated_by)$|_by$|assessor|reviewer|verified';
  IF v_scoperte <> 0 THEN
    RAISE EXCEPTION '000304: restano % FK di appartenenza fuori dal registro GDPR', v_scoperte;
  END IF;

  -- (b) CIO' CHE NON DOVEVA CAMBIARE — 1: la radice resta ANONIMIZZATA.
  --     Se diventasse DELETE, la cancellazione porterebbe via la persona a
  --     cascata insieme a tutto cio' che il diritto del lavoro impone di
  --     conservare. E' il difetto peggiore possibile in questo file.
  SELECT gdpr_map_erasure_strategy INTO v_radice
    FROM sys.sys_gdpr_data_map
   WHERE gdpr_map_table_schema = 'sys' AND gdpr_map_table_name = 'sys_users';
  IF v_radice IS DISTINCT FROM 'ANONYMIZE' THEN
    RAISE EXCEPTION '000304: la riga radice sys_users e'' passata a % invece di ANONYMIZE', coalesce(v_radice, '<assente>');
  END IF;

  -- (c) CIO' CHE NON DOVEVA CAMBIARE — 2: le 56 righe preesistenti ci sono
  --     ancora. 56 + 27 = 83. Un numero minore vuol dire che questo file ha
  --     sovrascritto una classificazione altrui invece di aggiungere la propria.
  SELECT count(*) INTO v_totale FROM sys.sys_gdpr_data_map;
  IF v_totale < 83 THEN
    RAISE EXCEPTION '000304: il registro ha % righe, attese almeno 83 (56 preesistenti + 27 nuove)', v_totale;
  END IF;

  -- (d) Le 27 di QUESTO file sono entrate, e ciascuna con la sua motivazione.
  --     Il predicato e' ristretto alle 27 coppie nominate qui: una prima
  --     stesura contava le righe senza motivazione su TUTTO il registro ed e'
  --     stata vista rossa dalla prova generale — 26 righe preesistenti non ne
  --     hanno, il che e' legittimo e non e' affare di questa migrazione.
  --     Una post-condizione deve misurare cio' che il file ha fatto, non lo
  --     stato del mondo.
  SELECT count(*) INTO v_aggiunte
    FROM (VALUES
      ('audit','user_self_service_actions','action_user_id'),
      ('sys','sys_auth_mfa_exemption_audit','auth_mfa_exemption_audit_user_id'),
      ('sys','sys_auth_mfa_exemption_eligible_users','auth_mfa_eligible_user_id'),
      ('sys','sys_calibration_discussions','calibration_discussion_subject_user_id'),
      ('sys','sys_calibration_participants','calibration_participant_user_id'),
      ('sys','sys_gap_closure_plans','gap_closure_plan_user_id'),
      ('sys','sys_goal_check_ins','check_in_subject_user_id'),
      ('sys','sys_inbox_notifications','notification_user_id'),
      ('sys','sys_kpi_assessment_results','kpi_assessment_result_user_id'),
      ('sys','sys_kpi_measurements','kpi_measurement_user_id'),
      ('sys','sys_kpi_targets','kpi_target_user_id'),
      ('sys','sys_learning_gaps','learning_gap_user_id'),
      ('sys','sys_notification_preferences','preference_user_id'),
      ('sys','sys_overtime','overtime_subject_user_id'),
      ('sys','sys_person_evidence_records','person_evidence_record_user_id'),
      ('sys','sys_process_participants','process_participant_user_id'),
      ('sys','sys_readiness_scores','readiness_score_user_id'),
      ('sys','sys_reward_gates','reward_gate_user_id'),
      ('sys','sys_skill_gap_scores','skill_gap_score_user_id'),
      ('sys','sys_succession_readiness_scores','succession_readiness_score_user_id'),
      ('sys','sys_succession_scores','succession_score_user_id'),
      ('sys','sys_successor_candidates','successor_candidate_user_id'),
      ('sys','sys_survey_assignments','survey_assignment_user_id'),
      ('sys','sys_talent_scores','talent_score_user_id'),
      ('sys','sys_team_members','team_member_user_id'),
      ('sys','sys_time_off_balances','balance_subject_user_id'),
      ('sys','sys_time_off_requests','request_subject_user_id')
    ) AS mie(sch, tbl, col)
    LEFT JOIN sys.sys_gdpr_data_map m
      ON m.gdpr_map_table_schema = mie.sch
     AND m.gdpr_map_table_name   = mie.tbl
     AND m.gdpr_map_subject_fk   = mie.col
   WHERE m.gdpr_data_map_id IS NULL
      OR m.gdpr_map_legal_basis IS NULL
      OR btrim(m.gdpr_map_legal_basis) = '';
  IF v_aggiunte <> 0 THEN
    RAISE EXCEPTION '000304: % delle 27 righe di questo file sono assenti o prive di motivazione', v_aggiunte;
  END IF;

  RAISE NOTICE '000304 OK — registro a % righe, 0 FK di appartenenza scoperte, radice ANONYMIZE', v_totale;
END $$;
