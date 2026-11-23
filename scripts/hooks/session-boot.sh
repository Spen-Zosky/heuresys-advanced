#!/bin/sh
# session-boot.sh — hook SessionStart di heuresys-advanced, uguale su ogni macchina.
#
# PERCHE' ESISTE: l'hook chiamava solo `powershell.exe` e, dove non c'e' (VM Ubuntu ARM64,
# PC Linux), si saltava in silenzio con `|| true`: il boot di sessione non avveniva mai.
# Un solo punto d'ingresso, `sh scripts/hooks/session-boot.sh`, scelto per sistema:
#   - Windows (Git Bash/MSYS) con powershell.exe -> scripts/session-boot.ps1 (invariato:
#     tunnel :5433, pgpass di Windows, ecc.);
#   - tutto il resto (Linux, macOS)              -> la versione sh qui sotto, che fa lo
#     stesso controllo senza il tunnel (sulla VM il database e' locale).
#
# IDEMPOTENTE: marker creato solo se assente, diario ruotato solo se non vuoto, session-id
# ricalcolato (stesso valore se HEAD e' lo stesso). Rilanciarlo non fa danni.
# NON FATALE: esce sempre 0 e non blocca la sessione. Un passo che non riesce lo DICE
# nell'output (riga [!]/[--]), non tace.
set -u

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd) || exit 0
ROOT=$(CDPATH= cd -- "$DIR/../.." && pwd -P) || exit 0

# Self-guard: agisce solo se la sessione e' su questo repo.
if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
    CUR=$(CDPATH= cd -- "$CLAUDE_PROJECT_DIR" 2>/dev/null && pwd -P) || CUR=""
    [ -z "$CUR" ] || [ "$CUR" = "$ROOT" ] || exit 0
fi

OS=$(uname -s 2>/dev/null || echo unknown)
case "$OS" in
    MINGW*|MSYS*|CYGWIN*)
        if command -v powershell.exe >/dev/null 2>&1; then
            PR=$ROOT
            command -v cygpath >/dev/null 2>&1 && PR=$(cygpath -w "$ROOT")
            powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ROOT/scripts/session-boot.ps1" -ProjectRoot "$PR" || true
            exit 0
        fi
        ;;
esac

cd "$ROOT" || exit 0
PORT=${HEURESYS_DB_PORT:-}

port_up() { # $1 = porta; usa node (gia' richiesto dagli altri hook), niente bashismi
    command -v node >/dev/null 2>&1 || return 1
    node -e 'const s=require("net").connect({host:"127.0.0.1",port:+process.argv[1]});const f=c=>()=>process.exit(c);s.setTimeout(1500,f(1));s.on("connect",f(0));s.on("error",f(1))' "$1" 2>/dev/null
}

# 1. Database raggiungibile? Sulla VM e' locale (5432); dove c'e' il tunnel, 5433.
if [ -n "$PORT" ]; then CAND=$PORT; else CAND="5432 5433"; fi
UP=""
for p in $CAND; do port_up "$p" && { UP=$p; break; }; done
if [ -n "$UP" ]; then DBMSG="[OK]   database in ascolto su :$UP"; else DBMSG="[--]   nessun database in ascolto su :$(echo $CAND | tr ' ' '/') (su Linux il tunnel non si apre da qui)"; fi

# 2. pgpass
if [ -f "${PGPASSFILE:-$HOME/.pgpass}" ]; then PGMSG='[OK]   pgpass present'; else PGMSG='[--]   pgpass missing'; fi

# 3. Smoke check (psql opzionale, non fatale)
SMOKE='[--]   psql non nel PATH o database non raggiungibile (controllo saltato)'
if [ -n "$UP" ] && command -v psql >/dev/null 2>&1; then
    r=$(PGCONNECT_TIMEOUT=3 psql -h localhost -p "$UP" -U heuresys -d heuresys_advanced -tAc 'select 1' 2>/dev/null)
    if [ "$(printf '%s' "$r" | tr -d '[:space:]')" = "1" ]; then SMOKE='[OK]   DB reachable (select 1)'; else SMOKE='[DOWN] DB query failed'; fi
fi

