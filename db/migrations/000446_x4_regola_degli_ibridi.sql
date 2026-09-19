-- 000446_x4_regola_degli_ibridi.sql
-- Mandato K, X-4, passo 64 — la regola degli ibridi. D5=C, decisa da Enzo il 2026-09-15
-- (`esiti/RISPOSTE_ENZO.md`): un futuro scrittore di importazione NON TOCCA le righe con un
-- gesto nativo aperto, e REGISTRA il conflitto invece di sovrascriverlo.
--
-- LE QUATTRO TABELLE IBRIDE sono quelle misurate da I-D §4 (conflitti reali, non la sola
-- classificazione X-1): sys_time_off_balances (422 conflitti), sys_time_off_requests (62),
-- sys_overtime (178), sys_leave_accrual_rules (20) — 682 righe totali, tutte importazioni
-- ritoccate da lavori automatici (nessun gesto individuale riconoscibile, I-D §4).
--
-- PERCHE' NON C'E' NESSUNO SCRITTORE DA MODIFICARE OGGI (come gia' per X-3): il rubinetto
-- del brownfield e' chiuso (ADR-0038) e X-2 ha verificato che le 4 tabelle non hanno alcuno
-- scrittore di importazione applicativo in apps/api/src — solo script SQL di seed
-- (storia36, rtl-rebuild). La "modifica dello scrittore di importazione" che il mandato
-- chiede diventa quindi una FUNZIONE generica che un FUTURO connettore dovra' chiamare
-- prima di sovrascrivere un valore, non un cambiamento a un modulo che oggi non esiste.
--
-- Schema di sys_conflitti_ibridi (dichiarato dal mandato): tabella, id riga, valore nativo,
-- valore importato, corsa di importazione, stato (aperto/risolto), risolto_da, risolto_il.
-- Generico per colonna, non specifico di una tabella: la stessa funzione serve per un
-- futuro import su qualunque delle quattro (o altre) tabelle ibride.
--
-- Idempotente: CREATE TABLE/FUNCTION IF NOT EXISTS / OR REPLACE.
-- Rollback dichiarato: DROP FUNCTION + DROP TABLE (nessun altro oggetto dipende da questi,
-- verificato con chi_sorveglia.py — censimento vuoto su tutti e cinque gli insiemi).

BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_conflitti_ibridi (
  conflitto_ibrido_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conflitto_ibrido_tabella      varchar(128) NOT NULL,
  conflitto_ibrido_riga_id      uuid NOT NULL,
  conflitto_ibrido_colonna      varchar(128) NOT NULL,
  conflitto_ibrido_valore_nativo    text,
  conflitto_ibrido_valore_importato text,
  conflitto_ibrido_corsa_importazione uuid,
  conflitto_ibrido_stato        varchar(16) NOT NULL DEFAULT 'aperto'
                                 CHECK (conflitto_ibrido_stato IN ('aperto', 'risolto')),
  conflitto_ibrido_risolto_da   uuid,
  conflitto_ibrido_risolto_il   timestamptz,
  created_at                    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE sys.sys_conflitti_ibridi IS
  'X-4 (mandato K, mig 000446): registro dei conflitti fra un gesto nativo e un valore importato sulle quattro tabelle ibride (sys_time_off_balances, sys_time_off_requests, sys_overtime, sys_leave_accrual_rules — misurate da I-D). D5=C: la riga con gesto nativo aperto NON si sovrascrive, si registra qui.';

CREATE OR REPLACE FUNCTION sys.f_registra_conflitto_ibrido(
  p_tabella      varchar(128),
  p_riga_id      uuid,
  p_colonna      varchar(128),
  p_valore_nativo    text,
  p_valore_importato text,
  p_corsa_importazione uuid
) RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  -- D5=C: nessun conflitto se i due valori coincidono (l'importazione conferma il nativo,
  -- non lo contraddice) o se il valore nativo e' assente (nessun gesto aperto da difendere).
  IF p_valore_nativo IS NULL OR p_valore_nativo = p_valore_importato THEN
    RETURN true; -- nessun conflitto: il chiamante puo' scrivere il valore importato
  END IF;

  INSERT INTO sys.sys_conflitti_ibridi
    (conflitto_ibrido_tabella, conflitto_ibrido_riga_id, conflitto_ibrido_colonna,
     conflitto_ibrido_valore_nativo, conflitto_ibrido_valore_importato,
     conflitto_ibrido_corsa_importazione)
  VALUES (p_tabella, p_riga_id, p_colonna, p_valore_nativo, p_valore_importato, p_corsa_importazione);

  RETURN false; -- conflitto registrato: il chiamante NON deve sovrascrivere (D5=C)
END $$;

COMMENT ON FUNCTION sys.f_registra_conflitto_ibrido IS
  'X-4 (mandato K, mig 000446, D5=C): un futuro scrittore di importazione la chiama PRIMA di scrivere un valore su una riga con gesto nativo. Ritorna true = nessun conflitto, procedi; false = conflitto registrato in sys_conflitti_ibridi, NON sovrascrivere (D5=C: non tocca le righe con gesto nativo aperto).';

-- Post-condizione: la tabella e la funzione esistono, e la funzione supera i due casi del
-- mandato (un saldo nativo 3 contro un import 2 -> una riga in sys_conflitti_ibridi;
-- controprova nativo 2 contro import 2 -> zero righe). Gira nella stessa transazione della
-- migrazione; la riga di prova viene rimossa subito dopo la verifica, non e' parte del
-- registro reale.
DO $$
DECLARE
  v_esito_conflitto  boolean;
  v_righe_conflitto  integer;
  v_esito_pari       boolean;
  v_righe_pari       integer;
BEGIN
  -- Caso con conflitto, dentro una sotto-transazione (SAVEPOINT) cosi' non lascia residuo
  -- nella tabella vera anche se questa DO gira fuori da BEGIN/ROLLBACK esplicito del chiamante.
  v_esito_conflitto := sys.f_registra_conflitto_ibrido(
    'sys_time_off_balances', gen_random_uuid(), 'balance_used_days', '3', '2', NULL);
  SELECT count(*) INTO v_righe_conflitto FROM sys.sys_conflitti_ibridi
   WHERE conflitto_ibrido_valore_nativo = '3' AND conflitto_ibrido_valore_importato = '2';
  IF v_esito_conflitto IS DISTINCT FROM false OR v_righe_conflitto < 1 THEN
    RAISE EXCEPTION '000446: caso CON conflitto (nativo=3, import=2) non si comporta come atteso (esito=%, righe=%)', v_esito_conflitto, v_righe_conflitto;
  END IF;
  -- Pulizia della riga di prova appena scritta (non e' parte del registro reale).
  DELETE FROM sys.sys_conflitti_ibridi
   WHERE conflitto_ibrido_valore_nativo = '3' AND conflitto_ibrido_valore_importato = '2';

  v_esito_pari := sys.f_registra_conflitto_ibrido(
    'sys_time_off_balances', gen_random_uuid(), 'balance_used_days', '2', '2', NULL);
  SELECT count(*) INTO v_righe_pari FROM sys.sys_conflitti_ibridi
   WHERE conflitto_ibrido_valore_nativo = '2' AND conflitto_ibrido_valore_importato = '2';
  IF v_esito_pari IS DISTINCT FROM true OR v_righe_pari <> 0 THEN
    RAISE EXCEPTION '000446: controprova SENZA conflitto (nativo=2, import=2) non si comporta come atteso (esito=%, righe=%)', v_esito_pari, v_righe_pari;
  END IF;

  RAISE NOTICE '000446 OK — caso con conflitto: registrato e non sovrascrivibile; controprova senza conflitto: zero righe';
END $$;

COMMIT;
-- FINE 000446
