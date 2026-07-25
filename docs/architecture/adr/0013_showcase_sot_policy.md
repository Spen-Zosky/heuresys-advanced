# ADR‑0013 — Showcase SoT Policy: 4‑Level Source‑of‑Truth Layering

- **Status:** Accepted — *con emendamento sul solo meccanismo di dipendenza (vedi sotto)*
- **Date:** 2026‑05‑20

> **Emendamento (S1029, 2026‑07‑25).** La stratificazione a 4 livelli decisa qui è tuttora in vigore e non è toccata. È superata **solo** la descrizione di *come* `@heuresys/ui` entra in questo repo: al momento della decisione era collegata con il protocollo `link:` a una copia di lavoro locale; dalla migrazione **X18** (2026‑05) è una **libreria npm pubblicata e versionata**, consumata come dipendenza normale (`"@heuresys/ui": "^0.1.x"`), e le sue dipendenze UI arrivano come transitive. Il repo sorgente resta `ux-design-shared`, ma non è più un percorso di macchina: i riferimenti assoluti Windows presenti nel testo originale sono stati resi relativi al repo. Setup, workflow di modifica di un componente e storia della migrazione: `docs/kb/xtras/DESIGN_SYSTEM_UI.md`.

## Context

Brand identity v1 has produced a three‑surface deploy pipeline that is easy to confuse:

1. `@heuresys/ui` — design system library at `ux-design-shared/ui` linked via the `link:` protocol from this repo's root `package.json`.
2. `apps/web` — Next.js 15 admin SPA + ESS portal; hosts `src/app/showcase/<route>/page.tsx` (the brand showcase routes) and business code side by side.
3. `apps/showcase` — minimal Next.js workspace whose only purpose is to produce a static export of the showcase routes for GitHub Pages. Its `src/app/showcase/`, `src/lib/theme/`, and `src/components/` are populated at build time by `scripts/sync-showcase.sh`.

The 4th surface is the deploy artifact on the `gh-pages` branch, published at https://spen-zosky.github.io/heuresys-advanced/showcase/ by `.github/workflows/showcase.yml`.

Without an explicit policy, three failure modes have been observed in real practice during Session S924 (2026‑05‑20):

