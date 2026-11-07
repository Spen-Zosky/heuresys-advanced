-- ============================================================================
-- storia36 C13 — LA SELEZIONE: da dove sono entrate le persone di RTL.
--
-- Richiesta di Enzo del 2026-11-06: «sì, aggiungi la selezione alla storia di
-- RTL». Fino a oggi le sette tabelle del ciclo di selezione (migrazione 000364:
-- requisizione, annuncio, candidato, candidatura, colloquio, valutazione,
-- offerta) erano vuote in tutti i tenant: chi ha il ruolo RECRUITER o
-- HIRING_MANAGER apriva pagine vuote, e nessuno poteva giudicare quei ruoli.
--
-- Cosa scrive questo seed, e su che cosa si appoggia. Niente qui è inventato
-- a caso: ogni selezione nasce da un fatto che la storia ha già.
--
--  · OGNI ASSUNZIONE DELLA FINESTRA NASCE DA UNA SELEZIONE. Chi ha la data di
--    assunzione fra l'inizio della storia e la sua frontiera è entrato da una
--    requisizione sulla posizione che occupa (I1: si copre un posto, non si
--    assume una persona), con un annuncio, altri candidati che non ce l'hanno
--    fatta, i colloqui, le valutazioni di chi li ha condotti e l'offerta
--    accettata. L'offerta porta la RAL e il tipo del primo contratto della
--    persona, e la data d'inizio è la data di assunzione: si ricava, non si
--    sceglie. Le date si leggono all'indietro dall'assunzione (preavviso,
--    offerta, colloqui, candidatura, annuncio, requisizione) e cadono tutte su
--    giorni lavorativi del calendario della storia.
--  · OGNI CAMBIO DI POSIZIONE NELLA FINESTRA NASCE DA UNA SELEZIONE INTERNA:
--    annuncio INTERNAL, candidato INTERNAL che è la persona stessa, uno-tre
--    colleghi che si sono candidati e non sono stati scelti. È escluso il
--    riordino del 2025-03-01: lì le persone non si sono candidate, le ha
--    spostate la riorganizzazione (C6).
--  · LE POSIZIONI LASCIATE NEGLI ULTIMI SEI MESI E ANCORA SCOPERTE hanno una
--    selezione IN CORSO alla frontiera: requisizione OPEN, annuncio PUBLISHED,
--    candidature ferme allo stadio che il tempo trascorso consente. Nessun
--    colloquio e nessuna offerta oltre la frontiera: la storia si ferma a ieri.
--  · CHI CONDUCE I COLLOQUI È UNA PERSONA DI RTL, assunta prima di quel giorno:
--    il primo colloquio lo fa chi ha il ruolo RECRUITER (oggi una persona della
--    direzione HR, decisione di Enzo del 2026-11-05), il tecnico il responsabile
--    dell'unità della posizione, il finale il responsabile insieme a chi guida
--    le risorse umane. Mai il candidato stesso.
--  · I CANDIDATI ESTERNI NON SONO PERSONE DEL TENANT: nomi di fantasia,
--    dichiarati come tali nel metadato, e indirizzi sul dominio riservato
--    `candidati.example` (RFC 2606), che non può appartenere a nessuno.
--  · LA CONSERVAZIONE È QUELLA DEL GDPR, scritta nello schema: il consenso è
--    del giorno della prima candidatura, la conservazione dura 24 mesi
--    dall'ultima chiusura, e chi l'ha superata alla frontiera è ARCHIVED e
--    ANONIMIZZATO — nome, cognome e indirizzo non ci sono più. Una storia che
--    conservasse i curricula oltre il termine mostrerebbe a un agente di
--    conformità un'infrazione che nessuno ha commesso.
--
--  · QUATTRO POSTI NUOVI PER POTENZIAMENTO, scoperti, con la selezione in corso:
--    in RTL ogni posto attivo ha il suo titolare, e senza un posto scoperto
--    nessuna selezione può essere aperta (I1: la requisizione nasce da una
--    posizione). Sono secondi seggi di mestieri che nella stessa unità ne hanno
--    già almeno due, e si creano una volta sola.
--
-- IL PRESENTE SI TOCCA SOLO LÌ: a parte i quattro posti nuovi, questo seed non
-- scrive su persone, posizioni, assegnazioni, contratti o ruoli. Racconta come
-- ci si è arrivati.
--
-- Post-condizioni: staging.storia36_check_c13a..c13d (verify-storia36.sql),
-- con i loro selftest. Idempotente: id uuid_generate_v5 su chiavi naturali,
-- ON CONFLICT DO NOTHING. Twice-run: 0.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

-- Il giorno lavorativo più vicino ALL'INDIETRO: un fatto spostato su un giorno
-- lavorativo non deve mai finire dopo la data da cui è stato ricavato. Prima
-- dell'inizio del calendario della storia valgono i soli fine settimana.
CREATE OR REPLACE FUNCTION pg_temp.wd(d date) RETURNS date LANGUAGE sql STABLE AS
$fn$
  SELECT coalesce(
    (SELECT max(c.cal_date) FROM staging.storia36_calendar c
      WHERE c.cal_date <= d AND c.cal_date > d - 10 AND c.is_workday),
    (SELECT max(g::date) FROM generate_series(d - 6, d, interval '1 day') g
      WHERE extract(isodow FROM g) < 6
        AND NOT EXISTS (SELECT 1 FROM staging.storia36_calendar c2 WHERE c2.cal_date = g::date)))
$fn$;

-- L'ora di un colloquio, a Roma: mattina 9:00-12:30 o pomeriggio 14:00-17:30.
CREATE OR REPLACE FUNCTION pg_temp.slot(d date, k text) RETURNS timestamptz LANGUAGE sql IMMUTABLE AS
$fn$
  SELECT ((d + CASE WHEN pg_temp.h(k) % 16 < 8
                    THEN time '09:00' + (pg_temp.h(k) % 8) * interval '30 minutes'
                    ELSE time '14:00' + (pg_temp.h(k) % 8) * interval '30 minutes' END)
          AT TIME ZONE 'Europe/Rome')
$fn$;

DO $$
DECLARE
  c_rtl    constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns     constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  c_start  constant date := DATE '2023-08-01';
  c_reorg  constant date := DATE '2025-03-01';
  c_dom    constant text := 'candidati.example';
  c_to     date;
  v_rec    uuid;   -- chi conduce la selezione (RECRUITER)
  v_hrh    uuid;   -- chi guida le risorse umane (PEOPLE_MANAGER / HRMS_MANAGER)
  v_n      bigint := 0;
  v_tot    bigint := 0;
  c_nomi   constant text[] := ARRAY[
    'Alessandro','Andrea','Antonio','Carlo','Claudio','Daniele','Davide','Emanuele',
    'Fabio','Federico','Filippo','Francesco','Gabriele','Giacomo','Giorgio','Giovanni',
    'Jacopo','Leonardo','Lorenzo','Luca','Marco','Matteo','Michele','Nicola','Pietro',
    'Riccardo','Roberto','Samuele','Simone','Stefano','Tommaso','Valerio',
    'Alessia','Alice','Anna','Arianna','Aurora','Beatrice','Camilla','Caterina',
    'Chiara','Elena','Eleonora','Elisa','Federica','Francesca','Gaia','Giorgia',
    'Giulia','Ilaria','Irene','Laura','Ludovica','Marta','Martina','Noemi','Paola',
    'Sara','Silvia','Sofia','Valentina','Veronica'];
  c_cogn   constant text[] := ARRAY[
    'Albanese','Amato','Bassi','Bellucci','Benedetti','Bernardi','Bianchi','Borghi',
    'Caputo','Carbone','Cattaneo','Cirillo','Colombi','Conte','Coppola','Corradi',
    'D''Angelo','De Luca','Donati','Esposito','Fabbri','Farina','Ferraro','Fiore',
    'Fontana','Galli','Gatti','Gentile','Giordano','Grasso','Greco','Guerra','Leone',
    'Lombardo','Longo','Mancini','Marino','Martini','Mazza','Messina','Monti',
    'Morelli','Moretti','Negri','Orlando','Pagano','Palumbo','Parisi','Pellegrini',
    'Piras','Ricci','Riva','Rizzo','Romano','Sala','Sanna','Serra','Testa','Valentini',
    'Villa','Vitale','Zanetti'];
