#!/usr/bin/env bash
#
# scripts/copia-prova.sh — apre, elenca e chiude le copie di prova di heuresys-advanced.
#
# PERCHE' ESISTE (Enzo, 2026-10-30). Le sessioni che dovevano provare qualcosa senza toccare
# ~/heuresys-advanced clonavano il repository in una cartella nuova della home (~/adv-c3a-dopo,
# ~/adv-rilascio-20261025, ...), ognuna per conto suo, e a lavoro finito nessuno le toglieva:
# il 30/10 erano cinque, 2,2 GB, nessuna piu' in uso. Questo comando da' alle copie una sede
# sola, un registro che impedisce a due thread di aprirne in parallelo, e una chiusura che le
# porta nel cestino.
#
#   sede       ~/prove-heuresys-advanced/<nome>            (HEURESYS_PROVE_DIR la cambia)
#   registro   ~/prove-heuresys-advanced/.registro/<nome>/chi.txt
#   cestino    ~/_da_eliminare/prove-heuresys-advanced_<AAAAMMGG>/<nome>_<HHMMSS>
#
# Uso:
#   bash scripts/copia-prova.sh elenco
#   bash scripts/copia-prova.sh apri <nome> "<scopo>" [--rif <commit>] [--anche-se-altre]
#   bash scripts/copia-prova.sh chiudi <nome>
#
# REGOLE CHE IL COMANDO FA RISPETTARE:
#   - controllo e creazione della voce nel registro avvengono sotto `flock`: se due thread
#     aprono nello stesso istante, uno solo passa;
#   - `apri` rifiuta se la copia <nome> esiste gia' (la si riusa) e, senza --anche-se-altre,
#     se e' aperta un'altra copia qualsiasi (la si riusa o si aspetta). --anche-se-altre e'
#     per le prove che hanno davvero bisogno di due copie insieme (per esempio prima/dopo);
#   - `chiudi` rifiuta se la copia ha modifiche non committate, commit non pubblicati, uno
#     stash o un processo dentro; poi la sposta nel cestino (niente rm) e toglie la voce.
#
# Esiti: 0 fatto, 2 uso sbagliato, 3 copia gia' aperta, 4 altre copie aperte,
#        5 chiusura rifiutata, 6 clone fallito.

set -euo pipefail

SEDE="${HEURESYS_PROVE_DIR:-$HOME/prove-heuresys-advanced}"
REG="$SEDE/.registro"
REPO="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"

uso() { sed -n '17,20p' "$0" | sed 's/^# \{0,3\}//' >&2; exit 2; }

voce() { # stampa una voce del registro su una riga
  local n="$1"
  printf '  %s  ' "$n"
  tr '\n' ' ' < "$REG/$n/chi.txt" 2>/dev/null || printf '(voce senza chi.txt)'
  echo
}

elenco() {
  local n trovate=0
  [ -d "$REG" ] || { echo "nessuna copia di prova aperta"; return 0; }
  for d in "$REG"/*/; do
    [ -d "$d" ] || continue
    n="$(basename "$d")"; voce "$n"; trovate=1
  done
  [ "$trovate" = 1 ] || echo "nessuna copia di prova aperta"
}

apri() {
  local nome="${1:-}" scopo="${2:-}" rif="origin/main" altre=0
  [ -n "$nome" ] && [ -n "$scopo" ] || uso
  shift 2
  while [ $# -gt 0 ]; do
    case "$1" in
      --rif) rif="${2:?--rif vuole un commit}"; shift 2 ;;
      --anche-se-altre) altre=1; shift ;;
      *) uso ;;
    esac
  done
  [[ "$nome" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "nome non valido: solo minuscole, cifre e trattini" >&2; exit 2; }

  mkdir -p "$REG"
  exec 9>"$REG/.lucchetto"
  flock -w 30 9 || { echo "registro occupato da piu' di 30 s: riprova" >&2; exit 4; }

  if [ -d "$REG/$nome" ]; then
    echo "RIFIUTATO: la copia '$nome' e' gia' aperta. Riusala ($SEDE/$nome) o aspetta che chi la tiene la chiuda:" >&2
    voce "$nome" >&2; exit 3
  fi
  if [ "$altre" = 0 ] && [ -n "$(ls -A "$REG" | grep -v '^\.lucchetto$' || true)" ]; then
    echo "RIFIUTATO: c'e' gia' una copia di prova aperta. Riusala o aspetta; due copie insieme solo con --anche-se-altre:" >&2
    elenco >&2; exit 4
  fi
  mkdir "$REG/$nome"
  {
    echo "sessione=${CLAUDE_CODE_SESSION_ID:-sconosciuta}"
    echo "host=$(hostname)"
    echo "aperta=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "rif=$rif"
    echo "scopo=$scopo"
  } > "$REG/$nome/chi.txt"
  flock -u 9

  # Clone dal repository locale (veloce, oggetti condivisi), poi origin torna GitHub.
  if ! git clone -q --no-checkout "$REPO" "$SEDE/$nome"; then
    echo "clone fallito: la voce resta nel registro, chiudila con: bash scripts/copia-prova.sh chiudi $nome" >&2
    exit 6
  fi
  git -C "$SEDE/$nome" remote set-url origin "$(git -C "$REPO" remote get-url origin)"
  git -C "$SEDE/$nome" fetch -q origin || echo "avviso: fetch da GitHub fallito, uso i commit del repository locale" >&2
  git -C "$SEDE/$nome" checkout -q --detach "$rif"
  echo "APERTA: $SEDE/$nome su $(git -C "$SEDE/$nome" log -1 --format='%h %s')"
  echo "a fine lavoro: bash scripts/copia-prova.sh chiudi $nome"
}

chiudi() {
  local nome="${1:-}" dir motivi=() cestino p
  [ -n "$nome" ] || uso
  [ -d "$REG/$nome" ] || { echo "la copia '$nome' non e' nel registro" >&2; elenco >&2; exit 2; }
  dir="$SEDE/$nome"
  if [ -d "$dir" ]; then
    [ -z "$(git -C "$dir" status --porcelain)" ] || motivi+=("modifiche non committate (git -C $dir status)")
    [ -z "$(git -C "$dir" log --oneline --branches --not --remotes)" ] || motivi+=("commit non pubblicati (git -C $dir log --branches --not --remotes)")
    [ -z "$(git -C "$dir" stash list)" ] || motivi+=("uno stash")
    for p in /proc/[0-9]*; do
      case "$(readlink "$p/cwd" 2>/dev/null)" in
        "$dir"|"$dir"/*) [ "${p#/proc/}" = "$$" ] || { motivi+=("processo ${p#/proc/} dentro la copia"); break; } ;;
      esac
    done
    if [ ${#motivi[@]} -gt 0 ]; then
      echo "RIFIUTATO: la copia '$nome' contiene lavoro o e' in uso:" >&2
      printf '  - %s\n' "${motivi[@]}" >&2; exit 5
    fi
    cestino="$HOME/_da_eliminare/prove-heuresys-advanced_$(date +%Y%m%d)"
    mkdir -p "$cestino"
    mv "$dir" "$cestino/${nome}_$(date +%H%M%S)"
    echo "CHIUSA: $dir spostata in $cestino/"
  else
    echo "la cartella $dir non c'e': tolgo solo la voce dal registro"
  fi
  rm -f "$REG/$nome/chi.txt"
  rmdir "$REG/$nome"
}

case "${1:-}" in
  elenco) elenco ;;
  apri) shift; apri "$@" ;;
  chiudi) shift; chiudi "$@" ;;
  *) uso ;;
esac
