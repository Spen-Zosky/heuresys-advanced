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
