---
name: consolida-pagina
description: |
  Gestisce il consolidamento completo di una pagina nel grafo Ruoli-Dashboards-Pagine di Heuresys.
  Usa questa skill OGNI VOLTA che l'utente dice "consolida pagina", "consolida", "consolida la pagina",
  "crea nuova pagina web", o quando si lavora su una pagina in una sessione dashboard dedicata.
  Si attiva anche quando l'utente chiede di collegare una pagina a una dashboard, registrare una nuova pagina nel DB,
  aggiornare lo status di una pagina, o qualsiasi operazione che modifichi il grafo navigazione
  (rbp_pages, rbp_dashboard_nav_items, rbp_role_dashboards, rbp_role_permissions).
  Copre l'intero ciclo: backup, aggiornamento record, navigazione N:M, permessi, scope, field policies,
  prospettive PET, widget, integrità, restart cache, verifica API, aggiornamento documenti.
---

# Consolida Pagina — Skill Operativa

Questa skill orchestra il consolidamento completo di una pagina nel sistema Heuresys, aggiornando l'intero grafo relazionale Ruoli ↔ Dashboards ↔ Pagine. Non si limita al record della pagina: ogni modifica ha impatto a cascata su navigazione, permessi, scope, cache e documenti.

## Quando si attiva

- Comando **"consolida pagina"** (o varianti: "consolida", "consolida la pagina")
- Comando **"crea nuova pagina web"** (al momento del consolidamento DB)
- Qualsiasi operazione su `rbp_pages` o `rbp_dashboard_nav_items` in sessioni dashboard dedicate
- Collegamento/scollegamento pagina da dashboard

## Warning DEMO — Emettere SEMPRE

Prima di qualsiasi operazione su una pagina con `status = 'DEMO'`:

```
⚠️ WARNING DEMO: La pagina [code] (route: [route_path]) ha status DEMO.
   Contiene dati mock/statici — non collegata ad API reali.
   Qualsiasi modifica alla UI non avrà effetto sui dati fino al collegamento API.
```

Il warning va emesso all'inizio del lavoro, prima di consolidare, e ogni volta che la pagina compare in un elenco operativo.

---

## Le 7 Fasi del Consolidamento

### FASE A — Backup e pre-check

Il consolidamento modifica dati di produzione. Un backup protegge da errori e permette rollback.

```sql
-- Pre-check: snapshot contatori per la dashboard target
SELECT 'pages' as entity, count(*) FROM rbp_pages
UNION ALL
SELECT 'nav_items', count(*) FROM rbp_dashboard_nav_items
UNION ALL
SELECT 'nav_visible', count(*) FROM rbp_dashboard_nav_items WHERE is_visible = true
UNION ALL
SELECT 'nav_hidden', count(*) FROM rbp_dashboard_nav_items WHERE is_visible = false;
```

```bash
# Backup manuale (se >5 record coinvolti o modifica relazioni)
bash backups/backup-manual.sh pre-consolida-<page_code>
```

Se l'operazione coinvolge una singola pagina senza modifiche strutturali, il backup e opzionale.

### FASE B1 — Admin Component Registry Check (P11) *(introdotta 2026-04-10)*

Prima di aggiornare `rbp_pages` e prima di scrivere/modificare UI, **OBBLIGATORIO**
interrogare `admin_component_registry` per verificare la riusabilita di componenti
esistenti. Questa fase implementa il principio P11 "Reuse-First Admin Components".

**Step 1 — Query registry per area funzionale**:
```sql
SELECT code, name, frontend_path, export_name, export_kind,
       prop_shape, scope_level, read_only, verified_with_data
  FROM admin_component_registry
 WHERE functional_area_code = '{AREA_CODE}'
   AND (tenant_id = '{TENANT_UUID}' OR tenant_id IS NULL);
```

