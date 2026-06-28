# Employee-Centric Mapping Doctrine — legacy `employee*` ⟹ advanced `sys_user*`

> **Authority**: ADR-0024 (ACCEPTED 2026-06-01). This document is the operational mapping table that ADR-0024 §2 governs.
> **One-line rule**: in the legacy Docker DB the person is **`employees`**, not `users`. `sys.sys_users` (advanced) ⟸ `employees` (legacy). `users` (legacy) ⟹ `sys.sys_auth_*` only.
> **Status**: canonical. Supersedes the user-centric framing in `BROWNFIELD_IMPORT_PLAN.md` §5 (pre-correction) and the `users` row of `BROWNFIELD_ADAPTATION_MAP.md`.

---

## 1. Why (the false-friend trap)

`heuresys_platform` (legacy Docker) and `heuresys_advanced` (bare metal) both have a table literally named `users`. **They mean opposite things.**

| | Legacy `users` | Advanced `sys.sys_users` |
|---|---|---|
| Carries | credentials (`username`, `password_hash`, `role`, `totp_*`) | the **person** (identity core) |
| Cardinality | one per *account* (some employees have none) | one per *person* |
| Role | subordinate auth shell of an employee | the business entity |
| Legacy equivalent | — | legacy **`employees`** |

The legacy person/business entity is **`employees`** (95 columns of HR substance). Mapping legacy `users → sys.sys_users` by name is the bug: it imports credentials as if they were the person and drops every employee without an account.

## 2. Structural proof (FK census, live legacy DB, S954)

895 FK constraints in `public`. Referenced-table distribution (top):

```
tenants    289   (tenancy parent — expected)
employees  207   ← business gravity centre
users       45   ← audit actor only
esco_skills 38   (catalog)
...
```

- **207 : 45 ≈ 4.6 : 1** in favour of `employees`.
- `users.employee_id → employees.id` — `users` points *at* `employees`, never the reverse.
- `employees.manager_id → employees` — the reporting line is employee→employee (self-FK).
- Tables that FK to both carry two columns: `..._employee_id` (HR subject) + `user_id` (technical actor).

Full lists: `qa_artifacts/_FK_centric.txt` (207 → employees), `_FK_users.txt` (45 → users).

## 3. The canonical mapping

### 3.1 Entity routing

```
legacy.employees  ──►  sys.sys_users                 (identity core)
                  └──►  sys.sys_user_profiles         (bio, phone, linkedin)
                  └──►  sys.sys_user_position_assignments   (job_title, position, org_unit, manager)
                  └──►  sys.sys_user_skill_evidence         (skills[])
                  └──►  sys.sys_user_certifications
                  └──►  sys.sys_user_education_records      (highest_education_*, education_history)
                  └──►  sys.sys_user_professional_experiences
legacy.users      ──►  sys.sys_auth_* (11 tables)     (username, password, role, totp — CREDENTIALS ONLY)
legacy.users.employee_id  =  bridge only, never imported as data
```

### 3.2 Column-level map (legacy `employees` → advanced)

