# WARGAME 13 — heuresys-advanced F4: the functional/activity axis (backlog #24)

- **Mission**: implement backlog item **#24 — F4 of ADR-0027** (functional axis + activity endpoints + `sys_process_participants` + ACTIVITY taxonomy extension + functional-axis scope tests), including the cross-tree half of F5. Currently HOLD `{kind: manual}` — this plan converts Enzo's pending decision into the MASTER FORK below instead of a blocker.
- **Executor**: Claude Code CLI (Sonnet or Opus) on the heuresys-advanced repo — `D:\heuresys-advanced` (Windows) / `/home/ubuntu/heuresys-advanced` (VM). DB: PostgreSQL 16 on OCI VM via tunnel `localhost:5433`.
- **Date wargamed**: 2026-07-06 (recon on repo state at S1016, HEAD `2397eb0a`).
- **Sources of truth to RE-READ at execution start, in this exact order (SoT wins over this plan)**:
  1. `docs/kb/SOT_STATE.md` (expect: F4 HOLD register #24; re-derive migration count / CI job count / test-file count live)
  2. `docs/kb/SOT_BACKLOG.md` (item #24 — confirm still HOLD with reactivation-trigger `{kind: manual}`)
  3. `docs/kb/DEBT_REGISTER.md` (D-51 and D-52 must read RISOLTO; D-12/D-38 doctrine)
  4. `.handoff/STATE.md` (current work state, open questions)
  5. `docs/architecture/adr/0027_two_axis_contextual_authorization.md` §2.3, §2.5, §5
  6. `docs/superpowers/specs/2026-06-30-two-axis-authorization-model-design.md` §2 Pillar 1 + §3 (F4 row) + §4
  7. `apps/api/src/lib/scope/` — all five files (org.ts, resolver.ts, data-classes.ts, gate.ts, audit.ts)
  8. `docs/superpowers/specs/2026-07-01-f3-sensitive-modules-map.md` (historical — module→gate map)

**Binding doctrine (from the mission brief, verbatim obligations)**: migrations twice-run idempotent (**D-12**); varchar+CHECK, never ENUM (**RD-08**); migration asserts scoped to owned codes, never resource-wide counts (**D-38**); tests run under per-file tx isolation (**D-52**, `test/helpers/tx-isolation.ts`); the D-51 boot-gate must be EXTENDED for the functional axis (designed in move C5); full API suite 0 fail; done = typecheck · lint · i18n parity · suite green · CI green · vm-deploy · LIVE verification on www.heuresys.com. **The A-vs-B choice and taxonomy semantics are Enzo's authority — never pre-decide.**

---

## 1. RECON FINDINGS (verified 2026-07-06, read-only)

### Verified facts (evidence: file:line)

| # | Fact | Evidence |
|---|------|----------|
| V1 | F4 is the only remaining phase; F0-F3+F5(org half)+F6+I21 SHIPPED; the cross-tree FUNCTIONAL half of F5 belongs to F4 | `docs/architecture/adr/0027_two_axis_contextual_authorization.md:134` |
| V2 | Activities = Enzo's four: tasks & deadlines, team objectives, operational work indicators, operational approvals — never personal data | ADR-0027 §2.3 (lines 60-65) |
| V3 | Cardinal rule absolute: functional membership NEVER unlocks sensitive data (I18/I20); the axes are independent in BOTH directions | ADR-0027 §2.5 (lines 81-89) |
| V4 | **`sys_process_participants` does NOT exist** — zero migrations, zero code references; it appears ONLY in the design spec (F4 row + Pillar 1 "processes I lead (new membership, Pillar in F4)") | repo-wide grep: the table name appears ONLY at `docs/superpowers/specs/2026-06-30-two-axis-authorization-model-design.md:77` (line 43 carries the Pillar-1 "processes I lead" phrase, not the table string) |
| V5 | Process↔org linkage today is OU-level only: `sys_organization_unit_processes` (RACI roles OWNER/CONTRIBUTOR/CONSULTED/INFORMED), FK → `sys_blueprint_process_registry(blueprint_process_id)` (GLOBAL platform-level catalog, not tenant-scoped) | `db/migrations/000121_organization_unit_processes.sql:26-58` |
| V6 | Team chain exists and is populated: `sys_teams.team_lead_user_id` + `sys_team_members` (role CHECK `LEAD`/`MEMBER`, `team_member_is_active`); 24 teams live | `db/migrations/000054_r1b_teams_and_roles.sql:28-83`; SOT_STATE §0 "24 team" |
| V7 | `lib/scope/` today = ORGANIZATIONAL axis only: `org.ts` (orgSubtreeUserIds/isInOrgSubtree/isOrgUnitManager), `resolver.ts` (resolveOrgReadScope/canReadOrgTarget, HR_MANDATED_ROLES={TENANT_ADMIN,HRMS_MANAGER}, MANAGERIAL_ROLES={MANAGER,CEO}). **No functional.ts, no functionalScopeUserIds anywhere** | `apps/api/src/lib/scope/resolver.ts:26-44`; dir listing (5 files: audit, data-classes, gate, org, resolver) |
| V8 | Taxonomy: `ACTIVITY` exists in the `DataClass` union but **zero resources are mapped to it** — comment says "added at F4 — none mapped yet". Mapping shape = `Record<string, DataClass>`: **exactly one class per RBAC resource** | `apps/api/src/lib/scope/data-classes.ts:20,38,45-70` |
| V9 | `goal` is already mapped **EVALUATION** (sensitive → org axis); goals routes carry `config.orgGate:"service"`; the goals list filter is `goal_subject_user_id = ANY($allow) OR goal_subject_user_id IS NULL` → **subject-less goals are tenant-visible to every goal:read holder today** | `data-classes.ts:65`; `modules/goals/routes.ts:16,22`; `modules/goals/repository.ts:53-57` |
| V10 | `sys_goals` has `goal_subject_user_id`/`goal_owner_user_id` but **NO team or process anchor column**; `goal_type` CHECK includes 'OBJECTIVE','PROJECT',… | `modules/goals/repository.ts:13-23`; `db/migrations/000037:143-148` |
| V11 | `approval` resource is **UNMAPPED** in the taxonomy (RBAC+tenant only); approvals runtime is generic & battle-tested: `sys_approval_requests` polymorphic (`approval_request_resource_type varchar(64)` + resource_id), `sys_approval_steps.approval_step_approver_user_id`, SLA/effects/chains modules exist; `buildScope` = platform/tenant only, no orgGate on routes | `modules/approvals/routes.ts` (no config.orgGate anywhere); `db/migrations/000132:30-141`; `modules/approvals/service.ts:45-48` |
| V12 | **D-51 boot gate covers SENSITIVE resources ONLY**: `isSensitiveReadCode` → `isSensitiveResource`; an ACTIVITY-classified resource would today escape the boot assertion entirely. Gate values closed set {service,catalog,aggregate}; self-verbs and writes exempt; error `ORG_GATE_MISSING` refuses boot | `apps/api/src/lib/scope/gate.ts:74-83,111-123` |
| V13 | `ScopeAxis` audit union has **no "functional" value**: `"platform"|"hr_mandate"|"org_subtree"|"self"|"tenant"|"denied"` | `apps/api/src/lib/scope/audit.ts:17` |
| V14 | Drift test requires **every key of RESOURCE_DATA_CLASS to exist as a live `auth_permission_resource`** — mapping a new resource string before its permission seed is applied to the test DB fails the suite | `apps/api/test/scope-data-classes.integration.test.ts:28-32` |
| V15 | RBAC roles include `TEAM_LEADER` and `PROCESS_OWNER` (12 roles, 156 perms, 698 maps live) | `packages/shared/src/schemas/role-codes.ts:11-24`; SOT_STATE S1016 counts |
| V16 | Permission-seed pattern to mirror: `000142_goals_okrs_permission_seed.sql` — INSERT perms ON CONFLICT DO NOTHING; read audience = {PLATFORM_ADMIN, TENANT_ADMIN, BLUEPRINT_MANAGER, HRMS_MANAGER, PROCESS_OWNER, MANAGER}; write audience = {PLATFORM_ADMIN, TENANT_ADMIN, HRMS_MANAGER}; DO-block assert scoped to owned codes (D-38) | `db/migrations/000142:8-37`; also `000169` (I21 grant pattern) |
| V17 | Migrations: **167 files, max `000169`, gaps at 000035+000139** → next free number 000170 (RE-DERIVE LIVE, see move C0) | `ls db/migrations` + SOT_STATE S1016 |
| V18 | Every new table must self-register in `sys_reconciliation_registry` (0-UNCLASSIFIED invariant); app-authored tables = bucket D / EXCLUDE | `db/migrations/000121:78-88` |
| V19 | Test personas are env-driven (`test/helpers/personas.ts`, F-001 — NEVER hardcode passwords); real personas: paolo.caputo (MANAGER), tommaso.fiore (his report), antonio.parisi (outsider), claudia (disjoint manager), federica.marchetti (TENANT_ADMIN) | design spec §4 matrix; SOT_STATE S1014 |
| V20 | i18n = `apps/web/src/locales/{it,en}/*.json` namespaced files; parity 1745 keys at S1016; CI has an i18n-parity workflow | dir listing; SOT_STATE S1016; `.github/workflows/i18n-parity.yml` |
| V21 | `registerOrgGateAssertion(app)` is wired at `apps/api/src/app.ts:200`, BEFORE module route registration (goals at :422, approvals at :435) — the extension point for the activity gate | `apps/api/src/app.ts:100,200,422,435` |
| V22 | Self-scope perms `goal:read:self` and `approval:read:self` already exist (S1011, /v1/me/*) — I17 floor already covers "my own activities" regardless of route | SOT_STATE §0 (S1011 delta) |
| V23 | 9 workflow files exist in `.github/workflows/` but SOT deltas cite "CI 6/6" (S1014) and "CI 7/7" (S1016) — the effective required set varies by trigger | dir listing; SOT_STATE deltas |

### Assumed (reasonable, but marked)

- A-1 *(assumed)*: `sys_teams` has a tenant FK column (name assumed `team_tenant_id`) — column list at `000054:28-47` was only partially read. Executor: `\d sys.sys_teams` before writing SQL (folded into C0).
- A-2 *(assumed)*: no live rows in any table will be touched by F4 DDL (new table + optional ALTER ADD COLUMN nullable = non-destructive). Verified in principle; re-verify with twice-run + pg_dump diff (V-RUN-1).
- A-3 *(assumed)*: the resource string `activity` is free in RBAC (modules `activity-classifications` exist and may own `activity_classification`-like resources). Settled by RN-6.

---

## 2. RECON NEEDED (exact settling checks)

| ID | Unsettled assumption | The EXACT check that settles it | When |
|----|---------------------|--------------------------------|------|
| **RN-1** | **THE MASTER FORK — route A vs route B** (Enzo's product decision; see §5) | Present Enzo the decision memo produced by move C9 (evidence table §5.3) and receive an explicit "A" or "B". If the kickoff message from Enzo already contains the decision, skip the memo and proceed. | Gate between COMMON MOVES and route moves |
| RN-2 | Member-visibility semantics: does a plain team MEMBER see team-level activity rows (team objectives) and peers' tasks, or only their own? | Same memo as RN-1, question 2. **Default if Enzo answers only A/B**: leader sees all rows of their teams/processes; member sees rows where they are assignee/subject + team-level rows (no assignee) of their own teams; outsiders see nothing. State the default in the memo so silence = consent. | With RN-1 |
| RN-2b | Does `activity:read` extend to `USER` (the role real members hold — TEAM_MEMBER is holderless)? Without it, RN-2's member visibility dies at `requirePermission` with 403 before the functional resolver ever runs | Same memo, question 2b. **Default: YES** — mirror the I17 floor logic (a member must at least see their own team's activity rows), with row-level scope enforced by the functional resolver; flag the grant explicitly in the C2 commit message for Enzo's review. | With RN-1 |
| RN-3 | `sys_process_participants` role vocabulary: LEAD/MEMBER (mirror `sys_team_members`) or RACI (mirror `sys_organization_unit_processes`)? | Same memo, question 3. **Default**: `LEAD`/`MEMBER` — the functional resolver needs a "lead" notion (design spec Pillar 1 "processes I lead"); RACI has no LEAD. | With RN-1 |
| RN-4 | Is UI in scope this session (team-activities page + sidebar entry) or API-only? | Same memo, question 4. **Default: API-only** (deliverable says "i18n it+en for ANY UI" — none ⇒ parity untouched at current count). | With RN-1 |
| RN-5 | Do HR-mandated roles (TENANT_ADMIN, HRMS_MANAGER) get tenant-wide ACTIVITY scope? (spec §2 rule 2 covers sensitive classes only; I21 says HRMS_MANAGER reads ANY business datum) | Same memo, question 5. **Default: HRMS_MANAGER yes** (I21, ADR-0027 §2.7), **TENANT_ADMIN no** (spec §2 Pillar 3 first-match sends ACTIVITY to rule 3, the functional scope; I21 covers HRMS_MANAGER only) — TENANT_ADMIN tenant-wide activity visibility ONLY on Enzo's explicit yes. HRMS_MANAGER's tenant scope recorded as axis `hr_mandate` in the audit. | With RN-1 |
| RN-6 | Resource-name collision: are `activity` and `process_participant` free? | `psql -h localhost -p 5433 … -c "SELECT DISTINCT auth_permission_resource FROM sys.sys_auth_permissions WHERE auth_permission_resource LIKE 'activ%' OR auth_permission_resource LIKE 'process%' ORDER BY 1"` — if `activity` is taken, use `activity_item` consistently everywhere (taxonomy key = RBAC resource, V14). | Move C0 |
| RN-7 | Next free migration numbers | `ls db/migrations/ \| tail -3` on current main. Expected 000170+; if HEAD moved, shift all numbers in this plan accordingly. | Move C0 |
| RN-8 | A real cross-tree pair exists live? (a team lead with an active member OUTSIDE the lead's org subtree — needed for the F5 cross-tree matrix against real data) | SQL: for each team lead, compare member set vs `orgSubtreeUserIds(lead)` (run the CTE from `lib/scope/org.ts:30-48` manually). If NO cross-tree pair exists → tests create their own team+members inside the file transaction (D-52 rolls it back) — that is the expected path, not a failure. | Move C7 |
| RN-9 | Item #24 still HOLD and unclaimed | SoT read order step 2. If status ≠ HOLD or another session started F4 → **ABORT-1**. | Session start |
| RN-10 | Effective CI job count (6 vs 7 vs 9 workflows) | `gh run list --limit 1` after first push (or read the checks on the PR/commit page); the pass criterion is "all required checks green", count re-derived, not hardcoded. | V-RUN-6 |

---

## 3. THE SHAPE OF THE BATTLEFIELD (why the fork wastes no work)

The decisive recon insight: **the fork only concerns the STORAGE layer.** Both routes need identical work at every other layer:

- the same new table `sys_process_participants` (V4),
- the same functional-axis primitives in `lib/scope/` (V7),
- the same `ScopeAxis` audit extension (V13),
- the same boot-gate extension for ACTIVITY (V12),
- the same NEW RBAC resource + permission seed — because in route B the reused `goal` resource CANNOT be re-mapped to ACTIVITY (it is already EVALUATION, one-class-per-resource, V8+V9): route B still exposes activities under a NEW resource/routes reading from the OLD tables,
- the same route surface `/v1/activities/*` + the same scope tests.

Therefore COMMON MOVES C0-C9 are ~70% of the mission and are safe to execute before Enzo decides. Routes A and B differ only in: one migration (new table vs ALTER goals) + the repository SQL behind the same service interface + route-B regression guards on `/v1/goals`.

---

## 4. COMMON MOVES (execute in order; each safe whichever route wins)

Format — **Action** · **Expect** (what you see if it worked) · **Failure → cause → counter-move**.

### C0 — Ground-truth re-derivation (read-only)
**Action**: SoT read order (header). Then live re-derive: `ls db/migrations | tail -3` (RN-7); RN-6 resource-collision query; `\d sys.sys_teams`, `\d sys.sys_team_members`, `\d sys.sys_organization_unit_processes`, `\d sys.sys_goals`, `\d sys.sys_approval_requests` via psql on `localhost:5433`; confirm tunnel alive (`pg_isready -h localhost -p 5433`). Capture the deployed API path prefix (nginx mapping) from `deploy/` or the status-dashboard script — it drives the V-RUN-7/8 probes. Capture whether the kickoff message grants push authorization; if not, C8 stops at local commits and asks Enzo before pushing (project rule: push authorization is per-session, resets to "ask" on a new session).
**Expect**: #24 HOLD confirmed; max migration 000169 (or noted shift); `activity`+`process_participant` free (or renamed per RN-6); column names captured (incl. the real tenant column of sys_teams, A-1).
**Failure**: tunnel down (`pg_isready` no response) → cause: SSH tunnel not started → counter-move: start the tunnel per the project's session-start procedure (`session-start.md` GATE 0-1); do NOT invent connection params (they are in the project CLAUDE.md / .env). If SoT contradicts this plan → SoT wins; if the contradiction is material (F4 started, schema moved) → **ABORT-1**.

### C1 — Migration `000170_process_participants.sql` (user↔process membership)
**Action**: create the table mirroring 000121 conventions exactly (V5, V18):
```sql
CREATE TABLE IF NOT EXISTS sys.sys_process_participants (
  process_participant_id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  process_participant_tenant_id            uuid        NOT NULL,   -- FK sys_tenancies ON DELETE CASCADE
  process_participant_user_id              uuid        NOT NULL,   -- FK sys_users ON DELETE CASCADE
  process_participant_blueprint_process_id uuid        NOT NULL,   -- FK sys_blueprint_process_registry ON DELETE CASCADE
  process_participant_role                 varchar(16) NOT NULL DEFAULT 'MEMBER',  -- CHECK ('LEAD','MEMBER')  [RN-3 default]
  process_participant_is_active            boolean     NOT NULL DEFAULT true,
  process_participant_metadata             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```
Plus, all guarded (IF NOT EXISTS / pg_constraint lookups, mirroring 000121): role CHECK per RN-3; `updated_at >= created_at` CHECK; the 3 FKs; UNIQUE (process_id, user_id); indexes on tenant / user+is_active / process; `sys_set_updated_at` trigger; `sys_reconciliation_registry` INSERT bucket D / EXCLUDE with rationale "[sign-off: EXCLUDE — app-authored user↔process membership (F4 ADR-0027, mig 000170)…]" (V18). MANDATORY PAIRED EDIT (same commit): `apps/api/test/reconciliation-registry.integration.test.ts` hardcodes the bucket split at line 59 (`{ A: 27, B: 16, C: 23, D: 49 }`, 115 rows, title at line 10). Bump `D` by +1 (and the title's total by +1) and append a comment line to the trail following the file's ritual: `+1 bucket-D EXCLUDE — F4 ADR-0027 sys_process_participants (app-authored user↔process membership, mig 000170)`. This is the established pattern (see the S990 absorption note at lines 39-41 — a prior session forgot it and left the suite red). No data seed — the table legitimately starts EMPTY.
**Expect**: `bash scripts/…/migrate.sh` (use the project's canonical migrate entrypoint found in C0) applies it; second run = no-op; `\d sys.sys_process_participants` shows the shape.
**Failure**: FK to `sys_blueprint_process_registry` fails → cause: wrong PK column name guessed → counter-move: `\d sys.sys_blueprint_process_registry` and use the real PK (recon says `blueprint_process_id`, 000121:58). Twice-run diff non-empty → cause: an unguarded statement → counter-move: guard it (D-12), re-run. Full suite red on `reconciliation-registry` "registry holds exactly N rows" → cause: the MANDATORY PAIRED EDIT above was skipped → counter-move: apply it; this is NOT ABORT-5.

### C2 — Migration `000171_f4_activity_permission_seed.sql`
**Action**: mirror 000142 (V16). Seed `activity:{read,create,update,delete}` + `process_participant:{read,create,delete}` (resource strings per RN-6). Read audience: 000142's six roles **plus `TEAM_LEADER` plus `USER`** (TEAM_LEADER exists, V15, and F4 is precisely its purpose; USER per RN-2b default — real team members hold USER, TEAM_MEMBER is holderless, and without the grant RN-2's member visibility dies at `requirePermission` with 403 before the resolver runs — flag BOTH additions explicitly in the commit message for Enzo's review). Write audience: {PLATFORM_ADMIN, TENANT_ADMIN, HRMS_MANAGER} + `activity:{create,update}` also to {MANAGER, TEAM_LEADER, PROCESS_OWNER} (leads "manage, assign" — ADR §2.3). DO-block assert counts ONLY the codes this migration owns (D-38 — never `WHERE resource='activity'` count).
**Expect**: migrate twice-run clean; `SELECT count(*) FROM sys.sys_auth_permissions WHERE auth_permission_code LIKE 'activity:%'` = 4; role-permission map grew by the exact expected grants.
**Failure**: assert fires on re-run → cause: D-38 violation (resource-wide count) → counter-move: scope to owned codes. Role code typo → cause: not re-deriving from `role-codes.ts` → counter-move: copy the literal strings from `packages/shared/src/schemas/role-codes.ts`.

### C3 — `lib/scope/functional.ts` (the functional chain as query primitives)
**Action**: new file mirroring `org.ts` style, exporting:
- `functionalScopeUserIds(q, actorUserId): Promise<string[]>` — UNION of (a) active members of teams the actor leads (`sys_teams.team_lead_user_id = $1` **OR** an active `sys_team_members` row with role `LEAD` — union both signals, they coexist per V6), (b) active participants of processes where the actor has a `sys_process_participants` row with role `LEAD`, (c) `SELECT $1::uuid` (self always).
- `isInFunctionalScope(q, actorUserId, targetUserId): Promise<boolean>` — EXISTS form (mirror `isInOrgSubtree`).
- `functionalMembershipUserIds(q, actorUserId)` — teams/processes the actor MERELY BELONGS to (for RN-2 member semantics).
- `ledAnchorIds(q, actorUserId): Promise<{teamIds: string[]; processIds: string[]}>` — teams via `team_lead_user_id=$1` UNION active `team_member_role='LEAD'` rows; processes via `sys_process_participants` role LEAD. And `memberAnchorIds(q, actorUserId)` — same shape, MEMBER rows. (These feed the A2/B3 repository SQL filters, which are keyed on ANCHOR IDs, not user ids — the user-id exports above cannot serve them.)
Tenant safety: every join constrained to the actor's rows' tenant columns (no cross-tenant bleed) — same discipline as org.ts (tenant filtering also happens at service level per I5).
**Expect**: `pnpm --filter @heuresys/api typecheck` green; unit-level sanity via psql: running the SQL by hand for a known team lead returns that team's member ids + self.
**Failure**: column-name drift (e.g. tenant column of sys_teams) → cause: A-1 assumption → counter-move: the C0 `\d` output is authoritative; fix and re-run typecheck.

### C4 — Resolver + audit extension
**Action**:
- `audit.ts:17` — extend `ScopeAxis` with `"functional"` (V13).
- `resolver.ts` — add `resolveFunctionalReadScope(q, actor): Promise<FunctionalReadScope>` and `canReadFunctionalTarget(q, actor, targetUserId, targetTenantId)`. `FunctionalReadScope = { kind: "all" } | { kind: "tenant"; tenantId } | { kind: "anchored"; tenantId; teamIds: string[]; processIds: string[]; userIdAllowList: string[] } | { kind: "self"; tenantId; userIdAllowList: string[] }` — the anchored variant carries BOTH the anchor-id lists (for the A2/B3 SQL filters, fed by C3's `ledAnchorIds`/`memberAnchorIds`) and the user allow-list (for per-target checks). Rules, first match (design spec §2 Pillar 3 + RN-5 default): PLATFORM_ADMIN → all (axis `platform`); no tenant → Forbidden; **HRMS_MANAGER** → tenant (axis `hr_mandate`, RN-5 default — TENANT_ADMIN gets tenant-wide ONLY on Enzo's explicit yes, otherwise falls through to the anchored scope); else anchored: anchor-id lists + allowList = `functionalScopeUserIds` (+ member semantics per RN-2 default) (axis `functional`); self always included (axis `self`). Both record via `recordScopeAccess` (F6 parity).
- Do NOT touch `resolveOrgReadScope`/`canReadOrgTarget` — the org axis is shipped and frozen.
**Expect**: typecheck green; existing suite untouched (baseline 186 passed + 2 skipped files at S1015 per DEBT_REGISTER D-52 — re-derive; nothing imports the new symbols yet).
**Failure**: TS union exhaustiveness breaks an existing switch on `ScopeAxis` → cause: some consumer switches exhaustively → counter-move: grep `ScopeAxis` consumers (`scope-audit.integration.test.ts` asserts axes) and extend them.

### C5 — Boot-gate extension (D-51 → functional axis) — THE DESIGNED EXTENSION THE BRIEF DEMANDS
**Action**: extend `lib/scope/gate.ts` so the taxonomy stays prescriptive for the NEW class:
- `data-classes.ts`: add `isActivityResource(resource)` helper (class === "ACTIVITY").
- `gate.ts`: generalize `isSensitiveReadCode` into a classifier returning `{resource, kind: "sensitive"|"activity"}` (self-verbs and write-verbs stay exempt, same READ_VERBS). Sensitive → existing `config.orgGate` assertion, error `ORG_GATE_MISSING` (unchanged, byte-for-byte behavior). ACTIVITY → NEW `config.activityGate` declaration, closed set `"service" | "catalog" | "aggregate"`, collected into `stats.activityReadRoutes` / `stats.activityViolations`, boot error `ACTIVITY_GATE_MISSING` with the same fix-hint format.
- `declare module "fastify"`: add `activityGate?: ActivityGateDeclaration` beside `orgGate`.
- Rationale to record in the file header: a separate key (not a new `orgGate` value like `"functional"`) keeps the sensitive surface auditable in isolation — `orgGate` continues to mean exactly "org-axis handled", so D-51's 76 annotated routes and their review semantics are untouched.
- Extend `apps/api/test/org-gate.integration.test.ts` (4 tests) with the activity mirror: real app boots with 0 activity violations; a synthetic ACTIVITY read route without the declaration refuses boot; with it, boots; self/write/unclassified exempt.
**Expect**: suite file `org-gate.integration.test.ts` green (now ~7-8 tests); full app boots unchanged (no ACTIVITY resources mapped yet at this commit — the gate is armed but sees an empty set).
**Failure**: boot fails at this commit with `ACTIVITY_GATE_MISSING` → cause: something already maps to ACTIVITY (should be impossible, V8) → counter-move: read the error's route list — if non-empty, taxonomy was edited out of order; revert to plan order (taxonomy mapping happens in C6/route moves, AFTER routes exist annotated).

### C6 — Taxonomy extension + `sys_process_participants` exposure (module)
**Action** (two parts, one commit):
1. `data-classes.ts`: map `process_participant: "ACTIVITY"` and `activity: "ACTIVITY"` (names per RN-6) in `RESOURCE_DATA_CLASS`, with a dated comment (F4). **Ordering trap (see RED-TEAM §9): migrations C1+C2 MUST already be applied to the live VM DB before any test run after this edit** — the drift test (V14) checks the mapping against live `sys_auth_permissions`.
2. New module `apps/api/src/modules/process-participants/` (repository/service/routes, mirror the teams module style): `GET /v1/process-participants` (list, filter by processId/userId) + `GET /v1/process-participants/:id`, `requirePermission("process_participant:read")`, `config: { activityGate: "service" }`, service scoping via `resolveFunctionalReadScope` (leads see their processes' rows; HRMS_MANAGER tenant per RN-5 default — NOT TENANT_ADMIN unless Enzo's explicit yes; member sees own rows). Admin writes `POST`/`DELETE` with `process_participant:{create,delete}` + `app.verifyCsrf` (write pattern = goals routes V9). Zod schemas in `packages/shared` (mirror `schemas/teams.ts`). Register in `app.ts` after line 435 block, prefix `/v1/process-participants`.
**Expect**: app boots (routes annotated → gate satisfied); typecheck+lint green; drift test green AGAINST THE MIGRATED DB; new module listable via local smoke (`curl` 401 unauthenticated).
**Failure A**: boot `ACTIVITY_GATE_MISSING` listing the new routes → cause: missing `config.activityGate` on a read route → counter-move: annotate it (this failure PROVES C5 works — expected in the negative test only).
**Failure B**: drift test red `classified resource not present in DB: activity` → cause: C2 not applied to the DB the suite points at → counter-move: run migrate against the tunnel DB, re-run.

### C7 — Functional-axis scope tests (the cross-tree half of F5) — written BEFORE route storage
**Action**: new `apps/api/test/scope-functional.integration.test.ts` (+ later `activities-scope.integration.test.ts` in route moves). Under D-52 per-file tx isolation: create inside the file a synthetic team (lead = a real cross-tree persona pair per RN-8, else freshly-seeded users), team members, and `sys_process_participants` rows (LEAD + MEMBER) — all rolled back at file end. Assert with LIVE-DERIVED expectations (no hardcoded id lists):
1. `functionalScopeUserIds(lead)` = created members + self.
2. Cross-tree: lead NOT org-ancestor of member (verify via `isInOrgSubtree` = false) yet `isInFunctionalScope` = true → **ACTIVITY yes**.
3. Cardinal rule both directions: same lead+member, `canReadOrgTarget` = **false** (functional never unlocks sensitive, I18); and an org MANAGER who is NOT lead/participant gets `isInFunctionalScope`=false over their org report (org never unlocks functional) — axis independence proven bidirectionally.
4. HR-mandate: an HRMS_MANAGER actor (synthetic ActorContext — C7 exercises the resolver primitives directly) → tenant scope (axis `hr_mandate`); federica.marchetti (TENANT_ADMIN) → NOT tenant-wide, falls to the anchored/functional scope (RN-5 default — flips only on Enzo's explicit yes).
5. Non-lead member → self(+RN-2 default set) only.
6. Audit: `enableScopeAuditCapture()` → axes recorded include `"functional"`.
Passwords/personas via `test/helpers/personas.ts` only (V19 — R11: never literal).
**Expect**: file green in isolation (`pnpm vitest run test/scope-functional…`) AND inside the full suite; DB row counts unchanged after run (tx rollback — spot-check `SELECT count(*) FROM sys.sys_process_participants` = 0 before/after).
**Failure**: FK violation creating fixtures → cause: fixture order (process registry row must exist; use an EXISTING blueprint_process_id selected live) → counter-move: `SELECT blueprint_process_id FROM sys.sys_blueprint_process_registry LIMIT 1` inside the fixture instead of inventing one.

### C8 — Commit checkpoint α (the no-waste line)
**Action**: commit C1-C7 as 2-3 logical commits (migrations · scope-lib+gate · module+tests), push, wait CI.
**Expect**: CI all-green (job count per RN-10). Nothing in these commits depends on A-vs-B.
**Failure**: CI i18n-parity red → cause: accidental locale edit (none planned API-only) → counter-move: revert stray locale change. Any other red → fix ALL (R3 doctrine), never skip.

### C9 — THE DECISION MEMO (turns the HOLD into the fork trigger)
**Action**: write `cowork_code_exchange/` (or the session-artifacts dir per project CLAUDE.md) memo for Enzo: the §5.3 evidence table verbatim + questions RN-2..RN-5 (incl. RN-2b) with the stated defaults, plus **question 6** (route-B only): the `/me` surface for anchored rows — the two admissible shapes and the zero-touch default are spelled out in B5 case 4. Deliver and **STOP route work** until RN-1 answered. (If the kickoff prompt already contained the decision: log that as the trigger evidence and proceed immediately.)
**Expect**: an explicit "A" or "B" from Enzo.
**Failure**: no answer in-session → this is NOT an abort: checkpoint α is shipped, mission pauses cleanly at the fork with zero wasted work; report status (analysis-paralysis rule: never improvise the product decision).

---

## 5. THE MASTER FORK — route A vs route B

### 5.1 Trigger
**Enzo's explicit decision (RN-1) — and nothing else.** Observable forms, in precedence order: (1) an "A" or "B" in the kickoff prompt; (2) his reply to the C9 memo; (3) an updated `SOT_BACKLOG.md` #24 entry naming the entities (`decided-by: Enzo`). If none observed → stop at checkpoint α. The executor NEVER infers the choice from technical evidence; the evidence below only INFORMS Enzo.

### 5.2 What each route is
- **ROUTE A — generic task model**: one new table `sys_activities` (kind CHECK 'TASK','OBJECTIVE','KPI','APPROVAL_REF') anchored to team/process; `/v1/activities/*` reads it. Approvals-kind rows LINK to the existing approval runtime (polymorphic `resource_type='ACTIVITY'`) rather than duplicating steps/SLA — the runtime is infrastructure, using it is not "route B".
- **ROUTE B — reuse goals/approvals as carriers**: `sys_goals` gains nullable `goal_team_id`/`goal_process_id` anchors → anchored rows ARE the tasks/objectives; operational approvals = existing `sys_approval_requests` filtered by activity resource_types; `/v1/activities/*` is a functional-scoped projection over both. `/v1/goals` (org axis) must then EXCLUDE anchored rows (FORK-B1).

### 5.3 Technical evidence for Enzo (honest, from recon — the cost/risk/fit table)

| Criterion | ROUTE A (new `sys_activities`) | ROUTE B (reuse goals + approvals) |
|---|---|---|
| New DDL | 1 new table (mirror 000121 conventions) — non-destructive | 2 nullable columns + 2 FKs + indexes ON THE HOT `sys_goals` table (632 backfilled rows, /me/career depends on it — S1011) — still non-destructive, but on shipped surface |
| Taxonomy fit | Clean: `activity` → ACTIVITY, one-class-per-resource invariant intact (V8) | **`goal` stays EVALUATION — it CANNOT also be ACTIVITY** (V8/V9). B still needs the new `activity` resource + routes; reuse saves only the storage, not the authz layer |
| Regression surface | Zero on shipped modules — goals/approvals untouched | Real: `/v1/goals` list filter change (exclude anchored rows) touches goals.integration + goals-scope + /me/career flows (3+ test files); approvals projection must not disturb `/v1/approvals` semantics (V11: today unmapped/tenant-wide — leave it untouched, expose activity-approvals only via the projection) |
| Leak risk if done wrong | Contained in new module | **Subject-less goals are ALREADY tenant-visible (V9)**; anchored team rows would inherit that tenant-wide visibility via legacy `/v1/goals` unless the exclusion filter ships in the SAME migration+commit — a forgotten filter = activity rows readable outside the functional scope |
| Code volume | Higher: full repo/service/schema for a new entity (~ mirrors goals module, V9/V10 as template) | Lower on storage; HIGHER on guards: exclusion filter + dual-read tests + approvals projection |
| Domain fit (Enzo's four) | Tasks & deadlines native; objectives/KPIs as kinds; approvals via runtime link | Objectives native (goals ARE objectives, goal_type 'OBJECTIVE'/'PROJECT' V10); tasks = stretched goal semantics (no assignee-vs-subject distinction; `goal_subject_user_id` means "person evaluated" in EVALUATION reads — semantic overload); approvals native (runtime battle-tested: steps/SLA/effects V11) |
| Future debt | Possible duplication: activities-as-objectives vs sys_goals OBJECTIVE rows (two homes for similar data) | Coupling: activity domain permanently rides an EVALUATION-classified table; every future goals change must consider both axes |
| Reversibility | High — drop table, drop module | Medium — anchored rows would need data migration out of sys_goals |

### 5.4 Post-fork convergence
Whichever route: same `/v1/activities` service interface (defined in common code shape at C6-style), same tests (C7 + `activities-scope`), same verification runs. Only the repository SQL + one migration differ.

---

## 6. ROUTE A MOVES (trigger: Enzo says "A")

### A1 — Migration `000172_sys_activities.sql`
**Action**: new table, 000121 conventions (guarded DDL, trigger, recon-registry bucket D EXCLUDE):
`activity_id` PK · `activity_tenant_id` FK NOT NULL · `activity_team_id` uuid NULL FK sys_teams · `activity_blueprint_process_id` uuid NULL FK registry · CHECK (team_id IS NOT NULL OR blueprint_process_id IS NOT NULL) — an activity is ALWAYS anchored (that is what makes it functional-axis, never personal) · `activity_kind` varchar(16) CHECK ('TASK','OBJECTIVE','KPI') · `activity_title`/`_description` · `activity_assignee_user_id` uuid NULL FK sys_users · `activity_status` varchar(16) CHECK ('OPEN','IN_PROGRESS','DONE','CANCELLED') DEFAULT 'OPEN' · `activity_priority` CHECK ('LOW','MEDIUM','HIGH','CRITICAL') DEFAULT 'MEDIUM' · `activity_due_date` date NULL · `activity_progress_percent` int CHECK 0-100 DEFAULT 0 · `activity_natural_key` unique per tenant · metadata jsonb · timestamps+trigger. Operational-approvals kind is NOT a row kind: approvals ride the runtime (A4). Indexes: tenant, team, process, assignee+status, due_date. MANDATORY PAIRED EDIT (same commit, second +1): the recon-registry INSERT for `sys_activities` bumps `apps/api/test/reconciliation-registry.integration.test.ts` AGAIN — `D` +1 and the title total +1 on top of C1's edit (C1 made it D:50/116; A1 makes it D:51/117), plus a comment line in the file's ritual trail for `sys_activities`.
**Expect**: twice-run clean; `\d` matches.
**Failure**: CHECK anchor rejected by an idempotent re-run pattern → cause: unguarded ADD CONSTRAINT → counter-move: pg_constraint guard (D-12).

### A2 — Shared schemas + repository/service/routes `/v1/activities`
**Action**: `packages/shared/src/schemas/activities.ts` (Zod: Activity, ListQuery with teamId/processId/kind/status/assigneeUserId filters, Create/Update bodies) exported from the shared index. Module `apps/api/src/modules/activities/`: repository = parameterized SQL over `sys.sys_activities` (mirror goals/repository.ts shape V9, incl. `userIdAllowList`-style filter BUT keyed on the FUNCTIONAL anchor: `activity_team_id = ANY(teams actor leads/belongs)` OR `activity_blueprint_process_id = ANY(...)` OR `activity_assignee_user_id = actor` — the anchor-id lists and user allow-set come from the resolver's anchored `FunctionalReadScope` variant (`teamIds`/`processIds`/`userIdAllowList`, C4), populated via C3's `ledAnchorIds`/`memberAnchorIds` per RN-2 semantics). Service: `resolveFunctionalReadScope` for lists, `isInFunctionalScope`/anchor-membership for `GET /:id`; creates/updates restricted to leads of the target anchor (+HR-mandate/admin). Routes: reads `requirePermission("activity:read")` + `config: { activityGate: "service" }`; writes CSRF + `activity:{create,update,delete}` (goals routes pattern V9). Register in app.ts.
**Expect**: boot green (gate satisfied); typecheck/lint green; smoke: lead lists own team's rows; outsider WITH activity:read (e.g. USER in another team, RN-2b) gets an EMPTY LIST — the resolver, not RBAC, produces the emptiness; member sees per RN-2 default.
**Failure**: gate refuses boot listing `/v1/activities` reads → cause: annotation missed → counter-move: add `activityGate`. Scope leak in list (outsider sees rows) → cause: repo filter ORs wrongly (the classic `OR IS NULL` trap from goals V9 must NOT be replicated — anchors are NOT NULL by CHECK) → counter-move: assert filter has no IS NULL branch; add the failing case to tests first.

### A3 — `activities-scope.integration.test.ts`
**Action**: mirror C7 harness: in-file fixtures (team, process, participants, activities per kind), live-derived expectations. Matrix: lead reads member's task ✅ · cross-tree lead reads member task ✅ while same pair sensitive (e.g. `GET /v1/users/:id` or compensation) ❌ (403/404/empty) · outsider (USER role, holds activity:read per RN-2b) ❌ = EMPTY LIST from the resolver, not 403 · member (USER role) per RN-2 · HRMS_MANAGER tenant ✅ while TENANT_ADMIN NOT tenant-wide (RN-5 default) · axis audit records `functional`. Also the negative-direction case: org MANAGER (paolo) over his report's team activities where paolo is NOT lead → ❌.
**Expect**: file green; full suite green.
**Failure**: flaky due to shared-DB parallel state → cause: fixture ids colliding with live data in filters → counter-move: filter assertions by the fixture's own natural keys/ids, never by global counts (project doctrine: owned codes).

### A4 — Operational approvals linkage (read projection)
**Action**: `GET /v1/activities/approvals` — list `sys_approval_requests` WHERE `approval_request_resource_type = 'ACTIVITY'` AND resource_id ∈ activities in the actor's functional scope (JOIN sys_activities). Read-only; `/v1/approvals` module UNTOUCHED (V11 — zero regression). Creating an approval for an activity uses the EXISTING `POST /v1/approvals` with resourceType 'ACTIVITY' (document in module README/comment; optionally extend the 000132 notification resource-type CHECK ONLY if a live check shows 'ACTIVITY' missing from `sys_inbox_notification_resource_type_check` — settle: `\d+` the constraint; if extension needed it goes in migration A1, guarded DROP/ADD like `000132_approval_runtime.sql:171-174`).
**Expect**: projection returns only in-scope approval rows; approvals suite files (3, V-list) still green.
**Failure**: notification CHECK rejects 'ACTIVITY' on live approval creation → cause: closed CHECK from 000132 → counter-move: the guarded constraint extension above (re-run migrate, twice-run verify).

### A5 — (Only if RN-4 = UI) minimal web surface
**Action**: page `apps/web/src/app/(authenticated)/…/activities` (list by my teams; mirror an existing table page), i18n namespace `activities.json` in BOTH `locales/it` and `locales/en` (parity!), sidebar entry via a `sys_ui_interfaces` migration mirroring 000163 (5-sections taxonomy — section: "Forza lavoro" default, confirm with Enzo in RN-4 answer). E2E smoke optional.
**Expect**: i18n-parity CI green with the SAME key count both locales; page renders for a lead persona.
**Failure**: parity red → cause: key drift it/en → counter-move: diff the two json files, align.

### A6 — Route-A verification & ship
**Action**: run V-RUNS 1-8 (§8), commit, push, CI, `vm-deploy.sh`, live checks.
**Expect / Failure**: per §8.

---

## 7. ROUTE B MOVES (trigger: Enzo says "B") — comparable depth

### B1 — Migration `000172_goals_activity_anchors.sql`
**Action**: guarded `ALTER TABLE sys.sys_goals ADD COLUMN IF NOT EXISTS goal_team_id uuid NULL` + `goal_blueprint_process_id uuid NULL`; guarded FKs (sys_teams / registry, ON DELETE SET NULL — an activity must survive team deletion as tenant history? NO: default **ON DELETE CASCADE** to mirror membership tables; flag the choice in the migration header for review); partial indexes `WHERE goal_team_id IS NOT NULL` / process; CHECK: `(goal_team_id IS NULL AND goal_blueprint_process_id IS NULL) OR goal_subject_user_id IS NULL` — an anchored row is an ACTIVITY carrier and must NOT double as a personal EVALUATION row (this single CHECK is what keeps the two axes disjoint at the data level; without it a row could be both). No backfill — all 632+ existing rows stay unanchored (pure EVALUATION), zero behavior change at DDL time.
**Expect**: twice-run clean; existing goals suites still green (columns nullable, unread).
**Failure**: CHECK violates an existing row → cause: impossible by construction (all existing rows have NULL anchors) — if it fires anyway, live data drifted from SoT → **ABORT-4**.

### B2 — The `/v1/goals` exclusion guard (ships in the SAME commit as B3 — never alone, never later)
**Action**: `modules/goals/repository.ts` listGoals: add `AND goal_team_id IS NULL AND goal_blueprint_process_id IS NULL` to the base WHERE (org-axis surface serves ONLY unanchored rows); `findGoalById`/update/delete path: if the row is anchored → treat as not-found on `/v1/goals` (it lives on `/v1/activities` now). For `/v1/me` goals self-reads: NO edit under the B5 case-4 default — they select by `goal_subject_user_id` (`me/repository.ts:453,566`) and B1 forces anchored ⇒ subject NULL, so anchored rows are structurally excluded there already; touch them ONLY if Enzo picks the case-4 alternative (memo question 6). Still grep `sys_goals` under `modules/me/` (C0 captured the list) to confirm no other read path exists.
**Expect**: goals.integration + goals-scope + me-career tests green UNCHANGED (they only ever created unanchored rows); a new test proves an anchored row is invisible via `/v1/goals` and visible via `/v1/activities`.
**Failure**: an existing test red → cause: a fixture or live-derived expectation counted anchored rows (impossible pre-B3 — none exist) OR the me-module has a second SELECT path missed → counter-move: grep ALL `FROM sys.sys_goals` occurrences (`rg "sys_goals" apps/api/src`) and apply the exclusion to every non-activity read path; fix all (R3).

### B3 — `/v1/activities` module over reused storage
**Action**: same shared schemas + module shape as A2, but repository reads `sys.sys_goals WHERE (goal_team_id IS NOT NULL OR goal_blueprint_process_id IS NOT NULL)` mapping goal_type→kind ('PROJECT'/'OBJECTIVE'→'OBJECTIVE', others→'TASK' presentation; kind filter maps accordingly) and `goal_owner_user_id` as assignee surrogate (document the mapping in the module header — this is the semantic-overload cost from §5.3, made explicit). Functional scoping identical to A2 (resolver + anchor membership). Writes: `POST /v1/activities` INSERTs into sys_goals WITH anchor set and `goal_subject_user_id` FORCED NULL (B1 CHECK enforces it — belt and braces). Routes annotated `activityGate: "service"`, resource `activity` (the NEW resource — `goal` perms are NOT reused for the activity surface, per V8/V9).
**Expect**: boot green; anchored rows flow only through `/v1/activities` under functional scope; `/v1/goals` untouched for unanchored rows (B2 proof).
**Failure**: taxonomy temptation — someone maps `goal`→ACTIVITY "for consistency" → cause: misreading of reuse → counter-move: FORBIDDEN — it flips 2 org-gated routes + drift/gate semantics of an EVALUATION resource; `goal` stays EVALUATION (V9), only `activity` maps to ACTIVITY. This is pinned by keeping the data-classes.ts diff limited to the two new keys from C6.

### B4 — Operational approvals projection
**Action**: identical to A4 (the approval runtime is shared infrastructure in both routes): `GET /v1/activities/approvals` over `sys_approval_requests` with resource_type 'ACTIVITY' — in route B resource_id points at the anchored sys_goals row id. Same notification-CHECK settling check as A4.
**Expect / Failure**: as A4.

### B5 — `activities-scope.integration.test.ts` (route-B flavor)
**Action**: same matrix as A3 PLUS the B-specific regression cases: (1) anchored row invisible on `/v1/goals` to its own creator via org axis; (2) unanchored personal goal invisible on `/v1/activities` even to the team lead of its subject (axis separation at the storage level); (3) paolo (MANAGER, org axis) cannot read his report's TEAM activities via `/v1/activities` unless lead (cardinal-rule mirror); (4) the `/v1/me` surface for anchored rows — case 4 has two admissible shapes; put the choice in the C9 memo as question 6. **Default (zero-touch)**: `/me` goals show UNANCHORED items only (they select by `goal_subject_user_id`, and B1 forces anchored ⇒ subject NULL — verified `me/repository.ts:453,566`); the user's own anchored activities are served by `/v1/activities` filtered on assignee=self (I17 satisfied across the two surfaces, not on one). The test asserts exactly that split. **Alternative (only if Enzo asks for /me to show both)**: extend the two `/me` queries with `OR (goal_owner_user_id = $1 AND (goal_team_id IS NOT NULL OR goal_blueprint_process_id IS NOT NULL))` and add the anchored/unanchored marker to the response shape.
**Expect**: file green; goals/me suites green; full suite 0 fail.
**Failure**: case 4 red under the zero-touch default → cause: the test asserted /me shows anchored rows (the retired expectation — structurally impossible given B1's CHECK + subject-based /me selects) → counter-move: assert the split surfaces per the case-4 default; switch to the alternative shape ONLY on Enzo's explicit answer to memo question 6 — never improvise the /me widening.

### B6 — (Only if RN-4 = UI) minimal web surface — identical to A5.

### B7 — Route-B verification & ship — run V-RUNS 1-8 (§8) with the B-specific pass additions (B2/B5 cases).

---

## 8. VERIFICATION RUNS (executor performs ALL, in this order; pass criteria explicit)

| # | Run (when) | Command / probe | PASS looks like |
|---|-----------|-----------------|-----------------|
| V-RUN-1 | After each migration (C1, C2, A1/B1) | project migrate entrypoint twice + `pg_dump --schema-only` diff between runs | 2nd run exit 0, no errors, empty schema diff (D-12); migration NOTICEs report expected owned-code counts (D-38) |
| V-RUN-2 | After C5 and after A2/B3 | boot the API locally (`pnpm --filter @heuresys/api dev` or the test buildApp) | boots clean; `orgGateStats` violations = 0 AND activity violations = 0; the NEGATIVE test (unannotated synthetic route) throws `ACTIVITY_GATE_MISSING` |
| V-RUN-3 | Before every commit | `pnpm typecheck` (src+test) + `pnpm lint` | exit 0, zero errors — fix ALL, including any pre-existing that appear (R3) |
| V-RUN-4 | After C7 and after A3/B5 | targeted: `pnpm vitest run <new files>`; then FULL API suite | new files 100% pass; full suite **0 fail** (baseline 186 passed + 2 skipped files at S1015 per DEBT_REGISTER D-52; count re-derived, the 2 pre-existing skips tolerated); `SELECT count(*) FROM sys.sys_process_participants` identical before/after (D-52 rollback proof) |
| V-RUN-5 | If UI (RN-4) | the repo's i18n-parity script (same as CI workflow) | it/en key counts EQUAL; if API-only: parity count UNCHANGED from baseline |
| V-RUN-6 | After each push | CI on the commit (`gh run list`/checks page) | ALL required checks green (count per RN-10) — a single red = stop and fix before proceeding |
| V-RUN-7 | Ship | `vm-deploy.sh` (the entrypoint per SOT S1001) then `curl -s https://www.heuresys.com/api/readyz` (or the deployed API path prefix captured in C0 — the project's dashboard doctrine probes `/api/readyz`) | deploy exit 0; readyz 200; API process restarted on new HEAD |
| V-RUN-8 | LIVE verification (final) | (a) `curl -si https://www.heuresys.com/api/v1/activities` (or the deployed API path prefix found in C0) unauthenticated; (b) authenticated spot-check with a lead persona (credentials via `.secrets/` per F-001 — NEVER echoed into logs, R11); (c) `GET /v1/process-participants` same pattern | (a) **401** (= route deployed & guarded); (b) 200 with only in-scope rows for the lead, empty/403 for an outsider persona; (c) 401→200 pattern likewise. Record verified-by: command + status + timestamp in the session report |

---

## 9. OTHER FORKS (trigger → route)

| Fork | Trigger (observable) | Route |
|------|---------------------|-------|
| FORK-1 (RN-3) | Enzo's memo answer names RACI | participant role CHECK becomes ('OWNER','CONTRIBUTOR','CONSULTED','INFORMED'); functional resolver treats **OWNER** as lead-equivalent; everything else unchanged. Silence → LEAD/MEMBER default |
| FORK-2 (RN-4) | Kickoff/memo says "UI in scope" | execute A5/B6 + sidebar migration; else skip, parity untouched |
| FORK-3 (RN-6) | Collision query returns `activity` taken | rename to `activity_item` in: perms seed C2, taxonomy C6, requirePermission strings, permission codes — grep-verify one name everywhere before commit |
| FORK-4 (RN-7) | `ls db/migrations | tail` shows > 000169 | shift all plan numbers to next-free, keeping the order (participants → perms → storage) |
| FORK-5 (RN-8) | No live cross-tree lead/member pair exists | tests build their own inside the file tx (already the C7 default harness) — do NOT mutate live team data to manufacture one |
| FORK-6 | `sys_teams.team_lead_user_id` and `team_member_role='LEAD'` disagree for a team (both signals exist, V6) | resolver takes the UNION of both signals (already designed in C3) — no executor judgment needed |
| FORK-7 (B only) | Enzo's answer to memo question 6 (the /me surface for anchored rows — B5 case 4) | Default/silence: **zero-touch** — /me shows unanchored only (B1's CHECK + the subject-based /me selects, `me/repository.ts:453,566`, exclude anchored rows by construction); the user's own anchored items live on `/v1/activities` assignee=self. Explicit "show both": extend the two /me queries per the B5 case-4 alternative |
| FORK-8 (A4/B4) | `sys_inbox_notification_resource_type_check` lacks 'ACTIVITY' (`\d+` shows the CHECK) | extend it in the storage migration with guarded DROP/ADD (`000132_approval_runtime.sql:171-174` pattern); else no-op |

---

## 10. ABORT CONDITIONS (stop, report to Enzo, do NOT improvise)

- **ABORT-1**: SoT re-read (RN-9) shows #24 not HOLD, re-scoped, or F4 already in progress by another session → the battlefield moved; this plan is stale.
- **ABORT-2**: No Enzo decision materializes for RN-1 → stop AT checkpoint α (C8) — deliver memo + status; common work is shipped and wasted-free. (This is a pause, not a failure; do not pick a route "to make progress".)
- **ABORT-3**: Extending the gate (C5/C6) surfaces violations on routes OUTSIDE the new module (i.e. some existing resource unexpectedly classifies as ACTIVITY) → the taxonomy diff leaked beyond the two planned keys; revert the taxonomy edit, report.
- **ABORT-4**: A migration assert or CHECK fails against LIVE data in a way this plan declared impossible (e.g. B1 CHECK on existing rows), or live counts grossly contradict SoT (sys_teams empty, personas missing) → data reality diverged from recon; no schema surgery without Enzo.
- **ABORT-5**: Full suite shows failures in modules this mission never touched, persisting after one honest investigation cycle → possible tx-isolation/harness interaction (D-52 is fresh); stop rather than stack workarounds (and NEVER set `TEST_TX_ISOLATION=0` to make it pass). Exclusion: a red `reconciliation-registry` bucket-split after C1/A1 is the planned paired-edit miss, NOT an abort trigger — apply the MANDATORY PAIRED EDIT per C1/A1 and re-run.
- **ABORT-6**: Any step seems to require `git push --force`, migration renumbering of ALREADY-APPLIED files, or destructive DDL on populated tables → out of mission authority (R12).
- **ABORT-7**: >2 failed attempts on the same failure in the same direction → change approach or stop and report (anti-anchoring), especially around the gate/boot machinery.

---

## 11. RED-TEAM RECORD (SUCCESS.md point 7)

**Attack 1 — FAILED (the plan held).** *"Force wasted work: make the executor build route-specific code before Enzo decides, so a 'B' answer torches days of 'A' work."* The attack fails structurally: recon proved the authorization layer is route-invariant (the `goal` resource can never carry the ACTIVITY class — V8/V9 — so even maximal reuse still needs the new `activity` resource, routes, gate extension, resolver, participants table and tests). C0-C8 contain 100% of that invariant work; route-specific effort only starts after the RN-1 trigger, and checkpoint α is a shippable, CI-green stopping point. No sequence of decisions by the executor can put route-A-only code before the fork.

**Attack 2 — SUCCEEDED → PATCH APPLIED.** *"Poison the suite with ordering: have the executor edit `data-classes.ts` (the innocuous-looking taxonomy one-liner) early, then run the suite before the permission-seed migration is applied to the live VM DB the tests point at."* This kills the drift test (`scope-data-classes.integration.test.ts:28-32` checks every mapped resource against live `sys_auth_permissions`) with a misleading failure ("classified resource not present in DB") that tempts a mid-tier executor to *weaken the drift test* instead of fixing the order — the worst possible fix. **Patch (now in the plan)**: (1) the taxonomy edit was MOVED out of the early scope-lib work into C6, explicitly AFTER C1+C2 are applied via migrate against the tunnel DB; (2) C6 carries the trap as a named failure mode with the counter-move "run migrate, re-run — never touch the drift test"; (3) V-RUN-1 (migrate twice) is sequenced before V-RUN-4 (suite) in §8. A second instance of the same class (B2/B3 "same commit — never alone, never later" rule for the goals exclusion filter) was hardened for the same reason: partial-ship of route B is the only path to a live activity-visibility leak, so the plan forbids the split.

### Independent adversarial review 2026-07-06 (REVIEW-13) — findings incorporated

Verdict was PASS-WITH-PATCHES (0 of ~26 spot-checked claims refuted). All nine findings are now patched into this plan:

- **F-1 · CRITICAL**: C1/A1 registry INSERTs deterministically broke the hardcoded bucket split in `reconciliation-registry.integration.test.ts:59` (`{A:27,B:16,C:23,D:49}`/115) and funneled a blind executor into ABORT-5 → MANDATORY PAIRED EDIT added to C1 and A1, failure branch added to C1, ABORT-5 exclusion added.
- **F-2 · MAJOR**: RN-2's member-visibility default was unreachable over HTTP (activity:read audience excluded USER; TEAM_MEMBER is holderless) → RN-2b added (grant `activity:read` to USER, default YES), C2 read audience widened, A2/A3 outsider expectation corrected to "empty list via resolver, not 403".
- **F-3 · MAJOR**: B1's disjointness CHECK made B5 case 4 unsatisfiable (/me selects strictly by subject — `me/repository.ts:453,566` — and anchored ⇒ subject NULL) → case 4 rewritten as a fork on C9 memo question 6 with a zero-touch default (/me unanchored-only; own anchored items via `/v1/activities` assignee=self); B2, B5-failure and FORK-7 rewritten to match.
- **F-4 · MAJOR**: RN-5's TENANT_ADMIN tenant-wide default contradicted the design-spec SoT (Pillar 3 first-match sends ACTIVITY to the functional rule; I21 covers HRMS_MANAGER only) → default flipped to HRMS_MANAGER-yes / TENANT_ADMIN-no (explicit-yes only), mirrored in C4, C6, C7 case 4 and the A3 matrix.
- **F-5 · MAJOR**: interface gap between the user-id-based resolver exports and the anchor-id-based A2/B3 repository SQL → C3 gains `ledAnchorIds`/`memberAnchorIds`; C4 pins the full `FunctionalReadScope` union whose anchored variant carries `teamIds`/`processIds`/`userIdAllowList`.
- **F-6 · MINOR**: C8 pushed unconditionally against the per-session push-authorization rule → C0 now captures the kickoff grant; without it C8 stops at local commits and asks Enzo.
- **F-7 · MINOR**: five imprecise line-cites corrected (V4 → spec:77; V10 → 000037:143-148; V15 → role-codes.ts:11-24; A4/FORK-8 → `000132_approval_runtime.sql:171-174`; V-RUN-4/C4 baseline → 186 passed + 2 skipped at S1015).
- **F-8 · MINOR**: V-RUN-7 PROD probe aligned to `/api/readyz` with the C0-captured path-prefix hedge (matching V-RUN-8).
- **F-9 · MINOR**: `docs/superpowers/specs/2026-07-01-f3-sensitive-modules-map.md` added to the header re-read list (item 8, historical) to mirror the brief's recon sources.

---

## 12. SELF-GRADE vs SUCCESS.md (8 points)

| # | Standard | Grade | Justification |
|---|----------|-------|---------------|
| 1 | Every move states its expected observation | **PASS** | All moves C0-C9, A1-A6, B1-B7 carry an explicit **Expect** with concrete observables (exit codes, psql outputs, boot behavior, HTTP statuses); the one wrong Expect found by REVIEW-13 (A2 outsider — 403 vs empty list, F-2) is corrected |
| 2 | Every move carries likely failure + cause + counter-move | **PASS** | Every move has ≥1 failure→cause→counter-move triple; the highest-risk moves (C6, A2, B2) carry two; the one deterministic suite-breaker the original draft missed (reconciliation-registry bucket split after C1/A1 — REVIEW-13 F-1) now has its paired edit, failure branch and ABORT-5 carve-out |
| 3 | Every fork has a trigger, no judgment calls | **PASS** | Master fork trigger = Enzo's explicit decision with observable precedence order (§5.1); FORK-1..8 each have a mechanical trigger; defaults are pre-stated so silence is itself an observable; the two contradiction-forcing defaults found by REVIEW-13 are resolved (RN-5 TENANT_ADMIN now SoT-conformant, F-4; B5 case 4 now a fork on memo question 6 with a zero-touch default, F-3) |
| 4 | RECON NEEDED with exact settling check | **PASS** | RN-1..RN-10, each with the literal command/query or memo mechanism that settles it |
| 5 | Abort conditions exist | **PASS** | ABORT-1..7, including the non-obvious ones (pause-at-α is not a failure; TEST_TX_ISOLATION=0 forbidden; >2-attempts rule); ABORT-5 now carries the F-1 exclusion so the planned paired-edit miss cannot masquerade as an untouched-module failure |
| 6 | Verification spelled out with pass criteria | **PASS** | V-RUN-1..8 ordered, with when/command/pass for each, including the live www.heuresys.com probes and the D-52 rollback proof |
| 7 | Survived a red-team pass, both attacks recorded | **PASS** | §11: attack 1 failed (structural no-waste layering), attack 2 succeeded (drift-test ordering trap) and its patch is visibly incorporated in C6/§8 sequencing; an independent adversarial review (REVIEW-13, 2026-07-06) found 1 CRITICAL + 4 MAJOR + 4 MINOR — all recorded in §11 and patched in place |
| 8 | Executable blind | **PASS (with the honesty note)** | A mid-tier model can run C0→C8, deliver the memo, and execute either route without asking a question — the only intentional stop is Enzo's own decision, which the mission itself mandates ("the A-vs-B choice is Enzo's authority"); that stop is a designed gate with a clean shipped checkpoint, not an executor question. The blind-execution gaps REVIEW-13 found (F-1 abort trap, F-2 403 wall on planned tests, F-3 unsatisfiable pass criterion, F-5 interface guess, F-6 push permission) are patched in place — no remaining point where a mid-tier executor must guess |

**Overall: 8/8 claimed — with the declared caveat that point 8's "no questions" is satisfied by design only because the single mandatory human input (RN-1) is the mission's own HOLD trigger, packaged as a fork with a shippable pre-fork checkpoint.**

**Post-review status**: the independent adversarial pass (REVIEW-13, 2026-07-06) graded the UNPATCHED plan 6/8 (points 2 and 8 FAIL-as-written) and 8/8 after its patches. All REVIEW-13 patches (F-1..F-9) are incorporated above; the 8/8 claim now rests on the patched text, not on the original draft's optimism.
