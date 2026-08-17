#!/usr/bin/env bash
# ============================================================================
# scripts/ci-gate.sh — D-08 F2: deploy gate "CI must be green".
#
# Blocks a PROD deploy unless the sha about to go live is CI-green. Called by
# vm-deploy.sh right after the git reset (before any mutation); usable
# standalone. Talks to the public GitHub API with curl (no gh dependency on
# the VM; the repo is public so no token is needed — ~2 calls per deploy).
#
# Semantics for <sha>:
#   - any completed run with conclusion failure/timed_out/startup_failure → RED
#   - runs still queued/in_progress → wait (poll CI_GATE_POLL, max CI_GATE_WAIT)
#   - ≥1 success and 0 failures → GREEN
#   - no signal at all (docs-only push: paths-ignore produces no runs; or only
#     cancelled runs) → fallback: the LATEST completed run of each key
#     workflow on main must be success — the deployed code content equals the
#     last code-bearing sha, and a standing red anywhere blocks (R3).
#
# CI_GATE_NONBLOCKING=1 (#165): PENDING returns immediately with exit 75
# (EX_TEMPFAIL) instead of sleeping to WAIT_SECS. It exists for scripts/deploy-watch.sh,
# which is invoked by a systemd timer every few minutes: a watcher must NEVER sleep
# holding a one-shot unit open, and "CI still running" is not a failure — it is
# "ask again later". 75 is deliberately distinct from BOTH 0 and 1: collapsing it
# onto 0 would deploy an unverified sha (the one hole that must not exist), and
# collapsing it onto 1 would light up `systemctl --failed` every few minutes while
# CI is merely doing its job.
#
# Bypass: DEPLOY_REQUIRE_CI=0 (emergency/bootstrap only — logged loudly).
# Fail-CLOSED on API errors (a gate that fails open is not a gate).
#
# Test hook: `ci-gate.sh --classify` reads a runs-JSON on stdin and prints the
# classification (RED:names / PENDING:n / GREEN:n / NOSIGNAL) — exercised by
# scripts/test/run-shell-tests.sh with fixtures, no network.
# ============================================================================
set -euo pipefail

REPO_SLUG="${REPO_SLUG:-Spen-Zosky/heuresys-advanced}"
API="https://api.github.com/repos/$REPO_SLUG"
WAIT_SECS="${CI_GATE_WAIT:-900}"
POLL_SECS="${CI_GATE_POLL:-30}"
KEY_WORKFLOWS="${CI_GATE_KEY_WORKFLOWS:-test-integration.yml playwright-smoke.yml build-web.yml typecheck.yml lint.yml}"

classify() {  # stdin: GitHub actions/runs JSON → one classification line
  python3 -c '
import json, sys
d = json.load(sys.stdin)
runs = d.get("workflow_runs", [])
pending = [r for r in runs if r.get("status") in ("queued", "in_progress", "waiting", "pending", "requested")]
fails = sorted({r.get("name", "?") for r in runs if r.get("status") == "completed"
                and r.get("conclusion") in ("failure", "timed_out", "startup_failure")})
succ = [r for r in runs if r.get("status") == "completed" and r.get("conclusion") == "success"]
if fails: print("RED:" + ",".join(fails))
elif pending: print("PENDING:%d" % len(pending))
elif succ: print("GREEN:%d" % len(succ))
else: print("NOSIGNAL")
'
}

if [ "${1:-}" = "--classify" ]; then classify; exit 0; fi

SHA="${1:?usage: ci-gate.sh <sha> | --classify}"

if [ "${DEPLOY_REQUIRE_CI:-1}" = "0" ]; then
  echo "[ci-gate] BYPASSED (DEPLOY_REQUIRE_CI=0) — deploying $SHA without CI verification" >&2
  exit 0
fi

