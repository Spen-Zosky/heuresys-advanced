-- 000234_drop_attendance_validation.sql
--
-- La validazione delle presenze non fa parte del prodotto (decisione di Enzo,
-- 2026-08-03, register #93).
--
-- Perimetro misurato prima di scrivere questa migrazione (2026-08-03, DB vivo):
--   sys.sys_attendance                        116.639 righe
--   attendance_is_validated = true                  0
--   attendance_validated_at IS NOT NULL             0
--   attendance_validated_by_user_id IS NOT NULL     0
--   citazioni in apps/api, apps/web, packages/shared 0
--   viste dipendenti dalle tre colonne              0
-- Nessun dato viene perso e nessuna riga di applicativo cambia. L'indice
-- parziale sys_attendance_unvalidated_idx era gia' stato rimosso da 000188.
--
-- Deroga consapevole al "nessuna operazione distruttiva" del pattern migrazioni:
-- qui la rimozione E' il deliverable, autorizzata da una decisione esplicita.
-- Il guard sotto la rende sicura anche fuori da questa macchina: se sul clone
-- di VM o linux-pc qualcuno avesse nel frattempo valorizzato la validazione, la
-- migrazione si ferma con un errore parlante invece di cancellare in silenzio.
-- Il guard e' significativo perche' la tabella ha massa reale: su una tabella
-- vuota un conteggio a zero non proverebbe niente.
--
-- La migrazione 000040, che crea le colonne, NON e' stata riscritta: e' storia
-- gia' applicata, e riscriverla romperebbe l'idempotenza dimostrata del set.
-- Un db:reset applica 000040 (crea) e poi questa (rimuove): stato finale corretto.
BEGIN;

DO $$
DECLARE
  v_valorizzate bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'sys' AND table_name = 'sys_attendance'
      AND column_name = 'attendance_is_validated'
  ) THEN
    EXECUTE $q$
      SELECT count(*) FROM sys.sys_attendance
      WHERE attendance_is_validated
         OR attendance_validated_at IS NOT NULL
         OR attendance_validated_by_user_id IS NOT NULL
    $q$ INTO v_valorizzate;

    IF v_valorizzate > 0 THEN
      RAISE EXCEPTION
        'sys_attendance: % righe portano dati di validazione. La rimozione '
        'distruggerebbe dato reale: rivedere la decisione #93 prima di procedere.',
        v_valorizzate;
    END IF;
  END IF;
END $$;

ALTER TABLE sys.sys_attendance
  DROP CONSTRAINT IF EXISTS sys_attendance_validation_coherent,
  DROP CONSTRAINT IF EXISTS sys_attendance_validated_by_fk;

ALTER TABLE sys.sys_attendance
  DROP COLUMN IF EXISTS attendance_is_validated,
  DROP COLUMN IF EXISTS attendance_validated_at,
  DROP COLUMN IF EXISTS attendance_validated_by_user_id;

COMMIT;
