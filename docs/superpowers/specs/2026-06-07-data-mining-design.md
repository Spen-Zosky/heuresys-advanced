# Data-Mining — In-Platform Scoring Engine — Design Spec

> **Status**: DESIGN (S, 2026-06-07). Capability ③/5 of the platform-capabilities program (`2026-06-03-platform-capabilities-roadmap.md`). **No code until this spec is reviewed + approved by Enzo + a plan is written.** This spec closes the **DESIGN stage only**; implementation is multi-session and out of scope here.
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
- The four `sys_*_scores` tables today contain *imported* seed values, which is exactly the registry's `NEEDS_DECISION` flag: Enzo must decide whether cap③ **recomputes them in-platform** (overwriting the legacy seed with a transparent derived value) or **keeps the legacy seed as a fallback** beside the derived value. This is **OPEN DECISION D-1** (§9). The recommended path recomputes in-platform and stamps provenance so the two are never confused.

> **Contrast vs BI ①**: BI is *descriptive* — it aggregates live rows into rollups (headcount, KPI %, heatmaps) and computes nothing per-person. Cap③ writes a **per-subject derived score** with its own provenance row. A flight-risk score is not an aggregate of attendance; it is a function of features, authored by a human rule.

## 3. First-slice candidates (pick a recommended P1)

All three are feasible on today's substrate. Each makes its **human-authored derivation rule explicit** — the rule is a *semantic decision for Enzo* (the same way `talent_scores` band thresholds and the imported PredictionsML target variables were human choices).

| Slice | Target table | Feature inputs (all live `sys.*`) | Derivation rule (human-authored, transparent) | Output |
|---|---|---|---|---|
| **A — Attrition / flight-risk** ⭐ recommended P1 | `sys_talent_scores` band-style OR a new `…_payload.flight_risk` field | tenure (assignment dates), KPI-achievement trend (KPI cluster), attendance/overtime anomaly (3180 attendance), engagement-survey score (862 responses), time-since-last-promotion (org/position history) | weighted, normalized, documented formula → `0–100` + band `LOW/MEDIUM/HIGH/CRITICAL` (RD-08 CHECK) + per-feature contribution in `payload` | risk score + band + explanation, per user |
| **B — Succession-readiness** | `sys_readiness_scores` (already has `horizon` CHECK `READY_NOW … NOT_READY`) | candidate skill-fit vs target position (② embeddings person↔position fit), KPI achievement, tenure, current-vs-target seniority gap | rule mapping a composite fit value → the existing `horizon` enum + `value 0–100` | readiness value + horizon per (user, position) |
| **C — Skill-gap clustering / segments** | `sys_employee_position_fit_scores` (`dimension=SKILL`) + a segment label in payload | per-person skill-evidence vector (② `sys_user_profile_embeddings`, 156) vs role/position skill demand; coverage gap | deterministic k-means-free *segmentation by rule* (gap-bucket thresholds) OR documented cosine-distance bucketing — **no opaque clustering model** | gap score + segment per user |

**Recommendation: P1 = Slice A (attrition / flight-risk)** — it is the canonical "data-mining" use-case (roadmap line 32), exercises the widest feature set (KPI + attendance + survey + tenure), reuses an existing score table, and has zero hard dependency on ② embeddings (B and C lean on the embedding substrate). It is the most *legible* first proof that the engine is in-platform and rule-driven, not a black box. B and C become P2 once A's pipeline pattern is proven (they reuse it).

## 4. Data model (proposed — NO DDL here)

Cap③ **reuses the four existing `NEEDS_DECISION` score tables** rather than minting new ones (they already match the required shape, FK discipline, and indexes — verified live). A new score family, if a slice needs one, follows the identical column convention:

