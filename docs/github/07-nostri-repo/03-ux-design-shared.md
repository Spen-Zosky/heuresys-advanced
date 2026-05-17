# 07.3 · `Spen-Zosky/ux-design-shared` — deep dive

> Repo che ospita il design system `@heuresys/ui` (51 componenti React + Storybook). Pubblica già su GitHub Pages. Path naturale di evoluzione: publish su npm come `@spen-zosky/ui` per sostituire il `pnpm link:` con cui oggi è consumato.

---

## 1. Identità del repo

| Attributo | Valore |
|---|---|
| Owner | Spen-Zosky (personal) |
| Visibility | public |
| URL | <https://github.com/Spen-Zosky/ux-design-shared> |
| Created | 2026-05-16 (2 minuti dopo `heuresys-advanced`) |
| Default branch | `main` |
| Description | Heuresys UI Design System — 51 reusable React components... |
| Homepage | _(vuoto — proposta: punta a Storybook live)_ |
| Topics | _(vuoti)_ |
| License | _(assente)_ |
| Pages | **enabled** (workflow source, HTTPS) |
| Pages URL | <https://spen-zosky.github.io/ux-design-shared/> |
| Workflow Actions | 1: `deploy-storybook.yml` |
| Total commits | 4 |
| Storybook | 122 stories, 51 componenti |

---

## 2. Settings consigliati (gh CLI batch)

```bash
# 1. Homepage URL → punta a Storybook
gh repo edit Spen-Zosky/ux-design-shared \
  --homepage https://spen-zosky.github.io/ux-design-shared/

# 2. Topics
gh repo edit Spen-Zosky/ux-design-shared \
  --add-topic react \
  --add-topic design-system \
  --add-topic tailwindcss \
  --add-topic radix-ui \
  --add-topic storybook \
  --add-topic typescript \
  --add-topic components \
  --add-topic ui-kit

# 3. Wiki — disabilita
gh repo edit Spen-Zosky/ux-design-shared --enable-wiki=false

# 4. Merge strategies
gh repo edit Spen-Zosky/ux-design-shared \
  --allow-merge-commit=false \
  --allow-squash-merge=true \
  --allow-rebase-merge=true \
  --delete-branch-on-merge=true

# 5. Branch protection Tier 1
# (vedi 05-security/05-branch-protection.md per JSON ruleset)
```

---

## 3. README mancante — priorità alta

Oggi il repo NON ha `README.md` a root. La home GitHub mostra solo la lista file. Manca il "biglietto da visita".

Contenuto suggerito (~80 righe), file `README.md` a root del repo:

```markdown
# Heuresys UI Design System

> 51 React components, Tailwind 4-styled, Radix-powered. Consumed by Heuresys applications via pnpm `link:` (and, in future, as `@spen-zosky/ui` on npm).

[![Storybook](https://img.shields.io/badge/storybook-live-ff4785?logo=storybook)](https://spen-zosky.github.io/ux-design-shared/)
[![Deploy](https://github.com/Spen-Zosky/ux-design-shared/actions/workflows/deploy-storybook.yml/badge.svg)](https://github.com/Spen-Zosky/ux-design-shared/actions)

## Stack

- React 19 + TypeScript 5.7
- Tailwind CSS 4
- Radix UI primitives
- Storybook 10 (Vite)
- 122 stories across 16 component tiers

## Live Storybook

[https://spen-zosky.github.io/ux-design-shared/](https://spen-zosky.github.io/ux-design-shared/)

## Usage today (pnpm link:)

In a consumer repo's root `package.json`:

```jsonc
{
  "dependencies": {
    "@heuresys/ui": "link:../ux-design-shared/ui"
  }
}
```

Then `pnpm install` and import:

```tsx
import { Button, Card } from "@heuresys/ui";
```

## Usage tomorrow (npm `@spen-zosky/ui`)

When published:

```bash
pnpm add @spen-zosky/ui
```

## Development

```bash
git clone https://github.com/Spen-Zosky/ux-design-shared.git
cd ux-design-shared
npm install --legacy-peer-deps
npm run storybook   # http://localhost:6006
```

## Contributing

Open issues for component requests or bugs. See [MANIFEST.md](MANIFEST.md) for the full component catalog and [SETUP.md](SETUP.md) for environment.

## License

(TBD)
```

Crea con `git add README.md && git commit -m "docs: add root README" && git push`.

---

## 4. Workflow attuale `deploy-storybook.yml`

Dettagliato in [`03-automazione/04-workflow-storybook.md`](../03-automazione/04-workflow-storybook.md). Recap:

- Trigger: `push:main` + `workflow_dispatch`
- 2 jobs (build + deploy), tempo ~1m45s
- Pubblica su `https://spen-zosky.github.io/ux-design-shared/`
- 3 run history: 2 ✅ + 1 ❌ (la prima, prima del fix cache)
- Storia recente:
  - `0a36b19` — fix MSW relative URL (latest)
  - `a28eef1` — fix npm cache directive
  - `443e423` — initial setup (fallita per lockfile mancante)
  - `b720ada` — initial extract da heuresys-evo

---

## 5. Path verso npm publish

