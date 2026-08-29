#!/usr/bin/env bash
#
# scripts/posso-uscire.sh — l'ultima domanda di ogni chiusura: «posso fare /exit adesso?»
#
# PERCHE' ESISTE (Enzo, 2026-08-29, a chiusura di S1084). La chiusura dichiara che i lavori
# remoti sono ARMATI e proseguono da soli, ma non dice niente su cio' che sta girando **qui
# dentro** — e sono due cose diverse. Un `/exit` dato nel momento sbagliato uccide i lavori
# locali in volo: quelli si', sono figli della sessione.
#
# LA DISTINZIONE CHE QUESTO COMANDO RENDE VISIBILE:
#
#   sopravvive a /exit          muore con /exit
#   ------------------          --------------------------------
#   deploy   (timer systemd)    i task in background della CLI
#   clone    (timer systemd)    gli `ssh` in primo piano
#   backup, storia36, ...       gli script locali lanciati da qui
#
# Cioe': **i lavori remoti armati non sono un motivo per aspettare**, ed e' esattamente il
# punto di #165 e #236. Se questo comando dice di attendere, e' per qualcosa che gira su
# QUESTA macchina.
#
# VOCABOLARIO CHIUSO, come gli altri verdetti del progetto:
#   USCITA SICURA   niente di locale in volo: /exit non perde nulla
#   ATTENDI         N lavori locali stanno girando, e /exit li ucciderebbe
#   NON-VERIFICATO  non ho potuto guardare — NON e' «a posto»
#
# Uso:  bash scripts/posso-uscire.sh [--tasks <dir>] [--breve]
# Uscita: 0 = USCITA SICURA · 1 = ATTENDI · 2 = NON-VERIFICATO
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASKS="${POSSO_USCIRE_TASKS:-}"
BREVE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tasks) TASKS="${2:?--tasks richiede una directory}"; shift 2 ;;
    --breve) BREVE=1; shift ;;
    *) echo "uso: posso-uscire.sh [--tasks <dir>] [--breve]" >&2; exit 2 ;;
  esac
done

riga() { printf '  %-26s %s\n' "$1" "$2"; }

# --- 1. dove stanno i task in background di QUESTA sessione.
# Non si indovina: se non la si trova, si dichiara. Un «tutto a posto» nato dal non aver
# guardato e' identico a uno nato da una misura, ed e' la peggiore delle risposte.
if [ -z "$TASKS" ]; then
  base="${TEMP:-${TMP:-/tmp}}/claude"
  # la directory `tasks` piu' recente sotto il progetto corrente
  TASKS="$(ls -dt "$base"/*/*/tasks 2>/dev/null | head -1)"
fi

echo "posso-uscire — cosa muore con /exit, e cosa no"

in_volo=""
n_task=0
if [ -z "$TASKS" ] || [ ! -d "$TASKS" ]; then
  riga "task in background" "NON MISURABILE (directory dei task non trovata)"
  VERDETTO="NON-VERIFICATO"
