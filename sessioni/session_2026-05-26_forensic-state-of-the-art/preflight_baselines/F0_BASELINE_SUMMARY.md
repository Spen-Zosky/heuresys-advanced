# Phase 0 — Baseline Capture Summary

**Date**: 2026-05-26 03:14-03:20 CET
**HEAD pre-flight**: `08a0d11` (post P1 housekeeping)
**Working tree state**: clean post commits 1-9 P1 + 1 untracked (`PREFLIGHT_PLAN_2026-05-26.md`, intenzionale)

---

## F0.1 — Tunnel SSH 5433

- **Status**: ✅ UP (Windows-side via PowerShell `Test-NetConnection localhost:5433`)
- **Note WSL2**: tunnel NOT visible from WSL2 namespace (`connect: Connection refused` su bash) — questo è atteso, network namespace separato. Test commands devono partire da Windows.
- **Verified-by**: PowerShell `Test-NetConnection localhost 5433` → True

## F0.2 — pnpm install -r

- **Status**: ✅ OK (lockfile up to date, packages/shared prepare done in 10.8s)
- **Note**: pnpm 9.15.0 (project pin); update 11.3.0 available ma non urgente
- **Verified-by**: `pnpm install -r` exit=0

## F0.3a — Typecheck per workspace

| Workspace | Exit | Status |
|---|---|---|
| @heuresys/shared | 0 | ✅ |
| @heuresys/api | 0 | ✅ |
| @heuresys/api typecheck:test | 0 | ✅ |
| @heuresys/web | 0 | ✅ |
| @heuresys/showcase | 0 | ✅ |

**Drift rilevato**: root script `pnpm typecheck` usa `pnpm -r --filter='@heuresys/*' run typecheck` ma in PowerShell il wildcard `@heuresys/*` non è espanso correttamente → "No projects matched the filters". Workaround usato: filter per ogni workspace specifico. Fix root script → Phase 3 (CODE base).

## F0.3b — Lint per workspace

| Workspace | Exit | Status |
|---|---|---|
| @heuresys/shared | 0 | ✅ |
| @heuresys/api | 0 | ✅ |
| @heuresys/web | **1** | ❌ **37 errors** |
| @heuresys/showcase | 0 | ✅ |

**Errors apps/web (37 totali in 3 file)**:
1. `apps/web/scripts/generate-favicons.mjs` (6 errors): `no-undef` su `console`, `document`, `process` — script Node.js standalone, eslint env wrong (missing `node` env)
2. `apps/web/scripts/generate-social-kit.mjs` (6 errors): stesso pattern
3. `apps/web/src/components/SystemHealthDashboard.tsx` (25 errors): `no-sparse-arrays` "Unexpected comma in middle of array" — array SVG path data o data structure con commas intenzionali

**Action**: fix in Phase 3 (CODE base, prima di refactor CODE-6).

## F0.3c — i18n parity check

- **Status**: ✅ OK
- **Output**: `Parity OK (23 keys × 2 locales × 1 namespaces)`
- **Verified-by**: `pnpm i18n:check` exit=0

## F0.3d — pnpm test (apps/api integration)

- **Status**: ⚠️ **partial captured** (MCP PowerShell timeout interrupts vitest child process)
- **Captured**: ~50% test run (auth + me + users integration tests via 9+9+13 tests visible nei log)
- **vitest config drift**: Vitest 4 DEPRECATED `test.poolOptions` → migrate top-level. **Fix applicato**: `apps/api/vitest.config.ts` aggiornato (`poolOptions` rimosso, sostituito da `fileParallelism: false` + `maxWorkers: 1` + `minWorkers: 1`). Da committare in Phase 0 closure.
- **Baseline known da STATE.md (2026-05-25)**: 341 PASS / 1 FAIL (skills.integration.test:131) / 5 SKIP
- **Decision autonoma**: assumo baseline noto come riferimento; validation completa = Gate G7 con strategia chunked.

## F0.4 — Git status

- **Status**: ✅ CLEAN (1 untracked atteso: `PREFLIGHT_PLAN_2026-05-26.md`)
- **HEAD**: `08a0d11`
- **Sync origin/main**: 0/0 (post P1 push)

## F0.5 — .secrets/ struct

- `D:\heuresys-advanced\.secrets\jwt_private.pem` ✅ presente (NON aperto)
- `D:\heuresys-advanced\.secrets\jwt_public.pem` ✅ presente (NON aperto)
- Coppia keypair RS256 per JWT auth — verifica struct only

---

## Gate G0 — Verdict

| Check | Status |
|---|---|
| Tunnel SSH 5433 UP | ✅ |
| pnpm install OK | ✅ |
| Typecheck all workspaces | ✅ |
| Lint shared/api/showcase | ✅ |
| Lint web | ❌ 37 errors (carry to Phase 3) |
| i18n parity | ✅ |
| pnpm test full | ⚠️ partial (Gate G7 reserve) |
| Git clean | ✅ |
| Secrets struct verified (no values logged) | ✅ |

**Gate G0 verdict**: ✅ PASS con 2 riserve documentate:
1. Lint web 37 errors → fix in Phase 3 CODE-base (item aggiunto)
2. Test full validation → deferred to Gate G7 chunked strategy

**Phase 0 closed**. Procedo Phase 1.

---

## Items aggiunti dinamicamente

- **CODE-NEW-1**: fix root script `pnpm typecheck` + `pnpm lint` per PowerShell compatibility (wildcard `@heuresys/*` non escape in PS)
- **CODE-NEW-2**: fix lint apps/web (37 errors in 3 file) → 12 errors no-undef in scripts/*.mjs (add eslint env Node) + 25 errors no-sparse-arrays in SystemHealthDashboard.tsx (real bug? or false positive?)
- **CODE-NEW-3**: commit vitest.config.ts Vitest 4 migration fix (poolOptions → top-level)

---

*F0 Baseline Summary — Cowork session 2026-05-26*
