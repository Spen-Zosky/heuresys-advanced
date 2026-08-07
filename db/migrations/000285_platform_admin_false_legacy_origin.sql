-- ═══════════════════════════════════════════════════════════════════════════════
-- 000285_platform_admin_false_legacy_origin.sql
--
-- #139 (parte inequivocabile) — UN ACCOUNT TECNICO SMETTE DI DICHIARARSI PERSONA
-- IMPORTATA DAL LEGACY.
--
-- `platform.admin@heuresys.com` porta `user_external_code = 'LEGACY_EMP::e1000001-…'`.
-- Per l'invariante **I14** quel prefisso ha un significato preciso e verificabile: «questa
-- riga viene dalla tabella `employees` del legacy», ed e' la chiave con cui si risale alla
-- persona di origine. Per un account tecnico creato dalla piattaforma quel codice
-- **dichiara il falso**: non esiste nessun dipendente `e1000001-0000-0000-0000-000000000001`.
--
-- Non e' cosmetico: qualunque riconciliazione che parta dai codici `LEGACY_EMP::` conta
-- questo account come una persona importata e va a cercarne l'origine dove non c'e'.
--
-- COSA NON FA, E PERCHE' — la misura ha smentito meta' della premessa di #139.
-- La voce chiedeva di tipizzare `SERVICE` **due** account «amministrativi indistinguibili
-- dalle persone». Misurato il 2026-08-07:
--   · `admin@heuresys.com` ha il ruolo **PLATFORM_ADMIN** ed e' l'account con cui accedono
--     gli E2E e 119 file di test. E' l'amministratore **umano** — cioe' esattamente il caso
--     che il `000118` era stato scritto per proteggere («a HUMAN PLATFORM_ADMIN must NOT be
--     exemptable»). Tipizzarlo SERVICE lo dichiarerebbe «non una persona» e toglierebbe di
--     mezzo l'unico soggetto su cui quella regola si prova. NON si tocca.
--   · `platform.admin@heuresys.com` ha **TENANT_ADMIN**, non PLATFORM_ADMIN nonostante il
--     nome. Dichiararlo «non una persona» ha ricadute di autorizzazione (per **I20** un
--     mandato HR apre l'accesso ai dati sensibili di tutto il tenant): e' una decisione di
--     Enzo, non una pulizia, e resta aperta.
-- Qui si corregge solo cio' che e' falso in modo non opinabile.
--
-- L'eleggibilita' all'esenzione MFA e' gia' stata sganciata dal tipo dal `000284`, quindi
-- niente di tutto questo puo' piu' aprire un accesso senza secondo fattore per effetto
-- collaterale.
--
-- Idempotente: agisce solo se il codice falso e' ancora li'.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $mig$
DECLARE
  v_upd bigint;
  v_res text;
BEGIN
  UPDATE sys.sys_users
     SET user_external_code = NULL,
         updated_at = now()
   WHERE user_email = 'platform.admin@heuresys.com'
     AND user_external_code LIKE 'LEGACY\_EMP::%';
  GET DIAGNOSTICS v_upd = ROW_COUNT;

  -- POST-CONDIZIONE: nessun account senza controparte nel legacy puo' continuare a
  -- dichiararsi importato. Si verifica lo STATO, non il numero di righe toccate: alla
  -- seconda esecuzione v_upd e' 0 e dev'essere comunque verde.
  SELECT COALESCE(user_external_code, '(nessuno)') INTO v_res
    FROM sys.sys_users WHERE user_email = 'platform.admin@heuresys.com';
  IF v_res LIKE 'LEGACY\_EMP::%' THEN
    RAISE EXCEPTION '000285: platform.admin dichiara ancora un origine legacy (%)', v_res;
  END IF;

  RAISE NOTICE '000285 done: righe corrette %, origine di platform.admin ora: %', v_upd, v_res;
END $mig$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (ripristina una dichiarazione falsa — solo per emergenza)
-- ═══════════════════════════════════════════════════════════════════════════════
-- BEGIN;
--   UPDATE sys.sys_users
--      SET user_external_code = 'LEGACY_EMP::e1000001-0000-0000-0000-000000000001'
--    WHERE user_email = 'platform.admin@heuresys.com';
-- COMMIT;
