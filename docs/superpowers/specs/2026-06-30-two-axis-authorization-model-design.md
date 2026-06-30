# Two-axis contextual authorization — technical design & phasing

**Companion to** ADR-0027 (the decision). This is the **HOW**: the concrete design onto the existing schema and the phased, shippable backlog. **Status: design, awaiting approval** — nothing here is implemented until Enzo approves ADR-0027.

**Date** 2026-06-30 · **Session** S1012 · **Authority** Enzo (WHAT) / CLI (HOW)

---

## 1. Problem recap (from the live S1012 map)

Authorization today = `requirePermission` (role→permission cache) + tenant FK. The org chart (`sys_organization_units.organization_unit_parent_id`) and the closure table `sys_organization_hierarchies` exist but are **empty/unused**; reports-to (`sys_positions.position_reports_to_position_id`) is walked **one-hop** and only for `/v1/users/*` (`apps/api/src/modules/users/repository.ts:162-183`). Sensitive modules (compensation, skills, assessments, goals) filter by **role+tenant only** → **D-50: a MANAGER reads every user's sensitive data tenant-wide**.

Target (ADR-0027): two orthogonal axes — **organizational** (transitive reports-to) gates sensitive data; **functional** (team/process membership) gates activities — with the cardinal rule "sensitive data ⇒ organizational sub-tree only, always".

## 2. Design — four pillars

### Pillar 1 — The two relationship chains as query primitives (`lib/scope/`)

- **Organizational sub-tree** (transitive). A recursive CTE over `position_reports_to_position_id`, mapped to users via `sys_user_position_assignments` (ACTIVE PRIMARY):

  ```sql
  WITH RECURSIVE my_positions AS (
    SELECT upa.user_position_assignment_position_id AS pid
      FROM sys.sys_user_position_assignments upa
     WHERE upa.user_position_assignment_user_id = $1
       AND upa.user_position_assignment_status = 'ACTIVE'
  ),
  subtree AS (
    SELECT pid FROM my_positions
    UNION
    SELECT p.position_id
      FROM sys.sys_positions p
      JOIN subtree s ON p.position_reports_to_position_id = s.pid
  )
  SELECT DISTINCT upa.user_position_assignment_user_id
    FROM sys.sys_user_position_assignments upa
    JOIN subtree s ON s.pid = upa.user_position_assignment_position_id
   WHERE upa.user_position_assignment_status = 'ACTIVE';
  ```

  Helpers: `orgSubtreeUserIds(actorUserId)` (my reports, transitive, incl. self), `orgAncestorUserIds(userId)` (who is above me). Decision: **recursive CTE on demand** (no materialized closure to maintain) for F0/F1; if profiling shows it hot, materialize `sys_organization_hierarchies` (already designed) as an optimization later — behind the same helper, so callers don't change.

- **Functional scope**: union of (a) teams I lead (`sys_teams.team_lead_user_id` / `sys_team_members` role LEAD) → their members, and (b) processes I lead (new membership, Pillar in F4). Helper: `functionalScopeUserIds(actorUserId, {context})`.

### Pillar 2 — Data-class taxonomy (`lib/scope/data-classes.ts`)

A closed enum `PERSONAL | COMPENSATION | SKILL | EVALUATION | ACTIVITY` and a **mapping resource→class** (TS constant, the single source; optionally mirrored to a `sys_authz_data_classes` table for audit/reporting). Sensitive = `{PERSONAL, COMPENSATION, SKILL, EVALUATION}` → organizational axis; `ACTIVITY` → functional axis. The mapping is exhaustive and lint-checked (a sensitive module without a class entry fails CI — mirrors the existing ESS self-route eslint guard).

### Pillar 3 — The shared scope resolver

```
resolveAccessScope(actor, { resourceType, dataClass, context }) -> { userIdAllowList, reason }
```

Rules (first match):
1. **self** is always in the allow-list (I17).
2. **HR-mandated roles** (default: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `HRMS_MANAGER`) → tenant-wide for sensitive classes (their explicit HR mandate, not peer-snooping). *(The exact HR-mandated set is the one decision to confirm at F1 start — see §5.)*
3. **dataClass = ACTIVITY** → `functionalScopeUserIds(actor)` (team/process I lead).
4. **dataClass sensitive** → `orgSubtreeUserIds(actor)` — **only** my transitive reports (I18/I20). Functional membership is ignored here (cardinal rule, absolute).
5. otherwise → `[self]`.

