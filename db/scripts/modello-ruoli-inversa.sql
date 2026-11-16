-- ============================================================================
-- Inversa di db/scripts/modello-ruoli.sql (ADR-0057). Si lancia solo con il sì di Enzo.
--
--   psql -v ON_ERROR_STOP=1 -v run_id=<uuid> -f db/scripts/modello-ruoli-inversa.sql
--
-- Prima si rimettono in vigore le revoche, poi si revocano le concessioni di quella corsa: RTL
-- non resta mai senza TENANT_ADMIN. Non si cancella niente. La corsa diventa ANNULLATA, e con
-- lei sys.f_modello_ruoli_applicato() torna falsa se non c'e' un'altra corsa APPLICATA.
-- GUARDIA: la corsa esiste, e' APPLICATA e non e' gia' annullata; nessuna riga rimessa in vigore
--   collide con una concessione attiva nata dopo (indice unico delle concessioni attive).
-- ============================================================================
\if :{?run_id}
\else
  \echo 'manca -v run_id=<uuid>'
  SELECT 1/0 AS manca_la_variabile;
  \quit
\endif

BEGIN;
LOCK TABLE sys.sys_user_auth_roles IN SHARE ROW EXCLUSIVE MODE;
SELECT set_config('modello.run_id', :'run_id', true);

DO $$
DECLARE v_run uuid := current_setting('modello.run_id')::uuid; v_x int; v_rip int; v_rev int;
BEGIN
  SELECT count(*) INTO v_x FROM staging.modello_ruoli_corse
   WHERE run_id = v_run AND esito = 'APPLICATA' AND annullata_il IS NULL;
  IF v_x <> 1 THEN RAISE EXCEPTION 'guardia: corsa % non trovata, non applicata o gia'' annullata', v_run; END IF;

  SELECT count(*) INTO v_x FROM staging.modello_ruoli_undo u
    JOIN sys.sys_user_auth_roles g ON g.user_auth_role_id = u.user_auth_role_id
   WHERE u.run_id = v_run AND u.azione = 'REVOCA' AND u.annullato_il IS NULL
     AND EXISTS (SELECT 1 FROM sys.sys_user_auth_roles a
                  WHERE a.user_auth_role_user_id = g.user_auth_role_user_id
                    AND a.user_auth_role_role_id = g.user_auth_role_role_id
                    AND a.user_auth_role_tenant_id IS NOT DISTINCT FROM g.user_auth_role_tenant_id
                    AND a.user_auth_role_revoked_at IS NULL
                    AND a.user_auth_role_id NOT IN (SELECT user_auth_role_id FROM staging.modello_ruoli_undo
                                                     WHERE run_id = v_run AND azione = 'CONCEDE'));
  IF v_x > 0 THEN RAISE EXCEPTION 'guardia: % revoche collidono con concessioni attive nate dopo', v_x; END IF;

  UPDATE sys.sys_user_auth_roles g
     SET user_auth_role_revoked_at = NULL, user_auth_role_revoked_by = NULL
    FROM staging.modello_ruoli_undo u
   WHERE u.run_id = v_run AND u.azione = 'REVOCA' AND u.annullato_il IS NULL
     AND g.user_auth_role_id = u.user_auth_role_id AND g.user_auth_role_revoked_at IS NOT NULL;
  GET DIAGNOSTICS v_rip = ROW_COUNT;

  UPDATE sys.sys_user_auth_roles g
     SET user_auth_role_revoked_at = clock_timestamp()
    FROM staging.modello_ruoli_undo u
   WHERE u.run_id = v_run AND u.azione = 'CONCEDE' AND u.annullato_il IS NULL
     AND g.user_auth_role_id = u.user_auth_role_id AND g.user_auth_role_revoked_at IS NULL;
  GET DIAGNOSTICS v_rev = ROW_COUNT;

  UPDATE staging.modello_ruoli_undo SET annullato_il = clock_timestamp()
   WHERE run_id = v_run AND annullato_il IS NULL;
  UPDATE staging.modello_ruoli_corse SET esito = 'ANNULLATA', annullata_il = clock_timestamp()
   WHERE run_id = v_run;

  RAISE NOTICE 'INVERSA OK: corsa %, % revoche rimesse in vigore, % concessioni revocate', v_run, v_rip, v_rev;
END $$;

COMMIT;
