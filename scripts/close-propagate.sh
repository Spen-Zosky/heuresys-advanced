#!/usr/bin/env bash
#
# scripts/close-propagate.sh — the SINGLE canonical close propagation (design §12.2 / §13.3).
#
# Runs BOTH channels that keep the active machines (Windows source + vm + linux-pc) true
# clones, so neither can be silently skipped. (Mac RETIRED from `all` in S1007 — dead weight:
# 2012 MBP, claude CLI SIGILLs; still reachable on-demand via `align-clones.sh mac`.)
#   1. align-clones.sh all      — repo + gitignored payload + .env key-merge + project memories
#                                 (sync-memory-tree) + PROD deploy (vm/linux-pc)
#   2. align-claude-ecosystem.sh all — Claude catalog (CLAUDE.md/skills/commands/settings) + SDK
#                                 + plugin verify-SHA (Opzione C: drift made visible, manual update)
# Then, by policy, refreshes the linux-pc bare-metal DB clone (clone-vm-db.sh) when the session
# touched VM data (or when forced).
#
# Resilience vs fail-loud (§13.3): both channels run with --resilient, so an UNREACHABLE host is
# skipped with a warning (never blocks the close); a channel that FAILS on a REACHABLE host makes
# this script exit non-zero (fail-loud — the close is not clean). The skill `handoff` Step 4b calls
# this; on a red exit it must investigate, never bypass.
#
# #165 — IL DEPLOY NON SI ASPETTA PIU'. Fino a S1048 `--auto-deploy` deployava QUI, in linea,
# e vm-deploy.sh chiamava ci-gate.sh, che polla fino a 900s aspettando che la CI diventi verde:
# la sessione restava aperta a guardare un controllo che non richiede nessuno che guardi
# (misura S1048: un giro completo di CI vale 20-30 minuti su una sola macchina self-hosted).
# Adesso la chiusura ARMA e basta — spinge `refs/heads/prod` sullo sha appena pushato — e il
# deploy lo esegue heuresys-advanced-deploy-watch.timer sui due host quando la CI passa al verde.
# L'armamento e' un push: costa un secondo. Chi vuole ancora il deploy sincrono usa `--deploy-now`.
#
# Usage (from the Windows PC, Git Bash):
#   bash scripts/close-propagate.sh [--full|--delta]
#                                   [--deploy|--auto-deploy|--no-deploy|--deploy-now]
#                                   [--clone-db|--no-clone-db]
#   defaults: --delta --auto-deploy   clone-db=auto (refresh iff db/migrations|db/seeds changed)
#     --auto-deploy : arma SE i commit di sessione toccano path di deploy (default)
#     --deploy      : arma comunque (chi sa, comanda)
#     --deploy-now  : deploy SINCRONO come prima di #165 — aspetta la CI. Scappatoia.
#     --no-deploy   : ne' arma ne' deploya
set -euo pipefail
# NOTE: do NOT globally export MSYS_NO_PATHCONV=1 — align-claude-ecosystem.sh manages
# it per-ssh-call (rssh) and its local jq calls on staging-dir POSIX paths need MSYS
# path conversion active. Close-propagate only needs it for its own direct SSH calls.

ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
# I path che decidono: una sola definizione, e caricata PRIMA di chiunque la usi —
# la riga 112 (clone-db) la legge molto prima del punto in cui stava la vecchia copia (S1069).
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deploy-paths.sh"   # accanto allo script, non a $ROOT: regge anche in una fixture (S1069)
SCRIPTS="$ROOT/scripts"

# L'id di questa CORSA di chiusura, ereditato da ogni passo che scrive nel diario
# (#148). Senza, `close-log.sh report` non sapeva dire dove finiva una chiusura e
# ne cominciava un'altra: 84 righe su 96 finivano in un blocco unico.
export HEURESYS_CLOSE_RUN="${HEURESYS_CLOSE_RUN:-$(date +%Y%m%dT%H%M%S)-$$}"

# ...e la SESSIONE che sta chiudendo (#191). Si deriva UNA volta e si eredita: se ogni passo la
# ricalcolasse per conto suo, un passo che gira dopo il commit di handoff e uno che gira prima
# scriverebbero due numeri diversi per la stessa chiusura. `align-clones.sh` scrive nel diario
# anche quando e' invocato da qui: senza questa export, la sua riga sarebbe di un'altra sessione.
export HEURESYS_SESSION="${HEURESYS_SESSION:-$(bash "$SCRIPTS/close-log.sh" sessione 2>/dev/null || echo 'S?')}"
MARKER="${HEURESYS_MARKER:-$ROOT/.session-align.marker}"   # env override: solo per i test (default invariato)
LINUXPC_REPO="${LINUXPC_REPO:-/home/enzo/heuresys-advanced}"

