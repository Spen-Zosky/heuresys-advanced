#!/usr/bin/env bash
#
# scripts/copia-fase-chiave.sh — crea, UNA VOLTA, la coppia di chiavi gpg delle copie di fase
# (ADR-0052). Si lancia sulla VM in un terminale SSH, da Enzo: la passphrase la scrive solo lui,
# qui, e non passa mai da una chat.
#
#   chiave PUBBLICA  -> ~/.config/heuresys/copie-fase.pub.asc sulla VM. Serve solo a CIFRARE:
#                       scripts/copia-fase.sh drive la usa a ogni fine fase, senza chiedere niente.
#   chiave PRIVATA   -> Drive, 30_cassaforte/copie-fase_chiave_privata_<AAAAMMGG>.asc, protetta
#                       dalla passphrase. Serve ad APRIRE una copia, e sulla VM non resta.
#
# Passi: 1 controlli · 2 creazione (chiede la passphrase) · 3 prova di apertura (la chiede di
# nuovo: un errore di battitura al passo 2 si vede qui) · 4 chiave privata su Drive (la chiede una
# terza volta per esportarla) e verifica dell'impronta riscaricandola · 5 chiave pubblica al suo posto · 6 la cartella di lavoro con la chiave privata
# viene tolta dalla VM.
#
# Esiti: 0 fatto · 1 rosso, niente e' stato messo al suo posto · 3 la chiave c'e' gia'
set -euo pipefail

REMOTE="${COPIE_CASSAFORTE:-gdrive-hr:Heuresys/30_cassaforte}"
CFG="$HOME/.config/heuresys"
PUB="$CFG/copie-fase.pub.asc"
OGGI="$(TZ=Europe/Rome date +%Y%m%d)"
NOME_PRIV="copie-fase_chiave_privata_${OGGI}.asc"
UID_CHIAVE="Heuresys copie di fase advanced <copie-fase@heuresys.invalid>"

rosso() { printf '\nROSSO: %s\nNiente e'"'"' stato messo al suo posto.\n' "$*" >&2; exit 1; }

echo "1/6 Controlli."
for c in gpg rclone sha256sum; do command -v "$c" >/dev/null || rosso "manca $c"; done
[ -t 0 ] || rosso "serve un terminale vero (ssh oracle-vm-default, poi questo comando)"
if [ -f "$PUB" ]; then
  echo "La chiave pubblica c'e' gia' ($PUB). Non ne creo un'altra."; exit 3
fi
rclone lsf --max-depth 1 "$REMOTE" >/dev/null 2>&1 || rosso "rclone non vede $REMOTE"
rclone lsf "$REMOTE/$NOME_PRIV" 2>/dev/null | grep -q . && rosso "su Drive esiste gia' $NOME_PRIV"

mkdir -p "$CFG"; chmod 700 "$CFG"
LAV="$(mktemp -d "$CFG/.chiave-lavoro.XXXX")"; chmod 700 "$LAV"
trap 'rm -rf "$LAV"' EXIT   # contiene la chiave privata: non deve restare sulla VM
export GNUPGHOME="$LAV/gnupg"; mkdir -m 700 "$GNUPGHOME"
export GPG_TTY; GPG_TTY="$(tty)"

echo
echo "2/6 Creo la coppia di chiavi. Scegli ora una passphrase lunga e conservala SOLO tu"
echo "    (non scriverla in chat). Te la chiedero' tre volte, ai passi 2, 3 e 4."
gpg --pinentry-mode loopback --quick-gen-key "$UID_CHIAVE" default default never \
  || rosso "creazione della chiave fallita"
FPR="$(gpg --with-colons --fingerprint | awk -F: '/^fpr/{print $10; exit}')"
[ -n "$FPR" ] || rosso "impronta della chiave non letta"

echo
echo "3/6 Provo ad aprire un messaggio cifrato: riscrivi la stessa passphrase."
gpgconf --kill gpg-agent 2>/dev/null || true   # dimentica la passphrase: la prova deve chiederla davvero
FRASE="prova copie di fase $OGGI $RANDOM"
APERTA="$(printf '%s' "$FRASE" | gpg --batch --trust-model always -r "$FPR" -e | gpg --pinentry-mode loopback -d 2>/dev/null || true)"
[ "$APERTA" = "$FRASE" ] || rosso "non sono riuscito ad aprire il messaggio: passphrase diversa?"
echo "    aperto: la passphrase funziona."

echo
echo "4/6 Porto la chiave privata (protetta dalla passphrase) su Drive e la verifico."
gpg --armor --pinentry-mode loopback --export-secret-keys "$FPR" > "$LAV/$NOME_PRIV" \
  || rosso "esportazione della chiave privata fallita"
grep -q 'BEGIN PGP PRIVATE KEY BLOCK' "$LAV/$NOME_PRIV" || rosso "file della chiave privata non valido"
LOC="$(sha256sum "$LAV/$NOME_PRIV" | cut -d' ' -f1)"
rclone copyto "$LAV/$NOME_PRIV" "$REMOTE/$NOME_PRIV"
REM="$(rclone hashsum sha256 --download "$REMOTE/$NOME_PRIV" | cut -d' ' -f1)"
[ "$LOC" = "$REM" ] || rosso "l'impronta su Drive ($REM) non coincide con quella locale ($LOC)"
echo "    su Drive: $REMOTE/$NOME_PRIV, impronta $LOC"

echo
echo "5/6 Metto la chiave pubblica al suo posto."
gpg --armor --export "$FPR" > "$PUB"; chmod 644 "$PUB"
printf '%s\n' "$FPR" > "$CFG/copie-fase.fpr"
printf '%s | chiave delle copie di fase creata, impronta %s, privata in %s/%s (sha256 %s)\n' \
  "$(TZ=Europe/Rome date '+%Y-%m-%d %H:%M %Z')" "$FPR" "$REMOTE" "$NOME_PRIV" "$LOC" >> "$CFG/copie-fase.registro"

echo
echo "6/6 Tolgo dalla VM la cartella di lavoro con la chiave privata."
gpgconf --kill gpg-agent 2>/dev/null || true
echo
echo "FATTO. Impronta della chiave: $FPR"
echo "Per aprire un giorno una copia:"
echo "  rclone copyto $REMOTE/$NOME_PRIV chiave.asc && gpg --import chiave.asc"
echo "  gpg -d database.dump.gpg > database.dump      (chiede la passphrase)"
