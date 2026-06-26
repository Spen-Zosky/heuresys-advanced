# Deploying / running heuresys-advanced

Idempotent bootstrap, by host role. All scripts are safe to re-run; each run
converges the host to the same healthy state.

## Secrets (always required, never in git)

Every host needs, in the repo root:

- `.env`
- `.secrets/jwt_private.pem`, `.secrets/jwt_public.pem`

These are gitignored and transferred out-of-band — the scripts verify them and
stop with instructions if missing:

```bash
scp .env        <host>:<repo>/.env
scp -r .secrets <host>:<repo>/
```

## Gitignored data → VM (`sync-gitignored-to-vm.sh`)

`git clone` brings only tracked files. Gitignored **data/artifacts** (brownfield
seeds + extracts, `graphify-out/`, qa snapshots, logs, the gitignored showcase
src, `.secrets/`, …) never reach the VM otherwise. From a source workstation
that has them:

```bash
bash scripts/sync-gitignored-to-vm.sh            # -> oracle-vm-default:/home/ubuntu/heuresys-advanced
SSH_HOST=… DEST_DIR=… bash scripts/sync-gitignored-to-vm.sh
```

One-shot, re-runnable (additive overwrite via tar-over-ssh; never deletes
VM-side files). It mirrors everything gitignored **except** the regenerable /
platform-specific objects — `node_modules`, `dist`, `.next`, `out`,
`test-results`, `*.tsbuildinfo` (regenerated per-platform by the bootstrap;
copying the PC's would break the VM's native binaries) — and `.env` (the
bootstrap owns it; the PC's tunnel `.env` would clobber the VM's local-DB
config). Run it *while the PC is alive* — it can't read a dead PC.

## Full alignment — VM + linuxpc as clones (`align-clones.sh`) — Mac on-demand only (S1007)

> **B-52 (S981)**: `linuxpc` (192.168.1.11, PROD twin autonomo con DB locale clonato) è ora un target di align: `bash scripts/align-clones.sh linuxpc [--deploy]` (strict) ed è incluso in `all` con resilienza FORZATA (PC spento → skip con warning, mai un fail del run). Il deploy leg riusa `vm-deploy.sh` con `REPO_DIR=/home/enzo/heuresys-advanced`; il refresh del DB clone resta `scripts/clone-vm-db.sh` (on-demand). Provisioning da zero: `scripts/provision-linux-pc.sh`.

The **canonical "allinea i cloni" entrypoint** (VM + linux-pc; the Mac is retired from `all` in S1007 — on-demand only). It makes the remotes idempotent
clones of the local PC repo (modulo OS/arch), wiring the steps below so nothing
gitignored is left behind. Run from the local PC — **push local commits first**
(the remotes reset to `origin/main`):

```bash
bash scripts/align-clones.sh all --deploy   # both remotes + redeploy PROD
bash scripts/align-clones.sh mac            # Mac — ON-DEMAND ONLY (retired from `all`, S1007)
bash scripts/align-clones.sh vm             # VM clone payload only (no build/restart)
```

Per target, in order: hard git sync (`reset --hard origin/main` + `clean -fd`,
gitignored files preserved) → `pnpm install --frozen-lockfile -r` → `.secrets/` +
gitignored data (`sync-gitignored-to-vm.sh`) → **`.env` additive key-merge**
(`env-key-merge.sh` — adds only NEW keys, never overwrites per-machine topology like
`POSTGRES_PORT`/`COOKIE_SECURE`) → Claude memory tree (`sync-memory-tree.sh`) →
(VM + `--deploy`) `vm-deploy.sh`.

Propagation rule of thumb — **clone verbatim**: `.secrets/*.pem` + new `.env` keys +
gitignored data. **Key-merge, value-preserve**: the rest of `.env` (topology stays
per-machine). **Never propagate**: regenerable/platform objects (`node_modules`,
`dist`, `.next`, `*.tsbuildinfo`). NB: this is the **hard-clone** path; the per-host
`dev-bootstrap.sh` below remains the non-destructive *provisioning* path.

