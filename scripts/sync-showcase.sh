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

echo "sync-showcase: copying apps/web/src/app/showcase -> apps/showcase/src/app/showcase"
mkdir -p "$SHOWCASE/app/showcase"
cp -r "$WEB/app/showcase/." "$SHOWCASE/app/showcase/"

echo "sync-showcase: copying apps/web/src/lib/theme -> apps/showcase/src/lib/theme"
mkdir -p "$SHOWCASE/lib/theme"
cp -r "$WEB/lib/theme/." "$SHOWCASE/lib/theme/"

echo "sync-showcase: done"
