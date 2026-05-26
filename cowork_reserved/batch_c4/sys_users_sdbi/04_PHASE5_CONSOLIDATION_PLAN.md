# 04 — Phase 5: UPSERT into sys.sys_users + Lineage Emission

**Authored**: 2026-05-21 (Cowork)
**Phase context**: Phase 5 of SDBI pattern. Final consolidation from `temp_sdbi.sys_users` (staging) into `sys.sys_users` (target). Preserves the 5 existing STANDARD test admins + 158 SYNTHETIC_REFERENCE rows untouched.

---

## 1. Pre-Phase-5 invariants (must hold from Phase 4)

| # | Invariant                                                                                 | How verified              |
| - | ----------------------------------------------------------------------------------------- | ------------------------- |
| 1 | `temp_sdbi.sys_users` exists and has 268–272 rows                                         | V1                        |
| 2 | All staging rows have valid CHECK-compatible status/type/synthetic combination            | V5                        |
| 3 | All staging rows have valid `user_tenant_id` (FK target exists)                           | V6                        |
| 4 | No staging row would collide with existing sys.sys_users on UQ                            | V7 (0 collisions)         |
| 5 | `audit.dbsync_lineage` has 274 STAGED/STAGED_SKIP_CONFLICT rows for this run_id           | Diagnostic capture step   |

If ANY fails → ABORT before Phase 5. Phase 5 is the destructive (write-to-target) step.

---

## 2. The UPSERT statement

```sql
-- Capture pre-upsert snapshot for diff
\set run_id (:run_id)  -- carried from Phase 3
CREATE TEMP TABLE pre_upsert_snapshot AS
SELECT user_id, user_email, user_external_code, user_type, user_status
FROM sys.sys_users;
-- expected count: 163

-- THE upsert
WITH inserted AS (
    INSERT INTO sys.sys_users (
        user_id, user_tenant_id, user_external_code, user_email, user_display_name,
        user_first_name, user_last_name, user_status, user_type, user_is_synthetic,
        user_locale, user_timezone, user_metadata, created_at, updated_at
    )
    SELECT
        tsu.user_id, tsu.user_tenant_id, tsu.user_external_code, tsu.user_email,
        tsu.user_display_name, tsu.user_first_name, tsu.user_last_name,
        tsu.user_status, tsu.user_type, tsu.user_is_synthetic,
        tsu.user_locale, tsu.user_timezone, tsu.user_metadata,
        tsu.created_at, tsu.updated_at
    FROM temp_sdbi.sys_users tsu
    ON CONFLICT ON CONSTRAINT sys_users_tenant_email_uq DO NOTHING
    RETURNING user_id, user_external_code, user_email
)
SELECT COUNT(*) AS rows_inserted FROM inserted;
-- expect: 268–272
```

