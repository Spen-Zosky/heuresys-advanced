-- ============================================================================================
-- 000526 — I permessi del Backstage, l'organizzazione ghost (ADR-0063 D2, piano AI-driven voce G1).
--
-- LA REGOLA (Enzo, 2026-11-28). Il Backstage farà parte di un gruppo autonomo che raccoglie le voci
-- e le funzionalità degli agenti e degli assistenti, riservato ai ruoli apicali; per ora è dei soli
-- ruoli di Enzo e di Valentina Conti. L'accesso è legato ai RUOLI, mai alle persone che li occupano
-- (Enzo, stesso giorno): PLATFORM_ADMIN (il ruolo di Enzo) e HRMS_MANAGER (il ruolo di Valentina
-- Conti). Niente TENANT_ADMIN, che resta fuori per il deny-by-default della 000210.
--   · `ghost_unit:read`   vedere il Backstage: albero, elenco, storia e deriva dall'albero vivo;
--   · `ghost_unit:reform` riallineare la storia ghost all'albero vivo (scrive solo in
--                         sys.sys_ghost_units, mai sulle tabelle di business: ADR-0063 D3).
-- PLATFORM_ADMIN li riceve anche dalla 000005 a ogni giro; qui si concedono in modo esplicito perché
-- su un database nuovo la 000005 gira prima che i permessi esistano.
-- Solo-plenipotenziari PER DECISIONE: dichiarati in 000418, file di numero minore.
--
-- COSA FA: i due permessi, le concessioni, le traduzioni EN (ADR-0029). Nessuna tabella nuova.
-- IDEMPOTENTE. NESSUNA CANCELLAZIONE.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
SELECT v.code, v.nome, 'ghost_unit', v.azione
  FROM (VALUES
    ('ghost_unit:read',   'Vedere il Backstage: le unità ghost del tenant, la loro storia e la deriva dall''albero vivo', 'read'),
    ('ghost_unit:reform', 'Riallineare il Backstage all''albero vivo delle unità del tenant',                            'reform')
  ) AS v(code, nome, azione)
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_auth_permissions p WHERE p.auth_permission_code = v.code);

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM (VALUES
    ('PLATFORM_ADMIN', 'ghost_unit:read'),
    ('PLATFORM_ADMIN', 'ghost_unit:reform'),
    ('HRMS_MANAGER',   'ghost_unit:read'),
    ('HRMS_MANAGER',   'ghost_unit:reform')
  ) AS g(ruolo, codice)
  JOIN sys.sys_auth_roles r ON r.auth_role_code = g.ruolo
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = g.codice
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en', v.en, 'MANUAL'
  FROM (VALUES
    ('ghost_unit:read',   'View the Backstage: the tenant''s ghost units, their history and the drift from the live tree'),
    ('ghost_unit:reform', 'Realign the Backstage with the tenant''s live unit tree')
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
   WHERE auth_permission_code IN ('ghost_unit:read', 'ghost_unit:reform');
  IF n_perm <> 2 THEN RAISE EXCEPTION '000526: i permessi sono % invece di 2', n_perm; END IF;

  SELECT count(*) INTO n_grant
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE (r.auth_role_code, p.auth_permission_code) IN (
     ('PLATFORM_ADMIN', 'ghost_unit:read'), ('PLATFORM_ADMIN', 'ghost_unit:reform'),
     ('HRMS_MANAGER', 'ghost_unit:read'), ('HRMS_MANAGER', 'ghost_unit:reform'));
  IF n_grant <> 4 THEN RAISE EXCEPTION '000526: le concessioni sono % invece di 4', n_grant; END IF;

  -- nessun altro ruolo li ha: per ora il Backstage è dei soli ruoli di Enzo e di Valentina Conti
  IF EXISTS (
    SELECT 1 FROM sys.sys_auth_role_permissions rp
      JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
     WHERE p.auth_permission_code IN ('ghost_unit:read', 'ghost_unit:reform')
       AND r.auth_role_code NOT IN ('HRMS_MANAGER', 'PLATFORM_ADMIN')) THEN
    RAISE EXCEPTION '000526: un ruolo fuori da PLATFORM_ADMIN e HRMS_MANAGER ha un permesso del Backstage';
  END IF;

  SELECT count(*) INTO n_trad FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE t.entity_table = 'sys_auth_permissions' AND t.locale = 'en' AND t.field = 'name'
     AND p.auth_permission_code IN ('ghost_unit:read', 'ghost_unit:reform');
  IF n_trad <> 2 THEN RAISE EXCEPTION '000526: le traduzioni EN sono % invece di 2', n_trad; END IF;

  RAISE NOTICE '000526 ok: 2 permessi, 4 concessioni, 2 traduzioni';
END $$;
