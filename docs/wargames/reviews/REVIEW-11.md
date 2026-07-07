# REVIEW-11 — Adversarial review of `wargames/11-heuresys-evidence.md`

- **Reviewer**: independent adversarial pass (did not author the plan). Repo evidence read from `D:\heuresys-advanced` (read-only), 2026-07-06.
- **Standard**: `fable-last-week/SUCCESS.md` (8 points). Brief: `fable-last-week/tasks/11-heuresys-evidence.md`.
- **Method**: 25+ factual claims spot-checked against the repo (DDL, code lines, tests, configs, SoT); then attack passes on privacy leaks, count-couplings, D-51 interactions, and blind-executability.

## VERDICT: **PASS-WITH-PATCHES**

The plan's recon is unusually accurate — 22 of 26 spot-checked claims verified EXACTLY (file:line included). The structure (moves/forks/aborts/verifications) genuinely meets the SUCCESS.md shape. But three claims presented as verified are **false**, and one of them (the continuous-feedback privacy default, C1) would ship a real sensitive-data exposure as a "reversible default". With the patches below applied verbatim, the plan is safe to hand to a blind Sonnet/Opus executor. Without them: FAIL.

---

## FINDINGS

### CRITICAL

**C1 — The E2 privacy default is keyed on the WRONG column: `feedback_visibility` is never consulted, and `feedback_is_private` defaults to FALSE.**
- **Evidence** (`db/migrations/000065_sdbi_perf_feedback_schema.sql:331-332`):
  ```sql
  feedback_visibility         varchar(20)    NOT NULL DEFAULT 'PRIVATE',
  feedback_is_private         boolean        NOT NULL DEFAULT false,
  ```
  and the CHECK at :348-349: `feedback_visibility IN ('PRIVATE','MANAGER','TEAM','PUBLIC')`.
- **The attack**: the plan's E2 + M5 mask the author only `WHEN feedback_is_private = true`, and expose the row content unconditionally to every `evidence:read` holder in org scope. But the table's own visibility model says rows default to `'PRIVATE'` while `is_private` defaults to `false`. If the 474 legacy rows carry defaults (the plan never checks — R5 only counts NULL subjects), the masking fires on ~0 rows and 100% of `visibility='PRIVATE'` feedback — content AND author — ships to every subtree manager and every non-leaf role in the E1 audience. This is the exact leak class the plan's own red-team Attack C patched for the 360 table; it missed the sibling column on the very next table in the same migration. The plan's §1.1 row for `sys_continuous_feedback` even LISTS the visibility CHECK — and then never uses it.
- **Impact bound**: org-gated (subtree/HR only), but the mission's whole premise is that this data is SENSITIVE; "org-gated" does not authorize showing a PRIVATE praise/CONSTRUCTIVE note beyond its intended audience by default.
- **PATCH (exact text)**:
  1. Add to §2 recon table: `R5b | continuous-feedback visibility distribution | psql: SELECT feedback_visibility, feedback_is_private, count(*) FROM sys.sys_continuous_feedback GROUP BY 1,2 ORDER BY 1,2 — record the numbers; they drive E5`.
  2. Replace E2 with: `E2/E5 (continuous feedback): admin/org endpoints EXCLUDE rows with feedback_visibility='PRIVATE' entirely (recipient-only by design; they remain visible on /v1/me/evidence to the recipient). Rows with visibility IN ('MANAGER','TEAM','PUBLIC') are included; author is nulled when feedback_is_private=true OR visibility='PRIVATE'. Flagged default awaiting Enzo's ratification; reversal = one SQL WHERE/CASE change.`
  3. In M7.1 add: `assert via API that a DB-verified visibility='PRIVATE' row does NOT appear in federica's admin list but DOES appear in the recipient's /v1/me/evidence`.

