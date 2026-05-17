# 03.1 · GitHub Actions — fondamenti

> GitHub Actions è la piattaforma di **CI/CD integrata**. Esegue workflow YAML su runner GitHub-hosted (o tuoi) in risposta a eventi (push, PR, schedule, manuale). È il building block di tutta l'automazione: test, build, deploy, release, dependency update.

---

## 1. Concetto

Un **workflow** è un file YAML in `.github/workflows/*.yml`. Contiene uno o più **jobs**, ognuno con una sequenza di **steps**. Ogni step è uno shell command o l'invocazione di un'**action** (riusabile, da Marketplace o custom).

### Anatomia base

```yaml
name: My Workflow                       # nome mostrato nella UI
on:                                     # eventi che lo triggerano
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:                    # trigger manuale

permissions:                            # GITHUB_TOKEN scopes
  contents: read
  pages: write

jobs:
  my-job:                               # ID del job
    name: My job display name
    runs-on: ubuntu-latest              # runner (ubuntu/macos/windows/self-hosted)
    steps:
      - uses: actions/checkout@v4       # action ufficiale
      - name: Setup Node
        uses: actions/setup-node@v4
        with: { node-version: "20" }
      - name: Install
        run: npm install --legacy-peer-deps
      - name: Run tests
        run: npm test
```

### Concetti chiave

| Termine | Definizione |
|---|---|
| **Workflow** | File YAML in `.github/workflows/`. Trigger + jobs. |
| **Job** | Sequenza di step su un singolo runner. Default: paralleli tra loro. |
| **Step** | Singolo comando shell o invocazione action. Sequenziali nel job. |
| **Action** | Unità riusabile (es. `actions/checkout@v4`). Marketplace o repo proprio. |
| **Runner** | Macchina che esegue il job. GitHub-hosted (gratis, con quote) o self-hosted. |
| **Event** | Trigger del workflow (push, PR, schedule, dispatch, repository_dispatch, ecc.). |
| **Job matrix** | Esegui lo stesso job con variabili diverse (es. node 18/20/22 paralleli). |
| **Concurrency group** | Limita esecuzioni concorrenti dello stesso workflow. |
| **Environment** | Namespace di secrets + approvals (es. `staging`, `production`). |
| **Artifact** | File prodotto da un job, scaricabile o passabile tra job. Vive 90 giorni. |
| **Cache** | Cache persistente cross-run (es. `node_modules`). |

### Eventi più usati

| Evento | Quando si triggera |
|---|---|
| `push` | Commit pushato su un branch (filtrabile con `branches:`) |
| `pull_request` | PR aperto, sincronizzato (nuovo push), riaperto |
| `pull_request_target` | Come sopra ma con secrets pieni (⚠️ rischio sicurezza) |
| `schedule` | Cron string (es. `0 0 * * 0` = ogni domenica mezzanotte UTC) |
| `workflow_dispatch` | Trigger manuale dalla UI o `gh workflow run` |
| `release` | Release pubblicata (`types: [published]`) |
| `issues` | Issue aperta/chiusa/etichettata |
| `repository_dispatch` | Webhook esterno via API |

### Runner gratuiti

Per repo public — quota **unlimited** (yes, davvero) di minuti GitHub-hosted. Per repo private:
- Free tier: 2000 min/mese Linux (Windows/macOS contano 2x e 10x rispettivamente).
- Pro tier: 3000 min/mese.

Standard runner Linux (`ubuntu-latest`): 4 CPU, 16 GB RAM, 14 GB SSD.

### Permissions del `GITHUB_TOKEN`

Ogni workflow ha un token automatico (`secrets.GITHUB_TOKEN`) con permessi scopati per repo. Di default è **read** su quasi tutto. Per scrivere (push, PR comments, deploy Pages, etc.) devi richiedere il permesso esplicito nel YAML:

```yaml
permissions:
  contents: write           # push
  pull-requests: write      # commenti PR
  pages: write              # deploy Pages
  id-token: write           # OIDC (cloud auth)
  packages: write           # publish package
```

