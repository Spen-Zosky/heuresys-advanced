# REVIEW-16 — Adversarial review of wargame 16 (heuresys #34 B/B3 approval-effect handlers)

- **Reviewer**: independent adversarial pass, 2026-07-06. Repo read at `D:\heuresys-advanced` (read-only). Every claim below carries file:line evidence I read myself.
- **Target**: `wargames/16-heuresys-approval-effects.md` · **Standard**: `SUCCESS.md` (8 points) · **Brief**: `tasks/16-heuresys-approval-effects.md`.

## VERDICT

**NOT PASS as written — APPROVED AFTER PATCHING.** The plan's architectural spine is excellent and its central red-team insight (§7.2, the service-call atomicity hole invisible under D-52) is **real and verified line-by-line**. But it fails blind-executability on one literal command (wrong env-var name → guaranteed false ABORT-5 at M7), contains one false statement under a "VERIFIED" heading, and waves off a genuine privilege-escalation channel that its own handler creates — with no test and no explicit escalation to Enzo. Self-grade of 8/8 is not honest; independent grade is **6/8**. With the five patches below applied, the plan is safe to hand to a blind Sonnet/Opus executor.

---

## SPOT-CHECK LEDGER (24 checks, 21 PASS / 3 FAIL)

| # | Plan claim | Evidence read | Outcome |
|---|---|---|---|
| 1 | Registry `Map` + handler signature at `registry.ts:15,17-27` | `apps/api/src/modules/approvals/effects/registry.ts:15-27` — exact | PASS |
| 2 | `effects/index.ts:7-12`, ONE handler registered at line 10 | `effects/index.ts:10` `registerApplyEffect(TENANT_ACTIVATION, applyTenantActivation)` | PASS |
| 3 | Template handler `tenant-activation.ts:20-34`, guarded UPDATE, `ConflictError(…, "APPLY_EFFECT_FAILED")` | exact, incl. `(res.rowCount ?? 0) !== 1` throw at :31-33 | PASS |
| 4 | `applyRequest` `service.ts:276-304`: pre-check APPROVED, ONE `withTransaction` (markApplied→getApplyEffect→handler), ApiError pass-through, wrap at :297 | `service.ts:276-304` — line-exact, wrap literally at :297 | PASS |
| 5 | Route `routes.ts:53-57` — `POST /:id/apply`, `verifyCsrf` + `requirePermission("approval:create")`, bodyless | `routes.ts:53-57` exact | PASS |
| 6 | `ConflictError(message, code)` at `errors/index.ts:49-53` | exact | PASS |
| 7 | `000132:35` `resource_type varchar(64)` **no CHECK**; `:40` `metadata jsonb NOT NULL DEFAULT '{}'`; CHECKs cover only status/policy/priority; `:160-174` widening is `notification_resource_type` only | `000132:35,40,50-61,163-175` — substance exact (CHECK block is 50-61, plan said 52-60: cosmetic drift) | PASS |
| 8 | `CreateApprovalRequestBodySchema` has NO metadata (`approvals.ts:104-119`); `insertRequest` inserts 8 columns without it (`repository.ts:149-160`); row-side `metadata` at :31 mapped :95 | all exact; Zod v4 `error:` idiom in the existing refine (:117-119) matches the plan's proposed refine style | PASS |
| 9 | `materialize(client: PoolClient, tenantId, archetype, mode)` ~:53; `findTenantStatus(q: DbConnector, …)` :27-33 accepts pool OR client | `tenant-materialization/repository.ts:52-57, 27-33` — signatures fit an apply-effect handler exactly as claimed | PASS |
| 10 | §7.2 red-team core: `service.materialize` uses `findTenantStatus(pool,…)` + opens its OWN `withTransaction` | `tenant-materialization/service.ts:42` (`pool`) and `:59` (own tx) — **verified, the attack is real** | PASS |
| 11 | Archetype: `RETAIL_BANK_REFERENCE` at blueprints:56, `getArchetype` null at :104-106, `SYN_<positionCode>` at :134; 7 OU / 11 positions | `blueprints.ts:56,104-106,134`; 7 orgUnits, 11 positions, 8 skills, 4 KPIs | PASS |
| 12 | D-52 facade `tx-isolation.ts:76-102` BEGIN→SAVEPOINT / COMMIT→RELEASE / ROLLBACK→ROLLBACK TO; write-only per-statement savepoints; wired in `setup.ts`; escape hatch `TEST_TX_ISOLATION=0` | `tx-isolation.ts:76-102,115-135`; `setup.ts:30-38` | PASS |
| 13 | Existing failure-path test green at `approvals-effects.integration.test.ts:123-135` (409 → stays APPROVED, subject untouched); file 143 lines | exact (test at :123-135; file is 143 lines) | PASS |
| 14 | D-52 register row: "186 file passed, 1285 test, 0 FAIL" | `DEBT_REGISTER.md:64` — verbatim ("186 file passed / 2 skip pre-esistenti, 1285 test, 0 FAIL") | PASS |
| 15 | Pinned tenant ids RTL `86ba7a65-…` / HEU `8bc5bc59-…`; purge FK order | `tenant-materialization.integration.test.ts:13-14,57-82` — **note: `purgeRbr` is tenant-scoped on every DELETE** (see finding M-1) | PASS |
| 16 | Time-off: table `000040:234`, status CHECK `:269-271`, pending-by-approver partial index `:301` | `000040:234, 269-272, 301` | PASS |
| 17 | **"No API module writes this table today (only `me/repository.ts` reads it)"** | `grep sys_time_off_requests apps/api/src` → **ZERO hits**. `me/repository.ts:418,573` reads `sys_time_off_balances` — a DIFFERENT table | **FAIL** (finding C-2) |
| 18 | Overtime CHECK `000040:457-459` PENDING→APPROVED | `:457-460` | PASS |
| 19 | Goals: `GoalStatusEnum` COMPLETED/CANCELLED `goals.ts:15-17`; PATCH writes status freely `goals/service.ts:56-63` | `goals.ts:15-17`; `service.ts:56-66` `updateGoalPartial` unrestricted on status | PASS |
| 20 | Web: create form sends no `resourceType`; `[id]` apply button type-agnostic `:55-60` | `approvals/page.tsx:66-68` (payload = title/policy/priority/approvers[/body]); `[id]/page.tsx:55-63` | PASS |
| 21 | Baseline: 167 migration files, max `000169` | glob `db/migrations/*.sql` = 167 files; max `000169_hrms_manager_data_plenipotentiary_grant.sql` | PASS |
| 22 | R6/R7 expected outcomes: `insertRequest` only call-site `service.ts` (:161); `registerApplyEffect` only registry+index | grep confirms both | PASS |
| 23 | Personas: "`TEST_PERSONA_PASSWORD` env-driven (F-001)" and R5 curl uses `$TEST_PERSONA_PASSWORD` | `test/helpers/personas.ts:26` — the TS export is `TEST_PERSONA_PASSWORD` but the **environment variable is `TEST_ADMIN_PASSWORD`**. There is no `TEST_PERSONA_PASSWORD` env var | **FAIL** (finding C-1) |
| 24 | M2 hint: "check `emitNotification`'s repo for precedent" (jsonb param idiom) | `lib/notifications/emit.ts` contains **no** metadata/jsonb insert. The house idiom lives elsewhere: `JSON.stringify(body.metadata ?? {})` (e.g. `activity-classifications/repository.ts:90`, `visualization-nodes/repository.ts:68`, +10 more) | **FAIL as pointer** (finding L-2) |

