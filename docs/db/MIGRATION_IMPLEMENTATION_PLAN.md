# Migration Implementation Plan
## Heuresys Advanced — 27 Idempotent SQL Migrations (26 v5 + 1 ESS), Native PostgreSQL

> **Status:** Planning deliverable #3 of 10. Defines the migration content blueprint, idempotency contract, the local PostgreSQL setup scripts (PowerShell + Bash), the migration audit table, the twice‑run proof, and the seed reference bank generator.
> **Companion:** `TARGET_SCHEMA_DESIGN.md` (Deliverable 2) holds the table catalogue.
> **No Docker.** Runtime is native PostgreSQL per ADR‑0004; location deferred per ADR‑0010.

---

## 1. Idempotency Contract

Every migration is **safe to run on an empty DB**, **safe to re‑run on a populated DB**, and **never destructive on canonical objects**.

### 1.1 Allowed DDL patterns

| Pattern | Example |
|---------|---------|
| `CREATE SCHEMA IF NOT EXISTS` | `CREATE SCHEMA IF NOT EXISTS sys;` |
| `CREATE EXTENSION IF NOT EXISTS` | `CREATE EXTENSION IF NOT EXISTS pgcrypto;` |
| `CREATE TABLE IF NOT EXISTS` | `CREATE TABLE IF NOT EXISTS sys.sys_positions (...)` |
| `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` | `ALTER TABLE sys.sys_positions ADD COLUMN IF NOT EXISTS position_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;` |
| `CREATE [UNIQUE] INDEX IF NOT EXISTS` | `CREATE UNIQUE INDEX IF NOT EXISTS sys_users_tenant_email_uq ON sys.sys_users(...);` |
| `CREATE OR REPLACE VIEW` | `CREATE OR REPLACE VIEW sys.v_pip_completeness AS ...` |
| `CREATE OR REPLACE FUNCTION` | trigger functions |
| `INSERT ... ON CONFLICT DO NOTHING` | seed inserts |
| `INSERT ... ON CONFLICT (<nat_key>) DO UPDATE SET ...` | seed evolution where explicit |
| `DO $$ BEGIN ... CREATE TRIGGER ...; EXCEPTION WHEN duplicate_object THEN NULL; END $$;` | trigger creation (PostgreSQL has no `CREATE TRIGGER IF NOT EXISTS`) |

### 1.2 Forbidden patterns

| Pattern | Reason |
|---------|--------|
| `DROP TABLE` on `sys.*` | Destroys canonical data |
| `DROP SCHEMA sys` | Same |
| `TRUNCATE sys.*` | Same |
| `ALTER TABLE ... DROP COLUMN` (canonical columns) | Data loss; use a follow‑up migration with `IF EXISTS` guard and explicit user approval |
| `--no-transaction` | Every migration must run in a single transaction |

Auxiliary schemas (`staging`, `brownfield`, `audit`) allow `TRUNCATE` and `DROP` between runs (they hold transient/operational data).

### 1.3 Transaction model

Each migration file is wrapped in `BEGIN; ... COMMIT;`. The runner uses `psql -v ON_ERROR_STOP=1 -1 -f <file>` (the `-1` flag wraps the whole file in a single transaction; if any statement fails, nothing commits).

### 1.4 Migration audit table

The first canonical migration creates `sys.sys_schema_migrations`:

```sql
CREATE TABLE IF NOT EXISTS sys.sys_schema_migrations (
  migration_id   serial PRIMARY KEY,
  file_name      varchar(255) NOT NULL UNIQUE,
  sha256         char(64) NOT NULL,
  applied_at     timestamptz NOT NULL DEFAULT now(),
  applied_by     varchar(128) NOT NULL DEFAULT current_user,
  duration_ms    integer
);
```

Each migration ends with an idempotent `INSERT ... ON CONFLICT (file_name) DO UPDATE SET sha256 = EXCLUDED.sha256, applied_at = EXCLUDED.applied_at, applied_by = EXCLUDED.applied_by, duration_ms = EXCLUDED.duration_ms` so the audit reflects the latest apply.

---

## 2. Native PostgreSQL Setup Scripts

### 2.1 Connection contract — `.env`

```env
# --- Option A: localhost (Windows PC) — default for MVP-0/1 unless overridden ---
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=heuresys_advanced
POSTGRES_USER=heuresys
POSTGRES_PASSWORD=<dev_secret_here>
POSTGRES_SCHEMA=sys
POSTGRES_SSL=disable

# Superuser for setup (used only by db/scripts/create_local_database.* and reset_local_database.ps1)
POSTGRES_SUPERUSER=postgres
POSTGRES_SUPERUSER_PASSWORD=<superuser_secret_here>

# --- Option B: OCI VM oracle-vm-default via SSH tunnel ---
# POSTGRES_HOST=localhost
# POSTGRES_PORT=5433              # local end of `ssh -L 5433:localhost:5432 oracle-vm-default`
# POSTGRES_DB=heuresys_advanced
# POSTGRES_USER=heuresys
# POSTGRES_PASSWORD=<vm_secret>
# POSTGRES_SCHEMA=sys
# POSTGRES_SSL=disable

# --- Option C: OCI Managed PostgreSQL ---
# POSTGRES_HOST=<endpoint>.adb.eu-milan-1.oraclecloud.com
# POSTGRES_PORT=5432
# POSTGRES_DB=heuresys_advanced
# POSTGRES_USER=heuresys
# POSTGRES_PASSWORD=<managed_secret>
# POSTGRES_SCHEMA=sys
# POSTGRES_SSL=require
```

