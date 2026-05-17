# Curriculum GitHub — indice + roadmap di rilascio

> **A chi è rivolto**: a Enzo Spenuso (sole-coder). L'obiettivo è costruire un mental model strutturato di GitHub partendo da zero, **ancorato ai due repo concreti** `Spen-Zosky/heuresys-advanced` e `Spen-Zosky/ux-design-shared`.

> **Approccio**: per ogni concetto GitHub introduci (a) la spiegazione "generica", (b) la sezione "applicato ai nostri repo" che dice cosa è/cosa potrebbe essere, (c) un block "comandi/checklist" pronto all'uso. Niente walkthrough lunghi che duplicano la doc ufficiale `docs.github.com` — l'indirizzo è sempre linkato come fonte di verità.

> **Lingua**: italiano, con i termini tecnici inglesi inline (`pull request`, `workflow`, ecc.). I termini sono raccolti nel [glossario](00-glossario.md).

---

## Come leggere questo curriculum

Ogni file di contenuto segue lo **stesso template**:

| Sezione | Cosa contiene |
|---|---|
| 1. **Concetto** | Spiegazione generica del concetto GitHub. Niente menzione dei nostri repo. |
| 2. **Modello mentale** | Diagramma testuale, tabella o flow di 30 secondi per fissare la struttura. |
| 3. **Applicato ai nostri repo** | Tabella `heuresys-advanced` × `ux-design-shared` × `stato/proposta/effort`. |
| 4. **Comandi / checklist** | Azioni concrete (CLI + Web UI), in ordine. |
| 5. **Trappole comuni** | Pitfall, errori frequenti, gotcha. |
| 6. **Per approfondire** | Link a doc ufficiale + 2-3 risorse esterne di qualità. |

Lettura stimata per file: **≤15 minuti**. Tutti i file sono autoconsistenti — puoi leggerli in qualsiasi ordine, ma l'ordine numerato suggerisce un percorso di apprendimento naturale.

---

## Struttura della directory

```
docs/github/
├── README.md                                ← (sei qui)
├── 00-glossario.md                          Termini chiave (~60-80 voci)
│
├── 01-fondamenti/
│   ├── 01-cosa-e-github.md                  Cosa offre · git vs GitHub · ecosistema · pricing
│   ├── 02-account-e-repo.md                 Account, profilo, visibility, scopes
│   ├── 03-git-flow.md                       Clone, branch, commit, push, history, tag, rebase
│   └── 04-readme-e-markdown.md              README, GFM, mermaid, alerts, badges
│
├── 02-collaborazione/
│   ├── 01-issues.md                         Issues, labels, milestones, templates
│   ├── 02-branches.md                       Branching model · trunk-based vs GitFlow
│   ├── 03-pull-requests.md                  PR lifecycle, reviews, suggestions
│   ├── 04-projects.md                       Projects v2 (table/board/roadmap)
│   └── 05-discussions.md                    Discussions vs Issues — quando usarle
│
├── 03-automazione/
│   ├── 01-actions-fondamenti.md             Workflow · jobs · runners · marketplace
│   ├── 02-actions-ricette.md                Ricette riusabili (lint, test, build, deploy)
│   ├── 03-secrets-e-variabili.md            Secrets · vars · environments · OIDC
│   └── 04-workflow-storybook.md             Anatomia del nostro `deploy-storybook.yml`
│
├── 04-publishing/
│   ├── 01-pages-fondamenti.md               Pages · branch source vs workflow · DNS · HTTPS
│   ├── 02-pages-il-nostro-caso.md           Walkthrough Storybook live · MSW · sub-path
│   ├── 03-releases-e-tags.md                Tag · GitHub Releases · semver · CHANGELOG
│   └── 04-packages.md                       GitHub Packages (npm · container · maven)
│
├── 05-security/
│   ├── 01-secret-hygiene.md                 `.gitignore` · secret scanning · push protection
│   ├── 02-dependabot.md                     Alerts · automated PR
│   ├── 03-code-scanning.md                  CodeQL · custom queries
│   ├── 04-signed-commits.md                 GPG vs SSH signing · verifiche
│   └── 05-branch-protection.md              Required reviews · status checks
│
├── 06-tooling/
│   ├── 01-gh-cli.md                         `gh` comandi essenziali · ricette
│   ├── 02-web-ui-tour.md                    Tab del repo · settings · insights
│   └── 03-integrazioni.md                   VS Code · JetBrains · mobile
│
├── 07-nostri-repo/
│   ├── 01-stato-corrente.md                 Snapshot di OGGI — cosa è attivo, cosa dorme
│   ├── 02-heuresys-advanced.md              Settings · segreti · branch model · prossimi step
│   ├── 03-ux-design-shared.md               Settings · Pages · workflow · path verso npm
│   └── 04-interazioni-tra-repo.md           pnpm `link:` oggi · npm `@spen-zosky/ui` futuro
│
└── 08-roadmap.md                            Ordine consigliato di adozione (10-15 step)
```

