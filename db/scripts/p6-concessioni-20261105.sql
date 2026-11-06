-- ============================================================================
-- P-6, concessioni autorizzate da Enzo il 2026-11-05 alle 20:18 ora di Roma.
-- FUORI CATENA: si lancia a mano, una volta.
--
--   psql -v ON_ERROR_STOP=1 [-v prova=1] -f db/scripts/p6-concessioni-20261105.sql
--
-- Con -v prova=1 fa tutto e chiude con ROLLBACK: nessuna scrittura resta.
--
-- CONCESSIONI: RECRUITER beatrice.russo; HIRING_MANAGER valentina.conti (tenant RTL_BANK);
--   BLUEPRINT_MANAGER, SALES, PLATFORM_OPERATOR, IMPLEMENTATION_CONSULTANT enzo.spenuso
--   (tenant HEURESYS). Nessuno dei sei e' in MANDATE_ROLES (lib/scope/mandati.ts), quindi
--   non passano da un atto di ADR-0050 D4. Alle utenze di prova non si toglie niente.
-- GUARDIA: ogni persona esiste, e' ACTIVE e sta nel tenant atteso; ogni ruolo esiste, non e'
--   ritirato e non e' un mandato; nessuna delle sei concessioni e' gia' attiva.
-- GIORNALE: staging.p6_concessioni_undo (run_id, riga concessa, persona, ruolo).
-- INVERSA: db/scripts/p6-concessioni-20261105-inversa.sql -v run_id=<uuid>.
-- POST-CONDIZIONI: le righe di prima identiche; righe totali = prima + 6; le sei attive.
-- ============================================================================
\if :{?prova}
\else
  \set prova 0
\endif

BEGIN;

CREATE TABLE IF NOT EXISTS staging.p6_concessioni_undo (
  undo_id            bigserial   PRIMARY KEY,
  run_id             uuid        NOT NULL,
  user_auth_role_id  uuid        NOT NULL,
  email              text        NOT NULL,
  ruolo              text        NOT NULL,
  eseguito_il        timestamptz NOT NULL DEFAULT clock_timestamp(),
  annullato_il       timestamptz
);

LOCK TABLE sys.sys_user_auth_roles IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  v_run uuid := gen_random_uuid();
  v_conc uuid;
  v_n_pre bigint; v_n_post bigint;
  v_h_pre text; v_h_post text;
  v_x int; v_id uuid; rec record;