Best practice: dichiara `permissions:` minimi a livello workflow + override più stretto a livello job se serve.

---

## 2. Modello mentale

```
                   ┌────────────────────────────────────────┐
                   │  EVENT (push, PR, schedule, dispatch)  │
                   └────────────┬───────────────────────────┘
                                ▼
                   ┌────────────────────────────────────────┐
                   │              WORKFLOW                  │
                   │  .github/workflows/<name>.yml          │
                   │  - on: ...                             │
                   │  - permissions: ...                    │
                   │  - jobs: { build, test, deploy }       │
                   └────────────┬───────────────────────────┘
                                │ parallel by default
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
        ┌──────────┐      ┌──────────┐      ┌──────────┐
        │  job:    │      │  job:    │      │  job:    │
        │  build   │      │  test    │      │  lint    │
        │ ubuntu   │      │ ubuntu   │      │ ubuntu   │
        │ steps[]  │      │ steps[]  │      │ steps[]  │
        └────┬─────┘      └──────────┘      └──────────┘
             │ needs: build
             ▼
        ┌──────────┐
        │  job:    │
        │  deploy  │
        │ steps[]  │
        └──────────┘
```

Default: tutti i job paralleli. Con `needs: [build]` un job aspetta gli altri.

---

## 3. Applicato ai nostri repo

### Stato attuale

| Repo | Workflow attivi | Run history |
|---|---|---|
| `heuresys-advanced` | **0** | — |
| `ux-design-shared` | **1**: `.github/workflows/deploy-storybook.yml` | 3 run (2 ✅ + 1 ❌ alla prima setup) |

### Il workflow Storybook (approfondito in `04-workflow-storybook.md`)

`ux-design-shared/.github/workflows/deploy-storybook.yml`:
- Trigger: `push:branches:[main]` + `workflow_dispatch`
- 2 jobs sequenziali: `build` (npm install + build) → `deploy` (uploads artifact + deploy-pages)
- Tempo medio: ~1m45s
- Permissions: `contents: read`, `pages: write`, `id-token: write`

### Cosa potresti aggiungere a `heuresys-advanced`

| Workflow proposto | Trigger | Cosa fa | Effort |
|---|---|---|---|
| `ci.yml` | push + PR | typecheck + vitest API + linting | basso (~30 min) |
| `e2e.yml` | push su main + nightly schedule | Playwright contro DB di test | medio (richiede gestione tunnel/seed) |
| `db-migrate-check.yml` | PR che tocca `db/migrations/*` | applica migration su DB ephemeral e fa dump diff | medio |
| `release.yml` | tag `v*` | crea GitHub Release + changelog | basso (release-please) |
| `dependabot-auto-merge.yml` | PR di Dependabot con label "automergeable" | merge auto se CI verde | medio |

**Priorità suggerita** (quando deciderai di attivarli):
1. `ci.yml` per typecheck + test API — ti dà un check "verde/rosso" su ogni push, prerequisito di branch protection.
2. `release.yml` se decidi di pubblicare release pubbliche.
3. `e2e.yml` se vuoi proteggere la SPA da regressioni.

---

## 4. Comandi / checklist

### CLI essenziali

```bash
# Lista workflow del repo
gh workflow list --repo Spen-Zosky/ux-design-shared

# View workflow file
gh workflow view deploy-storybook.yml --repo Spen-Zosky/ux-design-shared

# Lista run history
gh run list --repo Spen-Zosky/ux-design-shared --limit 10

# View singolo run
gh run view 25994151505 --repo Spen-Zosky/ux-design-shared
gh run view 25994151505 --log              # tutti i log
gh run view 25994151505 --log-failed       # solo step falliti

# Trigger manuale di un workflow
gh workflow run deploy-storybook.yml --repo Spen-Zosky/ux-design-shared
gh workflow run deploy-storybook.yml --ref main --field environment=production

# Re-run di un workflow (es. dopo fix)
gh run rerun 25994151505                   # solo job falliti
gh run rerun 25994151505 --failed
gh run rerun 25994151505 --debug           # con debug logging

# Cancel run
gh run cancel 25994151505

# Watch run live
gh run watch 25994151505

# Download artifact
gh run download 25994151505 --name storybook-static
```

