-- ============================================================================
-- Migration 000193 — Fase 3 (chiusura brownfield): drop dei residui staging
-- MORTI NETTI (mandato S1023 §3; census F3 §4, D-69).
--
-- Scope CONSERVATIVO — solo ciò che è 0-righe-utili + 0-ref-runtime (verificato
-- via fan-out forense S1024): le scratch table delle wave-migration e lo schema
-- staging SDBI mai letto a runtime.
--   - staging.tmp_*            (29 scratch intermedie delle wave-migration)
--   - staging.legacy_rtl_occupations (0 righe, 0 ref ovunque)
--   - temp_sdbi.pf_* (4) + DROP SCHEMA temp_sdbi (Phase-6 cleanup mai eseguito, mig 000036)
--
-- NON toccati (per scelta):
--   - staging.rtl_*   → landing raw RTL, eventuale riferimento per il seeding
--     skill (Blocco B); drop rimandato a blocco dedicato.
--   - staging.wave1_* → gated dalla decisione Wave-3 (#17, HOLD Enzo).
--   - brownfield.*    → VIVO (scritto dalla pipeline reference-sync attiva). NON è legacy.
--   - audit.skills_junk_archive → archivio rollback di 000160, drop a retention chiusa.
--
-- Idempotente (DROP IF EXISTS dinamico per pattern) + twice-run (2° giro: 0 drop).
-- Authored: 2026-07-21 (S1024).
-- ============================================================================

DO $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  -- staging.tmp_* + legacy_rtl_occupations
  FOR r IN
    SELECT tablename FROM pg_tables
     WHERE schemaname = 'staging'
       AND (tablename LIKE 'tmp\_%' OR tablename = 'legacy_rtl_occupations')
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS staging.%I CASCADE', r.tablename);
    RAISE NOTICE 'dropped staging.%', r.tablename;
    n := n + 1;
  END LOOP;

  -- temp_sdbi.* (schema intero: pf_* + qualsiasi residuo) poi lo schema
  IF to_regnamespace('temp_sdbi') IS NOT NULL THEN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'temp_sdbi'
    LOOP
      EXECUTE format('DROP TABLE IF EXISTS temp_sdbi.%I CASCADE', r.tablename);
      RAISE NOTICE 'dropped temp_sdbi.%', r.tablename;
      n := n + 1;
    END LOOP;
    EXECUTE 'DROP SCHEMA IF EXISTS temp_sdbi CASCADE';
    RAISE NOTICE 'dropped schema temp_sdbi';
  END IF;

  RAISE NOTICE '000193: % oggetti brownfield morti rimossi', n;
END $$;

-- Post-condition: nessun residuo morto atteso
DO $$
DECLARE
  leftover integer;
BEGIN
  SELECT count(*) INTO leftover FROM pg_tables
   WHERE (schemaname = 'staging' AND (tablename LIKE 'tmp\_%' OR tablename = 'legacy_rtl_occupations'))
      OR schemaname = 'temp_sdbi';
  IF leftover > 0 THEN
    RAISE EXCEPTION '000193: % residui morti ancora presenti', leftover;
  END IF;
  IF to_regnamespace('temp_sdbi') IS NOT NULL THEN
    RAISE EXCEPTION '000193: schema temp_sdbi ancora presente';
  END IF;
END $$;
