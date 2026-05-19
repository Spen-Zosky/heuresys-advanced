# heuresys-advanced — STATE

**Updated**: 2026-05-19 15:16 GMT+2
**Branch**: `main` — synced con `origin/main`
**Last commit**: `afbbc98` docs(cowork): Goal 002 EXEC log + REPORT + STATE finalize — PARTIAL closure

## Last session brief

Sessione lunga (S900 → S?): security triage Fase 3 (4 Dependabot alerts closed), eslint stack wired da zero (commit 26254d6, baseline 0 errori), poi Goal 002 EXEC end-to-end. 10 commit Goal 002 + REPORT + REVIEW (Cowork). Goal 002 CLOSED-PARTIAL (13/15 acceptance). 30 alerts Dependabot tutti fixed.

## Top priorities (next session)

1. **Goal 003 DISCOVERY** — LOOKUP_FK match_on payload semantic resolution (PRIMARY blocker A10/A11 da Goal 002). Cowork-side. Vedi `cowork_code_exchange/_05_REVIEW_002_*.md` §4 + nuova rule `U-2026-05-19-01`. Estimate Goal 003: <10 turn una volta semantica chiara. ~2-3 turn DISCOVERY + PROMPT.
2. **Cowork inbox rebuild** — INDEX.md ferma a 02:57Z, non riflette REVIEW 002 + closure. `pnpm cowork:inbox --rebuild-index`. ~1 turn.
3. **MVP-3 Tappa D status** — 🟡 partial-closure (architettura COMPLETE, data-flow partial pending Goal 003). Resta in attesa di Goal 003.

## Open questions

- **Goal 002 untracked artefacts** in `cowork_code_exchange/` (`_02_PLAN_002`, `_02b_APPROVAL_002` etc.) — restano untracked intenzionalmente per "NIENTE altro" constraint S894, o committarli ora con goal closed?
- **Rule U-2026-05-19-01** proposed by Cowork REVIEW §6.2 — creare `RULE_UPDATES.md` o aggiungere a CLAUDE.md cowork section?
- **Brand identity v1** gating MVP-3 B/E-UI/F — pivot vs continuare Goal 003?

## Stack snapshot (only deltas)

- API: 11/22 modules + brownfield-wave-executor con JSON_EXTRACT + LINEAGE_SOURCE_NK + LOOKUP_FK match_on (con caveat semantic) + type-coerce auto-wrap.
- Tests: 289 passed (+13 vs 276 baseline), 5 skipped, 0 failed. Gated debug-scale-v4 (3/3) + idempotency (1/1) verdi.
- Eslint stack: eslint 9.39.4 + typescript-eslint 8.59.4 + eslint-config-next 15.5.18 + `eslint.config.mjs` flat config (root). 0 errori baseline.
- Deps: vitest 4.1.6, vite 6.4.2, next 15.5.18, esbuild 0.25.12 (all post-security-upgrade).
- Full-scale Wave 1 runner: `scripts/run-wave1-fullscale.mjs`. 3 run COMPLETE ~110s wall-clock (5× sotto target 600s).
- Audit trail PERSISTED su live DB (no cleanup) — 3 runId in `brownfield.import_runs` + ~377 lineage rows + 81 HANDLED_VIA_LINEAGE_WRITE_V1.

## Verification (next session pre-flight)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"
cd apps/api && pnpm test    # expected 289 passed | 5 skipped | 0 failed
cd apps/api && pnpm typecheck && pnpm lint   # expected PASS + 0 errors
git status                                    # expected: synced + cowork_code_exchange/ untracked artifacts
```

## Untracked artifacts (left intentionally)

`cowork_code_exchange/` Goal 002 artefacts (`_02_PLAN_002`, `_02b_APPROVAL_002`, `_03_EXEC_002`, `_04_REPORT_002`, `_05_REVIEW_002`) sono tracked. Resta untracked: `_02_PLAN_001_*` archive copies, `.cowork-pending-commits/`, `.inbox/cli/pending/*`, `baselines/`, `_templates/`. Decisione open question #1 sopra.
