-- =============================================================================
-- 000001_init_extensions.sql
-- Heuresys Advanced — PostgreSQL extensions used by the canonical stack
-- -----------------------------------------------------------------------------
-- Runs first. Idempotent (CREATE EXTENSION IF NOT EXISTS).
-- Audit row in sys.sys_schema_migrations is written by the migrate runner
-- AFTER 000002 creates the audit table (guarded by table-exists check).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- uuid_generate_v4() (compat with legacy)
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- trigram similarity (search / fuzzy)
