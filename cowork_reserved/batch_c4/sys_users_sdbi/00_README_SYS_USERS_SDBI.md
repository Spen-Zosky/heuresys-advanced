# sys_users SDBI Extension Pilot — Index

**Batch**: C4.3
**Status**: AUTHORED (ready for CLI X4 execution)
**Authored**: 2026-05-21 (Cowork autonomous mode)
**Lock**: cowork_reserved/.lock held by Cowork

---

## What this pilot is — and is NOT

**IS**: an **EXTENSION** of the existing `sys.sys_users` table via UPSERT MERGE from `legacy_mirror.users` + `legacy_mirror.employees_core` + `legacy_mirror.employees_pii` (the latter as PII source for canonical email + display name).

**IS NOT**: a new table SDBI. This is the FIRST SDBI pilot pattern where the target table **already exists with data** (163 rows from CASCADIA seed: 5 STANDARD test admins + 158 SYNTHETIC_REFERENCE users).

**WHY THIS IS UNBLOCKING**: every future SDBI pilot that references `sys.sys_users(user_id)` as FK (e.g., Goals/OKRs `check_in_subject_user_id`, attendance `user_id`, comments `comment_author_user_id`, ~150+ FK references mapped) currently has a **target population of only 163 users**. Post-pilot: ~437 users (163 existing + 274 legacy merged), enabling realistic FK resolution across the entire HRMS surface.

---

## Live introspection evidence baseline (2026-05-21)

| Source                          | Row count | Key column(s)                                  | Notes                                                                                                                            |
| ------------------------------- | --------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `sys.sys_users` (target)        | 163       | PK `user_id` UUID; UQ `(user_tenant_id, lower(user_email))` | 5 STANDARD test admins (NULL `user_external_code`) + 158 SYNTHETIC_REFERENCE; all on tenant `86ba7a65-217f-48ba-8ce5-5c09b40a66b0` (RTL_BANK_REFERENCE) |
| `legacy_mirror.users`           | 274       | PK `id` UUID; UQ `username`                    | 272 with `employee_id`, 2 SUPERUSER without (sysadmin, evo.dev); 9 inactive (deleted_at set), 265 active                          |
| `legacy_mirror.employees_core`  | 270       | PK `id` UUID; UQ `(tenant_id, pernr)`          | Vertical-split shell: NO email/name. 4 legacy tenant_ids → all map to RTL_BANK_REFERENCE via `brownfield.tenant_id_mappings`     |
| `legacy_mirror.employees_pii`   | 270       | PK `employee_id` UUID                          | **Canonical email + first/last name source** for the 270 employees. 270 distinct emails, 0 collisions, format `firstname.lastname@<tenant>.org` |
| `brownfield.tenant_id_mappings` | 4         | PK `legacy_id`                                 | All 4 legacy tenants → `86ba7a65...` (RTL_BANK_REFERENCE, Wave 1 single-tenant scope)                                            |

**Identity model discovered**:
- `legacy_mirror.users.id` ≠ `legacy_mirror.employees_core.id` (0 overlap UUID)
- Relationship is FK: `users.employee_id` → `employees_core.id` (and `employees_pii.employee_id`)
- 272/274 users have a valid employee link; 2 SUPERUSER (sysadmin, evo.dev) are user-only (no employee)
- 268/272 employee links are unique (4 cases of `employee_id` reuse — verify in Phase 1 of CLI X4)
- 2 employees_core rows are orphaned (no user pointing to them — they are employees without login accounts)

**Test admin preservation guarantee**:
- 0 collision: none of the 5 test admin emails (`admin@heuresys.com`, `*_test@rtl-bank.test`) appear in `legacy_mirror.users.username` OR `legacy_mirror.employees_pii.email`. Safe insert without ON CONFLICT firing on them.

---

## Files in this pilot

