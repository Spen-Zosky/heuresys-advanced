# 01 — Source Analysis: legacy_mirror.users + employees_core + employees_pii

**Authored**: 2026-05-21 (Cowork, evidence-based from live SSH introspection on `oracle-vm-default` PostgreSQL 16)

---

## 1. sys.sys_users (target table, EXISTING)

### 1.1 Schema (key fields only, full DDL via `\d sys.sys_users` on VM)

```
user_id              uuid           PK, default gen_random_uuid()
user_tenant_id       uuid           NOT NULL, FK → sys.sys_tenancies(tenant_id) ON DELETE RESTRICT
user_external_code   varchar(128)   NULLABLE — partial idx WHERE NOT NULL
user_email           varchar(320)   NOT NULL
user_display_name    varchar(255)   NOT NULL
user_first_name      varchar(128)   NULLABLE
user_last_name       varchar(128)   NULLABLE
user_status          varchar(32)    NOT NULL, default 'ACTIVE', CHECK ∈ {ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION, DEACTIVATED}
user_type            varchar(32)    NOT NULL, default 'STANDARD', CHECK ∈ {STANDARD, SYNTHETIC_REFERENCE, SERVICE}
user_is_synthetic    boolean        NOT NULL, default false
user_locale          varchar(16)    NULLABLE
user_timezone        varchar(64)    NULLABLE
user_metadata        jsonb          NOT NULL, default '{}'
created_at           timestamptz    NOT NULL, default now()
updated_at           timestamptz    NOT NULL, default now()  (BEFORE UPDATE trigger sys_set_updated_at)
```

### 1.2 Constraints critici

| Constraint                          | Type            | Behavior                                                                                                |
| ----------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| `sys_users_pkey`                    | PRIMARY KEY     | `user_id`                                                                                               |
| `sys_users_tenant_email_uq`         | UNIQUE          | `(user_tenant_id, lower(user_email))` — **the ON CONFLICT target**                                       |
| `sys_users_synthetic_consistency_check` | CHECK       | `user_type='SYNTHETIC_REFERENCE' XOR user_is_synthetic=true` (no mix)                                    |
| `sys_users_user_status_check`       | CHECK           | status ∈ enum above                                                                                     |
| `sys_users_user_type_check`         | CHECK           | type ∈ enum above                                                                                       |
| `sys_users_user_tenant_id_fkey`     | FOREIGN KEY     | → `sys.sys_tenancies(tenant_id)` ON DELETE RESTRICT                                                     |

### 1.3 FK fan-out (downstream impact)

**~100+ tables reference `sys.sys_users.user_id`** as FK. Sampling:
- `sys.sys_auth_*` (8 tables: identities, sessions, refresh_tokens, password_reset_tokens, mfa_factors, login_events, user_auth_roles, credentials NOT shown but exists)
- `sys.sys_goals`, `sys.sys_goal_check_ins`, `sys.sys_goal_milestones`, `sys.sys_goal_updates`, `sys.sys_goal_comments`, `sys.sys_goal_templates`
- `sys.sys_okrs`, `sys.sys_okr_key_results`, `sys.sys_okr_check_ins`
- `sys.sys_assessments`, `sys.sys_assessment_results`, `sys.sys_behavioral_assessments`
- `sys.sys_user_*` (career_plans, certifications, documents, education_records, professional_experiences, position_assignments, target_positions, learning_assignments, learning_evidence, skill_evidence, kpi_evidence, profiles, assessment_evidence)
- `sys.sys_positions` (position_owner_user_id, created_by, updated_by)
- `sys.sys_organization_units` (manager_user_id, created_by, updated_by)
- `sys.sys_kpi_*` (definitions, measurements, targets, assessment_results — both user_id and created/updated_by)
- `sys.sys_gap_*`, `sys.sys_learning_*`, `sys.sys_succession_*`, `sys.sys_talent_*`, `sys.sys_compensation_*`, `sys.sys_reward_*`
- `audit.user_self_service_actions`, `audit.import_approval_decisions`, `brownfield.import_runs`, `brownfield.table_mappings`

**Implication**: increasing sys_users from 163 → ~437 unblocks realistic FK resolution for ALL of these — exactly the unblock mandate of this pilot.

### 1.4 Current row breakdown (163 rows, all on tenant `86ba7a65-217f-48ba-8ce5-5c09b40a66b0`)

