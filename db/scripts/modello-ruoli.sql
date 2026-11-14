-- ============================================================================
-- Il modello dei ruoli (ADR-0057; modello approvato da Enzo il 2026-11-10, ore 16:16 di Roma).
-- FUORI CATENA: si lancia a mano. In produzione solo con una frase scritta di Enzo.
--
--   psql -v ON_ERROR_STOP=1 -v concedente=<email di chi concede> -v modo=prova   -f db/scripts/modello-ruoli.sql
--   psql -v ON_ERROR_STOP=1 -v concedente=<email di chi concede> -v modo=applica -f db/scripts/modello-ruoli.sql
--
-- «prova» calcola e scrive tutto, stampa il piano e torna indietro (ROLLBACK): non resta niente.
-- «applica» fa lo stesso e conferma (COMMIT); da quel momento 000150, 000155, 000259 e 000272
-- smettono di concedere ruoli (sys.f_modello_ruoli_applicato()).
--
-- LO STATO A CUI PORTA (non si adatta a cio' che trova):
--   · ruolo di COMANDO = sys.v_ruoli_di_comando_attesi (000490), al massimo uno per persona;
--   · ruolo FUNZIONALE = l'elenco _funzionali qui sotto, deciso da Enzo, al massimo uno per
--     persona salvo le eccezioni dichiarate (una persona con due righe nell'elenco);
--   · TEAM_MEMBER non e' concesso a nessuno; USER non si tocca;
--   · le utenze @collaudo.invalid non tengono ruoli oltre USER (li ridà provision-collaudo-access
--     all'inizio di un giro).
--   Ogni altra concessione attiva, diversa da USER, delle persone dei tenant RTL_BANK e HEURESYS
--   e delle concessioni di piattaforma viene revocata. Non si cancella niente: una revoca
--   valorizza user_auth_role_revoked_at e user_auth_role_revoked_by.
--
-- ORDINE: prima si concede, poi si revoca: RTL non resta mai senza TENANT_ADMIN.
-- GUARDIA (al momento dell'esecuzione, mai ereditata dalla misura): ogni persona dell'elenco
--   esiste, e' ACTIVE e sta nel tenant dichiarato; ogni ruolo esiste; il concedente esiste ed e'
--   ACTIVE; nessuna unita' attiva e' retta da un'utenza di collaudo; tabella bloccata.
-- GIORNALE: staging.modello_ruoli_undo (run_id, azione, riga, ruolo, motivo) e
--   staging.modello_ruoli_corse (000490).
-- INVERSA: db/scripts/modello-ruoli-inversa.sql -v run_id=<uuid>.
-- POST-CONDIZIONI: le righe fuori dal giornale identiche a prima; utenti, posizioni, unita' e
--   assegnazioni invariati; sys.v_ruoli_fuori_modello vuota nel perimetro; al massimo un
--   comando e un funzionale per persona (eccezioni dichiarate a parte); RTL con un TENANT_ADMIN
--   vero; il piano raggiunto.
-- IDEMPOTENTE: una seconda passata non trova niente da fare.
-- ============================================================================
\if :{?concedente}
\else
  \echo 'manca -v concedente=<email>'
  SELECT 1/0 AS manca_la_variabile;
  \quit
\endif
\if :{?modo}
\else
  \echo 'manca -v modo=prova|applica'
  SELECT 1/0 AS manca_la_variabile;
  \quit
\endif
SELECT (:'modo' = 'applica') AS applica \gset
SELECT (:'modo' IN ('prova','applica')) AS modo_valido \gset
\if :modo_valido
\else
  \echo 'modo deve essere prova oppure applica'
  SELECT 1/0 AS modo_non_valido;
  \quit
\endif

BEGIN;

LOCK TABLE sys.sys_user_auth_roles IN SHARE ROW EXCLUSIVE MODE;

SELECT set_config('modello.concedente', :'concedente', true),
       set_config('modello.modo', :'modo', true);

DO $$
DECLARE
  v_run uuid := gen_random_uuid();
  v_rtl uuid; v_heu uuid; v_conc uuid;
  v_n_pre bigint; v_n_post bigint; v_conc_n int; v_rev_n int; v_x int;
  v_h_fuori_pre text; v_h_fuori_post text;
  v_conti_pre text; v_conti_post text;
  rec record;
BEGIN
  SELECT tenant_id INTO v_rtl FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK';
  SELECT tenant_id INTO v_heu FROM sys.sys_tenancies WHERE tenant_code = 'HEURESYS';
  IF v_rtl IS NULL OR v_heu IS NULL THEN
    RAISE EXCEPTION 'guardia: tenant RTL_BANK o HEURESYS non trovato';
  END IF;
  SELECT user_id INTO v_conc FROM sys.sys_users
   WHERE lower(user_email) = lower(current_setting('modello.concedente')) AND user_status = 'ACTIVE';
  IF v_conc IS NULL THEN
    RAISE EXCEPTION 'guardia: concedente % non trovato o non ACTIVE', current_setting('modello.concedente');
  END IF;

  -- L'ELENCO DEI RUOLI FUNZIONALI (decisioni D1-D5 di Enzo, 2026-11-10) ---------------------
  CREATE TEMP TABLE _funzionali (email text, ruolo text, tenant_code text, motivo text) ON COMMIT DROP;
  INSERT INTO _funzionali VALUES
    ('valentina.conti@rtl-bank.org',   'TENANT_ADMIN',             'RTL_BANK', 'HR Director: vertice HR con il mandato del tenant (D1)'),
    ('valentina.conti@rtl-bank.org',   'HRMS_MANAGER',             'RTL_BANK', 'HR Director: decide consolidamento e capacita degli agenti, che TENANT_ADMIN non ha (D1, D-57)'),
    ('maria.colombo@rtl-bank.org',     'PEOPLE_MANAGER',           'RTL_BANK', 'Resp. Amministrazione del Personale: gestione operativa delle persone (D2)'),
    ('marco.bruno@rtl-bank.org',       'DATA_STEWARD',             'RTL_BANK', 'Addetto Amministrazione del Personale: custode del dato del personale'),
    ('paolo.barbieri@rtl-bank.org',    'BLUEPRINT_MANAGER',        'RTL_BANK', 'Resp. Sviluppo, Formazione e Organizzazione: modello dell''organizzazione (D2)'),
    ('beatrice.russo@rtl-bank.org',    'RECRUITER',                'RTL_BANK', 'Specialista Formazione e Sviluppo: selezione (eccezione D3)'),
    ('beatrice.russo@rtl-bank.org',    'TAXONOMY_STEWARD',         'RTL_BANK', 'Specialista Formazione e Sviluppo: competenze (eccezione D3)'),
    ('laura.santoro@rtl-bank.org',     'DPO',                      'RTL_BANK', 'Specialista Compliance: protezione dei dati'),
    ('andrea.martino@rtl-bank.org',    'WHISTLEBLOWING_CUSTODIAN', 'RTL_BANK', 'Head of Legal & Compliance: custode delle segnalazioni'),
    ('alice.costa@rtl-bank.org',       'SECURITY_ADMIN',           'RTL_BANK', 'System Administrator: sicurezza degli accessi'),
    ('luca.bianchi@rtl-bank.org',      'PROCESS_OWNER',            'RTL_BANK', 'Operations Director: titolare dei processi'),
    ('enzo.spenuso@heuresys.com',      'PLATFORM_ADMIN',           NULL,       'Amministratore di Sistema: mandato di piattaforma');

  -- GUARDIA ---------------------------------------------------------------------------------
  SELECT count(*) INTO v_x FROM _funzionali f
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_auth_roles r WHERE r.auth_role_code = f.ruolo)
      OR NOT EXISTS (SELECT 1 FROM sys.sys_users u
                      WHERE lower(u.user_email) = f.email AND u.user_status = 'ACTIVE'
                        AND (f.tenant_code IS NULL
                             OR u.user_tenant_id = (SELECT tenant_id FROM sys.sys_tenancies
                                                     WHERE tenant_code = f.tenant_code)));
  IF v_x > 0 THEN
    FOR rec IN SELECT f.email, f.ruolo FROM _funzionali f
                WHERE NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE lower(u.user_email) = f.email
                                    AND u.user_status = 'ACTIVE')
                   OR NOT EXISTS (SELECT 1 FROM sys.sys_auth_roles r WHERE r.auth_role_code = f.ruolo)
    LOOP RAISE NOTICE 'non risolve: % / %', rec.email, rec.ruolo; END LOOP;
    RAISE EXCEPTION 'guardia: % righe dell''elenco non risolvono; non si tocca niente', v_x;
  END IF;
  SELECT count(*) INTO v_x FROM sys.sys_organization_units ou
    JOIN sys.sys_users u ON u.user_id = ou.organization_unit_manager_user_id
   WHERE ou.organization_unit_is_active AND u.user_email ILIKE '%@collaudo.invalid';
  IF v_x > 0 THEN
    RAISE EXCEPTION 'guardia: % unita'' attive rette da un''utenza di collaudo', v_x;
  END IF;

  -- LO STATO VOLUTO -------------------------------------------------------------------------
  -- perimetro: le persone dei due tenant e chiunque tenga una concessione di piattaforma
  CREATE TEMP TABLE _perimetro ON COMMIT DROP AS
  SELECT u.user_id, u.user_tenant_id, u.user_email FROM sys.sys_users u
   WHERE u.user_tenant_id IN (v_rtl, v_heu)
  UNION
  SELECT u.user_id, u.user_tenant_id, u.user_email FROM sys.sys_users u
   WHERE EXISTS (SELECT 1 FROM sys.sys_user_auth_roles g
                  WHERE g.user_auth_role_user_id = u.user_id AND g.user_auth_role_tenant_id IS NULL
                    AND g.user_auth_role_revoked_at IS NULL);

  CREATE TEMP TABLE _voluto (user_id uuid, role_id uuid, ruolo text, tenant_id uuid, motivo text) ON COMMIT DROP;
  INSERT INTO _voluto
  SELECT a.user_id, r.auth_role_id, a.ruolo, a.tenant_id,
         'ruolo di comando calcolato (ADR-0057 R2): ' || a.fonte
    FROM sys.v_ruoli_di_comando_attesi a
    JOIN _perimetro p ON p.user_id = a.user_id
    JOIN sys.sys_auth_roles r ON r.auth_role_code = a.ruolo;
  INSERT INTO _voluto
  SELECT u.user_id, r.auth_role_id, f.ruolo,
         (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = f.tenant_code),
         'ruolo funzionale (ADR-0057 R4): ' || f.motivo
    FROM _funzionali f
    JOIN sys.sys_users u ON lower(u.user_email) = f.email
    JOIN sys.sys_auth_roles r ON r.auth_role_code = f.ruolo;

  SELECT count(*) INTO v_n_pre FROM sys.sys_user_auth_roles;

  -- cio' che si revoca: ogni concessione attiva diversa da USER, nel perimetro, fuori dal voluto
  CREATE TEMP TABLE _da_revocare ON COMMIT DROP AS
  SELECT g.user_auth_role_id, g.user_auth_role_user_id AS user_id, r.auth_role_code AS ruolo,
         g.user_auth_role_tenant_id AS tenant_id,
         CASE WHEN p.user_email ILIKE '%@collaudo.invalid'
              THEN 'utenza di collaudo: nessun ruolo a riposo (ADR-0057 R7)'
              WHEN r.auth_role_code = 'TEAM_MEMBER'
              THEN 'TEAM_MEMBER non si concede piu: permessi tutti dentro USER (ADR-0057 R3)'
              WHEN r.auth_role_code IN ('CEO','MANAGER','BRANCH_MANAGER','TEAM_LEADER')
              THEN 'ruolo di comando che l''organigramma non assegna (ADR-0057 R2)'
              ELSE 'ruolo funzionale non previsto dal modello (ADR-0057 R4-R5)' END AS motivo
    FROM sys.sys_user_auth_roles g
    JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
    JOIN _perimetro p ON p.user_id = g.user_auth_role_user_id
   WHERE g.user_auth_role_revoked_at IS NULL
     AND r.auth_role_code <> 'USER'
     AND NOT EXISTS (SELECT 1 FROM _voluto v
                      WHERE v.user_id = g.user_auth_role_user_id AND v.role_id = g.user_auth_role_role_id
                        AND v.tenant_id IS NOT DISTINCT FROM g.user_auth_role_tenant_id);

  SELECT coalesce(md5(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.user_auth_role_id)), '')
    INTO v_h_fuori_pre FROM sys.sys_user_auth_roles t
   WHERE t.user_auth_role_id NOT IN (SELECT user_auth_role_id FROM _da_revocare);
  SELECT md5(string_agg(x::text, ',' ORDER BY x)) INTO v_conti_pre FROM (
    SELECT count(*) FROM sys.sys_users UNION ALL SELECT count(*) FROM sys.sys_positions
    UNION ALL SELECT count(*) FROM sys.sys_organization_units
    UNION ALL SELECT count(*) FROM sys.sys_user_position_assignments) c(x);

  INSERT INTO staging.modello_ruoli_corse (run_id, modo, esito, concedente_id)
  VALUES (v_run, upper(current_setting('modello.modo')),
          CASE WHEN current_setting('modello.modo') = 'applica' THEN 'APPLICATA' ELSE 'PROVATA' END, v_conc);

  -- 1. CONCESSIONI (prima di ogni revoca) ---------------------------------------------------
  WITH nuove AS (
    INSERT INTO sys.sys_user_auth_roles
      (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id,
       user_auth_role_granted_by, user_auth_role_reason)
    SELECT v.user_id, v.role_id, v.tenant_id, v_conc, v.motivo
      FROM _voluto v
     WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles x
                        WHERE x.user_auth_role_user_id = v.user_id AND x.user_auth_role_role_id = v.role_id
                          AND x.user_auth_role_tenant_id IS NOT DISTINCT FROM v.tenant_id
                          AND x.user_auth_role_revoked_at IS NULL)
    RETURNING user_auth_role_id, user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id,
              user_auth_role_reason
  )
  INSERT INTO staging.modello_ruoli_undo (run_id, azione, user_auth_role_id, user_id, ruolo, tenant_id, motivo)
  SELECT v_run, 'CONCEDE', n.user_auth_role_id, n.user_auth_role_user_id, r.auth_role_code,
         n.user_auth_role_tenant_id, n.user_auth_role_reason
    FROM nuove n JOIN sys.sys_auth_roles r ON r.auth_role_id = n.user_auth_role_role_id;
  GET DIAGNOSTICS v_conc_n = ROW_COUNT;

  -- 2. REVOCHE ------------------------------------------------------------------------------
  WITH tolte AS (
    UPDATE sys.sys_user_auth_roles t
       SET user_auth_role_revoked_at = clock_timestamp(), user_auth_role_revoked_by = v_conc
      FROM _da_revocare d
     WHERE t.user_auth_role_id = d.user_auth_role_id AND t.user_auth_role_revoked_at IS NULL
    RETURNING t.user_auth_role_id, d.user_id, d.ruolo, d.tenant_id, d.motivo
  )
  INSERT INTO staging.modello_ruoli_undo (run_id, azione, user_auth_role_id, user_id, ruolo, tenant_id, motivo)
  SELECT v_run, 'REVOCA', user_auth_role_id, user_id, ruolo, tenant_id, motivo FROM tolte;
  GET DIAGNOSTICS v_rev_n = ROW_COUNT;

  UPDATE staging.modello_ruoli_corse SET concessioni = v_conc_n, revoche = v_rev_n WHERE run_id = v_run;

  -- POST-CONDIZIONI -------------------------------------------------------------------------
  SELECT count(*) INTO v_n_post FROM sys.sys_user_auth_roles;
  IF v_n_post <> v_n_pre + v_conc_n THEN
    RAISE EXCEPTION 'post: righe % attese %', v_n_post, v_n_pre + v_conc_n;
  END IF;
  SELECT coalesce(md5(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.user_auth_role_id)), '')
    INTO v_h_fuori_post FROM sys.sys_user_auth_roles t
   WHERE t.user_auth_role_id NOT IN (SELECT user_auth_role_id FROM staging.modello_ruoli_undo WHERE run_id = v_run);
  IF v_h_fuori_post <> v_h_fuori_pre THEN
    RAISE EXCEPTION 'post: righe fuori dal giornale cambiate';
  END IF;
  SELECT md5(string_agg(x::text, ',' ORDER BY x)) INTO v_conti_post FROM (
    SELECT count(*) FROM sys.sys_users UNION ALL SELECT count(*) FROM sys.sys_positions
    UNION ALL SELECT count(*) FROM sys.sys_organization_units
    UNION ALL SELECT count(*) FROM sys.sys_user_position_assignments) c(x);
  IF v_conti_post <> v_conti_pre THEN
    RAISE EXCEPTION 'post: utenti, posizioni, unita'' o assegnazioni cambiati';
  END IF;

  SELECT count(*) INTO v_x FROM sys.v_ruoli_fuori_modello f JOIN _perimetro p ON p.user_id = f.user_id;
  IF v_x <> 0 THEN
    FOR rec IN SELECT f.difetto, p.user_email, f.ruolo FROM sys.v_ruoli_fuori_modello f
                 JOIN _perimetro p ON p.user_id = f.user_id LIMIT 20
    LOOP RAISE NOTICE 'fuori modello: % % %', rec.difetto, rec.user_email, rec.ruolo; END LOOP;
    RAISE EXCEPTION 'post: % concessioni fuori dal modello nel perimetro', v_x;
  END IF;

  SELECT count(*) INTO v_x FROM (
    SELECT g.user_auth_role_user_id FROM sys.sys_user_auth_roles g
      JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
      JOIN _perimetro p ON p.user_id = g.user_auth_role_user_id
     WHERE g.user_auth_role_revoked_at IS NULL
       AND r.auth_role_code IN ('CEO','MANAGER','BRANCH_MANAGER','TEAM_LEADER')
     GROUP BY 1 HAVING count(*) > 1) d;
  IF v_x <> 0 THEN RAISE EXCEPTION 'post: % persone con piu'' di un ruolo di comando', v_x; END IF;

  SELECT count(*) INTO v_x FROM (
    SELECT g.user_auth_role_user_id FROM sys.sys_user_auth_roles g
      JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
      JOIN _perimetro p ON p.user_id = g.user_auth_role_user_id
     WHERE g.user_auth_role_revoked_at IS NULL
       AND r.auth_role_code NOT IN ('USER','CEO','MANAGER','BRANCH_MANAGER','TEAM_LEADER')
     GROUP BY 1
    HAVING count(*) > (SELECT greatest(count(*), 1) FROM _funzionali f
                        WHERE f.email = (SELECT lower(user_email) FROM sys.sys_users
                                          WHERE user_id = g.user_auth_role_user_id))) d;
  IF v_x <> 0 THEN RAISE EXCEPTION 'post: % persone con piu'' ruoli funzionali di quelli dichiarati', v_x; END IF;

  SELECT count(*) INTO v_x FROM _voluto v
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles x
                      WHERE x.user_auth_role_user_id = v.user_id AND x.user_auth_role_role_id = v.role_id
                        AND x.user_auth_role_tenant_id IS NOT DISTINCT FROM v.tenant_id
                        AND x.user_auth_role_revoked_at IS NULL);
  IF v_x <> 0 THEN RAISE EXCEPTION 'post: % righe del voluto non raggiunte', v_x; END IF;

  SELECT count(*) INTO v_x FROM sys.sys_user_auth_roles x
    JOIN sys.sys_auth_roles r ON r.auth_role_id = x.user_auth_role_role_id
    JOIN sys.sys_users u ON u.user_id = x.user_auth_role_user_id
   WHERE r.auth_role_code = 'TENANT_ADMIN' AND x.user_auth_role_tenant_id = v_rtl
     AND x.user_auth_role_revoked_at IS NULL AND u.user_email NOT ILIKE '%@collaudo.invalid';
  IF v_x = 0 THEN RAISE EXCEPTION 'post: RTL senza TENANT_ADMIN vero'; END IF;

  -- IL PIANO, ruolo per ruolo
  FOR rec IN
    SELECT azione, ruolo, count(*) AS n FROM staging.modello_ruoli_undo
     WHERE run_id = v_run GROUP BY 1, 2 ORDER BY 1, 2
  LOOP RAISE NOTICE 'piano: % % x%', rec.azione, rec.ruolo, rec.n; END LOOP;

  RAISE NOTICE 'MODELLO DEI RUOLI OK (%): run_id %, % concessioni, % revoche, righe % -> %',
               current_setting('modello.modo'), v_run, v_conc_n, v_rev_n, v_n_pre, v_n_post;
END $$;

\if :applica
COMMIT;
\else
\echo 'modo prova: si torna indietro, non resta niente'
ROLLBACK;
\endif
