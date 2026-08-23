#!/usr/bin/env bash
#
# scripts/vm-deploy.sh — fast PRODUCTION redeploy of heuresys-advanced on the VM.
#
# The VM is the PRODUCTION environment (not a dev box) — the single live DBMS lives
# here and dev machines (Windows/Mac) use it directly or via the SSH tunnel without
# a local copy. So the web app is always served from a pre-built `.next` (next build
# → next start): pages are instant, no on-demand dev compile.
#
# This is the routine-update path: pull → install → next build → restart.
# (vm-bootstrap.sh is the heavier first-time / full setup; it does the same build.)
# Safe to re-run (idempotent). Run on the VM:  bash scripts/vm-deploy.sh
#
# Overridable via env: REPO_DIR BRANCH PUBLIC_HOST API_PORT WEB_PORT NODE_MAJOR RESTART_API
set -euo pipefail

# Il repo e' quello in cui vive QUESTO script, non un percorso cablato.
# ⚠ Qui c'era `/home/ubuntu/heuresys-advanced`: sul linux-pc quel percorso non
# esiste, e lo script moriva con «cannot change to» prima ancora di iniziare.
# Stessa trappola di SERVICE_USER poco sotto — un default che vale su un host
# solo, in uno script che si lascia lanciare su entrambi.
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BRANCH="${BRANCH:-main}"
PUBLIC_HOST="${PUBLIC_HOST:-80.225.82.207}"
API_PORT="${API_PORT:-8013}"
WEB_PORT="${WEB_PORT:-3013}"
NODE_MAJOR="${NODE_MAJOR:-22}"
RESTART_API="${RESTART_API:-1}"   # set 0 to skip restarting the API (web-only deploy)
# systemd unit owner. Default ubuntu (the OCI VM). The linux-pc PROD twin runs as 'enzo' —
# align-clones passes SERVICE_USER=enzo PUBLIC_HOST=192.168.1.11 for that leg so the scheduler
# units (and the inlined web URL) are rendered for the right host (design §12.4).
# L'utente dei servizi si DERIVA dall'host, non si cabla.
#
# ⚠ QUI C'ERA `${SERVICE_USER:-ubuntu}`, e ha rotto il gemello il 2026-08-21.
# `align-clones` passa sempre SERVICE_USER=enzo per la tratta del linux-pc, quindi
# il default non si vedeva mai — finche' qualcuno non ha lanciato vm-deploy A MANO
# su quella macchina. Le 14 unit sono state reinstallate con `User=ubuntu`, che sul
# linux-pc non esiste: api e web sono morti con `status=217/USER`, e il gemello di
# produzione e' rimasto giu' finche' non e' stato riparato a mano.
#
# `id -un` e' giusto per costruzione su ENTRAMBE le macchine: sulla VM il deploy
# gira come `ubuntu`, sul linux-pc come `enzo`. Un default che vale solo su un host
# e' una trappola che aspetta chi lancia lo script sull'altro — e lo script si
# LASCIA lanciare, perche' `align-clones` lo fa di mestiere.
# ⚠ IL CALCOLO STA PIU' SOTTO, dopo il seam `--check-gate`, e non e' un capriccio di
# ordine: `id -gn` NON risolve il GID su Git Bash di Windows («cannot find name for
# group ID»), e sotto `set -e` una sostituzione di comando fallita dentro
# un'assegnazione fa terminare lo script. Stando qui in cima faceva morire ANCHE il
# seam di sola lettura, che di utenti e gruppi non sa che farsene: la batteria offline
# aveva due casi rossi in permanenza sulla macchina di sviluppo — «vm-deploy PENDING» e
# «vm-deploy GREEN» — e un rosso permanente e' un rosso che si impara a non guardare.

log() { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }

