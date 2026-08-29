#!/usr/bin/env bash
#
# scripts/verifica-cloni.sh — #236 F3: «posso chiudere?» diventa un comando, non una memoria.
#
# PERCHE' ESISTE. Alla chiusura la sessione ARMA tre lavori e ritorna; nessuno dei tre
# si guarda mentre finisce. Fino a S1084 esisteva un solo modo di sapere com'era andata,
# `verifica-deploy.sh`, e valeva per **uno** dei tre. Degli altri due si sapeva quel che
# si ricordava — ed e' precisamente la domanda che Enzo ha posto a fine S1083 («mi
# confermi che le clonazioni arrivano a conclusione anche se chiudo?»), a cui la risposta
# giusta e' un comando che legge dalle macchine.
#
# I TRE LAVORI, e chi li esegue davvero:
#   deploy      heuresys-advanced-deploy-watch.timer (VM + gemello)   — #165
#   clone       heuresys-advanced-clonedb.service (gemello)           — #236 F2
#   ecosistema  align-claude-ecosystem.sh                             — #236 F4
#
# VOCABOLARIO CHIUSO, uno per lavoro, cosi' «a posto» significa lo stesso in giorni
# diversi. Il deploy tiene il suo (delegato a verifica-deploy.sh: DEPLOYATO · IN-VOLO ·
# CI-ROSSA · DISALLINEATO · NON-VERIFICATO). Gli altri due hanno il proprio, perche' il
# loro mestiere e' un altro e riusare le parole del deploy le renderebbe vaghe:
#
#   clone:       FRESCO · IN-CORSO · INDIETRO · FALLITO · NON-VERIFICATO
#   ecosistema:  ALLINEATO · INDIETRO · DISALLINEATO · NON-VERIFICATO
#
# ⚠ NON-VERIFICATO NON VUOL DIRE «A POSTO». Vuol dire «non ho potuto guardare», ed e' la
# ragione per cui questo script esiste invece di un comando ricordato a memoria: un
# controllo che tace quando la rete e' giu' insegna a fidarsi del silenzio.
#
# Uso:  bash scripts/verifica-cloni.sh              # i tre lavori
#       bash scripts/verifica-cloni.sh --solo clone # uno solo
#       bash scripts/verifica-cloni.sh --breve      # una riga per lavoro, niente dettaglio
#
# Uscita: 0 = niente da fare o lavoro in corso · 1 = guasto vero · 2 = non verificato
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 2

SOLO=""
BREVE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --solo)  SOLO="${2:?--solo richiede deploy|clone|ecosistema}"; shift 2 ;;
    --breve) BREVE=1; shift ;;
    *) echo "uso: verifica-cloni.sh [--solo deploy|clone|ecosistema] [--breve]" >&2; exit 2 ;;
  esac
done

GEMELLO="${CLONE_ARM_HOST:-linux-pc}"
UNIT="${CLONE_ARM_UNIT:-heuresys-advanced-clonedb.service}"
ECO_HOSTS="${ECO_HOSTS:-oracle-vm-default linux-pc}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=8)

# Il peggiore dei tre vince: un verdetto complessivo che dicesse «a posto» con un lavoro
# rotto sarebbe la stessa rassicurazione vuota che questo script deve togliere di mezzo.
PEGGIO=0
V_DEPLOY="—"; V_CLONE="—"; V_ECO="—"

riga()  { printf '  %-24s %s\n' "$1" "$2"; }
titolo(){ printf '\n\033[1m== %s ==\033[0m\n' "$1"; }
peggiora() { [ "$1" -gt "$PEGGIO" ] && PEGGIO="$1"; return 0; }

sul_gemello() { MSYS_NO_PATHCONV=1 ssh "${SSH_OPTS[@]}" "$GEMELLO" "$@" 2>/dev/null; }

