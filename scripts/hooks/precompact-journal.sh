#!/bin/sh
# precompact-journal.sh — l'unico punto in cui il diario di sessione serve davvero.
#
# PERCHE' ESISTE (misurato S1064, 2026-08-15, non supposto)
# `.handoff/session-journal.ndjson` era a 0 byte dal 10 agosto. La tentazione era leggerlo
# come «strumento rotto». La misura dice altro: la regola cardinale della skill `handoff`
# ammette QUATTRO fonti — backlog, debt, STATE, journal — e le sessioni S1053→S1063 hanno
# registrato tutto nelle prime tre, che sono piu' forti perche' versionate. Nessuna perdita
# misurabile. Il diario non e' quindi un registro mancato: e' un CUSCINETTO, e ha un solo
# caso d'uso reale.
#
# Quel caso e' la COMPATTAZIONE DEL CONTESTO. E' l'unico momento in cui un fatto emerso e non
# ancora registrato puo' sparire davvero: la conversazione si accorcia, e cio' che viveva solo
# li' dentro non e' piu' recuperabile da nessuna fonte. Il diario e' nato per questo (design
# §11.4) e proprio li' non veniva mai chiamato, perche' la sua invocazione dipendeva dal fatto
# che io me ne ricordassi — ed e' esattamente la forma di regola che questo progetto ha
# misurato essere quella con le recidive.
#
# COSA FA, e cosa deliberatamente NON fa
#   FA   — deposita una riga DETERMINISTICA di compattazione: quando, su quale HEAD, con quante
#          righe gia' nel diario. Chi legge la chiusura sa che c'e' stato un taglio, e sa dove.
#          Questa parte non dipende da nessun comportamento del modello: e' la sola che si possa
#          garantire, e infatti e' la sola che il test verifica.
#   FA   — stampa il promemoria di travasare le pendenze non ancora registrate.
#   NON  — non blocca, non fallisce, non ritarda la compattazione. Un osservatore che fa fallire
#          cio' che osserva e' un difetto, non una guardia (stessa regola di close-log.sh).
#   NON  — non registra i commit: quelli stanno gia' in `git log`, e un diario che duplica il
#          git log aggiunge rumore, non memoria.
#
# Uscita SEMPRE 0.

REPO=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
J="$REPO/.handoff/session-journal.ndjson"

mkdir -p "$REPO/.handoff" 2>/dev/null
righe=$(wc -l < "$J" 2>/dev/null | tr -d ' ')
[ -n "${righe:-}" ] || righe=0
head_sha=$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo '?')
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)

esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
printf '{"ts":"%s","kind":"note","ref":"compattazione","note":"%s"}\n' \
  "$ts" \
  "$(esc "contesto compattato su HEAD $head_sha — il diario aveva $righe riga/e. Cio' che era emerso prima e non e' stato registrato in una fonte vive ormai solo nel transcript.")" \
  >> "$J" 2>/dev/null

cat <<'FINE'
[diario] Il contesto sta per essere compattato. Prima che accada: ogni pendenza, decisione o
rinvio emerso finora e non ancora scritto in una fonte (register, DEBT, STATE o diario) va
registrato ADESSO — dopo il taglio non sara' piu' recuperabile.
  bash scripts/journal-append.sh <pending|decision|defer|interrupted|note> <ref> <nota>
FINE

exit 0