### 2.2 `db/scripts/create_local_database.ps1` (idempotent role + DB + schema)

```powershell
# db/scripts/create_local_database.ps1
# Creates the PostgreSQL role, database and canonical schema (sys + aux: brownfield, staging, audit).
# Idempotent: skips any object that already exists. Reads connection params from .env at repo root.

[CmdletBinding()]
param(
    [string]$EnvFile = "$PSScriptRoot\..\..\.env"
)

# Load .env (simple parser: KEY=VALUE lines, # comments)
if (-not (Test-Path $EnvFile)) {
    Write-Error ".env not found at $EnvFile. Copy .env.example and configure."
    exit 1
}
Get-Content $EnvFile | Where-Object { $_ -match "^\s*[A-Z_][A-Z0-9_]*\s*=" -and $_ -notmatch "^\s*#" } | ForEach-Object {
    $kv = $_ -split "=", 2
    Set-Item -Path "env:$($kv[0].Trim())" -Value $kv[1].Trim()
}

$superHost = $env:POSTGRES_HOST
$superPort = $env:POSTGRES_PORT
$super     = $env:POSTGRES_SUPERUSER
$superPwd  = $env:POSTGRES_SUPERUSER_PASSWORD
$db        = $env:POSTGRES_DB
$role      = $env:POSTGRES_USER
$rolePwd   = $env:POSTGRES_PASSWORD

$env:PGPASSWORD = $superPwd

$PsqlSuper = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
if (-not (Test-Path $PsqlSuper)) {
    $PsqlSuper = (Get-Command psql.exe -ErrorAction Stop).Source
}

function Invoke-PsqlAsSuper([string]$Sql) {
    & $PsqlSuper -h $superHost -p $superPort -U $super -d postgres -v ON_ERROR_STOP=1 -c $Sql
    if ($LASTEXITCODE -ne 0) { throw "psql failed: $Sql" }
}

# 1. Role (idempotent via DO block — CREATE ROLE has no IF NOT EXISTS)
$createRoleSql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$role') THEN
    CREATE ROLE $role WITH LOGIN PASSWORD '$rolePwd';
  END IF;
END
`$`$;
"@
Invoke-PsqlAsSuper $createRoleSql

# 2. Database (CREATE DATABASE cannot run inside DO block; check existence first)
$dbExists = & $PsqlSuper -h $superHost -p $superPort -U $super -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'"
if (-not $dbExists) {
    Invoke-PsqlAsSuper "CREATE DATABASE $db OWNER $role ENCODING 'UTF8' TEMPLATE template0;"
}

# 3. Schemas (sys + 3 auxiliary), idempotent
$schemaSql = @"
CREATE SCHEMA IF NOT EXISTS sys AUTHORIZATION $role;
CREATE SCHEMA IF NOT EXISTS staging AUTHORIZATION $role;
CREATE SCHEMA IF NOT EXISTS brownfield AUTHORIZATION $role;
CREATE SCHEMA IF NOT EXISTS audit AUTHORIZATION $role;
GRANT USAGE ON SCHEMA sys, staging, brownfield, audit TO $role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sys, staging, brownfield, audit
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $role;
"@
& $PsqlSuper -h $superHost -p $superPort -U $super -d $db -v ON_ERROR_STOP=1 -c $schemaSql
if ($LASTEXITCODE -ne 0) { throw "Schema creation failed." }

Write-Host "OK: role=$role, database=$db, schemas=(sys, staging, brownfield, audit)"
```

### 2.3 `db/scripts/create_local_database.sh` (Bash equivalent)

