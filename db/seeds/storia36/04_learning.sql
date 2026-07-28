-- ============================================================================
-- storia36 C4 — FORMAZIONE su 36 mesi.  ** versione 2 **
--
-- Piano:   docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md (Task C4)
-- Dominio: docs/kb/storia36/DOMINIO_FORMAZIONE_OBBLIGATORIA.md  ← OGNI soglia
--          numerica di questo file cita un paragrafo di quel documento.
-- Misura:  .storia36/analysis/c4-misura.md · Codice: c4-codice.md
--
-- La v1 e' stata demolita da una review adversarial a tre lenti (FAIL x3,
-- 4 BLOCKER + 11 MAJOR). Cosa e' cambiato qui, e perche':
--
--  · ORARIO — la v1 costruiva i timestamp come `data::timestamp + '16:30'`, che
--    su un server a Etc/UTC diventa 18:30 ora di Roma: il 99,6% delle giornate
--    d'aula risultava chiusa DOPO l'uscita timbrata della stessa persona. Ora
--    l'orario di parete e' interpretato esplicitamente `AT TIME ZONE 'Europe/Rome'`,
--    lo stesso fuso in cui il C1 ha scritto le timbrature (che sono `time` naive).
--  · CONTENUTO — la v1 garantiva le ORE, non gli ARGOMENTI: chi non aveva
--    deficit non riceveva nulla, e restava senza antiriciclaggio per un anno
--    intero (146 persone su 158 nel 2026). L'AML ora e' incondizionato per tutti
--    ogni anno, e l'aggiornamento MiFID per chi distribuisce (Reg. IVASS 44/2019,
--    CONSOB 20307/2018 — DOMINIO §2, §3).
--  · FRONTIERA — la v1 legava il pavimento alla fine del mese CORRENTE: il primo
--    di agosto la batteria sarebbe tornata rossa da sola e il seed non avrebbe
--    saputo ripararsi (abortiva sulla propria post-condizione). Ora la finestra
--    e' la frontiera della STORIA (l'ultima presenza), e il passo 4 e' davvero
--    incrementale: esclude i moduli gia' completati in quell'anno e ricalcola il
--    deficit residuo, quindi un `--repair-missing` pesca il modulo SUCCESSIVO.
--  · CONTINUITA' — la v1 rinnovava le abilitazioni DOPO la scadenza (jitter in
--    avanti): 75 catene su 78 lasciavano da 1 a 11 giorni senza titolo. Ora il
--    rinnovo si ottiene NEI 30 GIORNI PRIMA, come funziona davvero.
--  · DISTRIBUZIONE — la v1 piazzava i corsi ai quantili esatti dell'anno: gennaio
--    restava vuoto quattro anni di fila e 15 persone chiudevano lo stesso corso
--    lo stesso pomeriggio. Ora la posizione e' jitterata dentro la propria fetta
--    e l'ordine dell'antiriciclaggio varia per persona.
--  · RUOLO — la v1 assegnava i contenuti per hash: i cassieri facevano private
--    banking. Ora la coda dei moduli e' ordinata per RILEVANZA, cioe' per quante
--    competenze richieste dalla posizione della persona quel modulo copre
--    (`sys_position_skill_requirements` x `sys_skill_learning_mappings`).
--  · AULA — la v1 chiamava «edizione» un unico corso spalmato su 42-96 giorni con
--    44-67 partecipanti, e derivava la capienza dagli iscritti: il controllo sulla
--    capienza era una tautologia che non poteva scattare. Ora l'edizione e' MENSILE,
--    la capienza e' una costante di dominio (25 posti d'aula) e le coorti che non
--    ci stanno generano edizioni PARALLELE — cosi' il vincolo morde davvero.
--  · TENANT — la v1 aggiornava i piani di chiusura senza filtro di tenant e ha
--    scritto una riga del tenant HEURESYS. Ogni scrittura e' ora vincolata a RTL.
--
-- Idempotente: identificatori uuid_generate_v5 su chiavi STORIA36::C4::*, che
-- non dipendono piu' da un ordinale ma dalla CHIAVE NATURALE (utente, anno,
-- modulo), cosi' una corsa successiva non collide con se stessa. Twice-run: 0.
--
-- PREREQUISITI (in quest'ordine), tutti in db/seeds/storia36/repair/:
--   2026-07-28_c4_certs_monotonia_oneshot.sql   23 catene legacy non monotone
--   2026-07-28_c4_rui_sezione_d_oneshot.sql     la sezione del RUI e' la D, non la E
--   2026-07-28_c4_reseed_reset.sql              solo se esistono righe della v1
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
  -- capienza dell'aula: costante di DOMINIO dichiarata (DOMINIO §6.4), non
  -- derivata dagli iscritti — altrimenti il controllo C4c(iii) non potrebbe
  -- mai scattare e non proverebbe nulla
  c_posti constant int  := 25;
  -- monte-ore che la banca EROGA: le 37 ore annue retribuite in orario di lavoro
  -- del CCNL Credito 23/11/2023 (DOMINIO §1). Il PAVIMENTO che il check pretende
  -- resta piu' basso (24 h, 30 h per chi distribuisce): qui si semina la realta'
  -- di una banca, li' si verifica il minimo di legge.
  c_ore_target constant numeric := 37.0;
  c_to    date;
  v_hr    uuid;
  v_n     bigint := 0;
  v_tot   bigint := 0;
BEGIN
  -- frontiera della STORIA, derivata dal dato: l'ultima presenza registrata.
  -- NON la fine del mese corrente: la storia avanza con il cluster C12, non con
  -- il calendario dell'orologio.
  SELECT staging.storia36_c4_frontier() INTO STRICT c_to;
  IF c_to IS NULL THEN
    RAISE EXCEPTION 'storia36 C4: nessuna presenza nel tenant RTL — eseguire prima il C1';
  END IF;

  SELECT user_id INTO STRICT v_hr FROM sys.sys_users
   WHERE user_email = 'federica.marchetti@rtl-bank.org';

  -- ==========================================================================
  -- 0. CATALOGO D'AULA — i gemelli INSTRUCTOR_LED dei corsi bancari, con le
  --    stesse competenze mappate (la mappatura GIUSTIFICA l'iniziativa in C4d).
  -- ==========================================================================
  INSERT INTO sys.sys_learning_modules (
    learning_module_id, learning_module_tenant_id, learning_module_code,
    learning_module_title, learning_module_description, learning_module_kind,
    learning_module_delivery, learning_module_duration_minutes,
    learning_module_is_global, learning_module_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C4::MOD::'
           || replace(m.learning_module_code, 'BANK-LM', 'BANK-CL')),
         c_rtl,
         replace(m.learning_module_code, 'BANK-LM', 'BANK-CL'),
         m.learning_module_title || ' — edizione in aula',
         'Edizione d''aula del corso ' || m.learning_module_code
           || ', erogata in presenza con docente. Una giornata piena: 450 minuti '
           || '(7,5 h, orario contrattuale CCNL Credito).',
         'COURSE', 'INSTRUCTOR_LED', 450, false,
         jsonb_build_object('storia36', 'C4', 'aula_di', m.learning_module_code)
    FROM sys.sys_learning_modules m
   WHERE m.learning_module_code LIKE 'BANK-LM%'
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C4: moduli d''aula creati %', v_n;

  INSERT INTO sys.sys_skill_learning_mappings (
    skill_learning_mapping_id, skill_learning_mapping_skill_id,
    skill_learning_mapping_module_id, skill_learning_mapping_target_proficiency,
    skill_learning_mapping_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C4::SLM::'
           || sm.skill_learning_mapping_skill_id || '::' || cl.learning_module_id),
         sm.skill_learning_mapping_skill_id, cl.learning_module_id,
         sm.skill_learning_mapping_target_proficiency,
         jsonb_build_object('storia36', 'C4', 'derivato_da', lm.learning_module_code)
    FROM sys.sys_skill_learning_mappings sm
    JOIN sys.sys_learning_modules lm ON lm.learning_module_id = sm.skill_learning_mapping_module_id
    JOIN sys.sys_learning_modules cl
      ON cl.learning_module_code = replace(lm.learning_module_code, 'BANK-LM', 'BANK-CL')
     AND cl.learning_module_tenant_id = c_rtl
   WHERE lm.learning_module_code LIKE 'BANK-LM%'
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C4: competenze mappate sui moduli d''aula %', v_n;

  -- ==========================================================================
  -- 1. TAVOLI DI LAVORO
  -- ==========================================================================
  CREATE TEMP TABLE _scope ON COMMIT DROP AS
  SELECT u.user_id, u.user_email, min(e.user_employment_hire_date) AS hire,
         EXISTS (SELECT 1 FROM sys.sys_user_certifications c
                  WHERE c.user_certification_user_id = u.user_id
                    AND c.user_certification_issuer IN ('IVASS','EFPA Italia')) AS distributore,
         (SELECT a.user_position_assignment_position_id
            FROM sys.sys_user_position_assignments a
           WHERE a.user_position_assignment_user_id = u.user_id
             AND a.user_position_assignment_kind = 'PRIMARY'
             AND a.user_position_assignment_status = 'ACTIVE' LIMIT 1) AS pos
    FROM sys.sys_users u
    JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
   WHERE u.user_tenant_id = c_rtl
     AND u.user_status = 'ACTIVE'
     AND e.user_employment_hire_date IS NOT NULL
   GROUP BY 1, 2;

  CREATE TEMP TABLE _cl ON COMMIT DROP AS
  SELECT row_number() OVER (ORDER BY learning_module_code) AS k,
         learning_module_id AS mid, learning_module_code AS code,
         learning_module_title AS titolo
    FROM sys.sys_learning_modules
   WHERE learning_module_tenant_id = c_rtl AND learning_module_code LIKE 'BANK-CL%';

  IF (SELECT count(*) FROM _cl) = 0 THEN
    RAISE EXCEPTION 'storia36 C4: catalogo d''aula vuoto — il passo 0 non ha prodotto moduli';
  END IF;

  CREATE TEMP TABLE _sp ON COMMIT DROP AS
  SELECT row_number() OVER (ORDER BY learning_module_code) AS k,
         learning_module_id AS mid, learning_module_code AS code,
         COALESCE(learning_module_duration_minutes, 450) AS dur,
         staging.storia36_c4_module_topic(learning_module_code, learning_module_title) AS topic
    FROM sys.sys_learning_modules
   WHERE learning_module_code LIKE 'BANK-LM%';

  -- Le giornate d'aula del C1 (fisse), con la loro EDIZIONE. Un'edizione e' un
  -- MESE; se la coorte del mese non sta in aula, si sdoppia in edizioni parallele
  -- (A, B, C…) — esattamente come farebbe una banca vera con una sala da 25 posti.
  CREATE TEMP TABLE _tday ON COMMIT DROP AS
  WITH giorni AS (
    SELECT a.attendance_subject_user_id AS user_id, a.attendance_date AS d,
           date_trunc('month', a.attendance_date)::date AS mese
      FROM sys.sys_attendance a
     WHERE a.attendance_tenant_id = c_rtl AND a.attendance_status = 'TRAINING'
  ), persone_mese AS (
    SELECT mese, user_id,
           row_number() OVER (PARTITION BY mese
                              ORDER BY pg_temp.h(user_id::text || mese || 'ED')) AS pos_coorte
      FROM (SELECT DISTINCT mese, user_id FROM giorni) x
  )
  SELECT g.user_id, g.d, g.mese,
         chr(64 + ((p.pos_coorte - 1) / c_posti + 1)::int) AS lettera
    FROM giorni g
    JOIN persone_mese p ON p.mese = g.mese AND p.user_id = g.user_id;

  -- Il corso di ciascuna edizione NON e' scelto a caso: si guarda quali
  -- competenze richiedono le posizioni dei partecipanti e si sceglie fra i cinque
  -- moduli d'aula piu' pertinenti, ruotando col mese per non ripetere sempre lo
  -- stesso. (DOMINIO §7 — la formazione serve una competenza che serve.)
  CREATE TEMP TABLE _ti ON COMMIT DROP AS
  WITH coorte AS (
    SELECT DISTINCT mese, lettera, user_id FROM _tday
  ), rilevanza AS (
    SELECT c.mese, c.lettera, cl.k, cl.mid, cl.titolo,
           count(DISTINCT c.user_id) AS copre
      FROM coorte c
      JOIN _scope s ON s.user_id = c.user_id
      JOIN sys.sys_position_skill_requirements r ON r.position_id = s.pos
      JOIN sys.sys_skill_learning_mappings sm ON sm.skill_learning_mapping_skill_id = r.skill_id
      JOIN _cl cl ON cl.mid = sm.skill_learning_mapping_module_id
     GROUP BY 1, 2, 3, 4, 5
  ), classifica AS (
    SELECT r.*, row_number() OVER (PARTITION BY r.mese, r.lettera
                                   ORDER BY r.copre DESC, r.k) AS rango
      FROM rilevanza r
  ), scelta AS (
    SELECT c.mese, c.lettera, c.mid, c.titolo
      FROM classifica c
     WHERE c.rango = 1 + (pg_temp.h(c.mese::text || c.lettera || 'ROT')
                          % LEAST(5, (SELECT max(c2.rango) FROM classifica c2
                                       WHERE c2.mese = c.mese AND c2.lettera = c.lettera)))
  )
  SELECT t.mese, t.lettera,
         'RTL-' || to_char(t.mese, 'YYYYMM') || '-' || t.lettera AS code,
         min(t.d) AS start_d, max(t.d) AS end_d,
         count(DISTINCT t.user_id) AS partecipanti,
         -- se nessuna competenza aggancia la coorte (coorti minuscole), rotazione pura
         COALESCE(s.mid, (SELECT mid FROM _cl
                           WHERE k = 1 + (pg_temp.h(t.mese::text || t.lettera || 'FB')
                                          % (SELECT count(*) FROM _cl)))) AS mid,
         COALESCE(s.titolo, (SELECT titolo FROM _cl
                              WHERE k = 1 + (pg_temp.h(t.mese::text || t.lettera || 'FB')
                                             % (SELECT count(*) FROM _cl)))) AS titolo
    FROM _tday t
    LEFT JOIN scelta s ON s.mese = t.mese AND s.lettera = t.lettera
   GROUP BY t.mese, t.lettera, s.mid, s.titolo;

  INSERT INTO sys.sys_training_initiatives (
    training_initiative_id, training_initiative_tenant_id,
    training_initiative_module_id, training_initiative_code,
    training_initiative_cohort_name, training_initiative_start_date,
    training_initiative_end_date, training_initiative_facilitator_user_id,
    training_initiative_status, training_initiative_capacity,
    training_initiative_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C4::TI::' || t.code),
         c_rtl, t.mid, t.code,
         'Edizione ' || t.lettera || ' — ' || to_char(t.mese, 'TMMonth YYYY') || ' — ' || t.titolo,
         t.start_d,
         -- le edizioni del mese di frontiera sono ancora in corso
         CASE WHEN t.mese = date_trunc('month', c_to)::date THEN NULL ELSE t.end_d END,
         v_hr,
         CASE WHEN t.mese = date_trunc('month', c_to)::date THEN 'IN_PROGRESS' ELSE 'COMPLETED' END,
         c_posti,
         jsonb_build_object(
           'storia36', 'C4', 'mese', to_char(t.mese, 'YYYY-MM'), 'aula', t.lettera,
           'giustificazione',
           'competenze coperte: ' || COALESCE((
             SELECT string_agg(s.skill_name, ', ' ORDER BY s.skill_name)
               FROM sys.sys_skill_learning_mappings sm
               JOIN sys.sys_skills s ON s.skill_id = sm.skill_learning_mapping_skill_id
              WHERE sm.skill_learning_mapping_module_id = t.mid), '—'))
    FROM _ti t
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C4: edizioni d''aula inserite %', v_n;

  -- ==========================================================================
  -- 2. LA QUADRATURA — una traccia di frequenza per ogni giornata d'aula.
  --    L'orario e' scritto nel fuso in cui il C1 ha timbrato (Europe/Rome), e la
  --    chiusura cade PRIMA dell'uscita: fine lezione fra le 16:00 e le 17:15.
  -- ==========================================================================
  INSERT INTO sys.sys_user_learning_evidence (
    user_learning_evidence_id, user_learning_evidence_user_id,
    user_learning_evidence_tenant_id, user_learning_evidence_module_id,
    user_learning_evidence_completed_at, user_learning_evidence_score,
    user_learning_evidence_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C4::EV::' || t.user_id || '::' || t.d),
         t.user_id, c_rtl, ti.mid,
         ((t.d + time '16:00')
           + ((pg_temp.h(t.user_id::text || t.d || 'EM') % 75) || ' minutes')::interval)
         AT TIME ZONE 'Europe/Rome',
         70 + pg_temp.h(t.user_id::text || t.d || 'ES') % 31,
         jsonb_build_object('storia36', 'C4', 'initiative', ti.code, 'kind', 'AULA')
    FROM _tday t
    JOIN _ti ti ON ti.mese = t.mese AND ti.lettera = t.lettera
   WHERE NOT EXISTS (
     SELECT 1 FROM sys.sys_user_learning_evidence e
      WHERE e.user_learning_evidence_user_id = t.user_id
        AND (e.user_learning_evidence_completed_at AT TIME ZONE 'Europe/Rome')::date = t.d
        AND e.user_learning_evidence_metadata->>'kind' = 'AULA')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C4: tracce d''aula inserite %', v_n;

  -- ==========================================================================
  -- 3. LE ISCRIZIONI — non si frequenta un corso a cui non si e' iscritti.
  -- ==========================================================================
  INSERT INTO sys.sys_user_learning_assignments (
    user_learning_assignment_id, user_learning_assignment_tenant_id,
    user_learning_assignment_user_id, user_learning_assignment_initiative_id,
    user_learning_assignment_module_id, user_learning_assignment_is_mandatory,
    user_learning_assignment_deadline, user_learning_assignment_status,
    user_learning_assignment_assigned_by, user_learning_assignment_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C4::ULA::' || x.user_id || '::' || ti.code),
         c_rtl, x.user_id, t2.training_initiative_id, ti.mid, true,
         COALESCE(t2.training_initiative_end_date, (ti.mese + interval '1 month - 1 day')::date),
         CASE WHEN t2.training_initiative_status = 'IN_PROGRESS'
              THEN 'IN_PROGRESS' ELSE 'COMPLETED' END,
         v_hr,
         jsonb_build_object('storia36', 'C4', 'initiative', ti.code)
    FROM (SELECT DISTINCT user_id, mese, lettera FROM _tday) x
    JOIN _ti ti ON ti.mese = x.mese AND ti.lettera = x.lettera
    JOIN sys.sys_training_initiatives t2
      ON t2.training_initiative_code = ti.code
     AND t2.training_initiative_tenant_id = c_rtl
   WHERE NOT EXISTS (
     SELECT 1 FROM sys.sys_user_learning_assignments a
      WHERE a.user_learning_assignment_user_id = x.user_id
        AND a.user_learning_assignment_initiative_id = t2.training_initiative_id)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C4: iscrizioni alle edizioni %', v_n;

  -- ==========================================================================
  -- 4. IL MONTE-ORE E GLI OBBLIGHI DI CONTENUTO
  --    Due cose distinte: (a) l'antiriciclaggio ogni anno per TUTTI e
  --    l'aggiornamento MiFID ogni anno per chi distribuisce — dovuti a
  --    prescindere dalle ore gia' fatte; (b) il resto del catalogo, ordinato per
  --    quanto e' pertinente al ruolo della persona, fino a raggiungere le 37 ore
  --    che la banca eroga.
  -- ==========================================================================
  CREATE TEMP TABLE _need ON COMMIT DROP AS
  SELECT s.user_id, s.distributore, s.pos, y.y,
         staging.storia36_c4_hours_floor(s.user_id, y.y, c_start, c_to) AS floor_h,
         round((c_ore_target * staging.storia36_c4_hours_floor(s.user_id, y.y, c_start, c_to)
                  / CASE WHEN s.distributore THEN 30 ELSE 24 END
                - staging.storia36_c4_hours(s.user_id, y.y)) * 60) AS residual_min
    FROM _scope s
    CROSS JOIN generate_series(extract(year FROM c_start)::int,
                               extract(year FROM c_to)::int) AS y(y);

  CREATE TEMP TABLE _elig ON COMMIT DROP AS
  SELECT s.user_id, extract(year FROM c.cal_date)::int AS y, c.cal_date AS d,
         row_number() OVER (PARTITION BY s.user_id, extract(year FROM c.cal_date)
                            ORDER BY c.cal_date) AS rn,
         count(*)     OVER (PARTITION BY s.user_id, extract(year FROM c.cal_date)) AS cnt
    FROM _scope s
    JOIN staging.storia36_calendar c
      ON c.is_workday
     AND c.cal_date >= GREATEST(s.hire, c_start)
     AND c.cal_date <= c_to
   WHERE NOT EXISTS (
     SELECT 1 FROM sys.sys_attendance a
      WHERE a.attendance_subject_user_id = s.user_id
        AND a.attendance_date = c.cal_date
        AND a.attendance_status IN ('VACATION','SICK','ABSENT','PAID_LEAVE','TRAINING'));

  CREATE TEMP TABLE _pick ON COMMIT DROP AS
  WITH base AS (
    SELECT n.user_id, n.y, n.residual_min, sp.mid, sp.dur, sp.k, sp.topic,
           (sp.topic = 'AML' OR (sp.topic = 'MIFID' AND n.distributore)) AS obbligatorio,
           CASE
             -- l'obbligatorio viene per primo, ma non con lo stesso ordinale per
             -- tutti: altrimenti mezza banca chiude l'antiriciclaggio lo stesso giorno
             WHEN sp.topic = 'AML' THEN (pg_temp.h(n.user_id::text || n.y || 'AML') % 3)
             WHEN sp.topic = 'MIFID' AND n.distributore THEN 1
             -- poi il catalogo, dal piu' pertinente al ruolo al meno
             ELSE 10 - LEAST(5, (SELECT count(DISTINCT r.skill_id)
                                   FROM sys.sys_position_skill_requirements r
                                   JOIN sys.sys_skill_learning_mappings sm
                                     ON sm.skill_learning_mapping_skill_id = r.skill_id
                                  WHERE r.position_id = n.pos
                                    AND sm.skill_learning_mapping_module_id = sp.mid))
                  + (pg_temp.h(n.user_id::text || n.y || sp.code) % 1000) / 1000.0
           END AS ord
      FROM _need n
      CROSS JOIN _sp sp
     WHERE n.floor_h > 0
       -- incrementale: cio' che e' gia' stato completato in quell'anno non si ripete
       AND NOT EXISTS (
         SELECT 1 FROM sys.sys_user_learning_evidence e
          WHERE e.user_learning_evidence_user_id = n.user_id
            AND e.user_learning_evidence_module_id = sp.mid
            AND extract(year FROM e.user_learning_evidence_completed_at) = n.y)
  ), progressivo AS (
    SELECT b.*,
           COALESCE(sum(b.dur) OVER (w ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS cum_before
      FROM base b
      WINDOW w AS (PARTITION BY b.user_id, b.y ORDER BY b.ord, b.k)
  )
  SELECT p.user_id, p.y, p.mid, p.dur, p.obbligatorio,
         row_number() OVER (PARTITION BY p.user_id, p.y ORDER BY p.ord, p.k) AS seq,
         count(*)     OVER (PARTITION BY p.user_id, p.y) AS n_tot
    FROM progressivo p
   WHERE p.obbligatorio OR p.cum_before < p.residual_min;

  INSERT INTO sys.sys_user_learning_evidence (
    user_learning_evidence_id, user_learning_evidence_user_id,
    user_learning_evidence_tenant_id, user_learning_evidence_module_id,
    user_learning_evidence_completed_at, user_learning_evidence_score,
    user_learning_evidence_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C4::SP::' || p.user_id || '::' || p.y || '::' || p.mid),
         p.user_id, c_rtl, p.mid,
         ((el.d + time '11:00')
           + ((pg_temp.h(p.user_id::text || p.y || p.mid || 'SPM') % 330) || ' minutes')::interval)
         AT TIME ZONE 'Europe/Rome',
         70 + pg_temp.h(p.user_id::text || p.y || p.mid || 'SPS') % 31,
         jsonb_build_object('storia36', 'C4', 'kind', 'SELF_PACED', 'anno', p.y,
                            'obbligatorio', p.obbligatorio)
    FROM _pick p
    JOIN _elig el
      ON el.user_id = p.user_id AND el.y = p.y
     -- posizione JITTERATA dentro la propria fetta d'anno: senza il jitter i
     -- quantili esatti lasciano gennaio e dicembre strutturalmente vuoti
     AND el.rn = 1 + LEAST(el.cnt - 1,
           floor((((p.seq - 1) + (pg_temp.h(p.user_id::text || p.y || p.mid || 'POS') % 1000) / 1000.0)
                  * el.cnt) / p.n_tot)::int)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C4: corsi a distanza inseriti % (obblighi di contenuto + monte-ore)', v_n;

  -- ==========================================================================
  -- 5. I RINNOVI — un'abilitazione non puo' avere buchi: il rinnovo si ottiene
  --    NEI 30 GIORNI PRIMA della scadenza, mai dopo. Cadenza = validita' mediana
  --    osservata per quello schema (DOMINIO §6.2).
  -- ==========================================================================
  INSERT INTO sys.sys_user_certifications (
    user_certification_id, user_certification_user_id, user_certification_tenant_id,
    user_certification_name, user_certification_issuer,
    user_certification_issued_date, user_certification_expires_date,
    user_certification_credential_id, user_certification_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C4::CERT::' || b.cid || '::' || g.n),
         b.uid, c_rtl, b.nome, b.issuer,
         GREATEST(
           LEAST((b.chain_start + ((g.n - 1) * b.cad_days))::date
                   - (pg_temp.h(b.cid::text || g.n || 'CI') % 30), c_to),
           b.hire),
         (b.chain_start + (g.n * b.cad_days))::date,
         b.credenziale,
         jsonb_build_object('storia36', 'C4', 'rinnovo_di', b.cid, 'progressivo', g.n)
    FROM (
      SELECT DISTINCT ON (c.user_certification_user_id, c.user_certification_name,
                          c.user_certification_issuer)
             c.user_certification_id AS cid, c.user_certification_user_id AS uid,
             c.user_certification_name AS nome, c.user_certification_issuer AS issuer,
             c.user_certification_credential_id AS credenziale, s.hire,
             GREATEST(c.user_certification_expires_date, s.hire) AS chain_start,
             round(staging.storia36_cert_validity_years(
                     c.user_certification_name, c.user_certification_issuer) * 365)::int AS cad_days
        FROM sys.sys_user_certifications c
        JOIN _scope s ON s.user_id = c.user_certification_user_id
       WHERE c.user_certification_tenant_id = c_rtl
         AND staging.storia36_cert_is_abilitante(c.user_certification_issuer)
         AND c.user_certification_expires_date IS NOT NULL
         AND c.user_certification_metadata->>'storia36' IS NULL
       ORDER BY c.user_certification_user_id, c.user_certification_name,
                c.user_certification_issuer, c.user_certification_expires_date DESC
    ) b
    CROSS JOIN generate_series(1, 8) AS g(n)
   WHERE b.cad_days > 30
     AND (b.chain_start + ((g.n - 1) * b.cad_days))::date < c_to
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C4: rinnovi di abilitazioni inseriti %', v_n;

  -- ==========================================================================
  -- 6. IL CICLO SI CHIUDE — lacuna → azione → formazione. La scadenza dipende
  --    dalla GRAVITA' (una lacuna critica non ha gli stessi 90 giorni di una
  --    lieve) e lo stato dipende dalla formazione realmente ricevuta.
  -- ==========================================================================
  UPDATE sys.sys_gap_closure_actions a
     SET gap_closure_action_status = CASE
           WHEN NOT EXISTS (
             SELECT 1 FROM sys.sys_user_learning_evidence e
              WHERE e.user_learning_evidence_user_id = g.learning_gap_user_id
                AND e.user_learning_evidence_completed_at > g.learning_gap_detected_at)
             THEN 'IN_PROGRESS'
           -- una lacuna CRITICAL non si annulla e si chiude quasi sempre
           WHEN g.learning_gap_severity = 'CRITICAL' THEN
             CASE WHEN pg_temp.h(a.gap_closure_action_id::text || 'ST') % 100 < 90
                  THEN 'COMPLETED' ELSE 'IN_PROGRESS' END
           WHEN pg_temp.h(a.gap_closure_action_id::text || 'ST') % 100 < 70 THEN 'COMPLETED'
           WHEN pg_temp.h(a.gap_closure_action_id::text || 'ST') % 100 < 94 THEN 'IN_PROGRESS'
           ELSE 'CANCELLED' END,
         gap_closure_action_due_date = (g.learning_gap_detected_at + (
           CASE g.learning_gap_severity
             WHEN 'CRITICAL' THEN interval '30 days'
             WHEN 'HIGH'     THEN interval '60 days'
             ELSE                 interval '90 days' END))::date,
         gap_closure_action_owner_user_id = COALESCE(m.mgr, v_hr),
         gap_closure_action_payload = a.gap_closure_action_payload
           || jsonb_build_object('storia36', 'C4')
    FROM sys.sys_learning_gaps g
    JOIN sys.sys_users gu ON gu.user_id = g.learning_gap_user_id
    LEFT JOIN LATERAL (
      SELECT a2.user_position_assignment_user_id AS mgr
        FROM sys.sys_user_position_assignments a1
        JOIN sys.sys_positions p1 ON p1.position_id = a1.user_position_assignment_position_id
        JOIN sys.sys_user_position_assignments a2
          ON a2.user_position_assignment_position_id = p1.position_reports_to_position_id
         AND a2.user_position_assignment_kind = 'PRIMARY'
         AND a2.user_position_assignment_status = 'ACTIVE'
       WHERE a1.user_position_assignment_user_id = g.learning_gap_user_id
         AND a1.user_position_assignment_kind = 'PRIMARY'
         AND a1.user_position_assignment_status = 'ACTIVE'
       LIMIT 1) m ON true
   WHERE g.learning_gap_id = a.gap_closure_action_gap_id
     AND gu.user_tenant_id = c_rtl
     AND a.gap_closure_action_tenant_id = c_rtl
     AND a.gap_closure_action_kind = 'TRAINING_ASSIGNMENT'
     AND a.gap_closure_action_status = 'PROPOSED'
     AND g.learning_gap_detected_at::date <= c_to - 90
     AND a.gap_closure_action_payload->>'storia36' IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C4: azioni di chiusura avanzate %', v_n;

  -- orizzonte semestrale dall'ultima lacuna della persona; per i piani aperti su
  -- persone senza lacune registrate il riferimento e' la nascita del piano.
  UPDATE sys.sys_gap_closure_plans p
     SET gap_closure_plan_target_completion_date = (
           COALESCE((SELECT max(g.learning_gap_detected_at)
                       FROM sys.sys_learning_gaps g
                      WHERE g.learning_gap_user_id = p.gap_closure_plan_user_id),
                    p.created_at) + interval '180 days')::date,
         gap_closure_plan_metadata = p.gap_closure_plan_metadata
           || jsonb_build_object('storia36', 'C4')
   WHERE p.gap_closure_plan_tenant_id = c_rtl
     AND p.gap_closure_plan_status IN ('ACTIVE','COMPLETED')
     AND p.gap_closure_plan_target_completion_date IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C4: piani di chiusura con data obiettivo %', v_n;

  -- ==========================================================================
  -- 7. REGISTRO + POST-CONDIZIONI (la storia si scrive solo se resta coerente)
  -- ==========================================================================
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C4', '04_learning.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c4a(c_start, c_to);
  PERFORM staging.storia36_check_c4b(c_to);
  PERFORM staging.storia36_check_c4c(c_to);
  PERFORM staging.storia36_check_c4d(c_to);
  PERFORM staging.storia36_check_c4e();
  PERFORM staging.storia36_check_c4f(c_to);
  PERFORM staging.storia36_check_c4g();

  RAISE NOTICE 'storia36 C4 OK: % righe scritte in questa corsa (delta atteso 0 alla seconda)', v_tot;
END $$;

COMMIT;
