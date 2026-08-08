-- @migrate: once
-- #164 F4 — altera audit.import_validation_results. Lo schema `brownfield` e le tabelle `audit.import_*`
-- sono ritirati dalla 000297; senza il marcatore questo file cadrebbe (o li
-- ricreerebbe) a ogni deploy. Su un database nuovo gira comunque: il registro
-- e' vuoto e nulla viene saltato.
-- ============================================================================
-- Migration 000188 — Forense F2 (mandato S1023, census db-forensics S1024):
-- igiene DB misurata sul campo. Fonte: docs/kb/db-forensics/F2_DB_CENSUS_2026-07-21.md
--
-- Contenuto (tutto misurato, niente a tappeto):
--  A. Indice lookup lineage (F2.7 §4.1 — l'unico problema di performance REALE:
--     280.010 seq_scan / 10,9 miliardi di tuple lette dalla risoluzione
--     LOOKUP_FK per-riga in brownfield-wave-executor/transform-compiler.ts:468;
--     EXPLAIN confermava Seq Scan, nessun indice usabile).
--  B. 3 FK genuinamente mancanti, tutte a 0 orfani → FK PIENE, niente
--     NOT VALID (F2.3): goal_templates.role/org_unit (nullable, SET NULL) e
--     mfa_exemption_audit.user_id (audit trail → RESTRICT implicito NO ACTION).
--  C. Normalizzazione enum di fatto fuori convenzione (F2.2 check 4):
--     user_employment_status / user_contract_status = 'active' minuscolo
--     (161+158 righe, passthrough legacy wave-import, engine oggi FROZEN D-11)
--     → MAIUSCOLO + CHECK (RD-08). Nessun filtro runtime dipendeva dal
--     minuscolo (verificato: il codice fa solo SELECT del valore).
--  D. Offboarding integrity (F2.2 check 8a): 3 utenti DEACTIVATED con
--     assignment ancora ACTIVE → chiusura (ENDED + end_date) con regola
--     generica idempotente + vista di monitoraggio permanente.
--  E. Drop 5 indici morti (idx_scan=0 sull'intera vita del cluster,
--     stats_reset NULL → segnale forte; ~12 MB recuperati). Gli indici
--     feature-backing senza traffico (HNSW, trigram, FTS) NON si toccano.
--  F. Autovacuum per-tabella sulle 2 tabelle grandi append-only (soglia
--     default 0.2 = ~310k dead su import_validation_results prima del trigger).
--
-- Idempotente + twice-run safe: IF NOT EXISTS / DROP IF EXISTS / UPDATE con
-- WHERE che al secondo giro matcha 0 righe / reloptions assolute.
-- Post-conditions in coda (RAISE EXCEPTION se lo stato atteso non regge).
-- Authored: 2026-07-21 (S1024).
-- ============================================================================

-- --------------------------------------------------------------------------
-- A. Indice lookup lineage (composito + INCLUDE per index-only scan)
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS sys_source_lineage_records_srcrec_target_idx
  ON sys.sys_source_lineage_records
     (source_lineage_source_record_id, source_lineage_target_table_name)
  INCLUDE (source_lineage_target_record_id);

-- --------------------------------------------------------------------------
-- B. FK mancanti (0 orfani misurati → FULL, non NOT VALID)
-- --------------------------------------------------------------------------
ALTER TABLE sys.sys_goal_templates
  DROP CONSTRAINT IF EXISTS sys_goal_templates_role_fk;
ALTER TABLE sys.sys_goal_templates
  ADD CONSTRAINT sys_goal_templates_role_fk
  FOREIGN KEY (template_role_id) REFERENCES sys.sys_job_roles (job_role_id)
  ON DELETE SET NULL;

ALTER TABLE sys.sys_goal_templates
  DROP CONSTRAINT IF EXISTS sys_goal_templates_org_unit_fk;
ALTER TABLE sys.sys_goal_templates
  ADD CONSTRAINT sys_goal_templates_org_unit_fk
  FOREIGN KEY (template_org_unit_id) REFERENCES sys.sys_organization_units (organization_unit_id)
  ON DELETE SET NULL;

-- Audit trail di sicurezza: il soggetto non deve mai diventare dangling né
-- essere cancellato silenziosamente insieme all'utente (NO ACTION di default).
ALTER TABLE sys.sys_auth_mfa_exemption_audit
  DROP CONSTRAINT IF EXISTS sys_auth_mfa_exemption_audit_user_fk;
ALTER TABLE sys.sys_auth_mfa_exemption_audit
  ADD CONSTRAINT sys_auth_mfa_exemption_audit_user_fk
  FOREIGN KEY (auth_mfa_exemption_audit_user_id) REFERENCES sys.sys_users (user_id);

