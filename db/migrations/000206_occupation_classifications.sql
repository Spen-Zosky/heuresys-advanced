-- ============================================================================
-- Migration 000206 — Asse PROFESSIONE come catalogo di prima classe.
-- Proposta Cowork 2026-07-22 (COWORK_INBOX "Asse professione"), valutata e
-- adattata dal CLI: chiude il Gap A (catalogo ISCO-08 gerarchico standalone,
-- oggi l'ISCO vive solo come attributo `esco_occupation_mapping_isco_code` su
-- sys_esco_occupation_mappings, mig 000010) e prepara il Gap B (CP2021 Istat,
-- mai istanziato). Simmetrico all'asse ATTIVITÀ (sys_activity_classifications,
-- mig 000007): stesso pattern scheme/code/parent_code, unique (scheme,code),
-- parent index parziale, metadata jsonb, trigger sys_set_updated_at.
--
-- Deviazioni dal DDL PROPOSED di Cowork (decisioni CLI):
--   • CHECK scheme STRICT ('ISCO_08','CP_2021') senza 'ESCO': le occupazioni
--     ESCO vivono già in sys_esco_occupation_mappings (ADR-0016) — includerle
--     qui aprirebbe alla duplicazione del catalogo. Relax futuro = migration
--     dedicata (precedente: 000032).
--   • Registrazione nel reconciliation registry (bucket D EXCLUDE) nella
--     STESSA migration che crea le tabelle — invariante cardinale
--     "0 UNCLASSIFIED" asserito da 5 suite (precedente: 000195).
--   • Registrazione i18n del campo `name` in sys_translatable_field
--     (ADR-0029: IT canonico in-row + overlay EN in sys_reference_translations).
--     `description` NON registrata: il seed non la popola; si registra
--     quando/se popolata.
--
-- Il popolamento vive in db/scripts/populate-occupation-classifications.sql
-- (idempotente, CSV in db/data/occupations/): ISCO_08 619 nodi (L1-4
-- 10/43/130/436, titoli IT da ESCO API) + CP_2021 1502 nodi (L1-5
-- 9/40/130/510/813, Istat/INAIL). Migration default-safe: tabelle vuote =
-- zero impatto.
--
-- IDEMPOTENTE + twice-run safe. Authored: 2026-07-22 (S1027).
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. sys.sys_occupation_classifications — catalogo ISCO-08 + CP2021
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_occupation_classifications (
  occupation_classification_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  occupation_classification_scheme      varchar(32)  NOT NULL,
  occupation_classification_code        varchar(32)  NOT NULL,
  occupation_classification_parent_code varchar(32),
  occupation_classification_name        varchar(255) NOT NULL,
  occupation_classification_description text,
  occupation_classification_level       smallint,
  occupation_classification_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $scheme_check$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'sys_occupation_classifications_scheme_check'
      AND conrelid = 'sys.sys_occupation_classifications'::regclass
  ) THEN
    ALTER TABLE sys.sys_occupation_classifications
      ADD CONSTRAINT sys_occupation_classifications_scheme_check
      CHECK (occupation_classification_scheme IN ('ISCO_08', 'CP_2021'));
  END IF;
END $scheme_check$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_occupation_classifications_scheme_code_uq
  ON sys.sys_occupation_classifications (occupation_classification_scheme, occupation_classification_code);

CREATE INDEX IF NOT EXISTS sys_occupation_classifications_parent_idx
  ON sys.sys_occupation_classifications (occupation_classification_scheme, occupation_classification_parent_code)
  WHERE occupation_classification_parent_code IS NOT NULL;

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_occupation_classifications_set_updated_at' AND tgrelid = 'sys.sys_occupation_classifications'::regclass) THEN
    CREATE TRIGGER sys_occupation_classifications_set_updated_at BEFORE UPDATE ON sys.sys_occupation_classifications FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 2. sys.sys_occupation_classification_mappings — crosswalk cross-scheme
--    (gemella di sys_activity_classification_mappings, 000007 §2). Nasce vuota:
--    il popolamento ISCO↔CP2021 richiede la tavola di corrispondenza ufficiale
--    Istat (follow-up); ISCO↔ESCO è risolto dalla VIEW al §3 (no righe ESCO qui).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_occupation_classification_mappings (
  occupation_class_mapping_id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  occupation_class_mapping_source_id  uuid         NOT NULL REFERENCES sys.sys_occupation_classifications(occupation_classification_id) ON DELETE CASCADE,
  occupation_class_mapping_target_id  uuid         NOT NULL REFERENCES sys.sys_occupation_classifications(occupation_classification_id) ON DELETE CASCADE,
  occupation_class_mapping_kind       varchar(32)  NOT NULL DEFAULT 'EXACT',
  occupation_class_mapping_confidence numeric(4,3) NOT NULL DEFAULT 1.000,
  occupation_class_mapping_metadata   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $kind_check$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'sys_occupation_class_mapping_kind_check'
      AND conrelid = 'sys.sys_occupation_classification_mappings'::regclass
  ) THEN
    ALTER TABLE sys.sys_occupation_classification_mappings
      ADD CONSTRAINT sys_occupation_class_mapping_kind_check
      CHECK (occupation_class_mapping_kind IN ('EXACT','NARROWER','BROADER','RELATED','APPROXIMATE'));
  END IF;
