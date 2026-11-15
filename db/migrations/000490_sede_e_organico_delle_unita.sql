-- ============================================================================================
-- 000490 — Sede e organico delle unità; esito finale delle corse del modello
--          (piano docs/piani/PIANO_registro-corse-consolidamento_20261114.md, voci I1.2 e W5).
--
-- COSA FA.
--   ① sys.sys_organization_units: quattro colonne vere per ciò che il modello del datastore porta per ogni
--      unità e advanced non teneva (le viste a blocchi dell'organigramma le leggono):
--        organization_unit_site_code         il codice della sede del modello (SEDE_CENTRALE, UFFICIO, FILIALE_1…)
--        organization_unit_site_kind         il tipo di sede, lo stesso elenco di sys_blueprint_content_sites
--        organization_unit_planned_headcount l'organico previsto
--        organization_unit_headcount_note    perché quell'organico
--      Le riempie l'applicazione delle decisioni del consolidamento (gruppo Organizzazione); finché nessuno
--      le riempie restano nulle.
--   ② sys.sys_blueprint_runs.blueprint_run_final_results: l'esito dell'approvazione definitiva (chi, quando,
--      quante modifiche), accanto ai risultati iniziali.
--
-- IDEMPOTENTE: ADD COLUMN IF NOT EXISTS, vincoli ricreati per nome. NESSUNA CANCELLAZIONE, nessun dato scritto.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE sys.sys_organization_units
  ADD COLUMN IF NOT EXISTS organization_unit_site_code varchar(64),
  ADD COLUMN IF NOT EXISTS organization_unit_site_kind varchar(24),
  ADD COLUMN IF NOT EXISTS organization_unit_planned_headcount integer,
  ADD COLUMN IF NOT EXISTS organization_unit_headcount_note text;

ALTER TABLE sys.sys_organization_units DROP CONSTRAINT IF EXISTS sys_organization_units_site_kind_ck;
ALTER TABLE sys.sys_organization_units ADD CONSTRAINT sys_organization_units_site_kind_ck
  CHECK (organization_unit_site_kind IS NULL
         OR organization_unit_site_kind IN ('SEDE_CENTRALE', 'FILIALE', 'STABILIMENTO', 'MAGAZZINO', 'UFFICIO'));
ALTER TABLE sys.sys_organization_units DROP CONSTRAINT IF EXISTS sys_organization_units_planned_headcount_ck;
ALTER TABLE sys.sys_organization_units ADD CONSTRAINT sys_organization_units_planned_headcount_ck
  CHECK (organization_unit_planned_headcount IS NULL OR organization_unit_planned_headcount >= 0);

-- le viste dell'organigramma raggruppano per sede dentro il tenant
CREATE INDEX IF NOT EXISTS sys_organization_units_site_idx
  ON sys.sys_organization_units (organization_unit_tenant_id, organization_unit_site_code)
  WHERE organization_unit_site_code IS NOT NULL;

COMMENT ON COLUMN sys.sys_organization_units.organization_unit_site_code IS
  'Codice della sede dal modello (sys_blueprint_content_sites.blueprint_content_site_code), 000490.';
COMMENT ON COLUMN sys.sys_organization_units.organization_unit_site_kind IS
  'Tipo di sede: SEDE_CENTRALE, FILIALE, STABILIMENTO, MAGAZZINO, UFFICIO (000490).';
COMMENT ON COLUMN sys.sys_organization_units.organization_unit_planned_headcount IS
  'Organico previsto dal modello (000490).';
COMMENT ON COLUMN sys.sys_organization_units.organization_unit_headcount_note IS
  'Perché quell''organico, dal modello (000490).';

ALTER TABLE sys.sys_blueprint_runs
  ADD COLUMN IF NOT EXISTS blueprint_run_final_results jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
