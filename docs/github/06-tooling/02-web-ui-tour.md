# 06.2 · GitHub Web UI — tour

> La Web UI di GitHub è densa. Centinaia di pagine + decine di scorciatoie. Questo file evidenzia le sezioni che usi davvero (e quelle che probabilmente ignori per default) sui nostri due repo.

---

## 1. Concetto

L'interfaccia web di un repo è organizzata in **tab principali** + **menu laterali contextual**. Quasi ogni pagina ha shortcut keyboard.

### Tab repo (default order)

| Tab | Cosa contiene | Quando usarla |
|---|---|---|
| **Code** | Tree file + README rendered | Default, navigazione |
| **Issues** | Issues list | Bug/feature/task tracking |
| **Pull requests** | PR list | Code review |
| **Discussions** | Forum (se abilitato) | Q&A, idee |
| **Actions** | Workflow runs | CI/CD monitoring |
| **Projects** | Boards | Cross-issue work |
| **Wiki** | Markdown pages | Doc collaborative (raro) |
| **Security** | Alerts (CodeQL, Dependabot, Secret) | Audit security |
| **Insights** | Stats: traffic, contributors, dependency graph | Analisi |
| **Settings** | Config repo (solo admin) | Setup feature |

### Shortcut keyboard universali

Premi `?` su qualsiasi pagina GitHub per la lista completa. I più utili:

| Shortcut | Cosa fa |
|---|---|
| `g i` | Vai a Issues |
| `g p` | Vai a Pull requests |
| `g a` | Vai a Actions |
| `g s` | Vai a Settings (se admin) |
| `t` | Apri file finder (in Code) |
| `s` | Focus search bar |
| `/` | Idem |
| `c` | Crea (issue, PR — dipende dal contesto) |
| `.` (punto) | Apri `github.dev` (VS Code in browser) sul repo corrente |

### Pagine sotto-utilizzate

Alcune sezioni che probabilmente ignori ma valgono la pena:

1. **Insights → Traffic** — chi visita il repo, da dove. Per i nostri repo (0 audience): vuota. Quando avrai visibilità, utile.

2. **Insights → Dependency graph** — lista delle dependency parsate dai tuoi `package.json`. Click su una dipendenza → lista dei consumer di quella dep (per audit security).

3. **Insights → Network** — visualizzazione grafica dei branch e fork. Sui nostri repo (1 branch, 0 fork): un puntino. Su repo con tanti contributor, è bellissimo.

4. **Insights → Forks** — chi ha forkato. Per il primo "fan" di un tuo progetto open source.

5. **Code → "Go to file"** (tasto `t`): file finder fuzzy del repo. Velocissimo per navigazione, in particolare se l'AST del repo è grande.

6. **Code → file `.md` → "Outline"** (tasto `Ctrl+/`): TOC del file laterale.

7. **Compare** (`<repo>/compare`): diff arbitrari tra branch / tag / commit. Es. `compare/v0.1.0...v0.2.0` per generare manualmente un changelog.

8. **Releases** (anche se vuota): pagina raggiungibile a `<repo>/releases`. Tab nel sidebar destra della pagina home.

9. **Marketplace search**: per cercare un'Action invece di scrivere YAML from scratch. <https://github.com/marketplace?type=actions>

---

## 2. Modello mentale

```
   ┌─────────────────────────────────────────────────────────┐
   │   github.com/<owner>/<repo>                             │
   │                                                         │
   │   ╔════ Header ═════════════════════════════════════╗   │
   │   ║ Watch · Fork · Star ·  Public/Private chip      ║   │
   │   ╠═════════════════════════════════════════════════╣   │
   │   ║ Code · Issues · PR · Discussions · Actions · …  ║   │
   │   ╚═════════════════════════════════════════════════╝   │
   │                                                         │
   │   ┌─ Main area ─────────────┐  ┌─ Sidebar ──┐           │
   │   │ Tree file               │  │ About      │           │
   │   │ Search box              │  │ Topics     │           │
   │   │ Latest commit row       │  │ Releases   │           │
   │   │ README rendered         │  │ Packages   │           │
   │   │                         │  │ Languages  │           │
   │   └─────────────────────────┘  └────────────┘           │
   └─────────────────────────────────────────────────────────┘
```