MODE="--delta"; DEPLOY="--auto-deploy"; CLONE_DB="auto"; DRYRUN="${CLOSE_PROPAGATE_DRYRUN:-}"
for a in "$@"; do
  case "$a" in
    --full)        MODE="" ;;            # align-clones full mode = omit --delta
    --delta)       MODE="--delta" ;;
    --deploy)      DEPLOY="--deploy" ;;
    --auto-deploy) DEPLOY="--auto-deploy" ;;
    --no-deploy)   DEPLOY="--no-deploy" ;;
    --deploy-now)  DEPLOY="--deploy-now" ;;   # #165: comportamento pre-sgancio (sincrono)
    --resilient)   : ;;                  # accepted for compat; resilience is always on here
    --clone-db)    CLONE_DB="force" ;;
    --no-clone-db) CLONE_DB="skip" ;;
    --dry-run)     DRYRUN=1 ;;           # print the resolved plan and exit (no channel runs)
    *) echo "unknown arg: $a" >&2; exit 1 ;;
  esac
done

# HEURESYS_CLOSE_NODEPLOY=1 — veto sul deploy che VINCE sui flag (S1030).
# Nasce da un rilievo di review sull'orchestratore `zero-pending-loop`: la sua chiusura
# di ciclo invoca questo script con `--auto-deploy`, e il filtro per classe di rischio
# governa la SELEZIONE del cluster, non il rito di chiusura — quindi il deploy non era
# filtrato da nulla. In corsia non presidiata significava: alle 03:00 ciò che una sessione
# ha pushato arriva su www.heuresys.com con `git reset --hard` + restart systemd, senza
# nessuno che guardi. Un chiamante non presidiato ora esporta questa variabile e il divieto
# è imposto QUI, dal codice, invece che chiesto in prosa alla skill. Il flag esplicito da
# riga di comando non può scavalcarla: è un veto, non un default.
if [ "${HEURESYS_CLOSE_NODEPLOY:-0}" = "1" ]; then
  if [ "$DEPLOY" != "--no-deploy" ]; then
    echo "[veto] HEURESYS_CLOSE_NODEPLOY=1 -> deploy disabilitato (era $DEPLOY)" >&2
  fi
  DEPLOY="--no-deploy"
fi

log()  { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }
warn() { printf '\033[33m[warn]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31m[FATAL]\033[0m %s\n' "$*" >&2; exit 1; }

FAILED=""

# --- clone-db decision (policy §12.3-B: conditional) — computed up-front so --dry-run shows it
# DOTTRINA DEL DUBBIO (S1046, gemella di quella in align-clones.sh): il COMPORTAMENTO qui era già
# corretto — azione cara, stato ignoto ⟹ non agire. A essere sbagliato era il MESSAGGIO: quando il
# marcatore manca (consumato dalla propagazione precedente) il vecchio testo dichiarava «no
# db/migrations|seeds change this session», cioè affermava un fatto che in quel ramo il sistema non
# è più in grado di conoscere. Ora i tre stati sono distinti e ciascuno dice su cosa si basa:
# misurato-sì / misurato-no / IGNOTO. Una risposta sbagliata detta con la faccia di una giusta
# costa più di una ripetizione.
need_clone=0; clone_why=""
case "$CLONE_DB" in
  force) need_clone=1; clone_why="--clone-db esplicito" ;;
  skip)  need_clone=0; clone_why="--no-clone-db" ;;
  auto)
    if [ -f "$MARKER" ] && [ -n "$(head -1 "$MARKER" | tr -d '\r')" ]; then
      start_head="$(head -1 "$MARKER" | tr -d '\r')"
      if [ -n "$(git diff --name-only "$start_head"..HEAD 2>/dev/null | grep -E "$CLONE_DB_PATHS_RE" || true)" ]; then
        need_clone=1; clone_why="misurato: db/migrations|seeds cambiati in ${start_head:0:8}..HEAD"
      else
        need_clone=0; clone_why="misurato: nessun cambiamento in db/migrations|seeds da ${start_head:0:8}"
      fi
    else
      need_clone=0
      clone_why="IGNOTO: marcatore assente o vuoto — la finestra di sessione non è più misurabile; clone NON eseguito, forza con --clone-db"
      warn "clone-db: $clone_why"
    fi ;;