**C2 — False "verified" citation: the COALESCE join precedent at `me/repository.ts:387` does not exist.**
- **Evidence**: `apps/api/src/modules/me/repository.ts:381-388` is a flat `SELECT ... FROM sys.sys_performance_reviews WHERE review_subject_user_id = $1` — no JOIN, no COALESCE, and it never touches `sys_performance_review_competency_ratings`. Line 569 likewise. Fork F3's claim "the exact join `me/repository.ts:387` already uses" is fabricated precedent.
- **Impact**: low functionally — M5's proposed SQL (`COALESCE(rating_subject_user_id, pr.review_subject_user_id)` via `JOIN ... ON pr.review_id = rating_review_id`) is independently correct against the verified DDL (`rating_review_id NOT NULL FK → sys_performance_reviews(review_id)`, 000065:194,230-232; `review_subject_user_id` confirmed real at me/repository.ts:387). But per the review standard, wrong evidence in a VERIFIED section is CRITICAL: an executor that goes to :387 to "copy the existing join" finds nothing and starts improvising.
- **PATCH**: in §1.4 and F3 replace the parenthetical with: `(sys_performance_reviews.review_subject_user_id is the person key — see me/repository.ts:387 which filters on it; the ratings→reviews JOIN itself is NEW code, modeled on the FK sys_prcr_review_fk in 000065)`.

**C3 — Wrong Playwright spec location: `apps/web/e2e/` does not exist.**
- **Evidence**: `ls apps/web/e2e/` → "No such file or directory". `apps/web/playwright.config.ts:42` → `testDir: "./tests/e2e"`; 60+ existing specs live in `apps/web/tests/e2e/*.spec.ts` (e.g. `auth.spec.ts`, `admin-tabs.spec.ts`).
- **Impact**: M9 tells the executor to model on "existing specs in `apps/web/e2e/`" and add the new spec there. A spec placed in `apps/web/e2e/` is outside `testDir` — `--grep` finds no tests (Playwright errors "no tests found") or, worse, a full run goes green without ever executing the new spec (vacuous V12).
- **PATCH**: in M9 and V12 replace every `apps/web/e2e/` with `apps/web/tests/e2e/` and add: `confirm placement with: grep -n "testDir" apps/web/playwright.config.ts → "./tests/e2e"`.

### MAJOR

**M1 — E1 misstates the 000083 audience: 7 roles named (incl. CEO), the migration grants 6 and CEO is NOT among them.**
- **Evidence**: `db/migrations/000083_insights_permission_seed.sql:28` grants exactly `('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')`. The plan's E1 says "the 6 non-leaf roles — PLATFORM_ADMIN, TENANT_ADMIN, HRMS_MANAGER, BLUEPRINT_MANAGER, PROCESS_OWNER, MANAGER, CEO minus leaf roles" — seven names labeled "6", with CEO invented. The "copy the exact role list from 000083" hedge saves a careful executor, but a mid-tier model facing "the list I was given says CEO, the file says no CEO" has a coin-flip. Worse, the contradiction hides a REAL product question the plan should have surfaced: `resolver.ts:44` makes CEO a MANAGERIAL_ROLE (org-subtree scope), so a CEO without `evidence:read` gets 403 on the whole evidence surface — coherent with 000083's insights precedent, but it deserves to be IN E1 as an explicit named consequence, not an accident.
- **PATCH**: E1 becomes: `Mirror 000083 EXACTLY: the 6 roles PLATFORM_ADMIN, TENANT_ADMIN, BLUEPRINT_MANAGER, HRMS_MANAGER, PROCESS_OWNER, MANAGER. CEO is deliberately NOT granted (same as insights:view — flag for Enzo: CEO is managerial in resolver.ts:44 but has no evidence:read; he will 403 on /v1/evidence like he does on /v1/insights).` In M2 Expected and V2, replace "≈ 6–7 roles" with "exactly 6 roles".

**M2 — 360 anonymity has a de-anonymization side channel the hard rule does not cover: `response_relationship_type`.**
- **Evidence**: `000065:266` + CHECK :282-283 — `response_relationship_type IN ('SELF','PEER','MANAGER','DIRECT_REPORT','SKIP_LEVEL','EXTERNAL')`. The plan's hard rule masks `reviewer: null` only. If the executor maps relationship type into `EvidenceItem.label` or `sourceRef` (the natural choice for a 360 row's "label"), an anonymous response labeled `MANAGER` is de-anonymized for any subject with one manager — the org chart is queryable by the same viewer.
- **PATCH**: extend the §2 hard rule: `for rows with response_is_anonymous = true, suppress response_relationship_type as well (label = generic "360 feedback"); anonymity means no field in the body may narrow the reviewer's identity — not just the author field.` Add the same assertion to M7.1.

