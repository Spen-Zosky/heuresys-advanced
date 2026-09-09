-- 000389 — Un ruolo di cliente non si concede senza cliente (B6 passo 6).
--
-- PERCHE' ESISTE. La bonifica T1 (2026-09-09, fuori da questa catena — dati, non struttura)
-- ha corretto 11 concessioni di ruolo di cliente (10 BRANCH_MANAGER, 1
-- WHISTLEBLOWING_CUSTODIAN) scritte con `user_auth_role_tenant_id = NULL`.
-- `apps/api/src/modules/users/service.ts` tratta ogni concessione senza cliente come
-- concessione di PIATTAFORMA, revocabile solo da PLATFORM_ADMIN: un amministratore di
-- cliente non poteva togliere il ruolo ai propri dipendenti.
--
-- Correggere il dato non basta: senza un vincolo, la prossima INSERT scritta a mano (un
-- seed, uno script, un bugfix affrettato) puo' far ricomparire lo stesso difetto. Questo
-- file lo rende IMPOSSIBILE a livello di schema.
--
-- MECCANISMO. Un CHECK non basta: non puo' interrogare `sys_auth_roles` per sapere se un
-- ruolo e' di piattaforma. Serve un trigger BEFORE INSERT OR UPDATE che rifiuta una riga con
-- `user_auth_role_tenant_id IS NULL` quando il ruolo referenziato NON e' di piattaforma
-- (`auth_role_is_platform = false`).
--
-- Modello di trigger con prova a esiti opposti: mig. 000386 (B1, T3), stesso ciclo.

\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION sys.fn_user_auth_roles_richiede_tenant_se_non_piattaforma()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  e_di_piattaforma boolean;
BEGIN
  IF NEW.user_auth_role_tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT auth_role_is_platform INTO e_di_piattaforma
    FROM sys.sys_auth_roles WHERE auth_role_id = NEW.user_auth_role_role_id;

  IF e_di_piattaforma IS NOT TRUE THEN
    RAISE EXCEPTION
      'Un ruolo di cliente non si puo'' concedere senza cliente (user_auth_role_tenant_id '
      'NULL su un ruolo non di piattaforma, role_id=%). Vedi B6/T1 (2026-09-09): 11 '
      'concessioni cosi'' scritte rendevano irrevocabile il ruolo per l''amministratore del '
      'cliente.', NEW.user_auth_role_role_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION sys.fn_user_auth_roles_richiede_tenant_se_non_piattaforma() IS
  'B6/T1 passo 6 (2026-09-09). Impedisce di scrivere una concessione di ruolo di CLIENTE '
  '(auth_role_is_platform=false) con tenant NULL. I ruoli di piattaforma (PLATFORM_ADMIN) '
  'restano liberi di non averne uno.';

DROP TRIGGER IF EXISTS trg_user_auth_roles_richiede_tenant ON sys.sys_user_auth_roles;
CREATE TRIGGER trg_user_auth_roles_richiede_tenant
  BEFORE INSERT OR UPDATE ON sys.sys_user_auth_roles
  FOR EACH ROW
  EXECUTE FUNCTION sys.fn_user_auth_roles_richiede_tenant_se_non_piattaforma();

COMMIT;

-- =====================================================================================
-- LA PROVA A ESITI OPPOSTI — un INSERT che il trigger deve rifiutare, e uno che deve
-- lasciar passare. Tutto dentro una transazione che finisce in ROLLBACK.
-- =====================================================================================
-- BEGIN;
-- DO $prova$
-- DECLARE
--   ruolo_cliente    uuid;
--   ruolo_piattaforma uuid;
--   utente_qualunque uuid;
--   fallito          boolean := false;
-- BEGIN
--   SELECT auth_role_id INTO ruolo_cliente FROM sys.sys_auth_roles
--    WHERE auth_role_is_platform = false LIMIT 1;
--   SELECT auth_role_id INTO ruolo_piattaforma FROM sys.sys_auth_roles
--    WHERE auth_role_is_platform = true LIMIT 1;
--   SELECT user_id INTO utente_qualunque FROM sys.sys_users LIMIT 1;
--
--   -- ① deve FALLIRE: ruolo di cliente, tenant NULL
--   BEGIN
--     INSERT INTO sys.sys_user_auth_roles
--       (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
--     VALUES (utente_qualunque, ruolo_cliente, NULL);
--     RAISE EXCEPTION 'PROVA 1 NON SA FALLIRE: l''INSERT di un ruolo cliente senza tenant e'' passato';
--   EXCEPTION WHEN check_violation THEN
--     fallito := true;
--   END;
--   IF NOT fallito THEN
--     RAISE EXCEPTION 'PROVA 1: il trigger non ha sollevato check_violation';
--   END IF;
--   RAISE NOTICE 'PROVA 1 SUPERATA: ruolo cliente + tenant NULL rifiutato.';
--
--   -- ② deve PASSARE: ruolo di piattaforma, tenant NULL (comportamento invariato)
--   INSERT INTO sys.sys_user_auth_roles
--     (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
--   VALUES (utente_qualunque, ruolo_piattaforma, NULL);
--   RAISE NOTICE 'PROVA 2 SUPERATA: ruolo di piattaforma + tenant NULL ancora ammesso.';
-- END
-- $prova$;
-- ROLLBACK;   -- OBBLIGATORIO: nessuna delle due righe di prova resta