**Delta mode (used automatically at session close).** The `handoff` skill runs
`align-clones.sh all --delta --resilient --auto-deploy`, which propagates **only what
the session changed** (memories/data with `mtime` newer than the session marker
`.session-align.marker`, plus deleted-memory propagation), **deploys the VM only if the
commits touched code** (`apps|packages|db|scripts|deploy`), and **skips an unreachable
host with a warning** instead of failing. The VM deploy runs `db/scripts/migrate-if-pending.sh`
(migrates only when an sha256 is missing from the `sys.sys_schema_migrations` ledger —
normally a no-op on the shared DB). Use the full-clone form above to catch up a host that
was skipped.

## Claude ecosystem alignment (`align-claude-ecosystem.sh`)

Canonical replacement of the manual S979 procedure. Clones the **Windows user-level
Claude catalog** (`~/.claude` portable subset) onto mac / vm / linuxpc, making them
idempotent ecosystem clones (modulo OS): `CLAUDE.md`, `skills/`, `commands/`,
`statusline-command.sh`, per-OS-transformed `settings.json` (PowerShell hooks → bash
`session-bootstrap.sh`, statusline repath, drive letters dropped), claude-mem
`settings.json` (path keys per host, **DB never copied** — fresh per machine), and a
**native plugin reinstall** on each remote (6 marketplaces + 16 enabled plugins — the
plugin registry is never raw-copied: foreign absolute paths were the S979 corruption).

```bash
bash scripts/align-claude-ecosystem.sh linuxpc --dry-run   # preview (no remote writes)
bash scripts/align-claude-ecosystem.sh all                 # align (linuxpc resilient)
bash scripts/align-claude-ecosystem.sh all --verify        # drift reports only
bash scripts/align-claude-ecosystem.sh vm --rollback <stamp>
```

Safety by construction: first run moves the whole remote `~/.claude` to
`~/.claude.bak-<stamp>` (old lineage archived, recoverable) and restores
`.credentials.json`/`projects/`/`settings.local.json`/state from it; later runs take a
tgz of managed paths only. **Auth is never cloned and credentials are forward-only**
(rollback keeps the newest `.credentials.json` — restoring a stale copy over rotated
OAuth tokens bricks auth; learned the hard way on the VM, 2026-06-12). A headless
smoke test (`claude -p --tools ""`) gates startup breakage with auto-rollback; a 401
only warns (auth ≠ alignment; fix with `claude login` on the host). Drift reports land
in `deploy/reports/claude-align/` (gitignored). **The Mac is RETIRED from `all`/close-propagate
(S1007)** — dead weight: Claude Code ≥2.x is AVX2-native and the 2012 Mac has no AVX2 (its CLI
SIGILLs), so the ecosystem channel kept failing 16 plugins + drift. On-demand `align-clones.sh mac`
still runs config-only (`--skip-plugins --skip-smoke`); see `deploy/reports/claude-align/mac-cli-repair-20260612.md`.

**SDK parity** (opzione C, 2026-06-12): the Anthropic SDKs are part of the ecosystem on
every machine — npm `@anthropic-ai/claude-agent-sdk` + `@anthropic-ai/sdk` (global) and
pip `anthropic` + `claude-agent-sdk` (user site). The align/`--sdks-only` stage equalizes
remotes to the versions INSTALLED on the Windows SoT (read at runtime from `npm ls -g` /
`pip show` — to bump everyone, update the SoT then re-run) and prunes the deprecated
`claude-code-sdk`. pip falls back to `--break-system-packages` for PEP 668 hosts
(Ubuntu 24.04). Mac note: works (SDKs are pure JS/Python — no AVX2 constraint), but the
*Agent* SDKs spawn the Claude Code CLI at runtime, which the 2012 Mac cannot run: there
they are install-parity only; the plain API SDKs (`@anthropic-ai/sdk`, `anthropic`) are
fully usable. `claude --version` / `claude plugin list` checks include SDK versions in
the `--verify` drift report.