---

## Roadmap di rilascio

Il curriculum viene rilasciato in **7 batch progressivi**. Ogni batch è un commit atomico autoconsistente.

| Batch | Sezione | File | Stato |
|---|---|---|---|
| **1** | Fondamenta + stato | `README.md` · `00-glossario.md` · `01-fondamenti/*` · `07-nostri-repo/01-stato-corrente.md` | ✅ disponibile |
| **2** | Collaborazione | `02-collaborazione/*` (5 file) | ✅ disponibile |
| **3** | Automazione | `03-automazione/*` (4 file) | ✅ disponibile |
| **4** | Publishing | `04-publishing/*` (4 file) | ✅ disponibile |
| **5** | Security | `05-security/*` (5 file) | ✅ disponibile |
| **6** | Tooling | `06-tooling/*` (3 file) | ✅ disponibile |
| **7** | Repo-specific + roadmap | `07-nostri-repo/{02,03,04}.md` · `08-roadmap.md` | ✅ disponibile |

**Totale a regime**: 1 README + 1 glossario + 32 file di contenuto = **34 file**.

---

## Convenzioni

- **Snippet CLI**: sempre in fenced code block con language hint (` ```bash ` o ` ```powershell `).
- **Snippet Web UI**: descritti come breadcrumb (es. `Settings → Pages → Build and deployment → Source: GitHub Actions`).
- **Link interni**: relativi (es. `[glossario](00-glossario.md)` o `[issues](../02-collaborazione/01-issues.md)`).
- **Link a doc ufficiale**: completi e con anchor specifico (es. `https://docs.github.com/en/actions/learn-github-actions/finding-and-customizing-actions#using-the-latest-version`).
- **Riferimenti ai nostri repo**: sempre con prefix `Spen-Zosky/`.
- **Emoji**: solo per indicatori di stato nelle tabelle (`✅` `🚧` `❌` `⚠️`). Mai nel body.

---

## Quando il curriculum si aggiorna

Le condizioni che innescano un aggiornamento sono **deterministiche**:

1. **Nuova feature attivata** su uno dei repo → si aggiunge una nota datata in `07-nostri-repo/<repo>.md` + si aggiorna il "stato corrente".
2. **Nuovo batch consegnato** → si aggiornano le righe ✅/🚧 nella tabella sopra.
3. **GitHub annuncia una feature rilevante** → si aggiunge una nota nel capitolo del dominio + nel glossario.
4. **Si scopre una trappola sul campo** → si aggiunge alla sezione "Trappole comuni" del file pertinente.

Il file `07-nostri-repo/01-stato-corrente.md` è il **punto zero** verificabile via `gh api` ed è rigenerato all'inizio di ogni batch.

---

## Crediti

Curriculum redatto con [Claude Code](https://claude.com/claude-code) (Opus 4.7, 1M context). Plan in `C:\Users\enzospenuso\.claude\plans\vectorized-knitting-willow.md`.