| File                                    | Purpose                                                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `00_README_SYS_USERS_SDBI.md` (this)    | Index + UNIQUE strategy + identity model summary + HC checklist                                                                                            |
| `01_SOURCE_ANALYSIS.md`                 | Deep dive on `legacy_mirror.users` + `employees_core` + `employees_pii` schema + 5 test-admin reconciliation + edge cases (SUPERUSER without emp, inactive users) |
| `02_MAPPING_STRATEGY.md`                | The merge logic: how 274 users + 270 employees_pii → ~272 sys_users rows. Field-by-field mapping. Conflict resolution for the 4 reused employee_ids. HC-1/HC-2/HC-3/HC-4 decisions. |
| `03_PHASE3_TEMP_SDBI_DDL.md`            | `temp_sdbi.sys_users` mirror DDL + INSERT-SELECT from legacy_mirror join + validation predicates                                                            |
| `04_PHASE5_CONSOLIDATION_PLAN.md`       | UPSERT into `sys.sys_users` with `ON CONFLICT (user_tenant_id, lower(user_email)) DO NOTHING` — preserving all 163 existing rows (5 admins included)        |

---

## UNIQUE strategy (the critical design lock)

Target `sys.sys_users` has UNIQUE constraint:
```sql
sys_users_tenant_email_uq UNIQUE btree (user_tenant_id, lower(user_email::text))
```

This is **per-tenant, lowercased email**. Since all 4 legacy tenants collapse to the single canonical RTL_BANK_REFERENCE tenant in Wave 1, the post-merge uniqueness must hold:
- Pre-merge: 270 distinct emails across 4 tenants in `employees_pii` (270 unique globally — verified, no collisions even after tenant collapse).
- Post-merge: 270 employee-derived emails + 4 SUPERUSER/admin-only username-derived emails + 163 existing = ~437 candidate rows, all under `tenant_id=86ba7a65...`.
- ON CONFLICT DO NOTHING preserves the 163 existing (the 158 SYNTHETIC_REFERENCE emails are in domain `@rtl-bank-reference.example.com` — disjoint from legacy `@rtl-bank.org`/`@smartfood.org`/etc., so 0 collisions expected).

**Expected final population: ~437 rows** (163 existing + 270 employee-merged + 4 user-only). May be 435 if 2 dangling/inactive users skipped (HC-1 decision).

---

## I-invariant compliance

- **I5 tenant isolation**: all merged users will get `user_tenant_id=86ba7a65...` (RTL_BANK_REFERENCE) via `brownfield.tenant_id_mappings`. NO RLS.
- **I7 auth separation**: this pilot DOES NOT touch `sys.sys_auth_*` tables. Auth credentials are NOT migrated. Future C5+ pilot can authore `sys_auth_identities` from `legacy_mirror.users.password_hash` if needed. ADR-0011 ESS readiness preserved.
- **I12 brownfield enrichment**: no anonymization layer; PII is synthetic per `employees_pii` extract documentation (X3 noted "no real PII").
- **ADR-0015 nullable lineage FK**: each upserted row will carry `audit_lineage_source_table_id NULL` (lineage row emitted separately to `audit.dbsync_lineage` post-upsert).

---

## HC checklist (mandatory Enzo confirmation before CLI X4 EXEC)

| # | Decision                                                                                                                                                            | Cowork default (X2 pattern)                                                                                                                                    |
| - | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HC-1 | **Merge strategy**: UNION users+employees_pii (one row per user OR per employee) vs UPSERT separati vs hybrid?                                                  | **Hybrid recommended**: 1 row per `users.id` where employee_id IS NOT NULL (join employees_pii for email/name), + 1 row per SUPERUSER without employee (4 total). 2 orphan employees_core rows SKIPPED (no login, not addressable as user). |
| HC-2 | **Email collision behavior**: if a legacy email matches a test admin email (verified 0 today, but for safety) — preserve admin or warn?                            | **ON CONFLICT DO NOTHING** preserves admin. Logged to `audit.dbsync_skipped_rows` for visibility.                                                              |
| HC-3 | **tenant_id assignment for legacy users**: use `brownfield.tenant_id_mappings` (4 legacy → 1 RTL_BANK_REFERENCE)?                                                  | **YES, via JOIN on tenant_id_mappings.legacy_id**. The 2 SUPERUSER (no tenant) → assign RTL_BANK_REFERENCE as the only available canonical tenant in Wave 1.   |
| HC-4 | **employees_pii inclusion**: include first_name/last_name/email in sys_users? Skip sensitive PII (tax_id, national_id, birth_date, addresses, etc.)?              | **Include first/last/email ONLY** (mapped to user_first_name/user_last_name/user_email/user_display_name). Sensitive PII NOT migrated to sys_users (would belong to `sys.sys_user_profiles` in a separate future pilot). |

