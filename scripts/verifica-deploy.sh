#!/usr/bin/env bash
#
# scripts/verifica-deploy.sh — legge dalle MACCHINE se il deploy è avvenuto (S1054).
#
# PERCHÉ ESISTE. Dal #165 la chiusura non aspetta più la CI: **arma** il ramo `prod`
# e ritorna, e il deploy lo esegue da sé `heuresys-advanced-deploy-watch.timer` sui
# due host quando la CI diventa verde. La regola è che alla chiusura si annuncia
# «armato», mai «deployato» — perché «deployato» è un fatto che vive sulle macchine,
# non nella conversazione. Questo script è la LETTURA di quel fatto: non aspetta e
# non deploya, fotografa e dichiara.
#
# I cinque stati, vocabolario chiuso, così «chiuso» significa lo stesso in giorni diversi:
#   DEPLOYATO      LAST_GOOD_SHA == atteso su TUTTI gli host, servizi attivi, produzione 200
#   IN-VOLO        CI in corso, o verde da poco e il sorvegliante non ha ancora propagato
#   CI-ROSSA       la CI ha bocciato lo sha: il deploy NON avverrà, c'è da correggere
#   DISALLINEATO   un servizio è giù o la produzione non risponde ⟹ guasto vero
#   NON-VERIFICATO non è stato possibile misurare (rete, `gh` assente, host giù).
#                  NON è sinonimo di «a posto»: dice che non si sa, ed è il motivo
#                  per cui vale la pena avere uno script invece di un comando a memoria.
#
# Uso:  bash scripts/verifica-deploy.sh [sha]            # una fotografia (default: HEAD)
#       ATTESA_MAX=1800 bash scripts/verifica-deploy.sh  # ripassa finché è IN-VOLO
#
# Uscita: 0 = DEPLOYATO o IN-VOLO · 1 = CI-ROSSA o DISALLINEATO · 2 = NON-VERIFICATO
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 2
# Lo sha di riferimento e' l'ULTIMO ARMATO, non HEAD (S1054, seconda stesura).
#
# Perche' il cambio: con `HEAD` un commit di sola documentazione — non armato
# apposta, perche' non c'e' niente da mandare in produzione — faceva dire
# «0/2 host allineati», cioe' un allarme su una domanda che per quel commit non ha
# senso porre. La domanda giusta e': gli host sono sull'ultimo sha che abbiamo
# DECISO di mandare in produzione? Quella decisione ha un nome ed e' `refs/heads/prod`.
#
# Si legge dal remoto (`ls-remote`) e non da un `origin/prod` locale, che sarebbe
# vecchio quanto l'ultimo fetch: qui si vuole la verita' di adesso, non il ricordo.
# Uno sha passato a mano vince sempre — serve a interrogare il passato.
ARM_REF="${ARM_REF:-prod}"
SHA="${1:-}"
SHA_ORIGINE="argomento esplicito"
if [ -z "$SHA" ]; then
  SHA="$(git ls-remote origin "refs/heads/$ARM_REF" 2>/dev/null | awk '{print $1}')"
  SHA_ORIGINE="ultimo armato (origin/$ARM_REF)"
fi
if [ -z "$SHA" ]; then
  SHA="$(git rev-parse HEAD 2>/dev/null)"
  SHA_ORIGINE="HEAD — ATTENZIONE: refs/heads/$ARM_REF non leggibile, il confronto puo' essere improprio"
fi
SHORT="${SHA:0:8}"
ATTESA_MAX="${ATTESA_MAX:-0}"
PROD_URL="${PROD_URL:-https://www.heuresys.com}"
HOSTS="${HOSTS:-oracle-vm-default linux-pc}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=8)
VERDETTO=""

esito() { printf '  %-22s %s\n' "$1" "$2"; }

# Si contano TUTTE le corse dello sha, non le «ultime N»: un `--limit 5` mostrerebbe
# cinque verdi mentre la sesta è rossa (misurato: 10 corse per un solo sha).
ci_conta() {
  command -v gh >/dev/null || return 1
  gh run list --branch main --limit 30 --json status,conclusion,headSha \
    --jq "[.[] | select(.headSha==\"$SHA\")] | \"\(length) \([.[]|select(.conclusion==\"success\")]|length) \([.[]|select(.status!=\"completed\")]|length) \([.[]|select(.conclusion==\"failure\")]|length)\"" 2>/dev/null
}

