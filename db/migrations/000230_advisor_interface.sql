-- 000230 — #58 F4: registra la pagina «Consigli operativi» nel registry delle interfacce.
--
-- Come per VRIO (000224) e Salute organizzativa (000225): la sidebar e' guidata dal database,
-- quindi senza questa riga la pagina esiste ma non e' raggiungibile dalla navigazione.
--
-- Il permesso e' `org_director:read`, lo stesso che protegge GET /v1/advisor/suggestions e le
-- tre scorecard che l'advisor cita: chi non puo' vedere le fonti non deve vedere le conclusioni.
--
-- Idempotente: ON CONFLICT sul codice naturale.

INSERT INTO sys.sys_ui_interfaces (
  ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
  ui_interface_sidebar_group, ui_interface_perspective,
  ui_interface_required_resource, ui_interface_required_action,
  ui_interface_requires_admin, ui_interface_order, ui_interface_is_active
) VALUES (
  'org-director-advisor', 'Consigli operativi', '/org-director/advisor', 'Lightbulb',
  'overview', 'OVERVIEW',
  'org_director', 'read',
  TRUE, 10, TRUE
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
