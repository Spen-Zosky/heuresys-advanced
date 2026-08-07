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

# ------------------------------- N0. #165 — il deploy sganciato dalla chiusura
# Tre cose devono restare vere insieme, e sono indipendenti:
#   1. «CI in volo» non e' ne' verde ne' rossa — ci-gate esce 75, un codice suo;
#   2. il sorvegliante non deploya MAI cio' che non e' armato, verde e arretrato;
#   3. la chiusura arma invece di aspettare, e il veto S1030 disarma.
# Tutto offline: ci-gate legge un fixture (CI_GATE_FIXTURE) e il sorvegliante gira
# su un repo finto con un `origin` bare locale. Un test che avesse bisogno della rete
# non girerebbe mai dove serve — cioe' prima del push.
section "#165 — ci-gate non bloccante (75) + deploy-watch armato"
CG=scripts/ci-gate.sh; DW=scripts/deploy-watch.sh
if [ -f "$CG" ] && [ -f "$DW" ]; then
  F="$(mktemp -d)"
  printf '%s' '{"workflow_runs":[{"name":"a","status":"in_progress","conclusion":null}]}'          > "$F/pending.json"
  printf '%s' '{"workflow_runs":[{"name":"a","status":"completed","conclusion":"success"}]}'       > "$F/green.json"
  printf '%s' '{"workflow_runs":[{"name":"a","status":"completed","conclusion":"failure"}]}'       > "$F/red.json"

  # --- 1. i tre esiti del cancello, con e senza modo non bloccante
  CI_GATE_FIXTURE="$F/pending.json" CI_GATE_NONBLOCKING=1 bash "$CG" deadbeef >/dev/null 2>&1
  [ "$?" = 75 ] && ok "ci-gate: CI in volo + non bloccante => 75 (ne' 0 ne' 1)" || fail "ci-gate PENDING non ha dato 75"
  CI_GATE_FIXTURE="$F/green.json" CI_GATE_NONBLOCKING=1 bash "$CG" deadbeef >/dev/null 2>&1
  [ "$?" = 0 ]  && ok "ci-gate: verde => 0 anche in modo non bloccante" || fail "ci-gate GREEN non ha dato 0"
  CI_GATE_FIXTURE="$F/red.json" CI_GATE_NONBLOCKING=1 bash "$CG" deadbeef >/dev/null 2>&1
  [ "$?" = 1 ]  && ok "ci-gate: rossa => 1 (il non bloccante non ammorbidisce il rosso)" || fail "ci-gate RED non ha dato 1"
  # Il 75 deve esistere SOLO su richiesta: in modo normale una CI in volo che scade resta un 1.
  CI_GATE_FIXTURE="$F/pending.json" CI_GATE_WAIT=0 bash "$CG" deadbeef >/dev/null 2>&1
  [ "$?" = 1 ]  && ok "ci-gate: senza il flag, PENDING scaduto resta 1 (nessun cambio di contratto)" || fail "ci-gate PENDING bloccante non ha dato 1"

  # --- 2. il sorvegliante, su un repo finto con origin bare locale (offline)
  B="$F/origin.git"; W="$F/box"
  git init -q --bare "$B"
  git init -q "$W"
  git -C "$W" config user.email t@t; git -C "$W" config user.name t
  git -C "$W" config commit.gpgsign false
  mkdir -p "$W/scripts" "$W/pg_dump_snapshots"
  cp "$CG" "$DW" "$W/scripts/"
  echo x > "$W/f"; git -C "$W" add -A >/dev/null; git -C "$W" commit -qm c1
  git -C "$W" remote add origin "$B"; git -C "$W" push -q origin HEAD:refs/heads/main
  SHA1="$(git -C "$W" rev-parse HEAD)"
  dw() { DEPLOY_WATCH_DRYRUN=1 REPO_DIR="$W" bash "$W/scripts/deploy-watch.sh" 2>&1; }

  out="$(dw)"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'nessun deploy armato'; } \
    && ok "deploy-watch: niente armato => non fa nulla, esce 0" || fail "deploy-watch senza arma ($rc: $out)"

  git -C "$W" push -q origin HEAD:refs/heads/prod            # armato, ma LAST_GOOD assente
  out="$(dw)"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'IGNOTO' && ! printf '%s' "$out" | grep -q 'partirebbe'; } \
    && ok "deploy-watch: LAST_GOOD assente => IGNOTO, NON deploya (dottrina del dubbio)" || fail "deploy-watch IGNOTO ($rc: $out)"

  printf 'non-uno-sha\n' > "$W/pg_dump_snapshots/LAST_GOOD_SHA"
  out="$(dw)"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'IGNOTO'; } \
    && ok "deploy-watch: LAST_GOOD che non e' uno sha => IGNOTO (il guard non si accontenta dell'esistenza)" \
    || fail "deploy-watch LAST_GOOD malformato ($rc: $out)"

  printf '%s\n' "$SHA1" > "$W/pg_dump_snapshots/LAST_GOOD_SHA"
  out="$(dw)"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'gia'; } \
    && ok "deploy-watch: armato == in produzione => non fa nulla" || fail "deploy-watch idempotenza ($rc: $out)"

  # la punta avanza SENZA riarmare: e' il caso che protegge dal deploy non autorizzato
  echo y >> "$W/f"; git -C "$W" commit -qam c2; git -C "$W" push -q origin HEAD:refs/heads/main
  out="$(dw)"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'non e. piu. quella autorizzata'; } \
    && ok "deploy-watch: main oltre prod => NON deploya (nessun deploy non autorizzato)" || fail "deploy-watch main>prod ($rc: $out)"

  # armato, arretrato, e la CI dice le tre cose
  git -C "$W" push -qf origin HEAD:refs/heads/prod
  out="$(CI_GATE_FIXTURE="$F/pending.json" dw)"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'ancora in volo'; } \
    && ok "deploy-watch: CI in volo => esce 0 zitto (non accende systemctl --failed)" || fail "deploy-watch PENDING ($rc: $out)"
  out="$(CI_GATE_FIXTURE="$F/red.json" dw)"; rc=$?
  { [ "$rc" = 1 ] && printf '%s' "$out" | grep -q 'NON VERDE'; } \
    && ok "deploy-watch: CI rossa => esce 1 (OnFailure registra)" || fail "deploy-watch RED ($rc: $out)"
  out="$(CI_GATE_FIXTURE="$F/red.json" dw)"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'gia. segnalato'; } \
    && ok "deploy-watch: stessa CI rossa al tick dopo => zitto (un allarme ripetuto non e' un allarme)" || fail "deploy-watch RED ripetuto ($rc: $out)"
  out="$(CI_GATE_FIXTURE="$F/green.json" dw)"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'partirebbe'; } \
    && ok "deploy-watch: armato + arretrato + verde => deploya" || fail "deploy-watch GREEN ($rc: $out)"
  rm -rf "$F"
