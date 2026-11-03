# CW-B59 — True root cause analysis (S935 Path A bisect outcome)

> **STORICO — RISOLTO il 2026-05-27** (verificato S1030, cluster `Z-225`).
> **Fix effettivo**: commit **`7f6e174e`** — *«fix(web): CW-B59 — re-enable /showcase via ssr:false client boundary»*.
> Non è servito né il bisect §4, né lo split di `@heuresys/ui` (Path F, §6). Le route `/showcase`
> sono live in `apps/web/src/app/showcase/` e `apps/web/src/_disabled_showcase_X18/` non esiste più.
> Le 3 open question del §8 sono chiuse — vedi **§9** in fondo. Da qui in poi il documento è
> **cronaca dell'analisi**, non un piano da eseguire.

**Updated**: 2026-07-25 (chiusura formale; analisi originale 2026-05-26 Cowork S935 phase C)
**Status**: **RESOLVED** — root cause identificata e corretta (client boundary `ssr:false`).
**Author**: Cowork forensic post-S934.

---

## §1 — Old narrative (CW-B59 X18.4 hypothesis) — REFUTED

The X18.4 amendment cascade (PROMPT 022.4 → 022.5) framed the `/showcase` build failure as a **Next 15 RSC bundle-threshold** issue: the per-page JavaScript bundle for `apps/web/src/_disabled_showcase_X18/` routes was alleged to exceed an empirical threshold (~1 MB) that Next 15 enforces during page-data collection, with the heavy `@heuresys/ui` deps tree (Three.js, Plotly, ECharts, framer-motion, Radix-UI, d3) cited as cause.

12 bisect iterations followed under HALT-022-06; the bisect was **declared inconclusive** because no single commit could be identified as the threshold-crossing turn — the narrative concluded that the threshold was an **emergent property** of the post-X18 cumulative additions, not a single change.

Path B+C pragmatic workaround was applied: `apps/web/src/app/showcase` → `apps/web/src/_disabled_showcase_X18/` + tsconfig exclude. Admin routes 40+ build OK. /showcase deferred to dedicated DEFER-F session.

This document **refutes the narrative** based on fresh inspection of `qa_artifacts/x18_4_bisect_iter_12.txt`.

---

## §2 — Empirical evidence: the actual error

`qa_artifacts/x18_4_bisect_iter_12.txt` (the last bisect run before HALT) records the failure stack verbatim:

```
[Error: Failed to collect configuration for /showcase/icons] {
  [cause]: TypeError: d.createContext is not a function
      at 24981 (D:\heuresys-advanced\apps\web\.next\server\chunks\3741.js:63:9785)
      at c (D:\heuresys-advanced\apps\web\.next\server\webpack-runtime.js:1:128)
      at 96444 (D:\heuresys-advanced\apps\web\.next\server\app\showcase\icons\page.js:6:4659)
      ...
}
```

The cause is **NOT bundle size** (no `EBUNDLE_TOO_LARGE` / RSC-threshold-specific Next error code). The cause is `TypeError: d.createContext is not a function` — a **React runtime error**: at server-execution time, the minified identifier `d` (which is the bundler-renamed React import in chunk `3741.js`) does not have a `createContext` method.

This pattern is canonical for one of three causes:

1. **React peer dependency mismatch** — two React instances are present in the bundle graph; one chunk references React 18 (where `createContext` lives on the default export), another references React 19 (where the export shape may differ in chunk-minified form).
2. **`'use client'` directive missing on a module that calls `React.createContext()` at module load** — Next 15's page-data collection executes module top-level code server-side; if a Radix-UI / `@heuresys/ui` component sets up its `createContext` outside a client boundary, the server execution path tries to call `createContext` on a React shape that doesn't expose it.
3. **CJS/ESM interop drift** — `@heuresys/ui` published with tsup dual output (`.mjs` + `.cjs`). If `apps/web` resolves the CJS variant but a transitive (Radix) resolves the ESM variant of the same module, two React shapes coexist.

---

## §3 — Why bisect was inconclusive (CW-B58 lesson applied)