# ── #217 I3 — IL DEPLOY NON ASPETTA PIU' LA CI ────────────────────────────────────
# Enzo, 2026-08-18: «la chiusura arma e finisce, non aspetta la produzione».
#
# IL DIFETTO, misurato in S1069 e non dedotto: `deploy-watch.sh` e questo script fanno
# alla STESSA CI la STESSA domanda e si comportano in modo opposto. Il sorvegliante
# scrive «CI ancora in volo — riprovo al prossimo tick» ed esce 0; qui si dormiva fino
# a CI_GATE_WAIT=900s per poi dichiarare `TIMEOUT ... deploy FAILED`. Ma una CI in volo
# non e' un guasto del deploy: e' una domanda fatta troppo presto.
#
# LA CURA: il default diventa NON BLOCCANTE. Chi vuole il deploy sincrono lo chiede —
# `close-propagate.sh --deploy-now` esporta CI_GATE_NONBLOCKING=0 e riottiene il
# polling di prima. Si riusa la manopola che ESISTE gia' (#165) invece di aggiungerne
# una seconda accanto: due manopole per lo stesso comportamento divergono, ed e' il
# difetto che I1 ha appena curato sui path di deploy.
#
# PERCHE' USCIRE 0 NON E' UN FINTO VERDE: il cancello gira PRIMA di ogni mutazione
# (deps, snapshot, migrate, build) — invariante che `run-shell-tests.sh` sezione H
# verifica da se'. Quindi «non ho deployato» significa che sulla macchina non e'
# cambiato niente. E il rosso resta rosso: si traduce SOLO il 75, mai l'1.
#
# Il seam `--check-gate <sha>` esiste perche' altrimenti questa traduzione sarebbe
# provabile solo con un deploy vero: la batteria offline lo esercita con
# CI_GATE_FIXTURE al posto della rete. Stessa convenzione di `ci-gate.sh --classify`
# e `vm-deploy-remote.sh --print-gate-env`.
#
# Ritorna:  0 = procedi col deploy · 10 = rimanda (niente e' stato toccato) · altro = guasto
gate_ci() {
  local sha="$1" rc=0
  : "${CI_GATE_NONBLOCKING:=1}"
  export CI_GATE_NONBLOCKING
  bash "$REPO_DIR/scripts/ci-gate.sh" "$sha" || rc=$?
  case "$rc" in
    0)  return 0 ;;
    75) echo "[vm-deploy] CI ancora in volo su ${sha:0:8} — NON deployo, e non ho toccato niente."
        echo "[vm-deploy] Lo sha e' armato: heuresys-advanced-deploy-watch.timer lo porta in"
        echo "[vm-deploy] produzione al primo tick con la CI verde. Per aspettare qui, invece:"
        echo "[vm-deploy] CI_GATE_NONBLOCKING=0 bash scripts/vm-deploy.sh"
        return 10 ;;
    *)  return "$rc" ;;
  esac
}

# Seam di prova: esegue SOLO la decisione del cancello e ne restituisce l'esito tradotto.
# Sta qui in cima, prima di nvm e prima di qualunque git, perche' la batteria gira su
# Windows dove nvm non c'e' e il repo non e' quello di produzione.
if [ "${1:-}" = "--check-gate" ]; then
  gate_ci "${2:?usage: vm-deploy.sh --check-gate <sha>}"
  exit $?
fi

# Da qui in giu' si deploya davvero, e serve sapere COME si chiamano l'utente e il gruppo
# dei servizi. Il perche' della derivazione da `id` — e il guasto del 2026-08-21 che l'ha
# imposta — sta nel commento lungo in cima al file.
SERVICE_USER="${SERVICE_USER:-$(id -un)}"
SERVICE_GROUP="${SERVICE_GROUP:-$(id -gn)}"

# Guardia esplicita: se l'utente scelto non esiste su questa macchina, le unit
# verrebbero installate rotte e il guasto si scoprirebbe al restart — cioe' a
# servizi gia' fermi. Meglio non partire.
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  echo "ERROR: SERVICE_USER='$SERVICE_USER' non esiste su $(hostname). Le unit systemd" >&2
  echo "       verrebbero installate con un utente inesistente (status=217/USER)." >&2
  exit 1
fi

