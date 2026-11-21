-- ============================================================================
-- Il ruolo degli agenti — B2 (2026-11-21)
--
-- Gli agenti (sessioni Claude, script, strumenti) scrivono le RIGHE del database
-- con `heuresys_agenti`: SELECT/INSERT/UPDATE/DELETE, e basta. DROP, TRUNCATE,
-- ALTER e CREATE sono rifiutati dal database, per qualunque strada (psql, script,
-- MCP), perche' il ruolo non e' proprietario di nulla e non ha quei privilegi.
-- Le migrazioni restano del proprietario `heuresys` (script di rilascio).
--
-- COME SI APPLICA (serve superuser)
--     sudo -u postgres psql -d heuresys_advanced -f deploy/postgres/ruolo-agenti.sql
-- La password si assegna a parte: deploy/postgres/assegna-password-agenti.sh.
-- IDEMPOTENTE. Nessuna password in questo file.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'heuresys_agenti') THEN
    CREATE ROLE heuresys_agenti NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;

GRANT CONNECT ON DATABASE heuresys_advanced TO heuresys_agenti;
GRANT USAGE ON SCHEMA sys, audit, staging, reference_sync TO heuresys_agenti;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sys, audit, staging, reference_sync TO heuresys_agenti;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sys, audit, staging, reference_sync TO heuresys_agenti;

-- Le tabelle future le crea `heuresys` con la catena delle migrazioni.
ALTER DEFAULT PRIVILEGES FOR ROLE heuresys IN SCHEMA sys, audit, staging, reference_sync
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO heuresys_agenti;
ALTER DEFAULT PRIVILEGES FOR ROLE heuresys IN SCHEMA sys, audit, staging, reference_sync
  GRANT USAGE, SELECT ON SEQUENCES TO heuresys_agenti;

-- Post-condizione: verifica cio' che il ruolo NON deve poter fare.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM information_schema.role_table_grants
   WHERE grantee = 'heuresys_agenti' AND privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER');
  IF n > 0 THEN RAISE EXCEPTION 'ruolo-agenti: % privilegi TRUNCATE/REFERENCES/TRIGGER', n; END IF;

  IF has_schema_privilege('heuresys_agenti', 'sys', 'CREATE')
     OR has_schema_privilege('heuresys_agenti', 'public', 'CREATE')
     OR has_database_privilege('heuresys_agenti', 'heuresys_advanced', 'CREATE') THEN
    RAISE EXCEPTION 'ruolo-agenti: il ruolo puo'' creare oggetti';
  END IF;

  SELECT count(*) INTO n FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
   WHERE r.rolname = 'heuresys_agenti';
  IF n > 0 THEN RAISE EXCEPTION 'ruolo-agenti: il ruolo possiede % oggetti', n; END IF;

  IF (SELECT rolsuper OR rolcreaterole OR rolcreatedb FROM pg_roles WHERE rolname = 'heuresys_agenti') THEN
    RAISE EXCEPTION 'ruolo-agenti: il ruolo ha attributi di amministrazione';
  END IF;

  SELECT count(*) INTO n FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member
   WHERE r.rolname = 'heuresys_agenti';
  IF n > 0 THEN RAISE EXCEPTION 'ruolo-agenti: il ruolo e'' membro di altri ruoli'; END IF;

  RAISE NOTICE 'ruolo-agenti ok — righe si, struttura no';
END $$;
