# ADR-0021 — SSH tunnel automation via restricted service-account key (B-31 / CW-B62 closure)

**Status**: ACCEPTED
**Date**: 2026-05-28
**Author**: CLI session (session-boot hands-off, S944)
**Related**: B-31 (SOT_BACKLOG ssh-agent persistence), CW-B62 (passphrase non-interactive gap), ADR-0010 (PostgreSQL runtime on OCI VM), RD-25 (Option B active runtime)
**Triggered by**: Non-fluid session start — the SSH tunnel `localhost:5433 → oracle-vm-default:5432` (the only path to the live PostgreSQL per ADR-0010 Option B) is not persistent and was down at boot, requiring manual `ssh -fN -L ...`. The passphrase-protected `oci_recovery_ed25519` cannot be loaded into ssh-agent non-interactively after a Windows reboot (CW-B62), so the tunnel could not be made hands-off without a key strategy change.

---

## §1 — Context

Per ADR-0010 (Option B / RD-25), the live database is PostgreSQL 16 native on `oracle-vm-default`, reachable from the developer workstation only through an SSH local-forward on port 5433. Every dev-server run and the entire `apps/api` integration test suite (52 files, no mocks) depend on this tunnel being up.

Two facts made the tunnel a recurring boot friction:

1. **No persistence.** The tunnel is opened on-demand (`scripts/dev-bootstrap.ps1` via `Start-Process ssh`, or a manual `ssh -fN`). Both die on logout/reboot. There is no `ControlPersist`, no Windows scheduled task, no auto-heal. The global SessionStart hook (`session-bootstrap.ps1`) only *reports* the port state (`[DOWN]`), it does not open it.
2. **Passphrase blocks automation (CW-B62).** The standing key `oci_recovery_ed25519` is passphrase-protected. ssh-agent retains it across terminal sessions while the agent runs, but a Windows reboot empties it, and the passphrase cannot be supplied non-interactively via the CLI/MCP stdio. So any unattended tunnel-open hangs after a reboot.

B-31 was the open backlog item tracking this; no ADR existed. The user selected the "hands-off totale" target: a session must open with the tunnel already up and the DB reachable, with zero manual interaction, even after a reboot.

---

## §2 — The security question: is a no-passphrase key acceptable?

Hands-off automation across reboots is incompatible with a passphrase that only a human can supply. The options are (a) cache/inject the passphrase from a secret store, (b) use a no-passphrase key. Option (a) on Windows means Credential Manager + a wrapper that feeds `ssh-add` — fragile, and the cleartext passphrase still transits memory; it does not remove the secret-at-rest, it moves it. Option (b) puts a private key in cleartext on disk.

A cleartext private key is only as dangerous as what it can do. The standing `oci_recovery_ed25519` grants a full interactive shell on the VM — unacceptable to leave passphrase-free. But a **dedicated key whose authorization is restricted to a single port-forward** grants no shell, no other forwards, no agent/X11 forwarding. Its blast radius if stolen is: open a TCP forward to `localhost:5432` of a VM that is already behind the cloud firewall and SSH. That is an acceptable trade for full hands-off automation.

---

## §3 — Decision

**Introduce a dedicated, no-passphrase, capability-restricted SSH key used solely for the PostgreSQL tunnel.** The passphrase-protected `oci_recovery_ed25519` remains the key for all interactive/administrative access; it is unchanged.

- New keypair `~/.ssh/heuresys_tunnel_ed25519` (ed25519, empty passphrase), comment `heuresys-tunnel-noauth`.
- Authorized on `oracle-vm-default` with a forced-restriction line:

  ```
  command="echo tunnel-only-key",no-pty,no-agent-forwarding,no-X11-forwarding,no-user-rc,permitopen="127.0.0.1:5432" ssh-ed25519 AAAA...<pub>... heuresys-tunnel-noauth
  ```

  - `command="echo tunnel-only-key"` — any session/exec channel runs only the echo and exits; no shell is ever obtainable with this key.
  - `no-pty,no-agent-forwarding,no-X11-forwarding,no-user-rc` — no terminal, no agent/X11 forwarding, no `~/.ssh/rc` execution.
  - `permitopen="127.0.0.1:5432"` — the **only** forward allowed is to the PostgreSQL socket, so `ssh -N -L 5433:127.0.0.1:5432` works and nothing else does.
  - **Why not `restrict`?** Empirically on OpenSSH 9.6 (Ubuntu 24.04) `restrict,permitopen=...` left the forward `administratively prohibited` — `restrict` disables port-forwarding and `permitopen` did not re-enable it in this combination (verified via `ssh -vv` + a control test with the unrestricted admin key). The explicit `no-*` flags give equivalent lock-down while leaving the permitopen'd forward usable.
  - **Why `127.0.0.1` and not `localhost`?** `permitopen` is matched IP-literally and PostgreSQL on the VM listens on `127.0.0.1:5432`; the forward destination must be the literal IP, not the name.

- New SSH host alias `heuresys-tunnel` (HostName `80.225.82.207`, User `ubuntu`, `IdentityFile` = the new key, `ExitOnForwardFailure yes`). `IdentitiesOnly yes` is already global in `Host *`, so this alias uses only its dedicated key.

**Persistence is two-layered:**