| user_type           | user_is_synthetic | user_status | count | notes                                                                                                  |
| ------------------- | ----------------- | ----------- | ----- | ------------------------------------------------------------------------------------------------------ |
| STANDARD            | false             | ACTIVE      | 5     | Test admins (admin@heuresys.com, *_test@rtl-bank.test) — NULL user_external_code                       |
| SYNTHETIC_REFERENCE | true              | ACTIVE      | 158   | CASCADIA seed RTL_BANK_REFERENCE synthetic personas (e.g., garnet.reynoldsmiller.branch_01_branch_manager_01@rtl-bank-reference.example.com) |

**Email domain disjointness verified**:
- 158 SYNTHETIC: `@rtl-bank-reference.example.com`
- 5 STANDARD: `@heuresys.com` or `@rtl-bank.test`
- Legacy mirror (to be merged): `@rtl-bank.org`, `@smartfood.org`, `@econova.org`, `@heuresys.com` (subset of `@heuresys.com` need verification)

→ Risk surface: ONE potential collision domain is `@heuresys.com` (1 test admin `admin@heuresys.com` + N legacy heuresys-domain employees). Verified at query time: 0 collisions in legacy emp_pii.email vs the 5 test admin emails.

---

## 2. legacy_mirror.users (source #1, 274 rows)

### 2.1 Schema

```
id                    uuid          PK
username              varchar(100)  NOT NULL, UNIQUE  ← login identifier (NOT always email format)
password_hash         varchar(255)  NULLABLE         ← OUT OF SCOPE (auth pilot future)
role                  varchar(50)   NULLABLE, default 'USER'
permissions           text[]        default '{}'
is_active             boolean       default true
last_login            timestamp     NULLABLE
created_at            timestamp     default now()
updated_at            timestamp     default now()
employee_id           uuid          NULLABLE        ← FK semantic to employees_core.id / employees_pii.employee_id
deleted_at            timestamptz   NULLABLE
totp_*                ...           ← OUT OF SCOPE (auth)
palette_preference_id varchar(32)   NULLABLE        ← could → user_metadata.preferences.palette
theme_preference      varchar(8)    NULLABLE        ← could → user_metadata.preferences.theme
```

### 2.2 Check constraints

- `users_business_must_have_employee`: `role IN ('SUPERUSER','SYSADMIN','DEMO') OR employee_id IS NOT NULL` — explains the 2 SUPERUSER without emp_id.
- `users_palette_preference_id_check`: enum of 17 palette codes (alpha, beta, gamma, …, mu-data-dense) — preserved in metadata.
- `users_theme_preference_check`: `IN ('dark','light')`.
- `users_updated_after_created`: time invariant.

### 2.3 Distribution data (live)

| role           | count | with_emp_id | semantic                                                                |
| -------------- | ----- | ----------- | ----------------------------------------------------------------------- |
| EMPLOYEE       | 257   | 257         | Regular employees                                                       |
| DEPT_HEAD      | 5     | 5           | Department heads                                                        |
| TENANT_OWNER   | 5     | 5           | One per tenant, 4 legacy tenants + 1 extra                             |
| HR_DIRECTOR    | 2     | 2           | HR directors                                                            |
| **SUPERUSER**  | **2** | **0**       | `sysadmin`, `evo.dev` — system-level, no employee linkage (intentional)|
| LINE_MANAGER   | 1     | 1           | Line manager                                                            |
| HR_MANAGER     | 1     | 1           | HR manager                                                              |
| IT_ADMIN       | 1     | 1           | IT admin                                                                |
| **Total**      | **274** | **272**    |                                                                         |

| is_active | count | with deleted_at | semantic                                       |
| --------- | ----- | --------------- | ---------------------------------------------- |
| true      | 265   | 0               | Active users                                   |
| false     | 9     | 9               | Soft-deleted users (preserved as DEACTIVATED) |

### 2.4 username format analysis (sample)

Three patterns observed:
1. **Full email format**: `marco.desantis@rtl-bank.org`, `valentina.conti@rtl-bank.org`, etc. — most legacy users (260+)
2. **Domain-prefixed slug**: `rtl-bank.alice.esposito` — minority (~5 cases, possibly older accounts)
3. **System aliases**: `sysadmin`, `evo.dev`, `econova-admin` — SUPERUSER + occasional admin accounts

**Implication for mapping**: `users.username` is **NOT a reliable email source**. Always prefer `employees_pii.email` when joined; fallback to derived synthetic email for the 4 user-only rows (2 SUPERUSER + 2 admin-only without emp).

---

## 3. legacy_mirror.employees_core (source #2, 270 rows)

### 3.1 Schema (key fields)

