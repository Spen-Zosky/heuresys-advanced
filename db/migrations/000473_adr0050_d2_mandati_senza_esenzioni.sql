-- 000473_adr0050_d2_mandati_senza_esenzioni.sql
-- ADR-0050 D1 e D2 (accettato da Enzo il 2026-11-03): il secondo fattore è obbligatorio, senza
-- esenzioni, per chi porta un mandato forte.
--
-- §1 sys.f_ruoli_mandato(): l'insieme D1 in SQL. È la copia di MANDATE_ROLES
--    (apps/api/src/lib/scope/mandati.ts), e una prova d'integrazione pretende che le due
--    coincidano: chi aggiunge un mandato in un posto e non nell'altro vede la prova rossa.
-- §2 l'eleggibilità all'esenzione (000117, 000118, 000284) aggiunge una terza condizione:
--    l'utenza non porta alcun mandato attivo. Il corpo ripete quello di 000284 e aggiunge il
--    terzo lucchetto; la catena delle migrazioni si riapplica in ordine, quindi vince questo.
-- §3 il verso opposto: concedere un mandato a un'utenza con un'esenzione attiva fallisce.
--
-- Il codice di login fa la sua parte (modules/auth/service.ts): un'esenzione non vale per chi
-- porta un mandato, e chi porta un mandato senza fattore riceve la sessione di sola iscrizione
-- anche senza una politica del tenant.
--
-- Idempotente: CREATE OR REPLACE e trigger creati solo se mancano. Non tocca righe: se oggi
-- esistesse un'utenza esente con un mandato, lo dice in un NOTICE e la lascia com'è (il login
-- già ignora quell'esenzione). Rollback dichiarato: ripristinare il corpo di 000284, togliere il
-- trigger di §3, la sua funzione e sys.f_ruoli_mandato().

BEGIN;

-- §1
CREATE OR REPLACE FUNCTION sys.f_ruoli_mandato()
RETURNS SETOF text
LANGUAGE sql IMMUTABLE AS $$
  VALUES ('TENANT_ADMIN'), ('HRMS_MANAGER'), ('PEOPLE_MANAGER'), ('DPO'),
         ('PLATFORM_ADMIN'), ('SECURITY_ADMIN'), ('WHISTLEBLOWING_CUSTODIAN')
$$;

COMMENT ON FUNCTION sys.f_ruoli_mandato() IS
  'ADR-0050 D1 (mig 000473): i mandati forti. Copia di MANDATE_ROLES in lib/scope/mandati.ts; la parità la verifica adr0050-mandati.integration.test.ts.';

-- §2
CREATE OR REPLACE FUNCTION sys.sys_auth_mfa_exemption_eligibility()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sys.sys_users u
     WHERE u.user_id = NEW.auth_mfa_exemption_user_id
       AND u.user_type = 'SERVICE'
  ) THEN
    RAISE EXCEPTION
      'MFA exemption allowed ONLY for SERVICE accounts (user_type=SERVICE); user % is not a service account (M-8b)',
      NEW.auth_mfa_exemption_user_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM sys.sys_auth_mfa_exemption_eligible_users e
     WHERE e.auth_mfa_eligible_user_id = NEW.auth_mfa_exemption_user_id
  ) THEN
    RAISE EXCEPTION
      'MFA exemption requires an explicit entry in sys_auth_mfa_exemption_eligible_users; user % is not listed (#139)',
      NEW.auth_mfa_exemption_user_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- ADR-0050 D2: il terzo lucchetto. Un'esenzione attiva per chi porta un mandato forte non
  -- nasce. Una disattivata (enabled = false) sì: non apre niente.
  IF NEW.auth_mfa_exemption_enabled AND EXISTS (
    SELECT 1
      FROM sys.sys_user_auth_roles ur
      JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
     WHERE ur.user_auth_role_user_id = NEW.auth_mfa_exemption_user_id
       AND ur.user_auth_role_revoked_at IS NULL
       AND r.auth_role_code IN (SELECT sys.f_ruoli_mandato())
  ) THEN
    RAISE EXCEPTION
      'MFA exemption refused: user % holds a mandate role (ADR-0050 D2)',
      NEW.auth_mfa_exemption_user_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

-- §3
CREATE OR REPLACE FUNCTION sys.f_mandato_senza_esenzione()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.user_auth_role_revoked_at IS NULL
     AND EXISTS (
       SELECT 1 FROM sys.sys_auth_roles r
        WHERE r.auth_role_id = NEW.user_auth_role_role_id
          AND r.auth_role_code IN (SELECT sys.f_ruoli_mandato()))
     AND EXISTS (
       SELECT 1 FROM sys.sys_auth_mfa_exemptions x
        WHERE x.auth_mfa_exemption_user_id = NEW.user_auth_role_user_id
          AND x.auth_mfa_exemption_enabled)
  THEN
    RAISE EXCEPTION
      'mandate role refused: user % has an active MFA exemption (ADR-0050 D2)',
      NEW.user_auth_role_user_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

DO $tr$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_auth_roles_mandato_senza_esenzione') THEN
    CREATE TRIGGER sys_user_auth_roles_mandato_senza_esenzione
      BEFORE INSERT OR UPDATE ON sys.sys_user_auth_roles
      FOR EACH ROW EXECUTE FUNCTION sys.f_mandato_senza_esenzione();
  END IF;
END;
$tr$;

-- La misura, senza toccare niente: utenze esenti che oggi portano un mandato.
DO $mis$
DECLARE n bigint;
BEGIN
  SELECT count(DISTINCT x.auth_mfa_exemption_user_id) INTO n
    FROM sys.sys_auth_mfa_exemptions x
    JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = x.auth_mfa_exemption_user_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
   WHERE x.auth_mfa_exemption_enabled
     AND ur.user_auth_role_revoked_at IS NULL
     AND r.auth_role_code IN (SELECT sys.f_ruoli_mandato());
  IF n > 0 THEN
    RAISE NOTICE '000473: % utenze esenti portano un mandato: il login ignora la loro esenzione (ADR-0050 D2)', n;
  END IF;
END;
$mis$;

COMMIT;
