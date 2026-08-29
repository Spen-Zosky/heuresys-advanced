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
# La regex si carica DALLA FONTE (scripts/lib/deploy-paths.sh, S1069) invece di essere
# estratta a grep da align-clones: stesso principio di prima — nessuna copia nel test —
# ma ora la fonte e' una sola per tutti e quattro gli script che la usano.
RE_LINE=""
if ROOT="$(pwd)" . scripts/lib/deploy-paths.sh 2>/dev/null && [ -n "${DEPLOY_PATHS_RE:-}" ]; then RE_LINE="caricata"; fi
if [ -n "$RE_LINE" ]; then
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
  fail "DEPLOY_PATHS_RE non caricabile da scripts/lib/deploy-paths.sh"
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
#
# ⚠ AGGIORNATO IN S1084 (#236 F2). Il test cercava `ConnectTimeout=8` e `unreachable`
# dentro close-propagate.sh: erano nel blocco che lanciava il clone via ssh in primo
# piano, e quel blocco non c'e' piu' — l'atto e' passato a scripts/arma-clone.sh, che
# innesca l'unita' systemd del gemello con --no-block. La proprieta' non e' sparita, si
# e' spostata: qui si guarda dove vive ADESSO, invece di rimettere stringhe morte nel
# file solo per far tacere un grep. (La resilienza di arma-clone e' anche provata
# funzionalmente nella sezione G-bis, che e' la prova vera.)
if grep -q 'ConnectTimeout=8' "$ROOT/scripts/arma-clone.sh" \
   && grep -q 'non risponde' "$ROOT/scripts/arma-clone.sh" \
   && grep -q 'failed on a reachable host' "$CP"; then
  ok "resilience: unreachable→skip+warn (arma-clone), reachable-fail→fail-loud (die)"
else fail "resilience/fail-loud wiring missing"; fi
# F7: il clone si ARMA, non si aspetta — la riga che lo appendeva alla sessione non deve
#     tornare. E' il difetto di #236: un `ssh ... clone-vm-db.sh` in primo piano muore di
#     SIGHUP quando la sessione si chiude, a meta' ripristino del database.
#     I COMMENTI SI ESCLUDONO, e non e' un dettaglio: la testata del blocco cita la
#     riga vecchia per spiegare cosa e' cambiato, ed e' giusto che la citi. Un test che
#     non distingue il codice dal commento costringerebbe a cancellare la spiegazione
#     per far tacere un grep — cioe' a pagare la prova con la memoria del perche'.
if grep -vE '^[[:space:]]*#' "$CP" | grep -qE 'ssh[^|]*clone-vm-db\.sh'; then
  fail "close-propagate lancia ancora clone-vm-db.sh via ssh in primo piano (#236 F2)"
else ok "close-propagate arma il clone invece di appenderlo alla sessione (#236 F2)"; fi
if grep -q 'arma-clone.sh' "$CP"; then
  ok "close-propagate chiama arma-clone.sh"
else fail "close-propagate non chiama arma-clone.sh"; fi

# ------------------- G-bis. arma-clone.sh — l'armamento del clone (#236 F2, funzionale)
#
# Questi casi girano OVUNQUE, CI compresa: usano un host che non esiste, quindi non
# pretendono la LAN. I casi che richiedono il gemello vivo (unita' assente => fallito;
# innesco reale => preso in carico da systemd) sono provati a mano e documentati in
# .programmi/236-lavori-remoti-armati-non-appesi.md.
section "arma-clone.sh — armamento del clone (#236 F2)"
AC="scripts/arma-clone.sh"
if [ -f "$AC" ]; then
  # G1: host che non risponde => IGNOTO, e NON un verde. Esce 0 perche' un gemello
  #     spento non deve far fallire una chiusura sana, ma lo dichiara.
  out="$(CLONE_ARM_HOST=host-che-non-esiste-236 bash "$AC" --why test 2>&1)"; rc=$?
  if [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'IGNOTO'; then
    ok "arma-clone: host irraggiungibile => IGNOTO dichiarato, exit 0 (non fa cadere la chiusura)"
  else fail "arma-clone: host irraggiungibile — atteso IGNOTO+exit 0, avuto rc=$rc"; fi
  # G2: e IGNOTO non deve poter passare per «armato»
  if printf '%s' "$out" | grep -qi 'preso in carico'; then
    fail "arma-clone: un host morto NON puo' dire «preso in carico»"
  else ok "arma-clone: un host morto non si traveste da armato"; fi
  # G3: --dry-run non tocca niente e lo dice
  out="$(ARMA_CLONE_DRYRUN=1 bash "$AC" --why test 2>&1)"; rc=$?
  if [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'DRY-RUN'; then
    ok "arma-clone: --dry-run dichiara e non innesca"
  else fail "arma-clone: --dry-run rotto (rc=$rc)"; fi
  # G4: flag sconosciuto rifiutato prima di toccare qualunque host
  if bash "$AC" --flag-che-non-esiste >/dev/null 2>&1; then
    fail "arma-clone: un flag sconosciuto dovrebbe uscire non-zero"
  else ok "arma-clone: flag sconosciuto rifiutato"; fi
  # G5: `--no-block` E' il meccanismo. Senza, systemctl start ATTENDE il oneshot e si
  #     torna appesi all'ssh: e' la riga che fa esistere questa fase.
  if grep -q 'systemctl start --no-block' "$AC"; then
    ok "arma-clone: innesca con --no-block (il clone e' figlio di systemd, non dell'ssh)"
  else fail "arma-clone: manca --no-block — il clone resterebbe appeso alla sessione"; fi
  # G6: nessun apostrofo dentro un ${VAR:-default} — bash apre una stringa che inghiotte
  #     il resto del file, e uno `exit 1` smette di essere un comando. Costato un caso
  #     negativo verde in S1084, e arma-deploy.sh porta lo stesso avvertimento in testa.
  if grep -qE '\$\{[A-Za-z_]+:-[^}]*'"'"'[^}]*\}' "$AC"; then
    fail "arma-clone: apostrofo dentro un \${VAR:-default} — bash inghiotte il resto del file"
  else ok "arma-clone: nessun apostrofo dentro un \${VAR:-default}"; fi
else
  fail "arma-clone.sh assente (#236 F2)"
fi

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
  mkdir -p "$W/scripts" "$W/scripts/lib" "$W/pg_dump_snapshots"
  cp "$CG" "$DW" "$W/scripts/"
  # La libreria dei path e' importata dagli script sotto prova: senza, la sandbox
  # riproduce un repo che non esiste e il test fallisce per una ragione sua (S1069).
  cp scripts/lib/deploy-paths.sh "$W/scripts/lib/"
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

  # --- #212 GEMELLO: il deploy porta una FINESTRA, non un commit.
  #     Successo davvero il 2026-08-16: armato un commit di soli documenti (una sola corsa,
  #     verde), il rollout ha portato in produzione il codice del commit sotto, le cui tre
  #     corse erano ancora in volo. La produzione e' andata AVANTI rispetto al verificato.
  #     Serve una fixture PER-SHA: con un esito solo per tutti, il caso non e' esprimibile.
  cp "$CG" "$W/scripts/"                                   # ci-gate col seam a directory
  mkdir -p "$W/apps" "$W/docs" "$F/persha"
  echo codice > "$W/apps/x.ts"; git -C "$W" add -A >/dev/null; git -C "$W" commit -qm "codice"
  SHA_CODICE="$(git -C "$W" rev-parse HEAD)"
  echo testo > "$W/docs/y.md"; git -C "$W" add -A >/dev/null; git -C "$W" commit -qm "solo documenti"
  SHA_DOCS="$(git -C "$W" rev-parse HEAD)"
  git -C "$W" push -q origin HEAD:refs/heads/main
  git -C "$W" push -qf origin HEAD:refs/heads/prod         # ARMATO = il commit di documenti
  printf '%s\n' "$SHA1" > "$W/pg_dump_snapshots/LAST_GOOD_SHA"
  rm -f "$W/.deploy-watch-state"
  # I NOMI DEI WORKFLOW SONO VERI E DISTINTI, e non e' un dettaglio estetico (D-87, S1078).
  # Prima queste fixture usavano un generico "a" per lo sha armato E per l'intermedio: letta
  # alla lettera, quella coppia dice «il workflow a e' stato rosso su un albero vecchio e
  # verde su quello finale», che e' il caso D-87 — dove la risposta giusta e' DEPLOYA — non
  # il caso #212. Con un nome solo i due casi collassano e il test misura se' stesso.
  # Nella realta' del 2026-08-16 i workflow erano diversi: lo sha armato (solo docs/kb/) ebbe
  # la sola corsa «State lint», e le corse di codice stavano sul commit sotto.
  printf '%s' '{"workflow_runs":[{"name":"test-integration","status":"completed","conclusion":"failure"}]}' > "$F/ti_red.json"
  printf '%s' '{"workflow_runs":[{"name":"test-integration","status":"completed","conclusion":"success"}]}' > "$F/ti_green.json"
  printf '%s' '{"workflow_runs":[{"name":"test-integration","status":"in_progress","conclusion":null}]}'    > "$F/ti_pending.json"
  printf '%s' '{"workflow_runs":[{"name":"state-lint","status":"completed","conclusion":"success"}]}'       > "$F/sl_green.json"

  cp "$F/sl_green.json" "$F/persha/$SHA_DOCS.json"         # lo sha armato e' verde, ma su state-lint
  cp "$F/green.json"    "$F/persha/default.json"

  cp "$F/ti_pending.json" "$F/persha/$SHA_CODICE.json"     # ...ma il codice sotto e' in volo
  out="$(CI_GATE_FIXTURE="$F/persha" dw)"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'DENTRO la finestra' && ! printf '%s' "$out" | grep -q 'partirebbe'; } \
    && ok "#212 gemello: sha armato verde ma codice in volo DENTRO la finestra => non deploya" \
    || fail "#212 gemello PENDING intermedio ($rc: $out)"

  cp "$F/ti_red.json" "$F/persha/$SHA_CODICE.json"         # ...oppure rosso
  rm -f "$W/.deploy-watch-state"
  out="$(CI_GATE_FIXTURE="$F/persha" dw)"; rc=$?
  { [ "$rc" = 1 ] && printf '%s' "$out" | grep -q 'DENTRO la finestra'; } \
    && ok "#212 gemello: sha armato verde ma codice ROSSO nella finestra => esce 1, non deploya" \
    || fail "#212 gemello RED intermedio ($rc: $out)"

  cp "$F/ti_green.json" "$F/persha/$SHA_CODICE.json"       # tutta la finestra verde => si parte
  rm -f "$W/.deploy-watch-state"
  out="$(CI_GATE_FIXTURE="$F/persha" dw)"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'partirebbe'; } \
    && ok "#212 gemello: finestra intera verde => deploya (il controllo non blocca il caso sano)" \
    || fail "#212 gemello GREEN finestra ($rc: $out)"

  # --- D-87: UN ROSSO SUPERATO DA UNA CORREZIONE A VALLE NON BLOCCA PER SEMPRE.
  #     Misurato il 2026-08-21: fb486ad0 verde, be826657 verde, 5a26e610 verde, ma 61ea8b90
  #     — intermedio, rotto e GIA' CORRETTO dal commit successivo — rosso. La storia non si
  #     riscrive, quindi quel rosso resta per sempre: senza intervento manuale la produzione
  #     non sarebbe MAI avanzata. Il sorvegliante si e' fermato a ogni tick per un'ora.
  #
  #     Il criterio giusto non e' «ogni commit della finestra sia verde», e': la CI verifica
  #     l'ALBERO, non il diff — quindi per ogni workflow serve il verde sul commit PIU'
  #     RECENTE che quel workflow ha eseguito. Un rosso su un antenato e' irrilevante:
  #     quell'albero non va in produzione.
  #
  #     La differenza col caso #212 sta TUTTA nel nome del workflow: qui e' lo STESSO, prima
  #     rosso e poi verde; li' sono DIVERSI, e quello di codice non e' mai tornato verde.
  echo rotto > "$W/apps/z.ts";    git -C "$W" add -A >/dev/null; git -C "$W" commit -qm "codice rotto"
  SHA_ROTTO="$(git -C "$W" rev-parse HEAD)"
  echo corretto > "$W/apps/z.ts"; git -C "$W" add -A >/dev/null; git -C "$W" commit -qm "correzione a valle"
  SHA_FIX="$(git -C "$W" rev-parse HEAD)"
  git -C "$W" push -q origin HEAD:refs/heads/main
  git -C "$W" push -qf origin HEAD:refs/heads/prod          # ARMATO = la correzione
  printf '%s\n' "$SHA_DOCS" > "$W/pg_dump_snapshots/LAST_GOOD_SHA"
  rm -f "$W/.deploy-watch-state"
  cp "$F/ti_red.json"   "$F/persha/$SHA_ROTTO.json"         # l'intermedio e' rosso...
  cp "$F/ti_green.json" "$F/persha/$SHA_FIX.json"           # ...e lo STESSO workflow e' verde sopra
  out="$(CI_GATE_FIXTURE="$F/persha" dw)"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'partirebbe'; } \
    && ok "D-87: rosso intermedio SUPERATO dal verde dello stesso workflow a valle => deploya" \
    || fail "D-87 rosso superato ($rc: $out)"

  # --- e il gemello: anche un IN VOLO a monte e' superato da un verde a valle. Vale la
  #     stessa ragione — l'albero che va in produzione e' quello di ARMED, ed e' verificato —
  #     ma il difetto qui sarebbe piu' subdolo: non blocca «per sempre», blocca finche' una
  #     corsa vecchia non finisce, cioe' a volte per sempre lo stesso (una corsa cancellata
  #     resta in_progress). Senza questo caso, il PENDING resterebbe l'unico ramo in cui il
  #     criterio vecchio sopravvive di nascosto.
  rm -f "$W/.deploy-watch-state"
  cp "$F/ti_pending.json" "$F/persha/$SHA_ROTTO.json"
  out="$(CI_GATE_FIXTURE="$F/persha" dw)"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'partirebbe'; } \
    && ok "D-87: in volo a monte SUPERATO dal verde dello stesso workflow a valle => deploya" \
    || fail "D-87 in volo superato ($rc: $out)"
  rm -rf "$F"
