-- J3c (estensione, 2026-11-20): testi inglesi o misti residui del tenant RTL Bank, emersi dal giro del 20/11/2026. GENERATO da genera_J3c_testi_residui.py: non si modifica a mano.
-- Idempotente: sostituisce solo valori ESATTI, solo nel tenant RTL. Giornale: staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe).
-- Rollback: UPDATE sys.<tabella> SET <colonna> = vecchio WHERE <colonna> = nuovo (e stesso tenant), per ogni riga del giornale scritta da J3c.
-- Non toccati: codici con CHECK, sigle e termini ufficiali, nomi ufficiali di certificazioni, titoli di ruolo di uso comune (vedi docstring del generatore).
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_testi_undo (salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, colonna text NOT NULL, vecchio text NOT NULL, nuovo text NOT NULL, righe bigint NOT NULL, PRIMARY KEY (tabella, colonna, vecchio));
CREATE TEMP TABLE tr(tabella text, colonna text, en text, it text) ON COMMIT DROP;
CREATE TEMP TABLE tg(tabella text PRIMARY KEY, filtro text) ON COMMIT DROP;
CREATE TEMP TABLE misura(fase text, tabella text, righe_totali bigint, righe_inglesi bigint) ON COMMIT DROP;
INSERT INTO tg VALUES
('sys_behavioral_assessments','behavioral_assessment_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_calibration_sessions','calibration_session_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_content_versions','version_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_engagement_survey_templates','template_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_engagement_surveys','survey_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_goal_check_ins','check_in_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_goal_milestones','milestone_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_goal_templates','template_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_goals','goal_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_kpi_definitions','kpi_definition_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_kpi_targets','kpi_target_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_leads','true'),
('sys_mentorship_programs','program_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_okr_check_ins','check_in_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_overtime','overtime_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_performance_review_competency_ratings','rating_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_predictive_models','model_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_pulse_checks','pulse_check_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_survey_questions','survey_question_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_survey_templates','survey_template_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_surveys','survey_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_time_off_requests','request_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_user_education_records','user_education_record_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_user_timeline_events','user_timeline_event_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0''');
INSERT INTO tr VALUES
('sys_time_off_requests','request_reason','Medical appointment','Visita medica'),
('sys_time_off_requests','request_reason','Family vacation','Vacanza in famiglia'),
('sys_time_off_requests','request_reason','Family leave','Permesso per motivi familiari'),
('sys_time_off_requests','request_reason','Personal matters','Motivi personali'),
('sys_time_off_requests','request_reason','Short illness','Malattia di breve durata'),
('sys_time_off_requests','request_reason','Personal day','Permesso personale'),
('sys_time_off_requests','request_reason','Parental leave','Congedo parentale'),
('sys_overtime','overtime_reason','Quarter closing','Chiusura del trimestre'),
('sys_overtime','overtime_reason','System maintenance','Manutenzione dei sistemi'),
('sys_overtime','overtime_reason','Client meeting','Incontro con il cliente'),
('sys_overtime','overtime_notes','Auto-generated overtime record','Registrazione di straordinario generata automaticamente'),
('sys_pulse_checks','pulse_check_comment','Heavy workload but manageable','Carico di lavoro elevato ma gestibile'),
('sys_pulse_checks','pulse_check_comment','Feeling productive this week','Settimana produttiva'),
('sys_surveys','survey_title','Digital Transformation Feedback','Riscontri sulla trasformazione digitale'),
('sys_surveys','survey_title','Engagement Survey Q1 2024','Indagine sul coinvolgimento 1T 2024'),
('sys_surveys','survey_title','Engagement Survey Q2 2024','Indagine sul coinvolgimento 2T 2024'),
('sys_surveys','survey_title','Engagement Survey Q3 2024','Indagine sul coinvolgimento 3T 2024'),
('sys_surveys','survey_title','Engagement Survey Q4 2024','Indagine sul coinvolgimento 4T 2024'),
('sys_surveys','survey_title','Engagement Survey Q1 2025','Indagine sul coinvolgimento 1T 2025'),
('sys_surveys','survey_title','Q4 2024 Employee Engagement Survey','Indagine sul coinvolgimento dei dipendenti 4T 2024'),
('sys_engagement_surveys','survey_title','Digital Transformation Feedback','Riscontri sulla trasformazione digitale'),
('sys_engagement_surveys','survey_title','Engagement Survey Q1 2024','Indagine sul coinvolgimento 1T 2024'),
('sys_engagement_surveys','survey_title','Engagement Survey Q2 2024','Indagine sul coinvolgimento 2T 2024'),
('sys_engagement_surveys','survey_title','Engagement Survey Q3 2024','Indagine sul coinvolgimento 3T 2024'),
('sys_engagement_surveys','survey_title','Engagement Survey Q4 2024','Indagine sul coinvolgimento 4T 2024'),
('sys_engagement_surveys','survey_title','Engagement Survey Q1 2025','Indagine sul coinvolgimento 1T 2025'),
('sys_engagement_surveys','survey_title','Q4 2024 Employee Engagement Survey','Indagine sul coinvolgimento dei dipendenti 4T 2024'),
('sys_surveys','survey_description','Quarterly pulse check on employee engagement','Rilevazione trimestrale rapida sul coinvolgimento dei dipendenti'),
('sys_surveys','survey_description','Quick quarterly check on employee sentiment','Verifica trimestrale rapida sull''umore dei dipendenti'),
('sys_survey_templates','survey_template_name','Exit Interview Survey','Indagine di uscita'),
('sys_survey_templates','survey_template_name','Employee Engagement Survey','Indagine sul coinvolgimento dei dipendenti'),
('sys_survey_templates','survey_template_name','Wellbeing Assessment','Valutazione del benessere'),
('sys_survey_templates','survey_template_name','Onboarding Check-in','Verifica di inserimento'),
('sys_survey_templates','survey_template_name','Weekly Pulse Check','Rilevazione settimanale rapida'),
('sys_survey_templates','survey_template_name','Custom Engagement Survey','Indagine sul coinvolgimento personalizzata'),
('sys_engagement_survey_templates','template_name','Exit Interview Survey','Indagine di uscita'),
('sys_engagement_survey_templates','template_name','Employee Engagement Survey','Indagine sul coinvolgimento dei dipendenti'),
('sys_engagement_survey_templates','template_name','Wellbeing Assessment','Valutazione del benessere'),
('sys_engagement_survey_templates','template_name','Onboarding Check-in','Verifica di inserimento'),
('sys_engagement_survey_templates','template_name','Weekly Pulse Check','Rilevazione settimanale rapida'),
('sys_engagement_survey_templates','template_name','Custom Engagement Survey','Indagine sul coinvolgimento personalizzata'),
('sys_survey_templates','survey_template_description','General employee engagement survey','Indagine generale sul coinvolgimento dei dipendenti'),
('sys_survey_questions','survey_question_category','Psychological Safety','sicurezza psicologica'),
('sys_survey_questions','survey_question_category','Belonging','appartenenza'),
('sys_survey_questions','survey_question_category','Career','carriera'),
('sys_survey_questions','survey_question_category','Workload','carico di lavoro'),
('sys_survey_questions','survey_question_category','Pride','orgoglio'),
('sys_survey_questions','survey_question_category','Communication','comunicazione'),
('sys_survey_questions','survey_question_category','Motivation','motivazione'),
('sys_survey_questions','survey_question_category','Culture','cultura'),
('sys_survey_questions','survey_question_category','Collaboration','collaborazione'),
('sys_survey_questions','survey_question_category','Manager','responsabile'),
('sys_survey_questions','survey_question_category','Growth','crescita'),
('sys_survey_questions','survey_question_category','Resources','risorse'),
('sys_survey_questions','survey_question_category','Management','direzione'),
('sys_survey_questions','survey_question_category','Alignment','allineamento'),
('sys_survey_questions','survey_question_category','Recognition','riconoscimento'),
('sys_survey_questions','survey_question_category','Compensation','retribuzione'),
('sys_performance_review_competency_ratings','rating_competency_name','Professional Conduct','Condotta professionale'),
('sys_performance_review_competency_ratings','rating_competency_name','Technical Execution','Esecuzione tecnica'),
('sys_performance_review_competency_ratings','rating_competency_name','Domain Knowledge','Conoscenza del settore'),
('sys_behavioral_assessments','behavioral_assessment_competency','Professional Conduct','Condotta professionale'),
('sys_behavioral_assessments','behavioral_assessment_competency','Technical Execution','Esecuzione tecnica'),
('sys_behavioral_assessments','behavioral_assessment_competency','Domain Knowledge','Conoscenza del settore'),
('sys_performance_review_competency_ratings','rating_manager_comment','Consistently professional behavior','Comportamento costantemente professionale'),
('sys_performance_review_competency_ratings','rating_manager_comment','Solid understanding demonstrated','Solida comprensione dimostrata'),
('sys_performance_review_competency_ratings','rating_self_comment','I maintained high professional standards','Ho mantenuto standard professionali elevati'),
('sys_calibration_sessions','calibration_session_location','Meeting Room A','Sala riunioni A'),
('sys_calibration_sessions','calibration_session_location','Board Room','Sala del consiglio'),
('sys_calibration_sessions','calibration_session_location','Virtual','Virtuale'),
('sys_calibration_sessions','calibration_session_location','Virtual - MS Teams','Virtuale - MS Teams'),
('sys_calibration_sessions','calibration_session_location','Milan HQ - Board Room','Sede di Milano - Sala del consiglio'),
('sys_calibration_sessions','calibration_session_location','Milan HQ - Auditorium','Sede di Milano - Auditorium'),
('sys_calibration_sessions','calibration_session_location','Milan HQ - Conference A','Sede di Milano - Sala conferenze A'),
('sys_calibration_sessions','calibration_session_name','Q3 2024 Performance Calibrazione - Operations','Calibrazione della performance 3T 2024 - Operations'),
('sys_calibration_sessions','calibration_session_name','Q3 2024 Performance Calibrazione - Tecnologia','Calibrazione della performance 3T 2024 - Tecnologia'),
('sys_predictive_models','model_name','Skill Gap Analyzer','Analizzatore dei divari di competenza'),
('sys_predictive_models','model_name','Promotion Readiness','Prontezza alla promozione'),
('sys_predictive_models','model_name','Performance Predictor','Previsione delle prestazioni'),
('sys_mentorship_programs','program_name','Digital Transformation Champions','Ambasciatori della trasformazione digitale'),
('sys_mentorship_programs','program_name','Technical Banking Mastery','Eccellenza tecnica bancaria'),
('sys_mentorship_programs','program_name','Women in Banking Leadership','Leadership femminile nel settore bancario'),
('sys_mentorship_programs','program_name','Leadership Excellence Program','Programma di eccellenza nella leadership'),
('sys_goal_check_ins','check_in_blockers','Budget approval in attesa','Approvazione del budget in attesa'),
('sys_goal_check_ins','check_in_blockers','Tool/platform issue tecnico','Problema tecnico di strumento o piattaforma'),
('sys_goal_check_ins','check_in_blockers','Dipendenza vendor in ritardo','Dipendenza dal fornitore in ritardo'),
('sys_goal_check_ins','check_in_blockers','Sign-off compliance pending','Approvazione della compliance in attesa'),
('sys_goal_check_ins','check_in_next_steps','Schedulare meeting con stakeholders','Pianificare un incontro con le parti interessate'),
('sys_goal_check_ins','check_in_next_steps','Escalare blocco a Director per unblock','Segnalare il blocco al direttore per sbloccarlo'),
('sys_goal_check_ins','check_in_next_steps','Workshop tecnico per refactor approach','Workshop tecnico per rivedere l''impostazione del codice'),
('sys_goal_check_ins','check_in_notes','Avanzamento regolare. Milestone Q-X raggiunta in tempo.','Avanzamento regolare. Traguardo del trimestre raggiunto in tempo.'),
('sys_goal_check_ins','check_in_notes','Risk score elevato per resource constraint. Escalation valutata.','Punteggio di rischio elevato per vincolo di risorse. Segnalazione al livello superiore in valutazione.'),
('sys_goal_check_ins','check_in_notes','In attesa di sign-off compliance per next phase.','In attesa dell''approvazione della compliance per la fase successiva.'),
('sys_goal_check_ins','check_in_notes','Outcome misurabile validato dal manager.','Risultato misurabile convalidato dal responsabile.'),
('sys_okr_check_ins','check_in_next_steps','Coinvolgere stakeholder aggiuntivi','Coinvolgere altre parti interessate'),
('sys_okr_check_ins','check_in_blockers','Attesa approvazione budget per il prossimo step','Attesa approvazione del budget per il passo successivo'),
('sys_goal_milestones','milestone_title','Consolidamento e lessons learned','Consolidamento e lezioni apprese'),
('sys_goals','goal_title','Completare certificazione FRM Part I entro Q2 2025','Completare la certificazione FRM Parte I entro il 2T 2025'),
('sys_goals','goal_category','risk management','gestione del rischio'),
('sys_goals','goal_category','customer service','servizio al cliente'),
('sys_goals','goal_category','professional development','sviluppo professionale'),
('sys_goals','goal_category','development','sviluppo'),
('sys_goals','goal_category','sales','vendite'),
('sys_goal_templates','template_category','development','sviluppo'),
('sys_goal_templates','template_category','learning','apprendimento'),
('sys_goal_templates','template_category','project','progetto'),
('sys_goal_templates','template_category','career','carriera'),
('sys_kpi_targets','kpi_target_unit','ratio','rapporto'),
('sys_kpi_targets','kpi_target_unit','score','punteggio'),
('sys_kpi_targets','kpi_target_unit','days','giorni'),
('sys_kpi_definitions','kpi_definition_name','Tempo di determinazione della posizione di liquidità giornaliera (daily cash position)','Tempo di determinazione della posizione di liquidità giornaliera'),
('sys_kpi_definitions','kpi_definition_description','Tempo di determinazione della posizione di liquidità giornaliera (daily cash position)','Tempo di determinazione della posizione di liquidità giornaliera'),
('sys_kpi_definitions','kpi_definition_formula','ora di pubblicazione del report di daily cash position - ora di apertura operativa prevista','ora di pubblicazione del report della posizione di cassa giornaliera - ora di apertura operativa prevista'),
('sys_kpi_definitions','kpi_definition_formula','(numero giorni con daily cash position pubblicata entro l''orario operativo prestabilito / giorni operativi nel periodo) x100','(numero giorni con posizione di cassa giornaliera pubblicata entro l''orario operativo prestabilito / giorni operativi nel periodo) x100'),
('sys_user_education_records','user_education_field_of_study','Business Administration','Economia Aziendale'),
('sys_user_education_records','user_education_field_of_study','Computer Science','Informatica'),
('sys_content_versions','version_change_note','Initial version','Versione iniziale'),
('sys_leads','lead_message','Please contact me with more information.','Vi chiedo di contattarmi per avere maggiori informazioni.'),
('sys_user_timeline_events','user_timeline_event_summary','Certificazione conseguita: crum Master Certified (Scrum Alliance)','Certificazione conseguita: Scrum Master Certified (Scrum Alliance)'),
('sys_user_timeline_events','user_timeline_event_summary','Certificazione conseguita: inancial Risk Manager (FRM) (GARP)','Certificazione conseguita: Financial Risk Manager (FRM) (GARP)'),
('sys_user_timeline_events','user_timeline_event_summary','Certificazione conseguita: ntiriciclaggio AML Specialist (AICOM)','Certificazione conseguita: Antiriciclaggio AML Specialist (AICOM)'),
('sys_user_timeline_events','user_timeline_event_summary','Certificazione conseguita: DPR Data Protection Officer (TUV)','Certificazione conseguita: GDPR Data Protection Officer (TUV)'),
('sys_user_timeline_events','user_timeline_event_summary','Certificazione conseguita: icurezza Base D.Lgs 81/08 (INAIL)','Certificazione conseguita: Sicurezza Base D.Lgs 81/08 (INAIL)'),
('sys_user_timeline_events','user_timeline_event_summary','Certificazione conseguita: ertificazione Interna Leadership (Internal)','Certificazione conseguita: Certificazione Interna Leadership (Internal)'),
('sys_user_timeline_events','user_timeline_event_summary','Certificazione conseguita: ertified Anti-Money Laundering Specialist (CAMS) (ACAMS)','Certificazione conseguita: Certified Anti-Money Laundering Specialist (CAMS) (ACAMS)'),
('sys_user_timeline_events','user_timeline_event_summary','Certificazione conseguita: BA Bank Teller Certificate (American Bankers Association)','Certificazione conseguita: ABA Bank Teller Certificate (American Bankers Association)'),
('sys_user_timeline_events','user_timeline_event_summary','Certificazione conseguita: hartered Financial Analyst (CFA) (CFA Institute)','Certificazione conseguita: Chartered Financial Analyst (CFA) (CFA Institute)');
-- Guardia: il tenant RTL esiste con i suoi dati (un database diverso o vuoto non si tocca) e nessun valore di arrivo coincide con uno di partenza.
DO $$ BEGIN
  IF (SELECT count(*) FROM sys.sys_goals WHERE goal_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') < 1000 THEN RAISE EXCEPTION 'J3c: il tenant RTL non ha i dati attesi, si ferma'; END IF;
  IF EXISTS (SELECT 1 FROM tr a JOIN tr b ON a.tabella=b.tabella AND a.colonna=b.colonna AND a.it=b.en) THEN RAISE EXCEPTION 'J3c: catena di traduzioni, si ferma'; END IF;
END $$;
-- Misura prima: per tabella, righe del tenant e righe che portano un valore inglese elencato
DO $$ DECLARE r record; tot bigint; ing bigint; BEGIN
  FOR r IN SELECT DISTINCT t.tabella, g.filtro FROM tr t JOIN tg g USING (tabella) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %s', r.tabella, r.filtro) INTO tot;
    ing := 0;
    INSERT INTO misura VALUES ('prima', r.tabella, tot, 0);
  END LOOP;
  FOR r IN SELECT t.*, g.filtro FROM tr t JOIN tg g USING (tabella) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I = %L AND (%s)', r.tabella, r.colonna, r.en, r.filtro) INTO ing;
    UPDATE misura SET righe_inglesi = righe_inglesi + ing WHERE fase='prima' AND tabella=r.tabella;
  END LOOP;
  RAISE NOTICE 'J3c prima: % righe inglesi elencate in % tabelle', (SELECT sum(righe_inglesi) FROM misura WHERE fase='prima'), (SELECT count(*) FROM misura WHERE fase='prima');
END $$;
DO $$ DECLARE r record; n bigint; da_cambiare bigint := 0; BEGIN
  FOR r IN SELECT t.*, g.filtro FROM tr t JOIN tg g USING (tabella) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I = %L AND (%s)', r.tabella, r.colonna, r.en, r.filtro) INTO n;
    da_cambiare := da_cambiare + n;
    IF n > 0 THEN
      INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) VALUES (r.tabella, r.colonna, r.en, r.it, n) ON CONFLICT DO NOTHING;
      EXECUTE format('UPDATE sys.%I SET %I = %L WHERE %I = %L AND (%s)', r.tabella, r.colonna, r.it, r.colonna, r.en, r.filtro);
    END IF;
  END LOOP;
  RAISE NOTICE 'J3c: righe da cambiare prima = %', da_cambiare;
