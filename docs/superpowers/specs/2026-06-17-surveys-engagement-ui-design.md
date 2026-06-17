# Surveys / Engagement UI mini-milestone — design spec

> Status: DRAFT (design-only) · 2026-06-17 · Author: Claude (CLI) · Owner decision: Enzo
> Scope chosen by Enzo: **(A) admin read-only UI** over the live engagement read-model **+ (B) NET-NEW ESS self-response write-path** under `/v1/me/*`.
> This is a design spec only — no code, migrations, or other files were touched. Effort estimate **~12–16h**, split into phases below with honest scope.

---

## 0. Why this milestone exists (measured baseline)

The normalized survey cluster is **already shipped + live** (mig `000097`). Verified against the live DB (tunnel `:5433`):

| Table | Rows | Notes |
|---|---|---|
| `sys.sys_surveys` | 8 | status split: `closed`=5, `active`=2, `draft`=1 |
| `sys.sys_survey_questions` | 21 | types: `rating`=19, `nps`=2 |
| `sys.sys_survey_responses` | 3792 | **normalized: 1 row per answer**; 3792 with subject, **156 distinct users** |
| `sys.sys_pulse_checks` | 733 | bucketed by `pulse_check_week_number` |

The API module `apps/api/src/modules/engagement/` is **READ-ONLY today** (3 endpoints, all `requirePermission("surveys:read")`):
- `GET /v1/engagement/surveys` → `engagement/routes.ts:19` → list + derived `questionCount`/`responseCount`
- `GET /v1/engagement/surveys/:surveyId/results` → `routes.ts:24` → per-question aggregation (count + avg rating) via the FK `sys_survey_responses.survey_response_question_id → sys_survey_questions.survey_question_id`
- `GET /v1/engagement/pulse` → `routes.ts:29` → pulse trend aggregated by week

**There are NO web pages for surveys/engagement today** (API-only). That is the gap (A) closes.

There is also a **separate** JSONB cluster — `sys_engagement_survey_templates` / `sys_engagement_surveys` / `sys_engagement_survey_responses` (templates+CRUD, responses as immutable JSONB event log) backing `packages/shared/src/schemas/surveys.ts:1-9` (the `/v1/surveys/*` module, B-10b m2). **This spec does NOT touch that cluster.** The admin UI (A) and the ESS write-path (B) both target the **normalized** `sys_survey_*` cluster (the one with 3792 normalized rows), which is the richer per-question analytics surface and the one the existing `engagement/` module already reads. The name collision between the two clusters is a known false-friend — keep them disjoint.

### Live schema (the tables both A and B target)

`sys.sys_survey_responses` (verified `\d`):
```
survey_response_id              uuid  PK  default gen_random_uuid()
survey_response_survey_id       uuid  NOT NULL  FK → sys_surveys ON DELETE CASCADE
survey_response_question_id     uuid  NULL      FK → sys_survey_questions ON DELETE SET NULL
survey_response_tenant_id       uuid  NOT NULL  FK → sys_tenancies
survey_response_subject_user_id uuid  NULL      FK → sys_users ON DELETE SET NULL
survey_response_natural_key     text  NOT NULL  -- UNIQUE(tenant_id, natural_key)
survey_response_rating_value    integer NULL    -- for rating/nps
survey_response_text_value      text    NULL    -- for free-text
survey_response_choice_value    varchar(200) NULL -- for single/multi choice
survey_response_metadata        jsonb   NOT NULL default '{}'
created_at                      timestamptz NOT NULL default now()
```
**Critical measured fact**: there is **NO unique constraint** on `(survey_id, question_id, subject_user_id)`. The table is purely append-only — the only uniqueness guard is `UNIQUE(tenant_id, natural_key)`. So "one response per question per user" is **not enforced by the schema today**; the ESS write-path (B) must enforce it in the service layer (see §4.3) OR a new migration must add the constraint (open question OQ-3).

`sys.sys_surveys` carries only `survey_total_invitations` (int) + `survey_metadata` (jsonb, observed `{"legacy_survey_id": ...}`). **No assignment/invitation table exists** — measured: `information_schema.tables` for schema `sys` matching `%survey%`/`%assign%`/`%invit%` returns only `sys_surveys`, `sys_survey_questions`, `sys_survey_responses`, `sys_user_learning_assignments`, `sys_user_position_assignments` (the last two are unrelated HR assignments, not surveys). So **survey→user assignment is currently implicit** (audience is a number, not a set of rows). This is the central design decision for (B) — see §4.4 + OQ-1.