# Il marcatore lo scrive `vm-deploy.sh` in `pg_dump_snapshots/` — accanto al dump
# di sicurezza che prende prima di migrare, non in una cartella `.deploy/`. Il path
# si CERCA invece di darlo per noto: indovinarlo produrrebbe «host giù?» su un host
# perfettamente sano, cioè un falso allarme che somiglia a un guasto (misurato
# scrivendo questo script: la prima stesura diceva esattamente quello).
sha_host() {
  ssh "${SSH_OPTS[@]}" "$1"     "find ~/heuresys-advanced -maxdepth 3 -name LAST_GOOD_SHA -print0 2>/dev/null        | xargs -0 -r cat 2>/dev/null | head -1" 2>/dev/null
}
servizi_host() {
  ssh "${SSH_OPTS[@]}" "$1" "printf '%s/%s' \
    \"\$(systemctl is-active heuresys-advanced-api.service 2>/dev/null)\" \
    \"\$(systemctl is-active heuresys-advanced-web.service 2>/dev/null)\"" 2>/dev/null
}

giro() {
  local totali ok in_corso rosse ci_line verdetto="IN-VOLO" motivo="" \
        allineati=0 host_tot=0 servizi_ko="" prod_readyz prod_login

  ci_line="$(ci_conta || true)"
  if [ -z "$ci_line" ]; then
    esito "CI ($SHORT)" "non misurabile (gh assente o rete giù)"
    verdetto="NON-VERIFICATO"; motivo="CI non misurabile"
    totali=0; in_corso=0; rosse=0
  else
    read -r totali ok in_corso rosse <<<"$ci_line"
    esito "CI ($SHORT)" "$totali corse · $ok verdi · $in_corso in corso · $rosse rosse"
    if   [ "${rosse:-0}"    -gt 0 ]; then verdetto="CI-ROSSA"; motivo="$rosse corse bocciate: il deploy non avverrà"
    elif [ "${in_corso:-0}" -gt 0 ]; then verdetto="IN-VOLO";  motivo="CI ancora in corso ($in_corso)"
    elif [ "${totali:-0}"   -eq 0 ]; then verdetto="IN-VOLO";  motivo="nessuna corsa ancora registrata per questo sha"
    fi
  fi

  for h in $HOSTS; do
    host_tot=$((host_tot + 1))
    local s sv
    s="$(sha_host "$h")"; sv="$(servizi_host "$h")"
    if [ -z "$s" ]; then
      esito "$h" "LAST_GOOD_SHA non leggibile (host giù?)"
      verdetto="NON-VERIFICATO"; motivo="${motivo:-}${motivo:+ · }$h non leggibile"
      continue
    fi
    if [ "${s:0:40}" = "${SHA:0:40}" ]; then
      allineati=$((allineati + 1)); esito "$h" "deployato ${s:0:8} · servizi $sv"
    else
      esito "$h" "fermo su ${s:0:8} (atteso $SHORT) · servizi $sv"
    fi
    case "$sv" in *inactive*|*failed*) servizi_ko="$servizi_ko $h" ;; esac
  done

  # ⚠ `-4` NON e' una precauzione teorica: senza, questo controllo ha dichiarato la produzione
  # IRRAGGIUNGIBILE (`000` su entrambe le sonde) il 2026-08-16 mentre era sana. Misurato subito
  # dopo: `https://80.225.82.207/login` rispondeva **200 in 0,12 s**, la VM rispondeva 200 a se'
  # stessa, tutte le porte in ascolto — e `curl -4 https://www.heuresys.com/login` **200 in
  # 0,57 s**. A impiantarsi era la risoluzione del NOME sul router di casa, che interroga il DNS
  # via IPv6; il dominio non ha nemmeno un record AAAA, quindi IPv4 e' l'unica strada vera e
  # forzarla non nasconde nulla.
  #
  # Il difetto vero non era il timeout: era che uno STRUMENTO DI MISURA dichiarava rotto un
  # sistema sano. Un allarme falso costa piu' di nessun allarme, perche' insegna a non
  # guardarlo — ed e' la stessa specie dei falsi verdi che questo progetto continua a trovare,
  # vista dal lato opposto.
  # UN SOLO TENTATIVO NON DISTINGUE UN GUASTO DA UN INCIAMPO. Anche con `-4` la rete di casa
  # ha picchi che superano i 12 s: misurato il 2026-08-16, tre giri consecutivi dello stesso
  # comando hanno dato 200 / 200 / 200 con la risoluzione a 0,02 s, e uno intermedio 000. Un
  # secondo tentativo costa al massimo altri 12 s e toglie di mezzo il transitorio; se anche il
  # secondo tace, allora e' un fatto e va detto.
  sonda() {
    local url="$1" code
    code="$(curl -4 -s -o /dev/null -w '%{http_code}' --max-time 12 "$url" 2>/dev/null)"
    if [ "$code" = "000" ]; then
      code="$(curl -4 -s -o /dev/null -w '%{http_code}' --max-time 12 "$url" 2>/dev/null)"
    fi
    printf '%s' "$code"
  }
  prod_readyz="$(sonda "$PROD_URL/api/readyz")"
  prod_login="$(sonda "$PROD_URL/login")"
  esito "produzione" "readyz=$prod_readyz login=$prod_login"

  # DEPLOYATO chiede che TUTTO torni: un solo host allineato non basta — i due gemelli
  # devono raccontare la stessa storia, o la prossima verifica girerebbe su un codice
  # diverso da quello che serve il pubblico.
  if [ "$verdetto" != "CI-ROSSA" ] && [ "$verdetto" != "NON-VERIFICATO" ]; then
    if [ "$allineati" -eq "$host_tot" ] && [ -z "$servizi_ko" ] \
       && [ "$prod_readyz" = "200" ] && [ "$prod_login" = "200" ]; then
      verdetto="DEPLOYATO"; motivo="$host_tot host su $SHORT, servizi attivi, produzione 200"
    elif [ "${in_corso:-0}" -eq 0 ] && [ "${totali:-0}" -gt 0 ] && [ "$allineati" -lt "$host_tot" ]; then
      verdetto="IN-VOLO"
      motivo="CI verde, $allineati/$host_tot host allineati — il sorvegliante propaga entro ~5 min"
    fi
    if [ -n "$servizi_ko" ]; then
      verdetto="DISALLINEATO"; motivo="servizi non attivi su:$servizi_ko"
    elif [ "$prod_readyz" != "200" ] && [ "${totali:-0}" -gt 0 ] && [ "${in_corso:-0}" -eq 0 ]; then
      verdetto="DISALLINEATO"; motivo="produzione non risponde (readyz=$prod_readyz) a CI conclusa"
    fi
  fi

  VERDETTO="$verdetto"
  printf '\n  VERDETTO: %s — %s\n' "$verdetto" "$motivo"
  case "$verdetto" in
    DEPLOYATO|IN-VOLO) return 0 ;;
    NON-VERIFICATO)    return 2 ;;
    *)                 return 1 ;;
  esac
}

