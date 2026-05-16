# ADR‑0004 — Runtime: Native PostgreSQL Only, No Docker

- **Status:** Accepted (hard user policy)
- **Date:** 2026‑05‑16

## Context

The v5 Bootstrap Pack ships an optional `docker-compose.yml` template. The user (supervisor) has explicitly excluded Docker and containers from the canonical local development and runtime path. Reason: workflow simplicity, host‑level performance, control over the PostgreSQL installation and parameters, and avoidance of container orchestration overhead for a single‑service DB.

## Decision

**Native PostgreSQL 16 only.** No `docker-compose.yml` on the canonical path. No container references in the canonical execution sequence.

Canonical configuration (varies by ADR‑0010 location):

- Database name: `heuresys_advanced`
- Role: `heuresys`
- Canonical schema: `sys`
- Auxiliary schemas: `brownfield`, `staging`, `audit`

Connection parameters live in `.env`:

```env
POSTGRES_HOST=...
POSTGRES_PORT=...
POSTGRES_DB=heuresys_advanced
POSTGRES_USER=heuresys
POSTGRES_PASSWORD=<local secret>
POSTGRES_SCHEMA=sys
POSTGRES_SSL=disable   # require for managed
```

Setup scripts (idempotent native bootstrap):

- `db/scripts/create_local_database.{ps1,sh}` — creates role, db, schema if missing.
- `db/scripts/migrate.{ps1,sh}` — applies `db/migrations/*.sql` in order.
- `db/scripts/reset_local_database.ps1` — dev‑only, prompts confirm.
- `db/scripts/validate_database.ps1` — validation views + idempotency proof.

Docker is permitted **only** as an optional, clearly‑labelled, non‑default reference under `docs/optional/docker/` if a contributor opts in. The canonical workflow never depends on it.

## Alternatives Considered

| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| **Docker Compose with PostgreSQL service** | Single command bootstrap; isolation | Performance penalty on Windows host; volume management; reduces direct introspection (`psql` from host needs port mapping); adds maintenance | Explicit user policy: no Docker |
| **Docker for tests only** | Ephemeral test DB | Adds Docker dependency for contributors who run tests | Same — user policy excludes Docker |
| **Cloud‑hosted DB (managed)** | Zero local setup | Hard dependency on network + provider; not free for some setups | Covered as Option C inside ADR‑0010, not exclusive |

## Consequences

**Positive:**

- Direct host‑level `psql` access; no port mapping.
- Faster I/O than containerized DB on Windows hosts (avoids the Hyper‑V bridge overhead).
- Setup scripts work identically against any of the three ADR‑0010 locations (localhost / OCI VM / OCI Managed).
- Acceptance test "PostgreSQL connection succeeds" is single, location‑agnostic.

**Negative:**

- Contributors must install PostgreSQL 16 themselves (one‑time setup) — documented in `BOOTSTRAP_EXECUTION_PLAN.md` and a forthcoming `docs/setup/INSTALL_POSTGRESQL.md`.
- Heterogeneity across contributors' OSes (Windows 11, macOS, Linux): scripts cover PowerShell + Bash to mitigate.

**Neutral:**

- A contributor may still run PostgreSQL in their own Docker container locally; they only must point `.env` at it. The project does not provide or document that path as canonical.

## References

- Consumed by: `BOOTSTRAP_EXECUTION_PLAN.md`, `MIGRATION_IMPLEMENTATION_PLAN.md`, `BROWNFIELD_IMPORT_PLAN.md`.
- See also: ADR‑0010 (runtime location).
