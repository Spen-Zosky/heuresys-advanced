#!/usr/bin/env bash
# ============================================================================
# scripts/ci/tree-gia-verificato.sh — la seconda passata di CI, quando e' un doppione.
#
# PERCHE' ESISTE (2026-11-19, decisione di Enzo). Ogni rilascio faceva girare la CI due
# volte: sulla PR e, dopo l'unione, di nuovo sul commit di main. C'e' un solo runner
# (linux-pc), quindi la seconda passata raddoppiava l'attesa. Se il commit arrivato su
# main ha lo STESSO albero (tree) che la CI della PR ha gia' visto verde, la seconda
# passata non dice niente di nuovo: per tornare indietro ci sono gia' il backup verificato
# e la copia di ritorno (rilascia.sh G4).
#
# COSA FA. Solo su evento `push` (main). Calcola l'albero del commit e cerca, fra le corse
# RIUSCITE dello stesso workflow lanciate da una pull_request, una il cui commit di testa
# abbia lo stesso albero. Se la trova scrive `skip=true` e i job veri non partono: la corsa
# di main risulta verde (e lo e', per l'albero) e rilascia.sh / deploy-watch la accettano
# come sempre. Se l'albero e' diverso (merge commit, PR rimasta indietro, rebase che ha
# cambiato qualcosa, push diretto) o se qualunque cosa non torna, `skip=false`: la CI su
# main gira per intero. Ogni errore degrada verso «gira», mai verso il silenzio.
#
# Il tree di una squash e' quello della testa della PR solo se la PR era allineata alla
# punta di main: se non lo era, gli alberi differiscono e la CI su main resta obbligatoria.
#
# Env: GITHUB_EVENT_NAME GITHUB_REPOSITORY GITHUB_SHA WORKFLOW_FILE GH_TOKEN GITHUB_OUTPUT
#      (opzionale) GITHUB_STEP_SUMMARY; per i test TREE_GIA_FIXTURE=<dir> con runs.json e
#      commits/<sha>.json al posto dell'API.
# ============================================================================
set -uo pipefail

OUT="${GITHUB_OUTPUT:-/dev/stdout}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
esito() {  # esito <true|false> <motivo>
  echo "[tree-gia-verificato] skip=$1 — $2" >&2
  printf 'skip=%s\n' "$1" >> "$OUT"
  printf '**tree-gia-verificato** (%s): skip=%s — %s\n' "${WORKFLOW_FILE:-?}" "$1" "$2" >> "$SUMMARY"
  exit 0
}

[ "${GITHUB_EVENT_NAME:-}" = "push" ] || esito false "evento ${GITHUB_EVENT_NAME:-?}: la CI della PR gira sempre"
[ -n "${WORKFLOW_FILE:-}" ] || esito false "workflow non indicato"
SHA="${GITHUB_SHA:-}"
TREE="$(git rev-parse --verify -q "${SHA}^{tree}" 2>/dev/null)" || esito false "albero di ${SHA:0:8} non leggibile"

api() {  # api <percorso>  -> JSON su stdout, codice != 0 se non risponde
  if [ -n "${TREE_GIA_FIXTURE:-}" ]; then cat "$TREE_GIA_FIXTURE/$1.json" 2>/dev/null; return; fi
  curl -fsS -m 20 -H "Authorization: Bearer ${GH_TOKEN:-}" -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/${GITHUB_REPOSITORY}/$1"
}

RUNS="$(api "actions/workflows/${WORKFLOW_FILE}/runs?event=pull_request&status=success&per_page=30" | tr -d '\n')" \
  || esito false "elenco delle corse non leggibile"
[ -n "$RUNS" ] || esito false "elenco delle corse vuoto o non leggibile"

TESTE="$(printf '%s' "$RUNS" | python3 -c '
import json, sys, os
repo = os.environ.get("GITHUB_REPOSITORY", "")
seen = []
for r in json.load(sys.stdin).get("workflow_runs", []):
    if r.get("event") != "pull_request" or r.get("conclusion") != "success": continue
    hr = (r.get("head_repository") or {}).get("full_name")
    if repo and hr and hr != repo: continue
    s = r.get("head_sha")
    if s and s not in seen: seen.append(s)
print("\n".join(seen))
')" || esito false "elenco delle corse illeggibile"
[ -n "$TESTE" ] || esito false "nessuna corsa riuscita di PR per questo workflow"

for h in $TESTE; do
  T="$(api "git/commits/$h" | tr -d '\n' | python3 -c 'import json,sys; print(json.load(sys.stdin)["tree"]["sha"])' 2>/dev/null)" || continue
  if [ "$T" = "$TREE" ]; then
    esito true "albero ${TREE:0:10} gia' verde su ${WORKFLOW_FILE} nella PR (testa ${h:0:8}); su main non si rifa"
  fi
done
esito false "nessuna corsa verde di PR con l'albero ${TREE:0:10}: la CI su main gira"
