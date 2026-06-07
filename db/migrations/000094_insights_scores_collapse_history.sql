-- ============================================================================
-- Migration 000094 — D-18: collapse accumulated insights score history
-- ----------------------------------------------------------------------------
-- The cap③ insights score tables (sys_flight_risk_scores / sys_succession_readiness_scores
-- / sys_skill_gap_scores, mig 000082/000092) were append-with-latest-wins: every
-- POST .../recompute and every integration-test run INSERTed a new computed_at cohort,
-- and the read returns only the latest via DISTINCT ON. Functionally correct, but the
-- tables grew monotonically (measured pre-fix: ~9240 succession-readiness / ~1540
-- skill-gap rows for ~154 subjects).
--
-- The write path is now bounded (delete-then-insert per recomputed subject; see
-- apps/api/src/modules/insights/repository.ts). This migration does the ONE-TIME
-- backlog cleanup: keep only the active row(s) the read would return — the latest
-- computed_at per subject (flight-risk, skill-gap = per user; succession-readiness =
-- per (user, target position)) — and delete the older, never-read cohorts.
--
-- IDEMPOTENT: row_number()=1 keeps exactly the active row; a 2nd run finds nothing
-- with rn > 1 → deletes 0. No business data lost (deleted rows are superseded score
-- cohorts the read never surfaced). In-platform-derived analytics → no provenance to
-- preserve beyond the active score. Authored: 2026-06-08 (D-18).
-- ============================================================================

-- ── Slice A: flight-risk — active = latest per user ──
WITH ranked AS (
  SELECT flight_risk_score_id,
         row_number() OVER (
           PARTITION BY flight_risk_score_user_id
           ORDER BY flight_risk_score_computed_at DESC, flight_risk_score_id DESC
         ) AS rn
  FROM sys.sys_flight_risk_scores
)
DELETE FROM sys.sys_flight_risk_scores
WHERE flight_risk_score_id IN (SELECT flight_risk_score_id FROM ranked WHERE rn > 1);

-- ── Slice B: succession-readiness — active = latest per (user, target position) ──
WITH ranked AS (
  SELECT succession_readiness_score_id,
         row_number() OVER (
           PARTITION BY succession_readiness_score_user_id, succession_readiness_score_position_id
           ORDER BY succession_readiness_score_computed_at DESC, succession_readiness_score_id DESC
         ) AS rn
  FROM sys.sys_succession_readiness_scores
)
DELETE FROM sys.sys_succession_readiness_scores
WHERE succession_readiness_score_id IN (SELECT succession_readiness_score_id FROM ranked WHERE rn > 1);

-- ── Slice C: skill-gap — active = latest per user (read DISTINCT ON user) ──
WITH ranked AS (
  SELECT skill_gap_score_id,
         row_number() OVER (
           PARTITION BY skill_gap_score_user_id
           ORDER BY skill_gap_score_computed_at DESC, skill_gap_score_id DESC
         ) AS rn
  FROM sys.sys_skill_gap_scores
)
DELETE FROM sys.sys_skill_gap_scores
WHERE skill_gap_score_id IN (SELECT skill_gap_score_id FROM ranked WHERE rn > 1);

DO $d18$
DECLARE
  fr_dup int; sr_dup int; sg_dup int;
BEGIN
  -- Post-condition: exactly one active row per read-key (no duplicate cohorts remain).
  SELECT count(*) INTO fr_dup FROM (
    SELECT 1 FROM sys.sys_flight_risk_scores
    GROUP BY flight_risk_score_user_id HAVING count(*) > 1) x;
  SELECT count(*) INTO sr_dup FROM (
    SELECT 1 FROM sys.sys_succession_readiness_scores
    GROUP BY succession_readiness_score_user_id, succession_readiness_score_position_id HAVING count(*) > 1) y;
  SELECT count(*) INTO sg_dup FROM (
    SELECT 1 FROM sys.sys_skill_gap_scores
    GROUP BY skill_gap_score_user_id HAVING count(*) > 1) z;
  IF fr_dup <> 0 OR sr_dup <> 0 OR sg_dup <> 0 THEN
    RAISE EXCEPTION 'D-18 collapse failed: dup groups flight-risk=% succession=% skill-gap=%', fr_dup, sr_dup, sg_dup;
  END IF;
  RAISE NOTICE 'D-18: insights score history collapsed — one active row per subject (flight-risk/skill-gap=per user, succession-readiness=per user+position).';
END $d18$;
