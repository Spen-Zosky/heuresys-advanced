-- =====================================================================================
-- B3 — Le sentinelle che non esistono, su tre delle quattro catene forensi del 2026-09-09.
--
-- IL FATTO (istruttoria SINTESI_catene_e_peso_persona_20260909.md):
--   In tre casi su quattro il controllo esiste ed e' verde, e il verde e' falso: esclude
--   con un regex le righe rotte (buste paga), sorveglia un asse ritirato (organigramma,
--   voce B10 di questo stesso ciclo). Nel quarto caso qui sotto (presenze/straordinari) la
--   guardia non c'e' affatto.
--
-- QUESTO FILE aggiunge le sentinelle mancanti su TRE catene. La quarta (organigramma) e'
-- B10, voce separata di questo piano perche' ripara una funzione esistente invece di
-- crearne una nuova.
--
-- REGOLA 5 — le prove devono poter fallire: ciascuna sentinella porta la propria prova a
-- esiti opposti in coda al file, da eseguire a mano dentro BEGIN...ROLLBACK.
-- =====================================================================================

\set ON_ERROR_STOP on

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. PRESENZE E STRAORDINARI — nessuna delle 41 viste-sentinella guarda questa catena.
--
--    Misurato 2026-09-09: il processo di richiesta straordinari (sys_overtime) e'
--    completamente FERMO dal 2025-12-12 (zero righe, di QUALUNQUE stato, dopo quella
--    data), mentre le presenze continuano a registrare ore di straordinario. Un
--    confronto riga-per-riga fra presenza e richiesta approvata sarebbe cieco: anche
--    PRIMA del 12/12 solo 113 presenze su 9.534 con straordinario avevano una richiesta
--    approvata corrispondente — il confronto giusto non e' "manca la singola richiesta",
--    e' "il processo di autorizzazione si e' fermato mentre il lavoro continuava".
--
--    Se sys_overtime e' del tutto vuota, l'ultima richiesta si tratta come remotissima
--    (1900-01-01): un processo mai esistito non deve nascondersi dietro un NULL.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW sys.v_straordinari_non_autorizzati AS
  WITH ultima_richiesta AS (
    SELECT coalesce(max(overtime_requested_at)::date, '1900-01-01'::date) AS ultima
      FROM sys.sys_overtime
  )
  SELECT
    a.attendance_tenant_id       AS tenant_id,
    a.attendance_subject_user_id AS persona_id,
    count(*)                     AS giorni_non_autorizzati,
    sum(a.attendance_hours_overtime) AS ore_non_autorizzate,
    min(a.attendance_date)       AS dal,
    max(a.attendance_date)       AS al
  FROM sys.sys_attendance a
  CROSS JOIN ultima_richiesta u
  WHERE a.attendance_hours_overtime > 0
    AND a.attendance_date > u.ultima
  GROUP BY 1, 2;

COMMENT ON VIEW sys.v_straordinari_non_autorizzati IS
  'SENTINELLA (B3, 2026-09-09). Ore di straordinario registrate in sys_attendance DOPO che '
  'il processo di richiesta sys_overtime si e'' fermato (nessuna richiesta, di qualunque '
  'stato, oltre quella data). Non zero righe attese per disegno: e'' la fotografia di un '
  'processo di business, non un vincolo strutturale. Le 2.434 ore accumulate al 2026-09-09 '
  'sono sanate da B3 dello stesso ciclo; se il processo si ferma di nuovo, la vista torna a '
  'vedere.';

-- -------------------------------------------------------------------------------------
-- 2. BUSTE PAGA CON PERIODO MALFORMATO — la sentinella esistente
--    (v_payslip_contract_mismatch, mig. 000296/000362) le esclude con un'espressione
--    regolare: e' verde perche' non le guarda. Questa vista le guarda apposta.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW sys.v_busta_paga_periodo_malformato AS
  SELECT
    user_pay_slip_id        AS pay_slip_id,
    user_pay_slip_tenant_id AS tenant_id,
    user_pay_slip_user_id   AS persona_id,
    user_pay_slip_period    AS periodo_scritto
  FROM sys.sys_user_pay_slips
  WHERE user_pay_slip_period IS NOT NULL
    AND user_pay_slip_period !~ '^\d{4}-\d{2}$';

COMMENT ON VIEW sys.v_busta_paga_periodo_malformato IS
  'SENTINELLA (B3, 2026-09-09). Zero righe attese. Il periodo di una busta paga deve avere '
  'la forma YYYY-MM: un periodo scritto in prosa ("September 2025") ordina alfabeticamente '
  'invece che cronologicamente e spinge fuori dai grafici i mesi veri (B8 corregge le '
  'righe gia'' malformate).';

