#!/usr/bin/env bash
# install-hooks.sh — installa (opt-in) gli hook di auto-sync KB in .git/hooks/.
# Idempotente. NON tocca il pre-commit esistente (cowork naming validator).
# Disinstalla: docs/kb/tools/install-hooks.sh --uninstall
set -euo pipefail
REPO="$(git rev-parse --show-toplevel)"
SRC="$REPO/docs/kb/tools/hooks/post-commit"
HOOKS="$REPO/.git/hooks"

if [ "${1:-}" = "--uninstall" ]; then
  for h in post-commit post-merge; do
    if [ -f "$HOOKS/$h" ] && grep -q "heuresys-advanced KB auto-sync" "$HOOKS/$h" 2>/dev/null; then
      rm -f "$HOOKS/$h"; echo "rimosso $h"
    fi
  done
  exit 0
fi

[ -f "$SRC" ] || { echo "ERRORE: $SRC mancante"; exit 1; }
for h in post-commit post-merge; do
  cp "$SRC" "$HOOKS/$h"
  chmod +x "$HOOKS/$h"
  echo "installato .git/hooks/$h"
done
echo "Hook attivi: il graph graphify si riallinea in background a ogni commit/merge."
echo "Log: docs/kb/tools/.sync.log · Disinstalla: docs/kb/tools/install-hooks.sh --uninstall"