# Node via nvm (the services run on this Node; argon2 native ABI must match).
# nvm.sh is NOT safe under set -e/-u/pipefail (it runs commands that return
# non-zero by design, e.g. nvm_ls_current) — relax strict mode around it.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
set +euo pipefail
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm use "$NODE_MAJOR" >/dev/null
NODE_BIN="$(dirname "$(nvm which "$NODE_MAJOR")")"
set -euo pipefail
[ -x "$NODE_BIN/node" ] || { echo "nvm Node $NODE_MAJOR not resolved" >&2; exit 1; }
export PATH="$NODE_BIN:$PATH"
echo "node=$(node -v) pnpm=$(pnpm -v)"

# 1. Sync the repo to the authoritative remote (prod box: no local edits expected;
#    gitignored .env/.secrets are preserved by reset).
log "sync: $BRANCH @ origin"
git -C "$REPO_DIR" fetch origin --quiet
# D-08 (F-8): capture the CURRENTLY-DEPLOYED sha BEFORE the reset — it is the app
# rollback target if the new deploy fails its probe gate (scripts/vm-rollback.sh).
# Survives the self-modify re-exec below via VM_DEPLOY_PREV_SHA.
if [ -z "${VM_DEPLOY_REEXEC:-}" ]; then
  PREV_SHA="$(git -C "$REPO_DIR" rev-parse HEAD)"
else
  PREV_SHA="${VM_DEPLOY_PREV_SHA:-unknown}"
fi
git -C "$REPO_DIR" checkout "$BRANCH" --quiet
git -C "$REPO_DIR" reset --hard "origin/$BRANCH" --quiet
git -C "$REPO_DIR" log --oneline -1

# Self-modify-buffer fix: bash already buffered the OLD vm-deploy.sh into memory before
# the reset above pulled a NEW one. If this commit changed vm-deploy.sh, re-exec the
# freshly-pulled version ONCE (guarded) so the rest of the pipeline runs the update —
# otherwise steps added in the same commit silently don't take effect until the 2nd run.
if [ -z "${VM_DEPLOY_REEXEC:-}" ]; then
  exec env VM_DEPLOY_REEXEC=1 VM_DEPLOY_PREV_SHA="$PREV_SHA" \
    REPO_DIR="$REPO_DIR" BRANCH="$BRANCH" PUBLIC_HOST="$PUBLIC_HOST" \
    API_PORT="$API_PORT" WEB_PORT="$WEB_PORT" NODE_MAJOR="$NODE_MAJOR" RESTART_API="$RESTART_API" \
    SERVICE_USER="$SERVICE_USER" SERVICE_GROUP="$SERVICE_GROUP" \
    bash "$REPO_DIR/scripts/vm-deploy.sh"
fi

# 1c. D-08 F2 — deploy gate: the sha about to go live must be CI-green
#     (scripts/ci-gate.sh: red run on the sha → abort; CI in flight → wait;
#     docs-only sha with no runs → latest key workflows on main must be green).
#     Runs BEFORE any mutation (deps/snapshot/migrate/build) so a red sha
#     changes nothing on the box. DEPLOY_REQUIRE_CI=0 bypasses (emergency only
#     — the gate logs the bypass loudly). ADR-0028.
log "gate: CI must be green for the deployed sha (D-08 F2)"
GATE_RC=0
gate_ci "$(git -C "$REPO_DIR" rev-parse HEAD)" || GATE_RC=$?
[ "$GATE_RC" = 10 ] && exit 0
[ "$GATE_RC" = 0 ] || exit "$GATE_RC"