```bash
#!/usr/bin/env bash
# db/scripts/create_local_database.sh
# Idempotent native PostgreSQL setup. Reads .env at repo root.
set -euo pipefail

ENV_FILE="${1:-$(cd "$(dirname "$0")/../.." && pwd)/.env}"
[[ -f "$ENV_FILE" ]] || { echo "ERR: $ENV_FILE not found"; exit 1; }
set -a; source "$ENV_FILE"; set +a

export PGPASSWORD="${POSTGRES_SUPERUSER_PASSWORD}"

PSQL=(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_SUPERUSER" -v ON_ERROR_STOP=1)

# 1. Role (idempotent DO block)
"${PSQL[@]}" -d postgres -c "
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${POSTGRES_USER}') THEN
    CREATE ROLE ${POSTGRES_USER} WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
END
\$\$;
"

# 2. Database (cannot be wrapped in DO block)
EXISTS=$("${PSQL[@]}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'")
if [[ -z "$EXISTS" ]]; then
  "${PSQL[@]}" -d postgres -c "CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER} ENCODING 'UTF8' TEMPLATE template0;"
fi

# 3. Schemas
"${PSQL[@]}" -d "${POSTGRES_DB}" -c "
CREATE SCHEMA IF NOT EXISTS sys        AUTHORIZATION ${POSTGRES_USER};
CREATE SCHEMA IF NOT EXISTS staging    AUTHORIZATION ${POSTGRES_USER};
CREATE SCHEMA IF NOT EXISTS brownfield AUTHORIZATION ${POSTGRES_USER};
CREATE SCHEMA IF NOT EXISTS audit      AUTHORIZATION ${POSTGRES_USER};
GRANT USAGE ON SCHEMA sys, staging, brownfield, audit TO ${POSTGRES_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA sys, staging, brownfield, audit
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${POSTGRES_USER};
"

echo "OK: role=${POSTGRES_USER}, database=${POSTGRES_DB}, schemas=(sys, staging, brownfield, audit)"
```

### 2.4 `db/scripts/migrate.ps1` (applies migrations in order, audits each)

```powershell
# db/scripts/migrate.ps1
# Applies db/migrations/*.sql in lexical order against the database in .env.
# Records each apply in sys.sys_schema_migrations (idempotent).

[CmdletBinding()]
param(
    [string]$EnvFile = "$PSScriptRoot\..\..\.env",
    [string]$MigrationsDir = "$PSScriptRoot\..\migrations"
)

if (-not (Test-Path $EnvFile)) { Write-Error ".env missing"; exit 1 }
Get-Content $EnvFile | Where-Object { $_ -match "^\s*[A-Z_][A-Z0-9_]*\s*=" -and $_ -notmatch "^\s*#" } | ForEach-Object {
    $kv = $_ -split "=", 2
    Set-Item -Path "env:$($kv[0].Trim())" -Value $kv[1].Trim()
}

$env:PGPASSWORD = $env:POSTGRES_PASSWORD
$Psql = (Get-Command psql.exe -ErrorAction Stop).Source

$files = Get-ChildItem -Path $MigrationsDir -Filter "*.sql" | Sort-Object Name

foreach ($f in $files) {
    $start = Get-Date
    $sha = (Get-FileHash -Algorithm SHA256 $f.FullName).Hash.ToLower()
    Write-Host "[migrate] applying $($f.Name) (sha256=$($sha.Substring(0,12)))"

    & $Psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER -d $env:POSTGRES_DB -v ON_ERROR_STOP=1 -1 -f $f.FullName
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Migration $($f.Name) failed (exit $LASTEXITCODE)."
        exit 1
    }
    $duration = [int]((Get-Date) - $start).TotalMilliseconds

    # Audit record (idempotent upsert)
    $upsert = @"
INSERT INTO sys.sys_schema_migrations (file_name, sha256, applied_at, applied_by, duration_ms)
VALUES ('$($f.Name)', '$sha', now(), current_user, $duration)
ON CONFLICT (file_name) DO UPDATE
   SET sha256 = EXCLUDED.sha256,
       applied_at = EXCLUDED.applied_at,
       applied_by = EXCLUDED.applied_by,
       duration_ms = EXCLUDED.duration_ms;
"@
    & $Psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER -d $env:POSTGRES_DB -v ON_ERROR_STOP=1 -c $upsert | Out-Null
}

Write-Host "OK: $($files.Count) migrations applied."
```

### 2.5 `db/scripts/migrate.sh` (Bash equivalent)

```bash
#!/usr/bin/env bash
# db/scripts/migrate.sh
set -euo pipefail

ENV_FILE="${1:-$(cd "$(dirname "$0")/../.." && pwd)/.env}"
MIG_DIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
[[ -f "$ENV_FILE" ]] || { echo "ERR: $ENV_FILE not found"; exit 1; }
set -a; source "$ENV_FILE"; set +a
export PGPASSWORD="$POSTGRES_PASSWORD"
PSQL=(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1)

for f in "$MIG_DIR"/*.sql; do
  fname=$(basename "$f")
  sha=$(sha256sum "$f" | awk '{print $1}')
  echo "[migrate] applying $fname (sha256=${sha:0:12})"
  start_ms=$(date +%s%3N)
  "${PSQL[@]}" -1 -f "$f"
  end_ms=$(date +%s%3N)
  duration=$((end_ms - start_ms))
  "${PSQL[@]}" -c "INSERT INTO sys.sys_schema_migrations (file_name, sha256, applied_at, applied_by, duration_ms) VALUES ('$fname', '$sha', now(), current_user, $duration) ON CONFLICT (file_name) DO UPDATE SET sha256 = EXCLUDED.sha256, applied_at = EXCLUDED.applied_at, applied_by = EXCLUDED.applied_by, duration_ms = EXCLUDED.duration_ms;"
done

echo "OK: migrations applied."
```

### 2.6 `db/scripts/reset_local_database.ps1` (dev‑only, with confirmation prompt)