## Canonical session close (`close-propagate.sh`)

> **Non-bypassable doctrine (2026-06-20, design §12-§13).** The `handoff` skill Step 4b calls this script; both channels below are **always enforced** on every reachable host.

The single canonical orchestrator for session-close propagation — all three steps:

```bash
# Typical close (delta: only session changes, auto-deploy if code changed):
MSYS_NO_PATHCONV=1 bash scripts/close-propagate.sh --delta --auto-deploy

# Full catch-up after a skipped host or fresh setup:
MSYS_NO_PATHCONV=1 bash scripts/close-propagate.sh --full --deploy --clone-db
```

**Channel 1 — `align-clones.sh all`**: repo hard-sync + gitignored payload (`.secrets`, gitignored data) + `.env` key-merge + project memories (`sync-memory-tree.sh`) + PROD deploy (vm + linuxpc). See *Full alignment* above.

**Channel 2 — `align-claude-ecosystem.sh all`**: Claude catalog (`CLAUDE.md`, `skills/`, `commands/`, `settings.json` OS-transformed, claude-mem settings) + SDK parity + plugin verify-SHA. See *Claude ecosystem alignment* above.

**Channel 3 (conditional) — `clone-vm-db.sh` on linux-pc**: refreshes the linux-pc bare-metal PostgreSQL clone from the VM. Auto-triggered when `db/migrations/` or `db/seeds/` changed this session; use `--clone-db` to force.

