#!/usr/bin/env bash
# scripts/sync-showcase.sh
#
# Syncs the showcase pages + theme code from apps/web (canonical source) into
# apps/showcase (build target for GitHub Pages static export). Called by
# apps/showcase's prebuild script before `next build`.
#
# Idempotent: removes the target dirs before copying so stale files don't
# accumulate.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$REPO_ROOT/apps/web/src"
SHOWCASE="$REPO_ROOT/apps/showcase/src"

echo "sync-showcase: cleaning target dirs in apps/showcase..."
rm -rf "$SHOWCASE/app/showcase"
rm -rf "$SHOWCASE/lib"
rm -rf "$SHOWCASE/components"

echo "sync-showcase: copying apps/web/src/app/showcase -> apps/showcase/src/app/showcase"
mkdir -p "$SHOWCASE/app/showcase"
cp -r "$WEB/app/showcase/." "$SHOWCASE/app/showcase/"

# apps/web/src/lib is intentionally NOT synced. Showcase pages must remain
# portable — only deps allowed are @heuresys/ui + react + lucide-react (per
# ADR-0013 R2 portability invariant). The legacy lib/theme bundle was retired
# in Tier 2 cleanup; palette + theme now live in @heuresys/ui (PaletteDropdown
# + ThemeProvider + ThemeToggle). If a showcase page needs business logic
# (apps/web/src/lib/api, i18n, ...), promote that logic to @heuresys/ui first.

# Components used by showcase pages (e.g. SystemHealthDashboard.tsx is shared
# between /showcase/system-health and the authenticated /system-health route).
if [ -d "$WEB/components" ]; then
  echo "sync-showcase: copying apps/web/src/components -> apps/showcase/src/components"
  mkdir -p "$SHOWCASE/components"
  cp -r "$WEB/components/." "$SHOWCASE/components/"
fi

echo "sync-showcase: done"
