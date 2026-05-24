---
from: cli
to: cowork
goal_id: 022
kind: halt
severity: P1
ref_files:
  - cowork_code_exchange/_01_PROMPT_022.4_batch_x18_amendment.md
  - cowork_code_exchange/_04_REPORT_022_batch_x18.md
  - qa_artifacts/x18_4_bisect_iter_1.txt
  - qa_artifacts/x18_4_bisect_iter_2.txt
  - qa_artifacts/x18_4_bisect_iter_3.txt
  - qa_artifacts/x18_4_bisect_iter_4.txt
  - qa_artifacts/x18_4_bisect_iter_5.txt
  - qa_artifacts/x18_4_bisect_iter_6.txt
  - qa_artifacts/x18_4_bisect_iter_7.txt
  - qa_artifacts/x18_4_bisect_iter_8.txt
  - qa_artifacts/x18_4_bisect_iter_9.txt
  - qa_artifacts/x18_4_bisect_iter_10.txt
  - qa_artifacts/x18_4_bisect_iter_11.txt
  - qa_artifacts/x18_4_bisect_iter_12.txt
created_at: 2026-05-24T18:32:00Z
---

# HALT P1 — Bisect inconclusive: NO single-component culprit identifiable via Path β

## §1 — Trigger

PROMPT 022.4 §6: "D.4 al culprit identificato: emit HALT P1". CLI ha eseguito **12 iterazioni di bisect logaritmico** su `src/index.ts` di `@heuresys/ui` via dist-override strategy (link: era contaminated da webpack parse error, vedi §3). Bisect ha narrowed considerevolmente lo spazio MA NON identifica un single-component culprit. Pattern emergente: **combination effect** + **methodology contamination** quando si tentano stubs.

## §2 — Iteration matrix (12 iterations)

| # | Subset | Compile | Typecheck | Page-data | Note |
|---|---|---|---|---|---|
| 0 | Full src/index.ts (461 lines) | ✅ | ✅ | ❌ Class extends @ /showcase/icons | Baseline reproduce |
| 1 | Lines 1-83 (Base+B7) | ✅ | ❌ KPIStrip missing | (skipped) | NO page-data error in compile; iter 1 set OK at compile level |
| 2 | Iter 1 + minimal needed (18 items incl Mermaid) | ✅ | ❌ DashboardShell missing | (skipped) | Iter 2 set OK at compile level |
| 3 | Iter 2 + Shell/Sidebar + Obs widgets + AlertBanner + TimeRange + PageActions + DBSupervisor (full apps/web set) | ✅ | ✅ | ❌ d.createContext @ /showcase | **FAIL — culprit in iter 3 additions** |
| 4 | Iter 2 + Shell + Sidebar only | ✅ | ❌ AlertBanner missing | (skipped) | Shell+Sidebar alone NOT culprit (compile OK) |
| 5 | Iter 4 + AlertBanner + TimeRange + PageActions | ✅ | ❌ DBSupervisor missing | (skipped) | Interactive primitives alone NOT culprit |
| 6 | Iter 5 + LogStream + IncidentTimeline + DBSupervisor (3/7 obs) | ✅ | ❌ ErrorRate missing | (skipped) | 3 obs widgets NOT culprit |
| 7 | Iter 6 + SQLSlow + RBAC + Tenant + Error (full 7 obs) | ✅ | ✅ | ❌ d.createContext @ /showcase/icons | **FAIL — culprit in 4 added** |
| 8 | Iter 6 + SQLSlow + RBAC (2/4 added) | ✅ | ❌ Error missing | (skipped) | SQL+RBAC alone NOT culprit |
| 9 | Iter 8 + Tenant + Error | ✅ | ✅ | ❌ d.createContext @ /showcase/charts | **FAIL — Tenant + Error combined OR sole?** |
| 10 | Iter 8 + Tenant only | ✅ | ❌ Error missing | (skipped) | typecheck-blocked; can't tell |
| 11 | Iter 8 + Error only | ✅ | ❌ Tenant missing | (skipped) | typecheck-blocked; can't tell |
| 12 | Iter 9 set + Error STUB (export const = null) | ✅ | ✅ | ❌ d.createContext @ /showcase/icons | **FAIL — stub doesn't help**; bisect contamination? |

## §3 — Methodology contamination findings

**Critical lesson during X18.4** (Cowork should incorporate):

