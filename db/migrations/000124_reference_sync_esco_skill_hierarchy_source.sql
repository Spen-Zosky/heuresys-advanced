-- @migrate: once
-- #164 F4 — registra la sorgente ESCO_SKILL_HIERARCHY — l effetto TRASLOCA con la tabella. Lo schema `brownfield` e le tabelle `audit.import_*`
-- sono ritirati dalla 000297; senza il marcatore questo file cadrebbe (o li
-- ricreerebbe) a ogni deploy. Su un database nuovo gira comunque: il registro
-- e' vuoto e nulla viene saltato.
-- Migration 000124 — cap⑤ T1.1: seed the ESCO_SKILL_HIERARCHY source watermark
-- ----------------------------------------------------------------------------
-- T1.1 (spec docs/integrations/..._03_esco_population_spec_2026-06-15.md §1): the
-- reference-sync capability gains a backfill source that resolves the ESCO skill
-- hierarchy (`broaderHierarchyConcept` → skill_group_uri, `broaderSkill` →
-- broader_uri) for the ~14k sys.sys_skills rows carrying skill_esco_uri, merging
-- the result idempotently into skill_metadata (NO new column). Resolution is
-- server-side via apps/api/src/modules/reference-sync/esco-connector.ts behind the
-- EscoSkillFetcher seam; persistence + watermark live in repository.ts/service.ts.
--
-- Mirrors the ESCO/ATECO_2025 seeds (000095/000109): one IDLE watermark row, DO
-- NOTHING so a re-run never clobbers a live/advanced watermark. Idempotent.
-- No new permission needed — reference_sync:trigger is source-agnostic (000084).

INSERT INTO brownfield.source_watermarks (source_watermark_source_key, source_watermark_status)
VALUES ('ESCO_SKILL_HIERARCHY', 'IDLE')
ON CONFLICT (source_watermark_source_key) DO NOTHING;

DO $v$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM brownfield.source_watermarks WHERE source_watermark_source_key = 'ESCO_SKILL_HIERARCHY';
  IF n <> 1 THEN
    RAISE EXCEPTION 'cap⑤ T1.1: expected exactly 1 ESCO_SKILL_HIERARCHY watermark row, got %', n;
  END IF;
END
$v$;
