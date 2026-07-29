-- ============================================================================
-- storia36 C10 — CONSENSI, GDPR, SEGNALAZIONI, ACCESSI: la coda sensibile
--
-- Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md (Task C10)
--
-- Quello che c'era: `sys_user_consents` VUOTA (nessuna delle 162 persone ha mai
-- espresso una scelta sui trattamenti facoltativi), `sys_whistleblowing_reports`
-- VUOTA, `sys_auth_sessions` VUOTA, una sola richiesta GDPR. E 91.761 eventi di
-- accesso che sembrano tanti finché non si guarda chi li ha prodotti: **dodici
-- persone in due mesi** — è il traffico dei collaudi, non l'uso della banca.
--
-- UNA PRECISAZIONE CHE CAMBIA IL DISEGNO: i quattro scopi previsti dal
-- vocabolario — profilazione, comunicazioni commerciali, uso interno delle
-- fotografie, condivisione con terzi — sono trattamenti FACOLTATIVI. Il
-- trattamento dei dati del rapporto di lavoro non si fonda sul consenso ma sul
-- contratto e sugli obblighi di legge: chiederlo sarebbe scorretto, e
-- registrarlo come «concesso da tutti» sarebbe falso. Quello che deve valere
-- per tutti è che ognuno abbia ESPRESSO UNA SCELTA su ciascuno dei quattro —
-- e una scelta può benissimo essere «no». È questo che il check C10a pretende.
--
-- COSA SCRIVE:
--  · CONSENSI — 162 persone × 4 scopi, raccolti all'ingresso in azienda, con
--    adesioni diverse per scopo (le fotografie interne passano più della
--    condivisione con terzi, che quasi nessuno concede). Più le revoche di chi
--    ha cambiato idea dopo, che arrivano dal portale e non dall'ufficio.
--  · GDPR — quattro richieste concluse in tre anni: tre di accesso ai propri
--    dati e una di cancellazione. Per 162 persone è il volume che ci si
--    aspetta, e ognuna è chiusa entro i trenta giorni di legge.
--  · SEGNALAZIONI — due casi chiusi, affidati al CUSTODE VERO (andrea.martino,
--    che ha il ruolo `WHISTLEBLOWING_CUSTODIAN`). Il contenuto riguarda il
--    PROCESSO e non le persone: nessun nome, nessun fatto attribuibile a
--    qualcuno. Una segnalazione è la cosa più delicata che questo database
--    possa contenere, e va trattata come tale anche quando la si costruisce.
--  · ACCESSI — la traccia storica che mancava: un accesso al mese per persona
--    in forza, più i tentativi andati a vuoto. Non «ogni login» (sarebbero
--    centinaia di migliaia di righe senza informazione), ma abbastanza da
--    poter dire chi usa il sistema e da quando.
--  · SESSIONI — solo la coda recente, quella che ha senso avere aperta adesso,
--    con alcune revocate.
--
-- NON SCRIVE i codici di recupero MFA, che il piano citava: un codice di
-- recupero è un segreto generato dal sistema quando la persona attiva il
-- secondo fattore. Scriverne di finti significherebbe mettere in tabella
-- credenziali che non funzionano — peggio che lasciarli assenti.
--
-- Idempotente: id uuid_generate_v5 su chiavi naturali. Twice-run: 0.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

DO $$
DECLARE
  c_rtl   constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns    constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  c_start constant date := DATE '2023-08-01';
  c_to    date;
  v_hr    uuid;
  v_cust  uuid;
  v_n     bigint := 0;
  v_tot   bigint := 0;
