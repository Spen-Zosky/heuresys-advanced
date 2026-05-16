# `db/scripts/` — Database Bootstrap & Operations

> Native PostgreSQL 16 setup, migration runner, reset, and validation scripts. Cross‑platform (PowerShell 5+ on Windows, Bash on Linux/macOS/Git Bash). No Docker on the canonical path (ADR‑0004).

---

## Two operational models (per ADR‑0010)

| Model | Where PostgreSQL runs | Bootstrap script | Daily ops |
|-------|----------------------|------------------|-----------|
| **A — localhost** (Windows PC) | Native install on dev machine | `create_local_database.{ps1,sh}` | `migrate.*`, `reset_local_database.*`, `validate_database.*` |
| **B — OCI VM `oracle-vm-default`** (current, RD‑25) | Native install on Ubuntu 24.04 ARM64 VM | `setup_oci_vm_database.sh` (one‑shot via SSH) | `migrate.*`, `validate_database.*` (via SSH tunnel) |

The **daily ops scripts** (`migrate`, `validate`) are identical for A and B — they connect via `POSTGRES_HOST:POSTGRES_PORT` from `.env` as the `heuresys` role. Model B simply uses `localhost:5433` (the local end of an SSH tunnel).

---

## Quick start — Model B (current)

Prerequisites:
- SSH alias `oracle-vm-default` configured (`~/.ssh/config`).
- `sudo` access on the VM for one‑shot bootstrap.
- PostgreSQL 16 client (`psql`, `pg_dump`) installed locally.
- `.env` filled with Option B block active.

```bash
# 1) One-shot DB bootstrap on the VM (creates DB + schemas + extensions)
./db/scripts/setup_oci_vm_database.sh

# 2) Open SSH tunnel (run in a dedicated terminal, keep alive)
ssh -L 5433:localhost:5432 oracle-vm-default

# 3) Apply migrations through the tunnel
./db/scripts/migrate.sh            # or migrate.ps1 on Windows PowerShell

# 4) Validate (views + twice-run idempotency proof)
./db/scripts/validate_database.sh
```

---

## Quick start — Model A (localhost, fallback)

Prerequisites:
- PostgreSQL 16 installed natively (server + client).
- `.env` filled with Option A block active.
- `POSTGRES_SUPERUSER` and `POSTGRES_SUPERUSER_PASSWORD` set.

```powershell
# 1) Create role + DB + schemas + extensions
./db/scripts/create_local_database.ps1

# 2) Apply migrations
./db/scripts/migrate.ps1

# 3) Validate
./db/scripts/validate_database.ps1

# Optional: reset (DEV ONLY, destructive)
./db/scripts/reset_local_database.ps1
```

---

## Script reference

| Script | Purpose | Model | Idempotent | Destructive |
|--------|---------|:----:|:----------:|:-----------:|
| `create_local_database.ps1` / `.sh` | Bootstrap role + DB + schemas + extensions on localhost | A | ✓ | ✗ |
| `setup_oci_vm_database.sh` | One‑shot bootstrap on OCI VM via SSH (`sudo -u postgres`) | B | ✓ | ✗ |
| `migrate.ps1` / `.sh` | Apply `db/migrations/*.sql` in lexical order; audit each apply in `sys.sys_schema_migrations` | A, B | ✓ | ✗ |
| `reset_local_database.ps1` / `.sh` | DROP DB + recreate empty (Model A only); prompts for confirmation | A | n/a | ✓ (DB‑local) |
| `validate_database.ps1` / `.sh` | Run all `sys.v_*` validation views (expect 0 rows) + twice‑run `pg_dump` diff | A, B | ✓ | ✗ |

---

## Idempotency contract

Every migration is wrapped in a single transaction (`psql -1 -f`) and uses guarded DDL (`CREATE … IF NOT EXISTS`, `ALTER … ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS … ; ADD CONSTRAINT …` for CHECKs). The audit table `sys.sys_schema_migrations` records the SHA‑256 of each migration file applied, last apply timestamp, executor, and duration in ms.

The twice‑run proof (`validate_database.{ps1,sh}`) captures a `pg_dump --schema-only` snapshot before and after a second migrate pass and asserts the diff is empty. This is acceptance test **A3** in `BOOTSTRAP_EXECUTION_PLAN.md` §6.

---

## Tunnel notes (Model B)

The SSH tunnel forwards local port **5433** to the VM cluster on port **5432**:

```bash
ssh -L 5433:localhost:5432 oracle-vm-default
```

Port 5433 was chosen to avoid collision with any local PostgreSQL a contributor may run for parallel experiments. On the VM, port 5433 is occupied by an unrelated `docker-proxy` process — this does not interfere because the SSH `-L` flag forwards to the **remote** side `localhost:5432`, not the remote 5433.

While the tunnel is open, `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced` reaches the canonical DB on the VM.

---

## Coexistence with `heuresys_platform` (legacy brownfield DB)

The VM cluster already hosts `heuresys_platform` (711 tables, owner `heuresys`). The new `heuresys_advanced` DB is created **side‑by‑side**, never merged. Brownfield wave runs (post‑MVP) will `pg_dump` from `heuresys_platform`, transform staging rows, and upsert into `heuresys_advanced.sys.*` with lineage records — never `ALTER` the legacy DB.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `psql: connection refused` to `localhost:5433` | SSH tunnel not open | run `ssh -L 5433:localhost:5432 oracle-vm-default` |
| `psql: ERROR: password authentication failed for "heuresys"` | `.env` POSTGRES_PASSWORD mismatch | check `.env` against the password used by `heuresys_platform` (see `D:\evo.heuresys.com\services\api-gateway\.env`) |
| `permission denied to create database` | `heuresys` lacks `CREATEDB` | run `setup_oci_vm_database.sh` (grants `CREATEDB` via `ALTER ROLE`) |
| `validate_database.{ps1,sh}` reports a view failure | data invariant violated | inspect the failing view's rows and the upstream migration |
| `pg_dump` not found on Windows | client not installed | `winget install PostgreSQL.PostgreSQL.16` |
