# heuresys-advanced — STATE

**Updated**: 2026-05-27 (S937 housekeeping CLOSED via Claude Code CLI continuation — CK-1..6 complete, all 6 CI workflows green on OCI VM runner).
**Branch**: `main` — HEAD `01340ae` (synced origin). ux-design-shared `dfa2e81`.
**Last tags pushed**: `v0.4.0-mvp4-ready` (post-S935-Z) + `v0.4.0a-s937-partial-checkpoint` (Cowork S937 partial @ `0c53fdf`) + **`v0.4.1-housekeeping-closed`** (CLI continuation @ `01340ae`).
**S937 housekeeping**: ✅ CLOSED. CK-1 SSH resolved, CK-2 runner online, CK-3 CW-B60-A live (observability confirmed), CK-4/5 done (Cowork), CK-6 all 6 self-hosted workflows green, CK-7 this closure. CK-8 MVP-4 stream 2.4 SDBI Phase 2 decided (PROMPT 027 ready).
**Next session entry-point**: execute `cowork_code_exchange/_01_PROMPT_027_s937_ck8_sdbi_phase2_kickoff.md` (MVP-4 2.4 SDBI Phase 2). Full CLI continuation detail in HANDOFF.md §2026-05-27 + `cowork_code_exchange/_00_HANDOVER_CLI_2026-05-26_post_S937.md`.
**Previous tag**: `v0.3.2-mvp3-full` (`d17ee0a`) — Tappa E MFA full + Tappa D pragmatic + 2 CVE.

## Sessione S937 (2026-05-26) — Housekeeping closure PARTIAL + R23/iii eccezione SSH

**Status**: 2/8 DONE (CK-4 script v2 commit `b55ffe8`, CK-5 prefs verified). 1/8 PARTIAL (CK-1 config audited + helper script ready, passphrase entry pending). 3/8 BLOCKED-BY-CK-1 (CK-2 runner, CK-3 CW-B60-A live, CK-6 CI smoke). 1/8 PARTIAL closure (CK-7 = questo file + HANDOFF). 1/8 PENDING decision (CK-8 MVP-4 stream).

**Eccezione R23/iii**: passphrase OCI key `oci_recovery_ed25519` non bypass-able via MCP redirected stdio. 3 tentativi automation (Start-Process powershell -WindowStyle Normal + cmd /K + helper .ps1) tutti falliti — finestre si chiudono prima del prompt o restano invisibili. Helper script salvato in `C:\Users\enzospenuso\Claude Desktop\scripts\s937-ck1-load-ssh-key.ps1` per Enzo manual launch da shell aperta a mano.

Vedi HANDOFF.md §S937 per detail + istruzioni esecutive CK-1.

---

## Sessione S935 (2026-05-26) — CLOSED, ship pending Windows host

**Status**: ✅ B/C/E/F/D + Z all shipped to working tree. ⏳ commit+push pending via `cowork_reserved/auto-ship/run-all-s935.ps1` (sandbox limitation Cowork mount).

**Outcome highlights**:
- **B (CW-B60-B)**: ADR-0020 reclassify 3 application-level targets IMPORT→REFERENCE_ONLY, migration 000044 idempotente. CW-B60-B MITIGATED.
- **C (DEFER-F / CW-B59)**: empirical re-read x18_4 iter 12 → vera root cause `d.createContext` (NOT RSC bundle threshold). 3-path strategy G/A/F + scripts shipped. CW-B59 reframed partial-mitigation.
- **E (SEC)**: branch protection + Dependabot triage docs + MFA env validation.
- **F (CI)**: 6 workflow YAML self-hosted OCI VM + setup docs.
- **D (residual)**: CODE-2/3/7 inline fixed; CODE-5 auto-coordinated; CODE-10 deferred docs; CODE-6 explicit out-of-scope.
- **Z (closure)**: bias_registry consolidation (60 catalogued / 42 mitigated), HANDOFF §0ter S935 outcome, session report, master ship script.

**Ship**:
```powershell
cd D:\heuresys-advanced
powershell -ExecutionPolicy Bypass -File cowork_reserved/auto-ship/run-all-s935.ps1
```

Tag finale post-ship: `v0.4.0-mvp4-ready`.

---

## Sessione S934 (2026-05-26) — CW-B60-A engine silent-skip observability fix

## Sessione S934 (2026-05-26) — CW-B60-A engine silent-skip observability fix

**Status**: ✅ FIX SHIPPED to working tree (commit + push pending; sandbox limitation pnpm symlinks Windows mount + `.git/index.lock` non rimovibile lato Cowork → ship via `cowork_reserved/ship-cw-b60-a.ps1`).

**Cosa**: Osservability gap nel path `upsert-sql.ts:763-765` (post-CW-B49). Quando `executeUpsertSqlSidePerMapping` ritornava `{ upsertedRows:0, skipped:false }` su `pool.query(insertSql).rowCount === 0`, NESSUN log pino e NESSUNA audit row venivano emessi. Triggered per i 3 target CW-B60-A (sys_skill_categories / sys_activity_classification_mappings / sys_process_kpi_templates — tutti senza `_tenant_id` NK → `setClauses=[]` → `ON CONFLICT DO NOTHING` → rowCount=0 sui duplicati / re-run).

**Fix shipped** (4 files):
- `apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts` — nuovo `SILENT_UPSERT_ZERO_ROWS_V1`.
- `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts:763-875` — probe SELECT count (staging input) + `logger.warn` structured (10 fields: phase, sub_phase, table_mapping_id, source_table, target_table, conflict_inference, natural_key_columns, col_entries_count, set_clause_mode, skip_filters_count, staging_rows_input) + audit INSERT `SILENT_UPSERT_ZERO_ROWS_V1` status='SKIPPED' emessi BEFORE silent return. Result shape unchanged (back-compat: `{ upsertedRows:0, lineageRows:0, skipped:false }`).
- `apps/api/test/upsert-sql-cw-b60-a-silent-skip.test.ts` — 3 unit test TDD (T1 silent-skip emette audit, T2 happy-path stays quiet, T3 DRY_RUN no side-effect). Verde 3/3 via standalone esbuild driver in Cowork sandbox.
- `cowork_reserved/bias_registry.md` — CW-B61 entry + CW-B60-A reclassified to MITIGATED + tally 60 catalogued / 41 mitigated + Next available → CW-B62.

**Verify pre-push (Windows host, tunnel SSH 5433 attivo)**:
```powershell
cd D:\heuresys-advanced\apps\api
pnpm typecheck                                                            # exit 0 expected
pnpm lint                                                                 # exit 0 expected
pnpm exec vitest run upsert-sql-cw-b60-a-silent-skip.test.ts              # 3/3 pass expected
```

**Ship** (Windows host):
```powershell
cd D:\heuresys-advanced
powershell -ExecutionPolicy Bypass -File cowork_reserved/ship-cw-b60-a.ps1
```

(Script cleans up `_tmp_3_*` pnpm leftover, removes stale `.git/index.lock`, stages 4 files, commits atomic, pushes origin main.)

**Effort effettivo**: ~2h sessione Cowork (forensic engine investigation + TDD fix + observability + audit).

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