esac

# --- decisione di ARMAMENTO (#165) ----------------------------------------------------------
# Stesso predicato che align-clones.sh:101-113 usava per decidere il deploy, calcolato QUI e
# PRIMA di chiamarlo: align-clones consuma il marcatore alla fine (riga 194), quindi leggerlo
# dopo sarebbe una corsa. La regex e' la stessa di align-clones.sh:49 — se una delle due cambia
# senza l'altra, si arma su un criterio e si deploya su un altro.
ARM_PATHS_RE="$DEPLOY_PATHS_RE"   # stesso criterio del deploy, per costruzione e non per copia (S1069)
ARM_REF="${DEPLOY_ARM_REF:-prod}"
do_arm=0; arm_why=""; align_deploy_flag="--no-deploy"
case "$DEPLOY" in
  --no-deploy)  do_arm=0; arm_why="--no-deploy (o veto HEURESYS_CLOSE_NODEPLOY)" ;;
  --deploy-now) do_arm=0; arm_why="--deploy-now: deploy SINCRONO in linea (comportamento pre-#165)"
                # #217 I3: da qui in poi vm-deploy NON aspetta piu' la CI per default.
                # --deploy-now e' la richiesta esplicita di aspettarla, quindi e' QUI che
                # si rimette il polling — e vm-deploy-remote la inoltra al remoto.
                export CI_GATE_NONBLOCKING=0
                align_deploy_flag="--deploy" ;;
  --deploy)     do_arm=1; arm_why="--deploy esplicito" ;;
  --auto-deploy)
    if [ -n "$MODE" ] && [ -f "$MARKER" ] && [ -n "$(head -1 "$MARKER" | tr -d '\r')" ]; then
      arm_head="$(head -1 "$MARKER" | tr -d '\r')"
      if [ -n "$(git diff --name-only "$arm_head"..HEAD 2>/dev/null | grep -E "$ARM_PATHS_RE" || true)" ]; then
        do_arm=1; arm_why="misurato: i commit ${arm_head:0:8}..HEAD toccano path di deploy"
      else
        do_arm=0; arm_why="misurato: nessun commit su path di deploy da ${arm_head:0:8}"
      fi
    elif [ -n "$MODE" ] && git rev-parse --verify -q "origin/$ARM_REF" >/dev/null 2>&1; then
      # SECONDA CORSA NELLA STESSA SESSIONE (#212, S1067). La prima propagazione CONSUMA il
      # marcatore (align-clones.sh:194), quindi la seconda cadeva in IGNOTO e NON armava: la
      # chiusura diceva «propagato» mentre refs/heads/prod restava sul commit vecchio. Successo
      # DUE volte in S1066, ed e' il caso di una sessione che va BENE — chi chiude, trova un
      # rosso, corregge e ri-chiude propaga per forza due volte.
      #
      # Il marcatore risponde a «cosa ho fatto in questa sessione». Non e' la domanda giusta:
      # quella e' «cosa non e' ancora in produzione», e la porta `origin/$ARM_REF..HEAD`, che
      # non si consuma e non dipende dal ricordarsi di scriverla. E' anche piu' SEVERA: se una
      # sessione precedente ha lasciato del codice non armato, questa finestra lo vede e quella
      # di sessione no.
      arm_span="origin/$ARM_REF..HEAD"
      if [ -z "$(git rev-list --count "$arm_span" 2>/dev/null | grep -v '^0$' || true)" ]; then
        do_arm=0; arm_why="ri-derivato: origin/$ARM_REF e' gia' su HEAD, non c'e' niente da armare"
      elif [ -n "$(git diff --name-only "$arm_span" 2>/dev/null | grep -E "$ARM_PATHS_RE" || true)" ]; then
        do_arm=1
        arm_why="ri-derivato da $arm_span (marcatore consumato): $(git rev-list --count "$arm_span") commit non armati toccano path di deploy"
        warn "marcatore assente — finestra ri-derivata da origin/$ARM_REF: $arm_why"
      else
        do_arm=0
        arm_why="ri-derivato da $arm_span (marcatore consumato): $(git rev-list --count "$arm_span") commit non armati, nessuno su path di deploy"
      fi
    else
      # Dottrina del dubbio, gemella di align-clones.sh:108-111: armare fa partire un deploy in
      # PROD senza nessuno che guardi, quindi e' azione cara e nel dubbio NON si esegue. Ci si
      # arriva solo se manca ANCHE origin/$ARM_REF (mai fetchato) o se la modalita' e' full:
      # li' non esiste nessuna finestra misurabile, e IGNOTO e' la risposta onesta.
      do_arm=0
      arm_why="IGNOTO: nessuna finestra misurabile (marcatore assente E origin/$ARM_REF sconosciuto, o modalita' full) — non armo nel dubbio; forza con --deploy"
      warn "armamento non eseguito — $arm_why"
    fi ;;
