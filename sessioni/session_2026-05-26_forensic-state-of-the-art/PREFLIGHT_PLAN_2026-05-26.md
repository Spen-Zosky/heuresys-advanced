# Pre-flight Plan — Heuresys Advanced 2026-05-26

**Owner**: Cowork (Claude Opus 4.7)
**Trigger**: utente direttiva 2026-05-26 — risolvere tutti i debiti tecnici prima di affrontare P0 (DEFER-F, CW-B60-A, CW-B60-B)
**HEAD pre-flight**: `08a0d11` (post P1 housekeeping pushed)
**Tag target post-flight**: `v0.3.3-preflight-clean`
**Mode**: AUTONOMIA PIENA post via-libera utente
**Effort stimato totale**: 45-60h esecuzione (delegata a subagent dove fattibile per parallelizzazione)

---

## 0. Decisioni operative confermate (4 ambiguità risolte da utente)

| # | Topic | Decisione utente |
|---|---|---|
| Q1 | Scope items HIGH-effort opzionali | **Include tutti i 3 high-effort** (CODE-6 queries.ts refactor 8-15h + DOC-6 MVP-4 ROADMAP completa 2-3h + DOC-7 Wave runner docs complete 4-6h) |
| Q2 | Strategia CI workflow | **Full CI con self-hosted runner setup** |
| Q3 | Dependabot triage | **Merge minor/patch groups auto + defer-major + close duplicati** |
| Q4 | QA-1 + Test gate | **Fix QA-1 + full test gate** (pnpm test mandatory GREEN) |
| Q5 | Self-hosted runner host | **Entrambi (OCI VM primary + Windows backup)** |

---

## 1. Regole operative non-negotiable (richiamo)

### Da CLAUDE.md global user-level (R1-R17)
- **R1** Pensa prima, max 2 frasi piano per sub-task
- **R3** Correggere OGNI errore in scope (no "pre-esistente")
- **R5** Test-before-claim: ogni asserzione negativa o conteggio = verified-by (comando + output + path + timestamp)
- **R9** Efficienza/token hygiene: parallel tool calls, no re-read same file, Grep before Read
- **R10** No-hallucination: se non so → check o "non verificato"
- **R11** Secret hygiene: ZERO valori `.env`/`.secrets/`/`*.pem`/token in chat o file
- **R12** Git safety:
  - PUSH pre-autorizzato per pre-flight ✅
  - `--force` / `--force-with-lease` / `--no-verify` VIETATI senza richiesta esplicita
  - `git reset --hard` con guard
  - Mai amend commit pushato
- **R13** Subagent delega: usare per esplorazioni multi-step + verifiche indipendenti
- **R14** Anti-bias: >2 tentativi falliti stessa direzione → cambio approccio (no escalation effort)
- **R16** PowerShell 5.1 robusto (cross-OS workaround per WSL2 lock issues come visto in P1 housekeeping)

### Da CLAUDE.md project-level
- **I1-I14** Invarianti (mai violare): Position-centric, sys canonical, no RLS, auth separato, PIP=VIEW, no Docker, varchar+CHECK no ENUM, ESS hard self-scope, ecc.
- **Live-data doctrine**: zero mock/stub in production code, anche nei refactor CODE-6 queries.ts
- **Module pattern 7-step**: per ogni nuovo modulo (nessuno previsto in pre-flight)
- **Atomic commit**: ogni intervento logico = 1 commit