# 2. Deps (reproducible, exact lockfile match). Clean-reinstall if the Node ABI changed
#    (native modules argon2/@next/swc/sharp must match NODE_MODULE_VERSION) — a frozen
#    install over a stale node_modules built for another ABI can crash at runtime.
cd "$REPO_DIR"
ABI_SENTINEL="$REPO_DIR/node_modules/.heuresys-node-abi"
CUR_ABI="$(node -p 'process.versions.modules' 2>/dev/null || echo unknown)"
PREV_ABI="$(cat "$ABI_SENTINEL" 2>/dev/null || echo none)"
if [ -d "$REPO_DIR/node_modules" ] && [ "$CUR_ABI" != "$PREV_ABI" ]; then
  log "deps: Node ABI changed ($PREV_ABI -> $CUR_ABI) — clean reinstall of native modules"
  rm -rf "$REPO_DIR/node_modules" "$REPO_DIR"/apps/*/node_modules "$REPO_DIR"/packages/*/node_modules
fi
log "deps: pnpm install --frozen-lockfile"
if ! pnpm install --frozen-lockfile; then
  echo "ERROR: 'pnpm install --frozen-lockfile' failed — pnpm-lock.yaml is out of sync with package.json." >&2
  echo "       Regenerate + commit the lockfile on the PC (run 'pnpm install', commit pnpm-lock.yaml, push), then redeploy." >&2
  exit 1
fi
mkdir -p "$REPO_DIR/node_modules" && printf '%s' "$CUR_ABI" > "$ABI_SENTINEL"

# 2a. Pre-deploy DB safety snapshot (D-08 rollback net). Take a pg_dump -Fc BEFORE the
#     migration step (2b) — the first thing that mutates the live DB — so a bad deploy is
#     restorable (pg_restore). Kept in a dedicated pre-deploy/ dir (distinct from the
#     scheduled R5 daily backups). Fail-loud on an empty/short dump (a silent 0-byte safety
#     net is worse than none → abort the deploy). Skip with PREDEPLOY_BACKUP=skip (fast
#     iteration only). Overridable: PREDEPLOY_DIR, PREDEPLOY_RETAIN (keep newest N).
if [ "${PREDEPLOY_BACKUP:-run}" != "skip" ]; then
  log "db: pre-deploy snapshot (pg_dump -Fc, rollback net)"
  PD_DB="${DB_NAME:-${POSTGRES_DB:-heuresys_advanced}}"
  PD_DIR="${PREDEPLOY_DIR:-$REPO_DIR/pg_dump_snapshots/pre-deploy}"
  PD_RETAIN="${PREDEPLOY_RETAIN:-10}"
  mkdir -p "$PD_DIR"
  pd_out="$PD_DIR/${PD_DB}_predeploy_$(date -u +%Y%m%dT%H%M%SZ).dump"
  sudo -u postgres pg_dump -Fc "$PD_DB" > "$pd_out"
  if [ ! -s "$pd_out" ] || [ "$(stat -c %s "$pd_out")" -lt 1024 ]; then
    echo "ERROR: pre-deploy dump is empty/too small ($pd_out) — aborting deploy" >&2
    rm -f "$pd_out"; exit 1
  fi
  echo "  pre-deploy snapshot: $pd_out ($(du -h "$pd_out" | cut -f1))"
  # Retention: keep only the newest N pre-deploy dumps (deploy net, not a long-term archive).
  ls -1t "$PD_DIR/${PD_DB}_predeploy_"*.dump 2>/dev/null | tail -n +"$((PD_RETAIN + 1))" | xargs -r rm -f
  echo "  pre-deploy retention: kept newest $PD_RETAIN"
else
  log "db: pre-deploy snapshot SKIPPED (PREDEPLOY_BACKUP=skip)"
fi

# 2b. Apply DB migrations ONLY if a migration is pending (sha256 vs the sys.sys_schema_migrations
#     ledger). The DBMS is shared (PC tunnel :5433 == this VM's :5432), so it is normally already
#     migrated during dev → fast no-op; runs only for a genuinely unapplied migration.
#     Override: DB_MIGRATE=force|skip|auto (default auto).
log "db: migrate-if-pending"
bash "$REPO_DIR/db/scripts/migrate-if-pending.sh"

