-- ROLLBACK PRONTO per db/migrations/000423_r2_dpo_nucleo_gdpr.sql — mandato K, R-2.
--
-- NON e' un file della catena: vive apposta FUORI da db/migrations/, perche' se ci fosse
-- verrebbe ri-eseguito a OGNI deploy (ADR-0034: la catena si riapplica per intero) e
-- disfarebbe R-2 immediatamente dopo averla applicata. E' la ragione per cui il mandato
-- chiede "rollback PRONTA PRIMA di applicare" e non "rollback nella catena": R-2 e'
-- l'unica voce di F4 che toglie un potere (gdpr:erase) a una persona viva (HRMS_MANAGER),
-- quindi il contingency plan deve esistere ed essere committato PRIMA che 000423 tocchi la
-- produzione — ma restare inerte finche' nessuno lo attiva.
--
-- COME SI ATTIVA (decisione di chi vuole disfare R-2, mai automatica):
--   cp .programmi/K-ruoli-direzione/evidenze/R-2_202609190000/rollback_pronto_000424.sql \
--      db/migrations/000424_rollback_r2_dpo.sql
--   git add db/migrations/000424_rollback_r2_dpo.sql
--   git commit ...
--   (poi il deploy normale: pnpm db:migrate:vm)
--
-- EFFETTO: ritira il ruolo DPO (retired_at, ADR-0035 — la riga resta, non si cancella) e
-- restituisce gdpr:erase a HRMS_MANAGER (revoked_at = NULL). La riga di eccezione G-D2
-- (sys_ritiri_ammessi, HRMS_MANAGER/gdpr:erase/R-2, aggiunta da 000420) NON si tocca: una
-- volta che gdpr:erase torna attivo per HRMS_MANAGER, la vista v_permessi_ritirati_a_
-- ruoli_preesistenti non lo vede piu' comunque (filtra su revoked_at IS NOT NULL), quindi
-- la riga diventa innocua senza bisogno di rimuoverla.
--
\set ON_ERROR_STOP on

BEGIN;

-- 1. Ritira il ruolo DPO (storia, non cancellazione).
UPDATE sys.sys_auth_roles
   SET retired_at = now()
 WHERE auth_role_code = 'DPO' AND retired_at IS NULL;

-- 2. Restituisce gdpr:erase a HRMS_MANAGER — SOLO la riga ritirata da 000423, non un
--    ritiro fatto da qualcun altro dopo (elenco esplicito per migrazione, mai jolly).
UPDATE sys.sys_auth_role_permissions rp
   SET revoked_at = NULL, revoked_by_migration = NULL
  FROM sys.sys_auth_roles r, sys.sys_auth_permissions p
 WHERE rp.auth_role_id = r.auth_role_id
   AND rp.auth_permission_id = p.auth_permission_id
   AND r.auth_role_code = 'HRMS_MANAGER'
   AND p.auth_permission_code = 'gdpr:erase'
   AND rp.revoked_by_migration = '000423';

-- 3. Post-condizione.
DO $$
DECLARE n_dpo_attivo int; n_hrms_erase int;
BEGIN
  SELECT count(*) INTO n_dpo_attivo FROM sys.sys_auth_roles
   WHERE auth_role_code = 'DPO' AND retired_at IS NULL;
  IF n_dpo_attivo <> 0 THEN
    RAISE EXCEPTION '000424: DPO risulta ancora attivo dopo il ritiro';
  END IF;

  SELECT count(*) INTO n_hrms_erase
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'HRMS_MANAGER' AND p.auth_permission_code = 'gdpr:erase'
     AND rp.revoked_at IS NULL;
  IF n_hrms_erase <> 1 THEN
    RAISE EXCEPTION '000424: HRMS_MANAGER dovrebbe avere di nuovo gdpr:erase attivo, ne ha %', n_hrms_erase;
  END IF;

  RAISE NOTICE '000424 (rollback R-2): DPO ritirato, gdpr:erase restituito a HRMS_MANAGER.';
END $$;

COMMIT;

-- FINE 000424 (rollback, non attivo finche' non viene copiato in db/migrations/)
