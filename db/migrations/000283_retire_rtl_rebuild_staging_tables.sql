-- ═══════════════════════════════════════════════════════════════════════════════
-- 000283_retire_rtl_rebuild_staging_tables.sql
--
-- #164 FASE 1 (rivista) — RITIRO DELLE TABELLE DI APPOGGIO DELLA RICOSTRUZIONE RTL.
--
-- LA DECISIONE (Enzo, 2026-08-07): **la ricostruzione del tenant RTL e' a fine vita.**
-- Senza questa risposta le 12 tabelle NON andavano toccate: sono l'ingresso di uno
-- strumento, e una tabella vuota non e' una tabella inutilizzata — e' l'ingresso di un
-- processo che in questo momento non sta girando. E' la ragione per cui F1, come era
-- scritta nel piano («nessuna conseguenza: zero righe, zero viste, zero codice»), e'
-- stata FERMATA dalla misura: il codice c'era.
--
-- COSA SI RIMUOVE, E COSA NO
--   · SI: le 12 `staging.rtl_*` **vuote**, elencate una per una qui sotto.
--   · NO: `staging.rtl_employees` (162 righe) e `staging.rtl_employee_module_completions`
--     (11 righe). Contengono dati, e «lo strumento e' a fine vita» non e' la stessa cosa
--     di «i suoi dati si buttano»: e' una decisione separata, e non e' stata presa.
--   · NO: le 18 `staging.wave1_*` vuote. Non appartengono alla ricostruzione RTL ma
--     all'area di appoggio della funzionalita' brownfield, che la **fase 3** ritira e la
--     **fase 4** rimuove. Toglierle qui romperebbe la funzionalita' prima del suo ritiro,
--     che e' esattamente cio' che l'ordine delle fasi esiste per impedire.
--   · NO: `staging.storia36_*` (calendario, corse, giornali di rollback di #155/#160).
--     Sono infrastruttura VIVA della storia RTL, non residuo. Per questo la rimozione e'
--     per elenco esplicito e mai per schema.
--
-- COSA SI ROMPE, DICHIARATO. I seed `db/seeds/rtl-rebuild/{02,05,06,07,08}*.sql` leggono
-- almeno una di queste tabelle e non saranno piu' eseguibili. E' l'effetto voluto del
-- ritiro, non un danno collaterale: vedi `db/seeds/rtl-rebuild/RETIRED.md`.
-- VERIFICATO che il ritiro non tocca nulla di recente: il seed rieseguito in S1048 e'
-- `db/seeds/storia36/05_career.sql`, che sta in un'ALTRA cartella e legge **zero**
-- tabelle `staging.rtl_*`.
--
-- Misurato prima: 0 chiavi esterne e 0 viste puntano a queste tabelle.
-- Idempotente: `DROP TABLE IF EXISTS`. Rieseguirla non fa nulla.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $mig$
DECLARE
  -- Elenco ESPLICITO. Mai `DROP SCHEMA`, mai un pattern: nello stesso schema vivono il
  -- calendario della storia e i giornali di rollback, e un carattere jolly non distingue.
  c_tabelle constant text[] := ARRAY[
    'rtl_certifications', 'rtl_employee_attendance', 'rtl_employee_certifications',
    'rtl_employee_contracts', 'rtl_employee_skill_assessments', 'rtl_employee_skill_profiles',
    'rtl_employee_skills', 'rtl_org_units', 'rtl_salary_band_assignments',
    'rtl_salary_bands', 'rtl_tenant_custom_skills', 'rtl_users'
  ];
  v_t     text;
  v_righe bigint;
  v_drop  int := 0;
  v_gia   int := 0;
BEGIN
  FOREACH v_t IN ARRAY c_tabelle LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='staging' AND tablename=v_t) THEN
      v_gia := v_gia + 1;
      CONTINUE;                                   -- gia' rimossa: la migrazione e' rieseguibile
    END IF;

    -- GUARDIA: si rimuove solo cio' che e' VUOTO, e la vuotezza si verifica ADESSO, non
    -- si eredita dalla misura di ieri. Se qualcuno ha ripopolato una di queste tabelle,
    -- il presupposto del ritiro non vale piu' e la migrazione deve fermarsi, non decidere
    -- da sola che i dati sono sacrificabili.
    EXECUTE format('SELECT count(*) FROM staging.%I', v_t) INTO v_righe;
    IF v_righe > 0 THEN
      RAISE EXCEPTION '000283: staging.% contiene % righe — non e piu vuota, il ritiro si ferma qui', v_t, v_righe;
    END IF;

    EXECUTE format('DROP TABLE IF EXISTS staging.%I', v_t);
    v_drop := v_drop + 1;
  END LOOP;

  -- POST-CONDIZIONE 1 — nessuna delle 12 sopravvive.
  SELECT count(*) INTO v_righe FROM pg_tables
   WHERE schemaname='staging' AND tablename = ANY(c_tabelle);
  IF v_righe > 0 THEN
    RAISE EXCEPTION '000283: % tabelle dell elenco sono ancora presenti', v_righe;
  END IF;

  -- POST-CONDIZIONE 2 — l'infrastruttura VIVA e' intatta. E' la verifica che conta:
  -- prova che il ritiro ha colpito l'elenco e nient'altro nello stesso schema.
  FOREACH v_t IN ARRAY ARRAY['storia36_calendar','storia36_runs','rtl_employees'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='staging' AND tablename=v_t) THEN
      RAISE EXCEPTION '000283: staging.% e sparita — il ritiro ha colpito oltre l elenco', v_t;
    END IF;
  END LOOP;

  RAISE NOTICE '000283 done: % tabelle di appoggio ritirate (% gia assenti); infrastruttura storia36 e rtl_employees intatte', v_drop, v_gia;
END $mig$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — non esiste, e va detto invece di lasciarlo intendere.
-- Le tabelle erano VUOTE: ricrearle significa ricreare lo SCHEMA, che sta nelle
-- migrazioni che le hanno introdotte (e in `db/seeds/rtl-rebuild/`). Nessun dato e'
-- andato perso perche' non ce n'era: la guardia qui sopra si ferma se ce n'e'.
-- ═══════════════════════════════════════════════════════════════════════════════
