# 02 — Mapping Strategy: legacy_mirror → sys.sys_users

**Authored**: 2026-05-21 (Cowork)
**Authority**: derived from 01_SOURCE_ANALYSIS.md live evidence

---

## 1. Core merge logic (HC-1 decision)

**Recommended**: **HYBRID — driver table is `legacy_mirror.users`** (not employees_core). Each `users.id` row produces 0 or 1 sys_users row, with PII enrichment from `employees_pii` when joinable.

### 1.1 Why driver = users (not employees_core)

| Driver candidate    | Reason for choice                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| ✅ `users` (chosen) | A "user" is a login-capable identity. Employees without a user account are NOT actionable as `sys_users.user_id` FK in any auth/UI context. They will appear later in `sys_employees` (out of scope for this pilot). |
| ❌ `employees_core` | Would skip the 4 user-only records (SUPERUSER + econova-admin patterns). Also doesn't carry email/PII directly — would force re-join with `employees_pii` AND `users` anyway. |
| ❌ UNION            | Risks producing 2 rows for the same identity (one from each side). Would need de-dup logic. Hybrid driver is cleaner. |

### 1.2 The canonical join (Phase 3 INSERT-SELECT shape)

```sql
INSERT INTO temp_sdbi.sys_users (...)
SELECT
    u.id AS legacy_user_id,
    COALESCE(tm.canonical_tenant_id, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'::uuid) AS user_tenant_id,
    'LEGACY:' || u.id::text AS user_external_code,
    COALESCE(
        ep.email,
        u.username || '@legacy.heuresys.local'  -- fallback for SUPERUSER/admin-only
    ) AS user_email,
    COALESCE(
        TRIM(CONCAT_WS(' ', ep.first_name, ep.last_name)),
        INITCAP(REPLACE(REPLACE(u.username, '.', ' '), '-', ' '))
    ) AS user_display_name,
    ep.first_name AS user_first_name,
    ep.last_name AS user_last_name,
    CASE
        WHEN u.deleted_at IS NOT NULL THEN 'DEACTIVATED'
        WHEN u.is_active = false THEN 'INACTIVE'
        ELSE 'ACTIVE'
    END AS user_status,
    'STANDARD' AS user_type,
    false AS user_is_synthetic,
    'it-IT' AS user_locale,        -- HC-4 default (Italian project)
    'Europe/Rome' AS user_timezone, -- HC-4 default
    jsonb_build_object(
        'legacy_role', u.role,
        'legacy_username', u.username,
        'palette_preference', u.palette_preference_id,
        'theme_preference', u.theme_preference,
        'last_login', u.last_login,
        'has_employee_link', (u.employee_id IS NOT NULL)
    ) AS user_metadata,
    u.created_at AT TIME ZONE 'UTC' AS created_at,
    u.updated_at AT TIME ZONE 'UTC' AS updated_at
FROM legacy_mirror.users u
LEFT JOIN legacy_mirror.employees_core ec ON u.employee_id = ec.id
LEFT JOIN legacy_mirror.employees_pii  ep ON u.employee_id = ep.employee_id
LEFT JOIN brownfield.tenant_id_mappings tm ON ec.tenant_id = tm.legacy_id
WHERE u.id NOT IN (SELECT legacy_user_id FROM temp_sdbi.sys_users); -- idempotency
```

---

## 2. Field-by-field mapping table

| sys.sys_users field   | Source                                                       | Transform                                                                                       |
| --------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `user_id`             | `gen_random_uuid()`                                          | New UUID; **NOT** copying `users.id` (kept as `user_external_code` for traceability instead)    |
| `user_tenant_id`      | `brownfield.tenant_id_mappings.canonical_tenant_id` via `employees_core.tenant_id` | Fallback: `86ba7a65...` (RTL_BANK_REFERENCE) for users without emp link                         |
| `user_external_code`  | `'LEGACY:' \|\| users.id::text`                              | Lineage stamp, indexable via partial idx; max 128 chars OK                                      |
| `user_email`          | `employees_pii.email` if present, else `users.username \|\| '@legacy.heuresys.local'` | Synthetic fallback domain disjoint from prod                                                    |
| `user_display_name`   | `TRIM(CONCAT_WS(' ', ep.first_name, ep.last_name))` if present, else `INITCAP(REPLACE(users.username, '.', ' '))` | NOT NULL constraint, must always have a value                                                   |
| `user_first_name`     | `employees_pii.first_name`                                   | NULL if no emp link                                                                             |
| `user_last_name`      | `employees_pii.last_name`                                    | NULL if no emp link                                                                             |
| `user_status`         | CASE: `deleted_at` → DEACTIVATED, `is_active=false` → INACTIVE, else ACTIVE | Matches enum CHECK                                                                              |
| `user_type`           | constant `'STANDARD'`                                        | All legacy users are real (not synthetic); this is the I-invariant key distinguishing them from CASCADIA seed |
| `user_is_synthetic`   | constant `false`                                             | Pairs with `user_type='STANDARD'` per `sys_users_synthetic_consistency_check`                   |
| `user_locale`         | constant `'it-IT'`                                           | HC-4 default; legacy doesn't store locale                                                       |
| `user_timezone`       | constant `'Europe/Rome'`                                     | HC-4 default; legacy doesn't store TZ                                                           |
| `user_metadata`       | jsonb_build_object(...)                                      | Preserves legacy role, username, theme/palette preferences, last_login, employee_link flag     |
| `created_at`          | `users.created_at AT TIME ZONE 'UTC'`                        | Legacy is `timestamp` (no TZ); cast as UTC                                                      |
| `updated_at`          | `users.updated_at AT TIME ZONE 'UTC'`                        | Same                                                                                             |

