# Data-Mining — In-Platform Scoring Engine — Design Spec

> **Status**: DESIGN — **decisions resolved, implementation-ready** (S972, 2026-06-07). Capability ③/5 of the platform-capabilities program (`2026-06-03-platform-capabilities-roadmap.md`). The open design decisions are now **RESOLVED** with best-practice defaults (§9); the **one residual human sign-off** is D-3 — the derivation rule's weights/thresholds (§9.1/§9.2), which Enzo tunes or accepts at implementation kickoff. **Still no code until a plan is written; implementation is multi-session and out of scope here.** This spec closes the **DESIGN stage only**.
> **Core principle**: ONE in-platform scoring foundation (deterministic feature-extraction → human-authored derivation rule → idempotent materialization into `sys_*_scores` read tables → analytics-style endpoints). Every scoring scenario is an additive slice on that foundation — all included, none precluded. Same inclusive, additive pattern as the BI (①) and AI (②) specs.

## 1. Goal & intent

Derive **scores / segments / signals** about people and positions **in-platform**, from the live `sys.*` data already present — skill-evidence, attendance, KPI achievement, the org graph, the pgvector embeddings (②), and engagement-survey responses — and write them into `sys_*_scores` read tables surfaced via analytics-style endpoints.

This is the **predictive / inferential** layer of the analytics stack (descriptive = BI ①; semantic = AI ②; predictive/inferential = data-mining ③), the slot the roadmap explicitly sequences **after** ①+② "so each reuses the prior's substrate" (roadmap §"Cross-cutting", line 61; ③ row lines 30–37). The substrate is now largely in place (§7) — this de-risks ③ materially.

## 2. The hard boundary — in-platform derivation vs imported PredictionsML (non-negotiable)

This is the **central distinction** of this capability. Two read-model families coexist in `sys.*`; cap③ owns exactly one of them.

| Family | Tables | Provenance | Registry bucket | API today |
|---|---|---|---|---|
| **Imported PredictionsML** (NOT cap③) | `sys_predictive_models` (4), `sys_model_predictions` (468), `sys_mentor_match_scores` (30) | Legacy xgboost/random_forest/kmeans outputs imported **as-is** (`LEGACY_PMODEL::…` keys, `last_trained_at` 2025-11, off-platform ML) | **A / IMPORT** | `/v1/predictions/*` (mig 000079/000080) |
| **In-platform scores** (= cap③ target) | `sys_talent_scores` (154), `sys_readiness_scores` (90), `sys_succession_scores` (90), `sys_employee_position_fit_scores` (146) | Currently hold **legacy-derived seed values** (`payload.legacy.source_table = mv_employee_performance_context`); **no in-platform computation, no API surface** | **C / NEEDS_DECISION** | none |

- **PredictionsML is OUT of scope** for cap③: it is a *brownfield import* of precomputed legacy model outputs (the read-model precedent that proved the "import legacy-precomputed values as-is, NO in-platform ML" pattern). Cap③ does **not** import, retrain, or replace it.
- **Cap③ is IN-PLATFORM feature-extraction → scoring**: deterministic SQL/embedding feature extraction over live `sys.*` → a **human-authored derivation rule** → idempotent write into the four `NEEDS_DECISION` score tables → endpoints. **No black-box ML, no external ML service, no model training** (see §4, §8). The score is reproducible from the inputs + the documented rule + a `model_version` tag.
- The four `sys_*_scores` tables today contain *imported* seed values, which is exactly the registry's `NEEDS_DECISION` flag. This was **D-1** — **RESOLVED (S972, §9): cap③ recomputes them in-platform and SUPERSEDES the legacy seed with a transparent derived value, stamping provenance (`payload.derivation`) and retaining the original legacy value in `payload.legacy.*` for audit** so the two are never confused. Resolving this also moves the four `NEEDS_DECISION` registry rows to POPULATED-by-derivation once recomputed.

> **Contrast vs BI ①**: BI is *descriptive* — it aggregates live rows into rollups (headcount, KPI %, heatmaps) and computes nothing per-person. Cap③ writes a **per-subject derived score** with its own provenance row. A flight-risk score is not an aggregate of attendance; it is a function of features, authored by a human rule.

## 3. First-slice candidates (pick a recommended P1)

All three are feasible on today's substrate. Each makes its **human-authored derivation rule explicit** — the rule is a *semantic decision for Enzo* (the same way `talent_scores` band thresholds and the imported PredictionsML target variables were human choices).

