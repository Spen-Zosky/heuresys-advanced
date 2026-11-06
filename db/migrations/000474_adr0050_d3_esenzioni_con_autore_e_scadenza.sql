-- 000474_adr0050_d3_esenzioni_con_autore_e_scadenza.sql
-- ADR-0050 D3 (2026-11-05): un'esenzione dal secondo fattore ha un autore e una scadenza.
--
-- 1. Colonna `auth_mfa_exemption_expires_at` (timestamptz, NOT NULL). Le righe che esistono
--    ricevono `created_at + 30 giorni`: è il massimo che D3 concede, contato dalla nascita.
--    Quasi tutte risultano quindi già scadute, e valgono come assenti. Le utenze di collaudo
--    le rinnova `pnpm db:provision-collaudo`, che in CI gira dopo le migrazioni.
-- 2. Trigger `sys_auth_mfa_exemptions_autore_e_scadenza` (BEFORE INSERT OR UPDATE). Quando
--    un'esenzione si accende o si rinnova (nasce attiva, passa da spenta ad attiva, oppure
--    cambia la scadenza mentre è attiva), pretende:
--    - una scadenza nel futuro e al massimo fra 30 giorni;
--    - un autore (`created_by`) che sia una persona: utenza STANDARD, ACTIVE, diversa
--      dall'utenza esentata. Un account di servizio non si esenta da solo.
--    Spegnere un'esenzione resta sempre permesso, anche sulle righe vecchie senza autore:
--    chiudere una porta non chiede la firma di nessuno.
-- 3. Sentinella `sys.v_esenzione_mfa_scaduta_o_senza_autore`: le esenzioni ATTIVE scadute
--    oppure senza autore. Pretende zero. Una scaduta non apre niente (il login la ignora,
--    `isUserMfaExempt`), ma un'esenzione accesa e scaduta è una porta da chiudere o da
--    rinnovare con un atto, non da dimenticare.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS, backfill solo sulle righe senza scadenza,
-- CREATE OR REPLACE, trigger creato solo se manca.
-- Rollback dichiarato: DROP TRIGGER, DROP FUNCTION, DROP VIEW, DROP COLUMN. Nessun dato di
-- business cambia: la colonna è nuova e il backfill tocca solo lei.

BEGIN;

ALTER TABLE sys.sys_auth_mfa_exemptions
  ADD COLUMN IF NOT EXISTS auth_mfa_exemption_expires_at timestamptz;

-- Il backfill tocca solo la colonna nuova. Il trigger di eleggibilità (000117/000473) si
-- spegne per questa sola istruzione: rifiuterebbe una riga vecchia accesa per chi porta un
-- mandato (coppia che la 000473 conta e non tocca), e qui non si concede niente.
DO $bf$
BEGIN
  IF EXISTS (SELECT 1 FROM sys.sys_auth_mfa_exemptions WHERE auth_mfa_exemption_expires_at IS NULL) THEN
    ALTER TABLE sys.sys_auth_mfa_exemptions DISABLE TRIGGER sys_auth_mfa_exemptions_eligibility;
    UPDATE sys.sys_auth_mfa_exemptions
       SET auth_mfa_exemption_expires_at = created_at + interval '30 days'
     WHERE auth_mfa_exemption_expires_at IS NULL;
    ALTER TABLE sys.sys_auth_mfa_exemptions ENABLE TRIGGER sys_auth_mfa_exemptions_eligibility;
  END IF;
END;
$bf$;

ALTER TABLE sys.sys_auth_mfa_exemptions
  ALTER COLUMN auth_mfa_exemption_expires_at SET NOT NULL;

COMMENT ON COLUMN sys.sys_auth_mfa_exemptions.auth_mfa_exemption_expires_at IS
  'ADR-0050 D3 (mig 000474): oltre questo istante l''esenzione vale come assente. Al massimo 30 giorni dall''accensione o dal rinnovo.';

CREATE OR REPLACE FUNCTION sys.f_esenzione_mfa_autore_e_scadenza()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NOT NEW.auth_mfa_exemption_enabled THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.auth_mfa_exemption_enabled
     AND NEW.auth_mfa_exemption_expires_at IS NOT DISTINCT FROM OLD.auth_mfa_exemption_expires_at
     AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by THEN
    RETURN NEW;
  END IF;

  IF NEW.auth_mfa_exemption_expires_at IS NULL
     OR NEW.auth_mfa_exemption_expires_at <= now()
     OR NEW.auth_mfa_exemption_expires_at > now() + interval '30 days' THEN
    RAISE EXCEPTION
      'MFA exemption refused: expires_at must be in the future and within 30 days (ADR-0050 D3), got %',
      NEW.auth_mfa_exemption_expires_at
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.created_by IS NULL
     OR NEW.created_by = NEW.auth_mfa_exemption_user_id
     OR NOT EXISTS (
       SELECT 1 FROM sys.sys_users u
        WHERE u.user_id = NEW.created_by
          AND u.user_type = 'STANDARD'
          AND u.user_status = 'ACTIVE') THEN
    RAISE EXCEPTION
      'MFA exemption refused: created_by must be an active person (STANDARD) other than the exempted user (ADR-0050 D3)'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

DO $tr$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'sys_auth_mfa_exemptions_autore_e_scadenza'
       AND tgrelid = 'sys.sys_auth_mfa_exemptions'::regclass
  ) THEN
    CREATE TRIGGER sys_auth_mfa_exemptions_autore_e_scadenza
      BEFORE INSERT OR UPDATE ON sys.sys_auth_mfa_exemptions
      FOR EACH ROW EXECUTE FUNCTION sys.f_esenzione_mfa_autore_e_scadenza();
  END IF;
END;
$tr$;

CREATE OR REPLACE VIEW sys.v_esenzione_mfa_scaduta_o_senza_autore AS
SELECT x.auth_mfa_exemption_user_id AS utente,
       CASE
         WHEN x.auth_mfa_exemption_expires_at <= now() AND x.created_by IS NULL THEN 'scaduta e senza autore'
         WHEN x.auth_mfa_exemption_expires_at <= now() THEN 'scaduta'
         ELSE 'senza autore'
       END AS dettaglio,
       x.auth_mfa_exemption_expires_at AS scadenza
  FROM sys.sys_auth_mfa_exemptions x
 WHERE x.auth_mfa_exemption_enabled
   AND (x.auth_mfa_exemption_expires_at <= now() OR x.created_by IS NULL);

COMMENT ON VIEW sys.v_esenzione_mfa_scaduta_o_senza_autore IS
  'ADR-0050 D3 (mig 000474): esenzioni MFA accese ma scadute o senza autore. Pretende zero. Sola lettura.';

COMMIT;
