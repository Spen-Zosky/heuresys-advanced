# ATLAS — mappa cross-layer heuresys-advanced (GENERATO)

> Generato da `docs/kb/tools/build_atlas.py` @ commit `81b4b53a` (2026-09-05T17:57:02+02:00). **Non editare a mano** — la sintesi curata vive in `ATLAS_CURATED.md`. Ruolo SoT: atlas = SoT interrogabile; graphify-out/ e wiki-graph = viste esplorative parallele, mai autoritative.

## Conteggi

| Layer | Valore |
|---|---|
| Moduli API | 101 |
| Route API | 617 |
| Pagine web | 120 |
| Schemi shared | 111 |
| Tabelle DB | 290 (vuote: 24) |
| Viste / matview | 40 / 0 |
| Endpoint API senza consumer web (server-side/CLI/ESS-fetch indiretto) | 279 |

## Moduli API

| Modulo | Prefix | Route | Permessi | Tabelle | Test |
|---|---|---|---|---|---|
| activity-classification-mappings | /v1/activity-classification-mappings | 4 | 3 | 2 | 1 |
| activity-classifications | /v1/activity-classifications | 5 | 4 | 1 | 1 |
| advisor | /v1/advisor | 2 | 1 | 1 | 1 |
| analytics | /v1/analytics | 10 | 1 | 13 | 5 |
| approvals | /v1/approvals | 5 | 3 | 4 | 4 |
| assessment-methods | /v1/assessment-methods | 1 | 1 | 1 | 1 |
| assessment-results | /v1/assessment-results | 3 | 2 | 2 | 2 |
| assessments | /v1/assessments | 4 | 3 | 2 | 2 |
| auth | /v1/auth, /v1/auth/mfa | 31 | 3 | 16 | 7 |
| blueprint-activations | /v1/blueprint-activations | 5 | 3 | 2 | 1 |
| blueprint-families | /v1/blueprint-families | 5 | 4 | 2 | 1 |
| blueprint-overrides | /v1/blueprint-overrides | 4 | 3 | 3 | 1 |
| blueprint-processes | /v1/blueprint-processes | 5 | 4 | 2 | 1 |
| blueprint-variants | /v1/blueprint-variants | 5 | 4 | 3 | 1 |
| calibration-sessions | /v1/calibration-sessions | 3 | 1 | 4 | 1 |
| candidates | /v1/candidates | 4 | 2 | 2 | 3 |
| capability-composition | /v1/capability | 5 | 2 | 15 | 2 |
| capability-maturity | /v1/capability | 3 | 2 | 8 | 2 |
| career-path-steps | /v1/career-path-steps | 5 | 4 | 3 | 1 |
| career-paths | /v1/career-paths | 5 | 4 | 2 | 2 |
| compensation | /v1/compensation | 14 | 2 | 14 | 5 |
| content | /v1/content | 20 | 5 | 4 | 5 |
| content-blueprint-links | /v1/content-blueprint-links | 5 | 4 | 4 | 1 |
| dashboard | /v1/dashboard | 4 | 1 | 25 | 4 |
| delegations | /v1/delegations | 4 | 2 | 2 | 1 |
| engagement | /v1/engagement | 4 | 1 | 5 | 2 |
| engagement-feedback | /v1/engagement-feedback | 10 | 4 | 2 | 1 |
| enterprise-size-bands | /v1/enterprise-size-bands | 4 | 3 | 1 | 1 |
| enterprise-typing-profiles | /v1/enterprise-typing-profiles | 4 | 3 | 1 | 1 |
| evidence | /v1/evidence | 2 | 1 | 14 | 2 |
| gdpr | /v1/gdpr | 5 | 4 | 4 | 1 |
| generated-origins | /v1/generated-origins | 2 | 1 | 1 | 1 |
| goals | /v1/goals | 12 | 4 | 7 | 4 |
| insights | /v1/insights | 7 | 2 | 15 | 5 |
| job-families | /v1/job-families | 5 | 3 | 1 | 2 |
| job-postings | /v1/job-postings | 4 | 2 | 2 | 1 |
| job-requisitions | /v1/job-requisitions | 4 | 2 | 2 | 1 |
| job-roles | /v1/job-roles | 4 | 3 | 2 | 1 |
| kpi-definitions | /v1/kpi-definitions | 9 | 4 | 5 | 1 |
| leads | /v1/leads | 3 | 2 | 1 | 1 |
| learning-gaps | /v1/learning-gaps | 9 | 4 | 7 | 4 |
| learning-modules | /v1/learning-modules | 5 | 4 | 1 | 1 |
| learning-path-steps | /v1/learning-path-steps | 5 | 4 | 3 | 1 |
| learning-paths | /v1/learning-paths | 5 | 4 | 2 | 1 |
| me | /v1/me | 65 | 32 | 63 | 40 |
| mentorship | /v1/mentorship | 17 | 4 | 4 | 3 |
| mfa-policy | /v1/mfa-policy | 2 | 2 | 2 | 1 |
| notifications | /v1/notifications | 2 | 1 | 2 | 0 |
| observability | /v1/observability | 3 | 1 | 5 | 2 |
| occupation-classifications | /v1/occupation-classifications | 5 | 4 | 1 | 1 |
| okrs | /v1/okrs | 7 | 4 | 3 | 3 |
| operating-models | /v1/operating-models | 4 | 3 | 1 | 1 |
| org-health | /v1/org-health | 1 | 1 | 11 | 1 |
| organization-unit-history | /v1/organization-unit-history | 3 | 3 | 2 | 1 |
| organization-unit-kpi-templates | /v1/organization-unit-kpi-templates | 4 | 3 | 3 | 1 |
| organization-unit-processes | /v1/organization-unit-processes | 4 | 3 | 4 | 2 |
| organization-units | /v1/organization-units | 5 | 4 | 1 | 1 |
| performance-reviews | /v1/performance-reviews | 2 | 1 | 2 | 2 |
| position-career-paths | /v1/position-career-paths | 4 | 3 | 3 | 1 |
| position-succession-relevance | /v1/position-succession-relevance | 4 | 3 | 2 | 1 |
| positions | /v1/positions | 16 | 4 | 12 | 3 |
| predictions | /v1/predictions | 4 | 1 | 2 | 3 |
| process-kpi-templates | /v1/process-kpi-templates | 4 | 3 | 3 | 1 |
| provenance | /v1/provenance | 2 | 1 | 1 | 1 |
| public-stats | /v1/public | 1 | 0 | 11 | 1 |
| reference-sync | /v1/reference-sync | 4 | 2 | 3 | 2 |
| research | — | 0 | 0 | 20 | 1 |
| review-cycles | /v1/review-cycles | 4 | 2 | 1 | 2 |
| seed-acquisition-runs | /v1/seed-acquisition-runs | 6 | 3 | 1 | 1 |
| seed-approval-decisions | /v1/seed-approval-decisions | 3 | 2 | 2 | 1 |
| seed-candidate-records | /v1/seed-candidate-records | 5 | 2 | 3 | 1 |
| semantic-matching | /v1/matching | 10 | 2 | 10 | 5 |
| skill-aliases | /v1/skill-aliases | 5 | 3 | 2 | 1 |
| skill-categories | /v1/skill-categories | 5 | 3 | 3 | 1 |
| skill-families | /v1/skill-families | 5 | 3 | 2 | 1 |
| skill-proficiency-levels | /v1/skill-proficiency-levels | 1 | 0 | 1 | 1 |
| skill-taxonomy-edges | /v1/skill-taxonomy-edges | 4 | 2 | 2 | 1 |
| skills | /v1/skills | 5 | 3 | 3 | 2 |
| succession-pools | /v1/succession-pools | 5 | 4 | 4 | 2 |
| successor-candidates | /v1/successor-candidates | 6 | 4 | 3 | 2 |
| successor-readiness | /v1/successor-readiness | 3 | 2 | 2 | 2 |
| surveys | /v1/surveys | 12 | 4 | 3 | 4 |
| talent-review | /v1/talent-review | 6 | 1 | 7 | 2 |
| teams | /v1/teams | 6 | 3 | 3 | 1 |
| tenant-blueprints | /v1/tenant-blueprints | 20 | 0 | 13 | 1 |
| tenant-materialization | /v1/tenant-materialization | 2 | 1 | 18 | 1 |
| tenants | /v1/tenants | 7 | 4 | 2 | 1 |
| time-off | /v1/time-off | 3 | 1 | 7 | 2 |
| training-initiatives | /v1/training-initiatives | 4 | 4 | 3 | 1 |
| user-career-plans | /v1/user-career-plans | 5 | 4 | 4 | 2 |
| user-target-positions | /v1/user-target-positions | 6 | 4 | 3 | 1 |
| user-timeline | /v1/user-timeline | 2 | 1 | 1 | 1 |
| users | /v1/users | 10 | 5 | 3 | 1 |
| visualization-edges | /v1/visualization-edges | 4 | 3 | 3 | 1 |
| visualization-exports | /v1/visualization-exports | 4 | 2 | 2 | 1 |
| visualization-graphs | /v1/visualization-graphs | 9 | 4 | 6 | 1 |
| visualization-layouts | /v1/visualization-layouts | 5 | 4 | 2 | 1 |
| visualization-node-layouts | /v1/visualization-node-layouts | 4 | 3 | 4 | 1 |
| visualization-nodes | /v1/visualization-nodes | 5 | 4 | 2 | 1 |
| visualization-styles | /v1/visualization-styles | 4 | 3 | 2 | 1 |
| whistleblowing | /v1/whistleblowing | 5 | 2 | 1 | 2 |

