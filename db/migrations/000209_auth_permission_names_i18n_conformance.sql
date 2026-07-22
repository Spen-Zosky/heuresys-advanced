-- ============================================================================
-- Migration 000209 — conformità ADR-0029 dei 16 permessi con name EN in-row.
--
-- 000199 (15 permessi G2) e 000202 (leave:request:self) hanno inserito
-- auth_permission_name in INGLESE, violando il canone i18n (IT canonico
-- in-row + overlay EN in sys_reference_translations). Il gate di copertura
-- (000207) li segnalava: sys_auth_permissions.name missing=16.
--
-- Fix: (a) in-row → nome IT canonico; (b) overlay EN = il testo EN originale
-- (preservato, source=MANUAL). Idempotente e CI-safe: keyed by
-- auth_permission_code, ON CONFLICT DO UPDATE; su DB fresco gira DOPO
-- 000199/000202 e li conforma. Le migration precedenti usano ON CONFLICT
-- DO NOTHING sui permessi, quindi non ri-sovrascrivono l'IT ai re-run.
--
-- Authored: 2026-07-22 (S1027).
-- ============================================================================

WITH fix(code, name_it, name_en) AS (
  VALUES
    ('job_family:create',                     'Creazione famiglie professionali (tassonomia piattaforma)',                  'Create job families (platform taxonomy)'),
    ('job_family:update',                     'Aggiornamento famiglie professionali (tassonomia piattaforma)',              'Update job families (platform taxonomy)'),
    ('job_family:delete',                     'Eliminazione famiglie professionali (tassonomia piattaforma)',               'Delete job families (platform taxonomy)'),
    ('leave:request:self',                    'Invio delle proprie richieste di assenza (ESS)',                             'Submit own time-off requests (ESS)'),
    ('operating_model:read',                  'Lettura del catalogo modelli operativi',                                     'Read the operating-model catalog'),
    ('operating_model:update',                'Inserimento/aggiornamento voci del catalogo modelli operativi',              'Upsert operating-model catalog entries'),
    ('operating_model:delete',                'Eliminazione voci del catalogo modelli operativi',                           'Delete operating-model catalog entries'),
    ('organization_unit_kpi_template:read',   'Lettura template KPI delle unità organizzative',                             'Read organization-unit KPI templates'),
    ('organization_unit_kpi_template:update', 'Inserimento/aggiornamento template KPI delle unità organizzative',           'Upsert organization-unit KPI templates'),
    ('organization_unit_kpi_template:delete', 'Eliminazione template KPI delle unità organizzative',                        'Delete organization-unit KPI templates'),
    ('process_kpi_template:read',             'Lettura template KPI di processo',                                           'Read process KPI templates'),
    ('process_kpi_template:update',           'Inserimento/aggiornamento template KPI di processo',                         'Upsert process KPI templates'),
    ('process_kpi_template:delete',           'Eliminazione template KPI di processo',                                      'Delete process KPI templates'),
    ('skill_taxonomy:create',                 'Creazione strutture della tassonomia competenze (famiglie/categorie/edge)',  'Create skill-taxonomy structures (families/categories/edges)'),
    ('skill_taxonomy:update',                 'Aggiornamento strutture della tassonomia competenze (famiglie/categorie)',   'Update skill-taxonomy structures (families/categories)'),
    ('skill_taxonomy:delete',                 'Eliminazione strutture della tassonomia competenze (famiglie/categorie/edge)','Delete skill-taxonomy structures (families/categories/edges)')
)
UPDATE sys.sys_auth_permissions p
   SET auth_permission_name = f.name_it
  FROM fix f
 WHERE p.auth_permission_code = f.code
   AND p.auth_permission_name IS DISTINCT FROM f.name_it;

