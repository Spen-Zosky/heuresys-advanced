# heuresys-advanced — STATE

**Updated**: 2026-05-26 GMT+2 (P1 housekeeping + Pre-flight Phase 0-3 partial CLOSED — Cowork autonomy strict mode)
**Branch**: `main` — synced `649ac7a` (post Phase 3 commit, all pushed). ux-design-shared `dfa2e81`.
**Last tag**: `v0.3.3-preflight-partial` (TBD post-Phase-8-commit) — pre-flight Phase 0-3 closed, Phase 4-7 deferred
**Previous tag**: `v0.3.2-mvp3-full` (`d17ee0a`) — Tappa E MFA full + Tappa D pragmatic + 2 CVE

## Pre-flight 2026-05-26 status

| Phase | Status | Commit |
|---|---|---|
| Phase 0 baseline | ✅ DONE | `6d5541a` |
| Phase 1 DOC base (11 items) | ✅ DONE | `40a0838` |
| Phase 2 DOC high-effort (MVP-4 ROADMAP + Wave runners + Q1-Q8 + API refresh) | ✅ DONE | `8608b12` |
| Phase 3 CODE base (CODE-1 logger + CODE-4 dep + CODE-NEW-2 lint 37→0) | ⚠️ PARTIAL (3/7 items, 4 deferred) | `649ac7a` |
| Phase 4 CODE-6 queries.ts 47 routes | ⏸️ DEFERRED | — |
| Phase 5 SEC base (Dependabot + qs + branch protection) | ⏸️ DEFERRED | — |
| Phase 6 SEC CI workflows + dual self-hosted runners | ⏸️ DEFERRED | — |
| Phase 7 QA gate finale (skills:131 + chunked test) | ⏸️ DEFERRED | — |
| Phase 8 Closure | ⏳ in flight (questo commit) | TBD |

Full outcome + rationale in `sessioni/session_2026-05-26_preflight/PREFLIGHT_REPORT.md`.

## Last session brief

**Sessione 2026-05-26 (S933)** — apertura post-`v0.3.2-mvp3-full`. Lavoro multi-fase:
- **P1 housekeeping** (commits 1-9, push `08a0d11`): Goal 003 formal closure retroattiva (REPORT 003 + REVIEW 003 + STATE_003 → CLOSED_PENDING_STRATEGIC_PIVOT) + REVIEW 004/005 per X1/X2 pending + cowork_code_exchange complete archive + cowork_reserved KB committato + ADR-0018 + showcase SystemHealthDashboard + .gitignore worktree+cowork transient + CLAUDE.md trailing fix
- **Pre-flight Phase 0** (commit `6d5541a`): baseline capture (typecheck/lint/i18n green; pnpm test deferred Gate G7) + vitest.config Vitest 4 migration fix + PREFLIGHT_PLAN_2026-05-26.md (9 phases roadmap)
- **Pre-flight Phase 1 DOC base** (in flight): ADR_INDEX refresh + ADR-0017 LOOKUP_FK_2HOP scrittura retroattiva + README.md rewrite post-X18 + package.json description + .env.example MFA_ENCRYPTION_KEY label
- Direttiva utente: autonomy piena per chiudere debiti tecnici pre-MVP-4 senza intervento

## Top priorities (next session post pre-flight)

1. **DEFER-F — fix /showcase RSC bundle-threshold** (~2-3h, HIGH-RISK). PROMPT 025 pronto. Restore `apps/web/src/_disabled_showcase_X18` + Path A bisect / Path F split @heuresys/ui / Path E Next 16.
2. **CW-B60-A — forensic engine silent-filter** (~2-3h). 3 target AUTO_APPROVED ma 0 upserted senza log (skill_categories / activity_classification_mappings / process_kpi_templates).
3. **CW-B60-B — Wave 2 / computed views ADR** (~2-3h). 3 target IMPORT senza staging source (blueprint_overrides / position_learning_requirements / position_skill_requirements).

## Open questions