```
id                       uuid          PK
tenant_id                uuid          NOT NULL
skills                   text[]        default '{}'
is_active                boolean       default true
created_at               timestamp     default now()
updated_at               timestamp     default now()
pernr                    varchar(8)    NULLABLE  ← payroll number
employment_status        varchar(20)   default 'active'
termination_date         date          NULLABLE
termination_reason       varchar(100)  NULLABLE
profile_embedding        text          NULLABLE  ← vector-stored as text
embedding_*              …             OUT OF SCOPE (AI pilot)
deleted_at               timestamptz   NULLABLE
enrichment_consent       boolean       NOT NULL default false
enrichment_consent_*     …             OUT OF SCOPE
```

### 3.2 What this table does NOT contain

- **NO email field**
- **NO first_name / last_name / display_name**
- **NO phone, address, tax_id, national_id**

This is the vertical-split "core" shell. PII lives in `employees_pii` (1:1 by `employee_id`).

### 3.3 Tenant distribution

| legacy tenant_id                     | count | maps to canonical                                  |
| ------------------------------------ | ----- | -------------------------------------------------- |
| 0c54b84a-db6e-4da4-bc91-af5d480d524e | 158   | `86ba7a65...` (RTL_BANK_REFERENCE) — RTL Bank      |
| 1d7bf448-ceac-4215-917d-45ff13678104 | 82    | `86ba7a65...` (RTL_BANK_REFERENCE) — SmartFood    |
| fb1e866c-e90a-4e25-a146-f68d660a0be8 | 26    | `86ba7a65...` (RTL_BANK_REFERENCE) — EcoNova      |
| d5855519-3ed1-4427-865f-fe75f1e42c4c | 4     | `86ba7a65...` (RTL_BANK_REFERENCE) — Heuresys     |

All 4 → 1 collapse via `brownfield.tenant_id_mappings` (Wave 1 single-tenant scope per Goal 003).

### 3.4 Employment status

```
employment_status='active': 270 (100%)
termination_date IS NULL:    270 (100%)
```

→ All 270 employees are active; no edge case for terminated-but-still-FK-referenced.

---

## 4. legacy_mirror.employees_pii (source #3 — CRITICAL FOR EMAIL/NAME, 270 rows)

### 4.1 Why this table is the canonical email source

`employees_pii.employee_id` is PK and FK-equivalent to `employees_core.id` (1:1 by design). Fields relevant to sys_users:

| employees_pii field | sys_users target field          | Notes                                                              |
| ------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `email`             | `user_email`                    | **Canonical, 270/270 not null, 270/270 unique, valid format**     |
| `first_name`        | `user_first_name`               | Direct map                                                         |
| `last_name`         | `user_last_name`                | Direct map                                                         |
| `first_name+last_name` | `user_display_name`          | Derived: `TRIM(CONCAT_WS(' ', first_name, last_name))`             |
| `middle_name`       | (drop)                          | Not present in sys_users                                           |
| All other fields    | (skip)                          | Sensitive PII out of scope (tax_id, national_id, addresses, etc.) |

### 4.2 Sample emails (verified live)

```
Valentina Conti  → valentina.conti@rtl-bank.org
Laura Ferrari    → laura.ferrari@rtl-bank.org
Stefano Giuliani → stefano.giuliani@smartfood.org
```

**Format invariant**: `<first>.<last>@<tenant_domain>`. After tenant collapse to RTL_BANK_REFERENCE, the domain in email **REMAINS the original** (e.g., `stefano.giuliani@smartfood.org` stays as-is) — this is by design, since email is a natural identity attribute and we don't rewrite it. The TENANT FK changes, the email does not.

### 4.3 Email uniqueness post-tenant-collapse

Verified: 270 distinct emails globally (`SELECT lower(email), COUNT(*) FROM employees_pii GROUP BY 1 HAVING COUNT(*) > 1 → 0 rows`).
→ Safe to collapse all 4 tenant_ids to single canonical without hitting the `(tenant_id, lower(email))` UQ constraint.

---

## 5. brownfield.tenant_id_mappings (canonical tenant resolver, 4 rows)

### 5.1 Content (live)

```
legacy_id                            | canonical_tenant_id                  | created_at (UTC)
-------------------------------------+--------------------------------------+--------------------
0c54b84a-db6e-4da4-bc91-af5d480d524e | 86ba7a65-217f-48ba-8ce5-5c09b40a66b0 | 2026-05-19 14:57:50
1d7bf448-ceac-4215-917d-45ff13678104 | 86ba7a65-217f-48ba-8ce5-5c09b40a66b0 | 2026-05-19 14:57:50
fb1e866c-e90a-4e25-a146-f68d660a0be8 | 86ba7a65-217f-48ba-8ce5-5c09b40a66b0 | 2026-05-19 14:57:50
d5855519-3ed1-4427-865f-fe75f1e42c4c | 86ba7a65-217f-48ba-8ce5-5c09b40a66b0 | 2026-05-19 14:57:50
```

