-- Voce 5, residui dopo J (mandato RTL 2026-11-11): testi italiani con parole inglesi e descrizioni dei programmi di mentorship. Idempotente, stesso giornale di J.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_testi_undo (salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, colonna text NOT NULL, vecchio text NOT NULL, nuovo text NOT NULL, righe bigint NOT NULL, PRIMARY KEY (tabella, colonna, vecchio));
CREATE TEMP TABLE tr(tabella text, colonna text, en text, it text) ON COMMIT DROP;
INSERT INTO tr VALUES
('sys_mentorship_programs','program_description','Equipping employees with digital skills and mindset through guidance from tech-savvy mentors. Focus on fintech innovations and digital customer experience.','Sviluppo delle competenze e della mentalità digitali delle persone con la guida di mentori esperti di tecnologia. Attenzione alle innovazioni fintech e all''esperienza digitale dei clienti.'),
('sys_mentorship_programs','program_description','An empowering program dedicated to advancing women in senior banking roles through strategic mentorship, networking, and career development.','Programma dedicato alla crescita delle donne nei ruoli bancari senior, con mentorship strategica, relazioni professionali e sviluppo di carriera.'),
('sys_mentorship_programs','program_description','Connect junior analysts with experienced professionals to develop deep expertise in financial products, risk modeling, and regulatory frameworks.','Affianca gli analisti junior a professionisti esperti per sviluppare competenze approfondite su prodotti finanziari, modelli di rischio e quadro regolamentare.'),
('sys_mentorship_programs','program_description','Supporting first-time managers in their transition from individual contributors to people leaders. Focus on coaching, feedback delivery, and team dynamics.','Sostegno ai nuovi responsabili nel passaggio da collaboratore a guida delle persone. Attenzione al coaching, alla restituzione di feedback e alle dinamiche di team.'),
('sys_mentorship_programs','program_description','A comprehensive 12-month program designed to develop the next generation of banking leaders. Participants are paired with senior executives to build strategic thinking, leadership skills, and a deeper understanding of the business.','Programma completo di 12 mesi per formare la prossima generazione di dirigenti bancari. I partecipanti sono affiancati a dirigenti senior per sviluppare pensiero strategico, capacità di leadership e una conoscenza più profonda del business.'),
('sys_learning_modules','learning_module_description','Preparazione FRM GARP Part II: market risk, credit risk, operational risk, liquidity risk.','Preparazione FRM GARP Parte II: rischio di mercato, rischio di credito, rischio operativo, rischio di liquidità.'),
('sys_learning_modules','learning_module_description','Preparazione FRM GARP Part I: quantitative analysis, financial markets, valuation models.','Preparazione FRM GARP Parte I: analisi quantitativa, mercati finanziari, modelli di valutazione.'),
('sys_learning_modules','learning_module_description','Evoluzioni regolamentari: output floor, revisione approcci IRB, rischio operativo, CVA risk, FRTB.','Evoluzioni regolamentari: output floor, revisione degli approcci IRB, rischio operativo, rischio CVA, FRTB.'),
('sys_learning_paths','learning_path_description','Preparazione FRM GARP Part II: market risk, credit risk, operational risk, liquidity risk.','Preparazione FRM GARP Parte II: rischio di mercato, rischio di credito, rischio operativo, rischio di liquidità.'),
('sys_learning_paths','learning_path_description','Evoluzioni regolamentari: output floor, revisione approcci IRB, rischio operativo, CVA risk, FRTB.','Evoluzioni regolamentari: output floor, revisione degli approcci IRB, rischio operativo, rischio CVA, FRTB.'),
('sys_engagement_action_plans','action_plan_title','Revisione policy smart working','Revisione della politica sul lavoro agile'),
('sys_engagement_feedback','feedback_message','Eccellente collaborazione tra i dipartimenti Risk e Operations','Eccellente collaborazione tra le direzioni Rischi e Operations'),
('sys_goal_check_ins','check_in_blockers','Allineamento cross-team mancante','Allineamento fra team mancante'),
('sys_goal_check_ins','check_in_notes','Bloccato su dependency cross-team (Finance Ops). Riallineamento in agenda.','Bloccato su una dipendenza da un altro team (Finanza e Operations). Riallineamento in agenda.'),
('sys_goal_check_ins','check_in_notes','Dipendenza esterna in ritardo (vendor / cross-team). Monitoraggio settimanale.','Dipendenza esterna in ritardo (fornitore o altro team). Monitoraggio settimanale.'),
('sys_goal_milestones','milestone_title','Completare training richiesto','Completare la formazione richiesta'),
('sys_kpi_definitions','kpi_definition_name','Collaborazione team','Collaborazione nel team'),
('sys_kpi_metric_definitions','kpi_metric_definition_name','Collaborazione team','Collaborazione nel team'),
('sys_payout_curves','payout_curve_name','Curva executive a S (risk takers)','Curva dirigenziale a S (assuntori di rischio)'),
('sys_positions','position_title','Specialista Customer Care e Gestione Reclami','Specialista Assistenza Clienti e Gestione Reclami'),
('sys_projects','project_name','Team Delivery Clienti','Squadra Servizio Clienti'),
('sys_job_roles','job_role_name','Responsabile Direzione Risk Management','Responsabile Direzione Gestione dei Rischi'),
('sys_job_roles','job_role_name','addetto customer care contact center','Addetto assistenza clienti contact center'),
('sys_job_roles','job_role_name','Bank Manager','Direttore di Filiale (ruolo del catalogo)'),
('sys_learning_modules','learning_module_title','Project management agile','Gestione agile dei progetti'),
('sys_learning_paths','learning_path_name','Project management agile','Gestione agile dei progetti');
DELETE FROM tr WHERE en='Bank Manager';
DO $$ DECLARE r record; n bigint; BEGIN
  FOR r IN SELECT * FROM tr LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I = %L', r.tabella, r.colonna, r.en) INTO n;
    IF n > 0 THEN
      INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) VALUES (r.tabella, r.colonna, r.en, r.it, n) ON CONFLICT DO NOTHING;
      EXECUTE format('UPDATE sys.%I SET %I = %L WHERE %I = %L', r.tabella, r.colonna, r.it, r.colonna, r.en);
    END IF;
  END LOOP;
END $$;
-- «Risk management bancario» (modulo, percorso, edizioni, richieste di approvazione): termine italiano
DO $$ DECLARE r record; n bigint; BEGIN
  FOR r IN SELECT * FROM (VALUES ('sys_learning_modules','learning_module_title'),('sys_learning_paths','learning_path_name'),('sys_training_initiatives','training_initiative_cohort_name'),('sys_approval_requests','approval_request_title')) v(t,c) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I LIKE %L', r.t, r.c, '%Risk management bancario%') INTO n;
    IF n > 0 THEN
      EXECUTE format($q$INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) SELECT %L, %L, %I, replace(%I,'Risk management bancario','Gestione del rischio bancario'), count(*) FROM sys.%I WHERE %I LIKE '%%Risk management bancario%%' GROUP BY %I ON CONFLICT DO NOTHING$q$, r.t, r.c, r.c, r.c, r.t, r.c, r.c);
      EXECUTE format($q$UPDATE sys.%I SET %I = replace(%I,'Risk management bancario','Gestione del rischio bancario') WHERE %I LIKE '%%Risk management bancario%%'$q$, r.t, r.c, r.c, r.c);
    END IF;
  END LOOP;
END $$;
COMMIT;
SELECT 'J2 ok' esito, (SELECT count(*) FROM staging.rtl_allinea_testi_undo) voci_nel_giornale;
