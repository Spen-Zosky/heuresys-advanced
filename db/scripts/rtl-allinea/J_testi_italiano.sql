-- Voce 5 (mandato RTL 2026-11-11): testi in italiano. GENERATO da genera_J_testi.py: non si modifica a mano.
-- Idempotente: sostituisce solo valori esatti inglesi. Giornale: staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe).
-- Rollback: UPDATE <tabella> SET <colonna> = vecchio WHERE <colonna> = nuovo, per ogni riga del giornale.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_testi_undo (salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, colonna text NOT NULL, vecchio text NOT NULL, nuovo text NOT NULL, righe bigint NOT NULL, PRIMARY KEY (tabella, colonna, vecchio));
CREATE TEMP TABLE tr(tabella text, colonna text, en text, it text) ON COMMIT DROP;
INSERT INTO tr VALUES
('sys_calibration_discussions','calibration_discussion_adjustment_reason','Adjusted based on cross-team comparison','Rettificato in base al confronto fra team'),
('sys_calibration_discussions','calibration_discussion_adjustment_reason','Cross-team calibration adjustment based on peer comparison','Rettifica di calibrazione fra team in base al confronto fra pari'),
('sys_calibration_discussions','calibration_discussion_notes','Performance discussion completed. Employee reviewed against peers.','Discussione sulla performance conclusa. Persona confrontata con i pari.'),
('sys_calibration_sessions','calibration_session_department','Risk Management','Gestione dei Rischi'),
('sys_calibration_sessions','calibration_session_description','Annual calibration for all departments','Calibrazione annuale per tutte le direzioni'),
('sys_calibration_sessions','calibration_session_description','Calibration for Risk and Compliance teams','Calibrazione per i team Rischi e Compliance'),
('sys_calibration_sessions','calibration_session_description','Calibration of Q3 performance ratings for Operations department','Calibrazione dei giudizi di performance del terzo trimestre per la direzione Operations'),
('sys_calibration_sessions','calibration_session_description','Performance calibration session for Commercial Banking','Sessione di calibrazione della performance per la Banca Commerciale'),
('sys_calibration_sessions','calibration_session_description','Performance calibration session for Direzione Generale','Sessione di calibrazione della performance per la Direzione Generale'),
('sys_calibration_sessions','calibration_session_description','Performance calibration session for Finance & Treasury','Sessione di calibrazione della performance per Finanza e Tesoreria'),
('sys_calibration_sessions','calibration_session_description','Performance calibration session for Human Resources','Sessione di calibrazione della performance per le Risorse Umane'),
('sys_calibration_sessions','calibration_session_description','Performance calibration session for Information Technology','Sessione di calibrazione della performance per l''IT'),
('sys_calibration_sessions','calibration_session_description','Performance calibration session for Legal & Compliance','Sessione di calibrazione della performance per Legale e Compliance'),
('sys_calibration_sessions','calibration_session_description','Performance calibration session for Marketing','Sessione di calibrazione della performance per il Marketing'),
('sys_calibration_sessions','calibration_session_description','Performance calibration session for Operations','Sessione di calibrazione della performance per Operations'),
('sys_calibration_sessions','calibration_session_description','Performance calibration session for Retail Banking','Sessione di calibrazione della performance per il Retail Banking'),
('sys_calibration_sessions','calibration_session_description','Performance calibration session for Risk Management','Sessione di calibrazione della performance per la Gestione dei Rischi'),
('sys_calibration_sessions','calibration_session_description','Tech team calibration session','Sessione di calibrazione del team tecnologico'),
('sys_calibration_sessions','calibration_session_name','Calibration Risk Management 11/2025','Calibrazione Gestione dei Rischi 11/2025'),
('sys_calibration_sessions','calibration_session_name','Calibration Risk Management 12/2025','Calibrazione Gestione dei Rischi 12/2025'),
('sys_calibration_sessions','calibration_session_name','Calibration Risk Management 9/2025','Calibrazione Gestione dei Rischi 9/2025'),
('sys_calibration_sessions','calibration_session_name','Q3 2024 Performance Calibration - Risk & Compliance','Calibrazione della performance 3T 2024 - Rischi e Compliance'),
('sys_calibration_sessions','calibration_session_name','Calibration Legal & Compliance 10/2025','Calibrazione Legale e Compliance 10/2025'),
('sys_calibration_sessions','calibration_session_summary_notes','Aligned 12 ratings. 3 adjustments from initial manager ratings. Strong discussion on high-potential identification.','Allineati 12 giudizi, con 3 rettifiche rispetto ai giudizi iniziali dei responsabili. Discussione approfondita sull''individuazione degli alti potenziali.'),
('sys_calibration_sessions','calibration_session_summary_notes','Calibration session completed with consensus on ratings','Sessione di calibrazione conclusa con consenso sui giudizi'),
('sys_calibration_sessions','calibration_session_summary_notes','Good alignment across managers. Discussed promotion readiness for 4 senior engineers.','Buon allineamento fra i responsabili. Valutata la maturità alla promozione di 4 ingegneri senior.'),
('sys_calibration_sessions','calibration_session_summary_notes','Reviewed 18 employees. Identified 2 high potentials for succession planning.','Riesaminate 18 persone. Individuati 2 alti potenziali per la pianificazione della successione.'),
('sys_career_paths','career_path_description','Career path for software engineers from Junior to Principal','Percorso di carriera degli ingegneri del software da Junior a Principal'),
('sys_career_paths','career_path_description','Career progression from Analyst to Operations Director','Crescita professionale da Analista a Direttore Operations'),
('sys_career_paths','career_path_description','From developer to CTO path','Percorso da sviluppatore a responsabile della tecnologia'),
('sys_career_paths','career_path_description','Progression in risk analysis and management','Crescita nell''analisi e nella gestione dei rischi'),
('sys_career_paths','career_path_name','Risk Management Track','Percorso Gestione dei Rischi'),
('sys_career_paths','career_path_name','Compliance & Legal Track','Percorso Compliance e Legale'),
('sys_compensation_bands','compensation_band_name','Support Band 1','Fascia Supporto 1'),
('sys_compensation_bands','compensation_band_name','Support Band 2','Fascia Supporto 2'),
('sys_compensation_bands','compensation_band_name','Tech Band 1','Fascia Tecnica 1'),
('sys_compensation_bands','compensation_band_name','Tech Band 2','Fascia Tecnica 2'),
('sys_compensation_bands','compensation_band_name','Tech Band 3','Fascia Tecnica 3'),
('sys_compensation_bands','compensation_band_name','Professional Band 1','Fascia Professionale 1'),
('sys_compensation_bands','compensation_band_name','Professional Band 2','Fascia Professionale 2'),
('sys_compensation_bands','compensation_band_name','Professional Band 3','Fascia Professionale 3'),
('sys_compensation_bands','compensation_band_name','Management Band 1','Fascia Direttiva 1'),
('sys_compensation_bands','compensation_band_name','Management Band 2','Fascia Direttiva 2'),
('sys_compensation_bands','compensation_band_name','Executive Band 1','Fascia Dirigenziale 1'),
('sys_compensation_bands','compensation_band_name','Executive Band 2','Fascia Dirigenziale 2'),
('sys_continuous_feedback','feedback_message','Consider breaking down complex topics more for stakeholders.','Valuta di scomporre di più gli argomenti complessi per gli interlocutori.'),
('sys_continuous_feedback','feedback_message','Consider delegating more to develop your team.','Valuta di delegare di più per far crescere il tuo team.'),
('sys_continuous_feedback','feedback_message','Consider scheduling buffer time between client meetings.','Valuta di lasciare dei margini di tempo fra un incontro con i clienti e l''altro.'),
('sys_continuous_feedback','feedback_message','Consider using more visual aids in your reports. The data is solid but could be more accessible.','Valuta di usare più supporti visivi nei rapporti: i dati sono solidi ma potrebbero essere più accessibili.'),
('sys_continuous_feedback','feedback_message','Excellent handling of the difficult client situation!','Ottima gestione della situazione difficile con il cliente!'),
('sys_continuous_feedback','feedback_message','Excellent presentation on Q3 risk metrics. Very clear and well-structured.','Ottima presentazione sugli indicatori di rischio del terzo trimestre: molto chiara e ben strutturata.'),
('sys_continuous_feedback','feedback_message','Great job on the presentation today! Your clear communication really helped the team understand the project status.','Ottimo lavoro con la presentazione di oggi: la tua comunicazione chiara ha aiutato il team a capire lo stato del progetto.'),
('sys_continuous_feedback','feedback_message','Great presentation skills in the team meeting today!','Ottima capacità di presentazione nella riunione di team di oggi!'),
('sys_continuous_feedback','feedback_message','Great teamwork on the Basel III compliance review. Your attention to detail was outstanding.','Ottimo lavoro di squadra sulla revisione di conformità a Basilea III: la tua attenzione ai dettagli è stata eccellente.'),
('sys_continuous_feedback','feedback_message','Keep up the great work on the regulatory submissions!','Continua così con le segnalazioni regolamentari!'),
('sys_continuous_feedback','feedback_message','Really appreciate your support during the system migration!','Apprezzo molto il tuo supporto durante la migrazione del sistema!'),
('sys_continuous_feedback','feedback_message','The documentation you created will help the whole team.','La documentazione che hai preparato sarà utile a tutto il team.'),
('sys_continuous_feedback','feedback_message','The new process you suggested saved us significant time.','Il nuovo processo che hai proposto ci ha fatto risparmiare molto tempo.'),
('sys_continuous_feedback','feedback_message','Try using the new dashboard for faster reporting.','Prova il nuovo cruscotto per produrre i rapporti più in fretta.'),
('sys_continuous_feedback','feedback_message','You might want to involve the compliance team earlier next time.','La prossima volta valuta di coinvolgere prima il team compliance.'),
('sys_continuous_feedback','feedback_message','Your analysis on the risk report was very thorough.','La tua analisi nel rapporto sui rischi è stata molto accurata.'),
('sys_continuous_feedback','feedback_message','Your attention to detail on audits is exemplary.','La tua attenzione ai dettagli negli audit è esemplare.'),
('sys_continuous_feedback','feedback_message','Your cross-team collaboration really improved the outcome.','La tua collaborazione fra team ha migliorato davvero il risultato.'),
('sys_continuous_feedback','feedback_message','Your mentorship of the junior analysts is making a real difference.','Il tuo affiancamento degli analisti junior sta facendo una vera differenza.'),
('sys_engagement_action_plans','action_plan_title','Team building Q2 2025','Team building 2T 2025'),
('sys_engagement_surveys','survey_title','Wellbeing & Work-Life Balance Survey','Indagine su benessere ed equilibrio fra lavoro e vita privata'),
('sys_engagement_survey_templates','template_description','30-day onboarding experience survey for new hires','Indagine sull''esperienza di inserimento dei neoassunti a 30 giorni'),
('sys_engagement_survey_templates','template_description','Comprehensive engagement survey covering key dimensions of employee experience','Indagine completa sul coinvolgimento, sulle dimensioni principali dell''esperienza delle persone'),
('sys_engagement_survey_templates','template_description','Employee wellbeing and mental health check-in','Verifica del benessere e della salute mentale delle persone'),
('sys_engagement_survey_templates','template_description','Quick 3-question pulse check for weekly engagement tracking','Sondaggio rapido di 3 domande per il monitoraggio settimanale del coinvolgimento'),
('sys_engagement_survey_templates','template_description','Standard exit interview to understand departure reasons and gather feedback','Colloquio di uscita standard per capire i motivi dell''addio e raccogliere osservazioni'),
('sys_feedback_360_responses','response_areas_for_improvement','Could be better at saying no to non-priority items','Potrebbe dire più spesso di no alle attività non prioritarie'),
('sys_feedback_360_responses','response_areas_for_improvement','Could be more decisive under pressure','Potrebbe essere più deciso sotto pressione'),
('sys_feedback_360_responses','response_areas_for_improvement','Could be more flexible with changing priorities','Potrebbe essere più flessibile quando le priorità cambiano'),
('sys_feedback_360_responses','response_areas_for_improvement','Could develop strategic thinking skills','Potrebbe sviluppare il pensiero strategico'),
('sys_feedback_360_responses','response_areas_for_improvement','Could enhance cross-functional collaboration','Potrebbe rafforzare la collaborazione fra funzioni'),
('sys_feedback_360_responses','response_areas_for_improvement','Could improve delegation skills','Potrebbe migliorare la capacità di delega'),
('sys_feedback_360_responses','response_areas_for_improvement','Could improve time management','Potrebbe migliorare la gestione del tempo'),
('sys_feedback_360_responses','response_areas_for_improvement','Could share knowledge more often with the team','Potrebbe condividere più spesso le conoscenze con il team'),
('sys_feedback_360_responses','response_areas_for_improvement','Could take on more leadership opportunities','Potrebbe cogliere più occasioni di leadership'),
('sys_feedback_360_responses','response_areas_for_improvement','Need to improve public speaking skills','Deve migliorare la capacità di parlare in pubblico'),
('sys_feedback_360_responses','response_areas_for_improvement','Need to work on work-life balance','Deve lavorare sull''equilibrio fra lavoro e vita privata'),
('sys_feedback_360_responses','response_areas_for_improvement','Should network more across the organization','Dovrebbe costruire più relazioni nell''organizzazione'),
('sys_feedback_360_responses','response_areas_for_improvement','Want to develop more technical depth','Vuole approfondire di più le competenze tecniche'),
('sys_feedback_360_responses','response_areas_for_improvement','Would benefit from executive presence development','Gioverebbe sviluppare l''autorevolezza di ruolo'),
('sys_feedback_360_responses','response_areas_for_improvement','Would benefit from more proactive communication','Gioverebbe una comunicazione più proattiva'),
('sys_feedback_360_responses','response_strengths','Adaptable to changing business needs','Si adatta ai cambiamenti delle esigenze del business'),
('sys_feedback_360_responses','response_strengths','Consistently meets and often exceeds expectations','Rispetta sempre e spesso supera le aspettative'),
('sys_feedback_360_responses','response_strengths','Dedicated to professional growth and learning','Impegnato nella crescita professionale e nell''apprendimento'),
('sys_feedback_360_responses','response_strengths','Demonstrates strong ownership of responsibilities','Dimostra forte senso di responsabilità'),
('sys_feedback_360_responses','response_strengths','Effective at prioritizing and managing workload','Efficace nel definire le priorità e gestire il carico di lavoro'),
('sys_feedback_360_responses','response_strengths','Excellent collaboration and team support','Ottima collaborazione e supporto al team'),
('sys_feedback_360_responses','response_strengths','Good at building relationships across teams','Bravo a costruire relazioni fra i team'),
('sys_feedback_360_responses','response_strengths','Great attitude and positive team influence','Ottimo atteggiamento e influenza positiva sul team'),
('sys_feedback_360_responses','response_strengths','Reliable and consistently delivers quality work','Affidabile, consegna sempre lavoro di qualità'),
('sys_feedback_360_responses','response_strengths','Shows initiative and drives results','Prende iniziativa e porta risultati'),
('sys_feedback_360_responses','response_strengths','Strong analytical skills and attention to detail','Solide capacità analitiche e attenzione ai dettagli'),
('sys_feedback_360_responses','response_strengths','Strong commitment to quality and continuous improvement','Forte impegno per la qualità e il miglioramento continuo'),
('sys_feedback_360_responses','response_strengths','Strong communication and problem-solving skills','Solide capacità di comunicazione e di soluzione dei problemi'),
('sys_feedback_360_responses','response_strengths','Technical expertise and willingness to help others','Competenza tecnica e disponibilità ad aiutare gli altri'),
('sys_goals','goal_description','CI fixture goal','Obiettivo di verifica automatica'),
('sys_goals','goal_description','Ensure regulatory knowledge is current','Mantenere aggiornata la conoscenza normativa'),
('sys_goals','goal_description','Identify and implement cost saving measures','Individuare e attuare misure di contenimento dei costi'),
('sys_goals','goal_description','Improve complaint handling efficiency','Migliorare l''efficienza nella gestione dei reclami'),
('sys_goals','goal_description','Improve customer service quality and response times','Migliorare la qualità del servizio ai clienti e i tempi di risposta'),
('sys_goals','goal_description','Increase loan processing efficiency and volume','Aumentare l''efficienza e i volumi nell''istruttoria dei prestiti'),
('sys_goals','goal_description','Increase revenue through product bundling','Aumentare i ricavi con l''offerta di prodotti in pacchetto'),
('sys_goals','goal_description','Maintain banking platform availability and reliability','Mantenere disponibilità e affidabilità della piattaforma bancaria'),
('sys_goals','goal_description','Non-performing loans reduction through improved risk assessment','Ridurre i crediti deteriorati migliorando la valutazione del rischio'),
('sys_goals','goal_description','Optimize payment and transfer processing workflows','Ottimizzare i flussi di elaborazione di pagamenti e bonifici'),
('sys_goals','goal_description','Reduce fraud incidents by 25%','Ridurre del 25% gli episodi di frode'),
('sys_goals','goal_description','Support team development and knowledge transfer','Sostenere la crescita del team e il passaggio di conoscenze'),
('sys_goals','goal_title','Achieve 95% regulatory compliance score - Q4 2025','Raggiungere il 95% di indice di conformità normativa - 4T 2025'),
('sys_goals','goal_title','Achieve 99.9% system uptime - Q4 2025','Raggiungere il 99,9% di disponibilità dei sistemi - 4T 2025'),
('sys_goals','goal_title','Achieve quarterly revenue targets - Q4 2025','Raggiungere gli obiettivi di ricavo trimestrali - 4T 2025'),
('sys_goals','goal_title','Complete AML certification - Q4 2025','Completare la certificazione antiriciclaggio - 4T 2025'),
('sys_goals','goal_title','Complete Basel III compliance training - Q4 2025','Completare la formazione sulla conformità a Basilea III - 4T 2025'),
('sys_goals','goal_title','Complete digital banking training program - Q4 2025','Completare il programma di formazione sul digital banking - 4T 2025'),
('sys_goals','goal_title','Complete RBP compliance training','Completare la formazione di conformità RBP'),
('sys_goals','goal_title','Improve HR onboarding TTD by 20%','Ridurre del 20% i tempi di inserimento delle persone neoassunte'),
('sys_goals','goal_title','Increase customer satisfaction to 4.5/5 - Q4 2025','Portare la soddisfazione dei clienti a 4,5/5 - 4T 2025'),
('sys_goals','goal_title','Mentor 2 junior team members - Q4 2025','Affiancare 2 colleghi junior - 4T 2025'),
('sys_goals','goal_title','Process 500 loan applications monthly - Q4 2025','Istruire 500 richieste di prestito al mese - 4T 2025'),
('sys_goals','goal_title','Reduce customer complaint resolution time to 24h - Q4 2025','Ridurre a 24 ore il tempo di risoluzione dei reclami - 4T 2025'),
('sys_goals','goal_title','Reduce NPL ratio by 15% - Q4 2025','Ridurre del 15% l''incidenza dei crediti deteriorati - 4T 2025'),
('sys_goals','goal_title','Reduce operational costs by 10% - Q4 2025','Ridurre del 10% i costi operativi - 4T 2025'),
('sys_goals','goal_title','Reduce transaction processing time by 20% - Q4 2025','Ridurre del 20% i tempi di elaborazione delle transazioni - 4T 2025'),
('sys_job_roles','job_role_description','Department manager','Responsabile di direzione'),
('sys_job_roles','job_role_description','Senior department manager','Responsabile di direzione senior'),
('sys_job_roles','job_role_description','In-house legal counsel — contracts, corporate & regulatory law, litigation support.','Consulenza legale interna: contratti, diritto societario e regolamentare, supporto al contenzioso.'),
('sys_kpi_definitions','kpi_definition_name','Findings closure time','Tempo di chiusura dei rilievi'),
('sys_kpi_definitions','kpi_definition_name','Goal Completion','Completamento degli obiettivi'),
('sys_kpi_definitions','kpi_definition_name','KYC verification time','Tempo di verifica KYC'),
('sys_kpi_definitions','kpi_definition_name','Mean time to resolve','Tempo medio di risoluzione'),
('sys_kpi_definitions','kpi_definition_name','New Product Success Rate','Tasso di successo dei nuovi prodotti'),
('sys_kpi_definitions','kpi_definition_name','Risk-weighted assets','Attività ponderate per il rischio'),
('sys_kpi_definitions','kpi_definition_name','Time-to-hire','Tempo di assunzione'),
('sys_kpi_definitions','kpi_definition_name','Time to Hire','Tempo di assunzione'),
('sys_kpi_definitions','kpi_definition_name','Training Hours','Ore di formazione'),
('sys_kpi_metric_definitions','kpi_metric_definition_name','AML alert resolution time','Tempo di chiusura delle segnalazioni antiriciclaggio'),
('sys_kpi_metric_definitions','kpi_metric_definition_name','Customer activation rate','Tasso di attivazione dei clienti'),
('sys_kpi_metric_definitions','kpi_metric_definition_name','Customer NPS','Soddisfazione dei clienti (NPS)'),
('sys_kpi_metric_definitions','kpi_metric_definition_name','Findings closure time','Tempo di chiusura dei rilievi'),
('sys_kpi_metric_definitions','kpi_metric_definition_name','Goal Completion','Completamento degli obiettivi'),
('sys_kpi_metric_definitions','kpi_metric_definition_name','KYC verification time','Tempo di verifica KYC'),
('sys_kpi_metric_definitions','kpi_metric_definition_name','Mean time to resolve','Tempo medio di risoluzione'),
('sys_kpi_metric_definitions','kpi_metric_definition_name','New Product Success Rate','Tasso di successo dei nuovi prodotti'),
('sys_kpi_metric_definitions','kpi_metric_definition_name','Risk Assessment Accuracy','Accuratezza della valutazione del rischio'),
('sys_kpi_metric_definitions','kpi_metric_definition_name','Risk-weighted assets','Attività ponderate per il rischio'),
('sys_kpi_metric_definitions','kpi_metric_definition_name','Time-to-hire','Tempo di assunzione'),
('sys_kpi_metric_definitions','kpi_metric_definition_name','Time to Hire','Tempo di assunzione'),
('sys_kpi_metric_definitions','kpi_metric_definition_name','Training Hours','Ore di formazione'),
('sys_leave_accrual_rules','accrual_rule_name','annual Accrual Policy','Maturazione ferie'),
('sys_leave_accrual_rules','accrual_rule_name','sick Accrual Policy','Maturazione malattia'),
('sys_leave_accrual_rules','accrual_rule_name','personal Accrual Policy','Maturazione permessi personali'),
('sys_leave_accrual_rules','accrual_rule_name','parental Accrual Policy','Maturazione permessi parentali'),
('sys_leave_accrual_rules','accrual_rule_name','bereavement Accrual Policy','Maturazione permessi per lutto'),
('sys_leave_accrual_rules','accrual_rule_description','Standard accrual policy for annual','Regola standard di maturazione delle ferie'),
('sys_leave_accrual_rules','accrual_rule_description','Standard accrual policy for sick','Regola standard di maturazione dei giorni di malattia'),
('sys_leave_accrual_rules','accrual_rule_description','Standard accrual policy for personal','Regola standard di maturazione dei permessi personali'),
('sys_leave_accrual_rules','accrual_rule_description','Standard accrual policy for parental','Regola standard di maturazione dei permessi parentali'),
('sys_leave_accrual_rules','accrual_rule_description','Standard accrual policy for bereavement','Regola standard di maturazione dei permessi per lutto'),
('sys_leave_balance_transactions','transaction_description','Year-end adjustment','Rettifica di fine anno'),
('sys_leave_balance_transactions','transaction_description','Carryover from previous year','Riporto dall''anno precedente'),
('sys_leave_balance_transactions','transaction_description','Leave taken','Giorni goduti'),
('sys_leave_balance_transactions','transaction_description','Monthly accrual','Maturazione mensile'),
('sys_mentor_match_scores','match_skill_name','Project Management','Gestione dei progetti'),
('sys_mentorship_programs','program_name','New Manager Accelerator','Acceleratore per nuovi responsabili'),
('sys_mentorship_sessions','session_notes','Productive session covering key topics. Action items assigned.','Incontro produttivo sugli argomenti principali. Assegnate le azioni.'),
('sys_mentorship_sessions','session_notes','Productive session covering key topics. Good progress on goals.','Incontro produttivo sugli argomenti principali. Buoni progressi sugli obiettivi.'),
('sys_mentorship_sessions','session_notes','Productive session covering key topics. Great insights shared.','Incontro produttivo sugli argomenti principali. Condivisi spunti molto utili.'),
('sys_mentorship_sessions','session_notes','Productive session covering key topics. Identified areas for improvement.','Incontro produttivo sugli argomenti principali. Individuate aree di miglioramento.'),
('sys_objective_reward_rules','objective_reward_rule_name','Annual Performance Bonus 2024','Premio annuale di performance 2024'),
('sys_objective_reward_rules','objective_reward_rule_name','Digital Project Bonus','Premio per progetti digitali'),
('sys_okr_key_results','key_result_description','Increase digital onboarding rate','Aumentare la quota di clienti acquisiti con l''apertura digitale'),
('sys_okr_key_results','key_result_description','Increase mobile app daily active users','Aumentare gli utenti attivi giornalieri dell''app'),
('sys_okr_key_results','key_result_description','Launch 3 new digital products','Lanciare 3 nuovi prodotti digitali'),
('sys_okr_key_results','key_result_description','Reduce average loan approval time','Ridurre il tempo medio di approvazione dei prestiti'),
('sys_okrs','okr_department','Risk Management','Gestione dei Rischi'),
('sys_okrs','okr_objective','Achieve 15% growth in digital banking transactions','Raggiungere una crescita del 15% delle operazioni di digital banking'),
('sys_okrs','okr_objective','Achieve 98% AML compliance score','Raggiungere il 98% di indice di conformità antiriciclaggio'),
('sys_okrs','okr_objective','Achieve B Corp certification','Ottenere la certificazione B Corp'),
('sys_okrs','okr_objective','Complete core banking system modernization Phase 1','Completare la fase 1 dell''ammodernamento del sistema di core banking'),
('sys_okrs','okr_objective','Expand to 3 new regional markets','Entrare in 3 nuovi mercati regionali'),
('sys_okrs','okr_objective','Improve customer satisfaction (NPS) to 65+','Portare la soddisfazione dei clienti (NPS) a 65 e oltre'),
('sys_okrs','okr_objective','Increase corporate lending by 20%','Aumentare del 20% i finanziamenti alle imprese'),
('sys_okrs','okr_objective','Launch organic product line with 15 SKUs','Lanciare una linea di prodotti sostenibili con 15 articoli'),
('sys_okrs','okr_objective','Reduce food waste by 25% across operations','Ridurre del 25% gli sprechi in tutta l''operatività'),
('sys_okrs','okr_objective','Reduce loan processing time by 30%','Ridurre del 30% i tempi di istruttoria dei prestiti'),
('sys_okrs','okr_objective','Reduce NPL ratio to below 2.5%','Ridurre l''incidenza dei crediti deteriorati sotto il 2,5%'),
('sys_okrs','okr_objective','Reduce operational costs by 12%','Ridurre del 12% i costi operativi'),
('sys_organization_units','organization_unit_name','Direzione Risk Management','Direzione Gestione dei Rischi'),
('sys_organization_units','organization_unit_name','Divisione Risk & Compliance','Divisione Rischi e Compliance'),
('sys_overtime','overtime_reason','Emergency support','Supporto in emergenza'),
('sys_overtime','overtime_reason','Project deadline','Scadenza di progetto'),
('sys_performance_review_competency_ratings','rating_manager_comment','Good technical output quality','Buona qualità del lavoro tecnico'),
('sys_performance_review_competency_ratings','rating_self_comment','I applied my skills effectively to project deliverables','Ho applicato con efficacia le mie competenze ai risultati dei progetti'),
('sys_performance_review_competency_ratings','rating_self_comment','I have developed strong domain knowledge this period','In questo periodo ho sviluppato una solida conoscenza del settore'),
('sys_predictive_models','model_name','Turnover Risk Model','Modello di rischio di uscita'),
('sys_projects','project_name','Divisione Risk & Compliance','Divisione Rischi e Compliance'),
('sys_projects','project_name','Squadra Risk Management','Squadra Gestione dei Rischi'),
('sys_teams','team_name','Divisione Risk & Compliance','Divisione Rischi e Compliance'),
('sys_teams','team_name','Squadra Risk Management','Squadra Gestione dei Rischi'),
('sys_teams','team_name','Team Delivery Clienti','Squadra Servizio Clienti'),
('sys_pulse_checks','pulse_check_comment','A bit stressed with the Q4 deadline approaching','Un po'' di stress con la scadenza del quarto trimestre in arrivo'),
('sys_pulse_checks','pulse_check_comment','Feeling productive today, good team collaboration','Oggi mi sento produttivo, buona collaborazione nel team'),
('sys_pulse_checks','pulse_check_comment','Good balance this week, taking time for exercise','Buon equilibrio questa settimana, ho trovato il tempo per fare movimento'),
('sys_pulse_checks','pulse_check_comment','Great meeting with mentor, feeling motivated','Ottimo incontro con il mentore, mi sento motivato'),
('sys_pulse_checks','pulse_check_comment','Great team collaboration','Ottima collaborazione nel team'),
('sys_pulse_checks','pulse_check_comment','Heavy workload but manageable with proper planning','Carico di lavoro pesante ma gestibile con una buona pianificazione'),
('sys_pulse_checks','pulse_check_comment','Looking forward to the project launch','Non vedo l''ora del lancio del progetto'),
('sys_pulse_checks','pulse_check_comment','Need more clarity on priorities','Serve maggiore chiarezza sulle priorità'),
('sys_pulse_checks','pulse_check_comment','Need to take more breaks, feeling tired','Devo fare più pause, mi sento stanco'),
('sys_pulse_checks','pulse_check_comment','Project launch went well, celebrating small wins','Il lancio del progetto è andato bene, festeggiamo i piccoli successi'),
('sys_reward_gate_catalog','reward_gate_catalog_description','All mandatory compliance training completed.','Tutta la formazione obbligatoria di conformità è stata completata.'),
('sys_reward_gate_catalog','reward_gate_catalog_description','All required training completed and assessed.','Tutta la formazione richiesta è stata completata e valutata.'),
('sys_reward_gate_catalog','reward_gate_catalog_description','No conduct violations during evaluation period.','Nessuna violazione di condotta nel periodo di valutazione.'),
('sys_reward_gate_catalog','reward_gate_catalog_description','No open critical risk findings.','Nessun rilievo critico di rischio ancora aperto.'),
('sys_reward_gate_catalog','reward_gate_catalog_description','No substantiated customer harm complaints.','Nessun reclamo fondato per danno ai clienti.'),
('sys_reward_gate_catalog','reward_gate_catalog_name','Customer Harm Gate','Cancello danno ai clienti'),
('sys_reward_gate_catalog','reward_gate_catalog_name','Risk Gate','Cancello rischi'),
('sys_reward_gate_catalog','reward_gate_catalog_name','Training Gate','Cancello formazione'),
('sys_reward_gate_catalog','reward_gate_catalog_name','Compliance Gate','Cancello conformità'),
('sys_succession_pools','succession_pool_name','Successione — Responsabile Direzione Risk Management','Successione — Responsabile Direzione Gestione dei Rischi'),
('sys_survey_questions','survey_question_text','Communication from leadership is clear and transparent','La comunicazione dei vertici è chiara e trasparente'),
('sys_survey_questions','survey_question_text','How likely are you to recommend us as a workplace?','Con quale probabilità ci consiglieresti come luogo di lavoro?'),
('sys_survey_questions','survey_question_text','I collaborate effectively with my team','Collaboro in modo efficace con il mio team'),
('sys_survey_questions','survey_question_text','I feel a sense of belonging at work','Sul lavoro mi sento parte di una comunità'),
('sys_survey_questions','survey_question_text','I feel comfortable sharing my ideas and opinions','Mi sento a mio agio nel condividere idee e opinioni'),
('sys_survey_questions','survey_question_text','I feel motivated at work this quarter','In questo trimestre mi sento motivato al lavoro'),
('sys_survey_questions','survey_question_text','I feel proud to work for this company','Sono orgoglioso di lavorare per questa azienda'),
('sys_survey_questions','survey_question_text','I feel valued for my contributions','Mi sento valorizzato per il mio contributo'),
('sys_survey_questions','survey_question_text','I feel valued for the work I do','Mi sento valorizzato per il lavoro che svolgo'),
('sys_survey_questions','survey_question_text','I have opportunities for growth and development','Ho opportunità di crescita e di sviluppo'),
('sys_survey_questions','survey_question_text','I have the resources I need to do my job effectively','Ho le risorse necessarie per lavorare in modo efficace'),
('sys_survey_questions','survey_question_text','I have the tools and resources to do my job well','Ho gli strumenti e le risorse per fare bene il mio lavoro'),
('sys_survey_questions','survey_question_text','I see a clear path for career growth here','Vedo un percorso chiaro di crescita professionale'),
('sys_survey_questions','survey_question_text','I understand how my work contributes to company goals','So come il mio lavoro contribuisce agli obiettivi dell''azienda'),
('sys_survey_questions','survey_question_text','I would recommend this company as a great place to work','Consiglierei questa azienda come ottimo posto di lavoro'),
('sys_survey_questions','survey_question_text','My compensation is fair for my role','La mia retribuzione è equa rispetto al mio ruolo'),
('sys_survey_questions','survey_question_text','My manager supports my growth and development','Il mio responsabile sostiene la mia crescita e il mio sviluppo'),
('sys_survey_questions','survey_question_text','My manager supports my professional development','Il mio responsabile sostiene il mio sviluppo professionale'),
('sys_survey_questions','survey_question_text','My workload is manageable','Il mio carico di lavoro è gestibile'),
('sys_survey_questions','survey_question_text','The company culture promotes work-life balance','La cultura aziendale favorisce l''equilibrio fra lavoro e vita privata'),
('sys_surveys','survey_description','Annual engagement survey measuring employee satisfaction, culture, and workplace experience','Indagine annuale sul coinvolgimento: soddisfazione, cultura ed esperienza sul luogo di lavoro'),
('sys_surveys','survey_description','Assessment of management quality','Valutazione della qualità della gestione'),
('sys_surveys','survey_description','Comprehensive annual engagement assessment','Valutazione annuale completa del coinvolgimento'),
('sys_surveys','survey_description','Feedback from new employees about onboarding','Opinioni dei neoassunti sull''inserimento'),
('sys_surveys','survey_description','Feedback on new digital banking tools','Opinioni sui nuovi strumenti di digital banking'),
('sys_surveys','survey_title','Annual Engagement Survey 2025','Indagine annuale sul coinvolgimento 2025'),
('sys_surveys','survey_title','Manager Effectiveness Survey','Indagine sull''efficacia dei responsabili'),
('sys_surveys','survey_title','New Hire Onboarding Survey','Indagine sull''inserimento dei neoassunti'),
('sys_tenant_consolidation_working_items','tenant_consolidation_working_item_original_name','Direzione Risk Management','Direzione Gestione dei Rischi'),
('sys_tenant_consolidation_working_items','tenant_consolidation_working_item_translated_name','Direzione Risk Management','Direzione Gestione dei Rischi'),
('sys_time_off_requests','request_reason','Annual holiday','Ferie annuali'),
('sys_time_off_requests','request_reason','Annual leave','Ferie annuali'),
('sys_positions','position_title','Bank Manager','Direttore di Filiale'),
('sys_positions','position_title','Bank manager','Direttore di Filiale'),
('sys_positions','position_title','Bank Teller','Cassiere'),
('sys_positions','position_title','Bank teller','Cassiere'),
('sys_positions','position_title','Back Office Specialist','Specialista Back Office'),
('sys_positions','position_title','Chief Risk Officer','Direttore Rischi'),
('sys_positions','position_title','Financial Analyst','Analista Finanziario'),
('sys_positions','position_title','Financial analyst','Analista Finanziario'),
('sys_positions','position_title','Risk Analyst','Analista Rischio'),
('sys_positions','position_title','Risk analyst','Analista Rischio'),
('sys_positions','position_title','Compliance Officer','Specialista Compliance'),
('sys_positions','position_title','Compliance officer','Specialista Compliance'),
('sys_positions','position_title','Investment Advisor','Consulente Investimenti'),
('sys_positions','position_title','Investment advisor','Consulente Investimenti'),
('sys_positions','position_title','Securities Dealer','Operatore Titoli'),
('sys_positions','position_title','Securities dealer','Operatore Titoli'),
('sys_positions','position_title','Head of Commercial Banking','Direttore Commerciale'),
('sys_positions','position_title','Head of Internal Audit','Responsabile Internal Audit'),
('sys_positions','position_title','Head of Marketing','Responsabile Marketing'),
('sys_positions','position_title','Head of Product','Responsabile Prodotti'),
('sys_positions','position_title','Head of Treasury','Responsabile Tesoreria'),
('sys_positions','position_title','Head of Legal & Compliance','Responsabile Legale e Compliance'),
('sys_positions','position_title','HR Manager','Responsabile Risorse Umane'),
('sys_positions','position_title','HR Director','Direttore Risorse Umane'),
('sys_positions','position_title','IT Director','Direttore IT e Digital'),
('sys_positions','position_title','Operations Director','Direttore Operations'),
('sys_positions','position_title','Retail Director','Direttore Retail Banking'),
('sys_positions','position_title','Finance Director','Direttore Finanza e Amministrazione'),
('sys_positions','position_title','CEO','Direttore Generale'),
('sys_positions','position_title','Line Manager - Operations','Responsabile Operations'),
('sys_positions','position_title','Risk Manager','Responsabile Gestione Rischi'),
('sys_positions','position_title','Risk manager','Responsabile Gestione Rischi'),
('sys_positions','position_title','Payment Specialist','Specialista Pagamenti'),
('sys_positions','position_title','Payment specialist','Specialista Pagamenti'),
('sys_positions','position_title','Software Developer','Sviluppatore Software'),
('sys_positions','position_title','Software developer','Sviluppatore Software'),
('sys_positions','position_title','System Administrator','Sistemista'),
('sys_positions','position_title','System administrator','Sistemista'),
('sys_positions','position_title','Legal Counsel','Legale'),
('sys_positions','position_title','Legal counsel','Legale'),
('sys_positions','position_title','Responsabile Direzione Risk Management','Responsabile Direzione Gestione dei Rischi'),
('sys_user_contracts','user_contract_job_title','Bank Manager','Direttore di Filiale'),
('sys_user_contracts','user_contract_job_title','Bank manager','Direttore di Filiale'),
('sys_user_contracts','user_contract_job_title','Bank Teller','Cassiere'),
('sys_user_contracts','user_contract_job_title','Bank teller','Cassiere'),
('sys_user_contracts','user_contract_job_title','Back Office Specialist','Specialista Back Office'),
('sys_user_contracts','user_contract_job_title','Chief Risk Officer','Direttore Rischi'),
('sys_user_contracts','user_contract_job_title','Financial Analyst','Analista Finanziario'),
('sys_user_contracts','user_contract_job_title','Financial analyst','Analista Finanziario'),
('sys_user_contracts','user_contract_job_title','Risk Analyst','Analista Rischio'),
('sys_user_contracts','user_contract_job_title','Risk analyst','Analista Rischio'),
('sys_user_contracts','user_contract_job_title','Compliance Officer','Specialista Compliance'),
('sys_user_contracts','user_contract_job_title','Compliance officer','Specialista Compliance'),
('sys_user_contracts','user_contract_job_title','Investment Advisor','Consulente Investimenti'),
('sys_user_contracts','user_contract_job_title','Investment advisor','Consulente Investimenti'),
('sys_user_contracts','user_contract_job_title','Securities Dealer','Operatore Titoli'),
('sys_user_contracts','user_contract_job_title','Securities dealer','Operatore Titoli'),
('sys_user_contracts','user_contract_job_title','Head of Commercial Banking','Direttore Commerciale'),
('sys_user_contracts','user_contract_job_title','Head of Internal Audit','Responsabile Internal Audit'),
('sys_user_contracts','user_contract_job_title','Head of Marketing','Responsabile Marketing'),
('sys_user_contracts','user_contract_job_title','Head of Product','Responsabile Prodotti'),
('sys_user_contracts','user_contract_job_title','Head of Treasury','Responsabile Tesoreria'),
('sys_user_contracts','user_contract_job_title','Head of Legal & Compliance','Responsabile Legale e Compliance'),
('sys_user_contracts','user_contract_job_title','HR Manager','Responsabile Risorse Umane'),
('sys_user_contracts','user_contract_job_title','HR Director','Direttore Risorse Umane'),
('sys_user_contracts','user_contract_job_title','IT Director','Direttore IT e Digital'),
('sys_user_contracts','user_contract_job_title','Operations Director','Direttore Operations'),
('sys_user_contracts','user_contract_job_title','Retail Director','Direttore Retail Banking'),
('sys_user_contracts','user_contract_job_title','Finance Director','Direttore Finanza e Amministrazione'),
('sys_user_contracts','user_contract_job_title','CEO','Direttore Generale'),
('sys_user_contracts','user_contract_job_title','Line Manager - Operations','Responsabile Operations'),
('sys_user_contracts','user_contract_job_title','Risk Manager','Responsabile Gestione Rischi'),
('sys_user_contracts','user_contract_job_title','Risk manager','Responsabile Gestione Rischi'),
('sys_user_contracts','user_contract_job_title','Payment Specialist','Specialista Pagamenti'),
('sys_user_contracts','user_contract_job_title','Payment specialist','Specialista Pagamenti'),
('sys_user_contracts','user_contract_job_title','Software Developer','Sviluppatore Software'),
('sys_user_contracts','user_contract_job_title','Software developer','Sviluppatore Software'),
('sys_user_contracts','user_contract_job_title','System Administrator','Sistemista'),
('sys_user_contracts','user_contract_job_title','System administrator','Sistemista'),
('sys_user_contracts','user_contract_job_title','Legal Counsel','Legale'),
('sys_user_contracts','user_contract_job_title','Legal counsel','Legale'),
('sys_user_contracts','user_contract_job_title','Responsabile Direzione Risk Management','Responsabile Direzione Gestione dei Rischi'),
('sys_job_postings','posting_title','Bank Manager','Direttore di Filiale'),
('sys_job_postings','posting_title','Bank manager','Direttore di Filiale'),
('sys_job_postings','posting_title','Bank Teller','Cassiere'),
('sys_job_postings','posting_title','Bank teller','Cassiere'),
('sys_job_postings','posting_title','Back Office Specialist','Specialista Back Office'),
('sys_job_postings','posting_title','Chief Risk Officer','Direttore Rischi'),
('sys_job_postings','posting_title','Financial Analyst','Analista Finanziario'),
('sys_job_postings','posting_title','Financial analyst','Analista Finanziario'),
('sys_job_postings','posting_title','Risk Analyst','Analista Rischio'),
('sys_job_postings','posting_title','Risk analyst','Analista Rischio'),
('sys_job_postings','posting_title','Compliance Officer','Specialista Compliance'),
('sys_job_postings','posting_title','Compliance officer','Specialista Compliance'),
('sys_job_postings','posting_title','Investment Advisor','Consulente Investimenti'),
('sys_job_postings','posting_title','Investment advisor','Consulente Investimenti'),
('sys_job_postings','posting_title','Securities Dealer','Operatore Titoli'),
('sys_job_postings','posting_title','Securities dealer','Operatore Titoli'),
('sys_job_postings','posting_title','Head of Commercial Banking','Direttore Commerciale'),
('sys_job_postings','posting_title','Head of Internal Audit','Responsabile Internal Audit'),
('sys_job_postings','posting_title','Head of Marketing','Responsabile Marketing'),
('sys_job_postings','posting_title','Head of Product','Responsabile Prodotti'),
('sys_job_postings','posting_title','Head of Treasury','Responsabile Tesoreria'),
('sys_job_postings','posting_title','Head of Legal & Compliance','Responsabile Legale e Compliance'),
('sys_job_postings','posting_title','HR Manager','Responsabile Risorse Umane'),
('sys_job_postings','posting_title','HR Director','Direttore Risorse Umane'),
('sys_job_postings','posting_title','IT Director','Direttore IT e Digital'),
('sys_job_postings','posting_title','Operations Director','Direttore Operations'),
('sys_job_postings','posting_title','Retail Director','Direttore Retail Banking'),
('sys_job_postings','posting_title','Finance Director','Direttore Finanza e Amministrazione'),
('sys_job_postings','posting_title','CEO','Direttore Generale'),
('sys_job_postings','posting_title','Line Manager - Operations','Responsabile Operations'),
('sys_job_postings','posting_title','Risk Manager','Responsabile Gestione Rischi'),
('sys_job_postings','posting_title','Risk manager','Responsabile Gestione Rischi'),
('sys_job_postings','posting_title','Payment Specialist','Specialista Pagamenti'),
('sys_job_postings','posting_title','Payment specialist','Specialista Pagamenti'),
('sys_job_postings','posting_title','Software Developer','Sviluppatore Software'),
('sys_job_postings','posting_title','Software developer','Sviluppatore Software'),
('sys_job_postings','posting_title','System Administrator','Sistemista'),
('sys_job_postings','posting_title','System administrator','Sistemista'),
('sys_job_postings','posting_title','Legal Counsel','Legale'),
('sys_job_postings','posting_title','Legal counsel','Legale'),
('sys_job_postings','posting_title','Responsabile Direzione Risk Management','Responsabile Direzione Gestione dei Rischi'),
('sys_positions','position_title','Back office specialist','Specialista Back Office'),
('sys_positions','position_title','Chief risk officer','Direttore Rischi'),
('sys_positions','position_title','Head of commercial banking','Direttore Commerciale'),
('sys_positions','position_title','Head of internal audit','Responsabile Internal Audit'),
('sys_positions','position_title','Head of marketing','Responsabile Marketing'),
('sys_positions','position_title','Head of product','Responsabile Prodotti'),
('sys_positions','position_title','Head of treasury','Responsabile Tesoreria'),
('sys_positions','position_title','Head of legal & compliance','Responsabile Legale e Compliance'),
('sys_positions','position_title','Hr manager','Responsabile Risorse Umane'),
('sys_positions','position_title','Hr director','Direttore Risorse Umane'),
('sys_positions','position_title','It director','Direttore IT e Digital'),
('sys_positions','position_title','Operations director','Direttore Operations'),
('sys_positions','position_title','Retail director','Direttore Retail Banking'),
('sys_positions','position_title','Finance director','Direttore Finanza e Amministrazione'),
('sys_positions','position_title','Ceo','Direttore Generale'),
('sys_positions','position_title','Line manager - operations','Responsabile Operations'),
('sys_positions','position_title','Responsabile direzione risk management','Responsabile Direzione Gestione dei Rischi'),
('sys_user_contracts','user_contract_job_title','Back office specialist','Specialista Back Office'),
('sys_user_contracts','user_contract_job_title','Chief risk officer','Direttore Rischi'),
('sys_user_contracts','user_contract_job_title','Head of commercial banking','Direttore Commerciale'),
('sys_user_contracts','user_contract_job_title','Head of internal audit','Responsabile Internal Audit'),
('sys_user_contracts','user_contract_job_title','Head of marketing','Responsabile Marketing'),
('sys_user_contracts','user_contract_job_title','Head of product','Responsabile Prodotti'),
('sys_user_contracts','user_contract_job_title','Head of treasury','Responsabile Tesoreria'),
('sys_user_contracts','user_contract_job_title','Head of legal & compliance','Responsabile Legale e Compliance'),
('sys_user_contracts','user_contract_job_title','Hr manager','Responsabile Risorse Umane'),
('sys_user_contracts','user_contract_job_title','Hr director','Direttore Risorse Umane'),
('sys_user_contracts','user_contract_job_title','It director','Direttore IT e Digital'),
('sys_user_contracts','user_contract_job_title','Operations director','Direttore Operations'),
('sys_user_contracts','user_contract_job_title','Retail director','Direttore Retail Banking'),
('sys_user_contracts','user_contract_job_title','Finance director','Direttore Finanza e Amministrazione'),
('sys_user_contracts','user_contract_job_title','Ceo','Direttore Generale'),
('sys_user_contracts','user_contract_job_title','Line manager - operations','Responsabile Operations'),
('sys_user_contracts','user_contract_job_title','Responsabile direzione risk management','Responsabile Direzione Gestione dei Rischi'),
('sys_job_postings','posting_title','Back office specialist','Specialista Back Office'),
('sys_job_postings','posting_title','Chief risk officer','Direttore Rischi'),
('sys_job_postings','posting_title','Head of commercial banking','Direttore Commerciale'),
('sys_job_postings','posting_title','Head of internal audit','Responsabile Internal Audit'),
('sys_job_postings','posting_title','Head of marketing','Responsabile Marketing'),
('sys_job_postings','posting_title','Head of product','Responsabile Prodotti'),
('sys_job_postings','posting_title','Head of treasury','Responsabile Tesoreria'),
('sys_job_postings','posting_title','Head of legal & compliance','Responsabile Legale e Compliance'),
('sys_job_postings','posting_title','Hr manager','Responsabile Risorse Umane'),
('sys_job_postings','posting_title','Hr director','Direttore Risorse Umane'),
('sys_job_postings','posting_title','It director','Direttore IT e Digital'),
('sys_job_postings','posting_title','Operations director','Direttore Operations'),
('sys_job_postings','posting_title','Retail director','Direttore Retail Banking'),
('sys_job_postings','posting_title','Finance director','Direttore Finanza e Amministrazione'),
('sys_job_postings','posting_title','Ceo','Direttore Generale'),
('sys_job_postings','posting_title','Line manager - operations','Responsabile Operations'),
('sys_job_postings','posting_title','Responsabile direzione risk management','Responsabile Direzione Gestione dei Rischi'),
('sys_learning_modules','learning_module_title','ABA Bank Teller Certificate - Foundations','Certificato ABA per cassieri - Fondamenti'),
('sys_learning_modules','learning_module_title','Advanced Data Analysis','Analisi avanzata dei dati'),
('sys_learning_modules','learning_module_title','AML Transaction Monitoring','Monitoraggio delle transazioni antiriciclaggio'),
('sys_learning_modules','learning_module_title','Basel III Framework - Capital Requirements','Basilea III - Requisiti patrimoniali'),
('sys_learning_modules','learning_module_title','Basel IV - New Advances in Banking Regulation','Basilea IV - Le novità della regolamentazione bancaria'),
('sys_learning_modules','learning_module_title','CAMS - Certified Anti-Money Laundering Specialist Prep','CAMS - Preparazione alla certificazione antiriciclaggio'),
('sys_learning_modules','learning_module_title','Cash Handling & Counterfeit Detection','Gestione del contante e riconoscimento delle banconote false'),
('sys_learning_modules','learning_module_title','Cloud Computing AWS','Cloud computing con AWS'),
('sys_learning_modules','learning_module_title','Core Banking Systems Overview','Panoramica dei sistemi di core banking'),
('sys_learning_modules','learning_module_title','Credit Risk Analysis Fundamentals','Fondamenti di analisi del rischio di credito'),
('sys_learning_modules','learning_module_title','Customer Service Excellence in Banking','Eccellenza nel servizio al cliente in banca'),
('sys_learning_modules','learning_module_title','Cybersecurity in Financial Services','Sicurezza informatica nei servizi finanziari'),
('sys_learning_modules','learning_module_title','Data Analytics for Banking','Analisi dei dati per il settore bancario'),
('sys_learning_modules','learning_module_title','Design Thinking','Design thinking'),
('sys_learning_modules','learning_module_title','ESG Investing & Sustainable Finance','Investimenti ESG e finanza sostenibile'),
('sys_learning_modules','learning_module_title','Ethical Sales in Banking','Vendita etica in banca'),
('sys_learning_modules','learning_module_title','Financial Literacy for Customer Education','Educazione finanziaria per la clientela'),
('sys_learning_modules','learning_module_title','Fraud Prevention for Frontline Staff','Prevenzione delle frodi per il personale di prima linea'),
('sys_learning_modules','learning_module_title','FRM Part I - Financial Risk Manager Foundations','FRM Parte I - Fondamenti del Financial Risk Manager'),
('sys_learning_modules','learning_module_title','FRM Part II - Advanced Risk Management','FRM Parte II - Gestione avanzata del rischio'),
('sys_learning_modules','learning_module_title','Investment Advisory Fundamentals','Fondamenti di consulenza sugli investimenti'),
('sys_learning_modules','learning_module_title','KYC Foundations - Know Your Customer','Fondamenti di KYC - Conosci il tuo cliente'),
('sys_learning_modules','learning_module_title','Leadership for Production Supervisors','Leadership per i responsabili di produzione'),
('sys_learning_modules','learning_module_title','Liquidity Risk Management','Gestione del rischio di liquidità'),
('sys_learning_modules','learning_module_title','Machine Learning Basics','Fondamenti di machine learning'),
('sys_learning_modules','learning_module_title','Market Risk Management','Gestione del rischio di mercato'),
('sys_learning_modules','learning_module_title','MiFID II Compliance for Investment Services','Conformità MiFID II per i servizi di investimento'),
('sys_learning_modules','learning_module_title','Operational Risk Management','Gestione del rischio operativo'),
('sys_learning_modules','learning_module_title','Portfolio Management Essentials','Fondamenti di gestione del portafoglio'),
('sys_learning_modules','learning_module_title','Production Supervision Excellence','Eccellenza nella supervisione della produzione'),
('sys_learning_modules','learning_module_title','Project Management Agile','Project management agile'),
('sys_learning_modules','learning_module_title','Securities Markets & Trading','Mercati mobiliari e negoziazione'),
('sys_learning_modules','learning_module_title','Sensory Analysis & Evaluation','Analisi e valutazione sensoriale'),
('sys_learning_modules','learning_module_title','Sustainability Consulting Methods','Metodi di consulenza sulla sostenibilità'),
('sys_learning_modules','learning_module_title','Time Management','Gestione del tempo'),
('sys_learning_modules','learning_module_title','Transaction Processing Excellence','Eccellenza nell''elaborazione delle transazioni'),
('sys_learning_paths','learning_path_name','ABA Bank Teller Certificate - Foundations','Certificato ABA per cassieri - Fondamenti'),
('sys_learning_paths','learning_path_name','Advanced Data Analysis','Analisi avanzata dei dati'),
('sys_learning_paths','learning_path_name','AML Transaction Monitoring','Monitoraggio delle transazioni antiriciclaggio'),
('sys_learning_paths','learning_path_name','Basel III Framework - Capital Requirements','Basilea III - Requisiti patrimoniali'),
('sys_learning_paths','learning_path_name','Basel IV - New Advances in Banking Regulation','Basilea IV - Le novità della regolamentazione bancaria'),
('sys_learning_paths','learning_path_name','CAMS - Certified Anti-Money Laundering Specialist Prep','CAMS - Preparazione alla certificazione antiriciclaggio'),
('sys_learning_paths','learning_path_name','Cash Handling & Counterfeit Detection','Gestione del contante e riconoscimento delle banconote false'),
('sys_learning_paths','learning_path_name','Cloud Computing AWS','Cloud computing con AWS'),
('sys_learning_paths','learning_path_name','Core Banking Systems Overview','Panoramica dei sistemi di core banking'),
('sys_learning_paths','learning_path_name','Credit Risk Analysis Fundamentals','Fondamenti di analisi del rischio di credito'),
('sys_learning_paths','learning_path_name','Customer Service Excellence in Banking','Eccellenza nel servizio al cliente in banca'),
('sys_learning_paths','learning_path_name','Cybersecurity in Financial Services','Sicurezza informatica nei servizi finanziari'),
('sys_learning_paths','learning_path_name','Data Analytics for Banking','Analisi dei dati per il settore bancario'),
('sys_learning_paths','learning_path_name','Design Thinking','Design thinking'),
('sys_learning_paths','learning_path_name','ESG Investing & Sustainable Finance','Investimenti ESG e finanza sostenibile'),
('sys_learning_paths','learning_path_name','Ethical Sales in Banking','Vendita etica in banca'),
('sys_learning_paths','learning_path_name','Financial Literacy for Customer Education','Educazione finanziaria per la clientela'),
('sys_learning_paths','learning_path_name','Fraud Prevention for Frontline Staff','Prevenzione delle frodi per il personale di prima linea'),
('sys_learning_paths','learning_path_name','FRM Part I - Financial Risk Manager Foundations','FRM Parte I - Fondamenti del Financial Risk Manager'),
('sys_learning_paths','learning_path_name','FRM Part II - Advanced Risk Management','FRM Parte II - Gestione avanzata del rischio'),
('sys_learning_paths','learning_path_name','Investment Advisory Fundamentals','Fondamenti di consulenza sugli investimenti'),
('sys_learning_paths','learning_path_name','KYC Foundations - Know Your Customer','Fondamenti di KYC - Conosci il tuo cliente'),
('sys_learning_paths','learning_path_name','Leadership for Production Supervisors','Leadership per i responsabili di produzione'),
('sys_learning_paths','learning_path_name','Liquidity Risk Management','Gestione del rischio di liquidità'),
('sys_learning_paths','learning_path_name','Machine Learning Basics','Fondamenti di machine learning'),
('sys_learning_paths','learning_path_name','Market Risk Management','Gestione del rischio di mercato'),
('sys_learning_paths','learning_path_name','MiFID II Compliance for Investment Services','Conformità MiFID II per i servizi di investimento'),
('sys_learning_paths','learning_path_name','Operational Risk Management','Gestione del rischio operativo'),
('sys_learning_paths','learning_path_name','Portfolio Management Essentials','Fondamenti di gestione del portafoglio'),
('sys_learning_paths','learning_path_name','Production Supervision Excellence','Eccellenza nella supervisione della produzione'),
('sys_learning_paths','learning_path_name','Project Management Agile','Project management agile'),
('sys_learning_paths','learning_path_name','Securities Markets & Trading','Mercati mobiliari e negoziazione'),
('sys_learning_paths','learning_path_name','Sensory Analysis & Evaluation','Analisi e valutazione sensoriale'),
('sys_learning_paths','learning_path_name','Sustainability Consulting Methods','Metodi di consulenza sulla sostenibilità'),
('sys_learning_paths','learning_path_name','Time Management','Gestione del tempo'),
('sys_learning_paths','learning_path_name','Transaction Processing Excellence','Eccellenza nell''elaborazione delle transazioni');
DO $$ DECLARE r record; n bigint; BEGIN
  FOR r IN SELECT * FROM tr LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I = %L', r.tabella, r.colonna, r.en) INTO n;
    IF n > 0 THEN
      INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) VALUES (r.tabella, r.colonna, r.en, r.it, n) ON CONFLICT DO NOTHING;
      EXECUTE format('UPDATE sys.%I SET %I = %L WHERE %I = %L', r.tabella, r.colonna, r.it, r.colonna, r.en);
    END IF;
  END LOOP;
