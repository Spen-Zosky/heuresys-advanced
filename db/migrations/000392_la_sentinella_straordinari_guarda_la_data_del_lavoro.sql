-- 000392 — correzione a B3 (mig. 000387): v_straordinari_non_autorizzati guardava la
-- colonna sbagliata.
--
-- IL FATTO (scoperto scrivendo B9, 2026-09-09, stessa sessione): la vista usava
-- `max(overtime_requested_at)` per stabilire da quando il processo di richiesta e' fermo.
-- Ma `overtime_requested_at` e' QUANDO la richiesta e' stata sottomessa, non il giorno di
-- lavoro a cui si riferisce — e differisce da `overtime_date` (misurato: l'ultima richiesta
-- approvata ha requested_at=2025-12-10, ma overtime_date=2025-12-12, la data che il bundle
-- cita testualmente: "l'ultimo straordinario autorizzato e' del 12/12/2025"). Usare la
-- colonna sbagliata restringeva la finestra di due giorni e sottostimava la sanatoria di
-- B9 di 22 righe / 23,50 ore (2458 invece di 2436 / 2434,50 — la prova generale della
-- sanatoria l'ha scoperto: la guardia ha rifiutato di scrivere finche' i due numeri non
-- coincidevano).
--
-- Nessun cambiamento di comportamento oltre alla correzione della finestra: la logica
-- (processo fermo => presenze successive non autorizzate) resta la stessa.

\set ON_ERROR_STOP on

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════════════
-- ⭐ EMENDATA S1096 (2026-09-10, C6) — LA SOGLIA E' STATA TOLTA: ORA GUARDA TUTTO.
--
-- IL FATTO. La vista era verde, ma la sua soglia era il 2026-09-09: guardava solo le
-- presenze SUCCESSIVE all'ultima richiesta registrata. E ogni sanatoria sposta quella
-- soglia in avanti — B9 al 2025-12-12, la sanatoria storica (000399) fino a coprire tutto —
-- quindi la sentinella diventava verde proprio perche' l'insieme che guardava si
-- svuotava. Misurato il 2026-09-10, prima della sanatoria storica: la vista vedeva **10**
-- presenze scoperte, mentre quelle prive di richiesta erano **9.420**. Verde su dieci
-- righe, cieca su novemilaquattrocentodieci.
--
-- ⚠⚠ QUESTO NON E' «ALLARGARE UNA SENTINELLA PER FARLA TACERE» — il divieto che
-- `chi_sorveglia.py` stampa in testa a ogni censimento. E' l'esatto contrario: si allarga
-- perche' **veda di piu'**, e infatti l'insieme osservato passa da «dopo una data» a
-- «sempre». Sta scritto qui perche' fra sei mesi, letto di fretta, un `WHERE` tolto da una
-- sentinella somigliera' a quella violazione: la differenza e' la DIREZIONE — chi fa
-- tacere restringe cio' che si guarda, qui lo si allarga.
--
-- LA DOMANDA NUOVA, che e' anche piu' semplice della vecchia: esiste una presenza con ore
-- di straordinario che non abbia una richiesta per QUELLA persona in QUEL giorno?
-- ══════════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW sys.v_straordinari_non_autorizzati AS
  SELECT
    a.attendance_tenant_id       AS tenant_id,
    a.attendance_subject_user_id AS persona_id,
    count(*)                     AS giorni_non_autorizzati,
    sum(a.attendance_hours_overtime) AS ore_non_autorizzate,
    min(a.attendance_date)       AS dal,
    max(a.attendance_date)       AS al
  FROM sys.sys_attendance a
  WHERE a.attendance_hours_overtime > 0
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_overtime o
       WHERE o.overtime_subject_user_id = a.attendance_subject_user_id
         AND o.overtime_date = a.attendance_date
         AND o.overtime_hours > 0)
  GROUP BY 1, 2;

COMMENT ON VIEW sys.v_straordinari_non_autorizzati IS
  'SENTINELLA (B3, 2026-09-09; colonna corretta mig. 000392; SOGLIA TOLTA S1096/C6, '
  '2026-09-10). Ogni presenza con ore di straordinario che non ha una richiesta in '
  'sys_overtime per quella persona in quel giorno — SENZA soglia di data. Prima guardava '
  'solo le presenze successive all''ultima richiesta registrata, e ogni sanatoria spostava '
  'quella soglia in avanti: era verde perche'' l''insieme osservato si svuotava (10 righe '
  'viste contro 9.420 scoperte, misurato). Togliere quel WHERE NON e'' allargare una '
  'sentinella per farla tacere: e'' allargarla perche'' veda di piu''. Zero righe attese, e '
  'la prova a esiti opposti in coda alla migrazione dimostra che sa ancora accendersi.';

COMMIT;

-- ============================================================================================
-- LA PROVA A ESITI OPPOSTI — una vista che nasce verde e non si e' mai vista rossa non e' una
-- sentinella. Si inserisce UNA presenza con straordinario e senza richiesta, si verifica che
-- la vista la veda, e si annulla tutto: nel database non resta niente.
-- ============================================================================================
BEGIN;
DO $prova$
DECLARE
  v_tenant uuid; v_persona uuid; v_giorno date; n_prima bigint; n_dopo bigint;
BEGIN
  SELECT count(*) INTO n_prima FROM sys.v_straordinari_non_autorizzati;

  SELECT a.attendance_tenant_id, a.attendance_subject_user_id
    INTO v_tenant, v_persona
    FROM sys.sys_attendance a LIMIT 1;
  IF v_persona IS NULL THEN
    RAISE NOTICE '000392 prova: nessuna presenza in archivio, la prova non puo'' girare qui '
      '(database ricostruito da zero). NON MISURATO, e dichiarato.';
    RETURN;
  END IF;

  -- Un giorno che quella persona non ha: cosi' la riga di prova non collide con una vera.
  SELECT max(a.attendance_date) + 3650 INTO v_giorno FROM sys.sys_attendance a;

  INSERT INTO sys.sys_attendance
    (attendance_tenant_id, attendance_natural_key, attendance_subject_user_id,
     attendance_date, attendance_hours_regular, attendance_hours_overtime)
  VALUES (v_tenant, '__PROVA_000392_C6__', v_persona, v_giorno, 7.5, 2.0);

  SELECT count(*) INTO n_dopo FROM sys.v_straordinari_non_autorizzati;
  IF n_dopo <= n_prima THEN
    RAISE EXCEPTION 'PROVA C6 NON SA FALLIRE: inserita una presenza con straordinario e senza '
      'richiesta, la sentinella vede ancora % gruppi (prima %)', n_dopo, n_prima;
  END IF;
  RAISE NOTICE 'PROVA C6 SUPERATA: la sentinella e'' passata da % a % gruppi — sa accendersi.',
    n_prima, n_dopo;
END
$prova$;
ROLLBACK;   -- OBBLIGATORIO: la presenza di prova non resta
