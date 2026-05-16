# Brownfield Exclusion Rules

## Always Exclude From Canonical Bootstrap

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

## Sensitive Review Required

```text
employee_skill_assessments
employee_kpi_targets
salary_history
course_enrollments
learning_path_enrollments
career_profiles
career_recommendations
succession_candidates
```

These may be used only as anonymized/synthetic development evidence or after explicit validation.

## Reason

The new platform is position-centric and intelligence-oriented. It is not a Core HR Administration, payroll, benefits, medical/anamnestic or attendance system.
