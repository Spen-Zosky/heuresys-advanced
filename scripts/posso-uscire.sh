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
# ⚠ LIMITE NOTO, dichiarato invece che nascosto (S1090): il conteggio degli `ssh` in primo
# piano e' PER MACCHINA, non per sessione. Con due sessioni aperte sullo stesso albero, l'ssh
# di una fa dire ATTENDI anche all'altra, che non ha niente in volo. E' successo in S1090: la
# sessione di `#219` stava estraendo i referti E2E dal runner, e questa chiusura ha ereditato
# il suo ATTENDI. Il conteggio dei TASK e' stato ancorato al progetto (sotto); per l'ssh non
# esiste un modo altrettanto semplice di attribuirlo a una sessione, quindi resta cosi' e
# chi legge deve saperlo: davanti a un ATTENDI mosso dal solo ssh, si guarda `ps -ef` e si
# stabilisce di chi e' prima di aspettare.
#
# ⚠⚠ D-90 (S1093/S1094, RISOLTO S1096): IL REGISTRO NON E' L'INSIEME. Questo strumento leggeva
# i FILE dei task e concludeva sui PROCESSI: un task ucciso dal sistema (o il cui file l'harness
# non ha mai chiuso) restava «in volo» per sempre, e lo strumento contava la PROPRIA corsa fra
# quelli — tre esecuzioni, tre id diversi, sempre un solo «in volo», sempre se stesso. Un
# ATTENDI permanente e' un cancello che insegna a non guardarlo. Due rimedi, entrambi misurati:
#   1. la misura dei processi VIVI: ogni comando che la CLI sta eseguendo e' un `bash` con un
#      involucro riconoscibile (`shopt -u extglob …`) e la riga di comando intera visibile in
#      `ps -ef` (959 caratteri, misurato). Quelli — tolto questo stesso script — sono i lavori
#      locali che /exit ucciderebbe. Il registro dei file resta come DETTAGLIO: un file senza
#      riga finale ma senza nessun processo vivo e' «concluso o perso», non «in volo»;
#   2. il riconoscimento di se stesso NON dipende piu' dal marcatore su stderr (che sparisce
#      con `2>/dev/null`, ed e' cosi' che in S1094 non si ritrovava): il file di questa corsa
#      contiene l'intestazione che questo script stampa su STDOUT, e un file con quella
#      intestazione e senza riga finale e' una corsa di posso-uscire ancora aperta — questa.
# Limite che resta, dichiarato: gli involucri sono PER MACCHINA, non per sessione — con due
# sessioni CLI aperte, i comandi dell'altra contano. Davanti a un ATTENDI si legge l'elenco dei
# comandi vivi (stampato) e si decide sapendo di chi sono.
#
# Uso:  bash scripts/posso-uscire.sh [--tasks <dir>] [--breve] [--selftest]
# Uscita: 0 = USCITA SICURA · 1 = ATTENDI · 2 = NON-VERIFICATO
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASKS="${POSSO_USCIRE_TASKS:-}"
BREVE=0
SELFTEST=0
INTESTAZIONE="posso-uscire — cosa muore con /exit, e cosa no"
while [ $# -gt 0 ]; do
  case "$1" in
    --tasks) TASKS="${2:?--tasks richiede una directory}"; shift 2 ;;
    --breve) BREVE=1; shift ;;
    --selftest) SELFTEST=1; shift ;;
    *) echo "uso: posso-uscire.sh [--tasks <dir>] [--breve] [--selftest]" >&2; exit 2 ;;
  esac
done

riga() { printf '  %-26s %s\n' "$1" "$2"; }

