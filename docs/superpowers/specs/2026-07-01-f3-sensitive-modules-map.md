# F3 — sensitive-modules map (ADR-0027, generated S1012 - 16-agent workflow 2026-07-01)

Closes debt **D-50**. Pattern is uniform (replicate the `users` module, F1): a list
endpoint filters rows by the resolver's `userIdAllowList` (`resolveOrgReadScope`); a
per-target read is gated by `canReadOrgTarget`. Resolver + data-classes already shipped
(F1/F2, `apps/api/src/lib/scope/`). ESS `/v1/me/*` is out of scope (already self-scoped).
`skill` (catalog only), `document`, `certification` need no change.

Each fix ships with an integration test on real RTL personas: a manager reads a report's
record (paolo -> tommaso) but not an outsider's (paolo -> antonio); a non-managerial user
sees only self; HR-mandated see the tenant. Run the full suite before deploy.

**13 sensitive resources with a cross-user leak to fix:**

## assessment  -  effort M
- **current gate**: service.ts:32-35 (visible() function checks only isPlatform + tenantId match; repository.ts:73-75 filters list only by tenantId, no userIdAllowList)
- **integration**: **list() endpoint:** (1) service.ts:29 - add import `canReadOrgTarget, resolveOrgReadScope` from "../../lib/scope/resolver.js"; (2) service.ts:49-52 - call `const scope = await resolveOrgReadScope(pool, actor)` and pass scope.userIdAllowList to repo.listAssessments() via ListFilter; (3) repository.ts:62-65 - add `userIdAllowList?: string[]` to ListFilter interface; (4) repository.ts:77-80 - add userIdAllowList filter: `if (filter.userIdAllowList) { if (filter.userIdAllowList.length === 0) return { items: [], total: 0 }; params.push(filter.userIdAllowList); where.push('assessment_subject_user_id = ANY($...) ') }` (pattern: users/repository.ts:86-93). **getById() endpoint:** (1) service.ts:29 - ensure canReadOrgTarget is imported; (2) service.ts:54-59 - replace visible(actor, target) call at line 57 with `!(await canReadOrgTarget(pool, actor, target.subjectUserId, target.tenantId))` (pattern: users/service.ts:79, 103).
- **files**: D:/heuresys-advanced/apps/api/src/modules/assessments/service.ts, D:/heuresys-advanced/apps/api/src/modules/assessments/repository.ts
- **notes**: Assessment is classified as EVALUATION (data-classes.ts:61) — a SENSITIVE resource requiring organizational-axis gating. The module today leaks cross-user sensitive per-person data (assessment_subject_user_id) to any actor holding assessment:read permission in the same tenant, regardless of org-chart position. The fix replicates F1 (already shipped in users module): resolve the actor's org scope once per request, filter list results by userIdAllowList, and gate get-by-id by canReadOrgTarget. Pattern reference: users/service.ts (lines 29, 50-64, 79, 95-107) and users/repository.ts (lines 67-125). The tenantId scope field is already correctly filtered; only the userIdAllowList axis is missing.

## capability  -  effort M
- **current gate**: Permission (capability:read) + tenant context only; no org-scope check. Routes.ts:27, 36 enforce capability:read; service.ts:252 builds tenant-only scope; repository.ts:237-251 listActiveScores filters only by tenantId; repository.ts:253-268 getActiveScore filters only by tenantId/subjectId without subject-user gating.
- **integration**: Extend routes and queries to filter EMPLOYEE subjects by org scope via resolveOrgReadScope + canReadOrgTarget:

(1) **service.ts imports**: Add `import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";` after line 20.

(2) **service.ts composition() method (line 251-260)**: Before line 252, resolve scope: `const orgScope = await resolveOrgReadScope(pool, actor);` then map to repo scope object `{ tenantId, userIdAllowList? }` and pass to listActiveScores. Only EMPLOYEE subjects check userIdAllowList; ORG/POSITION/ORG_UNIT aggregate up from scoped EMPLOYEEs so no separate gating needed there.

(3) **service.ts subject() method (line 262-268)**: Before line 265 (before returning toScore), gate EMPLOYEE reads: `if (subjectType === "EMPLOYEE") { if (!(await canReadOrgTarget(pool, actor, subjectId, row.tenantId))) throw new NotFoundError(...); }`. This prevents individual employee score enumeration across org boundary.

