-- ============================================================================
-- Migration 000130 — QW-C1 (S-100X-A4 / WS-C F-WS-C-1): add the missing
-- supporting indexes for the *_tenant_id FK filter (I5 isolation = FK +
-- middleware, present in nearly every list/filter API query) on the 6 largest
-- sys.* tables that had NO index leading with tenant_id → hidden per-tenant
-- sequential scans (tables up to 70 MB).
--
-- Plain CREATE INDEX IF NOT EXISTS (NOT CONCURRENTLY): migrate.sh applies each
-- file with `psql -1` (--single-transaction), and CREATE INDEX CONCURRENTLY
-- cannot run inside a transaction block. The plain build takes a brief SHARE
-- lock (blocks writes for a few seconds on this demo/test DB) — acceptable here.
-- Additive, idempotent (IF NOT EXISTS), touches no API contract / Zod schema.
-- Authored: 2026-06-16 (S993).
-- ============================================================================

CREATE INDEX IF NOT EXISTS sys_source_lineage_records_tenant_idx
  ON sys.sys_source_lineage_records (source_lineage_tenant_id);

CREATE INDEX IF NOT EXISTS sys_skills_tenant_idx
  ON sys.sys_skills (skill_tenant_id);

CREATE INDEX IF NOT EXISTS sys_auth_refresh_tokens_tenant_idx
  ON sys.sys_auth_refresh_tokens (auth_refresh_token_tenant_id);

CREATE INDEX IF NOT EXISTS sys_auth_login_events_tenant_idx
  ON sys.sys_auth_login_events (auth_login_event_tenant_id);

CREATE INDEX IF NOT EXISTS sys_learning_modules_tenant_idx
  ON sys.sys_learning_modules (learning_module_tenant_id);

CREATE INDEX IF NOT EXISTS sys_learning_paths_tenant_idx
  ON sys.sys_learning_paths (learning_path_tenant_id);
