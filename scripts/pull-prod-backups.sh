#!/usr/bin/env bash
#
# scripts/pull-prod-backups.sh — copia OFF-HOST dei backup di produzione (W0.2).
#
# PERCHE'. `scripts/backup-db.sh` produce un dump giornaliero sulla VM, ma lo lascia
# sullo STESSO disco del database che protegge: la perdita del volume porta via
# insieme il DB e tutti i suoi backup. Lo script di backup prevede una copia
# off-host opzionale (BACKUP_OFFHOST_SSH) via scp in PUSH, che pero' non e' usabile
# qui: l'unico host di archivio disponibile (linux-pc, il gemello PROD sulla LAN
# domestica) sta dietro NAT e la VM non puo' raggiungerlo. La direzione corretta e'
# quindi il PULL: e' l'host di archivio a scaricare, e la VM non ha bisogno di
# alcuna credenziale verso di lui (meno superficie, non piu').
#
# COSA FA. Scarica i dump nuovi dalla VM (rsync incrementale), VERIFICA ogni file
# scaricato con `pg_restore --list` — un dump corrotto o troncato e' peggio di un
# dump assente perche' da' falsa sicurezza — e applica una retention locale piu'
# lunga di quella sulla VM (l'archivio ha spazio, la VM no).
#
# DOVE GIRA. Sull'host di archivio (oggi linux-pc), NON sulla VM. Richiede solo un
# accesso SSH key-based verso la VM e `pg_restore` in PATH.
#
# Usage:  bash scripts/pull-prod-backups.sh
# Env:    BACKUP_SOURCE_SSH   host ssh della VM              (default: oracle-vm-default)
#         BACKUP_SOURCE_DIR   dir remota dei dump            (default: ~/heuresys-advanced/pg_dump_snapshots/scheduled)
#         BACKUP_ARCHIVE_DIR  dir locale di archivio         (default: ~/heuresys-backups/prod)
#         BACKUP_ARCHIVE_RETENTION_DAYS  giorni da tenere    (default: 30)
#         BACKUP_MIN_EXPECTED_BYTES      soglia anti-troncamento (default: 10485760 = 10 MiB)
set -euo pipefail

SOURCE_SSH="${BACKUP_SOURCE_SSH:-oracle-vm-default}"
SOURCE_DIR="${BACKUP_SOURCE_DIR:-heuresys-advanced/pg_dump_snapshots/scheduled}"
ARCHIVE_DIR="${BACKUP_ARCHIVE_DIR:-$HOME/heuresys-backups/prod}"
RETENTION_DAYS="${BACKUP_ARCHIVE_RETENTION_DAYS:-30}"
MIN_BYTES="${BACKUP_MIN_EXPECTED_BYTES:-10485760}"

mkdir -p "$ARCHIVE_DIR"

echo "[pull-backups] source=$SOURCE_SSH:$SOURCE_DIR -> $ARCHIVE_DIR"

# --- 1. pull incrementale -----------------------------------------------------
# --ignore-existing: i dump sono immutabili una volta scritti (nome con timestamp),
# quindi non c'e' motivo di ri-trasferire quelli gia' archiviati.
# Nessun --delete: la retention locale e' PIU' LUNGA di quella remota; cancellare
# in mirror vanificherebbe lo scopo dell'archivio.
rsync -az --ignore-existing --partial \
  -e "ssh -o BatchMode=yes -o ConnectTimeout=15" \
  "$SOURCE_SSH:$SOURCE_DIR/"*.dump "$ARCHIVE_DIR/" 2>/dev/null || {
    echo "[pull-backups] ERROR: rsync dalla VM fallito (host irraggiungibile o dir vuota)" >&2
    exit 1
  }

# --- 2. verifica di integrita' su OGNI dump archiviato -------------------------
# `pg_restore --list` legge il TOC del formato custom: se il file e' troncato o
# corrotto fallisce qui, non il giorno in cui serve davvero il restore.
if ! command -v pg_restore >/dev/null 2>&1; then
  echo "[pull-backups] ERROR: pg_restore non in PATH — impossibile verificare i dump" >&2
  exit 1
fi

verified=0
corrupt=0
for f in "$ARCHIVE_DIR"/*.dump; do
  [ -e "$f" ] || continue
  size="$(stat -c %s "$f")"
  if [ "$size" -lt "$MIN_BYTES" ]; then
    echo "[pull-backups] CORROTTO (troppo piccolo: ${size}B): $f" >&2
    corrupt=$((corrupt + 1))
    continue
  fi
  if pg_restore --list "$f" >/dev/null 2>&1; then
    verified=$((verified + 1))
  else
    echo "[pull-backups] CORROTTO (TOC illeggibile): $f" >&2
    corrupt=$((corrupt + 1))
  fi
done

echo "[pull-backups] verificati: $verified dump integri, $corrupt corrotti"

# --- 3. retention locale ------------------------------------------------------
pruned="$(find "$ARCHIVE_DIR" -maxdepth 1 -name '*.dump' -type f -mtime +"$RETENTION_DAYS" -print -delete | wc -l)"
echo "[pull-backups] retention: tenuti <= ${RETENTION_DAYS}d, rimossi $pruned dump vecchi"

total="$(du -sh "$ARCHIVE_DIR" | cut -f1)"
newest="$(find "$ARCHIVE_DIR" -maxdepth 1 -name '*.dump' -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)"
echo "[pull-backups] archivio: $total totali, ultimo: ${newest:-nessuno}"

# Fail loud: un archivio senza dump integri NON e' un backup.
if [ "$verified" -eq 0 ]; then
  echo "[pull-backups] ERROR: nessun dump integro nell'archivio" >&2
  exit 1
fi
if [ "$corrupt" -gt 0 ]; then
  echo "[pull-backups] ERROR: $corrupt dump corrotti in archivio (vedi sopra)" >&2
  exit 1
fi

echo "[pull-backups] done"