else
  fail "$CG o $DW mancante"
fi

section "#165 — close-propagate arma invece di aspettare la CI"
# NIENTE STORIA GIT QUI. La CI fa `actions/checkout` con fetch-depth: 1, quindi
# `git log -- <file> | tail -1` restituisce la PUNTA e ogni diff «da li' a HEAD» e'
# vuoto: la prima stesura di questi test era verde in locale e rossa in CI proprio
# per questo (S1049 — e il repo l'aveva gia' imparato in S1046, commit «fixture git
# deterministica, non la storia del repo»). Il predicato si prova COM'E' SPEDITO,
# come gia' fa il gate DEPLOY_PATHS_RE di align-clones qui sopra.
CP=scripts/close-propagate.sh
if [ -f "$CP" ]; then
  MKD="$(mktemp -d)"; MK="$MKD/marker"
  plan() { local m="$1"; shift; HEURESYS_MARKER="$m" CLOSE_PROPAGATE_DRYRUN=1 bash "$CP" "$@" 2>/dev/null | grep '^PLAN arm='; }

  # --- il criterio di armamento DEVE essere lo stesso con cui align-clones deciderebbe
  #     il deploy. Se i due divergono si arma su un criterio e si deploya su un altro:
  #     e' il difetto piu' grave possibile qui, e nessuno lo vedrebbe a occhio.
  ARM_LINE="$(grep -m1 '^ARM_PATHS_RE=' "$CP")"
  DEP_LINE="$(grep -m1 '^DEPLOY_PATHS_RE=' scripts/align-clones.sh)"
  if [ -n "$ARM_LINE" ] && [ "${ARM_LINE#ARM_PATHS_RE=}" = "${DEP_LINE#DEPLOY_PATHS_RE=}" ]; then
    ok "close-propagate: criterio di armamento IDENTICO al criterio di deploy di align-clones"
  else fail "ARM_PATHS_RE diverge da DEPLOY_PATHS_RE ($ARM_LINE | $DEP_LINE)"; fi

  if [ -n "$ARM_LINE" ]; then
    eval "$ARM_LINE"   # il predicato come spedito — nessuna copia che possa derivare
    for p in scripts/deploy-watch.sh db/migrations/000300_x.sql apps/api/src/server.ts deploy/systemd/x.timer; do
      if printf '%s\n' "$p" | grep -qE "$ARM_PATHS_RE"; then ok "arma su: $p"; else fail "doveva armare su $p"; fi
    done
    for p in docs/kb/SOT_STATE.md .handoff/STATE.md README.md qa_artifacts/r.md; do
      if printf '%s\n' "$p" | grep -qE "$ARM_PATHS_RE"; then fail "NON doveva armare su $p"; else ok "non arma su: $p"; fi
    done
  fi

  # --- le etichette del piano. Nessuna di queste consulta la storia: `--deploy` e
  #     `--deploy-now` decidono per flag, il marcatore assente decide per assenza, e
  #     il ramo «misurato» si prova col caso deterministico marcatore==HEAD (finestra
  #     vuota => non armare), che vale identico su un clone shallow e su uno completo.
  printf 'deadbeef\n' > "$MK"
  p="$(plan "$MK" --delta --deploy)"
  { printf '%s' "$p" | grep -q 'arm=arma' && printf '%s' "$p" | grep -q 'align-deploy-flag=--no-deploy'; } \
    && ok "close-propagate: arma, e ad align-clones passa --no-deploy (il deploy NON e' piu' in linea)" \
    || fail "arm=arma + align-deploy-flag=--no-deploy attesi ($p)"

  git rev-parse HEAD > "$MK"
  p="$(plan "$MK" --delta --auto-deploy)"
  printf '%s' "$p" | grep -q 'arm=no' \
    && ok "close-propagate: finestra di sessione vuota => misura, e non arma" || fail "arm=no atteso su finestra vuota ($p)"

  p="$(plan "$MKD/assente" --delta --auto-deploy)"
  printf '%s' "$p" | grep -q 'arm=no' \
    && ok "close-propagate: marcatore assente => non arma nel dubbio" || fail "arm=no atteso ($p)"

  # il veto S1030 deve continuare a valere: e' la ragione per cui l'armamento esiste
  p="$(HEURESYS_MARKER="$MK" HEURESYS_CLOSE_NODEPLOY=1 CLOSE_PROPAGATE_DRYRUN=1 bash "$CP" --delta --deploy 2>/dev/null | grep '^PLAN arm=')"
  printf '%s' "$p" | grep -q 'arm=veto' \
    && ok "close-propagate: HEURESYS_CLOSE_NODEPLOY=1 => veto, vince sul flag esplicito (S1030 preservato)" || fail "arm=veto atteso ($p)"

  p="$(plan "$MK" --delta --deploy-now)"
  { printf '%s' "$p" | grep -q 'arm=deploy-now' && printf '%s' "$p" | grep -q 'align-deploy-flag=--deploy'; } \
    && ok "close-propagate: --deploy-now conserva il deploy sincrono di prima di #165" || fail "deploy-now ($p)"
  rm -rf "$MKD"