The bisect operated on the **wrong axis**: it asked *"which commit added enough bytes to cross the threshold?"* — but there is no threshold. Every iteration tested a candidate commit, observed the same `createContext` error, and could not distinguish "cross-threshold" from "below-threshold". The bisect was bound to be inconclusive because the binary signal (build pass/fail) did not vary linearly with commit position.

The correct bisect axis is *"which commit introduced the React peer-dep mismatch or the missing `'use client'` directive?"* — a different question entirely.

CW-B58 lesson: **empirical test matrix > narrative diagnosis**. Applied here: had the bisect script captured the actual error message (not just exit code) and grep'd for `createContext`, the narrative would have collapsed at iter 1.

---

## §4 — Path A revised bisect strategy

**New bisect target**: find the first commit where running `pnpm --filter @heuresys/web build 2>&1 | grep -q "createContext is not a function"` returns true.

**Pre-bisect setup** (essential):
- Restore `apps/web/src/app/showcase` from `apps/web/src/_disabled_showcase_X18/`.
- Re-add the showcase routes to `apps/web/tsconfig.json` includes (remove the exclude).
- Run `pnpm install` to refresh the workspace.

**Bisect range**: start = last known good (HEAD pre-X18-saga = `e13eb73` post-C19.1 accept-residual) — end = current HEAD post-S934 commit. Use `git bisect start <bad> <good>`.

**Bisect script** (replaces the X18.4 iter script that only checked exit code):

```powershell
# scripts/bisect-cw-b59-createctx.ps1 — to be created in S935 phase C ship script
$buildOutput = pnpm --filter @heuresys/web build 2>&1 | Out-String
if ($buildOutput -match "createContext is not a function") {
    Write-Host "BAD: createContext error reproduced"
    exit 1   # mark bad to git bisect
} elseif ($buildOutput -match "(?ms)Compiled successfully.*?Generating static pages") {
    Write-Host "GOOD: build clean"
    exit 0   # mark good
} else {
    Write-Host "SKIP: unrelated failure"
    exit 125  # let git bisect skip
}
```

**Expected outcome**: bisect should converge to the commit that either (a) bumped a Radix-UI peer dep without updating `@heuresys/ui`'s consumer-side React pinning, (b) added a new `@heuresys/ui` component that calls `createContext()` at module-top without `'use client'`, or (c) introduced the tsup dual-output config that drifted CJS/ESM resolution.

If after running this revised bisect the convergence is still inconclusive, **switch to Path F** (split @heuresys/ui), but only after exhausting **Path G**: pin React 19.2.5 as a global pnpm override (see §5).

---

## §5 — Path G (NEW) — global React pinning via pnpm overrides

The fastest hypothesis-test: force a single React instance across the workspace via `pnpm.overrides`. If the `createContext` error disappears, the root cause is hypothesis #1 (peer-dep mismatch); if not, it's #2 or #3.

**Proposed override** (additions to `package.json` `pnpm.overrides`):

```json
"pnpm": {
  "overrides": {
    "vite": "^6.4.2",
    "postcss": "^8.5.10",
    "esbuild": "^0.25.0",
    "qs": ">=6.15.2",
    "exceljs>uuid": ">=11.1.1",
    "react": "19.2.5",
    "react-dom": "19.2.5",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3"
  }
}
```

**Cost**: zero risk for admin routes (already use 19.2.5 explicitly); cost is one `pnpm install` lockfile refresh + one rebuild. Effort 10 minutes.

**If Path G fixes**: documenta in ADR-0021 (new) + close CW-B59 as "MITIGATED via React pinning"; the proper fix in `@heuresys/ui` source (declare React + ReactDOM + @types as `peerDependencies`, not `dependencies`) is parallel work in `ux-design-shared` repo.

**If Path G does NOT fix**: proceed with revised Path A bisect from §4. If bisect still inconclusive after 5 iter on the new error-grep axis, fall to **Path F (split @heuresys/ui)**.

---

## §6 — Path F (fallback) — split @heuresys/ui into 3 packages

If Paths G and A both fail, the architectural workaround remains:

- **`@heuresys/ui-core`** — Radix primitives + Button/Card/Input/DataTable + basic layout. Used by admin routes (40+).
- **`@heuresys/ui-charts`** — Recharts/Chart.js wrappers (KPIStrip, LineChart, BarChart). Used by dashboard.
- **`@heuresys/ui-3d`** — Three.js / d3-force / ECharts / Plotly heavy renderers. Used by `/visualizations` and `/showcase` only.