else
  fail "$CG o $DW mancante"
fi

section "#217 I3 — il deploy non aspetta piu' la CI (e il rosso resta rosso)"
# IL DIFETTO CHE QUESTI TEST IMPEDISCONO. `deploy-watch.sh` e `vm-deploy.sh` facevano alla
# STESSA CI la STESSA domanda e si comportavano in modo opposto: il sorvegliante «riprovo al
# prossimo tick», exit 0; vm-deploy dormiva fino a 900s e poi `TIMEOUT ... deploy FAILED`.
# Il rischio della cura e' il suo opposto — trasformare un rosso in un verde — quindi i casi
# 2 e 4 valgono piu' del caso 1: se cadessero, la cura sarebbe peggiore del difetto.
VD=scripts/vm-deploy.sh; VDR=scripts/vm-deploy-remote.sh; CP=scripts/close-propagate.sh
if [ -f "$VD" ] && [ -f "$VDR" ] && [ -f "$CP" ]; then
  F="$(mktemp -d)"; R="$(pwd)"
  printf '%s' '{"workflow_runs":[{"name":"a","status":"in_progress","conclusion":null}]}'    > "$F/pending.json"
  printf '%s' '{"workflow_runs":[{"name":"a","status":"completed","conclusion":"success"}]}' > "$F/green.json"
  printf '%s' '{"workflow_runs":[{"name":"a","status":"completed","conclusion":"failure"}]}' > "$F/red.json"
  # CI_GATE_WAIT=0: un test non deve poter DORMIRE. Scoperto sabotando (S1070): togliendo il
  # default non bloccante il primo caso non falliva, entrava nel polling da 900s — e un test
  # che si blocca al posto di fallire nasconde il difetto invece di mostrarlo. Con lo zero,
  # lo stesso sabotaggio produce 1 invece di 10 e la sezione diventa rossa in un secondo.
  cg() { REPO_DIR="$R" CI_GATE_FIXTURE="$F/$1.json" CI_GATE_WAIT=0 bash "$VD" --check-gate deadbeef 2>&1; }

  out="$(cg pending)"; rc=$?
  { [ "$rc" = 10 ] && printf '%s' "$out" | grep -q 'non ho toccato niente'; } \
    && ok "vm-deploy: CI in volo => 10 (rimanda) e lo DICHIARA, invece di dormire 900s" \
    || fail "vm-deploy PENDING ($rc: $out)"

  out="$(cg red)"; rc=$?
  [ "$rc" = 1 ] && ok "vm-deploy: CI rossa => 1 (il non bloccante NON ammorbidisce il rosso)" \
                || fail "vm-deploy RED ($rc: $out)"

  out="$(cg green)"; rc=$?
  [ "$rc" = 0 ] && ok "vm-deploy: CI verde => 0 (procedi)" || fail "vm-deploy GREEN ($rc: $out)"

  # --deploy-now deve conservare il contratto vecchio: chi chiede di aspettare, aspetta.
  out="$(REPO_DIR="$R" CI_GATE_FIXTURE="$F/pending.json" CI_GATE_NONBLOCKING=0 CI_GATE_WAIT=0 \
         bash "$VD" --check-gate deadbeef 2>&1)"; rc=$?
  [ "$rc" = 1 ] && ok "vm-deploy: CI in volo + NONBLOCKING=0 => 1, non 10 (--deploy-now aspetta ancora)" \
                || fail "vm-deploy PENDING bloccante ($rc: $out)"

  # D-79, una variabile piu' tardi: la manopola deve ARRIVARE al remoto, o non esiste.
  out="$(CI_GATE_NONBLOCKING=0 bash "$VDR" --print-gate-env)"
  printf '%s' "$out" | grep -q 'CI_GATE_NONBLOCKING="0"' \
    && ok "vm-deploy-remote: inoltra CI_GATE_NONBLOCKING al gate REMOTO (era l'unica esclusa)" \
    || fail "vm-deploy-remote non inoltra la manopola ($out)"
  out="$(bash "$VDR" --print-gate-env)"
  printf '%s' "$out" | grep -q 'CI_GATE_NONBLOCKING' \
    && fail "vm-deploy-remote inoltra la manopola anche quando nessuno l'ha chiesta ($out)" \
    || ok "vm-deploy-remote: non inoltra nulla se il chiamante non ha chiesto niente"

  # La scelta si LEGGE dal piano di chiusura, non si presume.
  out="$(bash "$CP" --dry-run 2>&1)"
  printf '%s' "$out" | grep -q 'ci-gate-nonblocking=1' \
    && ok "close-propagate: la chiusura normale non aspetta la CI, e il piano lo dichiara" \
    || fail "close-propagate --dry-run non dichiara il gate ($out)"
  out="$(bash "$CP" --dry-run --deploy-now 2>&1)"
  printf '%s' "$out" | grep -q 'ci-gate-nonblocking=0' \
    && ok "close-propagate: --deploy-now chiede il sincrono, e il piano lo dichiara" \
    || fail "close-propagate --deploy-now non chiede il sincrono ($out)"
  rm -rf "$F"
else
  fail "$VD, $VDR o $CP mancante"
fi

