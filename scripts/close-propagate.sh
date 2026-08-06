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
# Usage (from the Windows PC, Git Bash):
#   bash scripts/close-propagate.sh [--full|--delta] [--deploy|--auto-deploy|--no-deploy]
#                                   [--clone-db|--no-clone-db]
#   defaults: --delta --auto-deploy   clone-db=auto (refresh iff db/migrations|db/seeds changed)
set -euo pipefail
# NOTE: do NOT globally export MSYS_NO_PATHCONV=1 — align-claude-ecosystem.sh manages
# it per-ssh-call (rssh) and its local jq calls on staging-dir POSIX paths need MSYS
# path conversion active. Close-propagate only needs it for its own direct SSH calls.

ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
SCRIPTS="$ROOT/scripts"
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
      if [ -n "$(git diff --name-only "$start_head"..HEAD 2>/dev/null | grep -E '^db/(migrations|seeds)/' || true)" ]; then
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

# --dry-run / CLOSE_PROPAGATE_DRYRUN: print the resolved plan and exit BEFORE touching any channel
# (used by scripts/test/run-shell-tests.sh — flag parsing + clone-db conditional decision, §12.5).
if [ -n "$DRYRUN" ]; then
  mode_label="$([ -n "$MODE" ] && echo delta || echo full)"
  echo "PLAN mode=$mode_label deploy=$DEPLOY clone-db=$CLONE_DB need_clone=$need_clone"
  echo "PLAN clone-db-why: $clone_why"
  exit 0
fi

# --- channel 1: repo + payload + memories + deploy -----------------------------------------
log "channel 1/2 — align-clones (repo + payload + memories + PROD deploy)"
if ! bash "$SCRIPTS/align-clones.sh" all $MODE --resilient $DEPLOY; then
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
[ -f "$SCRIPTS/close-log.sh" ] && bash "$SCRIPTS/close-log.sh" step clone-db "$clone_outcome" "$clone_why" >/dev/null 2>&1 || true
[ -f "$SCRIPTS/close-log.sh" ] && bash "$SCRIPTS/close-log.sh" step propaga \
  "$([ -n "$FAILED" ] && echo fallito || echo eseguito)" \
  "canali: align-clones + align-claude-ecosystem (mode=${MODE:-full}, deploy=$DEPLOY)${FAILED:+ — falliti:$FAILED}" >/dev/null 2>&1 || true

# --- fail-loud on any reachable-host channel failure ---------------------------------------
if [ -n "$FAILED" ]; then
  die "close-propagate: channel(s) failed on a reachable host:$FAILED — investigate (close NOT clean)"
fi
log "close-propagate complete (mode=${MODE:-full} deploy=$DEPLOY clone-db=$CLONE_DB)"