WITH fix(code, name_it, name_en) AS (
  VALUES
    ('job_family:create',                     'Creazione famiglie professionali (tassonomia piattaforma)',                  'Create job families (platform taxonomy)'),
    ('job_family:update',                     'Aggiornamento famiglie professionali (tassonomia piattaforma)',              'Update job families (platform taxonomy)'),
    ('job_family:delete',                     'Eliminazione famiglie professionali (tassonomia piattaforma)',               'Delete job families (platform taxonomy)'),
    ('leave:request:self',                    'Invio delle proprie richieste di assenza (ESS)',                             'Submit own time-off requests (ESS)'),
    ('operating_model:read',                  'Lettura del catalogo modelli operativi',                                     'Read the operating-model catalog'),
    ('operating_model:update',                'Inserimento/aggiornamento voci del catalogo modelli operativi',              'Upsert operating-model catalog entries'),
    ('operating_model:delete',                'Eliminazione voci del catalogo modelli operativi',                           'Delete operating-model catalog entries'),
    ('organization_unit_kpi_template:read',   'Lettura template KPI delle unità organizzative',                             'Read organization-unit KPI templates'),
    ('organization_unit_kpi_template:update', 'Inserimento/aggiornamento template KPI delle unità organizzative',           'Upsert organization-unit KPI templates'),
    ('organization_unit_kpi_template:delete', 'Eliminazione template KPI delle unità organizzative',                        'Delete organization-unit KPI templates'),
    ('process_kpi_template:read',             'Lettura template KPI di processo',                                           'Read process KPI templates'),
    ('process_kpi_template:update',           'Inserimento/aggiornamento template KPI di processo',                         'Upsert process KPI templates'),
    ('process_kpi_template:delete',           'Eliminazione template KPI di processo',                                      'Delete process KPI templates'),
    ('skill_taxonomy:create',                 'Creazione strutture della tassonomia competenze (famiglie/categorie/edge)',  'Create skill-taxonomy structures (families/categories/edges)'),
    ('skill_taxonomy:update',                 'Aggiornamento strutture della tassonomia competenze (famiglie/categorie)',   'Update skill-taxonomy structures (families/categories)'),
    ('skill_taxonomy:delete',                 'Eliminazione strutture della tassonomia competenze (famiglie/categorie/edge)','Delete skill-taxonomy structures (families/categories/edges)')
)
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en', f.name_en, 'MANUAL'
  FROM fix f
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = f.code
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

-- Post-condition (fail-loud): tutti i 16 conformi — in-row IT + overlay EN
DO $$
DECLARE n_it int; n_en int;
BEGIN
  SELECT count(*) INTO n_it FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN
     ('job_family:create','job_family:update','job_family:delete','leave:request:self',
      'operating_model:read','operating_model:update','operating_model:delete',
      'organization_unit_kpi_template:read','organization_unit_kpi_template:update','organization_unit_kpi_template:delete',
      'process_kpi_template:read','process_kpi_template:update','process_kpi_template:delete',
      'skill_taxonomy:create','skill_taxonomy:update','skill_taxonomy:delete')
     AND auth_permission_name !~ '^(Create|Update|Delete|Read|Upsert|Submit) ';
  IF n_it <> 16 THEN
    RAISE EXCEPTION '000209: attesi 16 name IT in-row, trovati %', n_it;
  END IF;

  SELECT count(*) INTO n_en
    FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE t.entity_table = 'sys_auth_permissions' AND t.field = 'name' AND t.locale = 'en'
     AND p.auth_permission_code IN
     ('job_family:create','job_family:update','job_family:delete','leave:request:self',
      'operating_model:read','operating_model:update','operating_model:delete',
      'organization_unit_kpi_template:read','organization_unit_kpi_template:update','organization_unit_kpi_template:delete',
      'process_kpi_template:read','process_kpi_template:update','process_kpi_template:delete',
      'skill_taxonomy:create','skill_taxonomy:update','skill_taxonomy:delete');
  IF n_en <> 16 THEN
    RAISE EXCEPTION '000209: attesi 16 overlay EN, trovati %', n_en;
  END IF;

  RAISE NOTICE '000209: 16 permessi conformati ADR-0029 (IT in-row + overlay EN).';
END $$;