```powershell
# Destroys and recreates the database. Never run in production.
[CmdletBinding()]
param(
    [string]$EnvFile = "$PSScriptRoot\..\..\.env",
    [switch]$Force
)
# Load .env (omitted — same as create_local_database.ps1)
# ...
if (-not $Force) {
    $reply = Read-Host "This will DROP database '$env:POSTGRES_DB' and recreate it empty. Type 'yes' to continue"
    if ($reply -ne "yes") { Write-Host "Aborted."; exit 0 }
}
$env:PGPASSWORD = $env:POSTGRES_SUPERUSER_PASSWORD
$Psql = (Get-Command psql.exe).Source
& $Psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_SUPERUSER -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $($env:POSTGRES_DB);"
& "$PSScriptRoot\create_local_database.ps1" -EnvFile $EnvFile
Write-Host "OK: database reset to empty state."
```

### 2.7 `db/scripts/validate_database.ps1` (validation views + twice‑run proof)

```powershell
# db/scripts/validate_database.ps1
# 1. Runs all sys.v_* validation views; expects every count to be 0.
# 2. Captures pg_dump --schema-only snapshot, applies migrations again, captures again, diffs.

[CmdletBinding()]
param([string]$EnvFile = "$PSScriptRoot\..\..\.env")
# ... load .env (same pattern) ...

$env:PGPASSWORD = $env:POSTGRES_PASSWORD
$Psql   = (Get-Command psql.exe).Source
$PgDump = (Get-Command pg_dump.exe).Source

# Step 1: validation views
$views = @(
    'sys.v_orphan_position_assignments',
    'sys.v_tenant_boundary_violations',
    'sys.v_positions_without_job_role',
    'sys.v_pip_completeness',
    'sys.v_reward_gate_completeness',
    'sys.v_synthetic_user_flag_consistency',
    'sys.v_canonical_outside_sys',
    'sys.v_active_primary_assignment_per_user',
    'sys.v_visualization_node_in_canonical_node',
    'sys.v_inbox_resource_consistency'                  # ADR-0011 ESS
)
$fail = $false
foreach ($v in $views) {
    $count = & $Psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER -d $env:POSTGRES_DB -tAc "SELECT count(*) FROM $v"
    if ([int]$count -ne 0) { Write-Host "FAIL: $v returned $count rows."; $fail = $true }
    else { Write-Host "PASS: $v" }
}
if ($fail) { Write-Error "Validation views failed."; exit 1 }

# Step 2: twice-run idempotency proof
$snap1 = "$PSScriptRoot\..\..\qa_artifacts\schema_snapshot_before.sql"
$snap2 = "$PSScriptRoot\..\..\qa_artifacts\schema_snapshot_after.sql"
New-Item -ItemType Directory -Force -Path (Split-Path $snap1) | Out-Null

& $PgDump -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER -d $env:POSTGRES_DB --schema-only --no-owner --no-acl --schema=sys --schema=brownfield --schema=staging --schema=audit -f $snap1
& "$PSScriptRoot\migrate.ps1" -EnvFile $EnvFile     # apply all migrations again
& $PgDump -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER -d $env:POSTGRES_DB --schema-only --no-owner --no-acl --schema=sys --schema=brownfield --schema=staging --schema=audit -f $snap2

$diff = Compare-Object (Get-Content $snap1) (Get-Content $snap2)
if ($diff) {
    Write-Host "FAIL: schema diverged on second migrate run."
    $diff | Select-Object -First 50 | Format-Table -AutoSize
    exit 1
}
Write-Host "OK: twice-run idempotency proven (empty diff)."
```

A Bash version `validate_database.sh` mirrors the same logic (use `diff` and `sort` for snapshot comparison).

---

## 3. Per‑File Migration Content Map

Each entry below is a blueprint, not the final SQL. Final DDL details (column types, index names) may be refined in implementation per the freedom clause of `TARGET_SCHEMA_DESIGN.md` §18.

