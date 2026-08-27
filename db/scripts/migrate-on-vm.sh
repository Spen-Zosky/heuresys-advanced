#!/usr/bin/env bash
# db/scripts/migrate-on-vm.sh
#
# APPLICA LA CATENA DI MIGRAZIONI ALLA PRODUZIONE, ESEGUENDOLA **SULLA VM**.
#
# PERCHE' ESISTE (Enzo, 2026-08-27). Il database di produzione non sta sulla
# macchina di sviluppo: vive sulla VM Oracle, e da Windows ci si arriva con un
# tunnel SSH. Lanciare `db/scripts/migrate.sh` da Windows funziona, ma spedisce
# le ~60.000 righe della catena una per una attraverso quel tunnel. Misurato lo
# stesso giorno, stesso script e stesso esito (`334 applied, 21 skipped`):
#
#     da Windows, via tunnel : ~80 minuti
#     sulla VM,   DB locale  :  17 secondi        <- un fattore ~280
#
# Non e' una differenza di potenza di calcolo: e' la differenza fra avere il
# database in casa e averlo dall'altra parte di una rete. Sulla VM il `.env`
# dichiara `POSTGRES_HOST=localhost`.
#
# QUANDO USARE INVECE `pnpm db:migrate:sh` (da Windows): quando non si ha accesso
# SSH alla VM, o si sta diagnosticando qualcosa che richiede di stare in locale.
# Restano validi — semplicemente non sono la via normale, e chi li sceglie deve
# sapere che sta pagando quel fattore.
#
# PRECONDIZIONE: il file di migrazione dev'essere GIA' sulla VM. Due modi:
#   · dopo il push:   questo script fa `git pull` da se' (default)
#   · prima del push: `scp db/migrations/000NNN_*.sql oracle-vm-default:~/heuresys-advanced/db/migrations/`
#                     e poi lanciare con `--no-pull`
#
# Uso:
#   bash db/scripts/migrate-on-vm.sh              # git pull sulla VM, poi migra
#   bash db/scripts/migrate-on-vm.sh --no-pull    # migra cio' che c'e' gia' (prove pre-push)
#   HOST=linux-pc bash db/scripts/migrate-on-vm.sh   # stesso mestiere sul gemello
#
# ⚠ NON e' la prova generale. Prima di applicare alla produzione, la catena si
# prova sul clone: `ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'`.
# Questo script APPLICA; quello PROVA. Non sono intercambiabili.

set -euo pipefail

HOST="${HOST:-oracle-vm-default}"
REPO="${REPO:-~/heuresys-advanced}"
PULL=1

for arg in "$@"; do
  case "$arg" in
    --no-pull) PULL=0 ;;
    -h|--help) sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "opzione sconosciuta: $arg (usa --help)" >&2; exit 2 ;;
  esac
done

# MSYS_NO_PATHCONV: Git Bash su Windows converte `~/heuresys-advanced` in un
# path Windows prima di passarlo a ssh, e il comando remoto fallisce su un
# riferimento valido. Vale solo su Windows, e altrove e' inerte.
export MSYS_NO_PATHCONV=1

echo "[migrate-on-vm] host=$HOST  repo=$REPO  pull=$PULL"

REMOTE="cd $REPO"
if [ "$PULL" -eq 1 ]; then
  REMOTE="$REMOTE && git pull --ff-only"
fi
REMOTE="$REMOTE && ls db/migrations/*.sql | wc -l | sed 's/^/[migrate-on-vm] migrazioni sul disco remoto: /'"
REMOTE="$REMOTE && START=\$(date +%s) && bash db/scripts/migrate.sh > /tmp/migrate-on-vm.log 2>&1; RC=\$?; END=\$(date +%s);"
REMOTE="$REMOTE echo \"[migrate-on-vm] exit=\$RC durata=\$((END-START))s\";"
# L'esito si stampa SEMPRE, verde o rosso: un errore in coda alla catena non
# deve restare dentro un file remoto che nessuno apre.
REMOTE="$REMOTE grep -E '^OK:|^ERRORE|ERROR:|FATAL' /tmp/migrate-on-vm.log | tail -12; exit \$RC"

ssh -o ConnectTimeout=30 "$HOST" "$REMOTE"
