# SoT Unification — Design Spec

> **Status**: DESIGN v2 (S965, 2026-06-05). v1 (archive SOT_STATE, single condensed file) was implemented in `e7e9de3` then **revised** — Enzo flagged that the condensed `STATE.md` lost SOT_STATE's granularity. **See §11 for the authoritative v2 design** (two handoff-governed views). §1-§10 below are the v1 record (partially superseded by §11).
> **Goal (v2)**: keep BOTH a rapid view (`.handoff/STATE.md`) AND a granular snapshot (`docs/kb/SOT_STATE.md`), with **disjoint domains** + a **single updater** (the `handoff` skill writes both, same moment) → granularity preserved AND drift structurally impossible.

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

**Non-goals**: regenerating/pruning `INDEX_PATHS.md` (stale but separate concern — own task); changing the boot hook (it only checks git/tunnel/db); touching `cowork_*` archives (frozen read-only). *(v1 non-goal "changing the handoff skill" is superseded by v2 §11.)*

---

## 11. v2 design (AUTHORITATIVE) — two handoff-governed views

v1 (single condensed `STATE.md` + archive SOT_STATE) preserved no-drift but lost SOT_STATE's granularity. v2 keeps **two views**, disjoint, **both written by the `handoff` skill** each session — granularity AND no-drift.

### 11.1 Two views — disjoint domains (no fact in both)

| File | Domain (ONLY this) |
|---|---|
| `.handoff/STATE.md` | VOLATILE work state: last-session brief · top priorities (+effort) · open questions · verification commands. **Zero numbers/counts/stack.** <60 lines, rapid bootstrap. |
| `docs/kb/SOT_STATE.md` | GRANULAR system snapshot: git/release+tags · full stack versions · API/DB/web/CI counts · security · boot · invariants-ref (→ CLAUDE.md) · milestone narrative. **Zero work-priorities/open-questions.** |

Priorities/open-questions live ONLY in STATE.md; numbers/architecture live ONLY in SOT_STATE.md. The same fact never exists twice → the two cannot diverge.

### 11.2 Single updater (anti-drift core)

The `handoff` skill, at session close, writes BOTH files in the same run. SOT_STATE.md stops being orphaned/hand-maintained → no drift.

### 11.3 handoff skill = global, conditional (decision 1)

Modify `~/.claude/skills/handoff/SKILL.md`: always update `.handoff/STATE.md`; **if** `docs/kb/SOT_STATE.md` exists, also update it in the same run (re-deriving its numbers). Projects without that file are unaffected.

### 11.4 Counts = re-derived (robust — decision 2)

At each handoff the skill RE-DERIVES the granular numbers instead of trusting memory: DB counts via `psql` (sys.* populated, lineage, registry), migration list via `ls db/migrations`, versions via `package.json`, tags via `git tag`. Slower handoff, always-fresh snapshot.

### 11.5 STATE.md = pure disjunction (decision 3)

STATE.md carries NO numbers — only brief/priorities/open-questions/verification + a one-line pointer: "granular snapshot → `docs/kb/SOT_STATE.md`".

### 11.6 Delta vs the v1 implementation (`e7e9de3`)

- **Revert**: de-archive `docs/archive/SOT_STATE.md` → `docs/kb/SOT_STATE.md` (active granular reference), strip the STORICO header + the §0-bis delta (fold its facts into the proper sections).
- **Keep archived**: `HANDOFF.md` (narrative history), `NEXT_GENERATION_ENTRY_POINT.md` (v1.0.0 milestone record), `NEXT_SESSION_MVP_2A.md` (dead) — true history, not the granular state reference.
- **Re-point**: CLAUDE.md/README describe BOTH views (rapid + granular, both handoff-governed); governance section lists both as state SoT, still "do not spawn new files beyond these".

---

## 12. Session-start protocol + complete handoff (v2.1, S965)

The SoT is only useful if (a) the handoff writes **all** action sources and (b) the session start reads + aggregates them into **one exhaustive menu**. Two halves of the same loop, co-designed: the menu is exhaustive iff the handoff recorded everything.

### 12.1 Session-start protocol — `## Session start` in CLAUDE.md (LLM-driven)

After the infra hooks (tunnel/db/branch), before asking what to do, the LLM builds the action menu from all live sources so the user picks from a complete list (never from memory):

1. Read: `.handoff/STATE.md` (priorities + open questions), `docs/kb/SOT_BACKLOG.md` (items ≠ `DONE`/`WON'T-DO`), `docs/kb/DEBT_REGISTER.md` (debts ≠ `RISOLTO`), `docs/kb/SOT_STATE.md` §roadmap/gated.
2. Aggregate into ONE **priority-tiered** menu (**P1** high-impact/unblocking · **P2** quality/debt · **P3** roadmap/gated). Each row: `# · title · [source] · gating (⛔ reason if blocked) · effort (~Xh)`. Priority from existing markers (DEBT 🔴→P1 / 🟡→P2 / 🟢→P3; backlog P1-P3 sections; STATE top) + judgment on impact/unblocking.
3. EXCLUDE definitively-concluded work (`DONE`/`FATTO`/`RISOLTO`/`WON'T-DO` + shipped MVPs). KEEP gated items, ⛔-marked with the blocker (visible but clearly not ready).
4. Present the menu, then "Scegli #, aggrega (es. 1+4), o nuovo." The user may aggregate several items into one session.

Why LLM-driven (not the PS hook): "affrontabile/aggregabile/gated" needs judgment; markdown parsing in PowerShell is fragile. The hooks stay infra-only.

### 12.2 Complete handoff — skill v4

The `handoff` skill, at close, writes ALL sources (not just STATE + SOT_STATE):

- **STATE** (rapid) + **SOT_STATE** (granular, counts re-derived) — as v3.
- **SOT_BACKLOG**: mark `DONE` items closed this session; add new items — **including interrupted flows / pendings**.
- **DEBT_REGISTER**: mark `RISOLTO` debts closed; add new debts.
- **Cardinal rule**: no pending / interrupted flow left only in conversation memory — it MUST be recorded in a source (backlog/debt/STATE) before close. This is what makes the start-menu exhaustive.

### 12.3 The closed loop

handoff writes structured → session-start reads + aggregates → user picks from a complete menu → no memory of pendings needed.
