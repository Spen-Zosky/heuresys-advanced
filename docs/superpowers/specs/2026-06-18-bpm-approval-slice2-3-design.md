# BPM approval-flow — slice-2 (shipped) + slice-3 (design / residuo)

> Companion to `2026-06-17-bpm-approval-flow-design.md` (slice-D). Slice-2 is SHIPPED
> (S996, mig 000138). Slice-3 is DESIGNED here as honest residuo (multi-session: it needs a
> systemd-timer deploy for SLA and a natural apply-effect target). Authored 2026-06-18 (S996).

## slice-2 — ordered multi-level chains ✅ SHIPPED (S996)

Commit `8cc2e46`, mig `000138`. A request can be an ordered chain of levels; a level opens only
once the prior level is satisfied.

- **Schema** (`000138`): `approval_step_level_policy varchar(16)` (nullable → falls back to the
  request `decision_policy`; CHECK ALL_OF/ANY_OF, RD-08) + partial index `(request_id, ordinal)
  WHERE status='PENDING'` for the active-level lookup. The `ordinal` column + `SKIPPED` status
  already existed (000132).
- **Contract**: `CreateApprovalRequestBody.levels[]` (`{approverUserIds, policy?}`), mutually
  exclusive with the slice-1 `approverUserIds` (refine). `ApprovalStep.levelPolicy`.
- **Runtime** (`service.deriveChain`): evaluate levels in ascending ordinal — a level FAILS
  (→ REJECTED, skip ≥ordinal) on ALL_OF any-reject / ANY_OF all-reject; SATISFIES on ALL_OF
  all-approved / ANY_OF any-approved (→ open next or APPROVED); else it is the active level.
  `decideStep` guards `LEVEL_NOT_ACTIVE`; opening a level emits its inbox (dedupe → no re-notify).
  An approver may appear in only one level (000132 UNIQUE(request, approver)).
- **Behavior-preserving**: a single level reproduces slice-1 exactly (10 slice-1 tests green).

## slice-3 — effect-wiring + SLA/escalation

> **Update S997 (2026-06-19)**: **3b SLA/escalation ✅ SHIPPED** (live, mig `000141`). **3a
> effect-wiring stays RESIDUO** (needs a natural apply-effect target — shipping a seam-only
> registry would be scaffold, against the repo DoD; the WI-C tenant-materialization activation
> is the leading candidate target).

Two independent sub-features. 3b is shipped; 3a carries a real blocker that makes it multi-session.

### 3a. Effect-wiring (apply actually mutates the subject)

Today `applyRequest` is a pure marker (APPROVED→APPLIED). Design = a **handler registry** keyed by
`approval_request_resource_type`:

- `apps/api/src/modules/approvals/effects/registry.ts`: `type ApplyEffectHandler = (client:
  PoolClient, request: ApprovalRequestRow) => Promise<void>` + a `Map<string, handler>` with
  `register()/get()`. **No schema change** — reuses the polymorphic `resource_type/resource_id`
  from 000132.
- `applyRequest` runs `markApplied` AND the dispatched handler **inside the same withTransaction**
  (atomic; a handler throw rolls back the apply → typed `APPLY_EFFECT_FAILED`). Unknown
  `resource_type` → no-op (backward-compatible pure marker).
- **BLOCKER (why residuo)**: needs a *natural* apply-effect target to wire a real handler (the DoD
  wants one real subject mutated E2E on RTL data). Candidates to evaluate: a "pending→active"
  transition on an existing tenant resource. Do NOT invent an artificial mutation — pick a real
  one or ship the seam + a documented first handler in the same session that introduces a
  resource with an approvable lifecycle.

### 3b. SLA / escalation (the scheduler sub-feature) — ✅ SHIPPED S997 (mig 000141)

**As shipped** (`000141` + `approvals/sla.ts` + `sla-cli.ts` + 2 systemd units + vm-bootstrap wiring):
columns `approval_step_{due_at,reminder_count,escalated_at}` + `approval_request_sla_hours` +
partial due-index + inbox CHECK widened (`NotificationTypeSchema` += APPROVAL_REMINDER/OVERDUE).
`runApprovalSla(pool)` scans overdue PENDING steps → reminder to approver (dedupe, in-app) + bump
count + escalate to `created_by` once `reminder_count >= ESCALATE_AFTER` (3). Live-verified on
RTL_BANK (`approvals-sla.integration` 2/2: reminder+bump, escalate-once). The systemd timer is
inert until a `vm-bootstrap.sh` re-run installs it (ops gap, D-17); the runtime is proven live via
the test/CLI. Email escalation rides the SMTP-gated digest; in-app is fully functional now.

**Original design (for reference):**

- **Schema** (new migration, next free number): on `sys_approval_steps` add
  `approval_step_due_at timestamptz` (RD-09: intra-day reminders → timestamptz, not date),
  `approval_step_reminder_count int DEFAULT 0`, `approval_step_escalated_at timestamptz`; optional
  `sys_approval_requests.approval_request_sla_hours int`. Partial index `(due_at) WHERE
  status='PENDING' AND due_at IS NOT NULL`. Widen the inbox `notification_type` CHECK
  (+APPROVAL_OVERDUE/APPROVAL_REMINDER) — mirror `NotificationTypeSchema`.
- **Runtime** (mirror the digest scheduler exactly): `approvals/sla.ts` `runApprovalSla(pool)` —
  scan pending steps at the active level with `due_at < now()`, emit reminder/overdue inbox
  (dedupe), bump `reminder_count`, on the Nth reminder escalate to `created_by` (always present;
  manager-in-hierarchy is a richer variant but may be null). Best-effort per row (digest.ts try/
  catch idiom). + `approvals/sla-cli.ts` (digest-cli.ts twin), `package.json` `approvals:sla`,
  `deploy/systemd/heuresys-advanced-approvals-sla.{service,timer}` (OnCalendar hourly), +
  `scripts/vm-bootstrap.sh` wiring.
- **BLOCKER (why residuo)**: the new systemd timer is inert until a VM bootstrap re-run installs it
  (same ops gap as the digest timer, D-17 self-modify-buffer). Email escalation stays a chassis
  until SMTP creds exist. In-app reminders are fully functional without that.

### HOW decisions locked (slice-2, by Claude per PM-owns-WHAT)

nullable per-level `level_policy` column (not a `sys_approval_levels` table) · additive `levels[]`
(flat kept as sugar) · SLA `timestamptz` hourly · escalation → `created_by`+approver · effect
handler registry (code seam, no schema). All reversible/additive.