# 4. Snapshot git, separando la superficie di Codex (fonte unica: scripts/lib/superficie-codex.txt)
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
HEADL=$(git log -1 --oneline 2>/dev/null)
CODEX_LIST="$ROOT/scripts/lib/superficie-codex.txt"
MIO=0; COD=0
git status --porcelain 2>/dev/null | while IFS= read -r riga; do printf '%s\n' "$riga"; done > "${TMPDIR:-/tmp}/.hb.$$" 2>/dev/null
while IFS= read -r riga; do
    [ -n "$riga" ] || continue
    p=$(printf '%s' "$riga" | cut -c4- | sed 's/^"//; s/"$//')
    suo=0
    if [ -f "$CODEX_LIST" ]; then
        while IFS= read -r v; do
            v=$(printf '%s' "$v" | tr -d '\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
            case "$v" in ''|'#'*) continue ;; esac
            case "$v" in
                */) b=${v%/}; case "$p" in "$b"|"$v"*) suo=1; break ;; esac ;;
                *) [ "$p" = "$v" ] && { suo=1; break; } ;;
            esac
        done < "$CODEX_LIST"
    fi
    if [ "$suo" = 1 ]; then COD=$((COD+1)); else MIO=$((MIO+1)); fi
done < "${TMPDIR:-/tmp}/.hb.$$"
rm -f "${TMPDIR:-/tmp}/.hb.$$"
CODCODA=""; [ "$COD" -gt 0 ] && CODCODA=" - $COD voci di Codex, attese per contratto"
if [ "$MIO" -gt 0 ]; then TREE="[!]    working tree DIRTY ($MIO file miei)$CODCODA"
elif [ "$COD" -gt 0 ]; then TREE="[OK]   working tree pulito$CODCODA"
else TREE='[OK]   working tree clean'; fi
UNP=$(git log '@{u}..HEAD' --oneline 2>/dev/null | wc -l | tr -d ' ')
if [ "${UNP:-0}" -gt 0 ]; then PUSH="[!]    $UNP commit(s) unpushed"; else PUSH='[OK]   synced with origin'; fi

# Marker di allineamento: solo se assente (una ripresa non azzera la finestra del delta)
MARK="$ROOT/.session-align.marker"
if [ ! -e "$MARK" ]; then
    SH=$(git rev-parse HEAD 2>/dev/null)
    if [ -n "$SH" ]; then
        SLUG=$(printf '%s' "$ROOT" | sed 's#[/\\:]#-#g')
        MD="$HOME/.claude/projects/$SLUG/memory"
        { printf '%s\n' "$SH"; [ -d "$MD" ] && ls -1 "$MD" 2>/dev/null; } > "$MARK" 2>/dev/null
    fi
fi

# 5. Diario di sessione: ruota se non vuoto
JMSG='[OK]   session journal ready'
J="$ROOT/.handoff/session-journal.ndjson"
mkdir -p "$ROOT/.handoff" 2>/dev/null
if [ -s "$J" ]; then
    JN=$(wc -l < "$J" | tr -d ' ')
    mv -f "$J" "$ROOT/.handoff/session-journal.recovered.ndjson" 2>/dev/null
    JMSG="[!]    session journal: $JN entry da una sessione non chiusa -> .recovered (consolidare al close)"
fi
[ -e "$J" ] || : > "$J" 2>/dev/null

# 5b. Numero di sessione (lo calcola close-log.sh, una sola derivazione)
SMSG=''; EMSG=''
CLOG="$ROOT/scripts/close-log.sh"
if [ ! -f "$CLOG" ]; then
    SMSG="[!]    sessione NON DERIVABILE: close-log.sh non trovato - .handoff/session-id resta com'era"
    EMSG="[!]    EREDITA' NON LETTA: manca close-log.sh - non so se una chiusura e' rimasta a meta'"
