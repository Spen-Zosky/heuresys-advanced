# ADR‑0008 — Position Intelligence Profile: Relational Base + View, not Blob

- **Status:** Accepted
- **Date:** 2026‑05‑16

## Context

The Position Intelligence Profile (PIP) is the central aggregate of the platform. It joins for a single position:

- Required skills (with proficiency levels).
- Required KPIs (with targets and weights).
- Required learning paths and modules.
- Career paths.
- Succession relevance and criticality.
- Economic weight.
- Compensation profile.
- Position owner.
- Reporting structure.
- ESCO occupation mapping.
- Risk / compliance relevance.

A naive design would store this as a single JSONB blob per position. That violates two project rules:

1. Canonical data is relational and queryable from `psql`, not opaque JSON.
2. Person evidence must be **compared** to position requirements; this requires fields, not blobs.

## Decision

PIP is realized as:

1. **Relational base tables** in `sys`, one per requirement type:
   - `sys.sys_positions` (the spine).
   - `sys.sys_position_skill_requirements` (FK position + skill + required_proficiency + weight + criticality).
   - `sys.sys_position_kpi_requirements` (FK position + kpi_definition + target_template + weight).
   - `sys.sys_position_learning_requirements` (FK position + learning_path + mandatory_yes_no + deadline_rule).
   - `sys.sys_position_career_paths` (FK position + career_path).
   - `sys.sys_position_compensation_profiles` (FK position + band + economic_weight).
   - `sys.sys_position_succession_relevance` (FK position + is_critical + readiness_horizon_required).
2. **`VIEW` or `MATERIALIZED VIEW`** `sys.sys_position_intelligence_profiles_v` that joins all base tables into a single row per position, returning a JSON projection. This view is read‑only and serves the API endpoint `GET /positions/{id}/intelligence-profile`.
3. **JSONB columns** are permitted **only** in dedicated optional columns:
   - `sys_positions.ai_hints` JSONB — unstructured AI‑generated hints (e.g., suggested skills not yet in catalog).
   - `sys_visualization_nodes.metadata` JSONB — visualization metadata.
   - `sys_seed_candidate_records.candidate_payload` JSONB — external payloads from seed acquisition before validation.

JSONB is **never** the canonical store for required skills, KPIs, learning paths, career paths, or compensation profile.

## Alternatives Considered

| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| **Single JSONB blob per position** | Easy to read | Cannot index requirements; cannot enforce FK to skill/KPI/learning catalogs; gap analysis becomes ad hoc JSON walking | Violates project rules; defeats the purpose of a canonical schema |
| **One mega table with 50+ columns** | Joins avoided | Sparse, hard to evolve, hard to validate | Schema bloat |
| **Document store (MongoDB) for PIP** | Flexible | Splits the source of truth; loses FK integrity to `sys` | Goes against the single‑DB principle |

## Consequences

**Positive:**

- Gap analysis (`person evidence vs position requirement`) is a SQL join, not a JSON crawl.
- FK integrity: every required skill exists in `sys.sys_skills`, every required KPI exists in `sys.sys_kpi_definitions`, etc.
- The view can be materialized when read patterns demand it; refreshed on relevant writes.
- AI hints have a clear home (`ai_hints` JSONB) without polluting the canonical structure.

**Negative:**

- More tables (~7 PIP base tables instead of 1 blob). Schema is larger.
- The view definition is non‑trivial; we provide a tested SQL template in `TARGET_SCHEMA_DESIGN.md`.

**Neutral:**

- If performance demands it, `MATERIALIZED VIEW` + refresh trigger covers high‑read workloads. Default is plain `VIEW` until benchmarks say otherwise.

## References

- Consumed by: `TARGET_SCHEMA_DESIGN.md`, `MIGRATION_IMPLEMENTATION_PLAN.md`, `API_IMPLEMENTATION_PLAN.md` (positions module).
- See also: ADR‑0009 (visualization layout separation).