section "#217 I4 — armare e' un atto solo, e chi deploya arma"
# IL DIFETTO CHE QUESTI TEST IMPEDISCONO, e ha morso il 2026-08-18: l'armamento viveva solo in
# close-propagate.sh, quindi chi lanciava align-clones direttamente portava il codice in
# produzione lasciando `refs/heads/prod` a un commit di IERI — e il sorvegliante legge PROPRIO
# quella ref. Il rischio della cura e' il suo opposto: armare quando non si doveva, o forzare
# una ref di produzione. I casi 3 e 5 valgono quanto il caso 1.
AD=scripts/arma-deploy.sh; AC=scripts/align-clones.sh
if [ -f "$AD" ] && [ -f "$AC" ]; then
  T="$(mktemp -d)"; B="$T/origin.git"; W="$T/box"
  git init -q --bare "$B"
  git init -q "$W"; git -C "$W" config user.email t@t; git -C "$W" config user.name t
  git -C "$W" config commit.gpgsign false
  mkdir -p "$W/scripts"; cp "$AD" "$W/scripts/"
  echo x > "$W/f"; git -C "$W" add -A >/dev/null; git -C "$W" commit -qm c1
  git -C "$W" remote add origin "$B"; git -C "$W" push -q origin HEAD:refs/heads/main
  SHA1="$(git -C "$W" rev-parse HEAD)"
  arma() { ( cd "$W" && bash scripts/arma-deploy.sh "$@" 2>&1 ); }

  out="$(arma)"; rc=$?
  { [ "$rc" = 0 ] && [ "$(git -C "$B" rev-parse refs/heads/prod 2>/dev/null)" = "$SHA1" ]; } \
    && ok "arma-deploy: ref assente => la spinge su HEAD (e' l'atto che mancava ad align-clones)" \
    || fail "arma-deploy primo armamento ($rc: $out)"

  out="$(arma)"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'niente da armare'; } \
    && ok "arma-deploy: gia' armato => idempotente, esce 0 (due catene possono chiamarlo)" \
    || fail "arma-deploy idempotenza ($rc: $out)"

  # La punta avanza; il dry-run deve DIRE e non fare.
  echo y >> "$W/f"; git -C "$W" commit -qam c2
  out="$(arma --dry-run)"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'DRY-RUN' \
    && [ "$(git -C "$B" rev-parse refs/heads/prod)" = "$SHA1" ]; } \
    && ok "arma-deploy: --dry-run dichiara e NON spinge (la ref resta dov'era)" \
    || fail "arma-deploy dry-run ($rc: $out)"

  # NON-FAST-FORWARD: prod portata su un ramo divergente. Non si forza MAI in automatico.
  git -C "$W" checkout -q -b divergente "$SHA1"
  echo z > "$W/g"; git -C "$W" add -A >/dev/null; git -C "$W" commit -qm divergente
  SHA_DIV="$(git -C "$W" rev-parse HEAD)"
  git -C "$W" push -qf origin HEAD:refs/heads/prod
  git -C "$W" checkout -q master 2>/dev/null || git -C "$W" checkout -q main
  out="$(arma)"; rc=$?
  { [ "$rc" = 1 ] && [ "$(git -C "$B" rev-parse refs/heads/prod)" = "$SHA_DIV" ]; } \
    && ok "arma-deploy: non-fast-forward => esce 1 e NON forza la ref di produzione" \
    || fail "arma-deploy non-fast-forward ($rc: $out — prod=$(git -C "$B" rev-parse --short refs/heads/prod))"
  rm -rf "$T"

  # L'INNESTO in align-clones. Controllo strutturale, ma costruito per essere falsificabile:
  # si ignorano le righe di commento (il difetto di #194 e' un grep che trova il proprio
  # commento) e si pretende che la chiamata stia DENTRO una guardia su DEPLOY=1.
  if awk '!/^[[:space:]]*#/ && /\[ "\$DEPLOY" = 1 \]/ {g=NR}
          !/^[[:space:]]*#/ && /arma-deploy\.sh/ {a=NR}
          END {exit !(g && a && g < a && a - g < 6)}' "$AC"; then
    ok "align-clones: chiama arma-deploy dentro la guardia DEPLOY=1 (chi deploya arma, chi no no)"
  else
    fail "align-clones: la chiamata ad arma-deploy manca o non e' guardata da DEPLOY=1"
  fi

  # UN ARMAMENTO, UNA RIGA DI DIARIO. E' il rumore che #217 vuole togliere dal rendiconto
  # (13 propaga, 19 deploy, 16 arma in una sola sessione). Qui si conta davvero, sul diario
  # vero, deviato nella sandbox con HEURESYS_CLOSE_LOG.
  T2="$(mktemp -d)"; B2="$T2/origin.git"; W2="$T2/box"
  git init -q --bare "$B2"
  git init -q "$W2"; git -C "$W2" config user.email t@t; git -C "$W2" config user.name t
  git -C "$W2" config commit.gpgsign false
  mkdir -p "$W2/scripts" "$W2/.handoff"; cp "$AD" scripts/close-log.sh "$W2/scripts/"
  echo x > "$W2/f"; git -C "$W2" add -A >/dev/null; git -C "$W2" commit -qm c1
  git -C "$W2" remote add origin "$B2"; git -C "$W2" push -q origin HEAD:refs/heads/main
  ( cd "$W2" && HEURESYS_CLOSE_LOG="$T2/diario.ndjson" bash scripts/arma-deploy.sh >/dev/null 2>&1 )
  n="$(grep -c '"arma"' "$T2/diario.ndjson" 2>/dev/null || echo 0)"
  [ "$n" = 1 ] && ok "arma-deploy: un armamento scrive ESATTAMENTE una riga di diario (contata, non dedotta)" \
                || fail "arma-deploy: righe 'arma' nel diario = $n (attesa 1)"
  rm -rf "$T2"

  # ...e close-propagate non deve aggiungerne una seconda. Il test guarda l'ACCOPPIAMENTO, non
  # la presenza di una parola: prende il nome della variabile dalla GUARDIA e pretende che
  # qualcuno lo assegni davvero. La prima stesura cercava la stringa 'arm_logged' e restava
  # VERDE anche rinominando l'assegnazione — cieca esattamente come il grep di #194.
  var="$(awk '!/^[[:space:]]*#/ && /close-log.sh" step arma/ {
                if (match($0, /\$\{[a-z_]+:-0\}/)) { print substr($0, RSTART+2, RLENGTH-6); exit } }' \
        scripts/close-propagate.sh)"
  if [ -n "$var" ] && grep -qE "^[[:space:]]*$var=1[[:space:]]*$" scripts/close-propagate.sh; then
    ok "close-propagate: la riga di diario e' guardata da \$$var, che un ramo assegna davvero"
  else
    fail "close-propagate: guardia della riga di diario assente o scollegata (var='$var')"
  fi
else
  fail "$AD o $AC mancante"
fi

section "#217 I5 — profili di chiusura: quali passi servono, e perche' gli altri no"
# IL DIFETTO: la chiusura era un rito completo. Una sessione di soli documenti pagava
# armamento, clone del database e lettura dalle macchine — passi che per lei non
# significano niente. Ma il rischio della cura e' PIU' GRANDE del difetto: saltare un
# passo che serviva. Per questo il caso 4 (la propagazione non si salta MAI) e il caso 5
# (non misurabile => si esegue) valgono piu' dei primi tre.
PC=scripts/profilo-chiusura.sh
if [ -f "$PC" ]; then
  T="$(mktemp -d)"; W="$T/box"
  git init -q "$W"; git -C "$W" config user.email t@t; git -C "$W" config user.name t
  git -C "$W" config commit.gpgsign false
  mkdir -p "$W/scripts/lib" "$W/docs/kb" "$W/apps/api/src" "$W/db/migrations"
  cp "$PC" "$W/scripts/"; cp scripts/lib/deploy-paths.sh "$W/scripts/lib/"
  echo base > "$W/README.md"; git -C "$W" add -A >/dev/null; git -C "$W" commit -qm base
  BASE="$(git -C "$W" rev-parse HEAD)"
  prof() { ( cd "$W" && bash scripts/profilo-chiusura.sh --eval --finestra "$1" 2>/dev/null ); }

  # 1. soli documenti
  echo testo > "$W/docs/kb/nota.md"; git -C "$W" add -A >/dev/null; git -C "$W" commit -qm docs
  out="$(prof "$BASE..HEAD")"
  { printf '%s' "$out" | grep -q '^PROFILO=documenti$' \
    && printf '%s' "$out" | grep -q '^PASSO_ARMA=salta$' \
    && printf '%s' "$out" | grep -q '^PASSO_CLONEDB=salta$' \
    && printf '%s' "$out" | grep -q '^PASSO_VERIFICA=salta$'; } \
    && ok "profilo: soli documenti => niente arma, niente clone-db, niente verifica-deploy" \
    || fail "profilo documenti ($out)"

  # 4. LA PROPAGAZIONE NON SI SALTA MAI — decisione di Enzo, ed e' il caso che protegge
  #    il linux-pc (gemello di produzione, runner CI, macchina della verifica lunga).
  printf '%s' "$out" | grep -q '^PASSO_PROPAGA=esegui$' \
    && ok "profilo: anche a soli documenti si PROPAGA (i cloni restano allineati sempre)" \
    || fail "profilo: la propagazione e' stata saltata — e' la decisione che non si tocca ($out)"

  # 5. atlante NON MISURABILE (nella sandbox lo strumento non c'e') => si esegue
  printf '%s' "$out" | grep -q '^PASSO_ATLANTE=esegui$' \
    && ok "profilo: atlante non misurabile => si rigenera (si degrada verso il lavoro in piu')" \
    || fail "profilo: atlante saltato senza averlo potuto misurare ($out)"

  # 6. la forzatura, che i test usano per non dipendere dallo stato vero del repo
  out2="$( cd "$W" && ATLANTE_FORZA=salta bash scripts/profilo-chiusura.sh --eval --finestra "$BASE..HEAD" 2>/dev/null )"
  printf '%s' "$out2" | grep -q '^PASSO_ATLANTE=salta$' \
    && ok "profilo: ATLANTE_FORZA scavalca la misura (seam dei test)" || fail "profilo ATLANTE_FORZA ($out2)"

  # 2. codice
  echo 'export const x = 1' > "$W/apps/api/src/x.ts"; git -C "$W" add -A >/dev/null; git -C "$W" commit -qm codice
  out="$(prof "$BASE..HEAD")"
  { printf '%s' "$out" | grep -q '^PROFILO=codice$' \
    && printf '%s' "$out" | grep -q '^PASSO_ARMA=esegui$' \
    && printf '%s' "$out" | grep -q '^PASSO_VERIFICA=esegui$' \
    && printf '%s' "$out" | grep -q '^PASSO_CLONEDB=salta$'; } \
    && ok "profilo: codice => arma e legge dalle macchine, ma NON rinfresca il clone del database" \
    || fail "profilo codice ($out)"

  # 3. codice+db
  echo 'select 1;' > "$W/db/migrations/000001_x.sql"; git -C "$W" add -A >/dev/null; git -C "$W" commit -qm db
  out="$(prof "$BASE..HEAD")"
  { printf '%s' "$out" | grep -q '^PROFILO=codice+db$' \
    && printf '%s' "$out" | grep -q '^PASSO_CLONEDB=esegui$'; } \
    && ok "profilo: codice+db => in piu' rinfresca il clone del gemello" || fail "profilo codice+db ($out)"

  # finestra vuota: nessun commit da portare in produzione
  out="$(prof "HEAD..HEAD")"
  printf '%s' "$out" | grep -q '^PROFILO=documenti$' \
    && ok "profilo: finestra vuota => documenti (non si arma il nulla)" || fail "profilo finestra vuota ($out)"
  rm -rf "$T"

  # Lo strumento che traduce la misura dell'atlante deve dire UNA delle tre parole, sempre —
  # e il codice d'uscita fa parte del contratto quanto la parola: 0=fresco 1=vecchio 2=indeciso.
  # ⚠ QUESTO CASO ERA VERDE SOLO NEL CASO FORTUNATO. Catturava l'output con `|| echo VUOTO`, che
  # aggiunge «VUOTO» ogni volta che l'uscita non e' zero — cioe' per DUE delle tre risposte
  # valide. In locale passava perche' qui l'atlante e' fresco (uscita 0); in CI, dove il
  # checkout e' shallow e la misura non e' possibile, lo strumento risponde correttamente
  # «indeciso» con uscita 2 e il test lo dichiarava rotto. Ora si verifica la COPPIA
  # parola↔codice, che e' piu' forte e non ha un caso fortunato.
  a="$(python docs/kb/tools/atlante_fresco.py 2>/dev/null)"; rc=$?
  case "$a:$rc" in
    fresco:0|vecchio:1|indeciso:2)
      ok "atlante_fresco.py: parola e codice d'uscita si corrispondono ($a/$rc)" ;;
    *) fail "atlante_fresco.py: fuori contratto — parola '$a' con uscita $rc" ;;
  esac
