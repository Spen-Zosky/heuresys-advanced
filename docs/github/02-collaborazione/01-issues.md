# 02.1 · Issues

> Le Issue sono il sistema integrato di tracking di GitHub: bug, feature request, task, idee. Sostituiscono Jira/Linear per progetti che vivono interamente in GitHub. Per un sole-coder valgono come "to-do list ricca + ricerca + storia decisionale".

---

## 1. Concetto

Un'**Issue** è un thread di discussione associato a un repo, con:

- **Titolo** (≤256 char) — riassunto.
- **Body** in GFM — descrizione completa, può includere immagini, code block, task list.
- **Stato**: `open` / `closed` (`completed` o `not planned`).
- **Numero** progressivo per repo (`#1`, `#2`, ...) — non cambia mai.
- **Autore**, **assignee** (chi ci lavora), **reviewer** (su PR).
- **Label** (etichette colorate): bug, enhancement, documentation, ecc.
- **Milestone**: raggruppamento con scadenza opzionale (es. "v1.0").
- **Project**: linking a un Project v2 (board).
- **Linked PR**: PR che chiudono l'issue (`Closes #42`).
- **Reactions**: emoji come thumbs-up per voto leggero.
- **Comments**: thread di risposta con menzioni `@user` e riferimenti incrociati `#42`, `owner/repo#42`.

Possono essere creati da:
- Web UI (`Issues` tab → `New issue`).
- CLI: `gh issue create --title "..." --body "..."`.
- API: `POST /repos/{owner}/{repo}/issues`.
- Webhooks da servizi esterni (es. Sentry → crea issue su error).
- Issue forms YAML (template strutturati).

---

## 2. Modello mentale

```
       ISSUE  #42
       ├── title: "Login redirect breaks for READ_ONLY users"
       ├── state: open
       ├── labels: bug · auth · severity/high
       ├── milestone: MVP-3
       ├── assignee: @Spen-Zosky
       ├── linked PRs: #45 (open), #48 (merged)
       ├── linked project: "MVP-3 Roadmap" board
       └── body + comments thread

  Cross-references:
       #41 (also-affected, manually mentioned)
       owner/altro-repo#7 (cross-repo link)

  Lifecycle:
       open → in-progress (via project status) → closed (completed | not planned)
```

3 modi per chiudere automaticamente un'issue:
1. Da PR: include `Closes #42` (o `Fixes #42`, `Resolves #42`) nel body del PR → al merge l'issue si chiude.
2. Da commit: stesso magic word `Closes #42` nel commit message merged in `main`.
3. Manualmente: click `Close issue` nella UI / `gh issue close 42`.

---

## 3. Applicato ai nostri repo

| Repo | Issues attive | Issue mai usate? |
|---|---|---|
| `heuresys-advanced` | 0 open · 0 closed | ❌ mai usate |
| `ux-design-shared` | 0 open · 0 closed | ❌ mai usate |

Per ora la "to-do list" vive in:
- `HANDOFF.md` (stato di sessione)
- `NEXT_SESSION_MVP_2A.md` (doctrine)
- `MEMORY.md` (auto-memory) e file `memory/*.md` per cross-session

**Quando attivarle?** Tre soglie naturali:

1. **Tracciare bug noti che non risolvi subito**. Oggi: un bug "minore" rilevato durante MVP-2a (es. `me/repository.ts::listMyPositions()` aveva colonne sbagliate) è stato fixato immediatamente. Domani, quando avrai più di un task in coda, le Issue ti permettono di non perderle.

2. **Decisioni architetturali / ADR-leggere**. Ogni Issue è una traccia persistente di "perché abbiamo deciso X". Più leggera di un ADR formale, più strutturata di una nota in HANDOFF.

3. **Linkare i PR alle motivazioni**. Quando inizierai a fare PR (Batch 5 branch protection), la chain "Issue → branch → PR → merge → close" diventa il flusso standard.

**Cosa attivare oggi (proposta minima)**:

| Setup | Effort | Valore |
|---|---|---|
| 3-5 label di base (`bug`, `enhancement`, `documentation`, `tech-debt`, `question`) | 10 min via Web UI o CLI | Basso ma serve per filtrare |
| 1 Issue template (`.github/ISSUE_TEMPLATE/bug.md`) | 15 min | Forza struttura sui bug futuri |
| Aprire la prima Issue di esempio (es. "Add LICENSE file to ux-design-shared") | 5 min | Sblocca l'abitudine |

Nessuna delle suddette è obbligatoria — il curriculum **documenta** la feature; l'attivazione è decisione tua.

---

## 4. Comandi / checklist

### CLI essenziali

