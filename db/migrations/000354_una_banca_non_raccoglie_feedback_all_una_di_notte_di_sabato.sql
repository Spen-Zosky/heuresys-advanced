-- ============================================================================
-- 000354 — Una banca non raccoglie un feedback all'una di notte di sabato
--
-- #224, passo 2. Sette risposte del feedback 360 del tenant RTL Bank cadono, ORA
-- DI ROMA, fra le 00:11 e le 01:44 di SABATO. Viste da UTC cadono invece il
-- venerdi' sera, ed e' per questo che nessuno le aveva mai notate: il check C2g
-- fa `response_completed_at::date`, e quel cast usa il fuso della SESSIONE —
-- produzione gira `Etc/UTC`, il gemello `Europe/Rome`. Stesso dato, due verdetti.
--
-- Il fuso giusto e' Roma, e non e' una preferenza: `staging.storia36_calendar` e'
-- un calendario ITALIANO (Liberazione, Repubblica, Ferragosto, Santo Stefano vi
-- figurano non lavorativi). Confrontare un calendario italiano con giorni UTC
-- accosta due sistemi diversi.
--
-- ⚠ L'ORDINE E' OBBLIGATO, e questa migrazione e' il PRIMO dei due passi. Fissare
-- il fuso dentro i check PRIMA di sanare questi sette li renderebbe rossi anche in
-- produzione, cioe' romperebbe la sola macchina che oggi e' verde.
--
-- (a) LA MISURA, PRIMA E DAL VIVO — 2026-08-23, produzione via tunnel :5433
--     Sette righe, tutte sabato: 2025-10-11 00:33 · 01:22 · 2025-10-18 00:30 ·
--     00:30 · 2025-10-25 00:37 · 01:44 · 2025-11-08 00:11 (ora di Roma).
--
-- (d) IL ROLLBACK E' DICHIARATO: giornale `staging.storia36_c2g_fuso_undo`,
--     popolato PRIMA della scrittura, con il valore di partenza riga per riga.
--     Per disfare:  UPDATE sys.sys_feedback_360_responses f
--                      SET response_completed_at = u.valore_prima
--                     FROM staging.storia36_c2g_fuso_undo u
--                    WHERE u.response_id = f.response_id;
--
-- NESSUN GENERATORE DA EMENDARE, e non e' una svista rispetto ad ADR-0035: e'
-- stato MISURATO. Le 776 risposte del tenant si dividono in due famiglie —
-- `STORIA36::` (386 righe, 2024, generate da `db/seeds/storia36/02_performance.sql`,
-- ZERO nel weekend: quel generatore piazza gia' a ore 9-16 di un giorno lavorativo)
-- e `FEEDBACK_360::` (390 righe, 2025, SETTE nel weekend). Le seconde nascono da
-- `docs/archive/etl-brownfield-ritirato/.../03_phase5_consolidation.sql`, che e'
-- archivio e non gira piu' (I12, ADR-0038: il rubinetto del brownfield e' chiuso).
-- Nessun file vivo le ricrea, quindi non c'e' niente da emendare a monte e la
-- correzione non oscilla.
--
-- IN CI QUESTE RIGHE NON ESISTONO (il clone di CI non ha i dati importati da
-- script), e la migrazione deve restare verde lo stesso: per questo la
-- post-condizione e' «zero eventi in giorno non lavorativo», vera sia con sette
-- righe sanate sia con zero righe presenti — e non «sette righe aggiornate», che
-- sarebbe verde qui e rossa in CI.
-- ============================================================================