END $kind_check$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_occupation_class_mapping_pair_uq
  ON sys.sys_occupation_classification_mappings (occupation_class_mapping_source_id, occupation_class_mapping_target_id);

DO $trg2$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_occupation_class_mappings_set_updated_at' AND tgrelid = 'sys.sys_occupation_classification_mappings'::regclass) THEN
    CREATE TRIGGER sys_occupation_class_mappings_set_updated_at BEFORE UPDATE ON sys.sys_occupation_classification_mappings FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg2$;

-- -----------------------------------------------------------------------------
-- 3. VIEW sys.sys_esco_isco_resolved — aggancio ADDITIVO all'ESCO esistente.
--    L'attributo esco_occupation_mapping_isco_code resta l'unica verità
--    scritta (ADR-0016, zero-breaking); qui viene risolto verso il catalogo
--    ISCO-08 per unit-group (split_part toglie eventuali suffissi ESCO ".x").
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW sys.sys_esco_isco_resolved AS
SELECT e.esco_occupation_mapping_id,
       e.esco_occupation_mapping_esco_uri,
       e.esco_occupation_mapping_isco_code,
       o.occupation_classification_id   AS isco_classification_id,
       o.occupation_classification_name AS isco_label
FROM sys.sys_esco_occupation_mappings e
LEFT JOIN sys.sys_occupation_classifications o
  ON o.occupation_classification_scheme = 'ISCO_08'
 AND o.occupation_classification_code   = split_part(e.esco_occupation_mapping_isco_code, '.', 1);

-- -----------------------------------------------------------------------------
-- 4. Reconciliation registry — bucket D EXCLUDE (invariante 0 UNCLASSIFIED,
--    precedente 000195): reference data da fonti ufficiali (ILO/ESCO/Istat),
--    NON target di riconciliazione legacy (heuresys-evo non ha ISCO/CP2021).
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name,
   reconciliation_registry_bucket,
   reconciliation_registry_declared_status,
   reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_occupation_classifications', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — catalogo asse professione ISCO-08 (ILO/ESCO) + CP2021 (Istat), mig 000206. Reference data da fonti ufficiali, seed in db/data/occupations/; non un target di riconciliazione legacy.]'),
  ('sys_occupation_classification_mappings', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — crosswalk cross-scheme dell''asse professione (ISCO↔CP2021), mig 000206. Derivato da corrispondenze ufficiali; non un target di riconciliazione legacy.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Registrazione i18n (ADR-0029): `name` è IT-canonico in-row; l''overlay EN
--    vive in sys_reference_translations. Il gate di copertura (000207) copre
--    automaticamente la nuova entity via registro.
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_translatable_field
  (entity_table, entity_pk_column, field, entity_field_column, note)
VALUES
  ('sys_occupation_classifications','occupation_classification_id','name','occupation_classification_name','catalogo professioni ISCO-08/CP2021')
ON CONFLICT (entity_table, field) DO UPDATE
  SET entity_pk_column = EXCLUDED.entity_pk_column,
      entity_field_column = EXCLUDED.entity_field_column,
      note = EXCLUDED.note;

-- -----------------------------------------------------------------------------
-- Post-condition (fail-loud, CI-safe: solo struttura, nessun assert sui dati)
-- -----------------------------------------------------------------------------
DO $$
DECLARE n_unclassified int;
BEGIN
  IF to_regclass('sys.sys_occupation_classifications') IS NULL THEN
    RAISE EXCEPTION '000206: sys_occupation_classifications assente';
  END IF;
  IF to_regclass('sys.sys_occupation_classification_mappings') IS NULL THEN
    RAISE EXCEPTION '000206: sys_occupation_classification_mappings assente';
  END IF;
  IF to_regclass('sys.sys_esco_isco_resolved') IS NULL THEN
    RAISE EXCEPTION '000206: view sys_esco_isco_resolved assente';
  END IF;
  SELECT count(*) INTO n_unclassified
  FROM sys.v_reconciliation_status
  WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000206: attese 0 UNCLASSIFIED dopo la registrazione, trovate %', n_unclassified;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sys.sys_translatable_field
                 WHERE entity_table = 'sys_occupation_classifications' AND field = 'name') THEN
    RAISE EXCEPTION '000206: registrazione i18n del campo name mancante';
  END IF;
  RAISE NOTICE '000206: asse professione pronto (catalogo + crosswalk + view ESCO + registry + i18n).';
END $$;