# CI_GATE_FIXTURE (test seam, #165): serve a canned runs-JSON instead of calling
# GitHub, so the RED/PENDING/GREEN *decisions* — not just classify() in isolation —
# are exercised offline by scripts/test/run-shell-tests.sh. Without it the exit-75
# branch added below could only be asserted by reading the code, which is not a test.
#
# La fixture puo' essere un FILE (un solo esito, per tutti gli sha) o una DIRECTORY con
# `<sha>.json` piu' un `default.json` di ripiego. La forma a directory serve al gemello di
# #212: «lo sha armato e' verde ma un commit DENTRO la finestra e' rosso» non e' esprimibile
# se ogni sha riceve la stessa risposta — il test misurerebbe se' stesso.
fetch() {
  if [ -n "${CI_GATE_FIXTURE:-}" ]; then
    if [ -d "$CI_GATE_FIXTURE" ]; then
      f="$CI_GATE_FIXTURE/$SHA.json"
      [ -f "$f" ] || f="$CI_GATE_FIXTURE/default.json"
      cat "$f"; return
    fi
    cat "$CI_GATE_FIXTURE"; return
  fi
  curl -fsS -m 15 -H 'Accept: application/vnd.github+json' "$1"
}

deadline=$(( $(date +%s) + WAIT_SECS ))
while :; do
  if ! RUNS_JSON="$(fetch "$API/actions/runs?head_sha=$SHA&per_page=100")"; then
    echo "[ci-gate] FATAL: GitHub API unreachable or rate-limited — gate fails CLOSED." >&2
    echo "[ci-gate] Emergency bypass: DEPLOY_REQUIRE_CI=0 (only if you know the sha is green)." >&2
    exit 1
  fi
  STATE="$(printf '%s' "$RUNS_JSON" | classify)"
  case "$STATE" in
    GREEN:*)   echo "[ci-gate] OK — $SHA is CI-green (${STATE#GREEN:} successful runs)"; exit 0 ;;
    RED:*)     echo "[ci-gate] RED — failing workflows on $SHA: ${STATE#RED:}" >&2
               echo "[ci-gate] Fix CI first (R3). Emergency bypass: DEPLOY_REQUIRE_CI=0." >&2
               exit 1 ;;
    PENDING:*) if [ "${CI_GATE_NONBLOCKING:-0}" = "1" ]; then
                 echo "[ci-gate] PENDING — ${STATE#PENDING:} run(s) in flight for $SHA; non-blocking → exit 75 (retry later)"
                 exit 75
               fi
               if [ "$(date +%s)" -ge "$deadline" ]; then
                 echo "[ci-gate] TIMEOUT — CI still running for $SHA after ${WAIT_SECS}s (raise CI_GATE_WAIT or wait)" >&2
                 exit 1
               fi
               echo "[ci-gate] CI in progress for $SHA (${STATE#PENDING:} runs) — waiting ${POLL_SECS}s…"
               sleep "$POLL_SECS" ;;
    NOSIGNAL)  break ;;
    *)         echo "[ci-gate] FATAL: unexpected classification '$STATE'" >&2; exit 1 ;;
  esac
done

echo "[ci-gate] no runs for $SHA (docs-only push?) — checking latest main runs of key workflows"
for wf in $KEY_WORKFLOWS; do
  if ! J="$(fetch "$API/actions/workflows/$wf/runs?branch=main&status=completed&per_page=1")"; then
    echo "[ci-gate] FATAL: cannot fetch latest $wf run — gate fails CLOSED (bypass: DEPLOY_REQUIRE_CI=0)" >&2
    exit 1
  fi
  C="$(printf '%s' "$J" | python3 -c 'import json,sys;r=json.load(sys.stdin).get("workflow_runs",[]);print(r[0].get("conclusion","none") if r else "none")')"
  if [ "$C" != "success" ]; then
    echo "[ci-gate] RED — latest $wf on main concluded '$C' (must be success). Fix CI first (R3)." >&2
    exit 1
  fi
  echo "[ci-gate]   $wf: success"
done
echo "[ci-gate] OK — no runs for $SHA, all key workflows green on main"
exit 0