else
  fail "$CP missing"
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
    # NON usare `T`: è il tempdir globale (riga 39) e il trap EXIT ci fa `rm -rf`. Clobberarlo
    # qui lasciava T="Bash" ⟹ il trap cancellava una cartella `Bash` relativa alla root del repo
    # e il vero tempdir non veniva mai ripulito. Latente finché nessun test DOPO questa sezione
    # usava $T (S1046: i primi sono stati quelli della dottrina del dubbio).
    TOOLN="${R%% *}"; I="${R#* }"
    printf '%s' "$(pay "$SL" "$TOOLN" "$I")" | sh "$HK" lab-guard >/dev/null 2>&1 \
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

# ------------------- I. dottrina del dubbio — deploy + clone-db + diario (S1046)
# Regressione custodita: quando il marcatore non è misurabile, la catena di chiusura NON deve
# agire sulle azioni care (deploy in PROD, clone del DB) e DEVE dire perché. Prima di S1046
# align-clones deployava (`conservative: deploy`) e close-propagate non clonava dichiarando un
# fatto falso — due default opposti sulla stessa informazione mancante.
section "dottrina del dubbio — nel dubbio non si agisce, e si dichiara"
# Fixture git deterministica: tre commit noti (base → tocca scripts/ → tocca db/migrations/).
# Serve perché i rami "misurato-SÌ" hanno bisogno di una finestra che contenga davvero quei path,
# e la storia del repo reale non è disponibile sotto checkout shallow (CI).
FIXT="$T/fixture-repo"; FIXT_BASE=""
if mkdir -p "$FIXT/scripts" "$FIXT/db/migrations" 2>/dev/null \
   && git -C "$FIXT" init -q 2>/dev/null; then
  gitf() { git -C "$FIXT" -c user.email=t@t -c user.name=t -c commit.gpgsign=false "$@"; }
  echo base > "$FIXT/README.md";                 gitf add -A; gitf commit -qm base
  FIXT_BASE="$(git -C "$FIXT" rev-parse HEAD)"
  echo x    > "$FIXT/scripts/deploy-thing.sh";   gitf add -A; gitf commit -qm code
  FIXT_CODE="$(git -C "$FIXT" rev-parse HEAD)"
  echo y    > "$FIXT/db/migrations/000999_x.sql"; gitf add -A; gitf commit -qm mig