END $$;
-- titoli e corsi come funzioni temporanee (valgono solo in questa transazione)
CREATE FUNCTION pg_temp.t_titolo(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT CASE lower(x)
      WHEN 'bank manager' THEN 'Direttore di Filiale'
      WHEN 'bank teller' THEN 'Cassiere'
      WHEN 'back office specialist' THEN 'Specialista Back Office'
      WHEN 'chief risk officer' THEN 'Direttore Rischi'
      WHEN 'financial analyst' THEN 'Analista Finanziario'
      WHEN 'risk analyst' THEN 'Analista Rischio'
      WHEN 'compliance officer' THEN 'Specialista Compliance'
      WHEN 'investment advisor' THEN 'Consulente Investimenti'
      WHEN 'securities dealer' THEN 'Operatore Titoli'
      WHEN 'head of commercial banking' THEN 'Direttore Commerciale'
      WHEN 'head of internal audit' THEN 'Responsabile Internal Audit'
      WHEN 'head of marketing' THEN 'Responsabile Marketing'
      WHEN 'head of product' THEN 'Responsabile Prodotti'
      WHEN 'head of treasury' THEN 'Responsabile Tesoreria'
      WHEN 'head of legal & compliance' THEN 'Responsabile Legale e Compliance'
      WHEN 'hr manager' THEN 'Responsabile Risorse Umane'
      WHEN 'hr director' THEN 'Direttore Risorse Umane'
      WHEN 'it director' THEN 'Direttore IT e Digital'
      WHEN 'operations director' THEN 'Direttore Operations'
      WHEN 'retail director' THEN 'Direttore Retail Banking'
      WHEN 'finance director' THEN 'Direttore Finanza e Amministrazione'
      WHEN 'ceo' THEN 'Direttore Generale'
      WHEN 'line manager - operations' THEN 'Responsabile Operations'
      WHEN 'risk manager' THEN 'Responsabile Gestione Rischi'
      WHEN 'payment specialist' THEN 'Specialista Pagamenti'
      WHEN 'software developer' THEN 'Sviluppatore Software'
      WHEN 'system administrator' THEN 'Sistemista'
      WHEN 'legal counsel' THEN 'Legale'
      WHEN 'responsabile direzione risk management' THEN 'Responsabile Direzione Gestione dei Rischi'
      ELSE x END $f$;
CREATE FUNCTION pg_temp.t_corso(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT CASE x
      WHEN 'ABA Bank Teller Certificate - Foundations' THEN 'Certificato ABA per cassieri - Fondamenti'
      WHEN 'Advanced Data Analysis' THEN 'Analisi avanzata dei dati'
      WHEN 'AML Transaction Monitoring' THEN 'Monitoraggio delle transazioni antiriciclaggio'
      WHEN 'Basel III Framework - Capital Requirements' THEN 'Basilea III - Requisiti patrimoniali'
      WHEN 'Basel IV - New Advances in Banking Regulation' THEN 'Basilea IV - Le novità della regolamentazione bancaria'
      WHEN 'CAMS - Certified Anti-Money Laundering Specialist Prep' THEN 'CAMS - Preparazione alla certificazione antiriciclaggio'
      WHEN 'Cash Handling & Counterfeit Detection' THEN 'Gestione del contante e riconoscimento delle banconote false'
      WHEN 'Cloud Computing AWS' THEN 'Cloud computing con AWS'
      WHEN 'Core Banking Systems Overview' THEN 'Panoramica dei sistemi di core banking'
      WHEN 'Credit Risk Analysis Fundamentals' THEN 'Fondamenti di analisi del rischio di credito'
      WHEN 'Customer Service Excellence in Banking' THEN 'Eccellenza nel servizio al cliente in banca'
      WHEN 'Cybersecurity in Financial Services' THEN 'Sicurezza informatica nei servizi finanziari'
      WHEN 'Data Analytics for Banking' THEN 'Analisi dei dati per il settore bancario'
      WHEN 'Design Thinking' THEN 'Design thinking'
      WHEN 'ESG Investing & Sustainable Finance' THEN 'Investimenti ESG e finanza sostenibile'
      WHEN 'Ethical Sales in Banking' THEN 'Vendita etica in banca'
      WHEN 'Financial Literacy for Customer Education' THEN 'Educazione finanziaria per la clientela'
      WHEN 'Fraud Prevention for Frontline Staff' THEN 'Prevenzione delle frodi per il personale di prima linea'
      WHEN 'FRM Part I - Financial Risk Manager Foundations' THEN 'FRM Parte I - Fondamenti del Financial Risk Manager'
      WHEN 'FRM Part II - Advanced Risk Management' THEN 'FRM Parte II - Gestione avanzata del rischio'
      WHEN 'Investment Advisory Fundamentals' THEN 'Fondamenti di consulenza sugli investimenti'
      WHEN 'KYC Foundations - Know Your Customer' THEN 'Fondamenti di KYC - Conosci il tuo cliente'
      WHEN 'Leadership for Production Supervisors' THEN 'Leadership per i responsabili di produzione'
      WHEN 'Liquidity Risk Management' THEN 'Gestione del rischio di liquidità'
      WHEN 'Machine Learning Basics' THEN 'Fondamenti di machine learning'
      WHEN 'Market Risk Management' THEN 'Gestione del rischio di mercato'
      WHEN 'MiFID II Compliance for Investment Services' THEN 'Conformità MiFID II per i servizi di investimento'
      WHEN 'Operational Risk Management' THEN 'Gestione del rischio operativo'
      WHEN 'Portfolio Management Essentials' THEN 'Fondamenti di gestione del portafoglio'
      WHEN 'Production Supervision Excellence' THEN 'Eccellenza nella supervisione della produzione'
      WHEN 'Project Management Agile' THEN 'Project management agile'
      WHEN 'Securities Markets & Trading' THEN 'Mercati mobiliari e negoziazione'
      WHEN 'Sensory Analysis & Evaluation' THEN 'Analisi e valutazione sensoriale'
      WHEN 'Sustainability Consulting Methods' THEN 'Metodi di consulenza sulla sostenibilità'
      WHEN 'Time Management' THEN 'Gestione del tempo'
      WHEN 'Transaction Processing Excellence' THEN 'Eccellenza nell''elaborazione delle transazioni'
      ELSE x END $f$;
CREATE FUNCTION pg_temp.t_cat(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT CASE x
      WHEN 'compliance' THEN 'conformità'
      WHEN 'risk_management' THEN 'gestione del rischio'
      WHEN 'soft_skills' THEN 'competenze trasversali'
      WHEN 'investment' THEN 'investimenti'
      WHEN 'operations' THEN 'operatività'
      WHEN 'technical' THEN 'competenze tecniche'
      WHEN 'leadership' THEN 'leadership'
      ELSE x END $f$;
CREATE FUNCTION pg_temp.t_motivo(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT CASE x
      WHEN 'hire' THEN 'assunzione'
      WHEN 'adjustment' THEN 'adeguamento'
      WHEN 'promotion' THEN 'promozione'
      WHEN 'merit' THEN 'merito'
      WHEN 'promozione' THEN 'promozione'
      WHEN 'merito' THEN 'merito'
      WHEN 'cambio_ruolo' THEN 'cambio di ruolo'
      ELSE x END $f$;
CREATE FUNCTION pg_temp.t_eur(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT translate(to_char(x::numeric,'FM999,999,990.00'),',.','.,') $f$;
CREATE FUNCTION pg_temp.t_num(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT replace(x,'.',',') $f$;
CREATE TEMP TABLE ev ON COMMIT DROP AS
SELECT user_timeline_event_id id, user_timeline_event_summary vecchio,
 CASE
  WHEN s ~ '^Completed course: .* \([a-z_]+\)$' THEN 'Corso completato: ' || pg_temp.t_corso(regexp_replace(s,'^Completed course: (.*) \(([a-z_]+)\)$','\1')) || ' (' || pg_temp.t_cat(regexp_replace(s,'^Completed course: (.*) \(([a-z_]+)\)$','\2')) || ')'
  WHEN s ~ '^Certification earned: ' THEN 'Certificazione conseguita: ' || substr(s, 24)
  WHEN s ~ '^Hired as ' THEN 'Assunto come ' || pg_temp.t_titolo(substr(s, 10))
  WHEN s ~ '^level_realignment: Reassignment to CCNL_CRED_2024 tabellare levels \(.*\)$' THEN 'Riallineamento di livello: assegnazione ai livelli tabellari del CCNL Credito 2024 (' || pg_temp.t_titolo(regexp_replace(s,'^.*\((.*)\)$','\1')) || ')'
  WHEN s ~ '^salary_recalculation: ' THEN 'Ricalcolo della retribuzione: livello tabellare, scatti di anzianità e adeguamento individuale'
  WHEN s ~ '^executive_band_override: Override salariale per fascia dirigenziale \(.*\)$' THEN 'Retribuzione dirigenziale per fascia (' || pg_temp.t_titolo(regexp_replace(s,'^.*\((.*)\)$','\1')) || ')'
  WHEN s ~ '^Salary set to [0-9.]+ EUR \(.*\)$' THEN 'Retribuzione fissata a ' || pg_temp.t_eur(regexp_replace(s,'^Salary set to ([0-9.]+) EUR.*$','\1')) || ' euro (' || pg_temp.t_motivo(regexp_replace(s,'^.*\((.*)\)$','\1')) || ')'
  WHEN s ~ '^Review (annual|mid_year) completed: rating [0-9.]+/5$' THEN 'Valutazione ' || CASE WHEN s ~ '^Review annual' THEN 'annuale' ELSE 'intermedia' END || ' completata: giudizio ' || pg_temp.t_num(regexp_replace(s,'^.*rating ([0-9.]+)/5$','\1')) || '/5'
 END nuovo
FROM (SELECT user_timeline_event_id, user_timeline_event_summary, user_timeline_event_summary s FROM sys.sys_user_timeline_events) x;
DELETE FROM ev WHERE nuovo IS NULL OR nuovo = vecchio;
INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) SELECT 'sys_user_timeline_events', 'user_timeline_event_summary', vecchio, nuovo, count(*) FROM ev GROUP BY vecchio, nuovo ON CONFLICT DO NOTHING;
UPDATE sys.sys_user_timeline_events t SET user_timeline_event_summary = ev.nuovo FROM ev WHERE ev.id = t.user_timeline_event_id;
CREATE FUNCTION pg_temp.t_mesi(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(x, 'January ', 'gennaio '), 'February ', 'febbraio '), 'March ', 'marzo '), 'April ', 'aprile '), 'May ', 'maggio '), 'June ', 'giugno '), 'July ', 'luglio '), 'August ', 'agosto '), 'September ', 'settembre '), 'October ', 'ottobre '), 'November ', 'novembre '), 'December ', 'dicembre ') $f$;
INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) SELECT 'sys_training_initiatives', 'training_initiative_cohort_name', training_initiative_cohort_name, pg_temp.t_mesi(training_initiative_cohort_name), count(*) FROM sys.sys_training_initiatives WHERE training_initiative_cohort_name ~ '(January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{4}' GROUP BY training_initiative_cohort_name ON CONFLICT DO NOTHING;
UPDATE sys.sys_training_initiatives SET training_initiative_cohort_name = pg_temp.t_mesi(training_initiative_cohort_name) WHERE training_initiative_cohort_name ~ '(January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{4}';
INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) SELECT 'sys_approval_requests', 'approval_request_title', approval_request_title, pg_temp.t_mesi(approval_request_title), count(*) FROM sys.sys_approval_requests WHERE approval_request_title ~ '(January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{4}' GROUP BY approval_request_title ON CONFLICT DO NOTHING;
UPDATE sys.sys_approval_requests SET approval_request_title = pg_temp.t_mesi(approval_request_title) WHERE approval_request_title ~ '(January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{4}';
INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) SELECT 'sys_leave_balance_transactions', 'transaction_days_amount', transaction_type||':'||transaction_days_amount, transaction_type||':'||(CASE WHEN transaction_type IN ('ACCRUAL','CARRYOVER') THEN abs(transaction_days_amount) ELSE -abs(transaction_days_amount) END), count(*) FROM sys.sys_leave_balance_transactions WHERE (transaction_type IN ('ACCRUAL','CARRYOVER') AND transaction_days_amount<0) OR (transaction_type='USAGE' AND transaction_days_amount>0) GROUP BY transaction_type, transaction_days_amount ON CONFLICT DO NOTHING;
UPDATE sys.sys_leave_balance_transactions SET transaction_days_amount = abs(transaction_days_amount) WHERE transaction_type IN ('ACCRUAL','CARRYOVER') AND transaction_days_amount<0;
UPDATE sys.sys_leave_balance_transactions SET transaction_days_amount = -abs(transaction_days_amount) WHERE transaction_type='USAGE' AND transaction_days_amount>0;
COMMIT;
SELECT 'J ok' esito, (SELECT count(*) FROM staging.rtl_allinea_testi_undo) voci_nel_giornale, (SELECT coalesce(sum(righe),0) FROM staging.rtl_allinea_testi_undo) righe_tradotte;
