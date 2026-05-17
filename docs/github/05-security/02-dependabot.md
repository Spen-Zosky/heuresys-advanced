# 05.2 · Dependabot

> **Dependabot** è il bot GitHub che monitora le tue dipendenze, ti avvisa di vulnerabilità note (CVE) e — opzionalmente — apre PR automatici per aggiornarle. Gratuito su tutti i repo public e private. È il primo automation di security da attivare.

---

## 1. Concetto

Dependabot ha **3 modalità** indipendenti, attivabili separatamente:

| Modalità | Cosa fa | File config |
|---|---|---|
| **1. Alerts** | Notifica via email/UI quando una dipendenza ha una CVE | Nessuno — attivato globalmente |
| **2. Security updates** | Apre PR automatici per fixare vulnerabilità note | Nessuno — derivato dal config alert |
| **3. Version updates** | Apre PR per aggiornare dipendenze obsolete (anche senza CVE) | `.github/dependabot.yml` |

### Ecosystem supportati

Dependabot conosce 20+ ecosystem: npm/yarn/pnpm, pip, gomod, cargo, maven, gradle, nuget, composer, bundler, docker, github-actions, terraform, e altri.

Per i nostri repo: `npm` (entrambi) + `github-actions` (per `ux-design-shared`).

### Anatomia di `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: "npm"           # quale tool monitorare
    directory: "/"                      # path del package.json
    schedule:
      interval: "weekly"                # daily | weekly | monthly
      day: "monday"
      time: "06:00"
      timezone: "Europe/Rome"
    open-pull-requests-limit: 5         # max PR aperti contemporanei
    target-branch: "main"               # default è quello del repo
    labels: ["dependencies"]
    commit-message:
      prefix: "deps"                    # invece di "build(deps):"
      include: "scope"
    reviewers: ["Spen-Zosky"]
    groups:                             # raggruppa update simili in 1 PR
      types:
        patterns:
          - "@types/*"
      typescript:
        patterns:
          - "typescript"
          - "ts-*"
      storybook:
        patterns:
          - "storybook*"
          - "@storybook/*"
```

### Strategia di update

Per ogni dipendenza, Dependabot rispetta la **strategy** in `package.json`:
- `^1.2.3` (caret) → bump major bloccato
- `~1.2.3` (tilde) → bump minor bloccato
- `1.2.3` (exact) → solo patch via Security updates

Puoi sovrascrivere con `versioning-strategy`:
- `increase` (default) — bumpia minor/major se `^`
- `increase-if-necessary` — bumpia solo se richiesto
- `lockfile-only` — solo lockfile (non `package.json`)

---

## 2. Modello mentale

```
   ┌────────────────────────────────────────────────────────┐
   │                  GITHUB                                │
   │                                                        │
   │   1. ALERTS (sempre attivo)                            │
   │      Database CVE ──► scan deps ──► alert in Security  │
   │                                                        │
   │   2. SECURITY UPDATES (config-free)                    │
   │      Alert critical ──► PR auto "bump foo to 1.2.4"    │
   │                                                        │
   │   3. VERSION UPDATES (richiede dependabot.yml)         │
   │      Schedule weekly ──► check ──► PR "bump bar to 2.0"│
   │                                                        │
   └────────────────────────────────────────────────────────┘
            │                              │
            ▼                              ▼
   ┌────────────────┐         ┌─────────────────────┐
   │ Notifica email │         │  Pull request       │
   │ / UI alert     │         │  +    CI verde      │
   │                │         │  → auto-merge       │
   │                │         │     (se config)     │
   └────────────────┘         └─────────────────────┘
```

---

## 3. Applicato ai nostri repo

### Stato attuale

| Modalità | `heuresys-advanced` | `ux-design-shared` |
|---|---|---|
| Alerts | ⚠️ non verificato (Settings page admin-only — probabilmente attivo per public default) | ⚠️ idem |
| Security updates | ⚠️ idem | ⚠️ idem |
| Version updates | ❌ no `.github/dependabot.yml` | ❌ no |

Per repo public, GitHub attiva di default Dependabot Alerts. Per verificare:

```bash
gh api repos/Spen-Zosky/heuresys-advanced --jq '.security_and_analysis'
```

(restituisce solo per repo dove sei admin)

### Proposta di config per `heuresys-advanced`

File `.github/dependabot.yml`:

```yaml
version: 2

updates:
  # npm — root + workspaces (pnpm)
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    labels: ["dependencies", "tech-debt"]
    commit-message:
      prefix: "chore(deps)"
      include: "scope"
    groups:
      typescript:
        patterns: ["typescript", "@types/*"]
      fastify:
        patterns: ["fastify*", "@fastify/*"]
      vitest:
        patterns: ["vitest", "@vitest/*"]
      drizzle:
        patterns: ["drizzle*"]

  # GitHub Actions (se aggiungerai workflow)
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    labels: ["dependencies", "ci"]
    commit-message:
      prefix: "chore(actions)"
```

### Proposta per `ux-design-shared`

File `.github/dependabot.yml`:

```yaml
version: 2

updates:
  # npm — workspace ui/
  - package-ecosystem: "npm"
    directory: "/ui"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    labels: ["dependencies"]
    commit-message:
      prefix: "chore(deps)"
      include: "scope"
    groups:
      react:
        patterns: ["react", "react-dom", "@types/react*"]
      storybook:
        patterns: ["storybook*", "@storybook/*"]
      radix:
        patterns: ["@radix-ui/*"]
      tailwind:
        patterns: ["tailwindcss", "@tailwindcss/*"]

  # GitHub Actions (per deploy-storybook.yml)
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
    labels: ["dependencies", "ci"]
    commit-message:
      prefix: "chore(actions)"
