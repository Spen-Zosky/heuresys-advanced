# Pre-flight residual TODO (post-S935 phase D)

**Updated**: 2026-05-26
**Status**: tracker for residual pre-flight cleanup items not closed in S935 phase D.

---

## §1 — Closed in S935 phase D

| ID | Item | Resolution |
|---|---|---|
| CODE-2 | apps/api dead scripts (`test:integration` + `openapi:generate`) | REMOVED from `apps/api/package.json` (referenced files don't exist). Root `package.json` `openapi:generate` filter-call also removed (dead). |
| CODE-3 | Tailwind 4 source-scan portability (`globals.css:22`) | FIXED — `@source` now points to `node_modules/@heuresys/ui/dist/**/*.{js,mjs}` (npm-resolved, portable across machines). |
| CODE-7 | Dead `"test": "vitest run"` in `apps/web/package.json` | REMOVED. `apps/web` has only Playwright E2E (`tests/e2e/*.spec.ts`), no vitest unit tests. `test:e2e` retained. |

---

## §2 — Deferred (S936+ candidates)

### CODE-5 — Coordinated with S935 phase C ship outcome

**State**: `apps/web/src/_disabled_showcase_X18/` still on disk (18 file dead code per S933 PREFLIGHT_REPORT §4).

**Coordination**: S935 phase C ship script (`scripts/restore-showcase-routes.ps1`) is designed to MOVE `_disabled_showcase_X18/` → `apps/web/src/app/showcase/` (no copy, no leftover). If Path G (React pnpm.overrides) fixes the createContext issue → restore succeeds → CODE-5 auto-resolved (no separate cleanup needed).

If S935 phase C ship reveals Path G insufficient → bisect runs → Path F split @heuresys/ui — at that point CODE-5 is "delete _disabled_showcase_X18/ entirely" because the split lib will allow the canonical `apps/web/src/app/showcase/` to work without the disabled snapshot.

**Effort**: 0 (auto-resolved by phase C) or 30 min (hard-delete fallback).

### CODE-10 — i18n discovery + estensione locales

**State**: `apps/web/src/i18n/{it,en}.json` cover ~23 keys with parity (per `pnpm i18n:check`). MVP-4 will introduce new UI strings; coverage will need to grow proportionally.

**Approach when reopened**:

1. `grep -rE '"[A-Z][a-zA-Z ]{5,}"' apps/web/src/app apps/web/src/components --include='*.tsx' | grep -v 'src/i18n'` to find literal IT/EN strings hard-coded in components (vs translation keys).
2. Per each finding, replace with `t('namespace.key')` + add the key to both `it.json` and `en.json`.
3. Re-run `pnpm i18n:check` to confirm parity preserved.
4. Update `apps/web/src/i18n/keys-changelog.md` (create if missing) with the additions.

**Effort**: ~2-4h once UI surface stabilizes post-MVP-4 streams.

---

## §3 — Out of scope this iteration

Items intentionally NOT touched in S935:

- **CODE-6** queries.ts 47 routes refactor — Phase 4 in original plan, ~10-15h, architectural refactor (extract `apiFetch + useQuery` into per-page `queries.ts`). Deferred to a dedicated S936+ session because (a) doctrine is already respected without it, (b) refactor benefits primarily testability not user-facing behavior, (c) high risk of regression touching 47 page.tsx files in one batch.

---

## §4 — Verification commands

After running the S935 master ship script:

```powershell
cd D:\heuresys-advanced

# CODE-2 verify
pnpm --filter @heuresys/api run | findstr "test:integration openapi:generate"
# Expected: empty output (scripts removed)

# CODE-3 verify
grep "@source" apps\web\src\app\globals.css
# Expected: "@source \"../../node_modules/@heuresys/ui/dist/**/*.{js,mjs}\";"

# CODE-7 verify
pnpm --filter @heuresys/web run | findstr "\"test\""
# Expected: only test:e2e (NOT test)

# CODE-3 functional verify (after pnpm install)
cd apps\web
pnpm build
# Expected: build succeeds; .next/static/css/*.css contains classes used in @heuresys/ui dist
```

---

## §5 — Related

- S933 PREFLIGHT_REPORT §4 (original deferred-items list)
- S935 master ship script (`cowork_reserved/auto-ship/run-all-s935.ps1`)
- CW-B59 docs (S935 phase C) — CODE-5 coordination