### Da user_preferences Cowork (CW1-CW3)
- **CW1** Outputs mirroring: artefatti session in `D:\heuresys-advanced\sessioni\session_2026-05-26_*\` ✅
- **CW2** Cowork↔CLI protocol: non in scope pre-flight (no nuovi PROMPT)
- **CW3** Bootstrap reference noted

---

## 2. Gates & Guardrails

### Gates (verifiche obbligatorie pre-passaggio fase successiva)

| Gate | Verifica | Tool |
|---|---|---|
| **G0** Pre-flight | tunnel SSH 5433 up; pnpm test baseline documentato (341/1/5 skills:131 noto); git status clean | `netstat`, `pnpm test`, `git status -sb` |
| **G1** post-DOC base | ADR_INDEX include 0014-0018; STATE.md numeri match realtà (verified-by); commit pushed | grep + diff + git log origin |
| **G2** post-DOC high-effort | MVP_4_ROADMAP.md exists + cross-refs valid; 3 wave_runners docs exist; commit pushed | ls + grep |
| **G3** post-CODE base | typecheck PASS + lint PASS + 0 console.error in src/ (grep); Tailwind portability ok; commit pushed | pnpm typecheck/lint + grep |
| **G4** post-CODE-6 | typecheck PASS + Playwright smoke 5 personas PASS (live); 0 regression; commit pushed | pnpm + playwright |
| **G5** post-SEC base | pnpm audit moderate clean; Dependabot backlog ≤2 PR; branch protection docs in repo; commit pushed | pnpm audit + gh pr list |
| **G6** post-CI workflows | ≥1 workflow run green su OCI runner + ≥1 su Windows runner; secrets non leaked | gh run list + log redaction check |
| **G7** post-QA | pnpm test GREEN (oltre eventuale skills:131 documented); SKIP count documentato; commit pushed | pnpm test + grep |
| **G8** Closure | Tag pushed; HANDOFF/STATE/forensic refresh; sync 0/0 origin/main | git tag + git rev-list |

### Guardrails — AUTONOMY MODE STRICT (post direttiva utente 2026-05-26)

**Direttiva utente**: "io non posso presidiare queste sessioni, per qualunque necessità devi trovare tu la soluzione migliore ed applicarla autonomamente". Le stop conditions originali sono riformulate:

**Decisioni autonome (NO STOP)** — applico best-effort + log in PREFLIGHT_REPORT:
1. **>2 tentativi falliti stessa direzione** (R14) → cambio approccio + documento alternative considered
2. **Test rosso oltre baseline** → diagnose + fix se ≤1h; altrimenti documento root cause + `it.skip` esplicito con TODO-link + continuo
3. **Push fallisce** → diagnose (no remote sync? auth?) → fix autonomo se possibile (re-pull, retry) o log + skip push gate-corrente
4. **Secret rilevato in staging** → reset + clean + re-stage (mai committare segreti)
5. **Violazione invariante I1-I14 rilevata** → scrivo ADR proposing change + applico solo se non-destructive; documento per review futura
6. **Scope ambiguity dentro sub-task** → scelta best-effort + log razionale

**STOP HARD (solo blocchi infrastrutturali esterni)** — log + attendi:
- Tunnel SSH 5433 morto e SSH key non funzionante (non posso fix da remoto)
- OCI VM unreachable (network outage)
- GitHub API auth completamente fallita
- Disk full su workspace
- `.git/objects` corrotto

**MAI eseguito senza nuova esplicita user direttiva** (irreversibili, già R12):
- `git push --force` / `--force-with-lease`
- `git push --no-verify`
- `git reset --hard` su HEAD pushato
- `git commit --amend` su commit pushato
- `DROP DATABASE heuresys_advanced` o `heuresys_platform` (legacy)
- `rm -rf` su path non-temp
- Modifica `pg_hba.conf`/`postgresql.conf` su VM OCI
- Modifica SSH config / OCI security list
- Modifica root-level filesystem Windows (C:\Windows, C:\ProgramData)

Per casi MAI-eseguito: log decisione, propongo alternative non-distructive in PREFLIGHT_REPORT, lascio per review post-pre-flight.

### Commit/push strategy
- Atomici per categoria (1 commit per item logico)
- Push gate-by-gate (non a fine totale)
- Conventional commits + Co-Authored-By footer
- Mai amend pushed commits
- Tag annotato finale `v0.3.3-preflight-clean`

---

## 3. Fasi operative (9 phases)

### Phase 0 — Pre-flight check (~30 min)
**Sub-tasks**:
- F0.1 Tunnel SSH 5433 verify (auto-restart se down)
- F0.2 pnpm install -r refresh + dep tree clean
- F0.3 Baseline capture: `pnpm test` (apps/api) + `pnpm typecheck` + `pnpm lint` + `pnpm i18n:check` → output salvati in `sessioni/.../preflight_baselines/`
- F0.4 Git status clean confirm (no uncommitted)
- F0.5 .secrets/ struct verify (struttura solo, NO segreti loggati)

**Gate G0**: tunnel up + pnpm test baseline numerica documentata + git pulito.

### Phase 1 — DOC base (~6-8h)
**Sub-tasks** (DOC-1,2,3,4,5,8,9,12,13,14,15):
- F1.1 ADR_INDEX.md refresh (add 0014/0015/0016/0017/0018 entries) + verifica cross-refs
- F1.2 Scrittura `docs/architecture/adr/0017_lookup_fk_2hop.md` (referenced da 0014 + 0018, mig 000043 esiste)
- F1.3 README.md root: rimuovere "@heuresys/ui linked via link:" + aggiornare component count + status post-X18
- F1.4 HANDOFF.md refresh post-C19/P1 (cronologia continuata fino al 2026-05-26)
- F1.5 cowork_reserved/HANDOFF_FRESH_SESSION.md: fix readlink obsoleto + update pre-flight stato
- F1.6 .handoff/STATE.md: correggere drift (positions 55 non 158; column_mappings 1271 non 1177; staging 18 non 17; migration count 42)
- F1.7 apps/api/package.json description aggiornare ("Fastify 5, 58 modules, 272 endpoints")
- F1.8 .env.example: MFA_ENCRYPTION_KEY rimuovere label "post-MVP", marcare REQUIRED (Tappa E full shipped)
- F1.9 docs/api/API_IMPLEMENTATION_PLAN.md: aggiungere note state-machine wave-executor 8 stati (era 6)
- F1.10 Commit atomici per DOC + push

**Gate G1**: ADR registry == filesystem (18 file vs 18 entries); STATE numbers verified-by query DB.

### Phase 2 — DOC high-effort (~7-10h)
**Sub-tasks** (DOC-6,7,10,11):
- F2.1 `docs/MVP_4_ROADMAP.md` completa (~30 pagine markdown): scope, dependencies, effort, gates, acceptance per ogni stream (Brownfield Wave 2-4, SDBI Phase 2 pilot, MFA hardening, React Flow renderer, Mermaid renderer, Mobile responsive, WCAG 2.2 AA tail, OCI Managed migration prep, npm publish @spen-zosky/ui)
- F2.2 `docs/brownfield/wave_runners/wave_2_runner.md` completa (tenant operating model RTL_BANK_REFERENCE, ~94 source tables / 31 sys.* targets, pre-flight, execution steps, acceptance)
- F2.3 `docs/brownfield/wave_runners/wave_3_runner.md` completa (sensitive tenant data + human approval gates + ADR pre-required)
- F2.4 `docs/brownfield/wave_runners/wave_4_runner.md` completa (cross-tenant + governance)
- F2.5 BOOTSTRAP §10 Q1-Q8 marcare RESOLVED (post-RD-24) + cross-ref ADR-0010
- F2.6 docs/api/API_IMPLEMENTATION_PLAN.md refresh moduli 23→58 + endpoint 148→272 + esempi per nuovi moduli
- F2.7 Commit atomici + push

**Gate G2**: 4 wave_runners docs exist + MVP_4_ROADMAP navigable + cross-refs valid.

### Phase 3 — CODE base (~5-8h)
**Sub-tasks** (CODE-1,2,3,4,5,7,10):
- F3.1 brownfield-wave-executor: 6 `console.error` → `app.log.error` o `req.log.error` (engine.ts:223,268,820 + upsert-sql.ts:683,892,917)
- F3.2 apps/api/package.json: rimuovere o riscrivere script `test:integration`, `openapi:generate`. Se openapi generator realizzabile (~2h), scriverlo + generare `apps/api/openapi.yaml`. Altrimenti cleanup.
- F3.3 Tailwind 4 source-scan fix: `apps/web/src/app/globals.css` `@source` → path pnpm-resolved (`../../node_modules/@heuresys/ui/dist`) invece di working copy locale `D:/ux-design-shared/ui/src`. Verifica portability CI/Mac.
- F3.4 apps/web/package.json: aggiungere `"@heuresys/ui": "^0.1.1"` come dep esplicita
- F3.5 Rimuovere `apps/web/src/_disabled_showcase_X18/` (18 file dead code). NB: PRIMA backup nel `cowork_reserved/archived_2026-05-26_disabled_showcase_X18/` per recovery se DEFER-F dovesse riattivarli
- F3.6 apps/web: aggiungere `vitest.config.ts` o rimuovere script `test` dead da package.json
- F3.7 i18n discovery: grep literal IT/EN strings in `apps/web/src/**/*.tsx` per identificare missing translations → estendere `it/common.json` e `en/common.json` + verify `pnpm i18n:check` parity
- F3.8 Typecheck + lint gate intermediate
- F3.9 Commit atomici + push

**Gate G3**: typecheck PASS + lint PASS + grep 0 console residui in src/ + Tailwind config funzionante senza working copy locale (verificato via build).

### Phase 4 — CODE-6 queries.ts refactor 47 routes (~10-15h)
**Sub-tasks**:
- F4.1 Pattern design: definire convenzione `queries.ts` adiacente a `page.tsx` (hook tipato `useFoo()` ritorna `UseQueryResult<T>`)
- F4.2 Refactor pilot: 1 route (es. `/me/profile`) come template + verify Playwright E2E ancora verde
- F4.3 Refactor batch admin layer (30 routes): users/positions/skills/kpis/learning/blueprints/visualizations/ecc. Sub-commit per gruppo (5-10 routes per commit).
- F4.4 Refactor batch ESS layer (14 routes): /me/*. Sub-commit.
- F4.5 Refactor auth + system (3 routes): /login, /system-health, root router. Sub-commit.
- F4.6 Typecheck + lint full + Playwright E2E full (61 test). Iterare fix fino verde.
- F4.7 Push fase

**Gate G4**: typecheck PASS + Playwright 61/61 GREEN + 0 regression vs baseline + queries.ts presente per ogni page.tsx (verified ls).

### Phase 5 — SEC base (~4-6h)
**Sub-tasks** (SEC-1,2,3,6,7):
- F5.1 Dependabot triage (12 PR):
  - Verify gh CLI installato (`gh --version`); auth se serve
  - PR per PR: check CI status (se GitHub-hosted tests), label e merge minor/patch
  - Close duplicato `next-15.5.18` PR (mantieni il primo)
  - Label `defer-major` + comment su `zod-4.4.3` (breaking changes)
- F5.2 `pnpm install -r --frozen-lockfile=false` per refresh lockfile post-merges
- F5.3 `pnpm why qs` per verify dual-resolution → cleanup se necessario
- F5.4 `pnpm audit --audit-level=moderate` clean check
- F5.5 Verifica auto-close CVE-2026-41907 (uuid) + #76 (qs) su GitHub Security
- F5.6 MFA_ENCRYPTION_KEY: verifica `apps/api/src/config/env.ts` (o equivalente) — se non listato come required, aggiungerlo (alignment con `.env.example` + Tappa E shipped)
- F5.7 Branch protection rules: scrivere `docs/github/branch-protection.md` (canonical doc) con stato server-side attuale + recommendations
- F5.8 Commit atomici + push

**Gate G5**: pnpm audit moderate = 0 vulnerabilities + Dependabot backlog ≤2 (defer-major + eventuali review-needed) + branch-protection.md exists.

### Phase 6 — CI workflows + dual self-hosted runners (~8-12h)
**Sub-tasks**:
- F6.1 GitHub registration token (ephemeral, NO LOG):
  - Via gh CLI: `gh api -X POST /repos/Spen-Zosky/heuresys-advanced/actions/runners/registration-token`
  - Salvato come variabile shell, mai stampato
- F6.2 OCI VM runner install (primary):
  - SSH a `oracle-vm-default`
  - Download actions/runner ARM64 (`https://github.com/actions/runner/releases/download/v2.X.X/actions-runner-linux-arm64-*.tar.gz`)
  - `./config.sh --url https://github.com/Spen-Zosky/heuresys-advanced --token <REDACTED> --labels self-hosted,oci-vm,linux,arm64`
  - Install as systemd service: `sudo ./svc.sh install ubuntu && sudo ./svc.sh start`
  - Verify online via `gh api /repos/.../actions/runners`
