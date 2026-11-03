-- ============================================================================
-- RTL, «il ruolo segue il lavoro» (regola di Enzo del 2026-10-31; approvazione delle
-- correzioni e dei titolari del 2026-10-31). FUORI CATENA: si lancia a mano, una volta.
--
--   psql -v ON_ERROR_STOP=1 -v concedente=<email di chi concede> \
--        [-v con_bellini=1] -f db/scripts/rtl-ruolo-segue-lavoro.sql
--
-- Prima si concede, poi si revoca: il tenant non resta mai senza un TENANT_ADMIN.
-- Non si cancella niente: una revoca valorizza user_auth_role_revoked_at.
-- Ogni concessione porta user_auth_role_granted_by = il concedente (prima era vuoto).
--
-- CONCESSIONI: PEOPLE_MANAGER paolo.barbieri; DPO laura.santoro; SECURITY_ADMIN
--   alice.costa; TAXONOMY_STEWARD beatrice.russo; DATA_STEWARD e TEAM_LEADER
--   maria.colombo; TENANT_ADMIN valentina.conti.
-- REVOCHE: HRMS_MANAGER maria.colombo; TENANT_ADMIN marco.desantis; TENANT_ADMIN
--   federica.marchetti (tiene CEO); TEAM_LEADER marco.rinaldi; READ_ONLY alberto.rossetti;
--   BLUEPRINT_MANAGER quintino.bellini SOLO con -v con_bellini=1.
-- RECRUITER e HIRING_MANAGER restano senza titolare (decisione del 2026-10-31).
--
-- GUARDIA: ogni persona esiste, e' ACTIVE e sta in RTL_BANK; ogni ruolo esiste; il
--   concedente esiste ed e' ACTIVE. Tabella bloccata per tutta la transazione.
-- GIORNALE: staging.rtl_ruolo_segue_lavoro_undo (run_id, azione, riga toccata, motivo).
-- INVERSA: db/scripts/rtl-ruolo-segue-lavoro-inversa.sql -v run_id=<uuid>.
-- POST-CONDIZIONI: le righe fuori dal giornale identiche a prima; righe totali = prima +
--   concessioni; lo stato voluto e' raggiunto; RTL ha almeno un TENANT_ADMIN e un
--   HRMS_MANAGER attivi su persone vere (non @collaudo.invalid); ogni persona toccata
--   porta ancora USER.
-- IDEMPOTENTE: una seconda passata non trova niente da fare.
-- Migrazione emendata insieme: 000049 non ridà un ruolo revocato.
-- ============================================================================
\if :{?concedente}
\else
  \echo 'manca -v concedente=<email>'
  SELECT 1/0 AS manca_la_variabile;
  \quit
\endif
\if :{?con_bellini}
\else
  \set con_bellini 0
\endif

BEGIN;

CREATE TABLE IF NOT EXISTS staging.rtl_ruolo_segue_lavoro_undo (
  undo_id            bigserial   PRIMARY KEY,
  run_id             uuid        NOT NULL,
  azione             varchar(8)  NOT NULL CHECK (azione IN ('CONCEDE','REVOCA')),
  user_auth_role_id  uuid        NOT NULL,
  email              text        NOT NULL,
  ruolo              text        NOT NULL,
  concedente_id      uuid        NOT NULL,
  motivo             text        NOT NULL,
  eseguito_il        timestamptz NOT NULL DEFAULT clock_timestamp(),
  annullato_il       timestamptz
);
CREATE INDEX IF NOT EXISTS rtl_ruolo_segue_lavoro_undo_run_idx
  ON staging.rtl_ruolo_segue_lavoro_undo (run_id);

LOCK TABLE sys.sys_user_auth_roles IN SHARE ROW EXCLUSIVE MODE;

SELECT set_config('rtl.concedente', :'concedente', true),
       set_config('rtl.con_bellini', :'con_bellini', true);

DO $$
DECLARE
  v_run uuid := gen_random_uuid();
  v_tenant uuid; v_conc uuid;
  v_n_pre bigint; v_n_post bigint; v_conc_n int; v_rev_n int;
  v_h_fuori_pre text; v_h_fuori_post text;
  v_mancano int; v_x int; rec record;
