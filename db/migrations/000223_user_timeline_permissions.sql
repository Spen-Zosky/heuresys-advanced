-- ============================================================================
-- 000223_user_timeline_permissions.sql — D5 (#49) storia della persona.
--
-- Espone `sys.sys_user_timeline_events` (mig 000222) via /v1/user-timeline e
-- /v1/me/timeline. Modellato su 000173 (leave), che è il caso analogo: dato
-- PERSONALE per-persona, letto da un pubblico ristretto e dal diretto
-- interessato.
--
--   `timeline:read`      lettura della storia ALTRUI — org-gated (I18: la
--                        catena organizzativa, mai quella funzionale)
--   `timeline:read:self` la propria storia (I17, pavimento ESS)
--
-- Perché il pubblico di lettura è quello ristretto: la timeline contiene
-- SALARY_CHANGE, LEVEL_CHANGE e REVIEW_COMPLETED. È dato sensibile a tutti gli
-- effetti, non un elenco di attività: prende lo stesso pubblico di `leave:read`.
--
-- NESSUNA voce di menù: la storia non è una pagina, è una scheda dentro il
-- profilo della persona (`/users/[id]`) e dentro `/me`.
--
-- Idempotente: ON CONFLICT DO NOTHING ovunque.
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('timeline:read',      'Read a person''s timeline',  'timeline', 'read'),
  ('timeline:read:self', 'Read own timeline (ESS)',    'timeline', 'read')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- Pubblico di lettura: gli stessi 6 ruoli non-foglia di leave:read (000173).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'timeline:read'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- Pavimento self (I17): ogni persona vede la propria storia.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'timeline:read:self'
  AND r.auth_role_code IN ('USER','READ_ONLY','TEAM_MEMBER','TEAM_LEADER','MANAGER','HRMS_MANAGER','TENANT_ADMIN','PLATFORM_ADMIN')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;