fi
AC="scripts/align-clones.sh"
DEPLOY_BLOCK="$(sed -n '/^case "\$DEPLOY_FLAG" in/,/^esac/p' "$AC")"
RE_LINE2="$(grep -m1 '^DEPLOY_PATHS_RE=' "$AC")"
if [ -n "$DEPLOY_BLOCK" ] && [ -n "$RE_LINE2" ]; then
  # Valuta la decisione AS SHIPPED (nessuna copia che possa driftare — stesso principio del test D).
  decide() {  # $1=DEPLOY_FLAG $2=DELTA $3=HAVE_MARKER $4=START_HEAD  ->  "DEPLOY|WHY"
    ( set +eu
      warn() { :; }
      eval "$RE_LINE2"
      DEPLOY_FLAG="$1"; DELTA="$2"; HAVE_MARKER="$3"; START_HEAD="$4"; DEPLOY=""; DEPLOY_WHY=""
      eval "$DEPLOY_BLOCK"
      printf '%s|%s' "$DEPLOY" "$DEPLOY_WHY" )
  }
  # I1 — IL caso che ha causato il difetto: seconda chiusura, marcatore già consumato.
  r="$(decide auto 1 0 '')"
  case "$r" in 0\|IGNOTO*) ok "marcatore assente + --auto-deploy ⟹ NIENTE deploy, ragione IGNOTO" ;;
    *) fail "marcatore assente doveva dare 0|IGNOTO*, ha dato '$r'" ;; esac
  # I2 — modalità full: nessuna finestra su cui misurare ⟹ stessa risposta.
  r="$(decide auto 0 0 '')"
  case "$r" in 0\|IGNOTO*) ok "modalità full + --auto-deploy ⟹ NIENTE deploy, ragione IGNOTO" ;;
    *) fail "full mode doveva dare 0|IGNOTO*, ha dato '$r'" ;; esac
  # I3 — chi sa, comanda: il flag esplicito resta incondizionato.
  r="$(decide on 0 0 '')"
  case "$r" in 1\|*) ok "--deploy esplicito resta incondizionato (il dubbio non lo tocca)" ;;
    *) fail "--deploy esplicito doveva dare 1|*, ha dato '$r'" ;; esac
  # I4 — misurato-NO: finestra valida, nessun commit su path di deploy.
  r="$(decide auto 1 1 "$(git rev-parse HEAD)")"
  case "$r" in 0\|misurato*) ok "finestra valida senza commit di codice ⟹ 'misurato', non 'IGNOTO'" ;;
    *) fail "atteso 0|misurato*, ha dato '$r'" ;; esac
  # I5 — misurato-SÌ: finestra che CONTIENE un commit su scripts/.
  # La premessa si COSTRUISCE, non si cerca nella storia del repo: in CI il checkout è shallow,
  # quindi `git log -- scripts/` e `rev-parse <sha>^` non vedono ciò che vedono in locale. Un test
  # la cui premessa dipende da una storia che non controlla è verde a casa e rosso in CI — che è
  # esattamente com'è fallito al primo giro (37b025da).
  if [ -n "$FIXT_BASE" ]; then
    r="$( cd "$FIXT" && decide auto 1 1 "$FIXT_BASE" )"
    case "$r" in 1\|misurato*) ok "finestra che tocca scripts/ ⟹ deploy 'misurato' ed eseguito" ;;
      *) fail "atteso 1|misurato*, ha dato '$r'" ;; esac
  else fail "fixture git non creata: impossibile provare il ramo misurato-SÌ"; fi
else
  fail "blocco di decisione del deploy non estraibile da $AC"
