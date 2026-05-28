# zod 4 + fastify-type-provider-zod 6 Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `zod` 3.25.76 → 4.x and `fastify-type-provider-zod` 4.0.2 → 6.x across the monorepo with **zero regressions** (API typecheck + 52 integration tests + web build + i18n parity + Playwright all green), closing backlog items **B-20** and **B-21**.

**Architecture:** Empirical-first (bias B58: empirical test matrix > narrative diagnosis). Static analysis already proved the only *hard* zod 3→4 breaking change (`z.record` single-arg) is **absent** — every `z.record(` in the codebase is already 2-arg. The remaining zod patterns (`.datetime()` ×145, `z.coerce` ×123, `.strict()/.passthrough()` ×2, `.email()` ×8, `{ message }` ×3) are **deprecated-but-still-functional** in zod 4. The real risk is concentrated in (a) `fastify-type-provider-zod` v5's *"error response structure revised"* breaking change and (b) `z.coerce` whose input type becomes `unknown`. So we **measure first** (bump + typecheck + test in an isolated worktree), then fix exactly what breaks — never refactor 162 files on speculation.

**Tech Stack:** pnpm 9.15 monorepo · TypeScript 5.7 strict (`noUncheckedIndexedAccess`) · Fastify 5.8 · vitest 4 (singleThread, real DB via SSH tunnel) · zod (3.25.76 → ^4.4.3) · fastify-type-provider-zod (4.0.2 → ^6.0.0) · Next.js 15 (web also imports zod via react-hook-form).

---

## Context & verified evidence (do not re-derive — measured 2026-05-28)

