-- ─────────────────────────────────────────────────────────────────────────────
-- 000309 — I mandati di CATALOGO escono dal ciclo di valutazione (#92 F4)
--
-- COSA
--   Revoca `performance-review:read`, `performance-review:write`,
--   `calibration:manage`, `review-cycle:manage` a BLUEPRINT_MANAGER e PROCESS_OWNER.
--
-- PERCHE'
--   La 000256 derivo' la platea da chi possiede `talent:read`. Quel perimetro comprende
--   i due mandati di catalogo, il cui titolo — dichiarato in `apps/api/src/lib/scope/
--   domains.ts` — e' «le statistiche di catalogo e di processo del tenant, senza leggere
--   lo stipendio di nessuno». Le valutazioni sono dati di PERSONE (classe EVALUATION):
--   ricalcando la platea di una superficie di catalogo, il ciclo di valutazione ha
--   ereditato due ruoli che non hanno titolo a vederlo. E' lo stesso difetto che la
--   000270 aveva gia' corretto per TENANT_ADMIN — qui la classe di errore si chiude.
--
-- ADR-0035: la fonte e' gia' emendata (000256 concede alla platea DICHIARATA e ha la
--   post-condizione che vieta i due ruoli). Questo file rimuove l'esemplare esistente,
--   che l'emendamento da solo non toglie: `ON CONFLICT DO NOTHING` non revoca nulla.
--
-- MISURA PRIMA (2026-08-14, sul database di produzione):
--   4 permessi x 6 ruoli = 24 righe, di cui 8 ai due mandati di catalogo.
--   Persone toccate: BLUEPRINT_MANAGER 1, PROCESS_OWNER 1. Mapping totale: 957 -> 949.
--
-- ROLLBACK: giornale `staging.rbac_valutazione_undo`, popolato PRIMA della revoca, con
--   la funzione che lo riapplica. Chi deve tornare indietro non deve ricostruire nulla.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staging.rbac_valutazione_undo (
  undo_id          bigserial PRIMARY KEY,
  auth_role_code   varchar(64)  NOT NULL,
  permission_code  varchar(128) NOT NULL,
  granted_at       timestamptz,
  revocato_il      timestamptz  NOT NULL DEFAULT now(),
  migrazione       varchar(16)  NOT NULL DEFAULT '000309',
  UNIQUE (auth_role_code, permission_code, migrazione)
);

COMMENT ON TABLE staging.rbac_valutazione_undo IS
  'Giornale di ritorno della 000309: i grant RBAC del ciclo di valutazione revocati ai '
  'mandati di catalogo. Riapplicabile con staging.rbac_valutazione_ripristina().';

-- (a) il giornale si popola PRIMA: se la revoca fallisce a meta', si sa comunque cosa c'era
INSERT INTO staging.rbac_valutazione_undo (auth_role_code, permission_code, granted_at)
SELECT r.auth_role_code, p.auth_permission_code, rp.granted_at
  FROM sys.sys_auth_role_permissions rp
  JOIN sys.sys_auth_roles r       ON r.auth_role_id       = rp.auth_role_id
  JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
 WHERE r.auth_role_code IN ('BLUEPRINT_MANAGER','PROCESS_OWNER')
   AND p.auth_permission_code IN
       ('performance-review:read','performance-review:write','calibration:manage','review-cycle:manage')
ON CONFLICT (auth_role_code, permission_code, migrazione) DO NOTHING;

CREATE OR REPLACE FUNCTION staging.rbac_valutazione_ripristina()
RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id, granted_at)
  SELECT r.auth_role_id, p.auth_permission_id, coalesce(u.granted_at, now())
    FROM staging.rbac_valutazione_undo u
    JOIN sys.sys_auth_roles r       ON r.auth_role_code       = u.auth_role_code
    JOIN sys.sys_auth_permissions p ON p.auth_permission_code = u.permission_code
   WHERE u.migrazione = '000309'
  ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

