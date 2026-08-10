#!/usr/bin/env bash
# La guardia sul riallineamento deve distinguere «lavoro da perdere» da «copia gia' in main».
# Prova in DUE direzioni su un repo usa-e-getta: se riallineasse tutto sarebbe peggio del difetto.
set -uo pipefail
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); printf '[PASSA   ] %s\n' "$1"; }
ko(){ FAIL=$((FAIL+1)); printf '[FALLISCE] %s — %s\n' "$1" "$2"; }

R="$TMP/repo"; git init -q "$R"; cd "$R"
git config user.email t@t; git config user.name t
echo uno > a.txt; git add .; git commit -qm base
git branch -M main

# --- caso 1: un commit ENTRATO in main con hash diverso (rebase) ---------------
git checkout -qb ramo1
echo due > b.txt; git add .; git commit -qm "lavoro del lavoratore"
SUO=$(git rev-parse HEAD)
git checkout -q main
# main deve DIVERGERE, altrimenti il cherry-pick produce lo stesso hash (stesso parent,
# stesso albero, stesso messaggio) e lo scenario non riproduce il rebase.
echo altro > z.txt; git add .; git commit -qm "main va avanti per conto suo"
git cherry-pick "$SUO" >/dev/null || ko "setup" "il cherry-pick e' fallito"
NUOVO=$(git rev-parse HEAD)
[[ "$SUO" != "$NUOVO" ]] || ko "setup" "il cherry-pick non ha cambiato hash"

PER_HASH=$(git rev-list --count main..ramo1)
PER_CONTENUTO=$(git cherry main ramo1 | grep -c '^+' || true)
[[ "$PER_HASH" == "1" ]] && ok "per hash risulta 1 commit «proprio» (il difetto)" \
                         || ko "per hash" "atteso 1, ottenuto $PER_HASH"
[[ "${PER_CONTENUTO:-0}" == "0" ]] && ok "per contenuto risulta 0: niente da perdere" \
                                   || ko "per contenuto" "atteso 0, ottenuto $PER_CONTENUTO"

# --- caso 2: un commit VERAMENTE nuovo deve restare protetto -------------------
git checkout -q ramo1
echo tre > c.txt; git add .; git commit -qm "lavoro NON ancora in main"
PER_CONTENUTO2=$(git cherry main ramo1 | grep -c '^+' || true)
[[ "${PER_CONTENUTO2:-0}" == "1" ]] && ok "un commit davvero nuovo resta protetto (1)" \
                                    || ko "protezione" "atteso 1, ottenuto $PER_CONTENUTO2"

echo
echo "$PASS passati, $FAIL falliti"
[[ "$FAIL" == "0" ]]
