# ATLAS — mappa cross-layer heuresys-advanced (GENERATO)

> Generato da `docs/kb/tools/build_atlas.py` @ commit `115d7983` (2026-07-05T17:03:06+02:00). **Non editare a mano** — la sintesi curata vive in `ATLAS_CURATED.md`. Ruolo SoT: atlas = SoT interrogabile; graphify-out/ e wiki-graph = viste esplorative parallele, mai autoritative.

## Conteggi

| Layer | Valore |
|---|---|
| Moduli API | 83 |
| Route API | 468 |
| Pagine web | 101 |
| Schemi shared | 87 |
| Tabelle DB | 276 (vuote: 67) |
| Viste / matview | 12 / 0 |
| Endpoint API senza consumer web (server-side/CLI/ESS-fetch indiretto) | 196 |

## Moduli API

| Modulo | Prefix | Route | Permessi | Tabelle | Test |
|---|---|---|---|---|---|
| activity-classification-mappings | /v1/activity-classification-mappings | 4 | 3 | 2 | 1 |
| activity-classifications | /v1/activity-classifications | 5 | 3 | 1 | 1 |
| analytics | /v1/analytics | 10 | 1 | 13 | 3 |
| approvals | /v1/approvals | 5 | 3 | 4 | 3 |
| assessment-methods | /v1/assessment-methods | 1 | 1 | 1 | 1 |
| assessment-results | /v1/assessment-results | 3 | 2 | 2 | 2 |
| assessments | /v1/assessments | 4 | 3 | 2 | 2 |
| auth | /v1/auth, /v1/auth/mfa | 31 | 1 | 16 | 7 |
| blueprint-activations | /v1/blueprint-activations | 5 | 2 | 2 | 1 |
| blueprint-families | /v1/blueprint-families | 5 | 3 | 2 | 1 |
| blueprint-overrides | /v1/blueprint-overrides | 4 | 2 | 3 | 1 |
| blueprint-processes | /v1/blueprint-processes | 5 | 3 | 2 | 1 |
| blueprint-variants | /v1/blueprint-variants | 5 | 3 | 3 | 1 |
| brownfield-import-runs | /v1/brownfield-import-runs | 4 | 2 | 1 | 1 |
| brownfield-source-exports | /v1/brownfield-source-exports | 2 | 1 | 1 | 1 |
| brownfield-table-mappings | /v1/brownfield-table-mappings | 3 | 2 | 1 | 1 |
| brownfield-wave-executor | /v1/brownfield/wave-executor | 5 | 2 | 14 | 1 |
| capability-composition | /v1/capability | 3 | 2 | 10 | 2 |
| capability-maturity | /v1/capability | 3 | 2 | 8 | 2 |
| career-path-steps | /v1/career-path-steps | 5 | 3 | 3 | 1 |
| career-paths | /v1/career-paths | 5 | 3 | 2 | 2 |
| compensation | /v1/compensation | 5 | 2 | 9 | 2 |
| content | /v1/content | 20 | 5 | 4 | 5 |
| content-blueprint-links | /v1/content-blueprint-links | 5 | 3 | 4 | 1 |
| dashboard | /v1/dashboard | 1 | 1 | 11 | 1 |
| engagement | /v1/engagement | 4 | 1 | 5 | 2 |
| engagement-feedback | /v1/engagement-feedback | 10 | 4 | 2 | 1 |
| enterprise-size-bands | /v1/enterprise-size-bands | 4 | 2 | 1 | 1 |
| enterprise-typing-profiles | /v1/enterprise-typing-profiles | 4 | 2 | 1 | 1 |
| goals | /v1/goals | 5 | 4 | 1 | 2 |
| insights | /v1/insights | 7 | 2 | 13 | 4 |
| job-families | /v1/job-families | 5 | 0 | 1 | 2 |
| job-roles | /v1/job-roles | 4 | 3 | 2 | 1 |
| kpi-definitions | /v1/kpi-definitions | 5 | 4 | 1 | 1 |
| leads | /v1/leads | 2 | 1 | 1 | 1 |
| learning-gaps | /v1/learning-gaps | 5 | 3 | 4 | 2 |
| learning-modules | /v1/learning-modules | 5 | 4 | 1 | 1 |
| learning-path-steps | /v1/learning-path-steps | 5 | 4 | 3 | 1 |
| learning-paths | /v1/learning-paths | 5 | 4 | 2 | 1 |
| me | /v1/me | 44 | 25 | 45 | 26 |
| mentorship | /v1/mentorship | 17 | 4 | 4 | 3 |
| mfa-policy | /v1/mfa-policy | 2 | 2 | 2 | 1 |
| notifications | /v1/notifications | 1 | 1 | 1 | 0 |
| observability | /v1/observability | 1 | 1 | 5 | 1 |
| okrs | /v1/okrs | 6 | 4 | 2 | 2 |
| operating-models | /v1/operating-models | 4 | 2 | 1 | 1 |
| organization-unit-kpi-templates | /v1/organization-unit-kpi-templates | 4 | 2 | 3 | 1 |
| organization-unit-processes | /v1/organization-unit-processes | 4 | 3 | 4 | 2 |
| organization-units | /v1/organization-units | 5 | 4 | 1 | 1 |
| position-career-paths | /v1/position-career-paths | 4 | 3 | 3 | 1 |
| position-succession-relevance | /v1/position-succession-relevance | 4 | 2 | 2 | 1 |
| positions | /v1/positions | 13 | 4 | 6 | 1 |
| predictions | /v1/predictions | 4 | 1 | 2 | 2 |
| process-kpi-templates | /v1/process-kpi-templates | 4 | 2 | 3 | 1 |
| public-stats | /v1/public | 1 | 0 | 11 | 1 |
| reference-sync | /v1/reference-sync | 4 | 2 | 6 | 2 |
| seed-acquisition-runs | /v1/seed-acquisition-runs | 5 | 2 | 1 | 1 |
| seed-approval-decisions | /v1/seed-approval-decisions | 3 | 2 | 2 | 1 |
| seed-candidate-records | /v1/seed-candidate-records | 2 | 1 | 1 | 1 |
| semantic-matching | /v1/matching | 10 | 2 | 10 | 4 |
| skill-aliases | /v1/skill-aliases | 5 | 2 | 2 | 1 |
| skill-categories | /v1/skill-categories | 5 | 2 | 3 | 1 |
| skill-families | /v1/skill-families | 5 | 2 | 2 | 1 |
| skill-proficiency-levels | /v1/skill-proficiency-levels | 1 | 0 | 1 | 1 |
| skill-taxonomy-edges | /v1/skill-taxonomy-edges | 4 | 2 | 2 | 1 |
| skills | /v1/skills | 4 | 3 | 1 | 1 |
| succession-pools | /v1/succession-pools | 5 | 3 | 4 | 2 |
| successor-candidates | /v1/successor-candidates | 6 | 3 | 3 | 2 |
| successor-readiness | /v1/successor-readiness | 3 | 2 | 2 | 2 |
| surveys | /v1/surveys | 12 | 4 | 3 | 2 |
| teams | /v1/teams | 2 | 2 | 3 | 1 |
| tenant-materialization | /v1/tenant-materialization | 2 | 0 | 10 | 1 |
| tenants | /v1/tenants | 5 | 4 | 1 | 1 |
| training-initiatives | /v1/training-initiatives | 4 | 4 | 3 | 1 |
| user-career-plans | /v1/user-career-plans | 5 | 3 | 4 | 2 |
| users | /v1/users | 8 | 5 | 3 | 1 |
| visualization-edges | /v1/visualization-edges | 4 | 3 | 3 | 1 |
| visualization-exports | /v1/visualization-exports | 3 | 2 | 2 | 1 |
| visualization-graphs | /v1/visualization-graphs | 7 | 3 | 3 | 1 |
| visualization-layouts | /v1/visualization-layouts | 5 | 3 | 2 | 1 |
| visualization-node-layouts | /v1/visualization-node-layouts | 4 | 2 | 4 | 1 |
| visualization-nodes | /v1/visualization-nodes | 5 | 3 | 2 | 1 |
| visualization-styles | /v1/visualization-styles | 4 | 3 | 2 | 1 |