(4) **repository.ts listActiveScores() signature & WHERE clause (line 237-251)**: 
  - Extend scope parameter type from `{ tenantId: string | null }` to `{ tenantId: string | null; userIdAllowList?: string[] }`
  - After line 243, add clause: `if (userIdAllowList && subjectType === "EMPLOYEE") { params.push(userIdAllowList); clauses.push(\`s.capability_score_subject_id = ANY($\${params.length}::text[])\`); }`
  - This filters the /composition list response to only EMPLOYEE rows the actor may see.

(5) **repository.ts getActiveScore() signature (line 253-254)**: Optionally extend scope type to match listActiveScores for consistency, but service-layer gating in subject() is sufficient since getActiveScore is only called from subject().
- **files**: D:/heuresys-advanced/apps/api/src/modules/capability-composition/routes.ts, D:/heuresys-advanced/apps/api/src/modules/capability-composition/service.ts, D:/heuresys-advanced/apps/api/src/modules/capability-composition/repository.ts
- **notes**: The capability module exposes EMPLOYEE (per-person) capability scores via two endpoints: GET /composition (list all in tenant) and GET /composition/EMPLOYEE/{userId} (get one). Both routes require capability:read permission and check tenant context, but perform NO org-chart filtering. The "capability" resource is classified as SKILL data class (data-classes.ts:59), which is SENSITIVE and must be org-gated per ADR-0027. This is a D-50 leak: any :read permission holder reads ANOTHER user's sensitive SKILL data tenant-wide. The fix replicates the users module pattern (F1): (a) resolve org scope (resolveOrgReadScope) in composition() to get userIdAllowList; (b) pass userIdAllowList to repo.listActiveScores and apply SQL ANY() filtering; (c) gate subject() per-EMPLOYEE-read with canReadOrgTarget before returning. Non-EMPLOYEE subjects (POSITION/ORG_UNIT/ORG) remain tenant-wide (aggregates do not expose individual sensitive data). Estimated effort: imports + 2 type signature extensions + 1 SQL clause + 2 service-layer gates.

## career_succession  -  effort M
- **current gate**: Permission-only + tenant-scoped: `requirePermission("career_succession:read")` at apps/api/src/modules/successor-readiness/routes.ts:21, 26. No org-chart check via canReadOrgTarget().
- **integration**: **successor-readiness module (PRIMARY LEAK):**

1. **List endpoint** [apps/api/src/modules/successor-readiness/service.ts:25-28]:
   - Current: `repo.listReadiness(pool, { tenantId, query })`
   - Fix: Call `resolveOrgReadScope(pool, actor)` to obtain userIdAllowList; filter results by checking each readiness record's parent candidate (via sys.sys_successor_candidates.successor_candidate_user_id) against the allowlist before returning.

2. **Get-by-id endpoint** [apps/api/src/modules/successor-readiness/service.ts:30-35, visible() at line 19-22]:
   - Current: `visible(actor, target)` checks only `actor.tenantId === r.tenantId`
   - Fix: Replace visible() or add gate: `if (!await canReadOrgTarget(pool, actor, targetUserId, target.tenantId)) throw new NotFoundError(...)`
   - Obtain targetUserId by joining successor_readiness → successor_candidates to get successor_candidate_user_id

**Repository support** [apps/api/src/modules/successor-readiness/repository.ts]:
- listReadiness() at line 43-80: Add parameter `userIdAllowList?: string[]`; add WHERE clause to filter successor_readiness by parent candidate's user_id if allowlist present.
- findReadinessById() at line 82-87: Return the candidate's userId so service can call canReadOrgTarget().
- **files**: D:/heuresys-advanced/apps/api/src/modules/successor-readiness/routes.ts, D:/heuresys-advanced/apps/api/src/modules/successor-readiness/service.ts, D:/heuresys-advanced/apps/api/src/modules/successor-readiness/repository.ts
- **notes**: The successor-readiness module (resource: career_succession, classified as EVALUATION/SENSITIVE per data-classes.ts line 65) exposes two cross-user per-person read endpoints (GET / and GET /:id) gated only by permission + tenant, with no org-chart check. The vulnerability follows the D-50 pattern: any user with career_succession:read in a tenant can read any other user's succession readiness data. The list endpoint has no userIdAllowList filtering; the getById endpoint uses only a weak tenantId check in the visible() function. Secondary vulnerability exists in insights module (GET /v1/insights/succession-readiness at line 54-58 of routes.ts, service line 380-385), which also lacks per-user org-chart filtering. The reference implementation (users module, service.ts line 54-79) shows the correct pattern: call resolveOrgReadScope() to get userIdAllowList for lists, and canReadOrgTarget() for individual reads.

