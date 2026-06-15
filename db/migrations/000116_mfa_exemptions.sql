-- ============================================================================
-- Migration 000116 — MFA exemptions (integrazione #9, WI-A)
-- ----------------------------------------------------------------------------
-- Per-user opt-out dal gate mandatory-MFA del login (§3b auth/service.ts), per
-- gli account di servizio headless (es. il service user PLATFORM_ADMIN che
-- autora il catalogo blueprint via Agent SDK — vedi
-- docs/integrations/agent_sdk_mcp_integration_plan_2026-06-15.md §9, decisione
-- (a): A1 flag-DB = controllo PRIMARIO; A3 tenant-null = difesa-in-profondità).
--
-- INVARIANTE I7 (auth separato da sys_users): l'esenzione vive in una tabella
-- `sys_auth_*` dedicata, MAI come colonna su sys.sys_users. FK su user_id come
-- ogni altra tabella sys_auth_* (es. sys_auth_mfa_factors, 000005).
--
--   • una riga per utente (UNIQUE), FK → sys.sys_users ON DELETE CASCADE
--   • `enabled` boolean (esenzione attiva/sospesa senza cancellare la riga)
--   • `reason` text NOT NULL = audit (perché l'utente è esente)
--   • mutable → updated_at trigger (sys.sys_set_updated_at, mig 000002)
--
-- DEFAULT SICURO: con la tabella VUOTA il comportamento del login è
-- byte-identico a pre-000116 (nessun utente esente → il gate §3b si applica a
-- tutti come prima). L'esenzione è additiva e opt-in per-riga.
--
-- Reconciliation registry: bucket D / EXCLUDE (config auth app-authored — no
-- legacy source) + 0-UNCLASSIFIED assertion (classe D-22: registrata QUI così i
-- rebuild freschi non scattano l'assert).
-- Idempotent: twice-run = no-op. Authored: 2026-06-15 (integrazione #9 WI-A).
-- ============================================================================

-- =====================================================================
-- §1 — sys.sys_auth_mfa_exemptions (una riga per utente, opt-in)
-- =====================================================================
CREATE TABLE IF NOT EXISTS sys.sys_auth_mfa_exemptions (
  auth_mfa_exemption_id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_mfa_exemption_user_id uuid        NOT NULL,
  auth_mfa_exemption_reason  text        NOT NULL,
  auth_mfa_exemption_enabled boolean     NOT NULL DEFAULT true,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  created_by                 uuid,
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  updated_by                 uuid
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_auth_mfa_exemptions_user_fk') THEN
    ALTER TABLE sys.sys_auth_mfa_exemptions
      ADD CONSTRAINT sys_auth_mfa_exemptions_user_fk
      FOREIGN KEY (auth_mfa_exemption_user_id)
      REFERENCES sys.sys_users(user_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_auth_mfa_exemptions_user_uq') THEN
    ALTER TABLE sys.sys_auth_mfa_exemptions
      ADD CONSTRAINT sys_auth_mfa_exemptions_user_uq
      UNIQUE (auth_mfa_exemption_user_id);
  END IF;
END;
$cs$;

DO $tr$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sys_auth_mfa_exemptions_set_updated_at'
      AND tgrelid = 'sys.sys_auth_mfa_exemptions'::regclass
  ) THEN
    CREATE TRIGGER sys_auth_mfa_exemptions_set_updated_at
      BEFORE UPDATE ON sys.sys_auth_mfa_exemptions
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$tr$;

-- =====================================================================
-- §2 — reconciliation registry (bucket D / EXCLUDE — app-authored config)
-- =====================================================================
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_rationale)
VALUES
  ('sys_auth_mfa_exemptions', 'D', 'EXCLUDE',
   '[#9 WI-A] Per-user MFA exemption for headless service accounts (Agent SDK) — app-authored auth config; no legacy source (legacy heuresys-evo has no MFA). Invariant I7: auth-only table.')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

-- =====================================================================
-- §3 — post-conditions
-- =====================================================================
DO $pc$
DECLARE n int;
BEGIN
  IF to_regclass('sys.sys_auth_mfa_exemptions') IS NULL THEN
    RAISE EXCEPTION '000116: sys.sys_auth_mfa_exemptions missing';
  END IF;
  SELECT count(*) INTO n FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  IF n <> 0 THEN
    RAISE EXCEPTION '000116: % UNCLASSIFIED tables in the reconciliation view (expected 0)', n;
  END IF;
  RAISE NOTICE '000116: sys_auth_mfa_exemptions ready (default empty = login behaviour unchanged); registry row present.';
END;
$pc$;
