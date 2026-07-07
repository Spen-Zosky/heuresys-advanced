# REVIEW-13 — Adversarial review of `wargames/13-heuresys-f4-activity.md` (F4 functional/activity axis)

- **Reviewer**: independent adversarial pass, 2026-07-06. Repo evidence read from `D:\heuresys-advanced` (read-only, HEAD as mounted).
- **Standard**: `SUCCESS.md` (8 points). Method: full read of plan + brief, 25+ factual claims spot-checked against the repo, architecture attacked on both routes, gate extension verified against `gate.ts` mechanics, blind-executability probed.

## VERDICT: **PASS-WITH-PATCHES**

The recon is exceptionally accurate — of ~25 spot-checked claims, **none was refuted**; the core architectural thesis ("the A/B fork touches only the storage layer") survives attack because `goal` really is pinned to `EVALUATION` in a one-class-per-resource map (`data-classes.ts:45-70`), so route B provably still needs the new `activity` resource, gate extension, resolver and participants table. The C6 drift-test ordering trap is real and correctly patched. **But the plan ships one deterministic suite-breaker it never saw (F-1), and three internal contradictions a blind executor cannot resolve (F-2, F-3, F-5).** All are fixable with localized patch text below. Do not hand this to a blind executor unpatched: F-1 alone funnels the executor into ABORT-5 on a healthy mission.

---

## FINDINGS

### F-1 · CRITICAL — C1 (and route-A A1) deterministically break `reconciliation-registry.integration.test.ts`, and the plan never mentions it

**Evidence (verified)**: `apps/api/test/reconciliation-registry.integration.test.ts:10` — `it('registry holds exactly 115 rows with the signed-off bucket split A27/B16/C23/D49', …)` — and line 59: `expect(m).toEqual({ A: 27, B: 16, C: 23, D: 49 });`. This is a **hardcoded exact bucket split**. The file's 50-line comment trail (lines 16-58) shows the established ritual: every migration that INSERTs a registry row also bumps this expectation + adds a comment line (e.g. line 43-44 records exactly the 000121 bucket-D row the plan mirrors; lines 39-41 record a session that *forgot* this and left the assert red).

**Consequence**: C1's registry INSERT (bucket D, explicitly planned per V18) makes the split `D: 50` / 116 rows → the test goes red at the first full-suite run (V-RUN-4, after C7). Route A's A1 adds a second bucket-D row (`D: 51`). The failure appears in **a module the mission never touched** — which is the *literal trigger text of ABORT-5* ("failures in modules this mission never touched → stop"). A blind executor either aborts a healthy mission or burns its ABORT-7 attempt budget on a failure the plan declared out-of-band. Worst case: it "fixes" the test by weakening it — the exact anti-pattern the plan's own red-team §11 warns about for the drift test.

**Patch (exact)**:
1. In **C1 Action**, after the registry-INSERT sentence, append: *"MANDATORY PAIRED EDIT (same commit): `apps/api/test/reconciliation-registry.integration.test.ts` hardcodes the bucket split at line 59 (`{ A: 27, B: 16, C: 23, D: 49 }`, 115 rows, title at line 10). Bump `D` by +1 (and the title's total by +1) and append a comment line to the trail following the file's ritual: `+1 bucket-D EXCLUDE — F4 ADR-0027 sys_process_participants (app-authored user↔process membership, mig 000170)`. This is the established pattern (see the S990 absorption note at lines 39-41 — a prior session forgot it and left the suite red)."*
2. In **A1 Action**, append the same instruction for `sys_activities` (second +1 to D).
3. In **C1 Failure**, add: *"Full suite red on `reconciliation-registry` 'registry holds exactly N rows' → cause: the paired test edit above was skipped → counter-move: apply it; this is NOT ABORT-5."*
4. In **ABORT-5**, add the exclusion: *"(a red `reconciliation-registry` bucket-split after C1/A1 is the planned paired-edit miss, not an abort trigger — see C1)."*

### F-2 · MAJOR — RN-2's member-visibility default is unreachable over HTTP: C2's read audience excludes the roles real members hold

