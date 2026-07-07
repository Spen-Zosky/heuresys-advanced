# WARGAME 11 — heuresys-advanced #27 A/L2: evidence layer ("the proofs under the scores")

- **Mission**: implement backlog item **#27 A/L2 — evidence layer** in `heuresys-advanced`. Expose ~5.3k dormant evidence rows (assessment/learning evidence, 360, continuous feedback, behavioral, review ratings, KPI results) as read-only "why this score" drill-downs on the insights/gaps/reviews surfaces + ESS self-scope under `/v1/me/*`. i18n it+en. SENSITIVE data → data-class taxonomy extension + `config.orgGate` on every new read route (D-51 boot-gate) + `*-scope` tests (S1013 pattern), expectations derived live.
- **Executor**: Claude Code CLI (Sonnet/Opus) on the heuresys-advanced repo — `D:\heuresys-advanced` (Windows) or `/home/ubuntu/heuresys-advanced` (VM).
- **Date wargamed**: 2026-07-06 (recon evidence dated same day; repo HEAD at recon ≈ S1016 `2397eb0a`).
- **Sources of truth to RE-READ at execution time, in this order (the SoT wins over this plan on every count)**:
  1. `docs/kb/SOT_STATE.md`
  2. `docs/kb/SOT_BACKLOG.md` (item #27, line ~68)
  3. `docs/kb/DEBT_REGISTER.md`
  4. `.handoff/STATE.md`
  5. `docs/product/DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md` §L2 + §2-bis + §3 (doc of record)
  6. `CLAUDE.md` (project root) — module 7-step pattern §"The module pattern", invariants I1–I21, canonical commands
- **Binding constraints (verbatim from the brief)**: D-51 boot-gate (`apps/api/src/lib/scope/gate.ts`), D-52 per-file transactional test isolation, D-12 twice-run-idempotent migrations, D-38 scope-asserts-by-owned-codes (never resource-wide counts), RD-08 varchar+CHECK, live verification on www.heuresys.com with a real login. Product/scope decisions = Enzo's authority.

---

## 1. RECON FINDINGS (verified vs assumed)

### 1.1 VERIFIED — the evidence tables (DDL read from migrations)

All eight tables already exist. **Zero schema migration is needed** — only a permission-seed migration.

| Table | Defined in | Subject (person) column | Tenant column | Notes |
|---|---|---|---|---|
| `sys.sys_user_assessment_evidence` | `db/migrations/000006_user_profiles_and_evidence.sql:329` | `user_assessment_evidence_user_id` NOT NULL | `user_assessment_evidence_tenant_id` | dimension varchar(128), score numeric(5,2), narrative text, `..._assessor_user_id` nullable |
| `sys.sys_user_learning_evidence` | `000006:268` | `user_learning_evidence_user_id` NOT NULL | `user_learning_evidence_tenant_id` | |
| `sys.sys_person_evidence_records` | `000006:173` | `person_evidence_record_user_id` NOT NULL | `person_evidence_record_tenant_id` | `person_evidence_recorded_by` nullable, index on (user_id, recorded_at DESC) |
| `sys.sys_behavioral_assessments` | `000017_assessment_gap_model.sql:79` | `behavioral_assessment_user_id` NOT NULL | `behavioral_assessment_tenant_id` | competency varchar(255), score numeric(5,2), `..._evidence_payload` jsonb |
| `sys.sys_performance_review_competency_ratings` | `000065_sdbi_perf_feedback_schema.sql:191` | `rating_subject_user_id` **NULLABLE** | `rating_tenant_id` | `rating_review_id` NOT NULL FK→`sys_performance_reviews(review_id)` CASCADE; self/manager rating+comment, `rating_self_evidence text[]`, KSABA dimension CHECK |
| `sys.sys_feedback_360_responses` | `000065:259` | `response_target_user_id` **NULLABLE** | `response_tenant_id` | `response_reviewer_user_id` nullable, **`response_is_anonymous` boolean DEFAULT true**, immutable event log (no updated_at) |
| `sys.sys_continuous_feedback` | `000065:321` | `feedback_to_user_id` **NULLABLE** | `feedback_tenant_id` | `feedback_from_user_id` nullable, **`feedback_visibility` varchar(20) NOT NULL DEFAULT `'PRIVATE'`** CHECK ('PRIVATE','MANAGER','TEAM','PUBLIC') (000065:331,348-349), **`feedback_is_private` boolean NOT NULL DEFAULT `false`** (000065:332) — two INDEPENDENT columns: `visibility` drives row exposure, `is_private` drives author masking (REVIEW-11 C1); immutable event log |
| `sys.sys_kpi_assessment_results` | `000015_kpi_model.sql:218` | `kpi_assessment_result_user_id` **NULLABLE** (may be position-scoped via `..._position_id`) | `kpi_assessment_result_tenant_id` | FK→`sys_kpi_definitions`, score numeric(8,4), payload jsonb |

Row counts from the doc of record (dated 2026-07-05 — **evidence, not SoT; re-derive live**, dossier rule T2): 1560 / 1434 / 237 / 465 / 465 / 390 / 474 / 248 ≈ 5.3k.

Related fact: `sys.sys_nine_box_grid` **exists as a VIEW** over `sys_performance_reviews` (`000065`, §5) — the dossier's "NON esiste" note refers to a *table*; irrelevant to L2, do not touch.

### 1.2 VERIFIED — authorization plumbing (ADR-0027)

- **Taxonomy**: `apps/api/src/lib/scope/data-classes.ts` — `RESOURCE_DATA_CLASS` map (lines 45–70), keys are RBAC `auth_permission_resource` values. EVALUATION class already holds `assessment`, `kpi`, `goal`, `okr`, `career_succession`, `predictions`, `insights`. **`evidence` is NOT in the map** — the mission adds it.
- **Boot-gate D-51**: `apps/api/src/lib/scope/gate.ts` — `onRoute` collector reads permission codes exposed by `requirePermission`; `onReady` throws `ORG_GATE_MISSING` if a read route (verbs `read|view|list`, gate.ts:32) on a sensitive resource lacks `config.orgGate ∈ {"service","catalog","aggregate"}` (gate.ts:27–29, 111–123). Codes containing `self` are exempt (gate.ts:79). Resource = `code.split(":")[0]` (gate.ts:74–77).
- **Resolver**: `apps/api/src/lib/scope/resolver.ts` — `resolveOrgReadScope` (line 58, returns `all | tenant | subtree{userIdAllowList} | self`), `canReadOrgTarget` (line 89). `HR_MANDATED_ROLES = {TENANT_ADMIN, HRMS_MANAGER}` (line 26), `MANAGERIAL_ROLES = {MANAGER, CEO}` (line 44). Audit is built into the resolver (F6) — no extra wiring.
- **F3 pattern in production**: `apps/api/src/modules/insights/routes.ts` — every sensitive GET carries `config: { orgGate: "service" }` + `requirePermission("insights:view")` (lines 26–44); service layers `userIdAllowList` onto list SQL (`= ANY($n::uuid[])`) and per-target uses `canReadOrgTarget` → `NotFoundError` (404, not 403) on deny.
- **DRIFT test**: `apps/api/test/scope-data-classes.integration.test.ts:28–32` — **every key of `RESOURCE_DATA_CLASS` must exist as `auth_permission_resource` in `sys.sys_auth_permissions`**. Consequence: the permission migration MUST be applied before editing `data-classes.ts` is testable. This orders the moves (M2 before M3).
- **Gate coverage test**: `apps/api/test/org-gate.integration.test.ts` (S1015) derives the asserted surface from the taxonomy — the new `evidence` resource is asserted automatically, no test edit needed there.

### 1.3 VERIFIED — S1013 scope-test pattern (the template to replicate)

`apps/api/test/insights-scope.integration.test.ts` (250 lines) — 11 sibling `*-scope` suites exist (ls of `apps/api/test/`). The pattern:
- Personas: `paolo.caputo@rtl-bank.org` (MANAGER; tommaso is his report), `tommaso.fiore@` (USER, in subtree), `antonio.parisi@` (USER, org peer/OUTSIDER), `federica.marchetti@` (TENANT_ADMIN, HR mandate), `admin@heuresys.com` (PLATFORM_ADMIN). Password via `TEST_PERSONA_PASSWORD` from `test/helpers/personas.ts` (env-driven, F-001 — **never** hardcode).
- Asserts are **invariants, not counts**: allowed-manager GET-by-id → 200; outsider GET-by-id → **404 `NOT_FOUND`** (existence-hiding); outsider absent from list; HR-mandate → 200 tenant-wide; plain USER without the admin perm → 403.
- Every user id comes from the live login response; fixtures (if any) created in `beforeAll` — D-52 rolls the whole file back.

### 1.4 VERIFIED — the surfaces

- **Admin web pages** (all `"use client"`, TanStack Query + `apiFetch` from `@/lib/api/fetch`):
  - `/insights` → `apps/web/src/app/(authenticated)/insights/page.tsx`, namespace `admin`, already keeps a `selected: FlightRiskScore | null` row state (line ~30) — natural drill-down anchor.
  - `/insights/skill-gap` → `.../insights/skill-gap/page.tsx`, namespace `admin`, fetches `/v1/insights/skill-gap`.
  - `/gaps` → `.../gaps/page.tsx`, namespace `hr`, fetches `/v1/learning-gaps?limit=200`; rows carry `userId`.
  - `/users/[userId]` → `.../users/[userId]/page.tsx`, namespace `admin`, fetches `/v1/users/${userId}` — the per-person "reviews" surface per dossier §2-bis (there is **NO dedicated admin reviews page** — verified by page enumeration; see FORK F2).
- **ESS**: `/me/gaps` → `.../me/gaps/page.tsx`, namespace `ess`, fetches `/v1/me/gaps` (route `apps/api/src/modules/me/routes.ts:175`, perm `gap_analysis:read:self`). `/v1/me/performance` already reads `sys_performance_reviews` (`sys_performance_reviews.review_subject_user_id` is the person key — see `me/repository.ts:387` which filters on it in a **flat SELECT**, no join, no COALESCE; likewise :569; the ratings→reviews JOIN itself is **NEW code**, modeled on the FK `sys_prcr_review_fk` in 000065 — REVIEW-11 C2) — the only existing code touching any L2-adjacent table.
- **me module**: 43 routes, dedicated module (ADR-0011: never add `/me/*` to business modules). Self perms pattern: `goal:read:self` seeded in `000166` and granted to `PLATFORM_ADMIN, TENANT_ADMIN, READ_ONLY, USER`.
- **i18n**: namespaces = `apps/web/src/locales/{it,en}/{admin,analytics,blueprints,common,demo,ess,hr,investors,landing,shell}.json`. Parity checker: `pnpm i18n:check` (root script → `apps/web/scripts/check-i18n-parity.ts`). Parity count at S1016 = 1745 (grows; pass = exit 0, not a number).

### 1.5 VERIFIED — module pattern, migration pattern, gates, deploy

- **7-step module pattern** (CLAUDE.md §"The module pattern", mandatory): shared Zod schemas (+ subpath export in `packages/shared/package.json`) → `repository.ts` raw parameterized SQL → `service.ts` scope logic on `ActorContext` → `routes.ts` `FastifyPluginAsyncZod` + `requirePermission` + typed errors → register in `apps/api/src/app.ts` step 13 (`insightsRoutes` at app.ts:427, `learningGapsRoutes` at app.ts:378 are the models) → integration test via `buildTestApp()` → 100% green + atomic commit.
- **Permission-seed migration template**: `db/migrations/000166_me_goals_self.sql` — `INSERT ... WHERE NOT EXISTS` for the permission, `INSERT ... CROSS JOIN ... AND NOT EXISTS` for role grants, `DO $$ ... RAISE NOTICE` verification **scoped by owned codes** (D-38: never `count(*) WHERE resource='x'` assertions). `insights:view` audience precedent: `000083_insights_permission_seed.sql:28` — exactly 6 roles: PLATFORM_ADMIN, TENANT_ADMIN, BLUEPRINT_MANAGER, HRMS_MANAGER, PROCESS_OWNER, MANAGER (NO CEO — REVIEW-11 M1); excludes USER/READ_ONLY. ⚠️ 000083 also carries an EQUALITY assert (`IF v <> 2 THEN RAISE EXCEPTION`, 000083:43) — the anti-pattern this plan bans: take ONLY the audience list from 000083, take guard + assert style from 000166/000142 (floor form `IF v < N`, 000142:43) — REVIEW-11 m3.
- **Migrations on disk at recon**: 167 files, max `000169` (gaps 000035, 000139 cosmetic). **Re-derive live** (`ls db/migrations/*.sql | tail -1`).
- **12 RBAC roles**: PLATFORM_ADMIN, TENANT_ADMIN, BLUEPRINT_MANAGER, HRMS_MANAGER, PROCESS_OWNER, MANAGER, USER, READ_ONLY, CEO, TEAM_LEADER, TEAM_MEMBER (+1 — count per SOT_STATE, 156 perms / 698 maps at S1016).
- **Canonical commands** (CLAUDE.md §Canonical commands): `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check`, `pnpm db:migrate:sh` (idempotent), `cd apps/api && pnpm test` (full suite, single-thread, real DB via tunnel `localhost:5433`, per-file tx isolation D-52), `cd apps/api && pnpm typecheck:test`, `cd apps/web && pnpm test:e2e:prod` (Node ≥23 → `test:e2e:prod:node22`, D-36).
- **Deploy**: `bash scripts/vm-deploy.sh` (migrate + shared→api→web rebuild + restart + `/readyz` retry-45). CI: 9 workflow files in `.github/workflows/` (build-web, i18n-parity, lint, playwright-smoke, shell-tests, showcase, state-lint, test-integration, typecheck); some are path-gated → "CI 6/6" vs "7/7" in SoT deltas = how many trigger. Pass = **every run triggered on the commit is green**.
- **Known operational trap** (S1016 lesson, SOT_STATE delta): local E2E login rate-limit **10/5min** — repeated setup runs exhaust it; wait the window.
- **D-52 deltas** (CLAUDE.md §Tests): `now()` frozen per test file; `beforeAll` fixtures rolled back at file end; direct write statements run in serialized savepoints. Escape hatch `TEST_TX_ISOLATION=0` (don't use it).

### 1.6 ASSUMED (not settled by recon — each becomes RECON NEEDED below)

- A1: live row counts per table **per tenant** (dossier numbers are global, dated 2026-07-05).
- A2: the S1013 personas (tommaso, antonio) have rows in at least one evidence table.
- A3: `rating_subject_user_id` is populated (it's nullable; may need the `rating_review_id → sys_performance_reviews.review_subject_user_id` join instead — **NEW code**: no such join exists anywhere yet (`me/repository.ts:387` is a flat SELECT filtering on `review_subject_user_id`); model it on the FK `sys_prcr_review_fk` in 000065).
- A4: `feedback_to_user_id` / `response_target_user_id` null fractions are low enough that person-keyed exposure covers most rows.
- A5: no in-flight parallel work has consumed migration number `000170`.

---

## 2. RECON NEEDED (exact check for each; run at execution time)

**Executor-settleable** (run in M0/M1, before writing any code):

| # | Assumption | The exact check that settles it |
|---|---|---|
| R1 | Live migration max | `ls db/migrations/*.sql \| sort \| tail -1` → new file = that number + 1 |
| R2 | Live row counts per table per tenant | `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT 'assessment_ev', user_assessment_evidence_tenant_id, count(*) FROM sys.sys_user_assessment_evidence GROUP BY 2 UNION ALL SELECT 'learning_ev', user_learning_evidence_tenant_id, count(*) FROM sys.sys_user_learning_evidence GROUP BY 2 UNION ALL SELECT 'person_ev', person_evidence_record_tenant_id, count(*) FROM sys.sys_person_evidence_records GROUP BY 2 UNION ALL SELECT 'behavioral', behavioral_assessment_tenant_id, count(*) FROM sys.sys_behavioral_assessments GROUP BY 2 UNION ALL SELECT 'review_ratings', rating_tenant_id, count(*) FROM sys.sys_performance_review_competency_ratings GROUP BY 2 UNION ALL SELECT 'f360', response_tenant_id, count(*) FROM sys.sys_feedback_360_responses GROUP BY 2 UNION ALL SELECT 'cont_fb', feedback_tenant_id, count(*) FROM sys.sys_continuous_feedback GROUP BY 2 UNION ALL SELECT 'kpi_res', kpi_assessment_result_tenant_id, count(*) FROM sys.sys_kpi_assessment_results GROUP BY 2 ORDER BY 1,2"` |
| R3 | Personas have evidence rows (drives the scope test + live demo) | Same psql, e.g. `SELECT count(*) FROM sys.sys_user_assessment_evidence e JOIN sys.sys_users u ON u.user_id = e.user_assessment_evidence_user_id WHERE u.user_email IN ('tommaso.fiore@rtl-bank.org','antonio.parisi@rtl-bank.org') GROUP BY u.user_email` — repeat per table. If 0 for both → FORK F6 |
| R4 | `rating_subject_user_id` populated? | `SELECT count(*) FILTER (WHERE rating_subject_user_id IS NULL) AS nulls, count(*) AS total FROM sys.sys_performance_review_competency_ratings` — if nulls > 0 → FORK F3 (join path) |
| R5 | Null subject fractions on cont. feedback / 360 / kpi results | `SELECT count(*) FILTER (WHERE feedback_to_user_id IS NULL), count(*) FROM sys.sys_continuous_feedback` (same shape for `response_target_user_id`, `kpi_assessment_result_user_id`). Rows with NULL subject are **excluded** from person-keyed endpoints (documented in the module header) — no fork, just record the numbers |
| R5b | Continuous-feedback visibility distribution (drives E2) | `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT feedback_visibility, feedback_is_private, count(*) FROM sys.sys_continuous_feedback GROUP BY 1,2 ORDER BY 1,2"` — record the numbers; they drive E2 (REVIEW-11 C1: `visibility` DEFAULTs to 'PRIVATE' while `is_private` DEFAULTs to false — never assume either) |
| R6 | No admin reviews/assessments page hiding somewhere | PowerShell: `Get-ChildItem -Recurse apps/web/src/app -Filter page.tsx \| Select-String -Pattern "performance_review", "reviews" -List` (comma = OR — the old single-pattern `"a\|b"` form matches a LITERAL pipe in .NET regex and can never fail, REVIEW-11 M3). Bash/VM: `grep -rlE "performance_review\|reviews" apps/web/src/app --include=page.tsx`. Expected: none → FORK F2 default holds |
| R7 | i18n parity baseline green before starting | `pnpm i18n:check` → exit 0 |
| R8 | CI baseline green at HEAD before starting | `gh run list --limit 10` → latest runs on origin/main all green |
| R9 | Full API suite green at HEAD before starting (baseline) | `cd apps/api && pnpm test` → 0 fail (at S1016: 189 files / ~1285 tests, 2 pre-existing skips) |

**Enzo-personal** (product authority — the plan encodes a REVERSIBLE DEFAULT for each so the executor can run blind; the defaults are flagged for ratification in the handoff/register note, and each is a single-migration or single-diff reversal):

| # | Decision | Default encoded in this plan | Why reversible |
|---|---|---|---|
| E1 | Audience of the new `evidence:read` admin permission | Mirror `000083` EXACTLY: the **6 roles** PLATFORM_ADMIN, TENANT_ADMIN, BLUEPRINT_MANAGER, HRMS_MANAGER, PROCESS_OWNER, MANAGER (`000083:28`); **exclude USER/READ_ONLY** (D-6 analog). **CEO is deliberately NOT granted** (same as insights:view — flag for Enzo: CEO is managerial in `resolver.ts:44` but has no `evidence:read`; he will 403 on `/v1/evidence` like he does on `/v1/insights`). NB: copy the exact role list from `000083_insights_permission_seed.sql` at execution time | one follow-up grant/revoke migration |
| E2 | Visibility of PRIVATE continuous feedback + author identity | Admin/org endpoints **EXCLUDE rows with `feedback_visibility = 'PRIVATE'` entirely** (recipient-only by design; they remain visible on `/v1/me/evidence` to the recipient). Rows with visibility IN ('MANAGER','TEAM','PUBLIC') are included; **author is nulled when `feedback_is_private = true` OR `visibility = 'PRIVATE'`**. Flagged default awaiting Enzo's ratification (R5b numbers drive it) | one SQL WHERE/CASE change |
| E3 | Dedicated "Le mie evidenze" page vs panels in existing pages | **No new route, no `sys_ui_interfaces` migration**: evidence panels inside `/me/gaps` (drill-down per gap subject = self) and a per-category listing reachable from the same page. A dedicated `/me/evidence` page is deferred to Enzo | additive later |
| E4 | The "reviews" drill-down surface | `/users/[userId]` per dossier §2-bis (no admin reviews page exists) + ESS side `/me` Performance tab already exists (untouched) | additive later |

**Hard rule (NOT a decision, encode as written)**: anonymous 360 responses (`response_is_anonymous = true`, the default) must expose `reviewer: null` in every response body, on every endpoint, for every role including PLATFORM_ADMIN. For rows with `response_is_anonymous = true`, suppress `response_relationship_type` as well (label = generic "360 feedback"); anonymity means **no field in the body may narrow the reviewer's identity** — not just the author field (REVIEW-11 M2: a `MANAGER`-labeled anonymous response de-anonymizes for any subject with one manager, and the org chart is queryable by the same viewer). This is a privacy invariant, not a product option.

---

## 3. MOVES

Numbered, sequenced. Format per move: **Action → Expected observation → Most likely failure / what it signals / counter-move.**

### M0 — Session boot + SoT alignment
**Action**: read the 4 SoT files in order (SOT_STATE → SOT_BACKLOG #27 → DEBT_REGISTER → .handoff/STATE.md), then CLAUDE.md §module-pattern + §invariants. Start tunnel if down: `ssh -fN -L 5433:localhost:5432 oracle-vm-default`; smoke `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"`.
**Expected**: #27 still ACTIVE in SOT_BACKLOG (~line 68); psql lists the `sys_auth_*` tables; `git status` clean on `main`, `git log origin/main..HEAD` empty.
**Failure**: psql refuses / tunnel dead → *signals: tunnel not up or VM unreachable* → counter: re-run the ssh line; if VM unreachable after 3 tries → ABORT-1. If #27 is no longer ACTIVE (DONE/HOLD) → *signals: someone already worked it* → ABORT-2 (flag, do not redo).

### M1 — Live recon queries (settle R1–R9)
**Action**: run the R1–R9 checks from §2. Record outputs in the session notes (they feed test design and the commit message).
**Expected**: 8 tables all non-empty globally (≈5.3k total, tolerating drift from 2026-07-05); at least one persona among tommaso/antonio has rows in ≥1 table; baseline suite/CI/i18n green.
**Failure A**: ALL 8 tables 0 rows → *signals: dossier premise invalid or wrong DB* → verify DB name/port; if confirmed empty → ABORT-3.
**Failure B**: baseline suite has reds at HEAD → *signals: pre-existing breakage* → per R3 (global rule) fix is owed, but FIRST check `gh run list`: if CI is green and local is red, suspect local env (tunnel flaps, rate-limit) → rerun failing file in isolation; if genuinely red at HEAD → fix in a separate leading commit before mission work (do not mix).
**Failure C**: personas have zero evidence rows everywhere → FORK F6.

### M2 — Migration `0001NN_evidence_permissions.sql` (NN = R1 result + 1)
**Action**: create the migration modeled on `000166` + `000083`. **Template rule (REVIEW-11 m3): take ONLY the audience list from 000083; take the guard style and assert style from 000166/000142 — do NOT copy 000083's equality assert (`IF v <> 2 THEN RAISE EXCEPTION`, 000083:43), which is the exact anti-pattern banned below.** Contents, in order:
1. Seed `evidence:read` (`resource='evidence'`, `action='read'`) with `WHERE NOT EXISTS` guard.
2. Seed `evidence:read:self` (`resource='evidence'`, `action='read:self'`) with guard.
3. Grant `evidence:read` to the E1 default audience (copy exact role list from `000083`), `CROSS JOIN ... NOT EXISTS` guard.
4. Grant `evidence:read:self` to `PLATFORM_ADMIN, TENANT_ADMIN, READ_ONLY, USER` (mirror `goal:read:self`, 000166 §3).
5. `DO $$ RAISE NOTICE` verification **by owned codes only** (D-38): count grants `WHERE p.auth_permission_code IN ('evidence:read','evidence:read:self')` — NOTICE, never an exception on exact totals; if you assert, assert a **floor** (`< expected` raises), never equality (lesson 000142/000133).
No schema DDL. No data backfill.
Then: `pnpm db:migrate:sh` **twice**.
**Expected**: run 1 → NOTICE with grant counts (evidence:read = **exactly 6 roles** per E1 list, evidence:read:self = 4); run 2 → 0 new rows, chain exits 0 both times ("N migrations applied", EXIT 0). `SELECT auth_permission_code FROM sys.sys_auth_permissions WHERE auth_permission_resource='evidence'` returns both codes.
**Failure A**: chain fails on an EARLIER migration → *signals: D-12-class regression not caused by this mission* → ABORT-4 (flag with the failing file; do not patch old migrations as a side quest).
**Failure B**: run 2 inserts again → *signals: a guard is malformed (typo in NOT EXISTS subquery)* → fix the guard, `db:migrate:sh` ×2 again until idempotent.
**Failure C**: number collision (file `0001NN` already exists after a pull) → *signals: parallel work landed* → renumber to the new max+1, re-run.

### M3 — Extend the data-class taxonomy
**Action**: edit `apps/api/src/lib/scope/data-classes.ts` — add `evidence: "EVALUATION",` in the EVALUATION block (after `insights`, line ~69) with a dated comment (`// #27 L2 evidence layer`). Then run: `cd apps/api && pnpm exec vitest run test/scope-data-classes.integration.test.ts`.
**Expected**: DRIFT test green (the `evidence` resource now exists in `sys_auth_permissions` because M2 ran FIRST). 5/5 in that file.
**Failure**: DRIFT test red "classified resource not present in DB: evidence" → *signals: M2 not applied to the DB the tests hit (wrong port/db, or you edited the taxonomy before migrating)* → verify `psql ... -c "SELECT 1 FROM sys.sys_auth_permissions WHERE auth_permission_code='evidence:read'"`; re-run M2 against the tunnel DB.
**Order is load-bearing: M2 strictly before M3 (red-team patch #1, see §7).**

### M4 — Shared schemas
**Action**: create `packages/shared/src/schemas/evidence.ts`. Shape (normalized item + per-category payloads kept honest):
- `EvidenceCategorySchema = z.enum(["assessment","learning","behavioral","person","review","feedback360","continuous","kpi"])`
- `EvidenceItemSchema`: `{ evidenceId: uuid, category, subjectUserId: uuid, tenantId: uuid, label: string, score: number|null, narrative: string|null, sourceRef: string|null, recordedAt: string, author: { userId: uuid, displayName: string } | null }` — `author` carries assessor/reviewer/from-user and is **null when anonymous/private** (hard rule + E2).
- `EvidenceSummarySchema`: `{ userId, tenantId, displayName: string|null, categories: Array<{ category, count, avgScore: number|null, lastRecordedAt: string|null }> }`
- `EvidenceListQuerySchema`: `{ category?: EvidenceCategory, limit?: number (default 50, max 200), offset?: number }` — **real pagination** (dossier §3: "paginazione vera").
- `EvidenceListResponseSchema`: `{ scope: { kind, tenantId|null }, items: EvidenceItem[], total: number }` (mirror the insights list envelope).
- Self variants can reuse the same schemas.
Export from `packages/shared/src/index.ts` AND add the subpath export `./schemas/evidence` in `packages/shared/package.json` (7-step step 1 — both, not one). Build: `pnpm --filter @heuresys/shared build`.
**Expected**: build emits `dist/schemas/evidence.{js,d.ts}`; `pnpm typecheck` still green.
**Failure**: web/api can't resolve `@heuresys/shared` new symbols later → *signals: stale `tsconfig.tsbuildinfo` (D-17 class)* → `rm -rf packages/shared/dist packages/shared/tsconfig.tsbuildinfo && pnpm --filter @heuresys/shared build`.

### M5 — API module `evidence` (the heart)
**Action**: create `apps/api/src/modules/evidence/{repository.ts,service.ts,routes.ts}` per the 7-step pattern.
- **repository.ts** — raw parameterized SQL, one query per category, each normalizing to the EvidenceItem columns. Subject predicates (verified in §1.1): `user_assessment_evidence_user_id`, `user_learning_evidence_user_id`, `person_evidence_record_user_id`, `behavioral_assessment_user_id`, `COALESCE(rating_subject_user_id, pr.review_subject_user_id)` via `JOIN sys.sys_performance_reviews pr ON pr.review_id = rating_review_id` (FORK F3 made unconditional — the join is correct even when the column is populated), `response_target_user_id`, `feedback_to_user_id`, `kpi_assessment_result_user_id`. Every category query: `WHERE <subject> IS NOT NULL` + tenant filter + optional `AND <subject> = ANY($n::uuid[])` (allowList) + `LIMIT/OFFSET` + `count(*) OVER()` or separate count. Author masking IN SQL: 360 → `CASE WHEN response_is_anonymous THEN NULL ELSE reviewer... END`, **and when anonymous also suppress `response_relationship_type`** (label = generic `'360 feedback'` — hard rule, REVIEW-11 M2); continuous → **org/admin queries add `AND feedback_visibility <> 'PRIVATE'`** (PRIVATE rows are recipient-only, E2/REVIEW-11 C1) **and mask author with `CASE WHEN feedback_is_private OR feedback_visibility = 'PRIVATE' THEN NULL ELSE from_user... END`**; the self-scope query (M6) INCLUDES PRIVATE rows addressed to the actor, same author-masking CASE (red-team patch #2 + REVIEW-11 C1). Author display name via `LEFT JOIN sys.sys_users` on the (possibly NULL-masked) author id.
  Per-category `label` mapping (do NOT invent — REVIEW-11 m1): assessment → `dimension`; learning → module name via `JOIN sys.sys_learning_modules` (FK added in 000016 — learning evidence has NO dimension/narrative of its own, 000006:268); person → `person_evidence_type`; behavioral → `competency`; review → `rating_competency_name`; feedback360 → literal `'360 feedback'` (NEVER the relationship type when anonymous); continuous → `feedback_type`; kpi → kpi name via `JOIN sys.sys_kpi_definitions`.
- **service.ts** — `list(actor, userId?, query)`: `resolveOrgReadScope(pool, actor)` → map scope kind to filters exactly like insights' service (all → no filter; tenant → tenant filter; subtree/self → `userIdAllowList`). `summary(actor, userId)` and `listForUser(actor, userId, query)`: fetch target's tenant (`SELECT user_tenant_id FROM sys.sys_users WHERE user_id=$1`), then `canReadOrgTarget(pool, actor, userId, targetTenantId)` → on false `throw new NotFoundError("Evidence not found", "NOT_FOUND")` (404 not 403 — existence hiding, insights precedent).
- **routes.ts** — `FastifyPluginAsyncZod`, read-only, **every route**: `config: { orgGate: "service" }` + `preHandler: [requirePermission("evidence:read")]`:
  - `GET /users/:userId` → EvidenceSummarySchema ("why this score" header: counts per category)
  - `GET /users/:userId/items` → EvidenceListResponseSchema (query: category/limit/offset)
  No POST/PATCH/DELETE. No CSRF needed (no writes).
- **app.ts** — import + `await app.register(evidenceRoutes, { prefix: "/v1/evidence" });` at step 13, alphabetically near insights (app.ts:427 vicinity).
Boot check: `cd apps/api && pnpm dev`, watch for the RBAC cache line and NO `ORG_GATE_MISSING`.
**Expected**: server boots; `curl -s localhost:3001/v1/evidence/users/00000000-0000-4000-8000-000000000000 -o /dev/null -w "%{http_code}"` → `401` (unauthenticated).
**Failure A**: boot dies with `ORG_GATE_MISSING: ... evidence:read` → *signals: a route missed `config.orgGate`* → this is the gate doing its job; add the declaration to the listed route. (If the violations list names routes from OTHER modules → ABORT-5: the taxonomy edit had blast radius beyond mission scope.)
**Failure B**: boot dies with `RBAC_NOT_LOADED` or the route 403s for an admin persona → *signals: permission cache predates M2* → restart the API (cache loads at boot), confirm `mappingsLoaded` grew vs SOT_STATE count.
**Failure C**: Zod response serialization error at first real call → *signals: DB column type mismatch (e.g. numeric returned as string by pg)* → cast in SQL (`::float8`) or coerce in schema (`z.coerce.number()`), the `potentialRating` varchar lesson (S1010) says check the actual value first with psql.

### M6 — ESS self endpoints in the `me` module
**Action**: extend `apps/api/src/modules/me/{routes.ts,service.ts,repository.ts}` (ADR-0011: self routes live HERE, not in the evidence module):
- `GET /v1/me/evidence` → summary, `preHandler: [requirePermission("evidence:read:self")]`
- `GET /v1/me/evidence/items` → list with category/limit/offset, same perm.
Service pins subject to `actor.userId` (I17) — no scope resolution, no userId param. **Continuous-feedback semantics differ from the admin path (E2/REVIEW-11 C1): `/v1/me/evidence` INCLUDES rows with `feedback_visibility = 'PRIVATE'` addressed to the actor (recipient-only by design), with the same author-masking CASE — the repository must expose a self variant (or flag) that skips the org-path `feedback_visibility <> 'PRIVATE'` exclusion.** Reuse the evidence repository functions with `userIdAllowList=[actor.userId]` + the actor's tenant (import from the evidence module repository — precedent: cross-module reuse is fine at repository level; if the codebase style objects, re-declare the two queries locally).
**Expected**: gate ignores these routes (code contains `:self`, gate.ts:79); boot stays green; `curl` unauth → 401.
**Failure**: 403 for tommaso after login → *signals: `evidence:read:self` grant missing for USER* → check M2 §4 grant block executed (psql the role_permissions join); re-run migration.

### M7 — Integration tests (three files)
**Action**:
1. `apps/api/test/evidence.integration.test.ts` — module behavior: 401 unauth; 403 for a role outside the E1 audience (tommaso on `/v1/evidence/...`); 200 + envelope shape for federica; category filter works; pagination works; **anonymity invariant**: query the DB in-test for an anonymous 360 row in scope (`SELECT ... WHERE response_is_anonymous = true LIMIT 1`), fetch it through the API, assert `author === null` **AND that no field in the returned item carries `response_relationship_type`** (label must be the generic `'360 feedback'` — REVIEW-11 M2) (skip-if-none with a logged reason, but R5 said 390 rows exist and default is true — expect present); **privacy-visibility invariant (REVIEW-11 C1)**: query the DB in-test for a `feedback_visibility = 'PRIVATE'` continuous-feedback row with a known recipient, then assert via API that it does NOT appear in federica's admin list (`/v1/evidence/users/:recipient/items?category=continuous`) but DOES appear in the recipient's `/v1/me/evidence/items`.
2. `apps/api/test/evidence-scope.integration.test.ts` — clone the S1013 pattern from `insights-scope.integration.test.ts` §1.3: paolo→tommaso GET summary 200; paolo→antonio → **404 NOT_FOUND**; antonio absent from paolo's `/users/:id/items` reachable set (list is per-target here, so the list assert is: paolo's fetch of tommaso's items 200, of antonio's items 404); federica tenant-wide 200; admin cross-tenant 200; tommaso (USER, no `evidence:read`) → 403 even on himself via the admin route, 200 via `/v1/me/evidence`. **Expectations derived live**: in `beforeAll`, if tommaso has zero rows in every table (R3 red), INSERT one `sys_user_assessment_evidence` row for tommaso and one for antonio via `pool.query` (D-52 savepoints + file rollback make this residue-free) — ids from the live login responses, never hardcoded. **Fixture rows MUST be inserted inside the test file via `pool.query` (D-52 rolls them back; singleThread means no other file observes them). NEVER seed fixtures via psql and NEVER set `TEST_TX_ISOLATION=0` — `sdbi-perf-feedback.integration.test.ts:24-26,109-114` and `reconciliation-learning-rehome.integration.test.ts:81` assert EXACT row counts on 4 of the 8 evidence tables and will break on any committed residue (REVIEW-11 M4).**
3. `apps/api/test/me-evidence.integration.test.ts` — tommaso 200 on `/v1/me/evidence` + every returned item has `subjectUserId === tommaso.userId`; antonio's rows never appear.
Run each file in isolation, then the FULL suite: `cd apps/api && pnpm test`.
**Expected**: 3 new files green; full suite **0 fail** (files ≈ 192, tests > 1285; exact numbers re-derived — never asserted).
**Failure A**: cross-tree returns 200 → *signals: service skipped `canReadOrgTarget` or trusted the tenant filter (the exact D-50 leak class)* → fix service, not the test.
**Failure B**: fixture INSERT aborts the file transaction → *signals: FK violation (bad tenant/user id) under the D-52 savepoint* → the savepoint serialization preserves semantics; fix the fixture ids (read them from `sys_users` first).
**Failure C**: full suite flaky on login rate-limit → wait 5 min (10/5min window), re-run only the failed file; if it passes in isolation twice, re-run full suite once more.

### M8 — Web drill-down UI
**Action**: one shared component + four wirings + i18n.
1. `apps/web/src/components/evidence-panel.tsx` — client component, props `{ userId: string, self?: boolean, title?: string }`. Fetches summary (`/v1/evidence/users/${userId}` or `/v1/me/evidence`) then items per selected category (TanStack Query, keys `["evidence", userId, category]`). Renders: category count chips → item list (label, score, recordedAt, narrative, author-or-"anonymous"). Compose ONLY `@heuresys/ui` primitives (Card, Badge, Button, EmptyState) + existing `DataTablePanel` — dossier §3. Empty state = real `EmptyState`, no mock rows. **Render nothing (return null) on 403** — viewers without `evidence:read` (page perm ≠ evidence perm) must not see a broken panel; use `useCurrentUserPermissions()` and check `evidence:read` (or `evidence:read:self` for self mode) before fetching (red-team patch #3).
2. `/insights/page.tsx`: inside the existing `selected` detail area, add `<EvidencePanel userId={selected.userId} />` under a "Perché questo score" heading.
3. `/insights/skill-gap/page.tsx`: add row-select (mirror the insights page's `selected` state) + panel.
4. `/gaps/page.tsx`: rows carry `userId` — add row click → panel for that subject.
5. `/users/[userId]/page.tsx`: new "Evidenze" section with the panel (the "reviews" surface, FORK F2 default).
6. `/me/gaps/page.tsx`: `<EvidencePanel self />` section ("Le mie evidenze", E3 default).
7. i18n: add every new string to `admin.json` (insights + users pages), `hr.json` (gaps), `ess.json` (me/gaps) in BOTH `locales/it/` and `locales/en/`. Keys namespaced `evidence.*`. Run `pnpm i18n:check`.
8. (Optional, in-scope-adjacent — REVIEW-11 m2): `/insights/succession-readiness/page.tsx` exists with the same `selected` drill-down state (line 39) but is NOT among the doc-of-record's 5 surfaces (`DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md:72`). Add the panel there ONLY if zero marginal risk; not demanded by the doc of record — skipping it is fully compliant.
**Expected**: `pnpm --filter @heuresys/web build` green; `pnpm i18n:check` exit 0; dev-mode click a row on /insights with an admin login → panel shows real rows.
**Failure A**: i18n parity fails → *signals: a key added to one language only* → the checker output names the key; add the twin.
**Failure B**: panel renders but empty for every subject in dev → *signals: subject-column mismatch or tenant filter wrong (querying HEURESYS tenant while browsing RTL)* → psql the exact SQL from repository.ts with the browsed user's id; compare tenant ids.
**Failure C**: build fails on `@heuresys/shared` types → D-17 counter-move from M4.

### M9 — Full gate battery (local)
**Action**, in order: `pnpm typecheck` (all ws) → `cd apps/api && pnpm typecheck:test` → `pnpm lint` → `pnpm i18n:check` → `cd apps/api && pnpm test` (full) → `pnpm --filter @heuresys/web build` → targeted E2E: extend or add ONE Playwright spec in `apps/web/tests/e2e/` (pattern: existing specs there, e.g. `auth.spec.ts`, `admin-tabs.spec.ts` — NOT `apps/web/e2e/`, which does not exist; confirm placement with: `grep -n "testDir" apps/web/playwright.config.ts` → `"./tests/e2e"` — a spec outside `testDir` is never executed and `--grep` finds no tests, REVIEW-11 C3) asserting: login as admin persona → /insights → select row → evidence panel visible with ≥1 item OR real empty-state; run it with `pnpm test:e2e:prod` scoped to the spec (`--grep`), Node22 wrapper if on Windows Node ≥23 (D-36).
**Expected**: every gate exit 0; suite 0 fail.
**Failure**: any red → R3: fix ALL, including ones you didn't cause (but see M1-Failure-B for the separate-commit rule); 2+ failed attempts on the same red → change approach, re-read the failing module (R14), don't brute-force.

### M10 — Atomic commit + push + CI
**Action**: ONE atomic commit for the module work (precedent #25 `e22dcdb7` shipped API+web+i18n+tests together): `feat(api+web): #27 A/L2 — evidence layer (evidence module 2+2 endpoints, me self-scope, drill-down panels on insights/skill-gap/gaps/users/me-gaps, mig 0001NN perms, 3 test files, i18n it+en)`. The migration file goes IN this commit (it's part of the feature; the DB already has it applied — same sequencing as every prior perm migration). Push to `origin/main` (the mission brief's DoD requires CI + deploy → push is in-scope for this mission; **the mission brief's DoD line IS the explicit ask for this session** (REVIEW-11 m4) — do not stall waiting for a second authorization; if the session has an explicit no-push standing order that conflicts → ABORT-6). Watch: `gh run list --limit 10` then `gh run watch <id>` per triggered workflow.
**Expected**: every workflow triggered by the commit goes green (test-integration, typecheck, lint, i18n-parity, build-web, playwright-smoke, state-lint at minimum — the 6/7 set; showcase/shell-tests only if paths touched).
**Failure**: CI red on a workflow that was green locally → *signals: env drift (CI DB is localhost on the runner; frozen lockfile; Node version)* → read the run log FIRST (`gh run view <id> --log-failed`), fix, new commit `fix(ci): ...` (never `--amend` after push, R12).

### M11 — Deploy + LIVE verification (the DoD)
**Action**: `bash scripts/vm-deploy.sh` (detached mode per D-49 if the script offers it — it does since S1012). Wait for its `/readyz` verification (retry-45 built in, D-48). Then live checks against `https://www.heuresys.com`:
1. `curl -s -o /dev/null -w "%{http_code}" "https://www.heuresys.com/api/v1/evidence/users/00000000-0000-4000-8000-000000000000"` → **401**
2. `curl -s -o /dev/null -w "%{http_code}" "https://www.heuresys.com/api/v1/me/evidence"` → **401**
3. Real login (browser or Playwright against www) as an HR-mandated persona (federica) → `/insights` → select a subject → **evidence panel renders real rows** (or a real empty state for a subject with 0 rows — then pick a subject that R2/R3 proved has rows).
4. Real login as tommaso (USER) → `/me/gaps` → "Le mie evidenze" shows his rows only.
Respect the login rate-limit (10/5min): 2 logins total, reuse sessions (red-team patch #4).
**Expected**: 401/401; panels render live data; no JS console errors; `/readyz` 200 `database:ok`.
**Failure A**: deploy timeout/SSH drop → *signals: D-49 class* → re-run `vm-deploy.sh` (idempotent); verify `.next` prerender-manifest exists and API restarted (`mappingsLoaded` grew).
**Failure B**: live 500 on the new endpoint → *signals: migration not applied on the VM DB by the deploy* → `vm-deploy.sh` runs `db:migrate:sh` itself; check its log; the tunnel DB and the VM DB are THE SAME database (shared, ADR-0026) so M2 already applied it — a 500 more likely means stale API dist → restart API on VM.
**Failure C**: drill-down empty on www but full in dev → *signals: you browsed the other tenant* → login persona determines tenant; use federica (RTL_BANK).

### M12 — Close: SoT + register updates
**Action**: update `docs/kb/SOT_BACKLOG.md` #27 → DONE (with commit hash, date, delivered surface list) + one-line note of the E1–E4 defaults awaiting Enzo's ratification; commit `docs(register): #27 DONE — evidence layer live`. Leave SOT_STATE/.handoff to the `handoff` skill (single-updater rule, SOT_STATE header) — do NOT hand-edit SOT_STATE counts.
**Expected**: `python docs/kb/tools/handoff_lint.py` exit 0 (if run as part of close).
**Failure**: lint complains about register format → mimic the exact format of the #25 DONE entry.

---

## 4. FORKS (explicit triggers — no judgment calls)

| Fork | Trigger (observation) | Route |
|---|---|---|
| **F1 — tenant split** | R2 shows a category with 0 rows for RTL_BANK but >0 for the other tenant | Ship the category anyway (empty state is real data); pick live-verification subjects (M11.3) from a category with RTL rows. Never seed demo rows into prod tables |
| **F2 — reviews surface** | R6 finds NO admin reviews/assessments page (expected) | Drill-down for review-competency-ratings goes on `/users/[userId]` (dossier §2-bis). If R6 DOES find such a page → add the panel there IN ADDITION, same component |
| **F3 — rating subject join** | R4 shows `rating_subject_user_id` nulls > 0 | Already unconditional in M5: subject = `COALESCE(rating_subject_user_id, pr.review_subject_user_id)` via the review join (`sys_performance_reviews.review_subject_user_id` is the person key — see `me/repository.ts:387` which filters on it; the ratings→reviews JOIN itself is NEW code, modeled on the FK `sys_prcr_review_fk` in 000065). If R4 shows 0 nulls, keep the COALESCE anyway (harmless) |
| **F4 — gate fires on foreign routes** | M5 boot failure lists routes NOT under `/v1/evidence` or `/v1/me/evidence` | ABORT-5 — taxonomy blast radius beyond mission (means some existing module has un-gated reads on a resource named `evidence`, or the map edit touched another key). Do not annotate other modules' routes to make boot pass |
| **F5 — suite red at baseline** | M1/R9 shows failures at HEAD before any edit | Isolate: rerun failed file alone ×2. Passes → env flake, proceed. Fails → fix in a SEPARATE leading commit (R3), then restart from M2 |
| **F6 — personas have no evidence rows** | R3 returns 0 for both tommaso and antonio across all 8 tables | In `evidence-scope` `beforeAll`, INSERT one assessment-evidence row each for tommaso and antonio (ids from login responses, tenant from `sys_users`); D-52 rolls back at file end. **Fixture rows MUST be inserted inside the test file via `pool.query` (D-52 rolls them back; singleThread means no other file observes them). NEVER seed fixtures via psql and NEVER set `TEST_TX_ISOLATION=0` — `sdbi-perf-feedback.integration.test.ts:24-26,109-114` and `reconciliation-learning-rehome.integration.test.ts:81` assert EXACT row counts on 4 of the 8 evidence tables and will break on any committed residue (REVIEW-11 M4).** For the LIVE check (M11.3) instead pick, via SQL, any subject inside federica's tenant with rows: `SELECT user_assessment_evidence_user_id FROM sys.sys_user_assessment_evidence e JOIN sys.sys_users u ON u.user_id=e.user_assessment_evidence_user_id WHERE u.user_tenant_id=(SELECT user_tenant_id FROM sys.sys_users WHERE user_email='federica.marchetti@rtl-bank.org') LIMIT 1` and drill into that user on `/users/[userId]` |
| **F7 — migration number taken** | `git pull` before M10 brings a new `0001NN` | Renumber your file to new-max+1, `db:migrate:sh` ×2 again (guards make the re-run a no-op for the already-applied content under the old number? NO — renaming after applying leaves the old filename in the applied ledger; check how `migrate.sh` tracks applied files: if by filename, apply the renamed file fresh — its NOT EXISTS guards make it a no-op; that is the point of D-12 idempotence) |
| **F8 — CI workflow count ambiguity** | `gh run list` shows 6, 7, or more runs for the commit | Pass criterion is fixed: every run TRIGGERED on the commit is green. The absolute count is not asserted |
| **F9 — numeric-as-string serialization** | First API call throws ResponseSerializationError on `score` | `::float8` cast in SQL (preferred, matches insights) — not schema loosening to `z.string()` |
| **F10 — E2E rate-limited** | Playwright/live logins return 429 | Wait 5 minutes (window 10/5min), reuse storageState across specs, retry once |

---

## 5. ABORT CONDITIONS (stop and flag to Enzo — do not improvise)

- **ABORT-1**: OCI VM / tunnel unreachable after 3 attempts → nothing can be verified live; stop.
- **ABORT-2**: SOT_BACKLOG shows #27 not ACTIVE (DONE/HOLD/removed) → the SoT wins over this plan; stop and report.
- **ABORT-3**: all 8 evidence tables empty on the live DB → mission premise gone; stop (never fabricate/seed evidence data).
- **ABORT-4**: `db:migrate:sh` chain fails on a migration OLDER than yours → D-12-class regression outside mission scope.
- **ABORT-5**: D-51 boot-gate violations list routes outside `/v1/evidence` + `/v1/me/evidence` after the taxonomy edit → blast radius beyond mission; report the exact violation list.
- **ABORT-6**: pushing to origin/main is explicitly forbidden in the executor's current session context and cannot be reconciled with the DoD (CI + deploy) → stop before M10, deliver the local commit hash + this conflict.
- **ABORT-7**: any step seems to require ALTER/UPDATE on the evidence tables themselves (beyond the permission seeds) → the mission is read-only exposure; a schema need means the plan missed something structural. This includes any temptation to seed/commit fixture rows via psql: `sdbi-perf-feedback.integration.test.ts:24-26,109-114` and `reconciliation-learning-rehome.integration.test.ts:81` assert EXACT row counts on 4 of the 8 evidence tables — any committed residue turns unrelated test files red with no visible cause (REVIEW-11 M4).
- **ABORT-8**: production broken after deploy (readyz red past the retry window, or login broken) AND one re-run of `vm-deploy.sh` does not restore it → stop, dump `journalctl`/deploy log excerpts, flag. Do not experiment on prod.
- **General**: >30 min without convergence on any single failure, or 2+ failed attempts on the same approach → stop, report state (R14).

---

## 6. VERIFICATION RUNS (what, when, what pass looks like)

| # | When | Command | PASS looks like |
|---|---|---|---|
| V1 | M0 | `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"` | table list prints (tunnel + DB live) |
| V2 | M2 (×2) | `pnpm db:migrate:sh` twice | both runs EXIT 0; 2nd run NOTICE shows no new grants; counts by code: `evidence:read` = **exactly 6 roles** (E1 list, mirrors 000083:28 — no CEO), `evidence:read:self` = 4 roles |
| V3 | M3 | `cd apps/api && pnpm exec vitest run test/scope-data-classes.integration.test.ts` | 5/5 green incl. DRIFT |
| V4 | M5 | boot `pnpm dev` (api) | log shows RBAC cache loaded; NO `ORG_GATE_MISSING`; curl unauth `/v1/evidence/users/<uuid>` → 401 |
| V5 | M5 | `cd apps/api && pnpm exec vitest run test/org-gate.integration.test.ts` | 4/4 — the gate suite now covers the evidence surface with 0 violations |
| V6 | M7 | `pnpm exec vitest run test/evidence.integration.test.ts test/evidence-scope.integration.test.ts test/me-evidence.integration.test.ts` | all green; the scope file shows the 200/404/403 quartet (paolo→tommaso 200, paolo→antonio 404 NOT_FOUND, tommaso admin-route 403, federica 200); the module file shows the two privacy invariants green (anonymous 360: `author === null` + no relationship type; `visibility='PRIVATE'` continuous feedback: absent from admin list, present in recipient's `/v1/me/evidence` — REVIEW-11 C1/M2) |
| V7 | M9 | `pnpm typecheck` + `cd apps/api && pnpm typecheck:test` | exit 0, all workspaces |
| V8 | M9 | `pnpm lint` | exit 0 |
| V9 | M9 | `pnpm i18n:check` | exit 0 (parity; count > 1745 is expected, not asserted) |
| V10 | M9 | `cd apps/api && pnpm test` | **0 fail** across the full suite (~192 files; 2 pre-existing skips tolerated) |
| V11 | M9 | `pnpm --filter @heuresys/web build` | Next build succeeds, no type errors |
| V12 | M9 | targeted Playwright spec in `apps/web/tests/e2e/` (prod mode, node22 wrapper on Windows; testDir per `playwright.config.ts:42`) | spec green AND actually executed (`--grep` reports ≥1 test — a spec outside testDir passes vacuously, REVIEW-11 C3): panel visible with items or real empty state |
| V13 | M10 | `gh run list --limit 10` / `gh run watch` | every workflow triggered by the commit green |
| V14 | M11 | `bash scripts/vm-deploy.sh` | script's own readyz verification passes; exit 0 |
| V15 | M11 | 2× curl on www (evidence + me/evidence, unauth) | **401** both (deployed + gated) |
| V16 | M11 | real login federica → /insights drill-down; real login tommaso → /me/gaps | evidence rows render from prod DB; tommaso sees only self; browser console clean |
| V17 | M12 | `python docs/kb/tools/handoff_lint.py` (at close) | OK |

---

## 7. RED-TEAM RECORD (attacks on this plan)

**Attack A — "the boot-gate won't see the new routes" (FAILED against the plan).**
Claim: `registerOrgGateAssertion` uses an `onRoute` hook, which only sees routes registered after it — a new module might slip past. Checked: the hook is wired in `app.ts` before step-13 module registration (D-51 implementation, S1015, 76 routes collected), and `org-gate.integration.test.ts` independently derives the asserted surface from the taxonomy, so an `evidence`-classified resource is asserted the moment M3 lands. The attack fails; V4+V5 double-cover it.

**Attack B — "taxonomy first, migration later = misleading red" (SUCCEEDED → patched).**
Original draft had the executor edit `data-classes.ts` while writing the module, migration at the end. `scope-data-classes.integration.test.ts:28` (DRIFT) fails for any classified resource absent from `sys_auth_permissions` — the executor would chase a phantom bug or, worse, "fix" it by removing the taxonomy entry. **Patch**: M2 (migration, applied ×2) is strictly before M3 (taxonomy edit), and V3 runs immediately after M3. This ordering is now load-bearing and called out in both moves.

**Attack C — "the anonymity leak ships as a feature" (SUCCEEDED → patched).**
A naive normalized `EvidenceItem` with an `author` join exposes the reviewer of the 390 `feedback_360_responses` rows — whose `response_is_anonymous` DEFAULTS TO TRUE — to every manager with `evidence:read`. Nothing in RBAC or the org axis would catch it: the leak is inside the row, not across rows. **Patch**: masking moved INTO the repository SQL (`CASE WHEN response_is_anonymous THEN NULL ...`, same for `feedback_is_private` per E2), plus a dedicated test assertion in M7.1 that fetches a known-anonymous row through the API and asserts `author === null`. Also generalized: the hard rule in §2 applies to every role including PLATFORM_ADMIN. *[Superseded in part by REVIEW-11 C1/M2: this attack missed its nearest neighbor — `feedback_visibility` (DEFAULT 'PRIVATE', never consulted, sibling column in the same migration) and the `response_relationship_type` side channel. Current rule: PRIVATE-visibility rows excluded from org endpoints entirely; author nulled on `is_private OR visibility='PRIVATE'`; relationship type suppressed on anonymous rows.]*

**Attack D — "live verification self-DoS" (SUCCEEDED → patched).**
The DoD demands real logins on www; the S1016 lesson records the login rate-limit at 10/5min, and a Playwright prod run + manual checks + retries can burn it, producing 429s that look like a broken deploy. **Patch**: M11 fixes the login budget (2 logins, sessions reused), F10 gives the exact wait-and-retry rule, and the E2E spec reuses storageState.

**Attack E — "the panel 403s for legitimate page viewers" (SUCCEEDED → patched).**
`/gaps` is readable with `gap_analysis:read`; the evidence panel needs `evidence:read`. A BLUEPRINT_MANAGER-less role overlap (e.g., READ_ONLY viewing /gaps if granted) would render a panel that hard-fails 403 on every click — a shipped-broken UI on day one. **Patch**: M8.1 requires the permission pre-check via `useCurrentUserPermissions()` and a null render without the permission — the page works exactly as before for those viewers.

**Attack F — "404-vs-403 inconsistency invites enumeration" (FAILED against the plan).**
Claim: mixing 403 (no permission) and 404 (out of subtree) lets an attacker distinguish "exists but hidden" from "not allowed". Checked against the codebase doctrine: 403 = the ACTION is not granted at all (RBAC, pre-data), 404 = the action is granted but the TARGET is out of org scope (post-fetch, existence-hiding) — this is exactly the S1013/insights precedent (`insights-scope` asserts both), so the plan's quartet (403 for tommaso, 404 for paolo→antonio) is the house pattern, not a hole. Attack fails.

### Independent adversarial review 2026-07-06 (REVIEW-11)

Independent reviewer (did not author the plan) verified 26 factual claims against `D:\heuresys-advanced` (22 EXACT, 4 false/broken). Verdict: PASS-WITH-PATCHES, grade **6/8 as-written**. All 11 findings incorporated into this version:

- **C1** (CRITICAL) — E2 privacy masking was keyed on the wrong column: `feedback_is_private` DEFAULTs `false` while `feedback_visibility` DEFAULTs `'PRIVATE'` (000065:331-332) and was never consulted → §1.1 note corrected; recon R5b added; E2 rewritten (PRIVATE-visibility rows excluded from org/admin endpoints, recipient-only via `/v1/me/evidence`; author nulled on `is_private OR visibility='PRIVATE'`); M5 SQL, M6 self-variant, M7.1 assert, V6 updated.
- **C2** (CRITICAL) — fabricated precedent: no COALESCE join exists at `me/repository.ts:387` (flat SELECT on `sys_performance_reviews`) → §1.4, A3 and F3 corrected: `review_subject_user_id` is the person key; the ratings→reviews JOIN is NEW code modeled on FK `sys_prcr_review_fk` (000065).
- **C3** (CRITICAL) — wrong Playwright location: `apps/web/e2e/` does not exist; `testDir` = `./tests/e2e` (`playwright.config.ts:42`) → M9 and V12 corrected + testDir confirm-check added (a spec outside testDir passes vacuously).
- **M1** (MAJOR) — E1 misquoted 000083: seven role names (incl. a phantom CEO) labeled "6"; 000083:28 grants exactly 6 roles, NO CEO → E1 rewritten to the exact list; CEO's deliberate exclusion + resulting 403 flagged for Enzo; M2 Expected and V2 set to "exactly 6 roles".
- **M2** (MAJOR) — 360 de-anonymization side channel via `response_relationship_type` (an anonymous response labeled MANAGER de-anonymizes) → §2 hard rule extended (suppress relationship type, generic '360 feedback' label); M5 + M7.1 updated.
- **M3** (MAJOR) — R6 was a check that cannot fail (`\|` is a LITERAL pipe in .NET regex) → R6 replaced with comma-OR `Select-String -Pattern "a", "b"` / `grep -rlE`.
- **M4** (MAJOR) — unstated D-52 dependency vs exact-count couplings (`sdbi-perf-feedback...:24-26,109-114` asserts 465/390/474; `reconciliation-learning-rehome...:81` asserts 1434) → M7.2 + F6 fixture rules hardened (pool.query in-file only; never psql; never `TEST_TX_ISOLATION=0`); ABORT-7 extended.
- **m1** (MINOR) — per-category `label` mapping underspecified (8 guess points) → explicit 8-way mapping added to M5.
- **m2** (MINOR) — `/insights/succession-readiness/page.tsx` adjacency (same `selected` state, line 39) → noted in M8 as optional in-scope-adjacent, not demanded by the doc of record.
- **m3** (MINOR) — M2 template conflation: 000083 carries an EQUALITY assert (`IF v <> 2`, 000083:43), the banned anti-pattern → M2 + §1.5 now say: audience list ONLY from 000083; guard/assert style from 000166/000142 (floor form).
- **m4** (MINOR) — push-authorization tension with project CLAUDE.md → M10 now states the mission brief's DoD line IS the explicit ask for this session.

---

## 8. SELF-GRADE (vs SUCCESS.md, 8 points)

1. **Expected observation per move** — PASS. Every M0–M12 states exactly what the executor should see (exit codes, HTTP codes, log lines, NOTICE contents, green counts).
2. **Likely failure + signal + counter-move per move** — PASS. Every move carries ≥1 failure with its diagnostic meaning and the concrete counter (several carry 2–3, keyed A/B/C).
3. **Forks with triggers** — PASS. F1–F10 each bind an observable trigger to a single route; product-flavored choices are pre-decided as reversible defaults (E1–E4) so no judgment call remains.
4. **RECON NEEDED with exact checks** — PASS **after REVIEW-11 patches** (FAIL as originally written, per the independent review: R6 was a broken-regex check that could never fail, and R5 missed the decisive privacy datum `feedback_visibility`). Now: R1–R9 + R5b each have the literal command/SQL that can actually disconfirm; the four Enzo-personal items are isolated with encoded defaults and the reversal cost stated.
5. **Abort conditions** — PASS. ABORT-1..8 + the 30-min/2-attempts general rule (R14).
6. **Verification spelled out** — PASS. V1–V17 with when + command + what pass looks like, mapped to the mission's DoD line (typecheck · lint · i18n parity · full suite · CI · deploy · live 401 + real-login drill-down).
7. **Red-team survived and recorded** — PASS. Six attacks: two failed against the plan (A, F — recorded with the evidence that repelled them), four succeeded and produced patches (B, C, D, E) that are now embedded in the moves they patched.
8. **Executable blind** — PASS **after REVIEW-11 patches** (FAIL as originally written, per the independent review: three false "verified" facts — the fabricated :387 join precedent C2, the nonexistent `apps/web/e2e/` path C3, the phantom-CEO 000083 misquote M1 — sat exactly where a mid-tier executor guesses, plus the unstated D-52/count-coupling dependency M4 and 8 unmapped label mappings m1). All corrected/specified in this version. Remaining honest caveat: E1–E4 defaults ship pending Enzo's ratification — by design, since the mission brief assigns product decisions to Enzo and forbids inventing them; the plan converts them into flagged, reversible defaults rather than blockers.

**Grade**: independent adversarial review (REVIEW-11, 2026-07-06) graded the plan **6/8 as-written** (points 4 and 8 FAIL — the original self-grade of 8/8 overclaimed on both) and **8/8 after its patches**. This version incorporates all 11 REVIEW-11 findings verbatim → **8/8** (points 4 and 8 hold only by virtue of those patches; point 8 keeps the E1–E4 ratification caveat, resolved by design rather than by omission).
