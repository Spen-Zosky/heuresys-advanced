#!/usr/bin/env bash
#
# scripts/vm-deploy-remote.sh — D-49: run vm-deploy.sh on a remote host DECOUPLED
# from the client SSH connection.
#
# THE BUG IT FIXES: align-clones used to deploy with a single long-held
# `ssh host "bash vm-deploy.sh"`. A `next build` takes minutes; if the CLIENT
# side times out (e.g. a 10-min cap on the caller) or the link drops, the SSH
# channel close SIGTERMs the deploy MID-BUILD → `.next` left without
# prerender-manifest.json (web crashes at `next start`) AND the final restart
# never runs (API stays on the old dist). That is incident S1011 → D-49.
#
# THE FIX: open only SHORT-LIVED ssh calls.
#   1. one call launches vm-deploy.sh detached (setsid + nohup), redirecting its
#      output to a remote log and its exit code to a remote sentinel file, then
#      returns immediately — the deploy now runs in its own session, immune to
#      this client's connection lifetime.
#   2. a poll loop of brief `cat <sentinel>` calls waits for completion, printing
#      a one-line progress tail each tick. The deploy keeps running on the host
#      regardless of whether this watcher is alive.
# Returns the deploy's REAL exit code. If the poll budget (POLL_MAX) is exhausted
# the watcher DETACHES (exit 0) while the remote deploy keeps going — it is never
# the watcher that kills the deploy (the whole point of D-49).
#
# Usage:  bash scripts/vm-deploy-remote.sh <ssh-host>
# Env:
#   REMOTE_REPO    repo dir ON THE HOST — REQUIRED, no default. This script runs from
#                  the client toward an arbitrary host, so it must NOT bake in one host's
#                  layout (VM=/home/ubuntu/…, linux-pc=/home/enzo/…); align-clones passes
#                  the right value per target (idempotency across machines/OS/paths).
#   DEPLOY_ENV     extra `env` assignments prepended to the deploy command (per-host)
#   DEPLOY_CMD     remote command to run detached  (default 'bash scripts/vm-deploy.sh';
#                  overridable so the shell-test / a dry self-test can exercise the
#                  detach+poll mechanism with an innocuous payload, never touching PROD)
#   KIND           label for logs + per-host /tmp paths (default 'vm')
#   POLL_INTERVAL  seconds between status polls     (default 15)
#   POLL_MAX       max seconds to watch before detaching (default 2400 = 40 min)
#
#   CI_GATE_WAIT / CI_GATE_POLL / CI_GATE_KEY_WORKFLOWS / DEPLOY_REQUIRE_CI /
#   CI_GATE_NONBLOCKING
#                  read by ci-gate.sh ON THE REMOTE HOST, forwarded from this client.
#                  See D-79 below. CI_GATE_NONBLOCKING joined the list in #217 I3: it
#                  was the ONE gate knob left out, so `CI_GATE_NONBLOCKING=0 ... --deploy`
#                  (ask for the synchronous deploy) never reached the remote gate — the
#                  exact shape of D-79, one variable later.
#
# D-79: the deploy runs REMOTELY, so an env var set on the client never reaches
# ci-gate.sh — `CI_GATE_WAIT=2100 align-clones … --deploy` silently kept the gate's
# own 900s default and aborted two consecutive deploys on a CI that was still
# legitimately running. The gate was right to refuse; the knob to give it more time
# simply did nothing, and whoever used it believed otherwise. These vars are
# per-INVOCATION, so they do NOT belong in DEPLOY_ENV (per-HOST config: ports, user)
# — they are forwarded here instead.
#
# Dependency-free (bash + ssh + coreutils on both ends). set -u, no -e: a failed
# poll ssh must not abort the watcher (transient drops are expected and retried).
set -uo pipefail

# When run from Windows Git Bash, MSYS rewrites POSIX paths passed as ssh
# ARGUMENTS (the poll `cat '/tmp/…'` / `tail '/tmp/…'` calls) into C:\… and the
# remote command breaks. Disable it (no-op on Linux, where align-clones' VM leg
# also runs). See memory reference_remote_ssh_deploy_ops.
export MSYS_NO_PATHCONV=1

