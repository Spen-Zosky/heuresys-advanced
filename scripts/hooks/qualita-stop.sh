#!/bin/sh
# qualita-stop.sh — hook Stop: controllo dei tipi e test dei SOLI pacchetti toccati.
# Uscita 2 = ci sono errori nei file che hai modificato: Claude li corregge prima di fermarsi.
# - tipi: `tsc --noEmit` del pacchetto, ma contano solo gli errori nei file modificati
#   (rumore preesistente o dist di @heuresys/shared stantio non bloccano);
# - test: solo i test collegati ai file modificati (`vitest related`); nell'api solo il
#   livello unit, perche' l'integration vuole il database. La suite intera resta alla CI.
# Budget totale: 55 secondi; se finisce, si ferma senza bloccare.
set -u
INPUT=$(cat)
ACTIVE=$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).stop_hook_active===true))}catch(e){process.stdout.write("false")}})')
[ "$ACTIVE" = "true" ] && exit 0   # gia' rimandato una volta: niente cicli infiniti
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$ROOT" || exit 0
CHANGED=$(git status --porcelain --untracked-files=all 2>/dev/null | cut -c4- | sed 's/.* -> //' | grep -E '^(apps|packages)/[^/]+/.*\.(ts|tsx|mts)$' | grep -vE '(^|/)(node_modules|dist|\.next)/')
[ -n "$CHANGED" ] || exit 0
END=$(( $(date +%s) + 55 ))
left() { n=$(( END - $(date +%s) )); [ "$n" -gt 1 ] && echo "$n" || echo 0; }
FAIL=""
for PKG in $(printf '%s\n' "$CHANGED" | cut -d/ -f1-2 | sort -u); do
  [ -f "$PKG/tsconfig.json" ] || continue
  FILES=$(printf '%s\n' "$CHANGED" | grep "^$PKG/" | sed "s|^$PKG/||")
  T=$(left); [ "$T" -gt 0 ] || break
  OUT=$(cd "$PKG" && timeout "$T" pnpm exec tsc -p tsconfig.json --noEmit 2>&1)
  if [ $? -ne 124 ]; then
    # solo gli errori che nominano un file modificato
    ERR=""
    for f in $FILES; do
      ERR="$ERR$(printf '%s\n' "$OUT" | grep -F "$f" | grep 'error TS')"
    done
    [ -n "$ERR" ] && FAIL="$FAIL
[tipi $PKG]
$ERR"
  fi
  # test collegati
  case "$PKG" in
    packages/shared) continue ;;
    apps/api) CFG="-c vitest.unit.config.ts" ;;
    *) CFG="" ;;
  esac
  [ -f "$PKG/vitest.config.ts" ] || [ -f "$PKG/vitest.unit.config.ts" ] || continue
  T=$(left); [ "$T" -gt 0 ] || break
  # shellcheck disable=SC2086
  TOUT=$(cd "$PKG" && timeout "$T" pnpm exec vitest related --run --passWithNoTests $CFG $FILES 2>&1)
  TRC=$?
  if [ "$TRC" -ne 0 ] && [ "$TRC" -ne 124 ]; then
    FAIL="$FAIL
[test $PKG]
$(printf '%s\n' "$TOUT" | tail -40)"
  fi
done
if [ -n "$FAIL" ]; then
  printf 'Controllo di chiusura: errori nei file che hai modificato, correggili prima di fermarti.%s\n' "$FAIL" >&2
  exit 2
fi
exit 0
