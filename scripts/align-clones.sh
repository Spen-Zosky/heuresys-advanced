#!/usr/bin/env bash
#
# scripts/align-clones.sh — make Mac and/or the VM CLONES of the local repo.
#
# Two modes:
#   FULL  (default)  — `align-clones.sh all [--deploy]`     : full re-clone of the gitignored
#                      payload (secrets, lean data, all memories). The manual catch-up tool.
#   DELTA (--delta)  — used by the session-close (handoff)  : propagate only what THIS session
#                      changed, read from the session marker (.session-align.marker):
#                        • memories created/updated since session start → sync; deleted → rm on remote
#                        • lean gitignored data → sync only if it changed this session
#                        • code → via git reset (already pushed)
#
# Flags:  <mac|vm|linuxpc|all>  [--deploy|--no-deploy|--auto-deploy]  [--delta]  [--resilient]
#   mac (S1007): RETIRED from `all`/close-propagate (2012 MBP, OpenCore — dead weight; its
#   claude CLI SIGILLs on the Ivy Bridge CPU). Still works as an EXPLICIT on-demand target
#   (`align-clones.sh mac`) if ever revived; it is simply no longer dragged into `all`.
#   linuxpc (B-52): the autonomous PROD twin (192.168.1.11, local DB clone). Part of
#   `all` with FORCED resilience (a LAN host that may be off must never fail the run);
#   as an explicit target it is strict like mac/vm. Its deploy leg reuses vm-deploy.sh
#   with REPO_DIR=/home/enzo/heuresys-advanced (script is env-parameterized).
#   NOTE: its local DB is a clone refreshed via clone-vm-db.sh; migrate-if-pending in
#   the deploy leg keeps the clone's schema current between refreshes.
#   --auto-deploy : deploy the VM only if the session's commits touched deploy-relevant paths
#   --resilient   : skip an unreachable host with a warning instead of failing the run
# The remotes reset to origin/main, so LOCAL COMMITS MUST BE PUSHED FIRST.
# Run from the local PC (Git Bash on Windows).
set -euo pipefail
export MSYS_NO_PATHCONV=1

TARGETS_ARG=""; DEPLOY_FLAG=off; DELTA=0; RESILIENT=0
for a in "$@"; do
  case "$a" in
    mac|vm|linuxpc|all) TARGETS_ARG="$a" ;;
    --deploy)      DEPLOY_FLAG=on ;;
    --no-deploy)   DEPLOY_FLAG=off ;;
    --auto-deploy) DEPLOY_FLAG=auto ;;
    --delta)       DELTA=1 ;;
    --resilient)   RESILIENT=1 ;;
    *) echo "unknown arg: $a" >&2; exit 1 ;;
  esac
done
[ -n "$TARGETS_ARG" ] || { echo "usage: align-clones.sh <mac|vm|linuxpc|all> [--deploy|--no-deploy|--auto-deploy] [--delta] [--resilient]" >&2; exit 1; }

ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
SCRIPTS="$ROOT/scripts"
MARKER="${HEURESYS_MARKER:-$ROOT/.session-align.marker}"   # env override: solo per i test (default invariato)
LOCAL_MEM="${LOCAL_MEM:-$HOME/.claude/projects/D--heuresys-advanced/memory}"
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deploy-paths.sh"   # accanto allo script, non a $ROOT: regge anche in una fixture (S1069)
LEAN_EXCLUDE='(^|/)pg_dump_snapshots/|(^|/)legacy_data/|(^|/)extracted/|(^|/)graphify-(db-input|out)/|^qa_artifacts/|(^|/)_inspection_artifacts/|(^|/)db_snapshots/|\.(dump|backup|log)$|^\.claude/|^cowork_(code_exchange|reserved)/|^sessioni/|(^|/)\.auth/'

log()  { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }
warn() { printf '\033[33m[warn]\033[0m %s\n' "$*" >&2; }