---

## 1. (A) Admin read-only UI — page composition

### 1.1 Route & gating
- New page tree: `apps/web/src/app/(authenticated)/engagement/page.tsx` (list/overview) + `engagement/[surveyId]/page.tsx` (per-survey results) + a pulse section (either a tab on the overview or `engagement/pulse`).
- `"use client"` pages (like all other `(authenticated)` pages). Server prerender-safe by importing charts **only** from `_charts-client.tsx` (never `@heuresys/ui` directly — see `apps/web/src/app/(authenticated)/_charts-client.tsx:1-31`; `EChartsCard` crashes SSR via "Class extends value undefined", so it is `dynamic(..., { ssr: false })`).
- Sidebar registration via the DB-driven interface registry (`sys_ui_interfaces`, U1 epic) — a new migration row + `GET /v1/me/interfaces` picks it up. Gate the nav item on `surveys:read` (admin-side perm already seeded). **No client-side role hard-codes** — gating is server-driven (per the U2 doctrine in `project_s953_rbac_uix_epic`).

### 1.2 Data sources (all live, zero mock — MVP-2a doctrine)
Reuse the **existing** 3 endpoints unchanged. No new API needed for (A):

| Component | Endpoint | Shape (from `@heuresys/shared`) |
|---|---|---|
| Surveys table | `GET /v1/engagement/surveys` | `EngagementSurveyListResponse` (`engagement.ts:26`) — title, status, type, dates, isAnonymous, totalInvitations, questionCount, responseCount |
| Per-question analytics | `GET /v1/engagement/surveys/:surveyId/results` | `EngagementSurveyResultsResponse` (`engagement.ts:44`) — `{ surveyId, title, questions[] }`, each `{ questionId, text, type, category, displayOrder, responseCount, avgRating }` |
| Pulse trend | `GET /v1/engagement/pulse` | `EngagementPulseResponse` (`engagement.ts:62`) — `items[]` per `weekNumber` with `avgMood`/`avgWorkload`/`avgSatisfaction` + `totalChecks` |

TanStack Query hooks in `apps/web/src/lib/api/engagement.ts` (new file), **no `initialData`/`placeholderData`** (live-only). Types imported from `@heuresys/shared` — never re-declared.

### 1.3 Composition (compose `@heuresys/ui` primitives only — never reimplement)
- **Surveys overview**: `DataTable` (from `@heuresys/ui`) with columns title · status (status-pill) · type · responses (`responseCount`) · questions (`questionCount`) · invitations · window (start–end). Row click → detail. Reuse the existing `data-table-panel.tsx` / `status-pill.tsx` composition wrappers in `apps/web/src/components/`.
- **Per-survey results** (`[surveyId]`): header (title + status) → `DataTable` of questions (text · type · category · responseCount · avgRating, ordered by `displayOrder`) → **`EChartsCard`** bar chart of `avgRating` per question (rating/nps questions only; free-text questions show count, no avg) — imported from `_charts-client`.
- **Pulse section**: `EChartsCard` multi-series line chart over `weekNumber` (mood/workload/satisfaction) + a KPI tile for `totalChecks`. This is the highest-signal visual (733 checks across weeks).
- **Empty states**: real empty-state UI when an endpoint returns an empty list (e.g. a `draft` survey with 0 responses) — never a placeholder.

### 1.4 i18n (IT + EN, parity-checked)
- All labels in `apps/web/src/i18n/{it,en}/engagement.json` (new namespace). `pnpm i18n:check` must pass (parity gate). Strings: page titles, column headers, status labels (draft/active/closed/archived), question-type labels (rating/nps/text/choice), pulse metric names (mood/workload/satisfaction), empty-state copy.

### 1.5 Per-question aggregation correctness
The aggregation already lives in SQL (`engagement/repository.ts:62-85`): `LEFT JOIN` responses on `question_id`, `count(response_id)` + `avg(rating_value) FILTER (WHERE rating_value IS NOT NULL)`, rounded to 2 decimals, ordered by `displayOrder`. The UI consumes it as-is. No client-side recomputation (single source of truth = the endpoint).

---

## 2. (A) — what (A) does NOT need

