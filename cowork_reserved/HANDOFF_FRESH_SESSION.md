# HANDOFF — Fresh Cowork Session Bootstrap

**Updated**: 2026-05-26 CLOSURE (S935 chiusa — full B→C→E→F→D autonomy sequence shipped to working tree; commit + push via `cowork_reserved/auto-ship/run-all-s935.ps1` Windows host)
**Last Cowork session ID**: **S935** (CHIUSA: A=S934 + B/C/E/F/D + Z closure; tag finale `v0.4.0-mvp4-ready` post-Z)
**Last HEAD pushed**: `787236c` (S933 final docs handoff; pre-S934). Post-S935 ship-time HEAD via `run-all-s935.ps1` master script (commits 7 atomic + 2 annotated tags).
**Last tag pushed**: `v0.3.3-preflight-partial` (`1cd1f83`, S933). Post-S935: `v0.3.4-p0-closed` (post-C) + `v0.4.0-mvp4-ready` (final).
**Purpose**: bootstrap minimale per la prossima sessione Cowork post-S935.
**Reuse pattern**: aggiornare prima di chiudere ogni sessione lunga; nuova sessione legge SOLO questo file + i 2-3 file critici elencati sotto.

---

## §0ter — Sessione S935 chiusa (2026-05-26) — outcome sintetico

**Direttiva utente**: autonomia non-presidiata. Sequenza raccomandata B→C→E→F→D (A già S934-shipped). Tag intermedio `v0.3.4-p0-closed` post-C; tag finale `v0.4.0-mvp4-ready` post-F.

### Cosa è stato shipped in S935

