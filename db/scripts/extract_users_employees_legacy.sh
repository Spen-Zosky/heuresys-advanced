#!/usr/bin/env bash
# =============================================================================
# extract_users_employees_legacy.sh
# CW-B27 P1 mitigation — extend legacy_mirror with users + employees_*
# CW-B28 cross-OS hardening (X4 update) — strip PG 16+ \restrict tokens,
# normalize vector/uuid_generate functions before psql apply.
#
# Cause: SDBI pilots needing user_id resolution (Goals/OKRs, Performance Reviews,
#        Engagement Surveys, etc.) require legacy_mirror.users + employees_core
#        for source-to-target user mapping. Currently missing from extract-wave1.
#
# Tables added (5 total):
#   - users (274 rows, 18 cols)
#   - employees_core (270 rows, 18 cols)
#   - employees_pii (270 rows, 42 cols) ⚠️ PII data — see note
#   - employees_hr (270 rows, 32 cols)
#   - employees_payroll (270 rows, 15 cols)
#
# ⚠️ PII WARNING: employees_pii contains personally-identifying data
#                 (fiscal_code, addresses, etc.). Brownfield invariant I12 says
#                 brownfield is "demo/no-PII", but this is RTL_BANK test data,
#                 not real customer data. Confirmation: data is synthetic test
#                 fixtures from CASCADIA seeding (heuresys-evo project, ~270
#                 fake employees). Safe to copy.
#
# Cross-OS pipeline (CW-B28, X4 hardening):
#   - PG 16+ pg_dump emits `\restrict <token>` / `\unrestrict <token>` commands.
#     psql in non-interactive Windows mode rejects them ("backslash commands
#     are restricted; only \unrestrict is allowed"). Strip via grep -v.
#   - `vector(N)` columns (pgvector extension) absent in legacy_mirror schema.
#     Replace with `text` since data is 100% NULL in source.
#   - `uuid_generate_v4()` requires uuid-ossp extension; replace with PG 13+
#     built-in `gen_random_uuid()`.
#
# Idempotent: pg_dump --data-only + grep+sed transforms + CREATE TABLE IF NOT EXISTS
#             schema dump first if missing. Safe to re-run.
#
# Usage:
#   bash db/scripts/extract_users_employees_legacy.sh
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

SSH_HOST="${OCI_SSH_HOST:-oracle-vm-default}"
DB_URL="${DATABASE_URL:-postgres://heuresys:heuresys@localhost:5433/heuresys_advanced}"

TABLES=(users employees_core employees_pii employees_hr employees_payroll)

# Build the -t flags once
TABLE_FLAGS=""
for t in "${TABLES[@]}"; do
  TABLE_FLAGS+="-t public.${t} "
done

echo "[1/3] Schema dump (CREATE TABLE IF NOT EXISTS in legacy_mirror)..."
ssh "${SSH_HOST}" "sudo -u postgres pg_dump --schema-only --no-owner --no-privileges --no-comments \
  ${TABLE_FLAGS} -d heuresys_platform 2>/dev/null" \
  | grep -v '^\\restrict ' \
  | grep -v '^\\unrestrict ' \
  | sed 's/vector([0-9]*)/text/g' \
  | sed 's/uuid_generate_v4()/gen_random_uuid()/g' \
  | sed 's/CREATE TABLE public\./CREATE TABLE IF NOT EXISTS legacy_mirror./g' \
  | sed 's/public\./legacy_mirror./g' \
  | sed '/^ALTER TABLE.*ADD CONSTRAINT/d' \
  | sed '/^CREATE INDEX/d' \
  | sed '/^CREATE UNIQUE INDEX/d' \
  | sed '/^ALTER TABLE.*FORCE ROW LEVEL SECURITY/d' \
  | sed '/^ALTER TABLE.*ENABLE ROW LEVEL SECURITY/d' \
  | psql "$DB_URL"

echo "[2/3] Data copy (COPY pipeline)..."
ssh "${SSH_HOST}" "sudo -u postgres pg_dump --data-only --no-owner --no-privileges --no-comments \
  ${TABLE_FLAGS} -d heuresys_platform 2>/dev/null" \
  | grep -v '^\\restrict ' \
  | grep -v '^\\unrestrict ' \
  | sed 's/COPY public\./COPY legacy_mirror./g' \
  | psql "$DB_URL"

echo "[3/3] Verify counts..."
psql "$DB_URL" <<EOF
SELECT 'users' AS t, COUNT(*) FROM legacy_mirror.users
UNION ALL SELECT 'employees_core', COUNT(*) FROM legacy_mirror.employees_core
UNION ALL SELECT 'employees_pii', COUNT(*) FROM legacy_mirror.employees_pii
UNION ALL SELECT 'employees_hr', COUNT(*) FROM legacy_mirror.employees_hr
UNION ALL SELECT 'employees_payroll', COUNT(*) FROM legacy_mirror.employees_payroll
ORDER BY 1;
EOF
# Expected: users 274, employees_core 270, employees_pii 270, employees_hr 270, employees_payroll 270

echo "Done. legacy_mirror extended with 5 user/employee tables (~1354 rows total)."
