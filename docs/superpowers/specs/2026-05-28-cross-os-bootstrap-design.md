# Cross-OS Idempotent Bootstrap — Design Spec

> Status: approved design (2026-05-28). Drives the implementation plan in
> `docs/superpowers/plans/`. Server piece (`scripts/vm-bootstrap.sh`) already
> exists (commit `2ccaaf9`, unpushed) and is folded into this design.

## Goal

One coherent, **idempotent** bootstrap system that clones, installs, and runs
heuresys-advanced reproducibly across **all of Enzo's environments**:

- **Windows** (PowerShell-first dev workstation)
- **Mac** — Darwin on Intel x86_64, native OSX *or* OpenCore/hackintosh (dev workstation)
- **Linux arm64** (the OCI VM `oracle-vm-default` — persistent public server)
- **Linux amd64** (any x86_64 Linux host — server or desktop)

"Idempotent" = safe to re-run any number of times; each run converges the host
to the same healthy state, never duplicating or breaking existing state.

## Context & decisions (from brainstorming, 2026-05-28)

- **DB model = central VM DB + tunnel** (ADR-0010 Option B / RD-25). PostgreSQL
  lives once, natively, on the VM (`localhost:5432`). The VM is the persistent
  public server. Every workstation (Win/Mac/Linux-desktop) runs the stack in
  **dev, on-demand**, against the VM DB via an SSH tunnel (`localhost:5433` →
  `VM:5432`). Workstations do **not** host a local DB and do **not** run
  persistent services.
- **Prerequisite policy = assume the OS package manager + git; install the rest.**
  The scripts assume `apt`/`brew`/`winget` exist, then install Node 22 (via a
  Node version manager), pnpm (via corepack), build tools, and manage the tunnel.
- **Structure = twin-by-role**, matching the repo's existing `db/scripts/*.{ps1,sh}`
  convention.

## Roles & target matrix

| Target | Script | Role | DB | API/Web ports | Persistence | Public |
|---|---|---|---|---|---|---|
| OCI VM (Linux arm64) + any Linux amd64 server | `scripts/vm-bootstrap.sh` | server | local `:5432` | API `8013` / web `3013` | systemd (api+web) | yes (ufw 8013/3013) |
| Mac (Darwin Intel / hackintosh) | `scripts/dev-bootstrap.sh` (detect Darwin) | workstation | tunnel `5433`→VM | API `3001` / web `3000` | none (on-demand) | no |
| Linux desktop (arm64/amd64) | `scripts/dev-bootstrap.sh` (detect Linux) | workstation | tunnel `5433`→VM | API `3001` / web `3000` | none (on-demand) | no |
| Windows | `scripts/dev-bootstrap.ps1` | workstation | tunnel `5433`→VM | API `3001` / web `3000` | none (on-demand) | no |

Workstations use the repo's default local ports (API `3001`, web `3000`) — the
`8013`/`3013` numbering is VM-public-specific. `apps/showcase` is out of scope
(static export → GitHub Pages, not a dev service); workstations run `apps/api` +
`apps/web` only.

## Shared logical steps (both roles)

```
0. prerequisites   assume pkg-manager; ensure git, build tools, a Node-22 manager,
                   Node 22 active, corepack-provided pnpm
1. clone-or-update idempotent: if .git exists -> fetch + reset --hard origin/<branch>;
                   else clone. Preserves gitignored secrets.
2. secrets check   require .env + .secrets/{jwt_private,jwt_public}.pem (out-of-band,
                   never committed). Fail with scp instructions if missing. Tighten perms.
3. normalise .env  role-specific (see below), in-place, idempotent (no-op if correct)
4. install         pnpm install --frozen-lockfile (cross-platform lockfile)
5. run             SERVER: render + install systemd unit templates, daemon-reload,
                   enable, restart.
                   WORKSTATION: ensure SSH tunnel (5433) up. By default END here in a
                   "ready" state and print the `pnpm dev` command — do NOT block on /
                   spawn a dev server (so re-runs never create duplicate processes).
                   Optional `--run` flag launches `pnpm dev` in the foreground.
6. verify          SERVER: curl /healthz (+ /readyz db check).
                   WORKSTATION: probe tunnel (5433) reachable + report Node/pnpm versions;
                   /healthz only checked when `--run` was used.
```

### `.env` normalisation by role

- **Server:** `POSTGRES_HOST=localhost`, `POSTGRES_PORT=5432` (local native PG),
  `PORT=8013`, plus public origins (handled by the systemd web unit env:
  `NEXT_PUBLIC_API_PROXY_BASE_URL=http://localhost:8013`,
  `NEXT_PUBLIC_API_BASE_URL=http://<PUBLIC_HOST>:8013/v1`).
- **Workstation:** `POSTGRES_HOST=localhost`, `POSTGRES_PORT=5433` (tunnel),
  `PORT=3001`, `ADMIN_ORIGIN=http://localhost:3000`,
  `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/v1`.

## Per-OS adapters (the divergence, encapsulated)

