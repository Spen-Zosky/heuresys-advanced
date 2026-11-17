#!/usr/bin/env bash
# ============================================================================
# scripts/rilascia.sh — il rilascio dei thread, con le guardie dentro.
#
# PERCHE' ESISTE (2026-11-17). Enzo ha dato una delega permanente il 13/11: i thread
# rilasciano in produzione con CI verde sul commit, backup verificato prima e verifiche
# dal vivo dopo. I thread pero' armavano il rilascio a mano, con
# `git push origin <sha>:refs/heads/prod`: un comando che non porta con se' nessuna delle
# tre condizioni, quindi il controllo automatico dei permessi lo fermava e chiedeva a
# Enzo una frase da copiare. Due volte nella stessa notte. Qui le condizioni non sono
# promesse del chiamante: le controlla lo script, e se una manca non spinge niente.
#
# Guardie, tutte prima di spingere (nessuna si scavalca con un flag):
#   G1  il commit e' su origin/main (uguale o antenato della punta)
#   G2  origin/prod e' antenato del commit: solo avanzamento, mai force-push
#   G3  CI: almeno una corsa sul commit, tutte concluse, nessuna bocciata
#   G4  backup di heuresys_advanced verificato da meno di 24 ore
#       (marcatore di ~/.claude/tools/backup-verificato.sh; se e' vecchio lo rinnova)
# Dopo: l'atto e' arma-deploy.sh (uno solo, #217 I4); il rollout lo fa
# heuresys-advanced-deploy-watch.timer; la verifica dal vivo e' scripts/verifica-deploy.sh.
#
# Uso:   bash scripts/rilascia.sh <sha> [--why <testo>] [--dry-run]
# Esiti: 0 armato o gia' armato · 1 guardia rossa (niente spinto) · 2 uso sbagliato
# Env per i test: RILASCIO_CI_STATO="<totale> <verdi> <in_corso> <rosse>",
#                 RILASCIO_BACKUP_MARK=<file>, RILASCIO_NO_RINNOVO=1
# ============================================================================
set -euo pipefail

SHA_IN=""; WHY=""; DRY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --why)     WHY="${2:-}"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -*)        echo "uso: rilascia.sh <sha> [--why <testo>] [--dry-run]" >&2; exit 2 ;;
    *)         SHA_IN="$1"; shift ;;
  esac
done
[ -n "$SHA_IN" ] || { echo "uso: rilascia.sh <sha> [--why <testo>] [--dry-run]" >&2; exit 2; }

ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
rosso() { echo "[rilascio] FERMO — $*" >&2; exit 1; }

git fetch --quiet origin main prod 2>/dev/null || rosso "origin non risponde (fetch di main e prod)"
SHA="$(git rev-parse --verify -q "${SHA_IN}^{commit}" 2>/dev/null)" || rosso "commit sconosciuto: $SHA_IN"
SHORT="$(git rev-parse --short "$SHA")"

# G1 — su main
git merge-base --is-ancestor "$SHA" origin/main || rosso "G1: $SHORT non e' su origin/main"

# G2 — solo avanzamento
PROD="$(git rev-parse --verify -q origin/prod)" || rosso "G2: origin/prod non esiste"
if [ "$PROD" = "$SHA" ]; then echo "[rilascio] origin/prod e' gia' su $SHORT — niente da fare"; exit 0; fi
git merge-base --is-ancestor "$PROD" "$SHA" || rosso "G2: origin/prod ($(git rev-parse --short "$PROD")) non e' antenato di $SHORT: servirebbe un force-push, che resta di Enzo"

# G3 — CI verde sul commit
if [ -n "${RILASCIO_CI_STATO:-}" ]; then STATO="$RILASCIO_CI_STATO"
else
  STATO="$(gh run list --commit "$SHA" --limit 50 --json status,conclusion \
    --jq '"\(length) \([.[]|select(.conclusion=="success" or .conclusion=="skipped" or .conclusion=="neutral")]|length) \([.[]|select(.status!="completed")]|length) \([.[]|select(.status=="completed" and .conclusion!="success" and .conclusion!="skipped" and .conclusion!="neutral")]|length)"' 2>/dev/null)" \
    || rosso "G3: gh non risponde, CI non verificabile"
fi
read -r TOT VERDI INCORSO ROSSE <<<"$STATO"
[ "${TOT:-0}" -gt 0 ] || rosso "G3: nessuna corsa di CI su $SHORT"
[ "$ROSSE" = 0 ]      || rosso "G3: $ROSSE corse rosse su $SHORT"
[ "$INCORSO" = 0 ]    || rosso "G3: $INCORSO corse ancora in volo su $SHORT: riprova quando finiscono"
[ "$VERDI" = "$TOT" ] || rosso "G3: corse verdi $VERDI su $TOT"
echo "[rilascio] G3 ok — CI $VERDI/$TOT verde su $SHORT"

# G4 — backup verificato < 24 ore
MARK="${RILASCIO_BACKUP_MARK:-$HOME/.claude/state/backup-verificato.heuresys_advanced}"
fresco() { [ -f "$MARK" ] && [ "$(( $(date +%s) - $(stat -c %Y "$MARK") ))" -lt 86400 ]; }
if ! fresco && [ -z "${RILASCIO_NO_RINNOVO:-}" ] && [ -f "$HOME/.claude/tools/backup-verificato.sh" ]; then
  bash "$HOME/.claude/tools/backup-verificato.sh" heuresys_advanced >/dev/null 2>&1 || true
fi
fresco || rosso "G4: nessun backup verificato di heuresys_advanced nelle ultime 24 ore"
echo "[rilascio] G4 ok — backup verificato ($(sed -n 1p "$MARK" 2>/dev/null | xargs -r basename))"

if [ -n "$DRY" ]; then echo "[rilascio] DRY-RUN — guardie verdi, armerei origin/prod -> $SHORT"; exit 0; fi

# L'atto e' uno solo (#217 I4): arma-deploy.sh, sul commit verificato.
bash "$ROOT/scripts/arma-deploy.sh" --sha "$SHA" --why "${WHY:-rilascio $SHORT dal thread, guardie G1-G4 verdi}"
echo "[rilascio] ora: bash scripts/verifica-deploy.sh (atteso DEPLOYATO su $SHORT) e la prova dal vivo"