| # | File | Schemas | Objects created | Key FKs | Notes |
|---|------|---------|-----------------|---------|-------|
| 000001 | `init_extensions.sql` | (no schema) | `CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS pg_trgm;` | — | Idempotent extensions |
| 000002 | `init_sys_schema.sql` | `sys`, `staging`, `brownfield`, `audit` | All 4 schemas. Trigger function `sys.sys_set_updated_at()`. Audit table `sys.sys_schema_migrations`. | — | Bootstraps the migration audit |
| 000003 | `tenancies.sql` | `sys` | `sys.sys_tenancies` + unique index on `tenant_code` + status index | — | No FK out |
| 000004 | `users.sql` | `sys` | `sys.sys_users` + unique `(tenant_id, lower(email))` + status index | `user_tenant_id → sys_tenancies` | The canonical tenant FK |
| 000005 | `auth_foundation.sql` | `sys` | 11 auth tables (see `TARGET_SCHEMA_DESIGN.md` §1.3) + role catalog seed (8 roles), permission catalog seed | All auth FKs to `sys_users` and `sys_tenancies` | Seeds 8 roles via `ON CONFLICT DO NOTHING` |
| 000006 | `user_profiles_and_evidence.sql` | `sys` | 10 profile/evidence tables | All FKs to `sys_users` and `sys_tenancies` | Documents store URIs only, never blobs |
| 000007 | `enterprise_typing.sql` | `sys` | 5 enterprise typing tables | activity classification → ATECO/NACE seed in 000021 | |
| 000008 | `blueprint_catalog.sql` | `sys` | 5 blueprint tables (families, variants, process registry, activations, overrides) | `blueprint_variant_family_id → blueprint_families` | Seeds FIN_BANKING family + REGIONAL_RETAIL_BANK_MEDIUM variant + 23 processes in 000021 |
| 000009 | `organization_model.sql` | `sys` | 5 org tables (org units, unit types, branches, hierarchies, history) | `organization_unit_tenant_id`, `branch_organization_unit_id` | Hierarchies via closure table for O(log n) ancestor queries |
| 000010 | `job_role_model.sql` | `sys` | 3 job role tables (families, roles, ESCO occupation mappings) | `job_role_family_id` | |
| 000011 | `position_model.sql` | `sys` | `sys_positions` + 6 PIP base requirement tables + PIP view | All `position_*_id` FKs | Includes `sys.sys_position_intelligence_profiles_v` view |
| 000012 | `user_position_assignments.sql` | `sys` | `sys_user_position_assignments` + indexes + partial unique (one ACTIVE PRIMARY per user) | `user_position_assignment_user_id`, `_position_id`, `_tenant_id` | Partial unique enforces invariant I1 |
| 000013 | `skill_taxonomy_model.sql` | `sys` | 6 skill catalog tables | `skill_family_id`, `skill_category_id` | Seeds proficiency levels (NOVICE..MASTER) in 000021 |
| 000014 | `position_skill_requirements.sql` | `sys` | `sys_position_skill_requirements` + history table | `psr_position_id → sys_positions`, `psr_skill_id → sys_skills` | |
| 000015 | `kpi_model.sql` | `sys` | 10 KPI tables (definitions, metrics, templates, targets, measurements, assessment methods, weighting rules, results) | Cross‑refs to position, user, org unit | |
| 000016 | `learning_model.sql` | `sys` | 10 learning + gap closure tables | Cross‑refs to skill, position, user, training initiative | |
| 000017 | `assessment_gap_model.sql` | `sys` | 10 assessment + gap + readiness tables | Cross‑refs to position, user, skill, kpi | Gap closure FKs to `sys_learning_assignments` |
| 000018 | `career_succession_model.sql` | `sys` | 10 career + succession tables | Cross‑refs to position, user | |
| 000019 | `compensation_intelligence_model.sql` | `sys` | 12 compensation + reward gate tables | Cross‑refs to position, user, period | Seeds 7 FIN_BANKING gates in 000021 |
| 000020 | `seed_acquisition_staging.sql` | `sys` (+ `staging` if needed) | 5 staging tables (runs, candidates, evidence, validation, approval) | Self‑refs; FK to `sys_users` for approver | Uses natural keys per `IDEMPOTENT_SEEDING_RULES.md` |
| 000021 | `seed_reference_bank.sql` | `sys` | Idempotent INSERTs: ATECO/NACE catalog, ESCO sample, FIN_BANKING blueprint, RTL_BANK_REFERENCE tenant, 5 branches, 25 branch positions, ~30 HQ positions, 158 synthetic users + assignments, 7 reward gates | Many | `ON CONFLICT DO NOTHING` everywhere |
| 000022 | `visualization_graph_model.sql` | `sys` | 7 visualization tables (incl. `sys_visualization_node_layouts` per ADR‑0009) | Cross‑refs to source entities (polymorphic via `source_entity_type/id`) | |
| 000023 | `validation_views_and_checks.sql` | `sys` | 9 validation views (see `TARGET_SCHEMA_DESIGN.md` §14) | — | Read‑only; expected to return 0 rows on healthy DB |
| 000024 | `brownfield_import_staging.sql` | `brownfield`, `audit` | `brownfield.source_exports`, `source_tables`, `source_columns`, `import_runs`; `audit.import_run_logs` | Self‑refs | Aux schemas; never touches `sys` |
| 000025 | `brownfield_lineage_and_mapping.sql` | `brownfield`, `sys` | `brownfield.table_mappings`, `column_mappings`; `sys.sys_source_lineage_records` (canonical lineage table) | `lineage_target_record_id` is polymorphic + `target_table_name` | The single canonical artifact in `sys` for brownfield provenance |
| 000026 | `brownfield_import_validation.sql` | `audit` | `audit.import_validation_results`, `audit.import_approval_decisions` | FKs to `import_runs`, `candidate_records` | Approval gates pre‑upsert |
| **000027** | **`ess_inbox_and_audit.sql`** (ADR‑0011 ESS) | `sys`, `audit` | `sys.sys_inbox_notifications` (+ 3 indices + CHECK on `notification_type`, `notification_priority`, `notification_status`) · `audit.user_self_service_actions` (+ 4 indices + CHECK on `action_type`) · extends `sys.v_inbox_resource_consistency` view (replaced via `CREATE OR REPLACE VIEW` — definition was created in 000023 placeholder, completed here once all polymorphic FK targets exist) | `notification_user_id → sys_users`, `notification_tenant_id → sys_tenancies`, `action_user_id → sys_users`, `action_tenant_id → sys_tenancies` | New migration introduced by ADR‑0011 (ESS inclusion). Runs **last** in the sequence so that every polymorphic `notification_resource_type` target (POSITION, LEARNING_MODULE, ASSESSMENT, CAREER_TARGET, KPI, SKILL) is already a created canonical table. |

