--
-- 000415 — Prova di ripresa del mandato K (F0.4, sezione 3.5 del mandato): una vista che non serve
--          a nulla, creata apposta per provare che una sessione nuova riconosce «file completo,
--          effetto presente» dopo un'interruzione.
--
-- Scritta da Claude Code CLI (S1102, 2026-09-14). Non tocca dati, non tocca permessi.
-- La vista restituisce ZERO righe per costruzione: ogni `sys.v_*` e' raccolta da `db_health.py`
-- come sentinella e una riga la renderebbe rossa.
--
-- Consapevole del ritiro (ADR-0035): la catena si riapplica intera a ogni deploy. Se 000416 ha
-- gia' ritirato la vista (rinominata in `v_prova_ripresa_k_ritirata`), questo file NON la ricrea:
-- altrimenti ogni deploy la farebbe rinascere e 000416 la rinominerebbe di nuovo su un nome che
-- esiste gia'. Il file che CREA e' il file che sa del ritiro.
--
-- Effetto per dove_siamo.py: select 1 from pg_views where schemaname='sys' and viewname='v_prova_ripresa_k'
--
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'sys' AND viewname = 'v_prova_ripresa_k_ritirata') THEN
    RAISE NOTICE '000415: vista gia'' ritirata da 000416, non la ricreo';
  ELSE
    EXECUTE $v$
      CREATE OR REPLACE VIEW sys.v_prova_ripresa_k AS
        SELECT 'prova di ripresa del mandato K (F0.4)'::text AS nota
         WHERE false
    $v$;
    EXECUTE $c$
      COMMENT ON VIEW sys.v_prova_ripresa_k IS
        '000415 — prova del meccanismo di ripresa del mandato K (F0.4). Zero righe per costruzione. Verra'' ritirata da 000416.'
    $c$;
    RAISE NOTICE '000415: vista sys.v_prova_ripresa_k creata';
  END IF;
END $$;

-- Post-condizione: o la vista viva esiste, o esiste quella ritirata. Mai nessuna delle due.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'sys'
                    AND viewname IN ('v_prova_ripresa_k', 'v_prova_ripresa_k_ritirata')) THEN
    RAISE EXCEPTION '000415: ne'' la vista viva ne'' quella ritirata esistono';
  END IF;
END $$;

COMMIT;
-- FINE 000415