This **replaces** the scattered ad-hoc checks (`users/service.resolveReadScope`, `positions/service.canUpdate` ownerUserId match, `teams/service.userInTeam`) with one audited decision. Peer-isolation (I19) and the cross-tree leader fall out: a leader's functional scope grants activities; only rule 4 (org sub-tree) grants sensitive data.

### Pillar 4 — Enforcement + audit

- Sensitive-module repositories take `userIdAllowList` from the resolver and `WHERE subject_user_id = ANY($allow)` — same shape as the existing `users` allow-list, applied to compensation/skills/assessments/goals.
- **Audit**: each sensitive access records the **axis/reason** that authorized it (`self | org_subtree | hr_mandate | functional`), so a later review can tell *why* access was granted, not just *who* (closes a gap the map flagged).

## 3. Phases (each shippable + green on real RTL data)

| F | Deliverable | Touches | DoD (live, real data) |
|---|---|---|---|
| **F0** | Org + position **recursive helpers**; (opt.) populate `sys_organization_hierarchies` | `lib/scope/org.ts`, migration | helper returns correct transitive sub-tree for RTL managers; no behaviour change yet |
| **F1** | **Shared resolver** `lib/scope/`; refactor `users` to transitive reports-to (from one-hop) | `lib/scope/*`, `users/service.ts` | `/v1/users` unchanged externally; manager now sees full sub-tree; integ green |
| **F2** | **Data-class taxonomy** + mapping + lint guard | `lib/scope/data-classes.ts`, eslint rule | every sensitive resource classified; CI fails on a gap |
| **F3** | **Cardinal-rule enforcement** on compensation/skills/assessments/goals → **closes D-50** | those modules' service/repo | E2E: `paolo.caputo`→`tommaso.fiore` (his report) sensitive ✅; `paolo`→`antonio.parisi` (outsider) ❌ 403/empty; tenant-wide leak gone |
| **F4** | **Functional process axis** (`sys_process_participants`, user-level) + **team activity endpoints** (tasks/objectives/operational-KPI/operational-approvals — Enzo's four) | new module(s), migration | a team leader manages members' activities; cannot see their sensitive data unless org-subtree |
| **F5** | **Peer-isolation & cross-tree** test matrix | tests only | manager A ⊥ manager B; cross-tree leader: activities ✅ / sensitive ❌ |
| **F6** | **Scope-access audit** (axis/reason on sensitive reads) | audit hook | audit row carries the authorizing axis |

F3 is the security-closing phase; F0–F2 are its prerequisites. F4 is the largest (new activity domain) and depends on confirming the concrete activity entities at its start.

## 4. Test matrix (real personas, no mocks — per the DoD doctrine)

| Actor | Target | Class | Expected |
|---|---|---|---|
| `paolo.caputo` (MANAGER) | self | any | ✅ |
| `paolo.caputo` | `tommaso.fiore` (his report) | COMPENSATION/SKILL/EVAL | ✅ (org sub-tree) |
| `paolo.caputo` | `antonio.parisi` (outsider) | COMPENSATION/SKILL/EVAL | ❌ |
| team leader (cross-tree) | team member not in sub-tree | ACTIVITY | ✅ |
| team leader (cross-tree) | same member | COMPENSATION/SKILL/EVAL | ❌ |
| `federica.marchetti` (TENANT_ADMIN, HR-mandated) | any tenant user | sensitive | ✅ (mandate) |
| manager A | manager B's report | sensitive | ❌ (peer) |

## 5. One decision to confirm at F1 start (WHAT)

The **HR-mandated role set** that keeps tenant-wide sensitive access by explicit mandate (default proposal: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `HRMS_MANAGER`). Everything else (`MANAGER`, `TEAM_LEADER`, `PROCESS_OWNER`, `CEO`, `USER`, `READ_ONLY`) is axis-scoped. This is the only open WHAT; it does not block writing the model.

## 6. Risks

- **Recursion correctness/perf**: bad reports-to data could create cycles — the CTE uses `UNION` (dedup) which terminates on cycles; add a depth guard + a data-integrity check on `position_reports_to` (no self-cycle) in F0.
- **Refactor breadth (F3)**: touches several sensitive modules — mitigated by the shared resolver (one code path) + the real-persona E2E matrix as the regression net.
- **No RLS (I5)**: all enforcement stays in app code; the lint guard (F2) is the backstop against a module forgetting the filter.
