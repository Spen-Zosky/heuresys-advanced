-- 000429 — Mandato K, X-1: classificazione ratificata (passo 60, D6=A).
--
-- IL PERCHE'. I23 (ADR-0041) dichiara che ogni tabella `sys.sys_*` di dato cliente sta in
-- uno stato: nativo, importato, ibrido, infrastruttura. I-E (S1103, 2026-09-15) ha misurato
-- 245 tabelle: 97 ibrido, 88 importato, 32 infrastruttura, 28 nativo, con 103 "dubbie"
-- (regola meccanica del passo 22: scrittori API E di importazione insieme, o righe>0 senza
-- scrittore, o le quattro di D6). Le dubbie sono state ratificate da Enzo (esiti/RISPOSTE_ENZO.md,
-- chiave X-1, 2026-09-19) con UNA regola: "il secondo scrittore conta solo se continua a
-- scrivere" — un seed/migrazione one-shot non fa una tabella ibrida, solo un flusso di
-- importazione VERO la fa.
--
-- CONTROLLO RIFATTO, non ereditato (S1108, prima di scrivere questo file): le 103 righe
-- dubbie di I-E.md sono state rigenerate a partire dal file e confrontate con l'elenco di
-- RISPOSTE_ENZO — stesso insieme di 103 tabelle, stesso conteggio finale (76 ibrido / 23
-- nativo / 4 importato). Il conto torna: nessuna differenza da segnalare prima di migrare.
--
-- SEI TABELLE NUOVE misurate oggi, nate dopo I-E (R-0/R-1/S-1, mig. 000418/000420/000421):
-- sys_esco_isco_resolved, sys_nine_box_grid, sys_position_intelligence_profiles_v (VIEW,
-- information_schema.tables le include: la post-condizione lo pretende) e
-- sys_permessi_plenipotenziari_ammessi, sys_platform_user_tenant_assignments,
-- sys_ritiri_ammessi (registri tecnici RBAC) — tutte classificate `infrastruttura`.
--
-- TOTALE: 252 tabelle (76 ibrido, 51 nativo, 86 importato, 39 infrastruttura — l'ultima
-- e' la tabella stessa, che classifica se stessa per non violare la propria invariante).
--
-- Effetto per dove_siamo.py:
--   select 1 from information_schema.tables where table_schema='sys' and table_name='sys_classificazione_direzione_dato'
--
\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_classificazione_direzione_dato (
  tabella  varchar(128) PRIMARY KEY,
  stato    varchar(16)  NOT NULL CHECK (stato IN ('nativo', 'importato', 'ibrido', 'infrastruttura')),
  motivo   text         NOT NULL,
  adr      varchar(16)  NOT NULL DEFAULT 'ADR-0041',
  ratificato_il date     NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE sys.sys_classificazione_direzione_dato IS
  '000429 (mandato K, X-1) — la direzione del dato per ogni tabella sys.sys_* di dato cliente (I23, ADR-0041): nativo/importato/ibrido/infrastruttura. Fonte: I-E (misura) + RISPOSTE_ENZO (ratifica delle 103 dubbie).';

INSERT INTO sys.sys_classificazione_direzione_dato (tabella, stato, motivo)
VALUES
  ('sys_activity_classification_mappings', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): ha scrittori API E scrittori di importazione (migrazioni crosswalk ATECO/NACE): regola meccanica -> dubbia'),
  ('sys_activity_classifications', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): ha scrittori API E scrittori di importazione: regola meccanica -> dubbia. Nota per I-D/S-3: 3.276 righe di registro citano questa tabella ma la JOIN con gli id'),
  ('sys_advisor_suggestions', 'nativo', 'solo scrittore API, nessuna importazione trovata'),
  ('sys_approval_requests', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): ha scrittori API E scrittori di seed (storia36): regola meccanica -> dubbia'),
  ('sys_approval_steps', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): ha scrittori API E scrittori di seed: regola meccanica -> dubbia'),
  ('sys_assessment_methods', 'infrastruttura', 'catalogo statico seminato una volta in migrazione, nessun writer applicativo: registro di piattaforma'),
  ('sys_assessment_results', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API E scrittore di seed rtl-rebuild: dubbia'),
  ('sys_assessments', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API E scrittore di seed rtl-rebuild: dubbia'),
  ('sys_attendance', 'importato', 'nessuno scrittore applicativo, popolata solo da seed/materializzazione; non scatta ''nessuno scrittore'' perche'' il seed esiste. Nota I-D/S-3: 5.199 righe di regi'),
  ('sys_auth_credentials', 'infrastruttura', 'credenziali di autenticazione, non dato del cliente'),
  ('sys_auth_identities', 'infrastruttura', 'identita'' di autenticazione, infrastruttura auth'),
  ('sys_auth_login_events', 'infrastruttura', 'registro eventi di login, infrastruttura/audit'),
  ('sys_auth_mfa_exemption_audit', 'infrastruttura', 'popolata da un trigger di database, registro di audit'),
  ('sys_auth_mfa_exemption_eligible_users', 'infrastruttura', 'allowlist seminata in migrazione, configurazione di sicurezza'),
  ('sys_auth_mfa_exemptions', 'infrastruttura', 'esenzioni MFA seminate in migrazione'),
  ('sys_auth_mfa_factors', 'infrastruttura', 'fattori MFA, infrastruttura auth'),
  ('sys_auth_mfa_otp_challenges', 'infrastruttura', 'sfide OTP transitorie, 0 righe'),
  ('sys_auth_mfa_policies', 'infrastruttura', 'policy MFA di piattaforma, configurazione'),
  ('sys_auth_mfa_recovery_codes', 'infrastruttura', 'codici di recupero MFA, 0 righe'),
  ('sys_auth_mfa_webauthn_credentials', 'infrastruttura', 'credenziali WebAuthn, 0 righe'),
  ('sys_auth_password_reset_tokens', 'infrastruttura', 'token di reset password, 0 righe'),
  ('sys_auth_permissions', 'infrastruttura', 'catalogo permessi RBAC, seminato da 50 migrazioni, mai da API'),
  ('sys_auth_refresh_tokens', 'infrastruttura', 'token di sessione, infrastruttura auth'),
  ('sys_auth_role_permissions', 'infrastruttura', 'mappa ruolo-permesso, seminata da 80 migrazioni'),
  ('sys_auth_roles', 'infrastruttura', 'catalogo ruoli RBAC, seminato da 6 migrazioni'),
  ('sys_auth_sessions', 'infrastruttura', '0 righe e nessuno scrittore trovato in tutto il repository; possibile residuo morto'),
  ('sys_behavioral_assessments', 'importato', 'nessuno scrittore applicativo, solo seed di riconciliazione'),
  ('sys_blueprint_activations', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittori API E scrittori di seed/migrazione: dubbia'),
  ('sys_blueprint_content_dashboards', 'importato', 'contenuto del profilo dichiarato di un cliente, scritto solo da migrazioni, nessuna rotta API'),
  ('sys_blueprint_content_job_roles', 'importato', 'contenuto del profilo dichiarato di un cliente, scritto solo da migrazioni'),
  ('sys_blueprint_content_kpis', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API E scrittore di migrazione: dubbia'),
  ('sys_blueprint_content_positions', 'nativo', 'scritta solo dal modulo research, nessuna importazione'),
  ('sys_blueprint_content_skills', 'nativo', 'scritta solo dal modulo research, nessuna importazione'),
  ('sys_blueprint_content_units', 'nativo', 'scritta solo dal modulo research, nessuna importazione'),
  ('sys_blueprint_families', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittori API E scrittori di migrazione: dubbia'),
  ('sys_blueprint_family_activity_classes', 'infrastruttura', 'mappa attivita''-famiglia, tassonomia di piattaforma seminata da migrazioni'),
  ('sys_blueprint_overrides', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API E scrittore di seed: dubbia'),
  ('sys_blueprint_process_registry', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittori API (2 moduli) E scrittore di migrazione: dubbia'),
  ('sys_blueprint_variant_versions', 'infrastruttura', 'versionamento del catalogo, seminato solo da migrazione, nessuna rotta API'),
  ('sys_blueprint_variants', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API E scrittori di migrazione: dubbia'),
  ('sys_bonus_pools', 'importato', 'solo seed storico archiviato; apps/api/src/modules/compensation/repository.ts:735,743 lo legge soltanto'),
  ('sys_branches', 'importato', 'solo seed/materializzazione, nessuna rotta API di scrittura trovata'),
  ('sys_calibration_discussions', 'importato', 'repository.ts:116 la legge soltanto; scritta solo dalla migrazione di ingest legacy'),
  ('sys_calibration_participants', 'importato', 'repository.ts:80 la legge soltanto; nessun writer API'),
  ('sys_calibration_sessions', 'importato', 'repository.ts:58,61,71 la legge soltanto; nessun writer API'),
  ('sys_candidate_applications', 'nativo', 'solo rotta API (INSERT/UPDATE), nessun writer di importazione'),
  ('sys_candidates', 'nativo', 'solo rotta API (INSERT/UPDATE), nessun writer di importazione'),
  ('sys_capability_maturity_scores', 'nativo', 'solo rotta API (INSERT), nessun writer di importazione trovato'),
  ('sys_capability_score_lineage', 'nativo', 'solo rotta API (INSERT), nessun writer di importazione trovato'),
  ('sys_capability_scores', 'nativo', 'solo rotta API (INSERT), nessun writer di importazione trovato'),
  ('sys_career_path_steps', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittori API E scrittori di importazione coesistono'),
  ('sys_career_paths', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittori API E scrittore di importazione storico (archiviato) coesistono'),
  ('sys_compensation_bands', 'importato', 'repository.ts:84,1095,1105 la legge soltanto; righe_con_provenienza (75) supera righe (41), da segnalare'),
  ('sys_compensation_recommendations', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittore API e scrittori di importazione coesistono'),
  ('sys_content_blueprint_links', 'nativo', 'solo rotta API (INSERT), nessun writer di importazione'),
  ('sys_content_categories', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittori API e scrittore di importazione coesistono'),
  ('sys_content_documents', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittori API multipli e scrittore di importazione coesistono'),
  ('sys_content_media', 'nativo', 'solo rotta API trovata, 0 righe, nessun writer di importazione'),
  ('sys_content_versions', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittori API multipli e scrittore di importazione coesistono'),
  ('sys_continuous_feedback', 'importato', 'nessuna rotta API di scrittura trovata; righe_con_provenienza combacia esattamente con righe'),
  ('sys_critical_positions', 'importato', 'talent-review/repository.ts:382,390 la legge soltanto (catalogo, nessuna riga persona)'),
  ('sys_critical_role_coverage_status', 'importato', 'nessuna rotta API di scrittura trovata'),
  ('sys_dashboard_block_data_classes', 'importato', 'dashboard/repository.ts:328 la legge soltanto; popolata da INSERT calcolato dentro la migrazione 000316'),
  ('sys_dashboard_blocks', 'importato', 'dashboard/repository.ts:324 la legge soltanto'),
  ('sys_dashboards', 'importato', 'dashboard/repository.ts:323 la legge soltanto'),
  ('sys_employee_position_fit_scores', 'importato', 'talent-review/repository.ts:166,174 la legge soltanto'),
  ('sys_engagement_action_plans', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittori API e scrittore di importazione coesistono'),
  ('sys_engagement_feedback', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittori API e scrittore di importazione coesistono'),
  ('sys_engagement_survey_responses', 'importato', 'surveys/repository.ts:214,217,221 la legge soltanto'),
  ('sys_engagement_survey_templates', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittori API (INSERT/UPDATE/DELETE) e scrittore di importazione coesistono'),
  ('sys_engagement_surveys', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittori API e scrittori di importazione coesistono'),
  ('sys_enterprise_size_bands', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittore API e scrittore di importazione/seed coesistono'),
  ('sys_enterprise_typing_profiles', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittore API e scrittore di importazione coesistono'),
  ('sys_esco_isco_resolved', 'infrastruttura', 'NUOVA dopo I-E, misurata S1108 (2026-09-19): vista tecnica di risoluzione ESCO-ISCO (reference_sync), non tabella base con dati propri'),
  ('sys_esco_occupation_embeddings', 'nativo', 'unico writer e'' la rotta API di calcolo embedding; verify-storia36-dossier.sql la legge soltanto'),
  ('sys_esco_occupation_mappings', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittore API (reference-sync ESCO) e scrittori di importazione storica (brownfield archiviati) coesistono'),
  ('sys_feedback_360_responses', 'importato', 'evidence/repository.ts la legge soltanto; nessuna rotta API di scrittura'),
  ('sys_flight_risk_scores', 'nativo', 'solo rotta API (DELETE+INSERT di ricalcolo), nessun writer di importazione'),
  ('sys_gap_analysis_results', 'importato', 'learning-gaps/repository.ts la legge soltanto; nessuna rotta API di scrittura'),
  ('sys_gap_closure_actions', 'importato', 'learning-gaps/repository.ts la legge soltanto; nessuna rotta API di scrittura'),
  ('sys_gap_closure_plans', 'importato', 'learning-gaps/repository.ts la legge soltanto; nessuna rotta API di scrittura'),
  ('sys_gdpr_data_map', 'infrastruttura', 'registro tecnico (mappa tabelle/colonne per il tooling GDPR), non dati del cliente; gdpr/repository.ts la legge soltanto'),
  ('sys_gdpr_requests', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API e scrittore import coesistono (regola meccanica)'),
  ('sys_generated_record_origins', 'infrastruttura', 'registro tecnico dell''origine di righe generate, non dato di business'),
  ('sys_goal_alignments', 'importato', 'nessun writer in apps/api; trovato solo nella pipeline brownfield ritirata (100/100 righe con provenienza)'),
  ('sys_goal_check_ins', 'importato', 'nessuna rotta API di scrittura, solo import/avanzamento storia36'),
  ('sys_goal_comments', 'importato', 'nessuna rotta API; popolata da pipeline brownfield ritirata, ripulita da purge'),
  ('sys_goal_milestones', 'importato', 'nessuna rotta API; scrittore trovato solo nell''archivio brownfield ritirato'),
  ('sys_goal_templates', 'importato', 'nessuna rotta API; popolata da brownfield ritirato, tradotta da script di governance'),
  ('sys_goal_updates', 'importato', 'nessuna rotta API; popolata da brownfield ritirato'),
  ('sys_goals', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API reale e molteplici scrittori import coesistono'),
  ('sys_inbox_notifications', 'infrastruttura', 'coda tecnica di notifiche in-app, non dato di business del cliente'),
  ('sys_industry_codes', 'importato', 'tassonomia popolata solo da migrazioni'),
  ('sys_industry_forbidden_terms', 'importato', 'lista di governance popolata da migrazione'),
  ('sys_interview_feedback', 'nativo', 'unico scrittore e'' la rotta API, 0 righe'),
  ('sys_interviews', 'nativo', 'unico scrittore e'' la rotta API, 0 righe'),
  ('sys_job_families', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API reale e scrittori import/traduzione coesistono'),
  ('sys_job_offers', 'nativo', 'unico scrittore e'' la rotta API, 0 righe'),
  ('sys_job_postings', 'nativo', 'unico scrittore e'' la rotta API, 0 righe'),
  ('sys_job_requisitions', 'nativo', 'unico scrittore e'' la rotta API, 0 righe'),
  ('sys_job_role_embeddings', 'nativo', 'unico scrittore e'' rotta API di reindex (permesso tecnico matching:admin); da rivalutare in X-0'),
  ('sys_job_roles', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API reale e numerose migrazioni/seed di ricostruzione coesistono'),
  ('sys_kpi_assessment_methods', 'importato', 'catalogo popolato da migrazione seed'),
  ('sys_kpi_assessment_results', 'importato', 'popolata da seed di riconciliazione e storia36'),
  ('sys_kpi_definitions', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API reale (CRUD) e scrittore di materializzazione/seed coesistono'),
  ('sys_kpi_measurements', 'importato', 'nessuna rotta API; colonna origine gia'' dichiara LEGACY_IMPORT'),
  ('sys_kpi_metric_definitions', 'importato', 'popolata da seed di riconciliazione'),
  ('sys_kpi_targets', 'importato', 'nessuna rotta API; popolata da seed'),
  ('sys_kpi_weighting_rules', 'importato', 'catalogo popolato da migrazione seed'),
  ('sys_leads', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API reale (cattura lead pubblica) e scrittore import (seed storia36) coesistono'),
  ('sys_learning_gaps', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API reale e scrittori import/seed coesistono'),
  ('sys_learning_modules', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API reale e numerosi scrittori import/seed coesistono; 4959 record di registro ma 0 combaciano con gli id attuali (orfani, oggetto di I-D)'),
  ('sys_learning_path_steps', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API reale e scrittore import coesistono'),
  ('sys_learning_paths', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API reale e migrazioni di purge/riparazione coesistono'),
  ('sys_leave_accrual_rules', 'importato', 'nessuna rotta API; popolata da oneshot storia36'),
  ('sys_leave_balance_transactions', 'nativo', 'unico scrittore trovato e'' l''API; anomalia: 20/20 righe hanno provenienza nel registro ma nessun import writer individuato per nome (segnalato per revisione X-1'),
  ('sys_mentor_match_scores', 'importato', 'nessuna rotta API; popolata da migrazioni e seed'),
  ('sys_mentorship_programs', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API reale e scrittore import coesistono'),
  ('sys_mentorship_sessions', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API reale e scrittore import coesistono'),
  ('sys_mentorships', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): scrittore API reale e scrittore import coesistono'),
  ('sys_model_predictions', 'importato', 'nessuna rotta API; predizioni ML da seed di riconciliazione'),
  ('sys_nine_box_grid', 'infrastruttura', 'NUOVA dopo I-E, misurata S1108 (2026-09-19): vista di presentazione derivata da tabelle gia classificate (talent review)'),
  ('sys_notification_preferences', 'nativo', 'unico scrittore e'' la rotta self-service /v1/me, 0 righe'),
  ('sys_objective_reward_rules', 'importato', 'nessuna rotta API; nessuno scrittore in db/ ma trovato nell''archivio brownfield ritirato'),
  ('sys_occupation_classification_mappings', 'importato', '0 scrittori API e 0 scrittori di importazione trovati; righe=0 quindi la regola meccanica non scatta. Tabella creata in db/migrations/000206_occupation_classifi'),
  ('sys_occupation_classifications', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: ha scrittori API E scrittori di importazione -> dubbia'),
  ('sys_occupation_skill_requirements', 'importato', 'nessuno scrittore API (solo 1 lettura in public-stats/repository.ts:12); scrittore di importazione presente -> non dubbia'),
  ('sys_okr_check_ins', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: righe>0 (25) E nessuno scrittore trovato (repository.ts:138 dichiara esplicitamente READ-only; 0 riscontri INSERT in db/migrations e db/seeds)'),
  ('sys_okr_key_results', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: righe>0 (20) E nessuno scrittore trovato (solo SELECT in okrs/repository.ts; 0 riscontri INSERT in db/) -> dubbia'),
  ('sys_okrs', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: ha scrittori API E uno scrittore in db/migrations -> dubbia; ma quest''ultimo e'' dentro l''UNDO della migrazione 000357 (ripristina righe cancel'),
  ('sys_operating_model_catalog', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: ha scrittore API E scrittore di importazione/seed -> dubbia'),
  ('sys_organization_unit_history', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: ha scrittore API E scrittori di importazione/backfill storico -> dubbia'),
  ('sys_organization_unit_kpi_templates', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: ha scrittore API E scrittore di importazione -> dubbia'),
  ('sys_organization_unit_processes', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: ha scrittore API E scrittore di importazione (seed RACI demo RTL) -> dubbia'),
  ('sys_organization_unit_templates', 'importato', '0 scrittori API (nessun riscontro in apps/api/src ne'' apps/web/src, nemmeno in lettura); scrittore di importazione presente -> non dubbia'),
  ('sys_organization_unit_types', 'importato', 'solo letture da API (SELECT in tenant-materialization/repository.ts:80, research/repository.ts:596), 0 scrittori API; scrittori di importazione presenti -> non'),
  ('sys_organization_units', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: ha scrittori API (CRUD) E scrittori di importazione/materializzazione (tenant-materialization dal blueprint + seed storico) -> dubbia'),
  ('sys_overtime', 'importato', '0 scrittori API trovati (solo letture in analytics/repository.ts e me/repository.ts, nessun modulo overtime con rotta di scrittura); scrittore di importazione p'),
  ('sys_payout_curves', 'importato', 'solo lettura da API (compensation/repository.ts:955 SELECT); scrittore di importazione presente -> non dubbia'),
  ('sys_payroll_handoff_records', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: ha scrittore API (rotta POST reale) E scrittori di importazione (seed storia36) -> dubbia'),
  ('sys_performance_review_competency_ratings', 'importato', 'solo lettura da API (evidence/repository.ts:105 SELECT); scrittore di importazione presente -> non dubbia'),
  ('sys_performance_reviews', 'importato', 'solo lettura da API (repository.ts, commento ''sys.sys_performance_reviews (548 valutazioni storiche)'', nessun INSERT/UPDATE nel file); scrittore di importazione'),
  ('sys_permessi_plenipotenziari_ammessi', 'infrastruttura', 'NUOVA dopo I-E, misurata S1108 (2026-09-19): registro tecnico RBAC (S-1, mig 000418), allowlist dei permessi solo-plenipotenziari: non dato del cliente'),
  ('sys_person_evidence_records', 'importato', 'solo lettura da API (evidence/repository.ts:146 SELECT); scrittore di importazione presente -> non dubbia'),
  ('sys_platform_user_tenant_assignments', 'infrastruttura', 'NUOVA dopo I-E, misurata S1108 (2026-09-19): registro tecnico di assegnazione utente-di-piattaforma a tenant (R-0, mig 000421): meccanismo RBAC, non dato business del cliente'),
  ('sys_position_career_paths', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: ha scrittore API E scrittore di importazione/riallineamento -> dubbia'),
  ('sys_position_compensation_profiles', 'importato', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): D6: e'' una delle quattro tabelle (profili retributivi di posizione) dichiarate per decisione di Enzo (D6=A) ''importate, porta non ancora costruita'' -> dubbia=tr'),
  ('sys_position_economic_weight', 'importato', 'solo lettura da API (compensation/repository.ts:869,877 SELECT); scrittore di importazione presente -> non dubbia'),
  ('sys_position_intelligence_profiles_v', 'infrastruttura', 'NUOVA dopo I-E, misurata S1108 (2026-09-19): VIEW (I9, PIP): deriva da tabelle gia classificate, nessuna scrittura propria'),
  ('sys_position_kpi_requirements', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: ha scrittori API E scrittore di importazione -> dubbia'),
  ('sys_position_learning_requirements', 'importato', 'solo lettura da API (positions/repository.ts:605 SELECT); scrittori di importazione presenti -> non dubbia'),
  ('sys_position_skill_requirement_history', 'importato', 'solo lettura da API (positions/repository.ts:705 SELECT); scrittore di importazione presente -> non dubbia'),
  ('sys_position_skill_requirements', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: ha scrittore API E scrittori di importazione/derivazione -> dubbia'),
  ('sys_position_succession_relevance', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: ha scrittore API E scrittori di importazione/riparazione -> dubbia'),
  ('sys_positions', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: ha scrittori API (CRUD posizioni) E scrittore di importazione/materializzazione (tenant-materialization al provisioning) -> dubbia'),
  ('sys_predictive_models', 'importato', 'solo lettura da API (predictions/repository.ts:48,51,55 SELECT); scrittore di importazione presente -> non dubbia'),
  ('sys_process_kpi_templates', 'nativo', 'scrittore API presente; 0 scrittori di importazione trovati -> non dubbia (un solo tipo di scrittore)'),
  ('sys_process_participants', 'importato', '0 scrittori API (solo letture/EXISTS in lib/scope/functional.ts, lib/scope/domains.ts, me/repository.ts: e'' l''asse funzionale ''processes'' del resolver RBAC, let'),
  ('sys_project_members', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: ha scrittori API E scrittori di importazione/seed nella migrazione creatrice (000363) -> dubbia'),
  ('sys_projects', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: ha scrittori API E scrittore di importazione/seed nella migrazione creatrice (000363) -> dubbia'),
  ('sys_pulse_checks', 'importato', 'codice dichiara esplicitamente ''engagement/repository.ts: sys_pulse_checks READ-ONLY''; 0 scrittori API; scrittori di importazione presenti -> non dubbia'),
  ('sys_readiness_scores', 'importato', 'solo lettura da API (talent-review/repository.ts:243,251 SELECT); scrittore di importazione presente -> non dubbia'),
  ('sys_reconciliation_registry', 'infrastruttura', '0 riscontri in apps/api/src (rg --no-ignore --hidden: 0 file); scritta solo da script di riconciliazione storica. E'' il registro del processo di riconciliazione'),
  ('sys_reference_translations', 'importato', 'solo lettura da API (lib/i18n/localize.ts:32 SELECT); scrittore di importazione presente; ha gia'' una colonna di origine propria (source) -> non dubbia'),
  ('sys_research_sources', 'nativo', 'scrittore API presente (con workflow di approvazione: research_source_approved_by/approved_at); 0 scrittori di importazione -> non dubbia'),
  ('sys_review_cycles', 'nativo', 'scrittori API presenti; 0 scrittori di importazione (solo DDL di creazione in migrazione 000256) -> non dubbia'),
  ('sys_reward_gate_catalog', 'importato', 'solo lettura/JOIN da API (compensation/repository.ts righe 219,258,1051); scrittori di importazione presenti -> non dubbia'),
  ('sys_reward_gate_results', 'importato', 'solo lettura/JOIN da API (compensation/repository.ts righe 221,260,292,1053); scrittore di importazione presente -> non dubbia'),
  ('sys_reward_gates', 'importato', 'solo scrittori di importazione, nessuno API; ha tenant_id (reward_gate_tenant_id): dato business del cliente'),
  ('sys_ritiri_ammessi', 'infrastruttura', 'NUOVA dopo I-E, misurata S1108 (2026-09-19): registro tecnico G-D2 dei ritiri di permesso ammessi (R-1, mig 000420): meccanismo RBAC, non dato del cliente'),
  ('sys_schema_migrations', 'infrastruttura', 'registro tecnico delle migrazioni applicate, nessun tenant_id, scritto solo dal runner e dalle migrazioni stesse'),
  ('sys_seed_acquisition_runs', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_seed_approval_decisions', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_seed_candidate_records', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_seed_source_evidence', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_seed_validation_results', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_skill_aliases', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_skill_categories', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_skill_embeddings', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_skill_families', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_skill_gap_scores', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_skill_groups', 'infrastruttura', 'raggruppamento di tassonomia, nessun tenant_id (0/8 colonne), solo import: catalogo di piattaforma coerente con I21'),
  ('sys_skill_learning_mappings', 'importato', 'nessuno scrittore API, solo import/dedup; associazione competenza<->modulo, dato del cliente'),
  ('sys_skill_proficiency_levels', 'infrastruttura', 'catalogo fisso enum-like, nessun tenant_id (0/8 colonne), solo import: stesso pattern di sys_assessment_methods'),
  ('sys_skill_taxonomy_edges', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_skills', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import; NB righe_con_provenienza (19764) > righe (14031), anomalia da segnalare a I-D'),
  ('sys_source_lineage_records', 'infrastruttura', 'e'' il registro di provenienza stesso, esempio esplicito di infrastruttura citato dal passo 22'),
  ('sys_succession_pools', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_succession_readiness_scores', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_succession_scores', 'importato', 'nessuno scrittore API, unico scrittore seed reconciliation: dato business'),
  ('sys_successor_candidates', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_successor_readiness', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_survey_assignments', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_survey_questions', 'importato', 'nessuno scrittore API, solo import/seed: dato business'),
  ('sys_survey_responses', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_survey_templates', 'importato', 'nessuno scrittore API; unico scrittore e'' il seed storico archiviato (docs/archive), ha tenant_id: dato business importato, porta non piu'' presente'),
  ('sys_surveys', 'importato', 'nessuno scrittore API, solo import/seed: dato business'),
  ('sys_talent_scores', 'importato', 'nessuno scrittore API, unico scrittore seed reconciliation: dato business'),
  ('sys_team_members', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_teams', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_tenancies', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_tenant_blueprint_process_decisions', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_tenant_blueprint_snapshots', 'nativo', 'unico scrittore e'' l''effetto applicativo di approvazione, nessuno scrittore di importazione'),
  ('sys_tenant_blueprint_versions', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_tenant_blueprints', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_tenant_boundary_author_columns', 'infrastruttura', 'registro tecnico del confine tenant, nessun tenant_id proprio (0/3 colonne), solo import: metadato di schema per I16'),
  ('sys_time_off_balances', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_time_off_requests', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_training_initiatives', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): combo api+import'),
  ('sys_translatable_field', 'infrastruttura', 'registro tecnico i18n, nessun tenant_id (0/7 colonne), solo import: metadato di piattaforma'),
  ('sys_ui_interface_data_classes', 'infrastruttura', 'solo migrazioni scrivono questo registro di configurazione UI (quali classi di dato espone ogni voce di menu); nessuna rotta CRUD applicativa, nessun writer di'),
  ('sys_ui_interfaces', 'infrastruttura', 'registro delle voci di menu/interfaccia, scritto solo da migrazioni (una per feature che nasce); nessuna rotta API di scrittura; non e'' dato business del client'),
  ('sys_user_addresses', 'importato', 'nessuna rotta di scrittura in apps/api/src (solo SELECT in me/repository.ts:229); tutte le 171 righe generate dal seed anagrafico rtl-rebuild/gen-anagraphic-see'),
  ('sys_user_assessment_evidence', 'importato', 'solo SELECT in apps/api/src (evidence/repository.ts:35); scritta solo da seed rtl-rebuild e dal meccanismo di avanzamento storia36'),
  ('sys_user_auth_roles', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittore API (grant/revoke ruoli in users/repository.ts) E scrittori di importazione (script di provisioning, seed onboarding, migrazioni di'),
  ('sys_user_bank_details', 'importato', 'nessuna rotta di scrittura (solo SELECT in me/repository.ts:249); generata dal seed anagrafico'),
  ('sys_user_career_plans', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: CRUD nativo completo E scrittore di importazione (seed di riconciliazione) coesistono'),
  ('sys_user_certifications', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittore API (aggiunta certificazione self-service) E numerosi scrittori di importazione (seed storia36, rtl-rebuild, migrazioni) coesistono'),
  ('sys_user_consents', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittore API (consenso GDPR via ESS/ADMIN) E scrittori di importazione coesistono; confermato dalla colonna consent_source, 632/649 righe son'),
  ('sys_user_contracts', 'importato', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): D6'),
  ('sys_user_delegations', 'nativo', 'unico scrittore e'' l''API (modulo delegations, mig 000314); nessuno scrittore di importazione trovato in db/ ne'' in docs/archive; 0 righe oggi'),
  ('sys_user_demographics', 'importato', 'nessuna rotta di scrittura (solo SELECT in me/repository.ts:220); generata dal seed anagrafico'),
  ('sys_user_documents', 'importato', 'nessuna rotta di scrittura (solo SELECT in me/repository.ts:1832); unico scrittore e'' il seed di riconciliazione'),
  ('sys_user_education_records', 'importato', 'nessuna rotta di scrittura (solo SELECT in me/repository.ts:244); scritta da seed rtl-rebuild e meccanismo storia36'),
  ('sys_user_employment', 'importato', 'nessuna rotta di scrittura (solo SELECT in me/repository.ts:269); scritta da seed anagrafico e da migrazioni di riorganizzazione'),
  ('sys_user_family_members', 'importato', 'nessuna rotta di scrittura (solo SELECT in me/repository.ts:236); generata dal seed anagrafico'),
  ('sys_user_identity_documents', 'importato', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): D6'),
  ('sys_user_kpi_evidence', 'importato', 'nessuna rotta CRUD utente (solo SELECT/JOIN in insights, capability-maturity, me); unico scrittore in codice e'' l''effetto di materializzazione onboarding tenant'),
  ('sys_user_learning_assignments', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittore API (iscrizione self-service a un percorso) E scrittori di importazione (seed storia36, riconciliazione) coesistono'),
  ('sys_user_learning_evidence', 'importato', 'nessuna rotta di scrittura (solo SELECT in evidence/repository.ts:63); scritta da seed storia36/rtl-rebuild/riconciliazione'),
  ('sys_user_pay_slips', 'importato', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): D6'),
  ('sys_user_position_assignments', 'importato', 'nessuna rotta CRUD nativa trovata (il gesto assegnazione persona-posizione non e'' ancora costruito: e'' G-1, fase F6 del mandato); gli unici scrittori in apps/ap'),
  ('sys_user_preferences', 'nativo', 'unico scrittore e'' l''API self-service (preferenze tema/palette/lingua); nessun writer di importazione trovato'),
  ('sys_user_professional_experiences', 'importato', 'nessuna rotta di scrittura (solo SELECT in me/repository.ts:2017); scritta da seed storia36 e dal meccanismo di avanzamento'),
  ('sys_user_profile_embeddings', 'nativo', 'unico scrittore e'' la rotta POST /reindex (matching:admin) che ricalcola gli embedding dalle evidenze di competenza; nessun writer di importazione dati-cliente'),
  ('sys_user_profiles', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittore API (self-service bio/contatti) E scrittore di importazione (seed rtl-rebuild) coesistono'),
  ('sys_user_skill_evidence', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittore API (autovalutazione/valutazione manager via me/repository.ts) E scrittore di importazione/materializzazione (onboarding tenant, see'),
  ('sys_user_skills', 'importato', 'nessuna rotta CRUD nativa trovata nel codice applicativo (l''unico scrittore in apps/api/src e'' l''effetto di importazione tenant-import-run.ts); il resto sono sc'),
  ('sys_user_target_positions', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: CRUD nativo completo (modulo dedicato + self-service) E scrittori di importazione (seed storia36, migrazione di riallineamento) coesistono'),
  ('sys_user_timeline_events', 'importato', 'il repository stesso lo dichiara in testa (apps/api/src/modules/user-timeline/repository.ts:2-4): ''Sola lettura: la tabella si popola dall''import (...import-d5-'),
  ('sys_users', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittori API (creazione/modifica utente da admin, self-service, GDPR) E scrittori di importazione/materializzazione (onboarding tenant, seed,'),
  ('sys_valutazione_condivisione_eccezioni', 'importato', 'nessuna rotta di scrittura applicativa trovata (solo SELECT in performance-reviews/repository.ts:19,22,97); le 568 righe sono il backfill fatto dalla migrazione'),
  ('sys_variable_pay_calculations', 'importato', 'nessuna rotta di scrittura (solo SELECT in compensation/repository.ts:562,570,1003); scritta da seed storia36/riconciliazione e dalla migrazione di allineamento'),
  ('sys_visualization_edges', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: modulo CRUD nativo dedicato E seed demo organigramma coesistono'),
  ('sys_visualization_exports', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: modulo CRUD nativo E seed/migrazione di redazione coesistono'),
  ('sys_visualization_graphs', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: CRUD nativo E seed demo organigramma coesistono'),
  ('sys_visualization_layouts', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: CRUD nativo E seed di configurazione piattaforma coesistono'),
  ('sys_visualization_node_layouts', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: CRUD nativo E seed di configurazione piattaforma coesistono'),
  ('sys_visualization_nodes', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: CRUD nativo E seed/migrazione coesistono'),
  ('sys_visualization_styles', 'nativo', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: CRUD nativo E seed/migrazione di backfill coesistono'),
  ('sys_whistleblowing_reports', 'ibrido', 'RATIFICATA X-1 (2026-09-19, regola ''il secondo scrittore conta solo se continua a scrivere''): regola meccanica: scrittore API (invio segnalazione whistleblowing) E scrittore di importazione (seed storia36) coesistono'),
  ('sys_classificazione_direzione_dato', 'infrastruttura', 'NUOVA in questa stessa migrazione (000429): la tabella che dichiara la direzione del dato e'' essa stessa infrastruttura RBAC/governance, non dato del cliente — si classifica per non violare la propria invariante (I23), la vista v_tabelle_non_classificate la troverebbe altrimenti scoperta')
ON CONFLICT (tabella) DO UPDATE SET stato = EXCLUDED.stato, motivo = EXCLUDED.motivo;

CREATE OR REPLACE VIEW sys.v_tabelle_non_classificate AS
SELECT t.table_name AS tabella
  FROM information_schema.tables t
 WHERE t.table_schema = 'sys'
   AND t.table_name LIKE 'sys\_%'
   AND t.table_name NOT IN (SELECT tabella FROM sys.sys_classificazione_direzione_dato);
COMMENT ON VIEW sys.v_tabelle_non_classificate IS
  '000429 (mandato K, X-1) — ogni tabella sys.sys_* senza una direzione dichiarata (I23). Zero righe attese: una tabella nuova che compare qui e'' un buco nell''invariante, non un dettaglio.';

DO $$
DECLARE
  n_tot int; n_non_class int; n_ibrido int; n_nativo int; n_importato int; n_infra int;
BEGIN
  SELECT count(*) INTO n_tot FROM sys.sys_classificazione_direzione_dato;
  IF n_tot <> 252 THEN
    RAISE EXCEPTION '000429: attese 252 righe di classificazione, trovate %', n_tot;
  END IF;

  SELECT count(*) INTO n_non_class FROM sys.v_tabelle_non_classificate;
  IF n_non_class <> 0 THEN
    RAISE EXCEPTION '000429: % tabelle sys.sys_* senza classificazione (I23 violato)', n_non_class;
  END IF;

  SELECT count(*) FILTER (WHERE stato = 'ibrido')   INTO n_ibrido   FROM sys.sys_classificazione_direzione_dato;
  SELECT count(*) FILTER (WHERE stato = 'nativo')   INTO n_nativo   FROM sys.sys_classificazione_direzione_dato;
  SELECT count(*) FILTER (WHERE stato = 'importato') INTO n_importato FROM sys.sys_classificazione_direzione_dato;
  SELECT count(*) FILTER (WHERE stato = 'infrastruttura') INTO n_infra FROM sys.sys_classificazione_direzione_dato;
  IF n_ibrido <> 76 OR n_nativo <> 51 OR n_importato <> 86 OR n_infra <> 39 THEN
    RAISE EXCEPTION '000429: conteggio inatteso — ibrido=% nativo=% importato=% infrastruttura=% (attesi 76/51/86/39)',
      n_ibrido, n_nativo, n_importato, n_infra;
  END IF;

  RAISE NOTICE '000429: 252 tabelle classificate (76 ibrido, 51 nativo, 86 importato, 39 infrastruttura); v_tabelle_non_classificate a zero.';
END $$;

COMMIT;

-- FINE 000429