---

## 4. Validation Queries (Migration 000023)

Each view returns rows representing violations. On a healthy DB every view returns zero rows.

```sql
CREATE OR REPLACE VIEW sys.v_orphan_position_assignments AS
SELECT a.user_position_assignment_id
FROM sys.sys_user_position_assignments a
LEFT JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
LEFT JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
WHERE u.user_id IS NULL OR p.position_id IS NULL;

CREATE OR REPLACE VIEW sys.v_tenant_boundary_violations AS
SELECT a.user_position_assignment_id, a.user_position_assignment_tenant_id AS assignment_tenant,
       u.user_tenant_id AS user_tenant, p.position_tenant_id AS position_tenant
FROM sys.sys_user_position_assignments a
JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
WHERE a.user_position_assignment_tenant_id <> u.user_tenant_id
   OR a.user_position_assignment_tenant_id <> p.position_tenant_id;

CREATE OR REPLACE VIEW sys.v_positions_without_job_role AS
SELECT position_id, position_code, position_title
FROM sys.sys_positions
WHERE position_job_role_id IS NULL;

CREATE OR REPLACE VIEW sys.v_pip_completeness AS
SELECT p.position_id, p.position_code,
       (SELECT count(*) FROM sys.sys_position_skill_requirements WHERE position_id = p.position_id) AS skills_n,
       (SELECT count(*) FROM sys.sys_position_kpi_requirements WHERE position_id = p.position_id) AS kpis_n,
       (SELECT count(*) FROM sys.sys_position_learning_requirements WHERE position_id = p.position_id) AS learning_n
FROM sys.sys_positions p
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_position_skill_requirements WHERE position_id = p.position_id);
-- Violation: a position has no required skills.

CREATE OR REPLACE VIEW sys.v_synthetic_user_flag_consistency AS
SELECT user_id, user_type, user_is_synthetic
FROM sys.sys_users
WHERE (user_type = 'SYNTHETIC_REFERENCE' AND user_is_synthetic = false)
   OR (user_type <> 'SYNTHETIC_REFERENCE' AND user_is_synthetic = true);

CREATE OR REPLACE VIEW sys.v_canonical_outside_sys AS
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name LIKE 'sys_%' AND table_schema NOT IN ('sys');
-- Violation: a canonical-named table escaped the sys schema.

CREATE OR REPLACE VIEW sys.v_active_primary_assignment_per_user AS
SELECT user_position_assignment_user_id, count(*) AS n_active_primary
FROM sys.sys_user_position_assignments
WHERE user_position_assignment_kind = 'PRIMARY' AND user_position_assignment_status = 'ACTIVE'
GROUP BY user_position_assignment_user_id
HAVING count(*) > 1;

CREATE OR REPLACE VIEW sys.v_visualization_node_in_canonical_node AS
SELECT n.node_id, n.node_source_entity_type, n.node_source_entity_id
FROM sys.sys_visualization_nodes n
WHERE
  (n.node_source_entity_type = 'POSITION' AND NOT EXISTS (SELECT 1 FROM sys.sys_positions WHERE position_id = n.node_source_entity_id))
  OR
  (n.node_source_entity_type = 'USER' AND NOT EXISTS (SELECT 1 FROM sys.sys_users WHERE user_id = n.node_source_entity_id))
  OR
  (n.node_source_entity_type = 'SKILL' AND NOT EXISTS (SELECT 1 FROM sys.sys_skills WHERE skill_id = n.node_source_entity_id));

-- Inbox notifications polymorphic FK consistency (ADR-0011 ESS).
-- The view is declared empty in 000023 (sys.sys_inbox_notifications does not exist yet);
-- it is replaced (CREATE OR REPLACE) in 000027 with the full body below once the table is created.
CREATE OR REPLACE VIEW sys.v_inbox_resource_consistency AS
SELECT n.notification_id, n.notification_resource_type, n.notification_resource_id
FROM sys.sys_inbox_notifications n
WHERE n.notification_resource_id IS NOT NULL
  AND (
    (n.notification_resource_type = 'POSITION' AND NOT EXISTS
      (SELECT 1 FROM sys.sys_positions WHERE position_id = n.notification_resource_id))
    OR
    (n.notification_resource_type = 'LEARNING_MODULE' AND NOT EXISTS
      (SELECT 1 FROM sys.sys_learning_modules WHERE learning_module_id = n.notification_resource_id))
    OR
    (n.notification_resource_type = 'ASSESSMENT' AND NOT EXISTS
      (SELECT 1 FROM sys.sys_assessments WHERE assessment_id = n.notification_resource_id))
    OR
    (n.notification_resource_type = 'CAREER_TARGET' AND NOT EXISTS
      (SELECT 1 FROM sys.sys_user_target_positions WHERE user_target_position_id = n.notification_resource_id))
    OR
    (n.notification_resource_type = 'KPI' AND NOT EXISTS
      (SELECT 1 FROM sys.sys_kpi_definitions WHERE kpi_definition_id = n.notification_resource_id))
    OR
    (n.notification_resource_type = 'SKILL' AND NOT EXISTS
      (SELECT 1 FROM sys.sys_skills WHERE skill_id = n.notification_resource_id))
  );

CREATE OR REPLACE VIEW sys.v_reward_gate_completeness AS
SELECT t.tenant_id, t.tenant_code, ba.blueprint_variant_id,
       count(*) FILTER (WHERE g.reward_gate_catalog_id IS NULL) AS missing_gates
FROM sys.sys_tenancies t
JOIN sys.sys_blueprint_activations ba ON ba.tenant_id = t.tenant_id
LEFT JOIN sys.sys_reward_gate_catalog g ON g.blueprint_variant_id = ba.blueprint_variant_id
GROUP BY t.tenant_id, t.tenant_code, ba.blueprint_variant_id
HAVING count(*) FILTER (WHERE g.reward_gate_catalog_id IS NULL) > 0;
```

