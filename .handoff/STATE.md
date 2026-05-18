# heuresys-advanced — STATE

**Updated**: 2026-05-19 01:25 GMT+2
**Branch**: `main` — 14 commits ahead of `origin/main` (no push yet, user explicit)
**Last commit**: `3774716` docs(cowork): session handoff to Desktop Cowork

## Last session brief

Goal 001a v5 (brownfield-wave-executor SQL-side `executeUpsert` refactor) CLOSED and ACCEPTED. Closure REVIEW (`1e5dd76`) + session handoff file for Desktop Cowork (`3774716`) committed. Cowork CLI side wrapping up; Desktop side will take over.

## Top priorities (next session)

1. **Desktop Cowork takeover** — read `cowork_code_exchange/_00_SESSION_HANDOFF_2026-05-18.md` (262 lines, 22 KB) first. Goal 001b scoped inside it. Wait for Desktop to author next `_01_PROMPT_001b_*.md` before any EXEC. ~no-effort prep, scope TBD.
2. **Decide push to `origin/main`** — 14 commits ahead. User has explicitly held push so far. Confirm before pushing. ~5 min.
3. **MVP-2a frontend** (separate track) — only if user pivots away from cowork. Canonical doc: `NEXT_SESSION_MVP_2A.md` at repo root. ~multi-session.

## Open questions

- Push timing for the 14 local commits — held intentionally; needs user green-light.
- 7 pre-commit warnings on `cowork_code_exchange/` (PLAN naming v2 schema, `_04_REPORT_*` / `_05_REVIEW_*` prefixes unrecognized, 3 PLAN files vs single-file preference). Codify in cowork schema v3 or leave as-is?

## Stack snapshot (only deltas)

- API: 11/22 business modules + auth shipped, brownfield-wave-executor v5 (SQL-side upsert, audit-wired).
- Tests: regression suite green at commit `0d628d3`; criterion 11 assertions added at `b4a2e10`.
- Cowork: v2 schema in use, naming convention extended de-facto (`_04_REPORT_*`, `_05_REVIEW_*`, `_00_SESSION_HANDOFF_*`) pending schema update.

## Verification (next session pre-flight)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"
cd apps/api && pnpm test    # expected 100% green
git status                  # expect 14 ahead, no staged changes
```

## Untracked artifacts (left intentionally)

`cowork_code_exchange/` has 11 untracked files + `_templates/` + `baselines/`. Plus `scripts/cowork-exchange/`, `.claude/worktrees/`, and modified `package.json` + `README.md` + `settings.local.json`. All intentional ("NIENTE altro" constraint from user, S894).
