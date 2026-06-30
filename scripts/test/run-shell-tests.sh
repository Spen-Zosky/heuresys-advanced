#!/usr/bin/env bash
#
# scripts/test/run-shell-tests.sh — D-19: automated regression gate for the
# deploy/alignment shell scripts (previously verified only via `bash -n` +
# manual E2E; the S979 marker-CRLF bug was caught by hand — this gate exists
# so the next one is caught by CI).
#
# Dependency-free (bash + coreutils). shellcheck runs only where installed
# (advisory skip elsewhere, e.g. Git Bash on Windows); the CI runner has it.
# Run from anywhere inside the repo: bash scripts/test/run-shell-tests.sh
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
FAIL=0; PASS=0
ok()      { PASS=$((PASS+1)); printf '  \033[32mok\033[0m  %s\n' "$*"; }
fail()    { FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m %s\n' "$*" >&2; }
section() { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }

# ---------------------------------------------------------------- A. syntax
section "bash -n syntax gate (scripts/ + db/scripts/)"
while IFS= read -r f; do
  if bash -n "$f" 2>/dev/null; then ok "bash -n $f"; else fail "bash -n $f"; fi
done < <(ls scripts/*.sh scripts/test/*.sh db/scripts/*.sh db/scripts/_lib/*.sh 2>/dev/null)

# ------------------------------------------------------------ B. shellcheck
section "shellcheck (severity=error)"
if command -v shellcheck >/dev/null 2>&1; then
  if shellcheck --severity=error scripts/*.sh scripts/test/*.sh db/scripts/*.sh; then
    ok "shellcheck severity=error clean"
  else
    fail "shellcheck severity=error"
  fi
else
  printf '  \033[33mskip\033[0m shellcheck not installed here (gate active on CI runner)\n'
fi

# ------------------------------------- C. env-key-merge.sh merge core (fixtures)
section "env-key-merge.sh — merge_env_into fixtures (ENV_MERGE_LOCAL)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT

# C1: additive add + never-overwrite + comment/blank/non-var skip
printf 'A=1\nB=remote\n' > "$T/target"
printf '# comment\n\nB=local-should-not-win\nC=3\nNOEQUALS\n' > "$T/src"
added="$(ENV_MERGE_LOCAL=1 bash scripts/env-key-merge.sh "$T/target" "$T/src")"
if [ "$added" = "1" ] && grep -q '^C=3$' "$T/target" && grep -q '^B=remote$' "$T/target" \
   && ! grep -q 'local-should-not-win' "$T/target"; then
  ok "additive merge: adds only missing keys, never overwrites topology"
else
  fail "additive merge (added=$added)"
fi

# C2: CRLF source tolerated — keys land LF-only (no \r planted into a Linux .env)
printf 'A=1\n' > "$T/t2"
printf 'D=4\r\nE=5\r\n' > "$T/s2"
added="$(ENV_MERGE_LOCAL=1 bash scripts/env-key-merge.sh "$T/t2" "$T/s2")"
if [ "$added" = "2" ] && ! grep -q $'\r' "$T/t2" && grep -q '^D=4$' "$T/t2"; then
  ok "CRLF source: 2 keys merged, no CR planted (S979 CRLF lesson)"
else
  fail "CRLF source (added=$added)"
fi

# C3: idempotent re-run
added="$(ENV_MERGE_LOCAL=1 bash scripts/env-key-merge.sh "$T/t2" "$T/s2")"
if [ "$added" = "0" ]; then ok "re-run adds 0 (idempotent)"; else fail "idempotency (added=$added)"; fi

# C4: missing trailing newline on the last source line still merges
printf 'A=1\n' > "$T/t3"
printf 'F=6' > "$T/s3"
added="$(ENV_MERGE_LOCAL=1 bash scripts/env-key-merge.sh "$T/t3" "$T/s3")"
if [ "$added" = "1" ] && grep -q '^F=6$' "$T/t3"; then ok "no-trailing-newline source line merges"; else fail "no-trailing-newline (added=$added)"; fi

# C5: denylist — dev-only neutralization switches NEVER propagate to a remote
# (S989 MFA enforcement: a local 'false' must not silently disable PROD MFA).
printf 'A=1\n' > "$T/t5"
printf 'MFA_ENFORCEMENT_ENABLED=false\nG=7\n' > "$T/s5"
added="$(ENV_MERGE_LOCAL=1 bash scripts/env-key-merge.sh "$T/t5" "$T/s5")"
if [ "$added" = "1" ] && grep -q '^G=7$' "$T/t5" && ! grep -q 'MFA_ENFORCEMENT_ENABLED' "$T/t5"; then
  ok "denylist: MFA_ENFORCEMENT_ENABLED not propagated (no silent PROD downgrade)"
else
  fail "denylist (added=$added)"
fi

# --------------------- D. align-clones.sh auto-deploy gate (production regex)
section "align-clones.sh — DEPLOY_PATHS_RE auto-deploy gate"
RE_LINE="$(grep -m1 '^DEPLOY_PATHS_RE=' scripts/align-clones.sh)"
if [ -n "$RE_LINE" ]; then
  eval "$RE_LINE"   # tests the regex AS SHIPPED — no copy to drift
  should_deploy="apps/api/src/server.ts
packages/shared/src/index.ts
db/migrations/000103_x.sql
db/scripts/migrate.sh
scripts/vm-deploy.sh
deploy/nginx/heuresys.conf"
  should_skip="docs/kb/SOT_STATE.md
.handoff/STATE.md
memory/feedback_x.md
qa_artifacts/report.md
README.md
.github/workflows/lint.yml"
  while IFS= read -r p; do
    if printf '%s\n' "$p" | grep -qE "$DEPLOY_PATHS_RE"; then ok "deploy-relevant: $p"; else fail "expected deploy-relevant: $p"; fi
  done <<< "$should_deploy"
  while IFS= read -r p; do
    if printf '%s\n' "$p" | grep -qE "$DEPLOY_PATHS_RE"; then fail "expected NOT deploy-relevant: $p"; else ok "not deploy-relevant: $p"; fi
  done <<< "$should_skip"
else
  fail "DEPLOY_PATHS_RE not found in scripts/align-clones.sh"
fi

# ------------------------- E. session marker head-parse contract (CRLF, S979)
section "session marker — CRLF head parse contract"
printf 'abc1234\r\nmemory_one.md\r\n' > "$T/marker"
sha="$(head -1 "$T/marker" | tr -d '\r')"
if [ "$sha" = "abc1234" ]; then ok "CRLF marker line-1 parses to a clean sha"; else fail "marker parse ('$sha')"; fi

# ----------------- F. close-propagate.sh — flag parse + clone-db decision + resilience (§12.5)
section "close-propagate.sh — dry-run plan + resilience wiring"
CP="scripts/close-propagate.sh"
# F1: defaults — delta / auto-deploy / clone-db auto
out="$(CLOSE_PROPAGATE_DRYRUN=1 bash "$CP" 2>&1)"
if printf '%s' "$out" | grep -q 'mode=delta deploy=--auto-deploy clone-db=auto'; then
  ok "defaults: --delta --auto-deploy clone-db=auto"
else fail "defaults plan ($out)"; fi
# F2: explicit flags parsed correctly
out="$(CLOSE_PROPAGATE_DRYRUN=1 bash "$CP" --full --no-deploy --no-clone-db 2>&1)"
if printf '%s' "$out" | grep -q 'mode=full deploy=--no-deploy clone-db=skip'; then
  ok "flags: --full --no-deploy --no-clone-db"
else fail "explicit flags plan ($out)"; fi
# F3: --clone-db forces the conditional DB refresh (need_clone=1, regardless of the marker)
out="$(CLOSE_PROPAGATE_DRYRUN=1 bash "$CP" --clone-db 2>&1)"
if printf '%s' "$out" | grep -q 'clone-db=force need_clone=1'; then
  ok "--clone-db forces the DB refresh (§12.3 override)"
else fail "--clone-db force ($out)"; fi
# F4: unknown flag rejected before any channel runs (exit 1)
if CLOSE_PROPAGATE_DRYRUN=1 bash "$CP" --bogus-flag >/dev/null 2>&1; then
  fail "unknown flag should exit non-zero"
else ok "unknown flag rejected (exit 1, before any channel)"; fi
# F5: idempotent plan — two dry-runs produce identical output
a="$(CLOSE_PROPAGATE_DRYRUN=1 bash "$CP" --delta 2>&1)"; b="$(CLOSE_PROPAGATE_DRYRUN=1 bash "$CP" --delta 2>&1)"
if [ "$a" = "$b" ]; then ok "dry-run plan is idempotent (stable across runs)"; else fail "dry-run not idempotent"; fi
# F6: host-off resilience + fail-loud wiring present (static — no live LAN host in CI)
if grep -q 'ConnectTimeout=8' "$CP" && grep -q 'unreachable' "$CP" \
   && grep -q 'failed on a reachable host' "$CP"; then
  ok "resilience: unreachable→skip+warn, reachable-fail→fail-loud (die)"
else fail "resilience/fail-loud wiring missing"; fi

# ------------------- G. vm-deploy-remote.sh — detached-deploy wiring (D-49, static)
section "vm-deploy-remote.sh — detached deploy + poll wiring (D-49)"
VDR="scripts/vm-deploy-remote.sh"
if [ -f "$VDR" ]; then
  # G1: detaches the deploy from the client connection (setsid + nohup) so a
  #     client-side SSH timeout can't SIGTERM the build mid-flight.
  if grep -q 'setsid' "$VDR" && grep -q 'nohup' "$VDR"; then
    ok "detaches deploy from client SSH (setsid + nohup)"
  else fail "missing setsid/nohup detachment"; fi
  # G2: captures the REAL deploy exit code via a remote sentinel it then polls.
  if grep -qF 'echo \$? >' "$VDR" && grep -q 'rc=' "$VDR"; then
    ok "captures deploy exit code in a remote sentinel + polls it"
  else fail "missing exit-code sentinel / poll"; fi
  # G3: bounded poll budget — the watcher detaches instead of hanging forever,
  #     and never kills the still-running deploy.
  if grep -q 'POLL_MAX' "$VDR" && grep -q 'DETACHING watcher' "$VDR"; then
    ok "bounded poll budget — watcher detaches, deploy continues"
  else fail "missing bounded poll budget"; fi
  # G4: align-clones routes the PROD deploy THROUGH it — no bare foreground
  #     `ssh host bash scripts/vm-deploy.sh` that a client timeout can truncate.
  if grep -q 'vm-deploy-remote.sh' scripts/align-clones.sh \
     && ! grep -qE 'ssh .*bash scripts/vm-deploy\.sh' scripts/align-clones.sh; then
    ok "align-clones deploys via vm-deploy-remote.sh (no foreground ssh vm-deploy)"
  else fail "align-clones still uses a foreground ssh vm-deploy.sh"; fi
else
  fail "$VDR missing"
fi

# ---------------------------------------------------------------- summary
printf '\n%d ok, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" = 0 ]
