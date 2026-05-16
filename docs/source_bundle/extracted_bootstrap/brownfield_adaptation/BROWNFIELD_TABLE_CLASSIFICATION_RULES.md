# Brownfield Table Classification Rules

## Classification Categories

Every old DBMS table must be classified as one of:

```yaml
classification:
  - IMPORT
  - TRANSFORM
  - REFERENCE_ONLY
  - EXCLUDE
```

## IMPORT

Use for low-risk reusable catalogues that map cleanly to the new architecture.

Examples:

```text
esco_occupations
esco_skills
esco_occupation_skills
skill_classifications
business_processes
process_kpis
job_families
job_templates
courses
learning_paths
```

## TRANSFORM

Use where the old table contains useful data but the structure conflicts with the new model.

Examples:

```text
users
tenant_jobs
employee_job_assignments
org_chart_snapshots
rbp_roles
rbp_permissions
enrichment_*
```

## REFERENCE_ONLY

Use where data is informative but should not be imported by default.

Examples:

```text
employee_skill_assessments
course_enrollments
career_recommendations
salary_history
```

## EXCLUDE

Never import into canonical target during bootstrap.

Examples:

```text
employees_pii
employees_payroll
employee_bank_details
employee_benefits
employee_pay_stubs
employee_attendance
medical_certificates
payroll_export_*
SAP raw HR tables
RLS policies
runtime sessions
```

## Non-Negotiable Rule

If a table contains health/anamnestic, bank account, payroll, benefits, attendance or raw sensitive HR data, classify it as `EXCLUDE` unless a future legal/privacy/security review explicitly approves a separate isolated module.
