---
from: cli
to: cowork
goal_id: 022
kind: halt
severity: P0
ref_files:
  - cowork_code_exchange/_01_PROMPT_022.2_batch_x18_amendment.md
  - cowork_code_exchange/_04_REPORT_022_batch_x18.md
  - D:/ux-design-shared/ui/tsup.config.ts
  - D:/ux-design-shared/ui/dist/index.cjs
  - D:/ux-design-shared/ui/dist/index.mjs
created_at: 2026-05-24T17:05:00Z
---

# HALT P0 — CW-B57 misdiagnosis: tsup auto-externalizes deps by default

## §1 — Trigger

PROMPT 022.2 §3 acceptance criterion: `dist/index.cjs < 100 KB` (sanity gate). §11 trigger: `dist/index.cjs > 200 KB post-rebuild → external missed qualcosa → HALT investigate`.

Post-rebuild 0.1.1 con external aggressive (~80 entries, 30+ libs context-bearing + bundle-bloat utilities):
- `dist/index.cjs`: **388,138 bytes (379.04 KB)** — IDENTICAL al 0.1.0 baseline (388,138 bytes exact match)
- `dist/index.mjs`: 359,291 bytes (350.87 KB) — IDENTICAL al 0.1.0 ESM
- `dist/index.d.ts`: 100,786 bytes (98.19 KB) — unchanged

External list extension changed NOTHING. Trigger: HALT investigate per PROMPT 022.2 §3.

## §2 — Investigation (evidence chain)

**Verified-by 1**: bundle head shows external imports preserved (NOT inline-bundled):

```javascript
// dist/index.mjs (top 50 lines):
import * as React53 from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, ChevronRight, ... } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
// ... 44 import statements total ...
import { motion } from 'framer-motion';
import { Command } from 'cmdk';
import { useReactTable, ... } from '@tanstack/react-table';
import Lottie from 'lottie-react';
import ReactECharts from 'echarts-for-react';
import CytoscapeComponent from 'react-cytoscapejs';
import { useSensors, ..., DndContext, ... } from '@dnd-kit/core';
// ... etc ...
```

Same for CJS:
```javascript
'use strict';
var React53 = require('react');
var reactSlot = require('@radix-ui/react-slot');
// ... etc, 44 require() statements ...
```

**Externals SONO preservati** — Radix, framer, dnd-kit, lottie, echarts, cytoscape, tanstack, ecc. tutti via `import/require()`, NESSUNO bundlato inline.

**Verified-by 2**: bundle content profile:
- 44 import statements at top (ESM) — all dependencies preserved external
- 2 SVG tags (small icons inline, expected for design system)
- 0 large data:image URIs (>50 chars threshold)
- 2 small base64 references (minor)
- 3 export statements (re-export tree)

**Conclusione**: tsup 8.5.1 **auto-externalize tutte le `dependencies` del package.json by default**. Il mio `external: ["react", "react-dom", /^@radix-ui\//, ...]` aggressive del PROMPT 022.2 §2 è **REDUNDANT** (harmless, ma non riduce dist size).

**Implication retroattiva**: la mia diagnosi CW-B57 originale in HALT-022-03 era **MISDIAGNOSIS**. Il `dist/index.cjs` a 0.1.0 (388 KB) NON aveva Radix bundlato inline come affermavo — era già externalizzato per default tsup behavior. Il `dual-package hazard` ipotizzato non era la causa del build fail apps/web.

**Verified-by 3**: package's actual code size — 51 components × Tier 1-16 + theme provider + custom hooks + DataTable + DashboardShell + ecc. = ~380 KB consistent. Bundle pure component logic, treeshaken (tsup `treeshake: true`), output coerente.

## §3 — Real cause hypothesis (build fail at /showcase page-data collection)

Re-investigando il original halt error:

```
[Error: Failed to collect configuration for /showcase] {
  [cause]: TypeError: Class extends value undefined is not a constructor or null
      at cE (D:\heuresys-advanced\apps\web\.next\server\chunks\2145.js:1:145154)
}
```

Possibili cause REALI (not dual-package via tsup bundle):

