-- ============================================================================
-- 000332 — Le diciotto `staging.wave1_*` escono.  (#69 F1)
--
-- CHE COSA SONO: le tabelle di appoggio dell'importazione «Wave 1» dal database legacy —
-- buffer jsonb uniformi, uno per bersaglio canonico, che il caricatore riempiva leggendo
-- `brownfield.column_mappings`. **Diciotto tabelle, 720 kB, zero righe** (misurato
-- 2026-08-19, e la guardia qui sotto lo ri-misura al momento dell'esecuzione).
--
-- PERCHE' ADESSO E NON PRIMA — ed e' una catena di condizioni cadute, non un ripensamento.
-- Due migrazioni le hanno gia' incontrate e **lasciate dov'erano**, ognuna con la sua ragione:
--
--   · la `000193` («drop dead brownfield staging») le ha escluse dichiarando:
--     «staging.wave1_* → gated dalla decisione Wave-3 (#17, HOLD Enzo)»;
--   · la `000283` (ritiro delle tabelle della ricostruzione RTL) le ha escluse dichiarando:
--     «Non appartengono alla ricostruzione RTL ma all'area di appoggio della funzionalita'
--      brownfield, che la fase 3 ritira e la fase 4 rimuove. Toglierle qui romperebbe la
--      funzionalita' prima del suo ritiro.»
--
-- Entrambe le condizioni sono cadute, e **misurate**, non ricordate:
--   · **#17 Wave-3 e' `WON'T-DO`** dal 2026-08-14 — ritirato da Enzo perche' era
--     un'importazione dal legacy, vietata dall'invariante **I12** («il rubinetto e' chiuso»);
--   · **lo schema `brownfield` non esiste piu'** (0 schemi con quel nome): `#164` F4 l'ha
--     ritirato con la mig. `000297`, cioe' la fase che la `000283` diceva di aspettare.
--
-- ⚠ LA LEZIONE DELLA `000283`, che vale ancora e per questo si ripete qui: «una tabella
-- vuota non e' una tabella inutilizzata — e' l'ingresso di un processo che in questo momento
-- non sta girando». Il permesso di toglierle non viene dal fatto che siano vuote: viene dal
-- fatto che **il processo che le riempiva e' stato ritirato per decisione**.
--
-- COSA SI ROMPE: **niente**, e non e' un auspicio. I quattro file che nominano «wave1»
-- (`db/seeds/reconciliation/52_*.sql`, `db/scripts/populate-i18n-wave1-gaps.sql`,
-- `db/scripts/extract-wave1-legacy.sh`, un test di integrazione) nominano **file** con quel
-- nome — dump del legacy, CSV di traduzioni — non queste tabelle. Verificato leggendoli.
-- Misurato inoltre: **0 chiavi esterne** puntano a queste tabelle e **0 viste** le nominano.
--
-- ADR-0035, ED E' GIA' META' FATTO. La catena si ri-applica per intero a ogni deploy, quindi
-- un `DROP` a valle da solo oscillerebbe. Ma i due file che le creano — `000030` e `000034` —
-- portano gia' il marcatore `-- @migrate: once` (messo da `#164` F4) e **non hanno guardie
-- vive** (zero `RAISE EXCEPTION`): su un database che esiste vengono saltati, e su uno nuovo
-- girano, creano le diciotto, e questa migrazione le toglie subito dopo. Le due strade
-- arrivano allo stesso posto, ed e' la post-condizione a dimostrarlo invece di prometterlo.
--
-- ELENCO ESPLICITO, MAI UN CARATTERE JOLLY. `DROP ... staging.wave1_%` sarebbe piu' corto e
-- toglierebbe anche cio' che non ho misurato: e' la regola del metodo di bonifica, e qui ha
-- un motivo concreto — nello stesso schema vivono `storia36_*` (1.110 righe di calendario,
-- infrastruttura viva) e i giornali `*_undo` di sei migrazioni.
--
-- ROLLBACK, dichiarato: **non serve un giornale**. Le tabelle sono vuote — non c'e' una riga
-- da conservare — e la loro struttura resta scritta in `000030`/`000034`, che su un database
-- nuovo la ricreano. Ricostruirle a mano e' `git show` di due file.
-- IDEMPOTENTE: `DROP TABLE IF EXISTS`. Rieseguirla non fa niente.
-- ============================================================================
BEGIN;

-- ── ① la guardia, ri-verificata ADESSO e non ereditata dalla misura ───────────
-- La misura del censimento e' di poco fa, ma questa migrazione gira anche fra mesi, sul
-- clone di CI e su un database ricreato da zero. Se una di queste tabelle avesse righe,
-- toglierla sarebbe una perdita di dati travestita da pulizia: ci si ferma, e si dice quale.
DO $$
DECLARE v_piene text; n int;
BEGIN
  SELECT string_agg(t.tab || ' (' || t.righe || ')', ', ') INTO v_piene
    FROM (
      SELECT c.relname AS tab, coalesce(s.n_live_tup, 0) AS righe
        FROM pg_class c
        JOIN pg_namespace ns ON ns.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
       WHERE ns.nspname = 'staging' AND c.relkind = 'r' AND c.relname LIKE 'wave1\_%'
    ) t
   WHERE t.righe > 0;
  IF v_piene IS NOT NULL THEN
    RAISE EXCEPTION '000332: queste tabelle di appoggio NON sono vuote e non vanno tolte cosi'': %', v_piene;
  END IF;

  SELECT count(*) INTO n
    FROM pg_constraint pc
    JOIN pg_class c ON c.oid = pc.confrelid
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'staging' AND c.relname LIKE 'wave1\_%';
  IF n <> 0 THEN
    RAISE EXCEPTION '000332: % chiavi esterne puntano ancora alle tabelle wave1: qualcosa le usa', n;
  END IF;

  RAISE NOTICE '000332: guardia passata — nessuna riga, nessun riferimento in entrata';
END $$;

-- ── ② le diciotto, una per una ────────────────────────────────────────────────
DROP TABLE IF EXISTS staging.wave1_activity_classification_mappings;
DROP TABLE IF EXISTS staging.wave1_activity_classifications;
DROP TABLE IF EXISTS staging.wave1_blueprint_process_registry;
DROP TABLE IF EXISTS staging.wave1_compensation_bands;
DROP TABLE IF EXISTS staging.wave1_esco_occupation_mappings;
DROP TABLE IF EXISTS staging.wave1_job_families;
DROP TABLE IF EXISTS staging.wave1_job_roles;
DROP TABLE IF EXISTS staging.wave1_learning_modules;
DROP TABLE IF EXISTS staging.wave1_learning_path_steps;
DROP TABLE IF EXISTS staging.wave1_learning_paths;
DROP TABLE IF EXISTS staging.wave1_process_kpi_templates;
DROP TABLE IF EXISTS staging.wave1_skill_aliases;
DROP TABLE IF EXISTS staging.wave1_skill_categories;
DROP TABLE IF EXISTS staging.wave1_skill_families;
DROP TABLE IF EXISTS staging.wave1_skill_learning_mappings;
DROP TABLE IF EXISTS staging.wave1_skill_taxonomy_edges;
DROP TABLE IF EXISTS staging.wave1_skills;
DROP TABLE IF EXISTS staging.wave1_user_certifications;

-- ── ③ la sentinella che le tiene fuori (#69 F2) ───────────────────────────────
-- Il ritiro senza guardia sarebbe una pulizia, non una cura: nessuno saprebbe se domani
-- ricompaiono. Qui la guardia non e' uno script da ricordarsi di lanciare — e' una vista, e
-- `db_health.py` **scopre le sentinelle da `pg_views`** e pretende che ognuna torni ZERO
-- righe. Quindi basta che questa vista esista perche' la prova entri nella batteria che gira
-- alla prova generale e a ogni avvio di sessione: nessun elenco da tenere aggiornato a mano.
--
-- ⚠ Guarda `pg_class` e non un elenco di nomi: se qualcuno domani creasse una
-- `staging.wave1_qualcosa_di_nuovo`, comparirebbe qui senza che nessuno abbia aggiornato
-- niente. Un elenco fisso avrebbe protetto solo le diciotto che conoscevo io.
CREATE OR REPLACE VIEW sys.v_staging_wave1_residue AS
  SELECT c.relname AS tabella,
         'tabella di appoggio dell''import Wave 1: ritirata da #69 (mig. 000332), non deve tornare' AS motivo
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'staging' AND c.relkind = 'r' AND c.relname LIKE 'wave1\_%';

COMMENT ON VIEW sys.v_staging_wave1_residue IS
  'Sentinella #69: deve tornare ZERO righe. Le 18 tabelle di appoggio dell''importazione '
  'Wave 1 dal legacy sono state ritirate dalla mig. 000332, dopo che sono cadute entrambe le '
  'condizioni che le proteggevano (#17 Wave-3 = WON''T-DO per I12; schema brownfield ritirato '
  'da #164 F4). Una riga qui vuol dire che qualcosa le ha ricreate.';

-- ── ④ le post-condizioni ──────────────────────────────────────────────────────
DO $$
DECLARE n int; v_restano text;
BEGIN
  -- 1. Nessuna wave1 e' rimasta. Vale su entrambe le strade: su un database esistente i due
  --    file che le creano vengono saltati (`@migrate: once`), su uno nuovo girano e questa
  --    migrazione le toglie subito dopo — e questa riga dimostra che finiscono allo stesso
  --    posto, invece di prometterlo.
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'staging' AND c.relkind = 'r' AND c.relname LIKE 'wave1\_%';
  IF n <> 0 THEN
    RAISE EXCEPTION '000332: restano % tabelle wave1 in staging', n;
  END IF;

  -- 2. CIO' CHE NON DOVEVA CAMBIARE, ed e' il motivo per cui l'elenco e' esplicito: nello
  --    stesso schema vivono il calendario della storia RTL e i giornali di rollback di sei
  --    migrazioni. Un `DROP ... LIKE 'wave1%'` scritto male, o uno schema intero cancellato
  --    per fretta, li porterebbe via in silenzio.
  SELECT string_agg(x.tab, ', ') INTO v_restano
    FROM (VALUES ('storia36_calendar'), ('storia36_runs'), ('rtl_employees'),
                 ('rtl_employee_module_completions')) AS x(tab)
   WHERE NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
                      WHERE ns.nspname = 'staging' AND c.relname = x.tab);
  IF v_restano IS NOT NULL THEN
    RAISE EXCEPTION '000332: sono sparite tabelle che dovevano restare: %', v_restano;
  END IF;

  SELECT count(*) INTO n FROM staging.storia36_calendar;
  IF n = 0 THEN
    RAISE EXCEPTION '000332: il calendario della storia RTL e'' vuoto — nessun DROP di wave1 puo'' aver fatto questo';
  END IF;

  -- 3. I giornali `*_undo` restano: sono la via di ritorno di sei bonifiche precedenti, e
  --    perderli renderebbe irreversibile cio' che era stato scritto per essere reversibile.
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'staging' AND c.relkind = 'r' AND c.relname LIKE '%\_undo';
  IF n < 6 THEN
    RAISE EXCEPTION '000332: i giornali di rollback in staging sono scesi a %', n;
  END IF;

  -- 4. La sentinella esiste ED E' A ZERO. Verificarlo qui e non solo in `db_health` chiude
  --    il caso in cui la vista fosse scritta male: una sentinella che non trova mai niente
  --    perche' interroga la cosa sbagliata e' identica, a occhio, a una che vigila davvero.
  SELECT count(*) INTO n FROM pg_views WHERE schemaname = 'sys' AND viewname = 'v_staging_wave1_residue';
  IF n <> 1 THEN
    RAISE EXCEPTION '000332: la sentinella v_staging_wave1_residue non esiste';
  END IF;
  SELECT count(*) INTO n FROM sys.v_staging_wave1_residue;
  IF n <> 0 THEN
    RAISE EXCEPTION '000332: la sentinella vede ancora % tabelle wave1', n;
  END IF;

  RAISE NOTICE '000332 ok — le 18 tabelle di appoggio wave1 sono uscite; sentinella attiva; calendario, giornali e dati RTL intatti';
END $$;

COMMIT;
