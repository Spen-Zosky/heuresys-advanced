-- 000450_d12_origine_dato_sys_attendance.sql
-- Mandato K, D12. sys_attendance era l'unica delle 13 tabelle di X-2 (misura_k.py,
-- TABELLE_AMMINISTRATIVE) lasciata ATTESA_ENZO (esiti/X-2_attendance.md): X-2 proponeva
-- DEFAULT 'IMPORT' (mappatura 1:1 su attendance_source='IMPORT', unico valore su tutte le
-- 122.271 righe). X-6 ha poi spiegato il 100% delle 119.226 righe senza provenienza
-- (esiti/X-6.md): tre scrittori vivi, tutti seed/script SQL (db/seeds/storia36/01_attendance_
-- timeoff.sql, db/seeds/storia36/13_avanzamento.sql, db/seeds/rtl-rebuild/07_attendance_
-- topup.sql), nessuno dei quali scrive mai sys.sys_source_lineage_records — rimisurato oggi,
-- esiti/D12.md.
--
-- Decisione di Enzo (RISPOSTE_ENZO.md, 2026-09-24, opzione A di X-6): dichiarare per
-- SCRITTORE, non riga per riga — MATERIALIZZAZIONE senza tracciamento riga-per-riga, non
-- IMPORT semplice. Coerente con D6 (sys_user_contracts/pay_slips/identity_documents/
-- position_compensation_profiles, mig. 000433/000434/000435/000436): dati seminati dal
-- collaudo, nessuna porta applicativa esiste. Qui la porta non solo non esiste ma non è
-- nemmeno prevista come canale futuro imminente (a differenza di sys_overtime/sys_time_off_*
-- in X-2_tabelle.md, che restano IMPORT perché hanno un canale concettualmente reale): le
-- presenze di storia36 sono scenografia di collaudo generata in blocco, esattamente come i
-- quattro D6. Le righe storiche (5.199, registro pre-V5) non si toccano.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + guardia CHECK con verifica di esistenza.
-- Rollback dichiarato: NON si DROP la colonna. Una migrazione successiva la rende nullable
-- e la marca "ritirata" nel commento (ADR-0035).

ALTER TABLE sys.sys_attendance
  ADD COLUMN IF NOT EXISTS origine_dato varchar(32) NOT NULL DEFAULT 'MATERIALIZZAZIONE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'sys.sys_attendance'::regclass
       AND conname  = 'sys_attendance_origine_dato_check'
  ) THEN
    ALTER TABLE sys.sys_attendance
      ADD CONSTRAINT sys_attendance_origine_dato_check
      CHECK (origine_dato IN ('IMPORT', 'NATIVO', 'MATERIALIZZAZIONE'));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_attendance.origine_dato IS
  'I23/D12 (mandato K, mig 000450): MATERIALIZZAZIONE = seminata dal collaudo (storia36/rtl-rebuild), senza tracciamento riga-per-riga nel registro di provenienza — decisione esplicita di Enzo, non una lacuna. NATIVO/IMPORT non usati oggi: nessuno scrittore applicativo, nessun connettore di importazione reale esiste (X-6, D12).';

DO $$
DECLARE
  v_righe   integer;
  v_valori  integer;
BEGIN
  SELECT count(*) INTO v_righe FROM sys.sys_attendance;
  SELECT count(DISTINCT origine_dato) INTO v_valori FROM sys.sys_attendance;
  IF v_valori > 1 THEN
    RAISE EXCEPTION '000450: sys_attendance ha % valori distinti di origine_dato, atteso 1 (il default): dire il vero e'' fallito', v_valori;
  END IF;
  RAISE NOTICE '000450 OK — sys_attendance: % righe, origine_dato uniforme (MATERIALIZZAZIONE)', v_righe;
END $$;

-- FINE 000450