| Legacy `employees` column(s) | Advanced target | Notes |
|---|---|---|
| `email` | `sys.sys_users.user_email` | **the canonical match key** (97.5% to current data) |
| `first_name` / `last_name` | `user_first_name` / `user_last_name` + `user_display_name` | |
| `tenant_id` | `user_tenant_id` | resolved via `brownfield.tenant_id_mappings` |
| `is_active` / `employment_status` | `user_status` | bool/text → `varchar + CHECK` (RD-08) |
| `id` | `user_external_code = 'LEGACY_EMP::' \|\| id` | **the canonical crosswalk key** (ADR-0024 §2.2) |
| `job_title`, `position_id`, `org_unit_id`, `manager_id` | `sys.sys_user_position_assignments` | the position-centric core (I1) |
| `skills[]` | `sys.sys_user_skill_evidence` | exploded to evidence rows |
| `highest_education_*`, `education_history` | `sys.sys_user_education_records` | |
| `phone_*`, bio, linkedin | `sys.sys_user_profiles` | |
| `tax_id`, `passport`, `national_id`, `driver_license` (+ expiries), `birth_*`, `gender`, `nationality`, `marital_status`, `middle_name`, `address_*`/`temp_address_*`, `family_members`, `iban`/banking | **dedicated satellites — TO IMPLEMENT, treated as production data** (`sys.sys_user_demographics` / `_identity_documents` / `_addresses` / `_family_members` / `_bank_details`) | no-PII policy **abandoned** (ADR-0023/0026). **NOT** "out-of-scope". "Never inlined into `sys.sys_users`" = normalization choice (own satellite), **not** omission |
| `salary`/RAL, payroll, payslips | import-fed read-only satellite (`sys.sys_user_employment` / payroll) for **consultation/intelligence** | **I8**: the platform does **not execute** payroll; it consults/analyses imported data. Product-scope exclusion (pay execution), **not privacy** |
| `auth_username`, `auth_password_hash`, `auth_role` *(legacy employees also mirror auth)* | `sys.sys_auth_*` | I7 — but the authoritative auth source is legacy `users`, not these mirror columns |

### 3.3 Column-level map (legacy `users` → advanced)

| Legacy `users` column | Advanced target | Notes |
|---|---|---|
| `username` | `sys.sys_auth_identities` (local identity) | |
| `password_hash` | **not imported** | legacy algorithm; force reset, `must_rotate=true` |
| `role` | `sys.sys_user_auth_roles` | mapped to the 8 canonical roles |
| `totp_*` | `sys.sys_auth_*` MFA tables | |
| `employee_id` | join bridge only | resolve which `employees` this account belongs to |
| `id` | (deprecated as person key) | was `LEGACY:<id>`; do not use for person linkage |

## 4. Linkage keys — correct vs deprecated

| Purpose | ✅ Correct (ADR-0024) | ❌ Deprecated (pre-S954) |
|---|---|---|
| Person crosswalk | `user_external_code = 'LEGACY_EMP::' \|\| employees.id` | `'LEGACY:' \|\| users.id` |
| Independent cross-check | `lower(employees.email) = lower(sys_users.user_email)` | — |
| Auth account link | `users.employee_id → employees.id` (bridge) | (was treated as primary) |
| Coverage driver | `employees` row count | `users` row count (drops account-less employees) |

## 5. Measured impact of the old keying

| Scope | Employees | With `users` row | **Dropped** by user-centric keying |
|---|---|---|---|
| S950 rtl+heuresys subset | 162 | 160 | **2** |
| Global (4 tenants) | 270 | 268 | **2** |

The S950 live bare-metal carries correct *persons* but a wrong *key* (`LEGACY:<users.id>`). Re-keying to `LEGACY_EMP::<employees.id>` is the gated Phase-3 re-run (B-50).

## 6. Where this doctrine is enforced

- **ADR-0024** — the architectural decision.
- **`BROWNFIELD_IMPORT_PLAN.md` §5** — Wave 3 mapping corrected to employee-centric.
- **`BROWNFIELD_ADAPTATION_MAP.md`** — `users` / `employees` rows corrected.
- **`db/seeds/rtl-rebuild/`** — seeds re-keyed (Phase 2); README crosswalk note updated.
- **`CLAUDE.md`** invariant + **`SOT_STATE.md` §4/§9** + **`DEBT_REGISTER.md`** + **`SOT_BACKLOG.md` B-50** — pointers.

## 7. References
- ADR-0024 (governing decision), ADR-0023 (source doctrine), I1, I7
- Evidence: `qa_artifacts/_FK_centric.txt`, `_FK_users.txt`, `_emp_user_gap.txt`, `_FINAL_match.txt`, `_FINAL_chain.txt`, `_FINAL_reconcile.txt`
- `RTL_STABILIZATION_PLAN.md:47` (already noted email-match > external_code, pre-formalization)

---

*Canonical as of 2026-06-01 (S954). Changes require a PR amending ADR-0024.*