```bash
# Crea
gh issue create --title "Add LICENSE" --body "Decidere license (MIT vs Apache 2.0) e committare LICENSE.md"

# Lista
gh issue list                              # tutte le open
gh issue list --state closed --limit 10
gh issue list --label bug                  # filtra per label
gh issue list --assignee @me               # le tue
gh issue list --milestone "MVP-3"

# Vedi dettaglio
gh issue view 42
gh issue view 42 --web                     # apre nel browser

# Modifica
gh issue edit 42 --add-label bug --add-label severity/high
gh issue edit 42 --milestone "MVP-3"
gh issue edit 42 --add-assignee Spen-Zosky

# Chiudi / riapri
gh issue close 42 --reason completed
gh issue close 42 --reason "not planned"
gh issue reopen 42

# Commenta
gh issue comment 42 --body "Verified on staging, deploying tomorrow."

# Trasferisci a un altro repo (mantiene cronologia)
gh issue transfer 42 Spen-Zosky/altro-repo
```

### Crea labels strutturate

```bash
# Type
gh label create bug          --color d73a4a --description "Errore funzionale o regressione"
gh label create enhancement  --color a2eeef --description "Nuova feature o miglioramento"
gh label create documentation --color 0075ca --description "Aggiornamento documentazione"
gh label create tech-debt    --color e4e669 --description "Refactor, cleanup, riduzione complessità"
gh label create question     --color d876e3 --description "Discussione / chiarimento"

# Severity
gh label create severity/critical --color b60205
gh label create severity/high     --color d93f0b
gh label create severity/medium   --color fbca04
gh label create severity/low      --color 0e8a16

# Area (custom per heuresys-advanced)
gh label create area/api    --color 5319e7
gh label create area/web    --color 1d76db
gh label create area/db     --color 006b75
gh label create area/auth   --color 0052cc
gh label create area/docs   --color c5def5
```

### Issue template YAML (più strutturato di Markdown)

File: `.github/ISSUE_TEMPLATE/bug-report.yml`:

```yaml
name: Bug report
description: Riporta un comportamento difettoso o regressione
title: "[Bug]: "
labels: ["bug"]
body:
  - type: input
    id: summary
    attributes:
      label: Sintesi
      placeholder: Cosa va male in una frase
    validations:
      required: true
  - type: textarea
    id: reproduce
    attributes:
      label: Come riprodurre
      description: Step-by-step + dati di input
      placeholder: |
        1. Login as `employee_test@rtl-bank.test`
        2. Navigate to /me/profile
        3. Click "Salva"
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Comportamento atteso
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: Comportamento osservato (con log/screenshot se possibile)
  - type: dropdown
    id: area
    attributes:
      label: Area
      options:
        - api
        - web
        - db
        - auth
        - docs
```

### Web UI shortcuts

- `Issues` tab → `New issue` (se ci sono template, mostra selettore)
- `Filter` box supporta query string ricca:
  - `is:open is:issue label:bug assignee:@me sort:created-desc`
  - `is:closed milestone:"MVP-3" -label:not-planned`
- Tasti `g i` (go issues), `c` (create) — quasi tutta la UI ha shortcut, vedi `?` su qualsiasi pagina GitHub.

### Checklist primo Issue ben formato

- [ ] Titolo descrittivo (≤80 char, no buzzword)
- [ ] Label di tipo (`bug` / `enhancement` / `question`)
- [ ] Area di impatto (`area/api`, `area/web`, ...)
- [ ] Severity se bug
- [ ] Body con: contesto, passi, atteso, osservato, ambiente
- [ ] Milestone se applicabile
- [ ] Linkare Issue collegate con `#N`

---

## 5. Trappole comuni

- **Issue numbers sono globali nel repo**: PR e Issue condividono lo stesso namespace. Quindi `#42` può essere un'issue o un PR — la UI li distingue ma testualmente sono indistinguibili.
- **Label "Wontfix"**: una vecchia convenzione, ma `closed as not planned` è più chiaro e ufficiale.
- **Issue come task list infinita**: Issue ben usate sono "discrete e chiudibili". Una task list ricorrente si tiene meglio in un `Project v2` con stato `In progress`.
- **Forzare struttura troppo presto**: per un sole-coder, partire con 5 label e zero template è meglio di partire con 30 label e 8 template — il sistema deve aiutare, non frenare.
- **Dimenticarsi di chiudere**: Issue lasciate aperte per mesi diventano rumore. Audit periodico (`gh issue list --state open --limit 50`) ogni 1-2 mesi.
- **Magic word in commit non-mergeable**: `Closes #42` in un commit su un branch feature non chiude l'issue finché il branch non è merged in `main` (default branch).

---

## 6. Per approfondire

- **Issues docs**: <https://docs.github.com/en/issues>
- **Issue forms (YAML templates)**: <https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms>
- **Linking PR to issues**: <https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue>
- **Issue search syntax**: <https://docs.github.com/en/issues/tracking-your-work-with-issues/filtering-and-searching-issues-and-pull-requests>
- File curriculum: [02-branches.md](02-branches.md) · [03-pull-requests.md](03-pull-requests.md) · [04-projects.md](04-projects.md)