- `*_score_id uuid PK DEFAULT gen_random_uuid()`.
- `*_tenant_id uuid NOT NULL FK → sys.sys_tenancies` — tenant isolation via **FK + middleware filter (I5), never RLS**.
- `*_user_id uuid NOT NULL FK → sys.sys_users` — the **subject is employee-centric (I14)**; `sys_users` here is the person row, never the auth shell.
- optional `*_position_id uuid FK → sys.sys_positions` for position-relative slices (B/C).
- the numeric score `numeric(5,2)` + a categorical **band/horizon `varchar(N) + CHECK`** (RD-08, **never** PG ENUM — matches existing `readiness_horizon` and `epfs_dimension` checks).
- `*_payload jsonb NOT NULL DEFAULT '{}'` — the **feature breakdown + per-feature contribution + the rule's intermediate values** (explainability lives here). Provenance lives here too: `payload.derivation = {model_version, rule_id, features:{…}}` to **distinguish in-platform-derived rows from the legacy seed** (`payload.legacy.*`).
- provenance columns: `*_computed_at timestamptz NOT NULL DEFAULT now()` + `model_version varchar` (or `payload.model_version`) so a recompute supersedes prior rows and the active row is "latest `computed_at` per subject" (the existing `…_user_idx (user_id, computed_at DESC)` indexes already support this).

**Idempotency / supersession**: a recompute writes a new row (history) OR upserts the active row per subject — decided per slice at plan time; the existing DESC indexes favor append-with-latest-wins. No destructive deletes.

**Reconciliation registry note**: a recompute does not migrate the table's declared status by itself. When Enzo approves in-platform derivation for a table, its `sys_reconciliation_registry` entry should be flipped `NEEDS_DECISION → IMPORT`-equivalent-or-new-status with `legacy_source = NULL` and a rationale recording "in-platform-derived (cap③), legacy seed superseded". Add a registry annotation migration in the plan, not here.

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
            (mirrors matching:reindex) — scheduled refresh deferred (OPEN DECISION D-3)