else
  fail "$PC mancante"
fi

section "#217 I6 — gli artefatti derivati entrano nel ciclo (e due, di proposito, no)"
# IL DIFETTO, misurato: cinque generatori esistevano e nessuno li chiamava. Rigenerando
# `concepts-corpus.jsonl` sono comparsi 6 concetti esistenti e ne sono spariti 4 di uno
# schema RITIRATO settimane prima: l'artefatto descriveva un progetto che non esiste piu'.
BD=docs/kb/tools/build_derivati.py
if [ -f "$BD" ]; then
  out="$(python "$BD" --controlla 2>&1)"; rc=$?
  case "$rc" in
    0|1|2) ok "build_derivati --controlla: esce con un codice del vocabolario chiuso ($rc)" ;;
    *)     fail "build_derivati --controlla: codice fuori vocabolario ($rc)" ;;
  esac
  n="$(printf '%s\n' "$out" | grep -cE '^\s+\[(OK|!!|\? )\]')"
  [ "$n" = 3 ] && ok "build_derivati: dichiara una riga per ciascuno dei 3 artefatti in-repo" \
                || fail "build_derivati: righe di esito = $n (attese 3) — $out"

  # IL FALSO VERDE CORRETTO ALLA PRIMA ESECUZIONE: con la radice sbagliata tutti i
  # generatori risultavano «assente» e la rigenerazione usciva 0, cioe' dichiarava fatto
  # un lavoro mai tentato. Un verde che non ha eseguito niente e' peggio di un rosso.
  V="$(mktemp -d)"
  out="$(DERIVATI_REPO="$V" python "$BD" 2>&1)"; rc=$?
  { [ "$rc" = 1 ] && printf '%s' "$out" | grep -q 'nessun generatore eseguito'; } \
    && ok "build_derivati: nessun generatore eseguito => esce 1 (mai un verde a vuoto)" \
    || fail "build_derivati radice vuota ($rc: $out)"
  rm -rf "$V"

  # I DUE CHE NON DEVONO ENTRARE. Scrivono in wiki-space, che esiste SOLO sulla macchina
  # Windows: metterli in chiusura la farebbe fallire su VM e linux-pc, dove gira davvero.
  if grep -qE 'build_(linked_manifest|graph_hub)' "$BD" | grep -v '^#' >/dev/null 2>&1; then
    fail "build_derivati: nomina un generatore che scrive fuori dal repo"
  fi
  if python - <<'PY'
import io, re, sys
s = io.open('docs/kb/tools/build_derivati.py', encoding='utf-8').read()
corpo = s.split('"""', 2)[2] if s.count('"""') >= 2 else s   # via la docstring, che li CITA
sys.exit(1 if re.search(r'ORDINE\s*=\s*\[[^\]]*(linked_manifest|graph_hub)', corpo) else 0)
PY
  then
    ok "build_derivati: i due generatori che scrivono in wiki-space restano FUORI dal ciclo"
  else
    fail "build_derivati: un generatore che scrive fuori dal repo e' entrato in ORDINE"
  fi

  # LA FRESCHEZZA DEVE POTER DIVENTARE ROSSA, e la prima versione non poteva diventare
  # VERDE: confrontava i timestamp dei commit, quindi un artefatto rigenerato con contenuto
  # identico (git non committa nulla) restava «superato» per sempre. Un allarme che non si
  # spegne facendo la cosa giusta e' il difetto di #194. Ora si registra il commit di
  # generazione, come fa l'atlante, e questi due casi lo verificano nei due versi.
  REG=docs/kb/atlas/derivati.json
  if [ -f "$REG" ]; then
    B="$(mktemp -d)"; cp "$REG" "$B/reg.json"

    mv "$REG" "$B/via.json"
    python "$BD" --controlla >/dev/null 2>&1
    [ "$?" = 2 ] && ok "build_derivati: senza registro dice NON MISURABILE (2), mai 'fresco'" \
                 || fail "build_derivati senza registro non ha dato 2"
    mv "$B/via.json" "$REG"

    cp "$B/reg.json" "$REG"; rm -rf "$B"

    # ── IL CASO «SUPERATO» SI PROVA SU UN REPO-FIXTURE, NON SULLA STORIA VERA ──────
    # Le due stesure precedenti guardavano la storia di QUESTO repo — prima `HEAD~6`, poi
    # il padre dell'ultimo commit che tocca `atlas.yaml` — e sono cadute entrambe:
    #   · `HEAD~6` presumeva che sei commit fa ci fosse una modifica alle fonti, e la
    #     presunzione e' scaduta al primo commit successivo (rosso il 2026-08-18);
    #   · la derivazione dal path e' rossa **in CI**, dove il checkout e' `fetch-depth: 1`:
    #     `git log -- <path>` vede solo HEAD e `HEAD^` non esiste, quindi il registro
    #     riceve un valore vuoto e lo strumento risponde «cieco» (2) invece di
    #     «superato» (1). E' la trappola gia' registrata come
    #     `ci_shallow_checkout_git_history`: un test che CERCA un commit nella storia e'
    #     rosso in CI, e la cura e' costruirsi la storia che gli serve.
    # Qui la storia se la fa il test: due commit, il secondo tocca la fonte. Deterministico
    # su Windows, su Linux, con o senza `--depth 1`.
    S="$(mktemp -d)"; A="$S/repo"
    mkdir -p "$A/docs/kb/atlas" "$A/docs/architecture/adr" "$A/docs/kb/tools"
    git init -q "$A"; git -C "$A" config user.email t@t; git -C "$A" config user.name t
    git -C "$A" config commit.gpgsign false
    cp "$BD" "$A/docs/kb/tools/"
    printf 'meta:\n  generated_from_commit: x\n' > "$A/docs/kb/atlas/atlas.yaml"
    printf '{}\n'  > "$A/docs/kb/atlas/agent-operations.json"
    printf '\n'    > "$A/docs/kb/atlas/concepts-corpus.jsonl"
    printf '# adr\n' > "$A/docs/architecture/ADR_INDEX.md"
    git -C "$A" add -A >/dev/null; git -C "$A" commit -qm base
    BASE_SHA="$(git -C "$A" rev-parse HEAD)"
    printf 'meta:\n  generated_from_commit: y\nnuovo: 1\n' > "$A/docs/kb/atlas/atlas.yaml"
    git -C "$A" add -A >/dev/null; git -C "$A" commit -qm "tocca la fonte"
    printf '{\n  "generato_da_commit": "%s"\n}\n' "$BASE_SHA" > "$A/docs/kb/atlas/derivati.json"

    out="$(DERIVATI_REPO="$A" python "$BD" --controlla 2>&1)"; rc=$?
    { [ "$rc" = 1 ] && printf '%s' "$out" | grep -q 'SUPERATO'; } \
      && ok "build_derivati: fonti cambiate dopo il commit registrato => SUPERATO (1)" \
      || fail "build_derivati con registro vecchio non ha visto il superamento ($rc: $out)"

    # E il verso opposto, sullo stesso fixture: registro allineato a HEAD => fresco.
    printf '{\n  "generato_da_commit": "%s"\n}\n' "$(git -C "$A" rev-parse HEAD)" \
      > "$A/docs/kb/atlas/derivati.json"
    out="$(DERIVATI_REPO="$A" python "$BD" --controlla 2>&1)"; rc=$?
    { [ "$rc" = 0 ] && ! printf '%s' "$out" | grep -q 'SUPERATO'; } \
      && ok "build_derivati: registro allineato a HEAD => fresco (0), sullo stesso fixture" \
      || fail "build_derivati fixture allineato ($rc: $out)"
    rm -rf "$S"
  else
    fail "build_derivati: manca $REG — nessuna generazione registrata"
  fi

  # E il boot deve guardarlo, altrimenti la misura esiste e nessuno la legge.
  grep -q 'build_derivati' docs/kb/tools/status_dashboard.py \
    && ok "status_dashboard: lo staleness self-check interroga gli artefatti derivati" \
    || fail "status_dashboard: nessuno guarda la freschezza dei derivati"
else
  fail "$BD mancante"
fi

