-- ============================================================================
-- 000214 — #59 F/F5 (ADR-0031): permission `insight:read:self`
--
-- Self-view ESS dell'intelligence calcolata (capability + flight-risk con
-- evidenze) — decisione Enzo S1018 "tutto visibile al dipendente", supersede
-- della scelta D-6. Gate della nuova rotta self-scope GET /v1/me/development.
--
-- AUDIENCE derivata dal sibling semantico `gap_analysis:read:self` (pattern
-- 000208): chi può leggere la propria gap-analysis può leggere i propri score.
-- Self-healing: audience riportata ESATTAMENTE a quella della sorgente a ogni
-- re-run. i18n: name IT in-row + overlay EN (gate 000207 resta 0 gap).
--
-- IDEMPOTENTE + twice-run safe.
-- ============================================================================

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('insight:read:self', 'Lettura dei propri score calcolati (capability, flight-risk) con evidenze', 'insight', 'read:self')
ON CONFLICT (auth_permission_code) DO NOTHING;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en',
       'Read own computed scores (capability, flight-risk) with evidence', 'MANUAL'
  FROM sys.sys_auth_permissions p
 WHERE p.auth_permission_code = 'insight:read:self'
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

-- Estensione allowlist TENANT_ADMIN (guardia D-57 — parsa dopo il marker):
-- TENANT_ADMIN-ALLOWLIST-EXTEND
CREATE TEMP TABLE _ta_extend_000214(code text PRIMARY KEY);
INSERT INTO _ta_extend_000214(code) VALUES
    ('insight:read:self');
DROP TABLE _ta_extend_000214;

-- Audience derivata dalla sorgente (grant)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT rp.auth_role_id, np.auth_permission_id
  FROM sys.sys_auth_permissions sp
  JOIN sys.sys_auth_role_permissions rp ON rp.auth_permission_id = sp.auth_permission_id
  JOIN sys.sys_auth_permissions np ON np.auth_permission_code = 'insight:read:self'
 WHERE sp.auth_permission_code = 'gap_analysis:read:self'
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- Self-healing: audience ESATTAMENTE = sorgente
DELETE FROM sys.sys_auth_role_permissions rp
 USING sys.sys_auth_permissions np
 WHERE np.auth_permission_code = 'insight:read:self'
   AND rp.auth_permission_id = np.auth_permission_id
   AND NOT EXISTS (
     SELECT 1
       FROM sys.sys_auth_role_permissions srp
       JOIN sys.sys_auth_permissions sp ON sp.auth_permission_id = srp.auth_permission_id
      WHERE sp.auth_permission_code = 'gap_analysis:read:self'
        AND srp.auth_role_id = rp.auth_role_id);

-- Post-condition (fail-loud): audience identica alla sorgente
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM (
    (SELECT rp.auth_role_id FROM sys.sys_auth_role_permissions rp
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      WHERE p.auth_permission_code = 'insight:read:self'
     EXCEPT
     SELECT rp.auth_role_id FROM sys.sys_auth_role_permissions rp
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      WHERE p.auth_permission_code = 'gap_analysis:read:self')
    UNION ALL
    (SELECT rp.auth_role_id FROM sys.sys_auth_role_permissions rp
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      WHERE p.auth_permission_code = 'gap_analysis:read:self'
     EXCEPT
     SELECT rp.auth_role_id FROM sys.sys_auth_role_permissions rp
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      WHERE p.auth_permission_code = 'insight:read:self')
  ) diff;
  IF n <> 0 THEN
    RAISE EXCEPTION '000214: audience insight:read:self diverge dalla sorgente (% righe)', n;
  END IF;
  RAISE NOTICE '000214: insight:read:self attiva (audience = gap_analysis:read:self)';
END $$;
