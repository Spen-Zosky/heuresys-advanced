--
-- 000419 — S-3 (mandato K, F2): la sentinella degli ORFANI del registro di provenienza.
--
-- PERCHE'. `sys.sys_source_lineage_records` dice da dove viene ogni riga importata. In 11 tabelle il
-- registro ha PIU' righe della tabella stessa (misurato I-D, 2026-09-15: 15.054 orfani, da sys_skills
-- 19.764/14.031 a sys_leave_balance_transactions 24/20): righe importate e poi cancellate, di cui il
-- registro conserva la memoria senza piu' il bersaglio. Non e' un difetto da correggere qui (X-6 li
-- spiega, V5 vieta di riscrivere il registro): e' uno stato da TENERE SOTT'OCCHIO. La vista NASCE
-- ROSSA (11 righe) ed e' dichiarata INFORMATIVE in db_health.py con motivo «orfani noti, da spiegare
-- in X-6»; quando X-6 li avra' spiegati si toglie da INFORMATIVE e deve stare a zero.
--
-- Il registro usa DUE grafie per il nome della tabella (con e senza prefisso `sys.`: 6.382 / 64.577
-- righe, nessuna tabella in entrambe): la vista normalizza con replace(...,'sys.','') come I-D.
-- Le righe reali si contano tabella per tabella con una funzione (un conteggio dinamico non sta in
-- una vista semplice); la funzione e' STABLE e in sola lettura.
--
-- Due definizioni di «orfano», entrambe esposte:
--   orfani_totale   = max(0, righe_registro - righe_reali)            (quella del dossier: la vista filtra su questa)
--   orfani_per_riga = righe di registro il cui target_record_id NON trova la riga bersaglio (piu' vera: X-6 la usa)
--
-- Scritta da Claude Code CLI (S1103, 2026-09-15). Effetto per dove_siamo.py:
--   select 1 from pg_views where schemaname='sys' and viewname='v_registro_provenienza_orfano'
--
BEGIN;

CREATE OR REPLACE FUNCTION sys.f_registro_provenienza_orfani()
RETURNS TABLE (tabella text, nel_registro bigint, righe_reali bigint, orfani_totale bigint, orfani_per_riga bigint)
LANGUAGE plpgsql STABLE AS $$
DECLARE r record; pk text; n_reali bigint; n_mancanti bigint;
BEGIN
  FOR r IN
    SELECT replace(l.source_lineage_target_table_name, 'sys.', '') AS t, count(*) AS n
      FROM sys.sys_source_lineage_records l
     GROUP BY 1 ORDER BY 1
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sys' AND table_name = r.t) THEN
      tabella := r.t; nel_registro := r.n; righe_reali := 0; orfani_totale := r.n; orfani_per_riga := r.n;
      RETURN NEXT; CONTINUE;
    END IF;
    SELECT column_name INTO pk FROM information_schema.columns
     WHERE table_schema = 'sys' AND table_name = r.t AND ordinal_position = 1;
    EXECUTE format('SELECT count(*) FROM sys.%I', r.t) INTO n_reali;
    EXECUTE format(
      'SELECT count(*) FROM sys.sys_source_lineage_records l
        WHERE replace(l.source_lineage_target_table_name, ''sys.'', '''') = %L
          AND NOT EXISTS (SELECT 1 FROM sys.%I x WHERE x.%I::text = l.source_lineage_target_record_id::text)',
      r.t, r.t, pk) INTO n_mancanti;
    tabella := r.t; nel_registro := r.n; righe_reali := n_reali;
    orfani_totale := GREATEST(0, r.n - n_reali); orfani_per_riga := n_mancanti;
    RETURN NEXT;
  END LOOP;
END $$;
COMMENT ON FUNCTION sys.f_registro_provenienza_orfani() IS
  '000419 (mandato K, S-3) — per tabella normalizzata del registro di provenienza: righe di registro, righe reali, orfani per totale e per riga. Sola lettura.';

CREATE OR REPLACE VIEW sys.v_registro_provenienza_orfano AS
SELECT tabella, nel_registro, righe_reali, orfani_totale, orfani_per_riga
  FROM sys.f_registro_provenienza_orfani()
 WHERE orfani_totale > 0;
COMMENT ON VIEW sys.v_registro_provenienza_orfano IS
  '000419 (mandato K, S-3) — tabelle in cui il registro di provenienza ha PIU'' righe della tabella (orfani). Nasce ROSSA (11 tabelle, 15.054 orfani il 2026-09-15) ed e'' INFORMATIVE in db_health.py finche'' X-6 non spiega gli orfani; poi deve stare a zero.';

-- Post-condizione: la vista risponde, e la tabella con piu' orfani per totale e' sys_skills (misura I-D).
DO $$
DECLARE prima text;
BEGIN
  SELECT tabella INTO prima FROM sys.v_registro_provenienza_orfano ORDER BY orfani_totale DESC LIMIT 1;
  IF prima IS DISTINCT FROM 'sys_skills' THEN
    RAISE NOTICE '000419: la tabella con piu'' orfani e'' % (attesa sys_skills il 2026-09-15: il dato e'' cambiato, non e'' un errore)', prima;
  END IF;
END $$;

COMMIT;
-- FINE 000419