Oppure via API (se il frontend e il backend sono up):
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8012/api/v1/admin-components/by-area/{AREA_CODE}"
```

**Step 2 — Decidere**:

| Caso | Azione |
|------|--------|
| Il registry ritorna un componente con `scope_level` compatibile e `prop_shape` che accetta gli input necessari | **Riusare** il componente via import dal `frontend_path`. La pagina diventa un thin wrapper (pattern `PortalPageShell` + child render). |
| Il registry non ha match oppure lo scope non e compatibile | **Creare** il nuovo componente in una dir condivisa (es. `services/frontend/src/app/admin/employees/[id]/_components/`) e **registrarlo** nel registry con INSERT nella stessa migration/sessione. |

**Step 3 — Log della decisione**:
- Se riuso: loggare il `code` del componente e il path della pagina wrapper creata.
- Se nuovo: loggare il nuovo `code` registrato, i file creati e il perche non e stato riusato un componente esistente (scope incompatibile, feature non coperta, ecc.).

**Gate bloccante**: la FASE B (aggiornamento rbp_pages) **non** puo iniziare se la
FASE B1 e stata saltata o il suo esito non e stato documentato nel log di sessione.
La skill deve rifiutarsi di procedere e chiedere esplicitamente all'utente di fare
il reuse-check.

### FASE B — Aggiornamento `rbp_pages`

Il record pagina e il punto di partenza. Tutti i campi vanno verificati e aggiornati se necessario.

**Per pagina esistente** (UPDATE):
```sql
UPDATE rbp_pages SET
  status = '{NEW_STATUS}',                    -- ACTIVE|DEMO|DISABLED|ecc.
  suggested_dashboards = '{DASHBOARDS}',      -- svuotare '{}' se ora collegata
  name = '{DISPLAY_NAME}',                    -- se cambiato
  description = '{DESCRIPTION}',              -- se cambiato
  route_path = '{ROUTE}',                     -- se cambiato
  icon = '{ICON}',                            -- icona Lucide
  functional_area_code = '{AREA_CODE}',       -- se riassegnata
  redirect_to = '{TARGET}',                   -- solo se status=REDIRECT
  component_path = '{COMPONENT}',             -- se il componente React cambia
  metadata = '{METADATA}'::jsonb,             -- se serve
  updated_at = now()
WHERE code = '{PAGE_CODE}';
```

**Per pagina nuova** (INSERT — comando "crea nuova pagina web"):
```sql
INSERT INTO rbp_pages (code, name, description, route_path, functional_area_code,
                       status, icon, requires_auth, metadata)
VALUES ('{CODE}', '{NAME}', '{DESC}', '{ROUTE}', '{AREA}',
        '{STATUS}', '{ICON}', true, '{}');
```

**Regole status**:
- Se la pagina ha frontend operativo collegato ad API reali → `ACTIVE`
- Se la pagina ha UI ma dati mock/statici → `DEMO`
- Se la pagina non e collegata a nessuna dashboard → `UNASSIGNED` (con `suggested_dashboards` popolato)
- Se passa da UNASSIGNED/DEMO a ACTIVE → svuotare `suggested_dashboards` a `'{}'`

### FASE C — Aggiornamento `rbp_dashboard_nav_items` (navigazione)

La relazione pagina↔dashboard e N:M: una pagina puo apparire in piu dashboard. Ogni link e un record separato in `rbp_dashboard_nav_items`.

**Collegare pagina a una dashboard**:
```sql
INSERT INTO rbp_dashboard_nav_items
  (dashboard_id, item_type, target_page_id, section, sort_order, is_visible)
SELECT
  d.id, 'page', p.id, '{SECTION}', {SORT_ORDER}, true
FROM rbp_dashboards d, rbp_pages p
WHERE d.code = '{DASHBOARD_CODE}' AND p.code = '{PAGE_CODE}'
ON CONFLICT DO NOTHING;
```

**Convertire hidden → visible** (pagina UNASSIGNED che viene assegnata):
```sql
UPDATE rbp_dashboard_nav_items ni SET
  is_visible = true,
  section = '{SECTION}',
  sort_order = {SORT_ORDER}
FROM rbp_pages p, rbp_dashboards d
WHERE ni.target_page_id = p.id
  AND ni.dashboard_id = d.id
  AND p.code = '{PAGE_CODE}'
  AND d.code = '{DASHBOARD_CODE}';
```

**Spostare pagina tra dashboard** (rimuovere da una, aggiungere a un'altra):
```sql
-- Rimuovere
DELETE FROM rbp_dashboard_nav_items
WHERE target_page_id = (SELECT id FROM rbp_pages WHERE code = '{PAGE_CODE}')
  AND dashboard_id = (SELECT id FROM rbp_dashboards WHERE code = '{OLD_DASHBOARD}');

-- Aggiungere (usa template INSERT sopra)
```

**Verificare sort_order** — nessun conflitto nella stessa section:
```sql
SELECT ni.sort_order, p.code, ni.section
FROM rbp_dashboard_nav_items ni
JOIN rbp_pages p ON p.id = ni.target_page_id
WHERE ni.dashboard_id = (SELECT id FROM rbp_dashboards WHERE code = '{DASHBOARD_CODE}')
  AND ni.section = '{SECTION}'
ORDER BY ni.sort_order;
```

### FASE D — Relazioni a monte

Queste verifiche garantiscono che il ruolo possa effettivamente raggiungere la pagina attraverso il grafo.

**D.1 — `rbp_role_dashboards`**: il ruolo ha accesso alla dashboard?
```sql
-- Verificare
SELECT r.code as role, d.code as dashboard, rd.is_default
FROM rbp_role_dashboards rd
JOIN rbp_roles r ON r.id = rd.role_id
JOIN rbp_dashboards d ON d.id = rd.dashboard_id
WHERE d.code = '{DASHBOARD_CODE}';