All 4 → single canonical RTL_BANK_REFERENCE. The notes column documents: *"Goal 003 Wave 1 seed: all legacy tenants point to RTL_BANK_REFERENCE in single-tenant scope. Goal 004 Wave 2 will reconcile to per-tenant canonical IDs once SmartFood/EcoNova/Heuresys System tenancies are created."*

### 5.2 SUPERUSER tenant assignment

The 2 SUPERUSER (`sysadmin`, `evo.dev`) have NO `employee_id` → NO source `employees_core.tenant_id` → NO mapping lookup. **Decision**: assign them directly to canonical RTL_BANK_REFERENCE (the only canonical tenant available in Wave 1). Phase 2 (multi-tenant) may re-tenant them to a future "system" tenant if one is provisioned.

---

## 6. 5 STANDARD test admin reconciliation

### 6.1 Existing test admins (verified live)

```
user_id                              | user_email                       | user_display_name      | user_external_code
-------------------------------------+----------------------------------+------------------------+-------------------
82c89e25-95db-46eb-be24-33a840cb3b79 | admin@heuresys.com               | Heuresys Test Admin   | NULL
c5c349fc-e0e5-49bc-8599-173c0706b550 | tenant_admin_test@rtl-bank.test  | RTL Tenant Admin Test | NULL
d19eb2c5-09bb-4dc9-b603-2765d9c47802 | manager_test@rtl-bank.test       | RTL Manager Test      | NULL
ad5427a8-de11-419b-a22d-93700ad99107 | outsider_test@rtl-bank.test      | RTL Outsider Test     | NULL
3c5a25e9-5461-441c-8a98-2c170f69915e | employee_test@rtl-bank.test      | IT_ME_32BBE439-name  | NULL
```

### 6.2 Collision verification with legacy sources

```sql
-- vs legacy_mirror.users.username
SELECT u.username FROM legacy_mirror.users u
WHERE u.username IN ('admin@heuresys.com','tenant_admin_test@rtl-bank.test', ...);
→ 0 rows

-- vs legacy_mirror.employees_pii.email
SELECT ep.email FROM legacy_mirror.employees_pii ep
WHERE ep.email IN ('admin@heuresys.com','tenant_admin_test@rtl-bank.test', ...);
→ 0 rows
```

**Zero collisions** with both source tables. Safe.

### 6.3 Preservation strategy

Pure ON CONFLICT DO NOTHING. The 5 admins will fall through to "already exists, skip" on the UNIQUE constraint check naturally. No special handling needed beyond the default UPSERT semantics. **DO NOT update them** even on emp_id match (which doesn't exist anyway).

---

## 7. Edge cases summary

| Edge case                                  | Count | Treatment                                                                                                          |
| ------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------ |
| SUPERUSER without employee_id              | 2     | Insert with synthetic email `<username>@legacy.heuresys.local`, tenant=canonical RTL_BANK_REFERENCE                |
| Other admin without emp (econova-admin)    | 0–2   | Verify in Phase 1; if any, treat like SUPERUSER pattern                                                            |
| Inactive users (deleted_at IS NOT NULL)    | 9     | Include with `user_status='DEACTIVATED'`                                                                           |
| Active users with valid emp link           | 263   | Standard path: JOIN employees_pii for email/name                                                                    |
| Reused employee_id (4 cases)               | 4     | First user wins (ON CONFLICT DO NOTHING); document second-user skip in audit lineage                              |
| Orphaned employees_core (no user)          | 2     | **SKIPPED** — not addressable as user (no login intent in legacy). They remain employees-only, future ESS may add. |
| `users` orphaned (emp_id points to missing) | 0     | Verified 0 dangling in legacy_mirror.users.employee_id → employees_core.id                                          |

---

## 8. Total target population estimation

| Source                                                   | Count |
| -------------------------------------------------------- | ----- |
| Existing sys.sys_users (preserved)                       | 163   |
| Legacy users with valid emp link → joined with emp_pii   | 268 (272 minus 4 collision losers) |
| Legacy SUPERUSER (no emp)                                | 2     |
| Other legacy admin-only without emp (verify Phase 1)     | 0–2   |
| **Estimated final count**                                | **~433–437** |

Validation tolerance for acceptance criterion A1: `433 ≤ COUNT(*) ≤ 437`.
