-- ═══════════════════════════════════════════════════════════════════════════════
-- 000263_empty_review_shell_and_history_decision.sql
--
-- LE 545 VALUTAZIONI: LA DECISIONE, E I DUE GUSCI VUOTI.
--
-- LA MISURA DI PARTENZA, E COME E' CAMBIATA
--   Il referto del 2026-08-04 apriva su questo reperto: su 550 valutazioni, **545
--   hanno come valutatore il capo indicato dall'albero delle POSIZIONI** — l'albero
--   che lo stesso referto dichiarava inattendibile — e solo 42 il responsabile
--   dell'unita. Se ne concludeva che il difetto non era solo di lettura (un resolver
--   che percorre la struttura sbagliata) ma anche di scrittura: 545 atti intestati a
--   una gerarchia che non descriveva l'azienda.
--
--   Quella premessa OGGI NON REGGE PIU', e non perche' qualcuno abbia cambiato idea:
--   perche' l'albero e' stato riparato. Le otto migrazioni hanno raddrizzato le
--   unita, la `000258` ha riconnesso le posizioni, e la verifica che misura la
--   distanza fra i due alberi — «divergenza fra l'albero che il resolver usa e
--   l'albero delle unita» — e' passata da **30 persone su 38** a **ZERO su 42**.
--   I due alberi ora dicono la stessa cosa. Il resolver percorre quello delle
--   posizioni, ed e' corretto che lo faccia perche' quell'albero adesso e' vero.
--
-- LA DECISIONE SULLE 545: RESTANO
--   Non si riscrivono. Una valutazione conclusa e' un atto avvenuto fra due persone
--   in un momento dato; cambiarne il valutatore a posteriori non corregge un dato,
--   falsifica un documento del rapporto di lavoro. E quasi tutte sono `COMPLETED`.
--   La ragione che avrebbe potuto giustificare la riscrittura — «l'albero era
--   sbagliato, quindi anche il valutatore lo era» — cade insieme alla premessa: da
--   oggi le valutazioni NUOVE nascono da una catena che dice la verita, e questo e'
--   il rimedio, non la riscrittura del passato.
--
--   Conseguenza visibile, dichiarata e non nascosta: la verifica «responsabile senza
--   alcuna valutazione da fare» segna 23 su 42. Sono i responsabili nominati dalla
--   ricostruzione, che non hanno mai valutato nessuno perche' le valutazioni
--   esistenti appartengono alla gerarchia precedente. Non e' un difetto da azzerare:
--   e' la faccia visibile della decisione di non riscrivere la storia, e si
--   risolvera' da se' al primo ciclo di valutazione nuovo.
--
-- CIO' CHE SI TOGLIE: DUE GUSCI, NON UNO
--   La sola valutazione non conclusa — l'unica `IN_PROGRESS` — non ha ne' soggetto
--   ne' valutatore: entrambi NULL. Il piano prevedeva di «riassegnarla al
--   responsabile reale»: non c'e' nessuno a cui riassegnarla.
--
--   Cercandone il gemello ne e' saltato fuori un SECONDO, e questo cambia un numero
--   del referto: fra le 549 dichiarate `COMPLETED` ce n'e' una anch'essa **senza
--   soggetto e senza valutatore**, periodo 2024-01-01/06-30, cioe' il semestre
--   precedente all'altra. Sono due gusci consecutivi, non due valutazioni. Quindi le
--   valutazioni VERE non sono 549 ma **548**, e il «550 su 550» da cui partiva tutto
--   ne contava due che non lo erano.
--
--   Verificato che nessuna riga le referenzi — zero discussioni di calibrazione,
--   zero valutazioni di competenza, zero risposte 360 — quindi si tolgono entrambe.
--
--   Toglierla ha anche un effetto sulla misura, e va detto: la verifica «valutazione
--   aperta con un valutatore che non e' il responsabile» girava su un universo di
--   UNO, cioe' non poteva quasi fallire. Dopo, l'universo e' zero e la verifica
--   diventa apertamente cieca invece di sembrare superata. Una verifica dichiarata
--   cieca e' piu' onesta di una che passa perche' non ha niente da guardare.
--
-- Prerequisiti: 000258 applicata (e' quella che ha riparato l'albero).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DELETE FROM sys.sys_performance_reviews r
 WHERE r.review_subject_user_id IS NULL
   AND r.review_reviewer_user_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM sys.sys_calibration_discussions d
                    WHERE d.calibration_discussion_review_id = r.review_id)
   AND NOT EXISTS (SELECT 1 FROM sys.sys_performance_review_competency_ratings c
                    WHERE c.rating_review_id = r.review_id)
   AND NOT EXISTS (SELECT 1 FROM sys.sys_feedback_360_responses f
                    WHERE f.response_review_id = r.review_id);

