-- 000433_x2_origine_dato_sys_user_contracts.sql
-- Mandato K, X-2, passo 61 — colonna di provenienza per una delle 11/13 tabelle
-- amministrative (elenco e criterio in .programmi/K-ruoli-direzione/esiti/X-2_tabelle.md).
--
-- sys_user_contracts e' una delle quattro tabelle di D6 (contratti, buste paga, documenti
-- d'identita', profili retributivi di posizione): dichiarate "importate, porta non ancora
-- costruita" (D6=A, Enzo). Nessuna interfaccia scrive su questa tabella dal codice, verificato
-- (`grep -rn "INSERT INTO sys.sys_user_contracts" apps/api/src` -> zero riscontri fuori da
-- test). Le righe esistenti sono seminate dal collaudo: DEFAULT 'MATERIALIZZAZIONE', non
-- 'IMPORT' semplice, per dire il vero (la porta reale da Zucchetti/SAP non esiste ancora).
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + guardia CHECK con verifica di esistenza.
-- Rollback dichiarato: NON si DROP la colonna. Una migrazione successiva la rende nullable
-- e la marca "ritirata" nel commento (ADR-0035).

ALTER TABLE sys.sys_user_contracts
  ADD COLUMN IF NOT EXISTS origine_dato varchar(32) NOT NULL DEFAULT 'MATERIALIZZAZIONE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'sys.sys_user_contracts'::regclass
       AND conname  = 'sys_user_contracts_origine_dato_check'
  ) THEN
    ALTER TABLE sys.sys_user_contracts
      ADD CONSTRAINT sys_user_contracts_origine_dato_check
      CHECK (origine_dato IN ('IMPORT', 'NATIVO', 'MATERIALIZZAZIONE'));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_user_contracts.origine_dato IS
  'I23/X-2 (mandato K, mig 000433): IMPORT = scritta da una corsa di importazione da sistema esterno reale; NATIVO = scritta da una rotta API sotto mandato di people management; MATERIALIZZAZIONE = seminata dal collaudo, in attesa della porta reale (D6=A). Oggi tutte le righe sono MATERIALIZZAZIONE: nessuno scrittore di produzione esiste ancora.';

DO $$
DECLARE
  v_righe   integer;
  v_valori  integer;
BEGIN
  SELECT count(*) INTO v_righe FROM sys.sys_user_contracts;
  SELECT count(DISTINCT origine_dato) INTO v_valori FROM sys.sys_user_contracts;
  IF v_valori > 1 THEN
    RAISE EXCEPTION '000433: sys_user_contracts ha % valori distinti di origine_dato, atteso 1 (il default): dire il vero e'' fallito', v_valori;
  END IF;
  RAISE NOTICE '000433 OK — sys_user_contracts: % righe, origine_dato uniforme', v_righe;
END $$;