-- --------------------------------------------------------------------------
-- C. Normalizzazione status employment/contracts + CHECK (RD-08)
-- --------------------------------------------------------------------------
UPDATE sys.sys_user_employment
   SET user_employment_status = UPPER(user_employment_status)
 WHERE user_employment_status <> UPPER(user_employment_status);

UPDATE sys.sys_user_contracts
   SET user_contract_status = UPPER(user_contract_status)
 WHERE user_contract_status <> UPPER(user_contract_status);

ALTER TABLE sys.sys_user_employment
  DROP CONSTRAINT IF EXISTS sys_user_employment_status_check;
ALTER TABLE sys.sys_user_employment
  ADD CONSTRAINT sys_user_employment_status_check
  CHECK (user_employment_status IN ('ACTIVE', 'SUSPENDED', 'TERMINATED'));

ALTER TABLE sys.sys_user_contracts
  DROP CONSTRAINT IF EXISTS sys_user_contracts_status_check;
ALTER TABLE sys.sys_user_contracts
  ADD CONSTRAINT sys_user_contracts_status_check
  CHECK (user_contract_status IN ('ACTIVE', 'EXPIRED', 'TERMINATED'));

-- --------------------------------------------------------------------------
-- D. Offboarding integrity: chiudi gli assignment di utenti DEACTIVATED
-- --------------------------------------------------------------------------
UPDATE sys.sys_user_position_assignments upa
   SET user_position_assignment_status   = 'ENDED',
       user_position_assignment_end_date = COALESCE(upa.user_position_assignment_end_date, CURRENT_DATE)
  FROM sys.sys_users u
 WHERE u.user_id = upa.user_position_assignment_user_id
   AND u.user_status = 'DEACTIVATED'
   AND upa.user_position_assignment_status = 'ACTIVE';

-- Vista di monitoraggio permanente (0 righe = invariante rispettata).
CREATE OR REPLACE VIEW sys.v_deactivated_user_active_assignment AS
SELECT u.user_id,
       u.user_email,
       upa.user_position_assignment_id,
       upa.user_position_assignment_position_id
  FROM sys.sys_users u
  JOIN sys.sys_user_position_assignments upa
    ON upa.user_position_assignment_user_id = u.user_id
 WHERE u.user_status = 'DEACTIVATED'
   AND upa.user_position_assignment_status = 'ACTIVE';

-- --------------------------------------------------------------------------
-- E. Drop indici morti (0 scan lifetime; PK/UNIQUE e feature-backing esclusi)
-- --------------------------------------------------------------------------
DROP INDEX IF EXISTS audit.audit_import_validation_results_source_table_idx; -- 11 MB
DROP INDEX IF EXISTS sys.sys_skills_skill_kind_idx;
DROP INDEX IF EXISTS sys.sys_attendance_unvalidated_idx;
DROP INDEX IF EXISTS sys.sys_user_certifications_expires_idx;
DROP INDEX IF EXISTS sys.sys_viz_nodes_source_entity_idx;

-- --------------------------------------------------------------------------
-- F. Autovacuum per-tabella (append-only grandi: stats/bloat più stretti)
-- --------------------------------------------------------------------------
ALTER TABLE audit.import_validation_results
  SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE sys.sys_skill_embeddings
  SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02);

-- --------------------------------------------------------------------------
-- Post-conditions (fail-loud)
-- --------------------------------------------------------------------------
DO $$
DECLARE
  n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname = 'sys'
                    AND indexname = 'sys_source_lineage_records_srcrec_target_idx') THEN
    RAISE EXCEPTION '000188: indice lineage lookup assente';
  END IF;

  SELECT count(*) INTO n FROM pg_constraint
   WHERE conname IN ('sys_goal_templates_role_fk',
                     'sys_goal_templates_org_unit_fk',
                     'sys_auth_mfa_exemption_audit_user_fk');
  IF n <> 3 THEN
    RAISE EXCEPTION '000188: attese 3 FK nuove, trovate %', n;
  END IF;

  SELECT count(*) INTO n FROM sys.sys_user_employment
   WHERE user_employment_status <> UPPER(user_employment_status);
  IF n > 0 THEN
    RAISE EXCEPTION '000188: % employment status non normalizzati', n;
  END IF;

  SELECT count(*) INTO n FROM sys.v_deactivated_user_active_assignment;
  IF n > 0 THEN
    RAISE EXCEPTION '000188: % assignment ACTIVE su utenti DEACTIVATED', n;
  END IF;
END $$;
