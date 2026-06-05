# SoT Unification — Design Spec

> **Status**: DESIGN (S965, 2026-06-05). Approved by Enzo (brainstorming, 3 locked decisions). No file moves until the implementation plan is approved.
> **Goal**: collapse the proliferating state/handoff/entry-point `.md` files into **one live SoT per domain**, eliminating manual cross-file alignment and the drift it causes (e.g. `SOT_STATE.md` was 3 sessions stale behind `.handoff/STATE.md` at S965).

## 1. Problem

The repo accumulated overlapping "state" documents that must be hand-aligned every session, and drift anyway:

| File | Size | Last touch (pre-S965) | Role |
|---|---|---|---|
| `docs/kb/SOT_STATE.md` | 23.6 KB | S962 (3 sessions stale) | "live" CLI-owned state (legacy, S939) |
| `.handoff/STATE.md` | 3.9 KB | S965 | condensed state (skill `handoff` + boot hook) |
| `docs/kb/SOT_BACKLOG.md` | 38 KB | S965 | open backlog |
| `docs/kb/DEBT_REGISTER.md` | 10 KB | S962 | technical debts |
| `HANDOFF.md` | 69.6 KB | 2026-05-31 | narrative session history |
| `NEXT_GENERATION_ENTRY_POINT.md` | 48.6 KB | 2026-06-02 | v1.0.0 consolidated record |
| `NEXT_SESSION_MVP_2A.md` | 22 KB | 2026-05-24 | dead entry-point (MVP-2a shipped) |

Root causes: (1) **two** current-state files (`SOT_STATE.md` + `.handoff/STATE.md`) with no single owner — only `.handoff/STATE.md` has an automatic updater (skill `handoff`), `SOT_STATE.md` is updated by hand → it drifts; (2) several dead/historical files linger in root + `docs/kb/` and read as if authoritative.

## 2. Locked decisions (from brainstorming)

1. **One single current-state file** (not file-per-domain-with-overlap, not canonical+generated-views).
2. **`.handoff/STATE.md` is THE single state SoT** — it is already auto-maintained by the `handoff` skill every session (kills the manual-alignment root cause). `SOT_STATE.md` is archived.
3. **Historical/superseded files are archived** to `docs/archive/` (moved, not deleted) with a "⚠ STORICO — non SoT" header.

## 3. Target architecture — 3 live SoT + durable instructions

| SoT | File | Domain | Maintained by |
|---|---|---|---|
| **State** | `.handoff/STATE.md` | current state: last-session brief, top priorities, open questions, stack snapshot, verification | **skill `handoff` (automatic, every session)** |
| **Backlog** | `docs/kb/SOT_BACKLOG.md` | open work items, per-session updates | manual, per session |
| **Debts** | `docs/kb/DEBT_REGISTER.md` | technical debts | manual |
| **Durable instructions** | `CLAUDE.md` | invariants, module pattern, security model, design system, commands, architecture | manual (rare) |

Support files (NOT state SoT, unchanged in role): `docs/kb/INDEX_PATHS.md` (path index), `README.md` (public). The boot hook is unchanged — it only checks git/tunnel/db, it does not read these files.

## 4. What moves to `docs/archive/`

Move (git mv, no deletion), each prefixed with a one-line header `> ⚠ STORICO — non è una SoT. Stato corrente vivo: \`.handoff/STATE.md\`. Backlog: \`docs/kb/SOT_BACKLOG.md\`. Debiti: \`docs/kb/DEBT_REGISTER.md\`.`:

- `docs/kb/SOT_STATE.md` → `docs/archive/SOT_STATE.md`
- `HANDOFF.md` → `docs/archive/HANDOFF.md`
- `NEXT_GENERATION_ENTRY_POINT.md` → `docs/archive/NEXT_GENERATION_ENTRY_POINT.md`
- `NEXT_SESSION_MVP_2A.md` → `docs/archive/NEXT_SESSION_MVP_2A.md`

## 5. Content migration (before archiving SOT_STATE)

`SOT_STATE.md` mixes **durable** content (invariants §9, stack/pattern §2-§3, security §5, CI topology §7, boot prereqs §8) with **volatile** state (counts §4, current versions §2, migration number). Before archiving:

