# storia36 — Audit semantico finale (Task C12, Step 12.2)

> Generato da `db/scripts/audit-storia36-semantic.py` — **ri-eseguibile**. Data: 2026-07-29 · finestra della storia: `2023-08-01` → `2026-07-31` (fine calcolata, mai costante).

**Perimetro**: tutte le tabelle `sys.*` lette dal catalogo di sistema a ogni esecuzione (AP-03: nessun elenco scritto a mano — una tabella nuova entra nell'audit da sola).

| | |
|---|---|
| tabelle esaminate | **206** |
| righe coperte | **598.683** |
| rilievi **aperti** (nessuna spiegazione) | **263** |
| rilievi **spiegati** (classe dichiarata legittima) | **196** |
| tabelle vuote | **10** (dichiarate: 10) |

## Le regole e il loro criterio di applicabilità

Ogni regola si applica **per tipo e ruolo della colonna**, dedotti dal catalogo: non esiste una lista di tabelle da tenere aggiornata. Le colonne di *audit di scrittura* (`created_at`, `updated_at`, `*_by`) sono escluse dalle regole di fatto — chi scrive una riga non è il soggetto della riga, e la sua data è quella del popolamento, non della storia.

| id | regola | si applica a |
|---|---|---|
| D1 | data di fatto oltre la finestra della storia | colonne data/ora che non esprimono una scadenza o una pianificazione |
| D2 | data di fatto precedente al 1900 | colonne data/ora di fatto |
| D3 | intervallo invertito (fine < inizio) | coppie inizio/fine riconosciute dal nome |
| N1 | misura percentuale fuori da [0,100] | colonne numeriche con ruolo percentuale |
| N2 | valore negativo su misura non-negativa | colonne monetarie, conteggi, durate |
| S1 | colonna interamente NULL su tabella popolata | tutte le colonne non-audit |
| S2 | un solo valore distinto su ≥20 righe | colonne non-audit, non booleane |
| C1 | artefatto di calendario (giorno o mese dominante) | date di fatto con ≥30 valori |
| X1 | righe identiche al netto di chiave tecnica e audit | tabelle con colonne confrontabili |
| V1 | tabella vuota: richiede una dichiarazione esplicita | tabelle a zero righe |

**Nota di perimetro**: 2 tabelle superano le 100.000 righe (`sys_attendance` (116.015), `sys_occupation_skill_requirements` (126.051)) — su queste le regole C1 e X1 (che richiedono una scansione completa) non vengono eseguite: il costo non è giustificato e sono tabelle di traffico, non di storia. Le altre regole si applicano regolarmente.

## Rilievi APERTI

Rilievi per cui nessuna classe di `db/scripts/audit-storia36-explanations.txt` dichiara un motivo: o sono difetti da riparare, o attendono una spiegazione esplicita. Il silenzio non è una delle opzioni.

| tabella | righe | regola | rilievo |
|---|---|---|---|
| `sys_performance_reviews` | 550 | S1 | `review_calibrated_by_user_id`: colonna interamente NULL su 550 righe |
| `sys_performance_reviews` | 550 | S1 | `review_finalized_by_user_id`: colonna interamente NULL su 550 righe |
| `sys_performance_reviews` | 550 | S1 | `review_self_rating`: colonna interamente NULL su 550 righe |
| `sys_performance_reviews` | 550 | S1 | `review_calibrated_rating`: colonna interamente NULL su 550 righe |
| `sys_performance_reviews` | 550 | S1 | `review_pre_calibration_rating`: colonna interamente NULL su 550 righe |
| `sys_performance_reviews` | 550 | S1 | `review_employee_comments`: colonna interamente NULL su 550 righe |
| `sys_performance_reviews` | 550 | S1 | `review_self_comments`: colonna interamente NULL su 550 righe |
| `sys_performance_reviews` | 550 | S1 | `review_development_plan`: colonna interamente NULL su 550 righe |
| `sys_performance_reviews` | 550 | S1 | `review_career_aspirations`: colonna interamente NULL su 550 righe |
| `sys_performance_reviews` | 550 | S2 | `review_section_ratings`: un solo valore distinto su 550 righe |
| `sys_performance_reviews` | 550 | S2 | `review_recommended_actions`: un solo valore distinto su 550 righe |
| `sys_performance_reviews` | 550 | S1 | `review_self_submitted_at`: colonna interamente NULL su 550 righe |
| `sys_performance_reviews` | 550 | S1 | `review_manager_submitted_at`: colonna interamente NULL su 550 righe |
| `sys_performance_reviews` | 550 | S1 | `review_calibrated_at`: colonna interamente NULL su 550 righe |
| `sys_performance_reviews` | 550 | S1 | `review_finalized_at`: colonna interamente NULL su 550 righe |
| `sys_performance_reviews` | 550 | S1 | `review_self_review_completed_at`: colonna interamente NULL su 550 righe |
| `sys_performance_reviews` | 550 | S1 | `review_shared_at`: colonna interamente NULL su 550 righe |
| `sys_okrs` | 20 | S1 | `okr_owner_user_id`: colonna interamente NULL su 20 righe |
| `sys_okrs` | 20 | S1 | `okr_created_by_user_id`: colonna interamente NULL su 20 righe |
| `sys_okrs` | 20 | S1 | `okr_parent_okr_id`: colonna interamente NULL su 20 righe |
| `sys_okrs` | 20 | S2 | `okr_period_type`: un solo valore distinto su 20 righe |
| `sys_okrs` | 20 | S2 | `okr_period_start`: un solo valore distinto su 20 righe |
| `sys_okrs` | 20 | S2 | `okr_period_end`: un solo valore distinto su 20 righe |
| `sys_okrs` | 20 | S2 | `okr_fiscal_year`: un solo valore distinto su 20 righe |
| `sys_okrs` | 20 | S1 | `okr_fiscal_quarter`: colonna interamente NULL su 20 righe |
| `sys_okrs` | 20 | S2 | `okr_tags`: un solo valore distinto su 20 righe |
| `sys_user_contracts` | 160 | S2 | `user_contract_salary_type`: un solo valore distinto su 160 righe |
| `sys_user_contracts` | 160 | S2 | `user_contract_payment_frequency`: un solo valore distinto su 160 righe |
| `sys_user_contracts` | 160 | S2 | `user_contract_work_hours_weekly`: un solo valore distinto su 160 righe |
| `sys_user_contracts` | 160 | S1 | `user_contract_part_time_percentage`: colonna interamente NULL su 160 righe |
| `sys_user_contracts` | 160 | S1 | `user_contract_termination_date`: colonna interamente NULL su 160 righe |
| `sys_user_contracts` | 160 | S1 | `user_contract_termination_reason`: colonna interamente NULL su 160 righe |
| `sys_user_contracts` | 160 | S2 | `user_contract_metadata`: un solo valore distinto su 160 righe |
| `sys_overtime` | 178 | S1 | `overtime_requested_by_user_id`: colonna interamente NULL su 178 righe |
| `sys_overtime` | 178 | S2 | `overtime_notes`: un solo valore distinto su 178 righe |
| `sys_overtime` | 178 | C1 | `overtime_date`: mese «10» concentra 35% delle 178 date |
| `sys_overtime` | 178 | C1 | `overtime_requested_at`: mese «10» concentra 35% delle 178 date |
| `sys_overtime` | 178 | C1 | `overtime_approved_at`: mese «11» concentra 36% delle 162 date |
| `sys_overtime` | 178 | C1 | `overtime_exported_at`: mese «12» concentra 38% delle 162 date |
| `sys_attendance` | 116.015 | S2 | `attendance_hours_night`: un solo valore distinto su 116015 righe |
| `sys_attendance` | 116.015 | S2 | `attendance_hours_holiday`: un solo valore distinto su 116015 righe |
| `sys_attendance` | 116.015 | S2 | `attendance_source`: un solo valore distinto su 116015 righe |
| `sys_attendance` | 116.015 | S1 | `attendance_validated_by_user_id`: colonna interamente NULL su 116015 righe |
| `sys_attendance` | 116.015 | S1 | `attendance_validated_at`: colonna interamente NULL su 116015 righe |
| `sys_goal_templates` | 40 | S1 | `template_role_id`: colonna interamente NULL su 40 righe |
| `sys_goal_templates` | 40 | S1 | `template_org_unit_id`: colonna interamente NULL su 40 righe |
| `sys_goal_templates` | 40 | S2 | `template_goal_type`: un solo valore distinto su 40 righe |
| `sys_goal_templates` | 40 | S2 | `template_suggested_weight`: un solo valore distinto su 40 righe |
| `sys_goal_templates` | 40 | S2 | `template_usage_count`: un solo valore distinto su 40 righe |
| `sys_goals` | 2.624 | S1 | `goal_owner_user_id`: colonna interamente NULL su 2624 righe |
| `sys_goals` | 2.624 | S1 | `goal_parent_goal_id`: colonna interamente NULL su 2624 righe |
| `sys_goals` | 2.624 | S1 | `goal_template_id`: colonna interamente NULL su 2624 righe |
| `sys_goals` | 2.624 | S2 | `goal_tags`: un solo valore distinto su 2624 righe |
| `sys_goals` | 2.624 | S2 | `goal_custom_fields`: un solo valore distinto su 2624 righe |
| `sys_auth_refresh_tokens` | 6.963 | C1 | `auth_refresh_token_used_at`: giorno del mese «30» concentra 26% delle 31 date |
| `sys_auth_refresh_tokens` | 6.963 | C1 | `auth_refresh_token_used_at`: mese «07» concentra 65% delle 31 date |
| `sys_auth_refresh_tokens` | 6.963 | C1 | `auth_refresh_token_revoked_at`: giorno del mese «29» concentra 100% delle 46 date |
| `sys_auth_refresh_tokens` | 6.963 | C1 | `auth_refresh_token_revoked_at`: mese «07» concentra 100% delle 46 date |
| `sys_learning_gaps` | 270 | S1 | `learning_gap_position_id`: colonna interamente NULL su 270 righe |
| `sys_learning_gaps` | 270 | S1 | `learning_gap_skill_id`: colonna interamente NULL su 270 righe |
| `sys_learning_gaps` | 270 | S1 | `learning_gap_required_proficiency`: colonna interamente NULL su 270 righe |
| `sys_learning_gaps` | 270 | S1 | `learning_gap_current_proficiency`: colonna interamente NULL su 270 righe |
| `sys_leave_accrual_rules` | 20 | S2 | `accrual_rule_method`: un solo valore distinto su 20 righe |
| `sys_leave_accrual_rules` | 20 | S2 | `accrual_rule_max_carryover_days`: un solo valore distinto su 20 righe |
| `sys_leave_accrual_rules` | 20 | S2 | `accrual_rule_carryover_expiry_months`: un solo valore distinto su 20 righe |
| `sys_leave_accrual_rules` | 20 | S2 | `accrual_rule_min_tenure_months`: un solo valore distinto su 20 righe |
| `sys_person_evidence_records` | 237 | S2 | `person_evidence_type`: un solo valore distinto su 237 righe |
| `sys_person_evidence_records` | 237 | S1 | `person_evidence_resource_type`: colonna interamente NULL su 237 righe |
| `sys_person_evidence_records` | 237 | S1 | `person_evidence_resource_id`: colonna interamente NULL su 237 righe |
| `sys_person_evidence_records` | 237 | S2 | `person_evidence_source`: un solo valore distinto su 237 righe |
| `sys_positions` | 181 | S1 | `position_esco_occupation_uri`: colonna interamente NULL su 181 righe |
| `sys_positions` | 181 | S1 | `position_economic_weight`: colonna interamente NULL su 181 righe |
| `sys_positions` | 181 | S1 | `position_effective_to`: colonna interamente NULL su 181 righe |
| `sys_positions` | 181 | S2 | `position_ai_hints`: un solo valore distinto su 181 righe |
| `sys_time_off_balances` | 1.886 | S2 | `balance_carryover_days`: un solo valore distinto su 1886 righe |
| `sys_time_off_balances` | 1.886 | S1 | `balance_carryover_expires_at`: colonna interamente NULL su 1886 righe |
| `sys_time_off_balances` | 1.886 | S2 | `balance_adjustment_days`: un solo valore distinto su 1886 righe |
| `sys_time_off_balances` | 1.886 | S1 | `balance_adjustment_reason`: colonna interamente NULL su 1886 righe |
| `sys_visualization_edges` | 157 | S2 | `edge_graph_id`: un solo valore distinto su 157 righe |
| `sys_visualization_edges` | 157 | S2 | `edge_type`: un solo valore distinto su 157 righe |
| `sys_visualization_edges` | 157 | S1 | `edge_weight`: colonna interamente NULL su 157 righe |
| `sys_visualization_edges` | 157 | S2 | `edge_metadata`: un solo valore distinto su 157 righe |
| `sys_auth_password_reset_tokens` | 27 | S2 | `auth_password_reset_user_id`: un solo valore distinto su 27 righe |
| `sys_auth_password_reset_tokens` | 27 | S1 | `auth_password_reset_used_at`: colonna interamente NULL su 27 righe |
| `sys_auth_password_reset_tokens` | 27 | S2 | `auth_password_reset_requester_ip`: un solo valore distinto su 27 righe |
| `sys_capability_maturity_scores` | 20 | S2 | `capability_maturity_score_capability_ref`: un solo valore distinto su 20 righe |
| `sys_capability_maturity_scores` | 20 | S2 | `capability_maturity_score_rubric_version`: un solo valore distinto su 20 righe |
| `sys_capability_maturity_scores` | 20 | S2 | `capability_maturity_score_computed_at`: un solo valore distinto su 20 righe |
| `sys_content_documents` | 175 | S2 | `document_body_format`: un solo valore distinto su 175 righe |
| `sys_content_documents` | 175 | S2 | `document_author_user_id`: un solo valore distinto su 175 righe |
| `sys_content_documents` | 175 | S1 | `document_expires_date`: colonna interamente NULL su 175 righe |
| `sys_continuous_feedback` | 474 | S1 | `feedback_category`: colonna interamente NULL su 474 righe |
| `sys_continuous_feedback` | 474 | S2 | `feedback_visibility`: un solo valore distinto su 474 righe |
| `sys_continuous_feedback` | 474 | S1 | `feedback_acknowledged_at`: colonna interamente NULL su 474 righe |
| `sys_inbox_notifications` | 76 | S1 | `notification_read_at`: colonna interamente NULL su 76 righe |
| `sys_inbox_notifications` | 76 | S1 | `notification_dismissed_at`: colonna interamente NULL su 76 righe |
| `sys_inbox_notifications` | 76 | S1 | `notification_expires_at`: colonna interamente NULL su 76 righe |
| `sys_kpi_measurements` | 248 | S1 | `kpi_measurement_position_id`: colonna interamente NULL su 248 righe |
| `sys_kpi_measurements` | 248 | S1 | `kpi_measurement_unit`: colonna interamente NULL su 248 righe |
| `sys_kpi_measurements` | 248 | S2 | `kpi_measurement_source`: un solo valore distinto su 248 righe |
| `sys_leave_balance_transactions` | 20 | S2 | `transaction_reference_type`: un solo valore distinto su 20 righe |
| `sys_leave_balance_transactions` | 20 | S1 | `transaction_reference_id`: colonna interamente NULL su 20 righe |
| `sys_leave_balance_transactions` | 20 | S1 | `transaction_performed_by_user_id`: colonna interamente NULL su 20 righe |
| `sys_okr_check_ins` | 25 | S1 | `check_in_subject_user_id`: colonna interamente NULL su 25 righe |
| `sys_okr_check_ins` | 25 | S1 | `check_in_previous_progress`: colonna interamente NULL su 25 righe |
| `sys_okr_check_ins` | 25 | S1 | `check_in_new_progress`: colonna interamente NULL su 25 righe |
| `sys_okr_key_results` | 20 | S1 | `key_result_owner_user_id`: colonna interamente NULL su 20 righe |
| `sys_okr_key_results` | 20 | S2 | `key_result_confidence_level`: un solo valore distinto su 20 righe |
| `sys_okr_key_results` | 20 | S1 | `key_result_last_check_in_at`: colonna interamente NULL su 20 righe |
| `sys_organization_unit_kpi_templates` | 100 | S1 | `organization_unit_kpi_template_unit_id`: colonna interamente NULL su 100 righe |
| `sys_organization_unit_kpi_templates` | 100 | S1 | `organization_unit_kpi_template_tenant_id`: colonna interamente NULL su 100 righe |
| `sys_organization_unit_kpi_templates` | 100 | S2 | `organization_unit_kpi_template_weight`: un solo valore distinto su 100 righe |
| `sys_position_kpi_requirements` | 172 | S2 | `weight`: un solo valore distinto su 172 righe |
| `sys_position_kpi_requirements` | 172 | S2 | `position_kpi_requirement_metadata`: un solo valore distinto su 172 righe |
| `sys_position_kpi_requirements` | 172 | S1 | `rank`: colonna interamente NULL su 172 righe |
| `sys_user_education_records` | 160 | S1 | `user_education_grade`: colonna interamente NULL su 160 righe |
| `sys_user_education_records` | 160 | S1 | `user_education_esco_qualification_uri`: colonna interamente NULL su 160 righe |
| `sys_user_education_records` | 160 | C1 | `user_education_start_date`: mese «10» concentra 64% delle 159 date |
| `sys_user_employment` | 161 | S1 | `user_employment_termination_date`: colonna interamente NULL su 161 righe |
| `sys_user_employment` | 161 | S1 | `user_employment_termination_reason`: colonna interamente NULL su 161 righe |
| `sys_user_employment` | 161 | S2 | `user_employment_metadata`: un solo valore distinto su 161 righe |
| `sys_user_profiles` | 157 | S1 | `user_profile_picture_uri`: colonna interamente NULL su 157 righe |
| `sys_user_profiles` | 157 | S1 | `user_profile_linkedin_uri`: colonna interamente NULL su 157 righe |
| `sys_user_profiles` | 157 | S2 | `user_profile_contact_prefs`: un solo valore distinto su 157 righe |
| `sys_variable_pay_calculations` | 182 | S1 | `variable_pay_calculation_position_id`: colonna interamente NULL su 182 righe |
| `sys_variable_pay_calculations` | 182 | S1 | `variable_pay_calculation_signal_score`: colonna interamente NULL su 182 righe |
| `sys_variable_pay_calculations` | 182 | C1 | `variable_pay_calculation_computed_at`: mese «01» concentra 89% delle 182 date |
| `sys_visualization_nodes` | 158 | S2 | `node_graph_id`: un solo valore distinto su 158 righe |
| `sys_visualization_nodes` | 158 | S2 | `node_source_entity_type`: un solo valore distinto su 158 righe |
| `sys_visualization_nodes` | 158 | S2 | `node_metadata`: un solo valore distinto su 158 righe |
| `sys_approval_steps` | 751 | S2 | `approval_step_metadata`: un solo valore distinto su 751 righe |
| `sys_approval_steps` | 751 | S1 | `approval_step_level_policy`: colonna interamente NULL su 751 righe |
| `sys_assessment_results` | 1.560 | S1 | `assessment_result_assessor_user_id`: colonna interamente NULL su 1560 righe |
| `sys_assessment_results` | 1.560 | S2 | `assessment_result_metadata`: un solo valore distinto su 1560 righe |
| `sys_assessments` | 615 | S1 | `assessment_method_id`: colonna interamente NULL su 615 righe |
| `sys_assessments` | 615 | S1 | `assessment_period_start`: colonna interamente NULL su 615 righe |
| `sys_auth_credentials` | 496 | C1 | `rotated_at`: giorno del mese «27» concentra 49% delle 336 date |
| `sys_auth_credentials` | 496 | C1 | `rotated_at`: mese «07» concentra 100% delle 336 date |
| `sys_auth_role_permissions` | 908 | C1 | `granted_at`: giorno del mese «16» concentra 45% delle 908 date |
| `sys_auth_role_permissions` | 908 | C1 | `granted_at`: mese «05» concentra 46% delle 908 date |
| `sys_blueprint_process_registry` | 23 | S2 | `blueprint_process_variant_id`: un solo valore distinto su 23 righe |
| `sys_blueprint_process_registry` | 23 | S2 | `blueprint_process_metadata`: un solo valore distinto su 23 righe |
| `sys_branches` | 6 | S1 | `branch_address_line2`: colonna interamente NULL su 6 righe |
| `sys_branches` | 6 | S1 | `branch_regulatory_zone`: colonna interamente NULL su 6 righe |
| `sys_capability_scores` | 317 | S2 | `capability_score_aggregation_mode`: un solo valore distinto su 317 righe |
| `sys_capability_scores` | 317 | S2 | `capability_score_computed_at`: un solo valore distinto su 317 righe |
| `sys_compensation_recommendations` | 116 | S1 | `compensation_recommendation_position_id`: colonna interamente NULL su 116 righe |
| `sys_compensation_recommendations` | 116 | C1 | `compensation_recommendation_computed_at`: mese «04» concentra 68% delle 116 date |
| `sys_content_versions` | 204 | S2 | `version_body_format`: un solo valore distinto su 204 righe |
| `sys_content_versions` | 204 | S2 | `version_author_user_id`: un solo valore distinto su 204 righe |
| `sys_enterprise_size_bands` | 5 | S1 | `enterprise_size_band_min_revenue_eur`: colonna interamente NULL su 5 righe |
| `sys_enterprise_size_bands` | 5 | S1 | `enterprise_size_band_max_revenue_eur`: colonna interamente NULL su 5 righe |
| `sys_feedback_360_responses` | 776 | S1 | `response_sentiment_score`: colonna interamente NULL su 776 righe |
| `sys_feedback_360_responses` | 776 | S1 | `response_submission_time_seconds`: colonna interamente NULL su 776 righe |
| `sys_gap_analysis_results` | 158 | S2 | `gap_analysis_result_kind`: un solo valore distinto su 158 righe |
| `sys_gap_analysis_results` | 158 | S2 | `gap_analysis_result_computed_at`: un solo valore distinto su 158 righe |
| `sys_gap_closure_plans` | 36 | S1 | `gap_closure_plan_position_id`: colonna interamente NULL su 36 righe |
| `sys_gap_closure_plans` | 36 | S1 | `gap_closure_plan_owner_user_id`: colonna interamente NULL su 36 righe |
| `sys_goal_comments` | 849 | S1 | `comment_author_user_id`: colonna interamente NULL su 849 righe |
| `sys_goal_comments` | 849 | S1 | `comment_parent_comment_id`: colonna interamente NULL su 849 righe |
| `sys_goal_updates` | 1.798 | S1 | `update_author_user_id`: colonna interamente NULL su 1798 righe |
| `sys_goal_updates` | 1.798 | S2 | `update_attachments`: un solo valore distinto su 1798 righe |
| `sys_kpi_assessment_results` | 248 | S1 | `kpi_assessment_result_position_id`: colonna interamente NULL su 248 righe |
| `sys_kpi_assessment_results` | 248 | S1 | `kpi_assessment_result_method_id`: colonna interamente NULL su 248 righe |
| `sys_kpi_definitions` | 243 | S1 | `kpi_definition_tenant_id`: colonna interamente NULL su 243 righe |
| `sys_kpi_definitions` | 243 | S1 | `kpi_definition_formula`: colonna interamente NULL su 243 righe |
| `sys_payroll_handoff_records` | 36 | S2 | `payroll_handoff_record_recipient_system`: un solo valore distinto su 36 righe |
| `sys_payroll_handoff_records` | 36 | C1 | `payroll_handoff_record_handed_off_at`: giorno del mese «23» concentra 72% delle 36 date |
| `sys_position_economic_weight` | 24 | S1 | `position_economic_weight_period_start`: colonna interamente NULL su 24 righe |
| `sys_position_economic_weight` | 24 | S1 | `position_economic_weight_period_end`: colonna interamente NULL su 24 righe |
| `sys_position_skill_requirement_history` | 211 | S2 | `position_skill_requirement_history_old_weight`: un solo valore distinto su 211 righe |
| `sys_position_skill_requirement_history` | 211 | S2 | `position_skill_requirement_history_new_weight`: un solo valore distinto su 211 righe |
| `sys_reconciliation_registry` | 125 | C1 | `reconciliation_registry_decided_at`: giorno del mese «03» concentra 49% delle 125 date |
| `sys_reconciliation_registry` | 125 | C1 | `reconciliation_registry_decided_at`: mese «06» concentra 86% delle 125 date |
| `sys_reward_gate_results` | 3.283 | S2 | `reward_gate_result_payload`: un solo valore distinto su 3283 righe |
| `sys_reward_gate_results` | 3.283 | C1 | `reward_gate_result_recorded_at`: mese «01» concentra 72% delle 3283 date |
| `sys_reward_gates` | 3.283 | S1 | `reward_gate_position_id`: colonna interamente NULL su 3283 righe |
| `sys_reward_gates` | 3.283 | S2 | `reward_gate_payload`: un solo valore distinto su 3283 righe |
| `sys_schema_migrations` | 215 | C1 | `applied_at`: giorno del mese «29» concentra 100% delle 215 date |
| `sys_schema_migrations` | 215 | C1 | `applied_at`: mese «07» concentra 100% delle 215 date |
| `sys_survey_responses` | 8.288 | S1 | `survey_response_text_value`: colonna interamente NULL su 8288 righe |
| `sys_survey_responses` | 8.288 | S1 | `survey_response_choice_value`: colonna interamente NULL su 8288 righe |
| `sys_time_off_requests` | 2.078 | S1 | `request_cancelled_at`: colonna interamente NULL su 2078 righe |
| `sys_time_off_requests` | 2.078 | S1 | `request_cancelled_by_user_id`: colonna interamente NULL su 2078 righe |
| `sys_training_initiatives` | 62 | S2 | `training_initiative_facilitator_user_id`: un solo valore distinto su 62 righe |
| `sys_training_initiatives` | 62 | S2 | `training_initiative_capacity`: un solo valore distinto su 62 righe |
| `sys_user_auth_roles` | 340 | C1 | `user_auth_role_granted_at`: giorno del mese «01» concentra 49% delle 340 date |
| `sys_user_auth_roles` | 340 | C1 | `user_auth_role_granted_at`: mese «06» concentra 52% delle 340 date |
| `sys_user_career_plans` | 113 | S1 | `user_career_plan_target_position_id`: colonna interamente NULL su 113 righe |
| `sys_user_career_plans` | 113 | S1 | `user_career_plan_horizon_months`: colonna interamente NULL su 113 righe |
| `sys_user_certifications` | 916 | S1 | `user_certification_document_uri`: colonna interamente NULL su 916 righe |
| `sys_user_certifications` | 916 | C1 | `user_certification_issued_date`: mese «07» concentra 36% delle 916 date |
| `sys_user_position_assignments` | 196 | S2 | `user_position_assignment_kind`: un solo valore distinto su 196 righe |
| `sys_user_position_assignments` | 196 | S2 | `user_position_assignment_fte`: un solo valore distinto su 196 righe |
| `sys_user_profile_embeddings` | 156 | S2 | `tenant_id`: un solo valore distinto su 156 righe |
| `sys_user_profile_embeddings` | 156 | S2 | `model_id`: un solo valore distinto su 156 righe |
| `sys_visualization_node_layouts` | 158 | S2 | `layout_id`: un solo valore distinto su 158 righe |
| `sys_visualization_node_layouts` | 158 | S2 | `z`: un solo valore distinto su 158 righe |
| `sys_activity_classifications` | 3.257 | S2 | `activity_classification_scheme`: un solo valore distinto su 3257 righe |
| `sys_approval_requests` | 642 | S2 | `approval_request_decision_policy`: un solo valore distinto su 642 righe |
| `sys_auth_identities` | 160 | S2 | `auth_identity_provider`: un solo valore distinto su 160 righe |
| `sys_behavioral_assessments` | 465 | S2 | `behavioral_assessment_recorded_at`: un solo valore distinto su 465 righe |
| `sys_blueprint_activations` | 1 | S1 | `blueprint_activation_effective_to`: colonna interamente NULL su 1 righe |
| `sys_bonus_pools` | 6 | S1 | `bonus_pool_organization_unit_id`: colonna interamente NULL su 6 righe |
| `sys_capability_score_lineage` | 316 | S2 | `capability_score_lineage_computed_at`: un solo valore distinto su 316 righe |
| `sys_career_path_steps` | 35 | S2 | `career_path_step_required_proficiency_uplift`: un solo valore distinto su 35 righe |
| `sys_content_categories` | 6 | S1 | `category_parent_id`: colonna interamente NULL su 6 righe |
| `sys_critical_positions` | 8 | S1 | `critical_position_business_impact_score`: colonna interamente NULL su 8 righe |
| `sys_employee_position_fit_scores` | 146 | S2 | `employee_position_fit_score_dimension`: un solo valore distinto su 146 righe |
| `sys_engagement_survey_templates` | 5 | S1 | `template_created_by_user_id`: colonna interamente NULL su 5 righe |
| `sys_engagement_surveys` | 6 | S1 | `survey_template_id`: colonna interamente NULL su 6 righe |
| `sys_enterprise_typing_profiles` | 2 | S1 | `enterprise_typing_revenue_eur`: colonna interamente NULL su 2 righe |
| `sys_esco_occupation_embeddings` | 3.045 | S2 | `model_id`: un solo valore distinto su 3045 righe |
| `sys_flight_risk_scores` | 162 | S2 | `flight_risk_score_computed_at`: un solo valore distinto su 162 righe |
| `sys_gap_closure_actions` | 440 | S2 | `gap_closure_action_kind`: un solo valore distinto su 440 righe |
| `sys_gdpr_data_map` | 54 | S2 | `gdpr_map_table_schema`: un solo valore distinto su 54 righe |
| `sys_goal_alignments` | 100 | S2 | `alignment_type`: un solo valore distinto su 100 righe |
| `sys_goal_milestones` | 1.000 | C1 | `milestone_completed_at`: mese «02» concentra 95% delle 218 date |
| `sys_job_families` | 27 | S2 | `job_family_metadata`: un solo valore distinto su 27 righe |
| `sys_job_role_embeddings` | 137 | S2 | `model_id`: un solo valore distinto su 137 righe |
| `sys_kpi_metric_definitions` | 243 | S2 | `kpi_metric_definition_aggregation`: un solo valore distinto su 243 righe |
| `sys_kpi_targets` | 301 | S1 | `kpi_target_position_id`: colonna interamente NULL su 301 righe |
| `sys_learning_modules` | 1.002 | S2 | `learning_module_kind`: un solo valore distinto su 1002 righe |
| `sys_learning_paths` | 4.667 | S1 | `learning_path_target_outcome`: colonna interamente NULL su 4667 righe |
| `sys_mentor_match_scores` | 30 | S2 | `match_expires_at`: un solo valore distinto su 30 righe |
| `sys_mentorship_programs` | 5 | S1 | `program_end_date`: colonna interamente NULL su 5 righe |
| `sys_mentorships` | 63 | C1 | `mentorship_start_date`: giorno del mese «01» concentra 30% delle 63 date |
| `sys_model_predictions` | 468 | S1 | `prediction_model_id`: colonna interamente NULL su 468 righe |
| `sys_occupation_classifications` | 2.121 | S2 | `occupation_classification_metadata`: un solo valore distinto su 2121 righe |
| `sys_organization_unit_processes` | 105 | S2 | `org_unit_process_metadata`: un solo valore distinto su 105 righe |
| `sys_organization_units` | 28 | S1 | `organization_unit_effective_to`: colonna interamente NULL su 28 righe |
| `sys_performance_review_competency_ratings` | 1.644 | S1 | `rating_self_evidence`: colonna interamente NULL su 1644 righe |
| `sys_position_learning_requirements` | 1.791 | S2 | `deadline_rule`: un solo valore distinto su 1791 righe |
| `sys_process_participants` | 1.104 | S2 | `process_participant_metadata`: un solo valore distinto su 1104 righe |
| `sys_pulse_checks` | 2.834 | C1 | `pulse_check_date`: mese «11» concentra 43% delle 2834 date |
| `sys_readiness_scores` | 90 | S2 | `readiness_score_computed_at`: un solo valore distinto su 90 righe |
| `sys_reference_translations` | 32.426 | S2 | `locale`: un solo valore distinto su 32426 righe |
| `sys_skill_aliases` | 80 | S2 | `skill_alias_metadata`: un solo valore distinto su 80 righe |
| `sys_skill_categories` | 7 | S1 | `skill_category_family_id`: colonna interamente NULL su 7 righe |
| `sys_skill_embeddings` | 14.041 | S2 | `model_id`: un solo valore distinto su 14041 righe |
| `sys_skill_gap_scores` | 156 | S2 | `skill_gap_score_computed_at`: un solo valore distinto su 156 righe |
| `sys_succession_readiness_scores` | 468 | S2 | `succession_readiness_score_computed_at`: un solo valore distinto su 468 righe |
| `sys_succession_scores` | 90 | S2 | `succession_score_computed_at`: un solo valore distinto su 90 righe |
| `sys_successor_readiness` | 79 | C1 | `successor_readiness_assessed_at`: mese «11» concentra 100% delle 79 date |
| `sys_survey_questions` | 69 | S1 | `survey_question_options`: colonna interamente NULL su 69 righe |
| `sys_talent_scores` | 154 | S2 | `talent_score_computed_at`: un solo valore distinto su 154 righe |
| `sys_user_addresses` | 171 | S2 | `user_address_metadata`: un solo valore distinto su 171 righe |
| `sys_user_assessment_evidence` | 1.560 | S1 | `user_assessment_evidence_assessor_user_id`: colonna interamente NULL su 1560 righe |
| `sys_user_bank_details` | 156 | S2 | `user_bank_metadata`: un solo valore distinto su 156 righe |
| `sys_user_consents` | 641 | C1 | `consent_occurred_at`: mese «08» concentra 96% delle 641 date |
| `sys_user_demographics` | 161 | S2 | `user_demographics_metadata`: un solo valore distinto su 161 righe |
| `sys_user_documents` | 657 | S2 | `user_document_mime_type`: un solo valore distinto su 657 righe |
| `sys_user_family_members` | 150 | S2 | `user_family_member_metadata`: un solo valore distinto su 150 righe |
| `sys_user_identity_documents` | 332 | S2 | `user_identity_document_metadata`: un solo valore distinto su 332 righe |
| `sys_user_kpi_evidence` | 248 | S1 | `user_kpi_evidence_unit`: colonna interamente NULL su 248 righe |
| `sys_user_learning_evidence` | 3.868 | S1 | `user_learning_evidence_certificate_uri`: colonna interamente NULL su 3868 righe |
| `sys_user_pay_slips` | 5.641 | C1 | `user_pay_slip_payment_date`: giorno del mese «27» concentra 72% delle 5641 date |
| `sys_user_professional_experiences` | 255 | S2 | `user_prof_exp_description`: un solo valore distinto su 255 righe |
| `sys_user_skill_evidence` | 902 | S1 | `user_skill_evidence_assessor_user_id`: colonna interamente NULL su 902 righe |
| `sys_user_skills` | 1.355 | S1 | `user_skill_last_used_on`: colonna interamente NULL su 1355 righe |
| `sys_user_target_positions` | 164 | S2 | `user_target_position_metadata`: un solo valore distinto su 164 righe |
| `sys_users` | 163 | S2 | `user_type`: un solo valore distinto su 163 righe |
| `sys_whistleblowing_reports` | 2 | S1 | `whistleblowing_report_contact`: colonna interamente NULL su 2 righe |

## Rilievi SPIEGATI

Esiti che una regola segnala ma che sono corretti nel dominio. La classe e il motivo sono dichiarati nel file delle spiegazioni; una tabella nuova con le stesse caratteristiche eredita la spiegazione invece di generare rumore.

| tabella | regola | rilievo | perché è corretto |
|---|---|---|---|
| `sys_activity_classifications` | S1 | `activity_classification_description`: colonna interamente NULL su 3257 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_approval_requests` | S2 | `approval_request_tenant_id`: un solo valore distinto su 642 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_approval_requests` | C1 | `approval_request_resolved_at`: mese «08» concentra 72% delle 630 date | Verificato sui dati: la concentrazione e' su AGOSTO DI OGNI ANNO (150 nel 2023, 148 nel 2024, 153 nel 2025) — sono le richieste di assenza estiva e la loro approvazione. E' il calendario feriale italiano, non un artefatto di generazione. |
| `sys_approval_requests` | C1 | `approval_request_applied_at`: mese «08» concentra 95% delle 467 date | Verificato sui dati: la concentrazione e' su AGOSTO DI OGNI ANNO (150 nel 2023, 148 nel 2024, 153 nel 2025) — sono le richieste di assenza estiva e la loro approvazione. E' il calendario feriale italiano, non un artefatto di generazione. |
| `sys_approval_steps` | S2 | `approval_step_tenant_id`: un solo valore distinto su 751 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_approval_steps` | C1 | `approval_step_decided_at`: mese «08» concentra 63% delle 715 date | Verificato sui dati: la concentrazione e' su AGOSTO DI OGNI ANNO (150 nel 2023, 148 nel 2024, 153 nel 2025) — sono le richieste di assenza estiva e la loro approvazione. E' il calendario feriale italiano, non un artefatto di generazione. |
| `sys_assessment_methods` | S1 | `assessment_method_description`: colonna interamente NULL su 5 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_assessment_results` | S2 | `assessment_result_tenant_id`: un solo valore distinto su 1560 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_assessment_results` | S1 | `assessment_result_narrative`: colonna interamente NULL su 1560 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_assessments` | S2 | `assessment_status`: un solo valore distinto su 615 righe | Stato uniforme su tutte le righe: legittimo quando la tabella contiene solo record che hanno raggiunto lo stesso punto del ciclo (es. tutti attivi, tutti pubblicati). Dove NON lo era — code di approvazione ferme — e' stato riparato (vedi C12b). |
| `sys_attendance` | S2 | `attendance_tenant_id`: un solo valore distinto su 116015 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_attendance` | S1 | `attendance_source_reference`: colonna interamente NULL su 116015 righe | Aggancio a un sistema ESTERNO non ancora collegato (nessuna integrazione attiva oggi). Si valorizzera' quando l'integrazione esistera'. |
| `sys_attendance` | S1 | `attendance_notes`: colonna interamente NULL su 116015 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_auth_credentials` | S2 | `auth_credential_algorithm`: un solo valore distinto su 496 righe | Versione del motore che ha prodotto il dato: una sola perche' il calcolo e' stato eseguito da una sola versione. Diventera' varia al primo aggiornamento del modello. |
| `sys_auth_mfa_policies` | S1 | `auth_mfa_policy_role_codes`: colonna interamente NULL su 2 righe | Secondo fattore: la funzione esiste ma non e' in uso su questi profili, e le credenziali non si inventano (stessa ragione per cui le tabelle MFA restano vuote). |
| `sys_auth_mfa_webauthn_credentials` | S1 | `auth_webauthn_cred_last_used_at`: colonna interamente NULL su 6 righe | Secondo fattore: la funzione esiste ma non e' in uso su questi profili, e le credenziali non si inventano (stessa ragione per cui le tabelle MFA restano vuote). |
| `sys_auth_refresh_tokens` | C1 | `auth_refresh_token_issued_at`: giorno del mese «30» concentra 28% delle 6963 date | Traffico di accesso REALE, non storia costruita: si concentra nel periodo in cui il sistema e' stato effettivamente usato. Ridistribuirlo significherebbe falsificare i log di sicurezza. |
| `sys_auth_refresh_tokens` | C1 | `auth_refresh_token_issued_at`: mese «07» concentra 62% delle 6963 date | Traffico di accesso REALE, non storia costruita: si concentra nel periodo in cui il sistema e' stato effettivamente usato. Ridistribuirlo significherebbe falsificare i log di sicurezza. |
| `sys_behavioral_assessments` | S2 | `behavioral_assessment_tenant_id`: un solo valore distinto su 465 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_behavioral_assessments` | C1 | `behavioral_assessment_recorded_at`: giorno del mese «03» concentra 100% delle 465 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_behavioral_assessments` | C1 | `behavioral_assessment_recorded_at`: mese «06» concentra 100% delle 465 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_blueprint_process_registry` | S1 | `blueprint_process_description`: colonna interamente NULL su 23 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_blueprint_variants` | S1 | `blueprint_variant_description`: colonna interamente NULL su 1 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_capability_maturity_scores` | S2 | `capability_maturity_score_tenant_id`: un solo valore distinto su 20 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_capability_maturity_scores` | S2 | `capability_maturity_score_model_version`: un solo valore distinto su 20 righe | Versione del motore che ha prodotto il dato: una sola perche' il calcolo e' stato eseguito da una sola versione. Diventera' varia al primo aggiornamento del modello. |
| `sys_capability_score_lineage` | S2 | `capability_score_lineage_tenant_id`: un solo valore distinto su 316 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_capability_score_lineage` | C1 | `capability_score_lineage_computed_at`: giorno del mese «05» concentra 100% delle 316 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_capability_score_lineage` | C1 | `capability_score_lineage_computed_at`: mese «07» concentra 100% delle 316 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_capability_scores` | S2 | `capability_score_tenant_id`: un solo valore distinto su 317 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_capability_scores` | S2 | `capability_score_model_version`: un solo valore distinto su 317 righe | Versione del motore che ha prodotto il dato: una sola perche' il calcolo e' stato eseguito da una sola versione. Diventera' varia al primo aggiornamento del modello. |
| `sys_capability_scores` | C1 | `capability_score_computed_at`: giorno del mese «05» concentra 100% delle 317 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_capability_scores` | C1 | `capability_score_computed_at`: mese «07» concentra 100% delle 317 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_compensation_recommendations` | S2 | `compensation_recommendation_tenant_id`: un solo valore distinto su 116 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_compensation_recommendations` | S1 | `compensation_recommendation_narrative`: colonna interamente NULL su 116 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_compensation_recommendations` | C1 | `compensation_recommendation_period_start`: giorno del mese «01» concentra 100% delle 116 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_compensation_recommendations` | C1 | `compensation_recommendation_period_start`: mese «04» concentra 68% delle 116 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_content_blueprint_links` | S1 | `link_note`: colonna interamente NULL su 1 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_content_documents` | S2 | `document_tenant_id`: un solo valore distinto su 175 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_content_documents` | C1 | `document_published_at`: mese «06» concentra 85% delle 163 date | Pubblicazione INIZIALE del corpus documentale: quando un'azienda adotta il portale, i documenti vigenti entrano in un atto solo. Le revisioni successive sono invece datate sui fatti (le policy organizzative il 2025-03-17, due settimane dopo il riordino). |
| `sys_content_versions` | S2 | `version_tenant_id`: un solo valore distinto su 204 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_continuous_feedback` | S2 | `feedback_tenant_id`: un solo valore distinto su 474 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_continuous_feedback` | S1 | `feedback_tags`: colonna interamente NULL su 474 righe | Etichettatura facoltativa, a discrezione di chi inserisce. Non fa parte del dato minimo di nessun processo. |
| `sys_critical_positions` | S1 | `critical_position_rationale`: colonna interamente NULL su 8 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_employee_position_fit_scores` | S2 | `employee_position_fit_score_tenant_id`: un solo valore distinto su 146 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_employee_position_fit_scores` | C1 | `employee_position_fit_score_computed_at`: giorno del mese «13» concentra 95% delle 146 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_employee_position_fit_scores` | C1 | `employee_position_fit_score_computed_at`: mese «05» concentra 95% delle 146 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_engagement_feedback` | S2 | `feedback_tenant_id`: un solo valore distinto su 400 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_engagement_survey_responses` | S2 | `response_tenant_id`: un solo valore distinto su 862 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_enterprise_size_bands` | S1 | `enterprise_size_band_description`: colonna interamente NULL su 5 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_feedback_360_responses` | S2 | `response_tenant_id`: un solo valore distinto su 776 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_feedback_360_responses` | S2 | `response_status`: un solo valore distinto su 776 righe | Stato uniforme su tutte le righe: legittimo quando la tabella contiene solo record che hanno raggiunto lo stesso punto del ciclo (es. tutti attivi, tutti pubblicati). Dove NON lo era — code di approvazione ferme — e' stato riparato (vedi C12b). |
| `sys_feedback_360_responses` | C1 | `response_completed_at`: mese «10» concentra 52% delle 776 date | Le campagne di ascolto sono EVENTI PUNTUALI: gli inviti partono tutti insieme il giorno di apertura del ciclo e le risposte arrivano nelle settimane seguenti. La concentrazione e' la campagna. |
| `sys_flight_risk_scores` | S2 | `flight_risk_score_model_version`: un solo valore distinto su 162 righe | Versione del motore che ha prodotto il dato: una sola perche' il calcolo e' stato eseguito da una sola versione. Diventera' varia al primo aggiornamento del modello. |
| `sys_flight_risk_scores` | C1 | `flight_risk_score_computed_at`: giorno del mese «29» concentra 100% delle 162 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_flight_risk_scores` | C1 | `flight_risk_score_computed_at`: mese «07» concentra 100% delle 162 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_gap_analysis_results` | S2 | `gap_analysis_result_tenant_id`: un solo valore distinto su 158 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_gap_analysis_results` | C1 | `gap_analysis_result_computed_at`: giorno del mese «22» concentra 100% delle 158 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_gap_analysis_results` | C1 | `gap_analysis_result_computed_at`: mese «07» concentra 100% delle 158 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_gap_closure_actions` | S2 | `gap_closure_action_tenant_id`: un solo valore distinto su 440 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_gap_closure_plans` | S2 | `gap_closure_plan_status`: un solo valore distinto su 36 righe | Stato uniforme su tutte le righe: legittimo quando la tabella contiene solo record che hanno raggiunto lo stesso punto del ciclo (es. tutti attivi, tutti pubblicati). Dove NON lo era — code di approvazione ferme — e' stato riparato (vedi C12b). |
| `sys_goal_alignments` | S2 | `alignment_tenant_id`: un solo valore distinto su 100 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_goal_check_ins` | S2 | `check_in_tenant_id`: un solo valore distinto su 7567 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_goal_comments` | S2 | `comment_tenant_id`: un solo valore distinto su 849 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_goal_milestones` | S2 | `milestone_tenant_id`: un solo valore distinto su 1000 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_goal_templates` | S2 | `template_tenant_id`: un solo valore distinto su 40 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_goal_templates` | S1 | `template_deleted_at`: colonna interamente NULL su 40 righe | Traccia di una CANCELLAZIONE o revoca: vuota perche' nulla e' stato cancellato o revocato. E' esattamente lo stato che si vuole. |
| `sys_goal_updates` | S2 | `update_tenant_id`: un solo valore distinto su 1798 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_goals` | S2 | `goal_tenant_id`: un solo valore distinto su 2624 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_goals` | D1 | `goal_start_date`: 121 righe oltre la finestra (> 2026-07-31), max 2026-09-03 | Obiettivi PIANIFICATI per il trimestre successivo: fissare in anticipo un obiettivo che parte a settembre e' gestione normale, non una data sbagliata. |
| `sys_goals` | C1 | `goal_start_date`: giorno del mese «01» concentra 32% delle 2624 date | Gli obiettivi annuali partono a inizio anno e si chiudono a dicembre. Concentrazione attesa. |
| `sys_goals` | C1 | `goal_start_date`: mese «01» concentra 61% delle 2624 date | Gli obiettivi annuali partono a inizio anno e si chiudono a dicembre. Concentrazione attesa. |
| `sys_goals` | C1 | `goal_completed_at`: mese «12» concentra 71% delle 1060 date | Gli obiettivi annuali partono a inizio anno e si chiudono a dicembre. Concentrazione attesa. |
| `sys_inbox_notifications` | S2 | `notification_tenant_id`: un solo valore distinto su 76 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_inbox_notifications` | S2 | `notification_status`: un solo valore distinto su 76 righe | Stato uniforme su tutte le righe: legittimo quando la tabella contiene solo record che hanno raggiunto lo stesso punto del ciclo (es. tutti attivi, tutti pubblicati). Dove NON lo era — code di approvazione ferme — e' stato riparato (vedi C12b). |
| `sys_kpi_assessment_methods` | S1 | `kpi_assessment_method_description`: colonna interamente NULL su 5 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_kpi_assessment_results` | S2 | `kpi_assessment_result_tenant_id`: un solo valore distinto su 248 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_kpi_assessment_results` | C1 | `kpi_assessment_result_period_start`: giorno del mese «01» concentra 100% delle 248 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_kpi_assessment_results` | C1 | `kpi_assessment_result_period_start`: mese «01» concentra 100% delle 248 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_kpi_assessment_results` | C1 | `kpi_assessment_result_computed_at`: mese «01» concentra 100% delle 248 date | E' l'esito della riparazione C12: la misura di un esercizio ANNUALE si registra alla chiusura del periodo, quindi a gennaio. La concentrazione sul mese e' voluta; quella sul singolo GIORNO e' sparita (era 100%, ora ~35% distribuito su tre settimane). |
| `sys_kpi_measurements` | S2 | `kpi_measurement_tenant_id`: un solo valore distinto su 248 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_kpi_measurements` | C1 | `kpi_measurement_period_start`: giorno del mese «01» concentra 100% delle 248 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_kpi_measurements` | C1 | `kpi_measurement_period_start`: mese «01» concentra 100% delle 248 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_kpi_measurements` | C1 | `kpi_measurement_recorded_at`: giorno del mese «07» concentra 37% delle 248 date | E' l'esito della riparazione C12: la misura di un esercizio ANNUALE si registra alla chiusura del periodo, quindi a gennaio. La concentrazione sul mese e' voluta; quella sul singolo GIORNO e' sparita (era 100%, ora ~35% distribuito su tre settimane). |
| `sys_kpi_measurements` | C1 | `kpi_measurement_recorded_at`: mese «01» concentra 100% delle 248 date | E' l'esito della riparazione C12: la misura di un esercizio ANNUALE si registra alla chiusura del periodo, quindi a gennaio. La concentrazione sul mese e' voluta; quella sul singolo GIORNO e' sparita (era 100%, ora ~35% distribuito su tre settimane). |
| `sys_kpi_targets` | S2 | `kpi_target_tenant_id`: un solo valore distinto su 301 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_kpi_weighting_rules` | S1 | `kpi_weighting_rule_description`: colonna interamente NULL su 3 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_learning_gaps` | S2 | `learning_gap_tenant_id`: un solo valore distinto su 270 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_learning_path_steps` | S2 | `learning_path_step_is_prerequisite_for`: un solo valore distinto su 124 righe | Interruttore booleano-simile con lo stesso valore ovunque: significa che la configurazione e' uniforme, che e' cio' che ci si aspetta da un'impostazione di piattaforma. |
| `sys_leave_accrual_rules` | S2 | `accrual_rule_tenant_id`: un solo valore distinto su 20 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_leave_balance_transactions` | S2 | `transaction_tenant_id`: un solo valore distinto su 20 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_leave_balance_transactions` | N2 | `transaction_days_amount`: valore negativo su misura non-negativa — min -0.80 | E' un MOVIMENTO contabile, non una quantita': il segno distingue la maturazione (+) dall'utilizzo (-). Un saldo ferie senza valori negativi sarebbe il difetto. |
| `sys_mentor_match_scores` | S2 | `match_tenant_id`: un solo valore distinto su 30 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_mentorship_sessions` | S2 | `session_tenant_id`: un solo valore distinto su 150 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_mentorships` | S2 | `mentorship_tenant_id`: un solo valore distinto su 63 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_model_predictions` | S2 | `prediction_tenant_id`: un solo valore distinto su 468 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_model_predictions` | C1 | `prediction_computed_at`: giorno del mese «12» concentra 100% delle 468 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_model_predictions` | C1 | `prediction_computed_at`: mese «12» concentra 100% delle 468 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_occupation_classifications` | S1 | `occupation_classification_description`: colonna interamente NULL su 2121 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_okr_check_ins` | S2 | `check_in_tenant_id`: un solo valore distinto su 25 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_okr_key_results` | S2 | `key_result_tenant_id`: un solo valore distinto su 20 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_okrs` | S2 | `okr_tenant_id`: un solo valore distinto su 20 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_okrs` | S1 | `okr_description`: colonna interamente NULL su 20 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_okrs` | S2 | `okr_status`: un solo valore distinto su 20 righe | Stato uniforme su tutte le righe: legittimo quando la tabella contiene solo record che hanno raggiunto lo stesso punto del ciclo (es. tutti attivi, tutti pubblicati). Dove NON lo era — code di approvazione ferme — e' stato riparato (vedi C12b). |
| `sys_operating_model_catalog` | S1 | `operating_model_description`: colonna interamente NULL su 6 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_organization_unit_processes` | S2 | `org_unit_process_tenant_id`: un solo valore distinto su 105 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_organization_unit_types` | S1 | `organization_unit_type_description`: colonna interamente NULL su 8 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_overtime` | S2 | `overtime_tenant_id`: un solo valore distinto su 178 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_payroll_handoff_records` | S2 | `payroll_handoff_record_tenant_id`: un solo valore distinto su 36 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_payroll_handoff_records` | C1 | `payroll_handoff_record_period_start`: giorno del mese «01» concentra 100% delle 36 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_performance_review_competency_ratings` | S2 | `rating_tenant_id`: un solo valore distinto su 1644 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_performance_reviews` | S2 | `review_tenant_id`: un solo valore distinto su 550 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_performance_reviews` | S1 | `review_calibration_notes`: colonna interamente NULL su 550 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_performance_reviews` | S2 | `review_self_assessment_status`: un solo valore distinto su 550 righe | Stato uniforme su tutte le righe: legittimo quando la tabella contiene solo record che hanno raggiunto lo stesso punto del ciclo (es. tutti attivi, tutti pubblicati). Dove NON lo era — code di approvazione ferme — e' stato riparato (vedi C12b). |
| `sys_performance_reviews` | C1 | `review_period_start`: giorno del mese «01» concentra 100% delle 550 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_performance_reviews` | C1 | `review_period_start`: mese «01» concentra 100% delle 550 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_performance_reviews` | C1 | `review_submitted_at`: giorno del mese «15» concentra 33% delle 546 date | Le valutazioni annuali si consegnano e si controfirmano nella finestra di chiusura dell'esercizio: la concentrazione a gennaio e' il processo, non un artefatto. |
| `sys_performance_reviews` | C1 | `review_submitted_at`: mese «01» concentra 86% delle 546 date | Le valutazioni annuali si consegnano e si controfirmano nella finestra di chiusura dell'esercizio: la concentrazione a gennaio e' il processo, non un artefatto. |
| `sys_performance_reviews` | C1 | `review_acknowledged_at`: giorno del mese «20» concentra 31% delle 546 date | Le valutazioni annuali si consegnano e si controfirmano nella finestra di chiusura dell'esercizio: la concentrazione a gennaio e' il processo, non un artefatto. |
| `sys_performance_reviews` | C1 | `review_acknowledged_at`: mese «01» concentra 69% delle 546 date | Le valutazioni annuali si consegnano e si controfirmano nella finestra di chiusura dell'esercizio: la concentrazione a gennaio e' il processo, non un artefatto. |
| `sys_person_evidence_records` | S2 | `person_evidence_record_tenant_id`: un solo valore distinto su 237 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_position_career_paths` | S2 | `position_career_path_tenant_id`: un solo valore distinto su 252 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_position_economic_weight` | S2 | `position_economic_weight_tenant_id`: un solo valore distinto su 24 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_position_kpi_requirements` | S2 | `position_kpi_requirement_tenant_id`: un solo valore distinto su 172 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_position_learning_requirements` | S2 | `position_learning_requirement_tenant_id`: un solo valore distinto su 1791 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_position_skill_requirement_history` | S2 | `position_skill_requirement_history_tenant_id`: un solo valore distinto su 211 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_position_skill_requirement_history` | C1 | `position_skill_requirement_history_effective_at`: mese «03» concentra 33% delle 211 date | Le revisioni dei requisiti di ruolo decorrono dalla riorganizzazione (marzo 2025) e dai rinnovi contrattuali: hanno una data di efficacia comune per costruzione organizzativa. |
| `sys_position_skill_requirements` | S2 | `position_skill_requirement_tenant_id`: un solo valore distinto su 1678 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_process_participants` | S2 | `process_participant_tenant_id`: un solo valore distinto su 1104 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_readiness_scores` | C1 | `readiness_score_computed_at`: giorno del mese «03» concentra 100% delle 90 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_readiness_scores` | C1 | `readiness_score_computed_at`: mese «06» concentra 100% delle 90 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_reward_gate_results` | S2 | `reward_gate_result_tenant_id`: un solo valore distinto su 3283 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_reward_gates` | S2 | `reward_gate_tenant_id`: un solo valore distinto su 3283 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_reward_gates` | C1 | `reward_gate_period_start`: giorno del mese «01» concentra 100% delle 3283 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_reward_gates` | C1 | `reward_gate_period_start`: mese «01» concentra 100% delle 3283 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_seed_validation_results` | S2 | `seed_validation_result_status`: un solo valore distinto su 36 righe | Stato uniforme su tutte le righe: legittimo quando la tabella contiene solo record che hanno raggiunto lo stesso punto del ciclo (es. tutti attivi, tutti pubblicati). Dove NON lo era — code di approvazione ferme — e' stato riparato (vedi C12b). |
| `sys_skill_gap_scores` | S2 | `skill_gap_score_tenant_id`: un solo valore distinto su 156 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_skill_gap_scores` | S2 | `skill_gap_score_model_version`: un solo valore distinto su 156 righe | Versione del motore che ha prodotto il dato: una sola perche' il calcolo e' stato eseguito da una sola versione. Diventera' varia al primo aggiornamento del modello. |
| `sys_skill_gap_scores` | C1 | `skill_gap_score_computed_at`: giorno del mese «29» concentra 100% delle 156 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_skill_gap_scores` | C1 | `skill_gap_score_computed_at`: mese «07» concentra 100% delle 156 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_skill_proficiency_levels` | S1 | `skill_proficiency_level_description`: colonna interamente NULL su 6 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_source_lineage_records` | S2 | `source_lineage_tenant_id`: un solo valore distinto su 70972 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_source_lineage_records` | S2 | `source_lineage_validation_status`: un solo valore distinto su 70972 righe | Stato uniforme su tutte le righe: legittimo quando la tabella contiene solo record che hanno raggiunto lo stesso punto del ciclo (es. tutti attivi, tutti pubblicati). Dove NON lo era — code di approvazione ferme — e' stato riparato (vedi C12b). |
| `sys_succession_pools` | S1 | `succession_pool_description`: colonna interamente NULL su 17 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_succession_readiness_scores` | S2 | `succession_readiness_score_tenant_id`: un solo valore distinto su 468 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_succession_readiness_scores` | S2 | `succession_readiness_score_model_version`: un solo valore distinto su 468 righe | Versione del motore che ha prodotto il dato: una sola perche' il calcolo e' stato eseguito da una sola versione. Diventera' varia al primo aggiornamento del modello. |
| `sys_succession_readiness_scores` | C1 | `succession_readiness_score_computed_at`: giorno del mese «29» concentra 100% delle 468 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_succession_readiness_scores` | C1 | `succession_readiness_score_computed_at`: mese «07» concentra 100% delle 468 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_succession_scores` | C1 | `succession_score_computed_at`: giorno del mese «03» concentra 100% delle 90 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_succession_scores` | C1 | `succession_score_computed_at`: mese «06» concentra 100% delle 90 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_successor_candidates` | S2 | `successor_candidate_status`: un solo valore distinto su 28 righe | Stato uniforme su tutte le righe: legittimo quando la tabella contiene solo record che hanno raggiunto lo stesso punto del ciclo (es. tutti attivi, tutti pubblicati). Dove NON lo era — code di approvazione ferme — e' stato riparato (vedi C12b). |
| `sys_successor_readiness` | S2 | `successor_readiness_tenant_id`: un solo valore distinto su 79 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_survey_assignments` | S2 | `survey_assignment_tenant_id`: un solo valore distinto su 948 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_survey_assignments` | C1 | `survey_assignment_assigned_at`: giorno del mese «08» concentra 33% delle 948 date | Le campagne di ascolto sono EVENTI PUNTUALI: gli inviti partono tutti insieme il giorno di apertura del ciclo e le risposte arrivano nelle settimane seguenti. La concentrazione e' la campagna. |
| `sys_survey_assignments` | C1 | `survey_assignment_assigned_at`: mese «04» concentra 33% delle 948 date | Le campagne di ascolto sono EVENTI PUNTUALI: gli inviti partono tutti insieme il giorno di apertura del ciclo e le risposte arrivano nelle settimane seguenti. La concentrazione e' la campagna. |
| `sys_survey_assignments` | C1 | `survey_assignment_completed_at`: mese «04» concentra 37% delle 558 date | Le campagne di ascolto sono EVENTI PUNTUALI: gli inviti partono tutti insieme il giorno di apertura del ciclo e le risposte arrivano nelle settimane seguenti. La concentrazione e' la campagna. |
| `sys_survey_questions` | S2 | `survey_question_tenant_id`: un solo valore distinto su 69 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_survey_responses` | S2 | `survey_response_tenant_id`: un solo valore distinto su 8288 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_talent_scores` | C1 | `talent_score_computed_at`: giorno del mese «03» concentra 100% delle 154 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_talent_scores` | C1 | `talent_score_computed_at`: mese «06» concentra 100% delle 154 date | ISTANTANEA dello stato corrente (verificato: righe = soggetti distinti, o moltiplicate da un discriminante di contenuto e non dal tempo). L'ultimo ricalcolo avviene in un batch: e' corretto che sia datato uguale per tutti. |
| `sys_time_off_balances` | S2 | `balance_tenant_id`: un solo valore distinto su 1886 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_time_off_requests` | S2 | `request_tenant_id`: un solo valore distinto su 2078 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_time_off_requests` | S1 | `request_rejection_reason`: colonna interamente NULL su 2078 righe | Motivazione di un esito NEGATIVO: si valorizza solo quando quell'esito si verifica. Vuota significa che il caso non si e' presentato — riempirla creerebbe rifiuti che non ci sono stati. |
| `sys_time_off_requests` | S1 | `request_cancellation_reason`: colonna interamente NULL su 2078 righe | Motivazione di un esito NEGATIVO: si valorizza solo quando quell'esito si verifica. Vuota significa che il caso non si e' presentato — riempirla creerebbe rifiuti che non ci sono stati. |
| `sys_training_initiatives` | S2 | `training_initiative_tenant_id`: un solo valore distinto su 62 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_translatable_field` | S2 | `canonical_locale`: un solo valore distinto su 25 righe | Dimensione costante per costruzione: una banca italiana paga in euro, opera in Italia e lavora in italiano. La varianza arrivera' con un cliente estero, non prima. |
| `sys_user_addresses` | S2 | `user_address_country`: un solo valore distinto su 171 righe | Dimensione costante per costruzione: una banca italiana paga in euro, opera in Italia e lavora in italiano. La varianza arrivera' con un cliente estero, non prima. |
| `sys_user_assessment_evidence` | S2 | `user_assessment_evidence_tenant_id`: un solo valore distinto su 1560 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_user_assessment_evidence` | S1 | `user_assessment_evidence_narrative`: colonna interamente NULL su 1560 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_user_auth_roles` | S1 | `user_auth_role_revoked_at`: colonna interamente NULL su 340 righe | Traccia di una CANCELLAZIONE o revoca: vuota perche' nulla e' stato cancellato o revocato. E' esattamente lo stato che si vuole. |
| `sys_user_bank_details` | S2 | `user_bank_tenant_id`: un solo valore distinto su 156 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_user_career_plans` | S2 | `user_career_plan_tenant_id`: un solo valore distinto su 113 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_user_consents` | S2 | `consent_tenant_id`: un solo valore distinto su 641 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_user_contracts` | S2 | `user_contract_currency`: un solo valore distinto su 160 righe | Dimensione costante per costruzione: una banca italiana paga in euro, opera in Italia e lavora in italiano. La varianza arrivera' con un cliente estero, non prima. |
| `sys_user_contracts` | S2 | `user_contract_status`: un solo valore distinto su 160 righe | Stato uniforme su tutte le righe: legittimo quando la tabella contiene solo record che hanno raggiunto lo stesso punto del ciclo (es. tutti attivi, tutti pubblicati). Dove NON lo era — code di approvazione ferme — e' stato riparato (vedi C12b). |
| `sys_user_contracts` | S1 | `user_contract_notes`: colonna interamente NULL su 160 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_user_documents` | S2 | `user_document_tenant_id`: un solo valore distinto su 657 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_user_employment` | S2 | `user_employment_currency`: un solo valore distinto su 161 righe | Dimensione costante per costruzione: una banca italiana paga in euro, opera in Italia e lavora in italiano. La varianza arrivera' con un cliente estero, non prima. |
| `sys_user_employment` | S2 | `user_employment_status`: un solo valore distinto su 161 righe | Stato uniforme su tutte le righe: legittimo quando la tabella contiene solo record che hanno raggiunto lo stesso punto del ciclo (es. tutti attivi, tutti pubblicati). Dove NON lo era — code di approvazione ferme — e' stato riparato (vedi C12b). |
| `sys_user_family_members` | S2 | `user_family_member_tenant_id`: un solo valore distinto su 150 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_user_kpi_evidence` | S2 | `user_kpi_evidence_tenant_id`: un solo valore distinto su 248 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_user_kpi_evidence` | C1 | `user_kpi_evidence_period_start`: giorno del mese «01» concentra 100% delle 248 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_user_kpi_evidence` | C1 | `user_kpi_evidence_period_start`: mese «01» concentra 100% delle 248 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_user_kpi_evidence` | C1 | `user_kpi_evidence_recorded_at`: giorno del mese «07» concentra 33% delle 248 date | E' l'esito della riparazione C12: la misura di un esercizio ANNUALE si registra alla chiusura del periodo, quindi a gennaio. La concentrazione sul mese e' voluta; quella sul singolo GIORNO e' sparita (era 100%, ora ~35% distribuito su tre settimane). |
| `sys_user_kpi_evidence` | C1 | `user_kpi_evidence_recorded_at`: mese «01» concentra 100% delle 248 date | E' l'esito della riparazione C12: la misura di un esercizio ANNUALE si registra alla chiusura del periodo, quindi a gennaio. La concentrazione sul mese e' voluta; quella sul singolo GIORNO e' sparita (era 100%, ora ~35% distribuito su tre settimane). |
| `sys_user_learning_assignments` | S2 | `user_learning_assignment_tenant_id`: un solo valore distinto su 3061 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_user_pay_slips` | C1 | `user_pay_slip_period_start`: giorno del mese «01» concentra 100% delle 5641 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_user_professional_experiences` | S2 | `user_prof_exp_tenant_id`: un solo valore distinto su 255 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_user_skill_evidence` | S2 | `user_skill_evidence_tenant_id`: un solo valore distinto su 902 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_user_skill_evidence` | S1 | `user_skill_evidence_comment`: colonna interamente NULL su 902 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_user_skills` | S2 | `user_skill_tenant_id`: un solo valore distinto su 1355 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_user_skills` | S1 | `user_skill_notes`: colonna interamente NULL su 1355 righe | Campo descrittivo LIBERO: si compila quando chi lavora ha qualcosa da aggiungere, e nella maggior parte dei casi non ce l'ha. Vuoto e' lo stato normale, non un dato mancante. |
| `sys_user_target_positions` | S2 | `user_target_position_tenant_id`: un solo valore distinto su 164 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_variable_pay_calculations` | S2 | `variable_pay_calculation_tenant_id`: un solo valore distinto su 182 righe | Un solo tenant per tabella e' l'atteso: i dati di questo perimetro sono di RTL Bank. E' l'isolamento fra clienti che funziona, non varianza mancante. |
| `sys_variable_pay_calculations` | C1 | `variable_pay_calculation_period_start`: giorno del mese «01» concentra 100% delle 182 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_variable_pay_calculations` | C1 | `variable_pay_calculation_period_start`: mese «01» concentra 71% delle 182 date | Delimitatore di PERIODO, non un fatto puntuale: un esercizio annuale inizia il 1 gennaio e finisce il 31 dicembre per tutti. La concentrazione E' il calendario. |
| `sys_visualization_graphs` | S1 | `graph_source_query`: colonna interamente NULL su 1 righe | Aggancio a un sistema ESTERNO non ancora collegato (nessuna integrazione attiva oggi). Si valorizzera' quando l'integrazione esistera'. |

## Tabelle vuote (regola V1)

| tabella | perché è vuota |
|---|---|
| `sys_activity_classification_mappings` | Il crosswalk fra classificazioni delle attivita' non e' derivabile per calcolo (C11): una sola classificazione e' caricata, e la scorciatoia strutturale mapperebbe il mestiere sbagliato. Richiede la tavola ufficiale ISTAT importata, non dedotta. |
| `sys_auth_mfa_exemption_audit` | Conseguenza della precedente: nessuna esenzione concessa, quindi nessuna modifica di esenzione da tracciare. |
| `sys_auth_mfa_exemptions` | Tabella di eccezione: e' vuota perche' nessuna esenzione dal secondo fattore e' stata concessa. Lo stato corretto di un registro di deroghe senza deroghe e' zero righe. |
| `sys_auth_mfa_otp_challenges` | Gate dichiarato nel piano (#77) e nel register: le sfide OTP via email restano vuote finche' non arriva la credenziale di posta (#8, WAIT-INPUT). Il trasporto e' pronto, manca solo l'input di Enzo. |
| `sys_auth_mfa_recovery_codes` | I codici di recupero sono CREDENZIALI: popolarli con valori inventati creerebbe segreti falsi in un ambiente trattato come produzione (decisione C10). |
| `sys_auth_sessions` | Tabella MORTA, verificata al C10: il prodotto non la usa (le sessioni vere sono i token di rinnovo, `sys_auth_refresh_tokens`). Le 71 righe scritte per sbaglio sono state RIMOSSE anziche' derogate — una deroga serve per dati legittimi non ancora esposti, non per dati che non dovevano esserci. |
| `sys_content_media` | Allegare file ai documenti significherebbe inventarli (C9): i 10 documenti pubblicati hanno testo e revisioni reali, ma non esiste un allegato binario che non sia finto. |
| `sys_notification_preferences` | Le preferenze di notifica sono SCELTE PERSONALI di ciascuno, non storia dell'azienda (C7): precompilarle significherebbe attribuire alle persone decisioni che non hanno preso. Restano vuote finche' un utente vero non le imposta (il default e' nel codice). |
| `sys_occupation_classification_mappings` | Stesso motivo del precedente (C11): CP2021 e ISCO-08 non si mappano togliendo i punti dal codice — la CP mette le Forze Armate al grande gruppo 9 e la ISCO allo 0, e 4 grandi gruppi su 9 finirebbero sul mestiere sbagliato. |
| `sys_process_kpi_templates` | Gate EXCLUDE gia' in vigore (S970/S994), rispettato dal C7: i template KPI di processo sono esclusi dal perimetro di popolamento. |

## Verbale per tabella

Esito di ogni tabella del perimetro, con le regole effettivamente eseguite su di essa.

| tabella | righe | regole eseguite | esito |
|---|---|---|---|
| `sys_activity_classification_mappings` | 0 | V1 | vuota → V1 |
| `sys_activity_classifications` | 3.257 | N2 S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_approval_requests` | 642 | C1 D1 D2 N2 S1 S2 X1 | **1 aperti** · 3 spiegati |
| `sys_approval_steps` | 751 | C1 D1 D2 N2 S1 S2 X1 | **2 aperti** · 2 spiegati |
| `sys_assessment_methods` | 5 | S1 X1 | verde (1 spiegati) |
| `sys_assessment_results` | 1.560 | C1 D1 D2 N2 S1 S2 X1 | **2 aperti** · 2 spiegati |
| `sys_assessments` | 615 | D1 D2 D3 S1 S2 X1 | **2 aperti** · 1 spiegati |
| `sys_attendance` | 116.015 | D1 D2 N2 S1 S2 | **5 aperti** · 3 spiegati |
| `sys_auth_credentials` | 496 | C1 D1 D2 S1 S2 X1 | **2 aperti** · 1 spiegati |
| `sys_auth_identities` | 160 | S1 S2 X1 | **1 aperti** |
| `sys_auth_login_events` | 92.913 | S1 X1 | verde |
| `sys_auth_mfa_exemption_audit` | 0 | V1 | vuota → V1 |
| `sys_auth_mfa_exemptions` | 0 | V1 | vuota → V1 |
| `sys_auth_mfa_factors` | 180 | D1 D2 S1 X1 | verde |
| `sys_auth_mfa_otp_challenges` | 0 | V1 | vuota → V1 |
| `sys_auth_mfa_policies` | 2 | S1 X1 | verde (1 spiegati) |
| `sys_auth_mfa_recovery_codes` | 0 | V1 | vuota → V1 |
| `sys_auth_mfa_webauthn_credentials` | 6 | D1 D2 N2 S1 X1 | verde (1 spiegati) |
| `sys_auth_password_reset_tokens` | 27 | D1 D2 S1 S2 X1 | **3 aperti** |
| `sys_auth_permissions` | 204 | S1 X1 | verde |
| `sys_auth_refresh_tokens` | 6.963 | C1 D1 D2 D3 S1 X1 | **4 aperti** · 2 spiegati |
| `sys_auth_role_permissions` | 908 | C1 D1 D2 S1 X1 | **2 aperti** |
| `sys_auth_roles` | 13 | S1 X1 | verde |
| `sys_auth_sessions` | 0 | V1 | vuota → V1 |
| `sys_behavioral_assessments` | 465 | C1 D1 D2 N2 S1 S2 X1 | **1 aperti** · 3 spiegati |
| `sys_blueprint_activations` | 1 | D1 D2 D3 S1 X1 | **1 aperti** |
| `sys_blueprint_families` | 1 | S1 X1 | verde |
| `sys_blueprint_overrides` | 7 | S1 X1 | verde |
| `sys_blueprint_process_registry` | 23 | S1 S2 X1 | **2 aperti** · 1 spiegati |
| `sys_blueprint_variants` | 1 | S1 X1 | verde (1 spiegati) |
| `sys_bonus_pools` | 6 | D1 D2 D3 N2 S1 X1 | **1 aperti** |
| `sys_branches` | 6 | S1 X1 | **2 aperti** |
| `sys_capability_maturity_scores` | 20 | D1 D2 N2 S1 S2 X1 | **3 aperti** · 2 spiegati |
| `sys_capability_score_lineage` | 316 | C1 D1 D2 N2 S1 S2 X1 | **1 aperti** · 3 spiegati |
| `sys_capability_scores` | 317 | C1 D1 D2 N1 N2 S1 S2 X1 | **2 aperti** · 4 spiegati |
| `sys_career_path_steps` | 35 | N2 S1 S2 X1 | **1 aperti** |
| `sys_career_paths` | 7 | S1 X1 | verde |
| `sys_compensation_bands` | 87 | N2 S1 X1 | verde |
| `sys_compensation_recommendations` | 116 | C1 D1 D2 D3 N2 S1 S2 X1 | **2 aperti** · 4 spiegati |
| `sys_content_blueprint_links` | 1 | S1 X1 | verde (1 spiegati) |
| `sys_content_categories` | 6 | S1 X1 | **1 aperti** |
| `sys_content_documents` | 175 | C1 D1 D2 S1 S2 X1 | **3 aperti** · 2 spiegati |
| `sys_content_media` | 0 | V1 | vuota → V1 |
| `sys_content_versions` | 204 | N2 S1 S2 X1 | **2 aperti** · 1 spiegati |
| `sys_continuous_feedback` | 474 | D1 D2 N2 S1 S2 X1 | **3 aperti** · 2 spiegati |
| `sys_critical_positions` | 8 | D1 D2 S1 X1 | **1 aperti** · 1 spiegati |
| `sys_critical_role_coverage_status` | 8 | D1 D2 N1 N2 S1 X1 | verde |
| `sys_employee_position_fit_scores` | 146 | C1 D1 D2 N2 S1 S2 X1 | **1 aperti** · 3 spiegati |
| `sys_engagement_action_plans` | 8 | D1 D2 S1 X1 | verde |
| `sys_engagement_feedback` | 400 | C1 D1 D2 S1 S2 X1 | verde (1 spiegati) |
| `sys_engagement_survey_responses` | 862 | C1 D1 D2 S1 S2 X1 | verde (1 spiegati) |
| `sys_engagement_survey_templates` | 5 | S1 X1 | **1 aperti** |
| `sys_engagement_surveys` | 6 | D1 D2 D3 N2 S1 X1 | **1 aperti** |
| `sys_enterprise_size_bands` | 5 | S1 X1 | **2 aperti** · 1 spiegati |
| `sys_enterprise_typing_profiles` | 2 | D1 D2 N2 S1 X1 | **1 aperti** |
| `sys_esco_occupation_embeddings` | 3.045 | S1 S2 X1 | **1 aperti** |
| `sys_esco_occupation_mappings` | 7.675 | S1 X1 | verde |
| `sys_feedback_360_responses` | 776 | C1 D1 D2 N2 S1 S2 X1 | **2 aperti** · 3 spiegati |
| `sys_flight_risk_scores` | 162 | C1 D1 D2 N2 S1 S2 X1 | **1 aperti** · 3 spiegati |
| `sys_gap_analysis_results` | 158 | C1 D1 D2 N2 S1 S2 X1 | **2 aperti** · 3 spiegati |
| `sys_gap_closure_actions` | 440 | D2 S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_gap_closure_plans` | 36 | D2 S1 S2 X1 | **2 aperti** · 1 spiegati |
| `sys_gdpr_data_map` | 54 | N2 S1 S2 X1 | **1 aperti** |
| `sys_gdpr_requests` | 5 | S1 X1 | verde |
| `sys_goal_alignments` | 100 | N2 S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_goal_check_ins` | 7.567 | C1 D1 D2 N1 N2 S1 S2 X1 | verde (1 spiegati) |
| `sys_goal_comments` | 849 | S1 S2 X1 | **2 aperti** · 1 spiegati |
| `sys_goal_milestones` | 1.000 | C1 D1 D2 N2 S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_goal_templates` | 40 | D1 D2 N2 S1 S2 X1 | **5 aperti** · 2 spiegati |
| `sys_goal_updates` | 1.798 | N1 S1 S2 X1 | **2 aperti** · 1 spiegati |
| `sys_goals` | 2.624 | C1 D1 D2 N1 N2 S1 S2 X1 | **5 aperti** · 5 spiegati |
| `sys_inbox_notifications` | 76 | D1 D2 S1 S2 X1 | **3 aperti** · 2 spiegati |
| `sys_job_families` | 27 | S1 S2 X1 | **1 aperti** |
| `sys_job_role_embeddings` | 137 | S1 S2 X1 | **1 aperti** |
| `sys_job_roles` | 137 | S1 X1 | verde |
| `sys_kpi_assessment_methods` | 5 | S1 X1 | verde (1 spiegati) |
| `sys_kpi_assessment_results` | 248 | C1 D1 D2 D3 N2 S1 S2 X1 | **2 aperti** · 4 spiegati |
| `sys_kpi_definitions` | 243 | S1 X1 | **2 aperti** |
| `sys_kpi_measurements` | 248 | C1 D1 D2 D3 S1 S2 X1 | **3 aperti** · 5 spiegati |
| `sys_kpi_metric_definitions` | 243 | S1 S2 X1 | **1 aperti** |
| `sys_kpi_targets` | 301 | D2 D3 S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_kpi_weighting_rules` | 3 | S1 X1 | verde (1 spiegati) |
| `sys_leads` | 6 | D1 D2 S1 X1 | verde |
| `sys_learning_gaps` | 270 | C1 D1 D2 N2 S1 S2 X1 | **4 aperti** · 1 spiegati |
| `sys_learning_modules` | 1.002 | N2 S1 S2 X1 | **1 aperti** |
| `sys_learning_path_steps` | 124 | N2 S1 S2 X1 | verde (1 spiegati) |
| `sys_learning_paths` | 4.667 | S1 X1 | **1 aperti** |
| `sys_leave_accrual_rules` | 20 | D1 D2 N2 S1 S2 X1 | **4 aperti** · 1 spiegati |
| `sys_leave_balance_transactions` | 20 | N2 S1 S2 X1 | **3 aperti** · 2 spiegati |
| `sys_mentor_match_scores` | 30 | D2 N2 S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_mentorship_programs` | 5 | D1 D2 D3 N2 S1 X1 | **1 aperti** |
| `sys_mentorship_sessions` | 150 | C1 D1 D2 N2 S1 S2 X1 | verde (1 spiegati) |
| `sys_mentorships` | 63 | C1 D1 D2 D3 N2 S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_model_predictions` | 468 | C1 D1 D2 S1 S2 X1 | **1 aperti** · 3 spiegati |
| `sys_notification_preferences` | 0 | V1 | vuota → V1 |
| `sys_objective_reward_rules` | 6 | S1 X1 | verde |
| `sys_occupation_classification_mappings` | 0 | V1 | vuota → V1 |
| `sys_occupation_classifications` | 2.121 | N2 S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_occupation_skill_requirements` | 126.051 | S1 | verde |
| `sys_okr_check_ins` | 25 | D1 D2 N1 N2 S1 S2 X1 | **3 aperti** · 1 spiegati |
| `sys_okr_key_results` | 20 | D1 D2 N1 N2 S1 S2 X1 | **3 aperti** · 1 spiegati |
| `sys_okrs` | 20 | D1 D2 D3 N1 N2 S1 S2 X1 | **9 aperti** · 3 spiegati |
| `sys_operating_model_catalog` | 6 | S1 X1 | verde (1 spiegati) |
| `sys_organization_unit_history` | 6 | D1 D2 S1 X1 | verde |
| `sys_organization_unit_kpi_templates` | 100 | N2 S1 S2 X1 | **3 aperti** |
| `sys_organization_unit_processes` | 105 | S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_organization_unit_templates` | 225 | N2 S1 X1 | verde |
| `sys_organization_unit_types` | 8 | S1 X1 | verde (1 spiegati) |
| `sys_organization_units` | 28 | D1 D2 D3 S1 X1 | **1 aperti** |
| `sys_overtime` | 178 | C1 D1 D2 N2 S1 S2 X1 | **6 aperti** · 1 spiegati |
| `sys_payout_curves` | 3 | S1 X1 | verde |
| `sys_payroll_handoff_records` | 36 | C1 D1 D2 D3 S1 S2 X1 | **2 aperti** · 2 spiegati |
| `sys_performance_review_competency_ratings` | 1.644 | N2 S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_performance_reviews` | 550 | C1 D1 D2 D3 N2 S1 S2 X1 | **17 aperti** · 9 spiegati |
| `sys_person_evidence_records` | 237 | C1 D1 D2 S1 S2 X1 | **4 aperti** · 1 spiegati |
| `sys_position_career_paths` | 252 | S1 S2 X1 | verde (1 spiegati) |
| `sys_position_compensation_profiles` | 172 | N2 S1 X1 | verde |
| `sys_position_economic_weight` | 24 | D1 D2 D3 N2 S1 S2 X1 | **2 aperti** · 1 spiegati |
| `sys_position_kpi_requirements` | 172 | N2 S1 S2 X1 | **3 aperti** · 1 spiegati |
| `sys_position_learning_requirements` | 1.791 | S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_position_skill_requirement_history` | 211 | C1 D1 D2 N2 S1 S2 X1 | **2 aperti** · 2 spiegati |
| `sys_position_skill_requirements` | 1.678 | N2 S1 S2 X1 | verde (1 spiegati) |
| `sys_position_succession_relevance` | 17 | S1 X1 | verde |
| `sys_positions` | 181 | C1 D1 D2 D3 S1 S2 X1 | **4 aperti** |
| `sys_predictive_models` | 4 | S1 X1 | verde |
| `sys_process_kpi_templates` | 0 | V1 | vuota → V1 |
| `sys_process_participants` | 1.104 | S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_pulse_checks` | 2.834 | C1 D1 D2 N2 S1 X1 | **1 aperti** |
| `sys_readiness_scores` | 90 | C1 D1 D2 N2 S1 S2 X1 | **1 aperti** · 2 spiegati |
| `sys_reconciliation_registry` | 125 | C1 D1 D2 S1 X1 | **2 aperti** |
| `sys_reference_translations` | 32.426 | S1 S2 X1 | **1 aperti** |
| `sys_reward_gate_catalog` | 7 | S1 X1 | verde |
| `sys_reward_gate_results` | 3.283 | C1 D1 D2 N2 S1 S2 X1 | **2 aperti** · 1 spiegati |
| `sys_reward_gates` | 3.283 | C1 D1 D2 D3 S1 S2 X1 | **2 aperti** · 3 spiegati |
| `sys_schema_migrations` | 215 | C1 D1 D2 N2 S1 X1 | **2 aperti** |
| `sys_seed_acquisition_runs` | 12 | D1 D2 S1 X1 | verde |
| `sys_seed_approval_decisions` | 12 | D1 D2 S1 X1 | verde |
| `sys_seed_candidate_records` | 12 | S1 X1 | verde |
| `sys_seed_source_evidence` | 12 | D1 D2 S1 X1 | verde |
| `sys_seed_validation_results` | 36 | S1 S2 X1 | verde (1 spiegati) |
| `sys_skill_aliases` | 80 | S1 S2 X1 | **1 aperti** |
| `sys_skill_categories` | 7 | S1 X1 | **1 aperti** |
| `sys_skill_embeddings` | 14.041 | S1 S2 X1 | **1 aperti** |
| `sys_skill_families` | 77 | S1 X1 | verde |
| `sys_skill_gap_scores` | 156 | C1 D1 D2 N2 S1 S2 X1 | **1 aperti** · 4 spiegati |
| `sys_skill_groups` | 640 | S1 X1 | verde |
| `sys_skill_learning_mappings` | 685 | S1 X1 | verde |
| `sys_skill_proficiency_levels` | 6 | N2 S1 X1 | verde (1 spiegati) |
| `sys_skill_taxonomy_edges` | 18.420 | S1 X1 | verde |
| `sys_skills` | 14.041 | S1 X1 | verde |
| `sys_source_lineage_records` | 70.972 | S1 S2 X1 | verde (2 spiegati) |
| `sys_succession_pools` | 17 | S1 X1 | verde (1 spiegati) |
| `sys_succession_readiness_scores` | 468 | C1 D1 D2 N2 S1 S2 X1 | **1 aperti** · 4 spiegati |
| `sys_succession_scores` | 90 | C1 D1 D2 N2 S1 S2 X1 | **1 aperti** · 2 spiegati |
| `sys_successor_candidates` | 28 | S1 S2 X1 | verde (1 spiegati) |
| `sys_successor_readiness` | 79 | C1 D1 D2 N2 S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_survey_assignments` | 948 | C1 D1 D2 S1 S2 X1 | verde (4 spiegati) |
| `sys_survey_questions` | 69 | S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_survey_responses` | 8.288 | N2 S1 S2 X1 | **2 aperti** · 1 spiegati |
| `sys_survey_templates` | 2 | S1 X1 | verde |
| `sys_surveys` | 14 | D1 D2 D3 N2 S1 X1 | verde |
| `sys_talent_scores` | 154 | C1 D1 D2 N2 S1 S2 X1 | **1 aperti** · 2 spiegati |
| `sys_team_members` | 173 | S1 X1 | verde |
| `sys_teams` | 26 | S1 X1 | verde |
| `sys_tenancies` | 2 | S1 X1 | verde |
| `sys_time_off_balances` | 1.886 | D2 N2 S1 S2 X1 | **4 aperti** · 1 spiegati |
| `sys_time_off_requests` | 2.078 | C1 D1 D2 D3 N2 S1 S2 X1 | **2 aperti** · 3 spiegati |
| `sys_training_initiatives` | 62 | C1 D1 D2 D3 N2 S1 S2 X1 | **2 aperti** · 1 spiegati |
| `sys_translatable_field` | 25 | S1 S2 X1 | verde (1 spiegati) |
| `sys_ui_interfaces` | 55 | S1 X1 | verde |
| `sys_user_addresses` | 171 | S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_user_assessment_evidence` | 1.560 | C1 D1 D2 N2 S1 S2 X1 | **1 aperti** · 2 spiegati |
| `sys_user_auth_roles` | 340 | C1 D1 D2 S1 X1 | **2 aperti** · 1 spiegati |
| `sys_user_bank_details` | 156 | S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_user_career_plans` | 113 | S1 S2 X1 | **2 aperti** · 1 spiegati |
| `sys_user_certifications` | 916 | C1 D1 D2 D3 S1 X1 | **2 aperti** |
| `sys_user_consents` | 641 | C1 D1 D2 S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_user_contracts` | 160 | C1 D1 D2 D3 N2 S1 S2 X1 | **7 aperti** · 3 spiegati |
| `sys_user_demographics` | 161 | C1 D1 D2 S1 S2 X1 | **1 aperti** |
| `sys_user_documents` | 657 | S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_user_education_records` | 160 | C1 D1 D2 D3 S1 X1 | **3 aperti** |
| `sys_user_employment` | 161 | C1 D1 D2 D3 N1 N2 S1 S2 X1 | **3 aperti** · 2 spiegati |
| `sys_user_family_members` | 150 | C1 D1 D2 S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_user_identity_documents` | 332 | D2 S1 S2 X1 | **1 aperti** |
| `sys_user_kpi_evidence` | 248 | C1 D1 D2 D3 S1 S2 X1 | **1 aperti** · 5 spiegati |
| `sys_user_learning_assignments` | 3.061 | D2 S1 S2 X1 | verde (1 spiegati) |
| `sys_user_learning_evidence` | 3.868 | C1 D1 D2 N2 S1 X1 | **1 aperti** |
| `sys_user_pay_slips` | 5.641 | C1 D1 D2 D3 N2 S1 X1 | **1 aperti** · 1 spiegati |
| `sys_user_position_assignments` | 196 | C1 D1 D2 D3 S1 S2 X1 | **2 aperti** |
| `sys_user_preferences` | 6 | S1 X1 | verde |
| `sys_user_professional_experiences` | 255 | C1 D1 D2 D3 S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_user_profile_embeddings` | 156 | N2 S1 S2 X1 | **2 aperti** |
| `sys_user_profiles` | 157 | S1 S2 X1 | **3 aperti** |
| `sys_user_skill_evidence` | 902 | C1 D1 D2 N2 S1 S2 X1 | **1 aperti** · 2 spiegati |
| `sys_user_skills` | 1.355 | C1 D1 D2 S1 S2 X1 | **1 aperti** · 2 spiegati |
| `sys_user_target_positions` | 164 | S1 S2 X1 | **1 aperti** · 1 spiegati |
| `sys_users` | 163 | S1 S2 X1 | **1 aperti** |
| `sys_variable_pay_calculations` | 182 | C1 D1 D2 D3 N2 S1 S2 X1 | **3 aperti** · 3 spiegati |
| `sys_visualization_edges` | 157 | S1 S2 X1 | **4 aperti** |
| `sys_visualization_exports` | 3 | D1 D2 S1 X1 | verde |
| `sys_visualization_graphs` | 1 | S1 X1 | verde (1 spiegati) |
| `sys_visualization_layouts` | 1 | S1 X1 | verde |
| `sys_visualization_node_layouts` | 158 | S1 S2 X1 | **2 aperti** |
| `sys_visualization_nodes` | 158 | S1 S2 X1 | **3 aperti** |
| `sys_visualization_styles` | 3 | S1 X1 | verde |
| `sys_whistleblowing_reports` | 2 | S1 X1 | **1 aperti** |

