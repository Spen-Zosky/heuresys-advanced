#!/usr/bin/env bash
# ============================================================================
# scripts/arma-deploy.sh — #217 I4: ARMARE IL DEPLOY E' UN ATTO SOLO.
#
# IL DIFETTO CHE QUESTO SCRIPT CHIUDE, e ha morso il 2026-08-18. L'armamento —
# spingere `refs/heads/prod` sullo sha che deve andare in produzione — viveva
# SOLO dentro close-propagate.sh. Chi usava `align-clones.sh` direttamente, cioe'
# ogni volta che si chiede «pusha e deploya», lasciava il meccanismo cieco:
# `refs/heads/prod` era fermo a un commit DI IERI mentre la VM girava gia' quello
# di oggi, deployato a mano. Il sorvegliante (deploy-watch.timer) legge quella
# ref: una ref vecchia significa che il rollout automatico porta in produzione
# codice sbagliato, o non lo porta affatto.
#
# Chi decide SE armare resta il chiamante — close-propagate ha la sua finestra
# misurata (marcatore / `origin/prod..HEAD` / dottrina del dubbio), align-clones
# ha la sua (`DEPLOY=1`, cioe' «sto portando codice in produzione adesso»). Qui
# vive solo l'ATTO, cosi' non si duplica un predicato: e' la stessa dottrina di
# I1 sui path di deploy, dove quattro copie byte-identiche sono diventate una.
#
# Uso:
#   bash scripts/arma-deploy.sh [--ref <nome>] [--why <testo>] [--dry-run]
# Env:
#   DEPLOY_ARM_REF   ref da armare (default: prod) — la stessa che legge close-propagate
#   ARMA_DRYRUN      =1 : dichiara cosa farebbe e non spinge niente (usato dai test)
#
# Esiti (stampati e registrati nel diario delle chiusure):
#   eseguito : la ref e' stata spinta su HEAD                        -> exit 0
#   saltato  : origin/<ref> era GIA' su HEAD, non c'era niente da fare -> exit 0
#   fallito  : origin ha rifiutato (non fast-forward)                -> exit 1
#
# UN NON-FAST-FORWARD NON SI FORZA MAI IN AUTOMATICO. Succede solo se la punta e'
# stata riportata indietro (revert duro, reset): una force-push su una ref di
# produzione e' una decisione di chi conduce, non un dettaglio di implementazione.
# ============================================================================
set -euo pipefail

REF="${DEPLOY_ARM_REF:-prod}"
WHY=""
DRYRUN="${ARMA_DRYRUN:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --ref)     REF="${2:?--ref richiede un nome}"; shift 2 ;;
    --why)     WHY="${2:-}"; shift 2 ;;
    --dry-run) DRYRUN=1; shift ;;
    *) echo "uso: arma-deploy.sh [--ref <nome>] [--why <testo>] [--dry-run]" >&2; exit 2 ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
SCRIPTS="$ROOT/scripts"
HEAD_SHA="$(git rev-parse HEAD)"
SHORT="$(git rev-parse --short HEAD)"

diario() {  # esito, ragione — non fallisce mai la corsa (il diario e' un testimone, non un giudice)
  [ -f "$SCRIPTS/close-log.sh" ] && bash "$SCRIPTS/close-log.sh" step arma "$1" "$2" >/dev/null 2>&1 || true
}

# Gia' armato? La domanda si fa a origin, non a una copia locale che puo' essere vecchia.
git fetch --quiet origin "$REF" 2>/dev/null || true
REMOTE_SHA="$(git rev-parse --verify -q "origin/$REF" 2>/dev/null || true)"
if [ "$REMOTE_SHA" = "$HEAD_SHA" ]; then
  echo "[arma] origin/$REF e' gia' su $SHORT — niente da armare"
  # NB: niente apostrofi dentro un ${VAR:-default} — bash ci apre una stringa anche
  # quando tutto sta fra doppi apici, e lo script muore con «unexpected EOF».
  diario saltato "${WHY:-niente da armare: origin/$REF combacia con HEAD}"
  exit 0
fi

if [ -n "$DRYRUN" ]; then
  echo "[arma] DRY-RUN — spingerei origin/$REF -> $SHORT${WHY:+ ($WHY)}"
  exit 0
fi

echo "[arma] origin/$REF -> $SHORT${WHY:+ ($WHY)}"
if git push --quiet origin "HEAD:refs/heads/$REF"; then
  echo "  armato $SHORT — il deploy parte da se' entro ~5 minuti dal verde della CI"
  echo "  (sorvegliante: heuresys-advanced-deploy-watch.timer su VM e linux-pc)"
  diario eseguito "${WHY:-armamento richiesto dal chiamante}"
  exit 0
fi

echo "[arma] RIFIUTATO da origin (non fast-forward?). Se e' voluto, esplicitamente:" >&2
echo "[arma]     git push --force origin HEAD:refs/heads/$REF" >&2
diario fallito "${WHY:-armamento rifiutato da origin (non fast-forward)}"
exit 1
