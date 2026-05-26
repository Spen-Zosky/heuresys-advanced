# S936-1 Path G build test — outcome 2026-05-26

**Test**: restore `_disabled_showcase_X18` → `apps/web/src/app/showcase` + `pnpm install` (with new React pnpm.overrides) + `pnpm --filter @heuresys/web build`.

**Outcome**: **PARTIAL** — Path G changed the failure mode but did not fully close CW-B59.

## Evidence

`qa_artifacts/s936_pathG_build_202605261618.txt` (full build log, first attempt):

```
✓ Compiled successfully in 2.6min
   Skipping linting
   Checking validity of types ...
   Collecting page data ...
[Error: Failed to collect configuration for /showcase/footer] {
  [cause]: TypeError: Class extends value undefined is not a constructor or null
      at cE (D:\heuresys-advanced\apps\web\.next\server\chunks\3025.js:257:75333)
      ...
}
```

## Analysis

Pre-S935-C (no React overrides): the failure was `TypeError: d.createContext is not a function` on `/showcase/icons` (from `qa_artifacts/x18_4_bisect_iter_12.txt`).

Post-S935-C (with React + react-dom + @types/react + @types/react-dom pnpm.overrides): the failure becomes `TypeError: Class extends value undefined is not a constructor or null` on `/showcase/footer` (NB: different route).

**Interpretation**: forcing single React instance via overrides DID resolve the `createContext` shape mismatch (no longer the first failure). But the next problem in the dependency graph surfaces — a class extending an `undefined` value, a classic symptom of:

1. **Circular import** where the superclass module hasn't finished evaluating before the subclass declaration tries to extend it.
2. **Named export mismatch** where a re-export is missing (renaming or upstream library export drift) and the import resolves to `undefined`.
3. **CJS/ESM interop drift** where a default export is being treated as a named export or vice-versa.

The fact that **compilation succeeded** (2.6 min) but **page-data collection failed** narrows it to runtime-only evaluation of `/showcase/footer` (and likely other showcase routes).

## Decision

- **CW-B59 status flip**: from "partial-mitigation-S935-investigation-shipped" to "partial-mitigation-Path-G-eliminated-react-mismatch-class-extends-issue-remains".
- **Working tree restored**: `_disabled_showcase_X18` back in place, `apps/web/tsconfig.json` reset from HEAD. Build of `apps/web` is GREEN again (admin routes only, /showcase disabled). CI workflow `build-web.yml` will not regress when runners come online.
- **pnpm-lock.yaml drift**: minor (pnpm install run with React overrides). Will commit as part of S936-1 outcome.

## Next path strategy

Path F (split `@heuresys/ui` into 3 sub-packages: ui-core + ui-charts + ui-3d) becomes the **primary** fallback. Splitting reduces the import graph that triggers the `Class extends value undefined` issue (the 3 sub-packages would have minimal circular potential because they're separately exported).

Alternative: revised Path A bisect now searches for `Class extends value undefined` marker (the previous bisect script `scripts/bisect-cw-b59-createctx.ps1` grep'd for `createContext is not a function` — needs updating to also match the new marker).

Effort estimate:
- **Path A revised v2**: 1-2h bisect with `Class extends|createContext` regex.
- **Path F split**: 4-6h architectural work (in `ux-design-shared` repo, publish 3 npm packages, update consumer deps here).

Recommend Path A revised v2 first (cheaper), Path F if inconclusive.

## Files touched (uncommitted as of writing)

- `pnpm-lock.yaml` — minor refresh post `pnpm.overrides` activation. Will commit.
- `qa_artifacts/s936_pathG_build_202605261618.txt` — full build log.
- `qa_artifacts/s936_pathG_build_202605261618.pid` — process PID (cleanup).
- `qa_artifacts/s936_pathG_build_202605261618.log` — empty (background process never wrote).
- `qa_artifacts/s936_pathG_test_outcome.md` — this report.

The restored `_disabled_showcase_X18` directory was already in HEAD (untracked by S935 commits) — no diff there.
