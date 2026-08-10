#!/usr/bin/env bash
# Prova di zp_review: deve dire di NO nei casi in cui il difetto si manifesta.
# Radice usa-e-getta, cosi' la prova non tocca lo stato vero.
set -uo pipefail
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export ZP_ROOT="$TMP"
mkdir -p "$TMP/.zp"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
Z="$REPO/docs/kb/tools/zp_review.py"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); printf '[PASSA   ] %s\n' "$1"; }
ko()  { FAIL=$((FAIL+1)); printf '[FALLISCE] %s (atteso %s, ottenuto %s)\n' "$1" "$2" "$3"; }
att() { local d="$1" a="$2"; shift 2; "$@" >/dev/null 2>&1; local r=$?; [[ "$r" == "$a" ]] && ok "$d" || ko "$d" "$a" "$r"; }

echo "── il cancello deve dire di NO quando manca tutto ──"
att "senza verdetti: stato esce 1"  1 python "$Z" stato Z-999
att "senza verdetti: valida esce 1" 1 python "$Z" valida Z-999

echo "── un verdetto senza 'come_si_riproduce' e' un sospetto, non un rilievo ──"
cat > "$TMP/sospetto.json" <<'EOF'
{"rilievi":[{"severita":"alta","cosa":"forse perde dati","file":"x.ts"}],"conclusione":"boh"}
EOF
att "rilievo senza riproduzione: rifiutato" 2 python "$Z" registra Z-999 --lente correttezza --json "$TMP/sospetto.json"

echo "── una lente sola non basta ──"
cat > "$TMP/v1.json" <<'EOF'
{"rilievi":[],"conclusione":"nessun difetto trovato sulla correttezza"}
EOF
att "registra la prima lente" 0 python "$Z" registra Z-999 --lente correttezza --json "$TMP/v1.json"
att "1 lente su 3: valida esce 1" 1 python "$Z" valida Z-999
att "stato ora esce 0 (qualcosa c'e')" 0 python "$Z" stato Z-999

echo "── un rilievo GRAVE aperto blocca anche con tutte e tre le lenti ──"
cat > "$TMP/v2.json" <<'EOF'
{"rilievi":[{"severita":"alta","cosa":"query senza filtro tenant","file":"repo.ts","riga":42,
 "come_si_riproduce":"login come utente del tenant B, GET /v1/x ritorna righe del tenant A"}],
 "conclusione":"fuga fra tenant"}
EOF
cat > "$TMP/v3.json" <<'EOF'
{"rilievi":[],"conclusione":"il done-when si riproduce da zero"}
EOF
att "registra isolamento (con rilievo grave)" 0 python "$Z" registra Z-999 --lente isolamento --json "$TMP/v2.json"
att "registra riproducibilita"                0 python "$Z" registra Z-999 --lente riproducibilita --json "$TMP/v3.json"
att "3 lenti ma rilievo grave aperto: esce 1" 1 python "$Z" valida Z-999

echo "── «risolto» da solo non e' una risoluzione ──"
att "risolvi senza COME: rifiutato" 2 python "$Z" risolvi Z-999 --lente isolamento --rilievo 0 --come "   "
att "risolvi con COME: accettato"   0 python "$Z" risolvi Z-999 --lente isolamento --rilievo 0 --come "aggiunto filtro tenant in repo.ts:42, test 3/3"
att "ora il cancello passa"         0 python "$Z" valida Z-999

echo "── la ripresa: i verdetti sopravvivono alla sessione ──"
RIMASTI=$(ls "$TMP/.zp/revisori" 2>/dev/null | wc -l)
[[ "$RIMASTI" == "3" ]] && ok "i 3 verdetti restano su disco" || ko "i 3 verdetti restano su disco" 3 "$RIMASTI"

echo
echo "$PASS passati, $FAIL falliti"
[[ "$FAIL" == "0" ]]
