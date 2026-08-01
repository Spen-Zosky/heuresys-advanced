-- 000220_ui_interface_skill_taxonomy.sql
--
-- #43 (linea C2) — registra la pagina /skill-taxonomy nel menù laterale.
--
-- Stessa ragione della `000219`: il menù è un registro sul database
-- (`sys.sys_ui_interfaces`, letto da `GET /v1/me/interfaces`), non un file del
-- frontend. Una rotta senza la sua riga qui esiste e non la raggiunge nessuno.
--
-- La pagina governa l'ossatura del catalogo competenze — famiglie, categorie e
-- i livelli di padronanza di riferimento — che fino a oggi erano moduli API
-- (`skill-families`, `skill-categories`, `skill-proficiency-levels`) privi di
-- qualsiasi interfaccia.
--
-- Cancello di visibilità: `skill:read`, lo stesso del catalogo competenze da
-- cui la tassonomia discende (le rotte di scrittura chiedono in più
-- `skill_taxonomy:*`, che il pannello verifica per mostrare i comandi).
--
-- Posizione: GOVERNANCE, gruppo `governance`, ordine 20 — subito dopo la voce
-- del catalogo mansioni (18) e la console whistleblowing (19).
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
  'skill-taxonomy',
  'Tassonomia Competenze',
  '/skill-taxonomy',
  'Network',
  'governance',
  'GOVERNANCE',
  'skill',
  'read',
  TRUE,
  20,
  TRUE
)
ON CONFLICT (ui_interface_code) DO NOTHING;