| Slice | Target table | Feature inputs (all live `sys.*`) | Derivation rule (human-authored, transparent) | Output |
|---|---|---|---|---|
| **A — Attrition / flight-risk** ⭐ recommended P1 | `sys_talent_scores` band-style OR a new `…_payload.flight_risk` field | tenure (assignment dates), KPI-achievement trend (KPI cluster), attendance/overtime anomaly (3180 attendance), engagement-survey score (862 responses), time-since-last-promotion (org/position history) | weighted, normalized, documented formula → `0–100` + band `LOW/MEDIUM/HIGH/CRITICAL` (RD-08 CHECK) + per-feature contribution in `payload` | risk score + band + explanation, per user |
| **B — Succession-readiness** | `sys_readiness_scores` (already has `horizon` CHECK `READY_NOW … NOT_READY`) | candidate skill-fit vs target position (② embeddings person↔position fit), KPI achievement, tenure, current-vs-target seniority gap | rule mapping a composite fit value → the existing `horizon` enum + `value 0–100` | readiness value + horizon per (user, position) |
| **C — Skill-gap clustering / segments** | `sys_employee_position_fit_scores` (`dimension=SKILL`) + a segment label in payload | per-person skill-evidence vector (② `sys_user_profile_embeddings`, 156) vs role/position skill demand; coverage gap | deterministic k-means-free *segmentation by rule* (gap-bucket thresholds) OR documented cosine-distance bucketing — **no opaque clustering model** | gap score + segment per user |

**DECIDED (D-2, S972 §9): P1 = Slice A (attrition / flight-risk)** — it is the canonical "data-mining" use-case (roadmap line 32), exercises the widest feature set (KPI + attendance + survey + tenure + promotion recency), reuses an existing score table (`sys_talent_scores`), and has zero hard dependency on ② embeddings (B and C lean on the embedding substrate). It is the most *legible* first proof that the engine is in-platform and rule-driven, not a black box. B and C become P2 once A's pipeline pattern is proven (they reuse it). The flight-risk derivation rule is recorded in §9.1 (RECOMMENDED STARTING RULE, the one residual sign-off).

## 4. Data model (proposed — NO DDL here)

Cap③ **reuses the four existing `NEEDS_DECISION` score tables** rather than minting new ones (they already match the required shape, FK discipline, and indexes — verified live). A new score family, if a slice needs one, follows the identical column convention:

- `*_score_id uuid PK DEFAULT gen_random_uuid()`.
- `*_tenant_id uuid NOT NULL FK → sys.sys_tenancies` — tenant isolation via **FK + middleware filter (I5), never RLS**.
- `*_user_id uuid NOT NULL FK → sys.sys_users` — the **subject is employee-centric (I14)**; `sys_users` here is the person row, never the auth shell.
- optional `*_position_id uuid FK → sys.sys_positions` for position-relative slices (B/C).
- the numeric score `numeric(5,2)` + a categorical **band/horizon `varchar(N) + CHECK`** (RD-08, **never** PG ENUM — matches existing `readiness_horizon` and `epfs_dimension` checks).
- `*_payload jsonb NOT NULL DEFAULT '{}'` — the **feature breakdown + per-feature contribution + the rule's intermediate values** (explainability lives here). Provenance lives here too: `payload.derivation = {model_version, rule_id, computed_at, features:{…}}` to **distinguish in-platform-derived rows from the legacy seed**. Per D-1 (§9), the **original legacy value is retained in `payload.legacy.*` for audit** while the derived value becomes the active score — superseded, never deleted.
- provenance columns: `*_computed_at timestamptz NOT NULL DEFAULT now()` + `model_version varchar` (or `payload.model_version`) so a recompute supersedes prior rows and the active row is "latest `computed_at` per subject" (the existing `…_user_idx (user_id, computed_at DESC)` indexes already support this).

**Idempotency / supersession**: a recompute writes a new row (history) OR upserts the active row per subject — decided per slice at plan time; the existing DESC indexes favor append-with-latest-wins. No destructive deletes.

**Reconciliation registry note** (D-1 RESOLVED S972 §9): a recompute does not migrate the table's declared status by itself, but the resolved path is fixed — once a table is recomputed in-platform, its `sys_reconciliation_registry` entry flips `NEEDS_DECISION → POPULATED-by-derivation` with `legacy_source = NULL` and a rationale recording "in-platform-derived (cap③), legacy seed superseded + retained in `payload.legacy.*`". Add the registry-annotation migration in the plan, not here.

