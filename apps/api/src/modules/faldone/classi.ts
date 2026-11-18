/**
 * apps/api/src/modules/faldone/classi.ts — la CLASSIFICAZIONE del catalogo del Faldone.
 *
 * Il catalogo (quali tabelle, quali colonne) lo legge `catalogo.ts` dal database. Qui sta solo
 * ciò che il database non sa dire da sé:
 *
 *  - la CLASSE di dati di ogni tabella (ADR-0027/ADR-0036: PERSONAL, COMPENSATION, SKILL,
 *    EVALUATION, ACTIVITY, CREDENTIAL, SPECIAL_CATEGORY), che decide chi vede in chiaro;
 *  - il CAPITOLO del faldone e il TITOLO in italiano (mai il nome tecnico a video, R4);
 *  - la SFERA: `privata` (indirizzi, banca, famiglia, documenti: come nel dossier, al manager di
 *    linea arriva {omissis}) e `soloSe` (risposte ai questionari di clima: le legge solo la persona);
 *  - quali colonne di legame dicono che la riga PARLA della persona (`soggetto`). Tutte le altre
 *    (created_by, approvatore, responsabile...) sono `relazione`: la persona vi compare per ciò che
 *    ha fatto su un altro oggetto, e il faldone ne dà l'indice, non il contenuto;
 *  - i legami IMPLICITI: colonne uuid che puntano a una persona senza una chiave esterna (misurati
 *    dal censimento del 2026-11-18). Un uuid è unico: se vale l'id della persona, è la persona.
 *
 * Censimento di riferimento: `docs/piani/faldone/CENSIMENTO_20261118.md`. Il cricchetto è la prova
 * `faldone-catalogo.integration.test.ts`: ogni tabella che il database lega alla persona deve avere
 * qui la sua riga, e ogni riga qui deve esistere nel database.
 */
import type { DataClass } from "../../lib/scope/data-classes.js";

export interface Classificazione {
  classe: DataClass;
  capitolo: Capitolo;
  titolo: string;
  /** Sfera privata dell'anagrafica: al manager di linea arriva {omissis} (dossier, #124 D2). */
  privata?: true;
  /** La legge in chiaro solo la persona stessa (questionari di clima, per costruzione anonimi verso gli altri). */
  soloSe?: true;
}

export const CAPITOLI = [
  "Anagrafica",
  "Rapporto di lavoro",
  "Retribuzione",
  "Posizione e organizzazione",
  "Presenze e assenze",
  "Competenze",
  "Formazione",
  "Obiettivi e indicatori",
  "Valutazioni",
  "Talento e successione",
  "Carriera",
  "Clima e coinvolgimento",
  "Lavoro e collaborazione",
  "Selezione",
  "Accesso e sicurezza",
  "Privacy e consensi",
  "Assistente e agenti",
  "Modelli e configurazione",
  "Archivi e registri tecnici",
] as const;
export type Capitolo = (typeof CAPITOLI)[number];

type Riga = [DataClass, Capitolo, string, ("privata" | "soloSe")?];

