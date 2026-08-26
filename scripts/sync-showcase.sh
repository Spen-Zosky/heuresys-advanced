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

# /showcase lives at app/showcase when enabled, or _disabled_showcase_X18 while
# the CW-B59 in-app SSR issue keeps it out of apps/web's server build. apps/showcase
# is a static export (output: export) — a different build path that renders these
# pages fine either way — so source from whichever location exists.
SHOWCASE_SRC="$WEB/app/showcase"
[ -d "$SHOWCASE_SRC" ] || SHOWCASE_SRC="$WEB/_disabled_showcase_X18"
echo "sync-showcase: copying $SHOWCASE_SRC -> $SHOWCASE/app/showcase"
mkdir -p "$SHOWCASE/app/showcase"
cp -r "$SHOWCASE_SRC/." "$SHOWCASE/app/showcase/"

# Override di tema dell'applicazione. NON sono i token di marca: quelli vivono
# nella libreria (@heuresys/ui/theme) dal 2026-08-26 e i due globals.css li
# importano da li' per conto proprio, senza passare da questo sync. Qui si copia
# il solo file degli scostamenti di apps/web — oggi vuoto — perche' lo showcase
# lo importa dopo il tema, e senza il file l'@import non risolverebbe.
#
# Storia (S1030): prima i token erano duplicati a mano nei due globals.css con
# l'avvertenza "replicare ogni modifica"; non e' successo, e lo showcase e'
# rimasto senza il blocco @theme inline e senza i token semantici — `text-danger`
# non generava alcuna utility sul sito pubblico, e i fix di contrasto AA di
# S982/S1025 non ci arrivavano. La copia da apps/web chiuse quel drift; ora la
# fonte e' salita di un livello, nella libreria, dove serve tutti i prodotti.
echo "sync-showcase: copying theme-overrides.css -> apps/showcase/src/app/"
cp "$WEB/app/theme-overrides.css" "$SHOWCASE/app/theme-overrides.css"

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
  # Portability invariant (ADR-0013 R2): the showcase may only depend on @heuresys/ui + react +
  # lucide-react. Some apps/web components are app-specific wrappers that import non-portable
  # modules (@heuresys/shared types, @/lib api, react-i18next/i18next) — e.g. preferences-applier.tsx
  # (@heuresys/shared) and the i18n-migrated data-table-panel.tsx / language-switcher.tsx
  # (react-i18next). Those are NOT showcase primitives; prune them from the synced copy so
  # `next build` (which typechecks the whole tree) doesn't choke on a module the showcase
  # intentionally doesn't install.
  find "$SHOWCASE/components" -type f \( -name '*.tsx' -o -name '*.ts' \) | while read -r f; do
    if grep -qE "@heuresys/shared|@/lib/|i18next" "$f"; then
      echo "sync-showcase: pruning non-portable component $(basename "$f")"
      rm -f "$f"
    fi
  done
fi

echo "sync-showcase: done"
