-- ============================================================================
-- 000181_whistleblowing.sql — #51 E/E1: canale whistleblowing (D.Lgs 24/2023).
--
-- Obbligo di legge per aziende >50 dipendenti. Dominio a MASSIMA sensibilita' con
-- due requisiti che governano lo schema:
--
--  1. ANONIMATO: la segnalazione arriva da un canale PUBBLICO, fuori dall'auth
--     ordinaria (come /v1/leads). Nessun user_id, nessun IP. Il segnalante riceve
--     un CODICE di tracciamento e segue il caso con QUELLO, mai loggandosi.
--
--  2. ISOLAMENTO CUSTODIAN (deroga esplicita ad ADR-0027): le segnalazioni NON
--     sono visibili per gerarchia org NE' per la plenipotenza admin abituale. Ne'
--     un manager, ne' TENANT_ADMIN, ne' HRMS_MANAGER, ne' PLATFORM_ADMIN possono
--     leggerle. Solo il ruolo dedicato WHISTLEBLOWING_CUSTODIAN. La legge impone
--     che identita' del segnalante e contenuto raggiungano il SOLO gestore
--     designato — inclusa l'esclusione degli IT admin.
--
-- IL PUNTO CRITICO (e perche' questo si appoggia a D-57): 000005 concede a
-- PLATFORM_ADMIN OGNI permesso via CROSS JOIN, e a TENANT_ADMIN tutto meno una
-- denylist. Creare i permessi whistleblowing e basta li renderebbe visibili a
-- entrambi al primo re-run delle migrazioni → isolamento ROTTO. Questa migrazione
-- percio' CONCEDE i permessi al solo custodian e poi RIMUOVE ogni grant
-- whistleblowing da qualunque altro ruolo, con post-condizione che SOLLEVA
-- eccezione se l'isolamento e' violato. Auto-riparante: 000181 > 000005, gira
-- dopo il CROSS JOIN a ogni catena.
--
-- INVARIANTI: I3/I4 (sys.sys_<plural>) · RD-08 (varchar+CHECK) · I5 (tenant FK).
-- IDEMPOTENTE: IF NOT EXISTS + ON CONFLICT DO NOTHING/UPDATE. Authored: 2026-07-19.
-- ============================================================================

-- 1. Ruolo dedicato (functional, holderless — assegnato esplicitamente)
INSERT INTO sys.sys_auth_roles
  (auth_role_code, auth_role_name, auth_role_description, auth_role_is_platform, auth_role_category)
VALUES
  ('WHISTLEBLOWING_CUSTODIAN', 'Whistleblowing Custodian',
   'Designated handler of whistleblowing reports (D.Lgs 24/2023). The ONLY role that can read/manage reports — isolated from org hierarchy and from admin plenipotence by explicit derogation to ADR-0027.',
   false, 'functional')
ON CONFLICT (auth_role_code) DO UPDATE SET auth_role_category = EXCLUDED.auth_role_category;

-- 2. Permessi. `submit` NON e' concesso a nessun ruolo: il canale di invio e'
--    pubblico (no auth). `read`/`manage` = solo custodian.
INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('whistleblowing:read',   'Read whistleblowing reports (custodian)',   'whistleblowing', 'read'),
  ('whistleblowing:manage', 'Manage whistleblowing reports (custodian)', 'whistleblowing', 'manage')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- 3. Concedi SOLO al custodian.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'WHISTLEBLOWING_CUSTODIAN'
   AND p.auth_permission_code IN ('whistleblowing:read', 'whistleblowing:manage')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 4. ISOLAMENTO: rimuovi ogni grant whistleblowing da qualunque ruolo != custodian
--    (in particolare PLATFORM_ADMIN via CROSS JOIN e TENANT_ADMIN via denylist-che-non-lo-copre).
DELETE FROM sys.sys_auth_role_permissions rp
 USING sys.sys_auth_permissions p, sys.sys_auth_roles r
 WHERE rp.auth_permission_id = p.auth_permission_id
   AND rp.auth_role_id = r.auth_role_id
   AND p.auth_permission_code IN ('whistleblowing:read', 'whistleblowing:manage')
   AND r.auth_role_code <> 'WHISTLEBLOWING_CUSTODIAN';

-- 5. La tabella. Nessun FK al segnalante: l'anonimato e' strutturale, non applicativo.
CREATE TABLE IF NOT EXISTS sys.sys_whistleblowing_reports (
  whistleblowing_report_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whistleblowing_report_tenant_id  uuid,
  whistleblowing_report_tracking_code varchar(64) NOT NULL,
  whistleblowing_report_status     varchar(32) NOT NULL DEFAULT 'NEW',
  whistleblowing_report_category   varchar(32) NOT NULL,
  whistleblowing_report_subject    varchar(255) NOT NULL,
  whistleblowing_report_body       text NOT NULL,
  whistleblowing_report_contact    text,                 -- opzionale: il segnalante puo' restare anonimo
  whistleblowing_report_assignee_user_id uuid,           -- un custodian
  whistleblowing_report_public_message   text,           -- nota del gestore VISIBILE al segnalante via codice
  whistleblowing_report_internal_notes   text,           -- note interne, MAI esposte via il canale pubblico
  whistleblowing_report_metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz NOT NULL DEFAULT now(),
  updated_at                       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_whistleblowing_status_check
    CHECK (whistleblowing_report_status IN ('NEW','UNDER_REVIEW','MORE_INFO_REQUESTED','SUBSTANTIATED','UNSUBSTANTIATED','CLOSED')),
  CONSTRAINT sys_whistleblowing_category_check
    CHECK (whistleblowing_report_category IN ('CORRUPTION','FRAUD','HARASSMENT','SAFETY','DISCRIMINATION','DATA_PRIVACY','OTHER')),
  CONSTRAINT sys_whistleblowing_updated_after CHECK (updated_at >= created_at),
  CONSTRAINT sys_whistleblowing_assignee_fk FOREIGN KEY (whistleblowing_report_assignee_user_id)
    REFERENCES sys.sys_users (user_id) ON DELETE SET NULL,
  CONSTRAINT sys_whistleblowing_tenant_fk FOREIGN KEY (whistleblowing_report_tenant_id)
    REFERENCES sys.sys_tenancies (tenant_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_whistleblowing_tracking_code_uq
  ON sys.sys_whistleblowing_reports (whistleblowing_report_tracking_code);
CREATE INDEX IF NOT EXISTS sys_whistleblowing_status_idx
  ON sys.sys_whistleblowing_reports (whistleblowing_report_status, created_at DESC);

-- 6. Reconciliation registry: app-authored, nessuna sorgente legacy (bucket D/EXCLUDE).
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_whistleblowing_reports', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-authored whistleblowing channel (mig 000181, #51 E1, D.Lgs 24/2023). Anonymous public submissions, no legacy import; deliberately holds NO reporter identity FK.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

-- 7. Post-condizione: isolamento verificato o la migrazione FALLISCE.
DO $$
DECLARE leak int; cust int;
BEGIN
  SELECT count(*) INTO leak
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE p.auth_permission_code IN ('whistleblowing:read','whistleblowing:manage')
     AND r.auth_role_code <> 'WHISTLEBLOWING_CUSTODIAN';
  IF leak > 0 THEN
    RAISE EXCEPTION '000181: ISOLAMENTO VIOLATO — % grant whistleblowing su ruoli non-custodian', leak;
  END IF;
  SELECT count(*) INTO cust
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE p.auth_permission_code IN ('whistleblowing:read','whistleblowing:manage')
     AND r.auth_role_code = 'WHISTLEBLOWING_CUSTODIAN';
  IF cust <> 2 THEN
    RAISE EXCEPTION '000181: il custodian deve avere 2 permessi whistleblowing, ne ha %', cust;
  END IF;
  RAISE NOTICE '000181: whistleblowing isolato — custodian 2 permessi, 0 leak.';
END $$;
