# ADR‑0003 — DB Access: Drizzle ORM + Raw SQL Migrations

- **Status:** Superseded in part (S989, 2026‑06‑14) — the **Drizzle ORM** half (point 2) was never adopted: every business query is raw parameterized SQL over the pg `pool`, the `db = drizzle(pool)` export had zero consumers, and `drizzle-orm`/`drizzle-kit` were dead dependencies. They were removed (QW-H1 / TODO_100X QW-1), which also closed the lone esbuild Dependabot alert (`drizzle-kit` was its only carrier; override bumped to `>=0.28.1`). The **raw SQL migrations** half (point 1) remains fully in force.
- **Date:** 2026‑05‑16

## Context

The DBMS layer must support:

1. **Pure SQL migrations** — required by `DBMS_BOOTSTRAP_SPEC.md` and the existing 26 skeleton files. No proprietary DSL is allowed to wrap the migrations.
2. **Type‑safe query construction** for ~120 canonical tables.
3. **Tenant‑aware filtering** at the repository layer.
4. **Idempotency** verifiable via `pg_dump --schema-only` diff.
5. **No code‑gen schema lock‑in** — we want the schema to be readable by humans and `psql`.

## Decision

Combine two complementary tools:

1. **Raw SQL migrations** in `db/migrations/000001..000026.sql`, applied via `psql -v ON_ERROR_STOP=1 -f <file>` driven by `db/scripts/migrate.{ps1,sh}`. Audit table `sys.sys_schema_migrations` records each apply.
2. **Drizzle ORM** in `apps/api/src/db/` for runtime queries. Drizzle schema files are **introspected from the SQL** (via `drizzle-kit pull`) and committed alongside; we do **not** use `drizzle-kit push` to generate DDL. Migrations remain SQL.

## Alternatives Considered

| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| **Prisma + migrate** | Mature, widely used; great DX | Forces Prisma DSL as schema source of truth; introspection requires extra step; tenant filtering needs middleware/extension; slower at scale | The legacy `heuresys_platform` DB is Prisma‑based and brought us here in part — we want to break free of the DSL lock |
| **node‑postgres only (no ORM)** | Maximum control | Repetitive type definitions; manual type narrowing; query‑builder ergonomics absent | Productivity cost across 22 modules |
| **Kysely** | Type‑safe SQL builder, very thin | Smaller ecosystem; types must be hand‑maintained or generated | Drizzle has stronger schema introspection + migrations story |
| **TypeORM** | Decorator‑rich | Heavy, slower, more opinionated, decorator lock‑in | Same lock‑in concern as Prisma |
| **Drizzle with `push`** | Generates DDL automatically | Hides SQL; conflicts with `DBMS_BOOTSTRAP_SPEC.md` mandate for explicit migrations | Direct conflict with project policy |

## Consequences

**Positive:**

- Migration files remain canonical SQL that any PostgreSQL DBA can read and review.
- Drizzle types are derived from those SQL files, not the other way around — single source of truth is the DB schema.
- Tenant‑aware filtering becomes a thin repository pattern: `db.select().from(positions).where(eq(positions.tenant_id, tenantId))`.
- Twice‑run idempotency proof works because Drizzle does not own the schema state.

**Negative:**

- Introspection (`drizzle-kit pull`) must be re‑run after every migration; we add a `pnpm db:introspect` script and document it in `MIGRATION_IMPLEMENTATION_PLAN.md`.
- Drizzle is younger than Prisma; some advanced relational queries require manual SQL via `sql` template literal.

**Neutral:**

- Switching to node‑postgres only remains possible — the SQL migrations are independent of Drizzle. Drizzle is a runtime convenience, not a hard dependency for the DB layer.

## References

- Consumed by: `MIGRATION_IMPLEMENTATION_PLAN.md`, `API_IMPLEMENTATION_PLAN.md`.
- See also: ADR‑0002 (backend framework), ADR‑0004 (no Docker).
