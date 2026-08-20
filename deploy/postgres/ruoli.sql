-- ============================================================================
-- Le tre identita' del database — #223 F3 (rilievi F5-01, F4-08)
--
-- IL DIFETTO: una sola identita' fa tutto. `heuresys` e' proprietario del
-- database, applica le migrazioni, serve l'API e legge. Un difetto
-- dell'applicazione — una SQL injection, un endpoint che sbaglia — ha percio' a
-- disposizione i privilegi del proprietario: puo' cancellare tabelle, non solo
-- righe.
--
-- LE TRE IDENTITA':
--   `heuresys`      MIGRATOR e proprietario. Resta invariato: applica la catena
--                   (`db/scripts/migrate.sh`, `verify_gate`) e possiede gli
--                   oggetti. Non cambia nulla per chi lavora dal PC.
--   `heuresys_app`  APPLICAZIONE. Legge e scrive le RIGHE, non puo' toccare la
--                   STRUTTURA. E' l'identita' con cui gira l'API in produzione.
--   `heuresys_ro`   SOLA LETTURA. Per interrogare senza rischio di scrivere.
--
-- ⚠ PERCHE' `heuresys_app` DEVE SCRIVERE IN `audit`. I trigger installati da
-- 000339 girano con i privilegi di CHI ESEGUE l'operazione — non ci sono
-- funzioni `SECURITY DEFINER` in questo database, ed e' una disciplina da
-- mantenere. Se l'applicazione non potesse inserire in `audit.catalog_changes`,
-- OGNI modifica a un catalogo fallirebbe. Lo stesso vale per `staging`, dove
-- vivono i giornali di annullamento.
--
-- COME SI APPLICA (serve superuser: `heuresys` non ha CREATEROLE)
--     ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_advanced -f -' < deploy/postgres/ruoli.sql
--
-- ⚠ LE PASSWORD NON STANNO QUI, e non devono comparire in nessun file
-- versionato. Questo script crea i ruoli SENZA password (`NOLOGIN` finche' non
-- ne ricevono una): assegnarla e' un passo separato, fatto sulla macchina, con
-- un valore generato li' e scritto direttamente nel `.env`.
--
-- IDEMPOTENTE: ogni blocco controlla prima se il ruolo c'e'.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'heuresys_app') THEN
    -- NOLOGIN di proposito: un ruolo che puo' collegarsi prima di avere una
    -- password e' una porta aperta in attesa di essere trovata.
    CREATE ROLE heuresys_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'heuresys_ro') THEN
    CREATE ROLE heuresys_ro NOLOGIN;
  END IF;
END $$;

-- Il limite piu' importante, e non e' un privilegio ma la sua ASSENZA: nessuno
-- dei due riceve CREATE su alcuno schema, quindi non puo' creare ne' eliminare
-- oggetti. La struttura resta del solo proprietario.
GRANT CONNECT ON DATABASE heuresys_advanced TO heuresys_app, heuresys_ro;

GRANT USAGE ON SCHEMA sys, audit, staging, reference_sync TO heuresys_app;
GRANT USAGE ON SCHEMA sys, audit                          TO heuresys_ro;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sys, audit, staging, reference_sync TO heuresys_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sys, audit, staging, reference_sync TO heuresys_app;

GRANT SELECT ON ALL TABLES IN SCHEMA sys, audit TO heuresys_ro;

-- Le tabelle FUTURE le creera' `heuresys` applicando la catena: senza questo,
-- ogni migrazione nuova sarebbe invisibile all'applicazione finche' qualcuno non
-- ricorda di concedere a mano. «Finche' qualcuno non ricorda» non e' un
-- meccanismo.
ALTER DEFAULT PRIVILEGES FOR ROLE heuresys IN SCHEMA sys, audit, staging, reference_sync
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO heuresys_app;
ALTER DEFAULT PRIVILEGES FOR ROLE heuresys IN SCHEMA sys, audit, staging, reference_sync
  GRANT USAGE, SELECT ON SEQUENCES TO heuresys_app;
ALTER DEFAULT PRIVILEGES FOR ROLE heuresys IN SCHEMA sys, audit
  GRANT SELECT ON TABLES TO heuresys_ro;

-- Le sei superfici che #220 W1.2 ha chiuso a `codex_auditor` e `gov_worker`
-- restano chiuse anche alla sola lettura: `heuresys_ro` serve a interrogare il
-- business, non a leggere credenziali e buste paga. L'APPLICAZIONE invece deve
-- poterle usare — e' lei che autentica le persone e mostra le buste paga a chi
-- ne ha diritto.
REVOKE ALL ON sys.sys_auth_credentials,
              sys.sys_auth_mfa_recovery_codes,
              sys.sys_auth_password_reset_tokens,
              sys.sys_user_bank_details,
              sys.sys_user_pay_slips,
              sys.v_mfa_secrets_in_cleartext
  FROM heuresys_ro;

-- ---------------------------------------------------------------------------
-- POST-CONDIZIONE. Il terzo controllo e' quello che conta: verifica cio' che i
-- due ruoli NON devono potere. Contare i privilegi concessi non distingue
-- «separazione riuscita» da «ho creato due copie del proprietario».
-- ---------------------------------------------------------------------------
DO $$
DECLARE app_legge int; ro_legge int; app_crea boolean; ro_scrive int;
BEGIN
  SELECT count(*) INTO app_legge FROM information_schema.role_table_grants
   WHERE grantee = 'heuresys_app' AND table_schema = 'sys' AND privilege_type = 'INSERT';
  IF app_legge = 0 THEN
    RAISE EXCEPTION 'ruoli.sql: heuresys_app non puo'' scrivere in sys — l''API non partirebbe';
  END IF;

  SELECT count(*) INTO ro_legge FROM information_schema.role_table_grants
   WHERE grantee = 'heuresys_ro' AND table_schema = 'sys' AND privilege_type = 'SELECT';
  IF ro_legge = 0 THEN
    RAISE EXCEPTION 'ruoli.sql: heuresys_ro non legge nulla';
  END IF;

  -- (a) l'applicazione NON deve poter creare oggetti
  SELECT has_schema_privilege('heuresys_app', 'sys', 'CREATE') INTO app_crea;
  IF app_crea THEN
    RAISE EXCEPTION 'ruoli.sql: heuresys_app puo'' creare oggetti in sys — la separazione e'' nominale';
  END IF;

  -- (b) la sola lettura NON deve poter scrivere
  SELECT count(*) INTO ro_scrive FROM information_schema.role_table_grants
   WHERE grantee = 'heuresys_ro' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
  IF ro_scrive > 0 THEN
    RAISE EXCEPTION 'ruoli.sql: heuresys_ro ha % privilegi di scrittura', ro_scrive;
  END IF;

  RAISE NOTICE 'ruoli.sql ok — heuresys_app scrive le righe ma non crea oggetti; heuresys_ro legge e basta';
END $$;
