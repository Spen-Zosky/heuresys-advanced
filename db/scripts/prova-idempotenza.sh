#!/usr/bin/env bash
# db/scripts/prova-idempotenza.sh
#
# LA PROVA DI IDEMPOTENZA DELLA CATENA — SU UNA COPIA, NON SULLA PRODUZIONE.
#
# E' il comando della suite `migrate-idempotent` di `verify_gate.py`.
#
# ⚠ COSA FACEVA PRIMA, e perche' e' stato corretto (Enzo, 2026-08-27).
# La suite era `pnpm db:migrate:sh && pnpm db:migrate:sh`, cioe':
#
#   ① applicava la catena ALLA PRODUZIONE — due volte — per provare che fosse
#     idempotente. Un cancello di verifica che SCRIVE sull'ambiente vero. E' il
#     difetto che in S1065 ha portato in produzione una migrazione committata e
#     non deployata, lasciando 117 utenti senza organigramma: il cancello non
#     era read-only e nessuno se lo aspettava.
#   ② lo faceva DA WINDOWS, dove il database non c'e': le ~60.000 righe della
#     catena attraversavano il tunnel SSH una per una. Misurato il 2026-08-27,
#     stesso script e stesso esito: **~80 minuti da Windows contro 17 secondi
#     dove il database e' locale**. Due volte. Il cancello di fine turno costava
#     ore, e per questo si finiva per aggirarlo — che e' il modo in cui un
#     cancello smette di proteggere.
#
# COSA FA ORA: `ci-rehearsal.sh` sul linux-pc. La stessa prova, ma
#   · su una COPIA usa-e-getta (`heuresys_ci`), non sulla produzione;
#   · dove il database e' sulla stessa macchina — 12-26 secondi;
#   · con in piu' le sentinelle di `db_health` interrogate alla fine, che la
#     versione locale non faceva.
# E' una prova piu' severa e incomparabilmente piu' rapida.
#
# SE IL GEMELLO NON RISPONDE, QUESTO SCRIPT ESCE **ROSSO**, e non ripiega in
# locale. Ripiegare significherebbe riapplicare due catene alla produzione, cioe'
# tornare esattamente al difetto che questa correzione esiste per togliere. Un
# cancello che non ha potuto misurare deve dirlo: «non ho potuto guardare» non e'
# «va bene» — e un verde nato dal buio e' identico a uno nato da una misura, che
# e' la peggiore delle risposte.
#
# Via d'uscita dichiarata, per chi sa quello che fa:
#   IDEMPOTENZA_HOST=<altro-host>   prova altrove (deve avere il repo + ci-rehearsal)
#
# Uso:  bash db/scripts/prova-idempotenza.sh

set -euo pipefail

HOST="${IDEMPOTENZA_HOST:-linux-pc}"
REPO="${IDEMPOTENZA_REPO:-~/heuresys-advanced}"

# Git Bash su Windows convertirebbe `~/heuresys-advanced` in un path Windows
# prima di passarlo a ssh; altrove la variabile e' inerte.
export MSYS_NO_PATHCONV=1

echo "[idempotenza] la prova gira su '$HOST', su una copia usa-e-getta — non sulla produzione"

if ! ssh -o ConnectTimeout=15 -o BatchMode=yes "$HOST" true 2>/dev/null; then
  cat >&2 <<EOF
[idempotenza] ROSSO — '$HOST' non risponde, quindi la prova NON E' STATA ESEGUITA.

  Questo non e' un verde mancato per pignoleria: senza il gemello l'unica
  alternativa sarebbe riapplicare due volte la catena alla PRODUZIONE, dal
  tunnel, in ore. E' cio' che il cancello faceva prima, ed e' il difetto che
  questa correzione toglie.

  Cosa fare:
    · accendi il linux-pc e rilancia;
    · oppure IDEMPOTENZA_HOST=<host> se hai un altro gemello col repo;
    · la prova a mano resta:
        ssh $HOST 'cd $REPO && bash db/scripts/ci-rehearsal.sh'

  NON aggirarlo applicando la catena in locale: non proverebbe l'idempotenza,
  la consumerebbe.
EOF
  exit 1
fi

# Il repo dev'esserci, e con dentro la prova: un `ssh` che risponde non basta.
# `-f`, non `-x`: lo script si invoca con `bash <file>`, quindi il bit di esecuzione
# e' irrilevante — e infatti sul gemello il file non ce l'ha (`-rw-rw-r--`). La prima
# stesura di questa guardia usava `-x` e produceva un FALSO ROSSO su un gemello
# perfettamente sano. Una guardia deve misurare la condizione che serve davvero a
# funzionare, non una che le somiglia.
if ! ssh -o ConnectTimeout=15 "$HOST" "test -f $REPO/db/scripts/ci-rehearsal.sh" 2>/dev/null; then
  echo "[idempotenza] ROSSO — su '$HOST' manca $REPO/db/scripts/ci-rehearsal.sh." >&2
  echo "              Allinea il clone (skill full-alignment-deploy) e rilancia." >&2
  exit 1
fi

# Le migrazioni locali devono essere ARRIVATE sul gemello, o la prova gira sulla
# catena di ieri e dichiara verde un file che non ha mai visto. Si confronta il
# numero di file: piu' economico di un hash e sufficiente a cogliere il caso
# reale (ho aggiunto una migrazione e non l'ho propagata).
LOCALI=$(ls "$(dirname "$0")/../migrations"/*.sql | wc -l | tr -d ' ')
REMOTE=$(ssh -o ConnectTimeout=15 "$HOST" "ls $REPO/db/migrations/*.sql | wc -l" 2>/dev/null | tr -d ' \r')
echo "[idempotenza] migrazioni: qui $LOCALI · su $HOST $REMOTE"
if [ "$LOCALI" != "$REMOTE" ]; then
  cat >&2 <<EOF
[idempotenza] ROSSO — il gemello ha $REMOTE migrazioni, questa macchina $LOCALI.
              La prova girerebbe su una catena diversa da quella che stai per
              pubblicare, e il suo verde non direbbe niente sul tuo lavoro.
              Porta i file e rilancia:
                scp db/migrations/000NNN_*.sql $HOST:$REPO/db/migrations/
              (oppure, a push fatto: ssh $HOST 'cd $REPO && git pull --ff-only')
EOF
  exit 1
fi

exec ssh -o ConnectTimeout=30 "$HOST" "cd $REPO && bash db/scripts/ci-rehearsal.sh"