# 3. Production builds: shared (clean) → API (tsup bundle → node dist/server.js) → web (next build).
#    @heuresys/shared MUST be built BEFORE api/web because both typecheck against its
#    dist/*.d.ts. `pnpm install` alone does NOT reliably rebuild it: the incremental
#    tsc tsbuildinfo can skip re-emitting .d.ts files that were removed from disk (e.g.
#    a dist file untracked from git), leaving the web typecheck unable to resolve shared
#    types ("has no exported member ..."). Force a CLEAN shared build to avoid that.
log "build: clean @heuresys/shared (rm dist + tsbuildinfo, then tsc)"
rm -rf "$REPO_DIR/packages/shared/dist" "$REPO_DIR/packages/shared/tsconfig.tsbuildinfo"
pnpm --filter @heuresys/shared build

# Web NEXT_PUBLIC_* are inlined at BUILD time and MUST match the systemd unit's
# values — derived here from PUBLIC_HOST/API_PORT.
log "build: production api (tsup) + web (next build)"
pnpm --filter @heuresys/api build
NODE_ENV=production \
NEXT_PUBLIC_API_PROXY_BASE_URL="http://localhost:$API_PORT" \
NEXT_PUBLIC_API_BASE_URL="http://$PUBLIC_HOST:$API_PORT/v1" \
pnpm --filter @heuresys/web build