- **Durable** → must already live in `CLAUDE.md`. Audit CLAUDE.md vs SOT_STATE §2/§3/§5/§7/§8/§9; migrate only genuine gaps (CLAUDE.md already carries invariants I1-I14, module pattern, security model, design system, commands — expected gap is small). The §0-bis delta written in S965 is a session record → it goes to the archive with the file, not migrated.
- **Volatile** (counts, versions, migration №, CI status) → already lives in `.handoff/STATE.md` "Stack snapshot". No migration needed.

## 6. Reference re-pointing

Re-point **live operational** references to `SOT_STATE.md` → `.handoff/STATE.md`:

- `CLAUDE.md` (the "live source of truth is docs/kb/SOT_STATE.md" line → `.handoff/STATE.md`)
- `README.md`
- `docs/kb/SOT_BACKLOG.md`
- `docs/kb/DEBT_REGISTER.md`

`docs/kb/INDEX_PATHS.md` is **out of scope** for hand-editing: it is a 154 KB generated index (already stale, 2026-05-28); its `SOT_STATE`/moved-file entries are corrected by a separate index regeneration (non-goal §10), not by hand here.

**Leave untouched** (immutable / historical records — re-pointing them would falsify history): all `docs/architecture/adr/*`, `docs/superpowers/specs/*` and `plans/*`, `qa_artifacts/*`, `sessioni/*`, `cowork_reserved/*`, `cowork_code_exchange/*`, and anything already under `docs/archive/`. Their SOT_STATE references are contextual to when they were written.

## 7. Governance rule (the anti-drift core)

Add a `## Source of Truth` section near the top of `CLAUDE.md`:

```
## Source of Truth (single, per-domain — do not duplicate)
- **Current state** → `.handoff/STATE.md` (the ONLY live state file; auto-maintained by the `handoff` skill each session). Do NOT create parallel state/handoff/entry-point files.
- **Open backlog** → `docs/kb/SOT_BACKLOG.md`.
- **Technical debts** → `docs/kb/DEBT_REGISTER.md`.
- **Durable rules/architecture** → this file (`CLAUDE.md`).
- **Path index** → `docs/kb/INDEX_PATHS.md`. Public overview → `README.md`.
Historical records live in `docs/archive/` and are NOT SoT. When state changes, update the relevant SoT above — never spawn a new file.
```

This is what prevents the proliferation from re-forming.

## 8. Execution steps (ordered, idempotent)

1. Audit `CLAUDE.md` vs `SOT_STATE.md` durable sections; migrate any genuine gap into CLAUDE.md.
2. Add the `## Source of Truth` governance section to `CLAUDE.md`.
3. Re-point the 5 live references (§6) to `.handoff/STATE.md`.
4. `git mv` the 4 historical files (§4) into `docs/archive/`, prepend the "⚠ STORICO" header to each.
5. Verify (§9), then atomic commit(s) + push + CI.

## 9. Verification / exit criteria

- `grep -rl "SOT_STATE" --include="*.md"` over **live** dirs (root, `docs/kb`, `README.md`, excluding `INDEX_PATHS.md` + archive/adr/specs/plans/qa/sessioni/cowork) returns **0** (all live refs re-pointed).
- The 4 archived files are under `docs/archive/` with the header; root + `docs/kb/` no longer contain dead state files.
- `.handoff/STATE.md`, `SOT_BACKLOG.md`, `DEBT_REGISTER.md` remain valid and current.
- CLAUDE.md has the `## Source of Truth` section and no longer points to `docs/kb/SOT_STATE.md` as the live SoT.
- No build/test impact (docs-only) — but push triggers CI; it must stay green (lint/typecheck/build are docs-insensitive but confirm).

## 10. Risks & non-goals

| Risk | Mitigation |
|---|---|
| Re-pointing breaks an immutable ADR/spec record | Don't touch ADR/specs/plans/qa/sessioni/cowork (§6); only 5 live files |
| Durable content lost when SOT_STATE archived | §5 gap-audit into CLAUDE.md before the move; archive keeps the full file anyway |
| Losing a useful historical milestone record | Archived (moved, not deleted) — fully retrievable in `docs/archive/` + git history |

**Non-goals**: regenerating/pruning `INDEX_PATHS.md` (stale but separate concern — own task); changing the `handoff` skill or boot hook (they already target `.handoff/STATE.md` correctly); touching `cowork_*` archives (frozen read-only).