Also verified: `#34 … status: ACTIVE` at `SOT_BACKLOG.md:88`; §B3 at `DEVELOPMENT_LINES_B_ACTIVATE_DORMANT_CODE.md:20`; `scripts/{vm-deploy.sh,close-propagate.sh,align-clones.sh}` exist; `apps/api/package.json` has `test`/`lint`/`typecheck`/`typecheck:test`; `csrf-origin.integration.test.ts` exists (R4's referenced file is real); no circular import (tenant-materialization repo imports only pg/db-client/blueprints).

---

## FINDINGS

### C-1 · CRITICAL · Wrong env-var name in R5 + M7 → guaranteed false ABORT-5, mission killed at the live demo
**Evidence**: `apps/api/test/helpers/personas.ts:13-26` — `requiredEnv("TEST_ADMIN_PASSWORD")`; `TEST_PERSONA_PASSWORD` is only the exported TS constant. The plan's R5 literal command is `-d "{\"email\":…,\"password\":\"$TEST_PERSONA_PASSWORD\"}"` and §1.4 states the password is "`TEST_PERSONA_PASSWORD` env-driven". In any shell, `$TEST_PERSONA_PASSWORD` expands to **empty** → login 401 → the plan's own rule fires: "if 401 → ABORT-5" ("credentials rotated again; stop"). A blind executor follows this literally and aborts a healthy mission.
**Patch (exact text)**:
- §1.4 replace: `Personas: TEST_PERSONA_PASSWORD env-driven (F-001, S1014 rotation)` → `Personas: password read from the TEST_ADMIN_PASSWORD environment variable (repo-root .env, gitignored) — F-001. The TS constant test/helpers/personas.ts exports it as TEST_PERSONA_PASSWORD, but the ENV VAR NAME is TEST_ADMIN_PASSWORD. Never hardcode, never log (R11).`
- R5 replace the command with: `` source the repo-root .env (or export TEST_ADMIN_PASSWORD from it), then: curl -s -o /dev/null -w '%{http_code}' -X POST <base>/v1/auth/login -H 'content-type: application/json' -d "{\"email\":\"admin@heuresys.com\",\"password\":\"$TEST_ADMIN_PASSWORD\"}" → expect 200. If the var is unset in .env → that IS blocked-on-Enzo, not ABORT-5. ``
- M7b: same substitution.

### C-2 · CRITICAL (per review protocol: wrong evidence under a "VERIFIED" heading) · §1.5 time-off read claim is false
**Evidence**: plan §1.5: "**No API module writes this table today** (only `me/repository.ts` reads it)". Reality: `me/repository.ts:418,573` reads `sys.sys_time_off_balances`; a repo-wide grep for `sys_time_off_requests` in `apps/api` returns **nothing** — the table is entirely untouched by API code.
**Impact**: nil-to-positive for the F2 ranking (the "no competing write path" argument becomes *stronger*), but a false statement labeled VERIFIED poisons trust in the recon layer the whole plan rests on, and the executor's R2/M5 report to Enzo would repeat it.
**Patch (exact text)**: replace the parenthetical with: `(NOTHING in apps/api reads or writes sys_time_off_requests today — me/repository.ts:418,573 reads the sibling sys_time_off_balances only; verified by grep)`.

### H-1 · HIGH · The new handler opens a cross-tenant, non-platform materialization channel — no test, no explicit flag to Enzo
**Evidence chain**:
- Direct materialization is PLATFORM_ADMIN-only: `tenant-materialization/service.ts:18-22,37` (`TENANT_MATERIALIZE_ADMIN_ONLY`), asserted by test (`tenant-materialization.integration.test.ts:206-210`, federica/TENANT_ADMIN → 403).
- `approval:create` (which gates BOTH create and **apply**, `routes.ts:29,55`) is granted to `PLATFORM_ADMIN, TENANT_ADMIN, HRMS_MANAGER, PROCESS_OWNER, MANAGER` (`000133:42`); `approval:decide` is even broader (`000133:52`).
- `resourceId` is a free uuid (`approvals.ts:109`); the request's tenant is derived from the approvers (`service.ts:140-147`) and is **never required to match the resource tenant**. `applyRequest` scopes only the *request* (`service.ts:278`), then runs the handler with no actor context (`registry.ts:15`).
- The plan's handler guard requires the target tenant to be **ACTIVE** (M3 code) — i.e. exactly the state of RTL_BANK and every real customer tenant.
**Attack**: a MANAGER at RTL Bank creates a `TENANT_MATERIALIZATION` request with `resourceId = <any ACTIVE tenant uuid>` and himself as approver, self-approves, applies → 11 synthetic `SYN_RBR-*` users + org-units + positions + 132 evidence rows written into an arbitrary production tenant. This **bypasses** `ensurePlatformAdmin` and collides head-on with the mission's own ABORT-4 spirit (ADR-0026/I15) — except it ships as a permanent prod capability instead of a test accident. The existing `TENANT_ACTIVATION` handler shares the shape but its guard (`tenant_status = 'PENDING_ACTIVATION'`, `tenant-activation.ts:28`) makes ACTIVE production tenants *unreachable*; the new handler inverts that.
**The plan's own words** (M3 HARD RULE c) forbid permission logic in the handler and defer to Enzo — but neither M4 nor M5/M8 contains a test pinning the behavior or a report item flagging it. That is a judgment call silently baked in.
**Patch (exact text)** — zero migrations, stays inside the handler signature:
1. M3, after the archetype check, add: `` // Parity with the direct endpoint (TENANT_MATERIALIZE_ADMIN_ONLY): only a request CREATED by a PLATFORM_ADMIN may materialize. The handler has no actor; the creator's roles are checked inside the effect tx. const creator = request.createdBy; if (!creator) throw new ConflictError("TENANT_MATERIALIZATION request has no creator", "APPLY_EFFECT_FAILED"); const rr = await client.query(`SELECT 1 FROM sys.sys_auth_user_roles ur JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.auth_user_role_role_id JOIN sys.sys_auth_users au ON au.auth_user_id = ur.auth_user_role_auth_user_id WHERE au.auth_user_user_id = $1 AND r.auth_role_code = 'PLATFORM_ADMIN'`, [creator]); if (rr.rowCount === 0) throw new ConflictError("Only a PLATFORM_ADMIN-created request may materialize a tenant", "APPLY_EFFECT_FAILED"); `` — **executor MUST verify the exact auth join-table/column names against `middleware/rbac.ts` / the `sys_auth_*` DDL before using this SQL** (they were not re-derived by this review).
2. M4 add test 7: `federica.marchetti@rtl-bank.org` (TENANT_ADMIN, holds approval:create+decide) creates+approves+applies a TENANT_MATERIALIZATION request against an ACTIVE `TEST-MATFX-*` tenant → **409 APPLY_EFFECT_FAILED**, 0 RBR rows.
3. M5/M8: add a mandatory report line to Enzo: "the effects registry executes handlers with route-level authz only (`approval:create`); per-resource-type authz policy (who may create/apply which effect) is an open product decision — WAIT-INPUT before handler #2."
If Enzo's intent is instead that approval IS the delegation mechanism (no creator gate), then patches 2→(assert it's *allowed*, pinning the behavior) and 3 stay mandatory; shipping with the question unasked is the unacceptable branch.