**Evidence (verified)**: C2 seeds `activity:read` to 000142's six roles + `TEAM_LEADER` — i.e. `{PLATFORM_ADMIN, TENANT_ADMIN, BLUEPRINT_MANAGER, HRMS_MANAGER, PROCESS_OWNER, MANAGER, TEAM_LEADER}` (000142:26 verified for the base six). But `TEAM_LEADER`/`TEAM_MEMBER` are **holderless functional roles** (project CLAUDE.md, S953/R2); real team members hold `USER` (e.g. tommaso.fiore, USER, in the persona set the plan itself cites at V19). RN-2's default promises *"member sees rows where they are assignee/subject + team-level rows of their own teams"* — but a USER-role member calling `GET /v1/activities` dies at `requirePermission("activity:read")` with 403 **before the functional resolver ever runs**. The same hole makes A2's Expect *"outsider gets empty list"* wrong (a USER-role outsider gets **403**, not an empty list) and makes the A3/B5 HTTP matrix rows "member per RN-2" untestable as written. (C7 is unaffected — it tests the resolver primitives directly.)

**Patch (exact)**:
1. Add **RN-2b** to §2: *"Does `activity:read` extend to `USER` (the role real members hold — TEAM_MEMBER is holderless), with row-level scope enforced by the functional resolver? Default: YES — mirror the I17 floor logic (a member must at least see their own team's activity rows); flag the grant explicitly in the C2 commit message for Enzo's review."*
2. In **C2 Action**, change the read audience to: 000142's six + `TEAM_LEADER` + `USER` (per RN-2b default).
3. In **A2 Expect**, replace *"outsider gets empty list"* with: *"outsider WITH activity:read (e.g. USER in another team) gets an empty list; the resolver — not RBAC — produces the emptiness."*

### F-3 · MAJOR — Route B contradicts itself: B1's disjointness CHECK makes B5 case 4 impossible without an unspecified `/me` change

**Evidence (verified)**: B1's CHECK — `(goal_team_id IS NULL AND goal_blueprint_process_id IS NULL) OR goal_subject_user_id IS NULL` — forces **anchored ⇒ subject NULL** (the plan calls this "what keeps the two axes disjoint at the data level"). But the `/me` self-reads select strictly by subject: `apps/api/src/modules/me/repository.ts:453` (`FROM sys.sys_goals WHERE goal_subject_user_id = $1`) and `:566` (count, same predicate). Therefore an anchored row **can never appear on `/me`** — by construction, not by B2's exclusion filter. Yet B5 case 4 lists as a green pass criterion: *"`/v1/me` self-reads still return the user's own anchored+unanchored items per I17 (decide surface: /me shows both)"*. That expectation is structurally unsatisfiable without modifying `me/repository.ts` to add an owner/assignee-based read of anchored rows — a change the plan never specifies (the B5 failure branch waves at it as "a PRODUCT nuance"). A blind executor hits a red test whose fix is an unplanned schema-of-work decision.

**Patch (exact)**: Rewrite B5 case 4 as a fork with a trigger:
- *"Case 4 has two admissible shapes — put the choice in the C9 memo as question 6. **Default (zero-touch)**: `/me` goals show UNANCHORED items only (they select by `goal_subject_user_id`, and B1 forces anchored ⇒ subject NULL — verified `me/repository.ts:453,566`); the user's own anchored activities are served by `/v1/activities` filtered on assignee=self (I17 satisfied across the two surfaces, not on one). **Alternative (if Enzo asks for /me to show both)**: extend the two `/me` queries with `OR (goal_owner_user_id = $1 AND (goal_team_id IS NOT NULL OR goal_blueprint_process_id IS NOT NULL))` and add the anchored/unanchored marker to the response shape."* Update FORK-7 to reference the same trigger instead of asserting "self sees own rows on /me regardless of anchor".

### F-4 · MAJOR — RN-5's default for TENANT_ADMIN contradicts the design spec the plan itself declares SoT

**Evidence (verified)**: the plan's header rule is "SoT wins over this plan", and SoT item 6 is the design spec. Spec §2 Pillar 3 (rules, first match) — rule 2: HR-mandated roles get tenant-wide **"for sensitive classes"**; rule 3: `dataClass = ACTIVITY` → `functionalScopeUserIds(actor)`. Under the spec's own first-match order, a TENANT_ADMIN reading ACTIVITY falls to rule 3 (functional scope), NOT tenant-wide. I21 (ADR-0027 line 102) grants plenipotentiary reads to **HRMS_MANAGER only**. The plan's RN-5 default — *"yes for both (I21 for HRMS_MANAGER; admin duty for TENANT_ADMIN)"* — is spec-conformant for HRMS_MANAGER but **invents** the TENANT_ADMIN widening ("admin duty" appears in no SoT). On silence (Enzo answers only "A"/"B"), the executor ships an authorization scope wider than designed, in the one domain where the brief says semantics are "Enzo's authority — never pre-decide", and faces a direct SoT-vs-plan contradiction it was told to resolve in favor of SoT.