esac

# --dry-run / CLOSE_PROPAGATE_DRYRUN: print the resolved plan and exit BEFORE touching any channel
# (used by scripts/test/run-shell-tests.sh — flag parsing + clone-db conditional decision, §12.5).
if [ -n "$DRYRUN" ]; then
  mode_label="$([ -n "$MODE" ] && echo delta || echo full)"
  case "$DEPLOY" in
    --deploy-now) arm_label="deploy-now" ;;
    --no-deploy)  arm_label="$([ "${HEURESYS_CLOSE_NODEPLOY:-0}" = "1" ] && echo veto || echo no)" ;;
    *)            arm_label="$([ "$do_arm" = 1 ] && echo arma || echo no)" ;;
  esac
  echo "PLAN mode=$mode_label deploy=$DEPLOY clone-db=$CLONE_DB need_clone=$need_clone"
  echo "PLAN clone-db-why: $clone_why"
  echo "PLAN arm=$arm_label ref=$ARM_REF align-deploy-flag=$align_deploy_flag"
  echo "PLAN arm-why: $arm_why"
  # #217 I3 — la scelta «aspetto la CI oppure no» va LETTA, non presunta: senza questa riga
  # il piano dichiarava il deploy ma taceva sul suo comportamento piu' importante.
  echo "PLAN ci-gate-nonblocking=${CI_GATE_NONBLOCKING:-1} ($([ "${CI_GATE_NONBLOCKING:-1}" = 0 ] && echo 'aspetta la CI' || echo 'non aspetta: arma e finisce'))"
  exit 0
fi

# --- channel 1: repo + payload + memories + deploy -----------------------------------------
log "channel 1/2 — align-clones (repo + payload + memories${align_deploy_flag:+ + deploy=$align_deploy_flag})"
if ! bash "$SCRIPTS/align-clones.sh" all $MODE --resilient $align_deploy_flag; then
  FAILED="$FAILED align-clones"
fi

# --- channel 2: Claude ecosystem (catalog + skills + SDK + plugin verify-SHA) ---------------
log "channel 2/2 — align-claude-ecosystem (catalog + skills + SDK)"
if [ -f "$SCRIPTS/align-claude-ecosystem.sh" ]; then
  eco_mode=""; [ "$MODE" = "--delta" ] && eco_mode="--delta"
  # --skip-smoke: VM + linux-pc smoke is bypassed; the verify report is the quality gate instead.
  # (Mac retired from `all` in S1007; its claude CLI SIGILLed on the 2012 Ivy Bridge CPU anyway.)
  if ! bash "$SCRIPTS/align-claude-ecosystem.sh" all $eco_mode --resilient --skip-smoke; then
    FAILED="$FAILED align-claude-ecosystem"
  fi
else
  warn "align-claude-ecosystem.sh absent — ecosystem channel skipped (skill/CLAUDE.md won't propagate)"
fi

# --- linux-pc bare-metal DB refresh (policy §12.3-B: conditional; need_clone computed above) -
clone_outcome="saltato"
if [ "$need_clone" = 1 ]; then
  log "clone-db — linux-pc DB refresh ($clone_why)"
  if MSYS_NO_PATHCONV=1 ssh -o BatchMode=yes -o ConnectTimeout=8 linux-pc 'exit 0' 2>/dev/null; then
    if MSYS_NO_PATHCONV=1 ssh -o BatchMode=yes linux-pc "cd '$LINUXPC_REPO' && bash scripts/clone-vm-db.sh"; then
      clone_outcome="eseguito"
    else
      FAILED="$FAILED clone-vm-db"; clone_outcome="fallito"
      clone_why="$clone_why — MA clone-vm-db.sh è uscito in errore su linux-pc"
    fi
  else
    warn "linux-pc unreachable — clone-db skipped (run scripts/clone-vm-db.sh there when up)"
    clone_outcome="ignoto"
    clone_why="$clone_why — MA linux-pc irraggiungibile: eseguire scripts/clone-vm-db.sh là quando torna su"
  fi