# --- 1. dove stanno i task in background di QUESTA sessione.
# Non si indovina: se non la si trova, si dichiara. Un «tutto a posto» nato dal non aver
# guardato e' identico a uno nato da una misura, ed e' la peggiore delle risposte.
if [ -z "$TASKS" ]; then
  base="${TEMP:-${TMP:-/tmp}}/claude"
  # ⚠⚠ IL GLOB VA ANCORATO AL PROGETTO, o misura un'ALTRA sessione (S1090, misurato).
  # `"$base"/*/*/tasks` attraversa TUTTI i progetti: il primo livello e' il progetto, il
  # secondo la sessione. Il commento diceva «sotto il progetto corrente» e il codice non lo
  # faceva — e il piu' recente vince, quindi bastava avere una sessione viva su un altro
  # progetto per ereditarne i task. E' successo davvero: la chiusura di S1090 ha dichiarato
  # ATTENDI su `b7e7i6u98` e `btw53u1zz`, che erano di `D--heuresys-datastore`. Un ATTENDI
  # falso e' peggio di un NON-VERIFICATO: sembra una misura, e trattiene chi potrebbe uscire.
  # La CLI nomina la cartella del progetto dal suo percorso, con i separatori resi innocui:
  # `D:\heuresys-advanced` -> `D--heuresys-advanced`.
  # ⚠ In Git Bash `$ROOT` e' `/d/heuresys-advanced`, NON `D:\heuresys-advanced`: la forma
  # Windows la da' `pwd -W`, e solo li' la lettera del disco porta i due punti. Si prova
  # quella e si ripiega sulla conversione del path MSYS, cosi' la riga regge in entrambe.
  win="$(cd "$ROOT" && pwd -W 2>/dev/null || printf '%s' "$ROOT")"
  proj="$(printf '%s' "$win" | sed -e 's#^/\([A-Za-z]\)/#\1:/#' -e 's#^\([A-Za-z]\):#\1-#' -e 's#[/\\]#-#g')"
  TASKS="$(ls -dt "$base/$proj"/*/tasks 2>/dev/null | head -1)"
  # Se il progetto non ha una sua cartella non si ripiega su quella di un altro: si dichiara.
  # Ripiegare rimetterebbe in gioco esattamente il difetto che queste righe tolgono.
fi