# 3c. Render + install ALL systemd units (api/web + EVERY scheduler) from deploy/systemd/.
#     vm-deploy is the SINGLE deploy entrypoint for BOTH the VM (User=ubuntu) and the linux-pc
#     twin (SERVICE_USER=enzo): the sed rewrites User=/Group= + all @@placeholders@@ on EVERY
#     unit — not just the schedulers — so api/web are correct on the twin too (design §12.4;
#     removes the divergence with provision-linux-pc.sh). The 5 placeholders are exactly the
#     ones the sed covers (verified); a unit that still carries an unrendered @@…@@ aborts the
#     deploy (fail-loud > installing a broken unit). Idempotent: re-render + install + enable.
log "systemd: render + install ALL units (api/web + schedulers) — User=$SERVICE_USER (§12.4)"
swtmp="$(mktemp -d)"
render_unit() {  # $1 = absolute path to a template unit file
  local base; base="$(basename "$1")"
  sed -e "s#@@REPO_DIR@@#$REPO_DIR#g" -e "s#@@NODE_BIN@@#$NODE_BIN#g" \
      -e "s#@@PUBLIC_HOST@@#$PUBLIC_HOST#g" -e "s#@@API_PORT@@#$API_PORT#g" -e "s#@@WEB_PORT@@#$WEB_PORT#g" \
      -e "s#^User=ubuntu#User=$SERVICE_USER#g" -e "s#^Group=ubuntu#Group=$SERVICE_GROUP#g" \
      "$1" > "$swtmp/$base"
  # Only REAL placeholders (@@NAME@@, uppercase token) — NOT the literal "@@...@@" that the
  # template header comment carries ("placeholders (@@...@@) are rendered by …").
  if grep -qE '@@[A-Z_]+@@' "$swtmp/$base"; then
    echo "ERROR: unrendered placeholder in $base — vm-deploy sed does not cover it:" >&2
    grep -nE '@@[A-Z_]+@@' "$swtmp/$base" >&2; rm -rf "$swtmp"; exit 1
  fi
  sudo install -m 644 -o root -g root "$swtmp/$base" "/etc/systemd/system/$base"
}
for unit in "$REPO_DIR"/deploy/systemd/*.service "$REPO_DIR"/deploy/systemd/*.timer; do
  render_unit "$unit"
done
rm -rf "$swtmp"
sudo systemctl daemon-reload
# api/web are long-running services (restarted in step 4 below); ensure they're enabled at boot.
sudo systemctl enable heuresys-advanced-api.service heuresys-advanced-web.service >/dev/null 2>&1 || true
# every scheduler timer: enable + start now (idempotent — re-run safe).
for t in "$REPO_DIR"/deploy/systemd/*.timer; do
  sudo systemctl enable --now "$(basename "$t")" >/dev/null
done

# 4. Restart services (api first so the web's proxy target is up).
log "restart"
if [ "$RESTART_API" = 1 ]; then
  sudo systemctl restart heuresys-advanced-api.service
  sleep 4
fi
sudo systemctl restart heuresys-advanced-web.service
sleep 5

# 5. Verify.
log "verify"
systemctl is-active heuresys-advanced-api heuresys-advanced-web || true
echo "  scraping.timer: $(systemctl is-active heuresys-advanced-scraping.timer 2>/dev/null || echo inactive)"
echo "  insights.timer: $(systemctl is-active heuresys-advanced-insights.timer 2>/dev/null || echo inactive)"
echo "  backup.timer:   $(systemctl is-active heuresys-advanced-backup.timer 2>/dev/null || echo inactive)"
echo "  reindex.timer:  $(systemctl is-active heuresys-advanced-reindex.timer 2>/dev/null || echo inactive)"
# D-48: the API needs ~40s to boot (RBAC cache + DB connect through OCI jitter), so a
# bare curl right after the systemd restart hits ECONNREFUSED (false negative). Retry
# with backoff over the boot window: --retry-connrefused covers "not listening yet",
# --retry-all-errors covers the brief 503 while the readiness cache loads.
DEPLOY_OK=1
if curl -fsS --retry 45 --retry-delay 1 --retry-connrefused --retry-all-errors -m 8 "http://localhost:$API_PORT/readyz" >/dev/null; then
  echo "  api /readyz OK"
else
  echo "  api /readyz FAILED — journalctl -u heuresys-advanced-api -n 50" >&2
  DEPLOY_OK=0
fi
code=$(curl -s -o /dev/null -m 25 -w '%{http_code}' "http://localhost:$WEB_PORT/login" || echo ERR)
t=$(curl -s -o /dev/null -m 25 -w '%{time_total}' "http://localhost:$WEB_PORT/login" || echo ERR)
echo "  web /login HTTP $code in ${t}s (prod = sub-second)"
if [ "$code" != "200" ]; then
  echo "  web /login FAILED (expected 200) — journalctl -u heuresys-advanced-web -n 50" >&2
  DEPLOY_OK=0
fi

# D-08 (F-9/12): the probe is a GATE, not an observer. On failure the deploy exits
# non-zero (align-clones sees red) and prints the one-command rollback; on success
# the deployed sha becomes the durable LAST_GOOD rollback target. AUTO_ROLLBACK=1
# triggers scripts/vm-rollback.sh automatically (default: manual — vm-deploy is always
# operator-driven; preserving no-auto-deploy is D-08's most important control).
if [ "$DEPLOY_OK" != 1 ]; then
  last_dump="$(ls -1t "$REPO_DIR"/pg_dump_snapshots/pre-deploy/*.dump 2>/dev/null | head -1 || true)"
  {
    echo ""
    echo "DEPLOY FAILED at probe gate (sha $(git -C "$REPO_DIR" rev-parse --short HEAD))."
    echo "  app rollback:  bash scripts/vm-rollback.sh ${PREV_SHA}"
    echo "  db snapshot (pg_restore is DESTRUCTIVE — only if a migration broke data):"
    echo "    ${last_dump:-<none taken this run>}"
  } >&2
  if [ "${AUTO_ROLLBACK:-0}" = 1 ] && [ "$PREV_SHA" != "unknown" ]; then
    echo "AUTO_ROLLBACK=1 → rolling back to $PREV_SHA" >&2
    exec bash "$REPO_DIR/scripts/vm-rollback.sh" "$PREV_SHA"
  fi
  exit 1
fi
mkdir -p "$REPO_DIR/pg_dump_snapshots"
printf '%s\n' "$(git -C "$REPO_DIR" rev-parse HEAD)" > "$REPO_DIR/pg_dump_snapshots/LAST_GOOD_SHA"
echo "  LAST_GOOD recorded: $(git -C "$REPO_DIR" rev-parse --short HEAD)"
echo
echo "Done. Web http://$PUBLIC_HOST:$WEB_PORT  |  API http://$PUBLIC_HOST:$API_PORT"