CREATE TABLE IF NOT EXISTS staging.storia36_c2g_fuso_undo (
  response_id           uuid        PRIMARY KEY,
  response_natural_key  text        NOT NULL,
  valore_prima          timestamptz NOT NULL,
  valore_dopo           timestamptz NOT NULL,
  applicata_il          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE staging.storia36_c2g_fuso_undo IS
  'Giornale di annullamento della migrazione 000354 (#224): valore di partenza di ogni response_completed_at spostato in orario lavorativo. Serve a disfare, non e'' un residuo.';

DO $$
DECLARE
  c_rtl        constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_da_sanare  bigint;
  v_totale_pre bigint;
  v_storia_pre bigint;
  v_cal_pre    bigint;
  v_toccate    bigint;
  v_residue    bigint;
  v_totale_post bigint;
  v_storia_post bigint;
  v_cal_post   bigint;
BEGIN
  -- (b) LA GUARDIA, ri-verificata ADESSO e non ereditata dalla misura di ieri.
  --     Se qualcuno ha gia' sanato, o se il calendario nel frattempo e' cambiato,
  --     il numero che segue e' diverso da 7 — e va bene: si agisce su cio' che si
  --     trova, non su cio' che ci si aspettava.
  SELECT count(*) INTO v_da_sanare
    FROM sys.sys_feedback_360_responses f
    JOIN staging.storia36_calendar c
      ON c.cal_date = (f.response_completed_at AT TIME ZONE 'Europe/Rome')::date
   WHERE f.response_tenant_id = c_rtl AND NOT c.is_workday;

  -- Il fotogramma di cio' che NON deve cambiare, preso PRIMA di toccare qualsiasi cosa.
  SELECT count(*) INTO v_totale_pre FROM sys.sys_feedback_360_responses WHERE response_tenant_id = c_rtl;
  SELECT count(*) INTO v_storia_pre FROM sys.sys_feedback_360_responses
   WHERE response_tenant_id = c_rtl AND response_natural_key LIKE 'STORIA36::%';
  SELECT count(*) INTO v_cal_pre FROM staging.storia36_calendar;

  IF v_da_sanare = 0 THEN
    RAISE NOTICE '000354: nessun evento f360 in giorno non lavorativo (ora di Roma) — niente da fare.';
  ELSE
    RAISE NOTICE '000354: % eventi f360 da riportare in orario lavorativo.', v_da_sanare;

    -- Il giornale si popola PRIMA della scrittura, altrimenti non e' un rollback.
    INSERT INTO staging.storia36_c2g_fuso_undo (response_id, response_natural_key, valore_prima, valore_dopo)
    SELECT f.response_id, f.response_natural_key, f.response_completed_at,
           ((SELECT max(w.cal_date) FROM staging.storia36_calendar w
              WHERE w.is_workday
                AND w.cal_date <= (f.response_completed_at AT TIME ZONE 'Europe/Rome')::date)
            + make_interval(hours => 9 + (get_byte(decode(md5(f.response_natural_key), 'hex'), 0) % 8))
           ) AT TIME ZONE 'Europe/Rome'
      FROM sys.sys_feedback_360_responses f
      JOIN staging.storia36_calendar c
        ON c.cal_date = (f.response_completed_at AT TIME ZONE 'Europe/Rome')::date
     WHERE f.response_tenant_id = c_rtl AND NOT c.is_workday
       -- se non esiste un giorno lavorativo prima, non si inventa un istante
       AND EXISTS (SELECT 1 FROM staging.storia36_calendar w
                    WHERE w.is_workday
                      AND w.cal_date <= (f.response_completed_at AT TIME ZONE 'Europe/Rome')::date)
    ON CONFLICT (response_id) DO NOTHING;

    -- La scrittura legge dal giornale: cosi' il valore applicato e' ESATTAMENTE
    -- quello registrato per essere disfatto, e i due non possono divergere.
    UPDATE sys.sys_feedback_360_responses f
       SET response_completed_at = u.valore_dopo
      FROM staging.storia36_c2g_fuso_undo u
     WHERE u.response_id = f.response_id
       AND f.response_completed_at IS DISTINCT FROM u.valore_dopo;
    GET DIAGNOSTICS v_toccate = ROW_COUNT;
    RAISE NOTICE '000354: % righe riportate in orario lavorativo.', v_toccate;
  END IF;

  -- (c) LE POST-CONDIZIONI. La prima e' cio' che DOVEVA cambiare; le tre che
  --     seguono proteggono cio' che NON doveva — ed e' quella la parte che conta.
  SELECT count(*) INTO v_residue
    FROM sys.sys_feedback_360_responses f
    JOIN staging.storia36_calendar c
      ON c.cal_date = (f.response_completed_at AT TIME ZONE 'Europe/Rome')::date
   WHERE f.response_tenant_id = c_rtl AND NOT c.is_workday;
  IF v_residue <> 0 THEN
    RAISE EXCEPTION '000354: restano % eventi f360 in giorno non lavorativo (ora di Roma).', v_residue;
  END IF;

  SELECT count(*) INTO v_totale_post FROM sys.sys_feedback_360_responses WHERE response_tenant_id = c_rtl;
  IF v_totale_post <> v_totale_pre THEN
    RAISE EXCEPTION '000354: le risposte f360 del tenant erano % e ora sono % — questa migrazione sposta ISTANTI, non crea ne'' cancella righe.',
      v_totale_pre, v_totale_post;
  END IF;

  SELECT count(*) INTO v_storia_post FROM sys.sys_feedback_360_responses
   WHERE response_tenant_id = c_rtl AND response_natural_key LIKE 'STORIA36::%';
  IF v_storia_post <> v_storia_pre THEN
    RAISE EXCEPTION '000354: la famiglia STORIA36:: era % e ora e'' % — non doveva essere toccata: il suo generatore e'' sano.',
      v_storia_pre, v_storia_post;
  END IF;

  SELECT count(*) INTO v_cal_post FROM staging.storia36_calendar;
  IF v_cal_post <> v_cal_pre THEN
    RAISE EXCEPTION '000354: il calendario aveva % giorni e ora ne ha % — e'' il metro di misura, non doveva muoversi.',
      v_cal_pre, v_cal_post;
  END IF;

  RAISE NOTICE '000354: post-condizioni verdi (totale % invariato, STORIA36 % invariata, calendario % giorni).',
    v_totale_post, v_storia_post, v_cal_post;
END $$;