- **skills.integration.test:131** fallisce (createdSkillIds non in list response) — pre-esistente, deterministico. Fix tentativo Phase 7 (Gate G7).
- **Lint apps/web 37 errors** rilevati Phase 0: 12 errors no-undef in scripts/*.mjs (eslint env Node) + 25 errors no-sparse-arrays in SystemHealthDashboard.tsx. Fix Phase 3 (CODE base).
- **Vitest 4 migration**: `apps/api/vitest.config.ts` updated (`poolOptions` → `fileParallelism: false` + `maxWorkers/minWorkers: 1`). Pushed Phase 0. Da validare in Gate G7.
- **Dependabot 12 PR aperte** triage Phase 5 SEC base.

## Stack snapshot (post P1 + Phase 0)

- **HEAD**: `6d5541a` (sync origin)
- **Tag corrente**: `v0.3.2-mvp3-full` (`d17ee0a`)
- **Bias**: 58 attivi CW-B17..B60 (B57 withdrawn). Next CW-B61.
- **Tests baseline (da STATE pre-P1, ancora valida)**: vitest API 341 PASS / 1 FAIL (skills:131) / 5 SKIP — da rivalidare Gate G7 post pre-flight CODE/QA
- **ADR registrate**: 18 file (0001-0018, gap 0017 risolto retroattivamente in Phase 1 DOC-2). ADR_INDEX aligned post DOC-1.
- **Migrations**: 42 file (000001..000043, gap 000035 cosmetico) — tutte applicate
- **DB stato canonico**: sys.* ~110 tabelle, brownfield/audit aux, 18 staging.wave1_*, temp_sdbi schema
- **RTL_BANK seed**: 1 tenant + 5 branches + **55 positions** (25 branch + 30 HQ) + **158 users sintetici** + **158 PRIMARY ACTIVE assignments** (Faker SEED=42)
- **Brownfield registry**: 93 source_tables + 1164 source_columns + **95 table_mappings** + **1271 column_mappings** (drift vs forensic previous count 1177)
- **API endpoints**: 272 business + 2 health (58 moduli)
- **Web routes**: 47 (30 admin + 14 ESS + login + system-health + root)
- **Playwright E2E**: 61 test in 20 spec
- **Design system**: `@heuresys/ui ^0.1.1` npm-published (post-X18)
- **i18n parity**: 23 keys it=en ✅

## Verification (next session pre-flight)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
git log origin/main..HEAD --oneline                 # empty (synced 6d5541a o HEAD futuro post-Phase 8)
pnpm install -r                                      # lockfile up to date
pnpm --filter @heuresys/api typecheck                # PASS
pnpm --filter @heuresys/web typecheck                # PASS
cd apps/api && pnpm exec vitest run                  # target: 341+ PASS / 0-1 FAIL (skills:131 fix tentato Phase 7)
pnpm audit --audit-level=moderate                    # post-pre-flight Phase 5 SEC base
```

## Resume protocol

1. Read STATE + `cowork_reserved/HANDOFF_FRESH_SESSION.md` §0 (delta sessione 2026-05-26) + §2 (next-session candidates: DEFER-F / CW-B60-A / CW-B60-B).
2. SSH tunnel + apps/api `:3001` per test/Playwright live.
3. Se pre-flight finita: leggi `sessioni/session_2026-05-26_preflight/PREFLIGHT_REPORT.md` per outcome + tag `v0.3.3-preflight-clean`.
4. Se pre-flight interrotta a mezzo: leggi `sessioni/session_2026-05-26_forensic-state-of-the-art/PREFLIGHT_PLAN_2026-05-26.md` per riprendere dalla fase in corso (vedere tasklist Cowork last status).

## Note operative

- WSL2 vs Windows: tunnel SSH 5433 attivo SOLO da Windows namespace; bash WSL2 vede "Connection refused" (atteso). Test commands devono partire da PowerShell.
- Root pnpm scripts (`pnpm typecheck`, `pnpm lint`) **broken in PowerShell** per wildcard `--filter='@heuresys/*'` non escape. Workaround: filter per ogni workspace specifico. Fix in Phase 3 CODE-NEW-1.
- Index.lock cross-OS WSL2/Windows: WSL2 `rm` fallisce "Operation not permitted", PowerShell `Remove-Item -Force` funziona. Pattern noto, gestito automaticamente nei commit batch.
