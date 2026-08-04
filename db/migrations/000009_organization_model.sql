-- =============================================================================
-- 000009_organization_model.sql
-- Heuresys Advanced — organization structure (5 tables)
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §3.1.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_organization_unit_types (
  organization_unit_type_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_unit_type_code        varchar(64)  NOT NULL,
  organization_unit_type_name        varchar(128) NOT NULL,
  organization_unit_type_description text,
  organization_unit_type_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                         timestamptz  NOT NULL DEFAULT now(),
  updated_at                         timestamptz  NOT NULL DEFAULT now()
);

-- Il vincolo si (ri)crea SOLO se nessuna riga presente lo violerebbe.
--
-- Serve perche' `migrate.sh` ri-applica OGNI file a ogni corsa, quindi una
-- migrazione vecchia puo' disfare una nuova: la `000244` allarga questo elenco con
-- `GENERAL_MANAGEMENT` e `AREA`, e senza questa guardia la ri-esecuzione di questo
-- file lo restringerebbe di nuovo — fallendo proprio sulle righe che la 000244 ha
-- inserito. E' cosi' che la CI si e' fermata qui in S1043, mentre in locale tutto
-- era verde: in locale le migrazioni si applicano UNA volta, in CI si ri-applicano
-- tutte dalla 000001.
--
-- Su un database nuovo la tabella e' vuota, la condizione e' vera e il vincolo nasce
-- con gli otto codici originali: il comportamento di partenza non cambia.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sys.sys_organization_unit_types
     WHERE organization_unit_type_code NOT IN
           ('HEADQUARTERS','DIVISION','DEPARTMENT','TEAM','BRANCH','OFFICE','PLANT','WAREHOUSE')
  ) THEN
    ALTER TABLE sys.sys_organization_unit_types
      DROP CONSTRAINT IF EXISTS sys_organization_unit_type_code_check;
    ALTER TABLE sys.sys_organization_unit_types
      ADD CONSTRAINT sys_organization_unit_type_code_check
      CHECK (organization_unit_type_code IN ('HEADQUARTERS', 'DIVISION', 'DEPARTMENT', 'TEAM', 'BRANCH', 'OFFICE', 'PLANT', 'WAREHOUSE'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_organization_unit_types_code_uq
  ON sys.sys_organization_unit_types (organization_unit_type_code);

CREATE TABLE IF NOT EXISTS sys.sys_organization_units (
  organization_unit_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_unit_tenant_id       uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  organization_unit_code            varchar(128) NOT NULL,
  organization_unit_name            varchar(255) NOT NULL,
  organization_unit_type_id         uuid         REFERENCES sys.sys_organization_unit_types(organization_unit_type_id) ON DELETE SET NULL,
  organization_unit_type            varchar(64),
  organization_unit_parent_id       uuid         REFERENCES sys.sys_organization_units(organization_unit_id) ON DELETE SET NULL,
  organization_unit_manager_user_id uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  organization_unit_effective_from  date         NOT NULL DEFAULT current_date,
  organization_unit_effective_to    date,
  organization_unit_is_active       boolean      NOT NULL DEFAULT true,
  organization_unit_metadata        jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                        timestamptz  NOT NULL DEFAULT now(),
  created_by                        uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                        timestamptz  NOT NULL DEFAULT now(),
  updated_by                        uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_organization_units_tenant_code_uq
  ON sys.sys_organization_units (organization_unit_tenant_id, organization_unit_code);

CREATE INDEX IF NOT EXISTS sys_organization_units_parent_idx
  ON sys.sys_organization_units (organization_unit_parent_id)
  WHERE organization_unit_parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sys_organization_units_tenant_active_idx
  ON sys.sys_organization_units (organization_unit_tenant_id, organization_unit_is_active);

CREATE INDEX IF NOT EXISTS sys_organization_units_manager_idx
  ON sys.sys_organization_units (organization_unit_manager_user_id)
  WHERE organization_unit_manager_user_id IS NOT NULL;

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_organization_units_set_updated_at' AND tgrelid = 'sys.sys_organization_units'::regclass) THEN
    CREATE TRIGGER sys_organization_units_set_updated_at BEFORE UPDATE ON sys.sys_organization_units FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

CREATE TABLE IF NOT EXISTS sys.sys_branches (
  branch_id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_organization_unit_id   uuid         NOT NULL REFERENCES sys.sys_organization_units(organization_unit_id) ON DELETE CASCADE,
  branch_tenant_id              uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  branch_code                   varchar(64)  NOT NULL,
  branch_address_line1          varchar(255),
  branch_address_line2          varchar(255),
  branch_city                   varchar(128),
  branch_postal_code            varchar(32),
  branch_country_code           char(2),
  branch_region_code            varchar(32),
  branch_opening_hours          jsonb        NOT NULL DEFAULT '{}'::jsonb,
  branch_regulatory_zone        varchar(64),
  branch_metadata               jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                    timestamptz  NOT NULL DEFAULT now(),
  created_by                    uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                    timestamptz  NOT NULL DEFAULT now(),
  updated_by                    uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_branches_organization_unit_uq
  ON sys.sys_branches (branch_organization_unit_id);

CREATE UNIQUE INDEX IF NOT EXISTS sys_branches_tenant_code_uq
  ON sys.sys_branches (branch_tenant_id, branch_code);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_branches_set_updated_at' AND tgrelid = 'sys.sys_branches'::regclass) THEN
    CREATE TRIGGER sys_branches_set_updated_at BEFORE UPDATE ON sys.sys_branches FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- [S1023 amendment] sys_organization_hierarchies (closure table) REMOVED from
-- this migration. It was dead schema (never populated, no reader) dropped by
-- 000183 (R4); leaving the CREATE here made every idempotent full-chain re-run
-- resurrect it mid-chain, and once 000185 removed its reconciliation-registry
-- row the 000062 "0 UNCLASSIFIED" assert tripped on the SECOND re-run (the
-- twice-run invariant broke). Editing this file changes its sha → the chain
-- re-applies it — everything else in here is IF-NOT-EXISTS idempotent.
-- 000185 drops any resurrected orphan left by an aborted chain.

CREATE TABLE IF NOT EXISTS sys.sys_organization_unit_history (
  organization_unit_history_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_unit_history_unit_id       uuid         NOT NULL REFERENCES sys.sys_organization_units(organization_unit_id) ON DELETE CASCADE,
  organization_unit_history_tenant_id     uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  organization_unit_history_change_type   varchar(32)  NOT NULL,
  organization_unit_history_old_value     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  organization_unit_history_new_value     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  organization_unit_history_effective_at  timestamptz  NOT NULL DEFAULT now(),
  organization_unit_history_actor_user_id uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  organization_unit_history_notes         text,
  created_at                              timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_organization_unit_history
  DROP CONSTRAINT IF EXISTS sys_organization_unit_history_change_type_check;
ALTER TABLE sys.sys_organization_unit_history
  ADD CONSTRAINT sys_organization_unit_history_change_type_check
  CHECK (organization_unit_history_change_type IN ('CREATED', 'RENAMED', 'MOVED', 'MERGED', 'SPLIT', 'DEACTIVATED', 'REACTIVATED'));

CREATE INDEX IF NOT EXISTS sys_organization_unit_history_unit_idx
  ON sys.sys_organization_unit_history (organization_unit_history_unit_id, organization_unit_history_effective_at DESC);