# --------------------------------------------------------------------------- 1. deploy
# NON SI RISCRIVE: verifica-deploy.sh ha gia' i suoi cinque stati, la sonda IPv4 con il
# secondo tentativo, il cancello CI e la finestra dei commit non armati. Duplicarne il
# giudizio qui vorrebbe dire due criteri per una domanda sola — e prima o poi divergono.
verifica_deploy() {
  titolo "DEPLOY — la produzione ha lo sha armato?"
  if [ ! -f "$ROOT/scripts/verifica-deploy.sh" ]; then
    riga "verdetto" "NON-VERIFICATO — scripts/verifica-deploy.sh assente"
    V_DEPLOY="NON-VERIFICATO"; peggiora 2; return
  fi
  local out rc
  out="$(bash "$ROOT/scripts/verifica-deploy.sh" 2>&1)"; rc=$?
  [ "$BREVE" = 1 ] || printf '%s\n' "$out" | sed 's/^/  /'
  V_DEPLOY="$(printf '%s' "$out" | sed -n 's/.*VERDETTO: \([A-Z-]*\).*/\1/p' | tail -1)"
  [ -n "$V_DEPLOY" ] || V_DEPLOY="NON-VERIFICATO"
  [ "$BREVE" = 1 ] && riga "verdetto" "$V_DEPLOY"
  case "$rc" in 0) ;; 2) peggiora 2 ;; *) peggiora 1 ;; esac
}

# ---------------------------------------------------------------------------- 2. clone
# COSA SI GUARDA, e perche' due cose e non una. `Result=success` dice che l'ULTIMA corsa
# e' andata bene; non dice che il clone sia ATTUALE. Un clone riuscito una settimana fa,
# con tre migrazioni applicate in produzione da allora, e' un clone sano e **indietro** —
# e la CI e la verifica lunga di chiusura girano su quello. Percio': l'esito della corsa,
# e la distanza in migrazioni dalla sorgente.
verifica_clone() {
  titolo "CLONE — il gemello rispecchia la produzione?"
  if ! sul_gemello 'exit 0'; then
    riga "$GEMELLO" "non risponde"
    riga "verdetto" "NON-VERIFICATO — non ho potuto guardare (non e' «a posto»)"
    V_CLONE="NON-VERIFICATO"; peggiora 2; return
  fi

  local stato res quando
  stato="$(sul_gemello "systemctl is-active '$UNIT'")"
  res="$(sul_gemello "systemctl show -p Result --value '$UNIT'")"
  quando="$(sul_gemello "systemctl show -p ExecMainExitTimestamp --value '$UNIT'")"
  riga "ultima corsa" "${quando:-mai} · stato=${stato:-?} · esito=${res:-?}"

  if [ "$stato" = "activating" ]; then
    riga "verdetto" "IN-CORSO — un rifacimento e' in volo adesso, ripassare fra un minuto"
    V_CLONE="IN-CORSO"; return
  fi
  if [ -n "$res" ] && [ "$res" != "success" ]; then
    riga "verdetto" "FALLITO — l'ultima corsa e' uscita in errore ($res)"
    riga "  guardare" "ssh $GEMELLO 'systemctl status $UNIT'"
    V_CLONE="FALLITO"; peggiora 1; return
  fi

  # La distanza dalla sorgente. Le due conte si prendono con la STESSA domanda sui due
  # database: se una delle due non si puo' misurare si dichiara, non si assume che
  # combacino — sarebbe un verde nato dal buio.
  local q="select count(*) from sys.sys_schema_migrations"
  local n_gem n_prod
  n_gem="$(sul_gemello "sudo -n -u postgres psql -w -tAc \"$q\" heuresys_advanced" | tr -d '[:space:]')"
  n_prod="$(psql -w -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "$q" 2>/dev/null | tr -d '[:space:]')"

  if ! printf '%s' "$n_gem" | grep -qE '^[0-9]+$' || ! printf '%s' "$n_prod" | grep -qE '^[0-9]+$'; then
    riga "migrazioni" "gemello=${n_gem:-?} · produzione=${n_prod:-?}"
    riga "verdetto" "NON-VERIFICATO — una delle due conte non e' misurabile (tunnel giu'?)"
    V_CLONE="NON-VERIFICATO"; peggiora 2; return
  fi
  riga "migrazioni" "gemello=$n_gem · produzione=$n_prod"

  if [ "$n_gem" -lt "$n_prod" ]; then
    riga "verdetto" "INDIETRO — il gemello ha $(( n_prod - n_gem )) migrazioni in meno: CI e verifica lunga girerebbero su dati vecchi"
    riga "  rimedio" "bash scripts/arma-clone.sh --why 'clone indietro'"
    V_CLONE="INDIETRO"; peggiora 1; return
  fi
  # Il gemello AVANTI non e' un guasto del clone: e' una migrazione applicata li' e non
  # in produzione. Si dice, e non si tace, ma non e' questo lo strumento che la cura.
  if [ "$n_gem" -gt "$n_prod" ]; then
    riga "verdetto" "FRESCO — ma il gemello ha $(( n_gem - n_prod )) migrazioni IN PIU' della produzione (applicate li' e non deployate?)"
    V_CLONE="FRESCO"; return
  fi
  riga "verdetto" "FRESCO — stesse migrazioni della produzione, ultima corsa riuscita"
  V_CLONE="FRESCO"
}

