# 03 — Phase 3: temp_sdbi.sys_users Mirror DDL + INSERT-SELECT

**Authored**: 2026-05-21 (Cowork)
**Phase context**: Phase 3 of SDBI pattern (Acquire → Stage → Validate → Consolidate → Lineage)

---

## 1. Schema scope

`temp_sdbi` is an existing pilot schema (created by prior pilots in batch C3). Verify presence in Phase 1:

```sql
SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name='temp_sdbi');
-- expect: t
-- If false: CREATE SCHEMA temp_sdbi;  (no auth/RLS needed, transient)
```

---

## 2. DDL — temp_sdbi.sys_users

Mirror of `sys.sys_users` with two extra columns for traceability + lineage:

```sql
-- Drop any prior partial run from this pilot
DROP TABLE IF EXISTS temp_sdbi.sys_users CASCADE;

-- Create staging table with sys.sys_users shape + traceability extras
CREATE TABLE temp_sdbi.sys_users (
    -- Lineage / pilot extras (FIRST so they're easy to spot in inspections)
    legacy_user_id          uuid NOT NULL,         -- maps to legacy_mirror.users.id
    legacy_employee_id      uuid NULL,             -- maps to legacy_mirror.employees_core.id when present
    source_join_path        varchar(64) NOT NULL,  -- 'USER+EMP+PII' or 'USER_ONLY' (for SUPERUSER pattern)
    staging_run_id          uuid NOT NULL,         -- ties to dbsync_lineage.run_id
    staging_loaded_at       timestamptz NOT NULL DEFAULT now(),

    -- Mirror of sys.sys_users (exact column types, NULL/NOT NULL as target)
    user_id                 uuid NOT NULL DEFAULT gen_random_uuid(),
    user_tenant_id          uuid NOT NULL,
    user_external_code      varchar(128) NULL,
    user_email              varchar(320) NOT NULL,
    user_display_name       varchar(255) NOT NULL,
    user_first_name         varchar(128) NULL,
    user_last_name          varchar(128) NULL,
    user_status             varchar(32) NOT NULL DEFAULT 'ACTIVE',
    user_type               varchar(32) NOT NULL DEFAULT 'STANDARD',
    user_is_synthetic       boolean NOT NULL DEFAULT false,
    user_locale             varchar(16) NULL,
    user_timezone           varchar(64) NULL,
    user_metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    -- Local PK on legacy_user_id (idempotency anchor)
    CONSTRAINT temp_sdbi_sys_users_pkey PRIMARY KEY (legacy_user_id)
);

-- Local UQ mirror for fast pre-flight conflict detection (NOT the target UQ — that's enforced at Phase 5)
CREATE UNIQUE INDEX temp_sdbi_sys_users_tenant_email_uq
    ON temp_sdbi.sys_users (user_tenant_id, lower(user_email::text));

-- Helpful indexes for validation queries
CREATE INDEX temp_sdbi_sys_users_status_idx ON temp_sdbi.sys_users (user_status);
CREATE INDEX temp_sdbi_sys_users_join_path_idx ON temp_sdbi.sys_users (source_join_path);

COMMENT ON TABLE temp_sdbi.sys_users IS
    'C4.3 SDBI pilot staging. Mirror of sys.sys_users for upsert merge from legacy_mirror.users + employees_pii. Truncated and reloaded per run.';
```

**Why local UQ index**: catches duplicate-key issues during Phase 3 INSERT (the 4 reused emp_id case) **before** they reach Phase 5 — and turns them into a quantifiable Phase 4 metric instead of silent ON CONFLICT.

To handle the 4 reused emp_id without aborting the INSERT, use `INSERT … ON CONFLICT DO NOTHING` against the local UQ as well (see §4 below).

---

## 3. Pre-flight verification (CLI X4 Phase 1 — re-verify post-staging)

Before Phase 3 INSERT, CLI X4 runs the introspection battery once more (CW-B25):

```sql
-- F1: target tenant must exist
SELECT EXISTS (
    SELECT 1 FROM sys.sys_tenancies
    WHERE tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
);
-- expect: t

-- F2: source counts (drift check vs authoring baseline 2026-05-21)
SELECT
    (SELECT COUNT(*) FROM legacy_mirror.users)            AS users_count,           -- expect 274
    (SELECT COUNT(*) FROM legacy_mirror.employees_core)   AS emp_core_count,        -- expect 270
    (SELECT COUNT(*) FROM legacy_mirror.employees_pii)    AS emp_pii_count,         -- expect 270
    (SELECT COUNT(*) FROM brownfield.tenant_id_mappings)  AS tenant_map_count,      -- expect 4
    (SELECT COUNT(*) FROM sys.sys_users)                  AS existing_sys_users;    -- expect 163

-- F3: collision pre-check (must remain 0)
SELECT COUNT(*) FROM legacy_mirror.employees_pii ep
WHERE ep.email IN (
    SELECT user_email FROM sys.sys_users
);
-- expect 0
```