| Concern | Linux | Mac (Darwin) | Windows (PowerShell) |
|---|---|---|---|
| package install | `apt-get install -y` | `brew install` | `winget install` (fallback `scoop`) |
| Node 22 manager | `nvm` (auto-install if absent) | `nvm` (or `brew`) | existing Node ≥22 if present, else `fnm`/`winget` |
| pnpm | corepack (`corepack enable`) | corepack | corepack |
| edit `.env` in place | GNU `sed -i -E` | BSD `sed -i '' -E` | PowerShell `(Get-Content) -replace ... | Set-Content` |
| build tools (argon2 fallback) | `build-essential python3` | Xcode CLT (`xcode-select --install` hint) | prebuilt (MSVC build tools hint only if needed) |
| SSH tunnel | `ssh -fN -L 5433:localhost:5432 oracle-vm-default` | same | same (Windows OpenSSH client) |
| persistence (server only) | systemd unit templates | n/a (server is Linux-only) | n/a |

A small `sed-i` portability helper (GNU vs BSD detection via `sed --version`)
keeps `dev-bootstrap.sh` correct on both Linux and macOS.

## DB & tunnel model (workstation)

- Workstation `.env` uses the **tunnel block**: `POSTGRES_HOST=localhost`,
  `POSTGRES_PORT=5433`.
- The bootstrap **ensures the tunnel idempotently**: probe `localhost:5433`
  (`Test-NetConnection` on Windows; `/dev/tcp` or `nc` on Unix). If up → skip.
  If down → attempt `ssh -fN -L 5433:localhost:5432 oracle-vm-default`. If SSH
  needs an interactive passphrase and no agent is loaded → stop with a clear
  instruction (cannot auto-open non-interactively).
- The single source-of-truth DB stays on the VM; all workstations share it.
  Mac/Windows reach the VM over SSH (both already have OCI access).

## File map

| File | Responsibility | Status |
|---|---|---|
| `scripts/vm-bootstrap.sh` | Linux **server** role: prereqs, nvm Node 22, corepack pnpm, clone, secrets, local-DB `.env`, install, render+install systemd units, restart, verify. | exists (`2ccaaf9`) — verify on push |
| `scripts/dev-bootstrap.sh` | **Unix workstation** (Mac Darwin + Linux desktop): OS-detect (brew/apt, BSD/GNU sed), prereqs, Node 22, corepack pnpm, clone, secrets, tunnel `.env`, ensure tunnel, install, `pnpm dev`. | new |
| `scripts/dev-bootstrap.ps1` | **Windows workstation**: winget/scoop prereqs, Node 22 (existing/fnm/winget), corepack pnpm, clone, secrets, tunnel `.env` (PS replace), ensure tunnel (`Test-NetConnection`), install, `pnpm dev`. | new |
| `deploy/systemd/heuresys-advanced-{api,web}.service` | dev-mode unit templates (server) | exists (`2ccaaf9`) |
| `scripts/lib/*` (optional) | shared bash helpers (logging, sed-i portability, tunnel probe) if duplication grows | optional |

## Idempotency contract

Every step is a converge-to-desired-state operation, not an append:

- **clone**: `reset --hard origin/<branch>` → clean tree at remote HEAD; gitignored
  `.env`/`.secrets/` untouched.
- **prereqs**: install only what `command -v` / `Get-Command` reports missing.
- **Node**: `nvm install`/manager install is a no-op when the version exists.
- **`.env`**: anchored `sed`/`-replace` sets canonical values; re-applying is a no-op.
- **install**: `--frozen-lockfile` is deterministic.
- **systemd**: `install` overwrites unit + `daemon-reload` + `restart` (same result each run).
- **tunnel**: opened only if the port probe shows it down.

Result: N consecutive runs == 1 run, on a healthy host.

## Verification matrix

| Target | Live-testable here | Method |
|---|---|---|
| Linux arm64 (OCI VM) | ✅ | run `vm-bootstrap.sh` on the VM (idempotent re-run after the manual setup) |
| Windows | ✅ | run `dev-bootstrap.ps1` on this machine |
| Mac (Darwin Intel) | ✅ | SSH `mac-local`, run `dev-bootstrap.sh` |
| Linux amd64 | ❌ (no host available) | correctness **by construction**: cross-platform lockfile (x64+arm64 native variants verified present) + arch-agnostic toolchain (nvm/corepack/apt); shares the exact Linux code path live-tested on arm64 |

A live amd64 verification can be added later if/when an x86_64 Linux host is available.

## Out of scope (YAGNI)

- Per-machine local PostgreSQL (decided: central VM DB).
- Persistent services on workstations (launchd / Windows Service / systemd-user) —
  on-demand `pnpm dev` only; can be added later as a focused follow-up.
- `apps/showcase` as a runtime service (it ships via GitHub Pages static export).
- A Windows *server* role (the server role is Linux-only by design).

## Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| SSH tunnel needs interactive passphrase on a workstation | med | med | probe-then-attempt; on failure print exact `ssh-add` / tunnel command (no silent hang) |
| Windows Node manager variance (nvm-windows/fnm/winget) | med | low | prefer existing Node ≥22; else fnm (cross-platform) with winget fallback; corepack handles pnpm uniformly |
| amd64 not live-tested | low | med | cross-platform lockfile verified; same Linux path as arm64; flag as "by construction" |
| BSD vs GNU `sed -i` breakage on Mac | low | med | sed-i portability helper detecting GNU vs BSD |
| brew/winget not present on a "fresh" box | low | low | per prereq policy these are assumed; script errors early with a clear message |
