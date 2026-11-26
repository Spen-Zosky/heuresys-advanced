-- ============================================================================
-- 000521 — Il giornale vuoto del fattore rimosso esce.
--
-- CHE COSA E': `staging.fattore_rimosso_undo`, creata a mano in produzione il 2026-11-26
-- alle 13:19 UTC, fuori dalla catena, come copia di ritorno del secondo fattore
-- 'derived-access' del 15/09 tolto su richiesta di Enzo. Teneva una riga con il segreto
-- del fattore; quella riga e' gia' stata cancellata, e la tabella e' rimasta vuota.
--
-- PERCHE' SI TOGLIE: decisione di Enzo del 2026-11-26 (sì al DROP della tabella vuota,
-- nel canale del progetto). Era anche l'unica tabella che il ruolo di lettura degli agenti
-- non poteva leggere, e fermava la rigenerazione dell'atlante (PR #527).
--
-- PERCHE' UNA MIGRAZIONE: nessun file della catena la crea, quindi non c'e' una fonte da
-- emendare (ADR-0035); la si toglie una volta sola e la catena, riapplicata a ogni deploy,
-- la trova gia' assente. Su un database nuovo non esiste e il file non fa niente.
--
-- LE QUATTRO COSE (db-migrations.md):
--  (a) misura      — righe e chiavi esterne in entrata, misurate qui al momento del DROP
--  (b) guardia     — se la tabella ha anche una sola riga, o qualcosa la referenzia, si ferma
--  (c) post        — la tabella non c'e' piu' (se il ruolo che applica la catena poteva toglierla)
--  (d) rollback    — non serve un giornale: la tabella e' vuota per guardia, e la sua forma
--                    sta nel backup heuresys_advanced_20261126T131903Z.dump (verificato)
-- ============================================================================

DO $$
DECLARE
  v_righe bigint;
  v_fk    int;
BEGIN
  IF to_regclass('staging.fattore_rimosso_undo') IS NULL THEN
    RAISE NOTICE '000521: staging.fattore_rimosso_undo assente, niente da fare';
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM staging.fattore_rimosso_undo' INTO v_righe;
  IF v_righe <> 0 THEN
    RAISE EXCEPTION '000521: staging.fattore_rimosso_undo ha % righe: non si toglie cosi''', v_righe;
  END IF;

  SELECT count(*) INTO v_fk
    FROM pg_constraint
   WHERE contype = 'f' AND confrelid = 'staging.fattore_rimosso_undo'::regclass;
  IF v_fk <> 0 THEN
    RAISE EXCEPTION '000521: % chiavi esterne puntano a staging.fattore_rimosso_undo', v_fk;
  END IF;

  -- La tabella e' nata a mano: il suo proprietario puo' non essere il ruolo che applica la
  -- catena. In quel caso non si rompe il deploy: si avvisa e la si lascia, vuota.
  IF NOT pg_has_role(current_user,
       (SELECT relowner FROM pg_class WHERE oid = 'staging.fattore_rimosso_undo'::regclass), 'USAGE') THEN
    RAISE WARNING '000521: % non e'' proprietario di staging.fattore_rimosso_undo: resta, vuota', current_user;
    RETURN;
  END IF;

  DROP TABLE staging.fattore_rimosso_undo;
  RAISE NOTICE '000521: staging.fattore_rimosso_undo tolta (0 righe, 0 riferimenti)';
END $$;

DO $$
BEGIN
  IF to_regclass('staging.fattore_rimosso_undo') IS NOT NULL
     AND pg_has_role(current_user,
       (SELECT relowner FROM pg_class WHERE oid = 'staging.fattore_rimosso_undo'::regclass), 'USAGE') THEN
    RAISE EXCEPTION '000521: staging.fattore_rimosso_undo e'' ancora presente';
  END IF;
END $$;
