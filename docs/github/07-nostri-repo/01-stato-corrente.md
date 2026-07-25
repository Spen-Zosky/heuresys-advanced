# 07.1 · Stato corrente dei due repo (snapshot)

> ⚠️ **Il corpo di questa pagina è lo snapshot del 2026-05-17**, tenuto apposta come *punto zero* contro cui misurare la crescita. **Non è più lo stato corrente** e non va letto come tale: sotto trovi il rilievo aggiornato. Il titolo del file resta per stabilità dei link.

## Stato live (rilevato il 2026-07-25, S1029)

Tutti i valori da `gh repo view` / `gh workflow list` / `gh release list` / `git rev-list --count`, riproducibili con i comandi in fondo alla pagina.

| Campo | Punto zero (2026-05-17) | **Live (2026-07-25)** |
|---|---|---|
| Commit su `main` | 88 | **1.270** |
| Ultimo push | 2026-05-17 | **2026-07-23** |
| Workflow CI attivi | 0 | **11** (build-web, i18n-parity, lint, playwright-smoke, shell-tests, showcase-pages, state-lint, test-integration, typecheck, dependabot, pages-build) |
| Release pubblicate | 0 | **5** — l'ultima è `v1.0.0` (GA baseline, 2026-06-02) |
| Topics | _(vuoti)_ | **13** (hrms, bpm, fastify, nextjs-15, postgresql, monorepo, pnpm-workspace, typescript, zod, saas, design-system, workforce-intelligence, position-centric) |
| License | _(assente)_ | presente (`other`) |
| Disk usage | ~2 MB | **~19,8 MB** |
| Stars / Forks | 0 / 0 | 0 / 0 |

**Nota di drift ancora aperta**: la `description` del repo su GitHub dichiara «Fastify 4» mentre il progetto gira su **Fastify 5**, e riporta conteggi di endpoint/test non più attuali. I numeri vivi stanno in `docs/kb/SOT_STATE.md`, non qui né nella description.

**`Spen-Zosky/ux-design-shared`** (upstream del design system): ultimo push 2026-06-18, ~856 KB, **1 solo workflow** (deploy Storybook) — nessun gate di qualità, e la sua description parla ancora del protocollo `link:`, superato dalla pubblicazione npm (migrazione X18). Entrambe le cose sono cluster aperti del piano `docs/superpowers/specs/2026-07-25-zero-pending-plan.md`.

---

## Snapshot storico — 2026-05-17 (punto zero)

> Snapshot misurabile al **2026-05-17** dello stato GitHub di entrambi i repo. Funge da "punto zero" verificabile contro cui calibrare i prossimi batch del curriculum. Tutti i dati riportati provengono da `gh api` su endpoint pubblici e sono riproducibili con i comandi a fondo pagina.

---

## 1. `Spen-Zosky/heuresys-advanced`

### Identità

| Campo | Valore |
|---|---|
| URL | <https://github.com/Spen-Zosky/heuresys-advanced> |
| Default branch | `main` |
| Visibility | `PUBLIC` |
| Created | 2026-05-16 23:17 UTC |
| Last push | 2026-05-17 14:50 UTC |
| Total commits (`main`) | **88** |
| HEAD sha | `aeea62d` (`docs(readme): link to live Storybook on GitHub Pages`) |
| Disk usage | ~2 MB (2041 KB) |
| Description | "Heuresys Advanced HRMS/BPM Platform v5 — pnpm monorepo: Fastify 4 API (267 endpoints, 182 integration tests) + Next.js 15 admin/ESS web SPA + shared Zod schemas + PostgreSQL 16 migrations" |
| Homepage URL | _(vuoto)_ |
| Repository topics | _(vuoto)_ |
| License | _(assente)_ |
| Stars / Forks / Watchers | 0 / 0 / 0 |

### Feature GitHub

