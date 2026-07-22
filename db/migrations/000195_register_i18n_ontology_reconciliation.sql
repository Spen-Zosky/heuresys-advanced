-- ============================================================================
-- Migration 000195 — D-74 (a): registra nel reconciliation registry le 2 tabelle
-- introdotte in S1024 e mai registrate:
--   • sys_reference_translations (mig 000190, ADR-0029 — i18n IT/EN)
--   • sys_skill_groups           (mig 000192, ADR-0030 — ontologia ESCO)
--
-- Su PROD entrambe risolvono POPULATED (29.511 traduzioni / 640 gruppi caricati
-- dal dataset ESCO ufficiale), quindi il gap era invisibile; su un DB dove il
-- dataset non è caricato (heuresys_ci) risolvono UNCLASSIFIED e rompono
-- l'invariante cardinale "0 UNCLASSIFIED" asserito da 5 suite di test.
-- La classificazione è EXCLUDE / bucket D (come le embedding di 000062): dati
-- di riferimento app-generated da dataset ESCO ufficiale, NON target di
-- riconciliazione legacy (heuresys-evo non ha i18n né l'ontologia gruppi).
--
-- IDEMPOTENTE: INSERT ... ON CONFLICT DO NOTHING. Authored: 2026-07-22 (S1025).
-- ============================================================================

INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name,
   reconciliation_registry_bucket,
   reconciliation_registry_declared_status,
   reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_reference_translations', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — reference i18n IT/EN (ADR-0029, mig 000190). Traduzioni skill/governance/gruppi dal dataset ESCO ufficiale fornito offline; app/reference data, non un target di riconciliazione legacy.]'),
  ('sys_skill_groups', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — ontologia gruppi skill ESCO (ADR-0030, mig 000192). Gerarchia 4 livelli derivata dal dataset ESCO ufficiale; app/reference data, non un target di riconciliazione legacy.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $$
DECLARE n_unclassified int;
BEGIN
  SELECT count(*) INTO n_unclassified
  FROM sys.v_reconciliation_status
  WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000195: attese 0 UNCLASSIFIED dopo la registrazione, trovate %', n_unclassified;
  END IF;
  RAISE NOTICE '000195: sys_reference_translations + sys_skill_groups registrate EXCLUDE; 0 UNCLASSIFIED.';
END $$;
