-- ============================================================================================
-- 000496 — Il motivo e la condizione dell'eccezione di condivisione si leggono in italiano corrente
--          (giudizio qa-web del 16/11, A4, F1676).
--
-- PERCHÉ. La 000396 ha scritto nel registro `sys_valutazione_condivisione_eccezioni` un motivo con
--   nomi di colonna («review_acknowledged_at», «review_shared_at»), la parola «workflow» e gli
--   apostrofi al posto degli accenti («non e'' mai stato costruito»). Il motivo compare in /performance.
--   Il file che crea il dato è già emendato (ADR-0035); ma la 000396 inserisce solo le valutazioni non
--   ancora coperte, e oggi sono tutte coperte: le righe esistenti si riallineano qui.
--
-- IDEMPOTENZA. Ogni UPDATE ha come condizione il testo difettoso stesso (uguaglianza esatta con il testo
--   scritto dalla 000396 di prima): alla seconda passata non trova righe, e un motivo scritto da una
--   persona o diverso da quello non si tocca.
-- ROLLBACK. staging.eccezioni_valutazione_testo_undo registra, prima della scrittura, il valore di prima
--   e quello dopo di ogni colonna toccata; tornare indietro = riscrivere value_before dove la colonna
--   vale ancora value_after.
-- GUARDIA. Solo le colonne eccezione_motivo e eccezione_condizione_chiusura, solo le righe che hanno
--   esattamente il testo vecchio. Nessuna cancellazione.
-- ============================================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS staging.eccezioni_valutazione_testo_undo (
  eccezione_id uuid        NOT NULL,
  column_name  varchar(63) NOT NULL,
  value_before text,
  value_after  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (eccezione_id, column_name)
);

-- I testi, in un posto solo: quello vecchio (la 000396 di prima) e quello nuovo (la 000396 emendata).
CREATE TEMP TABLE _testi_eccezione ON COMMIT DROP AS
SELECT 'eccezione_motivo'::varchar(63) AS colonna,
       'Valutazione COMPLETED con review_acknowledged_at valorizzato ma review_shared_at mai '
       'scritto: il passo di condivisione del workflow di valutazione non e'' mai stato costruito '
       '(istruttoria SINTESI_catene_e_peso_persona_20260909.md, C2). Non e'' un dato da correggere: '
       'e'' funzionalita'' mancante.' AS vecchio,
       'Valutazione completata e già presa in visione dalla persona, ma mai condivisa formalmente: '
       'il passo di condivisione del flusso di valutazione non è mai stato realizzato '
       '(istruttoria del 9 settembre 2026, punto C2). Non è un dato da correggere: '
       'è una funzionalità che manca.' AS nuovo
UNION ALL
SELECT 'eccezione_condizione_chiusura',
       'Questa riga smette di essere coperta quando: (a) review_shared_at viene valorizzato '
       'davvero dal passo 4 del workflow, applicato a questa valutazione; oppure (b) Enzo decide '
       'diversamente per le 14 calibrazioni modificate mai riportate sulla persona (stessa '
       'istruttoria, C2) e la riga va ricalcolata invece che semplicemente condivisa.',
       'Questa riga smette di essere coperta quando: (a) la condivisione viene registrata '
       'davvero dal passo 4 del flusso di valutazione, applicato a questa valutazione; oppure (b) Enzo decide '
       'diversamente per le 14 calibrazioni modificate mai riportate sulla persona (stessa '
       'istruttoria, C2) e la riga va ricalcolata invece che semplicemente condivisa.';

-- ① il giornale di annullamento, prima della scrittura
INSERT INTO staging.eccezioni_valutazione_testo_undo (eccezione_id, column_name, value_before, value_after)
SELECT e.eccezione_id, 'eccezione_motivo', e.eccezione_motivo, t.nuovo
  FROM sys.sys_valutazione_condivisione_eccezioni e
  JOIN _testi_eccezione t ON t.colonna = 'eccezione_motivo' AND e.eccezione_motivo = t.vecchio
ON CONFLICT DO NOTHING;

INSERT INTO staging.eccezioni_valutazione_testo_undo (eccezione_id, column_name, value_before, value_after)
SELECT e.eccezione_id, 'eccezione_condizione_chiusura', e.eccezione_condizione_chiusura, t.nuovo
  FROM sys.sys_valutazione_condivisione_eccezioni e
  JOIN _testi_eccezione t ON t.colonna = 'eccezione_condizione_chiusura'
                         AND e.eccezione_condizione_chiusura = t.vecchio
ON CONFLICT DO NOTHING;

-- ② la riscrittura
UPDATE sys.sys_valutazione_condivisione_eccezioni e
   SET eccezione_motivo = t.nuovo
  FROM _testi_eccezione t
 WHERE t.colonna = 'eccezione_motivo' AND e.eccezione_motivo = t.vecchio;

UPDATE sys.sys_valutazione_condivisione_eccezioni e
   SET eccezione_condizione_chiusura = t.nuovo
  FROM _testi_eccezione t
 WHERE t.colonna = 'eccezione_condizione_chiusura' AND e.eccezione_condizione_chiusura = t.vecchio;

-- ③ la post-condizione: nessuna riga conserva più il testo di prima
DO $$
DECLARE n_residue int;
BEGIN
  SELECT count(*) INTO n_residue
    FROM sys.sys_valutazione_condivisione_eccezioni e
    JOIN _testi_eccezione t
      ON (t.colonna = 'eccezione_motivo' AND e.eccezione_motivo = t.vecchio)
      OR (t.colonna = 'eccezione_condizione_chiusura' AND e.eccezione_condizione_chiusura = t.vecchio);
  IF n_residue <> 0 THEN
    RAISE EXCEPTION '000496: % righe di eccezione conservano ancora il testo di prima', n_residue;
  END IF;
END $$;

COMMIT;