```

- **New API module** `insights` (or `mining` — naming is OPEN DECISION D-2), built with the **mandatory 7-step module pattern**: shared Zod schemas (`@heuresys/shared/schemas/insights`) → `repository.ts` raw parameterized SQL (feature extraction + score read; `withTransaction` for the multi-row recompute) → `service.ts` with `ActorContext` scope **reused from `analytics`/`dashboard`** (PLATFORM/TENANT/TEAM tiering, `findOwnedPositionIds`) → `routes.ts` `FastifyPluginAsyncZod` with `requirePermission` + `verifyCsrf` on the recompute → register at app.ts step 13 `prefix: '/v1/insights'` → integration test → atomic commit.
- **Feature extraction = SQL/embeddings, deterministic.** No randomness, no training. The "model" is a versioned, documented function. This keeps cap③ inside the no-Docker / native-stack / I13 discipline (no Python ML runtime, no external inference service).
- **API surface** (P1):
  - `GET /v1/insights/flight-risk` — scored list (scope-filtered) + bands + per-feature explanation. Permission `insights:view`.
  - `GET /v1/insights/users/:userId/flight-risk` — single subject (admin) / `GET /v1/me/insights/*` for ESS self-scope (gated by D-4, see §9).
  - `POST /v1/insights/recompute` — manual, idempotent re-materialization (admin only, `insights:recompute` + CSRF). On-demand like `matching:reindex`; scheduled refresh deferred (D-3).
- **Permissions**: new `insights:view` + `insights:recompute` seeded via a permission-seed migration (same pattern as `000080_predictionsml_permission_seed.sql`), mapped to the appropriate roles in `sys_auth_role_permissions`. A `sys_ui_interfaces` row + `/v1/me/interfaces` exposure if a frontend page ships (mirrors `000075_matching_ui_interface.sql`).
- **Frontend** (optional in P1, recommended P2): `apps/web/src/app/(authenticated)/insights/*` page(s) composing **`@heuresys/ui` primitives only** (no new chart deps, Design-System rule), **i18n parity**, **live-data E2E only** — a Playwright test logging in as a seeded persona, loading the page, asserting on a seed-derived score value (no mock, per the `NEXT_SESSION_MVP_2A` doctrine). Every cell fed by a real `/v1/insights/*` call; the only allowed empty UI is a real empty-state.

## 6. Testing

- **Integration** (`apps/api/test/insights.integration.test.ts`, real DB via tunnel, no mocks): RBAC (`insights:view` / `insights:recompute`) + CSRF on recompute + tenant/team scope isolation + **deterministic derived score on the seed** — recompute then assert a known persona gets the expected band given its seed features (the rule being deterministic, the assertion is exact, not fuzzy) + idempotent recompute (run twice → same active scores, supersession works) + empty-scope empty-state + the legacy-seed-vs-derived provenance tag is set.
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
| **P1b** | frontend `insights` page (1 view) — `@heuresys/ui`, i18n, live E2E | **S–M** | optional within P1; gated by D-4 (admin-only vs ESS) |
| **P2** | slice **B succession-readiness** (reuses ② position-fit embeddings) + slice **C skill-gap segments**; additional pages | **M** | each ships independently on the P1 pipeline |
| **P3** | scheduled recompute (D-3), saved cohorts/segments, export, registry-status migration for recomputed tables | **M** | only if on-demand proves insufficient |

| Risk | P | I | Mitigation |
|---|---|---|---|
| Derivation rule = a semantic judgement that turns out "wrong" | med | med | rule is human-authored + Enzo-approved + fully transparent in `payload`; versioned (`model_version`) so it can be revised without data loss; this is a gate decision, not a guess |
| Confusing in-platform-derived rows with the legacy seed | med | high | provenance tag in `payload.derivation` vs `payload.legacy`; registry-status flip; integration test asserts the tag |
| Scope leak across tenants on a per-subject score | low | high | reuse analytics/dashboard scope (FK + middleware, I5, never RLS); integration test asserts isolation |
| Feature-extraction perf on big tables (attendance 3180, surveys 862) | low | med | parameterized CTEs + existing indexes; `EXPLAIN` at plan; recompute is batch/off-path, not request-time |
| Scope creep (3 slices at once) | med | med | P1 = slice A only; B/C are additive P2 |
| Recompute non-idempotent / double-counts | low | med | latest-`computed_at`-wins via existing DESC indexes; idempotent-recompute integration test |

## 9. OPEN DECISIONS for Enzo (the gate)

The technical path is clear; the gate is **semantic**. Enzo decides:

- **D-1 — Legacy seed vs recompute** (the registry `NEEDS_DECISION`): for the four score tables holding legacy-derived seed values, does cap③ **recompute in-platform and supersede** the seed (recommended — transparent, owned, provenance-stamped), or **keep the legacy seed as a labelled fallback** beside the derived value? Resolving this also resolves the four `NEEDS_DECISION` registry rows.
- **D-2 — First scoring slice**: confirm **P1 = A flight-risk** (recommended), or pick B succession-readiness / C skill-gap segments first.
- **D-3 — The derivation rule(s)** themselves (the semantic authority — analogous to choosing PredictionsML target variables / `talent_scores` band thresholds): the feature weights + normalization + band thresholds for the chosen slice. Claude proposes a defensible default rule in the plan; Enzo signs off on the exact rule (this is the cell that cannot be auto-decided).
- **D-4 — Module name**: `/v1/insights` (recommended, intent-clear, distinct from imported `/v1/predictions`) vs `/v1/mining`.
- **D-5 — Recompute trigger**: on-demand only (`POST /v1/insights/recompute`, mirrors `matching:reindex`, recommended for P1) vs scheduled refresh (cron/job) — defer scheduling to P3 unless required now.
- **D-6 — ESS exposure**: are flight-risk / readiness scores admin-only, or does an employee see their own (a self-scoped `/v1/me/insights/*`)? Flight-risk in particular is sensitive even on synthetic data — recommend **admin-only for P1**, ESS revisited per-slice.
- **D-7 — In-platform-only confirmation**: confirm the hard constraint — **no external ML service, no model training, deterministic human-authored rules only** (keeps I13 native-stack discipline; PredictionsML stays the only "ML" and it is imported, not run here).

## 10. Out of scope (this spec)

- Importing / retraining / replacing **PredictionsML** (`sys_predictive_models` / `sys_model_predictions` / `/v1/predictions/*`) — that is the brownfield import read-model, deliberately separate (§2).
- Any **black-box / trained ML model**, external inference service, or Python ML runtime (violates I13 + §2 boundary).
- Descriptive aggregation already owned by **BI ①** (cap③ writes per-subject derived scores, not rollups).
- Generative LLM narratives over the scores ("explain this risk") — a later **AI ②** generative slice once the scoring substrate proves out.
- Scheduled refresh infrastructure (P3, D-5).

---

> **Honest summary**: this is a **multi-session** capability, **gated on Enzo**. This spec closes the **DESIGN stage only**. The infrastructure dependency on ①/② is now **largely satisfied** (BI complete, pgvector substrate live + populated, score tables exist), so what remains is composing existing substrate + authoring the human derivation rules — making the open decisions semantic (Enzo's authority), not technical. No code, no migration, no DDL is produced by this spec.
