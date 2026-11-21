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
TMPS=()
trap 'rm -f "${TMPS[@]}"' EXIT   # i temporanei contengono il file d'ambiente: non restano a meta'

[ -f "$ENVF" ] || { echo "[proprietario-pw] ERRORE: manca $ENVF" >&2; exit 1; }

valore_env() { sed -n 's/^POSTGRES_PASSWORD=//p' "$ENVF" | tail -n1 | tr -d '"'"'"' \r'; }
valore_file() { [ -f "$FILE" ] && sed -n 's/^POSTGRES_PASSWORD=//p' "$FILE" | head -n1 || true; }

prova() { # $1 = password; esito 0 se il proprietario entra (password via ambiente, mai fra gli argomenti)
  PGPASSWORD="$1" psql -X -w -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" \
    -U heuresys -d heuresys_advanced -tAc "select 1" >/dev/null 2>&1
}

# Copie che contengono ANCORA la password: .env.bak di assegna-password-app.sh,
# .env.bak-<data> di propagate-secret-rotation.sh, banco.env di banco-verifica.sh,
# ~/.pgpass, cestini. Cerca per contenuto, non per nome; non stampa mai il valore
# (il pattern passa a grep da un file, non dalla riga di comando).
copie_residue() { # $1 = password; stampa i percorsi
  local pat; pat="$(mktemp)"; TMPS+=("$pat"); printf '%s\n' "$1" > "$pat"
  find "$HOME" -maxdepth 6 \( -name node_modules -o -name .git -o -name .next -o -name .cache -o -name .turbo \) -prune -o \
    -type f \( -name '.env*' -o -name '*.env' -o -name '*.env.*' -o -name '.pgpass' \) -print 2>/dev/null \
    | while IFS= read -r c; do
        [ "$(readlink -f "$c")" = "$ENVF" ] && continue
        [ "$(readlink -f "$c")" = "$(readlink -f "$FILE" 2>/dev/null)" ] && continue
        grep -qF -f "$pat" "$c" 2>/dev/null && echo "$c"
      done
  rm -f "$pat"
}

# Riscrive la riga POSTGRES_PASSWORD con il valore di $NUOVO (variabile d'ambiente,
# non argomento: awk -v la mostrerebbe a ps e interpreterebbe le barre rovesciate).
# Temporaneo nella stessa cartella + mv: la sostituzione e' atomica.
riscrivi_riga() {
  local tmp; tmp="$(mktemp "$ENVF.XXXXXX")"; TMPS+=("$tmp")
  chmod --reference="$ENVF" "$tmp"
  NUOVO="$1" awk 'BEGIN{v=ENVIRON["NUOVO"]; f=0} /^POSTGRES_PASSWORD=/{print "POSTGRES_PASSWORD=" v; f=1; next} {print} END{if(!f) print "POSTGRES_PASSWORD=" v}' "$ENVF" > "$tmp"
  mv -f "$tmp" "$ENVF"
}

case "$MODO" in
  --verifica)
    e="$(valore_env)"; f="$(valore_file)"
    echo "[proprietario-pw] file d'ambiente: $([ -n "$e" ] && echo 'contiene la password' || echo 'senza password')"
    echo "[proprietario-pw] $FILE: $([ -n "$f" ] && echo 'presente' || echo 'assente')"
    [ -n "$f" ] && { prova "$f" && echo "[proprietario-pw] la password del file entra" || echo "[proprietario-pw] la password del file NON entra"; }
    pw="${f:-$e}"
    if [ -n "$pw" ]; then
      r="$(copie_residue "$pw")"
      if [ -n "$r" ]; then echo "[proprietario-pw] copie che contengono ancora la password:"; printf '%s\n' "$r" | sed 's/^/  /'
      else echo "[proprietario-pw] nessuna copia residua della password sotto $HOME"; fi
    fi
    exit 0 ;;
  --ritorna)
    f="$(valore_file)"; [ -n "$f" ] || { echo "[proprietario-pw] ERRORE: $FILE assente o vuoto" >&2; exit 1; }
    riscrivi_riga "$f"
    # Post-condizione: la riga c'e', e' quella del file, ed entra davvero.
    [ "$(valore_env)" = "$f" ] || { echo "[proprietario-pw] ERRORE: la riga nel file d'ambiente non coincide" >&2; exit 1; }
    prova "$(valore_env)" || { echo "[proprietario-pw] ERRORE: la password rimessa non entra" >&2; exit 1; }
    unset f
    echo "[proprietario-pw] ok — password rimessa nel file d'ambiente e verificata"
    exit 0 ;;
  sposta) ;;
  *) echo "uso: $0 [--verifica|--ritorna]" >&2; exit 2 ;;
esac

e="$(valore_env)"
if [ -z "$e" ]; then
  [ -n "$(valore_file)" ] || { echo "[proprietario-pw] ERRORE: nessuna password ne' nel file d'ambiente ne' in $FILE" >&2; exit 1; }
  e="$(valore_file)"; echo "[proprietario-pw] gia' spostata; controllo le copie residue"
else
  # Misura prima: la password deve entrare davvero, o si sposterebbe un valore morto.
  prova "$e" || { echo "[proprietario-pw] ERRORE: la password del file d'ambiente non entra, non sposto niente" >&2; exit 1; }

  mkdir -p "$DIR"; chmod 700 "$DIR"
  tmp="$(mktemp)"; TMPS+=("$tmp"); printf 'POSTGRES_PASSWORD=%s\n' "$e" > "$tmp"; install -m 600 "$tmp" "$FILE"; rm -f "$tmp"

  # Guardia: il file nuovo deve funzionare PRIMA di svuotare il vecchio.
  prova "$(valore_file)" || { echo "[proprietario-pw] ERRORE: il file nuovo non entra, il file d'ambiente resta com'era" >&2; exit 1; }

  # Niente copia del vecchio file: conterrebbe la password in chiaro accanto al repo.
  # L'unica riga cambiata e' questa, e --ritorna la rimette dal file nuovo.
  riscrivi_riga ""

  # Post-condizione: nel file d'ambiente non resta la password, il file nuovo entra.
  [ -z "$(valore_env)" ] || { echo "[proprietario-pw] ERRORE: la password e' ancora nel file d'ambiente" >&2; exit 1; }
  prova "$(valore_file)" || { echo "[proprietario-pw] ERRORE: post-condizione, il file nuovo non entra" >&2; exit 1; }
fi

# Le copie vecchie vanificherebbero lo spostamento: niente «ok» finche' ci sono.
r="$(copie_residue "$e")"; unset e
if [ -n "$r" ]; then
  echo "[proprietario-pw] NON FINITO — queste copie contengono ancora la password del proprietario:" >&2
  printf '%s\n' "$r" | sed 's/^/  /' >&2
  echo "[proprietario-pw] sono copie di un segreto: vanno cancellate, non spostate (anche _da_eliminare/ e' sotto $HOME); serve il si' di Enzo, poi si rilancia" >&2
  exit 3
fi
echo "[proprietario-pw] ok — password del proprietario solo in $FILE, nessuna copia residua sotto $HOME"
