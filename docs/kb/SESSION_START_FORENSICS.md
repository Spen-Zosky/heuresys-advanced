# Session-start forensics — why "avvia sessione" was slow, and what changed

**Date**: 2026-07-07 · **Method**: inline measurement + a 5-agent forensic workflow (4 parallel profilers — MCP-startup, context-surface, doctrine/scripts, plugin-bloat — + 1 adversarial verifier of the time-budget attribution). Read-only investigation; fixes applied after.

## TL;DR

Typing **"avvia sessione"** took **>20 min**. The deterministic scripts are **not** the cause (~12 s total). The dominant cost is a **product**, not a single slow tool:

> **(number of sequential model rounds imposed by the session-start doctrine) × (decode time per round at xhigh/ultracode).**

The old doctrine forced ~4–10 model rounds on a *mechanical* checklist (Read 4 raw state files → run `build_menu.py` → run `status_dashboard.py` → aggregate → present menu). At xhigh, each round burns thousands of thinking tokens; 4–10 rounds × 1–4 min ≈ 10–20 min of pure model latency — more than any MCP startup. Serena, first suspected as the "smoking gun", is a one-shot addend (estimated 30–90 s, **never measured** at `start-mcp-server`; the only real datum is 3.4 s on `--help`) and cannot by itself produce 20 min. MCP servers likely spawn in **parallel** (≈ max, not sum).

Second-order honesty: the CLI **prompt-cache** amortizes the stable injected surface after round 1, so the huge always-loaded context costs mostly a **one-shot cache-write** + a decode tax — not a full re-prefill every turn as a naive token count suggests.

## Time-budget attribution (~20 min)

| Bucket | Estimate | When | Basis |
|---|---|---|---|
| Model-decode at xhigh × N doctrine rounds | ~9–14 min (55–70%) | per-turn | inferred |
| MCP startup one-shot (serena + playwright npx + claude-mem daemon + 4 http/sse handshakes) | ~1.5–3.5 min (10–17%) | one-shot | estimated |
| Per-turn context/KV tax (cache-read ~52k tok surface) | ~1–2.5 min (8–13%) | per-turn | inferred |
| First-turn cache-WRITE of the injected surface (~72k tok) | ~20–60 s (2–5%) | one-shot | inferred |
| Cold-cache confound (uvx git-fetch serena + npx `@latest` at first session post-reboot) | 0–3 min variable | one-shot | estimated |
| Network probes of `status_dashboard` (git-fetch 25s + gh 30s + 2×curl 6s) | ~5–15 s typ (tail-risk ~67 s) | mixed | **measured** |
| SessionStart hooks (6.1 s) + deterministic scripts (~1 s) | ~12–18 s (~1%) | one-shot | **measured** |

**Missing evidence that would nail it** (not obtainable from inside a tool call): harness per-round timestamps (session-open → each MCP "tools advertised" → each model round start/end → menu presented) and per-round token counts (cache-write vs cache-read vs thinking/output). Until then, the dominant row is *inferred*, not measured — stated honestly.

## Measured ground-truth (deterministic pieces)

| Component | Time | Note |
|---|---|---|
| hook `session-bootstrap.ps1` | 2614 ms | informational banner |
| hook `session-boot.ps1` | 2728 ms | tunnel + pgpass + `select 1` + git + `handoff_lint --warn-only` + journal |
| hook `chrome-devtools-npx-bypass.ps1` | 754 ms | npx→node bypass (already mitigated) |
| `handoff_lint.py` | 365 ms | **also run by the boot hook** → duplicated |
| `build_menu.py` | 238 ms | — |
| `status_dashboard.py` full | 5553 ms | ~5.1 s is network (git-fetch+gh+curl); `--no-net --no-db` = 416 ms |
| serena `uvx … --help` | 3367 ms | `start-mcp-server` (LSP-index of 972 `.ts/.tsx`) NOT measured; est. 30–90 s |
| playwright `npx @playwright/mcp@latest --version` | 5400 ms warm | cold ~30 s (`@latest` re-resolves; browsers already installed) |
| claude-mem daemon boot | ~2300 ms | transient, idle-exit 5 s; no chroma/timeout error in current `daemon.log` |

**Always-loaded context surface** (per turn, mostly cache-amortized after round 1): global CLAUDE.md ~7.3k tok · project CLAUDE.md ~10.4k tok (pre-slim) · MEMORY.md ~2.2k · injected agent-types (152) ~9.9k · injected skills (~200) ~20k · deferred MCP tools ~4k · claude-mem session context (50 obs) ~19k one-shot. Removable-at-zero-loss ≈ 15–18k tok (129 inert agent-types + 144 inert skills, none of which mount MCP).