## Pagine web per zona

- **admin** (69): /admin/mfa-policy · /admin/roles · /analytics/attendance · /analytics/compensation · /analytics/kpi · /analytics/org-network · /analytics/overtime · /analytics/skills · /analytics/skills-by-category · /analytics/skills-group-share · /analytics/workforce · /approvals · /approvals/[id] · /blueprints · /blueprints/[variantId] · /career-succession · /compensation-intelligence · /content · /content/[id] · /dashboard · /dashboard/[famiglia] · /dev/agent · /engagement · /engagement/[surveyId] · /gaps · /generated-origins · /goals · /insights · /insights/skill-gap · /insights/succession-readiness · /job-catalog · /kpis · /leads · /learning · /learning/training-initiatives · /okrs · /org-director · /org-director/advisor · /org-director/health · /org-director/vrio · /organization · /organization/org-chart · /performance · /positions · /positions/[positionId] · /positions/[positionId]/kpis · /positions/[positionId]/learning · /positions/[positionId]/skills · /process-owner · /processes · /provenance · /seed-acquisition/runs · /skill-taxonomy · /skills · /system-health · /talent-review · /tenant-blueprints · /tenant-blueprints/[id] · /tenant-blueprints/[id]/versions/[n]/build · /tenant-blueprints/[id]/versions/[n]/diff · /tenants · /tenants/[tenantId] · /tenants/[tenantId]/enterprise-typing · /time-off · /users · /users/[userId] · /visualizations · /visualizations/[graphId] · /whistleblowing-console
- **me** (26): /me · /me/analytics · /me/approvals · /me/career · /me/career/target · /me/certifications · /me/documents · /me/gaps · /me/handbook · /me/handbook/[id] · /me/inbox · /me/kpis · /me/learning · /me/learning/catalogue · /me/matching · /me/org-chart · /me/performance · /me/positions · /me/profile · /me/security · /me/skills · /me/skills/self-assessment · /me/surveys · /me/surveys/[surveyId] · /me/team · /me/time-off
- **public** (7): / · /app · /demo · /investors · /login · /privacy · /whistleblowing
- **showcase** (18): /showcase · /showcase/charts · /showcase/dashboard-cards · /showcase/footer · /showcase/forms · /showcase/header · /showcase/icons · /showcase/landing-page · /showcase/login-page · /showcase/logo · /showcase/page-types · /showcase/palettes · /showcase/primary-initial-page · /showcase/shell · /showcase/sidebar · /showcase/system-health · /showcase/tables · /showcase/typography

