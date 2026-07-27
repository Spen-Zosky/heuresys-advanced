-- ============================================================================
-- storia36 — batteria dei DOSSIER (asse orizzontale della verifica)
-- Registro e metodo: docs/kb/storia36/DOSSIER_REGISTRY.md (questo file è la
-- forma ESEGUIBILE del registro: in caso di divergenza fa fede questo).
--
-- Uso:
--   psql -v ON_ERROR_STOP=1 -f db/scripts/verify-storia36-dossier.sql
--   psql -v ON_ERROR_STOP=1 -v selftest=1 -f ...   (con self-test di falsificabilità)
--
-- Ogni check è un'ASSERZIONE DI PROPRIETÀ ricalcolata dal catalogo di sistema,
-- mai una fotografia. Le sezioni per-dossier vengono riempite dal cluster che
-- tocca il dossier (vedi piano, Task C1..C11).
-- ============================================================================

\set ON_ERROR_STOP on
\if :{?selftest}
\else
\set selftest 0
\endif

-- ----------------------------------------------------------------------------
-- COMPLETEZZA: ogni tabella sys.* appartiene ad ALMENO una famiglia
-- (dossier di business ∪ CATALOGO derivato ∪ allowlist PIATTAFORMA).
-- Una tabella nuova non classificata → ECCEZIONE (registro ROSSO).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_assert_dossier_completeness()
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_unmapped text;
BEGIN
  WITH RECURSIVE fk AS (
    SELECT cr.relname AS child, cf.relname AS parent, na.attname AS col
    FROM pg_constraint co
    JOIN pg_class cr ON cr.oid = co.conrelid
    JOIN pg_namespace nr ON nr.oid = cr.relnamespace
    JOIN pg_class cf ON cf.oid = co.confrelid
    JOIN pg_namespace nf ON nf.oid = cf.relnamespace
    CROSS JOIN LATERAL unnest(co.conkey) AS k(attnum)
    JOIN pg_attribute na ON na.attrelid = cr.oid AND na.attnum = k.attnum
    WHERE co.contype = 'f' AND nr.nspname = 'sys' AND nf.nspname = 'sys'
  ),
  -- edge di business: escluse le colonne audit-actor (lezione I14: l'attore che
  -- SCRIVE una riga non è il soggetto della riga). Tre forme di write-audit:
  -- *_by, *_actor*, e la variante lunga (created|updated|deleted)_by_user_id.
  -- Le colonne-RUOLO (approver, reviewer, validator, performer...) restano
  -- business: fanno parte del record, non del suo audit trail.
  biz AS (
    SELECT DISTINCT child, parent FROM fk
    WHERE col !~ '_by$' AND col !~ '_actor'
      AND col !~ '(created|updated|deleted)_by_user_id$'
  ),
  hubs(hub, dossier) AS (VALUES
    ('sys_tenancies',                 'TENANT'),
    ('sys_users',                     'PERSONA'),
    ('sys_positions',                 'POSIZIONE'),
    ('sys_organization_units',        'UNITA_ORG'),
    ('sys_teams',                     'TEAM'),
    ('sys_blueprint_process_registry','PROCESSO'),
    ('sys_kpi_definitions',           'CASCATA_KPI')
  ),
  reach AS (
    SELECT h.hub COLLATE "C" AS tbl, h.dossier FROM hubs h
    UNION
    SELECT b.child, r.dossier FROM biz b JOIN reach r ON b.parent = r.tbl
  ),
  member AS (SELECT DISTINCT tbl FROM reach),
  -- CATALOGO: reference data referenziata (anche transitivamente) dai membri
  refd AS (
    SELECT b.parent AS tbl FROM biz b WHERE b.child IN (SELECT tbl FROM member)
    UNION
    SELECT b.parent FROM biz b JOIN refd r ON b.child = r.tbl
  ),
  -- PIATTAFORMA: allowlist esplicita e giustificata (il residuo senza FK né
  -- verso né dai dossier). Una riga = una giustificazione. Aggiungere qui
  -- SOLO dopo aver capito perché la derivazione non la cattura.
  allowlist(tbl) AS (VALUES
    ('sys_activity_classification_mappings'),  -- crosswalk fra schemi di classificazione attività (satellite catalogo; popolamento C11)
    ('sys_auth_permissions'),                  -- catalogo permessi RBAC platform-global (I7, enforcement plane)
    ('sys_auth_role_permissions'),             -- mapping ruolo×permesso platform-global (cache RBAC all'avvio API)
    ('sys_esco_occupation_embeddings'),        -- cache embedding (pgvector) del piano occupazioni ESCO
    ('sys_esco_occupation_mappings'),          -- crosswalk ESCO↔job_roles (satellite catalogo; C11)
    ('sys_gdpr_data_map'),                     -- registro governance dati (metadato di piattaforma, non dato tenant)
    ('sys_job_role_embeddings'),               -- cache embedding dei job roles
    ('sys_kpi_weighting_rules'),               -- regole di pesatura KPI platform-global (config, nessuna FK)
    ('sys_leads'),                             -- lead GTM dal canale pubblico (pre-tenant; C11)
    ('sys_occupation_classification_mappings'),-- crosswalk fra schemi occupazione ISCO↔CP2021 (C11)
    ('sys_occupation_classifications'),        -- catalogo classificazioni occupazioni (aggancio ai dati business senza FK diretta)
    ('sys_reconciliation_registry'),           -- registro riconciliazioni (infra)
    ('sys_reference_translations'),            -- i18n dei dati di riferimento (infra piattaforma)
    ('sys_schema_migrations'),                 -- registro migrazioni (infra)
    ('sys_skill_proficiency_levels'),          -- catalogo livelli proficiency: agganciato via varchar+CHECK (RD-08), non FK
    ('sys_translatable_field'),                -- registro campi traducibili (i18n infra)
    ('sys_ui_interfaces')                      -- registro interfacce UI (piattaforma)
  ),
  alltab AS (
    SELECT c.relname AS tbl
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'sys' AND c.relkind = 'r'
  )
  SELECT string_agg(a.tbl, ', ' ORDER BY a.tbl) INTO v_unmapped
  FROM alltab a
  WHERE a.tbl NOT IN (SELECT tbl FROM member)
    AND a.tbl NOT IN (SELECT tbl FROM refd)
    AND a.tbl NOT IN (SELECT al.tbl COLLATE "C" FROM allowlist al);

  IF v_unmapped IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = format('DOSSIER completezza VIOLATA — tabelle sys.* non mappate in alcuna famiglia: %s', v_unmapped),
      HINT = 'Capire a quale dossier/famiglia appartengono (derivazione in docs/kb/storia36/DOSSIER_REGISTRY.md), MAI zittire.';
  END IF;
END;
$fn$;

SELECT staging.storia36_assert_dossier_completeness();
\echo '[OK] dossier: completezza 206-tabelle (membri ∪ CATALOGO ∪ allowlist)'

-- ============================================================================
-- Batterie per-dossier (riempite dal cluster che tocca il dossier)
-- ============================================================================

-- === PERSONA ====================================================
-- (C1+: la batteria per-persona 162/162 vive in verify-storia36-person.sql;
--  qui entrano le asserzioni aggregate del dossier persona)

-- === PROCESSO ===================================================
-- (C7: OU responsabili esistenti e correnti · ruoli assegnati a utenti ATTIVI ·
--  owner in una OU responsabile · KPI template → requisiti posizioni)

-- === UNITA_ORG ==================================================
-- (C6: manager definito · posizioni afferenti con titolare o vacancy dichiarata ·
--  history continua senza periodi scoperti)

-- === POSIZIONE ==================================================
-- (C5: requisiti skill/KPI/learning · comp profile · incumbent · riporto ·
--  rilevanza successoria · PIP coerente con le sorgenti)

-- === TEAM =======================================================
-- (C1+: lead singolo in sync con membership · membri = utenti attivi ·
--  derivazione da OU)

-- === CASCATA_KPI ================================================
-- (C7: definizione → template processo/OU → requisito posizione → target utente
--  → misurazioni, coerenti a ogni gradino)

-- === TENANT =====================================================
-- (trasversale: ogni riga di ogni dossier dentro il perimetro I5; unica
--  esclusione motivata: sys_blueprint_process_registry, registro globale)

-- ============================================================================
-- SELFTEST (eseguito con -v selftest=1): la falsificabilità del check.
-- Inietta una tabella orfana in transazione → il check DEVE scattare → cleanup.
-- Un check mai visto fallire non prova nulla.
-- ============================================================================
\if :selftest
DO $$
DECLARE
  v_scattato boolean := false;
BEGIN
  EXECUTE 'CREATE TABLE sys.zzz_storia36_selftest_orphan(x int)';
  BEGIN
    PERFORM staging.storia36_assert_dossier_completeness();
  EXCEPTION WHEN OTHERS THEN
    v_scattato := true;
  END;
  EXECUTE 'DROP TABLE sys.zzz_storia36_selftest_orphan';
  IF NOT v_scattato THEN
    RAISE EXCEPTION 'SELFTEST FALLITO: il check di completezza dossier NON è scattato sulla tabella orfana iniettata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST dossier-completezza: violazione iniettata rilevata e ripulita';
END $$;
\endif