---

## 3. HC decisions resolved

### HC-1: Merge strategy
**HYBRID — `legacy_mirror.users` is driver, LEFT JOIN employees_pii for PII enrichment**. Produces exactly N rows where N = users.count - (collisions from reused employee_id). Expected N = 272 → ~268 distinct (4 emp_id reuse loses 4 to ON CONFLICT DO NOTHING).

### HC-2: Email collision behavior
**ON CONFLICT (user_tenant_id, lower(user_email)) DO NOTHING**. Existing 163 sys_users rows preserved. Skipped legacy rows logged via `audit.dbsync_skipped_rows` (or `audit.dbsync_lineage` with `action='SKIP_CONFLICT'`).

**Verified safe**: 0 collisions between legacy `employees_pii.email` (270 distinct) and existing sys_users emails (163 in disjoint domains).

### HC-3: tenant_id assignment for legacy users
**JOIN `brownfield.tenant_id_mappings` on `employees_core.tenant_id`**. All 4 legacy tenants → RTL_BANK_REFERENCE. For users without emp link (2 SUPERUSER): direct assignment to RTL_BANK_REFERENCE (Wave 1 single-tenant scope).

### HC-4: employees_pii inclusion
**LIMITED**: only `email`, `first_name`, `last_name` migrated to sys_users. All other PII (tax_id, national_id, addresses, phone, etc.) SKIPPED — out of scope for sys_users, would belong to `sys.sys_user_profiles` if/when a separate PII pilot is authored. Synthetic data per X3 extract notes, but principle holds: minimize PII surface in core identity table.

---

## 4. Conflict resolution detail

### 4.1 Primary conflict: UQ `(user_tenant_id, lower(user_email))`

After tenant collapse (all → `86ba7a65...`):
- **0 internal collisions** (270 emp_pii emails are globally unique even pre-collapse)
- **0 collisions with existing 163 sys_users** (verified domain disjointness)
- **Risk: synthetic fallback `<username>@legacy.heuresys.local`** could collide with itself if two SUPERUSER share username — verified: `users.username` is UNIQUE constraint, so no.

→ Net expected ON CONFLICT firings: 0 from legacy-vs-legacy, 0 from legacy-vs-existing. Defensive ON CONFLICT DO NOTHING remains for safety.

### 4.2 Secondary conflict: 4 reused employee_id in legacy_mirror.users

Discovered 268 distinct emp_ids across 272 user→emp links. That means 4 employees each have 2 user accounts in legacy. After mapping:
- Both users produce the SAME `user_email` (from `employees_pii.email`)
- First INSERT wins on UQ constraint
- Second INSERT is silently DO NOTHING'd

**Decision**: this is acceptable for Wave 1 (legacy data quality issue, not a target invariant). Log via `audit.dbsync_lineage` with `action='SKIP_DUPLICATE_EMP'` and source `users.id` of the loser for forensic auditability.

### 4.3 Tertiary: CHECK constraints

- `sys_users_user_status_check`: All produced values ∈ {ACTIVE, INACTIVE, DEACTIVATED} — subset of allowed enum. ✅
- `sys_users_user_type_check`: All produced = 'STANDARD'. ✅
- `sys_users_synthetic_consistency_check`: STANDARD + false satisfies the XOR. ✅
- `sys_users_user_tenant_id_fkey`: All produced tenants = `86ba7a65...` which exists in `sys.sys_tenancies`. **VERIFY in Phase 1 of CLI X4** that this tenant_id is still present.

