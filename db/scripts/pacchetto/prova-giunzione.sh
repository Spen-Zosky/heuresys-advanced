#!/usr/bin/env bash
# db/scripts/pacchetto/prova-giunzione.sh — la giunzione datastore -> advanced, provata su una COPIA usa-e-getta (W0-A1).
#
# Uso (sul gemello, linux-pc):  bash db/scripts/pacchetto/prova-giunzione.sh <pacchetto.json> <cartella_uscita> [nome_copia]
#
# 1. copia del database del gemello con `createdb --template` (l'originale non si tocca; se la copia c'e' gia' si ferma: non cancella);
# 2. applica alla copia la catena delle migrazioni (migrate.sh con un .env temporaneo che cambia solo POSTGRES_DB);
# 3. carica il pacchetto, lo rilegge (confronto per percorso e per intero), costruisce il piano, pubblica sulla copia e costruisce
#    il modello in un tenant nuovo della copia;
# 4. scrive gli esiti JSON nella cartella di uscita.
# La password del database non esce da qui: la legge il .env del gemello e la passa al processo figlio.
set -euo pipefail
PKG="${1:?serve il pacchetto .json}"; OUT="${2:?serve la cartella di uscita}"
COPIA="${3:-heuresys_advanced_w0a1_prova1}"
ORIG="${ORIGINE_DB:-heuresys_advanced}"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
case "$COPIA" in *_prova[0-9]*) ;; *) echo "rifiuto: $COPIA non e' una copia di prova (_prova<N>)" >&2; exit 2 ;; esac
mkdir -p "$OUT"
sudo -n -u postgres psql -Atc "SELECT 1" >/dev/null || { echo "serve il gemello (sudo -u postgres)" >&2; exit 2; }
if [ "$(sudo -u postgres psql -Atc "SELECT count(*) FROM pg_database WHERE datname='$COPIA'")" != 0 ]; then
  echo "la copia $COPIA c'e' gia': scegli un altro nome (niente si cancella)" >&2; exit 2
fi
set -a; . "$ROOT/.env"; set +a
echo "== copia $ORIG -> $COPIA"
sudo -u postgres createdb -O "$POSTGRES_USER" -T "$ORIG" "$COPIA"
echo "== migrazioni sulla copia"
ENVT="$(mktemp)"; trap 'rm -f "$ENVT"' EXIT
grep -v '^POSTGRES_DB=' "$ROOT/.env" > "$ENVT"; echo "POSTGRES_DB=$COPIA" >> "$ENVT"
bash "$ROOT/db/scripts/migrate.sh" "$ENVT" > "$OUT/migrazioni.out" 2>&1 || { tail -20 "$OUT/migrazioni.out"; exit 1; }
tail -2 "$OUT/migrazioni.out"
# shellcheck disable=SC1090
. "$HOME/.nvm/nvm.sh" >/dev/null; nvm use 22 >/dev/null
export PGHOST=localhost PGPORT="${POSTGRES_PORT:-5432}" PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD"
ACC="$ROOT/db/scripts/pacchetto/accogli-pacchetto.mjs"
echo "== carica"; node "$ACC" carica "$COPIA" "$PKG" "$OUT/carica.json" > "$OUT/carica.out" 2>&1 || { cat "$OUT/carica.out"; exit 1; }
echo "== rileggi"; node "$ACC" rileggi "$COPIA" "$PKG" "$OUT/rileggi.json" > "$OUT/rileggi.out" 2>&1 || { head -40 "$OUT/rileggi.out"; exit 1; }
VER="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).versione)' "$OUT/carica.json")"
echo "== attiva (versione $VER)"
cd "$ROOT/apps/api"
pnpm exec tsx "$ROOT/db/scripts/pacchetto/attiva-modello.ts" "$COPIA" "$VER" "$OUT/attiva_prima.json" > "$OUT/attiva_prima.out" 2>&1 || true
pnpm exec tsx "$ROOT/db/scripts/pacchetto/attiva-modello.ts" "$COPIA" "$VER" "$OUT/attiva.json" --pubblica-sulla-copia --costruisci W0A1_PROVA > "$OUT/attiva.out" 2>&1 || { cat "$OUT/attiva.out"; exit 1; }
echo "copia: $COPIA  versione: $VER"