| Feature | Stato | Note |
|---|---|---|
| Issues | ✅ enabled · 0 open · 0 closed | Mai usate finora |
| Pull requests | ✅ enabled · 0 open · 0 closed | Workflow attuale = commit diretti su `main` |
| Discussions | ❌ disabled | |
| Projects | ✅ enabled · nessuno creato | |
| Wiki | ✅ enabled · vuoto | Sostituibile da `docs/**` |
| Pages | ❌ disabled | Non necessario per la API (`apps/api`) — la SPA `apps/web` non è stata pubblicata |
| Actions / Workflows | ❌ nessun workflow in `.github/workflows/` | Nessuna CI/CD attiva |
| Releases / Tags | ❌ 0 release · 0 tag | |
| Packages | ❌ nessun pacchetto | |
| Dependabot alerts | ⚠️ non verificato (Settings page admin-only) | |
| Code scanning | ❌ non attivo | |
| Secret scanning | ✅ attivo automatico (default su repo public) | |
| Branch protection / Rulesets | ❌ nessuna regola | `main` libero a push diretti |
| Webhooks | ❌ nessuno | |
| Apps installate | ❌ nessuna (al di là dei default GitHub) | |
| `allow_forking` | `true` | |
| `web_commit_signoff_required` | `false` | |

### File top-level versionati

```
.env.example
.gitignore
.npmrc
.nvmrc
CLAUDE.md
HANDOFF.md
NEXT_SESSION_MVP_2A.md
README.md
START_HERE.md
heuresys-advanced-bootstrap-vm.md
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
tsconfig.base.json
```

E ovviamente le directory `apps/`, `packages/`, `db/`, `docs/`, `qa_artifacts/`, `tests/`.

Nessun `LICENSE`, nessun `CONTRIBUTING.md`, nessun `CODE_OF_CONDUCT.md`, nessun `SECURITY.md`, nessuna `.github/` directory. Nessun template di Issue o PR. Nessuna `FUNDING.yml`.

---

## 2. `Spen-Zosky/ux-design-shared`

### Identità

