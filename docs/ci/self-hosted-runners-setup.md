# Self-hosted GitHub Actions runner — OCI VM setup procedure

**Updated**: 2026-05-26 (S935 phase F)
**Status**: Procedure SHIPPED; first runner registration deferred to Windows host + SSH session.
**Runner host**: `oracle-vm-default` (80.225.82.207, Ubuntu 24.04 LTS ARM64, `ubuntu` user).
**Backup runner**: Windows local (DESKTOP-KH728P2) — deferred to S936+ (scope-defer).

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
# 1. On GitHub: Settings → Actions → Runners → New self-hosted runner
#    Select Linux ARM64. Copy the token shown (one-time use, expires in 1h).
#    Reference: https://github.com/Spen-Zosky/heuresys-advanced/settings/actions/runners/new

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

```bash
# 1. Create the EnvironmentFile (mode 600, ubuntu-owned)
sudo bash -c 'cat > /etc/heuresys-runner.env << EOF
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=heuresys_advanced
POSTGRES_USER=heuresys
POSTGRES_PASSWORD=<copy from D:\heuresys-advanced\.env on dev host>
POSTGRES_SCHEMA=sys
POSTGRES_SSL=disable

COOKIE_SECRET=<copy from D:\heuresys-advanced\.env>
ADMIN_ORIGIN=http://localhost:3000
NODE_ENV=test

JWT_PRIVATE_KEY=<base64 of .secrets/jwt_private.pem>
JWT_PUBLIC_KEY=<base64 of .secrets/jwt_public.pem>

MFA_ENCRYPTION_KEY=<openssl rand -base64 32>

LOG_LEVEL=warn
NEXT_TELEMETRY_DISABLED=1
EOF'
sudo chmod 600 /etc/heuresys-runner.env
sudo chown root:root /etc/heuresys-runner.env

# 2. Modify the runner systemd unit to load this file
sudo systemctl edit actions.runner.Spen-Zosky-heuresys-advanced.oracle-vm-default-runner.service

# Add the following in the editor that opens:
# [Service]
# EnvironmentFile=/etc/heuresys-runner.env

# 3. Reload + restart
sudo systemctl daemon-reload
sudo systemctl restart actions.runner.Spen-Zosky-heuresys-advanced.oracle-vm-default-runner.service
```

**R11 note**: never commit `/etc/heuresys-runner.env` to any repo. Keep a sealed backup on the dev host alongside `.secrets/`.

---

## §5 — Pre-Playwright DB seeding

The Playwright smoke workflow expects 5 test personas seeded. Add a cron or runner-pre-job script:

```bash
# /opt/heuresys-runner/pre-job-seed-check.sh
#!/bin/bash
# Run before each Playwright job to ensure test admin + 5 personas exist.
set -euo pipefail
source /etc/heuresys-runner.env

EXPECTED_COUNT=5
ACTUAL=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" \
  -tA -c "SELECT count(*) FROM sys.sys_users WHERE email IN ('admin@heuresys.com','tenant_admin_test@rtl-bank.test','manager_test@rtl-bank.test','employee_test@rtl-bank.test','outsider_test@rtl-bank.test')")

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

## §8 — Backup runner: Windows host (DEFERRED to S936+)

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