# Refuse to run if local has unpushed commits (the clones reset to origin/main).
git fetch origin --quiet
if [ -n "$(git rev-list origin/main..HEAD 2>/dev/null || true)" ] && [ "${ALIGN_ALLOW_UNPUSHED:-0}" != 1 ]; then
  echo "ERROR: local HEAD is ahead of origin/main — push first (clones reset to origin/main)." >&2
  echo "       Override with ALIGN_ALLOW_UNPUSHED=1 to align to the pushed state anyway." >&2
  exit 1
fi

# --- delta computation from the session marker (line 1 = startHead; rest = memory manifest;
#     the marker file's own mtime = session start, used as the -newer reference) ---
START_HEAD=""; HAVE_MARKER=0; MEM_INCLUDE=""; MEM_DELETE=""; DATA_CHANGED=1
if [ "$DELTA" = 1 ]; then
  if [ -f "$MARKER" ]; then
    HAVE_MARKER=1
    START_HEAD="$(head -1 "$MARKER" | tr -d '\r')"   # strip CR (marker may be CRLF from PowerShell)
    if [ -d "$LOCAL_MEM" ]; then
      MEM_INCLUDE="$(find "$LOCAL_MEM" -maxdepth 1 -type f -newer "$MARKER" -printf '%f\n' 2>/dev/null || true)"
      while IFS= read -r mf; do
        [ -n "$mf" ] || continue
        [ -e "$LOCAL_MEM/$mf" ] || MEM_DELETE="${MEM_DELETE}${mf}"$'\n'
      done < <(tail -n +2 "$MARKER" | tr -d '\r')
    fi
    DATA_CHANGED=0
    [ -n "$(find .secrets .apify apps/showcase/src/app/showcase -type f -newer "$MARKER" 2>/dev/null | head -1)" ] && DATA_CHANGED=1
  else
    # S1046: il deploy NON è più "conservative" in questo ramo — vedi la dottrina del dubbio sotto.
    warn "delta requested but no marker ($MARKER) — full sync; il deploy resta IGNOTO (non eseguito)"
  fi
fi

# --- deploy decision (DOTTRINA DEL DUBBIO, S1046) -------------------------------------------
# Una sola regola per tutta la catena di chiusura quando un predicato NON è misurabile:
#   • azione a costo basso e reversibile (sync repo, sync memorie) → esegui;
#   • azione a costo alto o irreversibile (deploy in PROD, clone del DB) → NON eseguire,
#     dichiara `IGNOTO`, e stampa come forzare.
# Prima di S1046 il ramo `else` faceva l'opposto (`DEPLOY=1`, commento «conservative: deploy»):
# alla SECONDA chiusura di una stessa sessione il marcatore era già stato consumato (vedi in fondo),
# quindi HAVE_MARKER=0, quindi si deployava in produzione ANCHE senza una riga di codice toccata —
# e la condizione protettiva DEPLOY_PATHS_RE, quella su cui contavamo, era proprio ciò che smetteva
# di applicarsi. Nello stesso caso close-propagate.sh decideva all'OPPOSTO (non clonare): due script
# della stessa catena, due default contrari sulla stessa informazione mancante, nessuno dichiarato.
# `--deploy` esplicito resta incondizionato: chi sa, comanda; è il dubbio che non agisce.
DEPLOY_WHY=""
case "$DEPLOY_FLAG" in
  on)  DEPLOY=1; DEPLOY_WHY="--deploy esplicito" ;;
  off) DEPLOY=0; DEPLOY_WHY="--no-deploy" ;;
  auto)
    if [ "$DELTA" = 1 ] && [ "$HAVE_MARKER" = 1 ] && [ -n "$START_HEAD" ]; then
      if [ -n "$(git diff --name-only "$START_HEAD"..HEAD 2>/dev/null | grep -E "$DEPLOY_PATHS_RE" || true)" ]; then
        DEPLOY=1; DEPLOY_WHY="misurato: i commit ${START_HEAD:0:8}..HEAD toccano path di deploy"
      else
        DEPLOY=0; DEPLOY_WHY="misurato: nessun commit su path di deploy in ${START_HEAD:0:8}..HEAD"
      fi
    else
      DEPLOY=0
      DEPLOY_WHY="IGNOTO: nessun delta affidabile ($([ "$DELTA" = 1 ] && echo 'marcatore assente' || echo 'modalità full')) — deploy NON eseguito nel dubbio; forza con --deploy"
      warn "deploy in PROD non eseguito — $DEPLOY_WHY"
    fi ;;
