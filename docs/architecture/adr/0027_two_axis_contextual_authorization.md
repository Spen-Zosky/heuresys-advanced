# ADR-0027 — Two-axis contextual authorization: the organizational chain gates sensitive personal data, the functional chain gates activities

**Status**: SUPERSEDED by ADR-0036 (2026-08-10) *(originally ACCEPTED — approved by Enzo 2026-06-30; per his decision the full design was written first, then implemented in phases F0–F6. The cardinal rule §1.3(3) survives unchanged as I18; the domain model, the data classes and the mask state now live in ADR-0036)*
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
- **I21 — HR data plenipotentiary.** `HRMS_MANAGER` (Responsabile Direzione HR / HR Manager) may read/write/create/delete ANY business datum — the **non-technological** counterpart of `PLATFORM_ADMIN` (which owns the technological plane). It bypasses the two-axis cardinal rule entirely (Enzo, 2026-07-01). *(Read is enforced via `HR_MANDATED_ROLES`; write/delete parity SHIPPED S1013 via migration 000169 — 9 data-business perms incl. `compensation_intelligence:update`, `user:delete`, `organization_unit:delete`; the technological plane — mfa/tenant/role/auth/blueprint/brownfield/seed — stays with `PLATFORM_ADMIN`.)*

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

**Implementation status** (2026-07-01, S1013): **F0·F1·F2·F3·F5·F6 SHIPPED** — F3 enforced on 11 sensitive modules (assessments, capability-composition, successor-readiness, compensation, learning-gaps, goals, insights, semantic-matching, mentorship, okrs, predictions) → **D-50 RESOLVED**; F5 = I19 peer-isolation proven bidirectionally on two real disjoint managers (paolo⊥claudia); F6 = scope-access audit records the authorizing axis centrally in the resolver. **I21 grant SHIPPED** (migration 000169). **F4 DEFERRED** to a dedicated session — it introduces the functional/activity domain and depends on Enzo confirming the concrete activity entities (§4). The cross-tree half of F5 (functional-axis) is part of F4.

**F1-bis — l'accesso al peer lo decide il resolver, non una lista di ruoli nel modulo** (2026-07-26, S1032, cluster `Z-203`, assorbe `backlog:OQ-4`). Domanda aperta: qual è il set di ruoli che sul *peer occupation-fit* può vedere solo se stesso? **Risposta: non esiste, e non deve esistere.** Chi può leggere il dato sensibile di un altro lo decide **`canReadOrgTarget` e nient'altro** — self (I17) · mandato HR (I20) · ruolo manageriale **oppure responsabile di unità organizzativa** + sotto-albero organizzativo (I18) · stesso tenant (I5). `semantic-matching` teneva una lista locale (`USER`/`TEAM_MEMBER`/`READ_ONLY`) che duplicava quella decisione e **la contraddiceva in un caso reale**: la managerialità, per F1, è anche un fatto di *dato* (`isOrgUnitManager`), non solo di ruolo RBAC — quindi un attore il cui unico ruolo è `USER` ma che **dirige un'unità organizzativa** è manageriale per il resolver e self-only per la lista. Misurato sul DB reale il 2026-07-26, tenendo separati insiemi che è facile confondere: gli attori **bloccati dalla lista locale** sono quelli con ruoli tutti dentro `USER`/`TEAM_MEMBER`/`READ_ONLY` — **e anche quelli senza alcun ruolo**, perché `[].some(...)` vale `false`. Fra i responsabili di OU sono **6**, di cui **2 con riporti reali** (`benedetta.cattaneo` 7, `enzo.spenuso` 2 con zero ruoli attivi); per gli altri il diniego era **inerte**, destinato a mordere al primo riporto assegnato. Gli 11 «non peer-capable per ruolo» secondo il resolver sono un insieme DIVERSO e più ampio: i 5 di differenza (`TEAM_LEADER`, `PROCESS_OWNER`, `BLUEPRINT_MANAGER`…) la lista li trattava già come elevati.

**È un allargamento delimitato, non solo la chiusura di un falso diniego** — e la formulazione precedente lo minimizzava. Due precisazioni che la revisione adversarial ha imposto:

1. *Dentro il modulo*, il fast-path era un filtro **aggiuntivo davanti a un gate che girava comunque**: i due erano in AND, quindi rimuoverne uno non può che allargare l'insieme dei concessi. L'insieme nuovo è esattamente quello che `canReadOrgTarget` autorizza — né più né meno.
2. *Fra i moduli*, l'affermazione «quei riporti erano già leggibili in ogni altro modulo F3» **è falsa**: `matching:read` è l'**unico** permesso F3 concesso al ruolo `USER`; su assessment, capability, compensation, gaps, goal, insights, mentorship, okr, predictions un attore `USER`/`TEAM_MEMBER` si ferma a 403 in RBAC prima che il resolver venga interrogato. L'effetto reale è che `semantic-matching` diventa **l'unica superficie F3** su cui un attore rank-and-file legge il fit sensibile di un altro — limitato al proprio sotto-albero organizzativo. Resta coerente con questo ADR (è l'asse organizzativo che concede, per I18), e con `user:read`, che include `USER` e passa già da `canReadOrgTarget`; ma va detto per quello che è.

La lista è stata rimossa dai tre metodi per-target (`userOccupations`/`userPositions`/`userJobRoles`), e la copertura di test verifica l'invariante su tutti e tre: l'esito del service deve coincidere con la decisione del resolver, altrimenti rosso. **Sopravvive un solo uso, con semantica diversa e nome esplicito**: `BROWSE_SELF_ONLY_ROLES` governa la *capacità di sfogliare* «persone simili a X» (`similarPeople`), che è uno strumento di leadership e resta **403 anche su se stessi** — è una domanda di capacità, non di bersaglio. Il titolo di questa sezione dice «non nel modulo» riferito alla decisione **sul bersaglio**: quella sulla capacità resta locale, ed è una domanda diversa.

⚠️ **`similarPeople` NON è certificato da questa sezione.** La revisione adversarial ha rilevato che il gate organizzativo vi filtra il *bersaglio* ma **non le righe restituite**: `knnSimilarUsers` filtra per tenant, non per sotto-albero, quindi la lista può contenere persone fuori dall'asse organizzativo dell'attore. È una perdita **preesistente**, non introdotta da `Z-203`, e va chiusa a sé (cluster `Z-256`).

Regola generale che ne deriva: **un modulo che vuole sapere «posso leggere questa persona?» chiama il resolver; se sente il bisogno di una lista di ruoli, sta duplicando una SoT.** Non è ancora imposta da nulla: altri moduli (es. `insights`) tengono scale di ruoli scritte a mano, e diventerà un controllo meccanico con la derivazione dei ruoli organizzativi (`docs/superpowers/specs/2026-07-26-organizational-model-and-role-derivation-design.md`, F2).

**F4 update** (2026-07-19 S1025 + 2026-07-22 S1026): **F4-A SHIPPED** (mig 000179 `sys_process_participants`, `lib/scope/functional.ts`, `resolveActivityScope`, audit axis `functional` — commit `bae19553`); **F4-B SHIPPED on approvals** — reads gated by the functional axis (commit `fd066a9d`), and (S1026, mig 000201) `TEAM_LEADER` granted `approval:read` so a pure functional leader monitors HIS operational queue (activity #4, §2.3) — safe because the runtime scope is functional-only. **F5 cross-tree half SHIPPED** (S1026): `two-axis-f4-crosstree.integration.test.ts` proves, on a live-derived cross-tree member (in paolo's functional scope, outside his org sub-tree), ACTIVITY visible ✅ / EVALUATION invisible ❌ at the HTTP surface. **F4 is COMPLETE under Enzo's recorded WHAT** (S1018: activity entities via reuse, NO generic task model; refined 2026-07-19: ONLY approvals + team/process membership move to the functional axis — goal/okr/kpi stay EVALUATION, or the leader would read the performance of the functional-but-not-org population, reopening D-50). A dedicated task/team-objective domain was considered and rejected: `sys_tasks`/`sys_team_objectives` do not exist, TEAM-type OKRs have 0 rows, and team operational KPIs have no live data (OU-KPI templates are blueprint-keyed only) — any such surface would ship permanently empty, violating the live-data DoD (ADR-0026). If the product later wants those surfaces, that is a NEW work item, not an F4 residue.
