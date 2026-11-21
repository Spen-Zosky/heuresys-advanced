#!/usr/bin/env bash
# deploy/postgres/sposta-password-proprietario.sh — B2, tappa 3 (2026-11-21)
#
# Toglie la password del proprietario `heuresys` dal file d'ambiente del repo
# (che leggono anche gli agenti) e la deposita in
#     ~/.config/heuresys-proprietario/db.env   (cartella 700, file 600)
# dove la leggono solo gli script di migrazione e rilascio, tramite
# deploy/postgres/env-proprietario.sh.
#
# Va eseguito SULLA VM, una volta, DOPO che la PR che porta env-proprietario.sh
# e' unita e rilasciata (altrimenti le migrazioni del deploy non trovano la
# password). La password non viene mai stampata ne' passata come argomento.
#
# Nel file d'ambiente la riga resta come `POSTGRES_PASSWORD=` (vuota): lo schema
# dell'API la pretende presente; in produzione l'API usa gia' `heuresys_app`.
#
# Rollback dichiarato: copia la riga da ~/.config/heuresys-proprietario/db.env
# nel file d'ambiente (deploy/postgres/sposta-password-proprietario.sh --ritorna).
#
# USO
#     bash deploy/postgres/sposta-password-proprietario.sh            # sposta
#     bash deploy/postgres/sposta-password-proprietario.sh --verifica # solo legge
#     bash deploy/postgres/sposta-password-proprietario.sh --ritorna  # rimette
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENVF="${ENV_FILE:-$ROOT/.env}"
ENVF="$(readlink -f "$ENVF")"
DIR="$HOME/.config/heuresys-proprietario"
FILE="$DIR/db.env"
MODO="${1:-sposta}"

[ -f "$ENVF" ] || { echo "[proprietario-pw] ERRORE: manca $ENVF" >&2; exit 1; }

valore_env() { sed -n 's/^POSTGRES_PASSWORD=//p' "$ENVF" | tail -n1 | tr -d '"'"'"' \r'; }
valore_file() { [ -f "$FILE" ] && sed -n 's/^POSTGRES_PASSWORD=//p' "$FILE" | head -n1 || true; }

prova() { # $1 = password; esito 0 se il proprietario entra
  PGPASSWORD="$1" psql -X -w -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" \
    -U heuresys -d heuresys_advanced -tAc "select 1" >/dev/null 2>&1
}

case "$MODO" in
  --verifica)
    e="$(valore_env)"; f="$(valore_file)"
    echo "[proprietario-pw] file d'ambiente: $([ -n "$e" ] && echo 'contiene la password' || echo 'senza password')"
    echo "[proprietario-pw] $FILE: $([ -n "$f" ] && echo 'presente' || echo 'assente')"
    [ -n "$f" ] && { prova "$f" && echo "[proprietario-pw] la password del file entra" || echo "[proprietario-pw] la password del file NON entra"; }
    exit 0 ;;
  --ritorna)
    f="$(valore_file)"; [ -n "$f" ] || { echo "[proprietario-pw] ERRORE: $FILE assente o vuoto" >&2; exit 1; }
    tmp="$(mktemp)"; awk -v v="$f" '/^POSTGRES_PASSWORD=/{print "POSTGRES_PASSWORD=" v; next} {print}' "$ENVF" > "$tmp"
    cat "$tmp" > "$ENVF"; rm -f "$tmp"; unset f
    echo "[proprietario-pw] ok — password rimessa nel file d'ambiente"
    exit 0 ;;
  sposta) ;;
  *) echo "uso: $0 [--verifica|--ritorna]" >&2; exit 2 ;;
esac

e="$(valore_env)"
if [ -z "$e" ]; then
  [ -n "$(valore_file)" ] && { echo "[proprietario-pw] gia' spostata, niente da fare"; exit 0; }
  echo "[proprietario-pw] ERRORE: nessuna password ne' nel file d'ambiente ne' in $FILE" >&2; exit 1
fi

# Misura prima: la password deve entrare davvero, o si sposterebbe un valore morto.
prova "$e" || { echo "[proprietario-pw] ERRORE: la password del file d'ambiente non entra, non sposto niente" >&2; exit 1; }

mkdir -p "$DIR"; chmod 700 "$DIR"
tmp="$(mktemp)"; printf 'POSTGRES_PASSWORD=%s\n' "$e" > "$tmp"; install -m 600 "$tmp" "$FILE"; rm -f "$tmp"

# Guardia: il file nuovo deve funzionare PRIMA di svuotare il vecchio.
prova "$(valore_file)" || { echo "[proprietario-pw] ERRORE: il file nuovo non entra, il file d'ambiente resta com'era" >&2; exit 1; }

# Niente copia del vecchio file: conterrebbe la password in chiaro accanto al repo.
# L'unica riga cambiata e' questa, e --ritorna la rimette dal file nuovo.
tmp="$(mktemp)"; awk '/^POSTGRES_PASSWORD=/{print "POSTGRES_PASSWORD="; next} {print}' "$ENVF" > "$tmp"
cat "$tmp" > "$ENVF"; rm -f "$tmp"; unset e

# Post-condizione: nel file d'ambiente non resta la password, il file nuovo entra.
[ -z "$(valore_env)" ] || { echo "[proprietario-pw] ERRORE: la password e' ancora nel file d'ambiente" >&2; exit 1; }
prova "$(valore_file)" || { echo "[proprietario-pw] ERRORE: post-condizione, il file nuovo non entra" >&2; exit 1; }
echo "[proprietario-pw] ok — password del proprietario solo in $FILE"