# ----------------------------------------------------------------------- 3. ecosistema
# COSA SI CONFRONTA, e cosa NO. Ogni host allineato porta `~/.claude/.ecosystem-align.json`
# con `stamp` e `manifestSha`. ⚠ I `manifestSha` dei due host sono DIVERSI per costruzione
# — `settings.json` viene trasformato per-OS — quindi confrontarli darebbe un allarme
# permanente su un sistema sano. Misurato il 2026-08-29: stesso stamp `20260828T210637Z`,
# sha `7b7865d7…` sulla VM e `c384ce8a…` sul gemello. Il criterio buono e' lo **stamp**:
# stessa corsa di allineamento, oppure uno degli host e' rimasto a una corsa precedente.
#
# E poi la domanda che conta davvero: **il catalogo e' cambiato dopo l'ultimo
# allineamento?** Se si', le istruzioni che governano le sessioni sui remoti non sono
# quelle di qui.
verifica_ecosistema() {
  titolo "ECOSISTEMA CLAUDE — i remoti hanno il catalogo di questa macchina?"
  local stamps="" mancanti="" h s
  for h in $ECO_HOSTS; do
    s="$(MSYS_NO_PATHCONV=1 ssh "${SSH_OPTS[@]}" "$h" \
         "sed -n 's/.*\"stamp\":\"\\([^\"]*\\)\".*/\\1/p' ~/.claude/.ecosystem-align.json 2>/dev/null" 2>/dev/null | tr -d '[:space:]')"
    if [ -z "$s" ]; then
      riga "$h" "sentinella assente o host giu'"
      mancanti="$mancanti $h"
    else
      riga "$h" "allineato $s"
      stamps="$stamps $s"
    fi
  done

  if [ -n "$mancanti" ]; then
    riga "verdetto" "NON-VERIFICATO — non letti:$mancanti"
    V_ECO="NON-VERIFICATO"; peggiora 2; return
  fi

  local unici
  unici="$(printf '%s\n' $stamps | sort -u | wc -l | tr -d '[:space:]')"
  if [ "$unici" != "1" ]; then
    riga "verdetto" "DISALLINEATO — gli host non vengono dalla stessa corsa di allineamento"
    V_ECO="DISALLINEATO"; peggiora 1; return
  fi

  # Il catalogo sorgente e' cambiato dopo? `stamp` e' UTC compatto (20260828T210637Z):
  # si converte in epoch e si confronta col file piu' recente del payload.
  local st ep_stamp piu_nuovo
  st="$(printf '%s\n' $stamps | head -1)"
  ep_stamp="$(date -u -d "${st:0:4}-${st:4:2}-${st:6:2} ${st:9:2}:${st:11:2}:${st:13:2}" +%s 2>/dev/null)"
  if [ -z "$ep_stamp" ]; then
    riga "verdetto" "NON-VERIFICATO — stamp «$st» non interpretabile come data"
    V_ECO="NON-VERIFICATO"; peggiora 2; return
  fi

  # ⚠ `settings.json` E' FUORI DAL CRITERIO, e non e' una scorciatoia. Misurato il
  # 2026-08-29: il file portava le 03:28 di quella mattina, cioe' l'AVVIO DI QUELLA
  # SESSIONE — lo riscrive il runtime di Claude Code da se' (stile di uscita, permessi
  # concessi al volo), non l'uomo. Tenerlo dentro avrebbe reso il verdetto INDIETRO a
  # ogni singola sessione, per sempre: un allarme sempre acceso e' un allarme che
  # insegna a non guardarlo, ed e' lo stesso difetto che #194 descrive per l'atlante.
  # In piu' il file viene TRASFORMATO per-OS prima di arrivare sui remoti, quindi il
  # suo mtime locale non risponde comunque alla domanda «i remoti sono indietro?».
  # Il limite si DICHIARA invece di essere nascosto: chi vuole la risposta anche su
  # quel file usa `--verify`, che confronta i contenuti e non le date.
  piu_nuovo="$(find "$HOME/.claude/CLAUDE.md" "$HOME/.claude/skills" "$HOME/.claude/commands" \
                    -type f -newermt "@$ep_stamp" 2>/dev/null | head -3)"
  if [ -n "$piu_nuovo" ]; then
    riga "catalogo locale" "cambiato dopo l'allineamento — es. $(printf '%s\n' "$piu_nuovo" | head -1 | sed "s|^$HOME/||")"
    riga "verdetto" "INDIETRO — i remoti girano con un catalogo precedente a questo"
    riga "  rimedio" "bash scripts/align-claude-ecosystem.sh all --delta"
    V_ECO="INDIETRO"; peggiora 1; return
  fi
  riga "verdetto" "ALLINEATO — stessa corsa ($st), CLAUDE.md/skills/commands non toccati dopo"
  riga "  non guardato" "settings.json (riscritto dal runtime a ogni sessione, e trasformato per-OS): bash scripts/align-claude-ecosystem.sh all --verify"
  V_ECO="ALLINEATO"
}

