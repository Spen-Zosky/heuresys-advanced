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
done < <(ls scripts/*.sh scripts/hooks/*.sh scripts/test/*.sh db/scripts/*.sh db/scripts/_lib/*.sh 2>/dev/null)

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

# ---------------- C6. propagate-secret-rotation.sh rotate core (fixtures, D-60)
section "propagate-secret-rotation.sh — rotate_keys_into fixtures (ENV_ROTATE_LOCAL)"

# C6a: rotazione esplicita — SOLO la chiave nominata cambia, le altre restano
printf 'A=1\nSECRET=old\nB=2\n' > "$T/r1"
printf 'SECRET=new\nA=999\n' > "$T/rs1"
rotated="$(ENV_ROTATE_LOCAL=1 bash scripts/propagate-secret-rotation.sh "$T/r1" "$T/rs1" SECRET)"
if [ "$rotated" = "1" ] && grep -q '^SECRET=new$' "$T/r1" && grep -q '^A=1$' "$T/r1" && grep -q '^B=2$' "$T/r1"; then
  ok "rotation: only the named key is overwritten (A untouched despite local A=999)"
else
  fail "rotation core (rotated=$rotated)"
fi

# C6b: refuse-list — la topologia per-macchina NON è ruotabile
printf 'POSTGRES_HOST=remotehost\n' > "$T/r2"
printf 'POSTGRES_HOST=localhost\n' > "$T/rs2"
if ENV_ROTATE_LOCAL=1 bash scripts/propagate-secret-rotation.sh "$T/r2" "$T/rs2" POSTGRES_HOST >/dev/null 2>&1; then
  fail "refuse-list: POSTGRES_HOST rotation should be refused"
else
  if grep -q '^POSTGRES_HOST=remotehost$' "$T/r2"; then
    ok "refuse-list: POSTGRES_HOST refused, remote topology intact"
  else
    fail "refuse-list: target mutated despite refusal"
  fi
fi

# C6c: chiave assente sul target → errore esplicito (rotazione ≠ canale additivo)
printf 'A=1\n' > "$T/r3"
printf 'NEWKEY=x\n' > "$T/rs3"
if ENV_ROTATE_LOCAL=1 bash scripts/propagate-secret-rotation.sh "$T/r3" "$T/rs3" NEWKEY >/dev/null 2>&1; then
  fail "missing-remote: NEWKEY rotation should fail (additive channel's job)"
else
  ok "missing-remote: refused (rotation only replaces existing keys)"
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
  # G5 (D-79): the CI-gate knobs are per-INVOCATION and the gate runs on the REMOTE
  #     host, so they must be forwarded explicitly. These exercise the composer, not
  #     a grep: a regression makes them fail with the wrong string, not a missing one.
  ge() { env -u CI_GATE_WAIT -u CI_GATE_POLL -u CI_GATE_KEY_WORKFLOWS -u DEPLOY_REQUIRE_CI \
           "$@" bash "$VDR" --print-gate-env; }
  [ "$(ge CI_GATE_WAIT=2100)" = ' CI_GATE_WAIT="2100"' ] \
    && ok "forwards CI_GATE_WAIT to the remote gate (D-79)" || fail "CI_GATE_WAIT not forwarded"
  [ "$(ge CI_GATE_KEY_WORKFLOWS='a.yml b.yml')" = ' CI_GATE_KEY_WORKFLOWS="a.yml b.yml"' ] \
    && ok "forwards a space-separated list intact (quoted)" || fail "list value not quoted"
  # The trap this guards: emitting `CI_GATE_WAIT=` would override the REMOTE default
  # with the empty string — a worse failure than the one D-79 describes.
  [ -z "$(ge CI_GATE_WAIT=)" ] \
    && ok "an empty value is NOT forwarded (remote default survives)" || fail "empty value forwarded"
  [ -z "$(ge 2>/dev/null)" ] \
    && ok "nothing forwarded when the caller set nothing" || fail "forwarded something unset"
  [ -z "$(ge CI_GATE_WAIT='9"; id; echo "' 2>/dev/null)" ] \
    && ok "refuses a value that would break out of the remote payload" || fail "unsafe value forwarded"
else
  fail "$VDR missing"
fi

# ----------------------- H. ci-gate.sh — deploy gate classification (D-08 F2)
section "ci-gate.sh — --classify fixtures + bypass (no network)"
CG=scripts/ci-gate.sh
if [ -f "$CG" ]; then
  cgc() { printf '%s' "$1" | bash "$CG" --classify; }
  R='{"workflow_runs":[{"name":"a","status":"completed","conclusion":"failure"},{"name":"b","status":"completed","conclusion":"success"}]}'
  [ "$(cgc "$R")" = "RED:a" ] && ok "RED on any failing run (success does not mask it)" || fail "classify RED"
  P='{"workflow_runs":[{"name":"a","status":"in_progress","conclusion":null},{"name":"b","status":"completed","conclusion":"success"}]}'
  [ "$(cgc "$P")" = "PENDING:1" ] && ok "PENDING while runs in flight (no premature green)" || fail "classify PENDING"
  G='{"workflow_runs":[{"name":"a","status":"completed","conclusion":"success"},{"name":"b","status":"completed","conclusion":"skipped"}]}'
  [ "$(cgc "$G")" = "GREEN:1" ] && ok "GREEN with success (+skipped tolerated)" || fail "classify GREEN"
  N='{"workflow_runs":[{"name":"a","status":"completed","conclusion":"cancelled"}]}'
  [ "$(cgc "$N")" = "NOSIGNAL" ] && ok "NOSIGNAL when only cancelled runs (fallback path)" || fail "classify NOSIGNAL"
  E='{"workflow_runs":[]}'
  [ "$(cgc "$E")" = "NOSIGNAL" ] && ok "NOSIGNAL on zero runs (docs-only push)" || fail "classify empty"
  if DEPLOY_REQUIRE_CI=0 bash "$CG" deadbeef >/dev/null 2>&1; then
    ok "DEPLOY_REQUIRE_CI=0 bypass exits 0 without network"
  else fail "bypass DEPLOY_REQUIRE_CI=0"; fi
  # vm-deploy wires the gate BEFORE the first mutating step (pre-deploy snapshot)
  if awk '/ci-gate.sh/{g=NR} /pre-deploy snapshot \(pg_dump/{s=NR} END{exit !(g && s && g<s)}' scripts/vm-deploy.sh; then
    ok "vm-deploy calls ci-gate before the first mutation (snapshot step)"
  else fail "vm-deploy gate ordering (must precede pre-deploy snapshot)"; fi
else
  fail "$CG missing"
fi

# -------------------------------------------- N. session modes (canonical|lab)
# Two sessions can run on this working tree at once: one developing, one doing
# read-only analysis. The mode is state on disk keyed by session_id, so the
# hooks can treat them differently AT THE SAME MOMENT. These tests assert the
# two treatments are OPPOSITE — a fix that simply silences the gate for
# everyone would pass a naive check and fail here.
section "session modes — scripts/hooks/"
HK="scripts/hooks/hook.sh"
if [ -f "$HK" ]; then
  if sh "$HK" selftest >/dev/null 2>&1; then
    ok "session_mode selftest (guard decisions + registry fail-safe + parser)"
  else
    sh "$HK" selftest 2>&1 | sed 's/^/      /'
    fail "session_mode selftest"
  fi

  SL='__shelltest_lab__'; SC='__shelltest_canon__'
  pay() { printf '{"session_id":"%s","tool_name":"%s","tool_input":%s}' "$1" "$2" "$3"; }

  sh "$HK" set "$SL" lab       >/dev/null 2>&1
  sh "$HK" set "$SC" canonical >/dev/null 2>&1
  [ "$(sh "$HK" mode "$SL")" = "lab" ]       && ok "marker: lab session reads back as lab" \
                                             || fail "marker lab"
  [ "$(sh "$HK" mode "$SC")" = "canonical" ] && ok "marker: canonical session reads back as canonical" \
                                             || fail "marker canonical"
  [ "$(sh "$HK" mode "__never_marked__")" = "canonical" ] \
      && ok "fail-safe: unmarked session defaults to canonical (never permissive)" \
      || fail "fail-safe default"

  # --- guard: writes denied in lab, allowed in canonical, reads ALWAYS allowed
  W="$(pay "$SL" Write '{"file_path":"'"$ROOT"'/apps/api/src/x.ts"}')"
  printf '%s' "$W" | sh "$HK" lab-guard >/dev/null 2>&1
  [ $? -eq 2 ] && ok "guard: lab session cannot write inside the repo" || fail "guard lab write"

  W="$(pay "$SC" Write '{"file_path":"'"$ROOT"'/apps/api/src/x.ts"}')"
  if printf '%s' "$W" | sh "$HK" lab-guard >/dev/null 2>&1; then
    ok "guard: canonical session writes freely (guard is inert outside lab)"
  else fail "guard must not touch canonical sessions"; fi

  GUARD_READ_FAIL=0
  for R in \
    'Read {"file_path":"'"$ROOT"'/apps/api/src/server.ts"}' \
    'Read {"file_path":"'"$ROOT"'/.env"}' \
    'Grep {"pattern":"x","path":"'"$ROOT"'"}' \
    'Bash {"command":"git log --oneline -3"}' \
    'Bash {"command":"psql -c \"SELECT 1;\""}' \
    'Bash {"command":"pnpm status"}' \
    'Bash {"command":"ssh linux-pc systemctl is-active heuresys-api"}' \
    'Bash {"command":"cat apps/api/package.json"}' ; do
    T="${R%% *}"; I="${R#* }"
    printf '%s' "$(pay "$SL" "$T" "$I")" | sh "$HK" lab-guard >/dev/null 2>&1 \
      || GUARD_READ_FAIL=$((GUARD_READ_FAIL+1))
  done
  [ "$GUARD_READ_FAIL" = 0 ] \
      && ok "guard: 8/8 read categories pass in lab (a blocked read is a defect)" \
      || fail "guard blocks $GUARD_READ_FAIL read(s) in lab mode"

  # --- stop gate: opposite treatment for the two sessions, same working tree
  LABOUT="$(printf '{"session_id":"%s","hook_event_name":"Stop"}' "$SL" | sh "$HK" stop-gate 2>/dev/null)"
  [ -z "$LABOUT" ] && ok "stop gate: silent for a lab session (turn can close)" \
                   || fail "stop gate must not block lab: $LABOUT"

  # Equivalence, not a hardcoded verdict: whatever the gate says today, a
  # canonical session must say exactly the same thing it said before this change.
  CANOUT="$(printf '{"session_id":"%s","hook_event_name":"Stop"}' "$SC" | sh "$HK" stop-gate 2>/dev/null)"
  DIRECT="$(python docs/kb/tools/verify_gate.py check --hook 2>/dev/null || true)"
  [ "$CANOUT" = "$DIRECT" ] \
      && ok "stop gate: canonical session gets verify_gate verbatim (no behaviour drift)" \
      || fail "stop gate drift — wrapper='$CANOUT' direct='$DIRECT'"

  # --- prompt parsing writes the marker deterministically (not model-dependent)
  SP='__shelltest_prompt__'
  printf '{"session_id":"%s","prompt":"avvia sessione lab"}' "$SP" | sh "$HK" prompt-hook >/dev/null 2>&1
  [ "$(sh "$HK" mode "$SP")" = "lab" ] && ok "'avvia sessione lab' marks the session lab" \
                                       || fail "prompt-hook lab"
  printf '{"session_id":"%s","prompt":"avvia sessione"}' "$SP" | sh "$HK" prompt-hook >/dev/null 2>&1
  [ "$(sh "$HK" mode "$SP")" = "canonical" ] && ok "'avvia sessione' marks the session canonical" \
                                             || fail "prompt-hook canonical"
  printf '{"session_id":"%s","prompt":"che ne pensi di avvia sessione lab?"}' "$SP" | sh "$HK" prompt-hook >/dev/null 2>&1
  [ "$(sh "$HK" mode "$SP")" = "canonical" ] && ok "a mention inside a sentence does not switch mode" \
                                             || fail "prompt-hook false positive"

  MDIR="$(cd "$ROOT/.." && pwd)/.heuresys-session-mode"
  rm -f "$MDIR/__shelltest_lab__.json" "$MDIR/__shelltest_canon__.json" \
        "$MDIR/__shelltest_prompt__.json" "$MDIR/__selftest__.json" 2>/dev/null
else
  fail "$HK missing"
fi

# ---------------------------------------------------------------- summary
printf '\n%d ok, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" = 0 ]