else
  # ⚠ IL CRITERIO E' LA CODA DEL FILE, non la sua data. Un task che gira da un'ora e non
  # scrive niente ha un file vecchio ed e' vivissimo; uno finito un secondo fa ha un file
  # recente ed e' morto. La riga finale la scrive l'harness: `[exited with code N]`
  # oppure `[killed]`. Un file senza nessuna delle due = lavoro ancora in volo.
  #
  # ⚠ E SI ESCLUDE SE STESSO. Alla prima esecuzione questo strumento ha dichiarato ATTENDI
  # per un task che era **la sua stessa corsa**: l'harness apre un file di output per il
  # comando in esecuzione, e quel file non ha la riga finale finche' il comando non
  # finisce — cioe' mai, dal punto di vista di chi lo sta leggendo. Sarebbe stato un
  # ATTENDI perpetuo, cioe' un allarme che si impara a ignorare.
  #
  # Il riconoscimento e' meccanico e non fragile: se dentro il file c'e' l'intestazione di
  # QUESTO script, quel task e' questa corsa. Non si esclude «il piu' recente» (un altro
  # lavoro appena partito verrebbe scartato) ne' per data (un task lento che non stampa
  # niente ha un file vecchio ed e' vivissimo).
  # Il marcatore va su **stderr**: il file del task raccoglie l'output del comando, e chi
  # lancia questo script per leggerlo redirige semmai stdout, non entrambi. Misurato: il
  # file del task contiene davvero lo stdout non rediretto (prova col marcatore, 2026-08-29).
  IO_STESSO="posso-uscire-marcatore-$$-$(date +%s)"
  printf '# %s  (marcatore: serve a NON contare questa stessa corsa)\n' "$IO_STESSO" >&2
  sleep 1                     # l'harness scrive il file con un attimo di ritardo
  mio=""
  for f in "$TASKS"/*.output; do
    [ -e "$f" ] || continue
    grep -qF "$IO_STESSO" "$f" 2>/dev/null && { mio="$f"; continue; }
    n_task=$((n_task + 1))
    if ! tail -3 "$f" 2>/dev/null | grep -qE '^\[(exited with code [0-9-]+|killed)\]'; then
      in_volo="$in_volo $(basename "$f" .output)"
    fi
  done
  # Se non mi sono ritrovato, l'output e' rediretto e uno dei task «in volo» potrebbe
  # essere questa stessa corsa. Si DICHIARA invece di indovinare: e' la differenza fra un
  # allarme e un rumore.
  if [ -z "$mio" ] && [ -n "$in_volo" ]; then
    riga "  nota" "non mi sono ritrovato fra i task (output rediretto?): uno di quelli in volo puo' essere questa corsa"
  fi
  if [ -n "$in_volo" ]; then
    riga "task in background" "⚠ IN VOLO:$in_volo  (su $n_task totali)"
  else
    riga "task in background" "nessuno in volo ($n_task conclusi)"
  fi
fi

# --- 2. gli ssh in primo piano: sono figli di questa shell, e /exit li recide.
#     `pgrep` non c'e' su Git Bash — si usa ps, che c'e' sempre.
ssh_vivi="$(ps -ef 2>/dev/null | grep -cE '[s]sh -o BatchMode|[s]sh .*(linux-pc|oracle-vm)' || true)"
[ -n "$ssh_vivi" ] || ssh_vivi=0
if [ "$ssh_vivi" -gt 0 ]; then
  riga "ssh in primo piano" "⚠ $ssh_vivi vivi — un /exit li recide a meta' lavoro"
else
  riga "ssh in primo piano" "nessuno"
fi

# --- 3. cio' che NON muore, e va detto perche' e' la meta' che rassicura.
#     Non si interroga la rete: qui si dichiara il MECCANISMO (un timer systemd non e'
#     figlio di questa sessione), non lo stato — quello lo dice `verifica-cloni.sh`.
riga "deploy armato" "prosegue da se' (timer systemd sulla VM e sul gemello)"
riga "clone armato" "prosegue da se' (heuresys-advanced-clonedb.service, #236 F2)"
riga "  lo stato dei tre" "bash scripts/verifica-cloni.sh"

# --- 4. il verdetto
# ⚠ Doppi apici in ogni printf: un apostrofo dentro una stringa a singoli apici la chiude
# e trasforma il resto in sintassi. Costato un caso negativo verde in S1084, due volte in
# un giorno — e in un file accanto l'avvertimento c'era gia'.
if [ "${VERDETTO:-}" = "NON-VERIFICATO" ]; then
  printf "\n  VERDETTO: NON-VERIFICATO — non ho potuto guardare i task locali.\n"
  printf "  Non e' «a posto»: e' «non lo so». Passare --tasks <dir> per misurare.\n"
  exit 2
fi
if [ -n "$in_volo" ] || [ "$ssh_vivi" -gt 0 ]; then
  printf "\n  VERDETTO: ATTENDI — qualcosa gira su QUESTA macchina, e /exit lo ucciderebbe.\n"
  [ -n "$in_volo" ] && printf "    task in volo:%s\n" "$in_volo"
  [ "$ssh_vivi" -gt 0 ] && printf "    %s ssh in primo piano\n" "$ssh_vivi"
  printf "    I lavori remoti armati NON sono un motivo per aspettare: quelli proseguono.\n"
  exit 1
fi
printf '\n  VERDETTO: USCITA SICURA — /exit non perde niente.\n'
printf '    Niente di locale in volo; deploy e clone armati proseguono senza questa sessione.\n'
exit 0