---

## 3. Applicato ai nostri repo

### `heuresys-advanced` — tour del menu

URL: <https://github.com/Spen-Zosky/heuresys-advanced>

| Tab | Stato | Cosa vedi |
|---|---|---|
| Code | Tree + README v1.0 | 14 file top-level + cartelle apps/packages/db/docs/tests |
| Issues | 0 open · 0 closed | Tab attiva ma vuota |
| Pull requests | 0 open · 0 closed | Vuota |
| Discussions | Disabled | Tab non mostrata |
| Actions | 0 workflow | "Get started with GitHub Actions" wizard mostrato |
| Projects | 0 project | "Create a project" prompt |
| Wiki | Enabled vuoto | Pagina "Welcome to the wiki!" |
| Security | Alerts (vuoti) | Bandiera "Set up security advisory" mostrata |
| Insights | Stats minime | Pulse + Contributors mostrano solo te |
| Settings | Admin (solo tu) | Hub di config |

### `ux-design-shared` — tour del menu

URL: <https://github.com/Spen-Zosky/ux-design-shared>

Stesso layout. Differenze rilevanti:
- **Actions**: 1 workflow `Deploy Storybook to GitHub Pages` con 3 run nella history.
- **Environments** (sidebar Code): `github-pages` con URL al sito live.
- **Settings → Pages**: configurato come `source: GitHub Actions`.
- **Code → sidebar destra**: link al sito Pages (`Deployments` section).

### Settings tab — riferimento rapido

Tutte le voci, in ordine di apparizione:

1. **General**
   - Repository name, description, homepage URL, topics
   - Default branch (`main`)
   - Features: Wiki, Issues, Projects, Discussions
   - Pull requests: merge strategies, auto-delete branch
   - Archives, transfers, delete
2. **Access**: collaborator e access settings
3. **Branches**: classic branch protection rules (legacy)
4. **Tags**: tag protection rules
5. **Rules → Rulesets**: moderni vincoli su branch + tag
6. **Actions**:
   - General — permission policy
   - Runners (self-hosted setup)
   - Workflow permissions default
   - Variables / Secrets
7. **Webhooks**: HTTP callback su eventi
8. **Environments**: namespace + protection
9. **Codespaces**: cloud dev environment config
10. **Pages**: source + custom domain
11. **Security**:
    - Security & analysis (Dependabot, Secret scanning, Code scanning)
    - Code security and analysis configuration
12. **Integrations**: GitHub Apps installate
13. **Email notifications**: opt-in/out per categoria
14. **Autolink references**: hot-link `JIRA-123` a Jira (utile in org)
15. **Notifications**: subscription al repo

---

## 4. Comandi / checklist

### Aprire spesso

Per navigazione veloce non da CLI:

```bash
# Da terminale, apri il repo
gh repo view --web              # se sei in cartella git
gh repo view Spen-Zosky/heuresys-advanced --web    # esplicito

# Apri sezione specifica
gh repo view Spen-Zosky/heuresys-advanced/issues --web  # NON funziona, --web apre solo root
# Workaround:
start https://github.com/Spen-Zosky/heuresys-advanced/issues   # Win
open  https://github.com/Spen-Zosky/heuresys-advanced/issues   # Mac
```

### `github.dev` — VS Code nel browser

Tasto `.` (punto) sul repo apre `github.dev/<owner>/<repo>` — VS Code completo in browser. Editing diretto, commit + push (ma niente terminale). Perfetto per:
- Fix di tipo / typo veloci
- Esplorare un repo grande senza clone locale
- Modificare file da telefono/tablet

URL diretta: <https://github.dev/Spen-Zosky/heuresys-advanced>

### URL pattern utili (impara questi)

