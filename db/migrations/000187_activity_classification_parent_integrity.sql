-- ============================================================================
-- 000187 — #65 / audit F-A06: parent integrity for the NACE/ATECO adjacency.
--
-- Measured state (S1023): 6.533 rows across 3 schemes. NACE (levels 1-4) and
-- ATECO_2025 (levels 1-6) have complete parent chains. The legacy `ATECO`
-- scheme is a PARTIAL import — levels 5-6 only — kept because 920 crosswalk
-- rows in sys_activity_classification_mappings reference its level-5 codes
-- (source AND target): deleting it would break the crosswalk, and backfilling
-- its levels 1-4 from a different classification vintage would invent data.
--
-- Decision (technical, S1023): the ATECO partial scheme is a crosswalk-support
-- scheme, not a navigable hierarchy. Integrity becomes PROSPECTIVE:
--   1. composite FK (scheme, parent_code) → (scheme, code) declared NOT VALID:
--      every NEW/UPDATED row is enforced; the 920 documented legacy rows are
--      exempt (never VALIDATE this constraint without first resolving them);
--   2. monitoring view that reports any orphan OUTSIDE the documented
--      exception — 0 rows today, any new drift class surfaces immediately.
-- Idempotent + full-chain safe (drop/recreate of constraint and view).
-- ============================================================================

ALTER TABLE sys.sys_activity_classifications
  DROP CONSTRAINT IF EXISTS sys_activity_classifications_parent_fk;

ALTER TABLE sys.sys_activity_classifications
  ADD CONSTRAINT sys_activity_classifications_parent_fk
  FOREIGN KEY (activity_classification_scheme, activity_classification_parent_code)
  REFERENCES sys.sys_activity_classifications
    (activity_classification_scheme, activity_classification_code)
  NOT VALID;

CREATE OR REPLACE VIEW sys.v_activity_classification_parent_orphans AS
SELECT c.activity_classification_id,
       c.activity_classification_scheme  AS scheme,
       c.activity_classification_code    AS code,
       c.activity_classification_parent_code AS missing_parent,
       c.activity_classification_level   AS level
  FROM sys.sys_activity_classifications c
 WHERE c.activity_classification_parent_code IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_activity_classifications p
      WHERE p.activity_classification_scheme = c.activity_classification_scheme
        AND p.activity_classification_code   = c.activity_classification_parent_code)
   -- documented S1023 exception: the partial legacy ATECO scheme (levels 5-6
   -- only, crosswalk-support). Anything else showing up here is NEW drift.
   AND NOT (c.activity_classification_scheme = 'ATECO'
            AND c.activity_classification_level = 5);