BEGIN
  SELECT staging.storia36_c4_frontier() INTO STRICT c_to;

  -- Chi conduce la selezione e chi guida le risorse umane: si leggono dai ruoli
  -- di oggi, non si cablano. Se mancano, il seed si ferma: una selezione senza
  -- chi la conduce non è una storia.
  SELECT u.user_id INTO v_rec
    FROM sys.sys_user_auth_roles ur
    JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
    JOIN sys.sys_users u ON u.user_id = ur.user_auth_role_user_id
   WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'
     AND u.user_email NOT LIKE '%.invalid'
     AND r.auth_role_code = 'RECRUITER' AND ur.user_auth_role_revoked_at IS NULL
   ORDER BY u.user_email LIMIT 1;
  SELECT u.user_id INTO v_hrh
    FROM sys.sys_user_auth_roles ur
    JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
    JOIN sys.sys_users u ON u.user_id = ur.user_auth_role_user_id
   WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'
     AND u.user_email NOT LIKE '%.invalid'
     AND r.auth_role_code IN ('PEOPLE_MANAGER','HRMS_MANAGER') AND ur.user_auth_role_revoked_at IS NULL
   ORDER BY (r.auth_role_code = 'PEOPLE_MANAGER') DESC, u.user_email LIMIT 1;
  IF v_rec IS NULL OR v_hrh IS NULL THEN
    RAISE EXCEPTION 'storia36 C13: manca chi conduce la selezione (RECRUITER=% , vertice HR=%) — nessuna riga scritta', v_rec, v_hrh;
  END IF;

  -- La data di assunzione di ognuno, per sapere da quando può condurre un colloquio.
  CREATE TEMP TABLE _hire ON COMMIT DROP AS
  SELECT e.user_employment_user_id AS user_id, min(e.user_employment_hire_date) AS hire
    FROM sys.sys_user_employment e
    JOIN sys.sys_users u ON u.user_id = e.user_employment_user_id
   WHERE u.user_tenant_id = c_rtl AND e.user_employment_hire_date IS NOT NULL
   GROUP BY 1;

  -- ==========================================================================
  -- 1. LE SELEZIONI: una riga per requisizione, con il fatto da cui nasce.
  -- ==========================================================================
  -- 1a. le assunzioni della finestra
  CREATE TEMP TABLE _sel ON COMMIT DROP AS
  SELECT 'HIRE'::text AS kind,
         'HIRE::' || u.user_id AS k,
         a.user_position_assignment_position_id AS pos,
         u.user_id AS winner,
         h.hire AS d,
         NULL::date AS vacated
    FROM sys.sys_users u
    JOIN _hire h ON h.user_id = u.user_id
    -- la posizione con cui la persona è entrata: il primo incarico principale
    -- che comincia fra un mese prima e sei mesi dopo l'assunzione (chi entra
    -- può cominciare in affiancamento e ricevere il posto poco dopo).
    -- Chi ha un incarico cominciato ANNI prima della propria assunzione porta un
    -- dato incoerente: per lui la selezione non si inventa (C13a lo esclude e
    -- lo dichiara, vedi staging.storia36_c13_assunti_incoerenti).
    JOIN LATERAL (
      SELECT a.user_position_assignment_position_id
        FROM sys.sys_user_position_assignments a
       WHERE a.user_position_assignment_user_id = u.user_id
         AND a.user_position_assignment_kind = 'PRIMARY'
         AND a.user_position_assignment_start_date BETWEEN h.hire - 31 AND h.hire + 183
       ORDER BY a.user_position_assignment_start_date
       LIMIT 1) a ON true
   WHERE u.user_tenant_id = c_rtl
     AND u.user_type = 'STANDARD'
     AND u.user_email NOT LIKE '%.invalid'
     AND h.hire BETWEEN c_start AND c_to;

  -- 1b. i cambi di posizione della finestra (non il riordino)
  INSERT INTO _sel
  SELECT 'MOVE', 'MOVE::' || a.user_position_assignment_id,
         a.user_position_assignment_position_id, a.user_position_assignment_user_id,
         a.user_position_assignment_start_date, NULL
    FROM sys.sys_user_position_assignments a
    JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
    JOIN _hire h ON h.user_id = u.user_id
   WHERE u.user_tenant_id = c_rtl AND u.user_type = 'STANDARD'
     AND u.user_email NOT LIKE '%.invalid'
     AND a.user_position_assignment_kind = 'PRIMARY'
     AND a.user_position_assignment_start_date BETWEEN c_start AND c_to
     AND a.user_position_assignment_start_date <> c_reorg
     -- un giorno in cui cambiano posto in tanti è una riorganizzazione, non una
     -- serie di selezioni: nessuno si è candidato (stesso motivo del riordino)
     AND (SELECT count(*) FROM sys.sys_user_position_assignments z
            JOIN sys.sys_users zu ON zu.user_id = z.user_position_assignment_user_id
           WHERE zu.user_tenant_id = c_rtl AND z.user_position_assignment_kind = 'PRIMARY'
             AND z.user_position_assignment_start_date = a.user_position_assignment_start_date) <= 5
     AND a.user_position_assignment_start_date > h.hire + 31
     AND EXISTS (
       SELECT 1 FROM sys.sys_user_position_assignments p
        WHERE p.user_position_assignment_user_id = a.user_position_assignment_user_id
          AND p.user_position_assignment_kind = 'PRIMARY'
          AND p.user_position_assignment_position_id <> a.user_position_assignment_position_id
          AND p.user_position_assignment_end_date BETWEEN a.user_position_assignment_start_date - 45
                                                      AND a.user_position_assignment_start_date);

  -- 1c-bis. QUATTRO POSTI NUOVI, per potenziamento (scelta di Enzo del 2026-11-06,
  --     sulla scheda «Vuoi selezioni ancora aperte in RTL?»: «Sì, 4 posti nuovi vacanti»). In RTL ogni posto attivo ha il suo titolare (158 su 158,
  --     misurato il 2026-11-06), quindi una selezione IN CORSO non avrebbe dove
  --     stare. Il posto nuovo è un secondo seggio di un mestiere che nella stessa
  --     unità ne ha già almeno due: stesso titolo, ruolo, riporto, criticità e
  --     peso economico del modello — si potenzia ciò che c'è, non si inventa un
  --     mestiere. Si creano UNA volta sola: se esistono già, il seed non ne fa altri.
  IF NOT EXISTS (SELECT 1 FROM sys.sys_positions
                  WHERE position_tenant_id = c_rtl AND position_metadata->>'storia36' = 'C13') THEN
    INSERT INTO sys.sys_positions (
      position_id, position_tenant_id, position_code, position_title,
      position_organization_unit_id, position_job_role_id, position_reports_to_position_id,
      position_esco_occupation_uri, position_criticality, position_economic_weight,
      position_is_active, position_effective_from, position_metadata, position_ai_hints,
      created_at, created_by, updated_at, updated_by)
    SELECT uuid_generate_v5(c_ns, 'STORIA36::C13::POS::' || m.position_id), c_rtl,
           left(m.position_code, 112) || '-N' || upper(substr(md5(m.position_id::text), 1, 4)),
           m.position_title, m.position_organization_unit_id, m.position_job_role_id,
           m.position_reports_to_position_id, m.position_esco_occupation_uri,
           m.position_criticality, m.position_economic_weight, true,
           pg_temp.wd(c_to - 60 - pg_temp.h(m.position_id::text || 'NEW') % 15),
           jsonb_build_object('storia36', 'C13', 'origine', 'potenziamento',
                              'modello_position_id', m.position_id,
                              'nota', 'posto nuovo, ancora scoperto: la selezione è in corso'),
           '{}'::jsonb,
           pg_temp.slot(pg_temp.wd(c_to - 60 - pg_temp.h(m.position_id::text || 'NEW') % 15), m.position_id::text || 'PNC'), v_hrh,
           pg_temp.slot(pg_temp.wd(c_to - 60 - pg_temp.h(m.position_id::text || 'NEW') % 15), m.position_id::text || 'PNC'), v_hrh
      FROM (
        SELECT DISTINCT ON (p.position_title) p.*
          FROM sys.sys_positions p
          JOIN sys.sys_organization_units o ON o.organization_unit_id = p.position_organization_unit_id
         WHERE p.position_tenant_id = c_rtl AND p.position_is_active AND o.organization_unit_is_active
           AND (SELECT count(*) FROM sys.sys_positions q
                 WHERE q.position_tenant_id = c_rtl AND q.position_is_active
                   AND q.position_organization_unit_id = p.position_organization_unit_id
                   AND q.position_title = p.position_title) >= 2
         ORDER BY p.position_title, md5('C13POS' || p.position_id)) m
     ORDER BY md5('C13POS' || m.position_id)
     LIMIT 4;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
    RAISE NOTICE 'storia36 C13: posti nuovi per potenziamento %', v_n;
  END IF;

  -- Il profilo del posto nuovo è quello del posto modello: competenze, KPI e
  -- formazione richiesti (senza, la vista v_pip_completeness li segnalava vuoti
  -- e le pagine del posto non avevano niente da mostrare). Copia generica per
  -- colonne, così una colonna aggiunta domani a queste tabelle viene copiata.
  DECLARE
    t     text;
    pk    text;
    cols  text;
  BEGIN
    FOREACH t IN ARRAY ARRAY['sys_position_skill_requirements',
                             'sys_position_kpi_requirements',
                             'sys_position_learning_requirements'] LOOP
      pk := replace(substr(t, 5), 'requirements', 'requirement') || '_id';
      SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position) INTO cols
        FROM information_schema.columns c
       WHERE c.table_schema = 'sys' AND c.table_name = t
         AND c.column_name NOT IN (pk, 'position_id', 'created_at', 'created_by', 'updated_at', 'updated_by');
      EXECUTE format(
        'INSERT INTO sys.%1$I (%2$I, position_id, %3$s, created_at, created_by, updated_at, updated_by)
         SELECT uuid_generate_v5($1, ''STORIA36::C13::PROFILO::'' || %1$L || ''::'' || r.%2$I),
                p.position_id, %4$s, p.created_at, p.created_by, p.created_at, p.created_by
           FROM sys.sys_positions p
           JOIN sys.%1$I r ON r.position_id = (p.position_metadata->>''modello_position_id'')::uuid
          WHERE p.position_tenant_id = $2 AND p.position_metadata->>''storia36'' = ''C13''
         ON CONFLICT DO NOTHING',
        t, pk, cols, (SELECT string_agg('r.' || x, ', ') FROM unnest(string_to_array(cols, ', ')) x))
      USING c_ns, c_rtl;
      GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
      RAISE NOTICE 'storia36 C13: profilo dei posti nuovi, % %', t, v_n;
    END LOOP;
  END;

  INSERT INTO _sel
  SELECT 'OPEN', 'OPEN::' || p.position_id, p.position_id, NULL, NULL,
         -- l'ancora: un mese dopo la nascita del posto, così annuncio e
         -- requisizione cadono dopo che il posto esiste
         p.position_effective_from + 32
    FROM sys.sys_positions p
   WHERE p.position_tenant_id = c_rtl AND p.position_is_active
     AND p.position_metadata->>'storia36' = 'C13'
     AND NOT EXISTS (
       SELECT 1 FROM sys.sys_user_position_assignments a
        WHERE a.user_position_assignment_position_id = p.position_id
          AND a.user_position_assignment_kind = 'PRIMARY'
          AND a.user_position_assignment_status = 'ACTIVE');

  -- 1c. le posizioni lasciate negli ultimi sei mesi e ancora scoperte
  INSERT INTO _sel
  SELECT 'OPEN', 'OPEN::' || p.position_id, p.position_id, NULL, NULL, v.lasciata
    FROM sys.sys_positions p
    JOIN LATERAL (
      SELECT max(a.user_position_assignment_end_date) AS lasciata
        FROM sys.sys_user_position_assignments a
       WHERE a.user_position_assignment_position_id = p.position_id
         AND a.user_position_assignment_kind = 'PRIMARY') v ON true
   WHERE p.position_tenant_id = c_rtl
     AND p.position_is_active
     AND v.lasciata BETWEEN c_to - 183 AND c_to - 21
     AND NOT EXISTS (
       SELECT 1 FROM sys.sys_user_position_assignments a
        WHERE a.user_position_assignment_position_id = p.position_id
          AND a.user_position_assignment_kind = 'PRIMARY'
          AND a.user_position_assignment_status = 'ACTIVE');

  -- Il calendario della selezione. Per HIRE e MOVE si legge all'indietro dalla
  -- data d'ingresso; per OPEN in avanti dal giorno in cui il posto è rimasto
  -- scoperto, fermandosi alla frontiera.
  CREATE TEMP TABLE _req ON COMMIT DROP AS
  SELECT s.*,
         pg_temp.h(s.k) AS hk,
         p.position_title AS titolo,
         p.position_organization_unit_id AS ou,
         o.organization_unit_name AS ou_nome,
         o.organization_unit_parent_id AS ou_padre,
         CASE WHEN s.kind = 'OPEN' THEN NULL
              ELSE pg_temp.wd(s.d - (18 + pg_temp.h(s.k || 'PRE') % 22)) END AS offer_resp,
         CASE s.kind WHEN 'HIRE' THEN 'EXTERNAL' WHEN 'MOVE' THEN 'INTERNAL' ELSE 'EXTERNAL' END AS vis
    FROM _sel s
    JOIN sys.sys_positions p ON p.position_id = s.pos
    LEFT JOIN sys.sys_organization_units o ON o.organization_unit_id = p.position_organization_unit_id;

  ALTER TABLE _req ADD COLUMN offer_sent date, ADD COLUMN final_on date, ADD COLUMN tech_on date,
    ADD COLUMN screen_on date, ADD COLUMN applied_on date, ADD COLUMN published date,
    ADD COLUMN opened date, ADD COLUMN reason text, ADD COLUMN hm uuid,
    ADD COLUMN req_id uuid, ADD COLUMN post_id uuid, ADD COLUMN code text,
    ADD COLUMN sede text, ADD COLUMN n_altri int, ADD COLUMN declina boolean;

  UPDATE _req SET
    offer_sent = pg_temp.wd(offer_resp - (2 + hk % 4)),
    req_id  = uuid_generate_v5(c_ns, 'STORIA36::C13::REQ::'  || k),
    post_id = uuid_generate_v5(c_ns, 'STORIA36::C13::POST::' || k),
    n_altri = CASE kind WHEN 'MOVE' THEN 1 + hk % 3 ELSE 5 + hk % 9 END,
    -- circa una selezione chiusa su cinque PUÒ avere un'offerta declinata dal secondo
    -- arrivato: succede solo se le date lo consentono (offerta prima di quella al
    -- vincitore). Sul dato del 2026-11-05 ne nasce una sola su venti.
    declina = (kind IN ('HIRE','MOVE') AND hk % 5 = 0);
  UPDATE _req SET final_on = pg_temp.wd(offer_sent - (3 + hk % 5)) WHERE kind <> 'OPEN';
  UPDATE _req SET tech_on  = pg_temp.wd(final_on  - (6 + hk % 7)) WHERE kind = 'HIRE';
  UPDATE _req SET screen_on = pg_temp.wd(coalesce(tech_on, final_on) - (6 + hk % 6)) WHERE kind <> 'OPEN';
  UPDATE _req SET applied_on = pg_temp.wd(screen_on - (5 + hk % 9)) WHERE kind <> 'OPEN';
  UPDATE _req SET published = pg_temp.wd(applied_on - (2 + hk % 14)) WHERE kind <> 'OPEN';
  -- OPEN: la requisizione parte qualche giorno prima che il posto si liberi
  -- (le dimissioni hanno un preavviso), l'annuncio dopo, e nulla oltre la frontiera.
  UPDATE _req SET published = LEAST(pg_temp.wd(vacated - (hk % 20)), pg_temp.wd(c_to - 14))
   WHERE kind = 'OPEN';
  -- Le selezioni aperte non stanno tutte allo stesso punto: una appena
  -- pubblicata, una ai primi colloqui, una ai tecnici, una all'offerta. Le
  -- posizioni nuove si scaglionano così (in ordine stabile di chiave).
  UPDATE _req r SET published = pg_temp.wd(c_to - (ARRAY[9, 20, 33, 48])[1 + (x.rn - 1) % 4])
    FROM (SELECT k, row_number() OVER (ORDER BY md5(k)) AS rn FROM _req
           WHERE kind = 'OPEN' AND EXISTS (SELECT 1 FROM sys.sys_positions p
                   WHERE p.position_id = _req.pos AND p.position_metadata->>'storia36' = 'C13')) x
   WHERE r.k = x.k;
  UPDATE _req SET opened = pg_temp.wd(published - (4 + hk % 8));
  UPDATE _req SET reason = CASE
      WHEN kind = 'MOVE' THEN 'INTERNAL_MOBILITY'
      WHEN kind = 'OPEN' AND EXISTS (SELECT 1 FROM sys.sys_positions p
                                      WHERE p.position_id = _req.pos
                                        AND p.position_metadata->>'storia36' = 'C13') THEN 'GROWTH'
      WHEN kind = 'OPEN' THEN 'REPLACEMENT'
      WHEN EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                    WHERE a.user_position_assignment_position_id = _req.pos
                      AND a.user_position_assignment_kind = 'PRIMARY'
                      AND a.user_position_assignment_user_id <> _req.winner
                      AND a.user_position_assignment_end_date BETWEEN _req.d - 365 AND _req.d)
        THEN 'REPLACEMENT'
      ELSE 'GROWTH' END;
  UPDATE _req SET code = 'REQ-' || to_char(opened, 'YYMM') || '-' || upper(substr(md5(k), 1, 5));

  -- Il responsabile che seleziona: chi guida l'unità della posizione, o quella
  -- sopra, purché non sia il candidato e fosse già in RTL quando la selezione
  -- è cominciata. Altrimenti chi guida le risorse umane.
  UPDATE _req r SET hm = coalesce(
      (SELECT o.organization_unit_manager_user_id FROM sys.sys_organization_units o
         JOIN _hire h ON h.user_id = o.organization_unit_manager_user_id
        WHERE o.organization_unit_id = r.ou
          AND o.organization_unit_manager_user_id IS DISTINCT FROM r.winner
          AND h.hire <= r.opened),
      (SELECT o.organization_unit_manager_user_id FROM sys.sys_organization_units o
         JOIN _hire h ON h.user_id = o.organization_unit_manager_user_id
        WHERE o.organization_unit_id = r.ou_padre
          AND o.organization_unit_manager_user_id IS DISTINCT FROM r.winner
          AND h.hire <= r.opened),
      (SELECT v_hrh FROM _hire h WHERE h.user_id = v_hrh AND h.hire <= r.opened
          AND v_hrh IS DISTINCT FROM r.winner),
      -- chi guidava già il vertice dell'organigramma quando la selezione è partita
      (SELECT o.organization_unit_manager_user_id FROM sys.sys_organization_units o
         JOIN _hire h ON h.user_id = o.organization_unit_manager_user_id
        WHERE o.organization_unit_tenant_id = c_rtl AND o.organization_unit_parent_id IS NULL
          AND o.organization_unit_manager_user_id IS DISTINCT FROM r.winner
          AND h.hire <= r.opened
        ORDER BY h.hire LIMIT 1));

  -- La sede: la filiale dell'unità o di quella che la contiene.
  UPDATE _req r SET sede = coalesce((
    WITH RECURSIVE su AS (
      SELECT r.ou AS ou, 0 AS dist
      UNION ALL
      SELECT o.organization_unit_parent_id, su.dist + 1
        FROM su JOIN sys.sys_organization_units o ON o.organization_unit_id = su.ou
       WHERE o.organization_unit_parent_id IS NOT NULL AND su.dist < 10)
    SELECT b.branch_city FROM su JOIN sys.sys_branches b ON b.branch_organization_unit_id = su.ou
     WHERE b.branch_tenant_id = c_rtl ORDER BY su.dist LIMIT 1), 'Milano');

  -- ==========================================================================
  -- 2. LE CANDIDATURE: chi ha vinto e chi no, con le sue tappe.
  -- ==========================================================================
  -- tappe: A=candidatura, S=primo colloquio, T=tecnico, F=finale, O=offerta,
  --        R=risposta all'offerta, C=chiusura. NULL = tappa non raggiunta.
  CREATE TEMP TABLE _app (
    req_k text, req_id uuid, post_id uuid, cand_key text, rank int,
    first_name text, last_name text, email text, source text, user_id uuid,
    stage text, applied date, s_on date, t_on date, f_on date,
    o_sent date, o_resp date, o_status text, closed date, motivo text,
    app_id uuid) ON COMMIT DROP;

  -- 2a. chi ha vinto (HIRE e MOVE): la persona di RTL
  INSERT INTO _app
  SELECT r.k, r.req_id, r.post_id, lower(u.user_email), 1,
         coalesce(u.user_first_name, split_part(u.user_display_name, ' ', 1)),
         coalesce(u.user_last_name, substr(u.user_display_name, length(split_part(u.user_display_name, ' ', 1)) + 2)),
         lower(u.user_email),
         CASE WHEN r.kind = 'MOVE' THEN 'INTERNAL'
              ELSE (ARRAY['JOB_BOARD','JOB_BOARD','JOB_BOARD','DIRECT','DIRECT','REFERRAL','REFERRAL','AGENCY','AGENCY','EVENT'])[1 + r.hk % 10] END,
         u.user_id, 'HIRED', r.applied_on, r.screen_on, r.tech_on, r.final_on,
         r.offer_sent, r.offer_resp, 'ACCEPTED', r.offer_resp, NULL, NULL
    FROM _req r JOIN sys.sys_users u ON u.user_id = r.winner
   WHERE r.kind IN ('HIRE','MOVE');

  -- 2b. gli altri candidati esterni (HIRE e OPEN): nomi di fantasia.
  --     Le loro tappe stanno dentro la finestra [annuncio, offerta al vincitore)
  --     per le selezioni chiuse, dentro [annuncio, frontiera] per quelle aperte.
  INSERT INTO _app (req_k, req_id, post_id, cand_key, rank, first_name, last_name, email, source,
                    user_id, stage, applied, motivo)
  SELECT r.k, r.req_id, r.post_id, x.chiave, g.i + 1, x.nome, x.cognome, x.chiave,
         (ARRAY['JOB_BOARD','JOB_BOARD','JOB_BOARD','JOB_BOARD','DIRECT','DIRECT','REFERRAL','AGENCY','AGENCY','EVENT'])
           [1 + pg_temp.h(r.k || g.i || 'SRC') % 10],
         NULL, NULL,
         pg_temp.wd(r.published + (pg_temp.h(r.k || g.i || 'A') %
             GREATEST(1, (CASE WHEN r.kind = 'OPEN' THEN LEAST(c_to, r.published + 30) ELSE r.offer_sent END
                          - r.published) * 2 / 5))),
         NULL
    FROM _req r
    CROSS JOIN LATERAL generate_series(1, r.n_altri) g(i)
    CROSS JOIN LATERAL (
      SELECT c_nomi[1 + pg_temp.h(r.k || g.i || 'N') % array_length(c_nomi, 1)] AS nome,
             c_cogn[1 + pg_temp.h(r.k || g.i || 'C') % array_length(c_cogn, 1)] AS cognome) n
    CROSS JOIN LATERAL (
      SELECT n.nome, n.cognome,
             lower(translate(replace(n.nome || '.' || n.cognome, '''', ''), ' ', '')) || '@' || c_dom AS chiave) x
   WHERE r.kind IN ('HIRE','OPEN')
     -- un nome di fantasia non deve coincidere con quello di una persona di RTL
     AND NOT EXISTS (SELECT 1 FROM sys.sys_users u
                      WHERE u.user_tenant_id = c_rtl
                        AND lower(u.user_first_name) = lower(x.nome)
                        AND lower(u.user_last_name)  = lower(x.cognome));

  -- 2c. i colleghi che si sono candidati all'annuncio interno e non sono stati scelti:
  --     persone attive, già in RTL all'apertura, non il vincitore, preferibilmente
  --     dalla stessa unità.
  INSERT INTO _app (req_k, req_id, post_id, cand_key, rank, first_name, last_name, email, source,
                    user_id, stage, applied, motivo)
  SELECT r.k, r.req_id, r.post_id, lower(c.user_email), c.rn + 1,
         coalesce(c.user_first_name, split_part(c.user_display_name, ' ', 1)),
         coalesce(c.user_last_name, c.user_display_name),
         lower(c.user_email), 'INTERNAL', c.user_id, NULL,
         pg_temp.wd(r.published + pg_temp.h(r.k || c.user_id || 'A') %
                    GREATEST(1, (r.offer_sent - r.published) * 2 / 5)),
         NULL
    FROM _req r
    CROSS JOIN LATERAL (
      SELECT u.*, row_number() OVER (ORDER BY (pa.ou = r.ou) DESC, md5(r.k || u.user_id)) AS rn
        FROM sys.sys_users u
        JOIN _hire h ON h.user_id = u.user_id
        LEFT JOIN LATERAL (
          SELECT p.position_organization_unit_id AS ou
            FROM sys.sys_user_position_assignments a
            JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
           WHERE a.user_position_assignment_user_id = u.user_id
             AND a.user_position_assignment_kind = 'PRIMARY'
             AND a.user_position_assignment_status = 'ACTIVE' LIMIT 1) pa ON true
       WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE' AND u.user_type = 'STANDARD'
         AND u.user_email NOT LIKE '%.invalid'
         AND u.user_id <> r.winner AND u.user_id IS DISTINCT FROM r.hm
         AND h.hire < r.opened - 180) c
   WHERE r.kind = 'MOVE' AND c.rn <= r.n_altri;

  -- Lo stesso candidato non si candida due volte allo stesso annuncio (vincolo
  -- di tabella): se il sorteggio lo ripete, resta la prima candidatura.
  DELETE FROM _app a USING _app b
   WHERE a.post_id = b.post_id AND a.cand_key = b.cand_key AND a.rank > b.rank;

  -- 2d. dove arriva ciascuno degli altri. Il ritmo è quello della selezione:
  --     una parte si ferma al curriculum, una al primo colloquio, una si ritira,
  --     una al tecnico, e il secondo arrivato fino al finale.
  UPDATE _app a SET stage = 'X' || CASE
      WHEN a.rank = 2 THEN 'F'                       -- il secondo arrivato
      WHEN pg_temp.h(a.req_k || a.cand_key || 'E') % 100 < 45 THEN 'CV'
      WHEN pg_temp.h(a.req_k || a.cand_key || 'E') % 100 < 62 THEN 'S'
      WHEN pg_temp.h(a.req_k || a.cand_key || 'E') % 100 < 72 THEN 'W'
      ELSE 'T' END
   WHERE a.stage IS NULL;

  UPDATE _app a SET
    s_on = CASE WHEN a.stage IN ('XS','XW','XT','XF')
                THEN pg_temp.wd(a.applied + 4 + pg_temp.h(a.cand_key || a.req_k || 'S') % 7) END
   WHERE a.stage LIKE 'X%';
  UPDATE _app a SET
    t_on = CASE WHEN a.stage IN ('XT','XF') AND r.kind <> 'MOVE'
                THEN pg_temp.wd(a.s_on + 5 + pg_temp.h(a.cand_key || a.req_k || 'T') % 6) END
    FROM _req r WHERE r.k = a.req_k AND a.stage LIKE 'X%';
  UPDATE _app a SET
    f_on = CASE WHEN a.stage = 'XF'
                THEN pg_temp.wd(coalesce(a.t_on, a.s_on) + 4 + pg_temp.h(a.cand_key || a.req_k || 'F') % 5) END
   WHERE a.stage LIKE 'X%';

  -- Per le selezioni chiuse nessuna tappa degli altri va oltre l'offerta al
  -- vincitore: chi sarebbe arrivato dopo si ferma prima, con lo stesso esito.
  UPDATE _app a SET
    f_on = CASE WHEN a.f_on  < r.offer_sent THEN a.f_on END,
    t_on = CASE WHEN a.t_on  < r.offer_sent THEN a.t_on END,
    s_on = CASE WHEN a.s_on  < r.offer_sent THEN a.s_on END
    FROM _req r WHERE r.k = a.req_k AND r.kind <> 'OPEN' AND a.stage LIKE 'X%';
  -- Per quelle aperte nessuna tappa oltre la frontiera.
  UPDATE _app a SET
    f_on = CASE WHEN a.f_on <= c_to THEN a.f_on END,
    t_on = CASE WHEN a.t_on <= c_to THEN a.t_on END,
    s_on = CASE WHEN a.s_on <= c_to THEN a.s_on END
    FROM _req r WHERE r.k = a.req_k AND r.kind = 'OPEN' AND a.stage LIKE 'X%';
  -- una tappa senza la precedente non esiste
  UPDATE _app SET t_on = NULL WHERE s_on IS NULL;
  UPDATE _app SET f_on = NULL WHERE s_on IS NULL OR (t_on IS NULL AND stage = 'XF' AND
         EXISTS (SELECT 1 FROM _req r WHERE r.k = _app.req_k AND r.kind = 'HIRE'));

  -- Il secondo arrivato che ha DECLINATO un'offerta prima di quella al vincitore
  -- (una selezione su sette): l'offerta è partita dopo il suo finale e prima di
  -- quella accettata.
  UPDATE _app a SET o_sent = pg_temp.wd(a.f_on + 2 + pg_temp.h(a.cand_key || 'OS') % 3),
                    o_status = 'DECLINED'
    FROM _req r
   WHERE r.k = a.req_k AND r.declina AND a.rank = 2 AND a.f_on IS NOT NULL
     AND pg_temp.wd(a.f_on + 2 + pg_temp.h(a.cand_key || 'OS') % 3) + 4 < r.offer_sent;
  UPDATE _app a SET o_resp = LEAST(pg_temp.wd(a.o_sent + 2 + pg_temp.h(a.cand_key || 'OR') % 3),
                                   pg_temp.wd(r.offer_sent - 1))
    FROM _req r WHERE r.k = a.req_k AND a.o_status = 'DECLINED';
  UPDATE _app SET o_resp = NULL, o_sent = NULL, o_status = NULL
   WHERE o_status = 'DECLINED' AND o_resp < o_sent;

  -- Lo stadio finale e la chiusura.
  UPDATE _app a SET
    stage = CASE
      WHEN a.o_status = 'DECLINED' THEN 'WITHDRAWN'
      WHEN r.kind = 'OPEN' THEN CASE
           -- selezione in corso: chi è stato scartato lo è già, gli altri sono
           -- fermi alla tappa che il tempo trascorso consente
           WHEN a.stage = 'XCV' AND a.applied + 10 <= c_to THEN 'REJECTED'
           WHEN a.stage = 'XS'  AND a.s_on IS NOT NULL AND a.s_on + 4 <= c_to THEN 'REJECTED'
           WHEN a.stage = 'XW'  AND a.s_on IS NOT NULL AND a.s_on + 3 <= c_to THEN 'WITHDRAWN'
           WHEN a.stage = 'XT'  AND a.t_on IS NOT NULL AND a.t_on + 4 <= c_to THEN 'REJECTED'
           WHEN a.f_on IS NOT NULL OR a.t_on IS NOT NULL THEN 'INTERVIEWING'
           WHEN a.s_on IS NOT NULL THEN 'SCREENING'
           ELSE 'APPLIED' END
      WHEN a.stage = 'XW' THEN 'WITHDRAWN'
      ELSE 'REJECTED' END,
    motivo = CASE
      WHEN a.o_status = 'DECLINED' THEN 'Ha declinato l''offerta'
      WHEN a.stage = 'XW' THEN 'Si è ritirato dalla selezione'
      WHEN a.f_on IS NOT NULL THEN 'Selezionato un altro candidato'
      WHEN a.t_on IS NOT NULL THEN 'Esito del colloquio tecnico'
      WHEN a.s_on IS NOT NULL AND a.stage = 'XS' THEN 'Esito del primo colloquio'
      WHEN a.s_on IS NOT NULL THEN 'Selezionato un altro candidato'
      WHEN r.kind = 'MOVE' THEN 'Selezionato un altro candidato'
      ELSE 'Profilo non in linea con i requisiti' END
    FROM _req r WHERE r.k = a.req_k AND a.stage LIKE 'X%';
  UPDATE _app SET motivo = NULL WHERE stage NOT IN ('REJECTED','WITHDRAWN');

  UPDATE _app a SET closed = CASE
      WHEN a.stage = 'HIRED' THEN a.o_resp
      WHEN a.stage NOT IN ('REJECTED','WITHDRAWN') THEN NULL
      WHEN a.o_resp IS NOT NULL THEN a.o_resp
      WHEN r.kind <> 'OPEN' AND a.motivo = 'Selezionato un altro candidato' THEN r.offer_resp
      ELSE LEAST(pg_temp.wd(coalesce(a.f_on, a.t_on, a.s_on, a.applied)
                            + 3 + pg_temp.h(a.cand_key || a.req_k || 'CL') % 8),
                 CASE WHEN r.kind = 'OPEN' THEN c_to ELSE r.offer_resp END) END
    FROM _req r WHERE r.k = a.req_k;
  UPDATE _app SET closed = applied WHERE closed < applied;

  UPDATE _app SET app_id = uuid_generate_v5(c_ns, 'STORIA36::C13::APP::' || req_k || '::' || cand_key);

  -- OPEN: se c'è chi è arrivato al finale da almeno tre giorni, la sua offerta è
  -- partita e aspetta risposta — la selezione aperta più avanti di tutte.
  UPDATE _app a SET stage = 'OFFER', o_sent = GREATEST(a.f_on, pg_temp.wd(c_to - 1)), o_status = 'SENT'
    FROM _req r
   WHERE r.k = a.req_k AND r.kind = 'OPEN' AND a.rank = 2 AND a.f_on IS NOT NULL
     AND a.f_on + 3 <= c_to AND a.stage = 'INTERVIEWING';

  -- ==========================================================================
  -- 3. SCRITTURA, in ordine di chiave esterna.
  -- ==========================================================================
  INSERT INTO sys.sys_job_requisitions (
    requisition_id, requisition_tenant_id, requisition_code, requisition_position_id,
    requisition_headcount, requisition_status, requisition_reason,
    requisition_opened_on, requisition_target_start, requisition_closed_on,
    requisition_notes, requisition_metadata, created_at, created_by, updated_at, updated_by)
  SELECT r.req_id, c_rtl, r.code, r.pos, 1,
         CASE WHEN r.kind = 'OPEN' THEN 'OPEN' ELSE 'FILLED' END,
         r.reason, r.opened,
         CASE WHEN r.kind = 'OPEN' THEN pg_temp.wd(r.published + 90) ELSE r.d END,
         CASE WHEN r.kind = 'OPEN' THEN NULL ELSE r.offer_resp END,
         CASE r.reason
           WHEN 'REPLACEMENT' THEN 'Sostituzione: il posto si è liberato.'
           WHEN 'GROWTH' THEN 'Potenziamento dell''organico dell''unità.'
           ELSE 'Mobilità interna: posto offerto prima alle persone di RTL.' END,
         jsonb_build_object('storia36', 'C13', 'origine', r.kind,
                            'responsabile_selezione_user_id', r.hm),
         pg_temp.slot(r.opened, r.k || 'RQC'), v_rec,
         pg_temp.slot(coalesce(CASE WHEN r.kind <> 'OPEN' THEN r.offer_resp END, r.published), r.k || 'RQU'), v_rec
    FROM _req r
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13: requisizioni %', v_n;

  INSERT INTO sys.sys_job_postings (
    posting_id, posting_tenant_id, posting_requisition_id, posting_code, posting_title,
    posting_description, posting_visibility, posting_status, posting_published_on,
    posting_expires_on, posting_location, posting_metadata, created_at, created_by, updated_at, updated_by)
  SELECT r.post_id, c_rtl, r.req_id, replace(r.code, 'REQ-', 'ANN-'), r.titolo,
         CASE WHEN r.vis = 'INTERNAL'
              THEN 'Annuncio interno: ' || r.titolo || coalesce(' presso ' || r.ou_nome, '') || '. Riservato alle persone di RTL Bank.'
              ELSE 'RTL Bank cerca ' || r.titolo || coalesce(' per ' || r.ou_nome, '') || ', sede di ' || r.sede || '.' END,
         r.vis,
         CASE WHEN r.kind = 'OPEN' THEN 'PUBLISHED' ELSE 'CLOSED' END,
         r.published,
         CASE WHEN r.kind = 'OPEN' THEN r.published + 90 ELSE GREATEST(r.published, r.offer_sent) END,
         r.sede,
         jsonb_build_object('storia36', 'C13'),
         pg_temp.slot(r.published, r.k || 'PC'), v_rec,
         pg_temp.slot(CASE WHEN r.kind = 'OPEN' THEN r.published ELSE GREATEST(r.published, r.offer_sent) END, r.k || 'PU'), v_rec
    FROM _req r
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13: annunci %', v_n;

  -- I candidati: una riga per persona, anche se si è candidata più volte.
  CREATE TEMP TABLE _cand ON COMMIT DROP AS
  SELECT a.cand_key,
         uuid_generate_v5(c_ns, 'STORIA36::C13::CAND::' || a.cand_key) AS cand_id,
         (array_agg(a.first_name ORDER BY a.applied))[1] AS first_name,
         (array_agg(a.last_name  ORDER BY a.applied))[1] AS last_name,
         (array_agg(a.source     ORDER BY a.applied))[1] AS source,
         max(a.user_id::text)::uuid AS user_id,
         bool_or(a.stage = 'HIRED') AS hired,
         bool_or(a.closed IS NULL) AS in_corso,
         min(a.applied) AS primo,
         max(coalesce(a.closed, c_to)) AS ultimo
    FROM _app a GROUP BY a.cand_key;
  ALTER TABLE _cand ADD COLUMN retention date, ADD COLUMN status text;
  -- 24 mesi dall'ultima chiusura per chi non è entrato in RTL; per chi è una
  -- persona di RTL il dato diventa fascicolo del dipendente e la scadenza non c'è.
  UPDATE _cand SET retention = CASE WHEN user_id IS NULL THEN (ultimo + interval '24 months')::date END;
  UPDATE _cand SET status = CASE
      WHEN hired THEN 'HIRED'
      WHEN user_id IS NOT NULL THEN 'ACTIVE'
      WHEN NOT in_corso AND retention < c_to THEN 'ARCHIVED'
      ELSE 'ACTIVE' END;

  INSERT INTO sys.sys_candidates (
    candidate_id, candidate_tenant_id, candidate_external_code, candidate_first_name,
    candidate_last_name, candidate_email, candidate_phone, candidate_source, candidate_status,
    candidate_consent_given_on, candidate_retention_until, candidate_hired_user_id,
    candidate_metadata, created_at, created_by, updated_at, updated_by)
  SELECT c.cand_id, c_rtl,
         'CND-' || upper(substr(md5(c.cand_key), 1, 8)),
         CASE WHEN c.status = 'ARCHIVED' THEN 'Candidato' ELSE c.first_name END,
         CASE WHEN c.status = 'ARCHIVED' THEN 'anonimizzato' ELSE c.last_name END,
         CASE WHEN c.status = 'ARCHIVED' THEN 'anonimo-' || substr(md5(c.cand_key), 1, 12) || '@' || c_dom
              ELSE c.cand_key END,
         NULL, c.source, c.status, c.primo, c.retention, c.user_id,
         CASE
           WHEN c.status = 'ARCHIVED' THEN jsonb_build_object('storia36', 'C13',
                  'anonimizzato_il', c.retention,
                  'motivo', 'conservazione scaduta: 24 mesi dall''ultima candidatura chiusa (GDPR art. 5.1.e)')
           WHEN c.user_id IS NULL THEN jsonb_build_object('storia36', 'C13',
                  'persona', 'nome di fantasia: un candidato esterno non è una persona del tenant')
           ELSE jsonb_build_object('storia36', 'C13', 'persona', 'persona di RTL Bank') END,
         pg_temp.slot(c.primo, c.cand_key || 'CC'), v_rec,
         CASE WHEN c.status = 'ARCHIVED' THEN pg_temp.slot(pg_temp.wd(c.retention), c.cand_key || 'CU')
              ELSE pg_temp.slot(c.primo, c.cand_key || 'CC') END, v_rec
    FROM _cand c
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13: candidati %', v_n;

  INSERT INTO sys.sys_candidate_applications (
    application_id, application_tenant_id, application_candidate_id, application_posting_id,
    application_stage, application_applied_on, application_closed_on, application_reject_reason,
    application_metadata, created_at, created_by, updated_at, updated_by)
  SELECT a.app_id, c_rtl, c.cand_id, a.post_id, a.stage, a.applied, a.closed,
         CASE WHEN a.stage = 'REJECTED' THEN a.motivo END,
         jsonb_build_object('storia36', 'C13') ||
           CASE WHEN a.stage = 'WITHDRAWN' THEN jsonb_build_object('motivo', a.motivo) ELSE '{}'::jsonb END,
         pg_temp.slot(a.applied, a.app_id::text || 'AC'), NULL,
         pg_temp.slot(coalesce(a.closed, a.o_sent, a.f_on, a.t_on, a.s_on, a.applied), a.app_id::text || 'AU'), v_rec
    FROM _app a JOIN _cand c ON c.cand_key = a.cand_key
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13: candidature %', v_n;

  -- I colloqui: uno per tappa raggiunta. Primo colloquio al telefono, gli altri in sede.
  CREATE TEMP TABLE _int ON COMMIT DROP AS
  SELECT a.app_id, a.req_k, a.cand_key, a.stage, a.rank, a.user_id AS cand_user, t.kind, t.giorno,
         uuid_generate_v5(c_ns, 'STORIA36::C13::INT::' || a.app_id || '::' || t.kind) AS int_id,
         pg_temp.slot(t.giorno, a.app_id || t.kind) AS quando,
         -- l'ultima tappa di chi è stato scartato è quella che l'ha fermato
         (a.stage = 'REJECTED' AND a.motivo LIKE 'Esito%' AND t.kind = CASE WHEN a.f_on IS NOT NULL THEN 'FINAL'
                                                    WHEN a.t_on IS NOT NULL THEN 'TECHNICAL'
                                                    ELSE 'SCREENING' END) AS bocciato,
         r.hm, r.sede
    FROM _app a
    JOIN _req r ON r.k = a.req_k
    CROSS JOIN LATERAL (VALUES ('SCREENING', a.s_on), ('TECHNICAL', a.t_on), ('FINAL', a.f_on)) t(kind, giorno)
   WHERE t.giorno IS NOT NULL;

  INSERT INTO sys.sys_interviews (
    interview_id, interview_tenant_id, interview_application_id, interview_kind, interview_status,
    interview_scheduled_at, interview_duration_min, interview_location, interview_metadata,
    created_at, created_by, updated_at, updated_by)
  SELECT i.int_id, c_rtl, i.app_id, i.kind, 'COMPLETED', i.quando,
         CASE i.kind WHEN 'SCREENING' THEN 30 WHEN 'TECHNICAL' THEN 60 ELSE 45 END,
         CASE i.kind WHEN 'SCREENING' THEN 'Telefonico' ELSE 'Sede di ' || i.sede END,
         jsonb_build_object('storia36', 'C13'),
         i.quando - interval '3 days', v_rec, i.quando + interval '1 hour', v_rec
    FROM _int i
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13: colloqui %', v_n;

  -- Le selezioni in corso hanno il prossimo colloquio in agenda: chi è ancora
  -- fra un colloquio e l'altro ha il successivo fissato da due a sette giorni
  -- dopo la frontiera, in un giorno feriale, SCHEDULED e senza valutazione.
  -- Prima del 2026-11-07 tutti i colloqui erano svolti, anche nelle selezioni
  -- in corso. G1 e C13b(ii) ammettono dopo la frontiera i soli SCHEDULED, entro
  -- 30 giorni. LIMITE NOTO: l'avanzamento notturno non rilegge questo seed,
  -- quindi l'appuntamento resta fermo mentre la frontiera avanza.
  INSERT INTO sys.sys_interviews (
    interview_id, interview_tenant_id, interview_application_id, interview_kind, interview_status,
    interview_scheduled_at, interview_duration_min, interview_location, interview_metadata,
    created_at, created_by, updated_at, updated_by)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C13::INT::' || a.app_id || '::' || n.kind),
         c_rtl, a.app_id, n.kind, 'SCHEDULED', n.quando,
         CASE n.kind WHEN 'TECHNICAL' THEN 60 ELSE 45 END,
         'Sede di ' || r.sede,
         jsonb_build_object('storia36', 'C13', 'agenda', 'colloquio fissato, non ancora svolto'),
         n.quando - interval '2 days', v_rec, n.quando - interval '2 days', v_rec
    FROM _app a
    JOIN _req r ON r.k = a.req_k AND r.kind = 'OPEN'
    CROSS JOIN LATERAL (
      SELECT CASE WHEN a.t_on IS NULL THEN 'TECHNICAL' ELSE 'FINAL' END AS kind,
             pg_temp.slot(g.d + CASE extract(isodow FROM g.d) WHEN 6 THEN 2 WHEN 7 THEN 1 ELSE 0 END,
                          a.app_id || 'AGENDA') AS quando
        FROM (SELECT c_to + 2 + pg_temp.h(a.app_id || 'AGENDA-G') % 6 AS d) g) n
   WHERE a.stage = 'INTERVIEWING' AND a.f_on IS NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13: colloqui in agenda %', v_n;

  -- Le valutazioni: chi ha condotto il colloquio, già in RTL quel giorno, mai il candidato.
  INSERT INTO sys.sys_interview_feedback (
    feedback_id, feedback_tenant_id, feedback_interview_id, feedback_interviewer_user_id,
    feedback_recommendation, feedback_score, feedback_notes, feedback_submitted_on,
    feedback_metadata, created_at, created_by, updated_at, updated_by)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C13::FB::' || i.int_id || '::' || v.who),
         c_rtl, i.int_id, v.who,
         CASE WHEN i.bocciato THEN (ARRAY['NO','NO','STRONG_NO','NEUTRAL'])[1 + pg_temp.h(i.int_id::text || v.who) % 4]
              WHEN i.stage = 'HIRED' AND i.kind = 'FINAL' THEN 'STRONG_YES'
              WHEN i.stage = 'HIRED' THEN (ARRAY['YES','STRONG_YES'])[1 + pg_temp.h(i.int_id::text || v.who) % 2]
              WHEN i.kind = 'FINAL' THEN 'YES'
              ELSE (ARRAY['YES','YES','NEUTRAL'])[1 + pg_temp.h(i.int_id::text || v.who) % 3] END,
         round((CASE WHEN i.bocciato THEN 3.5 + (pg_temp.h(i.int_id::text || v.who || 'S') % 21) / 10.0
                     WHEN i.stage = 'HIRED' THEN 7.5 + (pg_temp.h(i.int_id::text || v.who || 'S') % 20) / 10.0
                     ELSE 6.3 + (pg_temp.h(i.int_id::text || v.who || 'S') % 17) / 10.0 END)::numeric, 1),
         CASE WHEN i.bocciato THEN 'Profilo non adeguato alla posizione in questa fase.'
              WHEN i.stage = 'HIRED' AND i.kind = 'FINAL' THEN 'Candidato raccomandato per l''assunzione.'
              WHEN i.kind = 'FINAL' THEN 'Buon profilo, inferiore al candidato scelto.'
              ELSE 'Profilo coerente, procede alla tappa successiva.' END,
         (i.quando AT TIME ZONE 'Europe/Rome')::date,
         jsonb_build_object('storia36', 'C13'),
         i.quando + interval '2 hours', v.who, i.quando + interval '2 hours', v.who
    FROM _int i
    -- chi conduce: il primo colloquio il RECRUITER (o, se quel giorno non era
    -- ancora in RTL o è lui il candidato, il vertice HR, poi il responsabile);
    -- il tecnico il responsabile; il finale il responsabile e il vertice HR.
    CROSS JOIN LATERAL (
      SELECT DISTINCT w.who FROM (
        SELECT x.who FROM (VALUES (1, v_rec), (2, v_hrh), (3, i.hm)) x(ord, who)
          JOIN _hire h ON h.user_id = x.who
         WHERE i.kind = 'SCREENING' AND h.hire <= (i.quando AT TIME ZONE 'Europe/Rome')::date
           AND x.who IS DISTINCT FROM i.cand_user
         ORDER BY x.ord LIMIT 1) w
      UNION
      SELECT y.who FROM (VALUES (i.hm), (CASE WHEN i.kind = 'FINAL' THEN v_hrh END)) y(who)
        JOIN _hire h ON h.user_id = y.who
       WHERE i.kind IN ('TECHNICAL','FINAL') AND h.hire <= (i.quando AT TIME ZONE 'Europe/Rome')::date
         AND y.who IS DISTINCT FROM i.cand_user) v
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13: valutazioni %', v_n;

  -- Le offerte: al vincitore con la RAL e il tipo del primo contratto, al secondo
  -- arrivato quando ha declinato, a chi è in attesa di risposta nelle selezioni aperte.
  INSERT INTO sys.sys_job_offers (
    offer_id, offer_tenant_id, offer_application_id, offer_status, offer_gross_annual_salary,
    offer_contract_type, offer_start_date, offer_sent_on, offer_responded_on, offer_metadata,
    created_at, created_by, updated_at, updated_by)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C13::OFF::' || a.app_id),
         c_rtl, a.app_id, a.o_status,
         coalesce(ct.sal, ref.sal),
         coalesce(ct.tipo, ref.tipo),
         CASE WHEN a.stage = 'HIRED' THEN r.d ELSE coalesce(r.d, pg_temp.wd(c_to + 30)) END,
         a.o_sent, a.o_resp,
         jsonb_build_object('storia36', 'C13') ||
           CASE WHEN ct.sal IS NOT NULL THEN jsonb_build_object('ral_da',
                  CASE WHEN r.kind = 'HIRE' THEN 'primo contratto della persona' ELSE 'contratto della persona al cambio di posto' END)
                WHEN EXISTS (SELECT 1 FROM sys.sys_positions p
                              WHERE p.position_id = r.pos AND p.position_metadata->>'storia36' = 'C13')
                  THEN jsonb_build_object('ral_da', 'contratto di chi occupa il posto modello del potenziamento')
                ELSE jsonb_build_object('ral_da', 'contratto di chi occupava o occupa la posizione') END,
         pg_temp.slot(a.o_sent, a.app_id::text || 'OC'), v_rec,
         pg_temp.slot(coalesce(a.o_resp, a.o_sent), a.app_id::text || 'OU'), v_rec
    FROM _app a
    JOIN _req r ON r.k = a.req_k
    LEFT JOIN LATERAL (
      SELECT c.user_contract_gross_annual_salary AS sal, c.user_contract_type AS tipo
        FROM sys.sys_user_contracts c
       WHERE c.user_contract_user_id = a.user_id AND a.stage = 'HIRED'
         AND (r.kind = 'HIRE' OR c.user_contract_start_date <= r.d + 31)
       -- chi entra: il primo contratto; chi cambia posto: quello in vigore al cambio
       ORDER BY CASE WHEN r.kind = 'HIRE' THEN c.user_contract_start_date END ASC NULLS LAST,
                c.user_contract_start_date DESC
       LIMIT 1) ct ON true
    -- per chi non è entrato, la RAL di riferimento è quella di chi ha il posto;
    -- un posto nuovo di potenziamento non ha mai avuto titolari, e allora vale
    -- quella di chi occupa il posto modello da cui è stato copiato (prima del
    -- 2026-11-07 le due offerte in attesa restavano senza RAL e senza contratto)
    LEFT JOIN LATERAL (
      SELECT c.user_contract_gross_annual_salary AS sal, c.user_contract_type AS tipo
        FROM sys.sys_user_position_assignments pa
        JOIN sys.sys_user_contracts c ON c.user_contract_user_id = pa.user_position_assignment_user_id
       WHERE pa.user_position_assignment_position_id IN (
               r.pos,
               (SELECT (p.position_metadata->>'modello_position_id')::uuid
                  FROM sys.sys_positions p
                 WHERE p.position_id = r.pos AND p.position_metadata->>'storia36' = 'C13'))
         AND pa.user_position_assignment_kind = 'PRIMARY'
       ORDER BY (pa.user_position_assignment_position_id = r.pos) DESC,
                pa.user_position_assignment_start_date DESC NULLS LAST, c.user_contract_start_date DESC
       LIMIT 1) ref ON true
   WHERE a.o_status IS NOT NULL AND a.o_sent IS NOT NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13: offerte %', v_n;

  -- Le offerte già scritte prima del 2026-11-07 senza RAL (posto nuovo, mai un
  -- titolare): la stessa regola di sopra, applicata a ciò che c'è. Tocca solo
  -- offerte C13 con RAL vuota; alla seconda corsa non trova niente.
  UPDATE sys.sys_job_offers o
     SET offer_gross_annual_salary = m.sal,
         offer_contract_type = coalesce(o.offer_contract_type, m.tipo),
         offer_metadata = o.offer_metadata
                          || jsonb_build_object('ral_da', 'contratto di chi occupa il posto modello del potenziamento')
    FROM sys.sys_candidate_applications ap
    JOIN sys.sys_job_postings jp ON jp.posting_id = ap.application_posting_id
    JOIN sys.sys_job_requisitions rq ON rq.requisition_id = jp.posting_requisition_id
    JOIN sys.sys_positions p ON p.position_id = rq.requisition_position_id
                            AND p.position_metadata->>'storia36' = 'C13'
    CROSS JOIN LATERAL (
      SELECT c.user_contract_gross_annual_salary AS sal, c.user_contract_type AS tipo
        FROM sys.sys_user_position_assignments pa
        JOIN sys.sys_user_contracts c ON c.user_contract_user_id = pa.user_position_assignment_user_id
       WHERE pa.user_position_assignment_position_id = (p.position_metadata->>'modello_position_id')::uuid
         AND pa.user_position_assignment_kind = 'PRIMARY'
       ORDER BY pa.user_position_assignment_start_date DESC NULLS LAST, c.user_contract_start_date DESC
       LIMIT 1) m
   WHERE ap.application_id = o.offer_application_id
     AND o.offer_tenant_id = c_rtl AND o.offer_metadata->>'storia36' = 'C13'
     AND o.offer_gross_annual_salary IS NULL AND m.sal IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13: offerte completate con la RAL del posto modello %', v_n;

  -- ==========================================================================
  -- 4. REGISTRO + POST-CONDIZIONI
  -- ==========================================================================
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C13', '14_selezione.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c13a();
  PERFORM staging.storia36_check_c13b(c_to);
  PERFORM staging.storia36_check_c13c(c_to);
  PERFORM staging.storia36_check_c13d();

  RAISE NOTICE 'storia36 C13 OK: % righe scritte (delta atteso 0 alla seconda corsa)', v_tot;
END $$;

COMMIT;
