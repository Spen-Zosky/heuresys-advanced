-- 000447_x5_sentinella_della_direzione.sql
-- Mandato K, X-5, passo 65 — la sentinella della direzione. D5=C recepita (X-4).
--
-- Vista sys.v_direzione_del_dato_violata: per ogni tabella classificata (X-1) che ha la
-- colonna origine_dato (X-2), tre criteri diversi secondo lo stato dichiarato:
--   importato -> righe con origine_dato='NATIVO' (un dato che avrebbe dovuto restare
--                importato/materializzato ha ricevuto un gesto applicativo)
--   nativo    -> righe con origine_dato='IMPORT' (un dato che avrebbe dovuto nascere
--                da un gesto applicativo e' stato invece importato)
--   ibrido    -> conflitti APERTI in sys_conflitti_ibridi (X-4) da piu' di 30 giorni
--                (un conflitto registrato e mai risolto da DATA_STEWARD)
--
-- NASCE CON 20 RIGHE, dichiarate qui e non nascoste: sys_leave_balance_transactions e'
-- classificata 'nativo' (X-1, il pattern concettuale atteso), ma X-2 ha verificato sul vivo
-- che le sue 20 righe di oggi sono TUTTE da seed storico (nessun gesto individuale
-- riconoscibile, la stessa storia di I-D §4) e ha impostato DEFAULT='IMPORT' per "dire il
-- vero" — lo stesso principio che il mandato applica a D6. Sono quindi 20 righe storiche
-- note, non 20 violazioni nuove: dichiarata INFORMATIVE in db_health.py, con lo stesso
-- pattern gia' usato per v_registro_provenienza_orfano (S-3). Il giorno in cui una riga
-- IMPORT NUOVA comparisse su questa tabella (un vero futuro scrittore di importazione),
-- sarebbe la 21esima, indistinguibile dalle 20 di oggi in questa vista — la si notera'
-- guardando il conteggio muoversi, non un valore assoluto diverso da zero.
--
-- Idempotente: CREATE OR REPLACE FUNCTION/VIEW. Rollback dichiarato: DROP VIEW + DROP
-- FUNCTION (nessun altro oggetto dipende da questi, verificato con chi_sorveglia.py).

BEGIN;

CREATE OR REPLACE FUNCTION sys.f_direzione_del_dato_violazioni()
RETURNS TABLE (tabella text, stato text, violazioni bigint, dettaglio text)
LANGUAGE plpgsql STABLE AS $$
DECLARE r record; n bigint;
BEGIN
  -- importato / nativo: colonna origine_dato, un valore fuori posto per riga.
  FOR r IN
    SELECT ic.table_name AS t, cl.stato AS s
      FROM information_schema.columns ic
      JOIN sys.sys_classificazione_direzione_dato cl ON cl.tabella = ic.table_name
     WHERE ic.table_schema = 'sys' AND ic.column_name = 'origine_dato'
       AND cl.stato IN ('importato', 'nativo')
     ORDER BY 1
  LOOP
    IF r.s = 'importato' THEN
      EXECUTE format('SELECT count(*) FROM sys.%I WHERE origine_dato = ''NATIVO''', r.t) INTO n;
      tabella := r.t; stato := r.s; violazioni := n;
      dettaglio := 'righe importate/materializzate con un gesto NATIVO (non dovrebbe esisterne)';
    ELSE
      EXECUTE format('SELECT count(*) FROM sys.%I WHERE origine_dato = ''IMPORT''', r.t) INTO n;
      tabella := r.t; stato := r.s; violazioni := n;
      dettaglio := 'righe native scritte invece da un''importazione';
    END IF;
    IF n > 0 THEN RETURN NEXT; END IF;
  END LOOP;

  -- ibrido: conflitti aperti da piu' di 30 giorni, per tabella (X-4).
  FOR r IN
    SELECT conflitto_ibrido_tabella AS t, count(*) AS n
      FROM sys.sys_conflitti_ibridi
     WHERE conflitto_ibrido_stato = 'aperto'
       AND created_at < now() - interval '30 days'
     GROUP BY 1
  LOOP
    tabella := r.t; stato := 'ibrido'; violazioni := r.n;
    dettaglio := 'conflitti ibridi aperti da oltre 30 giorni, mai risolti da DATA_STEWARD';
    RETURN NEXT;
  END LOOP;
END $$;

COMMENT ON FUNCTION sys.f_direzione_del_dato_violazioni() IS
  'X-5 (mandato K, mig 000447): per ogni tabella con origine_dato, le righe la cui direzione contraddice lo stato dichiarato in X-1; per le ibride, i conflitti X-4 aperti da oltre 30 giorni. Sola lettura.';

CREATE OR REPLACE VIEW sys.v_direzione_del_dato_violata AS
SELECT tabella, stato, violazioni, dettaglio
  FROM sys.f_direzione_del_dato_violazioni();

COMMENT ON VIEW sys.v_direzione_del_dato_violata IS
  'X-5 (mandato K, mig 000447): la sentinella dell''invariante I23. Nasce con 20 righe su sys_leave_balance_transactions (stato nativo, ma le 20 righe di oggi sono seed storico dichiarato in X-2 — dire il vero) — INFORMATIVE in db_health.py per lo stesso motivo. Ogni altra riga qui e'' una violazione vera da guardare.';

-- Post-condizione, provata sul caso reale (non simulato): la sentinella vede ESATTAMENTE le
-- 20 righe attese su sys_leave_balance_transactions, nessun'altra violazione altrove.
DO $$
DECLARE
  v_altre  integer;
  v_lbt    integer;
BEGIN
  SELECT violazioni INTO v_lbt FROM sys.v_direzione_del_dato_violata
   WHERE tabella = 'sys_leave_balance_transactions';
  IF v_lbt IS DISTINCT FROM 20 THEN
    RAISE EXCEPTION '000447: sys_leave_balance_transactions ha % violazioni attese, non 20 (il dato reale e'' cambiato: verificare se e'' un vero progresso o un vero regresso)', coalesce(v_lbt::text, '<nessuna riga>');
  END IF;

  SELECT count(*) INTO v_altre FROM sys.v_direzione_del_dato_violata
   WHERE tabella <> 'sys_leave_balance_transactions';
  IF v_altre <> 0 THEN
    RAISE EXCEPTION '000447: % violazioni impreviste fuori da sys_leave_balance_transactions — guardarle, non ignorarle', v_altre;
  END IF;

  RAISE NOTICE '000447 OK — sentinella viva: 20 righe note su sys_leave_balance_transactions, zero altrove';
END $$;

COMMIT;
-- FINE 000447
