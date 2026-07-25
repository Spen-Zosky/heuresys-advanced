# Self-hosted GitHub Actions runner — OCI VM setup procedure

**Updated**: 2026-05-26 (S935 phase F)
**Status**: Procedure SHIPPED; first runner registration deferred to Windows host + SSH session.
**Runner host**: `oracle-vm-default` (80.225.82.207, Ubuntu 24.04 LTS ARM64, `ubuntu` user).
**2nd runner (ACTIVE, D-08 F5 S1023)**: `linux-pc-runner` on the x86_64 PROD twin — labels `off-prod,linux-pc`, heavy DB gates run there (→ §10). The old "Windows backup runner" idea (§8) is superseded.

---

## §1 — Why self-hosted

GitHub-hosted runners would re-install pnpm deps (~3GB symlink graph) on every push — 3-5 min per workflow × 6 workflows = 18-30 min cumulative wall time. Self-hosted runner on OCI VM keeps the pnpm store warm across runs → typecheck completes in <30s, lint <15s, full integration test suite <3 min.

Plus, the OCI VM **is** the PostgreSQL host (CW-B60-* runs needed `ssh -L 5433:5432` tunnel from dev machine — on the runner localhost:5432 is the live DB). Zero tunnel overhead in CI.

---

## §2 — Pre-requisites on OCI VM (one-time)

```bash
# Connect as ubuntu user
ssh oracle-vm-default

# 1. Node 22.x (already installed per S933 baseline)
node --version    # expected: v22.x

# 2. pnpm 9.15.0
sudo npm install -g pnpm@9.15.0
pnpm --version    # expected: 9.15.0

# 3. PostgreSQL 16 client tools (psql) — already installed for the DB
which psql        # expected: /usr/bin/psql

# 4. systemd unit dir + log dir
sudo mkdir -p /opt/heuresys-runner
sudo mkdir -p /var/log/heuresys-runner
sudo chown ubuntu:ubuntu /opt/heuresys-runner /var/log/heuresys-runner

# 5. Playwright system deps (chromium for E2E smoke)
sudo apt-get update
sudo apt-get install -y \
  libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libpango-1.0-0 libcairo2 libasound2t64
```

---

## §3 — Register the runner

```bash
# 1. Get a registration token. Two options:
#    (a) GitHub UI: Settings → Actions → Runners → New self-hosted runner (Linux ARM64).
#        https://github.com/Spen-Zosky/heuresys-advanced/settings/actions/runners/new
#    (b) Fully autonomous via gh CLI (PAT needs repo Administration write) — no UI step:
#        TOKEN=$(gh api -X POST repos/Spen-Zosky/heuresys-advanced/actions/runners/registration-token --jq .token)
#        Tokens are one-time use and expire in ~1h. Pass via stdin, never echo (R10).

# 2. On OCI VM, download the runner package (latest at time of writing: 2.319.1)
cd /opt/heuresys-runner
curl -o actions-runner.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-linux-arm64-2.319.1.tar.gz
tar xzf actions-runner.tar.gz

# 3. Configure the runner with the token from step 1
./config.sh \
  --url https://github.com/Spen-Zosky/heuresys-advanced \
  --token <TOKEN_FROM_GITHUB_UI> \
  --name oracle-vm-default-runner \
  --labels self-hosted,oci-vm,linux,ARM64 \
  --work _work \
  --unattended

# 4. Install + start as systemd service
sudo ./svc.sh install ubuntu
sudo ./svc.sh start
sudo ./svc.sh status    # expected: active (running)
```

---

## §4 — EnvironmentFile for secrets

The runner needs DB credentials + JWT key paths + cookie secret WITHOUT exposing them in workflow YAML (R11 secret hygiene).

**CRITICAL — systemd EnvironmentFile escaping gotcha (verified S937):** systemd
applies shell-style backslash unescaping to EnvironmentFile values. A literal
`\n` (backslash + n) is collapsed to `n` — it does **not** become a newline. So
a PEM written with single-`\n` escapes arrives at the app with its newlines
destroyed → `@fastify/jwt` boots with `FAST_JWT_INVALID_KEY` / "PEM section not
found for: PRIVATE KEY" and **every** integration suite fails in `beforeAll`.
Fix: write the PEM with **double** backslashes (`\\n`). systemd unescapes
`\\n` → `\n` (literal), and `env.ts`'s `readKeyMaterial` then converts `\n` →
real newline (it keys off the value containing `BEGIN`/`END`). Do **not** base64
the keys — `env.ts` expects a PEM block, not base64.

