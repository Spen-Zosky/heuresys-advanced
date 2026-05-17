# 02.4 · Projects v2

> GitHub Projects (v2) è il sistema di project management integrato. Permette di organizzare Issue + PR (anche **cross-repo**) in board (Kanban), table (spreadsheet), o roadmap (Gantt-like). Sostituisce Trello/Jira/Linear per progetti che vivono in GitHub.

---

## 1. Concetto

Un **Project** (v2) è una collezione di **items**: Issue, PR, o draft (note senza Issue/PR sottostante).

Caratteristiche:
- **Cross-repo**: un project può aggregare item da più repo (anche da org diverse).
- **Multi-vista**: stessa data shown come Board, Table, o Roadmap.
- **Custom fields**: aggiungi colonne arbitrarie (Status, Priority, Sprint, Story points, ecc.).
- **Filters / Groups / Sort**: sulle viste.
- **Automation**: regole semplici (es. "se issue chiusa → sposta a Done").
- **Templates**: scaffold riusabili (Roadmap, Bug Triage, Feature Planning).

### Project classic (deprecato)
La v1 di Projects, basata solo su colonne board, è in fase di sunset. Ignora completamente — usa solo v2.

### Anatomia di un item

| Campo | Note |
|---|---|
| **Source** | Issue / PR / draft note |
| **Status** | colonna del board (e.g. Todo, In Progress, Done) |
| **Custom fields** | aggiunti dal project owner (Priority, Sprint, Effort, ecc.) |
| **Visibility** | privato all'owner / visibile a chi accede al project |

---

## 2. Modello mentale

```
                  ┌───────────────────────────────┐
                  │       PROJECT v2              │
                  │                               │
                  │   ┌────────────────────────┐  │
                  │   │  Board view (Kanban)   │  │
                  │   │  Todo │ Doing │ Done   │  │
                  │   └────────────────────────┘  │
                  │   ┌────────────────────────┐  │
                  │   │  Table view            │  │
                  │   │  ID │ Status │ Effort  │  │
                  │   └────────────────────────┘  │
                  │   ┌────────────────────────┐  │
                  │   │  Roadmap view (Gantt)  │  │
                  │   └────────────────────────┘  │
                  └───────────────┬───────────────┘
                                  │ items
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
        ┌─────────┐         ┌─────────┐         ┌─────────┐
        │ Issue   │         │  PR     │         │  Draft  │
        │ #42     │         │  #45    │         │  (note) │
        │ repo-a  │         │ repo-b  │         └─────────┘
        └─────────┘         └─────────┘
```

3 viste della stessa data; gli item sono linked a Issue/PR in più repo.

---

## 3. Applicato ai nostri repo

### Stato attuale: **0 project creati**

Entrambi i repo hanno `has_projects: true` (default) ma nessuno è stato configurato.

### Quando ha senso un Project

Per un sole-coder oggi: **non urgente**, ma utile in 3 scenari:

1. **MVP roadmap visivo**: invece di tracciare le fasi MVP-1/2/3 in `HANDOFF.md` (testo lungo), un Project "Heuresys Roadmap" con viste Roadmap (timeline) + Table (effort) dà colpo d'occhio.

2. **Tracking cross-repo**: oggi il design system (`ux-design-shared`) e l'app (`heuresys-advanced`) hanno work intrecciato. Un Project unico con item da entrambi i repo aiuta a vedere il flow ("Aggiungi card hover effect" → issue su `ux-design-shared` + issue su `heuresys-advanced` per consumare il nuovo prop).

3. **Bug triage**: quando le Issue arrivano a 20+ aperti, un Project con priorità custom è meglio della Issue list piatta.

### Project proposto: "Heuresys Roadmap"

Setup (~15 minuti via Web UI):

1. `https://github.com/Spen-Zosky?tab=projects` → `New project`
2. Template: `Roadmap` (oppure `Team planning`)
3. Custom fields:
   - `Priority` (single-select: P0/P1/P2/P3)
   - `Effort` (single-select: XS/S/M/L/XL)
   - `Area` (single-select: api/web/db/docs/infra)
   - `MVP` (iteration: MVP-1, MVP-2a, MVP-2b, MVP-3, MVP-4)
