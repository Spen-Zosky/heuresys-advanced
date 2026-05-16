# Updated Migration Plan

| Migration | Purpose |
|---|---|
| `000001_init_extensions.sql` | Create PostgreSQL extensions required by the platform. |
| `000002_init_sys_schema.sql` | Create sys schema and shared utility functions. |
| `000003_tenancies.sql` | Create sys.sys_tenancies. |
| `000004_users.sql` | Create sys.sys_users with user_* fields and tenant FK. |
| `000005_auth_foundation.sql` | Create auth identities, credentials, sessions, roles and permissions. |
| `000006_user_profiles_and_evidence.sql` | Create profile, education, experience, certification, document and evidence tables. |
| `000007_enterprise_typing.sql` | Create enterprise activity profiles and ATECO/NACE mapping tables. |
| `000008_blueprint_catalog.sql` | Create blueprint family, variant, process registry and activation tables. |
| `000009_organization_model.sql` | Create organization units, branches and hierarchy support. |
| `000010_job_role_model.sql` | Create job families, job roles and ESCO occupation candidate mapping. |
| `000011_position_model.sql` | Create positions and Position Intelligence Profile foundations. |
| `000012_user_position_assignments.sql` | Create user-position assignment history table. |
| `000013_skill_taxonomy_model.sql` | Create skills and skill taxonomy tables. |
| `000014_position_skill_requirements.sql` | Create position-skill requirement mappings. |
| `000015_kpi_model.sql` | Create KPI catalogue, cascade, targets and assessment tables. |
| `000016_learning_model.sql` | Create learning modules, initiatives, paths and gap closure learning tables. |
| `000017_assessment_gap_model.sql` | Create assessment, evidence, gap analysis and readiness score tables. |
| `000018_career_succession_model.sql` | Create career path, mobility, succession and coverage tables. |
| `000019_compensation_intelligence_model.sql` | Create compensation decision-support, reward gates and payroll handoff tables. |
| `000020_seed_acquisition_staging.sql` | Create seed acquisition runs, candidate records, evidence, validation and approval staging. |
| `000021_seed_reference_bank.sql` | Seed FIN_BANKING reference tenant and reference model. |
| `000022_visualization_graph_model.sql` | Create generic visualization graph, nodes, edges, layout, styles and exports. |
| `000023_validation_views_and_checks.sql` | Create validation views and SQL checks. |


## v5 Brownfield Adaptation Migrations

| Migration | Purpose |
|---|---|
| `000024_brownfield_import_staging.sql` | Create brownfield schema and source export/table/column/import-run staging tables. |
| `000025_brownfield_lineage_and_mapping.sql` | Create brownfield mapping tables and `sys.sys_source_lineage_records`. |
| `000026_brownfield_import_validation.sql` | Create brownfield validation views/checks and approval decision tables. |
