-- ============================================================================
-- Inversa di db/scripts/p6-concessioni-20261105.sql, per un solo run_id:
--
--   psql -v ON_ERROR_STOP=1 -v run_id=<uuid> -f db/scripts/p6-concessioni-20261105-inversa.sql
--
-- Non cancella niente: ogni concessione del giro torna revocata e la riga del giornale si
-- marca annullato_il. Una seconda passata non trova niente.
-- ============================================================================
\if :{?run_id}
\else
  \echo 'manca -v run_id=<uuid>'
  SELECT 1/0 AS manca_la_variabile;
  \quit
\endif
BEGIN;
LOCK TABLE sys.sys_user_auth_roles IN SHARE ROW EXCLUSIVE MODE;
SELECT set_config('p6.run_id', :'run_id', true);
DO $$
DECLARE v_run uuid := current_setting('p6.run_id')::uuid; v_c int;
BEGIN
  UPDATE sys.sys_user_auth_roles t SET user_auth_role_revoked_at = clock_timestamp()
    FROM staging.p6_concessioni_undo j
   WHERE j.run_id = v_run AND j.annullato_il IS NULL
     AND t.user_auth_role_id = j.user_auth_role_id AND t.user_auth_role_revoked_at IS NULL;
  GET DIAGNOSTICS v_c = ROW_COUNT;
  UPDATE staging.p6_concessioni_undo SET annullato_il = clock_timestamp()
   WHERE run_id = v_run AND annullato_il IS NULL;
  RAISE NOTICE 'revocate % concessioni del run %', v_c, v_run;
END $$;
COMMIT;