- F6.3 Windows local runner install (backup):
  - Download actions/runner Windows x64
  - Install in `C:\Users\enzospenuso\actions-runner\` (workspace-level scripts location)
  - `config.cmd --url ... --token <REDACTED> --labels self-hosted,windows-fallback`
  - Install as Windows service
- F6.4 Workflow `.github/workflows/typecheck.yml`: matrix typecheck su apps/api + apps/web + packages/shared, GitHub-hosted ubuntu-latest
- F6.5 Workflow `.github/workflows/lint.yml`: lint + i18n:check GitHub-hosted
- F6.6 Workflow `.github/workflows/test-integration.yml`: `runs-on: [self-hosted, oci-vm]`, esegue pnpm test full con DB live (no tunnel needed se runner sulla VM)
- F6.7 Workflow `.github/workflows/playwright.yml`: `runs-on: [self-hosted, oci-vm]`, smoke 5 personas
- F6.8 Test execution: push feature branch, verify workflow run green
- F6.9 Commit workflow files + push

**Gate G6**: ≥1 workflow green su OCI runner + ≥1 green su Windows backup runner (anche via `workflow_dispatch` manual trigger). No secret leak in log.

### Phase 7 — QA gate finale (~3-5h)
**Sub-tasks** (QA-1,2,4,5,7):
- F7.1 QA-1 tentativo fix `apps/api/test/skills.integration.test.ts:131`:
  - Reproduce errore locale
  - Diagnose root cause (createdSkillIds non in list response — probabile pagination / filter mismatch)
  - Fix se ≤1h; altrimenti documentare in ADR + `it.skip` esplicito con riferimento
- F7.2 QA-2 grep `runIf|skipIf|test.skipIf|it.skip` in test/* per identificare i 5 SKIP dinamici
- F7.3 QA-4 risoluzione count divergenza 323 (grep statico) vs 341 (STATE dichiarato) — verifica `describe.each` expansion runtime
- F7.5 QA-7 estendere `apps/web/tests/e2e/me-pages.spec.ts` per coprire tutte 14 ESS routes (oggi 10/14)
- F7.6 QA-5 HANDOFF/STATE: aggiornare admin routes 30 (era 29 docs)
- F7.7 Full `pnpm test` integration + `pnpm exec playwright test` smoke 5 personas GREEN
- F7.8 Commit + push

**Gate G7**: pnpm test = X PASS (X = baseline ≥341) / 0 FAIL (skills:131 fixato o documented skip) / SKIP count documented + cause verified-by.

### Phase 8 — Closure (~1-2h)
**Sub-tasks**:
- F8.1 Refresh `D:\heuresys-advanced\sessioni\session_2026-05-26_forensic-state-of-the-art\FORENSIC_STATE_OF_ART_2026-05-26.md` (appendice "Pre-flight outcome 2026-05-26")
- F8.2 Refresh `HANDOFF.md` (nuovo entry "Pre-flight 2026-05-26 complete")
- F8.3 Refresh `.handoff/STATE.md` (baseline numeri post-preflight)
- F8.4 Write `sessioni/session_2026-05-26_preflight/PREFLIGHT_REPORT.md` (delivery finale: cosa fatto, gates passati, residui se any, raccomandazioni P0)
- F8.5 Tag annotato `v0.3.3-preflight-clean` su HEAD finale
- F8.6 `git push origin main --tags` (tag push autorizzato)
- F8.7 present_files al utente
- F8.8 Sintesi conversazionale finale

**Gate G8** (final): tag pushed + HANDOFF/STATE/forensic refreshed + sync 0/0 origin/main + report delivered.

---

## 4. Stop conditions (escalate-to-user)

In aggiunta ai guardrail §2:

- Dependabot CI fail su una PR specifica → label `needs-review` + skip merge, continua altri
- CI workflow self-hosted runner non si avvia → STOP + log diagnostico + ask user
- ADR-0017 LOOKUP_FK_2HOP richiede ricerca codice non triviale → delego subagent Explore
- MVP_4_ROADMAP > 50 pagine → split in multiple file (MVP_4_ROADMAP.md + MVP_4_BROWNFIELD.md + MVP_4_SECURITY.md + ecc.)
- queries.ts refactor rompe Playwright E2E → STOP fase 4 + diagnose + rollback se ≥3 routes fail

---

## 5. Tracking & checkpoint

- **TaskList**: 9 task fase (creati) + sub-task creati dinamicamente per ogni fase
- **Verified-by trail**: per ogni gate, comando + output + path + timestamp
- **Commit log**: conventional commits + Co-Authored-By footer + range trace
- **Push checkpoint**: 1 push per gate (non a fine totale)
- **Time tracking**: log timestamp inizio/fine fase in PREFLIGHT_REPORT finale

---

## 6. Tool inventory richiesto (R8)

Già caricati o disponibili:
- TaskCreate / TaskUpdate / TaskList ✅
- mcp__workspace__bash ✅ (Linux WSL2)
- mcp__Windows-MCP__PowerShell ✅ (cross-OS cleanup)
- Read / Write / Edit / Glob / Grep ✅
- WebSearch / mcp__workspace__web_fetch (per docs reference)
- mcp__visualize__show_widget (per eventuali diagrammi MVP_4_ROADMAP)
- mcp__cowork__present_files (delivery)
- Agent (subagent_type=Explore per esplorazioni codice, general-purpose per ricerche)

Da verificare/installare:
- gh CLI (per Dependabot triage + runner registration) — verifica `gh --version`
- actions/runner binary (download in OCI VM + Windows)

---

## 7. ETA & checkpointing

| Phase | Effort min | Effort max | Cumulative |
|---|---:|---:|---:|
| 0 Pre-flight | 0.5h | 1h | 1h |
| 1 DOC base | 6h | 8h | 9h |
| 2 DOC high-effort | 7h | 10h | 19h |
| 3 CODE base | 5h | 8h | 27h |
| 4 CODE-6 refactor | 10h | 15h | 42h |
| 5 SEC base | 4h | 6h | 48h |
| 6 CI workflows | 8h | 12h | 60h |
| 7 QA gate | 3h | 5h | 65h |
| 8 Closure | 1h | 2h | 67h |
| **TOTALE** | **44.5h** | **67h** | — |

Esecuzione **autonoma multi-ora**. Push gate-by-gate riduce rischio di perdita progress.

---

## 8. Pronto per via libera

Aspetto direttiva "vai" da Enzo. Al via:

1. Marco TaskUpdate #20 (Phase 0) → `in_progress`
2. Pre-flight check → Gate 0
3. Avanzamento sequenziale Phase 1 → 8 con gate verification
4. Stop solo per guardrail §2 + §4
5. Final delivery PREFLIGHT_REPORT.md

---

*Pre-flight Plan v1.0 — 2026-05-26 — Cowork session*
*Authored post-AskUserQuestion 4 ambiguities resolved + Q5 runner host*
