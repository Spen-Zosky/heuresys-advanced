# ADR-0027 — Two-axis contextual authorization: the organizational chain gates sensitive personal data, the functional chain gates activities

**Status**: ACCEPTED  *(approved by Enzo 2026-06-30; per his decision the full design was written first, then implemented in phases F0–F6)*
**Date**: 2026-06-30
**Author**: CLI session (S1012)
**Decision authority**: Enzo Spenuso
**Builds on**: I1 (position-centric), I5 (tenant isolation = FK + middleware filter, NEVER RLS), I7 (auth separate from `sys_users`), ADR-0011 (ESS = MVP-2b self-scope), the S953/R2 role epic (12 roles), R1b ("my team" 3rd scope axis)
**Related invariants (proposed)**: I16–I20 (see §2.7)
**Triggered by**: Enzo's specification (2026-06-30) of the multi-dimensional access model, refined by a 3-question interview (§1.3).

---

## §1 — Context

### §1.1 — Today the model is single-axis (role + tenant)

Authorization today is **two-dimensional only in the trivial sense**: a permission check (`requirePermission`, role→permission cache) plus a tenant FK filter (I5). A live map of 8 subsystems (S1012) found:

- **Org chart exists but is inert**: `sys_organization_units.organization_unit_parent_id` holds the Division→Department→Office tree (8 unit types), and a closure table `sys_organization_hierarchies` (ancestor/descendant/depth) is **defined but empty and unused** — no recursive query consults it.
- **Reports-to is one-hop**: `sys_positions.position_reports_to_position_id` (self-FK) is walked **a single level** by `getManagerTeamUserIds()` (`apps/api/src/modules/users/repository.ts:162-183`) and used **only** to scope `/v1/users/*`. No manager-of-managers / sub-tree traversal.
- **Team axis is read-only metadata**: `sys_teams` + `sys_team_members` (LEAD/MEMBER, R1b) gate visibility of the team list itself, but there are **no activity-management endpoints** scoped to a team.
- **Processes live only at OU level**: `sys_organization_unit_processes` (RACI) attaches *org units* to processes; there is **no user↔process membership**.
- **No data-sensitivity classification**: sensitive personal data — compensation (`sys_user_pay_slips`, `sys_variable_pay_calculations`, `sys_compensation_recommendations`), skills/competency (`sys_user_skill_evidence`), evaluation (`sys_user_assessment_evidence`, `sys_user_kpi_evidence`, `sys_goals`, `sys_okrs`), personal (`sys_user_profiles`) — is gated **only by role + tenant**, with no notion of sensitivity class.

### §1.2 — The resulting security gap (registered as D-50)

Because the one-hop reports-to filter is applied **only to `/v1/users/*`** and never to the sensitive modules, **any holder of `compensation_intelligence:read` / `skill:read` / `assessment:read` (e.g. the `MANAGER` role) can read the sensitive data of EVERY user in the tenant**, not just their reports. There is no org-chain check on sensitive data, hence no peer-isolation. This is the single most severe gap and the model below exists to close it (debt **D-50**).

### §1.3 — Enzo's specification + interview decisions

Enzo defined a model in which relationship chains are **not unique** but depend on context, split into two families, with a cardinal rule separating *activities* from *sensitive data*. Three clarifying decisions (2026-06-30 interview) pinned the ambiguities:

1. **Sequencing** → *write the complete design first, approve it, then implement in phases* (this ADR + the companion spec are that design; nothing is implemented until approved).
2. **What a team leader manages** → **all four** of: tasks & deadlines, team objectives, operational work indicators, operational approvals (never personal data).
3. **Who sees sensitive personal data** → **the organizational chain only, always, with no exceptions** — a team/process leader never sees a member's sensitive data unless they are *also* that member's org-chart superior.

---

## §2 — Decision

### §2.1 — Authorization becomes bi-axial and contextual

The access decision changes from `f(role, tenant)` to **`f(actor, resource, data-class, relationship-context)`**, resolved against **two orthogonal relationship chains**:

| Axis | Chain (source of truth) | Governs | Direction |
|---|---|---|---|
| **Organizational** | org-chart reports-to, **transitive** (`position_reports_to_position_id` closure + OU `parent_id` closure) | **Sensitive personal data** | a superior sees their whole sub-tree |
| **Functional / operational** | **team** (`sys_team_members`) + **process** (new user-level membership) | **Activities** (work) | a team/process leader sees their members' work |

The two axes are **independent**: team/process membership does **not** imply org-chart ancestry, and vice-versa (the rare cross-tree case — a junior-on-the-org-chart project leader with senior members — falls out naturally because the two chains are resolved separately).

### §2.2 — Organizational axis → sensitive personal data

Access to another user's **sensitive personal data** requires **both**: (a) the actor holds an **explicit managerial role**, and (b) that user is in the actor's **organizational sub-tree** (transitive reports-to). This is the **only** gate for sensitive data — §2.5.