- **Edit in wrong place** — modifying `apps/showcase/src/app/showcase/*` directly works for one build, then `sync-showcase.sh` wipes it on the next run (the script `rm -rf` the target dirs before copying).
- **Deps surface drift** — a component shared between `apps/web` and `apps/showcase` (sync‑copied) used `lucide-react`, which resolved in `apps/web` (transitively through the `@heuresys/ui` symlink) but failed in `apps/showcase` whose resolution path didn't reach the transitive dep. Build failure `Can't resolve 'lucide-react'` on GitHub Pages CI #26172547768 was bypassed with inline SVG (commit `75d726b`) and properly remediated in the same PR as this ADR.
- **Ambiguity on component placement** — for a domain‑aware widget (uses `@heuresys/shared` schemas) that must also render in the static showcase, contributors had no rule on whether it belongs to `@heuresys/ui`, `apps/web/src/components/`, or both.

## Decision

Adopt a 4‑level Source‑of‑Truth hierarchy with explicit edit semantics and three binding rules.

### Hierarchy

| Level | Location | Role | Editable? |
|------|----------|------|-----------|
| **L1** | `ux-design-shared/ui` (`@heuresys/ui`) | SoT for UI primitives, brand tokens, brand assets, Storybook | Yes |
| **L2** | `apps/web` | SoT for showcase route wrappers + business app code | Yes |
| **L3** | `apps/showcase` | Mirror / export target for static GH Pages deploy | **No** for sync‑copied paths; Yes for shell only |
| **L4** | `gh-pages` branch / GitHub Pages | Deploy artifact, force‑orphan reset on each workflow run | **No** |

Level 3 detail: `apps/showcase/src/app/showcase/`, `apps/showcase/src/lib/theme/`, and `apps/showcase/src/components/` are gitignored and overwritten on every `pnpm --filter @heuresys/showcase build:static` by `scripts/sync-showcase.sh`. The only tracked, editable files in `apps/showcase` are `package.json`, `tsconfig.json`, `next.config.js`, `postcss.config.mjs`, the root `src/app/layout.tsx`, and the landing `src/app/page.tsx`.

### Binding rules

**R1 — No‑edit zone (L3 sync‑copied paths).**
Never edit `apps/showcase/src/app/showcase/*`, `apps/showcase/src/lib/theme/*`, or `apps/showcase/src/components/*`. Edits to these paths are lost on the next sync. Modify the corresponding files in `apps/web/src/app/showcase/*`, `apps/web/src/lib/theme/*`, or `apps/web/src/components/*` instead.

**R2 — Portability invariant for shared components.**
Any file in `apps/web/src/components/` that is also consumed by a showcase route (and therefore sync‑copied to `apps/showcase`) MUST be portable across both apps. Concretely, its import surface is limited to: `@heuresys/ui`, `react` / `react-dom`, and any package declared as a direct dependency of BOTH `apps/web/package.json` AND `apps/showcase/package.json`. Domain‑aware deps (`@heuresys/shared`, server‑side libs, anything tied to the API) disqualify a component from being shared — it stays inside `apps/web` and is not used by showcase routes.

**R3 — Deps surface alignment.**
For every npm package referenced (directly or transitively) by a Level 2 file that is sync‑copied to Level 3, the package MUST appear as a direct dependency in BOTH `apps/web/package.json` and `apps/showcase/package.json`, with overlapping semver ranges. The first observed case is `lucide-react@^1.16.0` (added to both `package.json` files in the same commit that retired the inline‑SVG workaround). Future shared deps (charts, motion, etc.) follow the same rule.

## Alternatives Considered

| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| **A — Single‑source app: keep showcase inside `apps/web` only, deploy via Next.js `basePath`/`output: "export"`** | One SoT, no sync script, no second package.json to align | `apps/web` declares server‑only features (auth cookies, RSC fetch to `apps/api`, RBAC middleware, `@heuresys/shared` workspace dep with Zod imported by server routes) that are incompatible with `output: "export"`; rewriting `apps/web` for static‑export compatibility expands scope and breaks the production app | Static export of `apps/web` would require gutting the auth + DB layer — too invasive |
| **B — Move showcase entirely into `ux-design-shared`** | Co‑located with primitives, single repo for design work | `ux-design-shared` uses npm + Storybook + different dep tree; showcase composes domain‑aware widgets (`SystemHealthDashboard` references `@heuresys/shared` schemas indirectly via business types) that would force `ux-design-shared` to pull in non‑UI deps and lose its "pure design system" identity | Mixes design system and domain code in the wrong direction |
| **C — Sync‑copy pattern (chosen)** | Keeps `apps/web` full‑featured; keeps `apps/showcase` a minimal static‑export shell; sync‑script is one bash file and runs in CI | Two `package.json` files must be kept aligned for deps shared by sync‑copied files (this ADR's R3 codifies that) | — |

## Consequences

**Positive:**

- "Where do I edit?" has a deterministic answer for every modification — see the hierarchy table.
- `apps/showcase` remains a thin static‑export shell, suitable for GitHub Pages, with a tiny `package.json` surface.
- `apps/web` retains all auth/SSR/RBAC features needed for the production application.
- Deps surface drift becomes a finite, enumerable problem (compare the two `package.json` dependency lists for shared‑file deps) and is amenable to a future CI lint.
- The lucide‑react inline‑SVG hotfix in `SystemHealthDashboard.tsx` is retired; the component re‑imports from `lucide-react` and stays consistent with the 55 other lucide‑using files in `@heuresys/ui`.

**Negative:**

- Two `package.json` files must be kept aligned manually until the CI lint exists. Detection latency = next static build (which fails fast with `Module not found`).
- One additional sync step in `build:static` (already automated; ~1 sec).

**Neutral:**

- All existing 19 showcase routes already live in `apps/web/src/app/showcase/*` (verified at the time of this ADR). The policy formalizes existing practice rather than introducing a new pattern.
- `gh-pages` branch is force‑orphan reset by the workflow on every deploy — no manual edit possible anyway.

## References

- Pipeline script: `scripts/sync-showcase.sh`
- Deploy workflow: `.github/workflows/showcase.yml`
- First misalignment symptom + emergency hotfix: commit `75d726b` (`fix(showcase): drop lucide-react dep — inline SVG icons in SystemHealthDashboard`)
- Proper remediation: same commit as this ADR (`lucide-react` added as direct dep to both `apps/web` and `apps/showcase`; inline SVG removed; lucide imports restored)
- Related ADRs: [ADR‑0007](0007_frontend_next15_app_router.md) (frontend stack), [ADR‑0011](0011_ess_scope_inclusion.md) (scope of `apps/web` routes)
- Companion docs: `CLAUDE.md` §"Design System — CENTRALIZZATO in ux-design-shared" (consumer‑side rules already in place; this ADR codifies the producer side)
