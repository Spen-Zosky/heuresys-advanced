# Tenant, User, Profile and Evidence Model

---

# 1. Conceptual Separation

The system separates:

```text
Tenant
≠ User
≠ Authentication identity
≠ Profile
≠ Evidence
≠ Position
```

## Tenant

The enterprise using the platform.

## User

The platform person/account belonging to a tenant.

## Authentication Identity

The credential/provider mechanism used by a user to log in.

## Profile

Optional personal and professional profile details linked to the user.

## Evidence

Structured evidence used to evaluate the person against position requirements.

## Position

The central HRMS object. A user may occupy it, but the position owns the requirements.

---

# 2. What Belongs in sys.sys_users

Only stable identity/person anchor fields:

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
```

Do not add:

- passwords;
- family details;
- health data;
- education history;
- experience history;
- certifications;
- documents;
- payroll data;
- benefits data.

---

# 3. Profile Tables

Create linked tables for enrichment.

## sys.sys_user_profiles

General profile details.

Use sparingly and protect access.

## sys.sys_user_education_records

Education and qualifications.

Useful for:

- candidate matching;
- career planning;
- succession;
- skills evidence.

## sys.sys_user_professional_experiences

Professional experience and career history.

Useful for:

- position fit;
- readiness;
- talent analysis;
- succession.

## sys.sys_user_certifications

Formal certifications.

Useful for:

- regulated role readiness;
- position eligibility;
- gap analysis.

## sys.sys_user_documents

Document metadata only.

Do not store binary files directly in PostgreSQL unless explicitly required.

## sys.sys_person_evidence_records

Unified evidence register for position-fit logic.

---

# 4. Family and Sensitive Data

Family information should be considered optional and mostly out of scope for the current position-centric system.

Medical/anamnestic information is out of scope for bootstrap.

If later required, it must be implemented as a separately governed sensitive-data module with explicit legal/privacy/security validation.