1. **Primary — Windows scheduled task** `HeuresysTunnel5433`, trigger *At Logon* (user, hidden), action `scripts/tunnel-keepalive.ps1` — a supervised loop that runs `ssh -N -L 5433:localhost:5432 heuresys-tunnel` and restarts it with backoff if it drops. Survives reboot.
2. **Fallback — SessionStart hook in the Windows user-global settings** (`~/.claude/settings.json` → `scripts/session-boot.ps1`, added beside the existing `session-bootstrap.ps1`): if `:5433` is down at session start it re-opens it (the no-passphrase key never blocks), verifies/creates `.pgpass`, smoke-checks the DB, and prints a compact status. It **self-guards** — exits immediately unless the CLI's project is this repo, since the global hook fires for every project. Deliberately kept **out of the repo** (not in `.claude/settings.json`): a committed `powershell.exe` hook would error on every Mac/VM session. Idempotent; harmless when the task already holds the tunnel.

`.pgpass` (`~/.pgpass` + `%APPDATA%\postgresql\pgpass.conf`, ACL-restricted) is created from `.env`'s `POSTGRES_PASSWORD` so ad-hoc `psql` against `:5433` works without inline credentials.

This closes B-31 and reclassifies CW-B62 to MITIGATED.

---

## §4 — Alternatives considered

### Alt-1 — Passphrase injection from Windows Credential Manager
A wrapper reads the passphrase from Credential Manager and feeds `ssh-add` at logon.
**Rejected**: does not remove the secret-at-rest (cleartext passphrase in CredMan + in process memory), adds a fragile moving part, and still relies on the full-shell key for the tunnel — larger blast radius than a restricted key, for more complexity.

### Alt-2 — `ControlMaster`/`ControlPersist` on the existing key
Pool and persist the SSH connection via the standing key.
**Rejected**: solves connection reuse, not *unattended open after reboot* — the first connection still needs the passphrase. Orthogonal to the actual gap.

### Alt-3 — Run the tunnel as a Windows service with the standing key
**Rejected**: a service runs as SYSTEM (no access to the user `.ssh` profile / agent) or needs stored user creds; still hits the passphrase problem. An At-Logon user task is simpler and has the right profile context.

### Alt-4 — Status quo (manual open each boot)
**Rejected**: that is exactly the friction this ADR removes; recurring, error-prone, and blocks unattended runs.

---

## §5 — Consequences

### Positive
- **True hands-off boot**: tunnel up across reboots; sessions open DB-ready with no interaction.
- **Minimal blast radius**: the cleartext key can only forward to Postgres — no shell, no pivot, no other forward.
- **Separation of duties**: interactive/admin access stays on the passphrase-protected key; automation uses the restricted key.
- **Ad-hoc `psql` works** without leaking credentials on the command line.

### Negative
- **A cleartext private key exists on disk.** Mitigated by capability restriction; documented here as an accepted, bounded risk. If the workstation is compromised, the attacker already has the running tunnel anyway.
- **Two persistence layers** (task + hook) is mild redundancy — deliberate, so a missing/late task still yields a working session.
- **VM-side state** (`authorized_keys` line) is not in the repo; it is reproduced by the setup script. Documented in §6.

### Neutral
- No code (`*.ts`) is touched → typecheck/test surface unchanged; the tunnel the test suite already needs simply becomes reliably present.

---

## §6 — Implementation

- **ADR** — this file.
- **`scripts/setup-tunnel-automation.ps1`** — idempotent one-shot: generate keypair if absent; install the restricted `authorized_keys` line on `oracle-vm-default` (via the admin key already in agent), or print it for manual paste if not; append the `heuresys-tunnel` block to `~/.ssh/config` if absent; create `.pgpass` (both locations, `icacls`-restricted) from `.env`; register/refresh the scheduled task (`-Force`).
- **`scripts/tunnel-keepalive.ps1`** — supervised `ssh -N -L 5433:localhost:5432 heuresys-tunnel` loop with backoff + log; the scheduled-task action.
- **`scripts/session-boot.ps1`** — SessionStart fallback + status report.
- **`~/.claude/settings.json`** (Windows user-global, **NOT committed**) — a second `SessionStart` command → `session-boot.ps1`, beside the existing `session-bootstrap.ps1`. Windows-only by design; `session-boot.ps1` self-guards to this repo so it no-ops for other projects.
- **VM** — restricted line appended to `/home/ubuntu/.ssh/authorized_keys` (additive, idempotent: skip if the comment already present).

## §7 — Verification

```text
# Restricted key cannot get a shell, can only forward to Postgres:
ssh heuresys-tunnel whoami                          # => prints "tunnel-only-key", NOT "ubuntu"; NO shell
ssh -N -L 5433:127.0.0.1:5432 heuresys-tunnel       # => tunnel up (forward to 127.0.0.1, the permitopen'd target)
ssh -N -L 1234:127.0.0.1:22  heuresys-tunnel        # => "administratively prohibited" (permitopen denies)

# pgpass works without PGPASSWORD:
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "select 1"   # => 1

# Reboot resilience:
Stop tunnel; Start-ScheduledTask HeuresysTunnel5433   # => tunnel back up, no prompt

# Idempotency:
setup-tunnel-automation.ps1   (run twice)   # => no dupes in config / authorized_keys / task
```

## §8 — Related decisions
- **ADR-0010** — PostgreSQL runtime on OCI VM (the reason a tunnel exists at all).
- **B-31 / CW-B62** — the backlog item and bias entry this ADR closes.
- **RD-25** — Option B active runtime decision.