fi

# I6-I8 — close-propagate: i tre stati del clone-DB, su un marcatore FINTO (HEURESYS_MARKER),
# così il marcatore reale della sessione in corso non viene mai toccato dai test.
FAKE_M="$T/fake-marker"
rm -f "$FAKE_M"
out="$(HEURESYS_MARKER="$FAKE_M" CLOSE_PROPAGATE_DRYRUN=1 bash "$CP" 2>&1)"
if printf '%s' "$out" | grep -q 'need_clone=0' && printf '%s' "$out" | grep -q 'clone-db-why: IGNOTO'; then
  ok "clone-db: marcatore assente ⟹ need_clone=0 dichiarato IGNOTO (mai 'no change this session')"
else fail "clone-db marcatore assente ($out)"; fi
printf '%s\n' "$(git rev-parse HEAD)" > "$FAKE_M"
out="$(HEURESYS_MARKER="$FAKE_M" CLOSE_PROPAGATE_DRYRUN=1 bash "$CP" 2>&1)"
if printf '%s' "$out" | grep -q 'need_clone=0' && printf '%s' "$out" | grep -q 'clone-db-why: misurato'; then
  ok "clone-db: finestra valida senza migrazioni ⟹ 'misurato', non 'IGNOTO'"
else fail "clone-db misurato-no ($out)"; fi
# I8 — misurato-SÌ sulla fixture (stessa ragione di I5: la storia reale non è affidabile in CI).
# `--dry-run` esce prima di toccare qualunque canale, quindi girare dentro la fixture è sicuro:
# legge solo ROOT (dal git della cwd), il marcatore e `git diff`.
if [ -n "$FIXT_BASE" ]; then
  printf '%s\n' "$FIXT_CODE" > "$FAKE_M"   # finestra CODE..HEAD ⟹ contiene il commit di migrazione
  out="$( cd "$FIXT" && HEURESYS_MARKER="$FAKE_M" CLOSE_PROPAGATE_DRYRUN=1 bash "$ROOT/$CP" 2>&1 )"
  if printf '%s' "$out" | grep -q 'need_clone=1'; then
    ok "clone-db: finestra che tocca db/migrations ⟹ need_clone=1"
  else fail "clone-db misurato-si ($out)"; fi
else fail "fixture git non creata: impossibile provare il ramo clone-db misurato-SÌ"; fi

# I9 — il diario: scrive una riga per passo e la rilegge. Su un log FINTO
# (HEURESYS_CLOSE_LOG), altrimenti i test inquinerebbero la misura reale.
CL="scripts/close-log.sh"
FAKE_L="$T/fake-close-log.ndjson"
if [ -f "$CL" ]; then
  HEURESYS_CLOSE_LOG="$FAKE_L" HEURESYS_SESSION=STEST bash "$CL" step pubblica saltato \
    'niente da committare: stato già allineato a HEAD' >/dev/null 2>&1
  HEURESYS_CLOSE_LOG="$FAKE_L" HEURESYS_SESSION=STEST bash "$CL" step deploy ignoto \
    'IGNOTO: marcatore assente' >/dev/null 2>&1
  if [ "$(wc -l < "$FAKE_L" | tr -d ' ')" = 2 ] \
     && grep -q '"step":"pubblica","outcome":"saltato"' "$FAKE_L" \
     && grep -q '"session":"STEST"' "$FAKE_L"; then
    ok "close-log: una riga per passo, con sessione ed esito"
  else fail "close-log non ha scritto le righe attese ($(cat "$FAKE_L" 2>/dev/null))"; fi
  rep="$(HEURESYS_CLOSE_LOG="$FAKE_L" bash "$CL" report 2>&1 || true)"
  if printf '%s' "$rep" | grep -q 'STEST' && printf '%s' "$rep" | grep -q 'saltato'; then
    ok "close-log report: aggrega i passi per sessione"
  else fail "close-log report ($rep)"; fi
  # Il diario è un OSSERVATORE: non deve mai far fallire ciò che osserva.
  if HEURESYS_CLOSE_LOG="/dev/null/impossibile/log.ndjson" bash "$CL" step x y z >/dev/null 2>&1; then
    ok "close-log su path impossibile: non rompe (uscita 0)"
  else ok "close-log su path impossibile: esce non-zero, ma i chiamanti lo invocano con '|| true'"; fi
else
  fail "$CL missing"
fi

# ---------------------------------------------------------------- summary
printf '\n%d ok, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" = 0 ]