| Campo | Valore |
|---|---|
| URL | <https://github.com/Spen-Zosky/ux-design-shared> |
| Default branch | `main` |
| Visibility | `PUBLIC` |
| Created | 2026-05-16 23:19 UTC (2 minuti dopo l'altro repo) |
| Last push | 2026-05-17 14:54 UTC |
| Total commits (`main`) | **4** |
| HEAD sha | `0a36b19` (`fix(storybook): use page-relative MSW service-worker URL for subpath deploys`) |
| Disk usage | ~230 KB |
| Description | "Heuresys UI Design System — 51 reusable React components (Radix + Tailwind 4) shared across Heuresys repos via pnpm link: protocol. …" |
| Homepage URL | _(vuoto)_ — potenzialmente da puntare al Storybook live |
| Repository topics | _(vuoto)_ |
| License | _(assente)_ |
| Stars / Forks / Watchers | 0 / 0 / 0 |

### Feature GitHub

| Feature | Stato | Note |
|---|---|---|
| Issues | ✅ enabled · 0 open · 0 closed | |
| Pull requests | ✅ enabled · 0 open · 0 closed | |
| Discussions | ❌ disabled | |
| Projects | ✅ enabled · nessuno creato | |
| Wiki | ✅ enabled · vuoto | |
| **Pages** | ✅ **enabled** · source `workflow` · HTTPS enforced · URL `https://spen-zosky.github.io/ux-design-shared/` | Attivato 2026-05-17 |
| Actions / Workflows | ✅ 1 workflow: `.github/workflows/deploy-storybook.yml` | 3 run totali: 2 success + 1 failure (la failure è la prima, prima del fix del cache npm) |
| Releases / Tags | ❌ 0 release · 0 tag | Potenziale candidato per release npm via `@spen-zosky/ui` |
| Packages | ❌ nessun pacchetto | |
| Dependabot alerts | ⚠️ non verificato | |
| Code scanning | ❌ non attivo | |
| Secret scanning | ✅ attivo automatico (default su repo public) | |
| Branch protection / Rulesets | ❌ nessuna regola | |
| Webhooks | 1 webhook automatico per il deploy Pages (gestito da GitHub) | |
| `allow_forking` | `true` | |

### File top-level versionati

```
.github/workflows/deploy-storybook.yml
.gitignore
.prettierignore
MANIFEST.md
SETUP.md
package.json
ui/.storybook/main.ts
ui/.storybook/preview.ts
ui/README.md            ← presente solo dentro ui/, non a root
ui/package.json
ui/tsconfig.json
ui/vitest.config.ts
```

**Nota importante**: manca un `README.md` di root. La home page del repo su GitHub mostra solo la lista file, non un "biglietto da visita". `MANIFEST.md` e `SETUP.md` sono utili ma non sostituiscono il README per il visitatore casuale.

Nessun `LICENSE`, nessun `CONTRIBUTING.md`, nessun template Issue/PR.

---

## 3. Workflow CI/CD: dettaglio `deploy-storybook.yml`

| Caratteristica | Valore |
|---|---|
| File | `.github/workflows/deploy-storybook.yml` |
| Trigger | `push` su `main` + `workflow_dispatch` (manuale) |
| Runner | `ubuntu-latest` |
| Jobs | 2 (`build` + `deploy`) sequenziali |
| Node version | 20 |
| Build command | `npm install --legacy-peer-deps && npm run build-storybook` |
| Artifact path | `ui/storybook-static` |
| Deploy action | `actions/deploy-pages@v4` |
| Tempo medio | ~1m45s |
| Permissions richieste | `contents: read`, `pages: write`, `id-token: write` |
| Concurrency | gruppo `pages`, `cancel-in-progress: true` |

Run history:

| ID | Commit | Status | Durata | Quando |
|---|---|---|---|---|
| `25994151505` | `0a36b19` (MSW fix) | ✅ success | 1m44s | 2026-05-17 14:54 UTC |
| `25993996347` | `a28eef1` (cache fix) | ✅ success | 1m45s | 2026-05-17 14:47 UTC |
| `25993970602` | `443e423` (setup iniziale) | ❌ failure (lockfile missing per `cache: npm`) | 9s | 2026-05-17 14:46 UTC |

---

## 4. Interazioni tra i due repo

Ad oggi l'interazione **non passa da GitHub**:

- `heuresys-advanced` consuma `ux-design-shared` localmente tramite **pnpm `link:`** (filesystem symlink).
- In `apps/web/package.json` (e nel root `package.json`), la dipendenza è dichiarata come `"@heuresys/ui": "link:../ux-design-shared/ui"`.
- Su qualsiasi macchina nuova, l'utente deve clonare i due repo come fratelli (`/d/heuresys-advanced` e `/d/ux-design-shared`) prima di `pnpm install`.

Pro:
- Modifiche al design system sono visibili **istantaneamente** in `apps/web` (zero rebuild).
- Niente registry, niente versioning, niente token npm.

Contro:
- Non funziona in CI (i runner clonano solo un repo per default). Il workflow `deploy-storybook.yml` non ha questa dipendenza ed è autoconsistente, ma una futura CI per `apps/web` dovrebbe checkout-are entrambi i repo.
- Niente versioning: ogni consumer prende sempre la versione "trunk" del design system.
- Senza pubblicazione su npm/Packages, terze parti non possono usare il design system.

Path verso un'interazione "via GitHub":
1. **Publishing su GitHub Packages** come `@spen-zosky/ui` (registry GitHub-hosted, gratis per public).
2. `heuresys-advanced` switch a `"@spen-zosky/ui": "^1.0.0"` con dipendenza standard npm.
3. Bumping via tag su `ux-design-shared` + Action che pubblica il pacchetto.

Argomento approfondito nel Batch 4 [`04-publishing/04-packages.md`](../04-publishing/04-packages.md) `🚧 in arrivo` e nel Batch 7 [`07-nostri-repo/04-interazioni-tra-repo.md`](04-interazioni-tra-repo.md) `🚧 in arrivo`.

---

## 5. Riepilogo: quali feature usate vs disponibili

| Categoria | `heuresys-advanced` | `ux-design-shared` |
|---|---|---|
| **Hosting + git** | ✅ | ✅ |
| **README pubblico** | ✅ | ❌ (manca root README) |
| **Description + topics** | description ✅ · topics ❌ | description ✅ · topics ❌ |
| **License** | ❌ | ❌ |
| **Issues / PR** | ✅ (mai usati) | ✅ (mai usati) |
| **Projects v2** | ✅ (mai usato) | ✅ (mai usato) |
| **Discussions** | ❌ | ❌ |
| **Actions** | ❌ | ✅ (1 workflow) |
| **Pages** | ❌ | ✅ (Storybook live) |
| **Releases / Tags** | ❌ | ❌ |
| **Packages** | ❌ | ❌ (candidato npm) |
| **Dependabot** | non verificato | non verificato |
| **Code scanning** | ❌ | ❌ |
| **Branch protection** | ❌ | ❌ |
| **Signed commits** | ❌ | ❌ |

**Feature potenzialmente "quick win"** (alto valore, basso effort):

1. **Topics** su entrambi i repo (5 minuti via `gh repo edit --add-topic`).
2. **README.md** per `ux-design-shared` (1 file, ~50 righe).
3. **Homepage URL** del `ux-design-shared` impostato al Storybook.
4. **Dependabot** alerts attivati su entrambi (Settings → Security → Dependabot — è 1 click).
5. **LICENSE** decisa e committata (anche solo `LICENSE.md` con testo "All rights reserved" se non vuoi open-source).

Tutti questi sono coperti nei prossimi batch del curriculum.

---

## 6. Comandi per riprodurre lo snapshot

I dati di questo file sono tutti verificabili pubblicamente. Comandi:

```bash
# Identità + feature flags
gh api repos/Spen-Zosky/heuresys-advanced \
  --jq '{
    visibility, default_branch, created_at, pushed_at,
    description, homepage, topics: .topics, disk_usage,
    has_issues, has_projects, has_wiki, has_discussions, has_pages,
    allow_forking, archived, stargazers_count, forks_count, watchers_count,
    license: .license.spdx_id
  }'

# Total commit count (via pagination header)
gh api 'repos/Spen-Zosky/heuresys-advanced/commits?per_page=1' -i \
  | grep -i 'link:' | grep -oE 'page=[0-9]+' | tail -1

# Pages config (se enabled)
gh api repos/Spen-Zosky/ux-design-shared/pages

# Workflow files
gh api repos/Spen-Zosky/ux-design-shared/contents/.github/workflows \
  --jq '.[].name'

# Run history workflow
gh run list --repo Spen-Zosky/ux-design-shared --limit 10 \
  --json status,conclusion,name,createdAt,databaseId,headSha
```

Per rigenerare questo snapshot all'inizio di un nuovo batch del curriculum, eseguire i comandi sopra e aggiornare la sezione corrispondente.

---

## 7. Per approfondire

- File del curriculum: [02-account-e-repo.md](../01-fondamenti/02-account-e-repo.md) (settings spiegati) · [04-readme-e-markdown.md](../01-fondamenti/04-readme-e-markdown.md) (per il README mancante) · [02-heuresys-advanced.md](02-heuresys-advanced.md) `🚧 in arrivo` (deep dive) · [03-ux-design-shared.md](03-ux-design-shared.md) `🚧 in arrivo` (deep dive) · [08-roadmap.md](../08-roadmap.md) `🚧 in arrivo` (cosa attivare e in che ordine)