else
    rm -f "$ROOT/.handoff/session-id"
    SID=$(bash "$CLOG" sessione 2>/dev/null | head -1)
    case "$SID" in
        S\?|'') SMSG="[!]    sessione NON DERIVABILE: il rendiconto della chiusura dira' S?" ;;
        S*) printf '%s\n' "$SID" > "$ROOT/.handoff/session-id"; SMSG="[OK]   sessione $SID (depositata in .handoff/session-id)" ;;
        *)  SMSG="[!]    sessione NON DERIVABILE: il rendiconto della chiusura dira' S?" ;;
    esac
    # 5c. Eredita': chiusure interrotte
    REP=$(bash "$CLOG" report 2>/dev/null)
    if printf '%s' "$REP" | grep -q 'CORSE INTERROTTE'; then
        RIG=$(printf '%s\n' "$REP" | grep -E '^[[:space:]]{6}[^[:space:]]+[[:space:]]+ultimo passo')
        N=$(printf '%s\n' "$RIG" | grep -c .)
        EMSG="[!]    EREDITA': $N chiusura/e INTERROTTA/E dalla sessione precedente"
        EMSG="$EMSG
$(printf '%s\n' "$RIG" | sed 's/^[[:space:]]*/     /')
       -> bash scripts/close-log.sh report   (la corsa e' stata UCCISA, non e' finita)"
    else
        EMSG="[OK]   eredita': nessuna chiusura interrotta in sospeso"
    fi
fi

# 5d. Verdetto del cancello locale lasciato dalla sessione precedente (stantio se HEAD e' avanzato)
VMSG=''
VF="$ROOT/.zp/verify-verdict.json"
if [ -f "$VF" ]; then
    HNOW=$(git rev-parse HEAD 2>/dev/null)
    VMSG=$(node -e '
const fs=require("fs");let v;try{v=JSON.parse(fs.readFileSync(process.argv[1],"utf8"))}catch(e){console.log("[!]    cancello locale: verdetto NON LEGGIBILE - non so cosa ha lasciato la sessione precedente");process.exit(0)}
const h=process.argv[2]||"",vh=String(v.head||""),vd=String(v.verdict||"");
if(h&&vh&&h.trim()!==vh.trim())console.log("[i ]   cancello locale: verdetto \x27"+vd+"\x27 STANTIO (era su "+vh.slice(0,8)+", HEAD e\x27 "+h.slice(0,8)+") - non descrive questo albero");
else if(vd==="red"){const r=(v.results||[]).filter(x=>x.exit!==0).map(x=>x.suite).join(", ");console.log("[!]    EREDITA\x27: il cancello locale e\x27 ROSSO su questo stesso HEAD - suite: "+r+"\n       -> python docs/kb/tools/verify_gate.py run   (la sessione precedente lo ha lasciato rosso)")}
else console.log("[OK]   cancello locale: verdetto \x27"+vd+"\x27 su questo HEAD")' "$VF" "$HNOW" 2>/dev/null)
    [ -n "$VMSG" ] || VMSG='[!]    cancello locale: verdetto NON LEGGIBILE (node assente?)'
else
    VMSG="[i ]   cancello locale: nessun verdetto su disco - non e' stato eseguito, non e' 'a posto'"
fi

# 6. Coerenza dello stato (handoff-lint, sola lettura). Interprete: il primo che RISPONDE.
LMSG='[--]   handoff-lint not run (python/script absent)'
LINT="$ROOT/docs/kb/tools/handoff_lint.py"
if [ -f "$LINT" ]; then
    for c in python3 python; do
        if v=$($c -c 'import sys;print(sys.version_info[0])' 2>/dev/null) && [ "$v" = 3 ]; then
            OUT=$($c "$LINT" --warn-only 2>&1)
            FAILS=$(printf '%s\n' "$OUT" | grep -E '^FAIL ')
            if [ -z "$FAILS" ]; then LMSG='[OK]   stato coerente (handoff-lint)'
            else
                NF=$(printf '%s\n' "$FAILS" | grep -c .)
                LMSG="[!]    stato DRIFTATO: $NF FAIL (handoff-lint)
$(printf '%s\n' "$FAILS" | sed 's/^/       /')"
            fi
            break
        fi
    done
fi

echo '=== HEURESYS BOOT (project hook) ==='
echo "[--]   tunnel: non gestito su $OS (database locale)"
echo "$PGMSG"
echo "$DBMSG"
echo "$SMOKE"
echo "branch $BRANCH @ $HEADL"
echo "$TREE"
echo "$PUSH"
echo "$JMSG"
[ -z "$SMSG" ] || echo "$SMSG"
[ -z "$EMSG" ] || echo "$EMSG"
[ -z "$VMSG" ] || echo "$VMSG"
echo "$LMSG"
echo '==================================='
exit 0
