-- db/scripts/verifica-b9-sanatoria-straordinari.sql — B9 (bundle 2026-09-09).
--
-- Decisione di Enzo (2026-09-09): le ore lavorate senza autorizzazione dal 2025-12-12 in poi
-- si sanano, non si archiviano. Sanate 2.436 righe / 2.434,50 ore (126 persone) con
-- overtime_status='APPROVED', overtime_natural_key LIKE 'B9-SANATORIA::%',
-- overtime_requested_at/overtime_date = il giorno in cui le ore sono maturate,
-- overtime_approved_at = il momento della sanatoria. Rollback dichiarato:
-- staging.sanatoria_straordinari_undo (elenco degli overtime_id creati).
--
-- Uso: psql ... -f db/scripts/verifica-b9-sanatoria-straordinari.sql
--   atteso SEMPRE: 0 righe dalla sentinella v_straordinari_non_autorizzati (mig. 000387,
--   corretta 000392). Se il processo di richiesta si ferma di nuovo, questa vista lo dira'.

SELECT count(*) AS ore_non_autorizzate_residue FROM sys.v_straordinari_non_autorizzati;
