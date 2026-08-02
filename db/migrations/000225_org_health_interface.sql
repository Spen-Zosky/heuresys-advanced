-- 000225 — #57 F3: registra la pagina Salute organizzativa nel registry delle interfacce.
--
-- Come per la scorecard VRIO (000224): la sidebar e' guidata dal database, quindi senza
-- questa riga la pagina esiste ma non e' raggiungibile dalla navigazione.
--
-- Il permesso richiesto e' `org_director:read`, lo stesso che protegge
-- GET /v1/org-health e la Console Org Director sotto cui la pagina vive.
--
-- Idempotente: ON CONFLICT sul codice naturale.

INSERT INTO sys.sys_ui_interfaces (
  ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
  ui_interface_sidebar_group, ui_interface_perspective,
  ui_interface_required_resource, ui_interface_required_action,
  ui_interface_requires_admin, ui_interface_order, ui_interface_is_active
) VALUES (
  'org-director-health', 'Salute organizzativa', '/org-director/health', 'Activity',
  'overview', 'OVERVIEW',
  'org_director', 'read',
  TRUE, 9, TRUE
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