### M-1 · MEDIUM · M7h live cleanup is not explicitly tenant-scoped — unscoped `SYN_RBR-%` DELETEs live on prod
**Evidence**: the test purge the plan cites as the pattern is tenant-scoped on **every** statement (`tenant-materialization.integration.test.ts:57-82`, `WHERE … user_tenant_id = $1 AND user_external_code LIKE 'SYN_RBR-%'`). M7h lists only code patterns ("users `SYN_RBR-%` → skills/kpis → …"). In tests D-52 rolls everything back; **M7h runs live with no rollback**. If any other tenant was ever legitimately materialized (WI-C is a shipped prod endpoint), an unscoped DELETE destroys its data. R5-class verification also demands recorded row counts.
**Patch (exact text)**: M7h replace the list intro with: `Cleanup strictly TENANT-SCOPED, mirroring purgeRbr(tenantId) in apps/api/test/tenant-materialization.integration.test.ts:57-82 — every DELETE carries WHERE <table>_tenant_id = '<demo tenant_id>' (or the USING sys_users join pinned to that tenant) IN ADDITION to the code pattern. Run the purge once per demo tenant id, then approval requests titled '[DEMO #34]%', then the TEST-MATFX-% tenants. Record every DELETE's row count.`

### M-2 · MEDIUM · Fork F1 route B's downstream ripple is unspecified — blind executor on route B hits broken M4/M7 steps
**Evidence**: M4 tests 4 and 6 and M7c's payload all send `metadata: {archetypeKey: …}`; if F1's trigger fires and route B (no contract change) is taken, `CreateApprovalRequestBodySchema` still rejects unknown keys? (No — Zod objects strip by default, so the field would be silently dropped, and test 4 "unknown archetype → 409" becomes **unwritable**: the handler would default to RETAIL_BANK_REFERENCE and return 200.) SUCCESS #3 demands no judgment calls; route B currently leaves three.
**Patch (exact text)**: append to F1 route B: `Route B ripple (mandatory): (i) drop metadata from every createReq payload in M4 and from M7c; (ii) DROP test 4 (unknown archetype is unreachable without the field) and note why in the test header; (iii) test 6 becomes the primary happy path (default archetype); (iv) the report to Enzo states multi-archetype selection is blocked on the metadata field.`

