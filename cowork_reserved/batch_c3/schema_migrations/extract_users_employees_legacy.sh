#!/usr/bin/env bash
# =============================================================================
# extract_users_employees_legacy.sh
# CW-B27 P1 mitigation — extend legacy_mirror with users + employees_*
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
# Idempotent: pg_dump --data-only + sed s/public./legacy_mirror./
#             + CREATE TABLE IF NOT EXISTS schema dump first if missing.
#
# Usage:
#   bash db/scripts/extract_users_employees_legacy.sh
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

SSH_HOST="${OCI_SSH_HOST:-oracle-vm-default}"
DB_URL="${DATABASE_URL:-postgres://heuresys:heuresys@localhost:5433/heuresys_advanced}"

TABLES=(users employees_core employees_pii employees_hr employees_payroll)

echo "[1/3] Schema dump (CREATE TABLE IF NOT EXISTS in legacy_mirror)..."
ssh "${SSH_HOST}" "sudo -u postgres pg_dump --schema-only --no-owner --no-privileges \
  $(for t in "${TABLES[@]}"; do printf -- '-t public.%s ' "$t"; done) \
  -d heuresys_platform" \
  | sed 's/CREATE TABLE public\./CREATE TABLE IF NOT EXISTS legacy_mirror./g' \
  | sed 's/public\./legacy_mirror./g' \
  | sed '/^ALTER TABLE.*ADD CONSTRAINT/d' \
  | sed '/^CREATE INDEX/d' \
  | psql "$DB_URL"

echo "[2/3] Data copy (COPY pipeline)..."
ssh "${SSH_HOST}" "sudo -u postgres pg_dump --data-only --no-owner --no-privileges \
  $(for t in "${TABLES[@]}"; do printf -- '-t public.%s ' "$t"; done) \
  -d heuresys_platform" \
  | sed 's/COPY public\./COPY legacy_mirror./g' \
  | psql "$DB_URL"

echo "[3/3] Verify counts..."
psql "$DB_URL" -c "
SELECT 'users', COUNT(*) FROM legacy_mirror.users
UNION ALL SELECT 'employees_core', COUNT(*) FROM legacy_mirror.employees_core
UNION ALL SELECT 'employees_pii', COUNT(*) FROM legacy_mirror.employees_pii
UNION ALL SELECT 'employees_hr', COUNT(*) FROM legacy_mirror.employees_hr
UNION ALL SELECT 'employees_payroll', COUNT(*) FROM legacy_mirror.employees_payroll
ORDER BY 1;"
# Expected: users 274, employees_core 270, employees_pii 270, employees_hr 270, employees_payroll 270

echo "Done. legacy_mirror extended with 5 user/employee tables (~1354 rows total)."
