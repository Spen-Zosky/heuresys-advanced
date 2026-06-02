# AI — Semantic Matching Engine — Design Spec

> **Status**: DESIGN (S958, 2026-06-03), brainstormed with Enzo. Capability ②/5 of the platform-capabilities program (`2026-06-03-platform-capabilities-roadmap.md`). **No code until this spec is reviewed + approved + a plan is written.**
> **Core principle**: ONE shared embedding substrate; every matching scenario is a similarity query over it. All scenarios are additive phases on the same foundation — none precluded.

## 1. Goal

Semantic skill-matching for career mobility & development. Primary use-case (Enzo): **person → roles/occupations**. Realized inclusively: the same substrate also serves person→internal-roles, person↔person, skill-search/dedup, and (phase 3) person↔positions / position→candidates.

## 2. Architecture — the shared substrate

- **`pgvector`** extension on PG16 (ARM64-supported) — the only new infra. `pg_trgm` (already installed) stays for hybrid lexical matching.
- **Embeddings of 4 entities** (vector columns / sidecar tables `sys_*_embedding`):
  - skills (21939) — `skill_name` + `skill_description` + ESCO uri
  - ESCO occupations (7645, `sys_esco_occupation_mappings`)
  - job_roles (227)
  - **person profiles** (156) — derived: mean-pool of the embeddings of each person's skill-evidence (902 rows)
- **Similarity layer**: cosine kNN (`<=>` operator) + HNSW/IVFFlat index. Optional hybrid re-rank with `pg_trgm` lexical score.
- **New API module** `semantic-matching` (7-step pattern): `/v1/matching/*` (admin) + `/v1/me/matching` (ESS self-scope). Repository = raw parameterized SQL with vector ops; service = ActorContext scoping; routes = `requirePermission` + CSRF on writes.

## 3. Scenarios as additive phases (same substrate)

| Phase | Scenario | Query | Surface |
|---|---|---|---|
| **1** | person → ESCO occupations (primary) | person-emb kNN over occupation-emb | `/v1/me/matching/occupations` (ESS) |
| **1** | skill semantic search / dedup | skill-emb kNN over skill-emb | admin catalog hygiene; near-free with the substrate |
| **2** | person → internal job_roles | person-emb kNN over role-emb | ESS mobility + admin |
| **2** | person ↔ person similarity | person-emb kNN over person-emb | succession / team-building (admin) |
| **3** | person → positions / position → candidates | needs position skill-requirements derived first (today 0) — derive via the position's ESCO occupation + embeddings | staffing; ALSO closes the `position_skill_requirements` reconciliation blocker |

## 4. Technical decisions (recommended)

1. **Embedding model**: **Voyage AI** (multilingual IT/EN, Anthropic-aligned). ~30k vectors one-shot (skills+occupations+roles+persons) at low cost; zero ML infra. **The one new external dependency/key → needs Enzo's go for a Voyage account/key.** Alternative: self-host (sentence-transformers multilingual) on the VM — no per-call cost / no external dep, but Python+model infra + maintenance; revisit if a no-external-dependency constraint is set.
2. **Person profile vector**: mean-pool of the person's skill embeddings (robust, incremental, explainable) over concatenated-text embedding.
3. **Refresh**: batch backfill once + incremental on new skill-evidence (a small job/endpoint). Embeddings versioned (model id in metadata) for re-embed on model change.
4. **Scoping**: tenant isolation via FK + middleware (I5, never RLS); ESS results self-scoped to the caller.

## 5. Components & data flow

```
skill-evidence ─┐
skills ─────────┼─► embed (Voyage) ─► sys_*_embedding (pgvector) ─► kNN service ─► /v1/(me/)matching/*
ESCO occ ───────┤                                                        ▲
job_roles ──────┘                                              ActorContext scope (I5)
```

- Migration(s) `000057+`: `CREATE EXTENSION vector`; add embedding tables/columns + HNSW indexes (idempotent).
- Embedding pipeline: a service (batch + incremental) calling Voyage, writing vectors. No vectors fabricated — only real entity text embedded.
- Match endpoints: parameterized kNN, top-N + score, with the matched skills as explanation.

## 6. Testing

- Integration (`apps/api/test/semantic-matching.integration.test.ts`): RBAC + CSRF + scope; a seeded person returns deterministic top-N occupations (assert known overlap, e.g. a finance-skilled persona → finance ESCO occupations); empty-profile → empty-state; tenant isolation.
- Embedding pipeline: unit test on the mean-pool + a recorded-fixture for the Voyage call (no live API in CI).

## 7. Risks

| Risk | P | I | Mitigation |
|---|---|---|---|
| Voyage cost/dependency | low | low | one-shot ~30k vectors is cheap; cache; fixture in CI |
| Match quality / relevance | med | med | hybrid lexical re-rank; eval set of known person→occupation pairs |
| pgvector on ARM64 | low | med | supported; verify at plan step |
| Phase-3 position-req derivation ambiguity | med | med | gated as its own slice; ESCO-occupation-driven, documented |

## 8. Out of scope (this spec)

Generative LLM features (insight narratives, copilot) — a later AI slice once the embedding substrate proves out. Phases 2/3 get their own thin plans on top of this foundation.