section "#217 I7 — un rosso della CI e' nostro o di GitHub?"
# LA MISURA CHE HA DECISO L'INTERVENTO: il 429 e' reale (2026-08-17, cinque workflow morti
# insieme sul download di actions/checkout) ma e' accaduto UNA volta su 40 corse, e il runner
# ritenta gia' tre volte da se'. Quindi il 429 NON si cura — si cura il costo vero, cioe'
# l'indagine a mano per capire che il rosso non era nostro.
# IL RISCHIO DI QUESTO STRUMENTO E' ASSOLVERE UN ROSSO VERO: il caso 2 vale piu' del caso 1.
CR=scripts/ci-rosso-di-chi.sh
if [ -f "$CR" ]; then
  F="$(mktemp -d)"
  printf '##[error]Response status code does not indicate success: 429 (Too Many Requests).\n' > "$F/solo429.log"
  printf 'test-integration\tRun vitest\t##[error]Process completed with exit code 1.\n' > "$F/progetto.log"
  printf '##[error]Error: connect ETIMEDOUT — un errore che NON e0 una firma nota\n' > "$F/ignoto.log"

  # Il 429 da solo. E' il caso che smaschera la firma cieca: nella prima stesura il pattern
  # `429 (Too Many Requests)` aveva le parentesi NON protette, quindi in regex estesa era un
  # gruppo e non combaciava con la stringa vera. Il caso reale del 17 fu riconosciuto solo
  # grazie alle altre due firme — cioe' per fortuna.
  out="$(CI_LOG_FIXTURE="$F/solo429.log" bash "$CR" 2>&1)"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q '^INFRASTRUTTURA' \
    && printf '%s' "$out" | grep -q '429 (Too Many Requests)'; } \
    && ok "ci-rosso-di-chi: il 429 da solo => INFRASTRUTTURA (la firma aggancia davvero)" \
    || fail "ci-rosso-di-chi 429 ($rc: $out)"

  # IL CASO CHE PROTEGGE: un rosso vero non si assolve.
  out="$(CI_LOG_FIXTURE="$F/progetto.log" bash "$CR" 2>&1)"; rc=$?
  { [ "$rc" = 1 ] && printf '%s' "$out" | grep -q '^PROGETTO'; } \
    && ok "ci-rosso-di-chi: un rosso dei test resta PROGETTO (1) — non si auto-assolve" \
    || fail "ci-rosso-di-chi progetto ($rc: $out)"

  # Un errore che non e' una firma nota NON diventa infrastruttura per somiglianza.
  out="$(CI_LOG_FIXTURE="$F/ignoto.log" bash "$CR" 2>&1)"; rc=$?
  { [ "$rc" = 1 ] && printf '%s' "$out" | grep -q '^PROGETTO'; } \
    && ok "ci-rosso-di-chi: un errore fuori dalle firme note resta PROGETTO (elenco stretto)" \
    || fail "ci-rosso-di-chi errore ignoto ($rc: $out)"

  out="$(CI_LOG_FIXTURE="$F/non-esiste.log" bash "$CR" 2>&1)"; rc=$?
  { [ "$rc" = 2 ] && printf '%s' "$out" | grep -q '^NON-VERIFICATO'; } \
    && ok "ci-rosso-di-chi: log illeggibile => NON-VERIFICATO (2), che non e' 'a posto'" \
    || fail "ci-rosso-di-chi fixture assente ($rc: $out)"
  rm -rf "$F"
else
  fail "$CR mancante"
fi

section "#217 I8 — il rendiconto delle chiusure viene letto dal boot"
# IL DIFETTO: 269 record scritti con cura da tre script, e NESSUNO che li guardasse. La
# misura che ha fatto nascere #217 veniva proprio da li', ricavata a mano una volta sola.
# ⚠ Il vincolo che questi test difendono: MOSTRA, NON DECIDE. Nessun exit code blocca
# niente, e un diario assente non puo' produrre un verde.
RC=docs/kb/tools/rendiconto_chiusure.py
if [ -f "$RC" ]; then
  D="$(mktemp -d)"

  # Una chiusura serena: tutti i passi eseguiti o saltati.
  cat > "$D/serena.ndjson" <<'EOF'
{"ts":"2026-08-01T10:00:00+0200","session":"S900","run":"r1","step":"deploy","outcome":"saltato","why":"x"}
{"ts":"2026-08-01T10:01:00+0200","session":"S900","run":"r1","step":"propaga","outcome":"eseguito","why":"x"}
EOF
  out="$(HEURESYS_CLOSE_LOG="$D/serena.ndjson" python "$RC" --boot 2>&1)"
  { printf '%s' "$out" | grep -q '^OK' && printf '%s' "$out" | grep -q 'tutti sereni'; } \
    && ok "rendiconto: chiusura senza guasti => OK" || fail "rendiconto serena ($out)"

  # Un passo fallito DEVE emergere: e' la prima cosa da sapere aprendo una sessione.
  cat > "$D/guasta.ndjson" <<'EOF'
{"ts":"2026-08-02T10:00:00+0200","session":"S901","run":"r2","step":"propaga","outcome":"eseguito","why":"x"}
{"ts":"2026-08-02T10:01:00+0200","session":"S901","run":"r2","step":"clone-db","outcome":"ignoto","why":"x"}
{"ts":"2026-08-02T10:02:00+0200","session":"S901","run":"r2","step":"verifica-deploy","outcome":"fallito","why":"x"}
EOF
  out="$(HEURESYS_CLOSE_LOG="$D/guasta.ndjson" python "$RC" --boot 2>&1)"
  { printf '%s' "$out" | grep -q '^BAD' && printf '%s' "$out" | grep -q 'clone-db:ignoto' \
    && printf '%s' "$out" | grep -q 'verifica-deploy:fallito'; } \
    && ok "rendiconto: passi ignoti/falliti emergono NOMINATI, non contati e basta" \
    || fail "rendiconto guasta ($out)"

  # Diario assente => UNK. Mai un verde dal buio: un «tutto bene» nato dal nulla e'
  # indistinguibile da uno nato da una misura, ed e' la peggiore delle risposte.
  out="$(HEURESYS_CLOSE_LOG="$D/non-esiste.ndjson" python "$RC" --boot 2>&1)"
  { printf '%s' "$out" | grep -q '^UNK'; } \
    && ok "rendiconto: diario assente => UNK, mai OK (nessun verde dal buio)" \
    || fail "rendiconto diario assente ($out)"

  # Le corse da un passo solo NON sono chiusure: contarle falserebbe proprio il numero
  # che #217 vuole veder scendere. (Nel diario vero ce ne sono, lasciate dalle prove.)
  cat > "$D/orfane.ndjson" <<'EOF'
{"ts":"2026-08-03T10:00:00+0200","session":"S902","run":"o1","step":"deploy","outcome":"eseguito","why":"a mano"}
{"ts":"2026-08-03T11:00:00+0200","session":"S902","run":"o2","step":"arma","outcome":"eseguito","why":"a mano"}
EOF
  out="$(HEURESYS_CLOSE_LOG="$D/orfane.ndjson" python "$RC" --boot 2>&1)"
  { printf '%s' "$out" | grep -q '^UNK'; } \
    && ok "rendiconto: corse da un passo non sono chiusure (il conteggio resta vero)" \
    || fail "rendiconto orfane ($out)"

  # E il boot deve guardarlo, altrimenti I8 non e' fatta.
  grep -q 'rendiconto_chiusure' docs/kb/tools/status_dashboard.py \
    && ok "status_dashboard: il boot legge il rendiconto delle chiusure" \
    || fail "status_dashboard: nessuno legge il rendiconto"
  rm -rf "$D"
else
  fail "$RC mancante"
fi

section "S1069 — il marcatore di sessione NON si consuma"
# IL DIFETTO CHE QUESTO TEST IMPEDISCE. `align-clones.sh` cancellava `.session-align.marker`
# a fine corsa. La SECONDA propagazione della stessa sessione lo trovava sparito e cadeva in
# IGNOTO: nel rendiconto sono 12 `clone-db ignoto` e 6 `arma ignoto` — passi saltati non
# perche' inutili, ma perche' lo stato che li governava era stato distrutto.
_MKD="$(mktemp -d)"; _MK="$_MKD/marker"; echo deadbeef > "$_MK"
# (1) funzionale: l'epilogo dello script sono le sue ultime righe. Si eseguono con un
#     marcatore finto e si guarda se sopravvive.
# ⚠ NON `tail -8`: era la forma precedente, ed e' diventata CIECA il 2026-08-18. Aggiungere
# in fondo allo script il blocco di armamento (#217 I4) ha spostato l'epilogo del marcatore
# fuori dalle ultime 8 righe: il test restava VERDE perche' nulla toccava il marcatore, ma
# non provava piu' niente — se qualcuno avesse rimesso l'`rm`, non se ne sarebbe accorto.
# E' la TERZA volta che la prova di I2 nasce falsa. Qui il blocco si estrae per ANCORA
# semantica, e se l'ancora sparisce il test lo dichiara invece di misurare il vuoto.
_EPI="$(sed -n '/IL MARCATORE NON SI CONSUMA/,$p' scripts/align-clones.sh)"
if ! printf '%s' "$_EPI" | grep -q 'marcatore lasciato'; then
  fail "l'epilogo del marcatore non e' piu' estraibile dall'ancora — il test misurerebbe il vuoto"
fi
( set +eu; DELTA=1; HAVE_MARKER=1; MARKER="$_MK"; SKIPPED=""; DEPLOY=0; DEPLOY_WHY=""
  SCRIPTS=/dev/null/inesistente
  log() { :; }; warn() { :; }; eval "$_EPI" ) >/dev/null 2>&1 || true
if [ -f "$_MK" ]; then
  ok "il marcatore sopravvive all'epilogo — la seconda corsa misura invece di cadere in IGNOTO"
else
  fail "il marcatore e' stato consumato: la seconda propagazione della sessione tornera' IGNOTO"
fi
rm -rf "$_MKD"
# (2) testuale: nessuna forma di cancellazione del marcatore, comunque scritta.
# I COMMENTI NON CONTANO, e ignorarlo e' costato un rosso: la spiegazione di cio' che e' stato
# tolto CITA la riga tolta, quindi il primo pattern trovava se' stesso — lo stesso difetto di
# #194 e del grep di #198 T4, incontrato per la terza volta. Si guardano solo le righe di codice.
if grep -vE '^[[:space:]]*#' scripts/align-clones.sh | grep -qE 'rm\b[^|;]*\$MARKER'; then
  fail "align-clones cancella ancora il marcatore (una riga rm lo colpisce)"
