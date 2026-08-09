#!/bin/sh
# hook.sh — lanciatore portabile per gli hook di modalita' sessione.
#
# Perche' esiste: gli hook girano in Git Bash su Windows e in bash su Linux, e
# l'interprete Python non ha lo stesso nome ovunque. Su Linux `python` spesso
# non esiste; su Windows `python3` esiste ma e' lo stub dello Microsoft Store,
# che NON esegue nulla. Quindi non si assume: si prova, e si accetta solo un
# interprete che RISPONDE.
#
#   uso:  hook.sh <sottocomando> [args...]        (stdin passa attraverso)
#
# Fallimento sicuro: se nessun interprete risponde, esce 0 senza bloccare.
# Un guasto del lanciatore non deve mai ne' rompere la sessione ne' aprire la
# modalita' permissiva (chi decide il default e' session_mode.py, che in caso
# di dubbio sceglie `canonical`).

set -u

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd) || exit 0
REPO=$(CDPATH= cd -- "$DIR/../.." && pwd) || exit 0
PARENT=$(dirname "$REPO")
STORE="$PARENT/.heuresys-session-mode"
CACHE="$STORE/.python"
# Due impianti diversi dietro lo stesso lanciatore: la modalita' di sessione, e il
# governo dei lavoratori di gov. Il lanciatore resta uno solo perche' il problema che
# risolve — trovare un interprete Python che RISPONDA, su Windows come su Linux — e'
# identico per entrambi.
case "${1:-}" in
  gov-recinto) IMPL="$DIR/gov_worker_guard.py"; set -- recinto ;;
  gov-diario)  IMPL="$DIR/gov_worker_guard.py"; set -- diario ;;
  *)           IMPL="$DIR/session_mode.py" ;;
esac

[ -f "$IMPL" ] || exit 0

probe() {
    # $1 e' volutamente non quotato: deve poter essere "py -3".
    # shellcheck disable=SC2086
    v=$($1 -c 'import sys;print(sys.version_info[0])' 2>/dev/null) || return 1
    [ "${v:-}" = "3" ] || return 1
    return 0
}

PY=""

# 1. cache: evita tre spawn di processo a ogni hook (su Windows si sentono).
if [ -r "$CACHE" ]; then
    cached=$(cat "$CACHE" 2>/dev/null)
    if [ -n "${cached:-}" ] && probe "$cached"; then
        PY="$cached"
    fi
fi

# 2. sonda, in ordine dipendente dal sistema.
if [ -z "$PY" ]; then
    case "$(uname -s 2>/dev/null || echo unknown)" in
        MINGW*|MSYS*|CYGWIN*|Windows*)
            # `python3` per ultimo: su Windows e' lo stub dello Store.
            CANDIDATES='python
py -3
python3'
            ;;
        *)
            CANDIDATES='python3
python
py -3'
            ;;
    esac
    OLDIFS=$IFS
    IFS='
'
    for c in $CANDIDATES; do
        IFS=$OLDIFS
        if probe "$c"; then
            PY="$c"
            mkdir -p "$STORE" 2>/dev/null
            printf '%s' "$c" >"$CACHE" 2>/dev/null
            break
        fi
        IFS='
'
    done
    IFS=$OLDIFS
fi

[ -n "$PY" ] || exit 0

# shellcheck disable=SC2086
exec $PY "$IMPL" "$@"
