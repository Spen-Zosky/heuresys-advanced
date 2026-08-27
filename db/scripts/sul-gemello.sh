#!/usr/bin/env bash
# db/scripts/sul-gemello.sh
#
# ESEGUE UN COMANDO DEL REPO **DOVE IL DATABASE VIVE**, invece che da qui.
#
# PERCHE' ESISTE (Enzo, 2026-08-27): *«non deve piu' accadere in nessun caso e in
# nessun controllo»*. Il database non sta sulla macchina di sviluppo: da Windows
# ogni query attraversa un tunnel SSH fino alla VM. Per una manciata di letture
# non pesa; per un lavoro che ne fa migliaia diventa un'altra cosa. Misurato lo
# stesso giorno, **stesso comando e stesso esito**:
#
#   catena di migrazioni  : ~80 minuti da Windows   ->  17 s sulla VM
#   db:validate           : >10 minuti, NON FINITO  ->  20 s sul gemello
#   un file di test API   :  83 secondi             ->  14 s sul gemello
#
# Non e' potenza di calcolo: e' la differenza fra avere il database in casa e
# averlo dall'altra parte di una rete.
#
# ⚠ NON e' un acceleratore da usare sempre: cambia DOVE gira il lavoro, e quindi
# CONTRO QUALE database. Il gemello ha un **clone**, la VM ha la **produzione**.
#   · provare, validare, testare  -> gemello (`linux-pc`), su dati clonati
#   · applicare alla produzione   -> VM (`oracle-vm-default`) — vedi migrate-on-vm.sh
#   · leggere e diagnosticare     -> qui, dove il tunnel non pesa
#
# Uso:
#   bash db/scripts/sul-gemello.sh 'bash db/scripts/validate_database.sh'
#   bash db/scripts/sul-gemello.sh 'pnpm --filter @heuresys/api test'
#   HOST=oracle-vm-default bash db/scripts/sul-gemello.sh '...'   # sulla VM
#
# Esce con l'exit code del comando remoto. Se l'host non risponde esce ROSSO e
# NON ripiega qui: ripiegare rimetterebbe il lavoro sul tunnel, cioe' il difetto
# che questo script esiste per togliere.

set -euo pipefail

HOST="${HOST:-linux-pc}"
REPO="${REPO:-~/heuresys-advanced}"

if [ $# -lt 1 ]; then
  echo "uso: bash db/scripts/sul-gemello.sh '<comando da eseguire nel repo remoto>'" >&2
  exit 2
fi
CMD="$*"

export MSYS_NO_PATHCONV=1

echo "[sul-gemello] host=$HOST  repo=$REPO"
echo "[sul-gemello] comando: $CMD"

if ! ssh -o ConnectTimeout=15 -o BatchMode=yes "$HOST" true 2>/dev/null; then
  cat >&2 <<EOF
[sul-gemello] ROSSO — '$HOST' non risponde: il comando NON E' STATO ESEGUITO.

  Non ripiego su questa macchina di proposito: lo stesso lavoro da qui passa dal
  tunnel e costa da 6 a oltre 30 volte tanto (misurato). Un controllo che nessuno
  aspetta e' un controllo che si finisce per saltare.

  Accendi '$HOST' e rilancia, oppure HOST=<altro> se hai un altro gemello.
EOF
  exit 1
fi

# nvm non e' nel PATH di una shell ssh non interattiva: senza questo, `pnpm` esce
# 127 e il comando sembra assente su una macchina che ce l'ha (misurato oggi).
exec ssh -o ConnectTimeout=30 "$HOST" \
  "export NVM_DIR=\"\$HOME/.nvm\"; [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\" >/dev/null 2>&1; cd $REPO && $CMD"
