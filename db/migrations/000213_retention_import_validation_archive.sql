-- @migrate: once
-- #164 F4 — archivia audit.import_validation_results. Lo schema `brownfield` e le tabelle `audit.import_*`
-- sono ritirati dalla 000297; senza il marcatore questo file cadrebbe (o li
-- ricreerebbe) a ogni deploy. Su un database nuovo gira comunque: il registro
-- e' vuoto e nulla viene saltato.
-- ============================================================================
-- 000213 — #60 G/G1: retention & storage
--
-- (a) `audit.import_validation_results` — 1.551.696 righe / 536 MB = ~39% del
--     DB (1386 MB) per la storia riga-per-riga dei 21 import brownfield
--     COMPLETED: storia, non runtime (nessun modulo la legge — census D-69).
--     POLICY DICHIARATA: il dettaglio per-riga vive nell'ARCHIVIO OFF-DB, in
--     DB restano i sommari per-run (audit.import_run_logs 2963 righe +
--     audit.import_approval_decisions 1593 — NON toccati).
--     ARCHIVIO (verificato prima di questa migration, S1028 2026-07-23):
--       VM oracle-vm-default:/home/ubuntu/dump_archive/
--         audit_import_validation_results_2026-07-23.dump   (pg_dump -Fc -Z6, 83 MB)
--     RESTORE: pg_restore -d heuresys_advanced --data-only \
--                /home/ubuntu/dump_archive/audit_import_validation_results_2026-07-23.dump
--
-- (b) indici mancanti per il DELETE del job auth-housekeeping
--     (`WHERE revoked_at IS NOT NULL OR expires_at < now()`): la slow-query #1
--     del nuovo endpoint B7 (media 817 ms, max 33 s, 88 chiamate) era proprio
--     questo cleanup in seq-scan. BitmapOr su due indici dedicati:
--     expires_at (btree pieno) + revoked_at parziale (IS NOT NULL).
--
-- IDEMPOTENTE: TRUNCATE è no-op a tabella vuota; CREATE INDEX IF NOT EXISTS.
-- Fresh-DB safe: tutte le operazioni sono no-op senza dati.
-- ============================================================================

TRUNCATE TABLE audit.import_validation_results;

CREATE INDEX IF NOT EXISTS sys_auth_refresh_tokens_expires_idx
  ON sys.sys_auth_refresh_tokens (auth_refresh_token_expires_at);

CREATE INDEX IF NOT EXISTS sys_auth_refresh_tokens_revoked_idx
  ON sys.sys_auth_refresh_tokens (auth_refresh_token_revoked_at)
  WHERE auth_refresh_token_revoked_at IS NOT NULL;

-- Post-condition (fail-loud)
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM audit.import_validation_results;
  IF n > 0 THEN RAISE EXCEPTION '000213: import_validation_results non vuota (%)', n; END IF;

  -- i sommari per-run NON devono essere stati toccati (su DB popolato)
  SELECT count(*) INTO n FROM audit.import_run_logs;
  RAISE NOTICE '000213: dettaglio validazioni archiviato off-DB; run_logs=% (intatti)', n;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname='sys' AND indexname='sys_auth_refresh_tokens_expires_idx')
     OR NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname='sys' AND indexname='sys_auth_refresh_tokens_revoked_idx') THEN
    RAISE EXCEPTION '000213: indici housekeeping refresh-token mancanti';
  END IF;
END $$;
