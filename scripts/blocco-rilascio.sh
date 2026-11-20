#!/usr/bin/env bash
#
# scripts/blocco-rilascio.sh — main sta fermo mentre un rilascio e' armato.
#
# PERCHE' ESISTE (2026-11-20). deploy-watch.sh deploya solo se origin/prod == origin/main: se dopo
# l'armo qualcuno unisce una PR, la punta non e' piu' quella autorizzata e il deploy non parte. Fino
# a oggi la punta la teneva ferma il coordinatore, avvisando a voce i thread e chi sospendeva il
# timer dell'atlante automatico, a ogni rilascio (tre volte nella sola notte del 19-20/11).
#
# Il blocco e' un file sulla VM, scritto da rilascia.sh all'armo e tolto da deploy-watch.sh quando il
# commit armato e' in produzione (DEPLOYATO). Se il rilascio si abbandona (CI rossa, deploy fallito,
# punta superata) il blocco scade da se' dopo BLOCCO_SCADENZA secondi (2 ore), o si toglie a mano.
# Chi lo legge:
#   - scripts/atlante-automatico.sh: non apre e non unisce PR finche' c'e';
#   - lo stato di commit «rilascio-libero» sulle PR aperte (failure con il blocco, success senza),
#     pubblicato da `riconcilia` e dal workflow .github/workflows/rilascio-libero.yml: con il
#     controllo richiesto su main, nessuna PR si unisce durante un rilascio armato.
#
# Uso:
#   bash scripts/blocco-rilascio.sh arma <sha>        scrive il blocco (rilascia.sh, dopo l'armo)
#   bash scripts/blocco-rilascio.sh togli [motivo]    toglie il blocco (a mano, o deploy-watch)
#   bash scripts/blocco-rilascio.sh attivo            esce 0 se il blocco c'e' e non e' scaduto
#   bash scripts/blocco-rilascio.sh riconcilia [sha-in-produzione]
#        toglie il blocco se quello sha e' il commit armato o se e' scaduto, poi, se lo stato e'
#        cambiato dall'ultima volta, ripubblica «rilascio-libero» su tutte le PR aperte
#   bash scripts/blocco-rilascio.sh stato-pr <sha>    pubblica «rilascio-libero» su un solo commit
#
# Env: BLOCCO_FILE (default ~/.local/state/heuresys-advanced/rilascio-armato) · BLOCCO_SCADENZA
#      (secondi, default 7200) · BLOCCO_REPO (default Spen-Zosky/heuresys-advanced) · BLOCCO_GH
#      (comando gh, per i test)
# Esiti: 0 fatto (per `attivo`: blocco presente) · 1 per `attivo`: nessun blocco · 2 uso sbagliato

set -euo pipefail

STATO_DIR="${HOME}/.local/state/heuresys-advanced"
BLOCCO_FILE="${BLOCCO_FILE:-$STATO_DIR/rilascio-armato}"
ULTIMO_FILE="${BLOCCO_FILE}.pubblicato"
SCADENZA="${BLOCCO_SCADENZA:-7200}"
REPO="${BLOCCO_REPO:-Spen-Zosky/heuresys-advanced}"
GH="${BLOCCO_GH:-gh}"
CONTESTO="rilascio-libero"

say() { printf '[blocco-rilascio] %s\n' "$*"; }

sha_bloccato() { awk 'NR==1 {print $1}' "$BLOCCO_FILE" 2>/dev/null || true; }
eta() { echo $(( $(date +%s) - $(stat -c %Y "$BLOCCO_FILE") )); }

attivo() {
  [ -f "$BLOCCO_FILE" ] || return 1
  [ "$(eta)" -lt "$SCADENZA" ] || return 1
  return 0
}

pubblica() {  # pubblica <sha> <state> <descrizione>
  "$GH" api -X POST "repos/$REPO/statuses/$1" -f state="$2" -f context="$CONTESTO" \
    -f description="$3" >/dev/null
}

stato_corrente() {
  if attivo; then echo "bloccato:$(sha_bloccato)"; else echo "libero"; fi
}

pubblica_tutte() {
  local stato="$1" st desc sha
  case "$stato" in
    bloccato:*) st=failure; desc="rilascio armato su ${stato#bloccato:}: main fermo fino a DEPLOYATO" ;;
    *)          st=success; desc="nessun rilascio armato" ;;
  esac
  desc="${desc:0:140}"
  "$GH" pr list --repo "$REPO" --state open --limit 200 --json headRefOid -q '.[].headRefOid' \
    | while read -r sha; do
        [ -n "$sha" ] && { pubblica "$sha" "$st" "$desc" || say "non pubblicato su ${sha:0:8}"; }
      done
}

cmd="${1:-}"; shift || true
case "$cmd" in
  arma)
    sha="${1:?arma vuole lo sha armato}"
    mkdir -p "$(dirname "$BLOCCO_FILE")"
    printf '%s %s\n' "$sha" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$BLOCCO_FILE"
    say "blocco scritto: rilascio armato su ${sha:0:8}, main fermo fino a DEPLOYATO (scade fra ${SCADENZA}s)"
    "$0" riconcilia
    ;;
  togli)
    if [ -f "$BLOCCO_FILE" ]; then
      rm -f "$BLOCCO_FILE"
      say "blocco tolto${1:+: $1}"
    fi
    "$0" riconcilia
    ;;
  attivo)
    attivo
    ;;
  riconcilia)
    in_prod="${1:-}"
    if [ -f "$BLOCCO_FILE" ]; then
      if [ -n "$in_prod" ] && [ "$(sha_bloccato)" = "$in_prod" ]; then
        rm -f "$BLOCCO_FILE"; say "blocco tolto: ${in_prod:0:8} e' in produzione (DEPLOYATO)"
      elif ! attivo; then
        rm -f "$BLOCCO_FILE"; say "blocco tolto: scaduto dopo ${SCADENZA}s (rilascio abbandonato?)"
      fi
    fi
    stato="$(stato_corrente)"
    if [ "$(cat "$ULTIMO_FILE" 2>/dev/null || true)" != "$stato" ]; then
      pubblica_tutte "$stato"
      mkdir -p "$(dirname "$ULTIMO_FILE")"
      printf '%s\n' "$stato" > "$ULTIMO_FILE"
      say "«$CONTESTO» ripubblicato sulle PR aperte: $stato"
    fi
    ;;
  stato-pr)
    sha="${1:?stato-pr vuole uno sha}"
    if attivo; then
      pubblica "$sha" failure "rilascio armato su $(sha_bloccato | cut -c1-8): main fermo fino a DEPLOYATO"
      say "$CONTESTO: failure su ${sha:0:8} (rilascio armato)"
    else
      pubblica "$sha" success "nessun rilascio armato"
      say "$CONTESTO: success su ${sha:0:8}"
    fi
    ;;
  *)
    echo "uso: blocco-rilascio.sh arma <sha> | togli [motivo] | attivo | riconcilia [sha] | stato-pr <sha>" >&2
    exit 2 ;;
esac