## Tabelle DB vuote (feature senza dati — candidate brainstorming)

- `audit.user_self_service_actions`
- `staging.mig349_esco_consolidamento_undo`
- `sys.sys_auth_mfa_otp_challenges`
- `sys.sys_auth_mfa_recovery_codes`
- `sys.sys_auth_mfa_webauthn_credentials`
- `sys.sys_auth_password_reset_tokens`
- `sys.sys_auth_sessions`
- `sys.sys_blueprint_content_kpis`
- `sys.sys_blueprint_content_positions`
- `sys.sys_blueprint_content_skills`
- `sys.sys_blueprint_content_units`
- `sys.sys_candidate_applications`
- `sys.sys_candidates`
- `sys.sys_content_media`
- `sys.sys_generated_record_origins`
- `sys.sys_interview_feedback`
- `sys.sys_interviews`
- `sys.sys_job_offers`
- `sys.sys_job_postings`
- `sys.sys_job_requisitions`
- `sys.sys_notification_preferences`
- `sys.sys_occupation_classification_mappings`
- `sys.sys_process_kpi_templates`
- `sys.sys_user_delegations`

## Key counts live

- tenants_active: **2**
- users: **164**
- positions: **315**
- org_units: **45**
- roles: **14**
- permissions: **226**
- role_permission_mappings: **986**
- ui_interfaces_active: **74**
- skills: **14031**

## Anomalie shared exports

- schemi senza subpath export: _pagination, _query-boolean

## Dettaglio completo

Il dettaglio machine-readable (route con permessi/orgGate/CSRF, tabelle per modulo, endpoint per pagina, rowcount per tabella, cross-join) e' in `atlas.yaml` (stessa dir). Query rapide: `python -c "import yaml"` oppure grep sul file.
