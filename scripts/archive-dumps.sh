#!/usr/bin/env bash
#
# scripts/archive-dumps.sh — QW-K3: off-machine archival of the pre-op pg_dump
# snapshots to the OCI VM.
#
# WHY: pg_dump_snapshots/ (~3.7G / 27 files) lives ONLY on the local Windows disk
# — it is gitignored (.gitignore) and explicitly EXCLUDED from the Mac/VM clones
# (align-clones.sh LEAN_EXCLUDE + sync-gitignored-to-vm.sh). So there is NO
# off-machine copy of any restore-point: a single disk failure loses every
# pre-op snapshot. This script mirrors the pre-op snapshots to the VM at
# /home/ubuntu/dump_archive/ so a restore-point survives a local disk loss.
#
# WHAT it archives: the top-level pre-op snapshots in pg_dump_snapshots/
#   (*.dump, *.dump.gz, *.sql, *.provenance.txt). The scheduled/ subdir — when it
#   exists — is its OWN scheduled-backup DR lane and is NOT archived here (it has
#   its own retention/rotation; mixing the two would conflate two DR lanes).
#
# Transport: scp over the existing `oracle-vm-default` SSH config. rsync is NOT
# available in Git Bash on Windows (same constraint sync-gitignored-to-vm.sh
# documents), so we emulate `rsync -av --ignore-existing`: enumerate what is
# already on the VM (name + byte size) and transfer ONLY files that are missing
# or size-mismatched. Re-runnable / idempotent: an already-archived dump of the
# same size is skipped, never re-transferred.
#
# SAFETY: NEVER deletes anything (local or remote). No cron, no auto-purge.
# Retention/pruning is a MANUAL decision (a restore-point is never auto-deleted —
# same doctrine as clean.sh --dumps-dry-run). See docs/kb/DUMP_ARCHIVAL_RUNBOOK.md.
#
# Overridable env: SSH_HOST  REMOTE_DIR  LOCAL_DIR
set -euo pipefail

SSH_HOST="${SSH_HOST:-oracle-vm-default}"
REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/dump_archive}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DIR="${LOCAL_DIR:-$ROOT/pg_dump_snapshots}"

# MSYS_NO_PATHCONV=1 stops Git Bash from mangling the remote POSIX paths
# (/home/ubuntu/... -> C:\...) inside ssh/scp argument strings.
ssh_remote() { MSYS_NO_PATHCONV=1 ssh -o BatchMode=yes "$SSH_HOST" "$@"; }

if [ ! -d "$LOCAL_DIR" ]; then
  echo "[archive] LOCAL_DIR not found: $LOCAL_DIR — nothing to archive." >&2
  exit 0
fi

echo "[archive] off-machine archival of pre-op pg_dump snapshots"
echo "[archive]   local : $LOCAL_DIR"
echo "[archive]   remote: $SSH_HOST:$REMOTE_DIR"
echo "[archive]   (scheduled/ subdir is a separate DR lane — NOT archived here)"

# 1) Ensure the remote archive dir exists (idempotent).
ssh_remote "mkdir -p '$REMOTE_DIR'"

# 2) Snapshot what is already on the VM: "name<TAB>bytes" per file.
#    Used to skip already-archived dumps of matching size (idempotency).
remote_index="$(ssh_remote "cd '$REMOTE_DIR' 2>/dev/null && find . -maxdepth 1 -type f -printf '%f\t%s\n' 2>/dev/null" || true)"

remote_size_of() {
  # echoes the byte size of remote file $1, or empty if absent
  printf '%s\n' "$remote_index" | awk -F'\t' -v n="$1" '$1==n {print $2; exit}'
}

# 3) Enumerate local top-level pre-op snapshots (NOT the scheduled/ subdir).
shopt -s nullglob
transferred=0
skipped=0
xfer_bytes=0
for f in "$LOCAL_DIR"/*.dump "$LOCAL_DIR"/*.dump.gz "$LOCAL_DIR"/*.sql "$LOCAL_DIR"/*.provenance.txt; do
  [ -f "$f" ] || continue
  base="$(basename "$f")"
  lsize="$(stat -c '%s' "$f" 2>/dev/null || stat -f '%z' "$f")"
  rsize="$(remote_size_of "$base")"
  if [ "$rsize" = "$lsize" ]; then
    skipped=$((skipped + 1))
    continue
  fi
  if [ -n "$rsize" ]; then
    echo "[archive]   RE-SEND (size $rsize -> $lsize): $base"
  else
    echo "[archive]   SEND: $base ($lsize bytes)"
  fi
  # scp the single file. MSYS_NO_PATHCONV protects the REMOTE POSIX path from
  # Git Bash mangling, but it would also stop conversion of the LOCAL path —
  # so convert the local source to a native Windows path first (cygpath), which
  # scp.exe accepts as-is. (Without this, scp tries to stat "/d/..." literally.)
  if command -v cygpath >/dev/null 2>&1; then src="$(cygpath -w "$f")"; else src="$f"; fi
  MSYS_NO_PATHCONV=1 scp -q -o BatchMode=yes "$src" "$SSH_HOST:$REMOTE_DIR/"
  transferred=$((transferred + 1))
  xfer_bytes=$((xfer_bytes + lsize))
done
shopt -u nullglob

# 4) Summary: local count/size, transferred this run, remote total after.
human() { numfmt --to=iec --suffix=B "$1" 2>/dev/null || echo "${1}B"; }
local_n="$(find "$LOCAL_DIR" -maxdepth 1 -type f \( -name '*.dump' -o -name '*.dump.gz' -o -name '*.sql' -o -name '*.provenance.txt' \) | wc -l | tr -d ' ')"
remote_du="$(ssh_remote "du -sh '$REMOTE_DIR' 2>/dev/null | cut -f1" || echo '?')"
remote_n="$(ssh_remote "find '$REMOTE_DIR' -maxdepth 1 -type f 2>/dev/null | wc -l" || echo '?')"

echo
echo "[archive] === summary ==="
echo "[archive]   local pre-op snapshots : $local_n file(s)"
echo "[archive]   transferred this run   : $transferred file(s), $(human "$xfer_bytes")"
echo "[archive]   already-archived (skip): $skipped file(s)"
echo "[archive]   remote total now       : $remote_n file(s), $remote_du at $SSH_HOST:$REMOTE_DIR"
echo "[archive] done — nothing deleted (retention is manual; see docs/kb/DUMP_ARCHIVAL_RUNBOOK.md)"
