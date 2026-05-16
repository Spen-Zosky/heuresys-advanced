# ADR‑0010 — PostgreSQL Runtime Location: Deferred (Localhost / OCI VM / OCI Managed)

- **Status:** Open (deferred decision)
- **Date opened:** 2026‑05‑16

## Context

ADR‑0004 fixes the **runtime model**: native PostgreSQL 16, no Docker. This ADR fixes the **physical location** of that PostgreSQL instance.

The user has three viable hosting options:

| ID | Option | Latency from Windows PC | Setup effort | Cost | Shared across machines |
|----|--------|-------------------------|--------------|------|-----------------------|
| **A** | **localhost** native PostgreSQL on Enzo's Windows 11 PC | 0 ms | Low (1 installer + `create_local_database.ps1`) | 0 | No (single machine) |
| **B** | **PostgreSQL 16 installed on OCI VM `oracle-vm-default`** (80.225.82.207, Ubuntu 24.04 ARM64), reached via SSH tunnel `ssh -L 5432:localhost:5432 oracle-vm-default` | ≈ 20–40 ms | Medium (`apt install postgresql-16`, `pg_hba.conf`, OCI security list, SSH config) | 0 (OCI Free Tier) | Yes (PC + Mac + Cowork + CCD‑CLI Local Agent all reach the same DB) |
| **C** | **OCI Database with PostgreSQL** (managed instance, EU Milan) | ≈ 20–40 ms (direct) | High (OCI provisioning, networking, security list, SSL) | ⚠️ to be verified (no clear OCI Free Tier for managed PG as of 2026‑05) | Yes |

The user's chosen position on 2026‑05‑16: **decide later; keep all three options open during planning**.

## Decision

Defer the choice. The plan and the 10 deliverables are designed to be **runtime‑location‑agnostic**:

1. Scripts and code **never hardcode the host**. All connection parameters live in `.env`:
   ```env
   POSTGRES_HOST=<host>
   POSTGRES_PORT=<port>
   POSTGRES_DB=heuresys_advanced
   POSTGRES_USER=heuresys
   POSTGRES_PASSWORD=<password>
   POSTGRES_SCHEMA=sys
   POSTGRES_SSL=<disable|require>
   ```
2. `.env.example` ships with **three commented blocks**, one per option, so contributors can uncomment the one that applies.
3. Database name `heuresys_advanced`, role `heuresys`, schema `sys` are **invariant** across all three locations.
4. Migration scripts, validation scripts, brownfield pipeline scripts all read `.env` and work against any of the three.

## Closure Criteria

This ADR closes when the user commits to one option (or a phased plan).

Suggested phased plan (non‑binding):

- **MVP‑0 + MVP‑1:** Option A (localhost) — fastest iteration on DDL and API.
- **MVP‑2 or post‑MVP:** Option B (OCI VM) — promote to shared dev DB so multiple machines/agents work against the same canonical data. Migration path: `pg_dump` from localhost → `pg_restore` on VM → switch `.env`.
- **Option C** stays on the table as a future production option, contingent on OCI cost verification.

## Alternatives Considered

| Option | Pros | Cons | Why not chosen now |
|--------|------|------|--------------------|
| **Commit to A localhost now** | Simplest; zero infra | No shared dev DB; doubles work to migrate later | User wants to keep options open |
| **Commit to B OCI VM now** | Shared dev DB immediately | Higher setup cost upfront; latency on every query during heavy DDL iteration | Not ergonomic for MVP‑0 schema authoring |
| **Commit to C OCI Managed now** | Managed backups/patching | Cost not verified; provisioning friction | Premature for MVP |

## Consequences (while Open)

**Positive:**

- Every deliverable is location‑agnostic by design; switching is trivial.
- Acceptance test "PostgreSQL connection succeeds against `.env`‑configured runtime" works for all three.

**Negative:**

- `.env.example` is slightly longer (three commented blocks instead of one).
- A reader must understand ADR‑0010 to know "which DB am I pointed at?".

**Neutral:**

- Switching between A/B/C is operational, not architectural. Code remains the same.

## References

- Consumed by: every deliverable that touches the DB layer.
- See also: ADR‑0004 (no Docker), ADR‑0003 (DB access).