else
  log "clone-db — non eseguito: $clone_why"
  case "$clone_why" in IGNOTO*) clone_outcome="ignoto" ;; esac
fi
# --- ARMAMENTO (#165) — l'ultimo atto della chiusura, e dura un secondo -----------------------
# Si arma SOLO se i canali sono puliti: mandare in produzione sopra un allineamento fallito
# significherebbe deployare una macchina che non sappiamo in che stato sia.
arm_outcome="saltato"
if [ "$do_arm" = 1 ] && [ -z "$FAILED" ]; then
  # #217 I4 — l'ATTO sta in scripts/arma-deploy.sh, chiamato anche da align-clones.sh.
  # Qui resta la DECISIONE (la finestra misurata sopra), che e' cio' che questo script sa
  # e l'altro no. Il diario lo scrive arma-deploy: registrarlo anche qui darebbe due righe
  # per un passo solo, che e' esattamente il difetto che #217 vuole togliere dal rendiconto.
  log "arma — origin/$ARM_REF -> $(git rev-parse --short HEAD) ($arm_why)"
  if bash "$SCRIPTS/arma-deploy.sh" --ref "$ARM_REF" --why "$arm_why"; then
    arm_outcome="eseguito"
  else
    FAILED="$FAILED arma"; arm_outcome="fallito"
    warn "armamento rifiutato — vedi il messaggio di arma-deploy.sh qui sopra"
  fi
  arm_logged=1
elif [ "$do_arm" = 1 ]; then
  arm_outcome="saltato"; arm_why="$arm_why — MA i canali sono falliti:$FAILED, non armo sopra un allineamento rotto"
  warn "$arm_why"
else
  log "arma — non eseguito: $arm_why"
  case "$arm_why" in IGNOTO*) arm_outcome="ignoto" ;; esac
fi
# Il diario dell'armamento lo scrive arma-deploy.sh quando ha AGITO (#217 I4). Qui si
# registrano solo i rami in cui non e' stato chiamato: non armato, o saltato perche' i
# canali erano rotti. Senza questa guardia lo stesso passo comparirebbe due volte.
[ "${arm_logged:-0}" = 1 ] || { [ -f "$SCRIPTS/close-log.sh" ] && bash "$SCRIPTS/close-log.sh" step arma "$arm_outcome" "$arm_why" >/dev/null 2>&1 || true; }

[ -f "$SCRIPTS/close-log.sh" ] && bash "$SCRIPTS/close-log.sh" step clone-db "$clone_outcome" "$clone_why" >/dev/null 2>&1 || true
[ -f "$SCRIPTS/close-log.sh" ] && bash "$SCRIPTS/close-log.sh" step propaga \
  "$([ -n "$FAILED" ] && echo fallito || echo eseguito)" \
  "canali: align-clones + align-claude-ecosystem (mode=${MODE:-full}, deploy=$DEPLOY)${FAILED:+ — falliti:$FAILED}" >/dev/null 2>&1 || true

# --- fail-loud on any reachable-host channel failure ---------------------------------------
if [ -n "$FAILED" ]; then
  die "close-propagate: channel(s) failed on a reachable host:$FAILED — investigate (close NOT clean)"
