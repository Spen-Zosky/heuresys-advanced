# WARGAME 12 — heuresys #26 A/L1: the life of goals/OKRs

**Mission**: implement backlog item **#26 A/L1** in heuresys-advanced — surface the ~4.8k dormant goal/OKR sub-resource rows (updates, check-ins, milestones, comments, alignments) as read-only API sub-resources + a timeline UI in `/goals`, `/okrs`, and the Obiettivi sub-tab of `/me/career`.
**Executor**: Claude Code CLI (Sonnet/Opus) on the heuresys-advanced repo (`D:\heuresys-advanced` on Windows / `/home/ubuntu/heuresys-advanced` on VM).
**Wargamed**: 2026-07-06 by Fable 5 (read-only recon against the live repo at S1016 state, HEAD `2397eb0a` per SoT).
**Sources of truth — RE-READ AT EXECUTION TIME, in this order (binding)**:
1. `docs/kb/SOT_STATE.md`
2. `docs/kb/SOT_BACKLOG.md` (item #26, line ~65)
3. `docs/kb/DEBT_REGISTER.md`
4. `.handoff/STATE.md`
5. `docs/product/DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md` §L1 (doc of record)
6. Repo `CLAUDE.md` (commands table, invariants I13-I21, tests doctrine)

If any count/status in this plan conflicts with the SoT at execution time, **the SoT wins** — and if the conflict is material (see ABORT), stop and flag.

---

## 1. RECON FINDINGS (verified 2026-07-06 unless marked ASSUMED)

### 1.1 Backlog + doc of record
- **VERIFIED** `docs/kb/SOT_BACKLOG.md:65-67`: `#26 A/L1 — vita dei goal/OKR (updates, check-ins, milestones, comments, alignments) · status: ACTIVE · priority P1 · effort ~6-10h · doc: DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md §L1`.
- **VERIFIED** dossier §L1 (`docs/product/DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md:15-19`): data = goal_updates 1.811 · goal_check_ins 1.000 · goal_milestones 1.000 · goal_comments 856 · goal_alignments 100 · goal_templates 40 · okr_check_ins 25 (numbers dated 2026-07-05, re-derivable, **not SoT** — rule T2). Build: sub-resources `/v1/goals/:id/{updates,check-ins,milestones,comments}` + `/v1/okrs/:id/check-ins` + alignments; ESS timeline in `/me/career` tab Obiettivi. Constraints: EVALUATION data-class → orgGate (D-51 enforces alone); `goal:read:self` already seeded.
- **NOTE (scope boundary)**: the dossier mentions "alignments/templates list"; the MISSION BRIEF deliverable line lists only `(updates, check-ins, milestones, comments, alignments)`. **Templates are OUT of scope** for this mission (Enzo can add later — see RECON NEEDED R9).

### 1.2 The dormant tables (DDL verified in `db/migrations/000037_sys_goals_okrs_scaffold.sql`)
All 7 tables exist since mig 000037, `sys.` schema, all tenant-FK'd to `sys_tenancies`, all goal-FK'd `ON DELETE CASCADE`:

| Table | DDL line | PK | Key columns (exact names) | Mutability |
|---|---|---|---|---|
| `sys_goal_templates` | 000037:41 | `template_id` | template_name/category/goal_type/difficulty_level, template_role_id, template_org_unit_id | updatable (OUT of scope) |
| `sys_goal_milestones` | 000037:216 | `milestone_id` | `milestone_goal_id`, milestone_title, milestone_description, milestone_target_date (date), milestone_completed_at, `milestone_status` CHECK ∈ PENDING/IN_PROGRESS/COMPLETED/MISSED/CANCELLED, milestone_weight numeric(5,2), created_at/updated_at | updatable |
| `sys_goal_check_ins` | 000037:277 | `check_in_id` | `check_in_goal_id`, **`check_in_subject_user_id` NOT NULL** (FK sys_users RESTRICT), check_in_date (date), check_in_previous_progress/new_progress int (new NOT NULL 0-100), `check_in_status_update` CHECK ∈ ON_TRACK/AHEAD/AT_RISK/BLOCKED/COMPLETED (nullable), check_in_notes/blockers/next_steps text, check_in_confidence_level 1-5, created_at only (immutable log) | immutable |
| `sys_goal_updates` | 000037:333 | `update_id` | `update_goal_id`, `update_author_user_id` nullable (FK SET NULL), `update_type` CHECK ∈ PROGRESS/STATUS_CHANGE/MILESTONE/BLOCKER/NOTE, update_previous/new_progress numeric(5,2), update_previous/new_status, update_content text, update_attachments jsonb, created_at only | immutable |
| `sys_goal_comments` | 000037:379 | `comment_id` | `comment_goal_id`, `comment_author_user_id` nullable, `comment_parent_comment_id` self-FK (threading), comment_content text NOT NULL, **`comment_is_private` boolean NOT NULL DEFAULT false**, created_at/updated_at | updatable |
| `sys_goal_alignments` | 000037:432 | `alignment_id` | `alignment_source_goal_id` + `alignment_aligned_goal_id` (both FK sys_goals, no-self CHECK, pair-unique), `alignment_type` CHECK ∈ SUPPORTS/CONTRIBUTES_TO/DERIVED_FROM/DEPENDS_ON, alignment_weight numeric(5,2), created_at only | immutable |
| `sys_okr_check_ins` | 000037:628 | `check_in_id` | `check_in_okr_id`, `check_in_key_result_id` nullable, `check_in_subject_user_id` **nullable**, `check_in_scope` CHECK ∈ KEY_RESULT/OKR_AGGREGATE (coherence CHECK with kr id), previous/new value numeric(15,2), previous/new/overall progress numeric(5,2), check_in_status_update **text free** (no CHECK), notes/blockers/next_steps, key_result_updates_snapshot jsonb, created_at only | immutable |

Indexes exist for every per-goal lookup (`sys_goal_updates_goal_idx`, `sys_goal_check_ins_goal_idx`, `sys_goal_milestones_goal_idx`, `sys_goal_comments_goal_idx`, `sys_goal_alignments_source_idx`/`aligned_idx`, `sys_okr_check_ins_okr_idx`). **No new index or migration needed.**

- **PG type traps (verified pattern in `apps/api/src/modules/goals/repository.ts` header comment)**: `numeric` comes back from pg as **string** → `Number()`; `date` columns must be cast `::text` (or `to_char`) in SELECT; `timestamptz` comes back as `Date` → `.toISOString()`.

### 1.3 Existing modules (the base you extend)
- **VERIFIED** `apps/api/src/modules/goals/{routes,service,repository}.ts` (41/76/118 lines): CRUD on `sys.sys_goals` only. Reads carry `config: { orgGate: "service" }` + `requirePermission("goal:read")` (routes.ts:15-25). Service pattern: `findGoalById` → `assertVisible(actor, g.tenantId)` (404 no-leak) → if `g.subjectUserId` then `canReadOrgTarget(pool, a, g.subjectUserId, g.tenantId)` else tenant-visible (service.ts getGoal). List: `resolveOrgReadScope` → `userIdAllowList` → repo filters `(goal_subject_user_id = ANY($n::uuid[]) OR goal_subject_user_id IS NULL)`.
- **VERIFIED** `apps/api/src/modules/okrs/{routes,service,repository}.ts`: same pattern + **the sub-resource template to copy**: `GET /:id/key-results` (routes.ts:29-33) → service `listKeyResults` = findOkrById → assertVisible → canReadOrgTarget(ownerUserId) → `repo.listKeyResultsByOkr` (service.ts:36-41). **This is the exact 7-step shape every new sub-resource must replicate.**
- **VERIFIED** permissions: `goal:read`/`okr:read` seeded mig `000142` to 6 roles (PLATFORM_ADMIN, TENANT_ADMIN, BLUEPRINT_MANAGER, HRMS_MANAGER, PROCESS_OWNER, MANAGER — plain USER has **no** goal:read → 403 on admin routes). `goal:read:self` seeded mig `000166` to 4 ESS roles (PLATFORM_ADMIN, TENANT_ADMIN, READ_ONLY, USER). 000142's post-assert is a **floor `>= 8`** (relaxed by `615ef1d` exactly because 000166 added a 9th) → **adding zero perms keeps everything green; no migration is needed for this mission at all** (no D-12/D-38 exposure).
- **VERIFIED** backfill state: mig `000166` header — `goal_subject_user_id` backfilled **632/1067** via `'LEGACY_EMP::'||goal_metadata->>'legacy_employee_id'` (I14 crosswalk) → 159 advanced users; the other 435 goals have `goal_subject_user_id IS NULL` and are tenant-visible but never in `/me/goals`.

### 1.4 AuthZ machinery (ADR-0027 / D-51)
- **VERIFIED** `apps/api/src/lib/scope/data-classes.ts:65-66`: `goal: "EVALUATION"`, `okr: "EVALUATION"` already in `RESOURCE_DATA_CLASS` → **no taxonomy change needed**.
- **VERIFIED** `apps/api/src/lib/scope/gate.ts` (D-51, S1015): `onRoute` collector + `onReady` assertion — server **refuses boot** (`ORG_GATE_MISSING`) if a read route (verbs `read`/`view`/`list`, **non-`:self`**) on a sensitive resource lacks `config.orgGate ∈ {"service","catalog","aggregate"}`. Self-verb routes (`goal:read:self`) are **exempt by design** (gate.ts header, "Self-scope routes ... are exempt"). Consequence: every new `/v1/goals/:id/*` and `/v1/okrs/:id/*` read route MUST declare `config: { orgGate: "service" }`; `/v1/me/*` routes must NOT.
- **VERIFIED** D-52 (S1015): integration suite runs under **per-FILE tx isolation** (`apps/api/test/helpers/tx-isolation.ts`, wired in setup.ts; escape hatch `TEST_TX_ISOLATION=0`). Direct SQL fixture writes from tests are wrapped in serialized savepoints — `beforeAll` fixtures + intra-file sequential flows work; everything rolls back at file end. Baseline: **189 API test files / 2 skip, 0 fail** (SoT S1016, `SOT_STATE.md:13`; the older Delta S1015 figure was 186 files / 1285 tests — superseded). M10/V7 gate on ≥189 accordingly.

### 1.5 The three pages
- **VERIFIED** `apps/web/src/app/(authenticated)/goals/page.tsx` (71 lines): flat `DataTablePanel` fed by `GET /v1/goals?limit=200`, namespace `hr`, testids `goals-page/goals-title/goals-count/goals-row/goals-empty`. **No detail route, no row click** — `EntityTableProps` (`apps/web/src/components/data-table-panel.tsx:31-46`) has no onRowClick; columns render arbitrary ReactNode → the drill-down entry point must be a per-row `Button` inside a new column cell.
- **VERIFIED** `apps/web/src/app/(authenticated)/okrs/page.tsx` (43 lines): same shape, testids `okrs-*`.
- **VERIFIED** `apps/web/src/app/(authenticated)/me/career/page.tsx` (28 lines): 3 sub-tabs via `ProfileTabs` — `obiettivi` (`career-tab-obiettivi`) → `_components/goals-tab.tsx`, `percorsi`, `rischio`. Namespace `ess`.
- **VERIFIED** `goals-tab.tsx` (37 lines): `useQuery` → `GET /v1/me/goals` → grid of `ProfileSection` cards, testids `career-goals`, `career-goal-primary`, `career-goals-empty`, `career-goals-error`.
- **VERIFIED** `/v1/me/goals` (apps/api/src/modules/me/routes.ts:200-203): `requirePermission("goal:read:self")` → `meService.getGoals` → `repo.loadMyGoals(pool, actor.userId)` = `SELECT ... FROM sys.sys_goals WHERE goal_subject_user_id = $1` (me/repository.ts:453). **`MeGoalSchema` (packages/shared/src/schemas/me.ts:491-503) has NO `goalId`** — the ESS tab cannot address a per-goal timeline today; the schema must gain `goalId` (additive).
- **VERIFIED** i18n: `apps/web/src/locales/{it,en}/hr.json` has `goals.*`/`okrs.*` blocks (title/cols/count/empty*/errorMessage/caption); `{it,en}/ess.json` has `career.goals.*` (due/error/none/priority/progress/status/type/untitled/weight). Parity checked by `pnpm i18n:check` (root package.json:35), parity count 1745 at S1016.
- **VERIFIED** `@heuresys/ui@0.1.9` (apps/web/package.json `^0.1.9`) exports **`Timeline` + `type TimelineEvent`** (also `ActivityFeed`, `CommentThread`, `IncidentTimeline`) — a real Timeline primitive exists. REVIEW-12 verified the dist typings: `TimelineEvent { id, time: string, title, description?, icon?, tone? }`, `Timeline({ events, className, emptyMessage })` — events are rendered internally by the component (no per-event testid slot → M7 container-testid rule; `time` is a preformatted string → occurredAt→formatDate mapping is correct, F5 almost certainly does not fire). R1 re-confirms at execution time.

### 1.6 Tests you extend
- **VERIFIED** `apps/api/test/goals-scope.integration.test.ts` — the gold pattern: real RTL personas (paolo.caputo MANAGER, tommaso.fiore USER = his report, antonio.parisi USER = outsider/peer, federica.marchetti TENANT_ADMIN, admin@heuresys.com PLATFORM_ADMIN), password **env-driven via `test/helpers/personas.ts` (F-001 — never hardcode)**, fixtures seeded by direct SQL with `SUITE_PREFIX`-tagged natural keys, invariant assertions only (no hardcoded counts — Enzo's rule S1012). `okrs-scope.integration.test.ts` also exists.
- **VERIFIED** E2E: `apps/web/tests/e2e/goals.spec.ts` (tenantAdmin storage state; asserts `goals-title`, `goals-count`, first `goals-row`) and `me-career-tabs.spec.ts` (employee = tommaso.fiore, has 4 real goals; asserts the 3 tabs + `career-goals` + `career-goal-primary`). Fixtures: `storageStateFor("tenantAdmin"|"employee")` in `tests/e2e/fixtures.ts`.
- **VERIFIED** commands (repo CLAUDE.md): typecheck all `pnpm typecheck` (+ `cd apps/api && pnpm typecheck:test`); single test `cd apps/api && pnpm exec vitest run test/<name>.integration.test.ts`; i18n `pnpm i18n:check`; E2E full `cd apps/web && pnpm test:e2e:prod` (on Node ≥23 hosts use `test:e2e:prod:node22` — D-36); tunnel localhost:5433 must be up for API tests.
- **VERIFIED** deploy: `scripts/vm-deploy.sh` (run ON the VM; readyz curl with retry — D-48; detached mode — D-49). CI = GitHub Actions on self-hosted VM runner; a red CI is the executor's to fix (R3).

### 1.7 ASSUMED (carried into RECON NEEDED)
- Row counts (1811/1000/1000/856/100/25) are atlas evidence dated 2026-07-05, not re-verified live here (no DB access from this wargame seat).
- Dormant rows presumed to belong to the RTL_BANK tenant and to attach to legacy-imported goals; distribution across subject-backfilled vs NULL-subject goals unknown.
- Whether tommaso.fiore's 4 goals carry any sub-resource rows: unknown.
- `TimelineEvent` prop shape: resolved by REVIEW-12 (see §1.5); R1 re-confirms live.

---

## 2. RECON NEEDED (execute these checks BEFORE writing code — Move M1)

Each check is a single command; run from repo root on a machine with the 5433 tunnel up. `PSQL="psql postgresql://heuresys@localhost:5433/heuresys_advanced"` (db name per repo CLAUDE.md; if auth fails, read the exact DSN from the gitignored `.env` — do NOT print credentials).

- **R1 — Timeline props**: `grep -n -B3 -A25 "TimelineEvent" node_modules/.pnpm/@heuresys+ui@0.1.9*/node_modules/@heuresys/ui/dist/index.d.ts | head -60` → settles the exact props for the UI move. If the shape doesn't fit (no per-event timestamp/label slots) → FORK F5.
- **R2 — live counts**: `$PSQL -c "SELECT 'updates',count(*) FROM sys.sys_goal_updates UNION ALL SELECT 'check_ins',count(*) FROM sys.sys_goal_check_ins UNION ALL SELECT 'milestones',count(*) FROM sys.sys_goal_milestones UNION ALL SELECT 'comments',count(*) FROM sys.sys_goal_comments UNION ALL SELECT 'alignments',count(*) FROM sys.sys_goal_alignments UNION ALL SELECT 'okr_check_ins',count(*) FROM sys.sys_okr_check_ins;"` → expect ≈ 1811/1000/1000/856/100/25. Any table at 0 or missing → ABORT A2.
- **R3 — tenant distribution**: `$PSQL -c "SELECT update_tenant_id, count(*) FROM sys.sys_goal_updates GROUP BY 1;"` (repeat for one more table) → settles which tenant's personas can see rows live. If rows live in a tenant with no login personas → FORK F4.
- **R4 — per-goal maxima (pagination decision)**: `$PSQL -c "SELECT max(c) FROM (SELECT count(*) c FROM sys.sys_goal_updates GROUP BY update_goal_id) s;"` (repeat per table) → if any max > 200 → FORK F3 (add limit/offset); else return-all with `LIMIT 500` guard.
- **R5 — demo goal WITH history (needed for live DoD)**: `$PSQL -c "SELECT g.goal_id, g.goal_title, g.goal_subject_user_id IS NOT NULL AS has_subject, (SELECT count(*) FROM sys.sys_goal_updates u WHERE u.update_goal_id=g.goal_id) + (SELECT count(*) FROM sys.sys_goal_check_ins ci WHERE ci.check_in_goal_id=g.goal_id) + (SELECT count(*) FROM sys.sys_goal_comments c WHERE c.comment_goal_id=g.goal_id) + (SELECT count(*) FROM sys.sys_goal_milestones m WHERE m.milestone_goal_id=g.goal_id) AS events FROM sys.sys_goals g ORDER BY events DESC LIMIT 5;"` → record the top goal_id (call it `GOAL_RICH`).
- **R6 — NULL-subject goal with history (the DoD trap)**: same query with `WHERE g.goal_subject_user_id IS NULL` → if a NULL-subject goal has events ≥1, record it as `GOAL_NOSUBJ`; if **zero** NULL-subject goals have any events → FORK F1 (empty-state acceptance + flag Enzo).
- **R7 — ESS persona data**: `$PSQL -c "SELECT g.goal_id, g.goal_title, (SELECT count(*) FROM sys.sys_goal_updates u WHERE u.update_goal_id=g.goal_id) AS upd FROM sys.sys_goals g JOIN sys.sys_users us ON us.user_id=g.goal_subject_user_id WHERE us.user_email='tommaso.fiore@rtl-bank.org';"` → if all of tommaso's goals have 0 events, pick another persona in the org tree that has events (query `sys_users` join) for the live ESS check; the E2E can still assert the timeline section renders (possibly empty state).
- **R8 — private comments**: `$PSQL -c "SELECT comment_is_private, count(*) FROM sys.sys_goal_comments GROUP BY 1;"` → count feeds the report to Enzo. Regardless of the answer, v1 policy is decided (see M4): **`comment_is_private = true` rows are excluded from ALL read endpoints**. Whether/how to expose them (author-only? manager?) is **Enzo's product decision** — record the count and the question in the session report, do not implement.
- **R9 — templates**: OUT of scope (brief). If Enzo asks for `goal_templates` list during the session, that is a scope change → new register item, not this mission.
- **R10 — CI workflow count**: `gh run list --limit 5` after first push → the SoT says 6/6 at S1014 and 7/7 at S1016; whatever number of workflows exists, **pass = ALL green**, don't hardcode 6.
- **R11 — live login credentials**: personas password is rotated + env-driven (F-001). Read it from `.secrets/test_admin_password.txt` (gitignored, present on dev machines/VM) — never echo it into logs/output.
- **R12 — okr with check-ins**: `$PSQL -c "SELECT check_in_okr_id, count(*) FROM sys.sys_okr_check_ins GROUP BY 1 ORDER BY 2 DESC LIMIT 3;"` → record `OKR_RICH` for live verification.

**Items requiring ENZO personally** (encode in report, do not decide):
- E1: exposure policy for `comment_is_private=true` rows (v1 default = hidden everywhere).
- E2: whether `goal_templates` (40 rows) gets a read endpoint (dossier mentions it; brief excludes it).
- E3: if FORK F1 fires (no NULL-subject goal has history), whether an empty-timeline render satisfies the DoD or whether he wants seeded demo history (data write = product decision).
- E4: okr check-in rows carry a per-person subject (`check_in_subject_user_id`) that may differ from the OKR owner; v1 default = expose the row but NULL out `subjectUserId` when `canReadOrgTarget(subject)` is false (mirror of the alignments counterpart-title rule — decided, no judgment). Whether to instead HIDE such rows entirely is Enzo's call — record count of rows with subject ≠ owner in the report.

---

## 3. MOVES

Every move: **Action → Expected observation → Most likely failure → cause → counter-move.**

### M0 — Boot, SoT, tunnel
**Action**: read the 4 SoT files in order (§Header); `git status` + `git log origin/main..HEAD --oneline` (expect clean, 0 unpushed); verify tunnel: `$PSQL -c "SELECT count(*) FROM sys.sys_goals;"`.
**Expected**: #26 status ACTIVE in SOT_BACKLOG; DEBT_REGISTER shows 0 open debts (S1015); goals count = 1067; migrations on disk 167 files max 000169 (`ls db/migrations | tail -1`).
**Failure**: tunnel refused → cause: SSH tunnel down → counter: start it per CLAUDE.md §quick-commands (port 5433→5432), retry once. #26 not ACTIVE or superseded → ABORT A1. Goals count ≠ 1067 → not fatal (data may have grown); re-derive and continue, but if the table is empty → ABORT A2.

### M1 — Live recon (run ALL of §2 R1-R12)
**Action**: execute the RECON NEEDED checks; write the resolved values (GOAL_RICH, GOAL_NOSUBJ or F1, per-table maxima, tenant, TimelineEvent shape) into a scratch note for the session.
**Expected**: counts ≈ dossier; GOAL_RICH found with ≥5 events.
**Failure**: a table name doesn't exist → cause: schema drift vs 000037 → ABORT A2. Counts wildly different (e.g. 10x) → cause: data changed since atlas → not fatal, SoT/T2 rule: live wins; adjust expectations, continue.

### M2 — Shared schemas (`packages/shared/src/schemas/`)
**Action**: in `goals.ts` add zod schemas + types, mirroring the existing style (camelCase fields, `.nullable()` where DDL allows NULL):
- `GoalUpdateSchema` (updateId, goalId, authorUserId, type, previousProgress, newProgress, previousStatus, newStatus, content, createdAt),
- `GoalCheckInSchema` (checkInId, goalId, subjectUserId, date, previousProgress, newProgress, statusUpdate, notes, blockers, nextSteps, confidenceLevel, createdAt),
- `GoalMilestoneSchema` (milestoneId, goalId, title, description, targetDate, completedAt, status, weight, createdAt, updatedAt),
- `GoalCommentSchema` (commentId, goalId, authorUserId, parentCommentId, content, createdAt, updatedAt) — **no isPrivate field exposed**,
- `GoalAlignmentSchema` (alignmentId, sourceGoalId, alignedGoalId, direction: `"OUT"|"IN"`, type, weight, counterpartTitle nullable, createdAt),
- `GoalTimelineEventSchema` (kind: `"UPDATE"|"CHECK_IN"|"MILESTONE"|"COMMENT"`, occurredAt ISO string, plus a flat payload of the union above) and `GoalTimelineResponseSchema { items, total }`,
- list-response wrappers `{ items, total }` per sub-resource.
In `okrs.ts` add `OkrCheckInSchema` (checkInId, okrId, keyResultId, subjectUserId, scope, date, previousValue, newValue, previousProgress, newProgress, overallProgress, statusUpdate, notes, blockers, nextSteps, confidenceLevel, createdAt) + response wrapper.
In `me.ts`: add `goalId: z.string()` to `MeGoalSchema` (additive) + `MeGoalTimelineResponseSchema` (reuse `GoalTimelineEventSchema` via import or re-declare in me.ts if cross-file import breaks convention — check how me.ts imports today).
Export everything from the package index.
**Expected**: `pnpm --filter @heuresys/shared typecheck` (or root `pnpm typecheck`) green.
**Failure**: type errors on export collisions → cause: name already taken (e.g. `GoalUpdate` vs `UpdateGoalBody`) → counter: prefix consistently (`GoalUpdateEntry` etc.), grep the package for the name before choosing.

### M3 — API repositories
**Action**: in `apps/api/src/modules/goals/repository.ts` add read functions, each `(q: DbConnector, goalId: string)`, parameterized SQL, ORDER BY `created_at DESC`, `LIMIT 500` guard (or limit/offset per FORK F3):
- `listUpdatesByGoal` → `sys.sys_goal_updates WHERE update_goal_id=$1`
- `listCheckInsByGoal` → `sys.sys_goal_check_ins WHERE check_in_goal_id=$1` (cast `check_in_date::text`)
- `listMilestonesByGoal` → `sys.sys_goal_milestones WHERE milestone_goal_id=$1` (cast `milestone_target_date::text`)
- `listCommentsByGoal` → `sys.sys_goal_comments WHERE comment_goal_id=$1 AND comment_is_private = false`
- `listAlignmentsByGoal` → both directions in one query: `WHERE alignment_source_goal_id=$1 OR alignment_aligned_goal_id=$1`, computing `direction` and `counterpart_goal_id`; **join counterpart title but return it separately** so the service can null it out (visibility rule, M4)
- `listTimelineByGoal` → either 4 queries merged in TS by `occurredAt` desc (preferred: reuses the 4 functions, no SQL union type-juggling) — comments filtered `is_private=false`.
Remember the type traps (§1.2): `Number()` on numerics, `::text` on dates, `.toISOString()` on timestamptz.
In `apps/api/src/modules/okrs/repository.ts` add `listCheckInsByOkr(q, okrId)` mirroring `listKeyResultsByOkr`.
**Expected**: `cd apps/api && pnpm typecheck` green.
**Failure**: runtime `weight`/`progress` arrives as string in tests → cause: forgot `Number()` on numeric(5,2) → counter: apply the repository.ts:5 comment pattern everywhere.

### M4 — API services + routes
**Action**: in `goals/service.ts` add ONE private helper `assertGoalReadable(a, id): Promise<Goal>` = `findGoalById → NotFound → assertVisible → if subjectUserId then canReadOrgTarget else pass` (this is verbatim the existing `getGoal` body — factor it, use it in getGoal too). Then services: `listGoalUpdates/CheckIns/Milestones/Comments/Alignments/Timeline(a, id)` = `assertGoalReadable` then repo call. **Alignments visibility rule (decided — no judgment call)**: for each alignment row, run the same readability predicate on the counterpart goal (tenant + subject org-gate); if the counterpart is NOT readable by the actor → keep the row but set `counterpartTitle: null` (the alignment belongs to YOUR goal; the foreign title does not). In `okrs/service.ts` add `listOkrCheckIns` cloning `listKeyResults` (lines 36-41), then apply the E4 v1 rule: for each row with a non-null `subjectUserId`, if NOT `canReadOrgTarget(pool, a, subjectUserId, o.tenantId)` → set `subjectUserId: null` (keep the row).
In `goals/routes.ts` add 6 GETs — **every one carries BOTH** `config: { orgGate: "service" }` **and** `preHandler: [requirePermission("goal:read")]`:
`GET /:id/updates`, `/:id/check-ins`, `/:id/milestones`, `/:id/comments`, `/:id/alignments`, `/:id/timeline` — zod `params: GoalIdParamSchema`, `response: {200: <wrapper>}`.
In `okrs/routes.ts` add `GET /:id/check-ins` (orgGate service + `okr:read`), exactly like `/:id/key-results`.
**Expected**: API boots (`cd apps/api && pnpm dev` or the test-app boot in the first vitest run) with **no `ORG_GATE_MISSING`** — the D-51 gate sees goal/okr (EVALUATION) read routes all declared.
**Failure**: boot refuses with `ORG_GATE_MISSING` listing one of the new URLs → cause: a route missed `config.orgGate` → counter: add `config: { orgGate: "service" }` to the flagged route (never silence the gate, never reclassify the resource).

### M5 — /me self endpoints
**Action**: in `me/repository.ts` add `goal_id AS goal_id` to `loadMyGoals` SELECT (line ~448) + map to `goalId`. Add `loadMyGoalTimeline(q, userId, goalId)`: first `SELECT 1 FROM sys.sys_goals WHERE goal_id=$2 AND goal_subject_user_id=$1` → if no row, the service throws NotFound (no leak, even if the goal exists for someone else); then reuse the goals-module repo timeline functions (import them — they are plain exported functions on DbConnector) with comments filtered `is_private=false`. In `me/service.ts` add `getGoalTimeline(actor, goalId)`. In `me/routes.ts` add `GET /goals/:goalId/timeline` with `preHandler: [requirePermission("goal:read:self")]`, params zod `{ goalId: uuid }`, response `MeGoalTimelineResponseSchema`. **No orgGate config** (self verb → gate-exempt by design, gate.ts header).
**Expected**: boot still green; `GET /v1/me/goals` now returns `goalId` per item.
**Failure A**: gate flags the me route → cause: the permission code parsing treats `read:self` as `read` (would be a gate regression, not your bug) → counter: STOP, do not annotate orgGate on a self route to silence it; inspect `gate.ts` verb parsing; if genuinely broken → ABORT A5 (flag, don't patch the gate in this mission).
**Failure B**: existing me-tests fail because response gained `goalId` → cause: a test asserts exact object shape → counter: update that test's expectation (additive field is legitimate; cite this plan).

### M6 — Integration tests (tunnel up; per-file tx isolation D-52 handles cleanup)
**Action**:
1. Extend `apps/api/test/goals-scope.integration.test.ts` (or add sibling `goals-subresources-scope.integration.test.ts` to keep the file focused — pick sibling, mirroring S1014 style): seed via direct SQL (SUITE_PREFIX natural keys) — one goal subject=tommaso with 1 update + 1 check-in (check_in_subject_user_id = tommaso, NOT NULL!) + 1 public comment + **1 private comment** + 1 milestone; one NULL-subject goal in the same tenant with 1 update; one alignment between them. Assert invariants (never counts of live data):
   - paolo (MANAGER, tommaso in sub-tree): `GET /v1/goals/:id/timeline` → 200, contains the seeded update AND NOT the private comment; `/comments` → the public one only.
   - antonio (peer/outsider): same URL → **404** (existence no-leak).
   - tommaso (plain USER, no goal:read): admin sub-resource URL → **403**.
   - federica (TENANT_ADMIN, I20): 200 tenant-wide.
   - NULL-subject goal: federica AND paolo both 200 (tenant-visible, matches list semantics).
   - Alignment counterpart-title nulling: as antonio is irrelevant (404 upstream), test with a manager whose sub-tree contains one side only — if org fixtures make this heavy, assert at least the row presence + fields for federica and leave the nulling branch covered by a unit-style assertion on the service with a scoped actor (keep it invariant-based).
2. Sibling for okrs: seed 1 okr + 1 check-in (scope OKR_AGGREGATE, kr NULL — respect the coherence CHECK) → same 200/404/403 matrix on `/v1/okrs/:id/check-ins`. OKR INSERT minimal columns: (`okr_tenant_id`, `okr_natural_key='${SUITE_PREFIX}::okr'`, `okr_objective`, `okr_owner_user_id`, `okr_period_start='2026-01-01'`, `okr_period_end='2026-03-31'`) — defaults cover type/period_type/status. Check-in INSERT minimal: (`check_in_tenant_id`, `check_in_okr_id`, `check_in_natural_key='${SUITE_PREFIX}::ci1'`, `check_in_scope='OKR_AGGREGATE'`) — `check_in_key_result_id` stays NULL (coherence CHECK), `check_in_date` defaults. E4 assert: seed one extra check-in with subject=antonio on an OKR owner=tommaso → paolo reads it with `subjectUserId === null` (row present, subject nulled per the E4 v1 rule in M4).
3. `me-goals` — NEW SIBLING FILE ONLY: create `test/me-goals-timeline.integration.test.ts` (do NOT extend `me-career-tabs.integration.test.ts` and do NOT seed any goal for tommaso inside that file: its line 47 hardcodes `expect(body.total).toBe(4)` on `/v1/me/goals` — a same-file fixture is visible under D-52 per-FILE rollback and breaks it). In the sibling: tommaso `GET /v1/me/goals` → items now carry `goalId`; `GET /v1/me/goals/<his seeded goal>/timeline` → 200 with seeded events; `GET /v1/me/goals/<antonio's goal id>/timeline` → 404; unauthenticated → 401.
**Header hygiene**: when cloning the scope-suite header comment, DROP the literal `(password Admin#PassW0rd!)` fragment — stale pre-F-001 residue; write `(password env-driven, F-001)`. Flag the residue in the 10 existing files to Enzo in the report (cleanup candidate, not this mission).
**Run**: `cd apps/api && pnpm exec vitest run test/goals-subresources-scope.integration.test.ts test/okrs-subresources-scope.integration.test.ts test/me-goals-timeline.integration.test.ts` (names as created).
**Expected**: all new tests green on first full run after M3-M5 (write them to FAIL before the impl if you follow red→green, but impl-first order is acceptable here since the pattern is cloned).
**Failure A**: FK violation seeding check-ins → cause: `check_in_subject_user_id` NOT NULL / not a real user → counter: use tommaso's userId from the login response (pattern already in goals-scope seedGoal).
**Failure B**: `25P02 current transaction is aborted` cascades → cause: an intentional-error SQL statement outside the savepoint discipline → counter: keep fixture SQL simple (plain INSERTs); if it persists, re-read `tx-isolation.ts` header for the writes-only savepoint contract; last resort for LOCAL debugging only: `TEST_TX_ISOLATION=0` then MANUALLY delete fixtures — never commit that env into CI.
**Failure C**: 404 where 200 expected for paolo → cause: seeded goal's tenant ≠ persona tenant → counter: derive `goal_tenant_id` from the subject user's row (seedGoal pattern does `SELECT u.user_tenant_id`).

### M7 — Admin UI: /goals and /okrs timeline drill-down
**Action**: in `goals/page.tsx` add a final column (header = t("goals.timeline.open")) whose cell renders a `Button` (variant ghost/outline, testid `goals-timeline-open`) setting `selectedGoal` state; render a `Dialog` (from `@heuresys/ui`) — testid `goals-timeline-dialog` — that on open `useQuery`s `GET /v1/goals/${id}/timeline` and renders the `Timeline` component (props per R1; map kind→icon/label via i18n, occurredAt→formatDate) plus a compact count strip (updates/check-ins/milestones/comments/alignments counts derived from items) and an alignments list (type + counterpartTitle ?? t("goals.timeline.restricted")). Empty → `EmptyState` (testid `goals-timeline-empty`); error → `ErrorState`. Wrap the `<Timeline events={…}/>` render in a container div with `data-testid="goals-timeline-events"` (visible only when `items.length > 0`; the empty branch renders `goals-timeline-empty` instead) — `Timeline` renders events internally (`{events, className, emptyMessage}`, no per-event testid slot), so the container is the ONLY stable E2E selector. Same for okrs (`okrs-timeline-events`) and ESS (`career-goal-timeline-events`). Same surgery on `okrs/page.tsx` with `/v1/okrs/${id}/check-ins` rendered through the same Timeline mapping (kind fixed CHECK_IN), testids `okrs-timeline-*`.
**Expected**: `pnpm --filter @heuresys/web typecheck` + `pnpm lint` green; dev-render shows the dialog with real rows for GOAL_RICH.
**Failure**: `Timeline` props mismatch → FORK F5 (hand-rolled list). Dialog import path/name differs → cause: check `@heuresys/ui` exports (`Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger` all exist, verified §1.5) → use controlled `open` prop instead of Trigger if the trigger lives in a table cell.

### M8 — ESS UI: Obiettivi sub-tab timeline
**Action**: in `me/career/_components/goals-tab.tsx`, inside each `ProfileSection` card add a disclosure ("Mostra storia" / "Show history", testid `career-goal-timeline-toggle`) that lazily `useQuery`s `GET /v1/me/goals/${g.goalId}/timeline` on first open and renders the same Timeline mapping (extract the event-mapping into a small shared component `apps/web/src/components/goal-timeline.tsx` used by M7 and M8 — one mapper, one i18n surface; it renders the M7 container testid, here `career-goal-timeline-events`, visible only when items exist). Empty → muted t("career.goals.timeline.none") (testid `career-goal-timeline-empty`).
**Expected**: tab still renders 4 cards for tommaso; expanding shows events or the empty message.
**Failure**: `g.goalId` undefined → cause: M5 repo select not deployed in the running API or shared package not rebuilt → counter: rebuild shared (`pnpm --filter @heuresys/shared build` if the workspace links via dist) and restart dev API.

### M9 — i18n
**Action**: add keys in **both** `it` and `en`: `hr.json` → `goals.timeline.{open,title,empty,error,restricted,counts.*,kind.{update,checkIn,milestone,comment,alignment}}`, `okrs.timeline.{open,title,empty,error}`; `ess.json` → `career.goals.timeline.{show,hide,none,error}`. Italian is the canonical wording (G-01 doctrine), English mirrors.
**Expected**: `pnpm i18n:check` green (parity grows from 1745 by exactly the number of added keys ×1 per language pair).
**Failure**: parity check red listing a key → cause: key added in one language only / typo → counter: add the missing twin, re-run.

### M10 — Full local gates
**Action**: run in order: `pnpm typecheck` → `cd apps/api && pnpm typecheck:test` → `pnpm lint` → `pnpm i18n:check` → `cd apps/api && pnpm test` (FULL suite, tunnel up, ~25 min under tx isolation).
**Expected**: suite ≥189 files passed / 2 skip / **0 fail** (baseline 1285+ tests grows by the new files).
**Failure**: a PRE-EXISTING test fails → cause per R3 (cross-project): there is no "pre-existing" — investigate; if your schema change (MeGoal goalId) broke it, fix the expectation; if genuinely unrelated flake, re-run the single file once; still red → fix it before proceeding (R3), or if it requires product decisions → ABORT A6 with precise evidence.

### M11 — E2E (targeted)
**Action**: extend `apps/web/tests/e2e/goals.spec.ts`: after row assertions, click first `goals-timeline-open`, expect `goals-timeline-dialog` visible AND (`goals-timeline-events` container visible OR `goals-timeline-empty` visible) — the OR keeps it live-data-honest; the container testid is the M7 wrapper (the `Timeline` component exposes no per-event slot). Extend `me-career-tabs.spec.ts`: in Obiettivi, click first `career-goal-timeline-toggle`, expect `career-goal-timeline-events` OR `career-goal-timeline-empty`. Run per-spec: `cd apps/web && pnpm exec playwright test tests/e2e/goals.spec.ts tests/e2e/me-career-tabs.spec.ts` (dev config OK for per-spec iteration; on Node ≥23 use the node22 wrapper — D-36). Mind the login rate-limit 10/5min (S1016 lesson) — reuse storage states, don't loop setup.
**Expected**: both specs green.
**Failure**: dialog never visible → cause: Dialog portal renders outside `main`/testid scoping or animation timing → counter: `await expect(...).toBeVisible({ timeout: 15000 })` and query by testid at page level (Playwright pierces portals by default).

### M12 — Commit, push, CI
**Action**: atomic commits (suggested split: `feat(shared+api): goals/okr read sub-resources + timeline (#26)` · `feat(web): goal/okr timeline UI (#26)` · `test/e2e: #26 coverage` — or a single atomic commit per repo convention "pattern modulo 7-step + atomic commit"); NO migration files in the diff (assert: `git diff --stat origin/main.. | grep db/migrations` → empty). Pre-commit secret grep (R11 global): `git diff origin/main.. | grep -iE "password|secret|api.key|sk-|BEGIN PRIVATE KEY"` → only matches must be i18n words like "password" labels — none expected here. Push; `gh run list --limit 8` then `gh run watch <id>` per workflow.
**Expected**: ALL workflows green (6 or 7 — per R10).
**Failure**: `test-integration` red on CI but green locally → cause: CI runs vitest with DB localhost on the VM (no tunnel latency) — a timing assumption baked into a test → counter: read the CI log for the exact assertion, fix the test (no retries-as-fix); hook/workflow failure → investigate, never `--no-verify` (R12g).

### M13 — Deploy + LIVE verification (DoD, ADR-0026: no mock, real login)
**Action**: on the VM: `bash scripts/vm-deploy.sh` (detached per D-49; it polls `/readyz` with retry — D-48). Then live checks on `https://www.heuresys.com`:
1. Unauthenticated API probes (proves routes deployed): `curl -s -o /dev/null -w "%{http_code}" https://www.heuresys.com/api/v1/goals/00000000-0000-4000-8000-000000000000/timeline` → **401** (same probe style as #25's DoD).
2. Real login as federica.marchetti@rtl-bank.org (TENANT_ADMIN; password from `.secrets/test_admin_password.txt` — R11): open `/goals`, open the timeline dialog on `GOAL_RICH` (find it by title from R5) → **real rows on screen**; then on `GOAL_NOSUBJ` (or per FORK F1: any NULL-subject goal → timeline renders, possibly the real empty state) → **renders without error**. Open `/okrs` → check-ins on OKR_RICH.
3. Real login as tommaso.fiore@rtl-bank.org: `/me/career` → Obiettivi → expand a goal → events or true empty state per R7.
Capture evidence (screenshots or curl outputs + timestamps) for the session report.
**Expected**: all four screens show live data; readyz OK.
**Failure**: readyz never OK → cause: boot-gate refusing (an orgGate miss that only manifests with prod route registration order) → counter: `journalctl`/pm2 logs on VM for `ORG_GATE_MISSING`, fix, redeploy; if the API is down >15 min on prod → ROLLBACK: redeploy previous commit (`REPO_DIR` git checkout prev tag/commit + vm-deploy), then fix offline (prod is the only environment — I15).

### M14 — Close
**Action**: follow the repo close-flow (handoff skill rewrites SOT_STATE/.handoff/STATE, register #26 → DONE with evidence, session journal). Include in the report: R8 private-comment count + question E1, E2 templates, F1 outcome if fired, E4 count (okr check-in rows with subject ≠ owner) + hide-vs-null question, L3 stale-password residue in the 10 existing scope files.
**Expected**: `python docs/kb/tools/handoff_lint.py` → OK; `git log origin/main..HEAD` → empty.
**Failure**: lint red → cause: register/state format rule → follow the lint message exactly.

---

## 4. FORKS (triggers, not judgment)

- **F1 — NULL-subject DoD**: IF R6 returns zero NULL-subject goals with events → the live DoD check on `GOAL_NOSUBJ` becomes "timeline dialog renders the real empty state without error" (still a real render, no mock), AND question E3 goes to Enzo in the report. IF R6 finds one → use it and assert real rows.
- **F2 — tommaso has no events (R7 empty)**: IF no persona-owned goal has events → E2E me-career asserts the toggle + empty-state testid (`career-goal-timeline-empty`, not the `career-goal-timeline-events` container); live check 3 in M13 shows the empty state. Do NOT seed prod data (product decision).
- **F3 — pagination**: IF any R4 max > 200 → add `querystring: {limit (default 50, max 200), offset}` to the affected sub-resource route(s) + repo LIMIT/OFFSET, mirroring `GoalListQuerySchema`; ELSE ship return-all with `LIMIT 500`.
- **F4 — rows in a persona-less tenant**: IF R3 shows the dormant rows' tenant has no login personas → do live verification with `admin@heuresys.com` (PLATFORM_ADMIN, cross-tenant per service code `isPlatform` bypass) instead of federica.
- **F5 — Timeline component unusable**: IF R1 shows `TimelineEvent` lacks arbitrary label/timestamp slots OR M7 typecheck fails on its props → build the list by hand inside `goal-timeline.tsx` (ordered `<ol>` with StatusPill + formatted date — primitives only, no new dependency). Do not fight the component API for more than one attempt (R14).
- **F6 — MeGoal shape breaks a test**: IF any existing test/e2e asserts the exact MeGoal key set → update that expectation in the same commit, citing "additive goalId (#26)".
- **F6-bis — me-career-tabs total**: IF `me-career-tabs.integration.test.ts` goes red on `total` after your changes → you seeded a goal for tommaso in the WRONG file; move the fixture to the sibling file (`me-goals-timeline.integration.test.ts`, M6.3), never edit the `toBe(4)` expectation for this mission.
- **F7 — gate flags the /me timeline route**: IF boot fails naming `/v1/me/goals/:goalId/timeline` → do NOT add orgGate to a self route; verify the permission string is exactly `goal:read:self` (the `:self` suffix drives the exemption); if it is and the gate still fires → ABORT A5.
- **F8 — okrs sub-resource naming clash**: IF `GET /:id/check-ins` conflicts with an existing route (it does not today, verified routes.ts) → re-check you're editing okrs/routes.ts not goals; there is no legitimate clash — a clash means wrong file.

## 5. ABORT CONDITIONS (stop, write findings, flag Enzo — do not improvise)

- **A1**: SOT_BACKLOG #26 is no longer ACTIVE, or its note contradicts this plan's scope (e.g. now demands write-paths).
- **A2**: any of the 7 tables missing/renamed/empty on the live DB (schema or data drift vs 000037/atlas).
- **A3**: `goal:read`, `okr:read`, or `goal:read:self` absent from `sys_auth_permissions` live (would demand a migration — a migration in this mission means the recon was wrong; re-recon, then flag).
- **A4**: the mission would require ANY schema migration (new column/table). Scope says zero migrations; needing one = misunderstanding → stop.
- **A5**: D-51 gate misbehaves on self routes (F7 second branch) — gate changes are out of scope and touch 76 annotated routes.
- **A6**: full API suite has failures you cannot trace to your diff after two focused attempts (R14: don't escalate effort in the same direction) — report with file:line evidence.
- **A7**: prod down >15 min post-deploy → rollback (M13 counter-move) is mandatory, then stop and report.
- **A8**: any step would need `git push --force`, history rewrite, or committing secrets — never (R11/R12).

## 6. VERIFICATION RUNS (what the executor runs, when, and what PASS looks like)

| # | When | Command | PASS |
|---|---|---|---|
| V1 | M0 | `$PSQL -c "SELECT count(*) FROM sys.sys_goals"` | `1067` (± growth; >0 mandatory) |
| V2 | M1 | §2 R2 union query | 6 rows, each count > 0 (≈1811/1000/1000/856/100/25) |
| V3 | M2-M5 (each) | `pnpm typecheck` && `cd apps/api && pnpm typecheck:test` | exit 0, 0 errors |
| V4 | after M4 | boot API (first vitest run boots test app) | no `ORG_GATE_MISSING` in output |
| V5 | M6 | `cd apps/api && pnpm exec vitest run test/goals-subresources-scope.integration.test.ts test/okrs-subresources-scope.integration.test.ts test/me-goals-timeline.integration.test.ts` | all pass; the 404/403/200 matrix green |
| V6 | M9 | `pnpm i18n:check` | exit 0, parity it=en |
| V7 | M10 | `pnpm lint` · `cd apps/api && pnpm test` | lint 0 errors; suite ≥189 files, **0 fail** (2 pre-existing skips allowed) |
| V8 | M11 | `cd apps/web && pnpm exec playwright test tests/e2e/goals.spec.ts tests/e2e/me-career-tabs.spec.ts` (node22 wrapper on Node≥23) | both specs pass |
| V9 | M12 | `gh run list --limit 8` after push | every workflow `completed success` |
| V10 | M13 | `curl -s -o /dev/null -w "%{http_code}" https://www.heuresys.com/api/v1/goals/00000000-0000-4000-8000-000000000000/timeline` | `401` |
| V11 | M13 | real login federica → /goals → GOAL_RICH dialog; GOAL_NOSUBJ dialog; /okrs → OKR_RICH | real rows visible; NOSUBJ renders (rows or true empty per F1) |
| V12 | M13 | real login tommaso → /me/career → Obiettivi → expand | timeline events or true empty per F2 |
| V13 | M14 | `python docs/kb/tools/handoff_lint.py` · `git log origin/main..HEAD --oneline` | OK · empty |

## 7. RED-TEAM RECORD

**Attack 1 — cross-tenant sub-resource smuggling (FAILED against the plan).** Attack: call `GET /v1/goals/<goal-of-tenant-B>/updates` as tenant-A TENANT_ADMIN — sub-resource repos filter only by `goal_id`, so if the route skipped the parent check the rows would leak cross-tenant. Why it fails: every sub-resource service path goes through `assertGoalReadable` = `findGoalById → assertVisible (tenant, 404 no-leak) → canReadOrgTarget` BEFORE any repo call (M4), which is the verbatim `listKeyResults` pattern already proven by `okrs-scope.integration.test.ts`; M6 explicitly encodes the outsider-404 and cross-tenant invariants. The attack found no hole.

**Attack 2 — the NULL-subject DoD trap (SUCCEEDED, plan patched).** Attack: the DoD says "timeline renders real rows on a goal with history AND on a goal without subject user". First draft assumed both demo goals exist. But `sys_goal_check_ins.check_in_subject_user_id` is **NOT NULL** (000037:281) — check-ins can only attach where a subject exists, and if the legacy import wrote updates/comments only for subject-resolvable goals, **zero NULL-subject goals may have any history**, making the literal DoD unsatisfiable with real data and inviting the executor to improvise (seed fake rows = ADR-0026 violation). Patch produced: RECON R6 (exact SQL that settles it) + FORK F1 (empty-state acceptance branch with explicit Enzo flag E3) + M13 wording updated to "renders without error (rows or real empty state per F1)".

**Attack 3 — private-comment exposure (SUCCEEDED, plan patched).** Attack: `sys_goal_comments.comment_is_private` exists (000037:387); a naive `listCommentsByGoal` (and the timeline merge) would surface private comments to every `goal:read` holder and to the ESS subject — a disclosure the schema clearly intended to prevent, and a product call nobody made. Patch produced: hard filter `comment_is_private = false` in BOTH repo paths (M3, M5), no `isPrivate` field in the shared schema (M2), an M6 fixture with one private comment asserting its absence, and R8+E1 recording the row count and routing the exposure policy to Enzo.

### Independent adversarial review 2026-07-06 (REVIEW-12)

Reviewer verdict: **CONDITIONAL PASS as-written → PASS after 4 patches** (all applied below). 20 spot-checks against the repo: 18 exact, 2 line-drift only; the "zero migrations" claim **independently CONFIRMED** on 4 axes (permissions, schema, D-51 gate, test-coupling).

- **H1 (HIGH, applied)** — M6.3's "extend existing file **or** sibling" was a poisoned judgment call: a same-file tommaso-goal fixture is visible under D-52 per-FILE rollback and detonates `me-career-tabs.integration.test.ts:47` `expect(body.total).toBe(4)` → M6.3 rewritten as NEW SIBLING FILE ONLY + fork F6-bis added (never edit the `toBe(4)` for this mission).
- **M1 (MEDIUM, applied)** — §2 PSQL template pointed at db `heuresys` instead of `heuresys_advanced`; 12 recon commands + V1/V2 would FATAL at mission start and mimic ABORT A2 → template corrected (single `$PSQL` definition feeds every command block).
- **M2 (MEDIUM, applied)** — M11 asserted testid `goals-timeline-event`, unbuildable with the real `Timeline({events, className, emptyMessage})` API (events rendered internally, no per-event slot) → M7 now mandates container testids `goals/okrs-timeline-events` + `career-goal-timeline-events`; M11, §1.5, §1.7 aligned.
- **M3 (MEDIUM, applied)** — the 4th attack this record had missed: `listOkrCheckIns` cloned from `listKeyResults` gates only on the OKR **owner**, so `check_in_subject_user_id` rows (per-person EVALUATION notes/blockers/confidence) leak outside the actor's org sub-tree — I18 tension → E4 v1 rule (NULL the subject when `canReadOrgTarget` is false, keep the row) wired into M4 + M6.2 assert + ENZO item E4 (hide-vs-null is his call).
- **M4 (MEDIUM, applied)** — M6.2 okr fixture under-specified vs the NOT NULL surface (000037:482-489, :634) → minimal INSERT column lists pinned to avoid a 23502 loop.
- **L1 (LOW, applied)** — 3 line pins drifted: `data-classes.ts` 65-66, `okrs/service.ts` 36-41, `goals/routes.ts` 15-25 → corrected in §1.3/§1.4/M4.
- **L2 (LOW, applied)** — §1.4 suite baseline was the stale S1015 delta (186 files) → updated to 189 files per SoT S1016; M10/V7 already gated ≥189.
- **L3 (LOW, applied)** — the gold-pattern header carries a stale `(password Admin#PassW0rd!)` pre-F-001 fragment; M6 now forbids cloning it and flags the 10-file residue to Enzo in the report.
- **I1 (INFO, no change)** — 000037 self-titles "Migration 000035" in its header; cosmetic gap already documented in CLAUDE.md, no A2 impact.
- **I2 (INFO, no change)** — "zero D-12/D-38 exposure" independently confirmed: 000142 assert is a floor, org-gate test is taxonomy-derived, no test counts goal/okr permissions.

## 8. SELF-GRADE (SUCCESS.md)

**Reviewer verdict (REVIEW-12, 2026-07-06, independent)**: **CONDITIONAL PASS as-written (5/8 pieni, 3 condizionali, 0 irrimediabili) → PASS after the 4 patches (H1+M1+M2+M3/M4)**, all applied in this revision. The grades below are the post-patch state; where the reviewer downgraded the original claim, the gap is named.

1. **Expected observation per move** — PASS (reviewer-confirmed): every M0-M14 states what you should see; the statically-verifiable expectations checked out exact (167/000169, testids, personas, floor>=8).
2. **Failure + cause + counter-move per move** — PASS (was "PASS con gap"): the review found two missing failure modes — the okr-fixture NOT NULL cascade and the `toBe(4)` mine — now covered by the M6.2 column lists (M4 patch) and F6-bis (H1 patch).
3. **Forks with triggers** — PASS (was **FAIL → patchable**): M6.3's "existing file **or** sibling" was a judgment call with a poisoned branch (H1); it is now a single forced branch (sibling file only) + F6-bis trigger. F1-F8+F6-bis are all "IF observed X → route Y"; open product questions are Enzo flags (E1-E4), per the mission's authority rule.
4. **RECON NEEDED with exact checks** — PASS (was "PASS con difetto"): R1-R12 literal and correct, and the PSQL template now points at `heuresys_advanced` (M1 patch) so the recon no longer FATALs at the first command.
5. **Abort conditions** — PASS (reviewer-confirmed): A1-A8 correct; A3/A4 independently confirmed non-triggerable by the review's §3 zero-migrations verification.
6. **Verification spelled out** — PASS (was "PASS con difetto"): V1-V13 solid; the V8/M11 timeline testid is now buildable as written (container `*-timeline-events`, M2 patch).
7. **Red-team pass recorded** — PASS (was "PASS incompleto"): three original attacks plus the review's 4th (okr check-in subject leak, M3) — now recorded with its patch (E4 rule) in the RED-TEAM RECORD's review subsection.
8. **Executable blind** — PASS (was CONDITIONAL): the four blockers the reviewer identified (H1/M1/M2/M4) each generated a wrong turn or a question for a mid-tier executor; all four are patched. Remaining creative latitude is visual composition inside `goal-timeline.tsx` (F5 fallback) — a style choice, not a question. Product decisions stay fenced off as report items (E1-E4).