/** Una riga per ogni tabella che il database lega alla persona (diretta, collegata o implicita). */
const TABELLE: Record<string, Riga> = {
  // ── Anagrafica
  "sys.sys_users": ["PERSONAL", "Anagrafica", "Persona"],
  "sys.sys_user_profiles": ["PERSONAL", "Anagrafica", "Profilo"],
  "sys.sys_user_addresses": ["PERSONAL", "Anagrafica", "Indirizzi", "privata"],
  "sys.sys_user_bank_details": ["PERSONAL", "Anagrafica", "Coordinate bancarie", "privata"],
  "sys.sys_user_demographics": ["PERSONAL", "Anagrafica", "Dati anagrafici e demografici", "privata"],
  "sys.sys_user_documents": ["PERSONAL", "Anagrafica", "Documenti", "privata"],
  "sys.sys_user_identity_documents": ["PERSONAL", "Anagrafica", "Documenti di identità", "privata"],
  "sys.sys_user_education_records": ["PERSONAL", "Anagrafica", "Istruzione", "privata"],
  "sys.sys_user_family_members": ["PERSONAL", "Anagrafica", "Familiari", "privata"],
  "sys.sys_user_preferences": ["PERSONAL", "Anagrafica", "Preferenze"],
  "sys.sys_user_professional_experiences": ["PERSONAL", "Anagrafica", "Esperienze professionali"],
  "sys.sys_user_timeline_events": ["PERSONAL", "Anagrafica", "Cronologia"],
  // ── Rapporto di lavoro
  "sys.sys_user_employment": ["PERSONAL", "Rapporto di lavoro", "Rapporto di lavoro"],
  "sys.sys_user_contracts": ["COMPENSATION", "Rapporto di lavoro", "Contratti"],
  "sys.sys_mandate_acts": ["PERSONAL", "Rapporto di lavoro", "Atti di mandato"],
  "sys.sys_mandate_act_audit": ["PERSONAL", "Rapporto di lavoro", "Registro degli atti di mandato"],
  "sys.sys_user_delegations": ["ACTIVITY", "Rapporto di lavoro", "Deleghe"],
  // ── Retribuzione
  "sys.sys_user_pay_slips": ["COMPENSATION", "Retribuzione", "Buste paga"],
  "sys.sys_compensation_recommendations": ["COMPENSATION", "Retribuzione", "Proposte retributive"],
  "sys.sys_variable_pay_calculations": ["COMPENSATION", "Retribuzione", "Retribuzione variabile"],
  "sys.sys_reward_gates": ["COMPENSATION", "Retribuzione", "Cancelli del premio"],
  "sys.sys_reward_gate_results": ["COMPENSATION", "Retribuzione", "Esiti dei cancelli del premio"],
  "sys.sys_position_compensation_profiles": ["COMPENSATION", "Retribuzione", "Profili retributivi delle posizioni"],
  // ── Posizione e organizzazione
  "sys.sys_user_position_assignments": ["PERSONAL", "Posizione e organizzazione", "Posizioni ricoperte"],
  "sys.sys_positions": ["PERSONAL", "Posizione e organizzazione", "Posizioni"],
  "sys.sys_organization_units": ["PERSONAL", "Posizione e organizzazione", "Unità organizzative"],
  "sys.sys_organization_unit_history": ["PERSONAL", "Posizione e organizzazione", "Storia delle unità organizzative"],
  "sys.sys_organization_unit_templates": ["PERSONAL", "Modelli e configurazione", "Modelli di unità organizzativa"],
  "sys.sys_branches": ["PERSONAL", "Posizione e organizzazione", "Filiali"],
  "sys.sys_teams": ["ACTIVITY", "Lavoro e collaborazione", "Team"],
  "sys.sys_team_members": ["ACTIVITY", "Lavoro e collaborazione", "Appartenenza ai team"],
  "sys.sys_job_roles": ["PERSONAL", "Modelli e configurazione", "Mansioni"],
  "sys.sys_critical_positions": ["EVALUATION", "Talento e successione", "Posizioni critiche"],
  "sys.sys_position_succession_relevance": ["EVALUATION", "Talento e successione", "Rilevanza per la successione"],
  "sys.sys_position_career_paths": ["PERSONAL", "Carriera", "Percorsi di carriera delle posizioni"],
  "sys.sys_position_kpi_requirements": ["EVALUATION", "Obiettivi e indicatori", "Indicatori richiesti dalle posizioni"],
  "sys.sys_position_learning_requirements": ["SKILL", "Formazione", "Formazione richiesta dalle posizioni"],
  "sys.sys_position_skill_requirements": ["SKILL", "Competenze", "Competenze richieste dalle posizioni"],
  "sys.sys_position_skill_requirement_history": ["SKILL", "Competenze", "Storia delle competenze richieste"],
  "sys.sys_platform_user_tenant_assignments": ["CREDENTIAL", "Accesso e sicurezza", "Assegnazioni ai clienti"],
  // ── Presenze e assenze
  "sys.sys_attendance": ["ACTIVITY", "Presenze e assenze", "Presenze"],
  "sys.sys_overtime": ["ACTIVITY", "Presenze e assenze", "Straordinari"],
  "sys.sys_time_off_balances": ["ACTIVITY", "Presenze e assenze", "Saldi di ferie e permessi"],
  "sys.sys_time_off_requests": ["ACTIVITY", "Presenze e assenze", "Richieste di ferie e permessi"],
  "sys.sys_leave_balance_transactions": ["ACTIVITY", "Presenze e assenze", "Movimenti dei saldi"],
  "sys.sys_leave_accrual_rules": ["ACTIVITY", "Modelli e configurazione", "Regole di maturazione"],
  // ── Competenze
  "sys.sys_user_skills": ["SKILL", "Competenze", "Competenze possedute"],
  "sys.sys_user_skill_evidence": ["SKILL", "Competenze", "Evidenze delle competenze"],
  "sys.sys_person_evidence_records": ["SKILL", "Competenze", "Evidenze registrate"],
  "sys.sys_learning_gaps": ["SKILL", "Competenze", "Lacune di competenza"],
  "sys.sys_gap_analysis_results": ["SKILL", "Competenze", "Analisi delle lacune"],
  "sys.sys_gap_closure_plans": ["SKILL", "Competenze", "Piani di chiusura delle lacune"],
  "sys.sys_gap_closure_actions": ["SKILL", "Competenze", "Azioni di chiusura delle lacune"],
  "sys.sys_skill_gap_scores": ["SKILL", "Competenze", "Punteggi di lacuna"],
  "sys.sys_user_profile_embeddings": ["SKILL", "Competenze", "Impronta semantica del profilo"],
  "sys.sys_skills": ["SKILL", "Modelli e configurazione", "Competenze del catalogo"],
  "sys.sys_mentor_match_scores": ["SKILL", "Competenze", "Abbinamenti di mentoring"],
  // ── Formazione
  "sys.sys_user_learning_assignments": ["SKILL", "Formazione", "Formazione assegnata"],
  "sys.sys_user_learning_evidence": ["SKILL", "Formazione", "Formazione frequentata"],
  "sys.sys_user_certifications": ["SKILL", "Formazione", "Certificazioni"],
  "sys.sys_training_initiatives": ["SKILL", "Formazione", "Iniziative formative"],
  "sys.sys_learning_modules": ["SKILL", "Modelli e configurazione", "Moduli formativi"],
  "sys.sys_learning_paths": ["SKILL", "Modelli e configurazione", "Percorsi formativi"],
  "sys.sys_mentorships": ["PERSONAL", "Formazione", "Mentoring"],
  "sys.sys_mentorship_sessions": ["PERSONAL", "Formazione", "Incontri di mentoring"],
  // ── Obiettivi e indicatori
  "sys.sys_goals": ["EVALUATION", "Obiettivi e indicatori", "Obiettivi"],
  "sys.sys_goal_check_ins": ["EVALUATION", "Obiettivi e indicatori", "Aggiornamenti periodici degli obiettivi"],
  "sys.sys_goal_comments": ["EVALUATION", "Obiettivi e indicatori", "Commenti agli obiettivi"],
  "sys.sys_goal_milestones": ["EVALUATION", "Obiettivi e indicatori", "Tappe degli obiettivi"],
  "sys.sys_goal_updates": ["EVALUATION", "Obiettivi e indicatori", "Avanzamenti degli obiettivi"],
  "sys.sys_goal_templates": ["EVALUATION", "Modelli e configurazione", "Modelli di obiettivo"],
  "sys.sys_goal_alignments": ["EVALUATION", "Obiettivi e indicatori", "Allineamenti fra obiettivi"],
  "sys.sys_okrs": ["EVALUATION", "Obiettivi e indicatori", "Obiettivi e risultati chiave"],
  "sys.sys_okr_key_results": ["EVALUATION", "Obiettivi e indicatori", "Risultati chiave"],
  "sys.sys_okr_check_ins": ["EVALUATION", "Obiettivi e indicatori", "Aggiornamenti dei risultati chiave"],
  "sys.sys_kpi_targets": ["EVALUATION", "Obiettivi e indicatori", "Bersagli degli indicatori"],
  "sys.sys_kpi_measurements": ["EVALUATION", "Obiettivi e indicatori", "Misure degli indicatori"],
  "sys.sys_kpi_assessment_results": ["EVALUATION", "Obiettivi e indicatori", "Esiti degli indicatori"],
  "sys.sys_user_kpi_evidence": ["EVALUATION", "Obiettivi e indicatori", "Evidenze degli indicatori"],
  "sys.sys_kpi_definitions": ["EVALUATION", "Modelli e configurazione", "Indicatori del catalogo"],
  // ── Valutazioni
  "sys.sys_performance_reviews": ["EVALUATION", "Valutazioni", "Valutazioni della prestazione"],
  "sys.sys_performance_review_competency_ratings": ["EVALUATION", "Valutazioni", "Giudizi sulle competenze"],
  "sys.sys_valutazione_condivisione_eccezioni": ["EVALUATION", "Valutazioni", "Eccezioni alla condivisione della valutazione"],
  "sys.sys_feedback_360_responses": ["EVALUATION", "Valutazioni", "Feedback a 360 gradi"],
  "sys.sys_continuous_feedback": ["EVALUATION", "Valutazioni", "Feedback continuo"],
  "sys.sys_calibration_discussions": ["EVALUATION", "Valutazioni", "Discussioni di calibrazione"],
  "sys.sys_calibration_participants": ["EVALUATION", "Valutazioni", "Partecipazioni alla calibrazione"],
  "sys.sys_calibration_sessions": ["EVALUATION", "Valutazioni", "Sessioni di calibrazione"],
  "sys.sys_review_cycles": ["EVALUATION", "Modelli e configurazione", "Cicli di valutazione"],
  "sys.sys_assessments": ["EVALUATION", "Valutazioni", "Assessment"],
  "sys.sys_assessment_results": ["EVALUATION", "Valutazioni", "Esiti degli assessment"],
  "sys.sys_user_assessment_evidence": ["EVALUATION", "Valutazioni", "Evidenze degli assessment"],
  "sys.sys_behavioral_assessments": ["EVALUATION", "Valutazioni", "Valutazioni comportamentali"],
  "sys.sys_employee_position_fit_scores": ["EVALUATION", "Valutazioni", "Aderenza alle posizioni"],
  // ── Talento e successione
  "sys.sys_talent_scores": ["EVALUATION", "Talento e successione", "Punteggi di talento"],
  "sys.sys_flight_risk_scores": ["EVALUATION", "Talento e successione", "Rischio di uscita"],
  "sys.sys_model_predictions": ["EVALUATION", "Talento e successione", "Previsioni dei modelli"],
  "sys.sys_readiness_scores": ["EVALUATION", "Talento e successione", "Prontezza"],
  "sys.sys_succession_scores": ["EVALUATION", "Talento e successione", "Punteggi di successione"],
  "sys.sys_succession_readiness_scores": ["EVALUATION", "Talento e successione", "Prontezza alla successione"],
  "sys.sys_succession_pools": ["EVALUATION", "Talento e successione", "Bacini di successione"],
  "sys.sys_successor_candidates": ["EVALUATION", "Talento e successione", "Candidature alla successione"],
  "sys.sys_successor_readiness": ["EVALUATION", "Talento e successione", "Prontezza del successore"],
  "sys.sys_advisor_suggestions": ["EVALUATION", "Talento e successione", "Suggerimenti del consigliere"],
  "sys.sys_capability_scores": ["SKILL", "Competenze", "Punteggi di capacità"],
  // ── Carriera
  "sys.sys_user_career_plans": ["PERSONAL", "Carriera", "Piani di carriera"],
  "sys.sys_user_target_positions": ["PERSONAL", "Carriera", "Posizioni obiettivo"],
  "sys.sys_career_paths": ["PERSONAL", "Modelli e configurazione", "Percorsi di carriera"],
  // ── Clima e coinvolgimento
  "sys.sys_engagement_survey_responses": ["PERSONAL", "Clima e coinvolgimento", "Risposte ai questionari di clima", "soloSe"],
  "sys.sys_survey_responses": ["PERSONAL", "Clima e coinvolgimento", "Risposte ai sondaggi", "soloSe"],
  "sys.sys_survey_assignments": ["ACTIVITY", "Clima e coinvolgimento", "Sondaggi assegnati"],
  "sys.sys_pulse_checks": ["PERSONAL", "Clima e coinvolgimento", "Rilevazioni lampo", "soloSe"],
  "sys.sys_engagement_feedback": ["ACTIVITY", "Clima e coinvolgimento", "Segnalazioni di clima"],
  "sys.sys_engagement_surveys": ["ACTIVITY", "Clima e coinvolgimento", "Questionari di clima"],
  "sys.sys_engagement_survey_templates": ["ACTIVITY", "Modelli e configurazione", "Modelli di questionario"],
  "sys.sys_engagement_action_plans": ["ACTIVITY", "Clima e coinvolgimento", "Piani d'azione sul clima"],
  // ── Lavoro e collaborazione
  "sys.sys_approval_requests": ["ACTIVITY", "Lavoro e collaborazione", "Richieste di approvazione"],
  "sys.sys_approval_steps": ["ACTIVITY", "Lavoro e collaborazione", "Passi di approvazione"],
  "sys.sys_process_participants": ["ACTIVITY", "Lavoro e collaborazione", "Partecipazione ai processi"],
  "sys.sys_project_members": ["ACTIVITY", "Lavoro e collaborazione", "Partecipazione ai progetti"],
  "sys.sys_inbox_notifications": ["ACTIVITY", "Lavoro e collaborazione", "Notifiche"],
  "sys.sys_notification_preferences": ["PERSONAL", "Lavoro e collaborazione", "Preferenze di notifica"],
  "sys.sys_content_documents": ["ACTIVITY", "Lavoro e collaborazione", "Documenti editoriali"],
  "sys.sys_content_versions": ["ACTIVITY", "Lavoro e collaborazione", "Versioni dei documenti"],
  "sys.sys_content_media": ["ACTIVITY", "Lavoro e collaborazione", "Allegati dei documenti"],
  "sys.sys_content_blueprint_links": ["ACTIVITY", "Modelli e configurazione", "Collegamenti dei contenuti"],
  "sys.sys_visualization_graphs": ["ACTIVITY", "Lavoro e collaborazione", "Grafici salvati"],
  "audit.user_self_service_actions": ["ACTIVITY", "Lavoro e collaborazione", "Azioni nel portale personale"],
  "audit.valore_eventi": ["ACTIVITY", "Lavoro e collaborazione", "Eventi di valore"],
  "audit.registro_scritture": ["ACTIVITY", "Archivi e registri tecnici", "Registro delle scritture"],
  // ── Selezione
  "sys.sys_candidates": ["PERSONAL", "Selezione", "Candidatura"],
  "sys.sys_candidate_applications": ["PERSONAL", "Selezione", "Domande di assunzione"],
  "sys.sys_interview_feedback": ["EVALUATION", "Selezione", "Esiti dei colloqui"],
  // ── Accesso e sicurezza
  "sys.sys_user_auth_roles": ["PERSONAL", "Accesso e sicurezza", "Ruoli assegnati"],
  "sys.sys_auth_identities": ["CREDENTIAL", "Accesso e sicurezza", "Identità di accesso"],
  "sys.sys_auth_credentials": ["CREDENTIAL", "Accesso e sicurezza", "Credenziali"],
  "sys.sys_auth_login_events": ["CREDENTIAL", "Accesso e sicurezza", "Accessi"],
  "sys.sys_auth_sessions": ["CREDENTIAL", "Accesso e sicurezza", "Sessioni"],
  "sys.sys_auth_refresh_tokens": ["CREDENTIAL", "Accesso e sicurezza", "Rinnovi di sessione"],
  "sys.sys_auth_password_reset_tokens": ["CREDENTIAL", "Accesso e sicurezza", "Richieste di nuova password"],
  "sys.sys_auth_mfa_factors": ["CREDENTIAL", "Accesso e sicurezza", "Fattori di autenticazione"],
  "sys.sys_auth_mfa_otp_challenges": ["CREDENTIAL", "Accesso e sicurezza", "Codici monouso inviati"],
  "sys.sys_auth_mfa_recovery_codes": ["CREDENTIAL", "Accesso e sicurezza", "Codici di recupero"],
  "sys.sys_auth_mfa_webauthn_credentials": ["CREDENTIAL", "Accesso e sicurezza", "Chiavi di sicurezza"],
  "sys.sys_auth_mfa_exemptions": ["CREDENTIAL", "Accesso e sicurezza", "Esenzioni dal secondo fattore"],
  "sys.sys_auth_mfa_exemption_audit": ["CREDENTIAL", "Accesso e sicurezza", "Registro delle esenzioni"],
  "sys.sys_auth_mfa_exemption_eligible_users": ["CREDENTIAL", "Accesso e sicurezza", "Idoneità all'esenzione"],
  "audit.chiavi_idempotenza": ["ACTIVITY", "Archivi e registri tecnici", "Richieste ripetibili"],
  // ── Privacy e consensi
  "sys.sys_user_consents": ["PERSONAL", "Privacy e consensi", "Consensi"],
  "sys.sys_gdpr_requests": ["PERSONAL", "Privacy e consensi", "Richieste sulla privacy"],
  // ── Assistente e agenti
  "sys.sys_agent_conversations": ["ACTIVITY", "Assistente e agenti", "Conversazioni con l'assistente"],
  "sys.sys_agent_activities": ["ACTIVITY", "Assistente e agenti", "Attività dell'assistente"],
  "sys.sys_agent_capabilities": ["ACTIVITY", "Assistente e agenti", "Capacità degli agenti"],
  "sys.sys_agent_capability_activations": ["ACTIVITY", "Assistente e agenti", "Attivazioni delle capacità"],
  // ── Modelli e configurazione (la persona vi compare come autrice o approvatrice)
  "sys.sys_blueprint_activations": ["ACTIVITY", "Modelli e configurazione", "Attivazioni dei modelli"],
  "sys.sys_blueprint_overrides": ["ACTIVITY", "Modelli e configurazione", "Personalizzazioni dei modelli"],
  "sys.sys_blueprint_runs": ["ACTIVITY", "Modelli e configurazione", "Corse dei modelli"],
  "sys.sys_enterprise_typing_profiles": ["ACTIVITY", "Modelli e configurazione", "Profili d'impresa"],
  "sys.sys_generated_record_origins": ["ACTIVITY", "Modelli e configurazione", "Origini dei dati generati"],
  "sys.sys_platform_vocabulary_equivalences": ["ACTIVITY", "Modelli e configurazione", "Equivalenze di vocabolario"],
  "sys.sys_reconciliation_registry": ["ACTIVITY", "Modelli e configurazione", "Registro delle riconciliazioni"],
  "sys.sys_research_sources": ["ACTIVITY", "Modelli e configurazione", "Fonti di ricerca"],
  "sys.sys_seed_acquisition_runs": ["ACTIVITY", "Modelli e configurazione", "Corse di acquisizione"],
  "sys.sys_seed_approval_decisions": ["ACTIVITY", "Modelli e configurazione", "Decisioni di acquisizione"],
  "sys.sys_tenant_blueprint_process_decisions": ["ACTIVITY", "Modelli e configurazione", "Decisioni sui processi del modello"],
  "sys.sys_tenant_blueprint_snapshots": ["ACTIVITY", "Modelli e configurazione", "Istantanee del modello"],
  "sys.sys_tenant_blueprint_versions": ["ACTIVITY", "Modelli e configurazione", "Versioni del modello"],
  "sys.sys_tenant_blueprints": ["ACTIVITY", "Modelli e configurazione", "Modelli del cliente"],
  "sys.sys_tenant_consolidation_decisions": ["ACTIVITY", "Modelli e configurazione", "Decisioni di consolidamento"],
  "sys.sys_tenant_consolidations": ["ACTIVITY", "Modelli e configurazione", "Consolidamenti"],
  "sys.sys_alignment_decisions": ["ACTIVITY", "Modelli e configurazione", "Decisioni di allineamento al modello"],
  "reference_sync.import_runs": ["ACTIVITY", "Modelli e configurazione", "Importazioni di riferimento"],
  // ── Archivi e registri tecnici: copie di righe della persona, tenute per poter tornare indietro
  "audit.overtime_exempt_archive": ["ACTIVITY", "Archivi e registri tecnici", "Archivio degli straordinari esenti"],
  "audit.training_initiatives_junk_archive": ["SKILL", "Archivi e registri tecnici", "Archivio delle iniziative formative"],
  "staging.collaudo_sospensione_undo": ["CREDENTIAL", "Archivi e registri tecnici", "Giornale della sospensione del collaudo"],
  "staging.mig264_employment_undo": ["COMPENSATION", "Archivi e registri tecnici", "Giornale di correzione del rapporto di lavoro"],
  "staging.mig307_dirigenti_undo": ["PERSONAL", "Archivi e registri tecnici", "Giornale di correzione dei dirigenti"],
  "staging.mig362_buste_heuresys_undo": ["COMPENSATION", "Archivi e registri tecnici", "Giornale di correzione delle buste paga"],
  "staging.modello_ruoli_undo": ["PERSONAL", "Archivi e registri tecnici", "Giornale del modello dei ruoli"],
  "staging.qaweb_valore_eventi_undo_20261106": ["ACTIVITY", "Archivi e registri tecnici", "Giornale degli eventi di valore"],
  "staging.rtl_allinea_livelli_undo": ["PERSONAL", "Archivi e registri tecnici", "Giornale dell'allineamento dei livelli"],
  "staging.ruoli_senza_cliente_undo": ["PERSONAL", "Archivi e registri tecnici", "Giornale dei ruoli senza cliente"],
  "staging.tenant_import_people": ["PERSONAL", "Archivi e registri tecnici", "Persone importate"],
};

