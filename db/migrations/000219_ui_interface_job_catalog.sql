-- 000219_ui_interface_job_catalog.sql
--
-- #43 (linea C2) — registra la pagina /job-catalog nel menù laterale.
--
-- Perché serve una migrazione per una pagina: il menù NON è un file del
-- frontend, è un registro sul database (`sys.sys_ui_interfaces`, letto da
-- `GET /v1/me/interfaces`). Una rotta creata senza la sua riga qui esiste ma
-- non è raggiungibile da nessuno — cioè non è nel prodotto.
--
-- I due moduli API job-families e job-roles erano fino a oggi gli unici del
-- catalogo senza ALCUNA pagina.
--
-- Cancello di visibilità: `job_role:read`. È il permesso che l'API richiede
-- davvero sulle rotte dei ruoli professionali (le famiglie non richiedono un
-- permesso dedicato — catalogo non sensibile, verificato sulle routes). Chi
-- non può leggere i ruoli non vede la voce.
--
-- Posizione: prospettiva GOVERNANCE, gruppo `governance`, ordine 18 — la
-- casella libera fra `users` (17) e `whistleblowing-console` (19), accanto a
-- `skills` (15) e `learning` (16) con cui condivide la natura di catalogo.
--
-- Idempotente: ON CONFLICT sul codice, che ha un vincolo di unicità.

INSERT INTO sys.sys_ui_interfaces (
  ui_interface_code,
  ui_interface_label,
  ui_interface_route,
  ui_interface_icon,
  ui_interface_sidebar_group,
  ui_interface_perspective,
  ui_interface_required_resource,
  ui_interface_required_action,
  ui_interface_requires_admin,
  ui_interface_order,
  ui_interface_is_active
) VALUES (
  'job-catalog',
  'Catalogo Mansioni',
  '/job-catalog',
  'Briefcase',
  'governance',
  'GOVERNANCE',
  'job_role',
  'read',
  TRUE,
  18,
  TRUE
)
ON CONFLICT (ui_interface_code) DO NOTHING;