# --- la classificazione dei file del registro, in una funzione perche' l'autoprova possa darle
#     una directory finta. Scrive in REG_TOT, REG_SENZA (nomi), REG_MIEI.
classifica_registro() {
  local dir="$1" f
  REG_TOT=0; REG_SENZA=""; REG_MIEI=0
  for f in "$dir"/*.output; do
    [ -e "$f" ] || continue
    if ! tail -3 "$f" 2>/dev/null | grep -qE '^\[(exited with code [0-9-]+|killed)\]'; then
      # senza riga finale: o e' in volo, o e' questa stessa corsa (l'intestazione e' su stdout)
      if grep -qF "$INTESTAZIONE" "$f" 2>/dev/null; then REG_MIEI=$((REG_MIEI + 1)); continue; fi
      REG_SENZA="$REG_SENZA $(basename "$f" .output)"
    fi
    REG_TOT=$((REG_TOT + 1))
  done
}

# --- il verdetto dai due numeri: processi vivi (la verita') e registro (il dettaglio).
#     Stampa e restituisce il codice; e' qui perche' l'autoprova possa chiamarlo con numeri finti.
verdetto() {
  local n_vivi="$1" senza="$2" ssh_n="$3"
  if [ "$n_vivi" -gt 0 ]; then
    printf "\n  VERDETTO: ATTENDI — %s comandi della CLI girano su QUESTA macchina, e /exit li ucciderebbe.\n" "$n_vivi"
    [ -n "$senza" ] && printf "    registro senza riga finale:%s\n" "$senza"
    [ "$ssh_n" -gt 0 ] && printf "    di cui %s con un ssh in primo piano\n" "$ssh_n"
    printf "    I lavori remoti armati NON sono un motivo per aspettare: quelli proseguono.\n"
    return 1
  fi
  printf '\n  VERDETTO: USCITA SICURA — /exit non perde niente.\n'
  if [ -n "$senza" ]; then
    printf '    Il registro ha%s senza riga finale, ma NESSUN processo vivo: conclusi o persi, non in volo.\n' "$senza"
  fi
  printf '    Niente di locale in volo; deploy e clone armati proseguono senza questa sessione.\n'
  printf '    I lavori remoti armati NON sono un motivo per aspettare: quelli proseguono.\n'
  return 0
}

if [ "$SELFTEST" = 1 ]; then
  # A esiti opposti: stessi file, verdetti diversi a seconda dei processi vivi — e' la
  # differenza fra un registro e l'insieme.
  d="$(mktemp -d)"
  printf 'lavoro\n[exited with code 0]\n' > "$d/finito.output"
  printf 'lavoro\n[killed]\n'             > "$d/ucciso.output"
  printf 'lavoro senza fine\n'             > "$d/senzafine.output"
  printf '%s\n  task in background  x\n' "$INTESTAZIONE" > "$d/iostesso.output"
  classifica_registro "$d"
  rossi=0
  chk() { if [ "$1" = "$2" ]; then printf '  [ok] %s\n' "$3"; else printf '  [FAIL] %s (atteso %s, avuto %s)\n' "$3" "$2" "$1"; rossi=$((rossi+1)); fi; }
  chk "$REG_TOT" 3 "conta i file, tolto se stesso (3 su 4)"
  chk "$REG_MIEI" 1 "riconosce la PROPRIA corsa dall'intestazione su stdout, non dal marcatore"
  chk "$(echo $REG_SENZA)" "senzafine" "un file senza riga finale e' segnalato; exited e killed no"
  out="$(verdetto 0 "$REG_SENZA" 0)"; c=$?
  chk "$c" 0 "registro con un senza-fine ma ZERO processi vivi -> USCITA SICURA (concluso o perso)"
  if echo "$out" | grep -q "conclusi o persi"; then chk 1 1 "...e lo dice"; else chk 0 1 "...e lo dice"; fi
  out="$(verdetto 2 "$REG_SENZA" 1)"; c=$?
  chk "$c" 1 "due processi vivi -> ATTENDI, qualunque cosa dica il registro"
  out="$(verdetto 1 "" 0)"; c=$?
  chk "$c" 1 "un processo vivo e registro pulito -> ATTENDI lo stesso: i processi sono la verita'"
  rm -rf "$d"
  printf '  autoprova: %s/7\n' "$((7 - rossi))"
  exit $rossi
fi

echo "$INTESTAZIONE"

REG_SENZA=""; REG_TOT=0; REG_MIEI=0
if [ -z "$TASKS" ] || [ ! -d "$TASKS" ]; then
  # Il registro e' uno dei due occhi: se manca, non si finge di aver guardato con entrambi.
  riga "registro dei task" "NON MISURABILE (directory dei task non trovata)"
  printf "\n  VERDETTO: NON-VERIFICATO — non ho potuto guardare il registro dei task locali.\n"
  printf "  Non e' «a posto»: e' «non lo so». Passare --tasks <dir> per misurare.\n"
  exit 2
else
  classifica_registro "$TASKS"
  if [ -n "$REG_SENZA" ]; then
    riga "registro dei task" "$(echo $REG_SENZA | wc -w) senza riga finale su $REG_TOT:$REG_SENZA"
  else
    riga "registro dei task" "tutti conclusi ($REG_TOT)"
  fi
fi

# --- 2. I PROCESSI VIVI, che sono la verita'. Ogni comando in corso della CLI e' un bash con
#     l'involucro `shopt -u extglob`; si toglie questa stessa corsa (la riga porta il nome di
#     questo script). Gli ssh in primo piano sono un sottoinsieme: si contano dentro.
vivi_righe="$(ps -ef 2>/dev/null | grep '[s]hopt -u extglob' | grep -v 'posso-uscire' || true)"
n_vivi=$(printf '%s' "$vivi_righe" | grep -c . || true); [ -n "$n_vivi" ] || n_vivi=0
# POSSO_USCIRE_PROCESSI=<n> sostituisce la misura: serve alle PROVE (in CI non c'e' nessuna CLI),
# e si dichiara nell'uscita perche' un numero finto non deve poter passare per misurato.
if [ -n "${POSSO_USCIRE_PROCESSI:-}" ]; then
  n_vivi="$POSSO_USCIRE_PROCESSI"; vivi_righe=""
  riga "  nota" "processi vivi DICHIARATI da POSSO_USCIRE_PROCESSI=$n_vivi, non misurati (modo di prova)"
fi
ssh_vivi=$(printf '%s' "$vivi_righe" | grep -cE 'ssh (-[A-Za-z0-9]+ )*[A-Za-z0-9._:-]*(linux-pc|oracle-vm|mac)' || true); [ -n "$ssh_vivi" ] || ssh_vivi=0
if [ "$n_vivi" -gt 0 ]; then
  riga "comandi della CLI vivi" "⚠ $n_vivi (ssh in primo piano: $ssh_vivi)"
  # l'involucro finisce con «|| true && eval '…»: si mostra cio' che viene dopo, cioe' il comando
  printf '%s\n' "$vivi_righe" | sed -e 's/.*|| true && //' -e "s/^eval '//" | cut -c1-96 | sed 's/^/      · /'
else
  riga "comandi della CLI vivi" "nessuno (ssh: 0)"
fi

# --- 3. cio' che NON muore, e va detto perche' e' la meta' che rassicura.
#     Non si interroga la rete: qui si dichiara il MECCANISMO (un timer systemd non e'
#     figlio di questa sessione), non lo stato — quello lo dice `verifica-cloni.sh`.
riga "deploy armato" "prosegue da se' (timer systemd sulla VM e sul gemello)"
riga "clone armato" "prosegue da se' (heuresys-advanced-clonedb.service, #236 F2)"
riga "  lo stato dei tre" "bash scripts/verifica-cloni.sh"

# --- 4. il verdetto: sui processi, col registro come dettaglio.
verdetto "$n_vivi" "$REG_SENZA" "$ssh_vivi"
exit $?
