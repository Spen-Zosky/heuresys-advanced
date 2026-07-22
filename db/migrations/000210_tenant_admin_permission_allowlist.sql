-- ============================================================================
-- Migration 000210 — D-57: allowlist esplicita deny-by-default per TENANT_ADMIN.
--
-- PROBLEMA (D-57, scoperto S1021): 000005 concede a TENANT_ADMIN OGNI permesso
-- via CROSS JOIN meno 7 codici hardcoded ("tutto meno 7"). Poiché le migration
-- rigirano tutte a ogni db:migrate, qualunque permesso futuro veniva assorbito
-- in silenzio da TENANT_ADMIN, salvo DELETE correttive sparse (000178/000199/
-- 000208). DECISO S1024 (delega Enzo, feedback_claude_decides_technical):
-- least-privilege, allowlist positiva.
--
-- MECCANICA: questa migration è la FONTE DI VERITÀ dell'audience TENANT_ADMIN:
--   1. INSERT dei grant per i 181 codici in allowlist (fresh-DB deterministico);
--   2. DELETE di ogni grant TENANT_ADMIN fuori allowlist (annulla il blanket
--      di 000005 a ogni re-run — 000210 > 000005, auto-riparante);
--   3. post-condition: audience TENANT_ADMIN == allowlist ESATTAMENTE (RAISE).
-- Il set corrente NON cambia (181 grant = stato corretto post-000208/000209,
-- verificato live 2026-07-22): cambia il default per il FUTURO.
--
-- POLICY (vincolante, guardia in rbac-tenant-admin-allowlist.test.ts):
--   • un permesso NUOVO non arriva MAI a TENANT_ADMIN in silenzio;
--   • per concederglielo, la migration che lo introduce deve contenere il
--     marker `-- TENANT_ADMIN-ALLOWLIST-EXTEND` seguito dalle righe
--     `    ('<permission_code>'),` (stesso formato di questa VALUES): il grant
--     effettivo lo fa la migration stessa (dopo 000210 nell'ordine), e il test
--     di guardia riconosce l'estensione parsando il marker.
--
-- IDEMPOTENTE + twice-run safe. Authored: 2026-07-22 (S1027).
-- ============================================================================

CREATE TEMP TABLE _ta_allowlist(code text PRIMARY KEY);
INSERT INTO _ta_allowlist(code) VALUES
('analytics:view'),
    ('approval:create'),
    ('approval:decide'),
    ('approval:read'),
    ('approval:read:self'),
    ('assessment:create'),
    ('assessment:read'),
    ('assessment:read:self'),
    ('assessment:update'),
    ('auth:revoke_user'),
    ('auth:sessions_read'),
    ('blueprint:activate'),
    ('blueprint:delete'),
    ('blueprint:override'),
    ('blueprint:read'),
    ('bpm_process:delete'),
    ('bpm_process:read'),
    ('bpm_process:update'),
    ('brownfield_adaptation:read'),
    ('brownfield_adaptation:trigger'),
    ('capability:admin'),
    ('capability:read'),
    ('career:request_target:self'),
    ('career_succession:create'),
    ('career_succession:delete'),
    ('career_succession:read'),
    ('career_succession:read:self'),
    ('career_succession:update'),
    ('certification:read:self'),
    ('certification:upload:self'),
    ('compensation_intelligence:read'),
    ('compensation_intelligence:read:self'),
    ('compensation_intelligence:update'),
    ('consent:manage:self'),
    ('content:create'),
    ('content:delete'),
    ('content:publish'),
    ('content:read'),
    ('content:update'),
    ('dashboard:view'),
    ('document:read:self'),
    ('document:upload:self'),
    ('engagement_feedback:create'),
    ('engagement_feedback:delete'),
    ('engagement_feedback:read'),
    ('engagement_feedback:update'),
    ('enterprise_typing:create'),
    ('enterprise_typing:delete'),
    ('enterprise_typing:read'),
    ('enterprise_typing:update'),
    ('evidence:read'),
    ('evidence:read:self'),
    ('gap_analysis:create'),
    ('gap_analysis:delete'),
    ('gap_analysis:read'),
    ('gap_analysis:read:self'),
    ('gap_analysis:update'),
    ('gdpr:erase'),
    ('gdpr:export'),
    ('gdpr:export:self'),
    ('gdpr:read'),
    ('gdpr:retention'),
    ('goal:create'),
    ('goal:delete'),
    ('goal:read'),
    ('goal:read:self'),
    ('goal:update'),
    ('insights:admin'),
    ('insights:view'),
    ('job_role:create'),
    ('job_role:read'),
    ('job_role:update'),
    ('kpi:create'),
    ('kpi:delete'),
    ('kpi:read'),
    ('kpi:read:self'),
    ('kpi:update'),
    ('learning:browse_catalogue'),
    ('learning:create'),
    ('learning:delete'),
    ('learning:enroll:self'),
    ('learning:read'),
    ('learning:read:self'),
    ('learning:update'),
    ('leave:read'),
    ('leave:read:self'),
    ('leave:request:self'),
    ('matching:admin'),
    ('matching:read'),
    ('me:content:read'),
    ('me:preferences:read'),
    ('me:preferences:update'),
    ('me:sessions:manage'),
    ('mentorship:create'),
    ('mentorship:delete'),
    ('mentorship:read'),
    ('mentorship:update'),
    ('mfa_policy:manage'),
    ('mfa_policy:read'),
    ('notification:create'),
    ('notification:mark_read:self'),
    ('notification:read:self'),
    ('occupation_classification:read'),
    ('okr:create'),
    ('okr:delete'),
    ('okr:read'),
    ('okr:update'),
    ('operating_model:delete'),
    ('operating_model:read'),
    ('operating_model:update'),
    ('org_director:read'),
    ('organization_unit:create'),
    ('organization_unit:delete'),
    ('organization_unit:list'),
    ('organization_unit:read'),
    ('organization_unit:update'),
    ('organization_unit_kpi_template:delete'),
    ('organization_unit_kpi_template:read'),
    ('organization_unit_kpi_template:update'),
    ('organization_unit_processes:create'),
    ('organization_unit_processes:delete'),
    ('organization_unit_processes:read'),
    ('position:create'),
    ('position:delete'),
    ('position:list'),
    ('position:read'),
    ('position:update'),
    ('predictions:read'),
    ('process_kpi_template:delete'),
    ('process_kpi_template:read'),
    ('process_kpi_template:update'),
    ('process_owner:read'),
    ('provenance:read'),
    ('role:assign'),
    ('role:read'),
    ('role_matrix:read'),
    ('seed_acquisition:approve'),
    ('seed_acquisition:delete'),
    ('seed_acquisition:read'),
    ('seed_acquisition:trigger'),
    ('skill:create'),
    ('skill:delete'),
    ('skill:read'),
    ('skill:read:self'),
    ('skill:self_assess'),
    ('skill:update'),
    ('surveys:create'),
    ('surveys:delete'),
    ('surveys:read'),
    ('surveys:respond:self'),
    ('surveys:update'),
    ('talent:read'),
    ('team:list'),
    ('team:read'),
    ('team:read:self'),
    ('tenant:list'),
    ('tenant:read'),
    ('tenant:update'),
    ('training_initiative:create'),
    ('training_initiative:list'),
    ('training_initiative:read'),
    ('training_initiative:update'),
    ('user:create'),
    ('user:delete'),
    ('user:list'),
    ('user:read'),
    ('user:update'),
    ('user_position_assignment:create'),
    ('user_position_assignment:delete'),
    ('user_position_assignment:list'),
    ('user_position_assignment:read'),
    ('user_position_assignment:read:self'),
    ('user_position_assignment:update'),
    ('user_profile:read'),
    ('user_profile:read:self'),
    ('user_profile:update'),
    ('user_profile:update:self'),
    ('visualization:create'),
    ('visualization:delete'),
    ('visualization:read'),
    ('visualization:update_layout');

-- Sanity: ogni codice in allowlist deve esistere come permesso (typo guard)
DO $$
DECLARE missing int;
BEGIN
  SELECT count(*) INTO missing FROM _ta_allowlist a
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_auth_permissions p WHERE p.auth_permission_code = a.code);
  IF missing <> 0 THEN
    RAISE EXCEPTION '000210: % codici in allowlist senza permesso corrispondente', missing;
  END IF;