No new API, no new schema, no new permission for the admin read UI. It is pure frontend wiring + i18n + one `sys_ui_interfaces` row for the sidebar. This keeps (A) low-risk (~4–5h, see §6).

---

## 3. (B) NET-NEW ESS self-response write-path — overview

ESS is its own module (ADR-0011 — `CLAUDE.md` invariant: "Don't add `/me/*` routes to existing modules; they get a dedicated module"). So the write-path lives under **`/v1/me/surveys`** inside the existing `apps/api/src/modules/me/` module (the ESS module), **not** in `engagement/` (which stays read-only/admin) and **not** in the JSONB `surveys/` module.

### 3.1 Endpoints (net-new)
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/v1/me/surveys` | `surveys:respond:self` (new) | List surveys assigned to me + my completion state |
| `GET` | `/v1/me/surveys/:surveyId` | `surveys:respond:self` | The survey's questions + any answers I already gave (for resume/review) |
| `POST` | `/v1/me/surveys/:surveyId/responses` | `surveys:respond:self` + `app.verifyCsrf` | Submit my answers (one append per question) |

`POST` returns `201` with the persisted responses (mirrors `me/routes.ts:89-95` self-assessment pattern). Active-status surveys only are answerable (`survey_status='active'`).

### 3.2 Self-scope auth model (hard contract — mirrors existing 19 `/me/*` perms)
`me/routes.ts:1-50` defines the **hard self-scope contract**:
- **No `:userId` URL param** anywhere under `/v1/me/*`.
- `userId` is **always** sourced from `req.user.userId` via the local `selfActor(req)` helper (`me/routes.ts:47-50`). Service methods never accept `userId` from request input.
- New permission `surveys:respond:self` follows the existing `:self` naming (verified live: `learning:enroll:self`, `skill:self_assess`, `user_profile:update:self`, etc. — 19 self perms). It is seeded in a new migration + granted to the roles that can self-respond (at minimum `USER`, `MANAGER`, `TEAM_MEMBER`, `TEAM_LEADER`, `CEO` — i.e. any human who can be a survey subject; OQ-2).
- Visibility: a user sees/answers **only surveys assigned to them** in **their own tenant** (`req.user.tenantId`). Out-of-scope or other-tenant surveys → `404` (no leak), mirroring `engagement/service.ts:28-31` `assertVisible`.

### 3.3 Write into the normalized response tables (append/immutable event-log)
Responses are an append-only event log (no `UPDATE`, no `DELETE` in the self-path). The `POST` body is an array of per-question answers; the service inserts **one row per answered question** into `sys_survey_responses`:
```
INSERT INTO sys.sys_survey_responses (
  survey_response_survey_id, survey_response_question_id, survey_response_tenant_id,
  survey_response_subject_user_id, survey_response_natural_key,
  survey_response_rating_value, survey_response_text_value, survey_response_choice_value,
  survey_response_metadata
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
```
- `subject_user_id = actor.userId` (from JWT, never input).
- `tenant_id = actor.tenantId` (required; tenantless actor → `403`/`404`).
- `natural_key` deterministic = e.g. `'ESS::' || survey_id || '::' || question_id || '::' || user_id` — this gives the per-question-per-user uniqueness **for free** via the existing `UNIQUE(tenant_id, natural_key)` constraint (no new migration needed for the dedup guard — see §4.3).
- Use the **`withTransaction(pool, async (client) => {...})`** helper (per `CLAUDE.md` module-pattern step 2 / `modules/auth/repository.ts`) so a multi-question submission is atomic: either all answers land or none.
- The response `value` column is chosen by question type: `rating`/`nps` → `rating_value`; free-text → `text_value`; choice → `choice_value`. Validate type↔column in the service (reject a text answer to a `rating` question with `VALIDATION`/`422`).

### 3.4 One-response-per-question-per-user rule
**Measured**: no DB constraint enforces this today. Two options:
- **Option B1 (recommended, no migration)**: encode user+question into `natural_key` (§3.3). The existing `UNIQUE(tenant_id, natural_key)` then makes a re-submit of the same question a `23505` → caught and surfaced as `409 CONFLICT` (`SURVEY_ALREADY_ANSWERED`) **OR** treated as idempotent (silent skip). Choice = OQ-3 / edit-policy OQ.
- **Option B2 (explicit, needs migration)**: add `UNIQUE(survey_response_survey_id, survey_response_question_id, survey_response_subject_user_id) WHERE subject_user_id IS NOT NULL` partial index. Cleaner intent, but a new migration `000132_*` on a live 3792-row table — verify no existing duplicate `(survey,question,user)` triples first (a pre-check query is part of the migration's idempotency proof).

Default recommendation: **B1** (zero schema change, leverages existing unique). Escalate B2 only if Enzo wants the constraint to be self-documenting at the schema level (OQ-3).

---

## 4. (B) Module pattern — 7-step for the write-path

Following `CLAUDE.md` "The module pattern (mandatory for every new API module)". Since this extends the **existing** ESS `me/` module, steps map onto that module's files rather than a brand-new directory:

1. **Shared schemas** — `packages/shared/src/schemas/me.ts` (or a focused `me-surveys` section): `MeSurveyListResponseSchema`, `MeSurveyDetailSchema` (questions + my-existing-answers), `SubmitMeSurveyResponseBodySchema` (array of `{ questionId, ratingValue?, textValue?, choiceValue? }`), `MeSurveyResponseSchema` (persisted row). Export from `packages/shared/src/index.ts` + subpath export in `packages/shared/package.json`. Reuse `EngagementQuestionResult`-style shapes where possible.
2. **Repository** — `apps/api/src/modules/me/repository.ts`: `listMySurveys(pool, userId, tenantId)`, `findMySurveyDetail(pool, userId, tenantId, surveyId)`, `insertMySurveyResponses(client, userId, tenantId, surveyId, answers)` (raw parameterized SQL, `$1..$N`, never interpolation; inside `withTransaction`). Mirror `insertSelfAssessment` (`me/repository.ts:233-272`) for the CTE/RETURNING shape.
3. **Service** — `apps/api/src/modules/me/service.ts`: `listSurveys`, `getSurveyDetail`, `submitSurveyResponses(actor, surveyId, body)` — does: `requireTenant(actor)`, assert survey is active + assigned-to-me (§4.4) else `404`, validate type↔column, atomic insert. Mirror `submitSelfAssessment` (`service.ts:96-102`) + `enrollLearning` (`service.ts:108-...`) which already show the `requireTenant` + visibility-check + insert flow.
4. **Routes** — add the 3 routes to `apps/api/src/modules/me/routes.ts` using `selfActor(req)`, `requirePermission("surveys:respond:self")`, and `app.verifyCsrf` on the `POST`. Typed errors from `src/errors/index.ts` (`NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`) with `SCREAMING_SNAKE` codes (`SURVEY_NOT_ASSIGNED`, `SURVEY_NOT_ACTIVE`, `SURVEY_ALREADY_ANSWERED`, `SURVEY_ANSWER_TYPE_MISMATCH`).
5. **Register** — already registered (the `me` module is already mounted at `/v1/me`); no new `app.register` needed.
6. **Integration test** — `apps/api/test/me-surveys.integration.test.ts` (4–8 tests, `buildTestApp()`, real DB via tunnel, no mocks): list returns only assigned active surveys; cross-tenant survey → 404; submit appends rows verified by re-query; re-submit same question → 409/idempotent (per OQ-3); type mismatch → 422; missing perm → 403.
7. **`pnpm test` 100% green**, then **atomic commit**: `feat(api): MVP-2b 5.1.X — me/surveys self-response (3 endpoints, N tests)`. Plus a new migration `000132_survey_respond_self_permission.sql` (idempotent: `INSERT ... ON CONFLICT DO NOTHING` for the permission + role grants; reload RBAC cache picks it up at server start).

### 4.4 Assignment model (the central open design point)
**Measured: no assignment table exists.** Three candidate models, in increasing build cost:

| Model | How "assigned to me" is decided | Build cost | Trade-off |
|---|---|---|---|
| **M0 — all-active-tenant** | Every `active` survey in my tenant is answerable by me | lowest (no schema) | No targeting; everyone sees every active survey. Matches today's implicit "audience = a number" reality |
| **M1 — metadata audience** | `survey_metadata` carries an audience descriptor (e.g. org_unit/role list) the service resolves against my profile | medium (no schema, service logic) | Flexible, but audience semantics undefined today; needs a convention |
| **M2 — assignment table** | New `sys_survey_assignments(survey_id, user_id, tenant_id, assigned_at, completed_at)` migration; `total_invitations` becomes derivable | highest (migration + seed + backfill) | Proper invitation model + per-user completion tracking + matches `totalInvitations` semantics. The "right" long-term shape |

**Recommendation**: ship **M0** for this mini-milestone (keeps it in the ~12–16h envelope and matches the current implicit audience), and register **M2** as a follow-up backlog item if Enzo wants real targeting/invitations. **This is OQ-1 and Enzo must decide before (B) is built** — it changes the schema footprint and the test matrix. Do not silently pick one.

---

## 5. Playwright live-data E2E (real personas, no mock)

Per the MVP-2a/2b "LIVE DATA E2E ONLY" doctrine (`CLAUDE.md`). Run via `pnpm test:e2e:prod` (or `:node22` wrapper on Node ≥23 — D-36). Personas are the real seeded RTL_BANK users (`db:seed-test-admin`, password `Admin#PassW0rd!`).

**(A) admin E2E** (`apps/web/e2e/engagement-admin.spec.ts`):
- Login `admin@heuresys.com` (PLATFORM_ADMIN) → navigate to `/engagement` → assert the surveys table shows ≥1 row whose `responseCount` matches the live aggregate (data came from the 3792-row seed, not a fixture) → open a survey with responses → assert per-question `avgRating` rows render → assert the pulse chart renders with `totalChecks` > 0.
- Login `federica.marchetti@rtl-bank.org` (TENANT_ADMIN) → assert she sees **only** RTL_BANK surveys (tenant scope, no cross-tenant leak).

**(B) ESS E2E** (`apps/web/e2e/me-surveys.spec.ts`) — the binding live-data proof:
- Login a real USER persona (e.g. `tommaso.fiore@rtl-bank.org`) → navigate to `/me/surveys` (or wherever the ESS survey page lands) → open an **active** assigned survey → submit answers to its rating/nps questions → assert `201` → **re-fetch** `GET /v1/me/surveys/:id` and assert the answers persisted (the immutable event-log row is visible) → assert re-submit of the same question is rejected/idempotent per OQ-3.
- Negative: USER cannot reach a draft/closed survey's submit path (404/disabled).

E2E is **mandatory before merge** — no page commit without a green live-data spec (MVP-2a/2b non-negotiable).

---

## 6. Phased plan + effort (~12–16h) + honest scope

| Phase | Work | Effort | Risk | Gate |
|---|---|---|---|---|
| **P0** | Decide OQ-1 (assignment model M0/M1/M2) + OQ-2 (which roles) + OQ-3 (edit policy) with Enzo | 0h (Enzo) | — | **Blocks P3** |
| **P1 (A)** | Admin UI: hooks (`lib/api/engagement.ts`) + overview page + `[surveyId]` results + pulse charts via `_charts-client` + i18n IT/EN + `sys_ui_interfaces` row | 4–5h | LOW (read-only, reuses 3 live endpoints) | `next build` + `i18n:check` + admin E2E green |
| **P2 (A)** | Admin Playwright E2E (2 personas) | 1–1.5h | LOW (live data exists) | E2E prod green |
| **P3 (B-api)** | ESS write-path: shared schemas + repo + service + 3 routes + migration `000132` (perm + grants) + integration tests | 4–5h | MED (write path; dedup + type-validation correctness; depends on P0) | `pnpm test` green + RBAC cache reloads perm |
| **P4 (B-ui)** | ESS survey page(s) under `/me/*` (list + answer form composed from `@heuresys/ui`) + i18n + ESS Playwright E2E (submit → re-fetch) | 3–4h | MED (form state + CSRF + live submit) | E2E prod green (submit verified by re-fetch) |
| **P5** | Final: typecheck/lint/vitest/Playwright/i18n all green, atomic commits, handoff/SoT update | 0.5–1h | LOW | full suite green |

**Total**: ~12.5–16.5h → fits the ~12–16h envelope **only if (A) and (B) are both kept lean** (M0 assignment, B1 dedup-via-natural-key, no M2 table). 

**Honest scope / what is explicitly OUT**:
- The JSONB `sys_engagement_*` cluster + `/v1/surveys/*` module is untouched.
- No survey **authoring/admin-write** UI (create/edit surveys, add questions) — admin side is read-only (A). Authoring would be a separate milestone.
- No M2 assignment/invitation table unless Enzo chooses it in P0 (would push effort past 16h + add migration risk on a live table).
- No response **edit/delete** (append-only event log; edit policy is OQ-3).
- No anonymous-response special-casing beyond honoring `survey_is_anonymous` in display (the ESS write still records `subject_user_id` for dedup; anonymity is a display/reporting concern — flag for OQ if Enzo wants true anonymity, which conflicts with per-user dedup).

**Regression risk**: (A) is additive frontend → LOW (existing API integration tests already cover the 3 endpoints). (B) adds a new permission + routes → MED; covered by new integration tests (step 6) + the RBAC cache reload. The 3792-row table is read-heavy already; appending rows is low-impact (indexed on subject + survey + question).

---

## 7. Open questions for Enzo (decide in P0, before any code)

- **OQ-1 — Assignment semantics (BLOCKING)**: which model? **M0** (every active tenant survey is answerable — lowest cost, matches today's implicit audience) · **M1** (audience descriptor in `survey_metadata`) · **M2** (new `sys_survey_assignments` table — proper invitations + per-user completion, highest cost, the long-term-correct shape). Recommendation: M0 now, M2 as a follow-up backlog item. This changes the schema footprint and the E2E "assigned to me" assertion.
- **OQ-2 — Who can self-respond**: grant `surveys:respond:self` to which roles? Proposed: `USER`, `MANAGER`, `TEAM_MEMBER`, `TEAM_LEADER`, `CEO` (every human subject). Exclude `READ_ONLY`? Include `HRMS_MANAGER`/`PROCESS_OWNER`?
- **OQ-3 — Response edit / re-submit policy**: a question is append-only. On re-answer of the same question, do we (a) **reject** with `409 SURVEY_ALREADY_ANSWERED` (strict one-shot), (b) **idempotent silent-skip** (re-submit is a no-op), or (c) **allow a new row** (latest-wins / full history, requires dropping the natural-key dedup and adding a `created_at`-based "latest" read)? Recommendation: (a) strict one-shot for v1. This also decides whether OQ-related dedup uses B1 (natural-key) or B2 (partial unique index).
- **OQ-4 — Anonymity**: `survey_is_anonymous=true` surveys still need `subject_user_id` for dedup. Is "anonymous" purely a *display/reporting* property (admin can't see who answered, but the system can dedup), or must the stored row truly carry no user id (which breaks per-user dedup)? Recommendation: display-only anonymity (store subject for dedup, redact in admin views).
- **OQ-5 — Pulse self-write**: this spec covers survey self-response. Do we also want an ESS **pulse-check submit** (`POST /v1/me/pulse`) in the same milestone, or is pulse admin-read-only for now? (733 existing checks are seed data; no self-write path proposed here.) Recommendation: defer pulse-write to a follow-up.

---

## 8. File-level change map (for the build session, not executed here)

| Layer | File | Change |
|---|---|---|
| shared | `packages/shared/src/schemas/me.ts` | + Me-survey schemas (list/detail/submit-body/response) |
| shared | `packages/shared/src/index.ts` + `package.json` | + exports |
| api | `apps/api/src/modules/me/repository.ts` | + `listMySurveys` / `findMySurveyDetail` / `insertMySurveyResponses` |
| api | `apps/api/src/modules/me/service.ts` | + `listSurveys` / `getSurveyDetail` / `submitSurveyResponses` |
| api | `apps/api/src/modules/me/routes.ts` | + 3 `/me/surveys*` routes |
| api | `apps/api/test/me-surveys.integration.test.ts` | new |
| db | `db/migrations/000132_survey_respond_self_permission.sql` | new (perm + grants; idempotent) — **+ optional `000133` partial unique index if OQ-3=B2/M2** |
| web | `apps/web/src/lib/api/engagement.ts` + `me-surveys.ts` | new hooks (live, no placeholderData) |
| web | `apps/web/src/app/(authenticated)/engagement/{page,[surveyId]/page}.tsx` | new admin pages |
| web | `apps/web/src/app/(authenticated)/me/surveys/page.tsx` | new ESS page |
| web | `apps/web/src/i18n/{it,en}/engagement.json` + `me-surveys.json` | new namespaces |
| web | `apps/web/e2e/engagement-admin.spec.ts` + `me-surveys.spec.ts` | new live E2E |
| db | `sys_ui_interfaces` row (migration) | sidebar nav for the admin engagement page |