# Forward the CI-gate knobs to the remote deploy (D-79). Only the ones the caller
# actually set: `${!v+set}` distinguishes "unset" from "set to empty", and emitting
# `CI_GATE_WAIT=` would override the remote default WITH THE EMPTY STRING — worse
# than the bug being fixed. Values are wrapped in double quotes because
# CI_GATE_KEY_WORKFLOWS is a space-separated list; a value carrying a quote,
# backslash, `$` or backtick would break out of the remote `bash -c '…'` payload,
# so it is refused LOUDLY rather than forwarded mangled.
gate_env() {
  local out="" v val
  for v in CI_GATE_WAIT CI_GATE_POLL CI_GATE_KEY_WORKFLOWS DEPLOY_REQUIRE_CI CI_GATE_NONBLOCKING; do
    [ -n "${!v+set}" ] || continue
    val="${!v}"
    [ -n "$val" ] || continue
    case "$val" in
      *[\'\"\\\$\`]*) echo "[vm-deploy-remote] WARNING: $v not forwarded (unsafe characters)" >&2; continue ;;
    esac
    out="$out $v=\"$val\""
  done
  printf '%s' "$out"
}

# Self-test hook for the shell-test gate: prints what WOULD be forwarded, then exits.
# Keeps the D-79 fixture honest without needing a reachable host.
if [ "${1:-}" = "--print-gate-env" ]; then gate_env; echo; exit 0; fi

HOST="${1:?usage: vm-deploy-remote.sh <ssh-host>}"
# REQUIRED, no default: a per-host absolute path baked in here would be wrong on
# every other target. align-clones always passes it (REMOTE_REPO="$REPO").
REMOTE_REPO="${REMOTE_REPO:?REMOTE_REPO required — the repo dir on $HOST (align-clones passes it per target)}"
DEPLOY_ENV="${DEPLOY_ENV:-}"
DEPLOY_CMD="${DEPLOY_CMD:-bash scripts/vm-deploy.sh}"
KIND="${KIND:-vm}"
POLL_INTERVAL="${POLL_INTERVAL:-15}"
POLL_MAX="${POLL_MAX:-2400}"

SSH=(ssh -o BatchMode=yes -o ConnectTimeout=10)
LOG="/tmp/heuresys-deploy-${KIND}.log"
ST="/tmp/heuresys-deploy-${KIND}.status"

log() { printf '\n\033[1m=== [%s] %s ===\033[0m\n' "$KIND" "$*"; }

# 1. Launch detached. The remote script is piped on stdin to `bash -s` so the
#    deploy command is single-level quoted (no 3-level ssh→sh→bash -c nesting).
#    The heredoc is UNQUOTED: $LOG/$ST/$REMOTE_REPO/$DEPLOY_ENV/$DEPLOY_CMD expand
#    locally; \$? and \$! are escaped so they evaluate ON THE HOST.
launch() {
  "${SSH[@]}" "$HOST" 'bash -s' <<EOF
set -u
rm -f "$LOG" "$ST"
cd "$REMOTE_REPO" 2>/dev/null || { echo 127 > "$ST"; echo "cd-failed: $REMOTE_REPO"; exit 0; }
setsid nohup bash -c 'env REPO_DIR="$REMOTE_REPO"$(gate_env) $DEPLOY_ENV $DEPLOY_CMD > "$LOG" 2>&1; echo \$? > "$ST"' </dev/null >/dev/null 2>&1 &
echo "launched pid \$!"
EOF
}

log "launch detached deploy on $HOST (repo=$REMOTE_REPO, cmd='$DEPLOY_CMD')"
launched="$(launch)" || { echo "FATAL: could not start remote deploy on $HOST" >&2; exit 1; }
log "$launched — watching (poll ${POLL_INTERVAL}s, budget ${POLL_MAX}s); the deploy is now independent of this connection"

# 2. Poll the sentinel with short calls. rc stays empty until the deploy writes it.
waited=0
rc=""
while :; do
  rc="$("${SSH[@]}" "$HOST" "cat '$ST' 2>/dev/null" || true)"
  [ -n "$rc" ] && break
  if [ "$waited" -ge "$POLL_MAX" ]; then
    log "still running after ${POLL_MAX}s — DETACHING watcher; the remote deploy CONTINUES."
    echo "    follow it: ssh $HOST tail -f $LOG" >&2
    exit 0
  fi
  sleep "$POLL_INTERVAL"
  waited=$((waited + POLL_INTERVAL))
  last="$("${SSH[@]}" "$HOST" "tail -n1 '$LOG' 2>/dev/null" || true)"
  printf '    [%s] %ds — %s\n' "$KIND" "$waited" "${last:-…}"
done

# 3. Surface the tail + the deploy's real exit code.
"${SSH[@]}" "$HOST" "tail -n 20 '$LOG' 2>/dev/null" || true
rc="${rc//[^0-9]/}"
rc="${rc:-1}"
if [ "$rc" = 0 ]; then
  log "deploy OK (exit 0) on $HOST"
else
  log "deploy FAILED (exit $rc) on $HOST — full log: ssh $HOST cat $LOG"
fi
exit "$rc"
