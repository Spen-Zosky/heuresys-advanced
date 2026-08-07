-- ═══════════════════════════════════════════════════════════════════════════════
-- 000279_mark_provenance_of_relevance_rows.sql
--
-- LE RIGHE DI RILEVANZA CREATE DALLA 000278 DICHIARANO DA DOVE VENGONO.
--
-- Il difetto
--   La 000278 (#160) ha creato 4 righe in `sys_position_succession_relevance` per
--   le posizioni critiche riagganciate che non ne avevano una. Le ha create SENZA
--   marchio di provenienza, e così sono diventate indistinguibili da quelle
--   dell'import Wave-2. La sentinella che sorveglia l'import
--   (`reconciliation-f3-imports`) le conta insieme alle proprie: 9 attese, 13
--   trovate.
--
--   È un difetto di **provenienza**, non di conteggio, ed è il motivo per cui la
--   soluzione non è alzare il numero atteso a 13: quel test verifica che l'import
--   non si eroda e non si gonfi, e perde la capacità di farlo se righe di altra
--   origine gli si mescolano dentro. Il repository ha già la convenzione giusta —
--   `metadata->>'storia36'` — e il commento della sentinella la nomina
--   esplicitamente: «quelle righe portano il marchio del programma».
--
-- Come si riconoscono, senza indovinare
--   Non per euristica sui valori: il giornale del ritorno della 000278
--   (`staging.storia36_160_undo`) registra ogni riga che quella migrazione ha
--   CREATO, con `operazione = 'INSERT'` e la chiave. Si marcano esattamente
--   quelle, cioè le righe di cui la 000278 è responsabile e nessun'altra.
--
--   Se il giornale non esiste (clone che non ha mai visto la 000278), non c'è
--   nulla da marcare e la migrazione non fa niente.
--
-- Rieseguibile: agisce solo sulle righe ancora prive di marchio.
-- Prerequisiti: 000278 applicata.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE sys.sys_position_succession_relevance r
   SET position_succession_relevance_metadata =
         r.position_succession_relevance_metadata || jsonb_build_object('storia36', '160'),
       updated_at = now()
  FROM staging.storia36_160_undo u
 WHERE u.tabella = 'sys_position_succession_relevance'
   AND u.operazione = 'INSERT'
   AND r.position_id = u.chiave
   AND r.position_succession_relevance_metadata->>'storia36' IS NULL;

-- ───────────────────────────────────────────────────────────────────────────────
-- AUTO-VERIFICA
--   L'invariante è che le righe SENZA marchio siano quelle dell'import e basta.
--   Relativa, non assoluta: su un clone senza la 000278 il giornale è vuoto, non
--   c'è nulla da marcare, e la condizione è soddisfatta a vuoto — correttamente.
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_non_marcate int; v_create int;
BEGIN
  SELECT count(*) INTO v_create
    FROM staging.storia36_160_undo
   WHERE tabella = 'sys_position_succession_relevance' AND operazione = 'INSERT';

  SELECT count(*) INTO v_non_marcate
    FROM sys.sys_position_succession_relevance r
    JOIN staging.storia36_160_undo u
      ON u.tabella = 'sys_position_succession_relevance'
     AND u.operazione = 'INSERT'
     AND r.position_id = u.chiave
   WHERE r.position_succession_relevance_metadata->>'storia36' IS NULL;

  IF v_non_marcate > 0 THEN
    RAISE EXCEPTION '000279: % righe create dalla 000278 restano senza provenienza', v_non_marcate;
  END IF;

  RAISE NOTICE '000279 — % righe di rilevanza dichiarano la propria provenienza; la sentinella dell''import torna a vedere solo l''import.', v_create;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
--   UPDATE sys.sys_position_succession_relevance
--      SET position_succession_relevance_metadata =
--            position_succession_relevance_metadata - 'storia36'
--    WHERE position_succession_relevance_metadata->>'storia36' = '160';
-- ═══════════════════════════════════════════════════════════════════════════════
