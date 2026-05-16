# Security and Privacy Boundaries

---

# 1. Key Boundary

The system may contain personal data, but it must not become an uncontrolled employee dossier.

---

# 2. Sensitive Data Policy

## Out of Scope for Bootstrap

- Medical/anamnestic data.
- Health records.
- Detailed family/dependent data unless justified.
- Payroll execution data.
- Benefit enrollment data.
- Disciplinary/legal case management.

## Allowed in Bootstrap

- user identity anchor;
- profile basics;
- education records;
- professional experience records;
- certifications;
- evidence records;
- skill assessments;
- learning completion;
- KPI evidence;
- position assignments.

---

# 3. Auth Security

- Never store plaintext passwords.
- Never store credentials in `sys.sys_users`.
- Log authentication events.
- Support token/session revocation.
- Hash reset tokens or use secure opaque tokens.
- Implement rate limiting later.

---

# 4. Data Access

- Tenant isolation must be enforced by FK and API query filters.
- Do not use RLS in this bootstrap.
- Role-based permissions must protect administrative operations.
- Sensitive profile/evidence tables must require elevated permissions.

---

# 5. AI Governance

AI or rule-generated outputs must be marked as:

```text
CANDIDATE
SYSTEM_PROPOSED
DOMAIN_VALIDATED
HR_VALIDATED
MANAGEMENT_APPROVED
REJECTED
```

AI outputs must not become final employment, compensation, succession or assessment decisions without human validation.
