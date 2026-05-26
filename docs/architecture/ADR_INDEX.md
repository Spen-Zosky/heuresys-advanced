# Architectural Decision Records — Index

> Heuresys Advanced HRMS/BPM Platform v5 — central registry of all ADRs.
> Each ADR is a separate file under `docs/architecture/adr/`.

## Format

Every ADR follows this structure:

1. **Title** (`NNNN_<slug>.md`)
2. **Status** — `Proposed` / `Accepted` / `Open` / `Deprecated` / `Superseded by NNNN`
3. **Date**
4. **Context** — why are we making this decision now? what forces apply?
5. **Decision** — the choice taken.
6. **Alternatives considered** — what else was on the table and why it was not chosen.
7. **Consequences** — positive, negative, neutral effects on the codebase, the team, future work.

## Registry

| ID | Title | Status | Decision Summary | Date |
|----|-------|--------|------------------|------|
| [0001](adr/0001_monorepo_tool_pnpm.md) | Monorepo manager | Accepted | **pnpm workspaces** — fast, deterministic, native TS resolution | 2026‑05‑16 |
| [0002](adr/0002_backend_framework_fastify.md) | Backend framework | Accepted | **Fastify 4** over Express — better TS ergonomics, faster, fastify‑zod | 2026‑05‑16 |
| [0003](adr/0003_db_access_drizzle_plus_raw_sql.md) | DB access | Accepted | **Drizzle ORM + raw `*.sql` migrations** — type‑safe queries, SQL‑first migrations | 2026‑05‑16 |
| [0004](adr/0004_no_docker_native_postgresql.md) | Runtime — no Docker | Accepted | **Native PostgreSQL 16 only**; Docker excluded from canonical path | 2026‑05‑16 |
| [0005](adr/0005_password_hashing_argon2id.md) | Password hashing | Accepted | **Argon2id** with OWASP 2024 parameters | 2026‑05‑16 |
| [0006](adr/0006_auth_strategy_jwt_plus_httponly_cookie.md) | Auth strategy | Accepted | **JWT 15‑min + 30‑day refresh, single‑use rotation, `HttpOnly`+`SameSite`+CSRF** | 2026‑05‑16 |
| [0007](adr/0007_frontend_next15_app_router.md) | Frontend framework | Accepted | **Next.js 15 App Router + React 19 + Tailwind 4 + shadcn/ui + TanStack Query + RHF + Zod** | 2026‑05‑16 |
| [0008](adr/0008_position_intelligence_profile_as_view.md) | Position Intelligence Profile | Accepted | **Relational base + `VIEW`/`MATERIALIZED VIEW`**; JSONB only for hints | 2026‑05‑16 |
| [0009](adr/0009_visualization_node_layouts_separate_table.md) | Visualization coordinates | Accepted | **Dedicated `sys.sys_visualization_node_layouts`** for per‑layout coords | 2026‑05‑16 |
| [0010](adr/0010_postgresql_runtime_location.md) | PostgreSQL runtime location | Accepted | **Option B** — PostgreSQL 16 native on OCI VM `oracle-vm-default` reached via SSH tunnel `ssh -L 5433:localhost:5432`; A and C documented as `.env` fallback blocks | 2026‑05‑16 |
| [0011](adr/0011_ess_scope_inclusion.md) | Employee Self‑Service Portal inclusion | Accepted | **ESS in scope as MVP‑2b** (13 pages `/me/*` + 18 endpoints `/v1/me/*` + 19 `self`‑scope permissions + hard‑coded `userId = req.user.userId`); reverses the original out‑of‑scope decision | 2026‑05‑16 |
| [0012](adr/0012_brownfield_table_mapping_wave_column.md) | Brownfield wave assignment storage | Accepted | **Dedicated `table_mapping_wave smallint` column** on `brownfield.table_mappings` with CHECK 1..4 + secondary index; symmetric with `import_runs.import_run_wave` | 2026‑05‑18 |
| [0013](adr/0013_showcase_sot_policy.md) | Showcase SoT policy | Accepted | **4‑level hierarchy** (`@heuresys/ui` → `apps/web` → `apps/showcase` mirror → GH Pages) + 3 rules: no‑edit zone on sync‑copied paths, portability invariant, deps surface alignment | 2026‑05‑20 |
| [0014](adr/0014_sdbi_semantic_driven_brownfield_import.md) | SDBI — Semantic-Driven Brownfield Import | Proposed | **Complementary paradigm** to deterministic ETL brownfield: 6-phase workflow AI-led con `temp_sdbi.*` staging schema + mapping_card + confidence HIGH/MEDIUM/LOW (mig 000036 + 000037 shipped pilot Goals/OKRs E2E X2) | 2026‑05‑20 |
| [0015](adr/0015_sys_job_roles_nullable_family_fk.md) | `sys_job_roles.family_id` nullable FK | Proposed | **DROP NOT NULL** on FK→`sys_job_families` (mig 000038) per gestire legacy senza canonical family assignment (CW-B26 Semantic FK Phantom — pattern surfaced in X2 cascade fix fail; mirror per ADR-0016) | 2026‑05‑21 |
| [0016](adr/0016_sys_esco_occupation_mappings_nullable_job_role_fk.md) | `sys_esco_occupation_mappings.job_role_id` nullable FK | Accepted | **DROP NOT NULL** + engine companion fix CW-B34 (TargetMeta.columnNullable map) per upsert 7645 ESCO rows; mig 000041 + X6.A engine patch | 2026‑05‑21 |
| [0017](adr/0017_lookup_fk_2hop_transform.md) | `LOOKUP_FK_2HOP` transform extension | Accepted | **Engine extension** + migration 000043 validator dispatch (LOOKUP_FK vs LOOKUP_FK_2HOP) per resolver 2-hop (varchar URI → legacy_mirror.x.id → sys.* via lineage); unlock 1381 rows X9 Block A | 2026‑05‑23 |
| [0018](adr/0018_coalesce_uq_class_of_bug.md) | COALESCE-UQ class-of-bug fix | Accepted | **Helper `replaceTargetColsInConflictInference`** parenthesis-depth-aware preserva COALESCE wrappers in ON CONFLICT inference; enumera 10 sys.* tables affette dalla class-of-bug CW-B49 (split-on-COALESCE su `upsert-sql.ts:661`) | 2026‑05‑23 |

## Conventions

- ADRs are append‑only. Never edit an Accepted ADR; supersede it with a new one and mark the old as `Superseded by NNNN`.
- An ADR that is `Open` must list the criteria that will close it.
- ADRs reference the deliverable that consumes them (e.g. `MIGRATION_IMPLEMENTATION_PLAN.md`).
- Cross‑references between ADRs use the relative path `adr/000N_*.md`.
