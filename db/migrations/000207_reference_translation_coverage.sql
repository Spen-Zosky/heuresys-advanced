-- ============================================================================
-- Migration 000207 — Gate di COMPLETEZZA per l'i18n dei dati (ADR-0029).
-- Proposta Cowork 2026-07-22 (COWORK_INBOX "i18n: gate di COPERTURA"),
-- adottata dal CLI (numerazione reale 000207; il PROPOSED era "000202").
--
-- Complementa la vista di INTEGRITÀ sys.v_reference_translation_orphans
-- (mig 000190): quella prova che nessuna traduzione punta a righe morte;
-- QUESTA prova che ogni riga viva con testo IT-canonico ha il suo overlay
-- nella lingua bersaglio (default 'en'). Entrambe sono PILOTATE DAL REGISTRO
-- sys.sys_translatable_field: qualunque tabella nuova (incluse le
-- sys_occupation_classifications di 000206) è coperta AUTOMATICAMENTE
-- appena registra i suoi campi.
--
-- Semantica di `missing` (signed):
--   > 0 → sotto-copertura (righe IT senza overlay EN)
--   < 0 → anomalia (overlay EN su righe con IT-canonico vuoto — investigare)
--
-- Consumo: status_dashboard.py (sezione DB). NON è un gate hard in CI:
-- heuresys_ci non carica i dataset ESCO/occupations (stessa ragione di 000195),
-- quindi lì la copertura è strutturalmente incompleta.
--
-- Pura lettura (fn STABLE + view) → idempotente, re-runnable, twice-run safe.
-- Authored: 2026-07-22 (S1027).
-- ============================================================================

CREATE OR REPLACE FUNCTION sys.fn_reference_translation_coverage(target_locale varchar DEFAULT 'en')
RETURNS TABLE (
  entity_table varchar,
  field        varchar,
  base_rows    bigint,   -- righe con testo IT-canonico non vuoto (in-row)
  translated   bigint,   -- overlay presenti nella lingua bersaglio
  missing      bigint    -- base_rows - translated (signed, vedi header)
) AS $$
DECLARE
  r record;
  b bigint;
  t bigint;
BEGIN
  FOR r IN
    SELECT f.entity_table, f.entity_pk_column, f.field, f.entity_field_column
    FROM sys.sys_translatable_field f
    ORDER BY f.entity_table, f.field
  LOOP
    -- difensivo: solo tabelle realmente esistenti nello schema sys
    IF to_regclass('sys.' || r.entity_table) IS NULL THEN
      CONTINUE;
    END IF;

    -- conteggio righe base con testo IT-canonico non vuoto (dinamico sul registro)
    EXECUTE format(
      'SELECT count(*) FROM sys.%I WHERE %I IS NOT NULL AND length(trim(%I::text)) > 0',
      r.entity_table, r.entity_field_column, r.entity_field_column
    ) INTO b;

    -- overlay presenti per (entity_table, field, locale)
    SELECT count(*) INTO t
    FROM sys.sys_reference_translations x
    WHERE x.entity_table = r.entity_table
      AND x.field        = r.field
      AND x.locale       = target_locale;

    entity_table := r.entity_table;
    field        := r.field;
    base_rows    := b;
    translated   := t;
    missing      := b - t;
    RETURN NEXT;
  END LOOP;
END $$ LANGUAGE plpgsql STABLE;

-- Vista comoda (lingua bersaglio 'en', la "seconda" lingua rispetto all'IT canonico)
CREATE OR REPLACE VIEW sys.v_reference_translation_coverage AS
  SELECT * FROM sys.fn_reference_translation_coverage('en');

-- Post-condition (fail-loud, CI-safe: la vista deve essere eseguibile;
-- NESSUN assert su missing=0 — su heuresys_ci i dataset non sono caricati)
DO $$
DECLARE n_gap int; n_anom int;
BEGIN
  SELECT count(*) INTO n_gap  FROM sys.v_reference_translation_coverage WHERE missing > 0;
  SELECT count(*) INTO n_anom FROM sys.v_reference_translation_coverage WHERE missing < 0;
  RAISE NOTICE '000207: i18n coverage — % campi con overlay EN mancanti, % anomalie (overlay su base vuota)', n_gap, n_anom;
END $$;
