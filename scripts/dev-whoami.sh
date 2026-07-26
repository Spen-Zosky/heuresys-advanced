#!/usr/bin/env bash
# scripts/dev-whoami.sh
# Z-262 — mostra le credenziali di accesso di un utente (bash: Mac, VM, linux-pc).
#
#   bash scripts/dev-whoami.sh mario.rossi@rtl-bank.org
#   bash scripts/dev-whoami.sh mario.rossi@rtl-bank.org --watch
#
# E' un WRAPPER: la derivazione vive tutta in scripts/dev-whoami.mjs, unica
# implementazione. Qui non si calcola nulla — tre copie della stessa
# crittografia divergono, e quando divergono producono password che il server
# rifiuta senza spiegare perche'.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

if [ $# -lt 1 ]; then
  echo "uso: bash scripts/dev-whoami.sh <email> [--watch]" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  # Su VM/linux-pc/Mac node e pnpm arrivano da nvm e NON sono nel PATH di una
  # shell non interattiva (verificato S962).
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    nvm use default >/dev/null 2>&1 || nvm use 22 >/dev/null 2>&1 || true
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm non trovato (nemmeno via nvm)." >&2
  exit 127
fi

# Le dipendenze (otpauth, pg, dotenv) vivono in apps/api: lo script gira di la',
# stesso schema gia' usato da `db:encrypt-totp` in package.json.
exec pnpm --filter @heuresys/api exec node scripts/dev-whoami.mjs "$@"