## compensation_intelligence  -  effort M
- **current gate**: apps/api/src/modules/compensation/routes.ts:30 requires only permission:read; apps/api/src/modules/compensation/service.ts:48 passes query.userId to repo without scope validation; apps/api/src/modules/compensation/repository.ts:177-179 filters by reward_gate_user_id without userIdAllowList gate
- **integration**: Plug resolveOrgReadScope and canReadOrgTarget at TWO points: (1) apps/api/src/modules/compensation/service.ts:43-49 — call resolveOrgReadScope(pool, actor), validate query.userId via canReadOrgTarget if specified, pass resolved userIdAllowList to repo.listRewardGates. (2) apps/api/src/modules/compensation/repository.ts:161 and post-line-180 — add userIdAllowList?: string[] to filter type and apply filtering via WHERE g.reward_gate_user_id = ANY($X::uuid[]) pattern (replicate users/repository.ts:86-93)
- **files**: D:/heuresys-advanced/apps/api/src/modules/compensation/routes.ts, D:/heuresys-advanced/apps/api/src/modules/compensation/service.ts, D:/heuresys-advanced/apps/api/src/modules/compensation/repository.ts
- **notes**: The vulnerable endpoint is GET /reward-gates which allows filtering by userId query param. Currently anyone with compensation_intelligence:read can list any tenant-member's reward gates without org-chart check. The POST /recommendations endpoint also targets users but is out-of-scope (write operation). The fix replicates the users module pattern (F1): service calls resolveOrgReadScope and passes userIdAllowList to repo, repo filters WHERE clauses by that list. No per-target get-by-id endpoint exists in compensation routes, so getById-style canReadOrgTarget gating is not needed here — only the list filter matters.

## gap_analysis  -  effort M
- **current gate**: apps/api/src/modules/learning-gaps/service.ts:25 — visible() checks only actor.tenantId === g.tenantId; routes.ts:25,30 gate on gap_analysis:read permission+tenant
- **integration**: Three exact changes needed to replicate users module pattern:

1. service.ts:57-60 (list method): Replace const tenantId line with call to resolveOrgReadScope(pool, actor) and extract userIdAllowList from result, then pass { tenantId, userIdAllowList, query } to repo

2. service.ts:62-67 (getById method): Replace visible(actor, target) check at line 65 with await canReadOrgTarget(pool, actor, target.userId, target.tenantId) to gate the read

3. repository.ts:62-65 (listGaps filter parameter): Add userIdAllowList?: string[] to the filter interface, then add SQL WHERE clause at line 88 using user_id = ANY($X::uuid[]) when userIdAllowList is present (following users/repository.ts:86-93 pattern)