else
  ok "nessun rm nel sorgente colpisce il marcatore"
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
  # Il criterio non e' piu' «le due righe coincidono» ma «esiste UNA SOLA fonte» (S1069):
  # e' piu' forte, perche' due righe uguali oggi possono divergere domani, mentre quattro
  # import dello stesso file non possono. Si verifica in due modi che si sorreggono a vicenda:
  # nessuno script porta una definizione propria, e il valore si carica davvero.
  _copie="$(grep -l "^\(ARM\|DEPLOY\)_PATHS_RE='\^(apps" scripts/align-clones.sh \
             scripts/close-propagate.sh scripts/deploy-watch.sh scripts/verifica-deploy.sh 2>/dev/null | wc -l)"
  if [ "$_copie" -eq 0 ]; then
    ok "path di deploy: nessuna copia locale nei quattro script — una sola fonte"
  else fail "$_copie script definiscono ancora una copia locale dei path di deploy"; fi

  ARM_LINE=""
  if ROOT="$(pwd)" . scripts/lib/deploy-paths.sh 2>/dev/null && [ -n "${DEPLOY_PATHS_RE:-}" ]; then
    ARM_PATHS_RE="$DEPLOY_PATHS_RE"; ARM_LINE="caricata"
    ok "path di deploy: la libreria si carica e definisce il predicato"
  else fail "scripts/lib/deploy-paths.sh non definisce DEPLOY_PATHS_RE"; fi

  if [ -n "$ARM_LINE" ]; then
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

  # --- #212: la SECONDA corsa nella stessa sessione. La prima consuma il marcatore, e prima
  #     di S1067 la seconda cadeva in IGNOTO e non armava: la chiusura diceva «propagato»
  #     mentre refs/heads/prod restava indietro (successo DUE volte in S1066). Ora, senza
  #     marcatore, la finestra si ri-deriva da `origin/prod..HEAD`.
  #     FIXTURE GIT DETERMINISTICA, non la storia di questo repo: qui serve una storia vera
  #     (la finestra e' fatta di commit), e su un checkout shallow della CI la storia non c'e'.
  P="$(mktemp -d)"; PB="$P/origin.git"; PW="$P/box"
  git init -q --bare "$PB"
  git init -q "$PW"
  git -C "$PW" config user.email t@t; git -C "$PW" config user.name t
  git -C "$PW" config commit.gpgsign false
  mkdir -p "$PW/scripts" "$PW/scripts/lib" "$PW/docs"
  cp "$CP" "$PW/scripts/"
  cp scripts/lib/deploy-paths.sh "$PW/scripts/lib/"   # lo script importa la sua libreria accanto a se' (S1069)
  echo base > "$PW/docs/a.md"; git -C "$PW" add -A >/dev/null; git -C "$PW" commit -qm base
  git -C "$PW" remote add origin "$PB"
  git -C "$PW" push -q origin HEAD:refs/heads/prod       # la produzione parte da qui
  cpplan() { ( cd "$PW" && HEURESYS_MARKER="$P/assente" CLOSE_PROPAGATE_DRYRUN=1 \
                bash scripts/close-propagate.sh "$@" 2>/dev/null | grep '^PLAN arm' ); }

  # (a) niente di nuovo dopo la produzione: misura, e non arma
  p="$(cpplan --delta --auto-deploy)"
  printf '%s' "$p" | grep -q "arm=no" && printf '%s' "$p" | grep -q "gia' su HEAD" \
    && ok "#212: marcatore assente + origin/prod == HEAD => misura «niente da armare», non IGNOTO" \
    || fail "#212 (a): atteso arm=no + «gia' su HEAD» ($p)"

  # (b) commit di SOLI DOCUMENTI sopra la produzione: misura, e non arma
  echo piu > "$PW/docs/a.md"; git -C "$PW" commit -qam docs
  p="$(cpplan --delta --auto-deploy)"
  { printf '%s' "$p" | grep -q "arm=no" && printf '%s' "$p" | grep -q "nessuno su path di deploy"; } \
    && ok "#212: marcatore assente + finestra di soli documenti => non arma, ma per MISURA" \
    || fail "#212 (b): atteso arm=no misurato ($p)"

  # (c) commit su path di deploy: DEVE armare — e' il caso che prima restava indietro in silenzio
  echo x > "$PW/scripts/nuovo.sh"; git -C "$PW" add -A >/dev/null; git -C "$PW" commit -qm codice
  p="$(cpplan --delta --auto-deploy)"
  { printf '%s' "$p" | grep -q "arm=arma" && printf '%s' "$p" | grep -q "ri-derivato"; } \
    && ok "#212: marcatore assente + finestra che tocca path di deploy => ARMA (era il difetto)" \
    || fail "#212 (c): atteso arm=arma ri-derivato ($p)"

  # (d) e sa ancora dire IGNOTO quando non esiste NESSUNA finestra: senza questo, la correzione
  #     avrebbe semplicemente spento la dottrina del dubbio invece di darle una misura.
  p="$( cd "$PW" && HEURESYS_MARKER="$P/assente" DEPLOY_ARM_REF=refchenonesiste \
        CLOSE_PROPAGATE_DRYRUN=1 bash scripts/close-propagate.sh --delta --auto-deploy 2>/dev/null | grep '^PLAN arm' )"
  { printf '%s' "$p" | grep -q "arm=no" && printf '%s' "$p" | grep -q "IGNOTO"; } \
    && ok "#212: nessuna finestra misurabile => IGNOTO e non arma (il dubbio non e' stato spento)" \
    || fail "#212 (d): atteso IGNOTO ($p)"
  rm -rf "$P"

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
RE_LINE2=""
if ROOT="$(pwd)" . scripts/lib/deploy-paths.sh 2>/dev/null && [ -n "${DEPLOY_PATHS_RE:-}" ]; then
  RE_LINE2="DEPLOY_PATHS_RE='$DEPLOY_PATHS_RE'"   # forma valutabile dentro la subshell di decide()
fi
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
  # #148 — DUE CHIUSURE DEVONO RESTARE DISTINTE. Fino al 2026-08-12 il report
  # raggruppava per sessione e 84 righe su 96 portavano "S?": cinque giorni di
  # chiusure finivano in un blocco unico, e la domanda per cui il diario esiste
  # («quante chiusure sono ripetizioni inutili?») restava non misurabile.
  FAKE_R="$T/fake-close-run.ndjson"
  HEURESYS_CLOSE_LOG="$FAKE_R" HEURESYS_CLOSE_RUN=RUN-UNO bash "$CL" step registra eseguito 'a' >/dev/null 2>&1
  HEURESYS_CLOSE_LOG="$FAKE_R" HEURESYS_CLOSE_RUN=RUN-DUE bash "$CL" step registra eseguito 'b' >/dev/null 2>&1
  rep2="$(HEURESYS_CLOSE_LOG="$FAKE_R" bash "$CL" report 2>&1 || true)"
  if printf '%s' "$rep2" | grep -q 'RUN-UNO' && printf '%s' "$rep2" | grep -q 'RUN-DUE'; then
    ok "close-log: due corse di chiusura restano blocchi distinti (#148)"
  else fail "close-log: le due corse si sono fuse in un blocco solo ($rep2)"; fi

  # Le righe scritte PRIMA di #148 non hanno `run`: devono degradare alla
  # sessione, non sparire dal rendiconto.
  printf '{"ts":"2026-08-01T10:00:00+0200","session":"SVECCHIA","host":"x","head":"a","step":"propaga","outcome":"eseguito","why":"storica"}
' >> "$FAKE_R"
  rep3="$(HEURESYS_CLOSE_LOG="$FAKE_R" bash "$CL" report 2>&1 || true)"
  if printf '%s' "$rep3" | grep -q 'SVECCHIA'; then
    ok "close-log: le righe senza corsa degradano alla sessione invece di sparire"
  else fail "close-log: una riga storica e' sparita dal rendiconto ($rep3)"; fi

  # #191 — LA SESSIONE, non piu' un segnaposto. Quattro prove: le tre fonti in ordine di
  # precedenza, e — la piu' importante — il caso in cui NESSUNA sa rispondere, che deve
  # restare raggiungibile. Se `S?` diventasse irraggiungibile, queste prove non potrebbero
  # piu' fallire e non sarebbero piu' prove (metodo di bonifica §5).
  SID="$T/fake-session-id"
  printf 'S9999\n' > "$SID"
  if [ "$(HEURESYS_SESSION=SENV HEURESYS_SESSION_FILE="$SID" bash "$CL" sessione)" = "SENV" ]; then
    ok "sessione: l'env di chi orchestra la chiusura vince su tutto"
  else fail "sessione: HEURESYS_SESSION non ha la precedenza"; fi
  if [ "$(HEURESYS_SESSION_FILE="$SID" bash "$CL" sessione)" = "S9999" ]; then
    ok "sessione: il file depositato dal boot vince sul ripiego git"
  else fail "sessione: .handoff/session-id ignorato"; fi
  : > "$T/sid-vuoto"
  # L'invariante del ripiego: una sessione IN CORSO viene DOPO l'ultima chiusa — `>`, non `>=`.
  # La prima versione chiedeva solo «assomiglia a S1234», e infatti non si accorse che il
  # ripiego era regredito da S1064 a S1063 nel momento stesso in cui veniva scritto (il commit
  # che lo descriveva conteneva «handoff S<N>» nel corpo, e `git log --grep` guarda anche li').
  #
  # ⚠ E LA SECONDA VERSIONE ERA VERDE QUI E ROSSA IN CI, per la ragione gia' registrata:
  # **la CI fa un checkout SHALLOW e la storia non c'e'**. Interrogare `git log` del repo vero
  # rende la prova dipendente da quanta storia e' stata scaricata — cioe' non e' piu' una prova
  # del codice. Si costruisce quindi la storia che serve, in una fixture: due commit, uno dei
  # quali e' un handoff, e uno STATE che dichiara la stessa sessione. Cosi' l'invariante e'
  # verificabile ovunque, anche con `git clone --depth 1`.
  FIXS="$T/fixture-sessione"
  rm -rf "$FIXS"; mkdir -p "$FIXS/.handoff"
  ( cd "$FIXS" && git init -q . && git config user.email t@t && git config user.name t \
    && echo a > a.txt && git add a.txt && git commit -qm "chore: handoff S900" \
    && printf '**Updated**: (S900)\n' > .handoff/STATE.md \
    && git add -A && git commit -qm "docs: qualcosa dopo l'handoff" ) >/dev/null 2>&1
  sess_ripiego="$( cd "$FIXS" && HEURESYS_SESSION_FILE="$FIXS/assente" bash "$ROOT/$CL" sessione )"
  if [ "$sess_ripiego" = "S901" ]; then
    ok "sessione: il ripiego viene DOPO l'ultima chiusura (handoff S900 ⟹ S901)"
  else fail "sessione: ripiego '$sess_ripiego' invece di S901 (handoff S900 in storia)"; fi

  # E il caso simmetrico: se l'handoff di QUESTA sessione e' gia' scritto nello STATE ma non
  # ancora committato, il ripiego deve dire quello, non il successivo.
  ( cd "$FIXS" && printf '**Updated**: (S901)\n' > .handoff/STATE.md ) 2>/dev/null
  sess_scritto="$( cd "$FIXS" && HEURESYS_SESSION_FILE="$FIXS/assente" bash "$ROOT/$CL" sessione )"
  if [ "$sess_scritto" = "S901" ]; then
    ok "sessione: STATE piu' avanti dell'ultimo handoff committato ⟹ vince STATE"
  else fail "sessione: con STATE a S901 il ripiego dice '$sess_scritto'"; fi
  # NEGATIVA: repo senza alcun commit 'handoff S<N>' e senza STATE.md. Deve dichiarare di non
  # sapere. Un numero inventato qui sarebbe peggio del segnaposto che #191 sta togliendo.
  NOSTORIA="$T/nostoria"
  rm -rf "$NOSTORIA"; mkdir -p "$NOSTORIA"
  ( cd "$NOSTORIA" && git init -q . && git config user.email t@t && git config user.name t \
    && echo x > a.txt && git add a.txt && git commit -qm "nessun handoff qui" ) >/dev/null 2>&1
  sess_muta="$( cd "$NOSTORIA" && HEURESYS_SESSION_FILE="$NOSTORIA/assente" bash "$ROOT/$CL" sessione )"
  if [ "$sess_muta" = "S?" ]; then
    ok "sessione: senza handoff e senza STATE dichiara S?, non inventa un numero"
  else fail "sessione: ha inventato '$sess_muta' dove non poteva sapere"; fi

  # S1064 — il diario di sessione e la COMPATTAZIONE. Le prove girano dentro una fixture git,
  # mai sul diario reale: un test che scrive nel diario vero mette una compattazione finta
  # davanti a chi legge la chiusura, ed e' la stessa contaminazione che HEURESYS_CLOSE_LOG
  # evita per il rendiconto.
  PCJ="scripts/hooks/precompact-journal.sh"
  if [ -f "$PCJ" ]; then
    FIXJ="$T/fix-journal"
    rm -rf "$FIXJ"; mkdir -p "$FIXJ"
    ( cd "$FIXJ" && git init -q . && git config user.email t@t && git config user.name t \
      && echo x > a.txt && git add a.txt && git commit -qm "base" ) >/dev/null 2>&1
    ( cd "$FIXJ" && sh "$ROOT/$PCJ" ) >/dev/null 2>&1
    JLINE="$(head -n1 "$FIXJ/.handoff/session-journal.ndjson" 2>/dev/null || true)"
    # La forma si verifica QUI, senza interprete: una batteria di shell che chiama `python`
    # smette di misurare il proprio bersaglio dove python non c'e' — e diventa rossa per la
    # ragione sbagliata (misurato su un clone usa-e-getta il 2026-08-16).
    if printf '%s' "$JLINE" | grep -q '"ref":"compattazione"' \
       && printf '%s' "$JLINE" | grep -qE '^\{.*"ts":"[0-9T:Z-]+".*"kind":"note".*"note":"[^"]+"\}$'; then
      ok "precompact: deposita una riga JSON valida di compattazione"
    else fail "precompact: riga assente o non JSON ($JLINE)"; fi
    # NEGATIVA/robustezza: fuori da un repo git non ha dove scrivere. Deve tacere e uscire 0 —
    # un hook che fa fallire la compattazione e' peggio del difetto che sorveglia.
    NOGIT="$T/senza-git"; rm -rf "$NOGIT"; mkdir -p "$NOGIT"
    if ( cd "$NOGIT" && sh "$ROOT/$PCJ" >/dev/null 2>&1 ); then
      ok "precompact: fuori da un repo git esce 0 senza rompere la compattazione"
    else fail "precompact: ha fatto fallire cio' che osserva (uscita non-zero fuori da git)"; fi
  else fail "$PCJ manca"; fi

  # Il diario è un OSSERVATORE: non deve mai far fallire ciò che osserva.
  if HEURESYS_CLOSE_LOG="/dev/null/impossibile/log.ndjson" bash "$CL" step x y z >/dev/null 2>&1; then
    ok "close-log su path impossibile: non rompe (uscita 0)"
  else ok "close-log su path impossibile: esce non-zero, ma i chiamanti lo invocano con '|| true'"; fi