If any F1–F3 fails → ABORT pilot, emit `audit.dbsync_lineage(action='PRE_FLIGHT_FAIL')`, escalate to Cowork via inbox.

---

## 4. INSERT-SELECT (Phase 3 main)

```sql
-- Generate staging_run_id once for this run
\set run_id (SELECT gen_random_uuid())

-- Truncate staging (idempotency)
TRUNCATE TABLE temp_sdbi.sys_users;

-- Main load (driver = legacy_mirror.users)
INSERT INTO temp_sdbi.sys_users (
    legacy_user_id, legacy_employee_id, source_join_path, staging_run_id,
    user_id, user_tenant_id, user_external_code, user_email, user_display_name,
    user_first_name, user_last_name, user_status, user_type, user_is_synthetic,
    user_locale, user_timezone, user_metadata, created_at, updated_at
)
SELECT
    u.id                                    AS legacy_user_id,
    u.employee_id                           AS legacy_employee_id,
    CASE
        WHEN ep.email IS NOT NULL THEN 'USER+EMP+PII'
        WHEN ec.id    IS NOT NULL THEN 'USER+EMP_NO_PII'    -- edge: shouldn't happen given 1:1 pii=core
        ELSE                          'USER_ONLY'
    END                                     AS source_join_path,
    :'run_id'::uuid                         AS staging_run_id,

    gen_random_uuid()                       AS user_id,
    COALESCE(
        tm.canonical_tenant_id,
        '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'::uuid
    )                                       AS user_tenant_id,
    'LEGACY:' || u.id::text                 AS user_external_code,
    COALESCE(
        ep.email,
        u.username || '@legacy.heuresys.local'
    )                                       AS user_email,
    COALESCE(
        NULLIF(TRIM(CONCAT_WS(' ', ep.first_name, ep.last_name)), ''),
        INITCAP(REPLACE(REPLACE(u.username, '.', ' '), '-', ' '))
    )                                       AS user_display_name,
    ep.first_name                           AS user_first_name,
    ep.last_name                            AS user_last_name,
    CASE
        WHEN u.deleted_at IS NOT NULL THEN 'DEACTIVATED'
        WHEN u.is_active = false      THEN 'INACTIVE'
        ELSE                               'ACTIVE'
    END                                     AS user_status,
    'STANDARD'                              AS user_type,
    false                                   AS user_is_synthetic,
    'it-IT'                                 AS user_locale,
    'Europe/Rome'                           AS user_timezone,
    jsonb_strip_nulls(jsonb_build_object(
        'legacy_role',          u.role,
        'legacy_username',      u.username,
        'palette_preference',   u.palette_preference_id,
        'theme_preference',     u.theme_preference,
        'last_login',           u.last_login,
        'has_employee_link',    (u.employee_id IS NOT NULL),
        'totp_enabled',         u.totp_enabled,
        'lineage_source',       'legacy_mirror.users',
        'lineage_run_id',       :'run_id'
    ))                                      AS user_metadata,
    u.created_at AT TIME ZONE 'UTC'         AS created_at,
    u.updated_at AT TIME ZONE 'UTC'         AS updated_at
FROM legacy_mirror.users u
LEFT JOIN legacy_mirror.employees_core ec ON u.employee_id = ec.id
LEFT JOIN legacy_mirror.employees_pii  ep ON u.employee_id = ep.employee_id
LEFT JOIN brownfield.tenant_id_mappings tm ON ec.tenant_id = tm.legacy_id
ON CONFLICT ON CONSTRAINT temp_sdbi_sys_users_tenant_email_uq DO NOTHING;
-- ↑ CRITICAL: handle the 4 reused emp_id cases gracefully at staging.
--   First user wins on (tenant, email); second silently skipped.
```

---

## 5. Phase 4 — Validation queries on staging

CLI X4 runs these and they MUST pass before Phase 5:

```sql
-- V1: staged row count matches expectation
SELECT COUNT(*) FROM temp_sdbi.sys_users;
-- expect: 268-272 (272 - 0..4 collision losers)

-- V2: source_join_path distribution
SELECT source_join_path, COUNT(*) FROM temp_sdbi.sys_users GROUP BY 1;
-- expect:
--   USER+EMP+PII     268-272 rows
--   USER_ONLY        2 rows (SUPERUSER)
--   USER+EMP_NO_PII  0 rows (sanity — 1:1 pii=core invariant)

-- V3: user_status distribution
SELECT user_status, COUNT(*) FROM temp_sdbi.sys_users GROUP BY 1 ORDER BY 1;
-- expect: ACTIVE ~261-265, DEACTIVATED 9, INACTIVE 0 (legacy.is_active=false ⇒ deleted_at also set)

-- V4: NULL checks on NOT NULL target columns
SELECT
    COUNT(*) FILTER (WHERE user_email IS NULL)        AS null_emails,
    COUNT(*) FILTER (WHERE user_display_name IS NULL) AS null_displays,
    COUNT(*) FILTER (WHERE user_tenant_id IS NULL)    AS null_tenants
FROM temp_sdbi.sys_users;
-- expect: 0, 0, 0

-- V5: CHECK constraint pre-validation (locale, status, type enums)
SELECT COUNT(*) FROM temp_sdbi.sys_users
WHERE user_status NOT IN ('ACTIVE','INACTIVE','SUSPENDED','PENDING_VERIFICATION','DEACTIVATED')
   OR user_type NOT IN ('STANDARD','SYNTHETIC_REFERENCE','SERVICE')
   OR (user_type='SYNTHETIC_REFERENCE') <> (user_is_synthetic=true);
-- expect: 0

-- V6: tenant FK pre-validation
SELECT COUNT(*) FROM temp_sdbi.sys_users tsu
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_tenancies t WHERE t.tenant_id = tsu.user_tenant_id);
-- expect: 0

-- V7: collision-with-target pre-check
SELECT COUNT(*) FROM temp_sdbi.sys_users tsu
WHERE EXISTS (
    SELECT 1 FROM sys.sys_users su
    WHERE su.user_tenant_id = tsu.user_tenant_id
      AND lower(su.user_email::text) = lower(tsu.user_email::text)
);
-- expect: 0 (defensive — would indicate authoring assumption broke)
-- If > 0: log details to audit, decide skip vs abort case by case.
```

Acceptance gate: V1–V7 all pass → proceed to Phase 5. Any FAIL → emit `audit.dbsync_lineage(action='VALIDATION_FAIL')`, ABORT, escalate to Cowork.

---

## 6. Diagnostic capture (always emit)

Regardless of pass/fail, capture in `audit.dbsync_lineage` a summary row per source:

```sql
INSERT INTO audit.dbsync_lineage (
    lineage_id, source_schema, source_table, source_pk, source_table_id,
    target_schema, target_table, target_pk, action, run_id, payload, created_at
)
SELECT
    gen_random_uuid(),
    'legacy_mirror', 'users', u.id::text, NULL,
    'temp_sdbi', 'sys_users',
    (SELECT tsu.user_id::text FROM temp_sdbi.sys_users tsu WHERE tsu.legacy_user_id = u.id),
    CASE
        WHEN EXISTS (SELECT 1 FROM temp_sdbi.sys_users tsu WHERE tsu.legacy_user_id = u.id)
            THEN 'STAGED'
        ELSE 'STAGED_SKIP_CONFLICT'
    END,
    :'run_id'::uuid,
    jsonb_build_object(
        'legacy_role', u.role,
        'has_employee_link', (u.employee_id IS NOT NULL),
        'is_active', u.is_active,
        'deleted_at', u.deleted_at
    ),
    now()
FROM legacy_mirror.users u;
```

This produces ~274 lineage rows per run (one per source). Phase 5 will add ~272 more (one per UPSERT outcome).

---

## 7. Estimated execution time

| Step                                       | Estimate              |
| ------------------------------------------ | --------------------- |
| DROP + CREATE temp_sdbi.sys_users          | <1 sec                |
| Pre-flight introspection (F1–F3)           | ~3 sec                |
| INSERT-SELECT (~274 rows scanned, joins)   | <2 sec                |
| Validation V1–V7                           | ~2 sec                |
| Diagnostic capture (~274 lineage rows)     | <1 sec                |
| **Phase 3+4 total**                        | **~10 sec**           |

CLI X4 should treat any phase taking >60s as anomalous and inspect (likely lock contention or unexpected data volume).

---

## 8. Cleanup policy

`temp_sdbi.sys_users` is **kept after Phase 5** (NOT dropped). Rationale:

- Lineage forensics: can be queried post-run for any audit question
- Phase 5 re-runs: re-using the same staging is the idempotent path
- Next pilot may reuse the join shape

Phase 5 in `04_PHASE5_CONSOLIDATION_PLAN.md` defines the actual UPSERT into `sys.sys_users`.
