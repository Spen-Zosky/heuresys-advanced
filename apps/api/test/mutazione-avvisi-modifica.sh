#!/usr/bin/env bash
# Mutazione per la prova di #265 F3: si guasta l'aggancio dell'avviso e la prova DEVE andare rossa (almeno due test per mutazione).
# Si lancia sul gemello, in una worktree usa-e-getta dove le dipendenze sono installate:
#   bash apps/api/test/mutazione-avvisi-modifica.sh <radice_worktree>
# Ogni mutazione parte da una copia di riserva del file e la rimette a posto alla fine (anche in caso di errore).
set -uo pipefail
RADICE="${1:?radice della worktree}"
API="$RADICE/apps/api"
SVC="$API/src/modules/hierarchy-levels/service.ts"
LOG="$API/src/modules/hierarchy-levels/logic.ts"
cd "$API"
set -a; . "$RADICE/.env"; set +a
cp "$SVC" "$SVC.orig"; cp "$LOG" "$LOG.orig"
ripristina() { cp "$SVC.orig" "$SVC"; cp "$LOG.orig" "$LOG"; }
trap ripristina EXIT

corri() {
  local nome="$1"
  local fuori
  fuori="$(pnpm exec vitest run test/hierarchy-levels-modifiche.integration.test.ts 2>&1)"
  local rossi
  rossi="$(printf '%s\n' "$fuori" | grep -E 'Tests ' | head -1 | sed 's/\x1b\[[0-9;]*m//g')"
  echo "[$nome] $rossi"
}

echo "== riferimento (nessuna mutazione)"; corri "intatto"

echo "== M1: gli avvisi delle modifiche di unita' non arrivano mai alla risposta"
sed -i 's|return { risultato, avvisi: dopo === null ? \[\] : avvisiNuovi(prima, dopo) };|return { risultato, avvisi: [] };|' "$SVC"
grep -c 'return { risultato, avvisi: \[\] };' "$SVC" | sed 's/^/  righe mutate: /'
corri "M1"; ripristina

echo "== M2: avvisiNuovi lascia passare anche gli avvisi che c'erano gia'"
sed -i 's|return dopo.filter((a) => !gia.has(chiave(a)));|return [...dopo];|' "$LOG"
grep -c 'return \[...dopo\];' "$LOG" | sed 's/^/  righe mutate: /'
corri "M2"; ripristina

echo "== M3: l'assegnazione proposta non calcola gli avvisi"
sed -i 's|return avvisiNuovi(avvisi, verifica(dopo, scala).avvisi);|return [];|' "$SVC"
grep -c 'return \[\];' "$SVC" | sed 's/^/  righe con return []: /'
corri "M3"; ripristina

echo "== dopo il ripristino"; corri "ripristinato"