| Fact | Value | Source |
|---|---|---|
| Files importing zod | 162 (`apps` + `packages`) | `grep -rlE "from ['\"]zod" apps packages` |
| `z.record(` occurrences | 166 — **all already 2-arg** (`z.record(z.string(), z.unknown())`) | sampled 15/15 + 0 single-arg matches |
| `.datetime()` | 145 — deprecated→`z.iso.datetime()`, **still works** | zod v4 changelog |
| `z.coerce.*` | 123 — **still works**, but `z.input` type → `unknown` | zod v4 changelog |
| `.strict()/.passthrough()` | 2 — deprecated→`z.strictObject/looseObject`, still works | zod v4 changelog |
| `.email()` method-form | 8 — deprecated→`z.email()`, still works | zod v4 changelog |
| `{ message: }` error param | 3 — deprecated→`{ error: }`, still works | zod v4 changelog |
| `required_error`/`invalid_type_error`/`errorMap` | 0 | grep |
| ftpz route files | 61 (`FastifyPluginAsyncZod` / `ZodTypeProvider`) | grep |
| ftpz compiler wiring | `app.ts:124-128` (`withTypeProvider<ZodTypeProvider>`, `setValidatorCompiler`, `setSerializerCompiler`) | read |
| errorHandler zod coupling | `errorHandler.ts:31` `if (err instanceof ZodError)` (imports `ZodError` from `zod`, NOT ftpz internals) | read |
| ftpz 5.0.0 breaking | "Switch to zod v4 API" + **"Error response structure revised to reduce duplication"** | GitHub release body |
| ftpz 6.0.0 change | OpenAPI 3.0/3.1 auto-switch (affects `pnpm openapi:generate` only) | GitHub release body |
| Integration tests | 52 files, 31 assert on validation error shape (`{error:{code,message,requestId}}`) | grep |
| Target versions | zod `^4.4.3` (Dependabot PR #3), ftpz `^6.0.0` | `gh pr view 3`, npm |

**Key risk hypotheses to confirm in the spike:**
1. **R1 — ftpz throws differently.** ftpz v4's `validatorCompiler` throws a `ZodError` that `errorHandler.ts:31` catches via `instanceof ZodError`. If ftpz 5 wraps validation failures in a different error type (the "error response structure revised" change), `instanceof ZodError` may no longer match → validation routes would emit the wrong shape → the 31 error-shape assertions fail. **Most likely failure.**
2. **R2 — `z.coerce` input type `unknown`** may surface `noUncheckedIndexedAccess`/strict typecheck errors where coerced input is consumed positionally.
3. **R3 — `z.iso.datetime()` semantics.** zod 4 `.datetime()` still works but the default offset/precision handling may differ; any test asserting on a specific datetime rejection could shift.

---

## Spike results (2026-05-28 — measured in worktree `feat/zod4-ftpz6`)

Bumped `apps/api` to `zod@4.4.3` + `fastify-type-provider-zod@6.1.0` and `apps/web` to `zod@4.4.3`. `pnpm install` clean: ftpz 6 pulls new peers `@fastify/swagger@9.7.0` + `openapi-types@12.1.3` (already present transitively, **no unmet peer**). zod resolved to 4.4.3 for our packages (a transitive zod 3.25.76 remains for some dep — harmless).

**`pnpm --filter @heuresys/api typecheck` → 302 errors**, in just **two root causes**:

| TS code | Count | Root cause | Fix locality |
|---|---|---|---|
| TS18046 (`req.body/params/query is 'unknown'`) | 156 | **ftpz 6 no longer infers handler request types** from Zod route schemas with our `FastifyPluginAsyncZod` + `app.get(path, { schema }, handler)` pattern | **central** (one wiring/typing fix should clear all) — needs the correct ftpz-6 setup, NOT 61 per-route edits |
| TS2345 (`'unknown' not assignable`) | 145 | same root cause — the `unknown` `req.*` is then passed to service/repo calls | resolves with the above |
| TS2339 (`ZodError.errors` missing) | 1 | zod 4 renamed `ZodError.errors` → `ZodError.issues` (`errorHandler.ts:33`) | **1-line fix** |

**Verdict vs my pre-spike hypotheses (honesty per B58):**
- R1 (ftpz error-response-structure) — **partially right**: the only concrete hit is `ZodError.errors`→`.issues` (1 error), not a broad error-shape break. errorHandler's `instanceof ZodError` still type-checks.
- R2 (`z.coerce` input `unknown`) — **wrong as a standalone**: there are *zero* isolated z.coerce errors; the `unknown` everywhere comes from the type-provider inference failure, not coercion.
- R-NEW (**unforeseen, dominant**): ftpz 6 + zod 4 breaks request-type inference end-to-end. **This is the actual B-21 work.** 301/302 errors are this single cause.
- Runtime impact unknown yet: vitest runs via `tsx` (no typecheck gate), so the 52 tests *may* still pass at runtime — but **CI `typecheck` is red**, which blocks merge regardless. Runtime test run deferred (decision-gate STOP).

**Revised plan delta:** Phase 1 is no longer "fix error response structure". It becomes **"restore ftpz-6 request-type inference"** — a focused investigation of the correct ftpz-6 wiring (does v6 need a different `withTypeProvider` setup / a `ZodTypeProvider` re-export / explicit generics on `FastifyPluginAsyncZod`?). Likely a small central change in `app.ts` and/or the route plugin typing, then the 301 errors clear in bulk. Phase 2 shrinks to the 1-line `.issues` fix. Effort is **moderate and concentrated** (1 root cause), not the 162-file sweep the raw counts suggested — but it does require getting the ftpz-6/zod-4 typing contract right, so it is a focused dedicated task, **not** a blind mechanical edit.

**Worktree state:** the bumps are committed on branch `feat/zod4-ftpz6` (WIP, not pushed) so the next session resumes from the measured baseline. To resume: `cd ../heuresys-advanced-zod4` and investigate ftpz-6 request typing.

---

## File map (what each touched file is responsible for)

| File | Responsibility | Expected change |
|---|---|---|
| `package.json` (root) + `apps/api/package.json` + `apps/web/package.json` | declare zod + ftpz versions | version bumps; check `pnpm.overrides` for zod pins |
| `pnpm-lock.yaml` | lockfile | regenerated by `pnpm install` |
| `apps/api/src/app.ts:17-20,124-128` | ftpz compiler wiring + type provider | verify import names unchanged in ftpz 6; likely no change |
| `apps/api/src/middleware/errorHandler.ts:11,30-31` | maps `ZodError` → `{error:{code:'VALIDATION',...}}` | **likely change** — adapt to ftpz 5's thrown error type if `instanceof ZodError` stops matching |
| `apps/api/src/modules/*/routes.ts` (61) | `FastifyPluginAsyncZod` route schemas | likely no change (type-level only); fix only what typecheck flags |
| `packages/shared/src/schemas/*.ts` (61) | Zod contract schemas | likely no change (z.record already compliant); optional modernization deferred |
| `apps/api/openapi.yaml` | generated spec | regenerate via `pnpm openapi:generate`; diff reviewed (ftpz 6 OpenAPI 3.0/3.1) |

---

## Phase 0 — Empirical spike (MEASURE the real blast radius)

> Goal: replace conjecture with the exact list of compile/test failures. Done in an **isolated git worktree** so `main` stays clean and the spike is throwaway if needed.

### Task 0.1: Create isolated worktree

**Files:** none (git operation)

- [ ] **Step 1: Create the worktree**

```bash
cd /d/heuresys-advanced
git worktree add ../heuresys-advanced-zod4 -b feat/zod4-ftpz6 main
cd ../heuresys-advanced-zod4
```

- [ ] **Step 2: Confirm clean baseline**

Run: `git status -sb && git log --oneline -1`
Expected: clean tree on `feat/zod4-ftpz6` at the current `main` HEAD.

### Task 0.2: Bump the dependencies

**Files:**
- Modify: `apps/api/package.json` (zod, fastify-type-provider-zod)
- Modify: `apps/web/package.json` (zod)
- Modify: `package.json` root (check `pnpm.overrides` for any zod pin)

- [ ] **Step 1: Inspect current declarations + overrides**

Run: `grep -rnE "\"zod\"|fastify-type-provider-zod" apps/*/package.json && node -e "console.log(require('./package.json').pnpm?.overrides||{})"`
Expected: api has `zod 3.25.76` + `fastify-type-provider-zod 4.0.2`; web has `zod 3.25.76`; note any override pin.

- [ ] **Step 2: Edit the versions**

In `apps/api/package.json`: `"zod": "4.4.3"`, `"fastify-type-provider-zod": "6.0.0"`.
In `apps/web/package.json`: `"zod": "4.4.3"`.
If `package.json` root `pnpm.overrides` pins zod, update it to `^4.4.3` too (otherwise the override wins and the bump is silently reverted — verify after install).

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: completes; **verify the resolved version** with `pnpm why zod | head -5` → must show 4.4.3, not 3.x (guards against an override pinning it back).

### Task 0.3: Measure typecheck failures

**Files:** none (measurement)

- [ ] **Step 1: API typecheck (source)**

Run: `pnpm --filter @heuresys/api typecheck 2>&1 | tee /tmp/zod4-tc-api.log | tail -40`
Record: error count + the distinct error categories (group by message). Expected: a finite, enumerable list — confirms or refutes R2.

- [ ] **Step 2: API test typecheck**

Run: `cd apps/api && pnpm typecheck:test 2>&1 | tail -40; cd ../..`
Record: errors in test files (tsconfig.test.json).

- [ ] **Step 3: Web typecheck**

Run: `pnpm --filter @heuresys/web typecheck 2>&1 | tail -30`
Record: web-side zod errors (react-hook-form resolver typing is the usual hotspot).

- [ ] **Step 4: Write the measurement to the plan**

Append a `## Spike results` section to this file listing the exact failure categories + counts. This list drives Phases 1-2 — do not proceed to fixes until it exists.

### Task 0.4: Measure runtime/test failures (the real safety net)

**Files:** none (measurement)

- [ ] **Step 1: Ensure tunnel up**

Run: `pwsh -c "Test-NetConnection localhost -Port 5433 -InformationLevel Quiet"` → `True` (else `ssh -fN -L 5433:localhost:5432 oracle-vm-default`).

- [ ] **Step 2: Run one validation-shape test first (fastest signal for R1)**

Run: `cd apps/api && pnpm exec vitest run -t "validation" 2>&1 | tail -30; cd ../..`
Expected: if R1 holds, validation-error-shape assertions fail with the wrong `code`/shape. This isolates the ftpz-5 error-structure issue before running the full suite.

- [ ] **Step 3: Run the full API suite**

Run: `cd apps/api && pnpm test 2>&1 | tee /tmp/zod4-test-api.log | tail -40; cd ../..`
Record: PASS/FAIL counts vs the known baseline (~341 PASS / 1 known-fail skills:131 / 5 SKIP). Any *new* failures are the work list for Phase 1.

- [ ] **Step 4: Decision gate**

If new failures ≤ ~5 categories and all map to R1/R2/R3 → continue to Phase 1 in this worktree.
If failures are broad/unexpected (e.g. zod runtime behavior change across many schemas) → STOP, append findings, and report to Enzo with the measured blast radius before spending more budget (feasibility re-evaluation per R20).

---

## Phase 1 — Fix ftpz-5 error response structure (R1, the likely blocker)

> Only execute the tasks whose failures actually appeared in Phase 0. The code below is the expected fix for R1; adapt to the real thrown type observed in the spike log.

### Task 1.1: Restore the validation-error → `{error:{code:'VALIDATION'}}` mapping

**Files:**
- Modify: `apps/api/src/middleware/errorHandler.ts:30-31`

- [ ] **Step 1: Read the spike failure + the new thrown type**

Run: `grep -n "ZodError\|hasZodFastifySchemaValidationErrors\|ResponseValidationError\|statusCode" apps/api/src/middleware/errorHandler.ts`
Inspect what ftpz 5 now throws (check `node_modules/fastify-type-provider-zod` exports: `hasZodFastifySchemaValidationErrors`, `isResponseSerializationError`).

- [ ] **Step 2: Update the guard to ftpz-5 API**

ftpz 5 exposes type guards instead of relying on raw `ZodError`. Replace the bare `instanceof ZodError` branch with ftpz's guard while keeping the same emitted shape:

```typescript
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";
import { ZodError } from "zod";

// inside the error handler, BEFORE the generic fallback:
if (hasZodFastifySchemaValidationErrors(err)) {
  return reply.status(400).send({
    error: {
      code: "VALIDATION",
      message: "Request validation failed",
      requestId: req.id,
      issues: err.validation, // ftpz 5 attaches the zod issues here
    },
  });
}
if (isResponseSerializationError(err)) {
  return reply.status(500).send({
    error: { code: "RESPONSE_SERIALIZATION", message: "Response did not match schema", requestId: req.id },
  });
}
if (err instanceof ZodError) {
  // service-level ZodError (manual .parse) — keep existing mapping
  return reply.status(400).send({
    error: { code: "VALIDATION", message: "Validation failed", requestId: req.id, issues: err.issues },
  });
}
```

(Match the exact existing field names/casing in `errorHandler.ts` — do not invent fields. If the current handler emits `issues` differently, preserve that.)

- [ ] **Step 3: Re-run the validation-shape tests**

Run: `cd apps/api && pnpm exec vitest run -t "validation" 2>&1 | tail -20; cd ../..`
Expected: PASS — error shape restored.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/middleware/errorHandler.ts
git commit -m "fix(api): adapt errorHandler to ftpz 5 validation error API (B-21)"
```

---

## Phase 2 — Fix residual typecheck errors (R2 / R3)

> One task per distinct error category from the Phase 0 spike log. Below is the expected `z.coerce` pattern; add sibling tasks only for categories that actually appeared.

### Task 2.1: Narrow `z.coerce` consumers where input type became `unknown`

**Files:**
- Modify: only the files listed in `/tmp/zod4-tc-api.log` (exact paths from the spike)

- [ ] **Step 1: List the failing locations**

Run: `grep -nE "z\.coerce" $(grep -lE "error TS" /tmp/zod4-tc-api.log 2>/dev/null || echo)`
For each, the fix is to rely on the *output* type (`z.infer`/`z.output`), not the input type. Most `z.coerce.number()` / `z.coerce.date()` query-param schemas need no change because routes consume the parsed output.

- [ ] **Step 2: Apply the minimal narrowing**

Where code reads `z.input<typeof schema>` of a coerced field, switch to `z.output<typeof schema>` (or `z.infer`). Show the concrete diff per file from the spike. Do **not** touch files the typecheck did not flag.

- [ ] **Step 3: Re-run typecheck**

Run: `pnpm --filter @heuresys/api typecheck && cd apps/api && pnpm typecheck:test && cd ../..`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(api): narrow z.coerce consumers to output type for zod 4 (B-20)"
```

---

## Phase 3 — Deprecation modernization (OPTIONAL — may be deferred)

> These compile and run fine under zod 4; doing them now is hygiene, not correctness. Each is a mechanical, pattern-based sweep verified by re-running typecheck + the full suite. **Default: defer** unless Enzo wants a clean deprecation-free tree. If deferred, record as a follow-up backlog note (B-20b) and skip to Phase 4.

### Task 3.1: `.email()` method-form → `z.email()` (8 sites)

**Files:** the 8 files from `grep -rln "\.email(" packages apps`

- [ ] **Step 1: Locate** — `grep -rnE "z\.string\(\)\.email\(" packages apps`
- [ ] **Step 2: Replace** `z.string().email()` → `z.email()` (preserve chained `.optional()`, messages).
- [ ] **Step 3: Verify** — `pnpm --filter @heuresys/api typecheck && pnpm --filter @heuresys/web typecheck`
- [ ] **Step 4: Commit** — `git commit -am "refactor(shared): z.string().email() -> z.email() (zod 4 top-level)"`

### Task 3.2: `{ message }` → `{ error }` (3 sites) + `.strict()/.passthrough()` → `z.strictObject/looseObject` (2 sites)

**Files:** the 5 sites from grep

- [ ] **Step 1: Locate** — `grep -rnE "\{ ?message:|\.strict\(\)|\.passthrough\(\)" packages apps`
- [ ] **Step 2: Replace** per the zod 4 changelog mappings (`message`→`error`; `z.object({...}).strict()`→`z.strictObject({...})`).
- [ ] **Step 3: Verify + Commit** — typecheck green, then `git commit -am "refactor(shared): adopt zod 4 error/strictObject API"`.

> `.datetime()` (145 sites) modernization to `z.iso.datetime()` is **explicitly deferred** — high churn, zero correctness benefit (the method form is permanently supported). Track as B-20b.

---

## Phase 4 — Full verification (the merge gate)

**Files:** none (verification)

- [ ] **Step 1: API typecheck (src + test)** — `pnpm --filter @heuresys/api typecheck && cd apps/api && pnpm typecheck:test && cd ../..` → 0 errors.
- [ ] **Step 2: Web typecheck + build** — `pnpm --filter @heuresys/web typecheck && pnpm --filter @heuresys/web build` → success.
- [ ] **Step 3: Full API suite** — `cd apps/api && pnpm test && cd ../..` → PASS count ≥ baseline, no *new* failures (skills:131 known-fail allowed).
- [ ] **Step 4: i18n parity** — `pnpm --filter @heuresys/web i18n:check` → Parity OK.
- [ ] **Step 5: OpenAPI regen + diff review** — `pnpm openapi:generate && git diff --stat apps/api/openapi.yaml`. ftpz 6 changes OpenAPI 3.0/3.1 emission; review the diff is structural-only (no endpoint loss).
- [ ] **Step 6: Playwright smoke (login uses validated forms)** — `cd apps/web && pnpm exec playwright test landing-pages.spec.ts auth.setup.ts 2>&1 | tail -15; cd ../..` → green (requires tunnel + seeded personas).

---

## Phase 5 — Land + bookkeeping

### Task 5.1: Merge the worktree branch into main

- [ ] **Step 1: Rebase on latest main** — `git fetch origin main && git rebase origin/main` (resolve trivial lock conflicts by re-running `pnpm install`).
- [ ] **Step 2: Final full verification** — repeat Phase 4 Step 1 + Step 3 after rebase.
- [ ] **Step 3: Fast-forward main** (from the primary checkout):

```bash
cd /d/heuresys-advanced
git merge --ff-only feat/zod4-ftpz6
git worktree remove ../heuresys-advanced-zod4
```

### Task 5.2: Update backlog + registers + STATE

- [ ] **Step 1:** In `docs/kb/SOT_BACKLOG.md` mark **B-20** and **B-21** ✅ FATTO with the measured blast radius + verification evidence; if Phase 3 deferred, add **B-20b** (deprecation sweep / `.datetime`→`z.iso`).
- [ ] **Step 2:** In `docs/kb/SOT_STATE.md` §2 bump the recorded versions (zod 4.4.3, ftpz 6.0.0).
- [ ] **Step 3:** Commit — `git commit -am "docs(kb): close B-20/B-21 zod4+ftpz6 upgrade, record verification"`.
- [ ] **Step 4:** Push only on explicit Enzo OK (project push policy). The 4 Dependabot defer-major PRs #3 (zod) and #5 (ftpz) are superseded by this work and close on push.

---

## Self-review notes

- **Spec coverage:** B-20 (zod 3→4) = Phases 0/2/3/4; B-21 (ftpz 4→6) = Phases 0/1/4; coupling (ftpz needs zod4) handled by bumping both in Task 0.2.
- **Empirical-first:** Phases 1-2 are explicitly gated on the Phase 0 spike log — no speculative 162-file edits. The decision gate (Task 0.4 Step 4) enforces a STOP-and-report if the blast radius exceeds the measured hypotheses.
- **Safety net:** the 52 integration tests (31 error-shape assertions) + typecheck + build + playwright are the regression guard — appropriate for a dependency upgrade where TDD's "write failing test first" maps to "the existing tests are the spec."
- **Reversibility:** all work in a throwaway worktree/branch; main untouched until Phase 5 ff-merge.