---

## 5. Idempotency strategy

The pilot MUST be safe to re-run (CW-B26 / SDBI principle). Three defenses:

1. **Temp staging**: Phase 3 loads into `temp_sdbi.sys_users` (own schema, not target). Re-run truncates+reloads.
2. **WHERE NOT EXISTS guard** on INSERT-SELECT (using `legacy_user_id NOT IN ...`).
3. **ON CONFLICT DO NOTHING** on Phase 5 UPSERT into `sys.sys_users`. Re-run produces 0 new rows (the existing 163 + first-run additions are all already there).

Idempotency proof point: running the entire pilot twice yields the same final state (433–437 rows, same UUIDs).

---

## 6. Lineage emission (ADR-0015 compliance)

For each row successfully inserted into `sys.sys_users`, emit a lineage row to `audit.dbsync_lineage`:

```sql
INSERT INTO audit.dbsync_lineage (
    lineage_id, source_schema, source_table, source_pk, source_table_id,
    target_schema, target_table, target_pk, action, run_id, created_at
)
SELECT
    gen_random_uuid(),
    'legacy_mirror', 'users', u.id::text, NULL,  -- ADR-0015: source_table_id nullable for SDBI
    'sys', 'sys_users', su.user_id::text,
    'INSERT', :run_id, now()
FROM temp_sdbi.sys_users tsu
JOIN legacy_mirror.users u ON tsu.legacy_user_id = u.id
JOIN sys.sys_users su ON su.user_external_code = 'LEGACY:' || u.id::text;
```

For skipped rows (UQ conflict or duplicate emp_id), emit with `action='SKIP_CONFLICT'` or `action='SKIP_DUPLICATE_EMP'` and `target_pk=NULL`.

---

## 7. Wave 2 carry-forward (out of scope for this pilot)

When Wave 2 reconciles per-tenant canonical IDs (SmartFood, EcoNova, Heuresys System tenants get their own UUIDs):

1. Re-evaluate each migrated user's correct `user_tenant_id` based on:
   - Original `employees_core.tenant_id` lookup against an updated `tenant_id_mappings`
   - The user's `user_metadata->>'legacy_role'` for system-tenant SUPERUSERs

2. UPDATE `sys.sys_users SET user_tenant_id = <new_canonical>` per row — this may collide with the same email already existing under a different tenant; resolution policy TBD by Wave 2 ADR.

3. The `user_external_code = 'LEGACY:<users.id>'` stamp permits **clean reverse lookup**: every Wave-1-migrated row can be located by its origin and re-routed without ambiguity.

**Wave 2 is OUT OF SCOPE** for this pilot. Document only.

---

## 8. Validation queries (Phase 4 ACCEPTANCE)

CLI X4 MUST run these after Phase 5 and before declaring DONE:

```sql
-- A1: total row count in window
SELECT COUNT(*) FROM sys.sys_users;  -- expect 433–437

-- A2: 5 test admins still present unchanged
SELECT COUNT(*) FROM sys.sys_users
WHERE user_type='STANDARD' AND user_external_code IS NULL
  AND user_email IN ('admin@heuresys.com','tenant_admin_test@rtl-bank.test',
                     'manager_test@rtl-bank.test','employee_test@rtl-bank.test',
                     'outsider_test@rtl-bank.test');
-- expect 5

-- A3: 158 SYNTHETIC_REFERENCE preserved
SELECT COUNT(*) FROM sys.sys_users WHERE user_type='SYNTHETIC_REFERENCE';
-- expect 158

-- A4: new STANDARD users have user_external_code populated
SELECT COUNT(*) FROM sys.sys_users
WHERE user_type='STANDARD' AND user_external_code LIKE 'LEGACY:%';
-- expect 268–272 (legacy users merged, modulo collisions/dupes)

-- A5: UQ constraint satisfied (should always be 0)
SELECT user_tenant_id, lower(user_email::text), COUNT(*)
FROM sys.sys_users GROUP BY 1,2 HAVING COUNT(*) > 1;
-- expect 0 rows

-- A6: lineage rows emitted
SELECT COUNT(*) FROM audit.dbsync_lineage
WHERE target_schema='sys' AND target_table='sys_users'
  AND run_id = :run_id;
-- expect 268–272 INSERT actions + 0–6 SKIP_* actions

-- A7: no FK orphan introduced (smoke test)
SELECT COUNT(*) FROM sys.sys_goals g
WHERE g.goal_owner_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE u.user_id = g.goal_owner_user_id);
-- expect 0
```