END $$;
-- Misura dopo e post-condizione: nessuna riga persa o aggiunta, nessun valore inglese elencato rimasto nel tenant
DO $$ DECLARE r record; tot bigint; prima bigint; resto bigint; BEGIN
  FOR r IN SELECT DISTINCT t.tabella, g.filtro FROM tr t JOIN tg g USING (tabella) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %s', r.tabella, r.filtro) INTO tot;
    SELECT righe_totali INTO prima FROM misura WHERE fase='prima' AND tabella=r.tabella;
    IF tot IS DISTINCT FROM prima THEN RAISE EXCEPTION 'J3c: la tabella % ha cambiato numero di righe (% -> %)', r.tabella, prima, tot; END IF;
  END LOOP;
  FOR r IN SELECT t.*, g.filtro FROM tr t JOIN tg g USING (tabella) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I = %L AND (%s)', r.tabella, r.colonna, r.en, r.filtro) INTO resto;
    IF resto > 0 THEN RAISE EXCEPTION 'J3c: restano % righe con %.% = %', resto, r.tabella, r.colonna, left(r.en, 60); END IF;
  END LOOP;
END $$;
COMMIT;
SELECT 'J3c ok' esito, (SELECT count(*) FROM staging.rtl_allinea_testi_undo) voci_nel_giornale;
-- Guardia vettori (classe J3, 19/11): se un testo con vettore e' cambiato e il vettore non e' stato ricalcolato, esce rosso. Rinviabile con -v vettori_rinvia=1 (lo fa applica.sh, che chiude con vettori.sh --verifica).
\if :{?vettori_rinvia}
\else
DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM sys.v_embedding_impronta_non_combacia;
  IF n > 0 THEN RAISE EXCEPTION 'J3c: % vettori non combaciano piu'' col testo, ricalcola: bash db/scripts/rtl-allinea/vettori.sh --ricalcola', n; END IF; END $$;
\endif
-- Prima della produzione: bash db/scripts/rtl-allinea/prova-catena.sh <.env della copia di prova> (migrate.sh exit 0 dopo questo script).