**Patch (exact)**: In RN-5, change the default to: *"Default: **HRMS_MANAGER yes** (I21, ADR-0027 §2.7), **TENANT_ADMIN no** (spec §2 Pillar 3 first-match sends ACTIVITY to rule 3; I21 covers HRMS_MANAGER only) — TENANT_ADMIN tenant-wide activity visibility ONLY on Enzo's explicit yes."* Mirror the same wording in C4's rules sentence.

### F-5 · MAJOR — Interface gap between the common resolver (C3/C4, user-id based) and the route repositories (A2/B3, anchor-id based)

**Evidence**: C4 defines `FunctionalReadScope` as a mirror of `OrgReadScope` (verified shape at `resolver.ts:33-37`: kinds + `userIdAllowList`). But A2's repository filter is keyed on **anchors**: `activity_team_id = ANY(teams actor leads/belongs) OR activity_blueprint_process_id = ANY(...) OR assignee = actor` — it needs **team-ID and process-ID lists**, which no C3 export provides (`functionalScopeUserIds` / `isInFunctionalScope` / `functionalMembershipUserIds` all return user-id sets). The plan's parenthetical "(the allow-set … computed as team/process ID lists + member user ids per RN-2 semantics)" acknowledges the need but never says where those helpers live or what the resolver's return shape actually carries. A mid-tier executor will guess an interface here — the exact thing SUCCESS point 8 forbids.

**Patch (exact)**: In **C3 Action**, add two exports: *"`ledAnchorIds(q, actorUserId): Promise<{teamIds: string[]; processIds: string[]}>` (teams via `team_lead_user_id=$1` UNION active `team_member_role='LEAD'` rows; processes via `sys_process_participants` role LEAD) and `memberAnchorIds(q, actorUserId)` (same shape, MEMBER rows)."* In **C4**, define: *"`FunctionalReadScope = { kind: "all" } | { kind: "tenant"; tenantId } | { kind: "anchored"; tenantId; teamIds: string[]; processIds: string[]; userIdAllowList: string[] } | { kind: "self"; tenantId; userIdAllowList }` — the anchored variant carries BOTH the anchor-id lists (for A2/B3 SQL filters) and the user allow-list (for per-target checks)."*

### F-6 · MINOR — C8 pushes without noting the per-session push-authorization rule

Project CLAUDE.md: "Never `git push` without an explicit ask" and (autonomy section) push authorization is per-session, resetting to "ask" on a new session. C8 says "commit … push, wait CI" unconditionally. **Patch**: add to C0: *"Capture whether the kickoff message grants push authorization; if not, C8 stops at local commits and asks Enzo before pushing (project rule, per-session)."*

### F-7 · MINOR — Line-cite imprecisions (none load-bearing, all verified against the repo)