BEGIN
  SELECT staging.storia36_c4_frontier() INTO STRICT c_to;
  SELECT user_id INTO STRICT v_hr FROM sys.sys_users
   WHERE user_email = 'federica.marchetti@rtl-bank.org';
  -- il custode non è scelto: è chi ha il ruolo
  SELECT u.user_id INTO STRICT v_cust
    FROM sys.sys_users u
    JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
   WHERE r.auth_role_code = 'WHISTLEBLOWING_CUSTODIAN' AND u.user_tenant_id = c_rtl
   LIMIT 1;

  CREATE TEMP TABLE _persone ON COMMIT DROP AS
  SELECT u.user_id, u.user_email,
         GREATEST(min(e.user_employment_hire_date), c_start) AS dal
    FROM sys.sys_users u
    JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
   WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'
     AND e.user_employment_hire_date IS NOT NULL
   GROUP BY 1, 2;

  -- ==========================================================================
  -- 1. I CONSENSI — ognuno esprime una scelta, e una scelta può essere «no»
  -- ==========================================================================
  INSERT INTO sys.sys_user_consents (
    consent_id, consent_tenant_id, consent_user_id, consent_purpose,
    consent_action, consent_source, consent_note, consent_occurred_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C10::CONS::' || p.user_id || '::' || s.scopo),
         c_rtl, p.user_id, s.scopo,
         CASE WHEN (pg_temp.h(p.user_id::text || s.scopo || 'SI') % 100) < s.adesione
              THEN 'GRANT' ELSE 'REVOKE' END,
         'IMPORT',
         'Raccolta all''ingresso in azienda.',
         (p.dal + (pg_temp.h(p.user_id::text || s.scopo || 'GG') % 21))::timestamptz
    FROM _persone p
    CROSS JOIN (VALUES
      ('INTERNAL_PHOTO_USE', 71),
      ('ANALYTICS_PROFILING', 56),
      ('MARKETING_COMMUNICATIONS', 34),
      ('THIRD_PARTY_SHARING', 17)
    ) AS s(scopo, adesione)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C10: scelte sui trattamenti facoltativi %', v_n;

  -- chi ha cambiato idea dopo: la revoca arriva dal portale, non dall'ufficio
  INSERT INTO sys.sys_user_consents (
    consent_id, consent_tenant_id, consent_user_id, consent_purpose,
    consent_action, consent_source, consent_note, consent_occurred_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C10::REVOCA::' || p.user_id || '::' || s.scopo),
         c_rtl, p.user_id, s.scopo, 'REVOKE', 'ESS',
         'Revoca espressa dalla persona dal portale.',
         (p.dal + 400 + (pg_temp.h(p.user_id::text || s.scopo || 'RV') % 500))::timestamptz
    FROM _persone p
    CROSS JOIN (VALUES ('ANALYTICS_PROFILING'), ('MARKETING_COMMUNICATIONS')) AS s(scopo)
   WHERE (pg_temp.h(p.user_id::text || s.scopo || 'SI') % 100)
         < CASE s.scopo WHEN 'ANALYTICS_PROFILING' THEN 56 ELSE 34 END   -- aveva concesso
     AND (pg_temp.h(p.user_id::text || s.scopo || 'CAMBIO') % 100) < 9    -- e ci ripensa
     AND (p.dal + 400 + (pg_temp.h(p.user_id::text || s.scopo || 'RV') % 500)) <= c_to
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C10: revoche successive %', v_n;

  -- ==========================================================================
  -- 2. LE RICHIESTE GDPR — poche, e tutte chiuse nei termini
  -- ==========================================================================
  INSERT INTO sys.sys_gdpr_requests (
    gdpr_request_id, gdpr_request_tenant_id, gdpr_request_subject_user_id,
    gdpr_request_type, gdpr_request_status, gdpr_request_requested_by,
    gdpr_request_report, created_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C10::GDPR::' || g.n),
         c_rtl, p.user_id, g.tipo, 'COMPLETED', p.user_id,
         jsonb_build_object('storia36', 'C10', 'motivo', g.motivo,
                            'chiusa_il', (g.quando + g.giorni)::text,
                            'giorni_impiegati', g.giorni),
         g.quando::timestamptz
    FROM (VALUES
      (1, 'EXPORT',  DATE '2024-02-19', 11, 'Richiesta di accesso ai propri dati.'),
      (2, 'EXPORT',  DATE '2024-11-05',  9, 'Richiesta di accesso ai propri dati.'),
      (3, 'ERASURE', DATE '2025-07-14', 22, 'Richiesta di cancellazione dopo la cessazione del rapporto.'),
      (4, 'EXPORT',  DATE '2026-04-08', 14, 'Richiesta di accesso ai propri dati.')
    ) AS g(n, tipo, quando, giorni, motivo)
    CROSS JOIN LATERAL (
      -- il richiedente è una persona vera, scelta in modo stabile
      SELECT p2.user_id FROM _persone p2
       WHERE p2.dal <= g.quando
       ORDER BY pg_temp.h(p2.user_id::text || 'GDPR' || g.n) LIMIT 1) p
   WHERE g.quando <= c_to
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C10: richieste GDPR concluse %', v_n;

  -- ==========================================================================
  -- 3. LE SEGNALAZIONI — sul processo, mai sulle persone
  -- ==========================================================================
  INSERT INTO sys.sys_whistleblowing_reports (
    whistleblowing_report_id, whistleblowing_report_tenant_id,
    whistleblowing_report_tracking_code, whistleblowing_report_status,
    whistleblowing_report_category, whistleblowing_report_subject,
    whistleblowing_report_body, whistleblowing_report_contact,
    whistleblowing_report_assignee_user_id, whistleblowing_report_public_message,
    whistleblowing_report_internal_notes, whistleblowing_report_metadata,
    created_at, updated_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C10::WB::' || w.n),
         c_rtl, w.codice, w.stato, w.categoria, w.oggetto, w.corpo, NULL,
         v_cust, w.riscontro, w.note,
         jsonb_build_object('storia36', 'C10'),
         w.quando::timestamptz, (w.quando + w.giorni)::timestamptz
    FROM (VALUES
      (1, 'RTL-WB-2024-0001', 'UNSUBSTANTIATED', 'SAFETY',
       'Segnaletica di emergenza in una sede periferica',
       'La segnalazione riferisce che in una sede la segnaletica delle vie di esodo risulterebbe poco visibile in alcuni tratti.',
       'Verifica effettuata sul posto con il servizio di prevenzione e protezione: la segnaletica risulta conforme e leggibile. Sono state comunque aggiunte due indicazioni supplementari lungo il corridoio interno.',
       'Sopralluogo congiunto con RSPP. Nessuna difformità rilevata; interventi migliorativi disposti in via prudenziale. Nessuna persona coinvolta né identificata.',
       DATE '2024-06-11', 34),
      (2, 'RTL-WB-2025-0001', 'CLOSED', 'DATA_PRIVACY',
       'Modalità di conservazione di documentazione cartacea',
       'La segnalazione riguarda la conservazione di documentazione contenente dati della clientela in un archivio ad accesso non controllato.',
       'La verifica ha confermato la necessità di rivedere le modalità di conservazione. L''archivio è stato dotato di accesso controllato e la procedura interna è stata aggiornata.',
       'Riscontro fondato sul piano organizzativo. Intervento tecnico completato; procedura aggiornata e diffusa. La segnalazione riguarda un processo, non condotte individuali.',
       DATE '2025-09-23', 41)
    ) AS w(n, codice, stato, categoria, oggetto, corpo, riscontro, note, quando, giorni)
   WHERE (w.quando + w.giorni) <= c_to
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C10: segnalazioni chiuse %', v_n;

  -- ==========================================================================
  -- 4. GLI ACCESSI — la traccia storica che mancava
  -- ==========================================================================
  INSERT INTO sys.sys_auth_login_events (
    auth_login_event_id, auth_login_event_user_id, auth_login_event_tenant_id,
    auth_login_event_type, auth_login_event_ip, auth_login_event_user_agent,
    auth_login_event_details, created_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C10::LOGIN::' || p.user_id || '::' || m.mese),
         p.user_id, c_rtl,
         -- un accesso su venti va a vuoto: password sbagliata, e poi si rientra
         CASE WHEN (pg_temp.h(p.user_id::text || m.mese::date || 'ESITO') % 20) = 0
              THEN 'LOGIN_FAILED' ELSE 'LOGIN_SUCCESS' END,
         ('10.20.' || (1 + pg_temp.h(p.user_id::text || 'RETE') % 4) || '.'
              || (10 + pg_temp.h(p.user_id::text || 'HOST') % 200))::inet,
         'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
         jsonb_build_object('storia36', 'C10'),
         ((m.mese::date + (pg_temp.h(p.user_id::text || m.mese::date || 'GG') % 26))::timestamptz
                 + ((8 + pg_temp.h(p.user_id::text || m.mese::date || 'HH') % 10) || ' hours')::interval)
    FROM _persone p
    CROSS JOIN LATERAL generate_series(
      date_trunc('month', p.dal)::date, c_to, interval '1 month') AS m(mese)
   WHERE m.mese::date >= p.dal
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C10: accessi storici %', v_n;

  -- ==========================================================================
  -- 5. LE SESSIONI — NON si scrivono, e il motivo vale la pena scriverlo
  --
  -- Il primo tentativo le aveva popolate (71 righe in `sys_auth_sessions`), e
  -- il cancello di esposizione le ha subito segnalate come scoperte. Cercando
  -- il perché è venuto fuori che quella tabella NON È USATA DA NESSUNA PARTE
  -- nel codice: le sessioni vere sono le famiglie di token in
  -- `sys_auth_refresh_tokens`, ed è quello che la pagina «sicurezza» del
  -- portale mostra. `sys_auth_sessions` è il residuo di un modello mai
  -- adottato. Popolarla avrebbe messo nel database dati che nessuna schermata
  -- potrà mai mostrare — e una deroga qui sarebbe stata peggio del difetto:
  -- le deroghe servono per dati legittimi non ancora esposti, non per dati che
  -- non dovevano esserci. Le 71 righe scritte sono state rimosse.

  -- ==========================================================================
  -- 6. REGISTRO + POST-CONDIZIONI
  -- ==========================================================================
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C10', '10_security_privacy.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c10a();
  PERFORM staging.storia36_check_c10b(c_to);
  PERFORM staging.storia36_check_c10c();
  PERFORM staging.storia36_check_c10d();

  RAISE NOTICE 'storia36 C10 OK: % righe scritte (delta atteso 0 alla seconda corsa)', v_tot;
END $$;

COMMIT;