---

## 5. Twice‑Run Idempotency Proof

The proof is run by `db/scripts/validate_database.ps1` and consists of:

1. Apply migrations once (already done in normal flow).
2. `pg_dump --schema-only --no-owner --no-acl --schema=sys --schema=staging --schema=brownfield --schema=audit -f qa_artifacts/schema_snapshot_before.sql`.
3. Apply migrations a second time via `migrate.ps1`.
4. `pg_dump` again into `qa_artifacts/schema_snapshot_after.sql`.
5. `Compare-Object` (PowerShell) or `diff` (Bash). Empty diff = PASS.

This proves both:

- No `CREATE TABLE` rerun produced an error (idempotency contract honored).
- No DDL was duplicated / drifted between runs.

A failure (non‑empty diff) blocks Section 19.5 (acceptance test A3).

---

## 6. Seed Reference Bank (`RTL_BANK_REFERENCE`)

### 6.1 Generator: `db/scripts/seed-reference-bank.ts`

Driven by Drizzle ORM + `@faker-js/faker` with a fixed seed. The script:

1. Loads `.env`.
2. Connects via `pg` Pool (Drizzle wrapper).
3. Reads a deterministic seed from `SEED_REFERENCE_BANK_SEED` env var (default `42`).
4. Inserts (idempotently via `ON CONFLICT DO NOTHING`):
   - 1 tenancy `RTL_BANK_REFERENCE`.
   - 5 branches (`BRANCH_01..BRANCH_05`).
   - 25 branch positions (5 per branch: `Branch Manager`, `Senior Teller`, `Teller`, `Customer Advisor`, `Operations Officer`).
   - ~30 HQ positions (Risk Manager, Compliance Officer, AML Officer, HR Director, etc.).
   - 158 users with `user_is_synthetic = true`, `user_type = 'SYNTHETIC_REFERENCE'`, deterministic names from Faker.
   - 158 PRIMARY active assignments (each user → one position).
   - Seed `sys.sys_reward_gate_catalog` for FIN_BANKING (7 gates).
   - Seed `sys.sys_blueprint_families` / `sys.sys_blueprint_variants` / `sys.sys_blueprint_activations` for FIN_BANKING/REGIONAL_RETAIL_BANK_MEDIUM.
5. Logs counts; never deletes; safe to re‑run.

### 6.2 SQL fallback: `db/seeds/seed_reference_bank.sql`

The same seeds expressed as raw SQL `INSERT ... ON CONFLICT DO NOTHING`. Used when Node isn't available (e.g. operator running `psql -f`).

### 6.3 Acceptance criteria

```sql
SELECT count(*) FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK_REFERENCE';
-- = 1

SELECT count(*) FROM sys.sys_branches
WHERE branch_organization_unit_id IN (
  SELECT organization_unit_id FROM sys.sys_organization_units
  WHERE organization_unit_tenant_id = (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK_REFERENCE')
    AND organization_unit_type = 'BRANCH'
);
-- = 5

SELECT count(*) FROM sys.sys_positions
WHERE position_tenant_id = (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK_REFERENCE');
-- = ~55 (25 branch + 30 HQ)

SELECT count(*) FROM sys.sys_users
WHERE user_tenant_id = (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK_REFERENCE')
  AND user_is_synthetic = true;
-- = 158

SELECT count(*) FROM sys.sys_user_position_assignments a
JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
WHERE u.user_tenant_id = (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK_REFERENCE')
  AND a.user_position_assignment_kind = 'PRIMARY' AND a.user_position_assignment_status = 'ACTIVE';
-- = 158

SELECT count(*) FROM sys.sys_reward_gate_catalog
WHERE blueprint_variant_id = (SELECT blueprint_variant_id FROM sys.sys_blueprint_variants WHERE blueprint_variant_code = 'REGIONAL_RETAIL_BANK_MEDIUM');
-- = 7
```

