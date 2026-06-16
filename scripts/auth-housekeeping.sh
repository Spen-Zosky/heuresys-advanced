#!/usr/bin/env bash
#
# scripts/auth-housekeeping.sh — QW-C2 (S-100X-A4 / WS-C F-WS-C-4): recurring
# prune of the auth-audit tables so they don't grow unbounded. The one-time
# collapse was migration 000129; this is the daily guard that keeps it bounded.
#
# Fired by heuresys-advanced-auth-housekeeping.timer (daily). SAFE — never logs
# out a live session:
#   refresh_tokens: delete only revoked OR already-expired tokens (a token that
#     can no longer mint a session). Still-active, not-yet-expired tokens are
#     kept; the leak rows age out and are collected here once they expire.
#   login_events: retention window (default 180d) for the append-only audit.
#
# Runs ON the VM as the service user; reads DB coords from .env. Idempotent and
# safe to re-run (a 2nd immediate run deletes ~0).
#
# Usage:  bash scripts/auth-housekeeping.sh
# Overridable env: POSTGRES_* (from .env), LOGIN_EVENT_RETENTION_DAYS (default 180)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }

export PGPASSWORD="${POSTGRES_PASSWORD:-}"
RETENTION_DAYS="${LOGIN_EVENT_RETENTION_DAYS:-180}"
PSQL=(psql -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-heuresys}" -d "${POSTGRES_DB:-heuresys_advanced}" \
  -v ON_ERROR_STOP=1 -tA)

echo "[auth-housekeeping] pruning revoked/expired refresh-tokens + login-events older than ${RETENTION_DAYS}d"

rt="$("${PSQL[@]}" -c "WITH d AS (DELETE FROM sys.sys_auth_refresh_tokens WHERE auth_refresh_token_revoked_at IS NOT NULL OR auth_refresh_token_expires_at < now() RETURNING 1) SELECT count(*) FROM d;")"
le="$("${PSQL[@]}" -c "WITH d AS (DELETE FROM sys.sys_auth_login_events WHERE created_at < now() - make_interval(days => ${RETENTION_DAYS}) RETURNING 1) SELECT count(*) FROM d;")"

echo "[auth-housekeeping] deleted refresh_tokens=${rt} login_events=${le}"
echo "[auth-housekeeping] done"