-- Se manca un ruolo che dovrebbe avere accesso:
INSERT INTO rbp_role_dashboards (role_id, dashboard_id, is_default)
SELECT r.id, d.id, false
FROM rbp_roles r, rbp_dashboards d
WHERE r.code = '{ROLE_CODE}' AND d.code = '{DASHBOARD_CODE}'
ON CONFLICT DO NOTHING;
```

**D.2 — `rbp_role_permissions`**: il ruolo ha permessi sull'area funzionale della pagina?
```sql
-- Verificare permessi per l'area della pagina
SELECT r.code as role, rp.can_view, rp.can_create, rp.can_edit, rp.can_delete
FROM rbp_role_permissions rp
JOIN rbp_roles r ON r.id = rp.role_id
WHERE rp.functional_area_code = '{AREA_CODE}'
ORDER BY r.hierarchy_level;

-- Se un ruolo non ha permessi e dovrebbe averli:
INSERT INTO rbp_role_permissions
  (role_id, functional_area_code, can_view, can_create, can_edit, can_delete, can_approve, can_execute)
SELECT r.id, '{AREA_CODE}', true, false, false, false, false, false
FROM rbp_roles r WHERE r.code = '{ROLE_CODE}'
ON CONFLICT DO NOTHING;
```

**D.3 — `rbp_scope_rules`**: se la pagina implementa scope filtering (PLATFORM/TENANT/DEPARTMENT/HIERARCHY/TEAM/SELF), verificare che le scope rules del ruolo siano coerenti.
```sql
SELECT r.code, sr.scope_type, sr.description
FROM rbp_scope_rules sr
JOIN rbp_roles r ON r.id = sr.role_id
WHERE r.code IN ({RUOLI_CON_ACCESSO})
ORDER BY r.hierarchy_level;
```

**D.4 — `rbp_field_policies`**: se la pagina espone campi sensibili (stipendio, dati personali, valutazioni), verificare le field policy (SHOW/MASK/HIDE) per ogni ruolo.
```sql
SELECT r.code, fp.data_classification_code, fp.visibility
FROM rbp_field_policies fp
JOIN rbp_roles r ON r.id = fp.role_id
ORDER BY r.hierarchy_level, fp.data_classification_code;
```

La Fase D richiede giudizio: non tutte le sotto-fasi si applicano a ogni pagina. Ad esempio, D.3 e D.4 sono rilevanti solo per pagine che gestiscono dati con scope o campi sensibili. Valutare caso per caso.

### FASE E — Oggetti derivati

Queste relazioni arricchiscono l'ecosistema della pagina ma non sono bloccanti per la navigazione.

**E.1 — `rbp_area_perspectives`**: se la pagina appartiene a un'area non ancora mappata a una prospettiva PET (Process/Enterprise/Talent):
```sql
-- Verificare mapping area→prospettiva
SELECT ap.functional_area_code, ap.perspective_code, ap.mapping_type
FROM rbp_area_perspectives ap
WHERE ap.functional_area_code = '{AREA_CODE}';

-- Se manca e serve:
INSERT INTO rbp_area_perspectives (functional_area_code, perspective_code, mapping_type)
VALUES ('{AREA_CODE}', '{PERSPECTIVE}', 'PRIMARY')
ON CONFLICT DO NOTHING;
```

**E.2 — `widget_catalog`**: se la pagina introduce KPI/chart/dati utili per la Personal Workspace, registrare nel catalogo widget.
```sql
-- Verificare widget esistenti per l'area
SELECT code, name, widget_type, functional_area_code
FROM widget_catalog
WHERE functional_area_code = '{AREA_CODE}';
```

**E.3 — `workspace_templates`**: se i widget della pagina devono apparire nei template di default per un ruolo, aggiornare i template.

La Fase E e quasi sempre opzionale nel consolidamento di singole pagine. Diventa rilevante quando si consolida un'intera sezione funzionale.

### FASE F — Integrita e indici

Queste query vanno eseguite SEMPRE dopo qualsiasi modifica, senza eccezioni.

```sql
-- F.1: FK orfane — pagine con area funzionale inesistente
SELECT p.code, p.functional_area_code
FROM rbp_pages p
LEFT JOIN rbp_functional_areas fa ON fa.code = p.functional_area_code
WHERE fa.code IS NULL AND p.functional_area_code IS NOT NULL;

-- F.2: Nav items orfani — puntano a pagine inesistenti
SELECT ni.id, ni.target_page_id
FROM rbp_dashboard_nav_items ni
LEFT JOIN rbp_pages p ON p.id = ni.target_page_id
WHERE ni.item_type = 'page' AND p.id IS NULL;

