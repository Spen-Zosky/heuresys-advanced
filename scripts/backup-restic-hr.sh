#!/usr/bin/env bash
# backup-restic-hr.sh - copia cifrata (restic) di heuresys_advanced, lalibraiascalza, ruoli DB e .env di heuresys-advanced.
# Dal 2026-10-25 anche il datastore (cluster 16 datastore, porta 5435): heuresys_datastore, heuresys_datastore_modello e i ruoli del cluster.
# Dal 2026-11-04 anche il .env del datastore (letto direttamente da restic, impronte in log/impronte_env.txt).
# Dal 2026-11-26 anche ciò che non sta in Git e non si riscarica (punti 4 e 6 del controllo del 4/11):
# .integrazioni-esterne e .auto-memory di advanced, _scarichi e _pubblicazioni del datastore. libreria/ resta fuori: si riscarica.
# DOVE GIRA. Sulla VM, da cron: copiato in ~/backup-hr/bin/backup_restic_hr.sh. Questa nel repo è la fonte:
#   install -D -m 750 scripts/backup-restic-hr.sh ~/backup-hr/bin/backup_restic_hr.sh
# Archivi: VM /home/ubuntu/backup-restic-hr (2 giornaliere, regola delle 48 ore del 30/10) e Drive rclone:gdrive-hr:HEURESYS-restic (14 giornaliere + 4 settimanali + 3 mensili).
# Dal 2026-10-25 Drive passa dal remote gdrive-hr: client OAuth proprio (progetto Google Cloud heuresys-backup), non quello condiviso di rclone.
# Password: ~/.config/restic/password (la stessa di MOD). Cron: 02:10 (dopo il dump delle 01:30).
# Non tocca hub/. Esito in log/restic_hr.log e log/ultimo_esito.txt.
set -uo pipefail

BASE=${BASE_HR:-/home/ubuntu/backup-hr}
STAGE=$BASE/stage
LOG=$BASE/log/restic_hr.log
ESITO=$BASE/log/ultimo_esito.txt
ALLARME=$BASE/log/ALLARME.txt
DUMPDIR=/home/ubuntu/heuresys-advanced/pg_dump_snapshots/scheduled
ENVFILE=/home/ubuntu/heuresys-advanced/.env
ENVFILE_DS=/home/ubuntu/heuresys-datastore/.env
EXTRA=(/home/ubuntu/heuresys-advanced/.integrazioni-esterne /home/ubuntu/heuresys-advanced/.auto-memory
       /home/ubuntu/heuresys-datastore/_scarichi /home/ubuntu/heuresys-datastore/_pubblicazioni)
REPO_VM=${REPO_VM:-/home/ubuntu/backup-restic-hr}
REPO_DRIVE=${REPO_DRIVE:-rclone:gdrive-hr:HEURESYS-restic}
# Drive: rclone paziente (piu tentativi, timeout lungo) e, se fallisce, fino a 3 nuovi giri a distanza di ATTESA secondi
RCLONE_OPT=(-o rclone.timeout=10m -o "rclone.args=serve restic --stdio --b2-hard-delete --retries 10 --low-level-retries 20 --timeout 5m --tpslimit 8")
ATTESA=${ATTESA_RITENTA:-600}
RITENTA=3
export RESTIC_PASSWORD_FILE=/home/ubuntu/.config/restic/password

log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$LOG"; }
fail() { log "ERRORE: $*"; echo "ERRORE $(date -u +%Y-%m-%dT%H:%M:%SZ) $*" > "$ESITO"; echo "ALLARME $(date -u +%Y-%m-%dT%H:%M:%SZ) backup_restic_hr: $*" >> "$ALLARME"; exit 1; }

mkdir -p "$STAGE" "$BASE/log" "$BASE/locks"

exec 9>"$BASE/locks/backup_restic_hr.lock"
flock -n 9 || { log "altra corsa in atto, esco"; exit 0; }

log "inizio"

# 1. ultimo dump di heuresys_advanced (deve avere meno di 26 ore)
ULTIMO=$(ls -t "$DUMPDIR"/heuresys_advanced_*.dump 2>/dev/null | head -1)
[ -n "$ULTIMO" ] || fail "nessun dump in $DUMPDIR"
ETA=$(( $(date +%s) - $(stat -c %Y "$ULTIMO") ))
[ "$ETA" -lt 93600 ] || fail "dump troppo vecchio ($ETA s): $ULTIMO"
cp -f "$ULTIMO" "$STAGE/heuresys_advanced.dump" || fail "copia dump"
log "dump heuresys_advanced: $(basename "$ULTIMO")"