fi
# --- LETTURA DALLE MACCHINE (S1054, richiesta di Enzo) ---------------------------------------
# L'ultimo atto della chiusura non e' un'azione: e' una LETTURA. Fino a ieri la chiusura
# finiva con «armato» e li' si fermava — corretto, perche' il deploy avviene dopo, quando
# la CI passa al verde. Ma «armato» e' cio' che ho FATTO IO, non cio' che e' successo: il
# fatto vive sulle macchine, in `LAST_GOOD_SHA`, nei servizi attivi e in una produzione che
# risponde. Questo passo va a leggerlo e lo dichiara con un vocabolario chiuso
# (DEPLOYATO / IN-VOLO / CI-ROSSA / DISALLINEATO / NON-VERIFICATO), cosi' «chiuso» significa
# la stessa cosa in giorni diversi.
#
# NON aspetta: subito dopo l'armamento lo stato sara' quasi sempre IN-VOLO, ed e' giusto
# cosi' — #165 dice che la sessione non resta a guardare un controllo che non richiede
# nessuno che guardi. Serve a due cose: dire con precisione DOVE si e' arrivati, e cogliere
# il caso in cui il deploy era gia' avvenuto (ri-chiusura, o CI gia' verde da prima).
# Per sapere com'e' finita piu' tardi: `bash scripts/verifica-deploy.sh`.
#
# Non entra in FAILED: un deploy in volo non e' una chiusura sporca. Un DISALLINEATO invece
# e' un guasto vero, e viene detto forte — ma resta una diagnosi da leggere, non un motivo
# per bloccare una propagazione gia' andata a buon fine.
# ---------------------------------------------------------------------------
# IL CANCELLO A TEMPO (#228, S1079) — «e' marcito qualcosa mentre non guardavo?»
#
# `verify_gate` guarda il DIFF: un controllo scatta solo se qualcuno tocca un file che lo
# instrada. Presume che le cose si guastino solo quando le tocchi. I sette difetti bonificati
# in S1079 dicono di no: una data che scade, un'altra voce che si chiude, una macchina che
# cambia, il database che si muove — nessuno di questi produce un diff, e nessun cancello
# legato al diff puo' vederli.
#
# Sta QUI e non nella skill `handoff` di proposito: la skill istruisce il modello, questo
# script gira. Un cancello che dipende dal fatto che qualcuno se lo ricordi e' esattamente
# il difetto da cui nasce.
#
# NON entra in FAILED: e' una diagnosi, non un guasto della propagazione. Il suo esito va nel
# messaggio di chiusura con lo stesso peso degli altri passi — un rosso taciuto qui e' un
# elenco di azioni che mente alla sessione successiva.
if [ -f "$ROOT/docs/kb/tools/check_marciume.py" ]; then
  bold "=== marciume — cosa e' cambiato senza che nessuno lo toccasse (lettura, non azione) ==="
  marciume_esito="ignoto"
  if PYTHONUTF8=1 PYTHONIOENCODING=utf-8 python "$ROOT/docs/kb/tools/check_marciume.py"; then
    marciume_esito="eseguito"
  else
    rc=$?
    case "$rc" in
      1) marciume_esito="fallito"; warn "marciume: qualcosa e' marcito — vedi i [!!] qui sopra (la propagazione resta valida)" ;;
      *) marciume_esito="ignoto";  warn "marciume: NON MISURABILE (exit $rc) — «non lo so» non e' «a posto»" ;;
    esac
  fi
  [ -f "$SCRIPTS/close-log.sh" ] && bash "$SCRIPTS/close-log.sh" step marciume "$marciume_esito" "cancello a tempo: strumenti scoperti + 5 controlli di stato" >/dev/null 2>&1 || true
fi

if [ -f "$SCRIPTS/verifica-deploy.sh" ]; then
  log "verifica — cosa dicono le macchine (lettura, non azione)"
  set +e
  # Nessun argomento: lo sha di riferimento lo risolve lo script da `refs/heads/prod`
  # (l'ultimo ARMATO). Passargli HEAD reintrodurrebbe il difetto per cui un commit
  # di sola documentazione faceva dire «0/2 host allineati».
  bash "$SCRIPTS/verifica-deploy.sh"
  verifica_rc=$?
  set -e
  case "$verifica_rc" in
    0) verifica_esito="eseguito" ;;
    1) verifica_esito="fallito"; warn "verifica-deploy: stato NON sano — vedi sopra (la propagazione resta valida)" ;;
    *) verifica_esito="ignoto";  warn "verifica-deploy: non misurabile — «non lo so» non e' «a posto»" ;;
  esac
  [ -f "$SCRIPTS/close-log.sh" ] && bash "$SCRIPTS/close-log.sh" step verifica-deploy     "$verifica_esito" "lettura da host+CI+produzione sullo sha $(git rev-parse --short HEAD)" >/dev/null 2>&1 || true
fi

log "close-propagate complete (mode=${MODE:-full} deploy=$DEPLOY arma=$arm_outcome clone-db=$CLONE_DB)"