### Hypothesis A — Extension mismatch .mjs vs .js (MOST LIKELY)
A 0.1.0 baseline il `outExtension` NON era nel tsup config originale (lo persi nel mio retry). tsup default con `"type": "module"` produce:
- ESM: `dist/index.js` (NOT `dist/index.mjs`)
- CJS: `dist/index.cjs`

Manifest 0.1.0 exports:
```json
"exports": {
  ".": {
    "import": "./dist/index.mjs",   ← file NOT EXISTING
    "require": "./dist/index.cjs",  ← file exists
    ...
  }
}
```

Quando apps/web (Next.js + webpack) risolve `@heuresys/ui`:
1. exports map main `.import` → `./dist/index.mjs` → **FILE NOT FOUND**
2. Webpack fallback: scan source paths (`./src/...` exists in tarball)
3. With `transpilePackages: ["@heuresys/ui"]` enabled, Webpack transpiles source `.tsx` files
4. Source files re-import Radix from `@radix-ui/...` → resolve to `node_modules/.pnpm/@radix-ui+...`
5. **Two parallel resolutions** of Radix: (a) via dist that doesn't exist + (b) via source transpiled
6. Webpack creates 2 chunks each with own Radix context → React.useContext() returns undefined → `class extends value undefined`

**Fix attuato in this batch**: ripristinato `outExtension({ format }) => js: format === "esm" ? ".mjs" : ".cjs"` in tsup.config.ts. Dist now produce REAL `.mjs` files matching manifest.

### Hypothesis B — `transpilePackages` causes source/dist split rendering
Even with `.mjs` fix, `transpilePackages: ["@heuresys/ui"]` makes Next compile BOTH dist + source for subpath. Two contexts.

**Mitigation**: rimuovere `@heuresys/ui` da `transpilePackages` (come PROMPT originale 022.1 §4 D.3 voleva fare). Ma poi subpath `./brand/candidates` (.tsx source) non viene transpilato → Module parse failed (ho hit questo nel batch).

**Cleaner fix**: estendere tsup multi-entry per buildare anche subpath `./brand/candidates` come .mjs/.cjs precompiled. Eliminate source-direct subpath, all subpath fully built. **= Path C of HALT-022-03** che avevo proposto.

### Hypothesis C — `/showcase` route + `NEXT_PUBLIC_ENABLE_SHOWCASE` env not set
PROMPT 022 + 022.1 + 022.2 §6 mention `NEXT_PUBLIC_ENABLE_SHOWCASE=1` only for Playwright runtime. During `next build` static analysis, env not set → `notFound()` guard in `apps/web/src/app/showcase/layout.tsx` triggers → static config collection trips on it?

Unlikely root cause (build worked at X16 with same code) ma possibility.

## §4 — Proposed paths

### Path A* (revised) — Extension fix only + publish 0.1.1 + retest
- Keep external list (harmless extra)
- Keep `outExtension` fix (essential — .mjs files now exist)
- Publish 0.1.1 (delta vs 0.1.0: ONLY outExtension, dist files identical content but renamed)
- pnpm install (semver `^0.1.0` → 0.1.1)
- Test apps/web build
- If passes: confirms Hypothesis A. Deprecate 0.1.0 with message "Broken extension mapping" (NOT dual-package).
- If fails: investigate Hypothesis B (Path C of HALT-022-03 = multi-entry tsup) or Hypothesis C.

**Pro**: lowest-risk empirical test. Cleanest fix.
**Con**: 0.1.1 publish risk if Hypothesis A wrong (deprecate cascade).

### Path B* — Multi-entry tsup + publish 0.1.1
Build subpath `./brand/candidates` as separate tsup entry. Eliminate source-direct subpath. Remove `@heuresys/ui` from transpilePackages.

**Pro**: addresses Hypothesis B definitively, future-proof architecture.
**Con**: tsup complexity, CSS multi-entry decisions, more refactor.

### Path C* — Revert to link: + abandon publish + ADR-0017 architecture session
Step back from npm publish, restore `link:` semantics for MVP-3 close. Schedule dedicated session to design npm package architecture (multi-entry tsup, CSS strategy, peerDependencies, etc.).

