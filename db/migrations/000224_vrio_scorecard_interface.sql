-- 000224 — #56 F2: registra la scorecard VRIO nel registry delle interfacce.
--
-- La sidebar e' guidata dal database (GET /v1/me/interfaces), quindi una pagina non
-- registrata qui esiste ma non e' raggiungibile dalla navigazione. La voce sta sotto la
-- Console Org Director (stessa sezione OVERVIEW, ordine subito successivo) perche' e' la
-- lettura board-level della stessa materia.
--
-- Il permesso richiesto e' `capability:read` — lo stesso che protegge
-- GET /v1/capability/composition/vrio: la voce compare a chi puo' davvero aprirla, non a
-- chi ha solo l'accesso alla console.
--
-- Idempotente: ON CONFLICT sul codice naturale.

INSERT INTO sys.sys_ui_interfaces (
  ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
  ui_interface_sidebar_group, ui_interface_perspective,
  ui_interface_required_resource, ui_interface_required_action,
  ui_interface_requires_admin, ui_interface_order, ui_interface_is_active
) VALUES (
  'org-director-vrio', 'Scorecard VRIO', '/org-director/vrio', 'TrendingUp',
  'overview', 'OVERVIEW',
  'capability', 'read',
  TRUE, 8, TRUE
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
