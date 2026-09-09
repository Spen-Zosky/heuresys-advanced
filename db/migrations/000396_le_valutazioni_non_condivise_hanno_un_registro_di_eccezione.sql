-- 000396 — Le 568 valutazioni "completate" mai condivise: eccezione dichiarata, non backfill.
--
-- DECISIONE DI ENZO (2026-09-09, in risposta diretta): NON si scrive `review_shared_at` a
-- tavolino — significherebbe dichiarare condivisa una valutazione che non lo è mai stata,
-- ed è esattamente il difetto che il progetto vieta (IL PUNTO FISSO). L'eccezione va scritta
-- come DATO in un registro, con la CONDIZIONE che la chiude, e il cruscotto deve mostrare
-- quante righe sono coperte — non farle sparire in silenzio.
--
-- LA CAUSA (istruttoria SINTESI_catene_e_peso_persona_20260909.md, C2): il modulo di
-- valutazione dichiara di sé «le 16 colonne di workflow si popolano dal passo 4» — e quel
-- passo non è mai stato costruito. Non è un dato da correggere: è funzionalità che manca.
--
-- IL MECCANISMO. `sys_valutazione_condivisione_eccezioni` porta UNA RIGA PER VALUTAZIONE
-- (mai un carattere jolly), con la ragione, chi ha deciso, quando, e la condizione che la
-- invalida. `v_valutazione_completata_non_condivisa` (B3, mig 000387) esclude le righe
-- coperte: non tace sul totale, lo sposta in una vista compagna che il cruscotto legge come
-- informativa e mostra sempre.

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_valutazione_condivisione_eccezioni (
  eccezione_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id                   uuid NOT NULL REFERENCES sys.sys_performance_reviews(review_id) ON DELETE CASCADE,
  eccezione_motivo            text NOT NULL,
  eccezione_decisa_da         text NOT NULL,
  eccezione_decisa_il         date NOT NULL,
  eccezione_condizione_chiusura text NOT NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_valutazione_condivisione_eccezioni_uq UNIQUE (review_id),
  CONSTRAINT sys_valutazione_condivisione_eccezioni_motivata
    CHECK (length(btrim(eccezione_motivo)) > 10 AND length(btrim(eccezione_decisa_da)) > 0
           AND length(btrim(eccezione_condizione_chiusura)) > 10)
);

COMMENT ON TABLE sys.sys_valutazione_condivisione_eccezioni IS
  'Eccezione dichiarata (2026-09-09, decisione di Enzo) per le valutazioni COMPLETED mai '
  'condivise: NON un backfill di review_shared_at, che sarebbe una dichiarazione falsa. '
  'Ogni riga copre UNA valutazione, con la condizione che la rende superata. Fonte per la '
  'vista compagna informativa e per l''esclusione in v_valutazione_completata_non_condivisa.';

-- Congela, per ciascuna valutazione OGGI coperta, la riga di eccezione. Idempotente: una
-- valutazione già registrata non si ri-registra (ON CONFLICT sul review_id).
INSERT INTO sys.sys_valutazione_condivisione_eccezioni
  (review_id, eccezione_motivo, eccezione_decisa_da, eccezione_decisa_il, eccezione_condizione_chiusura)
SELECT review_id,
  'Valutazione COMPLETED con review_acknowledged_at valorizzato ma review_shared_at mai '
  'scritto: il passo di condivisione del workflow di valutazione non e'' mai stato costruito '
  '(istruttoria SINTESI_catene_e_peso_persona_20260909.md, C2). Non e'' un dato da correggere: '
  'e'' funzionalita'' mancante.',
  'Enzo (2026-09-09, risposta diretta durante la chiusura di sessione S1095)',
  DATE '2026-09-09',
  'Questa riga smette di essere coperta quando: (a) review_shared_at viene valorizzato '
  'davvero dal passo 4 del workflow, applicato a questa valutazione; oppure (b) Enzo decide '
  'diversamente per le 14 calibrazioni modificate mai riportate sulla persona (stessa '
  'istruttoria, C2) e la riga va ricalcolata invece che semplicemente condivisa.'
  FROM sys.v_valutazione_completata_non_condivisa
ON CONFLICT (review_id) DO NOTHING;

-- La sentinella esclude le righe coperte: non tace, sposta il conteggio nella vista compagna.
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
    AND review_acknowledged_at IS NOT NULL
    AND review_id NOT IN (SELECT review_id FROM sys.sys_valutazione_condivisione_eccezioni);

COMMENT ON VIEW sys.v_valutazione_completata_non_condivisa IS
  'SENTINELLA (B3, mig. 000387; esclusione dichiarata mig. 000396). Zero righe attese: una '
  'valutazione qui e'' o un dato da correggere, o una nuova eccezione da dichiarare (mai una '
  'riga silenziata senza motivo). Le righe gia'' note e coperte si leggono in '
  'sys.v_valutazione_condivisione_eccezioni_coperte, che il cruscotto mostra sempre.';

CREATE OR REPLACE VIEW sys.v_valutazione_condivisione_eccezioni_coperte AS
  SELECT count(*) AS righe_coperte FROM sys.sys_valutazione_condivisione_eccezioni;

COMMENT ON VIEW sys.v_valutazione_condivisione_eccezioni_coperte IS
  'INFORMATIVA (mig. 000396): quante valutazioni COMPLETED-non-condivise sono coperte da '
  'un''eccezione dichiarata (vedi sys_valutazione_condivisione_eccezioni per il motivo e la '
  'condizione di chiusura di ciascuna). Non e'' un allarme: e'' il numero che il cruscotto '
  'deve continuare a mostrare perche'' il debito non sparisca dalla vista.';

DO $$
DECLARE n_coperte int; n_residue int;
BEGIN
  SELECT count(*) INTO n_coperte FROM sys.sys_valutazione_condivisione_eccezioni;
  SELECT count(*) INTO n_residue FROM sys.v_valutazione_completata_non_condivisa;
  RAISE NOTICE '000396: % valutazioni coperte dall''eccezione dichiarata, % residue (attese 0 '
              'residue: ogni valutazione COMPLETED-non-condivisa di oggi e'' stata congelata).',
              n_coperte, n_residue;
  IF n_residue <> 0 THEN
    RAISE EXCEPTION '000396: restano % righe non coperte ne'' dall''eccezione ne'' risolte',
      n_residue;
  END IF;
END $$;

COMMIT;