---

## 7. Auxiliary Schemas Ownership

Migration 000002 establishes:

```sql
CREATE SCHEMA IF NOT EXISTS sys        AUTHORIZATION heuresys;
CREATE SCHEMA IF NOT EXISTS staging    AUTHORIZATION heuresys;
CREATE SCHEMA IF NOT EXISTS brownfield AUTHORIZATION heuresys;
CREATE SCHEMA IF NOT EXISTS audit      AUTHORIZATION heuresys;
```

All four schemas owned by `heuresys`. The `apps/api` runtime connects as `heuresys` and has full DML on `sys`, plus `INSERT/UPDATE/SELECT` on `audit` for log writes. `brownfield` and `staging` are operated by `db/scripts/` and the seed acquisition / brownfield import pipelines (also as `heuresys`).

If multi‑role separation is required later, dedicated roles can be added:

- `heuresys_app` — runtime, SELECT/INSERT/UPDATE/DELETE on `sys`, INSERT on `audit`.
- `heuresys_migrator` — DDL on all schemas (used by `migrate.ps1`).

This split is out of MVP scope.

---

## 8. Run Order Cheat Sheet

```text
# First-time setup (one-time per developer)
1. Install PostgreSQL 16 natively (per OS docs).
2. Copy .env.example to .env, fill credentials.
3. pnpm install            (workspaces ready)

# Bootstrap (per developer, repeatable)
4. ./db/scripts/create_local_database.ps1           # or .sh
5. ./db/scripts/migrate.ps1                         # apply 000001..000027 (000001-000026 legacy v5 + 000027 ESS per ADR-0011)
6. ./db/scripts/validate_database.ps1               # views + twice-run proof
7. pnpm db:seed                                     # runs db/scripts/seed-reference-bank.ts

# Daily dev cycle
- After every new migration in db/migrations/, run ./db/scripts/migrate.ps1
- After data‑level changes, re‑seed if needed.
```

---

## 9. Cross‑Platform Notes

- **Windows PowerShell 5.1:** scripts use absolute path discovery for `psql.exe` and `pg_dump.exe` (looks in `C:\Program Files\PostgreSQL\16\bin\` then PATH). Per the user's CLAUDE.md regola 7.
- **Git Bash on Windows:** `db/scripts/*.sh` work in Git Bash with PATH including the PostgreSQL `bin/`.
- **macOS / Linux:** `db/scripts/*.sh` work natively.
- **Path separators in `.env`:** none required; values are plain strings.

---

## 10. Risk Mitigation Notes

| Risk | Mitigation |
|------|------------|
| `CREATE TYPE` (ENUM) — no `IF NOT EXISTS` until PG 17 | **Not applicable**: per Q‑R2 (Review #3) we chose `varchar(N) + CHECK` over ENUM types. No PostgreSQL ENUM is created in any migration. If a future migration ever needs an ENUM (e.g. for a 3rd‑party tool), wrap in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`. |
| `CHECK` constraints — `ADD CONSTRAINT` is not idempotent | Use the `DROP CONSTRAINT IF EXISTS ... ; ADD CONSTRAINT ...` pattern documented in `TARGET_SCHEMA_DESIGN.md` §0.6. Both statements wrapped in the migration's transaction. |
| `CREATE TRIGGER` — no `IF NOT EXISTS` | Same `DO` block wrapper |
| Drift in column ordering between human SQL and `pg_dump` output | `pg_dump --no-owner --no-acl` normalizes; only structural differences flagged |
| Long‑running migration on a populated DB (post‑MVP) | Per‑migration timing recorded in `sys_schema_migrations.duration_ms`; alert if > 30s |
| Constraint name collisions between dev and CI | Use prefix `<table>_<col>_<suffix>`; document in `TARGET_SCHEMA_DESIGN.md` |

---

## 11. Verification Checklist

- [x] Idempotency contract documented (§1)
- [x] Native setup scripts present in plan (§2): PowerShell + Bash for create / migrate / reset / validate
- [x] Audit table `sys_schema_migrations` design (§1.4)
- [x] Per‑file content map covers all 27 migrations (§3) — 26 legacy v5 + 1 new 000027 ESS (ADR‑0011)
- [x] Validation views covered (§4)
- [x] Twice‑run idempotency proof procedure (§5)
- [x] Seed reference bank generator (§6)
- [x] Auxiliary schemas defined (§7)
- [x] No Docker references on canonical path
- [x] Aligned with ADR‑0003 (Drizzle + raw SQL) and ADR‑0004 (no Docker)