**Why DO NOTHING (not DO UPDATE)**: this is the test admin preservation guarantee. If a future legacy email somehow collides with an admin email (which it does not today, verified), we MUST NOT overwrite the admin. DO NOTHING is the safe default. Any legitimate update case (e.g., refreshing a legacy user's display_name) is OUT OF SCOPE for this pilot — it would be a separate "data refresh" pilot.

---

## 3. Lineage emission (per inserted row)

```sql
INSERT INTO audit.dbsync_lineage (
    lineage_id, source_schema, source_table, source_pk, source_table_id,
    target_schema, target_table, target_pk, action, run_id, payload, created_at
)
SELECT
    gen_random_uuid(),
    'legacy_mirror', 'users', tsu.legacy_user_id::text, NULL,  -- ADR-0015: nullable
    'sys', 'sys_users', su.user_id::text,
    CASE
        WHEN su.user_id IS NOT NULL THEN 'UPSERTED'
        ELSE                              'SKIP_CONFLICT_TARGET'
    END,
    :'run_id'::uuid,
    jsonb_build_object(
        'staging_user_id', tsu.user_id,
        'target_user_id', su.user_id,
        'source_join_path', tsu.source_join_path,
        'final_email', tsu.user_email,
        'final_tenant', tsu.user_tenant_id
    ),
    now()
FROM temp_sdbi.sys_users tsu
LEFT JOIN sys.sys_users su
    ON su.user_external_code = tsu.user_external_code;
```

After this, for any legacy user that did NOT make it (extremely rare given verified 0 conflicts), the lineage entry will show `SKIP_CONFLICT_TARGET` with target_pk=NULL.

---

## 4. Post-upsert acceptance verification (A1–A7)

```sql
-- A1: total row count in target window
SELECT COUNT(*) AS sys_users_count FROM sys.sys_users;
-- expect: 433-437 (163 + 268-272)

-- A2: 5 test admins still present, unchanged
SELECT user_id, user_email, user_display_name, user_type, user_status
FROM sys.sys_users
WHERE user_email IN (
    'admin@heuresys.com','tenant_admin_test@rtl-bank.test',
    'manager_test@rtl-bank.test','employee_test@rtl-bank.test',
    'outsider_test@rtl-bank.test'
)
ORDER BY user_email;
-- expect: exactly 5 rows, all user_type='STANDARD', all user_external_code IS NULL
-- diff vs pre_upsert_snapshot: 0 changes

-- A3: 158 SYNTHETIC_REFERENCE preserved
SELECT COUNT(*) FROM sys.sys_users WHERE user_type='SYNTHETIC_REFERENCE';
-- expect: 158

-- A4: new STANDARD users tagged with LEGACY: prefix
SELECT COUNT(*) FROM sys.sys_users
WHERE user_type='STANDARD' AND user_external_code LIKE 'LEGACY:%';
-- expect: 268-272

-- A5: UQ constraint satisfied
SELECT user_tenant_id, lower(user_email::text), COUNT(*)
FROM sys.sys_users
GROUP BY 1,2 HAVING COUNT(*) > 1;
-- expect: 0 rows

-- A6: lineage rows
SELECT action, COUNT(*) FROM audit.dbsync_lineage
WHERE target_schema='sys' AND target_table='sys_users' AND run_id = :run_id
GROUP BY 1;
-- expect: UPSERTED ~268-272, SKIP_CONFLICT_TARGET 0-4

-- A7: no FK orphan introduced (smoke test on 3 representative referencing tables)
SELECT
    (SELECT COUNT(*) FROM sys.sys_goals g
       WHERE g.goal_owner_user_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE u.user_id = g.goal_owner_user_id)) AS goal_orphans,
    (SELECT COUNT(*) FROM sys.sys_okrs o
       WHERE o.okr_owner_user_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE u.user_id = o.okr_owner_user_id))    AS okr_orphans,
    (SELECT COUNT(*) FROM sys.sys_positions p
       WHERE p.position_owner_user_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE u.user_id = p.position_owner_user_id)) AS position_orphans;
-- expect: 0, 0, 0
```

---

## 5. Rollback strategy (if A1–A7 fail)

This pilot does NOT use a transaction wrapping Phase 5 across multiple statements — PostgreSQL's UPSERT is atomic per-statement, but the **lineage emission** is a separate INSERT. CLI X4 should wrap Phase 5 + lineage in a single explicit transaction:

```sql
BEGIN;
  -- The UPSERT (§ 2)
  -- The lineage emission (§ 3)
  -- A1–A6 verification queries (don't fail loudly — capture results)
COMMIT;  -- or ROLLBACK if A1–A6 fail
```

If A7 fails (FK orphans appear), this would indicate a pre-existing bug NOT introduced by this pilot (since we only added rows, no deletes). Report but do NOT rollback for A7.

### 5.1 If A1 fails (count outside 433–437)

Likely cause: staging count drift since authoring (HC change). Action:
1. Capture full lineage state
2. ROLLBACK
3. Re-evaluate: was the source data extracted again? Did staging see fewer rows than expected?

### 5.2 If A2 fails (test admin missing/changed)

CRITICAL — should never happen with DO NOTHING. If it does:
1. ROLLBACK immediately
2. Emit emergency lineage row `action='TEST_ADMIN_LOST'`
3. Halt entire batch — escalate to Cowork inbox + Enzo

### 5.3 If A5 fails (UQ violation)

Should be physically impossible given the constraint, but if a constraint was dropped:
1. ROLLBACK
2. Re-verify `\d sys.sys_users` shows the UQ
3. Restart from Phase 3

---

## 6. Post-pilot smoke test (unblocking validation)

Demonstrate that the FK pool is now usable for downstream pilots:

```sql
-- S1: Goals pilot can now resolve check_in_subject_user_id from a wider population
SELECT
    (SELECT COUNT(*) FROM sys.sys_users WHERE user_type='STANDARD') AS standard_users_available_for_fk,
    (SELECT COUNT(*) FROM sys.sys_users) AS total_users_available;
-- expect: ~273 standard + 158 synth = ~431 total available
-- (vs pre-pilot: 5 standard + 158 synth = 163 total)

-- S2: sample 5 random legacy-migrated users (sanity check the merged data shape)
SELECT user_id, user_email, user_display_name, user_first_name, user_last_name,
       user_status, user_external_code, user_metadata->'legacy_role' AS legacy_role
FROM sys.sys_users
WHERE user_external_code LIKE 'LEGACY:%'
ORDER BY random() LIMIT 5;
-- expected: well-formed rows, recognisable Italian names, legacy_role populated

-- S3: SUPERUSER edge case landed correctly
SELECT user_email, user_display_name, user_metadata->>'legacy_role', user_metadata->>'legacy_username'
FROM sys.sys_users
WHERE user_email LIKE '%@legacy.heuresys.local';
-- expect: 2 rows (sysadmin, evo.dev)
```

---

## 7. Final lineage closure row

After successful Phase 5, emit a SUMMARY row:

```sql
INSERT INTO audit.dbsync_lineage (
    lineage_id, source_schema, source_table, source_pk, source_table_id,
    target_schema, target_table, target_pk, action, run_id, payload, created_at
)
VALUES (
    gen_random_uuid(),
    'legacy_mirror', '*', NULL, NULL,
    'sys', 'sys_users', NULL,
    'PILOT_COMPLETE',
    :'run_id'::uuid,
    jsonb_build_object(
        'pilot', 'C4.3_sys_users_sdbi',
        'rows_pre',  (SELECT COUNT(*) FROM pre_upsert_snapshot),
        'rows_post', (SELECT COUNT(*) FROM sys.sys_users),
        'rows_inserted', (SELECT COUNT(*) FROM sys.sys_users) - (SELECT COUNT(*) FROM pre_upsert_snapshot),
        'rows_skipped', 274 - ((SELECT COUNT(*) FROM sys.sys_users) - (SELECT COUNT(*) FROM pre_upsert_snapshot)),
        'test_admins_preserved', (
            SELECT COUNT(*) FROM sys.sys_users
            WHERE user_email IN ('admin@heuresys.com','tenant_admin_test@rtl-bank.test',
                                 'manager_test@rtl-bank.test','employee_test@rtl-bank.test',
                                 'outsider_test@rtl-bank.test')
        ),
        'synthetic_preserved', (SELECT COUNT(*) FROM sys.sys_users WHERE user_type='SYNTHETIC_REFERENCE'),
        'acceptance_a1_a7_status', 'PASS',  -- CLI sets to FAIL if any A failed
        'authoring_baseline_date', '2026-05-21'
    ),
    now()
);
```

---

## 8. Handoff to next pilots (the unblock)

Once Phase 5 completes successfully:

| Downstream pilot                              | Now unblocked because…                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Goals/OKRs SDBI (C1.8/C2.3)                   | `goal_owner_user_id`, `check_in_subject_user_id`, etc. have ~430+ rows to draw from     |
| Performance Reviews SDBI (future)             | `reviewer_user_id`, `reviewee_user_id` FK resolution                                     |
| Attendance / Time-Leave SDBI (C4.2)           | Per-user attendance rows can now reference real legacy employees                          |
| Compensation SDBI                             | `compensation_recommendation_user_id`, etc.                                              |
| Auth identity SDBI (future C5+)               | Can now layer `sys_auth_credentials.user_id` FK onto the merged user pool               |

**Critical**: any downstream pilot that does its own `legacy_mirror.users.id → sys.sys_users.user_id` resolution MUST use the `user_external_code = 'LEGACY:<users.id>'` lookup pattern. NOT `user_id` (UUIDs were regenerated). Document this in PROMPT 007.

---

## 9. CLI X4 execution checklist (linear)

CLI X4 follows this sequence (everything else above is reference):

```
1. ACQUIRE LOCK (cowork_reserved/.lock — release-if-mine pattern)
2. PHASE 1 — Pre-flight introspection (F1–F3 from 03_*.md §3)
   → if any fails: ABORT + inbox.notify Cowork
3. PHASE 2 — (no schema migration needed — sys.sys_users already exists)
4. PHASE 3 — DDL temp_sdbi.sys_users + INSERT-SELECT (03_*.md §2, §4)
5. PHASE 4 — Validation V1–V7 (03_*.md §5)
   → if any fails: emit lineage + ABORT
6. PHASE 5 — BEGIN tx → UPSERT (this file §2) → Lineage (§3) → A1–A6 (§4) → COMMIT or ROLLBACK
7. PHASE 5 SMOKE — S1, S2, S3 (this file §6)
8. PHASE 5 CLOSURE — Final SUMMARY lineage row (this file §7)
9. RELEASE LOCK
10. EMIT report file _04_REPORT_007_<timestamp>.md to cowork_code_exchange/ (success or partial)
```

Effort budget: ~30–45 min including paranoia checks and report writeup.