Note the var names the code actually reads: `env.ts` uses **`POSTGRES_DB`**, while
the workflow's `psql` connectivity step uses `POSTGRES_DATABASE` + `PGPASSWORD`.
Set all three. Non-DB secrets (`COOKIE_SECRET`, `MFA_ENCRYPTION_KEY`, the JWT
keypair) do **not** need to match the dev host — the CI suite logs in against the
real Argon2id hashes in the DB and signs/verifies JWTs within one app instance,
so a freshly generated keypair is fine and avoids transferring dev secrets (R10).

```bash
# 1. Build the EnvironmentFile ON the VM. Generate the JWT keypair + cookie/MFA
#    secrets here; transfer ONLY the real DB password from the dev host's .env
#    (piped via stdin, never echoed — R10). $PW below = that password.
TMP=$(mktemp -d)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$TMP/priv.pem" 2>/dev/null
openssl rsa -in "$TMP/priv.pem" -pubout -out "$TMP/pub.pem" 2>/dev/null
# Escape newlines as DOUBLE backslash (chr(92)*2 + 'n') for systemd:
ESC='import sys;print(open(sys.argv[1]).read().replace(chr(10),chr(92)+chr(92)+chr(110)),end="")'
PRIV=$(python3 -c "$ESC" "$TMP/priv.pem"); PUB=$(python3 -c "$ESC" "$TMP/pub.pem")
COOKIE=$(openssl rand -base64 48 | tr -d '\n'); MFA=$(openssl rand -base64 32 | tr -d '\n')
sudo bash -c "umask 077; cat > /etc/heuresys-runner.env" << EOF
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=heuresys_advanced
POSTGRES_DATABASE=heuresys_advanced
POSTGRES_USER=heuresys
POSTGRES_PASSWORD=$PW
PGPASSWORD=$PW
POSTGRES_SCHEMA=sys
POSTGRES_SSL=disable
COOKIE_SECRET=$COOKIE
ADMIN_ORIGIN=http://localhost:3000
# NEXT_PUBLIC_* are baked into the apps/web bundle at `pnpm build` time, so the
# playwright-smoke workflow's web build needs this in the runner env or the SPA
# calls the wrong API origin → login never redirects → auth.setup times out.
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/v1
MFA_ENCRYPTION_KEY=$MFA
JWT_PRIVATE_KEY=$PRIV
JWT_PUBLIC_KEY=$PUB
# F-001 (added post-S950): the personas' login password — MUST match the value
# the seeder wrote into the (cloned) DB. Without it 155/206 suites fail at
# collection (S1023 lesson on the linux-pc runner).
TEST_ADMIN_PASSWORD=$TESTPW
LOG_LEVEL=warn
NODE_ENV=test
NEXT_TELEMETRY_DISABLED=1
EOF
sudo chmod 600 /etc/heuresys-runner.env && sudo chown root:root /etc/heuresys-runner.env
rm -rf "$TMP"

# 2. Verify the keys survive systemd's unescaping BEFORE trusting the runner:
sudo systemd-run --wait --collect --quiet \
  --property=EnvironmentFile=/etc/heuresys-runner.env \
  /bin/bash -c 'printf "%s" "$JWT_PRIVATE_KEY" > /tmp/jp.r'
sudo chmod 644 /tmp/jp.r
node -e 'const fs=require("fs"),c=require("crypto");let v=fs.readFileSync("/tmp/jp.r","utf8");v=v.split(String.fromCharCode(92)+"n").join(String.fromCharCode(10));c.createPrivateKey(v);console.log("JWT key OK")'
sudo rm -f /tmp/jp.r

# 3. Attach the EnvironmentFile via a systemd drop-in (non-interactive — avoids
#    the editor that `systemctl edit` opens), then reload + restart.
UNIT=actions.runner.Spen-Zosky-heuresys-advanced.oracle-vm-default-runner.service
sudo mkdir -p "/etc/systemd/system/${UNIT}.d"
printf '[Service]\nEnvironmentFile=/etc/heuresys-runner.env\n' \
  | sudo tee "/etc/systemd/system/${UNIT}.d/override.conf" >/dev/null
sudo systemctl daemon-reload
sudo systemctl restart "$UNIT"
sudo systemctl is-active "$UNIT"    # expected: active
```

**R11 note**: never commit `/etc/heuresys-runner.env` to any repo. Keep a sealed backup on the dev host alongside `.secrets/`.

---

## §5 — Pre-Playwright DB seeding (SUPERSEDED — never implemented, and the recipe below is now harmful)

> **Do not implement the script below.** It was a proposal, never deployed: no `pre-job-seed-check.sh` exists on either runner and no `heuresys-pre-job-seed.timer` is registered (verified S1029 on both hosts). Two reasons it must stay unimplemented:
>
> 1. **The personas it checks were deleted.** `tenant_admin_test@rtl-bank.test` and siblings were removed by the RTL rebuild (S950); today's personas are real `@rtl-bank.org` users. The `count(*) < 5` condition would therefore be true forever, and the timer would re-run `db:seed-test-admin` **every 5 minutes**, indefinitely.
> 2. **The need is already met, better.** Both `test-integration.yml` and `playwright-smoke.yml` run `pnpm db:seed-test-admin` as an explicit, idempotent, login-only step inside the job — seeding exactly when it matters, with the failure visible in that job's log instead of in a background timer nobody reads.
>
> The recipe is kept below for the record of the original S935 design.