echo "verifica-deploy — sha atteso $SHORT ($SHA_ORIGINE) · host: $HOSTS"
# Se HEAD e' andato avanti senza essere armato, lo si dice: e' la situazione normale
# dopo un commit di sola documentazione, e tacerla farebbe sembrare la verifica
# «indietro» quando invece sta guardando esattamente il punto giusto.
_head="$(git rev-parse HEAD 2>/dev/null)"
if [ -n "$_head" ] && [ "$_head" != "$SHA" ]; then
  _avanti="$(git rev-list --count "$SHA..$_head" 2>/dev/null || echo '?')"
  if [ "$_avanti" != "0" ] && [ "$_avanti" != "?" ]; then
    echo "  (HEAD ${_head:0:8} e' avanti di $_avanti commit NON armati — non riguardano la produzione)"
  fi
fi
t0=$(date +%s)
while :; do
  giro; rc=$?
  # Si ripassa SOLO mentre lo stato è IN-VOLO: su DEPLOYATO non c'è altro da sapere,
  # e su un guasto aspettare non ripara nulla — ritarda soltanto chi deve agire.
  [ "$ATTESA_MAX" -gt 0 ] || break
  [ "$VERDETTO" = "IN-VOLO" ] || break
  if [ $(( $(date +%s) - t0 )) -ge "$ATTESA_MAX" ]; then
    echo "  (attesa esaurita dopo ${ATTESA_MAX}s: lo stato resta IN-VOLO)"; break
  fi
  sleep 60; echo
done
exit $rc