**M3 — Recon check R6 is a verification that cannot fail (broken PowerShell regex).**
- **Evidence**: R6 = `Select-String -List "performance_review\|reviews"`. Select-String patterns are .NET regex: `\|` matches a LITERAL pipe character, so the pattern matches only the string `performance_review|reviews` — which exists nowhere. The check returns "none" whether or not a reviews page exists, vacuously "confirming" the F2 default. (The conclusion happens to be true today — page enumeration confirms no admin reviews page, only `/users/[userId]` — but the check as written can never disconfirm it.)
- **PATCH**: R6 becomes: PowerShell `Get-ChildItem -Recurse apps/web/src/app -Filter page.tsx | Select-String -Pattern "performance_review", "reviews" -List` (comma = OR) or bash `grep -rlE "performance_review|reviews" apps/web/src/app --include=page.tsx`.

**M4 — The hardcoded-count test couplings on the evidence tables exist and the plan never maps them; its fixture strategy is safe ONLY via D-52, a dependency it never states.**
- **Evidence**: `apps/api/test/sdbi-perf-feedback.integration.test.ts:24-26` asserts EXACT totals `465 / 390 / 474` on ratings / f360 / continuous-feedback; :109-111 asserts exact NOT-NULL splits (474, 473, 146); :113-114 asserts 390 rows with BOTH target and reviewer NOT NULL (which incidentally settles R5 for f360: zero NULL targets). `reconciliation-learning-rehome.integration.test.ts:81` asserts the learning-evidence total (1434). The M7.2/F6 fixture INSERTs into `sys_user_assessment_evidence` survive only because D-52 rolls the whole file back and vitest is singleThread — true, but unstated. An executor that seeds via psql "to be sure the fixture exists", or runs with `TEST_TX_ISOLATION=0` (an escape hatch the plan itself names in §1.5), turns three unrelated test files red with no visible cause.
- **PATCH**: add to M7.2 and F6: `Fixture rows MUST be inserted inside the test file via pool.query (D-52 rolls them back; singleThread means no other file observes them). NEVER seed fixtures via psql and NEVER set TEST_TX_ISOLATION=0 — sdbi-perf-feedback.integration.test.ts:24-26,109-114 and reconciliation-learning-rehome.integration.test.ts:81 assert EXACT row counts on 4 of the 8 evidence tables and will break on any committed residue.` Extend ABORT-7's rationale with the same file references.

### MINOR

**m1 — Per-category `EvidenceItem` field mapping is underspecified (guess points).** M5 gives the subject predicates and the author-masking CASEs but not the `label`/`narrative` mapping per category. Verified DDL shows the categories are heterogeneous: learning evidence (000006:268) has NO dimension/narrative — a human label needs a JOIN to `sys_learning_modules` (FK added in 000016); kpi results need `sys_kpi_definitions`; behavioral has `competency` varchar(255); person records have `person_evidence_type` + jsonb payload. A mid-tier model will invent 8 mappings. PATCH: add one line per category to M5 (`label ← dimension | module name (JOIN sys_learning_modules) | person_evidence_type | competency | rating_competency_name | '360 feedback' | feedback_type | kpi name (JOIN sys_kpi_definitions)`).

**m2 — `/insights/succession-readiness/page.tsx` exists (with the same `selected` drill-down state, line 39) and is not wired.** The plan is faithful to the doc of record (`DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md:72` lists exactly the 5 surfaces M8 covers), so this is NOT an error — but the readiness page is a 5-line adjacency with the shared panel. PATCH (optional): note it in M8 as "in-scope-adjacent, add only if zero marginal risk; not demanded by the doc of record".

