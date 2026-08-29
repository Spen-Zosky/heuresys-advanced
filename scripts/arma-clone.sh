#!/usr/bin/env bash
# ============================================================================
# scripts/arma-clone.sh — #236 F2: IL RIFACIMENTO DEL CLONE SI ARMA, NON SI APPENDE.
#
# IL DIFETTO CHE QUESTO SCRIPT CHIUDE. Fino a S1084 la chiusura di sessione lanciava
# il clone cosi' (close-propagate.sh):
#
#     ssh -o BatchMode=yes linux-pc "cd '$REPO' && bash scripts/clone-vm-db.sh"
#
# Nessun `nohup`, nessun `setsid`, nessun `&`. Il processo gira sul gemello ma e' figlio
# di un `ssh` che vive NELLA SESSIONE CLI: se la sessione si chiude, l'ssh muore, il
# canale si chiude e il remoto riceve SIGHUP a meta' lavoro. La domanda di Enzo — «mi
# confermi che le clonazioni arrivano a conclusione anche se chiudo la sessione?» —
# aveva come risposta misurata **no**.
#
# QUELLO CHE NON SERVIVA INVENTARE. Cercando l'unita' systemd da scrivere, sul gemello
# ce n'era gia' una: `heuresys-advanced-clonedb.service`, viva dal 2026 (Z-022), con
# tutto cio' che il modello di #165 pretende — `OnFailure=heuresys-unit-failure@%n`,
# `Persistent=true` sul timer, `TimeoutStartSec=900`, e per giunta lo stop di api+web
# prima del restore con `ExecStopPost` che li riaccende SEMPRE, anche se il clone
# fallisce. Mancava una cosa sola: **un innesco su richiesta**. Il timer la esegue la
# domenica alle 08:00, e fra una domenica e l'altra il solo modo di rinfrescare il
# gemello era il comando appeso alla sessione.
#
# L'ATTO, quindi, e' una riga: `systemctl start --no-block`. Il `--no-block` e' tutto il
# punto — systemd prende in carico l'unita' e ritorna subito, quindi il clone diventa
# figlio di **systemd**, non dell'ssh. Chiudere la CLI un istante dopo non lo tocca.
#
# PERCHE' UN'UNITA' E NON UN `nohup`. Un `nohup ... &` sopravviverebbe al SIGHUP, ma
# resterebbe orfano: nessun `OnFailure`, nessun log strutturato, nessuno stato
# interrogabile, e nessuno stop dei servizi prima del restore. L'unita' ha gia' tutto
# questo, ed e' collaudata da mesi di corse settimanali.
#
# Uso:
#   bash scripts/arma-clone.sh [--host <h>] [--why <testo>] [--dry-run]
# Env:
#   CLONE_ARM_HOST    host del gemello (default: linux-pc)
#   CLONE_ARM_UNIT    unita' da innescare (default: heuresys-advanced-clonedb.service)
#   ARMA_CLONE_DRYRUN =1 : dichiara cosa farebbe e non innesca niente
#
# Esiti (stampati e registrati nel diario delle chiusure, passo `arma-clone`):
#   eseguito : l'unita' e' stata presa in carico da systemd            -> exit 0
#   saltato  : un clone era GIA' in corso, non se ne accavalla un altro -> exit 0
#   ignoto   : il gemello non risponde — NON e' «a posto», e' «non ho potuto» -> exit 0
#   fallito  : l'host risponde ma l'innesco e' stato rifiutato          -> exit 1
#
# ⚠ `ignoto` esce 0 di proposito: un gemello spento non deve far fallire una chiusura
# altrimenti sana. Ma non si traveste da verde — lo dichiara, e F3 (`verifica-cloni.sh`)
# lo leggera' con lo stesso vocabolario chiuso di `verifica-deploy.sh`.
# ============================================================================
set -euo pipefail

HOST="${CLONE_ARM_HOST:-linux-pc}"
UNIT="${CLONE_ARM_UNIT:-heuresys-advanced-clonedb.service}"
WHY=""
DRYRUN="${ARMA_CLONE_DRYRUN:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --host)    HOST="${2:?--host richiede un nome}"; shift 2 ;;
    --why)     WHY="${2:-}"; shift 2 ;;
    --dry-run) DRYRUN=1; shift ;;
    *) echo "uso: arma-clone.sh [--host <h>] [--why <testo>] [--dry-run]" >&2; exit 2 ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
SCRIPTS="$ROOT/scripts"

diario() {  # esito, ragione — il diario e' un testimone, non un giudice: non fa mai fallire
  [ -f "$SCRIPTS/close-log.sh" ] && bash "$SCRIPTS/close-log.sh" step arma-clone "$1" "$2" >/dev/null 2>&1 || true
}
say() { printf '[arma-clone] %s\n' "$*"; }
err() { printf '[arma-clone] %s\n' "$*" >&2; }

sull_host() { MSYS_NO_PATHCONV=1 ssh -o BatchMode=yes -o ConnectTimeout=8 "$HOST" "$@"; }

