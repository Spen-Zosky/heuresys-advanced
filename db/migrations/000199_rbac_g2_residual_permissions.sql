-- ============================================================================
-- 000199_rbac_g2_residual_permissions.sql — #61 G/G2 (3/3): i residui.
--
-- 000177 ha dato a ogni DELETE la sua permission `:delete`; 000178 ha tolto i
-- proxy cross-area noti (observability, role-matrix, sessions, materialization).
-- Il censimento S1026 ha trovato QUATTRO residui che la matrice ancora non
-- rappresenta:
--
--   route/i                                     gate attuale           nuovo permesso
--   /v1/job-families POST|PATCH|DELETE          (nessuno; solo service  job_family:create|update|delete
--                                                ensurePlatformAdmin)
--   /v1/skill-families|skill-categories|        skill:create|update|   skill_taxonomy:create|update|delete
--     skill-taxonomy-edges mutazioni             delete al route, MA
--                                                service PLATFORM_ADMIN-only
--   /v1/operating-models CRUD                   enterprise_typing:*    operating_model:read|update|delete
--   /v1/organization-unit-kpi-templates CRUD    bpm_process:*          organization_unit_kpi_template:read|update|delete
--   /v1/process-kpi-templates CRUD              bpm_process:*          process_kpi_template:read|update|delete
--
-- Il caso skill_taxonomy e' il piu' insidioso: la matrice diceva che TENANT_ADMIN
--   e HRMS_MANAGER possono mutare famiglie/categorie/edge della tassonomia
--   (skill:create e' concesso a loro), ma il service li respingeva con 403 —
--   la matrice PROMETTEVA un potere che non esisteva. Il nuovo permesso
--   PLATFORM_ADMIN-only dice la verita'.
--
-- STESSO PRINCIPIO DI 000177/000178: la matrice diventa esplicita, i privilegi
--   effettivi NON si muovono. Audience derivata dalla sorgente:
--   - operating_model:*        ← enterprise_typing:* (verbo per verbo)
--   - *_kpi_template:*         ← bpm_process:* (verbo per verbo)
--   - job_family:* e skill_taxonomy:* ← tenant:create, usato SOLO come sorgente
--     dell'audience PLATFORM_ADMIN (il gate reale era ensurePlatformAdmin nel
--     service — pattern identico a tenant_materialization:execute in 000178).
--
-- I service mantengono i loro check (difesa in profondita'); i denial-code
--   pubblici (JOB_FAMILY_ADMIN_ONLY, SKILL_FAMILY_ADMIN_ONLY, ...) restano
--   invariati via override `requirePermission(code, deniedCode)`.
--
-- IDEMPOTENTE: ON CONFLICT DO NOTHING + DELETE self-healing (vedi sotto).
-- Authored: 2026-07-22 (S1026).
-- ============================================================================

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('job_family:create',                       'Create job families (platform taxonomy)',            'job_family',                       'create'),
  ('job_family:update',                       'Update job families (platform taxonomy)',            'job_family',                       'update'),
  ('job_family:delete',                       'Delete job families (platform taxonomy)',            'job_family',                       'delete'),
  ('skill_taxonomy:create',                   'Create skill-taxonomy structures (families/categories/edges)', 'skill_taxonomy',          'create'),
  ('skill_taxonomy:update',                   'Update skill-taxonomy structures (families/categories)',       'skill_taxonomy',          'update'),
  ('skill_taxonomy:delete',                   'Delete skill-taxonomy structures (families/categories/edges)', 'skill_taxonomy',          'delete'),
  ('operating_model:read',                    'Read the operating-model catalog',                    'operating_model',                  'read'),
  ('operating_model:update',                  'Upsert operating-model catalog entries',              'operating_model',                  'update'),
  ('operating_model:delete',                  'Delete operating-model catalog entries',              'operating_model',                  'delete'),
  ('organization_unit_kpi_template:read',     'Read organization-unit KPI templates',                'organization_unit_kpi_template',   'read'),
  ('organization_unit_kpi_template:update',   'Upsert organization-unit KPI templates',              'organization_unit_kpi_template',   'update'),
  ('organization_unit_kpi_template:delete',   'Delete organization-unit KPI templates',              'organization_unit_kpi_template',   'delete'),
  ('process_kpi_template:read',               'Read process KPI templates',                          'process_kpi_template',             'read'),
  ('process_kpi_template:update',             'Upsert process KPI templates',                        'process_kpi_template',             'update'),
  ('process_kpi_template:delete',             'Delete process KPI templates',                        'process_kpi_template',             'delete')
ON CONFLICT (auth_permission_code) DO NOTHING;

WITH mapping(new_code, source_code) AS (
  VALUES
    ('job_family:create',                     'tenant:create'),
    ('job_family:update',                     'tenant:create'),
    ('job_family:delete',                     'tenant:create'),
    ('skill_taxonomy:create',                 'tenant:create'),
    ('skill_taxonomy:update',                 'tenant:create'),
    ('skill_taxonomy:delete',                 'tenant:create'),
    ('operating_model:read',                  'enterprise_typing:read'),
    ('operating_model:update',                'enterprise_typing:update'),
    ('operating_model:delete',                'enterprise_typing:delete'),
    ('organization_unit_kpi_template:read',   'bpm_process:read'),
    ('organization_unit_kpi_template:update', 'bpm_process:update'),
    ('organization_unit_kpi_template:delete', 'bpm_process:delete'),
    ('process_kpi_template:read',             'bpm_process:read'),
    ('process_kpi_template:update',           'bpm_process:update'),
    ('process_kpi_template:delete',           'bpm_process:delete')
)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT rp.auth_role_id, np.auth_permission_id
  FROM mapping m
  JOIN sys.sys_auth_permissions sp ON sp.auth_permission_code = m.source_code
  JOIN sys.sys_auth_role_permissions rp ON rp.auth_permission_id = sp.auth_permission_id
  JOIN sys.sys_auth_permissions np ON np.auth_permission_code = m.new_code
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Self-healing contro il grant a tappeto di 000005 (stesso meccanismo di
-- 000178): il CROSS JOIN di 000005 assorbe in TENANT_ADMIN ogni permesso nuovo
-- a ogni re-run di `db:migrate`. Qui l'audience di ciascun permesso viene
-- riportata ESATTAMENTE a quella della sorgente; 000199 > 000005, quindi la
-- correzione gira sempre DOPO il CROSS JOIN → auto-riparante. Cruciale per i
-- 6 permessi PLATFORM_ADMIN-only (job_family:*, skill_taxonomy:*).
-- ---------------------------------------------------------------------------
WITH mapping(new_code, source_code) AS (
  VALUES
    ('job_family:create',                     'tenant:create'),
    ('job_family:update',                     'tenant:create'),
    ('job_family:delete',                     'tenant:create'),
    ('skill_taxonomy:create',                 'tenant:create'),
    ('skill_taxonomy:update',                 'tenant:create'),
    ('skill_taxonomy:delete',                 'tenant:create'),
    ('operating_model:read',                  'enterprise_typing:read'),
    ('operating_model:update',                'enterprise_typing:update'),
    ('operating_model:delete',                'enterprise_typing:delete'),
    ('organization_unit_kpi_template:read',   'bpm_process:read'),
    ('organization_unit_kpi_template:update', 'bpm_process:update'),
    ('organization_unit_kpi_template:delete', 'bpm_process:delete'),
    ('process_kpi_template:read',             'bpm_process:read'),
    ('process_kpi_template:update',           'bpm_process:update'),
    ('process_kpi_template:delete',           'bpm_process:delete')
)
DELETE FROM sys.sys_auth_role_permissions rp
 USING mapping m
  JOIN sys.sys_auth_permissions np ON np.auth_permission_code = m.new_code
 WHERE rp.auth_permission_id = np.auth_permission_id
   AND NOT EXISTS (
     SELECT 1
       FROM sys.sys_auth_role_permissions srp
       JOIN sys.sys_auth_permissions sp ON sp.auth_permission_id = srp.auth_permission_id
      WHERE sp.auth_permission_code = m.source_code
        AND srp.auth_role_id = rp.auth_role_id
   );

DO $$
DECLARE n int; extra int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN
     ('job_family:create','job_family:update','job_family:delete',
      'skill_taxonomy:create','skill_taxonomy:update','skill_taxonomy:delete',
      'operating_model:read','operating_model:update','operating_model:delete',
      'organization_unit_kpi_template:read','organization_unit_kpi_template:update','organization_unit_kpi_template:delete',
      'process_kpi_template:read','process_kpi_template:update','process_kpi_template:delete');
  IF n <> 15 THEN
    RAISE EXCEPTION '000199: attesi 15 permessi G2-residuo, trovati %', n;
  END IF;

  -- post-condizione: i 6 permessi PLATFORM_ADMIN-only non possono avere ruoli
  -- oltre l'audience di tenant:create (il grant a tappeto di 000005 non deve vincere)
  SELECT count(*) INTO extra
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions np ON np.auth_permission_id = rp.auth_permission_id
   WHERE np.auth_permission_code IN
     ('job_family:create','job_family:update','job_family:delete',
      'skill_taxonomy:create','skill_taxonomy:update','skill_taxonomy:delete')
     AND rp.auth_role_id NOT IN (
       SELECT srp.auth_role_id FROM sys.sys_auth_role_permissions srp
       JOIN sys.sys_auth_permissions sp ON sp.auth_permission_id = srp.auth_permission_id
       WHERE sp.auth_permission_code = 'tenant:create');
  IF extra > 0 THEN
    RAISE EXCEPTION '000199: % grant oltre l''audience sorgente — il grant a tappeto ha vinto', extra;
  END IF;

  RAISE NOTICE '000199: 15 permessi G2-residuo presenti, audience allineate alle sorgenti.';
END $$;