/**
 * I legami IMPLICITI: colonne uuid che puntano a una persona senza chiave esterna (censimento
 * 2026-11-18, sezione IMPLICITI). Sono `diretti` a tutti gli effetti. Le colonne che il censimento
 * ha trovato e che qui NON compaiono sono escluse per una ragione scritta in `IMPLICITI_ESCLUSI`.
 */
export const LEGAMI_IMPLICITI: readonly string[] = [
  "audit.chiavi_idempotenza.chiave_idempotenza_user_id",
  "audit.overtime_exempt_archive.overtime_subject_user_id",
  "audit.overtime_exempt_archive.overtime_requested_by_user_id",
  "audit.overtime_exempt_archive.overtime_approved_by_user_id",
  "audit.registro_scritture.registro_scrittura_persona_user_id",
  "audit.training_initiatives_junk_archive.training_initiative_facilitator_user_id",
  "staging.collaudo_sospensione_undo.undo_user_id",
  "staging.mig264_employment_undo.user_employment_user_id",
  "staging.mig307_dirigenti_undo.user_id",
  "staging.mig362_buste_heuresys_undo.user_id",
  "staging.modello_ruoli_undo.user_id",
  "staging.qaweb_valore_eventi_undo_20261106.valore_evento_attore_user_id",
  "staging.rtl_allinea_livelli_undo.user_id",
  "staging.ruoli_senza_cliente_undo.user_id",
  "staging.tenant_import_people.tenant_import_person_id",
  "sys.sys_advisor_suggestions.advisor_suggestion_subject_id",
  "sys.sys_capability_scores.capability_score_subject_id",
  "sys.sys_mandate_act_audit.mandate_act_audit_user_id",
  // created_by/updated_by senza chiave esterna: la persona come autrice
  "sys.sys_auth_mfa_exemptions.created_by",
  "sys.sys_auth_mfa_exemptions.updated_by",
  "sys.sys_candidates.created_by",
  "sys.sys_candidates.updated_by",
  "sys.sys_interview_feedback.created_by",
  "sys.sys_interview_feedback.updated_by",
  "sys.sys_process_participants.created_by",
  "sys.sys_process_participants.updated_by",
  "sys.sys_project_members.created_by",
  "sys.sys_project_members.updated_by",
  "sys.sys_user_delegations.created_by",
  "sys.sys_user_delegations.updated_by",
  "sys.sys_user_skills.created_by",
  "sys.sys_user_skills.updated_by",
];