END $$;

-- 1. Grant di tutti i codici in allowlist (fresh-DB deterministico)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM _ta_allowlist a
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = a.code
  JOIN sys.sys_auth_roles r ON r.auth_role_code = 'TENANT_ADMIN'
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 2. Deny-by-default: revoca ogni grant TENANT_ADMIN fuori allowlist
--    (annulla il CROSS JOIN blanket di 000005 a ogni re-run)
DELETE FROM sys.sys_auth_role_permissions rp
 USING sys.sys_auth_roles r, sys.sys_auth_permissions p
 WHERE r.auth_role_id = rp.auth_role_id
   AND p.auth_permission_id = rp.auth_permission_id
   AND r.auth_role_code = 'TENANT_ADMIN'
   AND NOT EXISTS (SELECT 1 FROM _ta_allowlist a WHERE a.code = p.auth_permission_code);

-- 3. Post-condition: audience TENANT_ADMIN == allowlist ESATTAMENTE
DO $$
DECLARE n_grants int; n_allow int; n_diff int;
BEGIN
  SELECT count(*) INTO n_allow FROM _ta_allowlist;
  SELECT count(*) INTO n_grants
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE r.auth_role_code = 'TENANT_ADMIN';
  SELECT count(*) INTO n_diff FROM (
    SELECT a.code FROM _ta_allowlist a
    EXCEPT
    SELECT p.auth_permission_code
      FROM sys.sys_auth_role_permissions rp
      JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
      JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
     WHERE r.auth_role_code = 'TENANT_ADMIN'
  ) d;
  IF n_grants <> n_allow OR n_diff <> 0 THEN
    RAISE EXCEPTION '000210: audience TENANT_ADMIN (%) != allowlist (%), diff=%', n_grants, n_allow, n_diff;
  END IF;
  RAISE NOTICE '000210: TENANT_ADMIN allowlist enforced — % grant, deny-by-default attivo.', n_grants;
END $$;

DROP TABLE _ta_allowlist;
