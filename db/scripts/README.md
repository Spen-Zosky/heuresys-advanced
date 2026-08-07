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
| `setup-ci-database.sh` | (Re)provision the isolated CI database `heuresys_ci` as a clone of PROD | on the runner | ✓ | ✓ (CI DB only) |
| `ci-rehearsal.sh` | **Prova generale della CI, prima del push** — vedi sotto | on the runner | ✓ | ✗ |

---

## `ci-rehearsal.sh` — provare la catena senza aspettare la CI

**Il problema che risolve.** `heuresys_ci` è un clone di produzione *congelato al provisioning*:
ha lo schema completo ma **non** i dati che arrivano da uno script di import. Una tabella creata
da migrazione e popolata da script è quindi **presente e vuota** su CI. Ogni post-condizione che
conta righe vede un numero in locale e uno zero là — verde qui, rossa in CI. In S1048 sono serviti
**tre giri di CI** (~25 minuti l'uno) per scoprire otto assert della stessa classe, due alla volta.

**Cosa fa.** Copia `heuresys_ci` con `createdb --template` (copia di file: 595 MB in ~3 s),
riapplica l'**intera** catena `db/migrations/*.sql` e interroga le sentinelle via
`docs/kb/tools/db_health.py`. È lo stesso passo *«Apply migrations (brings the clone to HEAD)»*
di `.github/workflows/test-integration.yml`, con lo stesso database e lo stesso ruolo non-superuser
— senza la coda dietro le altre cinque workflow. **L'originale non viene mai toccato**: la CI può
girare mentre la prova gira (e se `heuresys_ci` ha connessioni aperte, la prova si rifiuta di
partire invece di terminarle).

Ri-applicare una catena già applicata trova qualcosa perché **166 dei 277 file non trasformano il
database, lo controllano**: le post-condizioni rigirano tutte a ogni passata.

```bash
# dal PC Windows, in una riga
ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'

bash db/scripts/ci-rehearsal.sh --migrations-from 61f582b6^   # la catena com'era a quel commit
bash db/scripts/ci-rehearsal.sh --from-zero                   # modo severo, database vergine
bash db/scripts/ci-rehearsal.sh --keep                        # non distruggere il db di prova
```

**Misure reali (2026-08-07, linux-pc)** — catena a HEAD: **VERDE in 25,6 s**. Catena a
`f5d91b6a^`: **ROSSA in 7,5 s** con `B-50 assert: expected 3 defer tables … got 2`. Catena a
`61f582b6^`: **ROSSA in 7,5 s** con `WAVE2 assert: expected the 3 targets POPULATED … got 2`.
Sono esattamente i due difetti che in S1048 sono costati due giri di CI.

**Dove gira**: solo dove vive `heuresys_ci`, cioè `linux-pc` — che è anche la macchina su cui gira
la CI. Servono PostgreSQL 16, l'estensione `vector` e `sudo -u postgres` non interattivo. Su
Windows non gira: manca una credenziale superuser locale.

**Limite dichiarato**: `migrate.sh` usa `ON_ERROR_STOP`, quindi la prova mostra **il primo** assert
rotto, non tutti insieme. Non è un problema in pratica — un giro costa 7-26 s, quindi otto difetti
si scoprono in un paio di minuti invece che in tre giri di CI.

**`--from-zero`, e cosa ha rivelato**: su un database *vergine* la catena **non si applica** — si
ferma alla `000049_r2_assign_holderless_functional_roles.sql`, che pretende dati che nessuna
migrazione crea (`R2: expected >=4 active grants on the 4 holderless roles, got 0`). Cioè
l'ambiente non è ricostruibile dalle sole migrazioni. È un fatto architetturale misurato il
2026-08-07, non un difetto di questo script, e sta fuori dal mandato di #165.

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