### Anatomia minima di un nuovo workflow

File: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  typecheck-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - uses: pnpm/action-setup@v4
        with: { version: 9 }

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Test API
        run: pnpm --filter @heuresys/api test
```

### Checklist primo workflow

- [ ] Crea `.github/workflows/<name>.yml` (cartella va creata se manca).
- [ ] Trigger appropriati: `push:branches:[main]` + `pull_request:` per CI; `workflow_dispatch:` sempre utile per re-run manuale.
- [ ] `permissions:` minimi richiesti.
- [ ] `concurrency` per evitare run multipli sovrapposti sullo stesso branch.
- [ ] Usa **action ufficiali** (`actions/checkout@v4`, `actions/setup-node@v4`) → pinning della major version.
- [ ] Commit + push.
- [ ] Verifica nella tab `Actions` del repo che parta + verde.

### Matrix builds

Esempio test su Node 18 + 20 + 22 in parallelo:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20, 22]
    steps:
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }} }
      - run: npm test
```

Output: 3 job paralleli `test (18)`, `test (20)`, `test (22)`.

### Job che dipende da altri

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps: [...]
  test:
    needs: build       # parte solo se build verde
    runs-on: ubuntu-latest
    steps: [...]
  deploy:
    needs: [build, test]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps: [...]
```

### Artifact passaggio tra job

Job 1 produce → Job 2 consuma:

```yaml
jobs:
  build:
    steps:
      - run: mkdir dist && echo "hello" > dist/file.txt
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/
  publish:
    needs: build
    steps:
      - uses: actions/download-artifact@v4
        with: { name: build-output, path: ./downloaded }
      - run: ls downloaded/
```

---

## 5. Trappole comuni

- **YAML strict**: indentazione 2 spazi, no tab. Un solo carattere fuori posto rompe il workflow (in modo silente se la sintassi è ambigua).
- **`pull_request` vs `pull_request_target`**: il secondo ha accesso ai secret del base repo — usato spesso male, **rischio sicurezza grave** se eseguito codice del PR head. Default: usa `pull_request` (senza target).
- **`actions/checkout@v4` con `fetch-depth: 1`** (default): non hai la storia git completa. Se ti serve git tag history (es. per `release-please`), aggiungi `fetch-depth: 0`.
- **Permission denied al push**: il `GITHUB_TOKEN` di default è read-only. Aggiungi `permissions: { contents: write }`.
- **`actions/cache@v4` con key sbagliata**: cache shared tra branch può portare contaminazione. Best practice: includi `${{ hashFiles('**/package-lock.json') }}` nella key.
- **Concurrency group non-univoca**: rischio di cancel di run validi. Includi sempre `${{ github.ref }}` nella group.
- **Secrets accidentalmente in log**: GitHub maschera i secrets ma se li manipolate (es. `echo $SECRET | base64`), il base64 risultante **non è mascherato**. Usa `add-mask::` directive.
- **Versione action latched a `@main`**: instabile, può breakare senza warning. Pinning a major (`@v4`) o sha esatto è più sicuro.
- **Workflow che si auto-triggera** in loop: se il workflow committa, il `push` event ri-triggera il workflow. Risolvi con `if: github.actor != 'github-actions[bot]'` oppure event filter `pull_request:`.

---

## 6. Per approfondire

- **Actions overview**: <https://docs.github.com/en/actions/learn-github-actions/understanding-github-actions>
- **Workflow syntax**: <https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions>
- **Events reference**: <https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows>
- **Marketplace**: <https://github.com/marketplace?type=actions>
- **Security guides**: <https://docs.github.com/en/actions/security-guides>
- **Cheatsheet (community)**: <https://github.com/wearerequired/lint-action> per esempi
- File curriculum: [02-actions-ricette.md](02-actions-ricette.md) · [03-secrets-e-variabili.md](03-secrets-e-variabili.md) · [04-workflow-storybook.md](04-workflow-storybook.md)