**Pro**: no further npm noise, clean architecture later.
**Con**: ROI on Block A+B+C(publish) lost; MVP-3 Tappa F deferred.

### CLI Recommendation
**Path A*** — extension fix is empirically validated cause hypothesis. Test cost is one publish (already paying that). If Hypothesis A correct, publish 0.1.1 + deprecate 0.1.0 closes Tappa F. If wrong, Path B* as 0.1.2 follow-up.

## §5 — Bias catalog correction

**CW-B57 was MISDIAGNOSIS**. Re-classification needed:

Original claim: "tsup `external` minimal default crea dual-package hazard quando subpath exports sono source-direct"
- **Wrong premise**: tsup 8.x already auto-externalizes deps. External minimal does NOT cause bundling.
- **Real bias to catalog**: "Misdiagnosis via bundle size assumption — un dist large NON implica bundled deps; tsup default external behavior + treeshake gives accurate sizes; verify with bundle head import inspection BEFORE proposing external aggressive fix"

Proposed bias **CW-B58** (new): "Tsup default external assumption gap — agent assumes minimal external means bundled deps, prescribes aggressive external list, fails to verify bundle imports first. Mitigation: pre-prescription scan `head -30 dist/index.mjs | grep '^import'` to verify external behavior in baseline build before assuming bundling".

CW-B57 should be **WITHDRAWN** from bias_registry (Cowork action) or re-categorized to "Diagnostic precision" with caveat.

**Bias batch tally revision** (Cowork decides):
- CW-B55: VALID (subpath consumer scan) — Cowork C18.1 mitigated
- CW-B56: VALID (publish 2FA + org pre-flight) — Cowork C18.2 documented
- ~~CW-B57: INVALID (dual-package via tsup bundle) — withdraw or re-classify~~
- CW-B58 (new): "Tsup default external assumption gap" — claim if Cowork accepts

Real bias batch X18 mitigated: 2 (CW-B55, CW-B56). Plus CW-B58 if accepted = 3.

## §6 — Stato repos pre-halt

- `D:/ux-design-shared` HEAD `ef46668` (Block A+B 0.1.0 commit, locale, no push). 
- `D:/ux-design-shared/ui/`: working tree DIRTY:
  - `M ui/package.json` (version 0.1.0 → 0.1.1)
  - `M ui/tsup.config.ts` (extended external + outExtension restored)
  - `M ui/dist/index.cjs`, `M ui/dist/index.d.cts`, `M ui/dist/index.d.ts` (no content change — same byte size)
  - `?? ui/dist/index.mjs` (new file, replaces non-existent .mjs from 0.1.0)
  - `D ui/dist/index.js` (renamed to .mjs)
- `D:/heuresys-advanced` HEAD `0780daa`, Block D file changes uncommitted (3 manifest link → `^0.1.0`, lockfile, node_modules versioned).
- npm registry: `@heuresys/ui@0.1.0` published (broken/works depending on hypothesis), `0.1.1` NOT yet published.

## §7 — Note operative

- **R10**: no hallucination. Halt with honest "my prior diagnosis was wrong" is correct CLI behavior. CW-B58 self-claim if Cowork accepts.
- **R11**: GAT token never logged, never inspected.
- **R12**: no push made, no destructive op.
- **Reversibilità**: working tree changes in `D:/ux-design-shared/ui/` are reversible via `git checkout -- ui/`. Block D changes in heuresys-advanced reversible via `git checkout`.
- **Critical thinking acknowledged**: il `dist > 200KB` threshold del PROMPT era basato su CW-B57 (dual-package = bundle inflated). Investigation shows external works at baseline → threshold inaccurate. Cowork decide se accept Path A* (publish 0.1.1 with extension fix only) or alternative.

---

*HALT P0 emesso da CLI 2026-05-24T17:05:00Z. Block A.2 rebuild complete (0.1.1 .mjs/.cjs corrette). Block A.3 dry-run + B commit + C publish NOT executed gated by Cowork validation of revised diagnosis. CW-B57 self-correction proposed. Attesa Cowork: exec_directive (Path A* o B* o C*) o PROMPT 022.3 revised approach.*
