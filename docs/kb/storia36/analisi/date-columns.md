# Storia36 — TASK B: inventario e classificazione colonne `date`/`timestamptz` dello schema `sys`

Finestra storica G1: **2023-08-01 .. 2026-07-31**. Rilevazione: 2026-07-27, DB `heuresys_advanced` via tunnel :5433 (sola lettura).

Totale colonne inventariate: **513** (fonte: `information_schema.columns`, `table_schema='sys'`, tipi `date` + `timestamp with time zone`; include la vista `sys_position_intelligence_profiles_v`).

## Criteri di classificazione

- **AUDIT_TS** — timestamp di scrittura riga (`created_at`/`updated_at`, soft-delete) **e** timestamp operativi/di sistema scritti a `now()` quando l'azione avviene (token/sessioni/MFA usati, grant RBAC, `*_computed_at` analytics, famiglia `*_recorded_at` — misurata costante = istante del run di seed —, publish, export, pipeline seed, riconciliazione). Esclusi da G1: il runtime continua legittimamente a scriverli dopo la fine finestra.
- **BUSINESS_DATE** — data di un evento/periodo di business consuntivo (presenze, periodi busta/KPI/variable-pay, cicli review/assessment, check-in, risposte survey, assunzioni, nascite, consensi, decorrenze avvenute). **Incluse in G1** come upper bound: `max(col) <= fine finestra`.
- **FUTURE_OK** — semanticamente puo'/deve stare nel futuro (scadenze, expiry, due/target date, fine validita'/contratto/periodo in corso, pianificazione: goal/OKR/KPI-target/ferie/survey schedulate). Escluse da G1 con motivazione.
- **OTHER** — colonne della vista PIP (derivate da `sys_positions`): escluse per doppio conteggio.

**Nota sul lower bound**: G1 va applicato come **solo upper bound** sulle BUSINESS_DATE. Le date lifecycle/anagrafiche precedono legittimamente il 2023-08-01 (contratti dal 2003-03-16, posizioni dal 2005-09-13, istruzione 1988-2019, nascite 1964-1999). Il lower bound `>= 2023-08-01` e' applicabile solo al sottoinsieme *attivita' operativa* (attendance, overtime, buste, periodi KPI/variable-pay, risposte survey, pulse, check-in) — verificato: tutti i minimi attuali di quel sottoinsieme sono >= 2024-01-01, nessuna violazione.

## Riepilogo

| Classe | Colonne |
|---|---|
| AUDIT_TS | 392 |
| BUSINESS_DATE | 70 |
| FUTURE_OK | 49 |
| OTHER | 2 |
| **Totale** | **513** |

## BUSINESS_DATE oltre finestra (max > 2026-07-31)

**Nessuna**: nessuna colonna BUSINESS_DATE ha max attuale oltre il 2026-07-31. L'unica colonna con valori gia' oltre finestra era `sys_goals.goal_start_date` (max 2026-09-03): riclassificata **FUTURE_OK** perche' gli obiettivi pianificati partono legittimamente nel futuro (non dato sporco).

## Casi dubbi e anomalie rilevate

1. **`sys_auth_login_events.created_at`** — il mandato cita la "data login-evento" come business, ma la tabella ha solo `created_at` ed e' un log runtime vivo (91.698 righe, 2026-05-18..2026-07-27, login reali continui): classificata AUDIT_TS/operativa per non generare un falso positivo su ogni login reale successivo alla fine finestra. Se la finestra G1 e' un parametro mobile che segue il tempo, puo' essere promossa a BUSINESS_DATE.
2. **`sys_goals.goal_start_date`** — max 2026-09-03 (> fine finestra): obiettivi pianificati per Q3/Q4 2026. Riclassificata FUTURE_OK; non e' dato sporco.
3. **Famiglia `*_recorded_at`/`*_assessed_at`/`*_verified_at`** — misurate tutte **costanti** (un solo istante per tabella = run di seed: 2026-05-30, 2026-06-01, 2026-06-03) o pari all'istante di un run analytics (`user_skill_verified_at` == run gap-analysis 2026-07-22 01:47:37): confermano la natura di stamp di scrittura, non di data business.
4. **Incoerenze di popolamento** (non-G1, da registrare): `sys_assessments.assessment_period_start` ha 0 valori mentre `assessment_period_end` ne ha 303 (start mai seedato); `sys_user_education_records.user_education_start_date` ha 3 valori contro 159 di `user_education_end_date` (e il min end 1988-01-01 precede il min start 1992-10-01, non valutabile con gli start quasi tutti NULL).
5. **Minimi < 2003** — solo su colonne anagrafiche/storiche dove sono naturali: nascite (min 1964-09-23 familiari, 1970-11-27 dipendenti), istruzione (end min 1988-01-01, start min 1992-10-01). Nessuna data di *attivita' operativa* precede il 2024-01-01. Contratti/assunzioni min 2003-03-16 (= soglia, non anomalo).
6. **Massimi business a ridosso della finestra** — `position_effective_from` e `user_position_assignment_start_date` max 2026-07-23, `organization_unit_effective_from` max 2026-07-21: scritture reali recenti, in finestra, legittime.
7. **Conferme FUTURE_OK dai dati**: refresh token expires max 2026-08-26; bonus pool / KPI target / review period_end max 2026-12-31 (FY2026 in corso); contratti a termine max 2027-02-28; certificazioni max 2029-11-28; documenti identita' max 2035-12-02.
8. **`sys_engagement_survey_responses`**: `response_started_at` max 2026-02-24 ma `response_completed_at` max 2025-01-24 — risposte iniziate e mai completate dopo gennaio 2025; coerente (non anomalo), da sapere.

## Inventario completo

Le colonne con misura vuota appartengono a tabelle vuote o colonne tutte NULL (misura eseguita solo su colonne non `created_at`/`updated_at`).

