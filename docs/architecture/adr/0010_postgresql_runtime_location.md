# ADR‑0010 — PostgreSQL Runtime Location: OCI VM `oracle-vm-default` (Option B)

- **Status:** Accepted
- **Date opened:** 2026‑05‑16
- **Date closed:** 2026‑05‑16 (same day — see §9.1 RD‑25 in `BOOTSTRAP_EXECUTION_PLAN.md`)
- **Deciders:** Enzo Spenuso (supervisor)

## Context

ADR‑0004 fixes the **runtime model**: native PostgreSQL 16, no Docker. This ADR fixes the **physical location** of that PostgreSQL instance.

The user has three viable hosting options:

| ID | Option | Latency from Windows PC | Setup effort | Cost | Shared across machines |
|----|--------|-------------------------|--------------|------|-----------------------|
| **A** | **localhost** native PostgreSQL on Enzo's Windows 11 PC | 0 ms | Low (1 installer + `create_local_database.ps1`) | 0 | No (single machine) |
| **B** | **PostgreSQL 16 installed on OCI VM `oracle-vm-default`** (80.225.82.207, Ubuntu 24.04 ARM64), reached via SSH tunnel `ssh -L 5433:localhost:5432 oracle-vm-default` | ≈ 20–40 ms | Medium (`apt install postgresql-16`, `pg_hba.conf`, OCI security list, SSH config) | 0 (OCI Free Tier) | Yes (PC + Mac + Cowork + CCD‑CLI Local Agent all reach the same DB) |
| **C** | **OCI Database with PostgreSQL** (managed instance, EU Milan) | ≈ 20–40 ms (direct) | High (OCI provisioning, networking, security list, SSL) | ⚠️ to be verified (no clear OCI Free Tier for managed PG as of 2026‑05) | Yes |

Initial position on 2026‑05‑16: keep all three options open during planning. Closure on the same day: **Option B**.

## Decision

**Option B — PostgreSQL 16 native on OCI VM `oracle-vm-default`**, reached from any developer machine via SSH local‑forward tunnel on port `5433`.

Rationale:

- **Shared canonical DB** across all access points (Windows PC, Mac, Cowork sandbox, CCD‑CLI Local Agent on the VM itself). One source of truth, no `pg_dump`/`pg_restore` shuttling between machines.
- **Free Tier**: zero cost on OCI Always Free.
- **Schema authoring ergonomics**: 20–40 ms latency is acceptable for DDL iteration; the bulk of work is migration files applied through `psql -1`, not interactive queries.
- **Location‑agnostic codebase preserved**: `.env`‑driven, Options A and C remain documented in `.env.example` as commented fallback blocks.

## Implementation Notes (binding)

1. **Tunnel port**: local **5433** (`ssh -L 5433:localhost:5432 oracle-vm-default`) to avoid collision with any local PostgreSQL a contributor may run for parallel experiments.
2. **`.env.example`**: ships with three commented blocks (A / **B active** / C). Default working block = B.
3. **VM provisioning prerequisites** (executed once before MVP‑0 step 5.0.2):
   - `sudo apt update && sudo apt install -y postgresql-16 postgresql-contrib`
   - `pg_hba.conf` configured for `local` + `host 127.0.0.1/32` (no public binding — tunnel‑only access).
   - **Risk R13 mitigation**: install `build-essential python3 g++ make` so ARM64 builds of Argon2, `pg`, Drizzle compile from source if no aarch64 wheel is available.
4. **Fallback (R8)**: if ARM64 native deps prove problematic, downgrade to **Option A localhost** for MVP‑0/1 by uncommenting block A in `.env` and recommenting block B. No code change needed.
5. **Backup**: `pg_dump` from VM to a local snapshot under `qa_artifacts/db_snapshots/` (gitignored) before any destructive operation.

## Alternatives Considered

| Option | Pros | Cons | Why not chosen |
|--------|------|------|--------------------|
| **A localhost** | Simplest; zero infra; lowest latency | No shared dev DB across machines; doubles work to migrate later | Bus factor R12: a single‑machine DB is harder to recover if the Windows PC is unreachable |
| **C OCI Managed** | Managed backups/patching | Cost not verified; provisioning friction; SSL required | Premature for MVP; revisit at production cutover |

## Consequences

**Positive:**

- Single canonical DB reachable from PC, Mac, Cowork sandbox, CCD‑CLI Local Agent on the VM, and any future SSH client.
- OCI Free Tier keeps cost at €0 for development phase.
- `.env.example` 3‑block design preserved — switching back to A or forward to C remains a `.env` edit, not a code refactor.

**Negative:**

- SSH tunnel must be running for the API to start (developer workflow friction).
- 20–40 ms per‑query latency means heavy interactive DDL iteration on the VM is slower than localhost; mitigated by applying migrations through `psql -1 -f` (single transaction per file).
- ARM64 native dep build risk (R13) is now active — must verify on `pnpm install` before declaring MVP‑0 complete.

**Neutral:**

- Switching to Option A or C remains an operational change (uncomment a different `.env` block), not an architectural one.

## References

- Closed by: §9.1 RD‑25 in `BOOTSTRAP_EXECUTION_PLAN.md`.
- Consumed by: every deliverable that touches the DB layer.
- Related: ADR‑0004 (no Docker), ADR‑0003 (DB access), Risk R8 (Windows stack assembly), Risk R13 (OCI ARM64 native deps).
