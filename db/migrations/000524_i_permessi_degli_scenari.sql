-- ============================================================================================
-- 000524 — I permessi del motore degli scenari (ADR-0063 D5, piano AI-driven voce F3b-2).
--
-- LA REGOLA. Uno scenario di successione legge le tavole di successione di tutto il tenant e nomina
-- chi esce e chi copre: dati di classe EVALUATION (`scenario` in `lib/scope/data-classes.ts`). Per
-- questo i due permessi vanno ai soli mandati HR del tenant, che vedono tutto il tenant (I22):
--   · `scenario:read`   vedere gli scenari del tenant con opzioni, risultati, fonti ed equità;
--   · `scenario:create` calcolarne uno nuovo (scrive solo nelle tabelle degli scenari, ADR-0063 D3).
-- Concessi a HRMS_MANAGER e TENANT_ADMIN. PLATFORM_ADMIN li riceve dalla 000005, ma il servizio
-- calcola solo dentro il tenant dell'attore. Allargarli a un ruolo con un perimetro più stretto chiede
-- prima che il calcolo legga con quel perimetro: è una decisione delle voci F3d e G5, non di questa.
-- Solo-plenipotenziari PER DECISIONE: dichiarati in 000418, file di numero minore.
--
-- COSA FA: i due permessi, le concessioni, le traduzioni EN (ADR-0029). Nessuna tabella nuova.
-- IDEMPOTENTE. NESSUNA CANCELLAZIONE.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
SELECT v.code, v.nome, 'scenario', v.azione
  FROM (VALUES
    ('scenario:read',   'Vedere gli scenari what-if del tenant con opzioni, risultati, fonti ed equità', 'read'),
    ('scenario:create', 'Calcolare uno scenario what-if del tenant sulla struttura ombra',              'create')
  ) AS v(code, nome, azione)
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_auth_permissions p WHERE p.auth_permission_code = v.code);

-- TENANT_ADMIN è un mandato HR (I22): riceve entrambi (guardia D-57, deny-by-default della 000210).
-- TENANT_ADMIN-ALLOWLIST-EXTEND
CREATE TEMP TABLE _ta_extend_000524(code text PRIMARY KEY);
INSERT INTO _ta_extend_000524(code) VALUES
    ('scenario:read'),
    ('scenario:create');
DROP TABLE _ta_extend_000524;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM (VALUES
    ('HRMS_MANAGER', 'scenario:read'),
    ('HRMS_MANAGER', 'scenario:create'),
    ('TENANT_ADMIN', 'scenario:read'),
    ('TENANT_ADMIN', 'scenario:create')
  ) AS g(ruolo, codice)
  JOIN sys.sys_auth_roles r ON r.auth_role_code = g.ruolo
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = g.codice
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en', v.en, 'MANUAL'
  FROM (VALUES
    ('scenario:read',   'View the tenant''s what-if scenarios with options, results, sources and fairness'),
    ('scenario:create', 'Compute a what-if scenario of the tenant on the shadow structure')
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
   WHERE auth_permission_code IN ('scenario:read', 'scenario:create');
  IF n_perm <> 2 THEN RAISE EXCEPTION '000524: i permessi sono % invece di 2', n_perm; END IF;

  -- ciò che QUESTA migrazione concede, non lo stato globale
  SELECT count(*) INTO n_grant
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE (r.auth_role_code, p.auth_permission_code) IN (
     ('HRMS_MANAGER', 'scenario:read'), ('HRMS_MANAGER', 'scenario:create'),
     ('TENANT_ADMIN', 'scenario:read'), ('TENANT_ADMIN', 'scenario:create'));
  IF n_grant <> 4 THEN RAISE EXCEPTION '000524: le concessioni sono % invece di 4', n_grant; END IF;

  -- nessun ruolo fuori dai tre plenipotenziari li ha
  IF EXISTS (
    SELECT 1 FROM sys.sys_auth_role_permissions rp
      JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
     WHERE p.auth_permission_code IN ('scenario:read', 'scenario:create')
       AND r.auth_role_code NOT IN ('HRMS_MANAGER', 'TENANT_ADMIN', 'PLATFORM_ADMIN')) THEN
    RAISE EXCEPTION '000524: un ruolo fuori dai mandati HR ha un permesso degli scenari';
  END IF;

  SELECT count(*) INTO n_trad FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE t.entity_table = 'sys_auth_permissions' AND t.locale = 'en' AND t.field = 'name'
     AND p.auth_permission_code IN ('scenario:read', 'scenario:create');
  IF n_trad <> 2 THEN RAISE EXCEPTION '000524: le traduzioni EN sono % invece di 2', n_trad; END IF;

  RAISE NOTICE '000524 ok: 2 permessi, 4 concessioni, 2 traduzioni';
END $$;
