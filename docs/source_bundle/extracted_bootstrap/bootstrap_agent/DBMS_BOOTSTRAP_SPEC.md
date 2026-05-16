# DBMS Bootstrap Specification
## PostgreSQL Foundation for Company HRMS/BPM Platform

---

# 1. Purpose

This specification defines the PostgreSQL foundation for the tenant-aware, authenticated, position-centric HRMS/BPM platform.

The DBMS must support:

- tenants as enterprises;
- users as platform people/accounts;
- authentication;
- user profile and evidence enrichment;
- organization model;
- positions;
- job roles;
- ESCO occupation candidates;
- skill taxonomy;
- KPI cascading;
- learning paths;
- assessment and gap analysis;
- career and succession;
- compensation intelligence.

---

# 2. Database Technology

Use:

```text
PostgreSQL 16
database: company_hrms_bpm
schema: sys
```

Recommended local port:

```text
5439
```

to avoid conflicts with existing local PostgreSQL instances.

---

# 3. Schema Rules

All core platform tables must be in schema:

```text
sys
```

All tables must be named:

```text
sys.sys_*
```

Examples:

```text
sys.sys_tenancies
sys.sys_users
sys.sys_positions
```

Avoid:

```text
br_*
usr_*
```

Do not use RLS for tenant isolation in this bootstrap.

---

# 4. Migration Order

Create migrations in this order:

```text
000001_init_extensions.sql
000002_init_sys_schema.sql

000003_tenancies.sql
000004_users.sql
000005_auth_foundation.sql
000006_user_profiles_and_evidence.sql

000007_enterprise_typing.sql
000008_blueprint_catalog.sql
000009_organization_model.sql
000010_job_role_model.sql
000011_position_model.sql
000012_user_position_assignments.sql

000013_skill_taxonomy_model.sql
000014_position_skill_requirements.sql
000015_kpi_model.sql
000016_learning_model.sql
000017_assessment_gap_model.sql
000018_career_succession_model.sql
000019_compensation_intelligence_model.sql

000020_seed_reference_bank.sql
000021_validation_views_and_checks.sql
```

All migrations must be:

- idempotent;
- safe to re-run;
- non-destructive;
- FK-consistent;
- explicit about unique constraints;
- explicit about indexes;
- explicit about timestamps.

---

# 5. Tenant Table

Create:

```text
sys.sys_tenancies
```

Recommended fields:

```text
tenant_id
tenant_code
tenant_name
tenant_legal_name
tenant_country_code
tenant_status
tenant_employee_count
tenant_fte_count
tenant_branch_count
tenant_primary_ateco_code
tenant_primary_nace_code
tenant_industry_code
tenant_subindustry_code
tenant_size_class_code
tenant_blueprint_family_code
tenant_blueprint_variant_code
tenant_activity_profile_id
tenant_is_synthetic
tenant_created_at
tenant_updated_at
```

Primary key:

```text
tenant_id
```

Unique constraints:

```text
tenant_code
```

---

# 6. User Table

Create:

```text
sys.sys_users
```

Recommended fields:

```text
user_id
user_tenant_id
user_first_name
user_last_name
user_display_name
user_email
user_username
user_employment_status
user_status
user_type
user_external_ref
user_preferred_language
user_timezone
user_is_active
user_is_synthetic
user_created_at
user_updated_at
```

Foreign key:

```text
user_tenant_id → sys.sys_tenancies.tenant_id
```

Rules:

- use `user_*` fields;
- never use `usr_*`;
- do not store passwords here;
- do not store auth secrets here;
- do not store full personal dossier here.

---

# 7. Auth Foundation

Create:

```text
sys.sys_auth_identities
sys.sys_auth_credentials
sys.sys_auth_sessions
sys.sys_auth_refresh_tokens
sys.sys_auth_login_events
sys.sys_auth_password_reset_tokens
sys.sys_auth_mfa_factors
sys.sys_auth_roles
sys.sys_auth_permissions
sys.sys_auth_role_permissions
sys.sys_user_auth_roles
```

Auth identity relation:

```text
sys.sys_users.user_id
  1 → N
sys.sys_auth_identities.user_id
```

Credential rules:

- never store plaintext passwords;
- store password hash only;
- record hash algorithm;
- support credential rotation;
- support lockout metadata;
- record login events;
- support future SSO/OIDC/SAML identities.

---

# 8. User Profile and Evidence Layer

Do not overload `sys.sys_users`.

Create linked enrichment/evidence tables:

```text
sys.sys_user_profiles
sys.sys_user_family_members
sys.sys_user_education_records
sys.sys_user_professional_experiences
sys.sys_user_certifications
sys.sys_user_documents
sys.sys_person_evidence_records
sys.sys_user_skill_evidence
sys.sys_user_learning_evidence
sys.sys_user_kpi_evidence
sys.sys_user_assessment_evidence
```

## Important privacy boundary

Medical/anamnestic data is out of scope for bootstrap.

If future use cases require it, it must be isolated, reviewed and explicitly governed by privacy/security/legal controls.

---

# 9. Position Foundation

Create:

```text
sys.sys_positions
```

Recommended fields:

```text
position_id
tenant_id
position_code
position_title
org_unit_id
job_role_id
reports_to_position_id
position_owner_user_id
position_status
position_fte
position_criticality
position_economic_weight
position_scope_status
created_at
updated_at
```

Important distinction:

```text
Position Owner ≠ Position Incumbent
```

- Position Owner = accountable manager/user responsible for the position.
- Position Incumbent = user/person assigned to the position.

The owner is stored on `sys.sys_positions`.

The incumbent is represented through `sys.sys_user_position_assignments`.

---

# 10. User-Position Assignments

Create:

```text
sys.sys_user_position_assignments
```

Recommended fields:

```text
user_position_assignment_id
tenant_id
user_id
position_id
assignment_type
assignment_status
assignment_fte
assignment_start_date
assignment_end_date
is_primary_assignment
created_at
updated_at
```

Relationships:

```text
tenant_id → sys.sys_tenancies.tenant_id
user_id → sys.sys_users.user_id
position_id → sys.sys_positions.position_id
```

This table is required to support history and multiple assignment patterns.

---

# 11. Seed Rules

Seed the reference bank as:

```text
tenant = RTL_BANK_REFERENCE
employees/capacity = 158
branches = 5
branch employees = 25
```

Use synthetic users only:

```text
user_type = SYNTHETIC_REFERENCE
user_is_synthetic = true
```

Do not present synthetic users as real employee master data.

---

# 12. Validation Requirements

Create validation scripts that check:

- exactly one reference tenant;
- 158 synthetic users if synthetic user seeding is enabled;
- 158 planned/active position seats;
- 5 branches;
- 25 branch position assignments;
- no duplicate user emails;
- no duplicate position codes within tenant;
- every user belongs to a tenant;
- every position belongs to a tenant;
- every active assignment links user, tenant and position consistently;
- every position links to a job role and org unit;
- no orphan skill/KPI/learning records.

---

# v4 Additions

The migration plan now includes:

```text
000020_seed_acquisition_staging.sql
000021_seed_reference_bank.sql
000022_visualization_graph_model.sql
000023_validation_views_and_checks.sql
```

The Development Team must implement seed acquisition staging and visualization graph tables as first-class platform subsystems.
