-- ============================================================================
-- Inversa di db/scripts/rtl-ruolo-segue-lavoro.sql, per un solo run_id:
--
--   psql -v ON_ERROR_STOP=1 -v run_id=<uuid> -f db/scripts/rtl-ruolo-segue-lavoro-inversa.sql
--
-- Non cancella niente. Una CONCESSIONE del giro torna revocata; una REVOCA del giro torna
-- attiva (revoked_at = NULL), se nel frattempo nessuno ha concesso di nuovo lo stesso ruolo.
-- Le righe del giornale si marcano annullato_il. Una seconda passata non trova niente.
-- ============================================================================
\if :{?run_id}
\else
  \echo 'manca -v run_id=<uuid>'
  SELECT 1/0 AS manca_la_variabile;
  \quit
\endif
BEGIN;
LOCK TABLE sys.sys_user_auth_roles IN SHARE ROW EXCLUSIVE MODE;
SELECT set_config('rtl.run_id', :'run_id', true);
DO $$
DECLARE v_run uuid := current_setting('rtl.run_id')::uuid; v_c int; v_r int; v_doppi int;
BEGIN
  SELECT count(*) INTO v_doppi
    FROM staging.rtl_ruolo_segue_lavoro_undo j
    JOIN sys.sys_user_auth_roles t ON t.user_auth_role_id = j.user_auth_role_id
   WHERE j.run_id = v_run AND j.azione = 'REVOCA' AND j.annullato_il IS NULL
     AND EXISTS (SELECT 1 FROM sys.sys_user_auth_roles x
                  WHERE x.user_auth_role_user_id = t.user_auth_role_user_id
                    AND x.user_auth_role_role_id = t.user_auth_role_role_id
                    AND x.user_auth_role_tenant_id IS NOT DISTINCT FROM t.user_auth_role_tenant_id
                    AND x.user_auth_role_revoked_at IS NULL);
  IF v_doppi > 0 THEN
    RAISE EXCEPTION 'inversa: % ruoli revocati sono stati nel frattempo concessi di nuovo; si guarda a mano', v_doppi;
  END IF;

  UPDATE sys.sys_user_auth_roles t SET user_auth_role_revoked_at = clock_timestamp()
    FROM staging.rtl_ruolo_segue_lavoro_undo j
   WHERE j.run_id = v_run AND j.azione = 'CONCEDE' AND j.annullato_il IS NULL
     AND t.user_auth_role_id = j.user_auth_role_id AND t.user_auth_role_revoked_at IS NULL;
  GET DIAGNOSTICS v_c = ROW_COUNT;

  UPDATE sys.sys_user_auth_roles t SET user_auth_role_revoked_at = NULL
    FROM staging.rtl_ruolo_segue_lavoro_undo j
   WHERE j.run_id = v_run AND j.azione = 'REVOCA' AND j.annullato_il IS NULL
     AND t.user_auth_role_id = j.user_auth_role_id AND t.user_auth_role_revoked_at IS NOT NULL;
  GET DIAGNOSTICS v_r = ROW_COUNT;

  UPDATE staging.rtl_ruolo_segue_lavoro_undo SET annullato_il = clock_timestamp()
   WHERE run_id = v_run AND annullato_il IS NULL;

  RAISE NOTICE 'INVERSA OK — run_id %: % concessioni ritirate, % revoche annullate', v_run, v_c, v_r;
END $$;
COMMIT;
