# ADR-0036 — Hierarchical and functional domains: the perimeter and the modality are orthogonal

**Status**: ACCEPTED *(criteria decided by Enzo 2026-08-03; the three merit cells decided by Enzo 2026-08-04; formalized S1053)*
**Date**: 2026-08-10
**Author**: CLI session (S1053)
**Decision authority**: Enzo Spenuso
**Supersedes**: ADR-0027 (two-axis contextual authorization — remains the historical record of the model this one evolves; its cardinal rule survives unchanged as I18)
**Absorbs**: ADR-0032 (the `mask` state is the `platform_mandate` row of the matrix M1)
**Extended design record**: `heuresys-design-lab/2026-08-03--definizione-domini.md` (outside the repo, by design — S1038). Every number in THIS file was re-measured live on 2026-08-10; the lab document's counts are snapshots of 2026-08-03 and several were already stale by 2026-08-10 (six of ten load-bearing claims refuted on re-measure — #149 applied).

---

## §1 — Context

ADR-0027 separated the organizational axis (sensitive personal data) from the functional axis (activities) and closed D-50. Living with it exposed a structural residue it could not express:

1. **A role kept "coming with" a view.** Authorization lived partly in hand-written role lists scattered across services. Three of the five lists censused on 2026-08-03 have since been removed (#116/#119, S1044); two survive (`apps/web/.../layout.tsx:159`, `role-precedence.ts` as presentation-only) plus two new ones appeared (`positions/service.ts:33`, `teams/service.ts:29`) — proof that without a doctrine the sixth list always grows back (#99 F4 owns their removal and the anti-drift test).
2. **The hierarchical perimeter is resolved on the wrong tree.** `apps/api/src/lib/scope/org.ts` walks `position_reports_to_position_id`; the organization's authoritative shape is the **unit tree** (`organization_unit_parent_id` + `organization_unit_manager_user_id`). The two trees were re-aligned by the #114 mend (measured 2026-08-10: 313 positions, 161 active, 2 roots — one per tenant, 0 implausible reporting lines), but only one of them is doctrine. The rewrite is #99 F4 (pending; the test oracle `org-actors.ts` already derives from the unit tree precisely so resolver and oracle disagree when one drifts).
3. **Binary access could not say "the record exists but the value is withheld".** ADR-0032 introduced the fourth state (`mask`) for two surfaces; S1053 extended it to the whole COMPENSATION surface and to the dossier (#124 D1–D3), and split the dossier's identity into professional/private sections (D2).

## §2 — Decision: the six criteria (Enzo, 2026-08-03)

| # | Criterion |
|---|---|
| **C1** | **Orthogonality.** *Hierarchical* domains answer **on which people**. *Functional* domains answer **which data, in which modality**. Effective access = the **intersection**. A hierarchical domain has **no modality**: "the chief reads the personal file" is two facts — the `chain` domain yields the people, the `line_management` domain yields the modality. This is what makes a role unable to "come with" a view. |
| **C2** | **Matrix per data class.** Modalities are declared class by class: `edit` / `read` / `mask` / `none`. |
| **C3** | **Obscuring = masking in the data contract.** The field is withheld from the serialized response and declared in `masked` — never hidden client-side. (Implementation: `apps/api/src/lib/scope/mask.ts`, ADR-0032.) |
| **C4** | **Binding completeness of `self`.** Every table referencing a person is reachable from the personal domain; exclusions are declared one by one, motivated (M2). Enforced mechanically by the exposure gate (#117). |
| **C5** | **Chain principle.** The head of an organizational chain accesses everyone below, cascading; and **nothing** of sibling chains — even as a manager, even if the other person is a plain employee. The apex sees everything because its chain *is* the company, not by exception. |
| **C6** | **The HR mandate is of a different nature**: tenant-wide by explicit mandate, with **four declared exceptions** (§5). |

**Demarcation test (falsifiable)**: a domain is *hierarchical* iff its perimeter changes when the org chart changes. Applied: **2 hierarchical domains** (`chain`, `unit`) and **11 functional domains** (`self`, `line_management`, `team_lead`, `team_peer`, `process_owner`, `hr_mandate`, `platform_mandate`, `custody`, `mentor`, `delegation`, `approver`). The matrix M1 is **11 × 7 = 77 cells** — the two hierarchical domains declare only the perimeter.

## §3 — The seven data classes (one vocabulary)

Two disjoint vocabularies exist today — `data-classes.ts` (5 classes, keyed by RBAC resource, decides authorization) and `sys_gdpr_data_map` (7 classes, keyed by table, decides erasure) — with no drift test between them. The single vocabulary both converge to (#99 F2 owns the reconciliation):

| Class | Covers | Absorbs (code) | Absorbs (GDPR map) |
|---|---|---|---|
| `IDENTITY` | personal data, contacts, documents, family | `PERSONAL` | `IDENTITY`+`PERSONAL` |
| `CONTRACT_PAY` | contract, payslips, pay, bands, variable pay, banking | `COMPENSATION` | `FINANCIAL_LEGAL` |
| `COMPETENCE` | skills, gaps, learning, matching | `SKILL` | — |
| `EVALUATION` | reviews, KPI, goals, OKR, succession, talent | `EVALUATION` | `EVALUATION` |
| `ACTIVITY` | approvals, teams, process participation, requests | `ACTIVITY` | `OPERATIONAL` |
| `CREDENTIAL` | credentials, MFA, sessions, login events | — | `AUTH_SECURITY` |
| `SPECIAL_CATEGORY` | GDPR art. 9 (health, union, …) | — | — |

`DERIVED` is **not** a class: it is an attribute (computed provenance), orthogonal to access. `SPECIAL_CATEGORY` is **empty and guarded**: the only art.-9-adjacent data live in `sys_time_off_requests` as two medical-certificate flags (measured 2026-08-10: 845 of 2 105 requests) — the gate exists before the data does.

**Naming note**: the scope layer's split of the identity sphere (S1053, #124 D2) deliberately does NOT mint an `IDENTITY_PRO`/`IDENTITY_PRIV` DataClass pair — `GdprDataClassEnum.IDENTITY` already exists in another domain (gdpr.ts) and the project has one documented false friend too many (I14). The split is expressed as dossier **sections** (`UserDossierProfileSchema`, `maskedSections`).

## §4 — The three merit cells (Enzo, 2026-08-04)

1. `line_management`/`CONTRACT_PAY` = **`read`** — the chief sees band AND amount. The only cell of the 77 that changed.
2. `platform_mandate`/`CONTRACT_PAY` and `/EVALUATION` = **`mask`** confirmed (= ADR-0032). As of S1053 applied to: recommendations, assessment-results, the user dossier (payslips, employment pay, contracts pay, performance), variable-pay (+evaluation), reward-gates (payload + per-person score), bonus-pools, position-economic-weight, handoff-records.
3. `SPECIAL_CATEGORY` = **`none`** for every domain except `self`; the medical-cert flag seen by the approver is **parked**, not resolved — a dedicated session decides it.

## §5 — The four exceptions to the HR mandate (C6)

| Exception | Mechanism | Real support (re-measured 2026-08-10) |
|---|---|---|
| Whistleblowing reports | **absolute isolation**: only `custody` — not even `platform_mandate` | `whistleblowing:read` held by exactly **1** role |
| Special-category data | class `SPECIAL_CATEGORY` + separate access path | class empty and guarded (2 flag columns) |
| Top-of-chain pay | **chain threshold**: visible only at equal or higher level of the unit tree | unit-tree levels 1–2; `pay_scale_level`, `ccnl_level` populated |
| Uncommunicated evaluations | **communication status**: invisible until communicated to the subject | criterion: `review_shared_at IS NOT NULL OR review_acknowledged_at IS NOT NULL` → **546 of 548** communicated (0 have `shared_at`, 546 have `acknowledged_at`; applying `shared_at` alone would hide them ALL, subjects included) |

The first two are expressible as class + domain; the last two are **cell qualifiers** alongside `edit`/`read`/`mask`/`none` — #99 F5 owns their implementation.

## §6 — Invariants (rewritten in CLAUDE.md by this ADR)

- **I16** — Access = intersection of a hierarchical perimeter (*on whom* — canonical source: the **unit tree**) and a functional modality (*which data, how* — declared per class in M1). No role list may decide a view.
- **I17** — Universal ESS floor + **binding completeness of `self`** (C4): every person-referencing table is reachable self-scope or its exclusion is declared and motivated; the exposure gate enforces it mechanically.
- **I18** — Sensitive personal data travels the organizational chain only (unchanged cardinal rule of ADR-0027).
- **I19** — Chain principle (C5): cascade below, nothing across siblings, the apex by construction.
- **I20** — Organizational prevalence + HR mandate by explicit mandate with the **four declared exceptions** (§5); `platform_mandate` reads `CONTRACT_PAY`/`EVALUATION` masked (ADR-0032).
- **I22** *(new — I21 is taken by industry coherence)* — `HRMS_MANAGER` is **plenipotentiary on business data**: full CRUD on every business datum of the tenant by explicit mandate (Enzo). The four exceptions of §5 bound it; technical/platform surfaces stay out.

## §7 — Implementation state and consequences

Live today (all proven with two real actors on the same rows): the mask mechanism and its COMPENSATION/EVALUATION coverage (ADR-0032 + #124 D1/D3, S1044–S1053); the dossier professional/private split (#124 D2, S1053); the unit-tree test oracle (`org-actors.ts`, #115).

Owned by #99 and NOT yet live: **F2** class reconciliation + drift test; **F4** resolver on the unit tree + removal of `MANAGERIAL_ROLES` and of the surviving role lists + anti-sixth-list test; **F5** cell qualifiers (§5); **F6** M2 completeness closure (#117/#126); **F7** the `mentor`/`delegation`/`approver`/`team_peer` domains (no production consumer of the functional-scope helpers yet); **F8** interface derivation from the matrix (sequenced AFTER the #142 dashboard-family decision to avoid baking the wrong shape).

Consequences: a new surface must name its M1 cell (domain × class × modality) before it ships; a cell with no mechanism is a design gap, not an implementation detail; and any number quoted from the lab document must be re-measured before use — this ADR did.
