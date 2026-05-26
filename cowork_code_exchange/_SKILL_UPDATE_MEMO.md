# Skill Update Memo — `cowork-cli-orchestrator` alignment to protocol v2

**Created:** 2026-05-18, by Cowork
**Target skill:** `anthropic-skills:cowork-cli-orchestrator`
**Skill source path (Windows):** `C:\Users\enzospenuso\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\61ec6cd9-fa38-444f-ae7f-e0ae9c74dc1e\9ae94ddf-92f9-4366-91d2-70298f3eb46f\skills\cowork-cli-orchestrator\SKILL.md`

## Why this memo exists

The skill `cowork-cli-orchestrator` was originally authored for the `heuresys-evo` project and uses **protocol v1** (5 phases: PROMPT/PLAN/EXEC/REPORT/REVIEW). This repo (`heuresys-advanced`) now follows **protocol v2** (7 phases, adds DISCOVERY + APPROVAL).

We don't modify the global skill from a Cowork session because the skill lives in the plugin dir, which is owned by the plugin distribution system. A future plugin reinstall would overwrite our edits.

The chosen pattern is **project-level override**:

- Each project that uses the exchange channel keeps its **own** `cowork_code_exchange/README.md` as the project-level SoT.
- The skill is amended to **defer to the project-level README on first contact** with the directory.

This memo documents the change so it can be applied manually when convenient (e.g., during a Claude Code CLI session that owns the skill source on disk).

## Skill changes proposed

### Change 1 — Add v2 awareness at the top of SKILL.md

After the "Quando usare questa skill" section, insert:

```markdown
## ⚠️ Protocol versioning — read the project README first

Different projects may use different versions of the exchange protocol. **On every entry into a project that has a `cowork_code_exchange/` directory, your first action is to `Read` the project's `cowork_code_exchange/README.md`** to identify the protocol version and any project-specific conventions.

| Version detected | Action |
|---|---|
| README header says `Protocol version: 2.0` | Follow v2 (7 phases: DISCOVERY/PROMPT/PLAN/APPROVAL/EXEC/REPORT/REVIEW + STATE file + events.jsonl). See the README §"Phase definitions" for details. |
| README header says `Protocol version: 1.0` | Follow v1 (5 phases: PROMPT/PLAN/EXEC/REPORT/REVIEW). The content below this section in SKILL.md still applies. |
| No version header | Default to v1; ask the user before initiating any v2-only phase. |

The project README is the SoT, this skill is the operational guide. When they disagree, the README wins.
```

### Change 2 — Naming convention table

Replace the current naming convention block:

```markdown
cowork_code_exchange/YYYY-MM-DD_HHMM_NN_TIPO_descrizione.md
```

with:

```markdown
### Protocol v2 (projects with README v2)
_<step>_<TYPE>_<NNN>[<resume>]_<slug>.md

step:   00, 01, 02, 02b, 03, 04, 05
TYPE:   DISCOVERY, PROMPT, PLAN, APPROVAL, EXEC, REPORT, REVIEW
NNN:    monotone 3-digit goal counter
resume: a/b/c (only on EXEC after halt+amend)
slug:   kebab-case, shared across all files of a goal

### Protocol v1 (legacy projects)
cowork_code_exchange/YYYY-MM-DD_HHMM_NN_TIPO_descrizione.md
```

### Change 3 — Add DISCOVERY phase reference

After "Come Creare un PROMPT", insert a new section:

```markdown
## Come scrivere una DISCOVERY (v2 only)

Phase 0 is optional but strongly recommended when the task touches DB shape, data vocabularies, or external data.

The DISCOVERY file enumerates facts only — no plan, no design.

Use SSH remote-exec or local file reads to capture:
- Schemas (tables, columns) relevant to the task
- Vocabularies (distinct values of categorical columns that drive behavior)
- Row counts at the timestamp of capture
- Source file SHA-256 hashes (rollback anchor)
- Current state of any stuck/in-flight processes

A 30-line DISCOVERY with 3-4 SQL queries can prevent an entire EXEC halt round-trip. See the v2 README §"Phase 0 — DISCOVERY" for the template structure.

The PROMPT then cites DISCOVERY by file path + section, instead of restating facts inline.
```

