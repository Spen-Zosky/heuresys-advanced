-- ============================================================================================
-- 000489 — Il registro delle corse del modello (piano docs/piani/PIANO_registro-corse-consolidamento_20261114.md).
--
-- COSA FA.
--   ① sys.sys_blueprint_runs: per ogni tenant, una riga per corsa del datastore accolta in advanced come
--      versione di modello. Ricorda il codice della corsa e il numero del suo pacchetto, l'impronta, quando la
--      corsa è stata eseguita nel datastore, il modello (versione) e quando advanced l'ha caricato, la prima
--      sessione di consolidamento fatta con quel modello e i suoi risultati iniziali (per gruppo: voci, proposte,
--      certe, tempo dell'agente), lo stato (CARICATA, IN_CONSOLIDAMENTO, DEFINITIVA, SUPERATA). Serve a non
--      rifare una corsa già fatta e a sapere quale modello è diventato definitivo.
--   ② sys.sys_tenant_consolidations.tenant_consolidation_run_id: la sessione dice con quale corsa è stata fatta.
--
-- IDEMPOTENTE: IF NOT EXISTS ovunque. NESSUNA CANCELLAZIONE, nessun dato scritto.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_runs (
  blueprint_run_id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_run_tenant_id             uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  blueprint_run_code                  varchar(64) NOT NULL,
  blueprint_run_package_version       integer NOT NULL,
  blueprint_run_package_hash          varchar(64) NOT NULL,
  blueprint_run_description           text,
  blueprint_run_executed_from         timestamptz,
  blueprint_run_executed_to           timestamptz,
  blueprint_run_variant_version_id    uuid REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE SET NULL,
  blueprint_run_model_label           varchar(250) NOT NULL,
  blueprint_run_model_loaded_at       timestamptz NOT NULL,
  blueprint_run_status                varchar(20) NOT NULL DEFAULT 'CARICATA',
  blueprint_run_first_consolidation_id uuid REFERENCES sys.sys_tenant_consolidations(tenant_consolidation_id) ON DELETE SET NULL,
  blueprint_run_initial_results       jsonb NOT NULL DEFAULT '{}'::jsonb,
  blueprint_run_definitive_at         timestamptz,
  blueprint_run_definitive_by         uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  blueprint_run_metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                          timestamptz NOT NULL DEFAULT now(),
  created_by                          uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_runs_identity_uq UNIQUE (blueprint_run_tenant_id, blueprint_run_code, blueprint_run_package_version),
  CONSTRAINT sys_blueprint_runs_status_ck
    CHECK (blueprint_run_status IN ('CARICATA', 'IN_CONSOLIDAMENTO', 'DEFINITIVA', 'SUPERATA')),
  CONSTRAINT sys_blueprint_runs_hash_ck CHECK (blueprint_run_package_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sys_blueprint_runs_package_version_ck CHECK (blueprint_run_package_version >= 1)
);
CREATE INDEX IF NOT EXISTS sys_blueprint_runs_tenant_idx
  ON sys.sys_blueprint_runs (blueprint_run_tenant_id, blueprint_run_model_loaded_at DESC);
CREATE INDEX IF NOT EXISTS sys_blueprint_runs_version_idx
  ON sys.sys_blueprint_runs (blueprint_run_variant_version_id);
CREATE INDEX IF NOT EXISTS sys_blueprint_runs_first_consolidation_idx
  ON sys.sys_blueprint_runs (blueprint_run_first_consolidation_id);
-- un solo modello definitivo per tenant
CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_runs_one_definitive_uq
  ON sys.sys_blueprint_runs (blueprint_run_tenant_id) WHERE blueprint_run_status = 'DEFINITIVA';

DROP TRIGGER IF EXISTS sys_blueprint_runs_set_updated_at ON sys.sys_blueprint_runs;
CREATE TRIGGER sys_blueprint_runs_set_updated_at BEFORE UPDATE ON sys.sys_blueprint_runs
  FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();

ALTER TABLE sys.sys_tenant_consolidations
  ADD COLUMN IF NOT EXISTS tenant_consolidation_run_id uuid
    REFERENCES sys.sys_blueprint_runs(blueprint_run_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sys_tenant_consolidations_run_idx
  ON sys.sys_tenant_consolidations (tenant_consolidation_run_id);

COMMENT ON TABLE sys.sys_blueprint_runs IS
  'Registro delle corse del datastore accolte come versioni di modello, per tenant: date, modello, risultati iniziali del primo consolidamento, stato (000489).';

COMMIT;
