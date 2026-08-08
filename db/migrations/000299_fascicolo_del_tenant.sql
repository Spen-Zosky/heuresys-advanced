-- ============================================================================
-- 000299 — Il fascicolo: la descrizione ufficiale della configurazione di
--          un'azienda, con identita' propria e versioni.  (#131 Tenant Builder P1, T2)
--
--   Un fascicolo puo' esistere PRIMA dell'azienda (una trattativa), quindi il
--   legame al tenant e' facoltativo. Registra solo le DECISIONI ESPLICITE sul
--   modello: il silenzio significa «come dice il modello», e per questo non
--   esistono 23 righe per dire 23 volte si'.
--
-- Verificato prima di scrivere (2026-08-08, produzione): esistono
--   `sys_activity_classifications`, `sys_enterprise_size_bands` e
--   `sys_operating_model_catalog`; nessuna delle 4 tabelle del fascicolo esiste.
--
-- IDEMPOTENTE + sicura due volte.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_tenant_blueprints (
  tenant_blueprint_id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_blueprint_code               varchar(64)  NOT NULL,
  tenant_blueprint_name               varchar(255) NOT NULL,
  tenant_blueprint_tenant_id          uuid REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  tenant_blueprint_status             varchar(32)  NOT NULL DEFAULT 'ACTIVE',
  tenant_blueprint_current_version_id uuid,
  tenant_blueprint_metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  CONSTRAINT sys_tenant_blueprint_status_check
    CHECK (tenant_blueprint_status IN ('ACTIVE','ARCHIVED')),
  CONSTRAINT sys_tenant_blueprints_code_uq UNIQUE (tenant_blueprint_code)
);

-- Un'azienda ha UN SOLO fascicolo attivo. Parziale: i fascicoli di trattativa
-- (tenant nullo) non si contendono niente.
CREATE UNIQUE INDEX IF NOT EXISTS sys_tenant_blueprints_one_active_per_tenant_uq
  ON sys.sys_tenant_blueprints (tenant_blueprint_tenant_id)
  WHERE tenant_blueprint_status = 'ACTIVE' AND tenant_blueprint_tenant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sys.sys_tenant_blueprint_versions (
  tenant_blueprint_version_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_blueprint_version_blueprint_id    uuid NOT NULL
    REFERENCES sys.sys_tenant_blueprints(tenant_blueprint_id) ON DELETE CASCADE,
  tenant_blueprint_version_number          int NOT NULL,
  tenant_blueprint_version_status          varchar(32) NOT NULL DEFAULT 'DRAFT',
  tenant_blueprint_version_variant_version_id uuid
    REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE RESTRICT,
  -- strato 1: la carta d'identita', nullabile in bozza
  tenant_blueprint_version_industry_class_id uuid
    REFERENCES sys.sys_activity_classifications(activity_classification_id) ON DELETE RESTRICT,
  tenant_blueprint_version_size_band_id uuid
    REFERENCES sys.sys_enterprise_size_bands(enterprise_size_band_id) ON DELETE RESTRICT,
  tenant_blueprint_version_operating_model_id uuid
    REFERENCES sys.sys_operating_model_catalog(operating_model_id) ON DELETE RESTRICT,
  tenant_blueprint_version_regulatory_intensity varchar(32),
  tenant_blueprint_version_country_code    char(2),
  tenant_blueprint_version_employee_count  int,
  tenant_blueprint_version_revenue_eur     numeric(18,2),
  tenant_blueprint_version_supersedes_id   uuid
    REFERENCES sys.sys_tenant_blueprint_versions(tenant_blueprint_version_id) ON DELETE SET NULL,
  tenant_blueprint_version_approved_by uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  tenant_blueprint_version_approved_at timestamptz,
  tenant_blueprint_version_applied_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  CONSTRAINT sys_tenant_blueprint_version_status_check
    CHECK (tenant_blueprint_version_status IN
           ('DRAFT','IN_APPROVAL','APPROVED','APPLIED','SUPERSEDED','ABANDONED')),
  -- Stesso dominio della carta d'identita' esistente: i valori non si sdoppiano.
  CONSTRAINT sys_tenant_blueprint_version_regulatory_check
    CHECK (tenant_blueprint_version_regulatory_intensity IS NULL
        OR tenant_blueprint_version_regulatory_intensity IN ('LOW','MEDIUM','HIGH','EXTREME')),
  CONSTRAINT sys_tenant_blueprint_version_employee_count_check
    CHECK (tenant_blueprint_version_employee_count IS NULL
        OR tenant_blueprint_version_employee_count >= 0),
  CONSTRAINT sys_tenant_blueprint_version_revenue_check
    CHECK (tenant_blueprint_version_revenue_eur IS NULL
        OR tenant_blueprint_version_revenue_eur >= 0),
  CONSTRAINT sys_tenant_blueprint_versions_number_uq
    UNIQUE (tenant_blueprint_version_blueprint_id, tenant_blueprint_version_number)
);

-- Al massimo UNA versione aperta per fascicolo: due bozze contemporanee non
-- sono due idee, sono un pasticcio.
CREATE UNIQUE INDEX IF NOT EXISTS sys_tenant_blueprint_versions_one_open_uq
  ON sys.sys_tenant_blueprint_versions (tenant_blueprint_version_blueprint_id)
  WHERE tenant_blueprint_version_status IN ('DRAFT','IN_APPROVAL');

ALTER TABLE sys.sys_tenant_blueprints
  DROP CONSTRAINT IF EXISTS sys_tenant_blueprints_current_version_fk;
ALTER TABLE sys.sys_tenant_blueprints
  ADD CONSTRAINT sys_tenant_blueprints_current_version_fk
  FOREIGN KEY (tenant_blueprint_current_version_id)
  REFERENCES sys.sys_tenant_blueprint_versions(tenant_blueprint_version_id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS sys.sys_tenant_blueprint_process_decisions (
  tenant_blueprint_process_decision_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_blueprint_process_decision_version_id uuid NOT NULL
    REFERENCES sys.sys_tenant_blueprint_versions(tenant_blueprint_version_id) ON DELETE CASCADE,
  tenant_blueprint_process_decision_process_id uuid NOT NULL
    REFERENCES sys.sys_blueprint_process_registry(blueprint_process_id) ON DELETE RESTRICT,
  tenant_blueprint_process_decision_inclusion  varchar(16) NOT NULL,
  tenant_blueprint_process_decision_rationale  text NOT NULL,
  tenant_blueprint_process_decision_metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  -- Stesso dominio degli scostamenti esistenti.
  CONSTRAINT sys_tenant_blueprint_process_decision_inclusion_check
    CHECK (tenant_blueprint_process_decision_inclusion IN ('IN','PARTIAL','OUT')),
  -- R2 nello schema, non solo nel servizio: una decisione senza motivazione
  -- non e' una decisione.
  CONSTRAINT sys_tenant_blueprint_process_decision_rationale_check
    CHECK (length(btrim(tenant_blueprint_process_decision_rationale)) > 0),
  CONSTRAINT sys_tenant_blueprint_process_decisions_uq
    UNIQUE (tenant_blueprint_process_decision_version_id,
            tenant_blueprint_process_decision_process_id)
);

CREATE INDEX IF NOT EXISTS sys_tenant_blueprint_process_decisions_version_idx
  ON sys.sys_tenant_blueprint_process_decisions (tenant_blueprint_process_decision_version_id);

CREATE TABLE IF NOT EXISTS sys.sys_tenant_blueprint_snapshots (
  tenant_blueprint_snapshot_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_blueprint_snapshot_version_id   uuid NOT NULL UNIQUE
    REFERENCES sys.sys_tenant_blueprint_versions(tenant_blueprint_version_id) ON DELETE RESTRICT,
  tenant_blueprint_snapshot_payload      jsonb NOT NULL,
  tenant_blueprint_snapshot_content_hash char(64) NOT NULL,
  tenant_blueprint_snapshot_taken_at     timestamptz NOT NULL DEFAULT now(),
  tenant_blueprint_snapshot_taken_by     uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

-- La fotografia e' una PROVA: se si potesse ritoccare non proverebbe niente.
CREATE OR REPLACE FUNCTION sys.sys_tenant_blueprint_snapshot_immutable()
RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION 'Le fotografie del fascicolo sono immutabili (versione %)',
    OLD.tenant_blueprint_snapshot_version_id
    USING ERRCODE = 'restrict_violation';
END $fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sys_tenant_blueprint_snapshot_immutable_trg
  ON sys.sys_tenant_blueprint_snapshots;
CREATE TRIGGER sys_tenant_blueprint_snapshot_immutable_trg
  BEFORE UPDATE OR DELETE ON sys.sys_tenant_blueprint_snapshots
  FOR EACH ROW EXECUTE FUNCTION sys.sys_tenant_blueprint_snapshot_immutable();

-- `updated_at` come tutte le altre tabelle business.
DO $trg$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sys_tenant_blueprints','sys_tenant_blueprint_versions',
                           'sys_tenant_blueprint_process_decisions'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
                    WHERE tgname = t || '_set_updated_at'
                      AND tgrelid = ('sys.' || t)::regclass) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON sys.%I FOR EACH ROW '
                     'EXECUTE FUNCTION sys.sys_set_updated_at()', t || '_set_updated_at', t);
    END IF;
  END LOOP;
END $trg$;

DO $$
DECLARE n int; n_idx int; n_trg int;
BEGIN
  SELECT count(*) INTO n FROM information_schema.tables
   WHERE table_schema = 'sys' AND table_name IN
     ('sys_tenant_blueprints','sys_tenant_blueprint_versions',
      'sys_tenant_blueprint_process_decisions','sys_tenant_blueprint_snapshots');
  IF n <> 4 THEN RAISE EXCEPTION '000299: attese 4 tabelle del fascicolo, trovate %', n; END IF;

  -- Le due regole che vivono negli INDICI, non nel servizio: se l'indice non
  -- c'e', la regola non c'e' — e nessuno se ne accorgerebbe finche' due bozze
  -- non convivono.
  SELECT count(*) INTO n_idx FROM pg_indexes
   WHERE schemaname='sys' AND indexname IN
     ('sys_tenant_blueprints_one_active_per_tenant_uq','sys_tenant_blueprint_versions_one_open_uq');
  IF n_idx <> 2 THEN
    RAISE EXCEPTION '000299: attesi 2 indici unici parziali, trovati %', n_idx;
  END IF;

  SELECT count(*) INTO n_trg FROM pg_trigger
   WHERE tgname = 'sys_tenant_blueprint_snapshot_immutable_trg' AND NOT tgisinternal;
  IF n_trg <> 1 THEN
    RAISE EXCEPTION '000299: il trigger di immutabilita della fotografia non c''e''';
  END IF;

  RAISE NOTICE '000299: fascicolo — 4 tabelle, 2 indici unici parziali, trigger di immutabilita';
END $$;

COMMIT;
