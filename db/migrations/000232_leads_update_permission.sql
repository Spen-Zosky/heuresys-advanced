-- 000232_leads_update_permission.sql
-- #4 GTM W4 — gestione dei lead: permesso di scrittura + voce di navigazione.
--
-- I lead esistono dal primo deliverable GTM (form pubblico → `sys_leads`), ma finora
-- si potevano solo LEGGERE: `lead_status` era una colonna che nessuna superficie sapeva
-- cambiare. Un lead che arriva e resta per sempre `NEW` non è una pipeline commerciale,
-- è un archivio.
--
-- Il pubblico è lo stesso di `leads:read` — oggi il solo PLATFORM_ADMIN. Chi può vedere
-- i contatti raccolti è chi può lavorarli: separare le due cose creerebbe un ruolo che
-- guarda una lista su cui non può agire.
--
-- RD-08: lo stato è varchar + CHECK già in tabella; qui non si tocca lo schema dati.
-- Idempotente: ON CONFLICT DO NOTHING / DO UPDATE.

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES ('leads:update', 'Aggiornamento stato lead', 'leads', 'update')
ON CONFLICT (auth_permission_code) DO NOTHING;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'leads:update'
  -- Gli stessi ruoli che già leggono i lead, ri-derivati invece che elencati: se domani
  -- `leads:read` viene dato a un altro ruolo, questa migration non resta indietro.
  AND r.auth_role_id IN (
    SELECT rp.auth_role_id
      FROM sys.sys_auth_role_permissions rp
      JOIN sys.sys_auth_permissions rpp ON rpp.auth_permission_id = rp.auth_permission_id
     WHERE rpp.auth_permission_code = 'leads:read'
  )
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- Traduzione EN del nome, come impone la convenzione dei dati di riferimento (ADR-0029):
-- nome base in italiano + traduzione a fianco. Senza, il cancello i18n tornerebbe rosso.
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en', 'Update lead status', 'MANUAL'
  FROM sys.sys_auth_permissions p
 WHERE p.auth_permission_code = 'leads:update'
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_reference_translations t
      WHERE t.entity_table = 'sys_auth_permissions'
        AND t.entity_id = p.auth_permission_id
        AND t.field = 'name' AND t.locale = 'en'
   );

-- La sidebar è guidata dal database: senza questa riga la pagina esisterebbe ma non
-- sarebbe raggiungibile dalla navigazione.
INSERT INTO sys.sys_ui_interfaces (
  ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
  ui_interface_sidebar_group, ui_interface_perspective,
  ui_interface_required_resource, ui_interface_required_action,
  ui_interface_requires_admin, ui_interface_order, ui_interface_is_active
) VALUES (
  'leads', 'Richieste di contatto', '/leads', 'Inbox',
  'governance', 'GOVERNANCE',
  'leads', 'read',
  TRUE, 40, TRUE
)
ON CONFLICT (ui_interface_code) DO UPDATE
SET ui_interface_label             = EXCLUDED.ui_interface_label,
    ui_interface_route             = EXCLUDED.ui_interface_route,
    ui_interface_icon              = EXCLUDED.ui_interface_icon,
    ui_interface_sidebar_group     = EXCLUDED.ui_interface_sidebar_group,
    ui_interface_perspective       = EXCLUDED.ui_interface_perspective,
    ui_interface_required_resource = EXCLUDED.ui_interface_required_resource,
    ui_interface_required_action   = EXCLUDED.ui_interface_required_action,
    ui_interface_requires_admin    = EXCLUDED.ui_interface_requires_admin,
    ui_interface_order             = EXCLUDED.ui_interface_order,
    ui_interface_is_active         = EXCLUDED.ui_interface_is_active,
    updated_at                     = now();
