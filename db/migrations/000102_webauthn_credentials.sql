-- ============================================================================
-- Migration 000102 — WebAuthn/FIDO2 passkey credentials (MFA factor kind WEBAUTHN)
-- ----------------------------------------------------------------------------
-- One row per registered authenticator (passkey / security key). The parent
-- factor row lives in sys.sys_auth_mfa_factors (kind='WEBAUTHN', secret NULL);
-- the per-authenticator material (credential id, COSE public key, signature
-- counter, transports, AAGUID, backup flags) lives here. The factor-kind CHECK
-- on sys_auth_mfa_factors ALREADY admits 'WEBAUTHN' (no constraint change).
--
-- Conventions mirror 000086 (CMS content schema): sys.sys_<plural>; column prefix
--   <entity>_<field>; PK uuid DEFAULT gen_random_uuid(); guarded ADD CONSTRAINT;
--   CREATE TABLE/INDEX IF NOT EXISTS; reconciliation-registry INSERT (bucket D /
--   EXCLUDE — app-authored, no legacy source) + 0-UNCLASSIFIED assertion;
--   post-condition asserting the table exists.
-- Idempotent: twice-run = no-op.
-- Authored: 2026-06-09 (WebAuthn MFA factor — API layer).
-- ============================================================================

-- =====================================================================
-- §1 — sys.sys_auth_mfa_webauthn_credentials  (one row per authenticator)
-- =====================================================================
CREATE TABLE IF NOT EXISTS sys.sys_auth_mfa_webauthn_credentials (
  auth_webauthn_cred_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_webauthn_cred_factor_id       uuid         NOT NULL,
  auth_webauthn_cred_user_id         uuid         NOT NULL,
  auth_webauthn_cred_credential_id   text         NOT NULL,   -- base64url credential ID
  auth_webauthn_cred_public_key      bytea        NOT NULL,   -- COSE public key
  auth_webauthn_cred_counter         bigint       NOT NULL DEFAULT 0,
  auth_webauthn_cred_transports      text         NOT NULL DEFAULT '[]',  -- JSON array of transports
  auth_webauthn_cred_aaguid          text,
  auth_webauthn_cred_device_label    varchar(120) NOT NULL DEFAULT 'Passkey',
  auth_webauthn_cred_backup_eligible boolean      NOT NULL DEFAULT false,
  auth_webauthn_cred_backup_state    boolean      NOT NULL DEFAULT false,
  auth_webauthn_cred_last_used_at    timestamptz,
  created_at                         timestamptz  NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_webauthn_cred_factor_fk') THEN
    ALTER TABLE sys.sys_auth_mfa_webauthn_credentials
      ADD CONSTRAINT sys_webauthn_cred_factor_fk
      FOREIGN KEY (auth_webauthn_cred_factor_id)
      REFERENCES sys.sys_auth_mfa_factors(auth_mfa_factor_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_webauthn_cred_user_fk') THEN
    ALTER TABLE sys.sys_auth_mfa_webauthn_credentials
      ADD CONSTRAINT sys_webauthn_cred_user_fk
      FOREIGN KEY (auth_webauthn_cred_user_id)
      REFERENCES sys.sys_users(user_id) ON DELETE CASCADE;
  END IF;
END;
$cs$;

-- credential_id must be globally unique (the lookup key on authentication).
CREATE UNIQUE INDEX IF NOT EXISTS sys_webauthn_cred_credential_id_uq
  ON sys.sys_auth_mfa_webauthn_credentials (auth_webauthn_cred_credential_id);
CREATE INDEX IF NOT EXISTS sys_webauthn_cred_factor_idx
  ON sys.sys_auth_mfa_webauthn_credentials (auth_webauthn_cred_factor_id);
CREATE INDEX IF NOT EXISTS sys_webauthn_cred_user_idx
  ON sys.sys_auth_mfa_webauthn_credentials (auth_webauthn_cred_user_id);

-- =====================================================================
-- §2 — Reconciliation registry: 0-UNCLASSIFIED invariant (mirror 000086).
--      App-authored WebAuthn credentials, NOT a legacy-import target -> EXCLUDE / bucket D.
-- =====================================================================
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_auth_mfa_webauthn_credentials', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-authored WebAuthn credentials, mig 000102; no legacy source. Per-authenticator passkey material registered in-app via /v1/auth/mfa/webauthn/registration; not a reconciliation target.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $rc$
DECLARE n_unclassified int;
BEGIN
  SELECT count(*) INTO n_unclassified FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000102: expected 0 UNCLASSIFIED after registering webauthn credentials table, found %', n_unclassified;
  END IF;
END $rc$;

-- ============================================================================
-- Post-conditions (idempotent): assert the credentials table exists.
-- ============================================================================
DO $$
DECLARE n_tables int;
BEGIN
  SELECT count(*) INTO n_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'sys' AND c.relkind = 'r'
    AND c.relname = 'sys_auth_mfa_webauthn_credentials';
  IF n_tables <> 1 THEN
    RAISE EXCEPTION '000102: expected sys_auth_mfa_webauthn_credentials table to exist, found %', n_tables;
  END IF;
  RAISE NOTICE '000102: WebAuthn credentials schema OK — table present + registered EXCLUDE.';
END $$;
