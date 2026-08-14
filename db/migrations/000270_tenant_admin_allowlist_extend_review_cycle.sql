-- ============================================================================
-- 000270 — I quattro permessi del ciclo di valutazione entrano nell'allowlist
--          esplicita di TENANT_ADMIN (D-57).
--
-- CHE COSA E' SUCCESSO
--   La 000256 ha creato `performance-review:read/write`, `calibration:manage` e
--   `review-cycle:manage`, e ne ha derivato la platea da chi possiede gia'
--   `talent:read` — un criterio corretto e voluto, che pero' include
--   TENANT_ADMIN. Cosi' TENANT_ADMIN ha ricevuto quattro permessi nuovi SENZA
--   passare dall'allowlist esplicita che la 000210 pretende.
--
--   La guardia `rbac-tenant-admin-allowlist` e' diventata rossa, ed e'
--   esattamente il suo mestiere: e' nata per intercettare l'assorbimento
--   silenzioso di D-57 (il CROSS JOIN della 000005, «tutto meno sette»), dove
--   ogni permesso nuovo finiva a TENANT_ADMIN senza che nessuno lo decidesse.
--   Il test non va adeguato: la decisione va DICHIARATA.
--
-- CHE COSA FA QUESTA MIGRAZIONE
--   Niente, sui dati. I quattro grant esistono gia' e restano identici: qui si
--   scrive il marcatore che li rende una scelta esplicita invece di un effetto
--   collaterale. L'INSERT e' un ON CONFLICT DO NOTHING che non trova nulla da
--   inserire — serve a rendere la migrazione auto-riparante se un giorno il
--   grant si perdesse.
--
-- PERCHE' TENANT_ADMIN LI TIENE
--   Sono la superficie sorella di `talent:read`, che TENANT_ADMIN gia' possiede:
--   9-box, fit, readiness, successione. Un amministratore di tenant che vede il
--   9-box e non il ciclo che lo produce avrebbe una vista mutilata. La scelta
--   coincide con quella gia' presa dalla 000256; cambia solo che ora e' scritta.
--
-- NON tocca `mask` (ADR-0032): quello riguarda PLATFORM_ADMIN su COMPENSATION e
-- EVALUATION, ed e' un asse diverso da chi detiene il permesso.
--
-- IDEMPOTENTE + twice-run safe.
-- ============================================================================

BEGIN;

-- Estensione allowlist TENANT_ADMIN (la guardia rbac-tenant-admin-allowlist
-- parsa le righe VALUES a colonna singola dopo questo marker):
-- TENANT_ADMIN-ALLOWLIST-EXTEND
CREATE TEMP TABLE _ta_extend_000270(code text PRIMARY KEY);
INSERT INTO _ta_extend_000270(code) VALUES
    ('performance-review:read'),
    ('performance-review:write'),
    ('calibration:manage'),
    ('review-cycle:manage');

-- Auto-riparante: se un grant si perdesse, torna. Oggi non inserisce nulla.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  JOIN sys.sys_auth_permissions p
    ON p.auth_permission_code IN (SELECT code FROM _ta_extend_000270)
 WHERE r.auth_role_code = 'TENANT_ADMIN'
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$
DECLARE
  n_perm int; n_ta int; n_platea int; n_talent int;
BEGIN
  SELECT count(*) INTO n_perm FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN ('performance-review:read','performance-review:write',
                                  'calibration:manage','review-cycle:manage');
  IF n_perm <> 4 THEN
    RAISE EXCEPTION 'I quattro permessi della 000256 non ci sono tutti: trovati %', n_perm;
  END IF;

  SELECT count(*) INTO n_ta FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'TENANT_ADMIN'
     AND p.auth_permission_code IN ('performance-review:read','performance-review:write',
                                    'calibration:manage','review-cycle:manage');
  IF n_ta <> 4 THEN
    RAISE EXCEPTION 'TENANT_ADMIN dovrebbe avere tutti e quattro i permessi: ne ha %', n_ta;
  END IF;

  -- La platea complessiva non deve CAMBIARE: questa migrazione dichiara, non concede.
  -- [#92 F4, 2026-08-14] L'atteso NON e' piu' «4 volte i ruoli con talent:read»: quella
  -- formula inseguiva il perimetro di una superficie di CATALOGO, ed e' il difetto che la
  -- 000256 emendata e la 000309 hanno corretto. Ora la platea e' dichiarata: quattro ruoli.
  -- Il vincolo qui resta lo stesso in spirito — questo file non deve allargare nulla — ma
  -- misura contro la regola giusta. Trovato dalla SECONDA passata della prova generale:
  -- la prima era verde, perche' la revoca della 000309 non era ancora avvenuta.
  SELECT count(*) INTO n_platea FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE p.auth_permission_code IN ('performance-review:read','performance-review:write',
                                    'calibration:manage','review-cycle:manage')
     AND r.auth_role_code IN ('HRMS_MANAGER','TENANT_ADMIN','PLATFORM_ADMIN','MANAGER');
  SELECT count(DISTINCT x.auth_role_id) INTO n_talent FROM sys.sys_auth_role_permissions x
    JOIN sys.sys_auth_permissions xp ON xp.auth_permission_id = x.auth_permission_id
   WHERE xp.auth_permission_code = 'talent:read';
  IF n_platea <> 16 THEN
    RAISE EXCEPTION 'La platea del ciclo di valutazione e cambiata: % righe invece di 16 (4 permessi x 4 ruoli dichiarati); talent:read ne ha % ma non e piu il modello',
      n_platea, n_talent;
  END IF;

  RAISE NOTICE 'OK — allowlist TENANT_ADMIN estesa ai 4 permessi del ciclo di valutazione; platea invariata (% righe, % ruoli).', n_platea, n_talent;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK — togliere il marcatore riporterebbe la guardia rossa senza togliere
-- alcun grant: il rollback vero e' revocare i quattro permessi a TENANT_ADMIN,
-- che e' una decisione diversa e non va fatta per errore.
--
-- BEGIN;
--   DELETE FROM sys.sys_auth_role_permissions rp
--    USING sys.sys_auth_roles r, sys.sys_auth_permissions p
--    WHERE rp.auth_role_id = r.auth_role_id
--      AND rp.auth_permission_id = p.auth_permission_id
--      AND r.auth_role_code = 'TENANT_ADMIN'
--      AND p.auth_permission_code IN ('performance-review:read','performance-review:write',
--                                     'calibration:manage','review-cycle:manage');
-- COMMIT;
-- ============================================================================