## 5. Pipeline & architecture

```
sys.* live data (skill-evidence, attendance, KPI targets/achievement,
   assignments/tenure, org graph, engagement surveys)  +  ② embeddings (pgvector)
        └─► feature extraction (parameterized SQL CTEs + cosine ops, scope-aware)
             └─► scoring function (DETERMINISTIC, human-authored rule — TS service,
                  NOT ML; reproducible from features + rule + model_version)
                  └─► idempotent materialization → sys_*_scores (provenance-stamped)
                       └─► /v1/insights/* read endpoints (scope-filtered, I5)
                            └─► TanStack Query hooks ─► analytics page(s) ─► @heuresys/ui
        ▲
        └── recompute trigger: manual endpoint POST /v1/insights/recompute
            (mirrors matching:reindex) — on-demand in P1; scheduled refresh
            deferred to P2 (D-5, RESOLVED S972 §9)
```

- **New API module** `insights` (D-4 RESOLVED S972 §9 — `/v1/insights`, not `/v1/mining`), built with the **mandatory 7-step module pattern**: shared Zod schemas (`@heuresys/shared/schemas/insights`) → `repository.ts` raw parameterized SQL (feature extraction + score read; `withTransaction` for the multi-row recompute) → `service.ts` with `ActorContext` scope **reused from `analytics`/`dashboard`** (PLATFORM/TENANT/TEAM tiering, `findOwnedPositionIds`) → `routes.ts` `FastifyPluginAsyncZod` with `requirePermission` + `verifyCsrf` on the recompute → register at app.ts step 13 `prefix: '/v1/insights'` → integration test → atomic commit.
- **Feature extraction = SQL/embeddings, deterministic.** No randomness, no training. The "model" is a versioned, documented function. This keeps cap③ inside the no-Docker / native-stack / I13 discipline (no Python ML runtime, no external inference service).
- **API surface** (P1):
  - `GET /v1/insights/flight-risk` — scored list (scope-filtered) + bands + per-feature explanation. Permission `insights:view`. **Admin/manager scope only** (D-6 RESOLVED S972 §9 — flight-risk is sensitive, not ESS self-service).
  - `GET /v1/insights/users/:userId/flight-risk` — single subject, admin/manager only. **No `/v1/me/insights/flight-risk`** (D-6 — the subject does not see their own flight-risk; per-score ESS exposure revisited in later slices).
  - `POST /v1/insights/recompute` — manual, idempotent re-materialization (admin only, `insights:admin` + CSRF). On-demand like `matching:reindex` (D-5 RESOLVED S972 §9); optional systemd-timer schedule deferred to P2.
- **Permissions**: new `insights:view` + `insights:admin` (the recompute-trigger permission, mirroring the `matching:reindex` admin gate) seeded via a permission-seed migration (same pattern as `000080_predictionsml_permission_seed.sql`), mapped to the appropriate roles in `sys_auth_role_permissions` (admin/manager roles only for both). A `sys_ui_interfaces` row + `/v1/me/interfaces` exposure if a frontend page ships (mirrors `000075_matching_ui_interface.sql`).
- **Frontend** (optional in P1, recommended P2): `apps/web/src/app/(authenticated)/insights/*` page(s) composing **`@heuresys/ui` primitives only** (no new chart deps, Design-System rule), **i18n parity**, **live-data E2E only** — a Playwright test logging in as a seeded persona, loading the page, asserting on a seed-derived score value (no mock, per the `NEXT_SESSION_MVP_2A` doctrine). Every cell fed by a real `/v1/insights/*` call; the only allowed empty UI is a real empty-state.

## 6. Testing

- **Integration** (`apps/api/test/insights.integration.test.ts`, real DB via tunnel, no mocks): RBAC (`insights:view` / `insights:admin`) + admin/manager-only scope on flight-risk (no ESS self-leak, D-6) + CSRF on recompute + tenant/team scope isolation + **deterministic derived score on the seed** — recompute then assert a known persona gets the expected band given its seed features (the rule being deterministic, the assertion is exact, not fuzzy) + idempotent recompute (run twice → same active scores, supersession works) + empty-scope empty-state + the legacy-seed-vs-derived provenance tag is set.
- **Unit** on the scoring function: feed fixed feature vectors → assert exact score/band (the rule is pure; this is the explainability guarantee in test form).
- **E2E** (if frontend ships): live login + page asserts a seed-derived score, mutation/recompute path verified via re-fetch.
- `pnpm test` must be 100% green before the atomic commit (current full suite 582✓ must not regress).