esac
[ -f "$SCRIPTS/close-log.sh" ] && bash "$SCRIPTS/close-log.sh" step deploy \
  "$([ "$DEPLOY" = 1 ] && echo eseguito || { case "$DEPLOY_WHY" in IGNOTO*) echo ignoto ;; *) echo saltato ;; esac; })" \
  "$DEPLOY_WHY" >/dev/null 2>&1 || true

# DEPLOY_ENV: extra env prepended to vm-deploy.sh per host. The VM uses vm-deploy's defaults
# (PUBLIC_HOST=80.225.82.207, SERVICE_USER=ubuntu); linux-pc is the LAN PROD twin running as
# 'enzo' on 192.168.1.11 → it must render the web URL + systemd unit owner for THAT host (§12.4).
mac_cfg() { HOST=mac-local;         REPO=/Users/enzo/heuresys-advanced;  NVMUSE=default; DEPLOY_ENV=""; }
vm_cfg()  { HOST=oracle-vm-default; REPO=/home/ubuntu/heuresys-advanced; NVMUSE=22; DEPLOY_ENV=""; }
linuxpc_cfg() { HOST=linux-pc;      REPO=/home/enzo/heuresys-advanced;   NVMUSE=22; DEPLOY_ENV="PUBLIC_HOST=192.168.1.11 SERVICE_USER=enzo API_PORT=8013 WEB_PORT=3013"; }
reachable() { ssh -o BatchMode=yes -o ConnectTimeout=8 "$1" 'exit 0' 2>/dev/null; }

SKIPPED=""
align_one() {
  local kind="$1"; "${kind}_cfg"

  if [ "$RESILIENT" = 1 ] && ! reachable "$HOST"; then
    warn "[$kind] $HOST unreachable — skipped (run 'align-clones.sh $kind' when reachable)"
    SKIPPED="$SKIPPED $kind"; return 0
  fi

  log "[$kind] hard git sync + install ($HOST:$REPO)"
  ssh -o BatchMode=yes "$HOST" "
    set -e
    export NVM_DIR=\"\$HOME/.nvm\"
    set +e; . \"\$NVM_DIR/nvm.sh\"; nvm use $NVMUSE >/dev/null; set -e
    command -v pnpm >/dev/null || { echo 'pnpm missing after nvm' >&2; exit 1; }
    cd '$REPO'
    git fetch origin --quiet
    git reset --hard origin/main
    git clean -fd
    git log --oneline -1
    pnpm install --frozen-lockfile -r
  "

  if [ "$DELTA" = 1 ] && [ "$HAVE_MARKER" = 1 ] && [ "$DATA_CHANGED" = 0 ]; then
    log "[$kind] gitignored data — unchanged this session, skip"
  else
    log "[$kind] secrets + gitignored config (lean)"
    SSH_HOST="$HOST" DEST_DIR="$REPO" EXTRA_EXCLUDE_RE="$LEAN_EXCLUDE" bash "$SCRIPTS/sync-gitignored-to-vm.sh"
  fi

  log "[$kind] .env key-merge"
  bash "$SCRIPTS/env-key-merge.sh" "$HOST" "$REPO"

  if [ "$DELTA" = 1 ] && [ "$HAVE_MARKER" = 1 ]; then
    if [ -n "$MEM_INCLUDE" ] || [ -n "$MEM_DELETE" ]; then
      log "[$kind] Claude memory (delta)"
      MEM_INCLUDE="$MEM_INCLUDE" MEM_DELETE="$MEM_DELETE" bash "$SCRIPTS/sync-memory-tree.sh" "$HOST" "$REPO"
    else
      log "[$kind] Claude memory — no changes this session, skip"
    fi
  else
    log "[$kind] Claude memory (full mirror)"
    bash "$SCRIPTS/sync-memory-tree.sh" "$HOST" "$REPO"
  fi

  if { [ "$kind" = vm ] || [ "$kind" = linuxpc ]; } && [ "$DEPLOY" = 1 ]; then
    log "[$kind] PROD deploy (detached + poll — survives a client-SSH timeout, D-49)"
    REMOTE_REPO="$REPO" DEPLOY_ENV="$DEPLOY_ENV" KIND="$kind" bash "$SCRIPTS/vm-deploy-remote.sh" "$HOST"
  elif [ "$kind" = vm ] || [ "$kind" = linuxpc ]; then
    # Il messaggio riporta la RAGIONE misurata, non un elenco di cause possibili: «no code change /
    # --no-deploy» era vero come disgiunzione e inutile come informazione (S1046).
    log "[$kind] deploy non eseguito — ${DEPLOY_WHY:-ragione non registrata}"
  fi

  log "[$kind] DONE"
}

