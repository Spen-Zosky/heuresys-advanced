#!/usr/bin/env bash
#
# scripts/pacchetti-git-drive.sh — copia fuori sede della storia Git di advanced e datastore.
#
# PERCHE' ESISTE. Il pacchetto del datastore su Drive era fermo al 21/10/2026: lo script
# che lo rinnovava vive sul PC, congelato dal 22/10, e advanced non ne aveva uno. Se si
# perde GitHub devono restare un file solo, verificato, con tutta la storia.
#
# COSA FA. Per ogni repository: fetch, `git bundle create --all`, e sostituzione su Drive
# solo dopo le guardie. Il pacchetto in carica diventa `.precedente`. Se una guardia
# fallisce la destinazione resta com'era e scatta l'allarme. Il lavoro non committato e i
# file ignorati (`.env` compresi) non entrano: non sono in Git.
#
# DOVE GIRA. Sulla VM, da cron, copiato in ~/backup-hr/bin/.
# Piano: docs/piani/PIANO_pacchetti-git-drive_20261104.md
#
# Variabili: BASE_HR PACCHETTI_REMOTE PACCHETTI_REPOS
# Uscita: 0 = tutti in carica · 1 = almeno un repository non rinnovato
set -uo pipefail

BASE=${BASE_HR:-$HOME/backup-hr}
REMOTE=${PACCHETTI_REMOTE:-gdrive-hr:Heuresys}
REPOS=${PACCHETTI_REPOS:-heuresys-advanced heuresys-datastore}
LOG=$BASE/log/pacchetti_git.log
ESITO=$BASE/log/pacchetti_git_esito.txt
ALLARME=$BASE/log/ALLARME.txt

log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$LOG"; }

exec 9>"$BASE/locks/pacchetti_git.lock"
flock -n 9 || { log "altra corsa in atto, esco"; exit 0; }

TMP=$(mktemp -d "$BASE/.pacchetti.XXXXXX") || exit 1
trap 'rm -rf -- "$TMP"' EXIT

pacchetto() {
  local nome=$1 repo=$HOME/$1 dest=$REMOTE/$1 file=$1.bundle locale=$TMP/$1.bundle
  local atteso nel_pacchetto peso in_carica impronta riletta

  git -C "$repo" fetch origin --quiet || { log "$nome: fetch fallita"; return 1; }
  git -C "$repo" bundle create --quiet "$locale" --all || { log "$nome: costruzione fallita"; return 1; }
  git -C "$repo" bundle verify --quiet "$locale" 2>> "$LOG" || { log "$nome: verifica fallita"; return 1; }

  # il pacchetto deve contenere la main di GitHub appena letta
  atteso=$(git -C "$repo" rev-parse origin/main)
  nel_pacchetto=$(git bundle list-heads "$locale" refs/remotes/origin/main | cut -d' ' -f1)
  [ "$atteso" = "$nel_pacchetto" ] || { log "$nome: origin/main assente dal pacchetto"; return 1; }

  # un repository danneggiato farebbe un pacchetto piccolo che sostituisce quello buono
  peso=$(stat -c %s "$locale")
  in_carica=$(rclone lsf --format s "$dest/$file" 2>/dev/null | head -1)
  if [ -n "$in_carica" ] && [ "$peso" -lt $(( in_carica / 2 )) ]; then
    log "$nome: pacchetto da $peso byte contro $in_carica in carica, non sostituisco"
    return 1
  fi

  impronta=$(sha256sum "$locale" | cut -d' ' -f1)
  rclone copyto "$locale" "$dest/$file.nuovo" --retries 5 2>> "$LOG" || { log "$nome: invio fallito"; return 1; }
  riletta=$(rclone cat "$dest/$file.nuovo" 2>> "$LOG" | sha256sum | cut -d' ' -f1)
  [ "$impronta" = "$riletta" ] || { log "$nome: impronta riletta diversa"; return 1; }

  if [ -n "$in_carica" ]; then
    rclone moveto "$dest/$file" "$dest/$file.precedente" 2>> "$LOG" || { log "$nome: precedente non messo da parte"; return 1; }
  fi
  rclone moveto "$dest/$file.nuovo" "$dest/$file" 2>> "$LOG" || { log "$nome: sostituzione fallita, in carica resta .nuovo"; return 1; }

  log "$nome: OK $peso byte, sha256 $impronta, origin/main $atteso"
  rm -f -- "$locale"
}

log "inizio"
falliti=""
for nome in $REPOS; do
  pacchetto "$nome" || falliti="$falliti $nome"
done

if [ -n "$falliti" ]; then
  echo "ERRORE $(date -u +%Y-%m-%dT%H:%M:%SZ) non rinnovati:$falliti" > "$ESITO"
  echo "ALLARME $(date -u +%Y-%m-%dT%H:%M:%SZ) pacchetti-git-drive: non rinnovati:$falliti" >> "$ALLARME"
  log "fine con errori:$falliti"
  exit 1
fi
echo "OK $(date -u +%Y-%m-%dT%H:%M:%SZ) $REPOS" > "$ESITO"
log "fine OK"