Reference implementations: apps/api/src/modules/users/service.ts:50-64 (resolveReadScope pattern) and lines 100-108 (canReadOrgTarget usage); apps/api/src/modules/users/repository.ts:67-93 (ListFilter + listUsers WHERE clause)
- **files**: apps/api/src/modules/learning-gaps/service.ts, apps/api/src/modules/learning-gaps/repository.ts, apps/api/src/modules/learning-gaps/routes.ts
- **notes**: gap_analysis is classified SKILL (competency gaps → sensitive). The module's list/getById endpoints expose cross-user reads gated only by permission+tenant. No per-user filtering exists; a non-manager with gap_analysis:read permission can enumerate all users' skill gaps in the tenant. The fix mirrors users module F1 exactly: (a) service.list() calls resolveOrgReadScope to build userIdAllowList; (b) service.getById() gates with canReadOrgTarget; (c) repo.listGaps accepts userIdAllowList and applies SQL filter. ESS routes (/v1/me/*) are out of scope (already self-scoped). Both update/delete endpoints (service.ts:88-111) also need the canReadOrgTarget check; they currently only check tenant match.

## goal  -  effort S
- **current gate**: requirePermission("goal:read") at apps/api/src/modules/goals/routes.ts:16,21; tenant-only visibility via assertVisible(a, g.tenantId) at apps/api/src/modules/goals/service.ts:40,50,58 — no goal_subject_user_id check
- **integration**: 1. service.ts line 11: Add import `import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";`. 2. service.ts lines 34-36 (listGoals): Create resolveReadScope helper (see users/service.ts:50-64 pattern) calling resolveOrgReadScope(pool, a); pass result's userIdAllowList to repo. 3. service.ts lines 37-42 (getGoal): After assertVisible, add `if (g.subjectUserId && !(await canReadOrgTarget(pool, a, g.subjectUserId, g.tenantId))) throw NotFoundError("Goal");`. 4. service.ts lines 47-54 (updateGoal): Add same canReadOrgTarget check after assertVisible. 5. service.ts lines 55-60 (deleteGoal): Add same canReadOrgTarget check after assertVisible. 6. repository.ts lines 47-64 (listGoals): Add `userIdAllowList?: string[]` parameter to function signature and query interface; add filtering: `if (userIdAllowList) { if (!userIdAllowList.length) return { items: [], total: 0 }; params.push(userIdAllowList); where.push(`(goal_subject_user_id = ANY($${params.length}::uuid[]) OR goal_subject_user_id IS NULL)`); }`
- **files**: D:/heuresys-advanced/apps/api/src/modules/goals/service.ts, D:/heuresys-advanced/apps/api/src/modules/goals/repository.ts
- **notes**: Goal is EVALUATION-classified sensitive data (data-classes.ts:63). The vulnerability allows any goal:read holder to enumerate another user's goals within the same tenant via GET /:id. The goal_subject_user_id field (goals/repository.ts:15) is the org-scoping axis; it can be NULL (organizational goals with no subject user) which should remain tenant-visible to all. The fix mirrors users/service.ts F1 implementation: list filters by userIdAllowList, per-target ops gate via canReadOrgTarget. Non-managerial actors see self+org-subtree; HR-mandated (TENANT_ADMIN/HRMS_MANAGER) see tenant; PLATFORM_ADMIN sees all.

## insights  -  effort M
- **current gate**: Permission (insights:view) + scope filter by tenantId + teamPositionIds, with no org-chart validation. routes.ts:29-41 gates only by permission; service.ts:349-354 builds scope and queries repo but has no canReadOrgTarget check; repository.ts:262-303 filters by tenantId/teamPositionIds only (readScopeClause).
- **integration**: **1. service.ts line 29:** Add import `canReadOrgTarget, resolveOrgReadScope` alongside existing resolver imports (pattern: users/service.ts:29).

**2. service.ts line 336-346 (flightRisk list):** After buildScope, call `const orgScope = await resolveOrgReadScope(pool, a);` and attach `userIdAllowList` to filter passed to repo.readFlightRiskScores() — repository will filter by list.

**3. service.ts line 349-354 (userFlightRisk per-target):** After `repo.readUserFlightRiskScore()` returns row, gate with:
```
if (!row) throw new NotFoundError("Flight-risk score");
if (!(await canReadOrgTarget(pool, a, userId, row.tenantId))) {
  throw new NotFoundError("Flight-risk score");
}
return toFlightRiskScore(row);
```

**4. service.ts line 380-385 (successionReadiness list):** Identical pattern to flightRisk — resolve scope and attach userIdAllowList to filter.

**5. service.ts line 405-410 (skillGap list):** Identical pattern to flightRisk — resolve scope and attach userIdAllowList to filter.

**6. repository.ts line 23-27 (ScopeFilter interface):** Add `userIdAllowList?: string[];` alongside tenantId.

**7. repository.ts line 262-271 (readScopeClause):** After building clauses array, add:
```
if (scope.userIdAllowList) {
  params.push(scope.userIdAllowList);
  clauses.push(`fr.flight_risk_score_user_id = ANY($${params.length}::uuid[])`);
}
```

**8. repository.ts line 538-574 (readReadinessScores):** Mirror readFlightRiskScores — add userIdAllowList filter to the WHERE clause construction (lines 538-549).

**9. repository.ts line 576-612 (readSkillGapScores):** Mirror readFlightRiskScores — add userIdAllowList filter to the WHERE clause construction (lines 576-587).
- **files**: D:/heuresys-advanced/apps/api/src/modules/insights/routes.ts, D:/heuresys-advanced/apps/api/src/modules/insights/service.ts, D:/heuresys-advanced/apps/api/src/modules/insights/repository.ts
- **notes**: The insights module exposes three cross-user sensitive data slices (flight-risk, succession-readiness, skill-gap) all classified as EVALUATION-class data. The D-50 leak: a TENANT_ADMIN with insights:view can read ANY user's scores in their tenant without org-chart validation. The fix follows the F1 users module pattern exactly — (1) resolve scope via resolveOrgReadScope to get userIdAllowList; (2) filter list results by that list in the repo layer; (3) gate per-target userFlightRisk read with canReadOrgTarget before returning. The userFlightRisk endpoint at routes.ts:35-41 is the primary per-target leak; the three list endpoints at service.ts lines 336-346, 380-385, 405-410 are secondary (users with high-level roles see everyone unless filtered). No read-only /me routes exist for insights (comment at routes.ts:9 confirms), so ESS self-scoping is not in scope.

## insights (flight-risk, succession-readiness, skill-gap)  -  effort M
- **current gate**: routes.ts:29 requirePermission("insights:view") only — no org-target check
- **integration**: service.ts:349-354 userFlightRisk() must gate single-user reads with:
  const ok = await canReadOrgTarget(pool, a, userId, row?.tenantId);
  if (!ok) throw new NotFoundError("Flight-risk score");

service.ts:336-346 flightRisk() must filter list results by resolveOrgReadScope + userIdAllowList (like users module service.ts:95-97)

Same pattern for successionReadiness (service.ts:380-384) and skillGap (service.ts:405-409) list endpoints

repository.ts functions remain as-is; the scope check moves to service layer (matching users module pattern)
- **files**: D:/heuresys-advanced/apps/api/src/modules/insights/routes.ts, D:/heuresys-advanced/apps/api/src/modules/insights/service.ts, D:/heuresys-advanced/apps/api/src/modules/insights/repository.ts
- **notes**: The insights resource is already classified as EVALUATION (sensitive) at data-classes.ts:67, confirming it needs org-axis gating. The /users/:userId/flight-risk endpoint accepts a userId parameter and returns sensitive per-person data (flight-risk score, features). A TENANT_ADMIN/HRMS_MANAGER with insights:view can currently read ANY tenant member's score. 

The fix replicates the F1 users module pattern: add canReadOrgTarget() check in userFlightRisk() before returning the score (service.ts:349), and filter list endpoints using resolveOrgReadScope + userIdAllowList (service.ts:336, 380, 405).

The scope logic already exists (buildScope at service.ts:93-101 determines PLATFORM/TENANT/TEAM); it just needs to transition from repo-level filtering to service-level org-target gating for per-user reads.

## learning-gaps  -  effort M
- **current gate**: permission (gap_analysis:read) + tenantId only. apps/api/src/modules/learning-gaps/service.ts:25-26 `visible()` checks tenantId match only; apps/api/src/modules/learning-gaps/service.ts:57-59 `list()` filters by tenantId without userIdAllowList.
- **integration**: 1. apps/api/src/modules/learning-gaps/service.ts:50-67 - Import `resolveOrgReadScope` and `canReadOrgTarget` from "../../lib/scope/resolver.js". Replace `visible()` logic in `getById()` (line 65) with `canReadOrgTarget(pool, actor, target.userId, target.tenantId)` check (throw 404 if false). Modify `list()` method (lines 57-59) to call `resolveOrgReadScope(pool, actor)` and map result to `userIdAllowList` parameter for repo.listGaps(), matching the users module pattern (apps/api/src/modules/users/service.ts:50-64). 2. apps/api/src/modules/learning-gaps/repository.ts:62-111 - Add `userIdAllowList?: string[]` parameter to `listGaps()` filter and apply WHERE clause `learning_gap_user_id = ANY($N::uuid[])` when userIdAllowList is present (follow users/repository pattern).
- **files**: D:/heuresys-advanced/apps/api/src/modules/learning-gaps/routes.ts, D:/heuresys-advanced/apps/api/src/modules/learning-gaps/service.ts, D:/heuresys-advanced/apps/api/src/modules/learning-gaps/repository.ts
- **notes**: D-50 vulnerability confirmed: Any tenant member with gap_analysis:read permission can enumerate and read ALL users' learning gap data (userId, skill gaps, severity scores) in that tenant without org-chart validation. Resource is classified as SKILL (sensitive) per data-classes.ts:55 (gap_analysis). The sys.sys_learning_gaps table stores per-user skill gap assessments indexed by learning_gap_user_id. Current implementation (visible() function, listGaps filter) lacks org-axis gating. Fix follows established F1 pattern from users module: resolve scope to get userIdAllowList, filter list results by allowList, gate getById with canReadOrgTarget predicate. HR-mandated roles (TENANT_ADMIN, HRMS_MANAGER) see tenant-wide; managers see their sub-tree; non-managerial see self only.

## matching  -  effort S
- **current gate**: apps/api/src/modules/semantic-matching/routes.ts:51-96 all use `requirePermission("matching:read")` middleware; service.ts gating is role-based (elevated vs self-only) + tenant membership, no org-chart
- **integration**: Import `canReadOrgTarget` from "../../lib/scope/resolver.js" at apps/api/src/modules/semantic-matching/service.ts:10. Gate four per-target reads:
1. userOccupations (line 60): add `if (!(await canReadOrgTarget(pool, a, userId, tenant))) throw new NotFoundError("User");` after line 65
2. userPositions (line 92): add same check after line 97  
3. userJobRoles (line 115): add same check after line 119
4. similarPeople (line 130): add same check after line 134
- **files**: apps/api/src/modules/semantic-matching/service.ts
- **notes**: The matching resource is SKILL-classified (data-classes.ts:58), which is SENSITIVE and should be org-gated. The service currently enforces elevated-role checks + tenant scoping but lacks org-chart subtree validation. The four /users/:userId/* endpoints (occupations, positions, job-roles, similar-people) are vulnerable to cross-tenant-allowed-role actors reading data for users outside their org sub-tree. Pattern matches F1 implementation in users module: canReadOrgTarget should replace the ad-hoc role ladders.

## mentorship  -  effort M
- **current gate**: requirePermission("mentorship:read") at routes.ts (lines 25, 51, 102); assertVisible() check by tenant only at service.ts lines 81, 115, 121, 152
- **integration**: Apply resolveOrgReadScope/canReadOrgTarget pattern in service.ts and repository.ts:

**List endpoints (filter at SQL layer):**
- service.ts listMentorships (line 75-77): Resolve scope, pass userIdAllowList to repo
- repository.ts listMentorships (line 125-140): Add `userIdAllowList: string[] | undefined` parameter; add WHERE clause: `(mentorship_mentor_user_id = ANY($N::uuid[]) OR mentorship_mentee_user_id = ANY($N::uuid[]))` when userIdAllowList provided
- service.ts listMatchScores (line 146-148): Resolve scope, pass userIdAllowList to repo  
- repository.ts listMatchScores (line 259-273): Add `userIdAllowList: string[] | undefined` parameter; add WHERE clause: `(match_mentor_user_id = ANY($N::uuid[]) OR match_mentee_user_id = ANY($N::uuid[]))` when userIdAllowList provided

**Get-by-id endpoints (gate after fetch):**
- service.ts getMentorship (line 78-83): After assertVisible, add org-scope checks: if mentorUserId then canReadOrgTarget(pool, a, mentorUserId, tenantId); if menteeUserId then canReadOrgTarget(pool, a, menteeUserId, tenantId); throw NotFoundError if either fails
- service.ts getMatchScore (line 149-154): After assertVisible, add org-scope checks: if mentorUserId then canReadOrgTarget; if menteeUserId then canReadOrgTarget; throw NotFoundError if either fails

Sensitive data in responses: mentorUserId, menteeUserId (both involved in per-person relationships)
- **files**: D:/heuresys-advanced/apps/api/src/modules/mentorship/service.ts, D:/heuresys-advanced/apps/api/src/modules/mentorship/repository.ts
- **notes**: Mentorship is classified as PERSONAL (data-classes.ts line 50) — a sensitive ORGANIZATIONAL-axis resource. The D-50 vulnerability: a MANAGER with mentorship:read permission can view mentor/mentee relationships (cross-user per-person data) for ANY user in their tenant, including those outside their org sub-tree. The vulnerability spans four endpoints (list/get for pairings and match-scores). Sessions inherit parent pairing access (no direct changes needed if pairing check is added). Filtering in list should allow at least ONE user in scope (user involved in the relationship); get-by-id should require BOTH users accessible to prevent information leakage about unavailable parties.

## okr  -  effort M
- **current gate**: Permission-only gate via requirePermission("okr:read") at apps/api/src/modules/okrs/routes.ts:16,21,26; service layer checks tenant membership only (assertVisible at service.ts:13-16) but does NOT gate by org-chart scope or canReadOrgTarget.
- **integration**: Two files need changes to plug resolveOrgReadScope/canReadOrgTarget:

**apps/api/src/modules/okrs/service.ts**:
- Line 4: Add import `import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";`
- Line 24 (listOkrs): Call `resolveOrgReadScope(pool, a)`, extract userIdAllowList, pass to repo.listOkrs() as third parameter. Pattern: Same as users/service.ts:50-64 (resolveReadScope helper).
- Line 25-27 (getOkr): After fetching OKR, add org-chart gate: `if (o.ownerUserId && !(await canReadOrgTarget(pool, a, o.ownerUserId, o.tenantId))) throw new NotFoundError("OKR");` (pattern: users/service.ts:103-105)
- Line 29-32 (listKeyResults): Same as getOkr — check canReadOrgTarget on the OKR owner before returning key-results

**apps/api/src/modules/okrs/repository.ts**:
- Line 42 (listOkrs function): Modify signature to accept `userIdAllowList?: string[]` parameter.
- Line 46: Add filter when userIdAllowList is provided: `if (userIdAllowList) { if (userIdAllowList.length === 0) return { items: [], total: 0 }; params.push(userIdAllowList); where.push(`okr_owner_user_id = ANY($${params.length}::uuid[])`); }` (pattern: users/repository.ts:86-93)
- Update listOkrs caller in service.ts line 24 to pass the scope's userIdAllowList
- **files**: /d/heuresys-advanced/apps/api/src/modules/okrs/service.ts, /d/heuresys-advanced/apps/api/src/modules/okrs/repository.ts, /d/heuresys-advanced/apps/api/src/modules/okrs/routes.ts
- **notes**: The okr resource is classified as EVALUATION (data-classes.ts:64) — a SENSITIVE data class requiring ORGANIZATIONAL scope gating. The okr_owner_user_id field exists and is present in all queries, but is never checked during authorization. This is the D-50 vulnerability: any actor with okr:read permission can read OKRs of users outside their org-chart scope (no managerial relationship). The fix replicates the users module F1 pattern: resolveOrgReadScope in service layer to get userIdAllowList, pass to repo for WHERE filtering on listOkrs; and canReadOrgTarget gate on getOkr and listKeyResults per-target reads. Note: Key-results have key_result_owner_user_id also, but the org-chart gate should be on the parent OKR owner (more permissive design) rather than double-gating both; verify with Enzo if per-KR owners need separate gates.

## predictions  -  effort M
- **current gate**: apps/api/src/modules/predictions/service.ts:50 — `assertVisible(a, p.tenantId, "Prediction")` gates TENANT-only; no org-chart check on `p.subjectUserId`
- **integration**: Modify apps/api/src/modules/predictions/repository.ts line 86-87 signature to accept userIdAllowList parameter (like users module); add SQL WHERE clause at line 93 using `prediction_subject_user_id = ANY($n::uuid[])` pattern. In service.ts: (1) line 11 add import: `resolveOrgReadScope, canReadOrgTarget` from "../../lib/scope/resolver.js"; (2) line 44-45 listPredictions: resolve org scope via resolveOrgReadScope and pass userIdAllowList to repo.listPredictions (mirror users.service.ts:50-64); (3) line 47-52 getPrediction: after assertVisible, gate by `if (p.subjectUserId && !(await canReadOrgTarget(pool, actor, p.subjectUserId, p.tenantId))) throw NotFoundError("Prediction")` (mirror users.service.ts:103)
- **files**: D:/heuresys-advanced/apps/api/src/modules/predictions/service.ts, D:/heuresys-advanced/apps/api/src/modules/predictions/repository.ts
- **notes**: Predictions module exposes ML per-user predictions via /v1/predictions/* (classified as EVALUATION — sensitive at data-classes.ts:66). The subjectUserId field (repository.ts:62, mapped at :74) identifies the subject user of each prediction. Vulnerability: any predictions:read holder reads ALL tenant predictions (line 44-45 filters by tenant only), allowing cross-user reads without org-chart check. GET /predictions/:id (line 47-52) also leaks — getPrediction only checks tenant, not whether actor can read that subject's data. Fix mirrors users module (already F1-complete at apps/api/src/modules/users/): resolveOrgReadScope gates list scope; canReadOrgTarget gates per-target get. Predictions already support query.subjectUserId filter (repo line 93) but it's not being constrained by actor's org allowlist.
