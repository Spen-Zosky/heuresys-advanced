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
  echo "[clean] pg_dump_snapshots total:"
  du -sh pg_dump_snapshots 2>/dev/null || echo "  (none)"
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