DO $$
DECLARE
  n_tot int; n_completate int; n_vuote int; n_senza_soggetto int; n_diverg int;
BEGIN
  SELECT count(*) INTO n_tot FROM sys.sys_performance_reviews;
  SELECT count(*) INTO n_completate FROM sys.sys_performance_reviews WHERE review_status='COMPLETED';

  -- LE 548 RESTANO. Se un giorno questo numero calasse, qualcuno avrebbe riscritto
  -- la storia: questa asserzione e' la guardia di quella decisione, non un conteggio.
  --
  -- ⚠ CORRETTA S1064 (2026-08-16) DA `<> 548` A `< 548`, e il perche' e' il PUNTO FISSO del
  -- CLAUDE.md: un dato che per sua natura puo' variare non si cristallizza. L'intento e'
  -- scritto due righe sopra ed e' direzionale — «se un giorno questo numero CALASSE» — ma
  -- l'uguaglianza stretta scattava anche in CRESCITA, che e' cio' che il lavoro legittimo
  -- produce. Misurato il 2026-08-16 sul database di produzione: 570 concluse, +22 nate tutte
  -- il 2026-08-15, TUTTE con soggetto e valutatore, ZERO gusci vuoti — la storia che avanza,
  -- non una corruzione. La catena era percio' VERDE sulla CI (clone congelato, ferma a 548) e
  -- ROSSA in produzione: la stessa famiglia del difetto che la prova generale intercetta, ma
  -- al contrario, e per questo la prova generale non poteva vederla.
  --
  -- La guardia resta intera: una DIMINUZIONE e' ancora un errore fatale, e le due asserzioni
  -- sotto (nessun guscio senza soggetto, albero integro) non sono state toccate — sono loro a
  -- impedire che la crescita ammessa qui faccia entrare righe malformate.
  IF n_completate < 548 THEN
    RAISE EXCEPTION 'Valutazioni concluse REALI: attese almeno 548 INTATTE, trovate % — la storia non si riscrive', n_completate;
  END IF;
  IF n_tot < 548 THEN
    RAISE EXCEPTION 'Valutazioni totali: attese almeno 548 (550 meno i due gusci vuoti), trovate %', n_tot;
  END IF;

  SELECT count(*) INTO n_vuote FROM sys.sys_performance_reviews
   WHERE review_subject_user_id IS NULL OR review_reviewer_user_id IS NULL;
  IF n_vuote <> 0 THEN
    RAISE EXCEPTION 'Restano % valutazioni senza soggetto o senza valutatore', n_vuote;
  END IF;

  -- e la premessa che rende sostenibile la decisione: i due alberi coincidono.
  -- Se divergessero di nuovo, la scelta di non riscrivere andrebbe ridiscussa.
  SELECT violazioni INTO n_diverg FROM sys.fn_organization_integrity_violations()
   WHERE regola = 'R5 albero delle posizioni spezzato';
  IF n_diverg <> 0 THEN
    RAISE EXCEPTION 'L albero delle posizioni e di nuovo rotto (%): la decisione sulle 548 poggia sul fatto che sia integro', n_diverg;
  END IF;

  RAISE NOTICE 'OK — due gusci vuoti rimossi, % valutazioni concluse reali intatte, nessuna riga senza soggetto o valutatore, albero delle posizioni integro.', n_completate;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — le due righe rimosse erano vuote: ricrearle non restituirebbe alcun dato.
-- ═══════════════════════════════════════════════════════════════════════════════