/**
 * Ciò che il censimento ha trovato e che il faldone NON legge, con la ragione. Una colonna che non
 * è un uuid non può valere l'id di una persona; un archivio di righe di catalogo non è un dato di
 * persona; una chiave interna non è un legame.
 */
export const IMPLICITI_ESCLUSI: Readonly<Record<string, string>> = {
  "audit.career_paths_junk_archive.*": "archivio di percorsi di catalogo: la persona vi compare solo come autrice di un dato già tolto",
  "audit.learning_junk_archive.*": "archivio di catalogo formativo già tolto",
  "audit.learning_modules_junk_archive.*": "archivio di moduli di catalogo già tolti",
  "audit.skill_dedup_archive.*": "archivio di competenze di catalogo deduplicate",
  "audit.skills_junk_archive.*": "archivio di competenze di catalogo già tolte",
  "audit.training_initiatives_junk_archive.created_by": "autrice di un dato di catalogo già tolto (il facilitatore invece si legge)",
  "audit.training_initiatives_junk_archive.updated_by": "come sopra",
  "audit.position_requirements_stale_archive.archived_by": "testo, non un identificativo di persona",
  "staging.posti_c13_riapertura_undo.updated_by": "giornale di riapertura di posti: autore di una correzione di struttura",
  "staging.rtl_employee_module_completions.employee_id": "codice del vecchio sistema (testo), non un identificativo di persona (ADR-0038)",
  "staging.totp_derivato_undo.factor_id": "identificativo di un fattore, non di una persona",
  "sys.sys_auth_mfa_exemption_eligible_users.created_by": "testo, non un identificativo",
  "sys.sys_auth_mfa_factors.auth_mfa_factor_id": "chiave interna del fattore",
  "sys.sys_auth_mfa_otp_challenges.auth_mfa_otp_factor_id": "chiave interna del fattore",
  "sys.sys_auth_mfa_webauthn_credentials.auth_webauthn_cred_factor_id": "chiave interna del fattore",
  "sys.sys_auth_mfa_policies.*": "politica di tenant: configurazione, non persona",
  "sys.sys_blueprint_content_receipts.*": "testo, non un identificativo",
  "sys.sys_candidate_applications.*": "autore di una candidatura altrui (la candidatura si legge come dato collegato della persona assunta)",
  "sys.sys_industry_forbidden_terms.*": "testo, non un identificativo",
  "sys.sys_interviews.*": "autore di un colloquio altrui",
  "sys.sys_job_offers.*": "autore di un'offerta altrui",
  "sys.sys_job_postings.*": "autore di un annuncio",
  "sys.sys_job_requisitions.*": "autore di una richiesta di assunzione",
  "sys.sys_mandate_acts.mandate_act_review_by": "è una data",
  "sys.sys_user_auth_roles.user_auth_role_review_by": "è una data",
  "sys.sys_projects.*": "autore di un progetto (la partecipazione si legge da project_members)",
  "sys.sys_schema_migrations.*": "registro delle migrazioni",
  "sys.sys_tenant_process_activity_rules.*": "autore di una regola di processo",
  "sys.sys_tenant_process_steps.*": "autore di un passo di processo",
  "sys.sys_tenant_processes.*": "autore di un processo",
  "sys.sys_user_identity_documents.*": "il controllo per nome ha preso colonne del documento: il legame vero è user_identity_document_user_id, con chiave esterna",
  "sys.sys_users.user_id": "è la persona stessa",
};

