-- ============================================================================================
-- 000481 — Chi decide le capacità degli agenti: tre permessi (ADR-0053 A1/D4, ADR-0056 D2,
--          piano dei principi agentici voce T3c).
--
-- LA REGOLA (ADR-0053, D4 e passo A1).
--   · Il catalogo delle capacità (creare, dichiarare le operazioni, pubblicare, ritirare) è della
--     piattaforma: `agent_capability:manage`, a PLATFORM_ADMIN.
--   · Il modo di una capacità per un tenant lo decide il Direttore HR del tenant:
--     `agent_capability:activate`, a HRMS_MANAGER. La piattaforma ha lo stesso permesso (lo riceve
--     comunque dalla 000005) e il servizio la limita a riportare a `CONFERMA`: è l'interruttore.
--   · Leggere il registro: `agent_capability:read`, a HRMS_MANAGER, TENANT_ADMIN e PLATFORM_ADMIN.
-- I tre permessi sono solo-plenipotenziari PER DECISIONE: dichiarati in 000418, file di numero minore.
--
-- COSA FA: i tre permessi, le concessioni, le traduzioni EN (ADR-0029). Nessuna tabella nuova.
-- IDEMPOTENTE. NESSUNA CANCELLAZIONE.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
SELECT v.code, v.nome, v.risorsa, v.azione
  FROM (VALUES
    ('agent_capability:read',     'Vedere le capacità degli agenti e il loro modo nel tenant', 'agent_capability', 'read'),
    ('agent_capability:manage',   'Creare, pubblicare e ritirare le capacità degli agenti',     'agent_capability', 'manage'),
    ('agent_capability:activate', 'Decidere il modo di una capacità degli agenti nel tenant',    'agent_capability', 'activate')
  ) AS v(code, nome, risorsa, azione)
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_auth_permissions p WHERE p.auth_permission_code = v.code);

-- TENANT_ADMIN legge soltanto (guardia D-57, deny-by-default della 000210).
-- TENANT_ADMIN-ALLOWLIST-EXTEND
CREATE TEMP TABLE _ta_extend_000481(code text PRIMARY KEY);
INSERT INTO _ta_extend_000481(code) VALUES
    ('agent_capability:read');
DROP TABLE _ta_extend_000481;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM (VALUES
    ('HRMS_MANAGER',   'agent_capability:read'),
    ('HRMS_MANAGER',   'agent_capability:activate'),
    ('TENANT_ADMIN',   'agent_capability:read'),
    ('PLATFORM_ADMIN', 'agent_capability:read'),
    ('PLATFORM_ADMIN', 'agent_capability:manage'),
    ('PLATFORM_ADMIN', 'agent_capability:activate')
  ) AS g(ruolo, codice)
  JOIN sys.sys_auth_roles r ON r.auth_role_code = g.ruolo
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = g.codice
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en', v.en, 'MANUAL'
  FROM (VALUES
    ('agent_capability:read',     'View agent capabilities and their mode in the tenant'),
    ('agent_capability:manage',   'Create, publish and retire agent capabilities'),
    ('agent_capability:activate', 'Decide the mode of an agent capability in the tenant')
  ) AS v(code, en)
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = v.code
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================================
-- POST-CONDIZIONI
-- ============================================================================================
DO $$
DECLARE n_perm int; n_grant int; n_trad int;
BEGIN
  SELECT count(*) INTO n_perm FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN ('agent_capability:read', 'agent_capability:manage', 'agent_capability:activate');
  IF n_perm <> 3 THEN RAISE EXCEPTION '000481: i permessi sono % invece di 3', n_perm; END IF;

  -- ciò che QUESTA migrazione concede, non lo stato globale
  SELECT count(*) INTO n_grant
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE (r.auth_role_code, p.auth_permission_code) IN (
     ('HRMS_MANAGER', 'agent_capability:read'), ('HRMS_MANAGER', 'agent_capability:activate'),
     ('TENANT_ADMIN', 'agent_capability:read'),
     ('PLATFORM_ADMIN', 'agent_capability:read'), ('PLATFORM_ADMIN', 'agent_capability:manage'),
     ('PLATFORM_ADMIN', 'agent_capability:activate'));
  IF n_grant <> 6 THEN RAISE EXCEPTION '000481: le concessioni sono % invece di 6', n_grant; END IF;

  -- TENANT_ADMIN non scrive il catalogo e non decide il modo (la 000210 toglie il resto)
  IF EXISTS (
    SELECT 1 FROM sys.sys_auth_role_permissions rp
      JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
     WHERE r.auth_role_code = 'TENANT_ADMIN'
       AND p.auth_permission_code IN ('agent_capability:manage', 'agent_capability:activate')) THEN
    RAISE EXCEPTION '000481: TENANT_ADMIN ha un permesso di scrittura sul registro delle capacità';
  END IF;

  SELECT count(*) INTO n_trad FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE t.entity_table = 'sys_auth_permissions' AND t.locale = 'en' AND t.field = 'name'
     AND p.auth_permission_code IN ('agent_capability:read', 'agent_capability:manage', 'agent_capability:activate');
  IF n_trad <> 3 THEN RAISE EXCEPTION '000481: le traduzioni EN sono % invece di 3', n_trad; END IF;

  RAISE NOTICE '000481 ok: 3 permessi, 6 concessioni, 3 traduzioni';
END $$;