**Resilience**: both channels use `--resilient` — an **unreachable** host is skipped with a warning (catch up manually when it's back); a channel that **fails on a reachable** host is **fail-loud** (the close is not clean — investigate, never bypass). The script exits non-zero on any reachable-host failure; the `handoff` skill must not push on a red exit.

**Flags**:

| Flag | Meaning |
|---|---|
| `--full` | Full re-sync (default: `--delta` propagates only session changes) |
| `--delta` | Only mtime-newer memories + auto-deploy gate (default) |
| `--deploy` | Force PROD deploy on vm + linuxpc (default: `--auto-deploy`) |
| `--auto-deploy` | Deploy only if commits touched `apps\|packages\|db\|scripts\|deploy` |
| `--no-deploy` | Skip deploy entirely |
| `--clone-db` | Force linux-pc DB clone regardless of migration changes |
| `--no-clone-db` | Skip clone-db even if migrations changed |

## Linux server (OCI VM / any amd64 Linux) — public, systemd

```bash
bash scripts/vm-bootstrap.sh          # API :8013, web :3013, systemd units, ufw
```

- DB: native PostgreSQL on `localhost:5432` (the server hosts it).
- Persistence: `heuresys-advanced-api` + `heuresys-advanced-web` systemd units
  (dev-mode, auto-restart, start on boot).
- Manage: `sudo systemctl {status,restart} heuresys-advanced-{api,web}` ·
  `journalctl -u heuresys-advanced-api -f`.
- Override: `REPO_DIR=… PUBLIC_HOST=… API_PORT=… WEB_PORT=… bash scripts/vm-bootstrap.sh`.

### Mappa porte VM (oracle-vm-default) — registro allocazioni

La VM è un host **multi-app**: heuresys-advanced convive con evo legacy, Grafana,
altri progetti e tooling. Census live 2026-06-12 (S984). **Regola**: prima di
deployare QUALSIASI nuovo servizio sulla VM, consultare/aggiornare questa mappa —
una porta "libera" non è una porta "disponibile". Lezione S984: un next-server
estraneo su :3100 ha silenziato lo smoke CI per un giorno (il vecchio healthcheck
`curl -sf` passava contro l'app sbagliata).

| Porta | Servizio | Owner |
|---|---|---|
| 22 / 80 / 443 | sshd · nginx (TLS Certbot: `www.heuresys.com`→3013, `evo.heuresys.com`→3200, `lalibraiascalza.com`→3100) | sistema |
| 3000 | Grafana (docker) | observability |
| **3001** | **RISERVATA CI** — API effimera del job `playwright-smoke` (runner self-hosted) | heuresys-advanced CI |
| 3012 / 3200 / 8012 | evo legacy (web ×2 + api-gateway docker) | heuresys-evo |
| **3013 / 8013** | **PROD heuresys-advanced** (web `next start` + API tsup), systemd `heuresys-advanced-{web,api}` | heuresys-advanced |
| 3100 | La Libraia Scalza (Next.js, systemd `lalibraiascalza.service`) | lalibraiascalza.com |
| **3187** | **RISERVATA CI** — web effimero del job `playwright-smoke` (`PLAYWRIGHT_WEB_PORT`) | heuresys-advanced CI |
| 3847 / 4000 / 37035 / 8200 / 37777 | tooling vario (vibe-kanban, claude-mem worker, ecc.) | tooling |
| 5432 | PostgreSQL 16 nativo (`heuresys_advanced` + `heuresys_platform`) — localhost only | DB |
| 5433 / 6379 / 8020 | docker evo (legacy DB · redis · misc) — localhost only | heuresys-evo |
| 6432 | pgbouncer — localhost only | DB |
| 9090 / 9100 / 9187 | prometheus · node-exporter · pg-exporter (docker) | observability |

I due boot-step del workflow `playwright-smoke.yml` hanno **guard pre-bind**
(fail-loud se la porta risponde prima del nostro boot) + **identity-check**
dell'app servita (marker `heuresys` su `/login`; JSON `"database"` su `/readyz`)
— una nuova collisione produce un errore esplicito, mai un test sull'app sbagliata.

## Mac (Darwin Intel / OpenCore) or Linux desktop — dev, on-demand

```bash
bash scripts/dev-bootstrap.sh         # prepares; ensures tunnel; prints the run cmd
bash scripts/dev-bootstrap.sh --run   # also launches `pnpm dev` (API :3001, web :3000)
```

DB is reached over an SSH tunnel `localhost:5433 → oracle-vm-default:5432`.
No local DB, no persistent service. The script never overwrites local git work
(`pull --ff-only`, skipped if the tree is dirty or ahead).

**Port collision**: if `:5433` is already held by another process (e.g. Docker
Desktop on macOS publishes a local Postgres on `:5433`), the script reuses it
and the API then fails with `database "heuresys_advanced" does not exist`. Use a
free tunnel port: `DB_PORT=5434 bash scripts/dev-bootstrap.sh` (Unix) /
`-DbPort 5434` (Windows).

## Windows — dev, on-demand (PowerShell)

```powershell
pwsh -File scripts\dev-bootstrap.ps1            # prepares; ensures tunnel
pwsh -File scripts\dev-bootstrap.ps1 -Run       # also launches `pnpm dev`
```

Same tunnel + on-demand model as the Unix workstation. Uses an existing
Node ≥22 if present, otherwise installs via `fnm`/`winget`.

## Idempotency

Re-running any script converges to the same state:

- prerequisites install only what is missing (`apt`/`brew`/`winget` assumed present);
- workstation clone uses `pull --ff-only` and **skips if you have local work**;
  the server clone uses `reset --hard` (ephemeral deployment);
- `.env` is normalised to canonical values (no-op if already correct);
- `pnpm install --frozen-lockfile` is deterministic;
- the server's systemd units are re-installed + restarted.

## Cross-platform notes

- `pnpm-lock.yaml` carries native variants for `win32-x64`, `linux-x64`,
  `linux-arm64`, `darwin-x64` and `darwin-arm64`, so `--frozen-lockfile`
  resolves on every target.
- Node 22 is required (a transitive dep of `@heuresys/ui` needs `>=22`); the
  scripts pin it via nvm (Unix) / existing-or-fnm (Windows) and run pnpm via
  corepack. The server keeps the system Node untouched (nvm-scoped).
- Root scripts use `--filter="@heuresys/*"` (double quotes) so the workspace
  filter resolves under both `cmd.exe` and `sh`.