/**
 * Le colonne di legame che dicono che la riga PARLA della persona. Tutte le altre sono `relazione`.
 * Si scrivono come `tabella.colonna`.
 */
const SOGGETTO: ReadonlySet<string> = new Set([
  "audit.user_self_service_actions.action_user_id",
  "audit.valore_eventi.valore_evento_attore_user_id",
  "audit.registro_scritture.registro_scrittura_persona_user_id",
  "audit.overtime_exempt_archive.overtime_subject_user_id",
  "audit.chiavi_idempotenza.chiave_idempotenza_user_id",
  "sys.sys_agent_conversations.agent_conversation_user_id",
  "sys.sys_assessments.assessment_subject_user_id",
  "sys.sys_attendance.attendance_subject_user_id",
  "sys.sys_auth_identities.auth_identity_user_id",
  "sys.sys_auth_login_events.auth_login_event_user_id",
  "sys.sys_auth_mfa_exemption_audit.auth_mfa_exemption_audit_user_id",
  "sys.sys_auth_mfa_exemption_eligible_users.auth_mfa_eligible_user_id",
  "sys.sys_auth_mfa_exemptions.auth_mfa_exemption_user_id",
  "sys.sys_auth_mfa_factors.auth_mfa_factor_user_id",
  "sys.sys_auth_mfa_otp_challenges.auth_mfa_otp_user_id",
  "sys.sys_auth_mfa_recovery_codes.recovery_code_user_id",
  "sys.sys_auth_mfa_webauthn_credentials.auth_webauthn_cred_user_id",
  "sys.sys_auth_password_reset_tokens.auth_password_reset_user_id",
  "sys.sys_auth_refresh_tokens.auth_refresh_token_user_id",
  "sys.sys_auth_sessions.auth_session_user_id",
  "sys.sys_behavioral_assessments.behavioral_assessment_user_id",
  "sys.sys_calibration_discussions.calibration_discussion_subject_user_id",
  "sys.sys_calibration_participants.calibration_participant_user_id",
  "sys.sys_candidates.candidate_hired_user_id",
  "sys.sys_goal_check_ins.check_in_subject_user_id",
  "sys.sys_okr_check_ins.check_in_subject_user_id",
  "sys.sys_compensation_recommendations.compensation_recommendation_user_id",
  "sys.sys_user_consents.consent_user_id",
  "sys.sys_employee_position_fit_scores.employee_position_fit_score_user_id",
  "sys.sys_continuous_feedback.feedback_to_user_id",
  "sys.sys_flight_risk_scores.flight_risk_score_user_id",
  "sys.sys_gap_analysis_results.gap_analysis_result_user_id",
  "sys.sys_gap_closure_plans.gap_closure_plan_user_id",
  "sys.sys_gdpr_requests.gdpr_request_subject_user_id",
  "sys.sys_goals.goal_subject_user_id",
  "sys.sys_kpi_assessment_results.kpi_assessment_result_user_id",
  "sys.sys_kpi_measurements.kpi_measurement_user_id",
  "sys.sys_kpi_targets.kpi_target_user_id",
  "sys.sys_learning_gaps.learning_gap_user_id",
  "sys.sys_mandate_acts.mandate_act_user_id",
  "sys.sys_mandate_act_audit.mandate_act_audit_user_id",
  "sys.sys_mentor_match_scores.match_mentee_user_id",
  "sys.sys_mentor_match_scores.match_mentor_user_id",
  "sys.sys_mentorships.mentorship_mentee_user_id",
  "sys.sys_mentorships.mentorship_mentor_user_id",
  "sys.sys_model_predictions.prediction_subject_user_id",
  "sys.sys_notification_preferences.preference_user_id",
  "sys.sys_inbox_notifications.notification_user_id",
  "sys.sys_overtime.overtime_subject_user_id",
  "sys.sys_performance_review_competency_ratings.rating_subject_user_id",
  "sys.sys_performance_reviews.review_subject_user_id",
  "sys.sys_person_evidence_records.person_evidence_record_user_id",
  "sys.sys_platform_user_tenant_assignments.platform_user_tenant_assignment_user_id",
  "sys.sys_process_participants.process_participant_user_id",
  "sys.sys_project_members.project_member_user_id",
  "sys.sys_pulse_checks.pulse_check_subject_user_id",
  "sys.sys_readiness_scores.readiness_score_user_id",
  "sys.sys_engagement_survey_responses.response_subject_user_id",
  "sys.sys_feedback_360_responses.response_target_user_id",
  "sys.sys_reward_gates.reward_gate_user_id",
  "sys.sys_skill_gap_scores.skill_gap_score_user_id",
  "sys.sys_succession_readiness_scores.succession_readiness_score_user_id",
  "sys.sys_succession_scores.succession_score_user_id",
  "sys.sys_successor_candidates.successor_candidate_user_id",
  "sys.sys_survey_assignments.survey_assignment_user_id",
  "sys.sys_survey_responses.survey_response_subject_user_id",
  "sys.sys_talent_scores.talent_score_user_id",
  "sys.sys_team_members.team_member_user_id",
  "sys.sys_time_off_balances.balance_subject_user_id",
  "sys.sys_time_off_requests.request_subject_user_id",
  "sys.sys_user_addresses.user_address_user_id",
  "sys.sys_user_assessment_evidence.user_assessment_evidence_user_id",
  "sys.sys_user_auth_roles.user_auth_role_user_id",
  "sys.sys_user_bank_details.user_bank_user_id",
  "sys.sys_user_career_plans.user_career_plan_user_id",
  "sys.sys_user_certifications.user_certification_user_id",
  "sys.sys_user_contracts.user_contract_user_id",
  "sys.sys_user_delegations.user_delegation_delegator_id",
  "sys.sys_user_delegations.user_delegation_delegate_id",
  "sys.sys_user_demographics.user_demographics_user_id",
  "sys.sys_user_documents.user_document_user_id",
  "sys.sys_user_education_records.user_education_record_user_id",
  "sys.sys_user_employment.user_employment_user_id",
  "sys.sys_user_family_members.user_family_member_user_id",
  "sys.sys_user_identity_documents.user_identity_document_user_id",
  "sys.sys_user_kpi_evidence.user_kpi_evidence_user_id",
  "sys.sys_user_learning_assignments.user_learning_assignment_user_id",
  "sys.sys_user_learning_evidence.user_learning_evidence_user_id",
  "sys.sys_user_pay_slips.user_pay_slip_user_id",
  "sys.sys_user_position_assignments.user_position_assignment_user_id",
  "sys.sys_user_preferences.user_preference_user_id",
  "sys.sys_user_professional_experiences.user_prof_exp_user_id",
  "sys.sys_user_profile_embeddings.user_id",
  "sys.sys_user_profiles.user_profile_user_id",
  "sys.sys_user_skill_evidence.user_skill_evidence_user_id",
  "sys.sys_user_skills.user_skill_user_id",
  "sys.sys_user_target_positions.user_target_position_user_id",
  "sys.sys_user_timeline_events.user_timeline_event_user_id",
  "sys.sys_variable_pay_calculations.variable_pay_calculation_user_id",
  "sys.sys_advisor_suggestions.advisor_suggestion_subject_id",
  "sys.sys_capability_scores.capability_score_subject_id",
  "staging.collaudo_sospensione_undo.undo_user_id",
  "staging.mig264_employment_undo.user_employment_user_id",
  "staging.mig307_dirigenti_undo.user_id",
  "staging.mig362_buste_heuresys_undo.user_id",
  "staging.modello_ruoli_undo.user_id",
  "staging.qaweb_valore_eventi_undo_20261106.valore_evento_attore_user_id",
  "staging.rtl_allinea_livelli_undo.user_id",
  "staging.ruoli_senza_cliente_undo.user_id",
  "staging.tenant_import_people.tenant_import_person_id",
]);