### L-1 · LOW · ABORT-4 as written false-triggers on the plan's own baseline runs
`tenant-materialization.integration.test.ts` (run at M0/V4 per the plan) **writes RBR rows into RTL_BANK** (`:174-186`) — house-sanctioned because D-52 rolls the file back. A literal reader of ABORT-4 ("RTL_BANK … would be written by any step (test, demo, cleanup) → stop immediately") aborts at M0.
**Patch**: ABORT-4 append: `(scope: writes that would COMMIT — live demo/cleanup/seed. D-52-rolled-back test writes inside the existing suite, e.g. tenant-materialization.integration.test.ts against RTL, are house practice and exempt.)`

### L-2 · LOW · M2's jsonb precedent pointer is wrong
`lib/notifications/emit.ts` inserts no metadata jsonb. **Patch**: replace `check emitNotification's repo for precedent` with `house idiom is JSON.stringify(input.metadata ?? {}) as the param — see activity-classifications/repository.ts:90 or visualization-nodes/repository.ts:68`.

### L-3 · LOW · Cheap missing assertion: re-apply after APPLIED
`applyRequest`'s pre-check (`service.ts:280-282`) makes a second apply of the SAME request return 409 `NOT_APPROVED`. One extra line in M4 test 1 (`re-apply same id → 409 NOT_APPROVED`) pins the replay contract for free. Optional but recommended.