# 2. altri database e ruoli
sudo -n -u postgres pg_dump -Fc lalibraiascalza > "$STAGE/lalibraiascalza.dump" || fail "pg_dump lalibraiascalza"
sudo -n -u postgres pg_dumpall --globals-only > "$STAGE/pg_ruoli.sql" || fail "pg_dumpall globals"
# 2b. datastore: cluster 16 datastore sulla 5435, dal socket con l'utente ubuntu (peer, nessuna parola d'ordine)
PGBIN=/usr/lib/postgresql/16/bin
PGDS=(-h /var/run/postgresql -p 5435)
for DB in heuresys_datastore heuresys_datastore_modello; do
  "$PGBIN/pg_dump" "${PGDS[@]}" -Fc -d "$DB" -f "$STAGE/$DB.dump" || fail "pg_dump $DB"
done
"$PGBIN/pg_dumpall" "${PGDS[@]}" -l postgres --globals-only -f "$STAGE/datastore_ruoli.sql" || fail "pg_dumpall globals datastore"
log "datastore: heuresys_datastore, heuresys_datastore_modello, ruoli del cluster 5435"
chmod 600 "$STAGE"/*
[ -s "$ENVFILE" ] || fail ".env mancante"
[ -s "$ENVFILE_DS" ] || fail ".env del datastore mancante"
( sha256sum -- "$ENVFILE" "$ENVFILE_DS" ) > "$BASE/log/impronte_env.txt" || fail "impronte dei .env"

# una cartella che manca si dice nel registro e non ferma la copia dei database
PRESENTI=()
for d in "${EXTRA[@]}"; do
  if [ -d "$d" ]; then PRESENTI+=("$d"); else log "avviso: cartella assente, non copiata: $d"; fi
done

# 3. salvataggio: .env letto direttamente da restic (nessuna copia in chiaro)
salva() { # $1 = archivio, $2 = regole di potatura; le opzioni rclone valgono solo per i repository rclone:
  local repo=$1; shift
  local opt=()
  case "$repo" in rclone:*) opt=("${RCLONE_OPT[@]}" --pack-size 64);; esac   # pacchi da 64 MiB: circa 4 volte meno richieste a Drive (25/10)
  restic "${opt[@]}" -r "$repo" backup --host heuresys-vm --tag hr "$STAGE" "$ENVFILE" "$ENVFILE_DS" "${PRESENTI[@]}" --quiet >> "$LOG" 2>&1 || return 1
  restic "${opt[@]}" -r "$repo" forget --host heuresys-vm --tag hr --group-by host,tags "$@" --prune --quiet >> "$LOG" 2>&1 || return 2
  restic "${opt[@]}" -r "$repo" check --read-data-subset=2% --quiet >> "$LOG" 2>&1 || return 3
  return 0
}

salva "$REPO_VM" --keep-daily 2;                                   RV=$?
salva "$REPO_DRIVE" --keep-daily 14 --keep-weekly 4 --keep-monthly 3; RD=$?
N=0
while [ "$RD" -ne 0 ] && [ "$N" -lt "$RITENTA" ]; do
  N=$((N+1))
  log "Drive fallito (codice $RD), nuovo tentativo $N/$RITENTA fra ${ATTESA}s"
  sleep "$ATTESA"
  salva "$REPO_DRIVE" --keep-daily 14 --keep-weekly 4 --keep-monthly 3; RD=$?
done
log "esito VM=$RV Drive=$RD"

if [ "$RV" -ne 0 ] || [ "$RD" -ne 0 ]; then
  fail "VM=$RV Drive=$RD (0=ok, 1=backup, 2=potatura, 3=controllo)"
fi
# 4. dal 2026-10-29 (P5, approvata da Enzo): a corsa riuscita su VM e Drive l'appoggio si svuota. I file sono nelle istantanee
# di oggi e la notte dopo si rifanno; le impronte restano in log/impronte_stage.txt per prova_ripristino_datastore.sh.
( cd "$STAGE" && sha256sum -- *.dump *.sql ) > "$BASE/log/impronte_stage.txt" || fail "impronte dello stage"
rm -f -- "$STAGE"/*.dump "$STAGE"/*.sql
log "appoggio svuotato: impronte in log/impronte_stage.txt"
echo "OK $(date -u +%Y-%m-%dT%H:%M:%SZ) dump=$(basename "$ULTIMO")" > "$ESITO"
log "fine OK"
