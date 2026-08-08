-- @migrate: once
-- #164 F4 — registra la sorgente ATECO nelle filigrane — l effetto TRASLOCA con la tabella. Lo schema `brownfield` e le tabelle `audit.import_*`
-- sono ritirati dalla 000297; senza il marcatore questo file cadrebbe (o li
-- ricreerebbe) a ogni deploy. Su un database nuovo gira comunque: il registro
-- e' vuoto e nulla viene saltato.
-- Migration 000109 — cap⑤ P2: seed the ATECO_2025 source watermark (ISTAT 2nd source)
-- ----------------------------------------------------------------------------
-- S983 WS-C: the reference-sync capability gains its second official source —
-- the ISTAT ATECO 2025 economic-activity classification (official XLSX artifact,
-- parsed by apps/api/src/modules/reference-sync/istat-ateco-connector.ts into
-- sys.sys_activity_classifications under scheme 'ATECO_2025'; the legacy
-- 'ATECO'/'NACE' brownfield rows stay untouched — parallel generation).
-- Mirrors the ESCO seed in 000095: one IDLE watermark row, DO NOTHING so a
-- re-run never clobbers a live/advanced watermark. Idempotent.

INSERT INTO brownfield.source_watermarks (source_watermark_source_key, source_watermark_status)
VALUES ('ATECO_2025', 'IDLE')
ON CONFLICT (source_watermark_source_key) DO NOTHING;

DO $v$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM brownfield.source_watermarks WHERE source_watermark_source_key = 'ATECO_2025';
  IF n <> 1 THEN
    RAISE EXCEPTION 'cap⑤ P2: expected exactly 1 ATECO_2025 watermark row, got %', n;
  END IF;
END
$v$;
