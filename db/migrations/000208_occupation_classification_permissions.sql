-- ============================================================================
-- Migration 000208 — RBAC per il modulo occupation-classifications (000206).
--
-- Quattro permessi `occupation_classification:read|create|update|delete` con
-- matrice VERITIERA fin dalla nascita (doctrine 000177/000178/000199 — mai
-- promettere poteri che il service nega):
--   • read   ← audience di enterprise_typing:read (catalogo di riferimento,
--              lettura ampia — simmetrico all'asse attività).
--   • create/update/delete ← audience di tenant:create, usato SOLO come
--              sorgente dell'audience PLATFORM_ADMIN: il catalogo professioni
--              è platform taxonomy (come job_family:*/skill_taxonomy:* in
--              000199) e il service applica isPlatform (difesa in profondità).
--
-- i18n CONFORME ADR-0029 fin dalla nascita (a differenza di 000199/000202 che
-- hanno lasciato name EN in-row — gap sanato a parte): name IT-canonico
-- in-row + overlay EN in sys_reference_translations nella stessa migration.
--
-- IDEMPOTENTE: ON CONFLICT + self-healing DELETE (000199) contro il grant a
-- tappeto di 000005 che assorbe in TENANT_ADMIN ogni permesso nuovo a ogni
-- re-run. Authored: 2026-07-22 (S1027).
-- ============================================================================

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('occupation_classification:read',   'Lettura del catalogo professioni (ISCO-08/CP2021)',   'occupation_classification', 'read'),
  ('occupation_classification:create', 'Creazione voci del catalogo professioni',             'occupation_classification', 'create'),
  ('occupation_classification:update', 'Aggiornamento voci del catalogo professioni',         'occupation_classification', 'update'),
  ('occupation_classification:delete', 'Eliminazione voci del catalogo professioni',          'occupation_classification', 'delete')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- Overlay EN dei name (ADR-0029; idempotente, l'EN qui è l'autorità)
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en', v.text_en, 'MANUAL'
  FROM (VALUES
    ('occupation_classification:read',   'Read the occupation catalog (ISCO-08/CP2021)'),
    ('occupation_classification:create', 'Create occupation-catalog entries'),
    ('occupation_classification:update', 'Update occupation-catalog entries'),
    ('occupation_classification:delete', 'Delete occupation-catalog entries')
  ) AS v(code, text_en)
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = v.code
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

-- Audience derivata verb-by-verb dalla sorgente
WITH mapping(new_code, source_code) AS (
  VALUES
    ('occupation_classification:read',   'enterprise_typing:read'),
    ('occupation_classification:create', 'tenant:create'),
    ('occupation_classification:update', 'tenant:create'),
    ('occupation_classification:delete', 'tenant:create')
)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT rp.auth_role_id, np.auth_permission_id
  FROM mapping m
  JOIN sys.sys_auth_permissions sp ON sp.auth_permission_code = m.source_code
  JOIN sys.sys_auth_role_permissions rp ON rp.auth_permission_id = sp.auth_permission_id
  JOIN sys.sys_auth_permissions np ON np.auth_permission_code = m.new_code
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- Self-healing (000199): riporta l'audience ESATTAMENTE a quella della
-- sorgente; 000208 > 000005, quindi la correzione gira sempre DOPO il
-- CROSS JOIN a tappeto → auto-riparante a ogni re-run di db:migrate.
WITH mapping(new_code, source_code) AS (
  VALUES
    ('occupation_classification:read',   'enterprise_typing:read'),
    ('occupation_classification:create', 'tenant:create'),
    ('occupation_classification:update', 'tenant:create'),
    ('occupation_classification:delete', 'tenant:create')
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

-- Post-condition (fail-loud)
DO $$
DECLARE n int; extra int; en_cov int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN
     ('occupation_classification:read','occupation_classification:create',
      'occupation_classification:update','occupation_classification:delete');
  IF n <> 4 THEN
    RAISE EXCEPTION '000208: attesi 4 permessi occupation_classification, trovati %', n;
  END IF;

  -- i 3 permessi write non possono avere ruoli oltre l'audience di tenant:create
  SELECT count(*) INTO extra
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code IN
     ('occupation_classification:create','occupation_classification:update','occupation_classification:delete')
     AND NOT EXISTS (
       SELECT 1 FROM sys.sys_auth_role_permissions srp
         JOIN sys.sys_auth_permissions sp ON sp.auth_permission_id = srp.auth_permission_id
        WHERE sp.auth_permission_code = 'tenant:create' AND srp.auth_role_id = rp.auth_role_id
     );
  IF extra <> 0 THEN
    RAISE EXCEPTION '000208: % grant write oltre l''audience di tenant:create', extra;
  END IF;

  -- overlay EN presenti per i 4 name (conformità ADR-0029 nativa)
  SELECT count(*) INTO en_cov
    FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE t.entity_table = 'sys_auth_permissions' AND t.field = 'name' AND t.locale = 'en'
     AND p.auth_permission_code LIKE 'occupation_classification:%';
  IF en_cov <> 4 THEN
    RAISE EXCEPTION '000208: attesi 4 overlay EN, trovati %', en_cov;
  END IF;

  RAISE NOTICE '000208: 4 permessi occupation_classification (matrice veritiera + i18n conforme).';
END $$;