COMMENT ON FUNCTION staging.rbac_valutazione_ripristina() IS
  'Riapplica i grant revocati dalla 000309. Ritorna quante righe ha rimesso.';

-- (b) la guardia ri-verifica la precondizione ADESSO, non eredita la misura di ieri
DO $$
DECLARE n_prima int; n_giornale int;
BEGIN
  SELECT count(*) INTO n_prima
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r       ON r.auth_role_id       = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code IN ('BLUEPRINT_MANAGER','PROCESS_OWNER')
     AND p.auth_permission_code IN
         ('performance-review:read','performance-review:write','calibration:manage','review-cycle:manage');

  IF n_prima = 0 THEN
    RAISE NOTICE '000309: nulla da revocare (gia applicata, oppure la 000256 emendata ha gia fatto effetto su un DB nuovo)';
    RETURN;
  END IF;

  SELECT count(*) INTO n_giornale FROM staging.rbac_valutazione_undo WHERE migrazione = '000309';
  IF n_giornale < n_prima THEN
    RAISE EXCEPTION '000309: il giornale di ritorno ha % righe ma ne devo revocare %: non procedo senza rollback', n_giornale, n_prima;
  END IF;
END $$;

-- La revoca. Elenco ESPLICITO di ruoli e permessi: mai un carattere jolly su una
-- tabella di autorizzazione.
DELETE FROM sys.sys_auth_role_permissions rp
 USING sys.sys_auth_roles r, sys.sys_auth_permissions p
 WHERE r.auth_role_id       = rp.auth_role_id
   AND p.auth_permission_id = rp.auth_permission_id
   AND r.auth_role_code IN ('BLUEPRINT_MANAGER','PROCESS_OWNER')
   AND p.auth_permission_code IN
       ('performance-review:read','performance-review:write','calibration:manage','review-cycle:manage');

-- (c) post-condizioni: ciò che doveva cambiare E ciò che NON doveva
DO $$
DECLARE n_residuo int; n_legittimi int; n_altri_catalogo int;
BEGIN
  -- doveva cambiare: i due mandati di catalogo non hanno piu' nulla del ciclo
  SELECT count(*) INTO n_residuo
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r       ON r.auth_role_id       = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code IN ('BLUEPRINT_MANAGER','PROCESS_OWNER')
     AND p.auth_permission_code IN
         ('performance-review:read','performance-review:write','calibration:manage','review-cycle:manage');
  IF n_residuo <> 0 THEN
    RAISE EXCEPTION '000309: restano % grant del ciclo di valutazione ai mandati di catalogo', n_residuo;
  END IF;

  -- NON doveva cambiare (1): i quattro ruoli legittimi tengono tutti e quattro i permessi
  SELECT count(*) INTO n_legittimi
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r       ON r.auth_role_id       = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code IN ('HRMS_MANAGER','TENANT_ADMIN','PLATFORM_ADMIN','MANAGER')
     AND p.auth_permission_code IN
         ('performance-review:read','performance-review:write','calibration:manage','review-cycle:manage');
  IF n_legittimi <> 16 THEN
    RAISE EXCEPTION '000309: la platea legittima e a % grant invece di 16 — ho tolto piu del dovuto', n_legittimi;
  END IF;

  -- NON doveva cambiare (2): i due ruoli conservano il loro mandato VERO, quello di
  -- catalogo. Se questa cade, la revoca ha sconfinato dal ciclo di valutazione.
  SELECT count(*) INTO n_altri_catalogo
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE r.auth_role_code IN ('BLUEPRINT_MANAGER','PROCESS_OWNER');
  IF n_altri_catalogo = 0 THEN
    RAISE EXCEPTION '000309: i mandati di catalogo sono rimasti senza alcun permesso: la revoca ha sconfinato';
  END IF;

  RAISE NOTICE '000309 ok — ciclo di valutazione: 16 grant alla platea dichiarata, 0 ai mandati di catalogo; questi conservano % permessi propri', n_altri_catalogo;
END $$;
