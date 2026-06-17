# Design Spec — Capability 3.3 BPM Runtime, Slice D: Approval-Flow Runtime

- **Date**: 2026-06-17
- **Capability**: 3.3 BPM runtime · **Slice chosen by Enzo**: D = APPROVAL-FLOW RUNTIME
- **Status**: DESIGN (doc-only; no code/migration written by this spec)
- **Author**: Claude Code (subagent), grounded on live repo @ branch `main` HEAD `042e386`

---

## 0. TL;DR

The platform today has a process **catalog/modeling** layer but **zero runtime execution**. There is a tenant-less blueprint process registry (`sys.sys_blueprint_process_registry`, 23 rows — verified live), an org-unit↔process RACI assignment table (`sys.sys_organization_unit_processes`, mig `000121`), and KPI templates — but **no instance, no state, no transition, no approval table**. Slice D delivers the **first executable BPM primitive**: a **generic approval runtime**. An actor *creates* an approval request; one-or-more approver *steps* are materialized; each pending step is delivered to the approver's **inbox** as an actionable notification (reusing the 3.4 notification center shipped S992); the approver *approves* or *rejects*; when all steps resolve, the request reaches a terminal state (`APPROVED`/`REJECTED`) and an optional **apply** hook flips it to `APPLIED`. Net-new: two tables (`sys_approval_requests` + `sys_approval_steps`), three permissions (`approval:{create,decide,read}`), one API module (mandatory 7-step pattern), one admin UI surface + one approver inbox-action surface. D is deliberately a **special case of the full state-machine engine (option B)** so it composes forward without rework.

---

## 1. WHAT slice D delivers (scope)

A **generic, domain-agnostic approval runtime**:

1. **Request** — an authorized actor (`approval:create`) opens an approval request for an arbitrary subject (`resource_type` + `resource_id`, polymorphic like the inbox's own `notification_resource_type`/`notification_resource_id` pattern in `000027_ess_inbox_and_audit.sql:29-30`). A request carries a `title`, optional `body`, `priority`, and a list of approver `user_id`s.
2. **Steps** — at creation the service materializes **one row per approver** in `sys_approval_steps`, each `PENDING`. Slice-1 ships **single-level** semantics (any-of OR all-of, configurable per request — see §2.4); multi-step *ordered chains* are explicitly deferred (§7).
3. **Inbox delivery** — for every `PENDING` step, the service emits an **actionable inbox notification** to the approver via the existing emitter `emitNotification()` (`apps/api/src/lib/notifications/emit.ts:45`), with `action_url` pointing at the approver's decision surface and `resource_type='approval_step'` + `resource_id=<step id>` (§4).
4. **Decide** — an approver (`approval:decide`) calls approve/reject on **their own** step. The step flips to `APPROVED`/`REJECTED` with `decided_at` + `decision_comment`. The parent request's status is re-derived from its steps (§2.3).
5. **Apply** — when the request reaches `APPROVED`, an optional terminal transition `APPROVED → APPLIED` records that the approved effect was carried out (slice-1: a no-op marker + audit hook; the *effect wiring* per subject domain is out of scope for D and handled by the consuming module — D only owns the decision, not the side-effect).
6. **Track** — `approval:read` lets admins/owners list and inspect requests + their step ledger.

**Out of scope for slice D** (composes forward, not regressed): conditional branching, parallel gateways, timers/SLA escalation, delegation/reassignment, ordered multi-level chains (these are the *full state-machine engine* — option B, §8).

---

## 2. Net-new schema

Two tables, in a single idempotent migration **`000132_approval_runtime.sql`** (next free number — latest on disk is `000131_drop_dead_lineage_natural_key_idx.sql`), plus a sibling permission-seed migration **`000133_approval_permission_seed.sql`** (mirrors the table-vs-perms split of `000121`/`000122`). All DDL follows the conventions proven in `000121`: `sys.sys_<plural>`, FK fields prefixed, `gen_random_uuid()` PK, `tenant_id NOT NULL → sys.sys_tenancies ON DELETE CASCADE`, `jsonb metadata DEFAULT '{}'`, `updated_at` + `sys.sys_set_updated_at` trigger, guarded `ADD CONSTRAINT`, `CREATE TABLE/INDEX IF NOT EXISTS` → twice-run = empty `pg_dump` diff.

### 2.1 `sys.sys_approval_requests`

| column | type | notes |
|---|---|---|
| `approval_request_id` | `uuid` PK `DEFAULT gen_random_uuid()` | |
| `approval_request_tenant_id` | `uuid NOT NULL` | FK → `sys.sys_tenancies(tenant_id)` `ON DELETE CASCADE`. **I5 isolation = this FK + middleware filter, NEVER RLS.** |
| `approval_request_title` | `varchar(255) NOT NULL` | |
| `approval_request_body` | `text` | nullable |
| `approval_request_resource_type` | `varchar(64)` | polymorphic subject type (e.g. `ORG_UNIT_PROCESS`, `POSITION`, `SKILL`) — **CHECK is *open* in slice-1** (no enum lock; the consuming domain owns the vocabulary). Modeled on `notification_resource_type varchar(64)` (`000027:29`). |
| `approval_request_resource_id` | `uuid` | nullable; the subject row id |
| `approval_request_status` | `varchar(16) NOT NULL DEFAULT 'PENDING'` | **state machine via varchar+CHECK (RD-08, NEVER ENUM)**: `CHECK IN ('PENDING','APPROVED','REJECTED','APPLIED')` |
| `approval_request_decision_policy` | `varchar(16) NOT NULL DEFAULT 'ALL_OF'` | `CHECK IN ('ALL_OF','ANY_OF')` — quorum rule for re-deriving request status (§2.3) |
| `approval_request_priority` | `varchar(32) NOT NULL DEFAULT 'MEDIUM'` | aligns to inbox priority domain `CHECK IN ('INFO','MEDIUM','HIGH','CRITICAL')` (`000027:49-50`) so it can pass straight through to `emitNotification`'s `priority`. |
| `approval_request_metadata` | `jsonb NOT NULL DEFAULT '{}'::jsonb` | |
| `approval_request_resolved_at` | `timestamptz` | set when status becomes terminal (`APPROVED`/`REJECTED`) |
| `approval_request_applied_at` | `timestamptz` | set on `APPLIED` |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | RD-09: time-of-day matters → `timestamptz` |
| `created_by` | `uuid` FK → `sys.sys_users(user_id) ON DELETE SET NULL` | the requester |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | + `sys_set_updated_at` trigger; `CHECK (updated_at >= created_at)` (cf. `sys_oup_updated_after`, `000121:41`) |

Indexes: `(approval_request_tenant_id, approval_request_status, created_at DESC)` (admin tracking list, tenant-filtered); partial `(approval_request_resource_type, approval_request_resource_id) WHERE approval_request_resource_id IS NOT NULL` (subject lookup — mirrors `sys_inbox_resource_idx`, `000027:72-74`).

> **RD-09 dates vs timestamptz**: every column here is an *event timestamp* (creation, decision, resolution, application) so all are `timestamptz`. There are no date-only columns in this schema; if a future SLA/due-date field is added (§9 Q4) it would be `date` per RD-09.

### 2.2 `sys.sys_approval_steps`

| column | type | notes |
|---|---|---|
| `approval_step_id` | `uuid` PK `DEFAULT gen_random_uuid()` | this is the inbox `resource_id` (`resource_type='approval_step'`) |
| `approval_step_request_id` | `uuid NOT NULL` | FK → `sys.sys_approval_requests(approval_request_id) ON DELETE CASCADE` |
| `approval_step_tenant_id` | `uuid NOT NULL` | FK → `sys.sys_tenancies` — **denormalized from the parent for cheap tenant-filtered reads (I5)**, exactly the `org_unit_process_tenant_id` pattern (`000121:25`). Set by service from the parent's tenant. |
| `approval_step_approver_user_id` | `uuid NOT NULL` | FK → `sys.sys_users(user_id) ON DELETE CASCADE` — the assigned approver |
| `approval_step_ordinal` | `int NOT NULL DEFAULT 1` | slice-1 always `1` (single level); reserved for ordered chains (§7) |
| `approval_step_status` | `varchar(16) NOT NULL DEFAULT 'PENDING'` | **RD-08 varchar+CHECK**: `CHECK IN ('PENDING','APPROVED','REJECTED','SKIPPED')`. `SKIPPED` reserved for ANY_OF short-circuit (a sibling already satisfied the quorum). |
| `approval_step_decision_comment` | `text` | nullable |
| `approval_step_decided_at` | `timestamptz` | null until decided |
| `approval_step_decided_by` | `uuid` FK → `sys.sys_users(user_id) ON DELETE SET NULL` | normally == approver, captured for audit |
| `approval_step_metadata` | `jsonb NOT NULL DEFAULT '{}'::jsonb` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | + trigger + `CHECK (updated_at >= created_at)` |

Constraints/indexes:
- **UNIQUE** `(approval_step_request_id, approval_step_approver_user_id)` — a user is an approver on a request **at most once** (mirrors `sys_oup_ou_process_uq`, `000121:56`; gives the service a clean `23505` → `409 CONFLICT` path like `isUniqueViolation` in `organization-unit-processes/service.ts:28`).
- index `(approval_step_approver_user_id, approval_step_status)` partial `WHERE approval_step_status='PENDING'` — "my pending approvals" inbox query (mirrors `sys_inbox_user_unread_idx`, `000027:65-67`).
- index `(approval_step_request_id)` — load the step ledger for a request.

### 2.3 State machine + re-derivation logic

Request status is **re-derived from its steps** on every decision, inside a transaction:

```
ANY step REJECTED                                  → request REJECTED  (terminal; resolved_at = now)
policy=ALL_OF AND every step APPROVED              → request APPROVED  (terminal; resolved_at = now)
policy=ANY_OF AND ≥1 step APPROVED                 → request APPROVED  (terminal; remaining PENDING → SKIPPED)
otherwise                                          → request stays PENDING
APPROVED → APPLIED                                 (explicit apply call only; sets applied_at)
```

All multi-row writes (insert request + N steps; decide step + re-derive request + SKIPPED siblings) MUST run in **`withTransaction(pool, async (client) => {...})`** per the module pattern (CLAUDE.md §"The module pattern" item 2; the helper is the same one `modules/auth/repository.ts` uses for token rotation).

### 2.4 Idempotency

- **Migration idempotency**: `IF NOT EXISTS` + guarded `ADD CONSTRAINT`/`TRIGGER` (the `000121` `DO $cs$ … pg_constraint` guard pattern, lines 34-53). Twice-run empty diff is a release gate.
- **Runtime idempotency**: (a) the `UNIQUE(request_id, approver_user_id)` makes re-submitting the same approver set a no-op-or-409, not a duplicate; (b) decide is **state-guarded** — `UPDATE … WHERE approval_step_id=$1 AND approval_step_status='PENDING'`; `rowCount=0` ⇒ already decided ⇒ `409 ALREADY_DECIDED` (no double-count of a quorum); (c) inbox emit uses `emitNotification(..., { dedupe: true })` so a re-emit for an already-`UNREAD` `approval_step` step is suppressed (`emit.ts:56-68`).

---

## 3. New permissions (`approval:{create,decide,read}`)

Verified live: **no `approval:*` permission exists today** (`SELECT … WHERE auth_permission_code LIKE 'approval%'` → 0 rows). Current `sys_auth_role_permissions` count = **600** (live).

`000133_approval_permission_seed.sql` mirrors `000122` verbatim (single-token snake-ish resource `approval`, `ON CONFLICT DO NOTHING`, explicit `PLATFORM_ADMIN` listing because the one-time `000005` grant does not auto-extend — see `000122:9-10`):

```sql
INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('approval:create', 'Create approval request', 'approval', 'create'),
  ('approval:decide', 'Decide an approval step',  'approval', 'decide'),
  ('approval:read',   'Read approval requests',    'approval', 'read')
ON CONFLICT (auth_permission_code) DO NOTHING;
```

Role audience (proposed — confirm in §9 Q2):
- `approval:read` → `PLATFORM_ADMIN, TENANT_ADMIN, BLUEPRINT_MANAGER, HRMS_MANAGER, PROCESS_OWNER, MANAGER` (the 6-role HRMS-read audience used by `000122:27`).
- `approval:create` → `PLATFORM_ADMIN, TENANT_ADMIN, HRMS_MANAGER, PROCESS_OWNER` (process owners initiate flows).
- `approval:decide` → **broad** — any role that can be an approver, including `MANAGER` and `TEAM_LEADER`. Decision authority is *also* gated at the data layer (you can only decide **your own** `PENDING` step), so the permission is necessary-not-sufficient. `READ_ONLY` excluded.

The seed must `RAISE EXCEPTION` if `count <> 3` (the `000122:39-43` post-condition). RBAC cache reloads at server boot / first `buildTestApp()` (CLAUDE.md security model).

> **I7 note**: these are auth permissions on `sys.sys_auth_*` (separate from `sys.sys_users`) — correct; the requester/approver/decider FKs above point at `sys.sys_users` (the person), the *capability* lives in `sys_auth_*`. No `sys_users`/auth conflation.

---

## 4. Reuse of the 3.4 notification center (the REUSE SEAM)

D delivers each approval task **into the approver's existing inbox** — no new delivery channel. The seam is `emitNotification()` (`apps/api/src/lib/notifications/emit.ts:45`), which already inserts into `sys.sys_inbox_notifications` honoring per-user preferences (default-on in-app) and supports `dedupe`.

For each `PENDING` step the service calls, **inside the same transaction** (emit accepts a `PoolClient`, `emit.ts:22` / `:45`):

```ts
await emitNotification(client, {
  tenantId: step.tenantId,
  userId: step.approverUserId,
  type: "APPROVAL_REQUEST",                      // ← new type, see below
  subject: request.title,
  body: request.body ?? null,
  priority: request.priority,                    // INFO|MEDIUM|HIGH|CRITICAL — domains already aligned (§2.1)
  resourceType: "APPROVAL_STEP",                 // ← new resource_type, see below
  resourceId: step.approvalStepId,
  actionUrl: `/approvals/${request.id}?step=${step.id}`,  // approver decision surface
  createdBy: request.createdBy,
  dedupe: true,                                  // re-emit safe (emit.ts:56)
});
```

**Two CHECK domains on `sys_inbox_notifications` must be widened** (in `000132`, additive, idempotent — drop+re-add constraint like `000027:40-44`):
- `notification_type` CHECK (`000027:44`) currently `IN ('TRAINING_DEADLINE','ASSESSMENT_REQUEST','MANAGER_FEEDBACK_READY','CAREER_TARGET_STATUS','GAP_CLOSURE_DUE','SYSTEM')` → **add `'APPROVAL_REQUEST'`**.
- `notification_resource_type` CHECK (`000027:62-63`) currently `IN ('POSITION','LEARNING_MODULE','ASSESSMENT','CAREER_TARGET','KPI','SKILL')` → **add `'APPROVAL_STEP'`**.
- `NotificationTypeSchema` (`packages/shared/src/schemas/notifications.ts:12`) gets `"APPROVAL_REQUEST"` appended so the union mirrors the DB CHECK (the file's own header demands this mirror, `notifications.ts:7-8`).
- The polymorphic-consistency VIEW `sys.v_inbox_resource_consistency` (`000027:120-141`) SHOULD get an `APPROVAL_STEP → sys_approval_steps` arm so a deleted step is flagged (optional in slice-1; if added, it goes in `000132` after both tables exist).

**Why this is the right seam, not a new table**: the inbox already gives us (a) per-user delivery + opt-out preferences (`emit.ts:47-53`), (b) `action_url` deep-linking, (c) `priority`, (d) `resource_type/resource_id` polymorphic targeting, (e) bulk set-based emit (`emitNotificationsBulk`, `emit.ts:105`) if a request fans out to many approvers, (f) the consumer `/v1/me/inbox` UI already shipped. D contributes **only** the producer call + the actionable rendering of `APPROVAL_STEP` rows (§6).

When a step is decided, the corresponding inbox notification SHOULD be marked `READ`/`DISMISSED` (the inbox already supports `INBOX_MARK_READ`/`INBOX_DISMISS` audit actions, `000027:99`); the decide service issues that status flip in-txn so the task disappears from the approver's "to-action" list.

---

## 5. API module — mandatory 7-step pattern

New module `apps/api/src/modules/approvals/`, prefix `/v1/approvals`, following the 7-step pattern (CLAUDE.md §"The module pattern") and the org-unit-processes module as the closest live template.

**Step 1 — shared Zod** (`packages/shared/src/schemas/approvals.ts` + export in `index.ts` + subpath `./schemas/approvals` in `package.json`):
- `ApprovalStatusSchema = z.enum(['PENDING','APPROVED','REJECTED','APPLIED'])`, `ApprovalStepStatusSchema = z.enum(['PENDING','APPROVED','REJECTED','SKIPPED'])`, `ApprovalDecisionPolicySchema = z.enum(['ALL_OF','ANY_OF'])` — each mirroring its DB CHECK (RD-08).
- `CreateApprovalRequestBodySchema` = `{ title, body?, resourceType?, resourceId?, priority?, decisionPolicy?, approverUserIds: z.array(z.uuid()).min(1).max(50) }` (cap mirrors the broadcast `.max(500)` defensiveness, `notifications.ts:56`).
- `ApprovalRequestSchema`, `ApprovalStepSchema`, `ApprovalRequestDetailSchema` (request + steps array), `ApprovalListResponseSchema` (`items`+`total`, the project list shape), `DecideApprovalStepBodySchema` = `{ decision: z.enum(['APPROVE','REJECT']), comment? }`, id param schemas.

**Step 2 — repository** (`repository.ts`, raw parameterized SQL `$1,$2`, no Drizzle query-builder for select/insert): `insertRequestWithSteps(client, …)` (one INSERT request + one `unnest` set-based INSERT of N steps, like `emitNotificationsBulk`'s unnest, `emit.ts:136-144`), `findRequestScoped`, `listRequestsScoped` (tenant-filtered, `ScopeFilter` shape from `organization-unit-processes/repository.ts:16`), `listStepsForRequest`, `findStepScoped`, `decideStepGuarded` (state-guarded UPDATE §2.4b), `recomputeRequestStatus`, `markApplied`. **Defensive `LIMIT` cap** on the unbounded list read (QW-B2 doctrine, cf. the recent `80c71d2` commit on list reads).

**Step 3 — service** (`service.ts`, `ActorContext` from `lib/actor.ts:21`): `createRequest` (scope-check that every approver is a real user **in the actor's tenant** for non-platform actors — I5, the same `findOuScoped` tenant-pin logic, `organization-unit-processes/repository.ts:73`; build steps; emit inbox notifications in-txn §4), `listRequests`, `getRequest`, `decideStep` (load step → assert `actor.userId === step.approverUserId` else `ForbiddenError('Not your approval step','PERMISSION_DENIED')`; state-guarded decide; re-derive; SKIPPED siblings on ANY_OF; mark sibling inbox read; if terminal set `resolved_at`), `applyRequest` (`APPROVED → APPLIED`, else `ConflictError('Request not approved','NOT_APPROVED')`). Typed errors from `src/errors/index.ts` with `SCREAMING_SNAKE` codes (CLAUDE.md item 4): `NotFoundError`, `ForbiddenError('…','PERMISSION_DENIED')`, `ConflictError('…','ALREADY_DECIDED')`, `ConflictError('…','DUPLICATE_APPROVER')`.

**Step 4 — routes** (`routes.ts`, `FastifyPluginAsyncZod`, `requirePermission` on every route + `app.verifyCsrf` on every state-changer):

| method · path | permission | CSRF | body/params → response |
|---|---|---|---|
| `POST /` | `approval:create` | ✅ | `CreateApprovalRequestBody` → `ApprovalRequestSchema` |
| `GET /` | `approval:read` | — | filter query → `ApprovalListResponse` |
| `GET /:id` | `approval:read` | — | id param → `ApprovalRequestDetailSchema` |
| `POST /:id/steps/:stepId/decide` | `approval:decide` | ✅ | `DecideApprovalStepBody` → `ApprovalStepSchema` |
| `POST /:id/apply` | `approval:create` | ✅ | — → `ApprovalRequestSchema` |

(`requirePermission` + `app.verifyCsrf` usage exactly per `organization-unit-processes/routes.ts:28-37`.)

**Step 5 — register in `app.ts`** at step 13: `await app.register(approvalsRoutes, { prefix: "/v1/approvals" });` (cf. `app.ts:415`).

**Step 6 — integration test** (`apps/api/test/approvals.integration.test.ts`, supertest via `buildTestApp()`, **real DB through the tunnel, no mocks**): happy path (create → 2 steps → both inbox notifications emitted → approve both → request APPROVED → apply → APPLIED); reject short-circuit (one REJECT → request REJECTED, sibling not required); ANY_OF quorum (one APPROVE → request APPROVED, sibling SKIPPED); **I5 cross-tenant 404** (a TENANT_ADMIN of tenant A cannot read/decide tenant B's request — the no-leak assertion, like `organization-unit-processes` 404-on-cross-tenant); **decide-not-your-step 403**; **double-decide 409 ALREADY_DECIDED**; **RBAC denial** for a role lacking `approval:decide`. Assert an inbox row actually landed for the approver (`SELECT … FROM sys.sys_inbox_notifications WHERE notification_resource_type='APPROVAL_STEP'`). `pnpm test` 100% green.

**Step 7 — atomic commit**: `feat(api): 3.3 slice-D — generic approval runtime (5 endpoints, N tests)` — single commit, module + 2 migrations + shared schema together (CLAUDE.md: don't split a module across commits).

---

## 6. UI (admin track + approver actionable inbox)

Per the MVP-2a/2b **LIVE-DATA-E2E-ONLY** doctrine (CLAUDE.md bottom section): no mock data, no placeholder, every cell fed by a real `/v1/approvals/*` call; components composed from **`@heuresys/ui`** primitives (no UI primitive duplication in `apps/web`); i18n IT+EN with `pnpm i18n:check` parity; Playwright E2E green with a **real login** before any page commit.

- **Admin create/track** (`apps/web/src/app/(authenticated)/approvals/…`, gated by `approval:read`/`approval:create` via the DB-driven sidebar `useMyInterfaces`): a `DataTable` of requests (status badge using the app color tokens `text-danger/warning/success/info`, **not** `text-destructive` — that raw utility renders invisible per the known gotcha) + a create form (`Dialog` + `Form` from `@heuresys/ui`) picking approvers from a tenant-scoped user select; a detail drawer showing the **step ledger** (who, status, decided_at, comment).
- **Approver actionable inbox**: the existing `/me/inbox` notification list renders `APPROVAL_REQUEST` rows with **Approve / Reject inline actions** (a new actionable variant keyed off `resource_type='APPROVAL_STEP'`), each posting to `POST /v1/approvals/:id/steps/:stepId/decide`, then re-fetching the inbox (the task disappears as its notification flips to READ, §4). A standalone `/approvals/:id` decision page (the `action_url` deep-link target) provides the same actions for users who click the inbox link.
- TanStack Query hooks reuse types from `@heuresys/shared` (no hand-rolled types); **no `initialData`/`placeholderData` hard-codes**.
- **Playwright (live data, real personas)** — using the seeded RTL_BANK personas (CLAUDE.md security model): `paolo.caputo@rtl-bank.org` (MANAGER) creates a request naming `federica.marchetti@rtl-bank.org` (TENANT_ADMIN) as approver → assert the request row + that an inbox task appears for federica → log in as federica → approve from the inbox → assert the request flips to `APPROVED` via re-fetch (state verified through the real endpoint, not the DOM only). Run via `test:e2e:prod` (or `:node22` wrapper on Node ≥23, D-36).

---

## 7. Phased plan

**Slice-1 (this design, ~1-2 sessions)** — schema (`000132` two tables + inbox CHECK widening + perms `000133`) → shared schema → module (repo/service/routes, single-level ALL_OF/ANY_OF) → inbox wiring (`emitNotification` producer call) → integration tests green → admin track UI + approver inbox-action UI → Playwright live E2E → atomic commit. Single-level approval (1 request → N parallel approver steps, all ordinal 1) is the whole of slice-1.

**Slice-2 (later) — multi-step ordered chains**: use the already-present `approval_step_ordinal`. Steps materialize per level; only the lowest-ordinal `PENDING` level is "active" (its steps get inbox tasks); on level resolution the next ordinal activates and emits. No schema change beyond activating ordinal logic in the service + a `recomputeRequestStatus` that respects level order. This is why ordinal + SKIPPED already exist in slice-1's table.

**Slice-3 (later) — effect wiring & escalation**: per-`resource_type` apply hooks (the `APPLIED` transition actually mutates the subject row), SLA/timer escalation, delegation/reassignment. These are option-B engine features (§8).

---

## 8. D is a special case of the full state-machine engine (option B) — forward composition

The full BPM runtime (option B) is a generic instance/state/transition engine: a process *instance* moves through *states* via *transitions*, gated by *guards*, producing *tasks*. **Slice D is that engine narrowed to the canonical two-state-plus-quorum case**:

- `sys_approval_requests` ≈ the **instance** (a running thing with a status field that is a varchar+CHECK state machine — the exact shape a generic `sys_process_instances.instance_status` would take).
- `sys_approval_steps` ≈ the **task/transition ledger** (each step is a human task whose resolution drives a transition).
- the inbox notification ≈ the **task delivery channel** — already generic.
- `decision_policy` (ALL_OF/ANY_OF) ≈ a **degenerate gateway** (the simplest join semantics; a full engine generalizes this to arbitrary guard expressions).

Because the column conventions (varchar+CHECK status, polymorphic `resource_type/resource_id`, tenant-FK isolation, ordinal, jsonb metadata) are **identical to what a generic engine needs**, building D now does **not** create a dead-end: the generic engine, when built, can either subsume these tables (approval = a built-in process template) or sit beside them with the same patterns. No throwaway. This is the deliberate "close the cell so the row/column compose" matrix-discipline choice.

---

## 9. Open questions for Enzo

1. **Apply semantics (slice-1)**: should `APPROVED → APPLIED` in slice-1 be a pure marker + audit row (D owns *decision* only, the consuming domain wires the *effect* later), or do you want at least **one** concrete subject domain wired end-to-end now (e.g. an `ORG_UNIT_PROCESS` RACI assignment that only becomes active once approved) to satisfy the "LIVE E2E on real data, no green-test-only" Definition-of-Done? My default: marker + audit, with **one** real subject wired in the E2E so the DoD is met on real data.
2. **`approval:decide` role audience**: broad (any MANAGER/TEAM_LEADER can be an approver, data-layer pins to *own* step) vs narrow (only specific roles)? Default proposed broad (§3).
3. **Requester self-visibility**: should the requester see their own request's progress even without `approval:read` (a `/v1/me/approvals` self-scope read, ESS-style per ADR-0011), or is `approval:read` sufficient for slice-1? Default: defer the `/me/*` self-view to slice-2; slice-1 uses `approval:read` for admin/owner tracking.
4. **SLA / due date**: do approvals need a `date` due-date + escalation in slice-1, or is that slice-3? Default: slice-3 (keeps slice-1 schema minimal; RD-09 `date` column added then).
5. **`resource_type` vocabulary lock**: keep the request `resource_type` CHECK *open* (free varchar, consuming domain owns it) for flexibility, or lock it to an enum CHECK like the inbox does? Default: open in slice-1, lock later once real subjects are known (avoids churning a CHECK per new subject domain).

---

## Appendix — files cited (file:line, all verified live this session)

- `db/migrations/000027_ess_inbox_and_audit.sql:21-74` (inbox table, CHECK domains, indexes), `:120-141` (consistency VIEW)
- `db/migrations/000121_organization_unit_processes.sql:23-68` (table/constraint/trigger conventions), `:56` (unique idx)
- `db/migrations/000122_organization_unit_processes_permission_seed.sql:14-43` (perm-seed pattern + post-condition)
- `apps/api/src/lib/notifications/emit.ts:45` (`emitNotification`), `:22` (`PoolClient` accepted), `:56-68` (dedupe), `:105-159` (bulk unnest)
- `apps/api/src/lib/actor.ts:21-39` (`ActorContext`, `actorFromRequest`)
- `apps/api/src/modules/organization-unit-processes/{repository,service,routes}.ts` (closest 7-step template; scope-filter, 23505→409, requirePermission+verifyCsrf)
- `apps/api/src/modules/notifications/{service,routes}.ts` (set-based emit producer; CSRF+requirePermission route shape)
- `packages/shared/src/schemas/notifications.ts:12-22,55-69` (type/priority enums mirror DB CHECK; broadcast body cap)
- `apps/api/src/app.ts:114,415` (module import + step-13 register)
- Live DB: `sys_blueprint_process_registry` = 23 rows · `approval:*` perms = 0 · `sys_auth_role_permissions` = 600 · latest migration on disk `000131`