```

### Workflow auto-merge per patch/minor (opzionale)

File `.github/workflows/dependabot-auto-merge.yml` (vedi anche `03-automazione/02-actions-ricette.md`):

```yaml
name: Dependabot Auto-Merge

on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - uses: dependabot/fetch-metadata@v2
        id: meta
      - name: Auto-merge patch + minor
        if: steps.meta.outputs.update-type == 'version-update:semver-patch' ||
            steps.meta.outputs.update-type == 'version-update:semver-minor'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Significato:
- Patch + minor che passano CI → auto-merge.
- Major → ti chiedono manual review (giustamente — possono essere breaking).

**Prerequisito**: CI verde (workflow `ci.yml`) attivo e branch protection con `Require status checks` (se vuoi che davvero non si auto-mergiano i fail).

---

## 4. Comandi / checklist

### Abilitare Dependabot via Web UI

```
Settings → Code security → Dependency graph: enabled (default per public)
Settings → Code security → Dependabot alerts: enabled
Settings → Code security → Dependabot security updates: enabled
```

### Tramite API (gh CLI)

```bash
# Verifica alert config
gh api repos/Spen-Zosky/heuresys-advanced/vulnerability-alerts -i
# 204 = enabled, 404 = disabled

# Enable
gh api -X PUT repos/Spen-Zosky/heuresys-advanced/vulnerability-alerts

# Disable
gh api -X DELETE repos/Spen-Zosky/heuresys-advanced/vulnerability-alerts

# Lista alert
gh api repos/Spen-Zosky/heuresys-advanced/dependabot/alerts --jq '.[] | {state, severity, package: .dependency.package.name}'
```

### Commit del config

```bash
mkdir -p .github
# Salva il dependabot.yml proposto sopra
git add .github/dependabot.yml
git commit -m "chore(ci): enable Dependabot version updates"
git push
```

Dependabot prende il config entro pochi minuti, il primo PR arriva entro 24h al primo `interval`.

### Gestione di un PR Dependabot

Quando arriva un PR Dependabot:

1. **CI verde?** Verifica i status check.
2. **Changelog del package?** Dependabot scrive nel body un summary + link a release notes.
3. **Breaking change segnalato?** Lo segnala con commit prefix tipo `bump foo from 1.0 to 2.0`.
4. **Lock file aggiornato?** Sì, automaticamente.
5. **Test in locale?** `gh pr checkout <N>` + `pnpm install --frozen-lockfile=false && pnpm test`.
6. Merge.

Comandi rapidi:
```bash
gh pr list --author dependabot                     # tutti i PR Dependabot
gh pr view <N>                                      # leggi
gh pr checks <N>                                    # CI status
gh pr merge <N> --squash --delete-branch            # merge
```

### Pause/skip aggiornamenti specifici

Nel body del PR, commenta:
```
@dependabot ignore this major version
@dependabot ignore this dependency
@dependabot rebase
@dependabot recreate
@dependabot squash and merge
@dependabot cancel merge
```

Per ignorare permanente nel `dependabot.yml`:
```yaml
updates:
  - package-ecosystem: "npm"
    ignore:
      - dependency-name: "react"
        versions: ["19.x"]      # blocca update minor di React
      - dependency-name: "typescript"
        update-types: ["version-update:semver-major"]
```

### Checklist Dependabot setup

- [ ] Verifica Alerts attivo (default per public).
- [ ] Verifica Security updates attivo (forte default).
- [ ] Crea `.github/dependabot.yml` con config per ogni ecosystem.
- [ ] Definisci `groups:` per ridurre rumore (es. 1 PR per tutti i bump `@types/*`).
- [ ] (Opzionale) Setup auto-merge per patch + minor con CI gating.
- [ ] Commit + push → primo PR entro 24h.

---

## 5. Trappole comuni

- **PR cascade**: prima volta che abiliti Version updates su un repo "old", arrivano 20-30 PR insieme. Setup `open-pull-requests-limit: 5` per limitare.
- **Workspace pnpm**: Dependabot rileva i `package.json` di tutti i workspace ma il PR singolo aggiorna solo uno per volta. Per pnpm monorepo, ogni workspace richiede uno `directory:` separato in `dependabot.yml`.
- **Lock file rigenerato male**: a volte Dependabot fa rebase che corrompe `pnpm-lock.yaml`. Soluzione: `@dependabot recreate` per resettare.
- **Auto-merge senza CI**: se non hai branch protection con `Require status checks`, l'auto-merge è cieco. Configurare CI prima.
- **Conventional commit non rispettato**: Dependabot usa di default `build(deps):` prefix. Override con `commit-message: prefix: "chore(deps)"`.
- **Notifiche overload**: ogni PR Dependabot manda email. Mute il repo o filtra email per `dependabot[bot]`.
- **Ignored major bump per sempre**: `update-types: ["version-update:semver-major"]` in `ignore:` lo blocca permanente. Se vuoi solo "ignore for now", commenta `@dependabot ignore this major version` (transient).
- **`engines` non rispettato**: Dependabot non controlla `engines` di `package.json`. Può proporre upgrade Node-incompatibile. Mitigare con `ignore:` per package noti.

---

## 6. Per approfondire

- **About Dependabot**: <https://docs.github.com/en/code-security/dependabot>
- **dependabot.yml reference**: <https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference>
- **Configuration cheat sheet**: <https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file>
- **Security alerts**: <https://docs.github.com/en/code-security/dependabot/dependabot-security-updates/about-dependabot-security-updates>
- File curriculum: [01-secret-hygiene.md](01-secret-hygiene.md) · [03-code-scanning.md](03-code-scanning.md) · [03-automazione/02-actions-ricette.md](../03-automazione/02-actions-ricette.md)