The Playwright smoke workflow expects 5 test personas seeded. Add a cron or runner-pre-job script:

```bash
# /opt/heuresys-runner/pre-job-seed-check.sh
#!/bin/bash
# Run before each Playwright job to ensure test admin + 5 personas exist.
set -euo pipefail
source /etc/heuresys-runner.env

EXPECTED_COUNT=5
ACTUAL=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" \
  -tA -c "SELECT count(*) FROM sys.sys_users WHERE user_email IN ('admin@heuresys.com','tenant_admin_test@rtl-bank.test','manager_test@rtl-bank.test','employee_test@rtl-bank.test','outsider_test@rtl-bank.test')")

if [ "$ACTUAL" -lt "$EXPECTED_COUNT" ]; then
  echo "Re-seeding test personas..."
  cd /home/ubuntu/heuresys-advanced
  pnpm db:seed-test-admin
fi
```

Make executable + schedule via systemd timer (every 5 min, idempotent):

```ini
# /etc/systemd/system/heuresys-pre-job-seed.timer
[Unit]
Description=Heuresys CI pre-job seed check
[Timer]
OnCalendar=*:0/5
Unit=heuresys-pre-job-seed.service
[Install]
WantedBy=timers.target
```

---

## §6 — Verification

After setup, push a no-op commit and verify all 6 workflows queue + run + green on the new runner:

```powershell
# From dev host
cd D:\heuresys-advanced
git commit --allow-empty -m "ci: smoke test of self-hosted runner post-S935-F"
git push origin main

# Watch run progress
gh run list --limit 6
gh run watch <RUN_ID>
```

Expected: typecheck + lint + i18n-parity + test-integration + build-web + playwright-smoke all reach `success`. First run will be slower (cold pnpm cache); subsequent runs fast.

---

## §7 — Maintenance

- **Runner updates**: GitHub auto-updates the runner agent. The Node/pnpm versions are pinned in workflow YAML; bump them deliberately.
- **Log rotation**: `/var/log/heuresys-runner/` rotated weekly via logrotate. Add `/etc/logrotate.d/heuresys-runner` if disk fills.
- **Disk pressure**: pnpm store grows ~500MB-1GB per major refactor. Prune monthly: `pnpm store prune`.
- **Token expiry**: GitHub runner tokens expire after 1h at registration but the registered runner persists indefinitely. If `./config.sh remove` is run, re-issue a new token via the GitHub Settings UI.

---

## §8 — Backup runner: Windows host (SUPERSEDED by §10 — linux-pc, S1023)

> **Superseded.** The redundancy this section was deferring is now provided by the **linux-pc off-prod runner** (§10), which took over the heavy gates in D-08 F5 and is a full x86_64 PROD twin — strictly better than a Windows backup for this purpose (same OS as PROD, own PostgreSQL, no Task Scheduler divergence). A Windows runner is no longer planned; the text below is kept for the record of the original S935 decision.

Out of S935 scope. When implemented:

- Host: DESKTOP-KH728P2
- Runner label: `[self-hosted, windows-local]`
- Use case: failover when OCI VM down (rare; ~99.9% uptime in 2026).
- Setup pattern: mirror §3 with Windows runner package + Task Scheduler instead of systemd.
- Workflows can opt-in via `runs-on: [self-hosted, windows-local]` for Windows-specific tests.

Decision: backup runner not in critical path; OCI VM has been stable since 2025-12 setup. Re-evaluate if VM downtime exceeds 1% in any quarter.

---

## §9 — Related

- `docs/github/branch-protection.md` (status checks gated by these workflows)
- `docs/github/dependabot-triage-2026-05-26.md` (uses these workflows as merge gates)
- `.github/workflows/{typecheck,lint,i18n-parity,test-integration,build-web,playwright-smoke}.yml` (S935 phase F deliverables)
- CLAUDE.md (R11 secret hygiene — applies to all runner env files)

---

## §10 — OFF-PROD runner: linux-pc (D-08 F5, S1023)

**Host**: `linux-pc` (192.168.1.11, Zorin 17.3 / Ubuntu 22.04 x86_64, user `enzo`) — the PROD twin.
**Runner**: `linux-pc-runner`, labels `self-hosted,off-prod,linux-pc` (+ auto `Linux,X64`).
**Why**: the single `oci-vm` runner WAS the PROD host — SPOF, queue contention, CI secrets and CI load on production. The heavy gates now run off-prod on the twin against its **local** PostgreSQL: `heuresys_ci` cloned from the twin's local 1:1 `heuresys_advanced` clone. The OCI PROD host is no longer in the CI path for these jobs.