case "$TARGETS_ARG" in
  mac)     align_one mac ;;   # on-demand only — RETIRED from `all` (S1007, see header note)
  vm)      align_one vm ;;
  linuxpc) align_one linuxpc ;;
  # In `all`, linuxpc is ALWAYS resilient (LAN box, may be off — must not fail
  # the run). RESILIENT=1 as a function-call prefix persists afterwards in bash,
  # which is harmless here (last call of the run). mac excluded from `all` (S1007).
  all)     align_one vm; RESILIENT=1 align_one linuxpc ;;
esac

# IL MARCATORE NON SI CONSUMA PIU' (S1069).
#
# Qui c'era `rm -f "$MARKER"`, per «far ripartire la finestra di delta alla sessione dopo». Il
# costo era che la SECONDA propagazione della stessa sessione trovava il marcatore sparito e
# cadeva in IGNOTO: nel rendiconto delle chiusure sono **12 `clone-db ignoto` e 6 `arma ignoto`**
# — passi non eseguiti non perche' inutili, ma perche' lo stato che li governava era stato
# cancellato dalla corsa precedente. Una sessione che propaga due volte e' normale; uno stato
# che si autodistrugge a meta' non lo e'.
#
# Chi apre la finestra nuova resta `session-boot.ps1`, che lo riscrive a ogni avvio di sessione
# (create-if-absent): e' il posto giusto, perche' e' l'unico che sa quando una sessione comincia.
# Le decisioni che non possono dipendere da un file cancellabile — armamento e clone-db — hanno
# gia' la loro finestra derivata da `origin/prod..HEAD`, che non si consuma e non dipende dal
# ricordarsi di scrivere niente.
#
# Resta un solo uso legittimo del marcatore: il `find -newer` per il delta della memoria, che e'
# una domanda sui FILE («quali sono cambiati da allora») e non sulle decisioni.
: # marcatore lasciato dov'e' — vedi sopra

# #217 I4 — CHI DEPLOYA, ARMA. Fino a oggi l'armamento viveva solo in close-propagate.sh:
# chi lanciava questo script direttamente («pusha e deploya») portava il codice in produzione
# e lasciava `refs/heads/prod` indietro. Il 2026-08-18 la ref era ferma a un commit DI IERI
# mentre la VM girava gia' quello di oggi — e il sorvegliante legge PROPRIO quella ref.
#
# Fuori dal ciclo per host: armare e' un push a origin, si fa UNA volta e non una per macchina.
# La condizione e' la stessa che ha autorizzato il deploy, quindi non c'e' un secondo predicato
# da tenere allineato. Nella chiusura i due casi sono disgiunti per costruzione: quando
# close-propagate arma passa --no-deploy di qua, e quando passa --deploy (--deploy-now) non arma.
# L'atto e' comunque idempotente: se origin/prod e' gia' su HEAD dice «niente da armare».
if [ "$DEPLOY" = 1 ] && [ -f "$SCRIPTS/arma-deploy.sh" ]; then
  log "arma — refs/heads/${DEPLOY_ARM_REF:-prod} sullo sha appena portato in produzione"
  bash "$SCRIPTS/arma-deploy.sh" --why "align-clones ha deployato: $DEPLOY_WHY" || \
    warn "armamento non riuscito — vedi il messaggio di arma-deploy.sh qui sopra"
fi

log "alignment complete (deploy=$DEPLOY delta=$DELTA${SKIPPED:+ skipped:$SKIPPED})"
