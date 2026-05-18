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

## Conventions

- ADRs are append‑only. Never edit an Accepted ADR; supersede it with a new one and mark the old as `Superseded by NNNN`.
- An ADR that is `Open` must list the criteria that will close it.
- ADRs reference the deliverable that consumes them (e.g. `MIGRATION_IMPLEMENTATION_PLAN.md`).
- Cross‑references between ADRs use the relative path `adr/000N_*.md`.
