# 03.2 · Actions — ricette riusabili

> Raccolta di workflow YAML pronti, contestualizzati per i nostri due repo. Ogni ricetta è completa e copia-incollabile in `.github/workflows/`.

---

## 1. Concetto

Una **ricetta** è un workflow YAML completo che risolve un caso d'uso comune. Le ricette qui sotto sono organizzate per dominio:

- Quality gates (lint + typecheck + test)
- Build + deploy
- Release management
- Maintenance (dependency updates, scheduled jobs)

Ogni ricetta indica: trigger, job count, permissions, dipendenze esterne, tempo stimato, output.

---

## 2. Modello mentale

```
                  Trigger                Job(s)               Output
                  ───────              ─────────             ────────

  on push       ──►  CI checks      ──►  green/red status
                     (typecheck,           on commit
                      lint, test)

  on tag v*     ──►  release        ──►  GitHub Release
                     (build, publish)     + npm package

  on schedule   ──►  housekeeping   ──►  PR aperto da bot
                     (deps update,       (Dependabot-like)
                      stale issue
                      cleanup)

  workflow_dispatch
                ──►  manual deploy  ──►  staging/prod
                     (env-gated)         updated
```

---

## 3. Applicato ai nostri repo

### Ricetta 1 — CI per `heuresys-advanced` (pnpm monorepo)

File: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-test:
    name: Build + typecheck + test
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck (all workspaces)
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint
        continue-on-error: true   # rimuovi quando il lint sarà pulito

      - name: Test (vitest API)
        run: pnpm --filter @heuresys/api test
        env:
          # I test API hanno bisogno della DB live — per CI useremo
          # un postgres service container o un mock. Per ora skip:
          SKIP_INTEGRATION: "true"
```

**Note**: i test integration richiedono il tunnel SSH alla VM OCI. Per il CI cloud serviranno:
- Un Postgres service container (`services: postgres: image: postgres:16`).
- Una migration runner come step (`pnpm db:migrate`).
- Un seed runner (`pnpm db:seed-test-admin`).

Tempo stimato: ~3-4 min (install pnpm + 88 deps + typecheck).

### Ricetta 2 — Auto-deploy Storybook (già attivo su `ux-design-shared`)

File: `.github/workflows/deploy-storybook.yml` (riferimento, vedi `04-workflow-storybook.md` per il deep dive).

### Ricetta 3 — Release automatico via tag

File: `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags: ["v*"]

permissions:
  contents: write       # serve per creare il release
  packages: write       # se pubblichi su GitHub Packages

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # serve a git history completa per changelog

      - uses: pnpm/action-setup@v4
        with: { version: 9 }

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Extract version
        id: version
        run: echo "version=${GITHUB_REF#refs/tags/}" >> $GITHUB_OUTPUT

      - name: Generate changelog
        id: changelog
        run: |
          PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
          if [ -z "$PREV_TAG" ]; then
            git log --pretty=format:"- %s (%an)" > CHANGELOG.txt
          else
            git log $PREV_TAG..HEAD --pretty=format:"- %s (%an)" > CHANGELOG.txt
          fi
          echo "changelog<<EOF" >> $GITHUB_OUTPUT
          cat CHANGELOG.txt >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.version.outputs.version }}
          name: ${{ steps.version.outputs.version }}
          body: ${{ steps.changelog.outputs.changelog }}
          draft: false
          prerelease: ${{ contains(steps.version.outputs.version, '-rc') || contains(steps.version.outputs.version, '-beta') }}
```

**Utilizzo**: `git tag v1.0.0 && git push origin v1.0.0` → il workflow crea automaticamente la GitHub Release con changelog dei commit dall'ultimo tag.

### Ricetta 4 — Dependabot auto-merge (per minor/patch sicuri)

Prerequisito: Dependabot abilitato (vedi `05-security/02-dependabot.md`).

File: `.github/workflows/dependabot-auto-merge.yml`

```yaml
name: Dependabot Auto-Merge

on:
  pull_request:

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - name: Fetch Dependabot metadata
        id: meta
        uses: dependabot/fetch-metadata@v2

      - name: Auto-merge patch + minor (non breaking)
        if: steps.meta.outputs.update-type == 'version-update:semver-patch' ||
            steps.meta.outputs.update-type == 'version-update:semver-minor'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Sicurezza**: auto-merge solo se i status check (CI verde) passano. Mai per major bump.

### Ricetta 5 — Issue stale cleanup (scheduled)

File: `.github/workflows/stale.yml`

```yaml
name: Close stale issues and PRs

on:
  schedule:
    - cron: "0 1 * * *"   # ogni giorno alle 01:00 UTC
  workflow_dispatch:

permissions:
  issues: write
  pull-requests: write

jobs:
  stale:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/stale@v9
        with:
          days-before-stale: 60
          days-before-close: 14
          stale-issue-label: "stale"
          stale-pr-label: "stale"
          exempt-issue-labels: "pinned,security"
          stale-issue-message: |
            Questa issue è inattiva da 60 giorni. Verrà chiusa fra 14 giorni
            se non ci sarà nuova attività. Aggiungi un commento o rimuovi
            la label `stale` per evitare la chiusura.
          stale-pr-message: |
            Questo PR è inattivo da 60 giorni. Stessa policy.
          close-issue-message: "Chiusa per inattività. Riapribile in qualsiasi momento."
```