## Over-engineering verdict

**Present, in the boot *process* — not in the tools:**
1. The doctrine reads 4 raw files (429 KB, of which ~130 KB pure historical archive in `SOT_BACKLOG.md`) **and** then runs two scripts that distill the same data → triple representation in context, re-derived every session inside xhigh reasoning.
2. Footprint disproportionate to the work: 23 plugins / 152 agents / ~200 skills / 9 marketplaces for a TS/Fastify/Postgres HRMS — voltagent (Rust/Go/blockchain agents), trailofbits (C/crypto fuzzing + 2 `Stop`/`SubagentStop` prompt hooks), example-skills (slack-gif, algorithmic-art): inert over-provisioning.
3. Running a *mechanical* boot checklist at xhigh/ultracode = a sledgehammer for a shopping list.

**Justified, not touched**: invariants I1–I20 + module pattern + security model; the tunnel+DB boot hook; `status_dashboard`'s "re-derive live, never trust a cached number" philosophy (only its *boot-time network run* was the issue, not the tool); `handoff_lint`'s integrity checks (valid — just run once); the existence of serena/playwright/claude-mem (legit — lazy-load, don't keep always-on).

## Fixes applied (2026-07-07, all reversible)

| # | Fix | Change | Effect |
|---|---|---|---|
| 1 | **Collapse the doctrine** | New `docs/kb/tools/session_start.py` = menu (`build_menu`) + health (`status_dashboard`) in **one process, one round**, `--no-net` at boot. CLAUDE.md "Session start" rewritten: run one command; **do NOT read the big raw state files at boot** — drill-down only for the chosen item. | Cuts the dominant multiplier: ~4–10 rounds → ~1–2. Boot view: 2978 ms. |
| 3 | **No boot-time network** | Boot health runs `--no-net` (git-fetch/CI/PROD are on-demand via `pnpm status` or `session_start.py --net`). | −5–15 s + removes ~67 s tail-risk timeout. |
| 2+4 | **Prune inert plugins** | `~/.claude/settings.json` enabledPlugins **40 → 17**: disabled 6 voltagent + 11 trailofbits + codebase-audit-suite + optimization-suite + example-skills + karpathy (inert); serena + playwright set to lazy-load (re-enable on demand for symbol-nav / E2E). None mount MCP except serena/playwright. | −~15–18k tok injected surface; serena/playwright no longer start at every boot. Takes effect next CLI restart. |
| 6 | **Slim project CLAUDE.md** | 270→236 lines (−5.8 KB). Extracted the Design-System-X18 narrative → `docs/kb/DESIGN_SYSTEM_UI.md`, the R23 project detail → `docs/kb/AUTONOMY_R23_PROJECT.md`; compacted the (shipped) MVP-2a/2b doctrine to a pointer to `docs/archive/NEXT_SESSION_MVP_2A.md` (**fixing a stale "repo root" pointer**). All operative rules kept inline. | −~1.4k tok always-loaded; zero rule loss. |
| 7 | **Trim claude-mem inject** | `CLAUDE_MEM_CONTEXT_OBSERVATIONS` 50 → 12. | −~14k tok one-shot at session start. Takes effect next CLI restart. |

Backups: `~/.claude/settings.json.bak-forensic-20260707`, `~/.claude-mem/settings.json.bak-forensic-20260707`. Revert = restore the backup (or flip the keys back) + `git revert` the repo commit.

## Recommendation NOT auto-applied (needs your choice)

- **#5 — reasoning effort at boot**: the biggest lever alongside #1 is *not running the mechanical boot at xhigh/ultracode*. This is a **session-global** choice (`/effort`), not something a script can force. **Habit to adopt**: start a session at a lower effort, bump to xhigh only when the chosen work-item starts. `settings.json` `effortLevel` is left at `xhigh` (your deliberate default) — untouched.
- **claude-mem Chroma at boot**: left enabled (the `mem-search` skill relies on it; no current flakiness in `daemon.log`). Disable only if the 180 s-timeout flakiness recurs.

## Unrelated discovery (flagged, not chased)

When the boot health view actually reached the DB (the initial boot probe had falsely reported psql unreachable), `status_dashboard` reported **`integrità: 6 viste strutturali = 4 righe in violazione`** — a structural-invariant violation (`sys.v_*` validation views should be 0 rows). This is a **pre-existing data concern unrelated to the session-start work**; it was reported for a separate decision, not fixed here (scope discipline).
