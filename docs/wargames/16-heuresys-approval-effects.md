# WARGAME 16 — heuresys-advanced #34 B/B3: approval-effect handlers (the first REAL approval flow)

- **Mission**: implement backlog item **#34 B/B3** — a `TENANT_MATERIALIZATION` apply-effect handler wired into the approvals effects registry (registry dispatch already live, one handler today), full approve→effect→subject-mutated integration tests including the 409-rollback failure contract, a live E2E demo (create request → approve → apply → tenant materialized, verifiable on the VM), plus an **evidence-based proposal** (not implementation) of the next 1-2 handlers. Enzo decides which further handlers get built.
- **Executor**: Claude Code CLI (Sonnet/Opus) on the heuresys-advanced repo — `D:\heuresys-advanced` (Windows) or `/home/ubuntu/heuresys-advanced` (VM).
- **Date wargamed**: 2026-07-06 (recon evidence read same day; repo state at recon ≈ S1016, migrations on disk = 167 files, max `000169` — matches the brief's baseline; re-derive live at M0).
- **Sources of truth to RE-READ at execution time, in this order (SoT wins over this plan on every count)**:
  1. `docs/kb/SOT_STATE.md`
  2. `docs/kb/SOT_BACKLOG.md` (item #34, line ~88)
  3. `docs/kb/DEBT_REGISTER.md` (D-52 entry, line ~64 — read the whole row)
  4. `.handoff/STATE.md`
  5. `docs/product/DEVELOPMENT_LINES_B_ACTIVATE_DORMANT_CODE.md` §B3 (doc of record, line ~20)
  6. project `CLAUDE.md` (invariants I1–I21, Definition of Done, canonical commands)
- **Binding constraints (verbatim from the brief)**: materialization keying `SYN_<positionCode>`, **NEVER** `LEGACY_EMP::` (I14/ADR-0024); D-52 per-file tx isolation interplay checked before writing tests; D-12 twice-run-idempotent migrations (this mission needs **zero** migrations — if you conclude otherwise, ABORT-3); D-38 asserts by owned codes, never resource-wide counts; done = typecheck · lint · full suite green · CI 6/6 · vm-deploy · LIVE verification. Writes for the demo go to a throwaway `[TEST]` tenant — never RTL_BANK, never HEURESYS (ADR-0026/I15 discipline).

---

## 1. RECON FINDINGS

### 1.1 VERIFIED — the seam (read from source)

- **Registry**: `apps/api/src/modules/approvals/effects/registry.ts:17-27` — `Map<string, ApplyEffectHandler>` keyed by `approval_request_resource_type`; `registerApplyEffect(resourceType, handler)`, `getApplyEffect(resourceType)`. Handler signature (line 15): `(client: PoolClient, request: ApprovalRequestRow) => Promise<void>`.
- **Registration point**: `effects/index.ts:7-12` — imports for side-effect; today registers exactly ONE handler: `registerApplyEffect(TENANT_ACTIVATION, applyTenantActivation)` (line 10). The new handler registers here, one added import + one added line.
- **Template handler**: `effects/tenant-activation.ts:20-34` — guarded UPDATE `PENDING_ACTIVATION → ACTIVE` on `sys.sys_tenancies`; missing `resource_id` or 0-row result → `throw new ConflictError(msg, "APPLY_EFFECT_FAILED")`. This is the exact shape to mirror.
- **Dispatch**: `approvals/service.ts:276-304` (`applyRequest`) — pre-check status APPROVED outside tx, then `withTransaction(async (client) => { markApplied(client, id) → getApplyEffect(current.resourceType) → handler(client, row) })`. `ApiError` subclasses propagate as-is; any other throw is wrapped: `new ConflictError("Apply effect failed: …", "APPLY_EFFECT_FAILED")` (line 297). Handler throw ⇒ the WHOLE tx (markApplied + effect writes) rolls back ⇒ HTTP 409, request stays APPROVED. That is the contract the failure test must prove.
- **Route**: `approvals/routes.ts:53-57` — `POST /v1/approvals/:id/apply`, preHandler `verifyCsrf` + `requirePermission("approval:create")`, bodyless.
- **`ConflictError(message, code)`** → 409: `apps/api/src/errors/index.ts:49-53`.
- **No CHECK on `resource_type`**: `db/migrations/000132_approval_runtime.sql:35` — `approval_request_resource_type varchar(64)` free-form (CHECKs exist only on status/policy/priority, lines 52-60). **New resource_type values need NO migration.**
- **`approval_request_metadata jsonb NOT NULL DEFAULT '{}'`** exists: `000132:40`. It is read back into `ApprovalRequestRow.metadata` (`approvals/repository.ts:31`, mapped at :95) but is **NOT writable today**: `CreateApprovalRequestBodySchema` has no metadata field (`packages/shared/src/schemas/approvals.ts:104-119`) and `insertRequest` inserts 8 columns without it (`approvals/repository.ts:149-160`). The handler needs `archetypeKey` from somewhere → M2 threads an optional `metadata` through (zero DB migration, additive contract change).

### 1.2 VERIFIED — the materialization module (WI-C, complete since S998)

- `apps/api/src/modules/tenant-materialization/repository.ts` — `materialize(client: PoolClient, tenantId, archetype, mode)` (line ~53): org-units + positions (ON CONFLICT (tenant, code) DO NOTHING) + tenant-scoped skills `RBR-SK-*` / KPIs `RBR-KPI-*` (existence-check) + one `GENERATED_INCUMBENT` user per position keyed **`SYN_<positionCode>`** (blueprints.ts:134 — I14 honored by the existing code; touch nothing there) + PRIMARY ACTIVE assignment + set-based skill/KPI evidence anti-join INSERTs. Fully idempotent, takes the caller's `PoolClient` — **exactly what an apply-effect handler needs**.
- `findTenantStatus(q: DbConnector, tenantId)` (repository.ts:27-33) accepts pool OR client → the handler can M-1-validate inside the effect transaction.
- `tenant-materialization/service.ts:36-71` (`service.materialize`) uses `pool` for the status check and opens **its own `withTransaction`** — **the handler MUST NOT call the service** (see RED-TEAM §7.2). It calls `repo.materialize` + `repo.findTenantStatus` with the handler's `client`.
- Single archetype in the catalog: `RETAIL_BANK_REFERENCE` (blueprints.ts:56) — 7 org-units, 11 positions, 11 synthetic users/assignments, skills+KPIs; `getArchetype(key)` returns `null` for unknown keys (blueprints.ts:104-106).
- M-1 semantics: materialization requires the target tenant **ACTIVE** (service.ts:41-46). The handler mirrors this guard → natural failure path (subject not ACTIVE → 409 rollback), symmetric with TENANT_ACTIVATION's guard.

### 1.3 VERIFIED — D-52 tx-isolation interplay (the known trap, settled)

`apps/api/test/helpers/tx-isolation.ts` + wiring in `test/helpers/setup.ts` (`beginFileTx`/`endFileTx` per file, escape hatch `TEST_TX_ISOLATION=0`):
- The whole test FILE runs in ONE real transaction, rolled back at file end. `pool.connect()` (used by `withTransaction`) returns a **facade**: BEGIN → `SAVEPOINT d52_sp_N`, COMMIT → `RELEASE`, ROLLBACK → `ROLLBACK TO SAVEPOINT` (tx-isolation.ts:76-102). So `applyRequest`'s transaction — including the handler-throw rollback — behaves correctly INSIDE the file tx. **Proof it works**: the existing failure-path test `approvals-effects.integration.test.ts:123-135` (409 → stays APPROVED, subject untouched) is part of the 186-file suite that went green under D-52 at S1015 (DEBT_REGISTER D-52 row: "186 file passed, 1285 test, 0 FAIL").
- Consequences for the new tests: (a) do NOT open your own `withTransaction` in test code; (b) `now()` is frozen per file — never assert distinct timestamps (`created_at`/`applied_at` ordering); (c) direct `pool.query` writes are auto-savepointed and serialized — `Promise.all` write batches are safe but keep seeding sequential like the template does; (d) afterAll DELETE cleanup is redundant under D-52 but is house style (survives `TEST_TX_ISOLATION=0`) — keep it.
- **The one real residual risk**: the effect handler runs MANY statements on the facade client inside the app's savepoint. A failing statement mid-handler aborts up to the app savepoint and the app's ROLLBACK clears it — same as prod. No special handling needed. But because the facade collapses everything onto ONE physical client, a handler that (wrongly) grabs a second connection would silently "work" in tests and be broken in prod — see RED-TEAM §7.2.

### 1.4 VERIFIED — test templates to copy

- `apps/api/test/approvals-effects.integration.test.ts` (143 lines) — THE template: login helpers, `createReq` with `resourceType`/`resourceId`, `createAndApprove`, `apply`, `seedTenant(status)` producing `TEST-FX-*` throwaway tenants, beforeAll leftover-purge, afterAll purge by owned codes (D-38). The new file clones this shape.
- `apps/api/test/tenant-materialization.integration.test.ts` — the purge pattern for materialized rows (FK order: evidence → assignments → users `SYN_RBR-%` → skills `RBR-SK-%` → kpis `RBR-KPI-%` → positions `RBR-%` → org-units `RBR-%`) and the expected counts shape `C(7,11,11,11,…)`. Tenant ids pinned there: RTL_BANK `86ba7a65-217f-48ba-8ce5-5c09b40a66b0`, HEURESYS `8bc5bc59-f2d2-4a8a-882a-ea26ac367858` — the DEMO must target neither.
- Personas: password read from the **`TEST_ADMIN_PASSWORD` environment variable** (repo-root `.env`, gitignored) — F-001. The TS constant `test/helpers/personas.ts` exports it as `TEST_PERSONA_PASSWORD`, but the **ENV VAR NAME is `TEST_ADMIN_PASSWORD`** (`personas.ts:26` — `requiredEnv("TEST_ADMIN_PASSWORD")`; there is NO `TEST_PERSONA_PASSWORD` env var). Never hardcode, never log (R11). Approvers must belong to a tenant (service.ts:140-147); `admin@heuresys.com` works as its own approver (existing test does exactly this).

### 1.5 VERIFIED — candidate survey for further handlers (evidence for §4 FORKS)

- **Time-off**: `sys.sys_time_off_requests` exists since `db/migrations/000040_sys_time_leave_scaffold.sql:234` with `request_status varchar(20) DEFAULT 'PENDING'` + CHECK `('PENDING','APPROVED','REJECTED','CANCELLED','EXPIRED')` (000040:269-271) + partial index on pending-by-approver (000040:301). A `TIME_OFF_APPROVAL` handler is a guarded UPDATE PENDING→APPROVED — byte-for-byte the tenant-activation shape. **No API module writes this table today** (NOTHING in apps/api reads or writes sys_time_off_requests today — me/repository.ts:418,573 reads the sibling sys_time_off_balances only; verified by grep): B3 doc says "se Serie E/L8 evolve al write"; #33 (L8) is read-only and still ACTIVE. Live row count unknown → RECON NEEDED R2.
- **Goals**: `sys_goals` status CHECK includes `COMPLETED`/`CANCELLED` (`packages/shared/src/schemas/goals.ts:15-17`, mirrors mig 000037); live data exists (S1011 backfilled `goal_subject_user_id` on 632 rows — SOT_STATE). A `GOAL_COMPLETION` handler flips status→COMPLETED + `completed_at`. Semantics are weaker: goals are already freely writable via `PATCH /v1/goals/:id` (goals/service.ts:56-63), so approval is governance-by-convention, bypassable.
- **Overtime**: `sys_overtime` PENDING→APPROVED CHECK (000040:457-459) — same shape as time-off, same dormancy.
- **Webapp**: `/approvals` create form does NOT send `resourceType` (`apps/web/src/app/(authenticated)/approvals/page.tsx` — payload is title/policy/priority/approvers only) and the detail page's Apply button is resource-type-agnostic (`[id]/page.tsx:55-60`). **Zero web changes needed**; `apps/web/tests/e2e/approvals.spec.ts` exercises the typeless flow → unaffected.

### 1.6 ASSUMED (explicit, each with its risk)

- `sys_approval_requests` = 0 rows live (brief + backlog note, dated S1016). Low risk; re-derive at M1.
- CI is "6/6" as the brief states (SOT_STATE S1014 says 6/6; older deltas mention 7/7 and 9/9 — job count has drifted historically). Pass criterion = ALL jobs green, whatever the count.
- The VM API listens on `localhost:8013` behind nginx `www.heuresys.com/api` (SOT_STATE S1009/D-49 recovery notes). Settled by RECON NEEDED R4 before the live demo.

---

## 2. RECON NEEDED (settle each BEFORE the move that depends on it)

| # | Assumption to settle | The exact check | Depends |
|---|---|---|---|
| R1 | BPM still empty; no parallel work touched approvals since S1016 | `git log --oneline -5 -- apps/api/src/modules/approvals/` + psql (tunnel :5433): `SELECT count(*) FROM sys.sys_approval_requests;` → expect 0 (or only TEST- residue) | M0 |
| R2 | Which 2nd-handler candidate has real data | psql: `SELECT request_status, count(*) FROM sys.sys_time_off_requests GROUP BY 1;` and `SELECT status, count(*) FROM sys.sys_goals GROUP BY 1;` and `SELECT overtime_status, count(*) FROM sys.sys_overtime GROUP BY 1;` | M5 / FORK F2 |
| R3 | Migration baseline unchanged (no collision risk even though we add none) | `ls db/migrations/ | wc -l` (expect 167) and `ls db/migrations/ | tail -1` (expect `000169_*`); if higher, re-read SOT_STATE delta first | M0 |
| R4 | Live API entrypoint + CSRF/Origin requirements for the demo curl | On VM: `ss -tlnp | grep -E '8013|3001'`; in repo: `grep -rn "verifyCsrf\|origin" apps/api/src/plugins/*.ts apps/api/src/middleware/*.ts | head` and read `apps/api/test/csrf-origin.integration.test.ts` header to learn which headers a write needs (cookie + `x-csrf-token`, possibly `origin`) | M7 |
| R5 | Login personas password env works live | source the repo-root `.env` (or export `TEST_ADMIN_PASSWORD` from it), then: `curl -s -o /dev/null -w '%{http_code}' -X POST <base>/v1/auth/login -H 'content-type: application/json' -d "{\"email\":\"admin@heuresys.com\",\"password\":\"$TEST_ADMIN_PASSWORD\"}"` → expect 200. If the var is unset in `.env` → that IS `blocked-on-Enzo`, not ABORT-5. (MFA is OFF per SOT; 401 WITH the var set → ABORT-5; NEVER echo the password) | M7 |
| R6 | `insertRequest` call-sites beyond service.createRequest (metadata threading must not miss one) | `grep -rn "insertRequest" apps/api/src apps/api/test db/scripts` → expect exactly the service call-site | M2 |
| R7 | Nothing else already registers a second effect (parallel-work guard) | `grep -rn "registerApplyEffect" apps/api/src` → expect exactly registry.ts (def) + index.ts (TENANT_ACTIVATION) | M3 |
| R8 | Exact auth join-table/column names + `ApprovalRequestRow` creator field for the H-1 creator gate | Read `apps/api/src/middleware/rbac.ts` (how roles are loaded per user) + `\d sys.sys_auth_user_roles` / `\d sys.sys_auth_roles` / `\d sys.sys_auth_users` via psql; `grep -n "createdBy\|created_by" apps/api/src/modules/approvals/repository.ts` → confirm/fix the M3 gate SQL and field name before writing the handler | M3 |

---

## 3. MOVES

Legend per move: **A** action · **O** expected observation · **F** most likely failure → cause → counter-move.

### M0 — SoT re-read + baseline gates
**A**: Read the 4 SoT files in order, then §B3 doc, then project CLAUDE.md. Run R1/R3/R6/R7. Confirm `git status` clean, note HEAD sha. Run the three touched suites as baseline: `pnpm -C apps/api exec vitest run test/approvals.integration.test.ts test/approvals-effects.integration.test.ts test/tenant-materialization.integration.test.ts` (needs the :5433 tunnel up — `scripts/` has tunnel helpers on Windows; on VM the DB is local).
**O**: SoT shows #34 ACTIVE and unclaimed; baseline suites green; migrations 167/000169.
**F**: baseline suites red → cause: tunnel down / DB drift / parallel work → counter: fix tunnel first (`Test-NetConnection localhost -Port 5433` on Windows); if still red on UNTOUCHED files, that is pre-existing breakage: R3 says fix it, but first check ABORT-1 (SoT claims it) — if the failure is in the 3 files above and unexplained, stop and report before building on sand.

### M1 — Live recon queries (R1, R2)
**A**: psql via tunnel: the R1/R2 queries. Record outputs verbatim (they feed the §4 proposal and the final report to Enzo).
**O**: approval_requests ≈ 0; time_off/overtime counts likely 0 (scaffold tables), goals ≥ 600 spread across statuses.
**F**: psql cannot connect → tunnel/credentials → counter: use the VM directly (`ssh oracle-vm-default`, peer-auth psql); if neither works, ABORT-6 (no live verification possible = no Done).

### M2 — Thread optional `metadata` through the create path (contract change, zero migration)
**A**: three files:
1. `packages/shared/src/schemas/approvals.ts` — add to `CreateApprovalRequestBodySchema` (inside the `.object({...})`, before `.refine`): `metadata: z.record(z.string(), z.unknown()).optional()` **plus** a size guard in the same refine chain: `.refine((b) => !b.metadata || JSON.stringify(b.metadata).length <= 4096, { error: "metadata too large (max 4096 chars serialized)" })` (see RED-TEAM §7.3 — this guard is a red-team patch, not optional).
2. `approvals/service.ts` `createRequest`: pass `metadata: body.metadata ?? {}` into `repo.insertRequest` input.
3. `approvals/repository.ts` — `InsertRequestInput` gains `metadata: Record<string, unknown>`; `insertRequest` INSERT gains column `approval_request_metadata` + `$9` with `JSON.stringify(input.metadata)` (or the object directly — pg serializes objects to json params; follow whatever idiom nearby code uses for jsonb params — house idiom is `JSON.stringify(input.metadata ?? {})` as the param, see `activity-classifications/repository.ts:90` or `visualization-nodes/repository.ts:68`).
**O**: `pnpm -C apps/api run typecheck` + root `pnpm -r typecheck` exit 0. Existing approvals tests still green (field optional ⇒ backward compatible; web form unchanged).
**F**: shared-package type ripple (other consumers of `CreateApprovalRequestBody`) → cause: optional field should ripple nowhere, but `exactOptionalPropertyTypes`-style strictness can bite → counter: `grep -rn "CreateApprovalRequestBody" apps packages` and fix each site; if a site *validates* payload shape (e2e spec payloads are plain objects, unaffected).

### M3 — The handler: `effects/tenant-materialization.ts`
**A**: new file `apps/api/src/modules/approvals/effects/tenant-materialization.ts` mirroring `tenant-activation.ts`:
```ts
import type { PoolClient } from "pg";
import type { ApprovalRequestRow } from "../repository.js";
import { ConflictError } from "../../../errors/index.js";
import { getArchetype } from "../../tenant-materialization/blueprints.js";
import { findTenantStatus, materialize } from "../../tenant-materialization/repository.js";

export const TENANT_MATERIALIZATION = "TENANT_MATERIALIZATION";

export async function applyTenantMaterialization(client: PoolClient, request: ApprovalRequestRow): Promise<void> {
  const tenantId = request.resourceId;
  if (!tenantId) throw new ConflictError("TENANT_MATERIALIZATION approval has no target tenant (resource_id)", "APPLY_EFFECT_FAILED");
  const key = typeof request.metadata.archetypeKey === "string" ? request.metadata.archetypeKey : "RETAIL_BANK_REFERENCE";
  const archetype = getArchetype(key);
  if (!archetype) throw new ConflictError(`Unknown archetype '${key}'`, "APPLY_EFFECT_FAILED");
  // Parity with the direct endpoint (TENANT_MATERIALIZE_ADMIN_ONLY): only a request CREATED by a
  // PLATFORM_ADMIN may materialize. The handler has no actor; the creator's roles are checked
  // inside the effect tx. (REVIEW-16 H-1: without this gate, any approval:create holder — e.g. a
  // RTL Bank MANAGER, 000133:42 — could self-approve a request with resourceId = any ACTIVE tenant
  // uuid and write 11 SYN_RBR-* users + org-units + positions into an arbitrary production tenant,
  // bypassing ensurePlatformAdmin.)
  const creator = request.createdBy;
  if (!creator) throw new ConflictError("TENANT_MATERIALIZATION request has no creator", "APPLY_EFFECT_FAILED");
  const rr = await client.query(
    `SELECT 1 FROM sys.sys_auth_user_roles ur
       JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.auth_user_role_role_id
       JOIN sys.sys_auth_users au ON au.auth_user_id = ur.auth_user_role_auth_user_id
      WHERE au.auth_user_user_id = $1 AND r.auth_role_code = 'PLATFORM_ADMIN'`,
    [creator],
  );
  if (rr.rowCount === 0) throw new ConflictError("Only a PLATFORM_ADMIN-created request may materialize a tenant", "APPLY_EFFECT_FAILED");
  const status = await findTenantStatus(client, tenantId);          // M-1 guard, INSIDE the effect tx
  if (status === null) throw new ConflictError("Target tenant does not exist", "APPLY_EFFECT_FAILED");
  if (status !== "ACTIVE") throw new ConflictError(`Target tenant is not ACTIVE (status=${status})`, "APPLY_EFFECT_FAILED");
  await materialize(client, tenantId, archetype, "apply");           // idempotent, SAME client/tx
}
```
Register in `effects/index.ts`: import + `registerApplyEffect(TENANT_MATERIALIZATION, applyTenantMaterialization);`. Match the house header-comment style (every file in this repo opens with a path+purpose block — copy tenant-activation.ts's tone, cite #34/B3 and I14).
**HARD RULES**: (a) the handler file must **never import `pool`** or `tenantMaterializationService` — repo functions + the passed `client` only (RED-TEAM §7.2); (b) do not touch `blueprints.ts` or the SYN_ keying — I14 is already honored there; (c) the ONLY permission logic in the handler is the creator-PLATFORM_ADMIN parity gate above (REVIEW-16 H-1 — it mirrors the direct endpoint's `TENANT_MATERIALIZE_ADMIN_ONLY`, `tenant-materialization/service.ts:18-22,37`); add nothing beyond it — the broader per-resource-type authz policy for the effects registry is product scope = Enzo (mandatory report line, M5/M8). (d) **Before using the creator-gate SQL, the executor MUST verify the exact auth join-table/column names against `middleware/rbac.ts` and the `sys_auth_*` DDL** (they were not re-derived by the review — see RECON NEEDED R8); also verify `ApprovalRequestRow` exposes the creator (`createdBy` / `approval_request_created_by`) in `approvals/repository.ts`. If Enzo has ALREADY answered that approval IS the delegation mechanism (no creator gate), drop the gate and flip M4 test 7 to assert the flow is *allowed* — pinning the behavior and the report line stay mandatory either way; shipping with the question unasked is the forbidden branch.
**O**: typecheck green; `grep -n "pool" apps/api/src/modules/approvals/effects/tenant-materialization.ts` → no hits.
**F**: circular import approvals↔tenant-materialization → cause: repository.ts of tenant-materialization imports `pool` from db/client (fine) but nothing from approvals; effects/ importing blueprints+repository creates no cycle (verified: tenant-materialization has no import from approvals) → if tsc still complains, counter: move the `DbConnector`-typed imports to `import type` where possible and re-check; a true cycle would mean the repo changed since recon → re-recon the imports.

### M4 — Integration tests: the round-trip + the failure contract
**A**: new file `apps/api/test/approvals-materialization-effect.integration.test.ts`, cloned from `approvals-effects.integration.test.ts` (same helpers, same `TITLE_PREFIX` idea — use `TEST-APVMAT`), with the tenant-materialization purge block from `tenant-materialization.integration.test.ts` in afterAll (owned codes: `SYN_RBR-%`, `RBR-SK-%`, `RBR-KPI-%`, `RBR-%`, tenants `TEST-MATFX-%`). Tests, in order:
1. **Happy round-trip**: seed tenant ACTIVE (`TEST-MATFX-1`) → `createAndApprove({resourceType: "TENANT_MATERIALIZATION", resourceId, metadata: {archetypeKey: "RETAIL_BANK_REFERENCE"}})` → `apply` → expect 200, status APPLIED → **subject mutated**: count by owned codes on that tenant: org-units `LIKE 'RBR-%'` = 7, positions = 11, users `user_external_code LIKE 'SYN_RBR-%'` = 11, PRIMARY ACTIVE assignments = 11, skill evidence > 0, kpi evidence > 0. Also assert **NO** `LEGACY_EMP::` user exists on the tenant (I14 negative assert: `count(*) WHERE user_external_code LIKE 'LEGACY_EMP::%'` = 0). Then **re-apply the SAME request id** → **409 `NOT_APPROVED`** (the pre-check at `service.ts:280-282` — pins the replay contract for free, REVIEW-16 L-3).
2. **Idempotence**: on the SAME tenant, a second request+approve+apply → 200 APPLIED; counts unchanged (still 7/11/11/11 — ON CONFLICT skipped everything).
3. **Failure path A (the 409 contract, subject-untouched)**: seed tenant `PENDING_ACTIVATION` → create+approve+apply → expect **409**, `error.code === "APPLY_EFFECT_FAILED"`; re-GET detail → status **APPROVED** (markApplied rolled back); count RBR-% rows on that tenant = **0** (no partial materialization leaked).
4. **Failure path B**: request with `metadata: {archetypeKey: "NO_SUCH_ARCHETYPE"}` on an ACTIVE tenant → 409 APPLY_EFFECT_FAILED, request stays APPROVED, 0 rows.
5. **Failure path C**: `resourceType: "TENANT_MATERIALIZATION"` with **no** `resourceId` → apply → 409, stays APPROVED.
6. **Metadata default**: request with NO metadata at all on an ACTIVE tenant → apply → 200 (defaults to RETAIL_BANK_REFERENCE). (Fold into test 1 or keep separate — executor's call, both fine.)
7. **Cross-tenant privilege-escalation gate (REVIEW-16 H-1)**: login as `federica.marchetti@rtl-bank.org` (TENANT_ADMIN — holds `approval:create` + `approval:decide`, 000133:42,52) → create + approve + apply a `TENANT_MATERIALIZATION` request against an ACTIVE `TEST-MATFX-*` tenant → **409 `APPLY_EFFECT_FAILED`** ("Only a PLATFORM_ADMIN-created request may materialize a tenant"), request stays APPROVED, **0 RBR rows** on the target tenant. (If Enzo has explicitly ruled approval IS the delegation mechanism — see M3 HARD RULE (d) — flip this test to assert the flow is *allowed*; the behavior gets pinned either way.)
**D-52 rules in this file**: no own `withTransaction`; no timestamp-ordering asserts; keep afterAll purge (house style); seeding via direct `pool.query` is safe (auto-savepointed).
**O**: `pnpm -C apps/api exec vitest run test/approvals-materialization-effect.integration.test.ts` → all pass, and pass again on a second consecutive run (idempotence under D-52 rollback = second run starts from zero residue).
**F1**: test 3 finds RBR rows after the 409 → cause: the handler ran OUTSIDE the apply tx (someone used the service / a second connection) → counter: this is the RED-TEAM §7.2 bug, fix the handler to client-passing repo calls — do NOT "fix" the test.
**F2**: 409 arrives but status flipped to APPLIED → cause: markApplied committed separately — would mean `applyRequest` changed since recon → re-read service.ts:276-304, re-plan (ABORT-2 if the seam is gone).
**F3**: `25P02 current transaction is aborted` cascades through the file → cause: a raw seeding statement failed inside the file tx outside a savepoint (only possible for non-write statements or helper misuse) → counter: check the failing statement is a WRITE (auto-savepointed); if you hit the documented residual hole (intentionally-failing SELECT), restructure the test to fail via write statements; NEVER ship with `TEST_TX_ISOLATION=0` as the "fix" (ABORT-7).

### M5 — Proposal for the next 1-2 handlers (RECON deliverable, NOT implementation)
**A**: using M1/R2 live counts + §1.5 evidence, write the ranked proposal into the session report/handoff (see §4 FORKS for the decision table and triggers). Do not build handler #2 in this mission unless Enzo has already answered (FORK F2 trigger).
**O**: a table in the final report: candidate · resource_type · guarded transition · evidence (table, CHECK, live rows) · value · risk · effort. **Plus the mandatory REVIEW-16 H-1 line (verbatim)**: "the effects registry executes handlers with route-level authz only (`approval:create`); per-resource-type authz policy (who may create/apply which effect) is an open product decision — WAIT-INPUT before handler #2."
**F**: temptation to "just implement TIME_OFF_APPROVAL, it's 30 lines" → cause: scope creep → counter: the brief is explicit — *propose with evidence, Enzo decides*. Stop at the proposal.

### M6 — Full gates + commit + CI
**A**: in order: `pnpm -C apps/api run typecheck` · `pnpm -C apps/api run typecheck:test` · `pnpm -C apps/api run lint` · root `pnpm -r --filter="@heuresys/*" run typecheck` · targeted suites (M0's three + the new file) · **full suite** `pnpm -C apps/api test` (expect ~186-190 files, 0 FAIL, ~25 min over the tunnel — run from the VM clone if the tunnel is flaky) · commit (conventional style matching `git log` precedent, cite #34/B3/I14) · push → CI all-green.
**O**: every gate exit 0; CI 6/6 (or current job count — ALL green).
**F**: an UNRELATED file fails in the full suite → cause: pre-existing or shared-DB jitter → counter: R3 discipline — rerun the single file; if deterministic and pre-existing, fix it (leave the codebase better); if it smells like parallel-work drift on the shared DB, check SOT/handoff and flag rather than force-push over it.

### M7 — Deploy + LIVE E2E demo (the "verifiable on the VM" clause)
**A**:
1. `scripts/vm-deploy.sh` (the S1001 single entrypoint — read its header first; it is detached + polls readyz per D-49). Wait for `/readyz` 200 `database:ok`.
2. Settle R4/R5 (API base + login). Prefer running the demo ON the VM against `http://localhost:8013` (no nginx/CSP variables); fall back to `https://www.heuresys.com/api` if 8013 is not it.
3. Demo script (curl, cookie-jar; every response saved to `qa_artifacts/` or the session dir as evidence):
   a. psql: `INSERT INTO sys.sys_tenancies (tenant_code, tenant_name, tenant_status) VALUES ('TEST-MATFX-DEMO','[TEST] MATFX demo','ACTIVE') RETURNING tenant_id;`
   b. login `admin@heuresys.com` — password from the **`TEST_ADMIN_PASSWORD`** env var (source the repo-root `.env` first; NOT `$TEST_PERSONA_PASSWORD`, which is only the TS constant name — see §1.4/R5); capture cookies + `csrfToken`.
   c. `POST /v1/approvals` — `{"title":"[DEMO #34] Materialize TEST-MATFX-DEMO","approverUserIds":["<admin user_id>"],"resourceType":"TENANT_MATERIALIZATION","resourceId":"<tenant_id>","metadata":{"archetypeKey":"RETAIL_BANK_REFERENCE"}}` with cookie + `x-csrf-token` → 200 PENDING.
   d. GET detail → step id → `POST .../decide {"decision":"APPROVE"}` → request APPROVED.
   e. `POST /v1/approvals/:id/apply` → **200, status APPLIED**.
   f. psql proof: `SELECT count(*) FROM sys.sys_organization_units WHERE organization_unit_tenant_id='<id>' AND organization_unit_code LIKE 'RBR-%';` → **7**; same for positions → **11**; users `SYN_RBR-%` → **11**; `SELECT approval_request_status, approval_request_applied_at FROM sys.sys_approval_requests WHERE approval_request_id='<id>';` → APPLIED + timestamp.
   g. **Live failure-path demo** (proves the rollback in a REAL transaction, where D-52 cannot mask anything): repeat a-e with a second tenant seeded `PENDING_ACTIVATION` → apply → **409 `APPLY_EFFECT_FAILED`**; psql: status still APPROVED, RBR count 0.
   h. Cleanup strictly **TENANT-SCOPED**, mirroring `purgeRbr(tenantId)` in `apps/api/test/tenant-materialization.integration.test.ts:57-82` — **every DELETE carries `WHERE <table>_tenant_id = '<demo tenant_id>'`** (or the `USING sys_users` join pinned to that tenant) **IN ADDITION to the code pattern** (evidence → assignments → users `SYN_RBR-%` → skills/kpis → positions → org-units). Run the purge once per demo tenant id, then approval requests titled `[DEMO #34]%`, then the `TEST-MATFX-%` tenants. Record every DELETE's row count. (This runs LIVE with no D-52 rollback: an unscoped `SYN_RBR-%` DELETE would destroy legitimately-materialized data on any other tenant — WI-C is a shipped prod endpoint. REVIEW-16 M-1.) (Optionally keep the happy-path tenant alive for Enzo to click through `/approvals` in the UI and note it in the report — then the purge is deferred to Enzo's confirmation; state which option was taken.)
**O**: e/f/g outputs captured; UI check optional: `www.heuresys.com/approvals` lists the demo request with status chip.
**F**: 403 on the write calls → cause: CSRF/Origin (R4 wrong) → counter: replay the exact header set the integration test uses (`cookie`, `x-csrf-token`; add `origin: https://www.heuresys.com` if csrf-origin enforcement is on for non-localhost). 401 on login with `TEST_ADMIN_PASSWORD` set → ABORT-5 (unset var = blocked-on-Enzo, see R5).

### M8 — Close & propagate
**A**: per project close discipline (S1001 handoff-rigor): update `docs/kb/SOT_BACKLOG.md` #34 (TENANT_MATERIALIZATION shipped; proposal pending Enzo), SOT_STATE delta, `.handoff/STATE.md`, run the repo's close/lint tooling (`scripts/close-propagate.sh` — read its header; it runs `handoff_lint`). Final report to Enzo: what shipped, live evidence pointers, the §4 proposal table, RECON R2 numbers, **and the mandatory H-1 authz line**: "the effects registry executes handlers with route-level authz only (`approval:create`); per-resource-type authz policy (who may create/apply which effect) is an open product decision — WAIT-INPUT before handler #2" (plus whether the creator gate shipped, or was flipped per M3 HARD RULE (d)).
**O**: handoff lint exit 0; nothing marked done without live evidence (DoD).
**F**: lint blocks on vocabulary/status → follow its error message; it is prescriptive by design.

---

## 4. FORKS (trigger → route)

- **F1 — metadata threading vs hardcoded default** (at M2). Trigger: if R6 reveals `insertRequest` call-sites that make the threading risky, or typecheck ripple exceeds ~4 files, **route B**: skip the contract change entirely; handler uses `RETAIL_BANK_REFERENCE` unconditionally (single archetype exists — blueprints.ts:56). Ship a note that multi-archetype selection needs the metadata field later. Route A (thread metadata) is default because the column exists, the field is optional, and it future-proofs every next handler. Route B ripple (mandatory): (i) drop metadata from every createReq payload in M4 and from M7c; (ii) DROP test 4 (unknown archetype is unreachable without the field — Zod objects strip unknown keys, so the payload field would be silently dropped and the handler defaults to RETAIL_BANK_REFERENCE → 200) and note why in the test header; (iii) test 6 becomes the primary happy path (default archetype); (iv) the report to Enzo states multi-archetype selection is blocked on the metadata field.
- **F2 — which further handlers to PROPOSE, ranked (final choice = Enzo, flagged in the report)**:
  | Rank | Candidate | Trigger from R2 | Value / Risk |
  |---|---|---|---|
  | 1 | `TIME_OFF_APPROVAL` — guarded `sys_time_off_requests.request_status` PENDING→APPROVED (+ twin REJECT path via normal approval rejection = no effect, or a `CANCELLED` variant — design note for Enzo) | If `sys_time_off_requests` has PENDING rows live → propose as **build-next with live demo**; if 0 rows → still rank 1 (cleanest semantics: the table was BORN for approval, has approver column + pending index, no competing write path) but demo needs seeded rows | High value (real HR flow, unlocks L8→write evolution) / lowest risk (identical shape to tenant-activation, zero migrations) |
  | 2 | `GOAL_COMPLETION` — `sys_goals.status` →COMPLETED + `completed_at` | If goals live counts show IN_PROGRESS/ON_TRACK rows (expected ≥600 total) → demonstrable on real data day one | Medium value / medium risk: `PATCH /v1/goals` already writes status freely → approval is advisory unless the PATCH is later gated (product decision, NOT this mission) |
  | 3 | `OVERTIME_APPROVAL` — `sys_overtime` PENDING→APPROVED | Only if R2 shows overtime rows | Same shape as #1, less product visibility |
  Recommendation to hand Enzo: **build TIME_OFF_APPROVAL next** (evidence corrected per REVIEW-16 C-2: nothing in apps/api reads or writes `sys_time_off_requests` today — the "no competing write path" argument is even stronger), defer GOAL_COMPLETION until the goals-write-gating question is decided. **Handler #2 is WAIT-INPUT on the H-1 per-resource-type authz decision** (who may create/apply which effect — see the mandatory M5/M8 report line): Enzo answers both questions with one decision.
- **F3 — where to run the full suite** (at M6). Trigger: tunnel latency makes the Windows run exceed ~35 min or drops connections → run gates on the VM clone (`/home/ubuntu/heuresys-advanced`, align it first per repo practice).
- **F4 — live demo entrypoint** (at M7). Trigger: R4 shows 8013 not listening / different port → use the port nginx proxies to (read `deploy/nginx/` config); trigger: CSRF origin-enforcement rejects localhost curl → demo through `https://www.heuresys.com/api` with `origin` header set.

---

## 5. ABORT CONDITIONS (stop, report to Enzo, do not improvise)

1. **SoT conflict**: SOT_BACKLOG/handoff shows #34 done, in-progress elsewhere, or re-scoped → stop at M0.
2. **Seam changed**: `applyRequest` no longer runs handler+markApplied in one `withTransaction`, or the registry API differs from §1.1 → the plan's spine is void; stop, re-recon, report.
3. **A schema migration appears necessary** (any reason) → stop: the plan asserts zero migrations; needing one means a wrong assumption upstream (D-12/numbering coordination is Enzo-level).
4. **RTL_BANK or HEURESYS would be written** by any step (test, demo, cleanup) → stop immediately (ADR-0026/I15). The only legitimate writes are on `TEST-MATFX-%`/`TEST-APVMAT%`-owned rows. (Scope: writes that would COMMIT — live demo/cleanup/seed. D-52-rolled-back test writes inside the existing suite, e.g. `tenant-materialization.integration.test.ts` against RTL, are house practice and exempt.)
5. **Live login fails** with the `TEST_ADMIN_PASSWORD` env password **set** (R5) → credentials rotated again; stop (no live verification possible without them; never guess passwords). An UNSET `TEST_ADMIN_PASSWORD` is `blocked-on-Enzo: password non presente in .env`, NOT this abort.
6. **No DB access** (tunnel AND VM both unreachable) → stop; every verification in this mission is live-DB-bound.
7. **A test only passes with `TEST_TX_ISOLATION=0`** → the code violates the D-52 contract (likely a second-connection bug); fix the code or stop — never ship the escape hatch as a fix.
8. **>30 min stuck on one failure class with 2+ failed counter-moves** → R14: stop, report state and hypotheses.

---

## 6. VERIFICATION RUNS (executor performs ALL; pass criteria explicit)

| # | Run | When | Pass looks like |
|---|---|---|---|
| V1 | `pnpm -C apps/api run typecheck && pnpm -C apps/api run typecheck:test` | after M2, M3, M4 | exit 0, 0 errors |
| V2 | `pnpm -C apps/api run lint` + root `pnpm -r --filter="@heuresys/*" run typecheck` | M6 | exit 0 |
| V3 | `pnpm -C apps/api exec vitest run test/approvals-materialization-effect.integration.test.ts` — **twice, back to back** | end of M4 | all tests pass BOTH runs (2nd run proves zero-residue + idempotence under D-52) |
| V4 | `pnpm -C apps/api exec vitest run test/approvals.integration.test.ts test/approvals-effects.integration.test.ts test/tenant-materialization.integration.test.ts` | M6 | all pass (no regression on neighbors) |
| V5 | full suite `pnpm -C apps/api test` | M6 | 0 FAIL (pre-existing skips allowed; count matches SOT baseline ±new file) |
| V6 | push → GitHub Actions | M6 | ALL CI jobs green (6/6 per brief; whatever the current count, all of them) |
| V7 | `scripts/vm-deploy.sh` then `curl -s https://www.heuresys.com/api/readyz` | M7 | readyz 200 `database:ok` |
| V8 | **Live happy demo** (M7 a-f) | M7 | apply → HTTP 200 `status:"APPLIED"`; psql: RBR org-units=7, positions=11, `SYN_RBR-%` users=11 on the demo tenant; `LEGACY_EMP::%` count=0 |
| V9 | **Live failure demo** (M7 g) | M7 | apply → HTTP 409 `error.code:"APPLY_EFFECT_FAILED"`; psql: request still APPROVED, RBR rowcount 0 on the second tenant |
| V10 | handoff/close lint (`scripts/close-propagate.sh` flow) | M8 | exit 0 |

---

## 7. RED-TEAM RECORD

### 7.1 Attack that FAILED against the plan
**Attack**: "The new `resource_type` value or the new jsonb write will trip a DB constraint the plan missed — varchar CHECK on resource_type, or a metadata NOT NULL violation — forcing an unplanned migration mid-mission (D-12 numbering collision, the classic heuresys trap)."
**Defense held**: recon read the DDL directly — `000132:35` defines `approval_request_resource_type varchar(64)` with **no CHECK** (the CHECKs at :52-60 cover status/policy/priority only), and `000132:40` gives `approval_request_metadata jsonb NOT NULL DEFAULT '{}'` so the column pre-exists and omission-safe defaults apply. The inbox CHECK widening at `000132:160-174` concerns `notification_resource_type` (APPROVAL_STEP), which this mission never extends. Zero migrations stands; the attack found no purchase.

### 7.2 Attack that SUCCEEDED + the patch it forced
**Attack**: "Write the handler the *obvious* way — call `tenantMaterializationService.materialize(actor, body)` — and every test still passes." And it would: under D-52 the facade collapses `pool` and every `pool.connect()` onto ONE physical client, so the service's own `withTransaction` becomes a nested savepoint on the SAME connection and even the 409-rollback test goes green. **In production it is broken twice**: (a) the service opens a SECOND real transaction → materialization commits independently of `markApplied`, so a later failure leaves the tenant materialized while the request stays APPROVED (the exact atomicity the seam exists to guarantee, silently violated); (b) `service.materialize`'s `findTenantStatus(pool, …)` runs OUTSIDE the apply transaction (read-skew on the guard). The test suite is structurally incapable of catching this — only prod behavior differs.
**Patch applied to the plan**: (1) M3 HARD RULE (a): handler imports `repo.materialize`/`findTenantStatus` + `getArchetype` only, never `pool`, never the service — with a mechanical check: `grep -n "pool\|tenantMaterializationService" <handler file>` must return nothing; (2) M4-F1 names this exact bug as the diagnosis if failure-test 3 finds leaked rows; (3) V9 (live failure demo on the VM, real transactions) was added precisely because it is the ONLY environment where this class of bug is observable — the 409 + 0-rows live check is the atomicity proof D-52 cannot give.

### 7.3 (bonus, also applied) 
**Attack**: unbounded `metadata` on a public-ish create route (any `approval:create` holder) → multi-MB jsonb rows. **Patch**: the 4096-char serialized-size refine in M2 is mandatory, with a negative expectation available cheaply (payload over limit → 400) if the executor wants an 8th test (test 7 is now the H-1 authz gate).

### 7.4 Independent adversarial review 2026-07-06 (REVIEW-16)

Independent pass, repo re-read at `D:\heuresys-advanced` (24 spot-checks: 21 PASS / 3 FAIL). Verdict: NOT PASS as written (6/8) — APPROVED AFTER PATCHING. All patches applied to this plan:

- **C-1 (CRITICAL)**: R5/M7 used `$TEST_PERSONA_PASSWORD` — a TS constant name, NOT an env var; the real env var is `TEST_ADMIN_PASSWORD` (`personas.ts:26`). Empty expansion → 401 → false ABORT-5 at the live demo. → Patched in §1.4, R5, M7b, ABORT-5 (unset var = blocked-on-Enzo, not abort).
- **C-2 (CRITICAL)**: §1.5 "VERIFIED" claim was false — `me/repository.ts:418,573` reads `sys_time_off_balances`, NOT `sys_time_off_requests`; grep shows NOTHING in apps/api touches the latter. Conclusion survives (stronger); evidence corrected in §1.5 + F2.
- **H-1 (HIGH)**: the handler as drafted opened a cross-tenant privilege-escalation channel — `approval:create` is held by tenant roles (000133:42), `resourceId` is a free uuid never matched to the request tenant, and the ACTIVE-only guard makes RTL_BANK reachable while direct materialization is PLATFORM_ADMIN-only. → Patched: creator-PLATFORM_ADMIN parity gate in M3 (SQL to be re-derived per R8), M4 test 7 pinning the 409, mandatory WAIT-INPUT report line to Enzo in M5/M8, F2 handler-#2 gating.
- **M-1 (MEDIUM)**: M7h live cleanup was not explicitly tenant-scoped — an unscoped `SYN_RBR-%` DELETE live would destroy legitimately-materialized tenant data. → Patched: every DELETE tenant-scoped, mirroring `purgeRbr(tenantId)`, row counts recorded.
- **M-2 (MEDIUM)**: F1 route B left three unstated judgment calls (metadata payloads in M4/M7c, unwritable test 4, happy-path shift). → Patched: mandatory route-B ripple appended to F1.
- **L-1 (LOW)**: ABORT-4 literally false-triggered on the plan's own baseline runs (D-52-rolled-back RTL writes in the existing suite). → Patched: commit-scope exemption appended.
- **L-2 (LOW)**: M2's jsonb precedent pointer (`emitNotification`) was wrong. → Patched: `JSON.stringify(input.metadata ?? {})` idiom, `activity-classifications/repository.ts:90` / `visualization-nodes/repository.ts:68`.
- **L-3 (LOW)**: cheap missing replay assertion. → Patched: re-apply same id → 409 `NOT_APPROVED` added to M4 test 1.

---

## 8. SELF-GRADE vs SUCCESS.md

1. **Expected observation per move** — PASS. Every M0-M8 states **O** concretely (exit codes, HTTP codes, row counts 7/11/11/11, psql outputs).
2. **Failure + cause + counter-move per move** — PASS. Every move carries **F** with cause→counter; M4 carries three distinct failure modes with distinct diagnoses.
3. **Forks with triggers** — PASS *after patching* (reviewer: PARTIAL as written — F1 route B left three unstated judgment calls, fixed by the M-2 ripple; the H-1 authz question was silently decided, now routed to Enzo via the mandatory M5/M8 report line). F1-F4 each fire on an observable (R6 ripple size, R2 row counts, tunnel latency, R4 port scan); the 2nd-handler choice is routed to Enzo with a ranked recommendation.
4. **RECON NEEDED with exact settling checks** — PASS *after patching* (reviewer: FAIL as written — R5's literal check used a nonexistent env var, C-1; corrected to `TEST_ADMIN_PASSWORD`). R1-R8, each a literal command with expected output and the move it gates.
5. **Abort conditions** — PASS. Eight, each a stop-and-flag moment (SoT conflict, seam drift, migration temptation, prod-tenant writes, credential rotation, no DB, escape-hatch shipping, R14 timebox).
6. **Verification spelled out** — PASS. V1-V10 with when + pass criteria, including the double-run V3 (D-52 residue proof) and the live V8/V9 pair (the end-to-end demo the brief demands).
7. **Red-team survived and recorded** — PASS. §7.1 failed attack (constraint/migration trap, defeated by DDL recon), §7.2 successful attack (service-call atomicity hole invisible to the test suite) with three concrete patches now embedded in M3/M4/V9, a bonus metadata-size patch in M2, and the independent REVIEW-16 pass recorded in §7.4 (8 findings, all patched in).
8. **Executable blind** — PASS *after patching* (reviewer: FAIL as written — C-1 alone killed a blind run at M7 with a false abort; M-2 stranded route B; M-1 left the only irreversible step under-specified). With those patched, the executor never has to *ask* a question; M7's curl header set remains check-then-route via R4, which is an instruction, not a question.

**GRADE RECORD**: self-grade **8/8 claimed — REJECTED** by the independent adversarial review (REVIEW-16, 2026-07-06): **6/8 as written** (SUCCESS #3 PARTIAL, #4 FAIL, #8 FAIL — see §7.4). Verdict: NOT PASS as written, **APPROVED AFTER PATCHING**. All C-1/C-2/H-1/M-1/M-2 patches (plus L-1/L-2/L-3) are now applied in this document; post-patch status per the reviewer's own criteria: safe to hand to a blind executor (8/8 with the patches in).
