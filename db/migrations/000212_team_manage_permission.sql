-- ============================================================================
-- 000212 — #75 (ex D-71): permission `team:manage` per il lifecycle dei team
--
-- Il modulo teams era read-only (team:list/team:read; i team correnti derivano
-- dai seed). Il lifecycle S1028 (POST/PATCH /v1/teams + membership PUT/DELETE)
-- richiede una permission di scrittura. UNA permission (manage) invece di
-- create/update/member-*: superficie RBAC minima, il verbo copre l'intero
-- ciclo funzionale (i team sono l'asse funzionale I16 — gate di ATTIVITÀ, mai
-- di dati sensibili, quindi nessuna interazione con I18/I20).
--
-- AUDIENCE ESPLICITA (doctrine 000208 + D-57): PLATFORM_ADMIN, TENANT_ADMIN,
-- HRMS_MANAGER (plenipotenziario dati — gestione non-tecnologica completa).
-- MANAGER/CEO/TEAM_LEADER restano read-only (estensione additiva se servirà).
-- Self-healing: l'audience viene riportata ESATTAMENTE a questa lista a ogni
-- re-run (000212 > 000005 blanket > 000210 allowlist — ordine auto-riparante).
--
-- i18n dati (gate 000207): name IT-canonical in-row + overlay EN nella stessa
-- migration — coverage resta 0 gap.
--
-- IDEMPOTENTE + twice-run safe.
-- ============================================================================

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('team:manage', 'Gestione del ciclo di vita dei team (creazione, modifica, membership)', 'team', 'manage')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- Overlay EN del name (ADR-0029; idempotente)
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en',
       'Manage team lifecycle (create, update, membership)', 'MANUAL'
  FROM sys.sys_auth_permissions p
 WHERE p.auth_permission_code = 'team:manage'
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

-- Estensione allowlist TENANT_ADMIN (la guardia rbac-tenant-admin-allowlist
-- parsa le righe VALUES a colonna singola dopo questo marker):
-- TENANT_ADMIN-ALLOWLIST-EXTEND
CREATE TEMP TABLE _ta_extend_000212(code text PRIMARY KEY);
INSERT INTO _ta_extend_000212(code) VALUES
    ('team:manage');

-- Grant esplicito all'audience
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = 'team:manage'
 WHERE r.auth_role_code IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'HRMS_MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- Self-healing: nessun altro ruolo trattiene team:manage (000005 blanket ecc.)
DELETE FROM sys.sys_auth_role_permissions rp
 USING sys.sys_auth_permissions p, sys.sys_auth_roles r
 WHERE p.auth_permission_code = 'team:manage'
   AND rp.auth_permission_id = p.auth_permission_id
   AND rp.auth_role_id = r.auth_role_id
   AND r.auth_role_code NOT IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'HRMS_MANAGER');

DROP TABLE _ta_extend_000212;

-- Post-condition (fail-loud)
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_auth_permissions WHERE auth_permission_code = 'team:manage';
  IF n <> 1 THEN RAISE EXCEPTION '000212: permission team:manage mancante'; END IF;

  SELECT count(*) INTO n
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE p.auth_permission_code = 'team:manage';
  IF n <> 3 THEN RAISE EXCEPTION '000212: audience team:manage attesa 3 ruoli, trovati %', n; END IF;

  SELECT count(*) INTO n
    FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE p.auth_permission_code = 'team:manage'
     AND t.entity_table = 'sys_auth_permissions' AND t.field = 'name' AND t.locale = 'en';
  IF n <> 1 THEN RAISE EXCEPTION '000212: overlay EN mancante per team:manage'; END IF;

  RAISE NOTICE '000212: team:manage attiva (PLATFORM_ADMIN, TENANT_ADMIN, HRMS_MANAGER)';
END $$;