- V4 cites design spec ":43,77" — line 43 contains the Pillar-1 phrase but **not** the string `sys_process_participants` (only :77 does).
- A4/FORK-8 cite "000132:164-174" for the notification CHECK — actual guarded DROP/ADD at **171-174** of `000132_approval_runtime.sql` (the plan also never gives the real filename; C0's `\d` hedge covers it).
- V10 cites "000037:125-147" for the `goal_type` CHECK — the CHECK is at **143-148** (content claim verified: `'OBJECTIVE','PROJECT'` both present at :147).
- V15 cites "role-codes.ts:11-21" — the array runs **11-24** (the 12-role count is correct; `ORG_DIRECTOR` at :23).
- V-RUN-4 baseline "~189+ files" — DEBT_REGISTER D-52 records **186 passed + 2 skipped** at S1015 (plan marks it re-derive, so harmless).

**Patch**: correct the five cites; they are the currency this plan trades in.

### F-8 · MINOR — PROD probe path inconsistency (V-RUN-7 vs V-RUN-8)

V-RUN-7 probes `https://www.heuresys.com/readyz`; the project's own dashboard doctrine (CLAUDE.md §status_dashboard) probes `/api/readyz`, and V-RUN-8 correctly hedges "(or the deployed API path prefix found in C0)". **Patch**: apply the same hedge to V-RUN-7 and add to C0: *"capture the deployed API path prefix (nginx mapping) from `deploy/` or the dashboard script."*

### F-9 · MINOR — Header SoT re-read list omits the f3-sensitive-modules-map the brief names as a recon source

`docs/superpowers/specs/2026-07-01-f3-sensitive-modules-map.md` exists (verified) and the brief lists it. It is historical, and backlog #24's own doc line points at it, so impact is low — but the plan's re-read list should mirror the brief's. **Patch**: add it as item 8 of the re-read list, marked "(historical — module→gate map)".

---

## ARCHITECTURE ATTACKS — outcomes

- **"The fork touches ONLY the storage layer"** — **HOLDS**. Verified: `goal: "EVALUATION"` at `data-classes.ts:65` in a `Record<string, DataClass>` (one class per resource, :45); the drift test (:28-32) checks mapped keys against live RBAC resources; therefore route B cannot re-map `goal` and still needs the new `activity` resource + routes + gate + resolver + participants table. C0-C7 are genuinely route-invariant (C6's `activity` mapping is needed by both routes; at C6 no route yet carries `activity:read`, so the armed gate sees an empty set — verified against the collector mechanics).
- **Route-B consequence hunt** — the plan caught the big one (`/v1/goals` `OR goal_subject_user_id IS NULL` tenant-visibility at `repository.ts:56`, and the same-commit rule B2+B3) but missed the `/me` structural contradiction (F-3). Full-src grep confirms only **two** files read `sys_goals` (`modules/goals/repository.ts`, `modules/me/repository.ts`) — no analytics/dashboard leak path exists today, so B2's surface enumeration is complete once /me is settled.
- **Route-A consequence hunt** — reconciliation-registry hardcoded split missed (F-1). RBAC-side clear: the I21 test asserts only its owned `I21_GRANTS` codes (verified :128-150), the permission tests are live-derived, and 000142's own assert is an explicit floor — no other count landmine found.
- **Gate extension (C5)** — **COHERENT** with `gate.ts` as written: the collector reads `permissionCode` off preHandlers (:62-71), classifies via `isSensitiveReadCode` (:74-83, self-exempt via `parts.includes("self")`, READ_VERBS {read,view,list}), asserts at `onReady` (:111-123, `ORG_GATE_MISSING`). A parallel `activityGate` key + `ACTIVITY_GATE_MISSING` slots in cleanly; keeping `orgGate` semantics untouched preserves the 76 annotated routes (verified: DEBT_REGISTER D-51 RISOLTO records exactly 76; `grep orgGate:` finds 78 occurrences incl. non-route refs). The negative-test design mirrors the existing 4 tests in `org-gate.integration.test.ts` (verified: exactly 4 `it(` blocks).
- **Ordering trap (red-team attack 2)** — **REAL and correctly patched**: the drift test's direction (mapped key must exist in live `sys_auth_permissions`) confirms the C1+C2-before-C6 sequencing is the only safe order.

## SPOT-CHECKED CLAIMS (26)

| Claim | Outcome |
|---|---|
| V1 ADR-0027:134 (F4 only remaining; cross-tree F5 half in F4) | **verified** |
| V2 ADR §2.3 (Enzo's four, lines 60-65) | **verified** |
| V3 ADR §2.5 (cardinal rule, 81-89) | **verified** |
| V4 `sys_process_participants` absent from code/migrations | **verified** (cite ":43" imprecise — F-7) |
| V5 000121 RACI CHECK + FK → `blueprint_process_id` | **verified** (:36-38, :50) |
| V6 `sys_teams.team_lead_user_id` + LEAD/MEMBER CHECK + `team_member_is_active` | **verified** (000054:34, :74-78, :66) |
| A-1 `sys_teams` tenant column = `team_tenant_id` | **verified** (000054:30 — assumption correct) |
| V7 lib/scope = 5 files, org-only; HR_MANDATED + MANAGERIAL sets | **verified** (resolver.ts:26-29, :44) |
| V8 ACTIVITY in union, zero mapped, one-class-per-resource | **verified** (data-classes.ts:20, :38, :45-70) |
| V9 `goal`→EVALUATION :65; orgGate on goals routes :16,:22; `OR IS NULL` filter :53-57 | **verified** (all three, exact lines) |
| V10 no team/process anchor on sys_goals; goal_type CHECK has OBJECTIVE/PROJECT | **verified** (CHECK at 000037:143-148, cite off — F-7) |
| V11 `approval` unmapped; no orgGate in approvals; polymorphic resource_type varchar(64); buildScope :45-48 | **verified** (file is `000132_approval_runtime.sql`; resource_type :35) |
| V12 gate covers SENSITIVE only; closed set; self/write exempt; ORG_GATE_MISSING | **verified** (gate.ts:74-83, :111-123) |
| V13 ScopeAxis has no "functional" | **verified** (audit.ts:17) |
| V14 drift test checks mapped→live-RBAC at :28-32 | **verified** (exact lines) |
| V15 12 roles incl. TEAM_LEADER/PROCESS_OWNER | **verified** (role-codes.ts:11-24; cite range off — F-7) |
| V16 000142 seed pattern + audiences | **verified** (:8-37; NB its own assert is a resource-floor — plan's D-38 override instruction is explicit, OK) |
| V17 167 files, max 000169, gap at 000035 | **verified** (ls: 167, tail 000169, 000034→000036) |
| V18 recon-registry INSERT bucket D pattern | **verified** (000121:74-81) — but paired test edit missing → **F-1** |
| V19 personas env-driven (F-001) | **verified** (`test/helpers/personas.ts` exists, env-driven) |
| V21 app.ts :100/:200/:422/:435 | **verified** (all four exact) |
| V22 `goal:read:self` exists (000166) | **verified** (`000166_me_goals_self.sql` exists) |
| D-51/D-52 RISOLTO; 76 annotated routes; suite 186f/1285t | **verified** (DEBT_REGISTER:63-64) |
| #24 HOLD, `{kind: manual}`, decided-by Enzo | **verified** (SOT_BACKLOG:18-22) |
| A-3 `activity` resource likely free | **supported** (activity-classifications module uses `enterprise_typing:*` — live RN-6 check still required, as planned) |
| org-gate test = 4 tests | **verified** (4 `it(` blocks) |

**Refuted: 0.** Imprecise cites: 5 (F-7). Missed facts: 1 critical (F-1), 3 contradictions (F-2/F-3/F-5).

## INDEPENDENT 8-POINT GRADE

| # | Standard | Grade | Note |
|---|---|---|---|
| 1 | Expected observation per move | **PASS** | Concrete observables throughout; A2's "outsider gets empty list" is the one wrong Expect (F-2) |
| 2 | Failure/cause/counter-move per move | **FAIL as written → PASS after F-1 patch** | Every move has triples, but C1/C8's single *deterministic* failure (reconciliation bucket split) is absent — and it funnels into ABORT-5 |
| 3 | Fork triggers, no judgment calls | **PASS with patches** | Master fork trigger is genuinely mechanical; RN-5's TENANT_ADMIN default (F-4) and B5 case 4 (F-3) leave contradictions the executor must judge |
| 4 | RECON NEEDED with exact checks | **PASS** | RN-1..10 all carry literal commands/mechanisms; RN-6/RN-8 checks verified sound |
| 5 | Abort conditions | **PASS** | Well-designed (pause-at-α, TX-isolation ban, anti-anchoring) — but ABORT-5 needs the F-1 carve-out |
| 6 | Verification spelled out | **PASS** | V-RUN-1..8 ordered with criteria; minor probe-path inconsistency (F-8) |
| 7 | Red-team survived + recorded | **PASS (formally)** | Both attacks genuine; attack 2's patch is real and verified. The red-team missed the registry-test class it should have caught — the same "hardcoded count" species as its own drift-test attack |
| 8 | Executable blind | **FAIL as written → PASS after patches** | F-1 (abort trap), F-2 (403 wall on planned tests), F-3 (unsatisfiable pass criterion), F-5 (interface guess), F-6 (push permission) each force a mid-tier model to guess or stop |

**Score as written: 6/8. After the patches above: 8/8** — the plan's claimed 8/8 was optimistic by exactly the two blind-execution killers it could not see from its own recon (both are *test-suite* couplings, not source couplings — the blind spot is consistent).

## BOTTOM LINE

The plan's recon and architecture are the strongest part — every load-bearing fact checked out, the no-waste fork layering is genuinely sound, and the gate extension is implementable exactly as designed. The failures are all of one species: couplings that live in the *test suite and role-holder reality* rather than in the source files the recon read. Apply F-1 through F-6 (plus the F-7/F-8/F-9 cosmetics) and this is safe to hand to a blind Sonnet/Opus executor.