```
<repo>/blob/main/path/to/file.ts              View file
<repo>/blob/main/path/to/file.ts#L42-L50      Permalink a range di linee
<repo>/raw/main/path/to/file.ts               Raw content (no UI)
<repo>/commit/<sha>                           Singolo commit
<repo>/compare/main...feature/foo             Diff branch
<repo>/compare/v1.0.0...v1.1.0                Diff release
<repo>/network                                Network graph
<repo>/pulse                                  Pulse di attività
<repo>/graphs/contributors                    Contributor stats
<repo>/graphs/traffic                         Traffic (admin only)
<repo>/dependents                             Repo che dipendono da te (per public lib)
<repo>/releases/tag/v1.0.0                    Specifica release
<repo>/wiki/Page-Name                         Wiki page
<repo>/settings                               Settings hub (admin)
```

### Permalink a una riga di codice

In Code view:
1. Click sul numero di riga (es. riga 42 di `file.ts`).
2. URL diventa `<repo>/blob/main/file.ts#L42`.
3. Shift+click su riga 50: `<repo>/blob/main/file.ts#L42-L50` (range).
4. Tasto `y` (yank): URL diventa permalink al commit SHA invece di `main` → resta valido anche se file cambia.

### File finder + search

Su `Code` tab:
- `t` → file finder fuzzy (super veloce)
- `/` → search del repo (codice, file, issue)

Search syntax avanzata:
```
language:typescript /useState/    # typescript files contenenti useState
extension:md /TODO/                # tutti i Markdown con TODO
filename:tsconfig.json             # solo file con quel nome
path:apps/api                      # solo dentro apps/api
```

### Notifications inbox

`https://github.com/notifications`:
- All mentions, review request, issue update.
- Filter sidebar (Repository, Reason, Type, ecc.).
- Tasto `e` archive, `r` mark unread.
- Subscribe levels per repo: All activity / Participating + @mentions / Ignore.

### Checklist UI fluency

- [ ] Sai navigare con `g i`, `g p`, `g a`.
- [ ] Sai usare `t` (file finder) sul Code tab.
- [ ] Sai aprire `github.dev` con `.`.
- [ ] Sai linkare permalink con `y`.
- [ ] Conosci il URL pattern `/compare/A...B` per diff arbitrari.
- [ ] Sai trovare `Insights → Dependency graph` per audit.

---

## 5. Trappole comuni

- **URL con `<branch>` invece di SHA**: link da copia-incolla puntano a `main`. Quando `main` avanza, il link può cambiare significato. Usa `y` per ottenere permalink al SHA.
- **`Code` tab default branch**: se il default è `master` (vecchio) ma `main` esiste, alcuni link rimangono al vecchio. Verifica `Settings → General → Default branch`.
- **Markdown rendering vs raw**: `<repo>/blob/main/file.md` mostra rendered + link al raw. Per import dal raw, sempre `<repo>/raw/main/file.md`.
- **`Compare` con base/head invertiti**: `compare/A...B` mostra "cosa B ha che A non ha". `compare/B...A` è l'opposto. Confondibile.
- **`Search` con language filter sbagliato**: GitHub indicizza ogni 1-3 giorni — file appena pushato può non comparire. Aspetta.
- **Settings con paginazione nascosta**: alcune sezioni (Webhooks, Deploy keys) hanno paginazione subtle. Verifica scroll down.
- **Wiki vs `docs/**` vs Pages**: 3 posti dove può vivere la doc. Convenzione:
  - **Wiki**: doc collaborative editabili senza PR (non versionate insieme al codice).
  - **`docs/**`**: doc versionate, parte del repo.
  - **Pages**: deploy pubblico dei `docs/**` o di static site dedicato.
- **Insights → Traffic** richiede admin del repo. I view counter non sono pubblici.

---

## 6. Per approfondire

- **GitHub keyboard shortcuts**: <https://docs.github.com/en/get-started/accessibility/keyboard-shortcuts>
- **Searching code**: <https://docs.github.com/en/search-github/searching-on-github/searching-code>
- **`github.dev` web editor**: <https://docs.github.com/en/codespaces/the-githubdev-web-based-editor>
- **Customize your repo**: <https://docs.github.com/en/repositories/creating-and-managing-repositories/customizing-your-repository-with-extensions>
- File curriculum: [01-gh-cli.md](01-gh-cli.md) · [03-integrazioni.md](03-integrazioni.md)