BEGIN
  SELECT tenant_id INTO v_tenant FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK';
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'tenant RTL_BANK non trovato'; END IF;

  SELECT user_id INTO v_conc FROM sys.sys_users
   WHERE lower(user_email) = lower(current_setting('rtl.concedente')) AND user_status = 'ACTIVE';
  IF v_conc IS NULL THEN
    RAISE EXCEPTION 'concedente % non trovato o non ACTIVE', current_setting('rtl.concedente');
  END IF;

  CREATE TEMP TABLE _piano (ordine int, azione text, email text, ruolo text, motivo text) ON COMMIT DROP;
  INSERT INTO _piano VALUES
    (1, 'CONCEDE', 'valentina.conti@rtl-bank.org', 'TENANT_ADMIN',     'Direttrice HR: titolare del mandato di amministrazione del tenant'),
    (2, 'CONCEDE', 'paolo.barbieri@rtl-bank.org',  'PEOPLE_MANAGER',   'responsabile Ufficio Organizzazione: titolare del ruolo'),
    (3, 'CONCEDE', 'laura.santoro@rtl-bank.org',   'DPO',              'specialista Compliance: titolare del ruolo'),
    (4, 'CONCEDE', 'alice.costa@rtl-bank.org',     'SECURITY_ADMIN',   'responsabile Infrastrutture: titolare del ruolo'),
    (5, 'CONCEDE', 'beatrice.russo@rtl-bank.org',  'TAXONOMY_STEWARD', 'Ufficio Organizzazione: titolare del ruolo'),
    (6, 'CONCEDE', 'maria.colombo@rtl-bank.org',   'DATA_STEWARD',     'Amministrazione del Personale: il ruolo segue il lavoro'),
    (7, 'CONCEDE', 'maria.colombo@rtl-bank.org',   'TEAM_LEADER',      'responsabile di unita: comando della propria unita'),
    (10,'REVOCA',  'maria.colombo@rtl-bank.org',   'HRMS_MANAGER',     'il mandato HR sta al vertice HR, non all''Amministrazione del Personale'),
    (11,'REVOCA',  'marco.desantis@rtl-bank.org',  'TENANT_ADMIN',     'il lavoro non comprende l''amministrazione del tenant'),
    (12,'REVOCA',  'federica.marchetti@rtl-bank.org','TENANT_ADMIN',   'CEO: tiene CEO, l''amministrazione del tenant passa alla Direzione HR'),
    (13,'REVOCA',  'marco.rinaldi@rtl-bank.org',   'TEAM_LEADER',      'non guida un''unita'),
    (14,'REVOCA',  'alberto.rossetti@rtl-bank.org','READ_ONLY',        'il lavoro non richiede la lettura di tutto il tenant');
  IF current_setting('rtl.con_bellini') = '1' THEN
    INSERT INTO _piano VALUES
    (15,'REVOCA',  'quintino.bellini@rtl-bank.org','BLUEPRINT_MANAGER','confermato che non serve al consolidamento');
  END IF;

  -- GUARDIA: persone e ruoli
  SELECT count(*) INTO v_mancano FROM _piano p
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_users u
                      WHERE lower(u.user_email) = p.email AND u.user_status = 'ACTIVE'
                        AND u.user_tenant_id = v_tenant)
      OR NOT EXISTS (SELECT 1 FROM sys.sys_auth_roles r WHERE r.auth_role_code = p.ruolo);
  IF v_mancano > 0 THEN
    FOR rec IN SELECT p.email, p.ruolo FROM _piano p
              WHERE NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE lower(u.user_email) = p.email
                                  AND u.user_status = 'ACTIVE' AND u.user_tenant_id = v_tenant)
                 OR NOT EXISTS (SELECT 1 FROM sys.sys_auth_roles r2 WHERE r2.auth_role_code = p.ruolo)
    LOOP RAISE NOTICE 'non risolve: % / %', rec.email, rec.ruolo; END LOOP;
    RAISE EXCEPTION 'guardia: % righe del piano non risolvono; non si tocca niente', v_mancano;
  END IF;

  SELECT count(*) INTO v_n_pre FROM sys.sys_user_auth_roles;
  SELECT coalesce(md5(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.user_auth_role_id)), '')
    INTO v_h_fuori_pre FROM sys.sys_user_auth_roles t
   WHERE NOT EXISTS (
     SELECT 1 FROM _piano p JOIN sys.sys_users u ON lower(u.user_email) = p.email
       JOIN sys.sys_auth_roles r ON r.auth_role_code = p.ruolo
      WHERE p.azione = 'REVOCA' AND t.user_auth_role_user_id = u.user_id
        AND t.user_auth_role_role_id = r.auth_role_id AND t.user_auth_role_revoked_at IS NULL
        AND t.user_auth_role_tenant_id = v_tenant);

  -- 1. CONCESSIONI (prima di ogni revoca)
  WITH nuove AS (
    INSERT INTO sys.sys_user_auth_roles
      (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id, user_auth_role_granted_by)
    SELECT u.user_id, r.auth_role_id, v_tenant, v_conc
      FROM _piano p
      JOIN sys.sys_users u ON lower(u.user_email) = p.email
      JOIN sys.sys_auth_roles r ON r.auth_role_code = p.ruolo
     WHERE p.azione = 'CONCEDE'
       AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles x
                        WHERE x.user_auth_role_user_id = u.user_id AND x.user_auth_role_role_id = r.auth_role_id
                          AND x.user_auth_role_tenant_id = v_tenant AND x.user_auth_role_revoked_at IS NULL)
    RETURNING user_auth_role_id, user_auth_role_user_id, user_auth_role_role_id
  )
  INSERT INTO staging.rtl_ruolo_segue_lavoro_undo (run_id, azione, user_auth_role_id, email, ruolo, concedente_id, motivo)
  SELECT v_run, 'CONCEDE', n.user_auth_role_id, p.email, p.ruolo, v_conc, p.motivo
    FROM nuove n JOIN sys.sys_users u ON u.user_id = n.user_auth_role_user_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = n.user_auth_role_role_id
    JOIN _piano p ON p.email = lower(u.user_email) AND p.ruolo = r.auth_role_code AND p.azione = 'CONCEDE';
  GET DIAGNOSTICS v_conc_n = ROW_COUNT;

  -- 2. REVOCHE
  WITH tolte AS (
    UPDATE sys.sys_user_auth_roles t SET user_auth_role_revoked_at = clock_timestamp()
      FROM _piano p JOIN sys.sys_users u ON lower(u.user_email) = p.email
      JOIN sys.sys_auth_roles r ON r.auth_role_code = p.ruolo
     WHERE p.azione = 'REVOCA' AND t.user_auth_role_user_id = u.user_id
       AND t.user_auth_role_role_id = r.auth_role_id AND t.user_auth_role_tenant_id = v_tenant
       AND t.user_auth_role_revoked_at IS NULL
    RETURNING t.user_auth_role_id, p.email, p.ruolo, p.motivo
  )
  INSERT INTO staging.rtl_ruolo_segue_lavoro_undo (run_id, azione, user_auth_role_id, email, ruolo, concedente_id, motivo)
  SELECT v_run, 'REVOCA', user_auth_role_id, email, ruolo, v_conc, motivo FROM tolte;
  GET DIAGNOSTICS v_rev_n = ROW_COUNT;

  -- POST-CONDIZIONI
  SELECT count(*) INTO v_n_post FROM sys.sys_user_auth_roles;
  IF v_n_post <> v_n_pre + v_conc_n THEN
    RAISE EXCEPTION 'post: righe % attese %', v_n_post, v_n_pre + v_conc_n;
  END IF;
  SELECT coalesce(md5(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.user_auth_role_id)), '')
    INTO v_h_fuori_post FROM sys.sys_user_auth_roles t
   WHERE t.user_auth_role_id NOT IN (SELECT user_auth_role_id FROM staging.rtl_ruolo_segue_lavoro_undo
                                      WHERE run_id = v_run);
  IF v_h_fuori_post <> v_h_fuori_pre THEN
    RAISE EXCEPTION 'post: righe fuori dal piano cambiate';
  END IF;

  SELECT count(*) INTO v_x FROM _piano p
    JOIN sys.sys_users u ON lower(u.user_email) = p.email
    JOIN sys.sys_auth_roles r ON r.auth_role_code = p.ruolo
   WHERE (p.azione = 'CONCEDE') <> EXISTS (
          SELECT 1 FROM sys.sys_user_auth_roles x
           WHERE x.user_auth_role_user_id = u.user_id AND x.user_auth_role_role_id = r.auth_role_id
             AND x.user_auth_role_tenant_id = v_tenant AND x.user_auth_role_revoked_at IS NULL);
  IF v_x <> 0 THEN RAISE EXCEPTION 'post: % righe del piano non hanno lo stato voluto', v_x; END IF;

  SELECT count(*) INTO v_x FROM sys.sys_user_auth_roles x
    JOIN sys.sys_auth_roles rr ON rr.auth_role_id = x.user_auth_role_role_id
    JOIN sys.sys_users u ON u.user_id = x.user_auth_role_user_id
   WHERE rr.auth_role_code = 'TENANT_ADMIN' AND x.user_auth_role_tenant_id = v_tenant
     AND x.user_auth_role_revoked_at IS NULL AND u.user_email NOT ILIKE '%@collaudo.invalid';
  IF v_x = 0 THEN RAISE EXCEPTION 'post: RTL senza TENANT_ADMIN vero'; END IF;
  SELECT count(*) INTO v_x FROM sys.sys_user_auth_roles x
    JOIN sys.sys_auth_roles rr ON rr.auth_role_id = x.user_auth_role_role_id
    JOIN sys.sys_users u ON u.user_id = x.user_auth_role_user_id
   WHERE rr.auth_role_code = 'HRMS_MANAGER' AND x.user_auth_role_tenant_id = v_tenant
     AND x.user_auth_role_revoked_at IS NULL AND u.user_email NOT ILIKE '%@collaudo.invalid';
  IF v_x = 0 THEN RAISE EXCEPTION 'post: RTL senza HRMS_MANAGER vero'; END IF;

  SELECT count(DISTINCT p.email) INTO v_x FROM _piano p JOIN sys.sys_users u ON lower(u.user_email) = p.email
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles x
                       JOIN sys.sys_auth_roles rr ON rr.auth_role_id = x.user_auth_role_role_id
                      WHERE x.user_auth_role_user_id = u.user_id AND rr.auth_role_code = 'USER'
                        AND x.user_auth_role_revoked_at IS NULL);
  IF v_x <> 0 THEN RAISE EXCEPTION 'post: % persone toccate senza USER', v_x; END IF;

  RAISE NOTICE 'RUOLO SEGUE LAVORO OK — run_id %, % concessioni, % revoche, righe % -> %',
               v_run, v_conc_n, v_rev_n, v_n_pre, v_n_post;
END $$;

COMMIT;