| Tabella | Colonna | Tipo | Classe | Non-null | Min | Max | Motivo |
|---|---|---|---|---|---|---|---|
| sys_activity_classification_mappings | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_activity_classification_mappings | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_activity_classifications | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_activity_classifications | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_approval_requests | approval_request_applied_at | timestamptz | AUDIT_TS | 0 |  |  | azione runtime del workflow approvazioni (scritta a now() quando l'esito viene applicato) |
| sys_approval_requests | approval_request_resolved_at | timestamptz | AUDIT_TS | 0 |  |  | azione runtime del workflow approvazioni |
| sys_approval_requests | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_approval_requests | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_approval_steps | approval_step_decided_at | timestamptz | AUDIT_TS | 0 |  |  | azione runtime del workflow approvazioni |
| sys_approval_steps | approval_step_due_at | timestamptz | FUTURE_OK | 0 |  |  | scadenza dello step di approvazione |
| sys_approval_steps | approval_step_escalated_at | timestamptz | AUDIT_TS | 0 |  |  | azione runtime (escalation automatica) |
| sys_approval_steps | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_approval_steps | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_assessment_methods | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_assessment_results | assessment_result_recorded_at | timestamptz | AUDIT_TS | 1560 | 2026-05-30 16:33:23 | 2026-05-30 16:33:23 | stamp di scrittura: misurato costante = istante seed 2026-05-30; il periodo business sta in sys_assessments |
| sys_assessment_results | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_assessments | assessment_period_end | date | FUTURE_OK | 303 | 2025-06-06 | 2025-12-02 | fine del ciclo di assessment in corso puo' cadere nel futuro (simmetrica a review_period_end) |
| sys_assessments | assessment_period_start | date | BUSINESS_DATE | 0 |  |  | inizio periodo del ciclo di assessment (consuntivo) |
| sys_assessments | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_assessments | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_attendance | attendance_date | date | BUSINESS_DATE | 3180 | 2024-10-01 | 2025-12-08 | data presenza (attivita' operativa) |
| sys_attendance | attendance_validated_at | timestamptz | BUSINESS_DATE | 0 |  |  | validazione presenze = passo del flusso business, seedabile storicamente |
| sys_attendance | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_attendance | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_auth_credentials | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_auth_credentials | rotated_at | timestamptz | AUDIT_TS | 170 | 2026-07-04 01:06:50 | 2026-07-26 20:39:22 | rotazione credenziale a runtime (evidenza: rotazioni reali lug-2026) |
| sys_auth_identities | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_auth_identities | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_auth_login_events | created_at | timestamptz | AUDIT_TS | 91698 | 2026-05-18 01:57:35 | 2026-07-27 02:27:41 | CASO SPECIALE: e' la data dell'evento login MA e' log operativo runtime vivo (91.698 righe, 2026-05-18..oggi, login reali continui); includerlo in G1 produrrebbe falsi positivi su ogni login reale post-finestra |
| sys_auth_mfa_exemption_audit | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_auth_mfa_exemptions | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_auth_mfa_exemptions | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_auth_mfa_factors | auth_mfa_factor_last_used_at | timestamptz | AUDIT_TS | 8 | 2026-07-26 16:32:25 | 2026-07-27 02:27:40 | uso runtime del fattore MFA |
| sys_auth_mfa_factors | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_auth_mfa_otp_challenges | auth_mfa_otp_consumed_at | timestamptz | AUDIT_TS | 0 |  |  | consumo OTP runtime |
| sys_auth_mfa_otp_challenges | auth_mfa_otp_expires_at | timestamptz | FUTURE_OK | 0 |  |  | scadenza OTP |
| sys_auth_mfa_otp_challenges | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_auth_mfa_policies | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_auth_mfa_policies | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_auth_mfa_recovery_codes | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_auth_mfa_recovery_codes | recovery_code_used_at | timestamptz | AUDIT_TS | 0 |  |  | uso runtime |
| sys_auth_mfa_webauthn_credentials | auth_webauthn_cred_last_used_at | timestamptz | AUDIT_TS | 0 |  |  | uso runtime |
| sys_auth_mfa_webauthn_credentials | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_auth_password_reset_tokens | auth_password_reset_expires_at | timestamptz | FUTURE_OK | 33 | 2026-06-27 14:02:58 | 2026-07-05 02:24:06 | scadenza token reset |
| sys_auth_password_reset_tokens | auth_password_reset_used_at | timestamptz | AUDIT_TS | 0 |  |  | uso token runtime |
| sys_auth_password_reset_tokens | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_auth_permissions | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_auth_refresh_tokens | auth_refresh_token_expires_at | timestamptz | FUTURE_OK | 8929 | 2026-07-27 13:40:14 | 2026-08-26 02:27:42 | scadenza refresh token 30gg (max misurato 2026-08-26 gia' oltre finestra: corretto) |
| sys_auth_refresh_tokens | auth_refresh_token_issued_at | timestamptz | AUDIT_TS | 8929 | 2026-06-27 13:40:14 | 2026-07-27 02:27:41 | emissione token runtime |
| sys_auth_refresh_tokens | auth_refresh_token_revoked_at | timestamptz | AUDIT_TS | 0 |  |  | revoca runtime |
| sys_auth_refresh_tokens | auth_refresh_token_used_at | timestamptz | AUDIT_TS | 38 | 2026-06-27 13:47:57 | 2026-07-22 22:29:33 | rotazione token runtime |
| sys_auth_role_permissions | granted_at | timestamptz | AUDIT_TS | 908 | 2026-05-16 05:22:37 | 2026-07-26 14:46:11 | scrittura del grant RBAC (seed/migrazioni scrivono now()) |
| sys_auth_roles | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_auth_sessions | auth_session_expires_at | timestamptz | FUTURE_OK | 0 |  |  | scadenza sessione |
| sys_auth_sessions | auth_session_revoked_at | timestamptz | AUDIT_TS | 0 |  |  | revoca sessione runtime |
| sys_auth_sessions | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_behavioral_assessments | behavioral_assessment_recorded_at | timestamptz | AUDIT_TS | 465 | 2026-06-03 21:02:33 | 2026-06-03 21:02:33 | stamp di scrittura: costante = istante seed 2026-06-03 |
| sys_behavioral_assessments | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_blueprint_activations | blueprint_activation_effective_from | date | BUSINESS_DATE | 0 |  |  | decorrenza attivazione avvenuta |
| sys_blueprint_activations | blueprint_activation_effective_to | date | FUTURE_OK | 0 |  |  | fine validita' aperta/futura della configurazione |
| sys_blueprint_activations | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_blueprint_activations | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_blueprint_families | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_blueprint_families | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_blueprint_overrides | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_blueprint_overrides | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_blueprint_process_registry | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_blueprint_process_registry | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_blueprint_variants | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_blueprint_variants | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_bonus_pools | bonus_pool_period_end | date | FUTURE_OK | 6 | 2024-11-30 | 2026-12-31 | pool su esercizio in corso (max misurato 2026-12-31 = FY2026) |
| sys_bonus_pools | bonus_pool_period_start | date | BUSINESS_DATE | 6 | 2024-01-01 | 2026-01-01 | inizio periodo del pool |
| sys_bonus_pools | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_bonus_pools | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_branches | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_branches | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_capability_maturity_scores | capability_maturity_score_computed_at | timestamptz | AUDIT_TS | 20 | 2026-07-05 02:11:05 | 2026-07-05 02:11:05 | ricalcolo analytics (now() a ogni run) |
| sys_capability_maturity_scores | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_capability_score_lineage | capability_score_lineage_computed_at | timestamptz | AUDIT_TS | 316 | 2026-07-05 02:11:02 | 2026-07-05 02:11:02 | ricalcolo analytics |
| sys_capability_score_lineage | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_capability_scores | capability_score_computed_at | timestamptz | AUDIT_TS | 317 | 2026-07-05 02:11:02 | 2026-07-05 02:11:02 | ricalcolo analytics |
| sys_capability_scores | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_career_path_steps | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_career_path_steps | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_career_paths | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_career_paths | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_compensation_bands | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_compensation_bands | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_compensation_recommendations | compensation_recommendation_computed_at | timestamptz | AUDIT_TS | 116 | 2026-06-03 20:58:38 | 2026-06-03 20:58:38 | ricalcolo analytics; il periodo business sta nelle colonne period_* |
| sys_compensation_recommendations | compensation_recommendation_period_end | date | BUSINESS_DATE | 116 | 2024-04-01 | 2025-04-01 | periodo osservato (consuntivo) |
| sys_compensation_recommendations | compensation_recommendation_period_start | date | BUSINESS_DATE | 116 | 2024-04-01 | 2025-04-01 | periodo osservato (consuntivo) su cui e' calcolata la raccomandazione |
| sys_compensation_recommendations | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_content_blueprint_links | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_content_blueprint_links | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_content_categories | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_content_categories | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_content_documents | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_content_documents | document_effective_date | date | FUTURE_OK | 0 |  |  | una policy puo' avere decorrenza futura |
| sys_content_documents | document_expires_date | date | FUTURE_OK | 0 |  |  | scadenza documento |
| sys_content_documents | document_published_at | timestamptz | AUDIT_TS | 151 | 2026-06-10 17:32:50 | 2026-07-22 22:26:20 | azione publish a runtime (evidenza: pubblicazioni reali giu-lug 2026) |
| sys_content_documents | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_content_media | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_content_versions | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_continuous_feedback | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_continuous_feedback | feedback_acknowledged_at | timestamptz | BUSINESS_DATE | 0 |  |  | presa visione del feedback = evento business del flusso |
| sys_critical_positions | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_critical_positions | critical_position_flagged_at | timestamptz | AUDIT_TS | 8 | 2026-06-03 19:52:14 | 2026-06-03 19:52:14 | flag di sistema (now()) |
| sys_critical_role_coverage_status | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_critical_role_coverage_status | critical_role_coverage_computed_at | timestamptz | AUDIT_TS | 8 | 2026-06-03 21:07:18 | 2026-06-03 21:07:18 | ricalcolo analytics |
| sys_employee_position_fit_scores | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_employee_position_fit_scores | employee_position_fit_score_computed_at | timestamptz | AUDIT_TS | 146 | 2025-12-12 00:00:00 | 2026-05-13 00:00:00 | ricalcolo analytics (seed backdatato, ma il runtime riscrive now()) |
| sys_engagement_action_plans | action_plan_completed_at | timestamptz | BUSINESS_DATE | 0 |  |  | completamento avvenuto (evento passato) |
| sys_engagement_action_plans | action_plan_due_date | date | FUTURE_OK | 6 | 2026-02-18 | 2026-05-29 | scadenza del piano d'azione |
| sys_engagement_action_plans | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_engagement_action_plans | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_engagement_feedback | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_engagement_feedback | feedback_reviewed_at | timestamptz | BUSINESS_DATE | 45 | 2025-09-01 03:45:28 | 2026-02-22 03:45:28 | revisione feedback: seedata storicamente (spread 2025-09..2026-02) |
| sys_engagement_feedback | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_engagement_survey_responses | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_engagement_survey_responses | response_completed_at | timestamptz | BUSINESS_DATE | 796 | 2024-01-15 00:18:00 | 2025-01-24 00:26:00 | completamento risposta (evento avvenuto) |
| sys_engagement_survey_responses | response_started_at | timestamptz | BUSINESS_DATE | 862 | 2024-01-15 00:00:00 | 2026-02-24 00:12:01 | inizio compilazione risposta (evento avvenuto) |
| sys_engagement_survey_templates | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_engagement_survey_templates | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_engagement_surveys | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_engagement_surveys | survey_end_date | timestamptz | FUTURE_OK | 6 | 2024-01-31 00:00:00 | 2025-01-31 00:00:00 | chiusura survey pianificata |
| sys_engagement_surveys | survey_start_date | timestamptz | FUTURE_OK | 6 | 2024-01-15 00:00:00 | 2025-01-10 00:00:00 | apertura survey schedulabile nel futuro |
| sys_engagement_surveys | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_enterprise_size_bands | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_enterprise_size_bands | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_enterprise_typing_profiles | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_enterprise_typing_profiles | enterprise_typing_assessed_at | timestamptz | AUDIT_TS | 2 | 2026-06-03 21:07:18 | 2026-07-05 02:17:15 | run di sistema (evidenza: run reali giu-lug 2026) |
| sys_enterprise_typing_profiles | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_esco_occupation_embeddings | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_esco_occupation_mappings | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_esco_occupation_mappings | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_feedback_360_responses | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_feedback_360_responses | response_completed_at | timestamptz | BUSINESS_DATE | 390 | 2025-10-03 06:45:39 | 2025-12-02 00:43:06 | completamento risposta 360 (evento avvenuto) |
| sys_flight_risk_scores | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_flight_risk_scores | flight_risk_score_computed_at | timestamptz | AUDIT_TS | 162 | 2026-07-27 02:15:31 | 2026-07-27 02:15:31 | ricalcolo analytics (ultimo run 2026-07-27) |
| sys_gap_analysis_results | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_gap_analysis_results | gap_analysis_result_computed_at | timestamptz | AUDIT_TS | 158 | 2026-07-22 01:47:37 | 2026-07-22 01:47:37 | ricalcolo analytics |
| sys_gap_closure_actions | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_gap_closure_actions | gap_closure_action_due_date | date | FUTURE_OK | 0 |  |  | scadenza azione |
| sys_gap_closure_actions | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_gap_closure_plans | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_gap_closure_plans | gap_closure_plan_target_completion_date | date | FUTURE_OK | 0 |  |  | data target di completamento |
| sys_gap_closure_plans | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_gdpr_data_map | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_gdpr_data_map | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_gdpr_requests | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_goal_alignments | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_goal_check_ins | check_in_date | date | BUSINESS_DATE | 1000 | 2026-01-02 | 2026-05-06 | data check-in avvenuto |
| sys_goal_check_ins | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_goal_comments | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_goal_comments | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_goal_milestones | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_goal_milestones | milestone_completed_at | timestamptz | BUSINESS_DATE | 218 | 2026-01-30 01:41:42 | 2026-02-28 01:41:42 | completamento milestone (evento passato; seed storico 2026-01/02) |
| sys_goal_milestones | milestone_target_date | date | FUTURE_OK | 1000 | 2026-03-15 | 2026-07-26 | data target della milestone |
| sys_goal_milestones | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_goal_templates | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_goal_templates | template_deleted_at | timestamptz | AUDIT_TS | 0 |  |  | soft delete |
| sys_goal_templates | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_goal_updates | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_goals | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_goals | goal_completed_at | timestamptz | BUSINESS_DATE | 0 |  |  | completamento obiettivo (evento passato) |
| sys_goals | goal_due_date | date | FUTURE_OK | 1067 | 2025-03-31 | 2026-12-02 | scadenza obiettivo |
| sys_goals | goal_start_date | date | FUTURE_OK | 1067 | 2025-01-01 | 2026-09-03 | obiettivi pianificati partono nel futuro — EVIDENZA: max attuale 2026-09-03 gia' oltre finestra su dati legittimi |
| sys_goals | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_inbox_notifications | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_inbox_notifications | notification_dismissed_at | timestamptz | AUDIT_TS | 0 |  |  | azione utente runtime |
| sys_inbox_notifications | notification_expires_at | timestamptz | FUTURE_OK | 0 |  |  | scadenza notifica |
| sys_inbox_notifications | notification_read_at | timestamptz | AUDIT_TS | 0 |  |  | azione utente runtime |
| sys_job_families | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_job_families | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_job_role_embeddings | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_job_roles | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_job_roles | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_kpi_assessment_methods | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_kpi_assessment_results | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_kpi_assessment_results | kpi_assessment_result_computed_at | timestamptz | AUDIT_TS | 248 | 2026-06-03 20:47:44 | 2026-06-03 20:47:44 | ricalcolo analytics; periodo business in period_* |
| sys_kpi_assessment_results | kpi_assessment_result_period_end | date | BUSINESS_DATE | 248 | 2024-12-31 | 2025-12-31 | periodo consuntivo del risultato |
| sys_kpi_assessment_results | kpi_assessment_result_period_start | date | BUSINESS_DATE | 248 | 2024-01-01 | 2025-01-01 | periodo consuntivo del risultato |
| sys_kpi_definitions | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_kpi_definitions | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_kpi_measurements | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_kpi_measurements | kpi_measurement_period_end | date | BUSINESS_DATE | 248 | 2024-12-31 | 2025-12-31 | periodo misurato (consuntivo) |
| sys_kpi_measurements | kpi_measurement_period_start | date | BUSINESS_DATE | 248 | 2024-01-01 | 2025-01-01 | periodo misurato (data misurazione, consuntivo) |
| sys_kpi_measurements | kpi_measurement_recorded_at | timestamptz | AUDIT_TS | 248 | 2026-06-03 20:47:45 | 2026-06-03 20:47:45 | stamp di scrittura (costante = seed 2026-06-03); la data business e' il periodo misurato |
| sys_kpi_metric_definitions | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_kpi_metric_definitions | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_kpi_targets | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_kpi_targets | kpi_target_period_end | date | FUTURE_OK | 301 | 2024-12-31 | 2026-12-31 | target forward-looking (max misurato 2026-12-31 = FY2026) |
| sys_kpi_targets | kpi_target_period_start | date | FUTURE_OK | 301 | 2024-01-01 | 2026-01-01 | target forward-looking: definibili per periodi futuri |
| sys_kpi_targets | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_kpi_weighting_rules | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_leads | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_leads | lead_consent_at | timestamptz | BUSINESS_DATE | 0 |  |  | data consenso del lead (evento avvenuto; nota: flusso prospect live, vedi note) |
| sys_learning_gaps | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_learning_gaps | learning_gap_detected_at | timestamptz | AUDIT_TS | 270 | 2025-11-14 00:00:00 | 2026-05-13 00:00:00 | detection analytics (famiglia computed_at); il runtime riscrive now() a ogni nuova detection |
| sys_learning_gaps | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_learning_modules | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_learning_modules | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_learning_path_steps | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_learning_path_steps | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_learning_paths | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_learning_paths | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_leave_accrual_rules | accrual_rule_deleted_at | timestamptz | AUDIT_TS | 0 |  |  | soft delete |
| sys_leave_accrual_rules | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_leave_accrual_rules | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_leave_balance_transactions | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_mentor_match_scores | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_mentor_match_scores | match_expires_at | timestamptz | FUTURE_OK | 30 | 2026-03-30 03:49:23 | 2026-03-30 03:49:23 | scadenza validita' del match |
| sys_mentorship_programs | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_mentorship_programs | program_end_date | date | FUTURE_OK | 0 |  |  | fine programma pianificata |
| sys_mentorship_programs | program_start_date | date | BUSINESS_DATE | 5 | 2024-06-01 | 2025-02-01 | avvio programma (nel dataset: avvii storici) |
| sys_mentorship_programs | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_mentorship_sessions | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_mentorship_sessions | session_date | timestamptz | FUTURE_OK | 150 | 2025-06-13 00:00:00 | 2026-03-13 00:00:00 | le sessioni possono essere schedulate nel futuro (calendario) |
| sys_mentorships | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_mentorships | mentorship_end_date | date | FUTURE_OK | 18 | 2025-06-30 | 2025-09-30 | fine mentorship pianificata |
| sys_mentorships | mentorship_start_date | date | BUSINESS_DATE | 63 | 2025-01-01 | 2025-12-03 | avvio mentorship |
| sys_mentorships | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_model_predictions | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_model_predictions | prediction_computed_at | timestamptz | AUDIT_TS | 468 | 2025-12-12 04:30:10 | 2025-12-12 04:34:03 | ricalcolo ML |
| sys_model_predictions | prediction_valid_until | timestamptz | FUTURE_OK | 312 | 2026-01-11 04:30:10 | 2026-01-11 04:34:03 | validita' della predizione |
| sys_notification_preferences | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_notification_preferences | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_objective_reward_rules | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_objective_reward_rules | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_occupation_classification_mappings | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_occupation_classification_mappings | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_occupation_classifications | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_occupation_classifications | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_occupation_skill_requirements | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_occupation_skill_requirements | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_okr_check_ins | check_in_date | date | BUSINESS_DATE | 25 | 2025-10-11 | 2026-02-21 | data check-in avvenuto |
| sys_okr_check_ins | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_okr_key_results | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_okr_key_results | key_result_last_check_in_at | timestamptz | AUDIT_TS | 0 |  |  | stamp operativo dell'ultimo check-in (la data business e' okr_check_ins.check_in_date) |
| sys_okr_key_results | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_okrs | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_okrs | okr_period_end | date | FUTURE_OK | 20 | 2024-12-31 | 2024-12-31 | periodo OKR in corso/futuro |
| sys_okrs | okr_period_start | date | FUTURE_OK | 20 | 2024-10-01 | 2024-10-01 | OKR = pianificazione: definibili per trimestri futuri |
| sys_okrs | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_operating_model_catalog | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_operating_model_catalog | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_organization_unit_history | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_organization_unit_history | organization_unit_history_effective_at | timestamptz | BUSINESS_DATE | 0 |  |  | decorrenza storicizzata della modifica org (evento avvenuto) |
| sys_organization_unit_kpi_templates | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_organization_unit_kpi_templates | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_organization_unit_processes | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_organization_unit_processes | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_organization_unit_templates | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_organization_unit_templates | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_organization_unit_types | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_organization_unit_types | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_organization_units | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_organization_units | organization_unit_effective_from | date | BUSINESS_DATE | 28 | 2025-01-01 | 2026-07-21 | decorrenza versione org (nel dataset: decorrenze avvenute) |
| sys_organization_units | organization_unit_effective_to | date | FUTURE_OK | 0 |  |  | fine validita' versione org (aperta/futura) |
| sys_organization_units | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_overtime | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_overtime | overtime_approved_at | timestamptz | BUSINESS_DATE | 0 |  |  | approvazione straordinario (evento del flusso, seedabile storico) |
| sys_overtime | overtime_date | date | BUSINESS_DATE | 178 | 2025-09-14 | 2025-12-12 | data straordinario (attivita' operativa) |
| sys_overtime | overtime_exported_at | timestamptz | AUDIT_TS | 0 |  |  | export payroll runtime |
| sys_overtime | overtime_requested_at | timestamptz | BUSINESS_DATE | 178 | 2025-12-12 04:36:04 | 2025-12-12 04:36:04 | richiesta straordinario: seedata backdatata (2025-12-12), evento del flusso business |
| sys_overtime | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_payout_curves | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_payout_curves | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_payroll_handoff_records | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_payroll_handoff_records | payroll_handoff_record_handed_off_at | timestamptz | AUDIT_TS | 0 |  |  | operazione di handoff runtime; il periodo business sta in period_* |
| sys_payroll_handoff_records | payroll_handoff_record_period_end | date | BUSINESS_DATE | 0 |  |  | periodo payroll consuntivo |
| sys_payroll_handoff_records | payroll_handoff_record_period_start | date | BUSINESS_DATE | 0 |  |  | periodo payroll consuntivo |
| sys_performance_review_competency_ratings | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_performance_review_competency_ratings | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_performance_reviews | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_performance_reviews | review_acknowledged_at | timestamptz | BUSINESS_DATE | 155 | 2025-01-20 00:00:00 | 2025-01-20 00:00:00 | milestone del ciclo review seedata storicamente (2025-01-20) |
| sys_performance_reviews | review_calibrated_at | timestamptz | BUSINESS_DATE | 0 |  |  | milestone del ciclo review |
| sys_performance_reviews | review_finalized_at | timestamptz | BUSINESS_DATE | 0 |  |  | milestone del ciclo review |
| sys_performance_reviews | review_manager_submitted_at | timestamptz | BUSINESS_DATE | 0 |  |  | milestone del ciclo review |
| sys_performance_reviews | review_period_end | date | FUTURE_OK | 161 | 2024-06-30 | 2026-12-31 | fine del ciclo review in corso (max misurato 2026-12-31 = FY2026) |
| sys_performance_reviews | review_period_start | date | BUSINESS_DATE | 161 | 2024-01-01 | 2026-01-01 | inizio periodo del ciclo review (consuntivo/in corso) |
| sys_performance_reviews | review_self_review_completed_at | timestamptz | BUSINESS_DATE | 0 |  |  | milestone del ciclo review |
| sys_performance_reviews | review_self_submitted_at | timestamptz | BUSINESS_DATE | 0 |  |  | milestone del ciclo review |
| sys_performance_reviews | review_shared_at | timestamptz | BUSINESS_DATE | 0 |  |  | milestone del ciclo review |
| sys_performance_reviews | review_submitted_at | timestamptz | BUSINESS_DATE | 155 | 2025-01-15 00:00:00 | 2025-01-15 00:00:00 | milestone del ciclo review seedata storicamente (2025-01-15) |
| sys_performance_reviews | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_person_evidence_records | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_person_evidence_records | person_evidence_recorded_at | timestamptz | AUDIT_TS | 237 | 2026-06-03 21:02:34 | 2026-06-03 21:02:34 | stamp di scrittura: costante = istante seed 2026-06-03 |
| sys_person_evidence_records | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_position_career_paths | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_position_career_paths | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_position_compensation_profiles | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_position_compensation_profiles | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_position_economic_weight | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_position_economic_weight | position_economic_weight_period_end | date | BUSINESS_DATE | 0 |  |  | periodo consuntivo dell'analisi economica |
| sys_position_economic_weight | position_economic_weight_period_start | date | BUSINESS_DATE | 0 |  |  | periodo consuntivo dell'analisi economica |
| sys_position_economic_weight | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_position_intelligence_profiles_v | position_effective_from | date | OTHER | 181 | 2005-09-13 | 2026-07-23 | VISTA (PIP, I9) derivata da sys_positions: esclusa da G1 per evitare doppio conteggio, la base e' gia' coperta |
| sys_position_intelligence_profiles_v | position_effective_to | date | OTHER | 0 |  |  | VISTA derivata da sys_positions (idem) |
| sys_position_intelligence_profiles_v | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_position_kpi_requirements | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_position_kpi_requirements | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_position_learning_requirements | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_position_learning_requirements | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_position_skill_requirement_history | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_position_skill_requirement_history | position_skill_requirement_history_effective_at | timestamptz | BUSINESS_DATE | 0 |  |  | decorrenza storicizzata (evento avvenuto) |
| sys_position_skill_requirements | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_position_skill_requirements | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_position_succession_relevance | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_position_succession_relevance | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_positions | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_positions | position_effective_from | date | BUSINESS_DATE | 181 | 2005-09-13 | 2026-07-23 | decorrenza versione posizione (nel dataset: avvenute; riorg pianificate future richiederebbero rivalutazione) |
| sys_positions | position_effective_to | date | FUTURE_OK | 0 |  |  | fine validita' versione posizione (aperta/futura) |
| sys_positions | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_predictive_models | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_process_kpi_templates | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_process_kpi_templates | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_process_participants | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_process_participants | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_pulse_checks | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_pulse_checks | pulse_check_date | date | BUSINESS_DATE | 2834 | 2024-10-30 | 2026-03-19 | data pulse check (attivita') |
| sys_readiness_scores | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_readiness_scores | readiness_score_computed_at | timestamptz | AUDIT_TS | 90 | 2026-06-03 20:53:49 | 2026-06-03 20:53:49 | ricalcolo analytics |
| sys_reconciliation_registry | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_reconciliation_registry | reconciliation_registry_decided_at | timestamptz | AUDIT_TS | 125 | 2026-06-03 17:09:26 | 2026-07-26 14:42:59 | governance runtime (evidenza: decisioni reali fino a 2026-07-26) |
| sys_reconciliation_registry | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_reference_translations | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_reference_translations | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_reward_gate_catalog | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_reward_gate_catalog | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_reward_gate_results | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_reward_gate_results | reward_gate_result_recorded_at | timestamptz | AUDIT_TS | 0 |  |  | stamp di scrittura (famiglia recorded_at); periodo business in sys_reward_gates.period_* |
| sys_reward_gates | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_reward_gates | reward_gate_period_end | date | FUTURE_OK | 0 |  |  | gate su periodo in corso |
| sys_reward_gates | reward_gate_period_start | date | BUSINESS_DATE | 0 |  |  | inizio periodo del gate |
| sys_reward_gates | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_schema_migrations | applied_at | timestamptz | AUDIT_TS | 214 | 2026-07-26 14:38:37 | 2026-07-26 14:46:16 | bookkeeping migrazioni (non business) |
| sys_seed_acquisition_runs | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_seed_acquisition_runs | seed_acquisition_run_finished_at | timestamptz | AUDIT_TS | 0 |  |  | pipeline seed (operativo) |
| sys_seed_acquisition_runs | seed_acquisition_run_started_at | timestamptz | AUDIT_TS | 0 |  |  | pipeline seed (operativo) |
| sys_seed_acquisition_runs | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_seed_approval_decisions | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_seed_approval_decisions | seed_approval_decision_decided_at | timestamptz | AUDIT_TS | 0 |  |  | pipeline seed (operativo) |
| sys_seed_candidate_records | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_seed_candidate_records | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_seed_source_evidence | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_seed_source_evidence | seed_source_evidence_retrieved_at | timestamptz | AUDIT_TS | 0 |  |  | pipeline seed (operativo) |
| sys_seed_validation_results | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_skill_aliases | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_skill_categories | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_skill_categories | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_skill_embeddings | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_skill_families | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_skill_families | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_skill_gap_scores | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_skill_gap_scores | skill_gap_score_computed_at | timestamptz | AUDIT_TS | 156 | 2026-07-27 02:15:32 | 2026-07-27 02:15:32 | ricalcolo analytics (ultimo run 2026-07-27) |
| sys_skill_groups | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_skill_groups | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_skill_learning_mappings | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_skill_proficiency_levels | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_skill_proficiency_levels | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_skill_taxonomy_edges | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_skills | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_skills | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_source_lineage_records | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_succession_pools | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_succession_pools | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_succession_readiness_scores | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_succession_readiness_scores | succession_readiness_score_computed_at | timestamptz | AUDIT_TS | 468 | 2026-07-27 02:15:31 | 2026-07-27 02:15:31 | ricalcolo analytics |
| sys_succession_scores | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_succession_scores | succession_score_computed_at | timestamptz | AUDIT_TS | 90 | 2026-06-03 20:53:48 | 2026-06-03 20:53:48 | ricalcolo analytics |
| sys_successor_candidates | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_successor_candidates | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_successor_readiness | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_successor_readiness | successor_readiness_assessed_at | timestamptz | AUDIT_TS | 0 |  |  | valutazione di sistema (famiglia computed/assessed) |
| sys_survey_assignments | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_survey_assignments | survey_assignment_assigned_at | timestamptz | AUDIT_TS | 8 | 2026-06-18 15:34:21 | 2026-06-18 15:34:21 | stamp di assegnazione (costante = istante di scrittura) |
| sys_survey_assignments | survey_assignment_completed_at | timestamptz | BUSINESS_DATE | 0 |  |  | completamento assegnazione survey (evento avvenuto) |
| sys_survey_assignments | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_survey_questions | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_survey_responses | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_survey_templates | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_survey_templates | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_surveys | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_surveys | survey_end_date | date | FUTURE_OK | 7 | 2024-07-15 | 2025-12-31 | chiusura survey pianificata |
| sys_surveys | survey_start_date | date | FUTURE_OK | 7 | 2024-07-01 | 2025-11-15 | apertura survey schedulabile nel futuro |
| sys_surveys | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_talent_scores | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_talent_scores | talent_score_computed_at | timestamptz | AUDIT_TS | 154 | 2026-06-03 21:02:33 | 2026-06-03 21:02:33 | ricalcolo analytics |
| sys_team_members | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_team_members | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_teams | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_teams | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_tenancies | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_tenancies | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_time_off_balances | balance_carryover_expires_at | date | FUTURE_OK | 0 |  |  | scadenza carryover ferie |
| sys_time_off_balances | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_time_off_balances | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_time_off_requests | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_time_off_requests | request_approved_at | timestamptz | BUSINESS_DATE | 43 | 2025-12-02 20:43:49 | 2025-12-03 20:43:49 | approvazione richiesta (evento del flusso, seed storico 2025-12) |
| sys_time_off_requests | request_cancelled_at | timestamptz | BUSINESS_DATE | 0 |  |  | annullamento richiesta (evento avvenuto) |
| sys_time_off_requests | request_end_date | date | FUTURE_OK | 69 | 2025-12-06 | 2026-06-14 | ferie/permessi prenotati in anticipo |
| sys_time_off_requests | request_start_date | date | FUTURE_OK | 69 | 2025-12-03 | 2026-06-04 | ferie/permessi prenotati in anticipo (date future legittime) |
| sys_time_off_requests | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_training_initiatives | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_training_initiatives | training_initiative_end_date | date | FUTURE_OK | 0 |  |  | fine iniziativa pianificata |
| sys_training_initiatives | training_initiative_start_date | date | FUTURE_OK | 0 |  |  | iniziative formative pianificate nel futuro |
| sys_training_initiatives | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_ui_interfaces | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_ui_interfaces | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_addresses | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_addresses | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_assessment_evidence | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_assessment_evidence | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_assessment_evidence | user_assessment_evidence_recorded_at | timestamptz | AUDIT_TS | 1560 | 2026-06-01 19:50:37 | 2026-06-01 19:50:37 | stamp di scrittura: costante = istante seed 2026-06-01 |
| sys_user_auth_roles | user_auth_role_granted_at | timestamptz | AUDIT_TS | 340 | 2026-05-16 15:08:14 | 2026-07-22 17:24:36 | operazione RBAC runtime |
| sys_user_auth_roles | user_auth_role_revoked_at | timestamptz | AUDIT_TS | 0 |  |  | operazione RBAC runtime |
| sys_user_bank_details | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_bank_details | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_career_plans | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_career_plans | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_certifications | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_certifications | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_certifications | user_certification_expires_date | date | FUTURE_OK | 477 | 2021-01-11 | 2029-11-28 | scadenza certificazione (max misurato 2029-11-28: corretto) |
| sys_user_certifications | user_certification_issued_date | date | BUSINESS_DATE | 477 | 2016-01-13 | 2026-04-11 | data rilascio certificazione (passata per definizione) |
| sys_user_consents | consent_occurred_at | timestamptz | BUSINESS_DATE | 0 |  |  | data consenso (esempio esplicito del mandato G1) |
| sys_user_consents | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_contracts | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_contracts | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_contracts | user_contract_end_date | date | FUTURE_OK | 61 | 2009-03-03 | 2027-02-28 | fine contratto a termine (max misurato 2027-02-28: corretto) |
| sys_user_contracts | user_contract_probation_end_date | date | FUTURE_OK | 56 | 2006-03-13 | 2025-06-02 | il periodo di prova di un neoassunto termina nel futuro |
| sys_user_contracts | user_contract_start_date | date | BUSINESS_DATE | 160 | 2003-03-16 | 2024-12-15 | decorrenza contratto (avvenuta; min 2003 = anzianita' reale) |
| sys_user_contracts | user_contract_termination_date | date | FUTURE_OK | 0 |  |  | cessazione con preavviso = data futura nota |
| sys_user_demographics | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_demographics | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_demographics | user_demographics_birth_date | date | BUSINESS_DATE | 160 | 1970-11-27 | 1999-07-03 | data di nascita (mai futura; minimi naturali < 2003) |
| sys_user_documents | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_documents | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_education_records | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_education_records | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_education_records | user_education_end_date | date | BUSINESS_DATE | 159 | 1988-01-01 | 2019-01-01 | fine percorso di studi (nel dataset: percorsi conclusi; una laurea attesa futura richiederebbe rivalutazione) |
| sys_user_education_records | user_education_start_date | date | BUSINESS_DATE | 3 | 1992-10-01 | 2010-10-01 | inizio percorso di studi (storico) |
| sys_user_employment | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_employment | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_employment | user_employment_contract_end_date | date | FUTURE_OK | 74 | 2009-03-03 | 2027-02-28 | fine contratto a termine (max 2027-02-28) |
| sys_user_employment | user_employment_hire_date | date | BUSINESS_DATE | 161 | 2003-03-16 | 2024-12-15 | data assunzione (esempio esplicito del mandato G1) |
| sys_user_employment | user_employment_probation_end_date | date | FUTURE_OK | 156 | 2005-12-12 | 2022-09-01 | periodo di prova puo' terminare nel futuro |
| sys_user_employment | user_employment_seniority_date | date | BUSINESS_DATE | 158 | 2003-03-16 | 2024-12-15 | data anzianita' (passata) |
| sys_user_employment | user_employment_termination_date | date | FUTURE_OK | 0 |  |  | cessazione con preavviso |
| sys_user_family_members | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_family_members | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_family_members | user_family_member_birth_date | date | BUSINESS_DATE | 150 | 1964-09-23 | 2024-10-17 | data di nascita familiare (mai futura) |
| sys_user_identity_documents | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_identity_documents | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_identity_documents | user_identity_document_expiry_date | date | FUTURE_OK | 332 | 2025-12-12 | 2035-12-02 | scadenza documento identita' (max 2035: corretto) |
| sys_user_kpi_evidence | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_kpi_evidence | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_kpi_evidence | user_kpi_evidence_period_end | date | BUSINESS_DATE | 248 | 2024-12-31 | 2025-12-31 | periodo consuntivo dell'evidenza KPI |
| sys_user_kpi_evidence | user_kpi_evidence_period_start | date | BUSINESS_DATE | 248 | 2024-01-01 | 2025-01-01 | periodo consuntivo dell'evidenza KPI |
| sys_user_kpi_evidence | user_kpi_evidence_recorded_at | timestamptz | AUDIT_TS | 248 | 2026-06-03 20:47:46 | 2026-06-03 20:47:46 | stamp di scrittura (costante); periodo business in period_* |
| sys_user_learning_assignments | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_learning_assignments | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_learning_assignments | user_learning_assignment_deadline | date | FUTURE_OK | 0 |  |  | scadenza assegnazione formativa |
| sys_user_learning_evidence | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_learning_evidence | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_learning_evidence | user_learning_evidence_completed_at | timestamptz | BUSINESS_DATE | 1434 | 2024-02-27 00:00:00 | 2026-04-15 00:00:00 | completamento formativo avvenuto (seed storico 2024-02..2026-04) |
| sys_user_pay_slips | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_pay_slips | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_pay_slips | user_pay_slip_payment_date | date | BUSINESS_DATE | 471 | 2025-09-28 | 2026-06-27 | data pagamento busta (consuntivo) |
| sys_user_pay_slips | user_pay_slip_period_end | date | BUSINESS_DATE | 471 | 2025-09-30 | 2026-06-30 | periodo busta paga |
| sys_user_pay_slips | user_pay_slip_period_start | date | BUSINESS_DATE | 471 | 2025-09-01 | 2026-06-01 | periodo busta paga (esempio esplicito del mandato G1) |
| sys_user_position_assignments | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_position_assignments | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_position_assignments | user_position_assignment_end_date | date | FUTURE_OK | 6 | 2026-07-21 | 2026-07-23 | fine assegnazione pianificata |
| sys_user_position_assignments | user_position_assignment_start_date | date | BUSINESS_DATE | 167 | 2005-09-13 | 2026-07-23 | inizio assegnazione (avvenuto) |
| sys_user_preferences | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_preferences | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_professional_experiences | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_professional_experiences | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_professional_experiences | user_prof_exp_end_date | date | BUSINESS_DATE | 0 |  |  | fine esperienza passata (l'esperienza corrente ha end NULL) |
| sys_user_professional_experiences | user_prof_exp_start_date | date | BUSINESS_DATE | 0 |  |  | inizio esperienza professionale (storica) |
| sys_user_profile_embeddings | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_profiles | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_profiles | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_skill_evidence | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_skill_evidence | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_skill_evidence | user_skill_evidence_assessed_at | timestamptz | AUDIT_TS | 902 | 2026-05-30 16:33:23 | 2026-05-30 16:33:23 | stamp di scrittura: costante = istante seed 2026-05-30 |
| sys_user_skills | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_skills | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_user_skills | user_skill_last_used_on | date | BUSINESS_DATE | 0 |  |  | ultimo uso della skill (<= oggi per definizione) |
| sys_user_skills | user_skill_verified_at | timestamptz | AUDIT_TS | 356 | 2026-07-22 01:47:37 | 2026-07-22 01:47:37 | stamp operativo: costante = istante del run gap-analysis 2026-07-22 01:47:37 |
| sys_user_target_positions | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_user_target_positions | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_users | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_users | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_variable_pay_calculations | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_variable_pay_calculations | variable_pay_calculation_computed_at | timestamptz | AUDIT_TS | 121 | 2026-06-03 20:58:38 | 2026-06-03 20:58:38 | ricalcolo analytics; periodo business in period_* |
| sys_variable_pay_calculations | variable_pay_calculation_period_end | date | BUSINESS_DATE | 121 | 2024-11-30 | 2024-12-31 | periodo consuntivo del calcolo |
| sys_variable_pay_calculations | variable_pay_calculation_period_start | date | BUSINESS_DATE | 121 | 2024-01-01 | 2024-10-01 | periodo consuntivo del calcolo |
| sys_visualization_edges | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_visualization_exports | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_visualization_exports | export_generated_at | timestamptz | AUDIT_TS | 0 |  |  | generazione export runtime |
| sys_visualization_graphs | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_visualization_graphs | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_visualization_layouts | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_visualization_layouts | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_visualization_node_layouts | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_visualization_node_layouts | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_visualization_nodes | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_visualization_nodes | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
| sys_visualization_styles | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_whistleblowing_reports | created_at | timestamptz | AUDIT_TS |  |  |  | timestamp di scrittura riga (seed/app scrivono now()) |
| sys_whistleblowing_reports | updated_at | timestamptz | AUDIT_TS |  |  |  | timestamp di aggiornamento riga |