-- F.3: Nav items orfani — puntano a dashboard inesistenti
SELECT ni.id, ni.dashboard_id
FROM rbp_dashboard_nav_items ni
LEFT JOIN rbp_dashboards d ON d.id = ni.dashboard_id
WHERE d.id IS NULL;

-- F.4: Duplicati code in rbp_pages
SELECT code, count(*) FROM rbp_pages GROUP BY code HAVING count(*) > 1;

-- F.5: Duplicati nav_item (stessa pagina nella stessa dashboard)
SELECT dashboard_id, target_page_id, count(*)
FROM rbp_dashboard_nav_items
WHERE item_type = 'page'
GROUP BY dashboard_id, target_page_id
HAVING count(*) > 1;

-- F.6: Distribuzione status aggiornata
SELECT status, count(*) FROM rbp_pages GROUP BY status ORDER BY count(*) DESC;
```

**Tutti i risultati F.1-F.5 devono restituire 0 righe.** Se qualcuno restituisce righe, fermarsi e correggere prima di proseguire.

### FASE G — Propagazione e verifica

```bash
# G.1: Restart API gateway per invalidare RBPCacheService
docker restart heuresys_evo_api_gateway

# G.2: Verifica API (dopo ~5 secondi per startup)
curl -s http://localhost:8012/api/rbp/dashboard/{DASHBOARD_SLUG}/nav-items \
  -H "Authorization: Bearer {JWT}" | jq '.data | length'
```

**G.3: Aggiornare documenti** — dopo ogni consolidamento:

1. `docs/DASHBOARDS_CONSTITUTION_MAP.md` — spostare pagina da pending a completata nella sezione della dashboard, aggiornare metriche Sezione 7, aggiungere riga al diario di bordo Sezione 6
2. `docs/BLUEPRINT_ROLES_DASHBOARDS_PAGES.md` — solo se modifiche strutturali (nuove relazioni, nuovi indici, nuove tabelle)
3. Memory files (`.auto-memory/`) — solo se decisioni architetturali non ovvie

---

## Comando "crea nuova pagina web"

Quando l'utente chiede di creare una nuova pagina, al momento del consolidamento presentare questo **questionario** (usando AskUserQuestion se disponibile, altrimenti in conversazione):

| # | Campo | Tipo | Obbl. | Default/Note |
|---|-------|------|-------|-------------|
| 1 | `code` | varchar | SI | snake_case, univoco |
| 2 | `name` | varchar | SI | Nome display |
| 3 | `description` | text | NO | Descrizione funzionale |
| 4 | `route_path` | varchar | SI | Path Next.js (es. `/admin/hr/new-page`) |
| 5 | `functional_area_code` | varchar | SI | Una delle 33 aree funzionali |
| 6 | `status` | varchar | SI | DEMO se mock, ACTIVE se operativa |
| 7 | `icon` | varchar | NO | Icona Lucide |
| 8 | `requires_auth` | boolean | SI | Default: `true` |
| 9 | `dashboard(s) target` | varchar[] | SI | Una o piu dashboard |
| 10 | `sezione sidebar` | varchar | SI | main, hr, talent, analytics, ecc. |
| 11 | `sort_order` | integer | SI | Suggerito automaticamente |

Dopo il questionario, eseguire le Fasi A-G con INSERT invece di UPDATE dove applicabile.

---

## Riferimenti

Per il contesto completo su dashboard, pagine e numeri attuali, leggere:
- `docs/DASHBOARDS_CONSTITUTION_MAP.md` — piano, stato avanzamento, dettaglio per dashboard
- `docs/BLUEPRINT_ROLES_DASHBOARDS_PAGES.md` — schema ER, tabelle, API routes

Per le 33 aree funzionali valide:
```sql
SELECT code, name, category FROM rbp_functional_areas ORDER BY category, code;
```

Per le 11 dashboard valide:
```sql
SELECT code, name, layout_path FROM rbp_dashboards ORDER BY sort_order;
```

## Connessione DB

```bash
docker exec -i heuresys_evo_platform_db psql -U heuresys -d heuresys_platform
```

Tutte le query SQL in questa skill usano questo contesto di connessione.

## Governance gate locale (opzionale)

Il repo include un pre-push hook che esegue i gate P9 (widget coverage) e P11 (admin component registry) prima di ogni push. Non e' installato automaticamente — attivarlo con:

```bash
git config core.hooksPath infra/git-hooks
```

Il hook skippa E2E (`SKIP_E2E=1`) per mantenere il push sotto 30 secondi. La suite completa gira comunque in CI via `.github/workflows/governance.yml`. Per bypassare occasionalmente: `git push --no-verify`.
