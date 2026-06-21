-- ============================================================================
-- 000152_leads.sql — GTM lead capture (#4 front-door). A public website lead
-- form (POST /v1/leads) stores prospects here; admin reads via leads:read.
-- Real opt-in PII (consent captured in the form) — read RBAC-gated. Idempotent.
-- Authored: 2026-06-21 (S1002, #4 go-to-market).
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_leads (
  lead_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_name             varchar(200) NOT NULL,
  lead_company          varchar(200) NOT NULL,
  lead_email            varchar(320) NOT NULL,
  lead_role             varchar(160),
  lead_company_size     varchar(16) CHECK (lead_company_size IN ('LT_50','50_250','250_2000','GT_2000')),
  lead_message          text,
  lead_source           varchar(40) NOT NULL DEFAULT 'website',
  lead_status           varchar(16) NOT NULL DEFAULT 'NEW' CHECK (lead_status IN ('NEW','CONTACTED','QUALIFIED','CLOSED')),
  lead_consent_at       timestamptz NOT NULL,
  lead_consent_version  varchar(32) NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sys_leads_created_idx ON sys.sys_leads (created_at DESC);

-- Permission leads:read → PLATFORM_ADMIN (the registry/list side; the POST is public).
INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action, auth_permission_description)
VALUES ('leads:read', 'Read leads', 'leads', 'read', 'Read website lead submissions')
ON CONFLICT (auth_permission_code) DO NOTHING;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
JOIN sys.sys_auth_permissions p ON p.auth_permission_code = 'leads:read'
WHERE r.auth_role_code = 'PLATFORM_ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_auth_role_permissions rp
    WHERE rp.auth_role_id = r.auth_role_id AND rp.auth_permission_id = p.auth_permission_id
  );

-- Reconciliation registry: app-authored, no legacy source.
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_leads', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-authored GTM website leads (mig 000152, #4). Real opt-in prospect PII captured via the public POST /v1/leads form with consent; never imported from legacy.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_auth_role_permissions rp
   JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE p.auth_permission_code = 'leads:read' AND r.auth_role_code = 'PLATFORM_ADMIN';
  IF n <> 1 THEN RAISE EXCEPTION '000152: expected leads:read mapped to PLATFORM_ADMIN, found %', n; END IF;
  RAISE NOTICE '000152: sys_leads + leads:read (PLATFORM_ADMIN) + registry EXCLUDE.';
END $$;