## Pagine web per zona

- **admin** (53): /admin/mfa-policy · /admin/roles · /analytics/attendance · /analytics/compensation · /analytics/kpi · /analytics/org-network · /analytics/overtime · /analytics/skills · /analytics/skills-by-category · /analytics/skills-group-share · /analytics/workforce · /approvals · /approvals/[id] · /blueprints · /blueprints/[variantId] · /brownfield-adaptation · /career-succession · /compensation-intelligence · /content · /content/[id] · /dashboard · /dev/agent · /engagement · /engagement/[surveyId] · /gaps · /goals · /insights · /insights/skill-gap · /insights/succession-readiness · /kpis · /learning · /learning/training-initiatives · /okrs · /org-director · /organization · /organization/org-chart · /positions · /positions/[positionId] · /positions/[positionId]/kpis · /positions/[positionId]/learning · /positions/[positionId]/skills · /process-owner · /processes · /seed-acquisition/runs · /skills · /system-health · /tenants · /tenants/[tenantId] · /tenants/[tenantId]/enterprise-typing · /users · /users/[userId] · /visualizations · /visualizations/[graphId]
- **me** (24): /me · /me/analytics · /me/approvals · /me/career · /me/career/target · /me/certifications · /me/documents · /me/gaps · /me/handbook · /me/handbook/[id] · /me/inbox · /me/kpis · /me/learning · /me/learning/catalogue · /me/matching · /me/org-chart · /me/positions · /me/profile · /me/security · /me/skills · /me/skills/self-assessment · /me/surveys · /me/surveys/[surveyId] · /me/team
- **public** (6): / · /app · /demo · /investors · /login · /privacy
- **showcase** (18): /showcase · /showcase/charts · /showcase/dashboard-cards · /showcase/footer · /showcase/forms · /showcase/header · /showcase/icons · /showcase/landing-page · /showcase/login-page · /showcase/logo · /showcase/page-types · /showcase/palettes · /showcase/primary-initial-page · /showcase/shell · /showcase/sidebar · /showcase/system-health · /showcase/tables · /showcase/typography

