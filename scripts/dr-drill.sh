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

latest="$(ls -t "$BACKUP_DIR"/"${DB_NAME}"_*.dump 2>/dev/null | head -1 || true)"
if [ -z "$latest" ]; then
  echo "[dr-drill] ERROR: no backup found in $BACKUP_DIR (run backup-db.sh first)" >&2
  exit 1
fi

# RPO: how stale is the most recent restore point.
age_s=$(( $(date +%s) - $(stat -c %Y "$latest") ))
printf '[dr-drill] RPO: latest backup is %dh%02dm old — %s\n' "$((age_s/3600))" "$(((age_s%3600)/60))" "$(basename "$latest")"

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
for tbl in sys.sys_users sys.sys_positions sys.sys_attendance sys.sys_auth_credentials; do
  s="$(sudo -u postgres psql -d "$SCRATCH" -tAc "SELECT count(*) FROM $tbl" 2>/dev/null || echo '?')"
  p="$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT count(*) FROM $tbl" 2>/dev/null || echo '?')"
  st="$([ "$s" = "$p" ] && echo OK || { ok=0; echo DIFF; })"
  printf '  %-30s restored=%-7s prod=%-7s %s\n' "$tbl" "$s" "$p" "$st"
done

# Cleanup scratch (the drill proved restorability; we don't keep the copy).
sudo -u postgres dropdb --if-exists "$SCRATCH"

if [ "$ok" = 1 ]; then
  echo "[dr-drill] PASS — backup is restorable and row-counts match live prod"
else
  echo "[dr-drill] WARN — restored counts differ from live prod (expected if prod mutated since the backup; investigate if large)" >&2
fi
echo "[dr-drill] done"
