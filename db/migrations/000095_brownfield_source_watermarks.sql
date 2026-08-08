-- @migrate: once
-- #164 F4 — questo file CREA oggetti dello schema `brownfield`, ritirato dalla
-- 000297. Senza il marcatore la catena lo ricreerebbe a ogni deploy e il ritiro
-- oscillerebbe (ADR-0035). Su un database nuovo gira comunque: il registro e' vuoto.
-- ============================================================================
-- Migration 000095 — cap⑤ scraping P2: brownfield.source_watermarks (delta/HWM layer)
-- ----------------------------------------------------------------------------
-- Spec: docs/superpowers/specs/2026-06-07-scraping-design.md §3.3 / §8.1 D-3.
-- The ONE structural piece the reference-sync capability was missing: a per-official-
-- source high-water-mark so each run is incremental + idempotent. It records, per
-- source, WHAT we last fetched (version cursor / etag / content hash) and the run-state,
-- so an unchanged upstream artifact is a cheap no-op (status UNCHANGED, no re-stage) and
-- the cursor only advances on a COMPLETED run (in the same transaction as the run-finish,
-- so a crash mid-load never advances the HWM).
--
-- This is brownfield INGESTION INFRA (aux schema, I3/I4) — NOT a sys.* business table,
-- so it is NOT in the reconciliation registry. Reference taxonomies are GLOBAL/tenant-less
-- (§4) → no tenant FK here. RD-08 categorical = varchar+CHECK (never ENUM); timestamptz
-- for time-of-day (RD-09). Idempotent. Authored: 2026-06-08 (cap⑤ P2).
-- ============================================================================

CREATE TABLE IF NOT EXISTS brownfield.source_watermarks (
  source_watermark_id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- stable source identifier (e.g. 'ESCO', 'ISTAT_CP2021', 'ATECO_2025').
  source_watermark_source_key         varchar(64)  NOT NULL UNIQUE,
  -- upstream version/release id last ingested (e.g. ESCO 'v1.2.0'); null when the
  -- source has no published version cursor (ESCO search API → driven by content hash).
  source_watermark_cursor             varchar(255),
  -- HTTP etag of the last artifact (conditional GET), when the source supports it.
  source_watermark_etag               varchar(255),
  -- sha256 (hex) of the last ingested artifact → skip-if-unchanged. varchar(64) (not
  -- char(64)) to avoid blank-padding comparison pitfalls.
  source_watermark_content_hash       varchar(64),
  source_watermark_last_fetched_at    timestamptz,
  source_watermark_last_succeeded_at  timestamptz,
  source_watermark_last_import_run_id uuid         REFERENCES brownfield.import_runs(import_run_id) ON DELETE SET NULL,
  -- run-state of the source. RD-08: varchar + CHECK, never ENUM.
  source_watermark_status             varchar(16)  NOT NULL DEFAULT 'IDLE',
  source_watermark_metadata           jsonb        NOT NULL DEFAULT '{}',
  created_at                          timestamptz  NOT NULL DEFAULT now(),
  updated_at                          timestamptz  NOT NULL DEFAULT now()
);

DO $sw$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'source_watermark_status_check') THEN
    ALTER TABLE brownfield.source_watermarks
      ADD CONSTRAINT source_watermark_status_check
      CHECK (source_watermark_status IN ('IDLE','FETCHING','STAGED','FAILED','UNCHANGED'));
  END IF;
END
$sw$;

-- Seed the ESCO source row (P1 source, enabled). Idempotent — a re-run keeps any
-- advanced state (DO NOTHING never clobbers a live watermark).
INSERT INTO brownfield.source_watermarks (source_watermark_source_key, source_watermark_status)
VALUES ('ESCO', 'IDLE')
ON CONFLICT (source_watermark_source_key) DO NOTHING;

DO $v$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM brownfield.source_watermarks WHERE source_watermark_source_key = 'ESCO';
  IF n <> 1 THEN
    RAISE EXCEPTION 'cap⑤ P2: expected exactly 1 ESCO watermark row, got %', n;
  END IF;
  RAISE NOTICE 'cap⑤ P2: brownfield.source_watermarks created + ESCO seeded (status IDLE).';
END
$v$;
