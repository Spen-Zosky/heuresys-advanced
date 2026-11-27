-- ============================================================================================
-- 000525 — Il vocabolario dei cluster della storia di RTL arriva a C15 (piano AI-driven, voce F3c).
--
-- PERCHÉ UNA MIGRAZIONE. `staging.storia36_runs` nasce dal seed `db/seeds/storia36/00_foundation.sql`,
-- che dalla #556 allarga da sé il vincolo a C15. In produzione però il DDL passa solo da migrazione e
-- rilascio: il seed degli ex dipendenti (`15_uscite.sql`, cluster C15) gira come ruolo degli agenti e
-- non può cambiare un vincolo. Questa migrazione porta il vincolo alla stessa forma del seed, così
-- seed e catena dicono la stessa cosa e nessuno dei due riporta l'altro indietro.
--
-- COSA FA: se la tabella c'è e il vincolo non ha ancora la forma `1[0-5]`, lo ricrea con
-- `^(C([0-9]|1[0-5])|ADV)$`. Su un database senza storia (CI, copia nuova) non fa niente.
-- IDEMPOTENTE. NESSUNA CANCELLAZIONE DI DATI: le righe esistenti (C0-C13, ADV) restano valide.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF to_regclass('staging.storia36_runs') IS NULL THEN
    RAISE NOTICE '000525: staging.storia36_runs non c''è (database senza storia), niente da fare';
    RETURN;
  END IF;
  -- Un vincolo si cambia solo da chi possiede la tabella: se la catena gira con un altro ruolo lo
  -- dice e non ferma il rilascio; il seed C15, rifiutato dal vincolo, lo renderà visibile.
  IF NOT EXISTS (SELECT 1 FROM pg_class c
                  WHERE c.oid = 'staging.storia36_runs'::regclass
                    AND pg_has_role(current_user, c.relowner, 'MEMBER')) THEN
    RAISE WARNING '000525: % non possiede staging.storia36_runs, vincolo lasciato com''era', current_user;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conname = 'storia36_runs_cluster_code_check'
                AND conrelid = 'staging.storia36_runs'::regclass
                AND pg_get_constraintdef(oid) ~ '1\[0-5\]') THEN
    RETURN;
  END IF;
  ALTER TABLE staging.storia36_runs DROP CONSTRAINT IF EXISTS storia36_runs_cluster_code_check;
  ALTER TABLE staging.storia36_runs ADD CONSTRAINT storia36_runs_cluster_code_check
    CHECK (cluster_code ~ '^(C([0-9]|1[0-5])|ADV)$');
  RAISE NOTICE '000525: vocabolario cluster_code esteso a C15 (ex dipendenti) e ADV';
END $$;

COMMIT;
