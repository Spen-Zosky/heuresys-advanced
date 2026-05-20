-- =============================================================================
-- 000031_add_uq_sys_user_certifications.sql
-- Heuresys Advanced — Goal 002 enabler: add UNIQUE INDEX on sys.sys_user_certifications
-- so the brownfield wave executor's SQL-side `executeUpsertSqlSidePerMapping`
-- (in apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts) can populate
-- `targetMeta.conflictInference` and emit a real ON CONFLICT clause instead of
-- skipping the mapping with `no_conflict_inference_available`.
-- -----------------------------------------------------------------------------
-- Background
-- ----------
-- Goal 001a REPORT §7 item 3 documented that 1 brownfield column_mapping
-- (target sys.sys_user_certifications) consistently skipped during wave 1
-- execution because the target table had only its PRIMARY KEY (`user_certification_id`,
-- auto-generated uuid) — no other UNIQUE constraint or UNIQUE INDEX from which
-- engine.ts::loadTargetMeta() (lines 97-141, query against pg_index) could
-- derive a natural-key conflict target.
--
-- Goal 001a REVIEW §3.3 left the decision open between:
--   (a) emit ON CONFLICT DO NOTHING (silent first-write-wins)
--   (b) emit error + audit row (explicit failure semantics)
--   (c) add UQ to target table via migration (eliminates the case)
--
-- Goal 002 chooses (c) PLUS the SQL-side compiler continues to emit (b) for any
-- table that still lacks a UQ in the future. (a) is rejected for audit-quality
-- reasons.
--
-- Natural key design
-- ------------------
-- `(user_certification_tenant_id, user_certification_user_id, user_certification_name,
--   user_certification_issuer, COALESCE(user_certification_issued_date,'0001-01-01'::date))`
--
-- Rationale:
--   - tenant_id: scopes uniqueness per tenant (multi-tenant invariant I5)
--   - user_id: a person can hold multiple distinct certifications
--   - name + issuer: distinguishes "AWS Solutions Architect" from "Azure SA"
--     and "Coursera Python" from "edX Python"
--   - issued_date: the SAME certification may be re-issued annually (e.g. ITIL
--     v3 → v4, AWS recertification). COALESCE handles NULL issued_date by
--     mapping it to a sentinel '0001-01-01' so PG's "(NULL, NULL) is not equal
--     to (NULL, NULL)" quirk doesn't allow duplicate NULL-issued rows.
--
-- Idempotency: uses CREATE UNIQUE INDEX IF NOT EXISTS, safe to re-run.
-- Reversibility: DROP INDEX IF EXISTS sys.sys_user_certifications_natural_key_uq;
--
-- =============================================================================

-- 1. Add the UNIQUE INDEX
CREATE UNIQUE INDEX IF NOT EXISTS sys_user_certifications_natural_key_uq
  ON sys.sys_user_certifications (
    user_certification_tenant_id,
    user_certification_user_id,
    user_certification_name,
    user_certification_issuer,
    COALESCE(user_certification_issued_date, '0001-01-01'::date)
  );

-- 2. Comment for future operators
COMMENT ON INDEX sys.sys_user_certifications_natural_key_uq IS
  'Natural-key UNIQUE constraint added by migration 000031 (Goal 002 enabler). Allows brownfield wave executor SQL-side UPSERT path to emit ON CONFLICT on (tenant, user, name, issuer, COALESCE(issued_date,sentinel)). Without this index, the executor would skip mappings targeting this table with reason=no_conflict_inference_available.';

-- 3. Record in the migrations table (idempotent; ON CONFLICT DO NOTHING in
--    the migrate.{sh,ps1} runner wraps every migration in an INSERT to
--    sys.sys_schema_migrations after successful application — no explicit
--    INSERT here per the existing migration convention).

-- 4. Verification query for the operator (commented; run manually post-apply):
-- SELECT indexname, indexdef FROM pg_indexes
--   WHERE schemaname='sys' AND indexname='sys_user_certifications_natural_key_uq';
-- Expected: 1 row with indexdef matching the CREATE statement above.

-- =============================================================================
-- end of 000031_add_uq_sys_user_certifications.sql
-- =============================================================================