# ------------------------------------------------------------------------------ corsa
echo "verifica-cloni — i tre lavori che la chiusura arma e non aspetta"
case "$SOLO" in
  deploy)     verifica_deploy ;;
  clone)      verifica_clone ;;
  ecosistema) verifica_ecosistema ;;
  "")         verifica_deploy; verifica_clone; verifica_ecosistema ;;
  *) echo "--solo accetta deploy|clone|ecosistema" >&2; exit 2 ;;
esac

printf '\n\033[1m  RIEPILOGO\033[0m\n'
[ "$SOLO" = "clone" ] || [ "$SOLO" = "ecosistema" ] || riga "deploy" "$V_DEPLOY"
[ "$SOLO" = "deploy" ] || [ "$SOLO" = "ecosistema" ] || riga "clone" "$V_CLONE"
[ "$SOLO" = "deploy" ] || [ "$SOLO" = "clone" ]      || riga "ecosistema" "$V_ECO"
# ⚠ Doppi apici, non singoli: un apostrofo dentro una stringa a singoli apici la chiude
# e trasforma il resto in sintassi. E' la stessa specie di trappola che in S1084 ha reso
# verde un caso negativo di arma-clone.sh — l'ho riprodotta qui scrivendo «si puo'», e
# corretta prima ancora di eseguire. Il presidio e' nella batteria, non nella memoria.
case "$PEGGIO" in
  0) printf "\n  Si puo' chiudere: nessuno dei lavori guardati e' in guasto.\n" ;;
  1) printf "\n  ATTENZIONE: almeno un lavoro e' in guasto — vedi il verdetto qui sopra.\n" ;;
  2) printf "\n  NON-VERIFICATO: qualcosa non si e' potuto guardare. Non e' «a posto»: e' «non lo so».\n" ;;
esac
exit "$PEGGIO"