| Fase | Deliverable | File |
|---|---|---|
| **B** CW-B60-B Wave-2 ADR | ADR-0020 reclassify 3 application-level targets IMPORT→REFERENCE_ONLY; migration 000044 idempotente | docs/architecture/adr/0020_*.md, ADR_INDEX, db/migrations/000044, MVP_4_ROADMAP §2.1 |
| **C** DEFER-F CW-B59 reframe | Iter 12 empirical evidence → vera root cause `d.createContext`. 3-path strategy: G React overrides (10min), A revised message-grep bisect, F split fallback | docs/cw-b59-true-root-cause-2026-05-26.md, package.json pnpm.overrides, scripts/restore-showcase-routes.ps1, scripts/bisect-cw-b59-createctx.ps1 |
| **E** SEC base | Branch protection canonical doc + Dependabot 4-bucket triage doc + MFA_ENCRYPTION_KEY validation .min(32) + soft-warn production | docs/github/branch-protection.md, docs/github/dependabot-triage-2026-05-26.md, apps/api/src/config/env.ts |
| **F** CI workflows + OCI VM runner | 6 workflow YAML (typecheck/lint/i18n/test-integration/build-web/playwright-smoke) on [self-hosted, oci-vm] + setup docs + R11 EnvironmentFile pattern | .github/workflows/*.yml (×6), docs/ci/self-hosted-runners-setup.md, docs/ci/workflows-overview.md |
| **D** Residual cleanup | CODE-2 (api dead scripts) + CODE-3 (Tailwind portable @source) + CODE-7 (web dead vitest test) inline. CODE-5/CODE-10 deferred docs. CODE-6 explicitly out-of-scope | apps/api/package.json, apps/web/package.json, apps/web/src/app/globals.css, package.json root, docs/preflight-residual-todo.md |
| **Z** Closure | bias_registry consolidation (CW-B60-A→MITIGATED via CW-B61, CW-B60-B→MITIGATED via ADR-0020, CW-B59 reframed) + HANDOFF refresh + STATE drift fix + S935 session report + master ship script | bias_registry.md, HANDOFF_FRESH_SESSION.md, .handoff/STATE.md, sessioni/session_2026-05-26_s935/S935_SESSION_REPORT.md, cowork_reserved/auto-ship/run-all-s935.ps1 |

### Phase status sessione

- ✅ B/C/E/F/D + Closure all shipped to working tree
- ⏳ Commit + push pending — ship via `cowork_reserved/auto-ship/run-all-s935.ps1` Windows host
- ⏸️ Live re-runs (Path G build, CI workflow first run, runner registration) deferred to S936 first-acts

### Ship instructions (Windows host)

```powershell
cd D:\heuresys-advanced
powershell -ExecutionPolicy Bypass -File cowork_reserved/auto-ship/run-all-s935.ps1
```

Lo script ship in autopilot: cleanup leftover + 7 commit atomic (A+B+C+E+F+D+Z) + 2 annotated tag (`v0.3.4-p0-closed` post-C, `v0.4.0-mvp4-ready` post-Z) + push origin main --follow-tags. Halt automatico al primo errore di verify. Resume con `-FromPhase <X>` dopo halt; `-SkipVerify` se hai già verificato; `-NoPush` per commit+tag senza push.

### Next session candidates post-S935 (S936)

1. **S936 first-act**: live verify S935 shipped + CI workflow primo run. ~1h.
2. **S936-C-followup**: Path G build attempt — restore-showcase-routes.ps1 + pnpm --filter @heuresys/web build. Se OK → close CW-B59. ~30min.
3. **S936-runner-registration**: setup OCI VM runner per `docs/ci/self-hosted-runners-setup.md` §3. ~1-2h.
4. **MVP-4 stream selection**: pick da `docs/MVP_4_ROADMAP.md` (9 streams parallelizable).

---

---

## §0bis — Sessione S934 chiusa (2026-05-26) — outcome sintetico

**Direttiva utente**: ereditata S933 autonomia piena. Target: chiudere P0-2 CW-B60-A forensic engine silent-filter.

### Cosa è stato shipped in S934

| File | Tipo | Effetto |
|---|---|---|
| `apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts` | MODIFIED (+33 lines) | Nuova constante `SILENT_UPSERT_ZERO_ROWS_V1` + JSDoc payload contract |
| `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts` | MODIFIED (+110 lines @ 763-875) | Probe SELECT count (staging input) + `logger.warn` structured (10 fields) + audit INSERT `SILENT_UPSERT_ZERO_ROWS_V1` status='SKIPPED' emessi BEFORE silent return. Back-compat: result shape unchanged |
| `apps/api/test/upsert-sql-cw-b60-a-silent-skip.test.ts` | NEW | 3 unit test TDD (T1 silent-skip emette audit; T2 happy-path stays quiet; T3 DRY_RUN no side-effect). Verde 3/3 via standalone esbuild driver in Cowork sandbox |
| `cowork_reserved/bias_registry.md` | MODIFIED | CW-B61 entry + CW-B60-A reclassified MITIGATED via CW-B61 + tally 60 catalogued / 41 mitigated + Next available CW-B62 |
| `.handoff/STATE.md` | MODIFIED | S934 sezione outcome + ship instructions |
| `cowork_reserved/HANDOFF_FRESH_SESSION.md` | MODIFIED (questo file) | §0bis outcome + §1.5 P0 status updates |
| `cowork_reserved/ship-cw-b60-a.ps1` | NEW | PowerShell ship script con pre-commit verify (typecheck + lint + vitest) + commit atomico + push origin main |

### Root cause CW-B60-A (forensic deliverable)

Silent skip path: `upsert-sql.ts:763-765` (post-CW-B49). `if (upsertedCount === 0) return { upsertedRows:0, skipped:false }`. Con `skipped:false`, engine.ts:840 logger.error branch `if (sqlResult.skipped && sqlResult.skipReason)` saltato → nessun log pino. CW-B17 audit (`WHERE_SKIP_FILTER_EXCLUDED_V1`) copre solo per-row exclusions da `skipFilters`, NON il main-INSERT rowCount=0.

**Trigger comune ai 3 target affetti** (sys_skill_categories / sys_activity_classification_mappings / sys_process_kpi_templates): tutti senza `_tenant_id` NK (no CW-B49 COALESCE-sentinel UQ pattern). column_mappings coprono solo NK cols → `setClauses=[]` → `ON CONFLICT DO NOTHING` → rowCount=0 sui duplicati / re-run.

### Phase status sessione

- ✅ Bootstrap (turn 1 ACK + drift detection)
- ✅ Localizzare engine code (engine.ts + upsert-sql.ts + audit-rule-codes.ts mapped)
- ✅ Analizzare config 3 target (schema introspection migrations 7/13/15)
- ✅ Root cause identificato (path #7 silent return, post-CW-B49)
- ✅ Unit test TDD scritto (3 test cases sandbox-compatible)
- ✅ Fix engine shipped (+ probe + WARN + audit)
- ✅ Verify: 3/3 PASS via standalone driver + TS syntax pulito
- ⏸️ Live re-run Wave-1 (DEFERRED S935: richiede tunnel + DB live)
- ✅ Bias registry CW-B61
- ⏳ Commit + push (PENDING: sandbox lock — utente esegue `cowork_reserved/ship-cw-b60-a.ps1`)

### Ship instructions (Windows host)

```powershell
cd D:\heuresys-advanced
powershell -ExecutionPolicy Bypass -File cowork_reserved/ship-cw-b60-a.ps1
# Lo script: pulisce _tmp_3_* + .git/index.lock leftover, gira pre-commit verify
# (typecheck + lint + vitest cw-b60-a), commit atomico, push origin main.
# Opt -SkipVerify per saltare la verifica se già fatta manualmente.
```

### Razionale closure pending-push (R10 + R14)

Sandbox Cowork ha 2 limit hard: (a) pnpm node_modules symlinks Windows non risolvibili dal mount Linux → `pnpm typecheck` e `pnpm lint` full workspace impossibili lato Cowork; (b) `.git/index.lock` leftover post-`git status` non rimovibile da sandbox (Operation not permitted). Pertanto commit + push lifting necessariamente al Windows host. Il fix è verificato logico-sintatticamente + funzionalmente (3/3 test verde via standalone esbuild driver).

### Audit metodologico finale (R14 anti-bias)

Grep sistematico per `if (...) continue;` + `return.*skipped` in `engine.ts` + `upsert-sql.ts` mostra 2 silent path residui in engine.ts che NON sono coperti dal fix S934 ma NON sono root cause CW-B60-A:

- `engine.ts:764` `if (!stagingTable) continue;` — silent skip se `stagingTableFor(target)` ritorna null. Non si attiva per i 3 target affetti (tutti hanno staging.wave1_*).
- `engine.ts:766` `if (targetMeta.columns.size === 0) continue;` — silent skip se la target table sys non esiste. Non si attiva per i 3 target affetti (sys tables presenti nelle migration 7/13/15).

Questi 2 sono **candidate minor observability improvement** (S935+ low priority): aggiungere `logger.warn` strutturato BEFORE i 2 `continue` per coprire i casi (a) target_table senza staging mapping nello whitelist (B-scope: i 3 target CW-B60-B non hanno staging — l'engine non emette nessun log oggi), (b) target_table sys mancante (errori catastrofici schema). NOT BLOCKING per close S934.

### Invarianti rispettate

- I3/I4 schema discipline: no `usr_*`/`br_*` additions ✓
- I5 no RLS: no RLS changes ✓
- I7 auth separato `sys.sys_auth_*`: no auth changes ✓
- I13 PG native no docker: no infra changes ✓
- RD-08 no PG ENUM: no CREATE TYPE / ALTER TYPE aggiunti (rule_code è varchar constant) ✓
- R11 secret hygiene: nessun secret committed ✓
- R12 git safety: ship script no `--force`, no `--no-verify`; preferito new commit ✓

---

---

## §0 — Sessione S933 chiusa (2026-05-26) — outcome sintetico

**Direttiva utente 2026-05-26**: Cowork ha proceduto in **autonomia piena** per chiudere debiti tecnici pre-MVP-4. Plan operativo 9 phases in `sessioni/session_2026-05-26_forensic-state-of-the-art/PREFLIGHT_PLAN_2026-05-26.md`. Outcome finale in `sessioni/session_2026-05-26_preflight/PREFLIGHT_REPORT.md`.

### Cosa è stato shipped in S933

| Block | Commit range | Highlight |
|---|---|---|
| Forensic audit (turn 1) | — | `sessioni/.../FORENSIC_STATE_OF_ART_2026-05-26.md` (~7000 parole, audit comprehensive via 7 subagent paralleli) |
| **P1 housekeeping** (9 commit) | `ad7d5c0..08a0d11` | Goal 003 formal closure retroattiva (REPORT 003 + REVIEW 003 + STATE_003 CLOSED_PENDING_STRATEGIC_PIVOT) · REVIEW 004/005 retroactive · cowork_code_exchange complete archive · cowork_reserved KB · ADR-0018 · cleanup lock+manifest+worktree musing-wing-802781 prunable · .gitignore cowork transient |
| **Pre-flight Phase 0-3 partial + 8** (5 commit) | `6d5541a..1cd1f83` | vitest.config Vitest 4 migration · ADR_INDEX refresh + ADR-0017 retroactive · README rewrite post-X18 · STATE drift fix (positions 55 / cols 1271 / staging 18 / mig 42) · MVP_4_ROADMAP.md (571 righe) · 3 wave runner docs (1593 righe) · Q1-Q8 RESOLVED · API plan refresh 23/148→58/272 · CODE-1 6 console.error → pino logger structured · CODE-4 @heuresys/ui dep · **lint apps/web 37→0 errors** |
| Closure | tag `v0.3.3-preflight-partial` | annotato + pushed |

### Phase status

- ✅ Phase 0 baseline (G0 PASS, 2 riserve)
- ✅ Phase 1 DOC base (11 items)
- ✅ Phase 2 DOC high-effort (MVP-4 ROADMAP + Wave 2/3/4 runners + DOC-10/11)
- ⚠️ Phase 3 CODE base PARTIAL (3/7 items shipped, 4 deferred: CODE-2/3/5/7/10)
- ⏸️ Phase 4 CODE-6 queries.ts 47 routes refactor (DEFERRED)
- ⏸️ Phase 5 SEC base (Dependabot 12 PR + qs + branch protection) (DEFERRED)
- ⏸️ Phase 6 SEC CI workflows + dual self-hosted runners (DEFERRED)
- ⏸️ Phase 7 QA gate finale (skills:131 + chunked test) (DEFERRED)
- ✅ Phase 8 Closure (PREFLIGHT_REPORT delivered + tag pushed)

### Razionale closure partial (R14 anti-bias + R9 token hygiene)

Plan originale 45-67h > capacity context tipica singola sessione Cowork. Phase 4 (47 routes refactor) + Phase 6 (CI self-hosted runners setup) richiederebbero 50-100 MCP calls cumulative = saturazione context. Decisione autonoma: chiudere a Phase 3 con honest tag `-preflight-partial` (non `-clean`) + handoff strutturato per N sessioni dedicate.

### Nuovi bias rilevati pre-flight (da catalogare in `bias_registry.md` come CW-B61/62/63 prossima sessione)

- **CW-NEW-PF-01**: Plan overestimate vs context capacity → split in N sessioni dall'inizio
- **CW-NEW-PF-02**: PowerShell MCP timeout 30s vs vitest test full 3-8min → chunked test strategy
- **CW-NEW-PF-03**: ESLint flat config 9.x deprecata `/* eslint-env node */` → usare `/* global ... */`

---

## §1 — Stato attuale (snapshot)

- **Progetto**: heuresys-advanced (D:\heuresys-advanced) — HRMS/BPM platform
- **Fase**: **MVP-3 FULL SHIPPED** post-C19 (7/7 Tappe: A · B · C · D-pragmatic 13/19 · E-full MFA login-gating · F-pragmatic /showcase deferred · G). Tag `v0.3.2-mvp3-full` su origin (delta vs v0.3.1: Tappa E full MFA + Tappa D pragmatic accept-residual + 2 CVE fixed). `@heuresys/ui@0.1.1` PUBLISHED npm (0.1.0 deprecated). Admin core 40+ routes build OK con versioned dep. **KNOWN ISSUE DEFER-F**: /showcase routes (apps/web/src/_disabled_showcase_X18) + apps/showcase static deploy hit Next.js 15 RSC bundle-threshold defect — emergent, NON single-component (12 bisect iter HALT-022-06 inconclusive). Proper fix deferred: Path A git bisect / Path F split @heuresys/ui / Path E Next 16.
- **Ultimo HEAD pushato**: `da8e9c9` (post-X18 housekeeping cleanup, pushed 2026-05-24T~22Z). Catena X18 completa su origin: `da8e9c9` (inbox cleanup) ← `230afb0` (release notes) ← `754fe35` (Block E MVP-3 Tappa F) ← cascade 022.x amendment. ux-design-shared HEAD `dfa2e81` (0.1.1 publish-ready) pushato anche su origin.
- **Tag**: `v0.2.1-mvp2a-final` (X16) + `v0.3.1-mvp3-final` (X18, target `754fe35`, SHA `a4dc2c3c`) **entrambi su origin**. GitHub releases LIVE: https://github.com/Spen-Zosky/heuresys-advanced/releases/tag/v0.2.1-mvp2a-final + https://github.com/Spen-Zosky/heuresys-advanced/releases/tag/v0.3.1-mvp3-final (published 2026-05-24T23:54:28Z, name "MVP-3 final", notes da `qa_artifacts/x18_mvp3_release_notes_v0.3.1.md`).
- **PROMPT in flight**: nessuno. PROMPT 022 cascade (022 → 022.1 → 022.2 → 022.3 → 022.4 → 022.5) all closed via REPORT 022 RESUMED-X18.5. Tappa F shipped pragmatic.
- **npm registry state**: `@heuresys/ui` org `@heuresys` (owner spen-zosky). 0.1.0 DEPRECATED, 0.1.1 latest. GAT bypass-2fa configured in `~/.npmrc` (R11: never log token value).
- **Loop CLI**: FERMO (cron disattivato S929, manual poll only)
- **REPORT history**: 017 (X13) · 018 (X14) · 019 (X15) · 020 (X16) · 021 (X17) · **022 (X18 Tappa F npm publish — 5 amendment cascade + 6 halt + 12 bisect iter, pragmatic close Path B+C)** · **026 (X19.A Dependabot CVE — uuid bump)**

> **C19 sequenza autonoma 3-batch (X19.A → X19 → X20)** — start 2026-05-25T00:16:50Z, time-box 4h, NO push autonomi.
> - ✅ **X19.A DONE** (commit `b01c331`): uuid CVE-2026-41907 fixed via scoped override `exceljs>uuid >=11.1.1` → uuid@14.0.0 single version (8.3.2 eliminato). qs già fixato c304b02. typecheck API+web PASS, vitest API 336 (=baseline, 1 fail skills pre-esistente non-uuid), web build PASS.
> - ✅ **X19 ACCEPT-AS-RESIDUAL** (commit `e13eb73` + Cowork C19.1 decision 2026-05-25): run `6f531559` COMPLETED clean (47min, 34509 upserted, 0 failed, sys_users=433 ✅). MVP-3 Tappa D status FINAL: **13/19 IMPORT closed (68%)**, 6 residual classified per CW-B60 in 2 categorie: **(A) Engine silent-filter** (3 target: skill_categories/activity_classification_mappings/process_kpi_templates → 0 upserted silenzioso + 0 log, oltre CW-B49) deferred a forensic session dedicata; **(B) Scope gap** (3 target: blueprint_overrides/position_learning_requirements/position_skill_requirements → nessun staging.wave1_* source) deferred a Wave 2 / computed views ADR. Acceptance `≥75/134` mia spec era IRRAGGIUNGIBILE (solo 19 distinct IMPORT target Wave-1, max teorico 62/134) — CW-B52 staleness Cowork acknowledged. Tappa D closure pragmatic 13/19.
> - ✅ **X20 DONE** (MVP-3 Tappa E full closed): `mfaService.beginLoginChallenge` composto in `auth.service.login()` + `/login` UI 2-step (TOTP RFC 6238). LoginResponse → discriminated union `status: success|mfa_required`. 5 nuovi integration test (real TOTP) + Playwright `login-mfa` 2/2 (prod build) + web build PASS + vitest API 341 passed (0 regression, stesso 1 fail skills:131 pre-esistente). Codici: MFA_CODE_REQUIRED/MFA_INVALID/MFA_TOTP_INVALID. MFA factors DB = 0 post-cleanup. NO push. X21 (DEFER-F HIGH-RISK) resta fuori scope autonomo.
> - 🏁 **Sequenza C19 CONCLUSA** (X19.A ✅ + X19 ✅ accept-residual + X20 ✅). Background da terminare: tunnel 5433 + API :3001 + web :3000.

## §1.5 — Next-session candidates post-S933 (priorità da utente)

Vedi `sessioni/session_2026-05-26_preflight/PREFLIGHT_REPORT.md` §8 per raccomandazioni dettagliate. Sintesi opzioni N+1:

| ID | Scope | Effort | Risk | Razionale priorità |
|---|---|---|---|---|
| ~~P0-2 CW-B60-A~~ | ~~Forensic engine silent-filter~~ | — | — | ✅ **CHIUSO S934** — observability fix shipped (audit `SILENT_UPSERT_ZERO_ROWS_V1` + WARN + 3 unit test). Live re-run validation DEFERRED a S935 (richiede tunnel SSH). Vedi §0bis. |
| **P0-3 CW-B60-B** | Wave 2 / computed views scope ADR (3 target IMPORT senza staging source) | ~2-3h | MED | Indipendente da CW-B60-A. MVP_4_ROADMAP §2.1 fornisce già contesto Wave 2. Adesso top-prio dopo S934 ship. |
| **P0-1 DEFER-F** | /showcase Next 15 RSC bundle-threshold proper fix (PROMPT 025 pending dal 2026-05-25) | ~2-3h+ | HIGH | HIGH-RISK ma isolato (admin routes UNAFFECTED). Path A bisect / F split / E Next 16. |
| **S935 first-act** | Ship S934 lavoro pending (gira `ship-cw-b60-a.ps1` Windows host) + live re-run validation 1 dei 3 target con tunnel attivo + verifica `audit.import_validation_results` ha rows con `rule_code='SILENT_UPSERT_ZERO_ROWS_V1'` | ~30-60min | LOW | Pre-requisito per ogni P0 successivo. |
| pre-flight residual | CODE-2/3/5/7/10 + i18n discovery | ~5-8h | LOW | Cleanup workshop dedicato — non bloccante. |
| sec-dependabot | Dependabot 12 PR triage + qs + branch protection docs | ~4-6h | LOW | Risk hardening — non urgente ma value alto. |
| ci-runners | Dual self-hosted runners OCI VM + Windows + workflow yaml | ~8-12h | MED | Effort grande; richiede SSH setup + token mgmt. |
| qa-validation | skills:131 fix + chunked test + count divergenze | ~3-5h | LOW | Da fare DOPO i 3 P0 per validare regression. |

## §2 — Decisione attesa (post-S933) — formato originale C19 mantenuto per compatibilità

Sequenza C19 status (aggiornata 2026-05-25 post C19.1 accept-residual decision):

| # | Batch | Stato | Note |
|---|---|---|---|
| 1 | X19.A Dependabot CVE | ✅ DONE `b01c331` | uuid scoped override, qs già done c304b02 |
| 2 | X19 Brownfield Wave 1 | ✅ DONE `e13eb73` accept-as-residual | Tappa D 13/19 IMPORT, 6 residual CW-B60 deferred A/B |
| 3 | X20 MFA login-gating | ✅ DONE (REPORT 024) | Tappa E full closed — login 2-step TOTP, 5 vitest + Playwright 2/2 |
| 4 | X21 DEFER-F /showcase | ⏳ FUORI sequenza autonoma — gestito separato | HIGH-RISK, Cowork attiva richiesta |

**Next-session candidates** (post-C19, NON in scope MVP-3):

| ID | Scope | Origin | Effort |
|---|---|---|---|
| **CW-B60-A** | **Forensic engine silent-filter** | X19 residual cat (A) — 3 target AUTO_APPROVED + 0 upserted silenzioso + 0 log. Deep-dive `executeUpsert` filter logic oltre CW-B49 + aggiungere observability (log WARNING per silent-skip) + unit tests | ~2-3h dedicated |
| **CW-B60-B** | **Wave 2 / computed views scope ADR** | X19 residual cat (B) — 3 target senza staging.wave1_* source (blueprint_overrides + position_learning_requirements + position_skill_requirements). Definire fonte: derived/computed views OR Wave 2 import scope formalmente | ~2-3h ADR + impl |
| **DEFER-F** | /showcase Next 15 RSC bundle threshold | PROMPT 025 pronto, Path A bisect + Path F split fallback | ~3-4h CLI (Cowork attiva) |
| **PRE-EXIST** | skills.integration.test:131 createdSkillIds list visibility | X19.A flagged side-find, NON correlato uuid | ~30-60 min |
| **DEPENDABOT-77** | Eventuali ulteriori vuln post-X19.A | GitHub Dependabot ongoing | ~30 min |

**Decision authority Enzo** per ognuno. Pattern memo C19 PM consolidation rimane ongoing task (§20 già updated questo batch).

## §3 — File da leggere SUBITO (priorità ordinata)

| # | Path | Righe | Perché |
|---|---|---:|---|
| 1 | `cowork_code_exchange/_04_REPORT_022_batch_x18.md` | ~134 | Last REPORT — X18 Tappa F saga (pre-halt sections, cascade documented in PROMPT 022.x amendment files) |
| 2 | `cowork_reserved/bias_registry.md` | ~150 | SoT 58 bias (CW-B17→B59), CW-B57 withdrawn, CW-B59 deferred-architectural, next CW-B60 |
| 3 | `qa_artifacts/x18_mvp3_release_notes_v0.3.1.md` | ~103 | MVP-3 final release notes (overview X18 saga + bias + DEFER-F deferral plan + next session candidates) |

**Solo se scelta è DEFER-F**: leggi anche `cowork_code_exchange/_01_PROMPT_022.4_batch_x18_amendment.md` (bisect procedure CLI executed) + `qa_artifacts/x18_4_bisect_iter_*.txt` (12 iter empirical evidence Next 15 RSC bundle threshold).

**NON leggere** subito (consultare on-demand):
- `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` (pattern memo — solo se serve scrivere PROMPT nuovo)
- REPORT 015/017/019 (già processati, info essenziali in registry + STATE)
- Batch precedenti `cowork_reserved/batch_c[1-13]/` (archive)

## §4 — Vincoli operativi non-negotiable (heredita)

- **CARD-4 / I-1 NO MOCK**: dati live e2e via Prisma/pg, mai placeholder. Vedi CLAUDE.md root §REGOLA NON NEGOZIABILE
- **R20 Feasibility 5-Q**: prima di dichiarare "non eseguibile" applica i 5 criteri (Grep concreto / token budget / pattern repetitivity / test coverage / risk register). Mai opinione travestita da valutazione
- **R10 No-hallucination**: se manca contesto (S929 brainstorming, opzione (a)/(b)/(c) referenti), dichiarare apertamente e leggere file mancanti prima di emettere PROMPT
- **Decision Authority**: Enzo decide chiusura/interruzione. Cowork formula proposte evidence-based con budget+rischi, non veti. **Delega su stato stale = non vincolante** — re-confermare su baseline corretta
- **R11 Secret hygiene**: mai loggare password/key/token/connection string
- **I13 PostgreSQL 16 NATIVE no Docker** + **I5 tenant via FK+middleware no RLS** + **I7 auth separato sys.sys_auth_***
- **Halt+escalate**: solo per P0 via `cowork_code_exchange/.inbox/cowork/pending/<TS>_<goalid>_halt_<reason>.md`

## §5 — Engine state snapshot (post-X17)

- **17 transform codes** (DIRECT_COPY · CAST_TIMESTAMPTZ · CAST_VARCHAR · CAST_ENUM · TRIM · LINEAGE_SOURCE_NK · JSON_EXTRACT · LOOKUP_FK · LOOKUP_FK_2HOP · +8)
- **18 ADR accepted** (0014 SDBI · 0015/0016 nullable FK · 0017 LOOKUP_FK_2HOP · 0018 COALESCE-UQ)
- **Migrations applied**: 42 (last X13)
- **Bias**: 58 catalogati (CW-B17→B59 inclusi gap), 39 mitigated, **CW-B57 WITHDRAWN** (dual-package misdiagnosis — tsup auto-externalize deps by default), **CW-B59 deferred-proper-fix** (bisect methodology contamination + Next 15 RSC bundle threshold). X18 bias: CW-B55 (subpath consumer scan, C18.1) · CW-B56 (publish 2FA + org pre-flight, C18.2) · CW-B58 (outExtension/misdiagnosis-via-assumption, triple-reinforced) · CW-B59 (bisect contamination + RSC threshold). **CW-B58 lesson finale: empirical test matrix > narrative diagnosis** — applicata da CLI in self-check, NON Cowork-side (5 amendment cascade su hypothesis sbagliate).
- **Test suite**: 336/342 vitest (apps/api); **apps/web admin typecheck + build PASS con versioned @heuresys/ui@0.1.1 (40+ routes, X18 Path C)**; Playwright 124/125 X16 baseline. X18 Playwright auth.setup env-blocked (API :3001 + SSH tunnel :5433 non attivi in sessione CLI; build pass = primary gate).
- **DB live**: sys.* 60/134 populated (45%), legacy_mirror 116 tables, brownfield.table_mappings IMPORT + 14 REFERENCE_ONLY
- **MVP-2a state**: 40+ routes admin core (28 admin + 13 ESS + `/system-health`), 272 endpoints, 50 API integration tests, i18n parity 100% it/en, sys_users 433 NO REGRESSION
- **MVP-3 state**: A ✅ · B ✅ · C ✅ · D ✅ (47k residual) · E backend+UI ✅ · **F ✅ pragmatic (npm publish 0.1.1 + admin versioned; /showcase deferred DEFER-F)** · G ✅
- **@heuresys/ui npm**: published 0.1.1 (0.1.0 deprecated), org @heuresys owner spen-zosky, tsup dual ESM+CJS (.mjs/.cjs/.d.ts/.d.cts), exports 4 entries (`.` + 3 subpath preserved), tsup auto-externalizes ~85 deps by default (external list in config harmless-redundant). dist committed in ux-design-shared (no CI). **KNOWN ISSUE**: versioned dep breaks /showcase static page-data collection (Next 15 RSC bundle-threshold) — admin routes UNAFFECTED.
- **X18 deferred restore**: `mv apps/web/src/_disabled_showcase_X18 apps/web/src/app/showcase` + rm `src/_disabled_showcase_X18` from apps/web/tsconfig.json exclude, in DEFER-F session post root-cause fix.

## §6 — Lessons (apply going forward)

| Lesson | Mitigation |
|---|---|
| Read REPORT integrali consuma 5-8% context cadauno | Leggere solo §0 pre-conditions + §<bias updates> + §<next step>, full read solo se serve azione mirata |
| PROMPT > 80 righe sature troppo | Split: PROMPT principale 60 righe + ALLEGATO.md letto solo da CLI |
| Scheduled task watchdog recurring consuma context Cowork | On-demand poll trigger esplicito utente, NON recurring |
| Sessioni > 60 turni con artifact > 100 righe → saturazione lineare | A turno 50 proporre `/compact` o split sessione |
| Autonomia continua senza checkpoint utente → no recovery quando context si esaurisce | Almeno 1 checkpoint utente ogni 3-4 batch decision autonome |
| **HANDOFF non aggiornato dopo CLI batch in autonomia → Cowork riparte su stato stale** | Ogni batch CLI deve aggiornare HANDOFF_FRESH_SESSION.md §1 + §2 + §3 nel proprio §5 Block D, non solo `.handoff/STATE.md` |
| **Burn-in `NEXT_PUBLIC_*` findstr in chunks = false-negative** | Next.js inlines values, not names. Canonical burn-in = HTTP smoke su gated route |

## §7 — Connectivity prerequisites (verifica al bootstrap)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT NOW()"
# Post-X18 (2026-05-24): @heuresys/ui è npm-published ^0.1.1, NON più link: symlink.
# Verify install con: pnpm ls @heuresys/ui  →  deve mostrare 0.1.1 risolto da registry.
# Il vecchio check 'readlink → /d/ux-design-shared/ui' è OBSOLETO post-X18.
pnpm ls @heuresys/ui                                                # deve dare versione concreta (es. 0.1.1)
```

## §8 — Output: prima risposta nuova sessione

Dopo aver letto §1-§5, rispondi:
1. ACK + 3-righe sintesi stato (MVP-2a CERTIFIED post-X16, 124/125 PASS, tag locale)
2. Domanda A/B/C/D su §2 (con nota delega stale)
3. Aspetta decisione utente

**Niente** strategic analysis, **niente** PROMPT nuovo, **niente** azione autonoma prima della risposta utente.

---

*End HANDOFF — aggiornare prima di chiudere ogni sessione lunga. **Lezione X14-X16**: ogni REPORT CLI deve includere "HANDOFF refresh" come Block D obbligatorio.*
