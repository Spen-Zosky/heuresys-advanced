# SoT Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the proliferating state/handoff files into one live SoT per domain — `.handoff/STATE.md` (state), `SOT_BACKLOG.md` (backlog), `DEBT_REGISTER.md` (debts), `CLAUDE.md` (durable) — and archive the rest, so no manual cross-file alignment is ever needed again.

**Architecture:** Docs-only housekeeping. Move 4 historical files to `docs/archive/` (git mv + header), re-point 4 live references, add an anti-drift governance section to CLAUDE.md, after a gap-audit so no durable content is lost. No code changes; verification is grep-based; CI must stay green.

**Tech Stack:** Markdown, git, ripgrep/grep. Spec: `docs/superpowers/specs/2026-06-05-sot-unification-design.md`.

---

### Task 1: Gap-audit SOT_STATE durable content → CLAUDE.md

**Files:**
- Read: `docs/kb/SOT_STATE.md` (durable §2 stack-pattern, §3 API pattern, §5 security, §7 CI topology, §8 boot prereqs, §9 invariants)
- Read/Modify: `CLAUDE.md`

- [ ] **Step 1: List CLAUDE.md section headings** — `grep -nE "^#{1,3} " CLAUDE.md`. Expected: confirms CLAUDE.md already carries invariants, module pattern, security model, design system, commands, infra.
- [ ] **Step 2: Compare against SOT_STATE durable sections** — read SOT_STATE §5/§7/§8/§9. For each durable fact, confirm an equivalent exists in CLAUDE.md. The only plausible gaps are: CI topology (6 workflows + showcase, self-hosted runner) and boot prereqs (tunnel automation ADR-0021). Invariants/security/pattern are already in CLAUDE.md.
- [ ] **Step 3: Migrate genuine gaps only** — if a durable fact is missing from CLAUDE.md, add it to the most relevant existing CLAUDE.md section (CI → near "Required infrastructure"; boot → same). Keep it terse. If nothing is missing, record "no gap" and skip. The §0-bis delta and all volatile counts/versions are NOT migrated (they live in `.handoff/STATE.md` / archive).
- [ ] **Step 4: Commit** — `git add CLAUDE.md && git commit -m "docs: migrate SOT_STATE durable gaps into CLAUDE.md (SoT unification 1/4)"` (skip commit if no gap; fold into Task 2 instead).

### Task 2: Add `## Source of Truth` governance section to CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (insert near the top, after the "What this is" intro)

- [ ] **Step 1: Insert the governance block** exactly:

```markdown
## Source of Truth (single, per-domain — do not duplicate)

- **Current state** → `.handoff/STATE.md` (the ONLY live state file; auto-maintained by the `handoff` skill each session). Do NOT create parallel state/handoff/entry-point files.
- **Open backlog** → `docs/kb/SOT_BACKLOG.md`.
- **Technical debts** → `docs/kb/DEBT_REGISTER.md`.
- **Durable rules / architecture** → this file (`CLAUDE.md`).
- **Path index** → `docs/kb/INDEX_PATHS.md`. Public overview → `README.md`.

Historical records live in `docs/archive/` and are **not** SoT. When state changes, update the relevant SoT above — never spawn a new file. (Rationale + migration: `docs/superpowers/specs/2026-06-05-sot-unification-design.md`.)
```

- [ ] **Step 2: Verify** — `grep -n "Source of Truth (single" CLAUDE.md` returns 1 line.
- [ ] **Step 3: Commit** — `git add CLAUDE.md && git commit -m "docs: add Source-of-Truth governance section to CLAUDE.md (SoT unification 2/4)"` (or fold Task 1+2 into one commit).

