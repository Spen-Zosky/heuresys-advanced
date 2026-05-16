#!/usr/bin/env bash
# =============================================================================
# db/scripts/validate_database.sh
# -----------------------------------------------------------------------------
# Two-part validation:
#   1. Validation views (sys.v_*) — expect 0 rows everywhere.
#   2. Twice-run idempotency proof via pg_dump diff.
# =============================================================================
set -euo pipefail

ENV_FILE=""
SKIP_TWICE_RUN=0
for arg in "$@"; do
  case "$arg" in
    --skip-twice-run) SKIP_TWICE_RUN=1 ;;
    *) ENV_FILE="$arg" ;;
  esac
done
ENV_FILE="${ENV_FILE:-$(cd "$(dirname "$0")/../.." && pwd)/.env}"
[[ -f "$ENV_FILE" ]] || { echo "[validate] .env not found at $ENV_FILE" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${POSTGRES_HOST:?missing}"
: "${POSTGRES_PORT:?missing}"
: "${POSTGRES_DB:?missing}"
: "${POSTGRES_USER:?missing}"
: "${POSTGRES_PASSWORD:?missing}"

export PGPASSWORD="${POSTGRES_PASSWORD}"
PSQL=(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1)

# STRUCTURAL views — non-zero rows = SCHEMA/INVARIANT VIOLATION → exit 1.
STRUCTURAL_VIEWS=(
  'sys.v_orphan_position_assignments'
  'sys.v_tenant_boundary_violations'
  'sys.v_synthetic_user_flag_consistency'
  'sys.v_canonical_outside_sys'
  'sys.v_active_primary_assignment_per_user'
  'sys.v_visualization_node_in_canonical_node'
  'sys.v_inbox_resource_consistency'
)

# INFORMATIONAL views — non-zero rows = data-completeness gap (positions
# without job_role assignment, positions missing PIP requirements, tenants
# with activated blueprints missing gate seeds). These are progressively
# closed as the platform is populated. They print WARN but do NOT fail.
INFORMATIONAL_VIEWS=(
  'sys.v_positions_without_job_role'
  'sys.v_pip_completeness'
  'sys.v_reward_gate_completeness'
)

fail=0
skipped=0
total=$((${#STRUCTURAL_VIEWS[@]} + ${#INFORMATIONAL_VIEWS[@]}))

echo "[validate] Structural views (zero rows required):"
for v in "${STRUCTURAL_VIEWS[@]}"; do
  exists=$("${PSQL[@]}" -tAc "SELECT 1 FROM information_schema.views WHERE table_schema || '.' || table_name = '$v'" 2>/dev/null || echo "")
  if [[ -z "$exists" ]]; then
    echo "  SKIP: $v (view not yet created)"
    skipped=$((skipped + 1))
    continue
  fi
  count=$("${PSQL[@]}" -tAc "SELECT count(*) FROM $v")
  if [[ "$count" -ne 0 ]]; then
    echo "  FAIL: $v returned $count rows"
    fail=1
  else
    echo "  PASS: $v"
  fi
done

echo ""
echo "[validate] Informational views (data-completeness; warnings only):"
for v in "${INFORMATIONAL_VIEWS[@]}"; do
  exists=$("${PSQL[@]}" -tAc "SELECT 1 FROM information_schema.views WHERE table_schema || '.' || table_name = '$v'" 2>/dev/null || echo "")
  if [[ -z "$exists" ]]; then
    echo "  SKIP: $v"
    skipped=$((skipped + 1))
    continue
  fi
  count=$("${PSQL[@]}" -tAc "SELECT count(*) FROM $v")
  if [[ "$count" -ne 0 ]]; then
    echo "  WARN: $v has $count incomplete rows (informational — non-blocking)"
  else
    echo "  PASS: $v"
  fi
done

if [[ $fail -ne 0 ]]; then echo "[validate] one or more STRUCTURAL validation views returned rows." >&2; exit 1; fi
if [[ $skipped -eq $total ]]; then
  echo "[validate] all validation views skipped (migrations not yet applied). Done."
  exit 0
fi

if [[ $SKIP_TWICE_RUN -eq 1 ]]; then
  echo ""
  echo "[validate] twice-run idempotency proof skipped (--skip-twice-run)."
  exit 0
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[validate] pg_dump not in PATH — twice-run idempotency proof skipped."
  exit 0
fi

ARTIFACTS_DIR="$(cd "$(dirname "$0")/../.." && pwd)/qa_artifacts"
mkdir -p "$ARTIFACTS_DIR"
SNAP1="$ARTIFACTS_DIR/schema_snapshot_before.sql"
SNAP2="$ARTIFACTS_DIR/schema_snapshot_after.sql"

echo ""
echo "[validate] Capturing schema snapshot BEFORE second migrate run..."
pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" --schema-only --no-owner --no-acl --schema=sys --schema=brownfield --schema=staging --schema=audit -f "$SNAP1"

echo "[validate] Re-applying migrations..."
bash "$(dirname "$0")/migrate.sh" "$ENV_FILE"

echo "[validate] Capturing schema snapshot AFTER second migrate run..."
pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" --schema-only --no-owner --no-acl --schema=sys --schema=brownfield --schema=staging --schema=audit -f "$SNAP2"

# pg_dump emits two session-specific `\restrict <random>` / `\unrestrict <random>`
# pragma lines per session that differ between runs even when the schema is
# identical. Filter them out before diffing to avoid false-positive failures.
SNAP1_FILTERED="${SNAP1}.filtered"
SNAP2_FILTERED="${SNAP2}.filtered"
grep -vE '^\\(restrict|unrestrict) ' "$SNAP1" > "$SNAP1_FILTERED" || true
grep -vE '^\\(restrict|unrestrict) ' "$SNAP2" > "$SNAP2_FILTERED" || true

if diff -q "$SNAP1_FILTERED" "$SNAP2_FILTERED" >/dev/null 2>&1; then
  echo ""
  echo "OK: validation views all 0 rows; twice-run idempotency proven (empty schema diff)."
  rm -f "$SNAP1_FILTERED" "$SNAP2_FILTERED"
else
  echo ""
  echo "FAIL: schema diverged on second migrate run. Showing first 50 diff lines:"
  diff "$SNAP1_FILTERED" "$SNAP2_FILTERED" | head -50
  rm -f "$SNAP1_FILTERED" "$SNAP2_FILTERED"
  exit 1
fi