**m3 — M2 template conflation.** 000166 uses `WHERE NOT EXISTS` + NOTICE-only; 000083 uses `ON CONFLICT DO NOTHING` + an EQUALITY exception (`IF v <> 2 THEN RAISE EXCEPTION`, 000083:43) — the very anti-pattern the plan bans citing the 000142 lesson (000142:43 uses the floor form `IF v < 8`, verified). The plan's M2 instructions are correct, but it should say explicitly: "take ONLY the audience list from 000083; take the guard style and assert style from 000166/000142 — do NOT copy 000083's equality assert."

**m4 — Push-authorization tension.** Project CLAUDE.md: "Never `git push` without an explicit ask". M10 treats the mission DoD (CI green + deploy) as the ask; ABORT-6 covers the hard conflict. Acceptable, but M10 should say "the mission brief's DoD line IS the explicit ask for this session" so the executor doesn't stall.

---

## SPOT-CHECKED CLAIMS (outcome table)

| # | Claim (plan §) | Verified against | Outcome |
|---|---|---|---|
| 1 | 8 evidence tables' DDL at 000006:173/268/329, 000015:218, 000017:79, 000065:191/259/321 | migrations read | ✅ EXACT (all 8 file:line correct) |
| 2 | `rating_subject_user_id` NULLABLE; `rating_review_id` NOT NULL FK CASCADE; `rating_self_evidence text[]`; KSABA CHECK | 000065:194-235 | ✅ |
| 3 | `response_is_anonymous boolean NOT NULL DEFAULT true`; target/reviewer nullable; immutable (no updated_at) | 000065:263-277,314 | ✅ |
| 4 | `feedback_is_private` boolean; visibility CHECK PRIVATE/MANAGER/TEAM/PUBLIC | 000065:331-349 | ✅ columns exist — ❌ plan omits `is_private DEFAULT false` + never uses visibility (→ C1) |
| 5 | "COALESCE join at me/repository.ts:387 already uses" (F3) | me/repository.ts:375-396,559-574 | ❌ FALSE — flat SELECT on sys_performance_reviews, no join, no ratings table (→ C2) |
| 6 | DRIFT test at scope-data-classes.integration.test.ts:28 forces M2-before-M3 | test read | ✅ (:28-31 asserts every taxonomy key exists in sys_auth_permissions; 5 tests in file) |
| 7 | "No admin reviews page exists" | full page.tsx enumeration (99 pages) | ✅ conclusion true — ❌ R6's check is a broken regex that can't fail (→ M3) |
| 8 | S1013 template: personas, TEST_PERSONA_PASSWORD (env), 200/404/403 quartet, 250 lines | insights-scope.integration.test.ts | ✅ all (incl. 404 NOT_FOUND existence-hiding at :188-195, 403 at :223-233) |
| 9 | 000166 pattern: NOT EXISTS guards, self-grant to PLATFORM_ADMIN/TENANT_ADMIN/READ_ONLY/USER, NOTICE-only | 000166 read | ✅ |
| 10 | 000083 audience "6 non-leaf roles incl. CEO" | 000083:28 | ❌ 6 roles, NO CEO; plan names 7 (→ M1). Also 000083 has an equality assert (:43) — anti-pattern per plan's own D-38 rule (→ m3) |
| 11 | 000142 floor-assert lesson | 000142:42-43 (`IF v < 8 THEN RAISE EXCEPTION`) | ✅ |
| 12 | data-classes.ts map :45-70, EVALUATION block ends `insights` :69, `evidence` absent | file read | ✅ |
| 13 | gate.ts: verbs :32, values :27-29, `self` exempt :79, resource split :74-77, ORG_GATE_MISSING :111-123 | file read | ✅ (`:self` in `evidence:read:self` → parts.includes("self") → exempt, confirmed) |
| 14 | resolver.ts: HR_MANDATED :26, MANAGERIAL :44 (MANAGER, CEO), resolveOrgReadScope :58, canReadOrgTarget :89 | file read | ✅ |
| 15 | app.ts: gate registered :200 (before modules), learningGaps :378, insights :427 | grep | ✅ |
| 16 | insights/routes.ts every sensitive GET `orgGate:"service"` :26-44; allowList `ANY($n::uuid[])` in repo | files read | ✅ |
| 17 | org-gate.integration.test.ts derives surface from taxonomy, 4 tests, auto-covers new resource | file read | ✅ |
| 18 | me/routes.ts:175 `/gaps` with `gap_analysis:read:self` | file read | ✅ |
| 19 | i18n: 10 namespaces ×2 langs; checker `apps/web/scripts/check-i18n-parity.ts` | ls | ✅ |
| 20 | 167 migrations, max 000169; 9 CI workflows | ls | ✅ |
| 21 | SOT_BACKLOG #27 ACTIVE at line ~68 | grep | ✅ (line 68 exactly) |
| 22 | /insights `selected: FlightRiskScore\|null` (~:30); /gaps rows carry userId, fetch `/v1/learning-gaps?limit=200` | files read | ✅ (:29; :12,:36) |
| 23 | `useCurrentUserPermissions()` exists (red-team patch #3 dependency) | grep web | ✅ (`@/lib/api/auth`, already used on insights page) |
| 24 | Playwright specs "in apps/web/e2e/" (M9) | ls + playwright.config.ts:42 | ❌ dir doesn't exist; testDir `./tests/e2e` (→ C3) |
| 25 | Row counts 465/390/474 (ratings/f360/cf) and R5 null-fractions | sdbi-perf-feedback.integration.test.ts:24-26,109-114 | ✅ counts confirmed by committed test asserts; f360: ALL 390 have target+reviewer NOT NULL; cf: 474/474 recipients — but these same asserts are the count-coupling the plan never maps (→ M4) |
| 26 | Doc of record L2 surfaces = the 5 pages M8 wires | DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md:72 | ✅ (succession-readiness legitimately out of scope → m2) |

---

## INDEPENDENT 8-POINT GRADE (vs SUCCESS.md)

| # | Point | Grade | Note |
|---|---|---|---|
| 1 | Expected observation per move | **PASS** | Every M0–M12 has concrete observables (exit codes, HTTP codes, NOTICE contents) |
| 2 | Failure + signal + counter per move | **PASS** | All moves carry ≥1 keyed failure; several 2–3 |
| 3 | Forks with triggers | **PASS** | F1–F10 bind observations to routes; E-defaults mechanism sound (E2's CONTENT is wrong — C1 — but that's a recon/default flaw, not a missing trigger) |
| 4 | RECON NEEDED with exact checks | **FAIL** | R6 is a check that cannot fail (M3); R5 misses the decisive privacy datum `feedback_visibility` (C1). The other 7 are exemplary — but the standard says the EXACT check that settles it, and two don't |
| 5 | Abort conditions | **PASS** | ABORT-1..8 + 30-min/2-attempt rule, all observable |
| 6 | Verification spelled out | **PASS (caveat)** | V1–V17 complete and mapped to DoD; V12 inherits the wrong spec path (C3) |
| 7 | Red-team survived + recorded | **PASS (caveat)** | 6 attacks, 2 repelled with evidence, 4 patched into moves — formally the best section. Caveat: it missed the nearest-neighbor of its own Attack C (continuous-feedback visibility, same migration, next table) |
| 8 | Executable blind | **FAIL** | Three false "verified" facts (C2, C3, M1's 000083 misquote) are precisely where a mid-tier model guesses; plus the unstated D-52 dependency (M4) and 8 unmapped label mappings (m1) |

**Independent grade: 6/8** (plan self-graded 8/8 — points 4 and 8 do not genuinely hold as written).

---

## SUMMARY

- Findings: **3 CRITICAL** (C1 privacy default on wrong column; C2 fabricated join precedent; C3 wrong E2E spec directory), **4 MAJOR** (E1/000083 misquote incl. phantom CEO; 360 relationship-type de-anonymization channel; R6 unfailable check; unstated count-coupling/D-52 dependency), **4 MINOR**.
- The recon core (DDL, taxonomy, gate, resolver, tests, SoT line numbers) is verified-accurate to the line — the plan's skeleton is trustworthy.
- **Safe to execute blind ONLY after applying the patches above** (all are localized text edits to the plan; none change its architecture).