### Change 4 — Add APPROVAL phase reference

Update the "Solo dopo approvazione esplicita (file _03_EXEC_) puoi eseguire" sentence (which appears in Protocollo di Output template) to reflect v2:

```markdown
## Protocol v2 approval (where applicable)

In protocol v2, approval is no longer the implicit "Cowork creates EXEC". Instead:

1. CLI writes `_02_PLAN_<NNN>_<slug>.md` and stops.
2. Cowork reviews. If OK, Cowork writes `_02b_APPROVAL_<NNN>.md` containing the PLAN sha256.
3. CLI verifies the APPROVAL file exists, reads `plan_sha256` from its frontmatter, computes the actual PLAN sha256, confirms match.
4. CLI starts EXEC, writes `_03_EXEC_<NNN>_<slug>.md`.

If `plan_sha256` doesn't match (PLAN was modified post-approval), CLI must halt and request fresh APPROVAL.

The legacy v1 pattern ("Cowork creates EXEC file as green light") still applies in v1 projects.
```

### Change 5 — Add STATE file reference

Add a new section after "Naming convention":

```markdown
## STATE file (v2 only)

For every active goal, a `_00_STATE_<NNN>.md` is maintained as the live SoT. It uses YAML frontmatter with machine-readable fields (current_phase, plan_sha256, turn_consumed, last_event_ts, next_actor, halt_count, ...).

Every phase transition updates the STATE file. Any actor (Cowork, CLI, future automation) can `cat` it to know the goal's status in one read.

See the v2 README §"STATE file schema" for the canonical frontmatter shape.

CLI is responsible for updating STATE on every EXEC step that consumes turns or produces commits. Cowork is responsible for updating STATE on phase transitions it owns (PROMPT, APPROVAL, REVIEW, CLOSED).
```

### Change 6 — Update "Documenti di riferimento" table

Replace:

```markdown
| `references/exchange-protocol.md` | Quando serve il dettaglio del protocollo 5 passi |
```

with:

```markdown
| `references/exchange-protocol.md` | Quando serve il dettaglio del protocollo (legacy v1 dettaglio) |
| Project-level `cowork_code_exchange/README.md` | **Always read first** — it's the SoT for that project's protocol version and conventions |
```

## How to apply this memo

Two options:

### Option A — via Claude Code CLI on Windows (cleanest)

1. Open a Claude Code CLI session on Windows.
2. Read this memo.
3. Apply the 6 changes to the skill at the path above.
4. Test: `Read` the updated SKILL.md and confirm v2 references are present.
5. Commit nothing (the skill lives in plugin dir, outside any git repo we own).

### Option B — defer until next Cowork session that touches `heuresys-evo`

The skill applies to both `heuresys-evo` and `heuresys-advanced`. When the next Cowork session works on `heuresys-evo`, the same operator can apply these edits inline.

## Verification after apply

After applying changes, a fresh Cowork session that loads the skill should:

1. On first contact with `cowork_code_exchange/` in this repo, automatically `Read` the project README.
2. Detect "Protocol version: 2.0" and follow v2 phases.
3. Generate new goals with `_00_STATE_<NNN>.md` + DISCOVERY + APPROVAL.

A behavioral test:

```
User: "Apri Cowork e crea un Goal 002 per X"
Cowork: [reads cowork_code_exchange/README.md, identifies v2]
        [scaffolds via `node scripts/cowork-exchange/new-goal.mjs X` or manual]
        [STATE and DISCOVERY files appear]
```

If after the skill update Cowork still defaults to v1 behavior in this repo, the skill defer-to-README logic didn't take. Re-check Change 1.

---

*This memo lives in `cowork_code_exchange/_SKILL_UPDATE_MEMO.md` and is part of the repo's audit trail. It can be deleted once the skill update is verified applied across all sessions Enzo uses.*