Stato: oggi `pnpm link:` filesystem-based. Domani: `@spen-zosky/ui` su GitHub Packages (o npmjs.com).

Step concreti quando deciderai (riferimento completo in [`04-publishing/04-packages.md`](../04-publishing/04-packages.md)):

### Step 1 — Refactor `ui/package.json`

```json
{
  "name": "@spen-zosky/ui",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "src"],
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "public"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

### Step 2 — Build script per `dist/`

```bash
# In ui/
npm run build   # ← script che genera dist/index.js + dist/index.d.ts
```

Stack di build per design system: `tsup` o `unbuild` (più semplici di Rollup raw).

### Step 3 — Workflow publish

File `.github/workflows/publish.yml` (vedi `04-publishing/04-packages.md` per template completo). Trigger: `release: types: [published]`. Pubblica al registry GitHub Packages.

### Step 4 — Update consumer (`heuresys-advanced`)

```jsonc
// package.json
{
  "dependencies": {
    "@spen-zosky/ui": "^0.1.0"
  }
}
```

File `.npmrc` per il consumer (necessario per registry GitHub Packages):
```
@spen-zosky:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

### Trade-off del passaggio

| Aspetto | `pnpm link:` (oggi) | `@spen-zosky/ui` npm (domani) |
|---|---|---|
| **Modifiche istantanee al design system** | ✅ Sì | ❌ No (require publish) |
| **Setup macchina nuova** | ⚠️ Devi clonare 2 repo come fratelli | ✅ 1 repo solo |
| **CI/CD funziona naturalmente** | ❌ Richiede dual checkout | ✅ Sì |
| **Versioning esplicito** | ❌ No | ✅ Sì |
| **Terze parti possono usarlo** | ❌ No | ✅ Sì (se public + npm-published) |
| **Effort di mantenimento** | ✅ Zero | ⚠️ Bump + publish ad ogni change |

**Trigger naturale del passaggio**: quando un PR sul design system richiede coordinamento esplicito con la versione del consumer.

---

## 6. Branch model proposto

Stesso del `heuresys-advanced` ma con un dettaglio in più: **tag protection** per release pubbliche.

Quando attiverai release:

```
Ruleset: "Protect release tags"
Target: refs/tags/v*
Rules:
  ✓ Restrict creations to: github-actions[bot]  (solo CI può creare tag)
  ✓ Restrict deletions
  ✓ Block force pushes (n/a per tag)
```

Effetto: nessuno (incluso te in manual error) può creare un tag `v*` manualmente — deve passare dal workflow release-please.

---

## 7. Prossimi step prioritizzati

| Priorità | Step | Effort | Rationale |
|---|---|---|---|
| **P0** | **Crea `README.md` root** | 10 min | Front door del repo manca |
| **P0** | Aggiungi Homepage URL al Storybook | 1 min | Front-and-center visibility |
| **P0** | Aggiungi 6-8 topics | 2 min | Discoverability |
| P1 | LICENSE file (MIT? proprietary?) | 5 min | Default no-permission scoraggia reuse |
| P1 | Branch protection Tier 1 | 3 min | Anti-accident |
| P1 | Dependabot Alerts + Security updates | 1 click | Sicurezza gratis |
| P2 | `.github/dependabot.yml` Version updates | 10 min | PR settimanali per bump |
| P2 | Decidi publish strategy (GitHub Packages vs npm) | 30 min ricerca | Sblocca P3 |
| P3 | Refactor `ui/package.json` per publish | 1h | Step 1 di npm publish |
| P3 | `tsup`/`unbuild` setup per `dist/` | 1h | Step 2 di npm publish |
| P3 | `release-please-action` setup | 30 min | Automation versioning |
| P3 | `publish.yml` workflow | 30 min | Step 3 di npm publish |
| P4 | Prima release `v0.1.0` | 1h | Sblocca consume in heuresys-advanced |

---

## 8. Cose che NON consiglio di fare ora

- **CodeQL**: il codice è quasi tutto componenti React puri — CodeQL su FE produce molti falsi positivi su XSS. Aspetta finché il design system non avrà più logica.
- **CI test workflow**: gli unit test esistono (`vitest.config.ts`) ma sono pochi. Setup CI vale solo se aggiungi >20 test.
- **Custom domain Pages** (es. `design.heuresys.com`): vale la pena solo quando il design system avrà audience esterno.
- **Disable Pages**: l'unica feature attiva del repo — non smontarla.

---

## 9. Per approfondire

- `07.1` [`01-stato-corrente.md`](01-stato-corrente.md) — snapshot tecnico
- `07.2` [`02-heuresys-advanced.md`](02-heuresys-advanced.md) — deep dive sul repo consumer
- `07.4` [`04-interazioni-tra-repo.md`](04-interazioni-tra-repo.md) — come i 2 repo interagiscono
- `04` [`04-publishing/04-packages.md`](../04-publishing/04-packages.md) — setup npm publish completo
- `04` [`04-publishing/02-pages-il-nostro-caso.md`](../04-publishing/02-pages-il-nostro-caso.md) — walkthrough setup Storybook
- `08` [`../08-roadmap.md`](../08-roadmap.md) — sequenza temporale globale