### Task 3: Re-point the 4 live references SOT_STATE.md → .handoff/STATE.md

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/kb/SOT_BACKLOG.md`, `docs/kb/DEBT_REGISTER.md`

- [ ] **Step 1: Find each live reference** — for each file: `grep -n "SOT_STATE" <file>`. Note the exact phrasing (e.g. CLAUDE.md: "The live source of truth for project state is `docs/kb/SOT_STATE.md`").
- [ ] **Step 2: Re-point each** — replace the pointer so it names `.handoff/STATE.md` as the live state SoT (keep surrounding prose intact; where the line referenced SOT_STATE as "live SoT", change to `.handoff/STATE.md`; where it referenced it as a historical/archived doc, point to `docs/archive/SOT_STATE.md`). Do NOT touch ADR/specs/plans/qa/sessioni/cowork or `INDEX_PATHS.md`.
- [ ] **Step 3: Verify live refs gone** — `grep -rl "docs/kb/SOT_STATE" --include="*.md" CLAUDE.md README.md docs/kb/SOT_BACKLOG.md docs/kb/DEBT_REGISTER.md` returns nothing (all re-pointed; archive-path references are allowed).
- [ ] **Step 4: Commit** — `git add CLAUDE.md README.md docs/kb/SOT_BACKLOG.md docs/kb/DEBT_REGISTER.md && git commit -m "docs: re-point live SOT_STATE references to .handoff/STATE.md (SoT unification 3/4)"`.

### Task 4: Archive the 4 historical files to docs/archive/

**Files:**
- Move: `docs/kb/SOT_STATE.md`, `HANDOFF.md`, `NEXT_GENERATION_ENTRY_POINT.md`, `NEXT_SESSION_MVP_2A.md` → `docs/archive/`

- [ ] **Step 1: Confirm docs/archive/ exists** — `ls -d docs/archive/`. Expected: exists (already holds MIGRATION_STATUS_*, HANDOFF_BRAND.md).
- [ ] **Step 2: git mv each file** —
```bash
git mv docs/kb/SOT_STATE.md docs/archive/SOT_STATE.md
git mv HANDOFF.md docs/archive/HANDOFF.md
git mv NEXT_GENERATION_ENTRY_POINT.md docs/archive/NEXT_GENERATION_ENTRY_POINT.md
git mv NEXT_SESSION_MVP_2A.md docs/archive/NEXT_SESSION_MVP_2A.md
```
- [ ] **Step 3: Prepend the STORICO header** to each of the 4 moved files (top of file), exactly:
```markdown
> ⚠ **STORICO — non è una SoT.** Stato corrente vivo: `.handoff/STATE.md` · Backlog: `docs/kb/SOT_BACKLOG.md` · Debiti: `docs/kb/DEBT_REGISTER.md`. Archiviato S965 (2026-06-05), vedi `docs/superpowers/specs/2026-06-05-sot-unification-design.md`.

```
- [ ] **Step 4: Verify** — `ls docs/archive/{SOT_STATE,HANDOFF,NEXT_GENERATION_ENTRY_POINT,NEXT_SESSION_MVP_2A}.md` all present; `ls HANDOFF.md NEXT_GENERATION_ENTRY_POINT.md NEXT_SESSION_MVP_2A.md docs/kb/SOT_STATE.md 2>&1` all "No such file" (root/kb cleaned). Each archived file's first line is the STORICO header.
- [ ] **Step 5: Commit** — `git add -A docs/archive/ && git commit -m "docs: archive SOT_STATE/HANDOFF/NEXT_GENERATION/NEXT_SESSION_MVP_2A to docs/archive (SoT unification 4/4)"`.

### Task 5: Final verification + push + CI

- [ ] **Step 1: Live-ref grep is clean** — `grep -rl "docs/kb/SOT_STATE" --include="*.md" . | grep -vE "docs/archive|docs/architecture/adr|docs/superpowers|qa_artifacts|sessioni|cowork|INDEX_PATHS"` returns nothing.
- [ ] **Step 2: Update .handoff/STATE.md** — add a one-line note under stack/open-questions: "SoT unified (S965): `.handoff/STATE.md` is the single state SoT; SOT_STATE/HANDOFF/NEXT_GENERATION/NEXT_SESSION_MVP_2A archived to `docs/archive/`; governance in CLAUDE.md `## Source of Truth`." Commit folded with Task 4 or separate `docs(handoff)`.
- [ ] **Step 3: Push** — secret-scan the diff, then `git push origin main`.
- [ ] **Step 4: Monitor CI** — `gh run list --branch main` for HEAD; all green (docs-only, but confirm lint/typecheck/build unaffected). Fix any red (R17).

---

## Self-Review

- **Spec coverage:** §3 architecture → Tasks 2-4; §4 archive → Task 4; §5 migration → Task 1; §6 re-point → Task 3; §7 governance → Task 2; §9 verification → Task 5. All covered.
- **Placeholders:** none — the governance block and STORICO header are given verbatim; the gap-audit (Task 1) is conditional-by-design (migrate only real gaps) with an explicit "no gap → skip" branch, not a placeholder.
- **Consistency:** archive paths in Task 4 match §4; re-point file list in Task 3 matches §6 (4 files, INDEX_PATHS excluded).

## Notes
- Commits may be folded (Tasks 1-2 into one CLAUDE.md commit; 3 separate; 4+5 handoff). Keep them atomic per concern.
- Push is pre-authorized this session (Enzo). PROD untouched.
