-- ============================================================================
-- storia36 C15 — LE USCITE: chi ha lasciato RTL negli ultimi tre anni.
--
-- Decisione di Enzo del 2026-11-26 (thread «Stimare le probabilità degli
-- scenari», voce F3c del piano AI-driven): fino a oggi nella storia di RTL
-- nessuno era mai uscito, e senza uscite le probabilità del motore degli
-- scenari non si possono stimare né provare su un periodo tenuto da parte.
-- Piano: docs/piani/ai-driven_20261126/F3c_PIANO_ex_dipendenti_storia36.md.
--
-- Dove si innesta, senza riscrivere niente di ciò che c'è:
--  · OGNI POSTO RIMASTO VUOTO E COPERTO DA UNA SELEZIONE INTERNA ERA DI
--    QUALCUNO CHE È USCITO. La storia ha requisizioni INTERNAL_MOBILITY chiuse
--    (FILLED) su posizioni che prima dell'arrivo del collega non avevano mai
--    avuto un titolare: il posto c'era, la selezione è stata aperta per
--    coprirlo, dunque qualcuno l'aveva lasciato. Questo seed scrive quel
--    qualcuno. Il numero di uscite non si sceglie: discende dai posti che la
--    storia ha già (misurati il 2026-11-26: 16 su 18 cambi interni).
--  · LE DATE SI LEGGONO DALLA SELEZIONE: le dimissioni (o il pensionamento)
--    si presentano pochi giorni prima che la requisizione si apra; l'ultimo
--    giorno di lavoro è il giorno lavorativo prima dell'arrivo del collega.
--  · CHI ESCE È ENTRATO PRIMA DELLA FINESTRA (assunzione prima del
--    2023-08-01), così C13a non gli chiede una selezione d'ingresso; il motivo
--    è PENSIONAMENTO per chi guidava una funzione (POS-*-HEAD), altrimenti
--    DIMISSIONI_VOLONTARIE o, una volta su cinque, RISOLUZIONE_CONSENSUALE.
--  · UN EX DIPENDENTE NON HA UN'UTENZA: user_status = 'DEACTIVATED', nessuna
--    identità né ruolo di accesso (I7). Nome di fantasia nello stile del
--    tenant (RTL Bank è un tenant dimostrativo: tutti i suoi dati sono
--    inventati), indirizzo sul dominio di RTL, che non riceve posta.
--  · LA REQUISIZIONE DICE CHI HA LASCIATO IL POSTO: requisition_metadata
--    riceve 'posto_lasciato_da' e 'uscita'. È l'unica riga esistente che
--    questo seed tocca, e solo aggiungendo due chiavi.
--
-- Il presente non si tocca: nessuna persona attiva, posizione o assegnazione
-- in corso cambia (post-condizione C15d). La loro storia fino all'uscita
-- (presenze, paghe, valutazioni, formazione) è la voce X3 del piano e arriva
-- dominio per dominio; C15c garantisce intanto che nessuna riga cada dopo
-- l'uscita.
--
-- Rollback: ogni riga scritta porta metadata->>'storia36' = 'C15' (persona,
-- rapporto, contratto, assegnazione, anagrafica) o la chiave
-- 'posto_lasciato_da' (requisizione); l'elenco si ricava da lì.
--
-- Idempotente: id uuid_generate_v5 su chiavi naturali (l'id della
-- requisizione), ON CONFLICT DO NOTHING. Twice-run: 0.
-- ============================================================================
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

-- Il giorno lavorativo più vicino all'indietro (come in 14_selezione.sql).
CREATE OR REPLACE FUNCTION pg_temp.wd(d date) RETURNS date LANGUAGE sql STABLE AS
$fn$
  SELECT coalesce(
    (SELECT max(c.cal_date) FROM staging.storia36_calendar c
      WHERE c.cal_date <= d AND c.cal_date > d - 10 AND c.is_workday),
    (SELECT max(g::date) FROM generate_series(d - 6, d, interval '1 day') g
      WHERE extract(isodow FROM g) < 6))