BEGIN
  SELECT user_id INTO v_conc FROM sys.sys_users
   WHERE user_email = 'enzo.spenuso@heuresys.com' AND user_status = 'ACTIVE';
  IF v_conc IS NULL THEN RAISE EXCEPTION 'concedente non trovato o non attivo'; END IF;

  CREATE TEMP TABLE p6_voci ON COMMIT DROP AS
  SELECT v.email, v.ruolo, v.tenant_code, v.motivo, u.user_id, u.user_tenant_id, r.auth_role_id, t.tenant_id, r.retired_at
    FROM (VALUES
      ('beatrice.russo@rtl-bank.org',  'RECRUITER',                 'RTL_BANK', 'P-6: la selezione sta nella Divisione HR (Enzo, 2026-11-05)'),
      ('valentina.conti@rtl-bank.org', 'HIRING_MANAGER',            'RTL_BANK', 'P-6: aprire una posizione e scegliere il candidato sono della Divisione HR (Enzo, 2026-11-05)'),
      ('enzo.spenuso@heuresys.com',    'BLUEPRINT_MANAGER',         'HEURESYS', 'P-6: ruolo tenuto solo da utenze di prova (Enzo, 2026-11-05)'),
      ('enzo.spenuso@heuresys.com',    'SALES',                     'HEURESYS', 'P-6: ruolo tenuto solo da utenze di prova (Enzo, 2026-11-05)'),
      ('enzo.spenuso@heuresys.com',    'PLATFORM_OPERATOR',         'HEURESYS', 'P-6: ruolo tenuto solo da utenze di prova (Enzo, 2026-11-05)'),
      ('enzo.spenuso@heuresys.com',    'IMPLEMENTATION_CONSULTANT', 'HEURESYS', 'P-6: ruolo tenuto solo da utenze di prova (Enzo, 2026-11-05)')
    ) AS v(email, ruolo, tenant_code, motivo)
    LEFT JOIN sys.sys_tenancies t ON t.tenant_code = v.tenant_code
    LEFT JOIN sys.sys_users u ON u.user_email = v.email AND u.user_status = 'ACTIVE'
    LEFT JOIN sys.sys_auth_roles r ON r.auth_role_code = v.ruolo;

  SELECT count(*) INTO v_x FROM p6_voci
   WHERE user_id IS NULL OR auth_role_id IS NULL OR retired_at IS NOT NULL OR user_tenant_id <> tenant_id;
  IF v_x > 0 THEN RAISE EXCEPTION 'guardia: % voci con persona, ruolo o tenant non validi', v_x; END IF;
  SELECT count(*) INTO v_x FROM p6_voci;
  IF v_x <> 6 THEN RAISE EXCEPTION 'guardia: % voci invece di 6', v_x; END IF;

  SELECT count(*) INTO v_x FROM p6_voci WHERE ruolo IN (SELECT sys.f_ruoli_mandato());
  IF v_x > 0 THEN RAISE EXCEPTION 'guardia: % ruoli sono mandati e richiedono un atto (ADR-0050 D4)', v_x; END IF;

  SELECT count(*) INTO v_x FROM p6_voci p JOIN sys.sys_user_auth_roles g
      ON g.user_auth_role_user_id = p.user_id AND g.user_auth_role_role_id = p.auth_role_id
     AND g.user_auth_role_revoked_at IS NULL;
  IF v_x > 0 THEN RAISE EXCEPTION 'guardia: % concessioni sono gia attive', v_x; END IF;

  SELECT count(*), md5(string_agg(g::text, '|' ORDER BY g.user_auth_role_id))
    INTO v_n_pre, v_h_pre FROM sys.sys_user_auth_roles g;

  FOR rec IN SELECT * FROM p6_voci LOOP
    INSERT INTO sys.sys_user_auth_roles
      (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id, user_auth_role_granted_by, user_auth_role_reason)
    VALUES (rec.user_id, rec.auth_role_id, rec.tenant_id, v_conc, rec.motivo)
    RETURNING user_auth_role_id INTO v_id;
    INSERT INTO staging.p6_concessioni_undo (run_id, user_auth_role_id, email, ruolo)
    VALUES (v_run, v_id, rec.email, rec.ruolo);
  END LOOP;

  SELECT count(*) INTO v_n_post FROM sys.sys_user_auth_roles;
  IF v_n_post <> v_n_pre + 6 THEN RAISE EXCEPTION 'post: righe % invece di %', v_n_post, v_n_pre + 6; END IF;

  SELECT md5(string_agg(g::text, '|' ORDER BY g.user_auth_role_id)) INTO v_h_post
    FROM sys.sys_user_auth_roles g
   WHERE g.user_auth_role_id NOT IN (SELECT user_auth_role_id FROM staging.p6_concessioni_undo WHERE run_id = v_run);
  IF v_h_post IS DISTINCT FROM v_h_pre THEN RAISE EXCEPTION 'post: le righe di prima sono cambiate'; END IF;

  SELECT count(*) INTO v_x FROM staging.p6_concessioni_undo j JOIN sys.sys_user_auth_roles g USING (user_auth_role_id)
   WHERE j.run_id = v_run AND g.user_auth_role_revoked_at IS NULL;
  IF v_x <> 6 THEN RAISE EXCEPTION 'post: % concessioni attive invece di 6', v_x; END IF;

  RAISE NOTICE 'run_id=% righe prima=% dopo=% impronta righe di prima invariata=%', v_run, v_n_pre, v_n_post, v_h_pre;
END $$;

\if :prova
  ROLLBACK;
  \echo 'PROVA: ROLLBACK, nessuna scrittura'
\else
  COMMIT;
  \echo 'COMMIT eseguito'
\endif
