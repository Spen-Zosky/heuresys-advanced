# Session modes — `canonical` and `lab`

Two sessions can run on this working tree **at the same time**: one developing, one doing
read-only analysis. Before this existed, the end-of-turn verify gate read the whole shared tree and
blocked *both* — a session that never touched code was told to run the other session's test suite.

A session now **declares itself** with its first message:

| First message | Mode | What the system does |
|---|---|---|
| `avvia sessione` | `canonical` | development as always: action menu, verify gate active, code + commits allowed |
| `avvia sessione lab` | `lab` | analysis: verify gate skipped **for this session only**, writes blocked at the tool layer |
| anything else | `canonical` | **fail-safe** — forgetting the command never opens a hole |

> **A page that lags behind the code is worse than no page** (lesson paid twice): a guard being
> right does not help if what people read is wrong. Whoever changes the modes changes this table in
> the same commit.

## The two modes are not two permission levels

Only `lab` relaxes the verify gate, and only because it is the mode that does not write to the repo.
`canonical` goes through the gate in full. A first message that is neither of the two — a typo, a
withdrawn command, a language variant — is **not an error**: it falls back to `canonical`, the least
permissive of the two. Degrading downwards is the whole point.

## How it works

The mode is **state on disk keyed by `session_id`**, not a promise the model remembers:

```
<parent of repo>/.heuresys-session-mode/<session_id>.json
```

Outside the repo on purpose: it never dirties the working tree and never propagates to clones
(machine state, not configuration). `session_id` arrives in every hook payload, so two concurrent
sessions get different treatment in the same instant.

| Hook | Script | Behaviour |
|---|---|---|
| `UserPromptSubmit` | `hook.sh prompt-hook` | recognises the two commands, **writes the marker**, injects the mode brief |
| `PreToolUse` (`*`) | `hook.sh lab-guard` | inert unless `lab`; in `lab` denies writes (exit 2 + reason) |
| `Stop` / `SubagentStop` | `hook.sh stop-gate` | `lab` ⇒ silent; otherwise delegates to `verify_gate.py check --hook` **verbatim** |

Wired in `.claude/settings.local.json` (tracked by git despite the name → reaches VM and linux-pc
with a normal `git pull`).

Because `UserPromptSubmit` runs *before* the model sees the message, the mode switch is deterministic
— it does not depend on the model deciding to invoke anything.

### Fail-safe

Missing marker, corrupt marker, no `session_id`, unresolvable Python interpreter ⇒ **`canonical`**.
A malfunction always falls back to the stricter behaviour, never to the permissive one.

### Portability

`hook.sh` resolves the Python interpreter by **probing**, not by assuming: on Linux `python` often
does not exist, and on Windows `python3` is the Microsoft Store stub that executes nothing. Probe
order is OS-dependent (Windows never probes `python3` first) and the winner is cached in the mode
directory.

## `lab` constraints

**Reading has no limits.** Source, routes, endpoints, contracts, frontend, config, CI, migrations,
live schema and data, legacy DB, generated artifacts, `.env`, git history, docs — all readable.
*A blocked read is a defect in the guard, not a precaution.* The guard is a **deny list**, never an
allow list.

Denied in `lab`: writes outside the lab directory · mutating git · `pnpm test|typecheck|lint|build|dev|db:*`
· direct runners (`vitest`, `tsc`, `eslint`, `next`) · `verify_gate.py run` · non-`SELECT` SQL and
`psql -f` · deploy / clone-alignment / service restarts · filesystem mutations and redirections
targeting the repo · the `handoff`, `zero-pending-loop`, `full-alignment-deploy` skills.

Authenticated browsing **is allowed** (Chrome first, Playwright second): a lab session logs in as a
real person and navigates the profile's interfaces. The login writes an auth/audit row — that is the
only write a lab session produces, and it is authorised. `pnpm test:e2e*` stays denied: those scripts
run `next build` first and would write `.next/` into the repo. Playwright must point at a config and
output directory inside the lab directory.

**Limit of guarantee, stated**: no hook can tell a click on "Filter" from a click on "Delete".
Filesystem, git, database and commands are enforced; *not mutating through the UI* is a rule of
conduct, not a mechanical block.

## Diagnostics

```bash
sh scripts/hooks/hook.sh mode <session_id>     # current mode
sh scripts/hooks/hook.sh selftest              # guard decisions + fail-safe + parser
sh scripts/hooks/hook.sh gc                    # drop markers older than 14 days
bash scripts/test/run-shell-tests.sh           # full gate, includes the section below
```

The regression tests live in `scripts/test/run-shell-tests.sh`, section *session modes*. The
load-bearing one asserts the two treatments are **opposite** under the same dirty tree: lab silent,
canonical byte-identical to `verify_gate.py check --hook`. A change that merely silenced the gate for
everyone would pass a naive check and fail that one.