$fn$;

DO $$
DECLARE
  c_rtl    constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns     constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  c_start  constant date := DATE '2023-08-01';
  c_dom    constant text := 'rtl-bank.org';
  c_to     date;
  v_n      bigint := 0;
  v_tot    bigint := 0;
  v_impr   text;
  r        record;
  c_nomi_m constant text[] := ARRAY[
    'Alberto','Angelo','Bruno','Cesare','Corrado','Dario','Edoardo','Enrico','Ettore',
    'Franco','Gianluca','Guido','Ivano','Luigi','Massimo','Maurizio','Mauro','Ottavio',
    'Paolo','Renato','Sergio','Ugo','Vincenzo','Walter'];
  c_nomi_f constant text[] := ARRAY[
    'Adriana','Antonella','Barbara','Carla','Cristina','Daniela','Donatella','Emanuela',
    'Gabriella','Grazia','Lucia','Manuela','Marina','Monica','Nadia','Patrizia',
    'Roberta','Rosanna','Sabrina','Simona','Stefania','Tiziana','Vittoria','Zaira'];
  c_cogn   constant text[] := ARRAY[
    'Agostini','Baldini','Barbieri','Bertolini','Brambilla','Carraro','Castelli',
    'Cavalli','Cerutti','Ferretti','Fumagalli','Guidi','Lazzari','Lombardi','Magnani',
    'Marchesi','Mariani','Mazzoleni','Molinari','Montanari','Nicoletti','Pace',
    'Pedrazzini','Ravasi','Rinaldi','Rossetti','Sartori','Tagliabue','Vailati','Zanella'];