---

## CLI X4 execution interface

**Pre-spec live SSH introspection (CW-B25 compliance)**: completed by Cowork on 2026-05-21, embedded as evidence baseline above. CLI X4 **MUST re-verify** all 6 counts before Phase 3 INSERT (CW-B25 mandate: introspection results may have drifted since authoring).

**CW-B29 NO migration row insert**: this pilot DOES NOT add rows to `sys.sys_db_migrations`. It is a DATA upsert, not a schema migration.

**Effort budget for X4**: ~30-45 min (Phase 1 verify + Phase 3 temp_sdbi load + Phase 4 validation + Phase 5 upsert + lineage emission).

**Acceptance criteria (A1–A7)**:
- A1: `SELECT COUNT(*) FROM sys.sys_users` returns 433–437 (target window)
- A2: All 5 STANDARD test admins still present (`WHERE user_type='STANDARD' AND user_external_code IS NULL` count = 5)
- A3: All 158 SYNTHETIC_REFERENCE preserved unchanged
- A4: New STANDARD users have `user_external_code` populated (LEGACY:<users.id>) for lineage
- A5: 0 rows violate `sys_users_tenant_email_uq`
- A6: `audit.dbsync_lineage` has 270–274 new rows with `target_table='sys.sys_users'`
- A7: No FK violation introduced anywhere (verify against the 100+ tables referencing sys_users)

---

## R-risks identified (carry into PROMPT 007)

| R# | Risk                                                                                                                                                                     | Mitigation                                                                                                                                                  |
| -- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 | **2 SUPERUSER without employee link** (sysadmin, evo.dev) — they violate the `users_business_must_have_employee` check in legacy but are valid by exception clause       | UPSERT with `user_type='STANDARD'`, `user_external_code='LEGACY:SU:<username>'`, derive synthetic email `<username>@legacy.heuresys.local` (no collision risk verified) |
| R2 | **4 employee_id reuse cases** in users (268 distinct emp_ids across 272 user→emp links) — same employee with multiple user accounts (legacy data quality issue)         | Phase 1 quantify exact pattern; if same email reused: ON CONFLICT DO NOTHING wins (first user kept); record dup → audit                                     |
| R3 | **9 inactive users** (`deleted_at IS NOT NULL`) — include or skip?                                                                                                       | **Include with `user_status='DEACTIVATED'`** — preserves FK target for historical references in legacy `audit_logs`/`activity_log`. CHECK constraint allows DEACTIVATED. |
| R4 | **Tenant collapse 4→1**: post-merge all rows on `86ba7a65...`. When Wave 2 reconciles SmartFood/EcoNova/Heuresys System tenants, these rows will need re-tenant migration | OUT OF SCOPE for this pilot. Document in `02_MAPPING_STRATEGY.md` as Wave 2 carry-forward.                                                                  |
| R5 | **Display name derivation for SUPERUSER**: `sysadmin`/`evo.dev` — no first/last available                                                                                | `user_display_name = INITCAP(REPLACE(username, '.', ' '))` fallback (e.g., "Sysadmin", "Evo Dev"); `user_first_name=NULL`, `user_last_name=NULL`             |
| R6 | **Check constraint `sys_users_synthetic_consistency_check`**: enforces `user_type='SYNTHETIC_REFERENCE' XOR user_is_synthetic=true`                                       | All legacy upserts MUST set `user_type='STANDARD'` AND `user_is_synthetic=false`. Verified safe.                                                            |

---

## Cross-references

- **ADR-0014** (SDBI architecture)
- **ADR-0015** (nullable lineage FK)
- **CW-B25** (mandatory pre-spec introspection)
- **CW-B27** (legacy_mirror as source pattern)
- **CW-B29** (NO migration row for DATA SDBI)
- Sibling pilot: `cowork_reserved/batch_c4/time_leave_pilot/` (C4.2, same batch)
- Future enabler: Goals/OKRs FK resolution (`check_in_subject_user_id` etc., currently constrained to 163 user pool)