else
  fail "$CL missing"
fi

# ------------------------------------------------- Z. le batterie del loop zero-pending
#
# ── D-86: le guardie di clone-vm-db.sh, esercitate davvero ───────────────────────
# Questo script DECIDE SE DROPPARE DEGLI SCHEMI, e fino a S1078 la batteria lo copriva
# con `bash -n` e basta: si sapeva che era sintassi valida e NIENTE su cosa decide.
# Le sue guardie sono i rami che in produzione non si percorrono mai — quindi quelli
# che nessuno vede fallire finche' non servono. Le asserzioni che contano di piu' non
# sono su cosa fa, ma su cosa NON fa: la traccia registra ogni comando, e si pretende
# che in caso di dubbio il `DROP SCHEMA` NON compaia.
section "D-86 — clone-vm-db: le guardie decidono, e si vedono decidere"
CVD=scripts/clone-vm-db.sh; STUB=scripts/test/finti-comandi-clone-vm-db.sh
if [ -f "$CVD" ] && [ -f "$STUB" ]; then
  T="$(mktemp -d)"
  # ENV_FILE su un file inesistente: senza, lo script leggerebbe il .env VERO e la
  # prova misurerebbe la macchina invece dello scenario (e' il difetto «una variabile
  # occupata dal .env» che in S1049 ha prodotto un falso verde).
  cvd() {
    # `env` e non un prefisso: le assegnazioni arrivano qui come ARGOMENTI ("$@"), e
    # un prefisso di variabili non si espande da una variabile — bash cerca un comando
    # che si chiama "FINTO_VM_KO=1" e trova 127.
    ( env TRACCIA="$T/traccia" ENV_FILE="$T/nessun.env" CLONE_VM_DB_STUB="$PWD/$STUB" \
      VM_HOST=finta-vm DB_NAME=finto_db POSTGRES_PORT=1 POSTGRES_USER=finto \
      "$@" bash "$CVD" ) 2>&1
  }
  vuota_traccia() { : > "$T/traccia"; }
  ha_droppato() { grep -q 'DROP SCHEMA' "$T/traccia"; }
  # [S1083 · #236 F1] L'ASSERZIONE CHE CONTA E' NEGATIVA: lo scambio NON deve avvenire
  # quando una verifica e' fallita. Uno scambio su un clone divergente e' esattamente
  # il difetto che questa fase e' venuta a togliere, e un test che guardasse solo il
  # caso sano non lo vedrebbe mai.
  ha_scambiato() { grep -q 'RENAME TO "finto_db"' "$T/traccia"; }

  # 1. la VM non risponde -> si esce PRIMA di toccare il clone.
  #    E' il caso in cui il codice vecchio faceva danno: droppava `staging` comunque,
  #    perche' quel drop stava sopra la pipe.
  vuota_traccia
  out="$(cvd FINTO_VM_KO=1)"; rc=$?
  { [ "$rc" = 1 ] && ! ha_droppato && printf '%s' "$out" | grep -q 'non tocco niente'; } \
    && ok "clone-vm-db: VM muta => esce 1 e NON droppa niente" \
    || fail "clone-vm-db VM muta ($rc, droppato=$(ha_droppato && echo si || echo no): $out)"

  # 2. l'elenco degli schemi esce vuoto -> non e' «niente da fare», e' una misura
  #    andata storta in silenzio. Un guard che passa su input vuoto non e' un guard.
  vuota_traccia
  out="$(cvd FINTO_SCHEMI_VM= FINTO_SCHEMI_LOC=)"; rc=$?
  # ⚠ [S1083] Il guard e' lo stesso e vale ancora, ma ora misura il SOLO lato sorgente:
  # non serve piu' l'unione dei due lati, che serviva a decidere cosa droppare. Quindi
  # la frase e' cambiata («ZERO schemi applicativi» invece di «VUOTO») e l'asserzione
  # la segue. Cio' che si pretende e' invariato: esce 1, e non tocca niente.
  { [ "$rc" = 1 ] && ! ha_droppato && ! ha_scambiato \
      && printf '%s' "$out" | grep -q 'ZERO schemi applicativi'; } \
    && ok "clone-vm-db: la sorgente dichiara zero schemi => esce 1 e non tocca niente" \
    || fail "clone-vm-db elenco vuoto ($rc: $out)"

  # 3. [S1083 · #236 F1] LA GARANZIA E' CAMBIATA DI NATURA, e con essa questi due casi.
  #
  #    Qui stavano le prove che «uno schema ritirato dalla produzione viene droppato»
  #    (il cuore di D-86) e che «`public` non si droppa, ci vivono le estensioni».
  #    Entrambe verificavano un COMPORTAMENTO che oggi non esiste piu': il clone non
  #    droppa nulla, si ricostruisce in un database che nasce vuoto. Le due proprieta'
  #    che quelle prove difendevano non sono state abbandonate — sono diventate vere
  #    PER COSTRUZIONE, ed e' un modo piu' forte di essere vere: uno schema ritirato
  #    non puo' sopravvivere a un database che non lo ha mai contenuto, e `public` non
  #    puo' cadere se nessuno lo tocca.
  #
  #    Al loro posto va la garanzia nuova, che e' l'unica cosa che quel cambio ha reso
  #    necessario provare: **il clone di scena viene creato da zero**, non riusato. Un
  #    residuo di una corsa interrotta e' per definizione incompleto, e riusarlo
  #    significherebbe scambiare un clone mutilato — cioe' il difetto di partenza,
  #    ricomparso da un'altra porta.
  vuota_traccia
  out="$(cvd FINTO_SCHEMI_VM='sys staging' FINTO_SCHEMI_LOC='sys staging')"; rc=$?
  { [ "$rc" = 0 ]       && grep -q 'DROP DATABASE IF EXISTS "finto_db_stage"' "$T/traccia"       && grep -q 'CREATE DATABASE "finto_db_stage"' "$T/traccia"       && ! ha_droppato; }     && ok "clone-vm-db: il database di scena nasce da ZERO, e nessuno schema viene droppato"     || fail "clone-vm-db creazione dello stage ($rc: $(cat "$T/traccia"))"

  # 3b. E LO SCAMBIO AVVIENE, nel caso sano: senza questa riga i casi negativi qui
  #     sotto sarebbero soddisfatti anche da uno script che non scambia MAI.
  { grep -q 'ALTER DATABASE "finto_db" RENAME TO "finto_db_old"' "$T/traccia"       && grep -q 'ALTER DATABASE "finto_db_stage" RENAME TO "finto_db"' "$T/traccia"; }     && ok "clone-vm-db: caso sano => i due rinomini avvengono, nell'ordine"     || fail "clone-vm-db scambio nel caso sano ($(cat "$T/traccia"))"


  # 4. il dump si interrompe a meta': il clone e' gia' stato droppato, quindi e'
  #    INCOMPLETO — e va detto, non dedotto dal silenzio. (S1030, review Z-022: un
  #    dump tagliato al 70% dava exit 0 e una tabella a zero righe.)
  vuota_traccia
  out="$(cvd FINTO_SCHEMI_VM=sys FINTO_SCHEMI_LOC=sys FINTO_DUMP_RC=2)"; rc=$?
  { [ "$rc" = 2 ] && printf '%s' "$out" | grep -q 'INCOMPLETO' && ! ha_scambiato; } \
    && ok "clone-vm-db: dump interrotto => esce col SUO codice, e NON scambia (il clone vero resta)" \
    || fail "clone-vm-db dump interrotto ($rc, scambiato=$(ha_scambiato && echo si || echo no): $out)"

  # 5. il censimento diverge -> «NON corrisponde». E' il caso che ha bloccato la
  #    chiusura di S1074, e deve restare bloccante: e' il guardiano, non il difetto.
  vuota_traccia
  out="$(cvd FINTO_SCHEMI_VM=sys FINTO_SCHEMI_LOC=sys FINTO_CENS_VM='sys.tab=10' FINTO_CENS_LOC='sys.tab=11')"; rc=$?
  { [ "$rc" = 1 ] && printf '%s' "$out" | grep -q 'NON corrisponde' && ! ha_scambiato \
      && printf '%s' "$out" | grep -q 'resta quello di prima'; } \
    && ok "clone-vm-db: censimento divergente => FATAL, e il divergente NON prende il posto del buono" \
    || fail "clone-vm-db censimento DIFF ($rc, scambiato=$(ha_scambiato && echo si || echo no): $out)"

  # 6. «non ho potuto misurare» e «i numeri non combaciano» sono DUE guasti diversi e
  #    devono dirlo. Confrontare due '?' dava «OK»: il fallimento di entrambi i lati
  #    si presentava come successo perfetto (D-78).
  vuota_traccia
  out="$(cvd FINTO_SCHEMI_VM=sys FINTO_SCHEMI_LOC=sys FINTO_CONTE_KO=1)"; rc=$?
  { [ "$rc" = 1 ] && printf '%s' "$out" | grep -q 'NON e. stato possibile' \
      && printf '%s' "$out" | grep -q 'non e. stato verificato' \
      && ! printf '%s' "$out" | grep -q 'NON corrisponde'; } \
    && ok "clone-vm-db: conte non misurabili => «non verificato», NON «divergente»" \
    || fail "clone-vm-db non misurabile ($rc: $out)"

  # 7. il caso sano arriva in fondo. Senza, i sei casi sopra sarebbero soddisfatti
  #    anche da uno script che fallisce SEMPRE.
  vuota_traccia
  out="$(cvd FINTO_SCHEMI_VM='sys staging' FINTO_SCHEMI_LOC='sys staging')"; rc=$?
  { [ "$rc" = 0 ] && printf '%s' "$out" | grep -q 'done'; } \
    && ok "clone-vm-db: tutto sano => esce 0 (il controllo non blocca il caso buono)" \
    || fail "clone-vm-db caso sano ($rc: $out)"

  # 8. [#236 F1] IL PRIMO RINOMINO FALLISCE — tipicamente perche' qualcuno e' collegato.
  #    ⚠ Questo caso NON prova un pre-controllo: quello e' stato tolto, ed e' stata la
  #    corsa reale a imporlo. Chiedere «c'e' qualcuno?» e poi rinominare decide su una
  #    misura di un istante prima, e misurato oggi ha bloccato uno scambio per UNA
  #    connessione anonima che si stava gia' chiudendo. Il rinomino E' la misura: qui
  #    si pretende che, quando fallisce, il clone resti intatto e il messaggio dica
  #    CHI era collegato — che e' cio' che l'errore di PostgreSQL non dice.
  vuota_traccia
  out="$(cvd FINTO_SCHEMI_VM=sys FINTO_SCHEMI_LOC=sys FINTO_RENAME1_KO=1 \
             FINTO_CHI_COLLEGATO='api-gemello [idle]')"; rc=$?
  { [ "$rc" = 1 ] && ! ha_scambiato \
      && printf '%s' "$out" | grep -q 'NIENTE E. PERDUTO' \
      && printf '%s' "$out" | grep -q 'api-gemello'; } \
    && ok "clone-vm-db: primo rinomino fallito => niente scambio, e dice CHI era collegato" \
    || fail "clone-vm-db primo rinomino ($rc: $out)"

  # 9. LA FINESTRA DI MILLISECONDI, ed e' l'unico rischio che questa fase NON elimina:
  #    i due rinomini non stanno in una transazione perche' PostgreSQL non lo permette.
  #    Se il secondo fallisce, il dato NON e' perduto — si chiama `<nome>_old` — e il
  #    messaggio deve portare il comando esatto per rimetterlo a posto. Un messaggio
  #    che dicesse solo «errore» lascerebbe chi legge con un database che non trova.
  vuota_traccia
  out="$(cvd FINTO_SCHEMI_VM=sys FINTO_SCHEMI_LOC=sys FINTO_RENAME2_KO=1)"; rc=$?
  { [ "$rc" = 1 ] \
      && printf '%s' "$out" | grep -q 'IL DATO NON E. PERDUTO' \
      && printf '%s' "$out" | grep -q 'ALTER DATABASE "finto_db_old" RENAME TO "finto_db"'; } \
    && ok "clone-vm-db: secondo rinomino fallito => dice dov'e' il dato E il comando per rimediare" \
    || fail "clone-vm-db rinomino fallito ($rc: $out)"
  rm -rf "$T"
