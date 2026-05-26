-- ============================================================================
-- Migration 000034 — SDBI temp_sdbi schema bootstrap
-- ----------------------------------------------------------------------------
-- ADR-0014 §3.2: temp_sdbi.* schema inside heuresys_advanced (NOT separate DB)
-- Purpose: hosting transient mirror tables (no-FK) for SDBI Phase 3 seeding
--          before consolidation into sys.* in Phase 5.
-- ----------------------------------------------------------------------------
-- Idempotent: CREATE SCHEMA IF NOT EXISTS
-- Reversibility: DROP SCHEMA temp_sdbi CASCADE (Phase 6 cleanup uses table-level DROP TABLE, not schema-level)
-- ----------------------------------------------------------------------------
-- Authored: 2026-05-20 (Batch C1.8 — Goals/OKRs pilot)
-- ============================================================================

BEGIN;

-- §1 — Schema creation
CREATE SCHEMA IF NOT EXISTS temp_sdbi;

COMMENT ON SCHEMA temp_sdbi IS
  'SDBI (Semantic-Driven Brownfield Import) transient staging — ADR-0014. '
  'Tables here are mirror-of-sys.* without FK constraints; populated by Phase 3 INSERT...SELECT, '
  'consolidated into sys.* in Phase 5, dropped in Phase 6. TRUNCATE-and-retry safe.';

-- §2 — Privileges (assume single heuresys role for now)
-- heuresys user already has CREATE/USAGE on database; no extra GRANT needed at schema-level.
-- If multi-role separation needed later, add: GRANT USAGE, CREATE ON SCHEMA temp_sdbi TO heuresys;

-- §3 — Migration audit (uses existing sys.sys_schema_migrations runner pattern)
-- Audit row inserted by migration runner upstream — no INSERT here.

COMMIT;