export function legameSoggetto(tabella: string, colonna: string): boolean {
  return SOGGETTO.has(`${tabella}.${colonna}`);
}

export function classificazioneDi(tabella: string): Classificazione | undefined {
  const r = TABELLE[tabella];
  if (!r) return undefined;
  const c: Classificazione = { classe: r[0], capitolo: r[1], titolo: r[2] };
  if (r[3] === "privata") c.privata = true;
  if (r[3] === "soloSe") c.soloSe = true;
  return c;
}

export const TABELLE_CLASSIFICATE: readonly string[] = Object.keys(TABELLE);
export const LEGAMI_SOGGETTO: readonly string[] = [...SOGGETTO];

/** Il ruolo di una colonna di `relazione`, per il titolo della sezione («— come valutatore»). */
const RUOLI: ReadonlyArray<[RegExp, string]> = [
  [/(^|_)created_by(_user_id)?$|_initiated_by$|_started_by$|_taken_by$|_uploaded_by$|_recorded_by$/, "inseriti"],
  [/(^|_)updated_by$/, "modificati"],
  [/_reviewer_user_id$|_assessor_user_id$|_evaluator_user_id$|_calibrated_by_user_id$|_finalized_by_user_id$/, "come valutatore"],
  [/_approver_user_id$|_approved_by(_user_id)?$|_verified_by_user_id$/, "come approvatore"],
  [/_decided_by$|_definitive_by$/, "come decisore"],
  [/_owner_user_id$|_manager_user_id$|_lead_user_id$/, "come responsabile"],
  [/_author_user_id$|_published_by_user_id$/, "come autore"],
  [/_facilitator_user_id$/, "come facilitatore"],
  [/_interviewer_user_id$/, "come intervistatore"],
  [/_assignee_user_id$/, "come incaricato"],
  [/_assigned_by$|_granted_by$|_proposed_by$|_requested_by(_user_id)?$|_performed_by_user_id$|_revoked_by$|_cancelled_by_user_id$/, "come richiedente o esecutore"],
  [/_from_user_id$/, "dati ad altri"],
  [/_actor_user_id$/, "come autore della modifica"],
  [/_hired_user_id$/, "come assunto"],
];

export function ruoloDiRelazione(colonna: string): string {
  for (const [re, r] of RUOLI) if (re.test(colonna)) return r;
  return "collegati";
}