4. Viste:
   - **Board** (default): colonne Todo / In Progress / In Review / Done.
   - **Roadmap**: per timeline (richiede `Start date` + `End date` field).
   - **Table**: per filtering veloce (`Priority` discendente).
5. Aggiungi item dal Web UI: cerca "owner/repo#N" o "owner/repo" + titolo per linking.

### Custom fields utili (template per "Heuresys Roadmap")

| Field | Tipo | Valori |
|---|---|---|
| Status | Single-select | Backlog, Ready, In progress, In review, Done, Blocked |
| Priority | Single-select | P0 (urgent), P1 (high), P2 (medium), P3 (low) |
| Effort | Single-select | XS (<1h), S (1-4h), M (1-2d), L (3-5d), XL (>1w) |
| Area | Single-select | api, web, db, infra, docs |
| MVP | Iteration | settimanali o per milestone |

---

## 4. Comandi / checklist

### CLI

```bash
# Lista i tuoi project
gh project list --owner Spen-Zosky

# Crea
gh project create --owner Spen-Zosky --title "Heuresys Roadmap"

# View
gh project view 1 --owner Spen-Zosky
gh project view 1 --owner Spen-Zosky --web

# Lista item di un project
gh project item-list 1 --owner Spen-Zosky --limit 30

# Aggiungi Issue/PR esistente
gh project item-add 1 --owner Spen-Zosky --url https://github.com/Spen-Zosky/heuresys-advanced/issues/42

# Aggiungi draft (item senza Issue/PR)
gh project item-create 1 --owner Spen-Zosky --title "Investigate Redis cache layer" --body "Considera per MVP-3"

# Edit field di un item (richiede ID, vedi `item-list`)
gh project item-edit --project-id PVT_xxx --id PVTI_xxx --field-id PVTSSF_xxx --single-select-option-id ABC123
```

> Nota: l'API Projects v2 è in **GraphQL**. Il CLI `gh project` astrae le query comuni; per casi avanzati (es. report custom) usa direttamente `gh api graphql -f query='...'`.

### Web UI essenziale

- `https://github.com/users/<username>/projects` — lista personal.
- Dal repo: tab `Projects` → mostra i project a cui i suoi Issue/PR sono linkati.
- Filtri rapidi nella table view: `status:"In progress" priority:P0`
- Bulk edit: seleziona N item → tasto destro → assegna field a tutti.

### Checklist "primo Project"

- [ ] Decidi lo scope (single-repo o cross-repo)
- [ ] Crea il project dal template più vicino
- [ ] Definisci 3-5 custom fields (non di più — overhead)
- [ ] Definisci una vista Board (sempre) + 1 secondaria (Table o Roadmap)
- [ ] Aggiungi 5-10 item esistenti (no draft) per "popolarlo"
- [ ] Setup 1-2 automation rules (es. "Close Issue → Status=Done")

---

## 5. Trappole comuni

- **Custom fields proliferation**: tendenza a creare 15 field. Inutile. 3-5 max. Se ne servono di più, separa in più project.
- **Project + Milestone duplicano**: GitHub Milestone e Project "Iteration" overlappano. Convenzione: usa Milestone per le release versionate (`v1.0`, `v2.0`), Iteration per sprint settimanali.
- **Drag-and-drop nascosto su mobile**: il web UI Projects v2 ha funzionalità limitate su mobile. Lavoraci da desktop.
- **Privato vs pubblico**: i Project hanno visibilità propria (private/public), indipendente dai repo linkati. Un Project "public" è visibile a chiunque sappia l'URL — verifica.
- **Automation regole limitate**: rispetto a Linear/Jira, l'automation di Projects v2 è ancora basic. Workflow custom richiedono GitHub Actions con `gh api graphql` per editare item.
- **Project archive vs delete**: archiviare un Project lo nasconde dalle viste ma lo conserva. `gh project delete` invece è irreversibile.

---

## 6. Per approfondire

- **About Projects**: <https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects>
- **Best practices**: <https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/best-practices-for-projects>
- **Automation**: <https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project>
- **GraphQL API**: <https://docs.github.com/en/graphql/reference/objects#projectv2>
- **gh project CLI ref**: <https://cli.github.com/manual/gh_project>
- File curriculum: [01-issues.md](01-issues.md) · [03-pull-requests.md](03-pull-requests.md)