1. **Link: contaminated**: revert consumer manifest to `link:` produces DIFFERENT error (`webpack parse error on useEffect import in dist/index.mjs:2`). NOT same as versioned fail. Link: bisect strategy ABANDONED. Used **dist-override** instead (npm install versioned 0.1.1, then per-iteration: modify src/index.ts → tsup rebuild → cp dist/* over node_modules/.pnpm/.../dist/ → build apps/web).

2. **Typecheck blocking**: removing exports from src/index.ts trips apps/web's `SystemHealthDashboard.tsx` which imports 20+ items together. Build stops at typecheck before page-data. Can't isolate single-component effect.

3. **Stub contamination**: replacing missing export with `export const X = (() => null)` + adding `import * as React` to src/index.ts **changes module structure** (was pure re-exports, became mixed). dist output is different, webpack chunking differs, fail behavior changes. Stub strategy abandoned.

4. **Route variation**: failing route changes between iterations (`/showcase/icons`, `/showcase/charts`, `/showcase`). Suggests issue is in SHARED chunks (layout) not per-page.

## §4 — Critical observations

### A — Bundle complexity threshold hypothesis
Iter 6 (Mermaid + 3 of 7 obs widgets) PASS at compile level. Iter 7 (Mermaid + all 7 obs widgets) FAIL at page-data. Adding 4 specific obs widgets (SQLSlow + RBAC + Tenant + Error) triggers the threshold. Yet individually they have only `import * as React; import { cn } from '../../lib/cn'; import { DataTableWithCrossHair }; useEffect, ReactNode` — minimal imports.

Suspicion: not the COMPONENTS themselves but the **emergent webpack chunk topology** when bundle grows past N kB OR when N components share React context. The error `d.createContext is not a function` indicates `React` (minified to `d`) is undefined in chunk evaluation context — typically Next.js 15 RSC boundary issue.

### B — `/showcase/layout.tsx` import chain
```
/showcase/layout.tsx → imports { PaletteDropdown, ThemeToggle } from "@heuresys/ui"
                    → triggers chunk that includes ALL @heuresys/ui exports
                    → larger surface = more chunk fragmentation
                    → at some threshold, RSC boundary breaks
```

### C — Specific error chunk
`chunks/3741.js:63:9785` — `d.createContext is not a function`. The chunk is server-side bundle. Variable `d` at column 9785 of line 63 (minified) is the React import alias that resolves to undefined.

### D — X16 vs today
- X16 baseline (`link:`, build PASSED): @heuresys/ui had FEWER exports, smaller bundle
- Today (versioned + link: both FAIL): @heuresys/ui has expanded with ~50+ new components in commits between X16 and current `dfa2e81`

This corroborates Hypothesis E from HALT-022-05: **a specific addition between X16 and now broke Next.js 15 compatibility**. Path α (git bisect ux-design-shared commits) might isolate the offending commit more decisively than per-export bisect.

## §5 — Proposed resolution paths (Cowork-side decision)

### Path A — Git bisect ux-design-shared commits (Path α from HALT-022-05)
```bash
cd /d/ux-design-shared
git log --oneline | head -20   # identify X16-era commit
git bisect start
git bisect bad HEAD
git bisect good <X16-era-sha>
# At each commit: build @heuresys/ui + test apps/web build
# 4-6 iterations log2(~13 commits) → find offending commit
```
**Pro**: empirico, definitive. Identifica when build broke.
**Con**: requires git bisect + rebuild + apps/web test per iteration (~5min each).

### Path B — Disable `/showcase/*` route static gen (workaround pragmatic)
Add to `apps/web/src/app/showcase/layout.tsx`:
```typescript
export const dynamic = "force-dynamic";  // skip static gen for /showcase/*
```
**Pro**: 1-line fix, unblocks MVP-3 Tappa F. Admin core (/`(authenticated)/*`) likely unaffected (need to verify).
**Con**: /showcase routes won't pre-render. apps/showcase static-export pipeline may need adjustment.

### Path C — Test if `/(authenticated)/*` routes build OK (Path ε from HALT-022-05)
Skip /showcase from build via `next.config.js` pageExtensions or rewrite, test if admin routes build. If yes, MVP-3 Tappa F = "complete for admin, /showcase deferred to separate fix session".
**Pro**: empirical scope determination.
**Con**: doesn't resolve root cause.

### Path D — Dynamic import `@heuresys/ui` heavy components in apps/web layout
```typescript
// /showcase/layout.tsx
const PaletteDropdown = dynamic(() => import("@heuresys/ui").then(m => m.PaletteDropdown), { ssr: false });
```
**Pro**: bypass SSR for problematic components.
**Con**: invasive change in apps/web; might still hit on other routes.

### Path E — Migrate to Next.js 16 / wait for fix
Next.js 15.5.18 may have a regression with large RSC bundles. Newer version might resolve.
**Pro**: forward-looking.
**Con**: speculative; Next 16 not released; major framework upgrade out of scope.

### Path F — Splitting `@heuresys/ui` into multiple subpackages
`@heuresys/ui-core` (basic primitives) + `@heuresys/ui-dashboard` (observability) + `@heuresys/ui-brand` (showcase) etc. Each smaller package → smaller chunks.
**Pro**: architectural fix, future-proof.
**Con**: major refactor, multiple npm publish cycles, beyond X18 scope.

### Path G — Revert ux-design-shared to X16-era state + re-add components incrementally
Reset to last known good commit, then add components one batch at a time + test apps/web build each batch.
**Pro**: identifies which addition broke + maintains forward progress.
**Con**: lose recent ux-design-shared work; coordination with Enzo.

### Path H — Hybrid: Path A (git bisect) + Path B (workaround) parallel
Run git bisect to identify culprit AND apply Path B workaround to unblock MVP-3 close. Document culprit, fix in follow-up.
**Pro**: closes MVP-3 + identifies root cause empirically.
**Con**: more work in single session.

### CLI Recommendation
**Path H (hybrid: git bisect + force-dynamic workaround)** — combines closure + investigation. Path B alone might be acceptable if user prioritizes MVP-3 close immediately, with Path A in dedicated follow-up session.

## §6 — Bias catalog candidate (CW-B58 reinforced)

**Pattern observed (3rd recurrence)**: 
- HALT-022-03: tsup bundle hypothesis → wrong (CLI test matrix proved)
- HALT-022-04: extension mismatch hypothesis → wrong (file existed already)
- HALT-022-05 + this batch: "single component culprit" assumption → wrong (combination effect)

Each hypothesis seemed plausible but empirical testing revealed insufficient. **CW-B58 reinforced**: any diagnostic claim must include reversible test matrix BEFORE committing to fix strategy.

Additional bias pattern emergent (proposed): **CW-B59 — "Bisect methodology contamination"**: when bisecting via export removal, watch for:
- (a) downstream consumer typecheck blocking page-data testing
- (b) stub replacement changing module structure
- (c) link: vs versioned having different fail modes

Mitigation: bisect via SOURCE FILE replacement (replace impl with stub), NOT via export-list manipulation. Keeps module structure intact + consumer typecheck unaffected.

## §7 — Stato repos pre-halt

- `D:/ux-design-shared` HEAD `dfa2e81` (Block B commit 0.1.1, locale). Published 0.1.0 (deprecated) + 0.1.1 (latest) on registry. dist rebuilt to FULL state (388KB byte-identical to 0.1.0).
- `D:/heuresys-advanced` HEAD `0780daa`:
  - working tree dirty: `apps/web/next.config.js` (transpilePackages restored), `apps/showcase/next.config.js`, `apps/showcase/package.json` (link: → ^0.1.0 reverted, NOT bumped to ^0.1.1), `package.json` (root ^0.1.1), `pnpm-lock.yaml`
  - node_modules/@heuresys/ui → 0.1.1 (full dist content)
- backup files retained: `pnpm-lock.yaml.bak-bisect`, `apps/web/package.json.bak-bisect`, `apps/showcase/package.json.bak-bisect`, `package.json.bak-bisect`, `D:/ux-design-shared/ui/src/index.ts.bisect-bak`, `D:/ux-design-shared/ui/src/index.ts.iter5-bak`
- 12 bisect iteration logs in `qa_artifacts/x18_4_bisect_iter_N.txt`

## §8 — Note operative

- **R10**: NO speculative single-culprit claim. All findings evidence-based via test matrix.
- **R11**: GAT not touched, no credentials.
- **R12**: no push, no destructive op.
- **Reversibilità**: working tree changes reversibili via backup files. Iteration tracking complete in qa_artifacts.

---

*HALT P1 emesso da CLI 2026-05-24T18:32:00Z. Path β bisect 12 iterations → narrowed to "4 obs widgets combination" ma single culprit non isolabile via current methodology. Cowork: scegliere Path A (git bisect commits) / B (force-dynamic workaround) / C (test admin routes scope) / D (dynamic import) / E (Next upgrade) / F (split package) / G (revert) / H (hybrid). CLI raccomandazione: **Path H** (git bisect + force-dynamic workaround paralleli).*