**Workflow placement** (as of D-08 F5):

| Workflow | runs-on | Rationale |
|---|---|---|
| test-integration | `[self-hosted, off-prod]` | DB gate → twin's local `heuresys_ci` |
| playwright-smoke | `[self-hosted, off-prod]` | DB gate + chromium load off PROD |
| build-web | `[self-hosted, off-prod]` | heavy next build off PROD |
| typecheck, lint, i18n-parity, shell-tests | `[self-hosted, oci-vm]` | light (<30s), keep VM redundancy |
| state-lint | `[self-hosted, oci-vm]` | **must** read the REAL PROD DB (SoT staleness check vs live numbers — the clone would false-drift) |
| showcase | `ubuntu-latest` | GitHub Pages deploy, no self-hosted need |

**Provisioning** (idempotent, scoped-sudo only): `scripts/provision-ci-runner-linuxpc.sh` — apt chromium libs, checksum-verified runner download, `config.sh` registration, `/etc/heuresys-runner.env` (DB creds from the twin's `.env`, JWT/cookie/MFA generated on-host, double-`\n` PEM escaping per §4), hand-authored systemd unit (`sudo ./svc.sh` is outside the sudoers scope) **with the D-08 F3 resource slice baked in** (`MemoryMax=10G`, `CPUQuota=300%` of 4 cores), EnvironmentFile drop-in, live JWT-unescaping self-check via `/proc/<pid>/environ`, and `db/scripts/setup-ci-database.sh` for `heuresys_ci`.

```bash
# From the Windows dev host (token via stdin, never echoed — R10):
scp scripts/provision-ci-runner-linuxpc.sh linux-pc:/tmp/
gh api -X POST 'repos/{owner}/{repo}/actions/runners/registration-token' --jq .token \
  | MSYS_NO_PATHCONV=1 ssh linux-pc 'RUNNER_TOKEN=$(cat) bash /tmp/provision-ci-runner-linuxpc.sh'
```

**heuresys_ci refresh on the twin**: on demand — refresh the twin's base clone first if needed (`scripts/clone-vm-db.sh`), then `bash db/scripts/setup-ci-database.sh` (drops+recreates `heuresys_ci` objects). With D-52 per-file tx rollback the CI DB does not drift between runs.

**Availability trade-off (accepted)**: if linux-pc is off, the three off-prod gates queue until it returns (GitHub holds queued jobs; the deploy gate — D-08 F2 — has an explicit `DEPLOY_REQUIRE_CI=0` bypass for emergencies). The light gates on `oci-vm` keep signalling regardless.

### §10.1 — DB prerequisites of the runner (cluster-level, NOT carried by a clone)

Everything the test suite needs from the database arrives by clone **except one thing**: `shared_preload_libraries`. It is a *cluster* parameter, it requires a PostgreSQL restart, and it appears in no dump — so a freshly reprovisioned twin can have every table, every extension and still fail the suite.

| Prerequisite | Scope | Carried by a clone? | Fixed by |
|---|---|---|---|
| `pg_stat_statements` extension | per-database | yes (`setup-ci-database.sh` pre-creates every extension present on the source) | `db/scripts/create_local_database.sh`, `setup_oci_vm_database.sh` |
| `pg_stat_statements` in `shared_preload_libraries` | **cluster** | **no — never** | `scripts/provision-linux-pc.sh` step 2.2b (idempotent, appends) |

Without the preload the view exists but every read fails with SQLSTATE `55000` (*"must be loaded via shared_preload_libraries"*). This is what turned CI red on 2026-07-23: `GET /v1/observability/slow-queries` answered 500 and `Test (api integration)` stayed red on `main` until S1029. The endpoint now degrades to an empty panel instead of 500ing, and `observability.integration.test.ts` carries an explicit *environment gate* test that fails loudly — with the remediation in its own message — if the preload is missing.

```bash
# Verify (from the dev host). Expected: the setting lists pg_stat_statements,
# and the count query answers instead of erroring.
MSYS_NO_PATHCONV=1 ssh linux-pc "sudo -n -u postgres psql -tAc \"SHOW shared_preload_libraries\""
MSYS_NO_PATHCONV=1 ssh linux-pc "sudo -n -u postgres psql -d heuresys_ci -tAc 'SELECT count(*) FROM pg_stat_statements'"

# Remediate by hand if ever needed (APPEND — never overwrite the current value):
#   sudo -u postgres psql -c "ALTER SYSTEM SET shared_preload_libraries = '<current>,pg_stat_statements'"
#   sudo systemctl restart postgresql
```
