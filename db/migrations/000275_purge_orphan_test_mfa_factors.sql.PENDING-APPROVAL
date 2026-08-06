-- @migrate: once
-- ============================================================================
-- Migration 000275 — #152: rimuove i 32 fattori MFA lasciati dalle suite
-- ----------------------------------------------------------------------------
-- DISTRUTTIVA. Cancella righe di `sys.sys_auth_mfa_factors` in produzione.
--
-- Cosa rimuove, misurato il 2026-08-06 (S1047):
--   · 26 TOTP **non verificati** di `tommaso.fiore@rtl-bank.org`, lasciati dagli
--     E2E che premevano «annulla» quando annullare non cancellava niente;
--   · 6 WEBAUTHN **verificati** di `admin@heuresys.com`, lasciati dai tentativi
--     falliti di `webauthn.spec.ts`, il cui cleanup era l'ultima riga del test.
-- Entrambe le sorgenti sono chiuse a monte dalla migrazione precedente di
-- questo ciclo (commit c5255c65). Questa toglie solo l'arretrato.
--
-- QUATTRO GUARDIE, perché una DELETE in produzione non si scrive a fiducia:
--
--   §0 `@migrate: once` — gira UNA volta sola. Senza il marcatore, la catena si
--      ri-applica a ogni deploy e questa DELETE diventerebbe una regola
--      permanente «ogni fattore senza etichetta muore», che NON è ciò che si
--      vuole: un fattore senza etichetta creato in futuro da un utente reale
--      sarebbe legittimo. È l'unica migrazione del repo marcata così insieme
--      alla 000273.
--   §1 soglia temporale — tocca solo righe create ENTRO il 2026-08-06. Anche se
--      qualcuno la rieseguisse con MIGRATE_FORCE_ALL=1, non può mangiare nulla
--      di nuovo.
--   §2 solo le righe SENZA etichetta — i 158 fattori `derived-access`, da cui
--      dipende ogni login della suite (Z-262), non sono toccabili.
--   §3 nessuno resta senza secondo fattore — verifica PRIMA di cancellare che
--      ogni utente coinvolto conservi almeno un fattore verificato ed
--      etichettato; se non è vero, solleva e non cancella niente.
--
-- La guardia §3 è scritta per fallire davvero: `NOT EXISTS` su un utente
-- qualsiasi che resterebbe scoperto, non un conteggio complessivo che passerebbe
-- anche se UNA persona restasse senza accesso. Misurato prima di scrivere:
-- entrambi gli utenti conservano 1 fattore verificato (`derived-access`).
--
-- Reversibilità: NON reversibile — le righe cancellate contengono segreti che
-- non sono altrove. È accettabile perché nessuna di esse concede accesso: i 26
-- TOTP non sono mai stati verificati, e i 6 WebAuthn appartengono a cerimonie di
-- test già concluse su un authenticator virtuale che non esiste più. 2026-08-06.
-- ============================================================================

DO $purge$
DECLARE
  v_soglia    CONSTANT timestamptz := '2026-08-07 00:00:00+02';
  v_cancellati integer;
BEGIN
  -- §3 — nessuno deve restare senza secondo fattore.
  IF EXISTS (
    SELECT 1
      FROM (SELECT DISTINCT auth_mfa_factor_user_id AS uid
              FROM sys.sys_auth_mfa_factors
             WHERE auth_mfa_factor_metadata->>'label' IS NULL
               AND created_at < v_soglia) vittime
     WHERE NOT EXISTS (
       SELECT 1 FROM sys.sys_auth_mfa_factors f
        WHERE f.auth_mfa_factor_user_id = vittime.uid
          AND f.auth_mfa_factor_metadata->>'label' IS NOT NULL
          AND f.auth_mfa_factor_verified
     )
  ) THEN
    RAISE EXCEPTION
      '000275 ABORTITA: almeno un utente resterebbe senza alcun fattore MFA verificato. Nessuna riga cancellata.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- §1 + §2 — solo le righe senza etichetta, solo l'arretrato.
  DELETE FROM sys.sys_auth_mfa_factors
   WHERE auth_mfa_factor_metadata->>'label' IS NULL
     AND created_at < v_soglia;

  GET DIAGNOSTICS v_cancellati = ROW_COUNT;
  RAISE NOTICE '000275: rimossi % fattori residui (attesi 32 al 2026-08-06).', v_cancellati;
END
$purge$;
