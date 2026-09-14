#!/usr/bin/env bash
# pg_dump_pre_k.sh <voce> — lo snapshot che V6 pretende PRIMA di ogni migrazione del mandato K.
#
# Gira SULLA VM (dove il database vive: 138 MB in pochi secondi, contro il tunnel da qui), come fa
# gia' `scripts/vm-deploy.sh` passo 2a. Scrive
#   ~/heuresys-advanced/pg_dump_snapshots/pre-K-<voce>_<sha7>_<yyyymmdd_HHMM>.dump   (formato -Fc)
# dove <sha7> e' l'HEAD locale (il codice che sta per applicare la migrazione). La cartella e'
# gitignored; il linux-pc la tira giu' col pull notturno dei backup. Stampa nome e dimensione,
# ed esce rosso se il file non c'e' o e' vuoto: «non ho potuto guardare» non e' «va bene».
set -u
VOCE="${1:?uso: pg_dump_pre_k.sh <voce>}"
HOST="${HOST:-oracle-vm-default}"
SHA=$(git -C "$(dirname "$0")/../../.." rev-parse --short=7 HEAD)
TS=$(date +%Y%m%d_%H%M)
NOME="pre-K-${VOCE}_${SHA}_${TS}.dump"
export MSYS_NO_PATHCONV=1
ssh -o ConnectTimeout=20 "$HOST" "mkdir -p ~/heuresys-advanced/pg_dump_snapshots && sudo -u postgres pg_dump -Fc heuresys_advanced > ~/heuresys-advanced/pg_dump_snapshots/$NOME && ls -l ~/heuresys-advanced/pg_dump_snapshots/$NOME"
RC=$?
if [ $RC -ne 0 ]; then
  echo "[pg_dump_pre_k] ROSSO: snapshot NON scritto (exit $RC). La migrazione NON si applica." >&2
  exit 1
fi
SIZE=$(ssh -o ConnectTimeout=20 "$HOST" "stat -c %s ~/heuresys-advanced/pg_dump_snapshots/$NOME" | tr -d '\r')
if [ -z "$SIZE" ] || [ "$SIZE" -lt 1000000 ]; then
  echo "[pg_dump_pre_k] ROSSO: snapshot di $SIZE byte, troppo piccolo per essere vero." >&2
  exit 1
fi
echo "[pg_dump_pre_k] OK pg_dump_snapshots/$NOME ($SIZE byte) su $HOST"