## 7. Dependencies — NOW LARGELY SATISFIED

The roadmap sequenced ③ after ①+② precisely because it consumes both. **As of this session that dependency is largely met** — which de-risks ③ from "build a 3rd analytics stack" to "compose two existing ones + author the derivation rules":

| Dependency | Roadmap state (S958) | Verified state (2026-06-07) | Effect on ③ |
|---|---|---|---|
| ① BI substrate (analytics rollups, scope tiering) | planned | **COMPLETE** — `/v1/analytics/{workforce,kpi,attendance,compensation,skills,skills-by-category,org-network,overtime}` live; `analytics/service.ts` PLATFORM/TENANT/TEAM scope reusable | feature-extraction reuses analytics rollups + scope model directly |
| ② AI embedding substrate (pgvector) | NOT installed | **LIVE & POPULATED** — mig 000060; pgvector v0.8.2; 21939 skill / 3040 occ / 227 role / 156 profile embeddings; `/v1/matching/*` (me/occupations, me/positions, me/job-roles, users/:id/*, skills/:id/similar, users/:id/similar, search, reindex) | slices B/C consume person↔position/role cosine fit for free |
| Score read tables | "empty cat(ii) targets" (roadmap line 34 — now stale) | **EXIST + seeded** (`talent` 154 / `readiness` 90 / `succession` 90 / `pos_fit` 146), bucket **C/NEEDS_DECISION**, no API | ③ reuses tables; recompute supersedes legacy seed (D-1) |
| Feature data | rich | confirmed: KPI (243 def/248 tgt), attendance (3180), engagement surveys (862 responses / 6 surveys / 5 templates), skill-evidence (902), org graph (158 nodes) | feature set for slice A fully present |
| `matching:reindex` recompute precedent | n/a | live (`POST /v1/matching/reindex`) | ③ recompute endpoint mirrors it |

**Net**: the only thing ③ genuinely needs to *build* is the deterministic feature-extraction + the human-authored derivation rules + the `insights` module wiring — not infrastructure. The remaining unknowns are **semantic** (the rules), not technical, which is why they are Enzo's gate.

## 8. Phasing, effort, risk

| Phase | Scope | Effort | Notes |
|---|---|---|---|
| **P1** | `insights` module + slice **A flight-risk**: schemas → repo (SQL feature extraction) → service (scope-reused) → routes (`/v1/insights/flight-risk` + `/recompute`) → permission seed → integration tests; recompute `sys_talent_scores` (or new field) in-platform, provenance-stamped | **M** | API-first; no frontend required to call P1 done at the API layer |
| **P1b** | frontend `insights` page (1 view) — `@heuresys/ui`, i18n, live E2E | **S–M** | optional within P1; admin/manager-only (D-6 RESOLVED — no ESS for flight-risk) |
| **P2** | slice **B succession-readiness** (reuses ② position-fit embeddings) + slice **C skill-gap segments**; additional pages; **optional systemd-timer scheduled recompute** (D-5) | **M** | each ships independently on the P1 pipeline |
| **P3** | saved cohorts/segments, export, registry-status migration for recomputed tables (registry rows → POPULATED-by-derivation, D-1) | **M** | only after slices proven |

| Risk | P | I | Mitigation |
|---|---|---|---|
| Derivation rule = a semantic judgement that turns out "wrong" | med | med | a defensible **starting rule is now recorded** (§9.1) — human-authored, fully transparent in `payload`, versioned (`model_version`) so weights/thresholds can be revised without data loss; the exact rule is the one residual Enzo sign-off (§9.2), not a guess |
| Confusing in-platform-derived rows with the legacy seed | med | high | provenance tag in `payload.derivation` vs `payload.legacy`; registry-status flip; integration test asserts the tag |
| Scope leak across tenants on a per-subject score | low | high | reuse analytics/dashboard scope (FK + middleware, I5, never RLS); integration test asserts isolation |
| Feature-extraction perf on big tables (attendance 3180, surveys 862) | low | med | parameterized CTEs + existing indexes; `EXPLAIN` at plan; recompute is batch/off-path, not request-time |
| Scope creep (3 slices at once) | med | med | P1 = slice A only; B/C are additive P2 |
| Recompute non-idempotent / double-counts | low | med | latest-`computed_at`-wins via existing DESC indexes; idempotent-recompute integration test |

## 9. Resolved design decisions (S972)

The technical path was already clear; the gate was **semantic**. As of S972 the design decisions below are **DECIDED** with best-practice defaults, making this spec **implementation-ready** (design-only — implementation remains multi-session). The DECIDED choice for each is the recommended default from the prior open-decision pass, recorded with its justification. **The single residual human sign-off is D-3** (the derivation rule's weights/thresholds — irreducibly semantic; see the "Residual human sign-off" note below). Everything else needs no further decision.

- **D-1 — Legacy seed vs recompute** → **DECIDED: in-platform recompute that SUPERSEDES the legacy-seed score values.** Cap③ recomputes the four score tables in-platform and the derived value becomes the active score; provenance is stamped (`payload.derivation = {model_version, rule_id, computed_at, features:{…}}`) and the **original legacy value is retained in `payload.legacy.*` for audit** (never lost, never the active value). This **also resolves the four `NEEDS_DECISION` registry rows**: once recomputed they move to **POPULATED-by-derivation** (in-platform-derived, `legacy_source = NULL`, rationale "in-platform-derived (cap③), legacy seed superseded + retained in payload"). *Best practice: single source of truth — derivations live in-platform, are reproducible from inputs + rule + `model_version`, and the audit trail is preserved without dual-write ambiguity.*
- **D-2 — First scoring slice** → **DECIDED: P1 = Slice A (attrition / flight-risk).** Widest feature set (KPI + attendance + survey + tenure + promotion recency), reuses the existing `sys_talent_scores` table, and has **no hard dependency on ② embeddings** (B and C lean on the embedding substrate, so they follow as P2). *Best practice: prove the in-platform, rule-driven pipeline on the most legible, lowest-coupling slice first; B/C are additive on the proven pattern.*
- **D-3 — The derivation rule(s)** → **DECIDED: a transparent, explainable weighted-linear blend (RECOMMENDED STARTING RULE — see §9.1).** This is the **one irreducibly semantic decision**: a documented weighted-linear combination of measurable signals with stated starting weights + low/med/high/critical thresholds, **no black-box ML**, fully reviewable. The starting rule below is adopted as the implementation default and is the **only item carrying a residual human sign-off** — Enzo may tune the weights/thresholds at implementation kickoff (semantic authority). *Best practice: predictive scoring in an HR context must be transparent and explainable (each feature's contribution visible in `payload`), so the rule is a documented function a human can audit and revise, not a learned opaque model.*
- **D-4 — Module name** → **DECIDED: `/v1/insights`.** Reads as analytics-adjacent, intent-clear, and distinct from the imported `/v1/predictions` (PredictionsML) surface. The recompute trigger follows the `matching:reindex` precedent under an `insights:admin`-class permission. *Best practice: name by domain intent ("insights" = derived analytics) and keep the in-platform-derived surface lexically separate from the imported-ML surface to avoid the provenance confusion §2 guards against.*
- **D-5 — Recompute trigger** → **DECIDED: on-demand admin endpoint in P1 (`POST /v1/insights/recompute`, `insights:admin` + CSRF), mirroring `matching:reindex`; optional systemd-timer schedule in P2.** *Best practice: ship the simplest correct mechanism first (manual, idempotent, batch/off-path) and add scheduling only once on-demand proves insufficient — avoids premature cron infrastructure.*
- **D-6 — ESS exposure** → **DECIDED: admin/manager-only for sensitive scores; NOT shown to the subject employee.** Flight-risk is **sensitive** — it is a management tool, not self-service content — so P1 exposes it via admin/manager scope only (no `/v1/me/insights/flight-risk`). Per-score ESS exposure is **revisited in later slices** (e.g. a future "your readiness" view may be appropriate where flight-risk is not). *Best practice: sensitive predictive scores are privacy-guarded management instruments; defaulting them to admin/manager scope prevents a subject seeing a prediction about themselves that they cannot contextualize.*
- **D-7 — In-platform-only confirmation** → **DECIDED: yes — in-platform deterministic/explainable scoring only, no external ML service, no model training.** PredictionsML stays the only "ML" and it is *imported, not run here*. *Best practice: preserves the I5 / no-mock / single-stack (I13 native, no Docker, no Python ML runtime) discipline; the score is reproducible from features + documented rule + `model_version`.*

### 9.1 RECOMMENDED STARTING RULE — flight-risk derivation (D-3, residual sign-off)

> **RECOMMENDED STARTING RULE — adopt unless Enzo tunes at implementation kickoff (semantic authority).** Transparent, explainable, NO black-box ML. Every feature is measurable from live `sys.*`; every per-feature contribution is written to `payload.derivation.features` so the score is fully auditable. Weights are a defensible starting point, **not** a learned/optimized set — they are the cell Enzo signs off (or revises) before implementation.

Each feature is first **normalized to `0–100`** (0 = lowest risk contribution, 100 = highest), oriented so that higher = higher attrition risk, then combined as a **weighted linear blend**:

```
flight_risk_score = Σ (wᵢ × normalizedᵢ)        with  Σ wᵢ = 1.0
```

| Feature (signal) | Live source | Orientation (→ higher risk) | Starting weight |
|---|---|---|---|
| **Tenure** (assignment dates) | `sys_position_assignments` tenure | U-shaped: very short tenure → high; long stable tenure → low | **0.15** |
| **Recent attendance / overtime trend** | 3180 attendance rows (recent-window anomaly: rising absence or sustained overtime) | rising absence / chronic overtime → high | **0.20** |
| **KPI trajectory** (achievement trend) | KPI cluster (243 def / 248 tgt, achievement trend) | declining KPI achievement → high | **0.25** |
| **Engagement-survey signal** | 862 responses / 6 surveys (latest engagement score, low/declining) | low / falling engagement → high | **0.25** |
| **Comp-band position** | compensation vs band midpoint | below-midpoint / long-flat comp → high | **0.10** |
| **Time-since-last-promotion** | org/position history (promotion recency) | long since last move → high | **0.05** |

**Band thresholds (RD-08 `varchar + CHECK`, never PG ENUM):**

| Band | Score range |
|---|---|
| `LOW` | `0 – 39` |
| `MEDIUM` | `40 – 64` |
| `HIGH` | `65 – 84` |
| `CRITICAL` | `85 – 100` |

Missing-feature handling (e.g. no survey response for a subject): **re-normalize weights over the present features** (drop the missing term, rescale remaining weights to sum 1.0) and record the dropped feature in `payload.derivation` for transparency — never impute a synthetic value. `model_version` is stamped on every computed row so a later weight/threshold revision supersedes prior rows without data loss.

### 9.2 Residual human sign-off

**ONLY D-3 — the derivation rule's weights and thresholds (§9.1) — requires Enzo's semantic tuning at implementation kickoff.** It is the one irreducibly human decision (analogous to choosing PredictionsML target variables or `talent_scores` band thresholds): defensible defaults are recorded above, but the exact weights/thresholds are Enzo's to confirm or revise. **All other decisions (D-1, D-2, D-4, D-5, D-6, D-7) are resolved** — no further input needed. With D-3 signed off (or accepted as-is), the spec is ready for **plan → implementation** on Enzo's go.

## 10. Out of scope (this spec)

- Importing / retraining / replacing **PredictionsML** (`sys_predictive_models` / `sys_model_predictions` / `/v1/predictions/*`) — that is the brownfield import read-model, deliberately separate (§2).
- Any **black-box / trained ML model**, external inference service, or Python ML runtime (violates I13 + §2 boundary).
- Descriptive aggregation already owned by **BI ①** (cap③ writes per-subject derived scores, not rollups).
- Generative LLM narratives over the scores ("explain this risk") — a later **AI ②** generative slice once the scoring substrate proves out.
- Scheduled refresh infrastructure (optional P2 systemd-timer per D-5; not in P1).

---

> **Honest summary**: this is a **multi-session** capability whose **design decisions are now resolved** (S972, §9). This spec closes the **DESIGN stage only**. The infrastructure dependency on ①/② is **largely satisfied** (BI complete, pgvector substrate live + populated, score tables exist), so what remains is composing existing substrate + authoring the human derivation rule. Of the seven decisions, six (D-1, D-2, D-4, D-5, D-6, D-7) are settled with best-practice defaults; **only D-3 — the flight-risk rule's weights/thresholds (§9.1) — carries a residual human sign-off** (Enzo's semantic authority), and a defensible starting rule is already recorded. With that one sign-off (or acceptance as-is), the spec is ready for **plan → implementation** on Enzo's go. No code, no migration, no DDL is produced by this spec.
