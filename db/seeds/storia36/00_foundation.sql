-- ============================================================================
-- storia36 C0 — fondazioni: registro provenance + calendario lavorativo IT
-- Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md
-- Finestra storica: 2023-08-01 → 2026-07-31 (decisione Enzo S1033).
-- Sede RTL Bank = Milano (dal dato: sys_branches MI-HQ "Sede Centrale Milano",
--   Via Monte Rosa 91) → patrono = Sant'Ambrogio, 7 dicembre.
-- Idempotente: doppia esecuzione → delta 0 (registrato in staging.storia36_runs).
-- Convenzione id deterministici dei cluster:
--   uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,
--                    'STORIA36::<cluster>::<chiave-naturale>')
-- ============================================================================

\set ON_ERROR_STOP on

-- ----------------------------------------------------------------------------
-- 1. Registro provenance: una riga per ogni esecuzione di seed storia36.
--    twice_run_delta = righe effettivamente aggiunte da QUESTA corsa
--    (la seconda corsa di un seed idempotente DEVE registrare 0).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging.storia36_runs (
  run_id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_code    varchar(8)  NOT NULL
                  CONSTRAINT storia36_runs_cluster_code_check
                  CHECK (cluster_code ~ '^C([0-9]|1[0-2])$'),
  seed_file       text        NOT NULL,
  rows_written    bigint      NOT NULL,
  executed_at     timestamptz NOT NULL DEFAULT now(),
  twice_run_delta bigint      NOT NULL
);

-- ----------------------------------------------------------------------------
-- 2. Calendario lavorativo IT per la finestra: lun-ven MENO festività nazionali
--    + patrono di Milano. Le festività che cadono nel weekend restano etichettate
--    (is_workday è comunque false).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging.storia36_calendar (
  cal_date     date    PRIMARY KEY,
  is_workday   boolean NOT NULL,
  holiday_name text
);

DO $$
DECLARE
  v_before bigint;
  v_after  bigint;
BEGIN
  SELECT count(*) INTO v_before FROM staging.storia36_calendar;

  INSERT INTO staging.storia36_calendar (cal_date, is_workday, holiday_name)
  SELECT gs.d::date,
         (extract(isodow FROM gs.d) < 6 AND h.holiday_name IS NULL),
         h.holiday_name
  FROM generate_series('2023-08-01'::date, '2026-07-31'::date, interval '1 day') AS gs(d)
  LEFT JOIN (VALUES
    ('2023-08-15'::date, 'Ferragosto'),
    ('2023-11-01'::date, 'Ognissanti'),
    ('2023-12-07'::date, 'Sant''Ambrogio (patrono Milano)'),
    ('2023-12-08'::date, 'Immacolata Concezione'),
    ('2023-12-25'::date, 'Natale'),
    ('2023-12-26'::date, 'Santo Stefano'),
    ('2024-01-01'::date, 'Capodanno'),
    ('2024-01-06'::date, 'Epifania'),
    ('2024-04-01'::date, 'Lunedì dell''Angelo'),
    ('2024-04-25'::date, 'Festa della Liberazione'),
    ('2024-05-01'::date, 'Festa del Lavoro'),
    ('2024-06-02'::date, 'Festa della Repubblica'),
    ('2024-08-15'::date, 'Ferragosto'),
    ('2024-11-01'::date, 'Ognissanti'),
    ('2024-12-07'::date, 'Sant''Ambrogio (patrono Milano)'),
    ('2024-12-08'::date, 'Immacolata Concezione'),
    ('2024-12-25'::date, 'Natale'),
    ('2024-12-26'::date, 'Santo Stefano'),
    ('2025-01-01'::date, 'Capodanno'),
    ('2025-01-06'::date, 'Epifania'),
    ('2025-04-21'::date, 'Lunedì dell''Angelo'),
    ('2025-04-25'::date, 'Festa della Liberazione'),
    ('2025-05-01'::date, 'Festa del Lavoro'),
    ('2025-06-02'::date, 'Festa della Repubblica'),
    ('2025-08-15'::date, 'Ferragosto'),
    ('2025-11-01'::date, 'Ognissanti'),
    ('2025-12-07'::date, 'Sant''Ambrogio (patrono Milano)'),
    ('2025-12-08'::date, 'Immacolata Concezione'),
    ('2025-12-25'::date, 'Natale'),
    ('2025-12-26'::date, 'Santo Stefano'),
    ('2026-01-01'::date, 'Capodanno'),
    ('2026-01-06'::date, 'Epifania'),
    ('2026-04-06'::date, 'Lunedì dell''Angelo'),
    ('2026-04-25'::date, 'Festa della Liberazione'),
    ('2026-05-01'::date, 'Festa del Lavoro'),
    ('2026-06-02'::date, 'Festa della Repubblica')
  ) AS h(hd, holiday_name) ON h.hd = gs.d::date
  ON CONFLICT (cal_date) DO NOTHING;

  SELECT count(*) INTO v_after FROM staging.storia36_calendar;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C0', '00_foundation.sql', v_after, v_after - v_before);
END $$;

-- ----------------------------------------------------------------------------
-- 3. Post-condizioni fail-loud (la spec del calendario, non una fotografia).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_cnt       bigint;
  v_expected  bigint;
  v_min       date;
  v_max       date;
  v_bad       bigint;
  v_workdays  bigint;
BEGIN
  SELECT count(*), min(cal_date), max(cal_date)
    INTO v_cnt, v_min, v_max
    FROM staging.storia36_calendar;

  v_expected := ('2026-07-31'::date - '2023-08-01'::date) + 1;
  IF v_cnt <> v_expected OR v_min <> '2023-08-01' OR v_max <> '2026-07-31' THEN
    RAISE EXCEPTION 'storia36_calendar: copertura errata (cnt=% atteso=%, min=%, max=%)',
      v_cnt, v_expected, v_min, v_max;
  END IF;

  -- nessun buco: PK garantisce unicità, il conteggio sul range garantisce densità.

  -- coerenza is_workday: mai true nel weekend o in festività
  SELECT count(*) INTO v_bad
    FROM staging.storia36_calendar
   WHERE is_workday
     AND (extract(isodow FROM cal_date) IN (6, 7) OR holiday_name IS NOT NULL);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'storia36_calendar: % righe is_workday=true in weekend/festività', v_bad;
  END IF;

  -- ogni festività etichettata è non lavorativa
  SELECT count(*) INTO v_bad
    FROM staging.storia36_calendar
   WHERE holiday_name IS NOT NULL AND is_workday;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'storia36_calendar: % festività marcate lavorative', v_bad;
  END IF;

  -- sanità volumetrica: ~250 giorni lavorativi/anno su 3 anni
  SELECT count(*) INTO v_workdays FROM staging.storia36_calendar WHERE is_workday;
  IF v_workdays NOT BETWEEN 730 AND 790 THEN
    RAISE EXCEPTION 'storia36_calendar: giorni lavorativi fuori range plausibile (%)', v_workdays;
  END IF;

  RAISE NOTICE 'storia36 C0 foundation OK: % giorni (% lavorativi), finestra %..%',
    v_cnt, v_workdays, v_min, v_max;
END $$;