# --- 0. IL DRY-RUN NON TOCCA NIENTE, HOST COMPRESO.
#
# ⚠ DIFETTO TROVATO DALLA CI (2026-08-29, sha ed1e6366) — verde in locale, rosso in CI, e
# la differenza non era il codice: era che da qui `linux-pc` risponde e dal runner no.
# Il controllo del dry-run stava DOPO le tre domande all'host, quindi su una macchina che
# non vede il gemello `--dry-run` usciva `IGNOTO` invece di dichiarare cosa avrebbe fatto.
#
# Un dry-run che ha bisogno della rete non e' un dry-run: il suo mestiere e' dire
# l'intenzione senza produrre effetti, e interrogare un host E' un effetto — apre una
# connessione, puo' bloccarsi, e cambia l'esito a seconda di dove lo lanci. Chi vuole
# sapere se l'host risponde lancia il comando vero.
if [ -n "$DRYRUN" ]; then
  say "DRY-RUN — innescherei $UNIT su $HOST${WHY:+ ($WHY)}"
  say "  (non interrogo $HOST: un dry-run non tocca niente, host compreso)"
  exit 0
fi

# --- 1. l'host risponde? Se no si DICHIARA, non si finge di aver armato.
if ! sull_host 'exit 0' 2>/dev/null; then
  err "IGNOTO: $HOST non risponde — nessun clone armato."
  err "        Non e' «a posto»: e' «non ho potuto guardare». Quando torna su, o si"
  err "        rilancia questo comando, o ci pensa il timer settimanale (Persistent=true)."
  diario ignoto "${WHY:-gemello $HOST irraggiungibile: clone NON armato}"
  exit 0
fi

# --- 2. l'unita' esiste su quell'host? Innescare un nome che non c'e' fallirebbe con un
#     messaggio di systemd difficile da leggere dentro il rumore di una chiusura.
if ! sull_host "systemctl cat '$UNIT' >/dev/null 2>&1"; then
  err "FALLITO: l'unita' $UNIT non esiste su $HOST."
  err "        Si installa con lo step 'clone-db' di scripts/provision-linux-pc.sh."
  diario fallito "${WHY:-unita $UNIT assente su $HOST}"
  exit 1
fi

# --- 3. un clone gia' in corso non si accavalla. `systemctl start` su un oneshot attivo
#     non ne lancia un secondo, ma dirlo esplicitamente e' meglio che lasciarlo dedurre.
if sull_host "systemctl is-active --quiet '$UNIT'"; then
  say "un clone e' GIA' in corso su $HOST — non ne accavallo un altro"
  diario saltato "${WHY:-clone gia in corso su $HOST}"
  exit 0
fi

# --- 4. L'ATTO. `--no-block` e' la riga che sgancia il lavoro dalla sessione: systemd
#     prende in carico l'unita' e ritorna subito. Senza, `systemctl start` ATTENDE la
#     fine del oneshot, e saremmo daccapo — appesi all'ssh, con in piu' un livello.
say "innesco $UNIT su $HOST${WHY:+ ($WHY)}"
if ! sull_host "sudo -n systemctl start --no-block '$UNIT'"; then
  err "FALLITO: $HOST ha rifiutato l'innesco (sudo? unita' mascherata?)"
  diario fallito "${WHY:-innesco rifiutato da $HOST}"
  exit 1
fi

# --- 5. L'ARMAMENTO NON E' UNA PROMESSA: si rilegge. `--no-block` ritorna prima che
#     l'unita' sia partita, quindi si concede un istante e si guarda lo stato vero.
#     Un'attesa breve e limitata: qui non si aspetta il CLONE (sono minuti), si aspetta
#     che systemd l'abbia PRESO IN CARICO (sono millisecondi).
stato="$(sull_host "for i in 1 2 3 4 5 6 7 8 9 10; do s=\$(systemctl is-active '$UNIT' 2>/dev/null); case \"\$s\" in activating|active) echo \"\$s\"; exit 0;; esac; sleep 0.5; done; echo \"\$s\"" 2>/dev/null || echo sconosciuto)"
case "$stato" in
  activating|active)
    pid="$(sull_host "systemctl show -p MainPID --value '$UNIT'" 2>/dev/null || echo '?')"
    say "PRESO IN CARICO da systemd (stato=$stato, MainPID=$pid)"
    say "  il clone e' figlio di systemd, non di questo ssh: chiudere la sessione non lo tocca"
    say "  come e' finito:  ssh $HOST 'systemctl show -p Result --value $UNIT'"
    diario eseguito "${WHY:-clone armato su $HOST: $UNIT presa in carico da systemd (stato=$stato)}"
    exit 0 ;;
  *)
    # Non e' un fallimento certo: un oneshot brevissimo puo' essere gia' finito. Si
    # guarda l'esito prima di dare un verdetto — dichiarare «fallito» un clone riuscito
    # sarebbe lo stesso difetto, al contrario.
    res="$(sull_host "systemctl show -p Result --value '$UNIT'" 2>/dev/null || echo sconosciuto)"
    if [ "$res" = "success" ]; then
      say "l'unita' e' gia' terminata con successo (stato=$stato, Result=$res)"
      diario eseguito "${WHY:-clone su $HOST concluso subito: Result=success}"
      exit 0
    fi
    err "IGNOTO: innesco accettato ma stato=$stato, Result=$res"
    err "        Guardare:  ssh $HOST 'systemctl status $UNIT'"
    diario ignoto "${WHY:-innesco accettato su $HOST ma stato non confermato: $stato/$res}"
    exit 0 ;;
esac