`apps/web` admin routes import `@heuresys/ui-core` + `@heuresys/ui-charts`. `/showcase` and `/visualizations` import all three. The smaller bundle graph eliminates whichever chunk has the React mismatch.

Effort: 4-6h (3 separate npm publishes + dep bump in apps/web + transitive cleanup).

---

## §7 — Recommended sequence

1. **Try Path G first** (10 min). If fixes → close DEFER-F.
2. **If not**, run revised Path A bisect (§4) (1-2h).
3. **If still inconclusive**, fall to Path F (4-6h).

Total worst-case: ~8h. Best case (Path G works): 10 min + lockfile refresh.

---

## §8 — ~~Open questions~~ → chiuse, vedi §9

- ~~Does `@heuresys/ui@0.1.1` declare React as `peerDependency` or `dependency`?~~
- ~~Are there Radix-UI components in `@heuresys/ui` source files **without** `'use client'` directive?~~
- ~~Does the bisect from §4 converge on a commit that touched tsup config?~~

---

## §9 — Esito reale (chiusura, verificata 2026-07-25)

**Come è stato risolto.** Nessuno dei tre percorsi ipotizzati nel §7. La correzione (commit `7f6e174e`,
2026-05-27) sposta l'import del barrel `@heuresys/ui` **fuori dall'esecuzione server-side**: un modulo
client dedicato `apps/web/src/app/showcase/_ui-client.tsx` ri-esporta ogni componente showcase via
`next/dynamic(..., { ssr: false })`, e `apps/web/src/app/showcase/layout.tsx` importa solo da lì. Con il
barrel mai valutato durante la page-data collection, `d.createContext is not a function` non può più
presentarsi. Lo stesso pattern è applicato alle pagine chart autenticate
(`apps/web/src/app/(authenticated)/_charts-client.tsx`). Vincolo scoperto e annotato nel codice: le
opzioni di `next/dynamic` devono essere un **oggetto letterale inline** — una costante estratta non viene
riconosciuta dal transform.

**Risposte alle 3 open question** (misurate sul reale, non dedotte):

| Domanda §8 | Risposta | Evidenza |
|---|---|---|
| React è `peerDependency` o `dependency` in `@heuresys/ui`? | **peerDependency** — l'ipotesi #1 (due istanze React) è rimossa alla radice a monte | `node_modules/@heuresys/ui/package.json` v**0.1.9**: `peerDependencies: {react ^19.2.0, react-dom ^19.2.0, @types/react ^19.2.0, @types/react-dom ^19.2.0}`; `react` **assente** da `dependencies` |
| Radix senza `'use client'` nei sorgenti upstream? | **Domanda superata**: il boundary `ssr:false` rende irrilevante la direttiva sui singoli moduli per questo failure mode | `apps/web/src/app/showcase/_ui-client.tsx`, `apps/web/src/app/showcase/layout.tsx:9` |
| Il bisect §4 converge su tsup? | **Mai eseguito, non serve** — il fix ha preceduto il bisect. Lo script `bisect-cw-b59-createctx.ps1` è archiviato in `docs/archive/scripts-exhausted/` | `git log --oneline --all -- apps/web/src/_disabled_showcase_X18` → ultimo commit `7f6e174e` (rimozione) |

**Path G (§5) — stato**: adottato e tuttora vivo, ma come **igiene**, non come fix: `package.json`
`pnpm.overrides` pinna oggi `react`/`react-dom` a **19.2.7** e `@types/react` a 19.2.17 (le versioni
del §5 sono superate). Nessun ADR-0021 «CW-B59» è stato creato — ADR-0021 nel repo è un altro
argomento (SSH tunnel automation); la decisione vive nel commit e in questo documento.

**Path F (§6) — non necessario**: `@heuresys/ui` non è stato splittato. La granularità è arrivata
invece dai **subpath exports** (`.`, `./charts`, `./markdown`, `./styles`, `./brand/candidates`,
`./assets/brand/*`), che ottengono lo stesso beneficio sul grafo di bundle senza tre pacchetti.
