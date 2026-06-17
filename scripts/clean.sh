#!/usr/bin/env bash
#
# scripts/clean.sh — QW-2 / QW-K1 (S-100X-A10 / WS-K K-1/K-7): remove regenerable
# build artifacts across the monorepo. WS-K measured apps/web/.next at ~29G (28G of
# which is .next/dev/cache, growing ~1.7G/day) with NO clean script anywhere → cruft
# just accumulates. ALL targets here are gitignored AND regenerable (pnpm build /
# next build / pnpm install recreate them), so this is zero-risk.
#
# Modes:
#   (default)        remove build outputs + local caches (.next, dist, *.tsbuildinfo, .cache)
#   --deep           also remove node_modules/.cache + .turbo (force a cold next rebuild)
#   --dumps-dry-run  LIST pg_dump_snapshots/pre-* (ad-hoc restore points) WITHOUT
#                    deleting — archival/retention is a manual decision (QW-K3:
#                    a restore-point is NEVER auto-deleted).
#
# After a clean, run `pnpm build` (or `pnpm --filter @heuresys/shared build` first)
# before typecheck/dev that depend on emitted dist.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
MODE="${1:-}"

if [ "$MODE" = "--dumps-dry-run" ]; then
  echo "[clean] pre-op dumps (NOT deleted — archival is a manual decision, QW-K3):"
  du -sh pg_dump_snapshots/pre-* 2>/dev/null || echo "  (none)"
  echo "[clean] pg_dump_snapshots total (local):"
  du -sh pg_dump_snapshots 2>/dev/null || echo "  (none)"
  # Off-disk archive status (QW-K3): the VM holds a copy at /home/ubuntu/dump_archive/
  # (scripts/archive-dumps.sh). Report it so the dry-run shows BOTH local and archived
  # state. Non-destructive, non-fatal if the VM is unreachable.
  ARCHIVE_HOST="${ARCHIVE_HOST:-oracle-vm-default}"
  ARCHIVE_REMOTE_DIR="${ARCHIVE_REMOTE_DIR:-/home/ubuntu/dump_archive}"
  echo "[clean] off-disk archive ($ARCHIVE_HOST:$ARCHIVE_REMOTE_DIR):"
  if archive_stat="$(MSYS_NO_PATHCONV=1 ssh -o BatchMode=yes -o ConnectTimeout=10 "$ARCHIVE_HOST" \
        "n=\$(find '$ARCHIVE_REMOTE_DIR' -maxdepth 1 -type f 2>/dev/null | wc -l); s=\$(du -sh '$ARCHIVE_REMOTE_DIR' 2>/dev/null | cut -f1); printf '%s file(s), %s' \"\$n\" \"\${s:-0}\"" 2>/dev/null)"; then
    echo "  $archive_stat"
    echo "  (refresh with: bash scripts/archive-dumps.sh — see docs/kb/DUMP_ARCHIVAL_RUNBOOK.md)"
  else
    echo "  (VM unreachable — run 'bash scripts/archive-dumps.sh' when online to verify/refresh the off-disk copy)"
  fi
  exit 0
fi

echo "[clean] removing regenerable build artifacts (all gitignored)…"
# Next.js build + dev caches (the big one: apps/web/.next).
rm -rf apps/web/.next apps/showcase/.next
# Per-workspace dist + incremental tsbuildinfo.
find apps packages -maxdepth 3 -type d -name dist -prune -exec rm -rf {} + 2>/dev/null || true
find apps packages -maxdepth 3 -type f -name '*.tsbuildinfo' -delete 2>/dev/null || true
# Local caches.
rm -rf .cache apps/web/.cache apps/showcase/.cache

if [ "$MODE" = "--deep" ]; then
  echo "[clean] --deep: removing node_modules/.cache + .turbo…"
  rm -rf node_modules/.cache .turbo
fi

echo "[clean] done — regenerable artifacts removed. Run 'pnpm build' before typecheck/dev."