else
  fail "$CVD o $STUB mancante"
fi

# [S1052] Queste esistevano ma NESSUN cancello le eseguiva: questo file le raccoglieva
# solo per `bash -n` e shellcheck, mentre le batterie vere sono invocate da sezioni
# scritte a mano. Prove fuori dal presidio — ed e' la ragione per cui una batteria e'
# rimasta ROSSA per ore senza che nessuno lo sapesse: cinque controlli guardavano il
# posto vecchio, e non c'era niente che li eseguisse.
#
# Si invocano come processi separati e si guarda il CODICE D'USCITA, non l'output:
# leggere l'esito dai messaggi e' la trappola che questo progetto documenta.
section "batterie del loop zero-pending (verdetti dei revisori)"
for b in zp-review-tests.sh; do
  if [ ! -f "scripts/test/$b" ]; then
    fail "scripts/test/$b manca"
    continue
  fi
  if out="$(bash "scripts/test/$b" 2>&1)"; then
    ok "$b — $(printf '%s' "$out" | tail -1)"
  else
    fail "$b — $(printf '%s' "$out" | tail -1)"
  fi
done

# ------------------------------------------------- Y. la batteria del cancello di verifica
#
# [S1054] Il cancello e' l'unico guardiano di fine turno, e nessuno lo aveva mai
# visto dire ROSSO in modo controllato: lo si osservava verde e si concludeva che
# funzionasse. Lo stesso giorno si e' scoperto che il suo ramo «niente da
# verificare» scriveva `green` senza aver eseguito nulla.
#
# Stessa regola della sezione Z: processo separato, si legge il CODICE D'USCITA.
# La batteria e' in Python perche' deve importare `verify_gate.py` e chiamarne le
# funzioni pure — un wrapper `.sh` in mezzo aggiungerebbe un file e nessun valore.
section "batteria del cancello di verifica"
VGT="scripts/test/verify-gate-tests.py"
if [ ! -f "$VGT" ]; then
  fail "$VGT manca"
else
  PY="$(command -v python || command -v py || true)"
  if [ -z "$PY" ]; then
    fail "$VGT — nessun interprete python trovato (python/py)"
  elif out="$("$PY" "$VGT" 2>&1)"; then
    ok "verify-gate-tests.py — $(printf '%s' "$out" | tail -1)"
  else
    fail "verify-gate-tests.py — $(printf '%s' "$out" | tail -1)"
  fi
fi


# ------------------------------- Z. una funzione USATA e mai DEFINITA (S1079, #229)
# Nasce da un difetto reale del 2026-08-24: un blocco nuovo di `close-propagate.sh` chiamava
# `bold`, che in quello script NON esiste (le sue sono `log`/`warn`/`die`). Il nome era stato
# dedotto dall'OUTPUT — che mostra «=== … ===» in grassetto — invece che dal codice.
#
# Perche' e' passato inosservato: lo script e' morto su quella riga e ha comunque restituito
# **exit 0**. Il codice d'uscita diceva «bene», e solo l'output diceva la verita'. Le due righe
# che venivano dopo (il cancello a tempo e il marcatore di CHIUSURA della corsa) non sono mai
# state eseguite: una corsa monca che si dichiarava riuscita.
#
# Volutamente CONSERVATIVO: cerca solo i nomi tipici di questi script, come primo token di una
# riga. Un analizzatore generale darebbe falsi positivi su comandi esterni e alias, e un test
# rumoroso e' un test che si smette di guardare.
section "funzioni usate e mai definite (S1079)"
fn_rossi=0
for f in "$ROOT"/scripts/*.sh; do
  [ -f "$f" ] || continue
  for nome in $(grep -oE '^[[:space:]]*(bold|log|warn|say|die|info|nota|titolo|step)[[:space:]]' "$f" 2>/dev/null \
                | sed 's/[[:space:]]//g' | sort -u); do
    grep -qE "^[[:space:]]*${nome}\(\)" "$f" && continue
    # puo' arrivare da un file sorgentato: si guarda anche in scripts/lib, altrimenti il test
    # accuserebbe uno script corretto che eredita le sue funzioni da una libreria.
    grep -qrE "^[[:space:]]*${nome}\(\)" "$ROOT/scripts/lib" 2>/dev/null && continue
    printf '    %s: usa «%s», non definita ne qui ne in scripts/lib\n' "$(basename "$f")" "$nome" >&2
    fn_rossi=$((fn_rossi+1))
  done
done
if [ "$fn_rossi" = 0 ]; then
  ok "ogni funzione usata negli script e' definita"
else
  fail "$fn_rossi funzione/i usata/e e mai definita/e — una riga morta che restituisce exit 0"
fi
# ---------------------------------------------------------------- summary
printf '\n%d ok, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" = 0 ]