BEGIN
  SELECT staging.storia36_c4_frontier() INTO STRICT c_to;

  -- Le impronte del presente, prima di scrivere (post-condizione C15d).
  SELECT md5(string_agg(x, '|' ORDER BY x)) INTO v_impr FROM (
    SELECT u.user_id::text || u.user_status || coalesce(e.user_employment_termination_date::text, '-') AS x
      FROM sys.sys_users u
      LEFT JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
     WHERE u.user_tenant_id = c_rtl AND coalesce(u.user_metadata->>'storia36', '') <> 'C15'
    UNION ALL
    SELECT a.user_position_assignment_id::text || a.user_position_assignment_status
           || coalesce(a.user_position_assignment_end_date::text, '-')
      FROM sys.sys_user_position_assignments a
     WHERE a.user_position_assignment_tenant_id = c_rtl
       AND coalesce(a.user_position_assignment_metadata->>'storia36', '') <> 'C15') q;

  -- ==========================================================================
  -- 1. I POSTI LASCIATI: requisizione interna chiusa, posto mai avuto da
  --    nessuno (fuori da C15) prima dell'arrivo del collega.
  -- ==========================================================================
  CREATE TEMP TABLE c15_posti ON COMMIT DROP AS
  SELECT rq.requisition_id                  AS rq,
         rq.requisition_position_id         AS pos,
         p.position_code                    AS pos_code,
         rq.requisition_opened_on           AS aperta,
         arr.start_date                     AS arrivo,
         arr.user_id                        AS collega,
         pg_temp.h('C15::' || rq.requisition_id::text) AS k
    FROM sys.sys_job_requisitions rq
    JOIN sys.sys_positions p ON p.position_id = rq.requisition_position_id
    JOIN LATERAL (
      SELECT a.user_position_assignment_start_date AS start_date,
             a.user_position_assignment_user_id   AS user_id
        FROM sys.sys_user_position_assignments a
       WHERE a.user_position_assignment_position_id = rq.requisition_position_id
         AND a.user_position_assignment_kind = 'PRIMARY'
         AND a.user_position_assignment_start_date >= rq.requisition_opened_on
         AND coalesce(a.user_position_assignment_metadata->>'storia36', '') <> 'C15'
       ORDER BY a.user_position_assignment_start_date
       LIMIT 1) arr ON true
   WHERE rq.requisition_tenant_id = c_rtl
     AND rq.requisition_reason = 'INTERNAL_MOBILITY'
     AND rq.requisition_status = 'FILLED'
     AND rq.requisition_opened_on >= c_start
     AND arr.start_date <= c_to
     AND NOT EXISTS (
       SELECT 1 FROM sys.sys_user_position_assignments a0
        WHERE a0.user_position_assignment_position_id = rq.requisition_position_id
          AND a0.user_position_assignment_kind = 'PRIMARY'
          AND a0.user_position_assignment_start_date < arr.start_date
          AND coalesce(a0.user_position_assignment_metadata->>'storia36', '') <> 'C15');

  -- ==========================================================================
  -- 2. CHI L'HA LASCIATO: nome, nascita, ingresso, uscita, motivo.
  -- ==========================================================================
  CREATE TEMP TABLE c15_persone ON COMMIT DROP AS
  -- L'indirizzo: nome.cognome sul dominio di RTL; se un'altra persona (anche di
  -- questo stesso seed) l'ha già, si aggiunge un numero che dipende solo dalla
  -- requisizione, così la seconda corsa trova lo stesso indirizzo.
  SELECT y.*,
         y.base || CASE WHEN y.omonimo > 1
                          OR EXISTS (SELECT 1 FROM sys.sys_users u0
                                      WHERE u0.user_tenant_id = c_rtl AND u0.user_id <> y.uid
                                        AND lower(u0.user_email) = y.base || '@' || c_dom)
                        THEN '.' || (y.k % 89 + 11)::text ELSE '' END
                || '@' || c_dom                                   AS email
    FROM (
  SELECT x.*,
         lower(regexp_replace(x.nome || '.' || x.cognome, '[^A-Za-z.]', '', 'g')) AS base,
         row_number() OVER (PARTITION BY lower(x.nome || '.' || x.cognome) ORDER BY x.rq) AS omonimo
    FROM (
          SELECT ps.*,
             uuid_generate_v5(c_ns, 'STORIA36::C15::USER::' || ps.rq::text) AS uid,
             CASE WHEN ps.k % 2 = 0
                  THEN c_nomi_m[1 + (ps.k / 2) % array_length(c_nomi_m, 1)]
                  ELSE c_nomi_f[1 + (ps.k / 2) % array_length(c_nomi_f, 1)] END AS nome,
             CASE WHEN ps.k % 2 = 0 THEN 'MALE' ELSE 'FEMALE' END           AS genere,
             c_cogn[1 + (ps.k / 7) % array_length(c_cogn, 1)]               AS cognome,
             CASE WHEN ps.pos_code LIKE '%-HEAD' THEN 'PENSIONAMENTO'
                  WHEN ps.k % 5 = 0 THEN 'RISOLUZIONE_CONSENSUALE'
                  ELSE 'DIMISSIONI_VOLONTARIE' END                           AS motivo,
             pg_temp.wd(ps.arrivo - 1)                                        AS uscita,
             pg_temp.wd(ps.aperta - (1 + ps.k % 6))                           AS preavviso
        FROM c15_posti ps) x) y;

  ALTER TABLE c15_persone ADD COLUMN nascita date, ADD COLUMN ingresso date;
  -- Chi va in pensione ha 67 anni all'uscita e 25-35 anni di servizio; chi si
  -- dimette ne ha 28-55 ed è entrato fra 3 e 18 anni prima. Sempre: ingresso
  -- prima della finestra, e non prima dei 22 anni.
  UPDATE c15_persone SET
    nascita  = CASE WHEN motivo = 'PENSIONAMENTO'
                    THEN (uscita - interval '67 years' - (k % 300) * interval '1 day')::date
                    ELSE (uscita - interval '28 years' - (k % 27) * interval '1 year' - (k % 300) * interval '1 day')::date END;
  UPDATE c15_persone SET
    ingresso = pg_temp.wd(least(
                 c_start - 30,
                 CASE WHEN motivo = 'PENSIONAMENTO'
                      THEN (uscita - interval '25 years' - (k % 11) * interval '1 year')::date
                      ELSE (uscita - interval '3 years' - (k % 16) * interval '1 year' - (k % 200) * interval '1 day')::date END));
  UPDATE c15_persone SET ingresso = pg_temp.wd((nascita + interval '23 years')::date)
   WHERE ingresso < nascita + interval '22 years';

  -- ==========================================================================
  -- 3. LE RIGHE
  -- ==========================================================================
  INSERT INTO sys.sys_users
    (user_id, user_tenant_id, user_external_code, user_email, user_display_name,
     user_first_name, user_last_name, user_status, user_type, user_locale, user_timezone,
     user_metadata, created_at, updated_at)
  SELECT p.uid, c_rtl, 'STORIA36::C15::' || p.pos_code, p.email, p.nome || ' ' || p.cognome,
         p.nome, p.cognome, 'DEACTIVATED', 'STANDARD', 'it-IT', 'Europe/Rome',
         jsonb_build_object('storia36', 'C15', 'ex_dipendente', true),
         (p.ingresso + time '09:00') AT TIME ZONE 'Europe/Rome',
         (p.uscita + time '18:00') AT TIME ZONE 'Europe/Rome'
    FROM c15_persone p
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C15: ex dipendenti %', v_n;

  INSERT INTO sys.sys_user_demographics
    (user_demographics_id, user_demographics_user_id, user_demographics_tenant_id,
     user_demographics_birth_date, user_demographics_gender, user_demographics_nationality,
     user_demographics_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C15::DEMO::' || p.rq::text), p.uid, c_rtl,
         p.nascita, p.genere, 'IT', jsonb_build_object('storia36', 'C15')
    FROM c15_persone p
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;

  INSERT INTO sys.sys_user_employment
    (user_employment_id, user_employment_user_id, user_employment_tenant_id,
     user_employment_hire_date, user_employment_seniority_date,
     user_employment_termination_date, user_employment_termination_reason,
     user_employment_status, user_employment_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C15::EMP::' || p.rq::text), p.uid, c_rtl,
         p.ingresso, p.ingresso, p.uscita, p.motivo, 'TERMINATED',
         jsonb_build_object('storia36', 'C15', 'comunicazione_uscita', p.preavviso,
                            'posizione_lasciata', p.pos_code)
    FROM c15_persone p
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;

  -- Il contratto ricalca quello di chi oggi ha preso il posto (CCNL del credito,
  -- tipo e orario), con la sua data d'inizio e la cessazione.
  INSERT INTO sys.sys_user_contracts
    (user_contract_id, user_contract_user_id, user_contract_tenant_id, user_contract_type,
     user_contract_start_date, user_contract_end_date, user_contract_ccnl_type,
     user_contract_ccnl_level, user_contract_gross_annual_salary, user_contract_currency,
     user_contract_salary_type, user_contract_payment_frequency, user_contract_work_hours_weekly,
     user_contract_work_schedule_type, user_contract_job_title, user_contract_status,
     user_contract_termination_date, user_contract_termination_reason, user_contract_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C15::CONTRATTO::' || p.rq::text), p.uid, c_rtl,
         c.user_contract_type, p.ingresso, p.uscita, c.user_contract_ccnl_type,
         c.user_contract_ccnl_level, c.user_contract_gross_annual_salary, c.user_contract_currency,
         c.user_contract_salary_type, c.user_contract_payment_frequency,
         c.user_contract_work_hours_weekly, c.user_contract_work_schedule_type,
         pos.position_title, 'TERMINATED', p.uscita, p.motivo,
         jsonb_build_object('storia36', 'C15')
    FROM c15_persone p
    JOIN sys.sys_positions pos ON pos.position_id = p.pos
    LEFT JOIN LATERAL (
      SELECT * FROM sys.sys_user_contracts c0
       WHERE c0.user_contract_user_id = p.collega
       ORDER BY c0.user_contract_start_date DESC NULLS LAST LIMIT 1) c ON true
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;

  INSERT INTO sys.sys_user_position_assignments
    (user_position_assignment_id, user_position_assignment_tenant_id,
     user_position_assignment_user_id, user_position_assignment_position_id,
     user_position_assignment_kind, user_position_assignment_fte,
     user_position_assignment_start_date, user_position_assignment_end_date,
     user_position_assignment_status, user_position_assignment_notes,
     user_position_assignment_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C15::ASSEGNAZIONE::' || p.rq::text), c_rtl,
         p.uid, p.pos, 'PRIMARY', 1.000,
         p.ingresso, p.uscita, 'ENDED',
         'uscita: ' || lower(replace(p.motivo, '_', ' ')),
         jsonb_build_object('storia36', 'C15')
    FROM c15_persone p
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;

  UPDATE sys.sys_job_requisitions rq
     SET requisition_metadata = rq.requisition_metadata
           || jsonb_build_object('posto_lasciato_da', p.uid, 'uscita', p.uscita)
    FROM c15_persone p
   WHERE rq.requisition_id = p.rq
     AND NOT (rq.requisition_metadata ? 'posto_lasciato_da');
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C15: requisizioni annotate %', v_n;

  -- ==========================================================================
  -- 4. REGISTRO + POST-CONDIZIONI
  -- ==========================================================================
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C15', '15_uscite.sql', v_tot, v_tot);

  -- C15a/b/c nascono in db/scripts/verify-storia36.sql (custodia). Sul primo giro in un
  -- database dove la custodia non le ha ancora create, il seed non le pretende: la verifica
  -- la fa la custodia lanciata subito dopo, e C15d qui sotto protegge comunque il presente.
  IF to_regprocedure('staging.storia36_check_c15a()') IS NOT NULL
     AND to_regprocedure('staging.storia36_check_c15b()') IS NOT NULL
     AND to_regprocedure('staging.storia36_check_c15c()') IS NOT NULL THEN
    PERFORM staging.storia36_check_c15a();
    PERFORM staging.storia36_check_c15b();
    PERFORM staging.storia36_check_c15c();
  ELSE
    RAISE NOTICE 'storia36 C15: verifiche C15a/b/c non ancora create, le esegue la custodia dopo il seed';
  END IF;

  -- C15d: il presente non è cambiato.
  IF v_impr IS DISTINCT FROM (
    SELECT md5(string_agg(x, '|' ORDER BY x)) FROM (
      SELECT u.user_id::text || u.user_status || coalesce(e.user_employment_termination_date::text, '-') AS x
        FROM sys.sys_users u
        LEFT JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
       WHERE u.user_tenant_id = c_rtl AND coalesce(u.user_metadata->>'storia36', '') <> 'C15'
      UNION ALL
      SELECT a.user_position_assignment_id::text || a.user_position_assignment_status
             || coalesce(a.user_position_assignment_end_date::text, '-')
        FROM sys.sys_user_position_assignments a
       WHERE a.user_position_assignment_tenant_id = c_rtl
         AND coalesce(a.user_position_assignment_metadata->>'storia36', '') <> 'C15') q) THEN
    RAISE EXCEPTION 'C15d: il seed delle uscite ha cambiato persone o assegnazioni del presente';
  END IF;

  RAISE NOTICE 'storia36 C15 OK: % righe scritte (delta atteso 0 alla seconda corsa)', v_tot;
END $$;

COMMIT;