### Notes (no action)
- Cosmetic line drifts: 000132 CHECK block is :50-61 (plan: 52-60); `materialize` at :52 (plan: ~53); goals PATCH at :56-66 (plan: 56-63); `[id]/page.tsx` apply at :55-63 (plan: 55-60). All within tolerance; anchors resolve.
- The plan's proposed handler compiles conceptually against the real types (`request.metadata` is `Record<string, unknown>` at `repository.ts:31`; the `typeof … === "string"` narrow is strict-mode-safe).
- Idempotency, concurrency (guarded `markApplied` UPDATE), and the D-52 interplay analysis (§1.3) are all accurate as verified above.
- M4's new-file prefixes (`TEST-APVMAT`, `TEST-MATFX-%`) are disjoint from the sibling file's `TEST-FX-%` purges — no cross-file collision even under `TEST_TX_ISOLATION=0`.

---

## INDEPENDENT 8-POINT GRADE (vs self-grade 8/8)

| # | SUCCESS.md point | Grade | Why |
|---|---|---|---|
| 1 | Expected observation per move | **PASS** | Concrete O for M0-M8 (exit codes, HTTP codes, 7/11/11/11 counts). |
| 2 | Failure + cause + counter per move | **PASS** | Every move; M4 carries three distinct, correctly-diagnosed modes (F1 is the verified §7.2 bug). |
| 3 | Forks with triggers, no judgment calls | **PARTIAL** | F1-F4 triggers observable, but F1 route B leaves three unstated judgment calls (M-2), and the H-1 authz question is silently decided instead of routed. |
| 4 | RECON NEEDED with exact settling checks | **FAIL** | R1-R4/R6/R7 are exact and pre-verified correct; **R5's literal check is wrong** (C-1) — the one command that gates the live demo fails deterministically. |
| 5 | Abort conditions | **PASS (defects)** | Eight, well-chosen; ABORT-5 is armed by C-1 into a false trap and ABORT-4 false-triggers literally (L-1). |
| 6 | Verification spelled out | **PASS** | V1-V10, double-run V3 and live V8/V9 are genuinely strong; V8/V9 pass criteria match the real code paths. |
| 7 | Red-team survived + recorded | **PASS** | §7.1 defeated by real DDL (verified); §7.2 is a **genuine, code-verified** silent-in-tests/broken-in-prod hole with concrete embedded patches; §7.3 bonus is sound. Best section of the plan. |
| 8 | Executable blind | **FAIL** | C-1 alone kills a blind run at M7 with a false abort; M-2 strands route B; M-1 makes the only irreversible step (live DELETE) under-specified. After patches: PASS. |

**Independent grade: 6/8 as written.**

## SAFE-AFTER-PATCHING

**YES** — apply C-1, C-2, H-1 (at minimum patches 2+3 if the creator-gate is deferred to Enzo), M-1, M-2; L-1/L-2/L-3 recommended. The spine (seam, handler shape, D-52 analysis, test plan, live V8/V9 pair) is verified sound and needs no rework.