**Explicit managerial role** (Enzo's F1 constraint, 2026-07-01): an RBAC managerial role (`MANAGER`, `CEO`) **OR** being the manager of ≥1 organization unit (`organization_unit_manager_user_id` — *responsabile di Divisione / Direzione / centro di costo / unità organizzativa*). A plain employee who merely has reports in the chart does **NOT** get the sub-tree scope — they see only themselves. This stops the org sub-tree from silently widening visibility for non-managerial staff who happen to sit above someone in the chart. (Codified as `MANAGERIAL_ROLES` + `isOrgUnitManager` in `apps/api/src/lib/scope/`.)

### §2.3 — Functional axis → activities (Enzo's four)

A team leader / process leader may **manage, assign and monitor the members' activities**, scoped by team/process membership (not org-chart). "Activities" = the four Enzo confirmed:

1. **Tasks & deadlines** — assign work items, set deadlines, see progress.
2. **Team objectives** — team-level goals/OKRs/results.
3. **Operational work indicators** — work-output KPIs of the project (productivity/output), **distinct from a person's performance evaluation**.
4. **Operational approvals** — work-related approvals (authorize an activity, a project expense), **never** personal leave/permits (those follow the org chart).

### §2.4 — Data-class taxonomy

Every accessible resource is tagged with exactly one **data class**, which selects the axis:

| Data class | Examples (tables) | Axis that gates it |
|---|---|---|
| `PERSONAL` | `sys_user_profiles` (phone, contacts, personal info) | **Organizational** |
| `COMPENSATION` | `sys_user_pay_slips`, `sys_variable_pay_calculations`, `sys_compensation_recommendations` | **Organizational** |
| `SKILL` (competency) | `sys_user_skill_evidence` | **Organizational** |
| `EVALUATION` | `sys_user_assessment_evidence`, `sys_user_kpi_evidence`, performance reviews, individual goals/OKRs | **Organizational** |
| `ACTIVITY` | team tasks, team objectives, operational KPIs, operational approvals | **Functional** |

`PERSONAL/COMPENSATION/SKILL/EVALUATION` are **sensitive** → organizational axis. `ACTIVITY` → functional axis.

### §2.5 — The cardinal rule (organizational prevalence, absolute)

> A team/process leader may manage/assign/monitor the **activities** of members (functional axis), **but may NOT access ANY personal, compensation, skill or evaluation data of any member UNLESS that member is in the leader's organizational sub-tree** (transitive reports-to).

Per Enzo's interview decision #3, this is **absolute — no exceptions**. Consequences that follow mechanically:

- **Organizational prevalence**: for sensitive data the organizational chain always wins; functional membership never unlocks it.
- **Peer-isolation**: two holders of disjoint org sub-trees (two managers, two division heads) are peers — neither sees the other's (or the other's reports') sensitive data, because neither is in the other's sub-tree.
- **Cross-tree team leader**: the leader gets *activity* scope over members via the functional axis, and *sensitive-data* scope **only** over members who are also in their org sub-tree — the two are evaluated separately and concatenated per data-class.

### §2.6 — Base principle (already satisfied, now codified)

Every user is at least a `USER` → has the Employee Portal (ESS) and can see **every datum about themselves** (`/v1/me/*`, self-scope). This holds today (ADR-0011) and is reaffirmed as I17. *Self always wins over every axis.* (Additional constraints Enzo may add later are out of scope here.)

### §2.7 — Proposed durable invariants (to be added to CLAUDE.md on acceptance)

- **I16 — Bi-axial authorization.** Access depends on TWO orthogonal relationship chains — organizational (org-chart reports-to, transitive) for sensitive personal data, functional/operational (team/process membership) for activities — not on role+tenant alone.
- **I17 — Universal ESS floor.** Every user is at least `USER`: guaranteed the Employee Portal and full access to their own data. Self-scope overrides every other axis.
- **I18 — Sensitive data is organizational-only.** Another user's `PERSONAL/COMPENSATION/SKILL/EVALUATION` data is accessible **only** through the organizational chain (transitive reports-to). Functional (team/process) membership alone NEVER unlocks sensitive data.
- **I19 — Peer isolation.** Holders of disjoint organizational sub-trees are peers: none sees the other's sensitive data.
- **I20 — Organizational prevalence (absolute for sensitive data).** When axes concur, the organizational chain prevails for sensitive data, with no exceptions.

---

## §3 — Consequences

**Positive**
- Closes D-50 (the tenant-wide sensitive-data leak) at the root, not per-endpoint.
- A single shared scope resolver replaces the per-module ad-hoc checks (`resolveReadScope`, `ownerUserId` matches, `userInTeam`), reducing the chance of a module silently forgetting a filter.
- Peer-isolation and the cross-tree case become *emergent* properties of the two-chain design, not special cases.
- Enables real team-leader activity management (today absent) on a correct foundation.

**Bounded / costs**
- Requires populating + maintaining org/position closures (currently empty) and adding user↔process membership (currently OU-only).
- Sensitive-data modules must route reads through the resolver — a cross-module refactor, phased (F0–F6 in the spec) so each phase is shippable + tested on real RTL data.
- No RLS (I5 preserved): all axis filtering stays in application code/queries.

**Neutral**
- Roles (RBAC) remain; they answer "*can this action be performed at all*". The axes answer "*on whose data/work*". The two compose.

---

## §4 — Scope boundary & open items

- **In scope**: the model, the data-class taxonomy, the cardinal rule, the invariants, the phasing. **Implementation is NOT in this ADR** — it is gated on Enzo's approval and proceeds per the companion spec `docs/superpowers/specs/2026-06-30-two-axis-authorization-model-design.md`.
- **Deferred (Enzo, the WHAT)**: the concrete "activity" entities of F4 (a generic task model vs. reusing goals/approvals) are designed in the spec but their product shape is confirmed at F4 start; any *additional* constraints on the ESS base principle (§2.6) are a later decision.
- **Not changed**: tenant isolation (I5), position-centric model (I1), the no-RLS doctrine.

## §5 — Implementation phases (summary; detail in the spec)

`F0` org/position closures + recursive helpers · `F1` shared scope resolver + transitive reports-to · `F2` data-class taxonomy · `F3` **cardinal-rule enforcement on sensitive modules → closes D-50** · `F4` functional process axis + team activity endpoints · `F5` peer-isolation & cross-tree test matrix · `F6` scope-access audit. Each phase ships green on real RTL data (E2E: `paolo→tommaso` sensitive ✅, `paolo→antonio` ❌).