-- -------------------------------------------------------------------------------------
-- 3. VALUTAZIONI "COMPLETATE" MA MAI CONDIVISE — il controllo su review_shared_at viene
--    scavalcato da un review_acknowledged_at riempito senza che la condivisione sia mai
--    avvenuta: 568 persone vedono "Completata" una valutazione che non hanno mai visto.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW sys.v_valutazione_completata_non_condivisa AS
  SELECT
    review_id,
    review_tenant_id       AS tenant_id,
    review_subject_user_id AS persona_id,
    review_period_start,
    review_period_end,
    review_acknowledged_at
  FROM sys.sys_performance_reviews
  WHERE review_status = 'COMPLETED'
    AND review_shared_at IS NULL
    AND review_acknowledged_at IS NOT NULL;

COMMENT ON VIEW sys.v_valutazione_completata_non_condivisa IS
  'SENTINELLA (B3, 2026-09-09). Zero righe attese. Una valutazione COMPLETED deve avere '
  'review_shared_at valorizzato prima che review_acknowledged_at possa esserlo: la persona '
  'non puo'' aver preso atto di una valutazione che non le e'' mai stata condivisa. Trovate '
  '568 righe cosi'' al 2026-09-09 (istruttoria SINTESI_catene..., C2) — riparazione non in '
  'questo ciclo (dipende dalla decisione di Enzo su come trattare le 14 calibrazioni '
  'modificate mai riportate sulla persona).';

COMMIT;

-- =====================================================================================
-- LE TRE PROVE A ESITI OPPOSTI — si eseguono a mano dopo l'installazione, ciascuna dentro
-- una transazione che finisce in ROLLBACK: nessun dato viene modificato.
-- =====================================================================================
-- -- (1) presenze/straordinari: si azzera artificialmente la data dell'ultima richiesta
-- BEGIN;
-- CREATE TEMP TABLE prova1_prima AS SELECT * FROM sys.v_straordinari_non_autorizzati;
-- UPDATE sys.sys_overtime SET overtime_requested_at = '1900-01-02'::timestamptz;
-- DO $prova$
-- DECLARE prima bigint; dopo bigint;
-- BEGIN
--   SELECT coalesce(sum(giorni_non_autorizzati),0) INTO prima FROM prova1_prima;
--   SELECT coalesce(sum(giorni_non_autorizzati),0) INTO dopo  FROM sys.v_straordinari_non_autorizzati;
--   IF dopo <= prima THEN
--     RAISE EXCEPTION 'PROVA 1 NON SA FALLIRE: prima % giorni, dopo %', prima, dopo;
--   END IF;
--   RAISE NOTICE 'PROVA 1 SUPERATA: da % a % giorni non autorizzati.', prima, dopo;
-- END $prova$;
-- ROLLBACK;
--
-- -- (2) busta paga: si inietta un periodo scritto in prosa
-- BEGIN;
-- CREATE TEMP TABLE prova2_prima AS SELECT * FROM sys.v_busta_paga_periodo_malformato;
-- UPDATE sys.sys_user_pay_slips SET user_pay_slip_period = 'Gennaio 2020'
--  WHERE user_pay_slip_id = (SELECT user_pay_slip_id FROM sys.sys_user_pay_slips LIMIT 1);
-- DO $prova$
-- DECLARE prima int; dopo int;
-- BEGIN
--   SELECT count(*) INTO prima FROM prova2_prima;
--   SELECT count(*) INTO dopo  FROM sys.v_busta_paga_periodo_malformato;
--   IF dopo <= prima THEN
--     RAISE EXCEPTION 'PROVA 2 NON SA FALLIRE: prima % righe, dopo %', prima, dopo;
--   END IF;
--   RAISE NOTICE 'PROVA 2 SUPERATA: da % a % righe malformate.', prima, dopo;
-- END $prova$;
-- ROLLBACK;
--
-- -- (3) valutazione: nessuna riga COMPLETED ha MAI review_shared_at valorizzato (misurato
-- --     2026-09-09: 0 su 570 in produzione) — rompere una riga "buona" non e' realizzabile
-- --     su questo dataset. La prova costruisce invece una violazione NUOVA: valorizza
-- --     review_acknowledged_at su una delle rare righe COMPLETED che ancora non lo ha.
-- BEGIN;
-- CREATE TEMP TABLE prova3_prima AS SELECT * FROM sys.v_valutazione_completata_non_condivisa;
-- UPDATE sys.sys_performance_reviews
--    SET review_acknowledged_at = now()
--  WHERE review_id = (SELECT review_id FROM sys.sys_performance_reviews
--                      WHERE review_status = 'COMPLETED' AND review_shared_at IS NULL
--                        AND review_acknowledged_at IS NULL LIMIT 1);
-- DO $prova$
-- DECLARE prima int; dopo int;
-- BEGIN
--   SELECT count(*) INTO prima FROM prova3_prima;
--   SELECT count(*) INTO dopo  FROM sys.v_valutazione_completata_non_condivisa;
--   IF dopo <= prima THEN
--     RAISE EXCEPTION 'PROVA 3 NON SA FALLIRE: prima % righe, dopo %', prima, dopo;
--   END IF;
--   RAISE NOTICE 'PROVA 3 SUPERATA: da % a % righe.', prima, dopo;
-- END $prova$;
-- ROLLBACK;
