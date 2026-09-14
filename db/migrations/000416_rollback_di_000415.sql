--
-- 000416 — Rollback di 000415 (mandato K, F0.4, sezione 3.5): RITIRA la vista di prova.
--
-- Ritirare non e' cancellare (ADR-0035, V5): la vista `sys.v_prova_ripresa_k` NON si DROPpa,
-- si RINOMINA in `sys.v_prova_ripresa_k_ritirata` con un commento che dice chi l'ha ritirata e
-- perche'. 000415 e' consapevole di questo ritiro e non la ricrea al deploy successivo.
--
-- Idempotente: se la vista viva non c'e' piu' e quella ritirata c'e' gia', e' un no-op.
-- Restituisce sempre zero righe (WHERE false in 000415): `db_health.py` la raccoglie come
-- sentinella e resta verde.
--
-- Scritta da Claude Code CLI (S1103, 2026-09-15). Non tocca dati, non tocca permessi.
--
-- Effetto per dove_siamo.py (query consapevole del ritiro, dizionario EFFETTI["K-PROVA"]):
--   select 1 from pg_views where schemaname='sys' and viewname='v_prova_ripresa_k'  -> ASSENTE
--
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'sys' AND viewname = 'v_prova_ripresa_k')
     AND NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'sys' AND viewname = 'v_prova_ripresa_k_ritirata') THEN
    EXECUTE 'ALTER VIEW sys.v_prova_ripresa_k RENAME TO v_prova_ripresa_k_ritirata';
    EXECUTE $c$
      COMMENT ON VIEW sys.v_prova_ripresa_k_ritirata IS
        '000416 — RITIRATA (rollback di 000415, mandato K F0.4): era sys.v_prova_ripresa_k, prova del meccanismo di ripresa. Rinominata, non cancellata (ADR-0035). Zero righe per costruzione.'
    $c$;
    RAISE NOTICE '000416: vista sys.v_prova_ripresa_k ritirata (rinominata in _ritirata)';
  ELSIF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'sys' AND viewname = 'v_prova_ripresa_k_ritirata') THEN
    RAISE NOTICE '000416: ritiro gia'' presente, no-op';
  ELSE
    RAISE EXCEPTION '000416: ne'' la vista viva ne'' quella ritirata esistono: 000415 non e'' stata applicata';
  END IF;
END $$;

-- Post-condizione: la vista viva NON esiste piu', quella ritirata esiste.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'sys' AND viewname = 'v_prova_ripresa_k') THEN
    RAISE EXCEPTION '000416: la vista viva esiste ancora dopo il ritiro';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'sys' AND viewname = 'v_prova_ripresa_k_ritirata') THEN
    RAISE EXCEPTION '000416: la vista ritirata non esiste';
  END IF;
END $$;

COMMIT;
-- FINE 000416