## Tabelle DB vuote (feature senza dati — candidate brainstorming)

- `audit.user_self_service_actions`
- `staging.legacy_rtl_occupations`
- `staging.rtl_certifications`
- `staging.rtl_employee_attendance`
- `staging.rtl_employee_certifications`
- `staging.rtl_employee_contracts`
- `staging.rtl_employee_skill_assessments`
- `staging.rtl_employee_skill_profiles`
- `staging.rtl_employee_skills`
- `staging.rtl_org_units`
- `staging.rtl_salary_band_assignments`
- `staging.rtl_salary_bands`
- `staging.rtl_tenant_custom_skills`
- `staging.rtl_users`
- `staging.tmp_f4_km`
- `staging.wave1_activity_classification_mappings`
- `staging.wave1_activity_classifications`
- `staging.wave1_blueprint_process_registry`
- `staging.wave1_compensation_bands`
- `staging.wave1_esco_occupation_mappings`
- `staging.wave1_job_families`
- `staging.wave1_job_roles`
- `staging.wave1_learning_modules`
- `staging.wave1_learning_path_steps`
- `staging.wave1_learning_paths`
- `staging.wave1_process_kpi_templates`
- `staging.wave1_skill_aliases`
- `staging.wave1_skill_categories`
- `staging.wave1_skill_families`
- `staging.wave1_skill_learning_mappings`
- `staging.wave1_skill_taxonomy_edges`
- `staging.wave1_skills`
- `staging.wave1_user_certifications`
- `sys.sys_approval_requests`
- `sys.sys_approval_steps`
- `sys.sys_auth_mfa_exemption_audit`
- `sys.sys_auth_mfa_exemptions`
- `sys.sys_auth_mfa_otp_challenges`
- `sys.sys_auth_mfa_recovery_codes`
- `sys.sys_auth_mfa_webauthn_credentials`
- `sys.sys_auth_sessions`
- `sys.sys_blueprint_activations`
- `sys.sys_blueprint_overrides`
- `sys.sys_content_categories`
- `sys.sys_content_media`
- `sys.sys_leads`
- `sys.sys_notification_preferences`
- `sys.sys_organization_hierarchies`
- `sys.sys_organization_unit_history`
- `sys.sys_payout_curves`
- `sys.sys_payroll_handoff_records`
- `sys.sys_position_skill_requirement_history`
- `sys.sys_process_kpi_templates`
- `sys.sys_reward_gate_results`
- `sys.sys_reward_gates`
- `sys.sys_seed_acquisition_runs`
- `sys.sys_seed_approval_decisions`
- `sys.sys_seed_candidate_records`
- `sys.sys_seed_source_evidence`
- `sys.sys_seed_validation_results`
- `sys.sys_successor_readiness`
- `sys.sys_user_professional_experiences`
- `sys.sys_user_target_positions`
- `sys.sys_visualization_exports`
- `sys.sys_visualization_layouts`
- `sys.sys_visualization_node_layouts`
- `sys.sys_visualization_styles`

## Key counts live

- tenants_active: **2**
- users: **162**
- positions: **162**
- org_units: **26**
- roles: **12**
- permissions: **156**
- role_permission_mappings: **698**
- ui_interfaces_active: **41**
- skills: **14093**

## Anomalie shared exports

- schemi senza subpath export: _pagination

## Dettaglio completo

Il dettaglio machine-readable (route con permessi/orgGate/CSRF, tabelle per modulo, endpoint per pagina, rowcount per tabella, cross-join) e' in `atlas.yaml` (stessa dir). Query rapide: `python -c "import yaml"` oppure grep sul file.