Utile quando avrai >50 Issue aperti.

### Ricetta 6 — Lint + Prettier check su PR

File: `.github/workflows/lint.yml`

```yaml
name: Lint

on:
  pull_request:

permissions:
  contents: read

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: ESLint
        run: pnpm lint

      - name: Prettier check
        run: pnpm exec prettier --check .
        continue-on-error: true   # rimuovi quando tutto è formattato
```

### Ricetta 7 — Reusable workflow (DRY)

Quando 2+ workflow condividono setup, estrai in **reusable workflow**:

File: `.github/workflows/_setup.yml`

```yaml
name: Setup (reusable)

on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: "20"

jobs:
  setup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
```

Consumato da altri workflow:

```yaml
jobs:
  build:
    uses: ./.github/workflows/_setup.yml
    with:
      node-version: "20"
```

> Reusable workflow sono utili a partire da ~3 workflow simili. Per i nostri repo oggi (1 workflow attivo) è prematuro.

---

## 4. Comandi / checklist

### Test workflow localmente (act)

[Act](https://github.com/nektos/act) emula GitHub Actions in locale:

```bash
# Install (Windows)
winget install nektos.act

# Esegui un workflow
act push                            # esegue tutti i workflow su evento push
act -j test                         # solo il job "test"
act -W .github/workflows/ci.yml     # specifico workflow file
act --container-architecture linux/amd64   # su Mac M1
```

Limiti: non emula i token, alcuni action proprietari richiedono modifiche, networking diverso.

### Debug di un workflow falliuto

1. Apri il run nella UI: `Actions` tab → click sul run rosso.
2. Espandi il job fallito → trova lo step con la ❌.
3. Vedi i log dello step.
4. Re-run con debug logging:
   ```bash
   gh run rerun <RUN_ID> --debug
   ```
   oppure aggiungi temporaneamente al workflow:
   ```yaml
   env:
     ACTIONS_STEP_DEBUG: true
     ACTIONS_RUNNER_DEBUG: true
   ```

### Workflow templates GitHub

Quando crei un workflow nuovo dalla UI (`Actions` tab → `New workflow`), GitHub propone template basati sul linguaggio rilevato. Tipo "Node.js": pre-fillati con `actions/setup-node` + `npm ci` + `npm test`. Punto di partenza utile, da personalizzare.

### Checklist nuovo workflow

- [ ] File in `.github/workflows/<name>.yml` con estensione `.yml`
- [ ] `name:` esplicito (mostrato nella UI Actions)
- [ ] `on:` con trigger appropriati
- [ ] `permissions:` minimi (default è troppo permissivo per repo public)
- [ ] `concurrency:` per evitare run sovrapposti
- [ ] `timeout-minutes:` per evitare workflow infiniti
- [ ] Action pinati a major version (`@v4`) o sha
- [ ] Test localmente con `act` se possibile
- [ ] Commit + push → verifica nella tab Actions

---

## 5. Trappole comuni

- **Workflow che si auto-triggera**: se il workflow committa o pusha, può ri-triggerarsi. Filtro classico: `if: github.actor != 'github-actions[bot]'` o `if: github.event.head_commit.message != 'chore: auto-update'`.
- **Cache invalidation lenta**: la cache `actions/cache@v4` è scoped per branch + key. Se la chiave dipende dal lock file e tu cambi solo una dipendenza, l'install completo viene ricreato. Per workflow che girano spesso, considerare un cache più stabile.
- **Concurrency group sbagliato → cancel di run validi**: includi sempre `${{ github.ref }}` o `${{ github.event.pull_request.number }}`.
- **Workflow che gira su PR fork ha permission limitate**: il `GITHUB_TOKEN` ha solo `read`. Se devi commentare il PR (es. coverage bot), serve `pull_request_target` (con cautela) o un app token.
- **Action di terzi sbagliata**: alcune action del Marketplace sono di basso quality. Verifica: maintainer attivo, ≥100 stars, ultimo commit recente. In dubbio, fork.
- **Secret in matrix expansion**: se usi `matrix.foo` e `foo` contiene un secret, **viene espanso nel log**. GitHub Actions maschera solo `secrets.X` esplicito.
- **Action versionata a `@main`**: `npm/setup-node@main` può breakare senza warning. Pinna sempre.
- **YAML multi-line tricky**: usa `|` (literal block) per command shell multi-riga; usa `>` per fold whitespace. Sbagliarli causa parse error oscuri.

---

## 6. Per approfondire

- **Workflow examples**: <https://docs.github.com/en/actions/examples>
- **Marketplace actions ufficiali**: <https://github.com/actions>
- **Awesome Actions** (community curated): <https://github.com/sdras/awesome-actions>
- **act (local testing)**: <https://github.com/nektos/act>
- **GitHub Actions starter workflows**: <https://github.com/actions/starter-workflows>
- File curriculum: [01-actions-fondamenti.md](01-actions-fondamenti.md) · [03-secrets-e-variabili.md](03-secrets-e-variabili.md) · [04-workflow-storybook.md](04-workflow-storybook.md)
