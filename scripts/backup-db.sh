#!/usr/bin/env bash
#
# scripts/backup-db.sh — R5: scheduled pg_dump backup of the prod DB with retention.
#
# Before this the single live `heuresys_advanced` DB had ZERO scheduled backup — only
# manual pre-op snapshots in pg_dump_snapshots/ (3.7G, ad-hoc). This is a one-shot fired
# by heuresys-advanced-backup.timer (daily): `pg_dump -Fc` → timestamped file in
# BACKUP_DIR, prune files older than BACKUP_RETENTION_DAYS, optional off-host copy.
#
# Runs ON the VM as user `ubuntu` (sudo NOPASSWD → `sudo -u postgres` like clone-vm-db.sh).
# Off-host is OPT-IN (set BACKUP_OFFHOST_SSH=user@host:/path); without it the backup is
# local-with-retention only (still a huge step up from zero). A true off-host destination
# is an infra decision (twin/bucket) left to a later slice.
#
# Usage:  bash scripts/backup-db.sh
# Overridable env: DB_NAME BACKUP_DIR BACKUP_RETENTION_DAYS BACKUP_OFFHOST_SSH
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }

DB_NAME="${DB_NAME:-${POSTGRES_DB:-heuresys_advanced}}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/pg_dump_snapshots/scheduled}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/${DB_NAME}_${ts}.dump"

echo "[backup-db] pg_dump -Fc $DB_NAME -> $out"
# -Fc = custom format (compressed, pg_restore-able). postgres superuser so all objects dump.
sudo -u postgres pg_dump -Fc "$DB_NAME" > "$out"

# Fail loud on an empty/short dump (a silent 0-byte backup is worse than no backup).
if [ ! -s "$out" ] || [ "$(stat -c %s "$out")" -lt 1024 ]; then
  echo "[backup-db] ERROR: dump is empty/too small ($out) — removing and failing" >&2
  rm -f "$out"
  exit 1
fi
echo "[backup-db] ok: $out ($(du -h "$out" | cut -f1))"

# Retention: prune scheduled dumps older than N days (NEVER touches manual pre-op snapshots
# in the parent dir — scoped to BACKUP_DIR + the DB_NAME_*.dump pattern).
pruned="$(find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}_*.dump" -type f -mtime +"$RETENTION_DAYS" -print -delete | wc -l)"
echo "[backup-db] retention: kept <= ${RETENTION_DAYS}d, pruned $pruned old dump(s)"

# Off-host copy (opt-in). Best-effort: a failed off-host copy must NOT fail the local backup.
if [ -n "${BACKUP_OFFHOST_SSH:-}" ]; then
  if scp -o BatchMode=yes "$out" "$BACKUP_OFFHOST_SSH" 2>/dev/null; then
    echo "[backup-db] off-host copy ok -> $BACKUP_OFFHOST_SSH"
  else
    echo "[backup-db] WARNING: off-host scp to $BACKUP_OFFHOST_SSH failed (local backup retained)" >&2
  fi
fi

echo "[backup-db] done"
