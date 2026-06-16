#!/usr/bin/env bash
#
# scripts/dr-drill.sh — 3.7: disaster-recovery drill. A backup never restored is not a
# backup. Restores the LATEST scheduled backup (from backup-db.sh / R5) into a scratch DB,
# verifies row-counts against live prod, and reports RPO (backup age) + RTO (restore time).
# Drops the scratch DB at the end. Non-destructive to prod (separate scratch DB).
#
# Runs ON the VM as `ubuntu` (sudo NOPASSWD → sudo -u postgres). Reuses the verify pattern
# of clone-vm-db.sh. Run on demand:  bash scripts/dr-drill.sh
# Overridable env: DB_NAME SCRATCH_DB BACKUP_DIR
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }

DB_NAME="${DB_NAME:-${POSTGRES_DB:-heuresys_advanced}}"
SCRATCH="${SCRATCH_DB:-${DB_NAME}_drdrill}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/pg_dump_snapshots/scheduled}"
# QW-C3: strict mode (used by the weekly systemd timer) turns REAL DR failures
# into a non-zero exit so systemd marks the unit failed (= the alert). A benign
# row-count drift (prod mutated since the backup) stays a WARN, never an alert.
STRICT="${DR_DRILL_STRICT:-0}"
MAX_RPO_HOURS="${DR_DRILL_MAX_RPO_HOURS:-48}"
fail=0

latest="$(ls -t "$BACKUP_DIR"/"${DB_NAME}"_*.dump 2>/dev/null | head -1 || true)"
if [ -z "$latest" ]; then
  echo "[dr-drill] ERROR: no backup found in $BACKUP_DIR (run backup-db.sh first)" >&2
  exit 1
fi

# RPO: how stale is the most recent restore point.
age_s=$(( $(date +%s) - $(stat -c %Y "$latest") ))
printf '[dr-drill] RPO: latest backup is %dh%02dm old — %s\n' "$((age_s/3600))" "$(((age_s%3600)/60))" "$(basename "$latest")"
if [ "$age_s" -gt $(( MAX_RPO_HOURS * 3600 )) ]; then
  echo "[dr-drill] WARN: RPO exceeds ${MAX_RPO_HOURS}h — the daily backup timer may not be running" >&2
  fail=1
fi

# RTO: time to a usable restored DB.
echo "[dr-drill] restoring into scratch DB '$SCRATCH' ..."
sudo -u postgres dropdb --if-exists "$SCRATCH"
sudo -u postgres createdb "$SCRATCH"
t0=$(date +%s)
# --no-owner/--no-acl: scratch restore need not reproduce grants; benign notices ignored.
sudo -u postgres pg_restore --no-owner --no-acl -d "$SCRATCH" "$latest" >/dev/null 2>&1 || true
t1=$(date +%s)
printf '[dr-drill] RTO: restore completed in %ds\n' "$((t1-t0))"

# Integrity: row-counts scratch (restored) vs prod (live).
echo "[dr-drill] integrity check (restored vs live prod):"
ok=1
broken=0
for tbl in sys.sys_users sys.sys_positions sys.sys_attendance sys.sys_auth_credentials; do
  s="$(sudo -u postgres psql -d "$SCRATCH" -tAc "SELECT count(*) FROM $tbl" 2>/dev/null || echo '?')"
  p="$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT count(*) FROM $tbl" 2>/dev/null || echo '?')"
  # NB: assign ok=0 OUTSIDE a $()-subshell — the previous `st="$(… ok=0 …)"` set
  # ok=0 only inside the command-substitution subshell, so the parent ok stayed 1
  # and the drill printed PASS even on DIFF (pre-existing bug, found S993 by the
  # strict-mode end-to-end run). The strict `broken`/`fail` flags were already
  # outside the subshell, so STRICT FAIL was correct; this fixes the PASS/WARN line.
  if [ "$s" = "$p" ]; then st=OK; else st=DIFF; ok=0; fi
  # A restore that didn't bring the table at all ('?' / empty-while-prod-has-rows)
  # is a HARD failure, distinct from a benign post-backup drift.
  if [ "$s" = "?" ] || { [ "$s" = "0" ] && [ "$p" != "0" ] && [ "$p" != "?" ]; }; then broken=1; fi
  printf '  %-30s restored=%-7s prod=%-7s %s\n' "$tbl" "$s" "$p" "$st"
done
[ "$broken" = 1 ] && fail=1

# Cleanup scratch (the drill proved restorability; we don't keep the copy).
sudo -u postgres dropdb --if-exists "$SCRATCH"

if [ "$ok" = 1 ]; then
  echo "[dr-drill] PASS — backup is restorable and row-counts match live prod"
else
  echo "[dr-drill] WARN — restored counts differ from live prod (expected if prod mutated since the backup; investigate if large)" >&2
fi
echo "[dr-drill] done"

# QW-C3 strict mode (weekly timer): exit non-zero ONLY on real DR failures
# (no backup / RPO too old / restore did not bring the data) so systemd raises
# the alert. A benign row-count drift alone never fails the drill.
if [ "$STRICT" = 1 ] && [ "$fail" = 1 ]; then
  echo "[dr-drill] STRICT FAIL — DR problem detected (stale RPO or broken restore)" >&2
  exit 1
fi
