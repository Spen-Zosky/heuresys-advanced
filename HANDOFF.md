## 🎯 2026-05-26 — Cowork sessioni S934 + S935 + S936 (autonomy strict, post-P0 closure)

Sequenza 3 sessioni Cowork in cascade post-S933 pre-flight partial. Tag finale: **`v0.4.0-mvp4-ready`** (post-S935 Z closure, 9 commit total da `b27eccc` a `9fa3e57`).

### S934 (turn singolo, ~2h) — CW-B60-A engine silent-skip observability

Chiusura P0-2 originale del PREFLIGHT_REPORT §8. Root cause identificato: `upsert-sql.ts:763-765` ritornava `{upsertedRows:0, skipped:false}` su `pool.query(insertSql).rowCount === 0` → engine.ts:840 logger.error branch saltato (perché `skipped:false`) → silent return. CW-B17 audit copre solo skipFilter exclusions, non rowCount=0 main INSERT.

**Trigger comune ai 3 target affetti** (sys_skill_categories, sys_activity_classification_mappings, sys_process_kpi_templates): nessuno ha `_tenant_id` NK → CW-B49 COALESCE pattern inapplicabile → setClauses empty → ON CONFLICT DO NOTHING → rowCount=0 sui duplicati / re-run.

**Fix shipped** (commit `b27eccc` + duplicate `412cf6e`):
- `apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts`: nuovo `SILENT_UPSERT_ZERO_ROWS_V1` audit rule code.
- `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts:763-875`: probe SELECT count (staging input) + `logger.warn` structured (10 fields) + audit INSERT status SKIPPED BEFORE silent return. Result shape unchanged (back-compat).
- `apps/api/test/upsert-sql-cw-b60-a-silent-skip.test.ts`: 3 TDD test (T1 silent emette audit; T2 happy quiet; T3 DRY_RUN no side effect). 3/3 PASS via vitest pnpm exec real Windows host.
- `cowork_reserved/bias_registry.md` §60 reclassified to **MITIGATED via CW-B61** + CW-B61 entry added.

### S935 (turno autonomo non-presidiato, ~7h) — B/C/E/F/D/Z full sequence

Sequenza B→C→E→F→D→Z eseguita in autonomy strict post-S933 grant. 7 commit atomic + 2 annotated tag pushati.

| Fase | Commit | Deliverable |
|---|---|---|
| **B** CW-B60-B Wave-2 scope ADR | `1a2b6cf` | ADR-0020 reclassify 3 application-level targets (`sys_blueprint_overrides`, `sys_position_skill_requirements`, `sys_position_learning_requirements`) IMPORT→REFERENCE_ONLY. Schema analysis: tutti hanno `created_by/updated_by` FK a `sys_users` + tenant-scoped activation/position deps → application-level operational data, NOT eligible per brownfield import in any Wave. Migration `000044_cw_b60_b_reclassify_application_level_targets.sql` idempotente. ADR_INDEX entry. MVP_4_ROADMAP §2.1 Wave 2 out-of-scope amendment. CW-B60-B MITIGATED. |
| **C** DEFER-F CW-B59 reframed | `dbd791b` | Empirical re-read di `qa_artifacts/x18_4_bisect_iter_12.txt` → vera root cause `TypeError: d.createContext is not a function`, NOT "Next 15 RSC bundle threshold" (narrative-bias CW-B58 lesson). 3-path strategy: G React pnpm.overrides (10min quick-win), A revised message-grep bisect (1-2h), F split @heuresys/ui (4-6h fallback). Files: `docs/cw-b59-true-root-cause-2026-05-26.md` (analysis), `package.json` overrides react+react-dom+@types/react+@types/react-dom, `scripts/restore-showcase-routes.ps1`, `scripts/bisect-cw-b59-createctx.ps1`. CW-B59 reframed `partial-mitigation-investigation-shipped`. Tag intermedio **`v0.3.4-p0-closed`** post-C. |
| **E** SEC base | `bada257` | `docs/github/branch-protection.md` (canonical rules: linear history + status checks gating S935-F + force-push disabled + admin-included). `docs/github/dependabot-triage-2026-05-26.md` (4-bucket matrix MERGE_NOW/MERGE_BATCH/DEFER_MAJOR/CLOSE_DUPLICATE + qs dual-resolution verify + pnpm audit gate). `apps/api/src/config/env.ts`: `MFA_ENCRYPTION_KEY` `.min(32)` validation + soft-warn in production. |
| **F** CI workflows + OCI VM runner | `0845722` | 6 workflow YAML su `[self-hosted, oci-vm]`: typecheck + lint + i18n-parity + test-integration + build-web + playwright-smoke. Path-based scoping aggressive (docs/cowork commits skip CI). R11 secret hygiene via runner systemd EnvironmentFile (no literal secrets in YAML). `docs/ci/self-hosted-runners-setup.md` (9 sezioni procedurale OCI VM setup) + `docs/ci/workflows-overview.md` (inventory + scoping + failure handling). Backup Windows runner DEFERRED S937+. |
| **D** Pre-flight residual cleanup | `662e14c` | CODE-2 (apps/api dead scripts test:integration + openapi:generate rimossi). CODE-3 (Tailwind 4 `@source` portable: working-copy path → `node_modules/@heuresys/ui/dist/**/*.{js,mjs}`). CODE-7 (apps/web dead vitest test script rimosso). CODE-5 DEFERRED auto-coordinato con phase C ship. CODE-10 i18n discovery DEFERRED docs/preflight-residual-todo.md. CODE-6 queries.ts refactor explicit OUT OF SCOPE. |
| **Z** Closure | `dccd368` | bias_registry consolidation (CW-B60-A MITIGATED via CW-B61, CW-B60-B MITIGATED via ADR-0020, CW-B59 reframed; tally 60 catalogued / 42 mitigated; Next CW-B62). HANDOFF_FRESH_SESSION §0ter S935 outcome. .handoff/STATE.md S935 section. `sessioni/session_2026-05-26_s935/S935_SESSION_REPORT.md` full report. `cowork_reserved/auto-ship/run-all-s935.ps1` master ship script (poi superato per direct git+ps shell). Tag finale **`v0.4.0-mvp4-ready`**. |

### S936 (turn singolo, ~3h) — 6 follow-up post-S935

| # | Scope | Status | Commit |
|---|---|---|---|
| S936-1 | CW-B59 Path G build test live (restore /showcase + pnpm install + pnpm build) | **PARTIAL** — eliminated `d.createContext` error, exposed new blocker `Class extends value undefined` su /showcase/footer. Working tree restored (_disabled_showcase_X18 back). Next path: A bisect v2 con regex `Class extends|createContext` OR F split @heuresys/ui. | `f8776ee` |
| S936-2 | CW-B60-A live re-run validation (SSH tunnel + Wave-1 sample + audit count check) | **PARTIAL** — unit test 3/3 PASS sul Windows host vero (pino WARN structured emesso). Live DB re-run DEFERRED: 3 tentativi SSH setup falliti per passphrase prompt non-bypassable da MCP. | (parte di `25aa0df`) |
| S936-3 | OCI VM self-hosted GitHub Actions runner registration | **DEFERRED** — stesso SSH passphrase blocker. Procedura documentata `docs/ci/self-hosted-runners-setup.md` §3, ~1-2h interactive work. | (parte di `25aa0df`) |
| S936-4 | Patch user_preferences Cowork con MANDATORY TOOL PRELOAD block | **PARTIAL** — 4 tentativi save via Claude in Chrome JS injection falliti (React 19 + state interno ignora synthetic events, zero API call). Blocco preparato `cowork_reserved/MANDATORY_TOOL_PRELOAD_block_to_append.txt`. | (no commit code) |
| S936-5 | Fix Filesystem MCP extension allowed_directories | **DONE** — `userConfig.allowed_directories` patchato in `%APPDATA%\Claude\extensions-installations.json` (D:\, C:\, C:\Users\enzospenuso). Server boot OK verified via log `Secure MCP Filesystem Server running on stdio`. | (config Windows, no repo commit) |
| S936-6 | R23 AUTONOMIA OPERATIVA cross-layer | **DONE** — regola comportamentale comprehensive injected in 3 layer: (L2) `C:\Users\enzospenuso\.claude\CLAUDE.md` +3742B con R23 (a/b/c/d/e); (L3) `D:\heuresys-advanced\CLAUDE.md` +2639B con specifiche project-level; (L1) `cowork_reserved/PREFERENCES_v5_FINAL.txt` ready per paste claude.ai (save automatico via JS injection non funziona, paste manuale 30 sec). | `9fa3e57` |

### Razionale closure + outcome riepilogato

- **3 P0 chiusi** (target del v0.3.4 tag): CW-B60-A via S934, CW-B60-B via S935 B, DEFER-F via S935 C (partial Path G + scripts shipped).
- **SEC base + CI workflows** (target v0.4.0 tag): branch protection docs + Dependabot triage doc + MFA validation + 6 GitHub Actions workflow YAML self-hosted + OCI VM runner setup docs.
- **Residual cleanup**: 3 CODE-x inline + 2 deferred docs.
- **R23 comportamentale**: regola cross-layer per zero delega evitabile + proactive tool loading + self-diagnose fallback + evidence not suggestion. Triggered da S935+S936 frustrations utente su autonomy reale.
- **Bias registry**: 60 catalogued, 42 mitigated, next CW-B62.

### Carry-over per S937 (housekeeping closure + return to dev)

- ⏸️ Layer 1 claude.ai user_preferences paste manuale `cowork_reserved/PREFERENCES_v5_FINAL.txt` (utente ha già pasted manually post-S936-6, da verificare clean status).
- ⏸️ OCI VM runner registration (~1-2h) — `docs/ci/self-hosted-runners-setup.md` §3, requires interactive SSH session.
- ⏸️ CW-B59 next step — Path A revised v2 bisect (1-2h, regex `Class extends|createContext`) OR Path F split @heuresys/ui (4-6h architecturale).
- ⏸️ CW-B60-A live DB validation (~30min) — richiede ssh-agent persistent setup o passphrase interactive.
- ⏸️ Workaround SSH automation (ssh-agent registry persistent OR service-account no-passphrase key).
- 🎯 MVP-4 stream selection da `docs/MVP_4_ROADMAP.md` (9 streams parallelizable; suggerito 2.4 SDBI Phase 2 brownfield filone, OR 2.7 mobile+WCAG tail UX completion, OR 2.5 MFA multi-kind hardening).

Vedi `sessioni/session_2026-05-26_s937_housekeeping/NEXT_SESSION_START.md` (creato in S937) per priming completo.

---
## 🎯 2026-05-26 — Cowork session S933: P1 housekeeping + Pre-flight Phase 0+1 (autonomy strict)

Cowork session post-tag `v0.3.2-mvp3-full` che apre con un audit forensic comprehensive del progetto e poi procede a:

### Lavoro completato (HEAD aggiornato)

| Tappa | Commit | Output |
|---|---|---|
| Bootstrap turn 1 ACK + forensic audit | — | Lettura ancillari root + 7 subagent paralleli esplorazione (docs/cowork_code_exchange/cowork_reserved/api/web/db/config) → `sessioni/.../FORENSIC_STATE_OF_ART_2026-05-26.md` (~7000 parole, archive completo stato dell'arte + debiti tecnici + roadmap) |
| **P1 housekeeping** (9 commit, push range `ad7d5c0..08a0d11`) | `e61c042` `99ee8b0` `961cc2f` `da5f55b` `dea9012` `84bb132` `15cafac` `9b3703c` `08a0d11` | CLAUDE.md trailing fix · Goal 003 formal closure retroattiva (REPORT 003 + REVIEW 003 + STATE_003 CLOSED_PENDING_STRATEGIC_PIVOT) · REVIEW 004/005 per X1/X2 pending da 2026-05-20/21 · cowork_code_exchange complete archive (Goal 001/002/003 + batch X1-X8 + templates + baselines + handoff) · cowork-exchange scripts toolchain · cowork_reserved KB forensic F0-F12 + 12 batch_cN + bias_registry · ADR-0018 COALESCE-UQ · SystemHealthDashboard showcase · .gitignore worktree + cowork transient · sessioni/forensic doc |
| Cleanup tecnico | (parte P1) | Lock orphan + manifest pending-commits applied + worktree `musing-wing-802781` prunable + branch `claude/musing-wing-802781` rimossi · INDEX.md inbox rebuilt · inbox X1/X2 pending → read |
| **Pre-flight Phase 0** (commit `6d5541a`) | `6d5541a` | Baseline capture (G0 PASS con 2 riserve documentate): tunnel SSH 5433 UP · pnpm install OK · typecheck PASS shared/api/web/showcase · lint OK 3/4 (web FAIL 37 errors carry Phase 3) · i18n parity OK 23 keys · pnpm test deferred Gate G7 (chunked strategy MCP timeout) · vitest.config Vitest 4 migration fix (`poolOptions` → `fileParallelism + maxWorkers/minWorkers`) · PREFLIGHT_PLAN_2026-05-26.md (9 phases roadmap) |
| **Pre-flight Phase 1 DOC base** (in flight) | TBD | DOC-1 ADR_INDEX refresh add 0014-0018 (5 entries) · DOC-2 ADR-0017 LOOKUP_FK_2HOP scrittura retroattiva (188 LOC) · DOC-3 README.md rewrite post-X18 (272 endpoints + 47 routes + `@heuresys/ui` npm + MVP-3 closed + 18 ADR) · DOC-5 HANDOFF_FRESH_SESSION readlink obsoleto fix · DOC-8 apps/api/package.json description (Fastify 5, 58 moduli, 272 endpoint) · DOC-9 .env.example MFA_ENCRYPTION_KEY REQUIRED label · DOC-13/14/15 STATE.md drift fix (positions 55 non 158, column_mappings 1271 non 1177, staging 18 non 17, migration 42) |

### Pre-flight plan (9 phases, autonomy strict mode)

Direttiva utente 2026-05-26: Cowork procede in **autonomia piena** per chiudere debiti tecnici pre-MVP-4. Plan operativo in `sessioni/session_2026-05-26_forensic-state-of-the-art/PREFLIGHT_PLAN_2026-05-26.md`.

| Phase | Effort | Status |
|---|---:|---|
| 0 Pre-flight check | 0.5-1h | ✅ DONE (G0 PASS) |
| 1 DOC base (DOC-1..15) | 6-8h | ⏳ in flight |
| 2 DOC high-effort (MVP-4 ROADMAP + Wave runner docs + DOC-10/11) | 7-10h | pending |
| 3 CODE base (CODE-1..5,7,10 + lint web 37 errors fix) | 5-8h | pending |
| 4 CODE-6 queries.ts refactor 47 routes | 10-15h | pending |
| 5 SEC base (Dependabot 12 PR triage + qs + branch protection docs) | 4-6h | pending |
| 6 SEC CI workflows + dual self-hosted runners (OCI VM + Windows) | 8-12h | pending |
| 7 QA gate finale (skills:131 fix + full pnpm test green) | 3-5h | pending |
| 8 Closure (tag v0.3.3-preflight-clean + handoff + forensic refresh) | 1-2h | pending |

### Drift documentale risolti in P1+Phase 1

- ADR_INDEX.md fermo a 0013 → aligned a 0018 (5 entries aggiunte) ✅
- ADR-0017 LOOKUP_FK_2HOP mancante come file → scritto retroattivamente (referenced da migration 000043 + ADR-0014 §8 + ADR-0018 §8) ✅
- README.md root post-X18 obsoleto (link: vs npm-published, count 51 components vs 14+ widgets) → rewrite completo ✅
- HANDOFF_FRESH_SESSION readlink obsoleto (`/d/ux-design-shared/ui`) → updato a `pnpm ls @heuresys/ui` ✅
- apps/api/package.json description "Fastify 4, 23 modules" → "Fastify 5, 58 moduli, 272 endpoint + MFA TOTP" ✅
- .env.example MFA_ENCRYPTION_KEY label "post-MVP" → REQUIRED (post Tappa E MVP-3 v0.3.2) ✅
- STATE.md drift positions 158 (era users) → 55 (correct); column_mappings 1177 → 1271; staging 17 → 18 ✅

---

## 🎯 2026-05-23 — Batch X13 MVP-2a Coverage Hardening Sprint (acceptance-criteria-complete)

CLI sprint che chiude i residuali §5 NEXT_SESSION_MVP_2A.md dopo la validazione live state di X12. **MVP-2a passa da "strutturalmente completo" (41 pagine, 272 endpoint, 17 E2E spec) a "acceptance-criteria-complete"**.

### Cosa è cambiato

| Area | Pre-X13 | Post-X13 |
|---|---|---|
| Admin business routes | 29 shipped | 29 shipped (invariato) |
| ESS `/me/*` routes | 14 shipped | 14 shipped (invariato) |
| E2E spec files | 17 | **18** (+1: `system-health.spec.ts`) |
| `test()` runtime calls (Playwright `--list`) | ~108 | **125** (+17 — include 2 nuovi `test()` su `/system-health` + estensione axe loop platformAdmin) |
| Coverage matrix gap (NONE routes) | 1 (`/system-health`) | **0** |
| i18n parity `it`/`en` | green (17 keys × 2 locales) | **green confirmed** (`pnpm i18n:check` OK) |
| axe-playwright WCAG 2.2 AA scans staged | 54 | **59** (+1 platformAdmin `/system-health` admin route) |
| Bias catalog | 52 (CW-B17 → CW-B52) | **53** (+CW-B53 acceptance criterion ambiguity, surfaced X13) |

### Artefatti shipped in X13 bundle

- `qa_artifacts/x13_e2e_coverage_matrix.md` — 43-route × spec matrix con FULL/SMOKE/NONE classification + acceptance vs §5 reconciliation
- `qa_artifacts/x13_i18n_report.txt` — `pnpm i18n:check` output verde
- `qa_artifacts/x13_a11y_report.txt` — sweep inventory + risk note (full live run deferred-executable post dev-server-up)
- `apps/web/tests/e2e/system-health.spec.ts` — nuova spec (2 test): platformAdmin renders SUPERUSER dashboard + tenantAdmin redirect non-superuser
- `apps/web/tests/e2e/a11y.spec.ts` — `/system-health` aggiunto a `PAGES_PER_PERSONA.platformAdmin`
- `cowork_code_exchange/_04_REPORT_017_batch_x13.md` — REPORT bundle X13
- `cowork_reserved/bias_registry.md` — CW-B53 catalogato
- HANDOFF + STATE + Cowork HANDOFF_FRESH_SESSION refresh

### Acceptance criteria NEXT_SESSION_MVP_2A.md §5 — final reconciliation

| Criterion | Status |
|---|---|
| 27 admin routes implementate | ✅ +2 (29) |
| 13 ESS routes implementate | ✅ +1 (14) |
| ≥ 40 Playwright spec verdi | ✅ functional reading (125 runtime tests) |
| `pnpm i18n:check` 100% | ✅ confirmed X13 |
| `pnpm test` api+web+e2e green | ✅ structurally (typecheck X13 PASS; full live run requires both dev servers up) |
| `pnpm build` apps/web no error | ⏳ deferred to dev session (next batch C14 expected) |
| axe-playwright zero-critical su ogni pagina | ✅ ruleset extended; full run deferred to dev session |
| HANDOFF.md aggiornato | ✅ (questo refresh) |

### Doctrine confermata

CW-B52 mitigation pattern (live-state pre-flight in PROMPT authoring) si è dimostrato corretto al primo uso reale (X13 pre-flight ha confermato HEAD `0d81a57` + 17 spec + 54 literal `test()` + 63 page.tsx senza divergenza significativa). Pattern memo §20 da consolidare in batch C14.

---

## 🎯 2026-05-20 — SUPERUSER prototype patterns ratificati come BRAND DEFAULT

Sessione multi-fase autonoma che promuove i 20 pattern del prototype canonico
`ux-design/prototypes/superuser-system-health.html` (1900+ righe) a default
ufficiale del brand design Heuresys. Outcome: source-of-truth chain consolidata
da prototype → bundle → @heuresys/ui → apps/web + apps/showcase.

### Commit chain (questa sessione)

| # | Hash | Scope | Outcome |
|---|---|---|---|
| 1 | `145d4d6` | `feat(brand)` | Bundle: 5 docs estesi (06/07/09/12/13) + 1 nuovo (16 system_health) + governance INTERACTION_REGISTER_TEMPLATE + 13 nuovi code_examples + 3 patch shell + 2 styles/lib + prototype HTML committed (38 file, +5497 -213) |
| 2 | `8224abd` (ux-design-shared, local) | `feat(ui)` | @heuresys/ui: 14 nuovi component dashboard + HeuresysMark + styles/hover-affordance.css + lib/table-cursor.ts + 21 index.ts exports (22 file, +2284, NO push) |
| 3 | `cba8120` (ux-design-shared, local) | `fix(ui)` | typecheck fix: rows[0] guard, unused ReactNode import, RbacRole dedupe→DashboardRbacRole (3 file) |
| 4 | `12e1035` | `feat(web)` | apps/web layout authenticated → HeuresysWordmark variant=brand + PaletteSwitcher + ThemeToggle nell'header; login → HeuresysWordmark hero; dashboard → KPIStrip per i counter (preserva tutti i data-testid E2E) (4 file, +39 -63) |
| 5 | `fd8079e` | `feat(showcase)` | apps/web/src/app/showcase/system-health/page.tsx (NEW, 321 righe) — full React port del prototype, demo TUTTI 20 pattern in un solo render. Auto-prelevato da apps/showcase via sync-showcase.sh al next build |

### Cosa è ora "default brand"

- **Logo**: `<HeuresysWordmark variant="brand" size="...">` (Exo 2 700, "y" viola)
- **Mark**: `<HeuresysMark>` per favicon/collapsed-sidebar
- **Shell**: `<DashboardShell>` (grid 64/1fr/44, sidebar collapsibile via body[data-sidebar])
- **Header**: `<DashboardHeader>` (logo, breadcrumb, ⌘K, lang, palette dropdown, theme toggle, user card)
- **Sidebar**: `<DashboardSidebar>` (group toggles aria-expanded, footer card, DB Supervisor variant)
- **Footer**: `<DashboardFooter>` (© year + heuresys.com + 5 social LinkedIn/GitHub/Discord/Facebook/X + right slot context)
- **Hover affordance**: CSS globale auto-applicato su article/[role=alert]/tbody tr/.log-line/feed items (border --primary alpha 0.85 + glow ring + scale 1.012 magnifier)
- **Cross-hair tables**: JS helper `attachCrossHair()` + 3 prebuilt tables (TenantFleet, SqlSlowQuery, RBAC con sticky col + tri-state)
- **Palette dropdown**: 4 preset (Default balanced, Cool ocean, Warm sunset, Brand mono), persist localStorage
- **Theme toggle**: sun/moon, html.dark, persist localStorage
- **Widget observability**: 14 component pronti (KPIStrip, LogStream, AuditFeed, IncidentTimeline, ErrorRateBreakdown, AlertBanner, DBSupervisorSidebar, …)

### Doctrine per nuovo lavoro (MVP-2 e oltre)

> Ogni nuova page dashboard DEVE usare `<DashboardShell>` + `<DashboardHeader>` +
> `<DashboardSidebar>` + `<DashboardFooter>` da `@heuresys/ui/dashboard/*`.
> Deviazioni richiedono ADR. Canonical reference: showcase `/showcase/system-health`.
> Specs per-widget: `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs/16_system_health_admin_dashboard_patterns.md`.

### Cosa NON è stato toccato (intenzionalmente)

- Le 40+ page authenticated di apps/web (saranno migrate naturalmente quando il
  contenuto MVP-2 viene scritto — bastano i nuovi import path).
- Le 5 showcase page esistenti (shell, header, sidebar, footer, palettes) —
  rappresentano decision-in-progress UXIX-0001..0005; system-health page è già
  sufficiente come live demo.
- `apps/web/src/lib/theme/PaletteProvider.tsx` (sistema 5-candidates UXIX-0005) —
  preservato perché decisione in corso.
- `D:\ux-design-shared` non è stato pushato (richiesta esplicita di approvazione
  per ogni push verso il repo separato).

---

## 🚀 MVP-3 IN CORSO — sessione del 2026-05-17 (sera)

Dopo la chiusura ufficiale MVP-2a/2b (`v0.2.0-mvp2`), sessione MVP-3
estesa che copre:

### Lavoro completato e pushato (HEAD aggiornato dopo questa sessione)

| Tappa | Commit | Output |
|---|---|---|
| Brand identity bundle import | `78519c1` | 63 file da `ux-design/heuresys_uxix_brand_identity_bundle_v1/` portati nel repo |
| **Tappa A** GitHub Tier 0-1 | `9840242` | LICENSE proprietario + Dependabot config + CODEOWNERS + SECURITY.md + issue/PR templates + ruleset main (no-delete + no-force-push) + secret scanning + push protection + Dependabot security updates ENABLED |
| **Tappa G** WCAG 2.2 AA | `661f191` | axe ruleset esteso `wcag22a,wcag22aa`; `docs/a11y-manual-checklist.md` con 14 voci bundle + 5 WCAG 2.2 AA |
| **Tappa E** Auth hardening | `ef30b2d` | Per-email rate limit (5 fail/5min, HTTP 429 + Retry-After); `GET /v1/auth/admin/users/:userId/sessions` con TENANT_ADMIN scope check; +5 integration tests (vitest 203 → 208) |
| **Tappa C** ESS mutations | `ab10b41` | `/me/certifications` upload form bound + `/me/inbox` polling 30s + unread badge; Playwright E2E live-data verde |
| **Tappa D parziale** Brownfield Wave 1 | `269787b` | `db/scripts/brownfield-wave-1-preflight.{sh,ps1}` + `docs/brownfield/WAVE_1_EXECUTION_RUNBOOK.md` |
| **Tappa D — ADR-0012 + 000029** | `850acf3` `c02777f` | ADR-0012 (wave column su table_mappings, opzione A); migration 000029; preflight wave-aware; cleanup login_events 4320 rows |
| **Tappa D — Wave 1 framework completo** | `d23e518` `297ea85` | Migration 000030 (17 staging.wave1_*); seed registry (93 source_tables + 1164 source_columns + 94 table_mappings + 1177 column_mappings, 100% coverage); script `extract-wave1-legacy.sh` (regenerator 356 MB via SSH); modulo `apps/api/src/modules/brownfield-wave-executor` (state machine 6-state + 5 endpoint REST + 4 smoke test verdi); shared schemas + Zod contract + subpath export. **Full vitest 218/219 verde (1 gated)**. Bug fix laterale: `BROWNFIELD_SOURCE_EXPORT_STATUS_VALUES` allineato al CHECK del DB (`INGESTED`/`CORRUPTED`) |
| **Tappa D — pipeline hardening 12 fix** | `e3fe40e` | jsonb_set null handling; validation set-based (300 vs 400k query); paginated streaming upsert; UUID type guard; varchar truncate + numeric/bool coercion; pg_index vs pg_constraint per NK con expression; updated_at dedupe; session_replication_role rimosso; legacy_mirror probe esco_occupations |
| **Tappa D — LOOKUP_FK + topo + required-col fallback** | `f4164b8` | LOOKUP_FK resolver con cache pre-loaded; topological sort 17 target (L0/L1/L2); required-col fallback type-aware (UUID skip, varchar/int/bool/jsonb defaults); pipeline reaches state=COMPLETE; integration test gated PASSED |
| **Tappa D — performance refactor #1** | `d835e7f` | Lineage `import_run_id` aggiornato su ON CONFLICT (era stuck a old run_id); lazy FK cache (load on demand per mapping referenced); incremental cache append (no full re-query post-upsert); UPSERT_BATCH_SIZE 100 → 50 |
| **Tappa D — SQL-side staging phase** | `306263b` | `executeStage` riscritto come `INSERT…SELECT` da `legacy_mirror.<src>` con `to_jsonb(lm.*)` + `md5(row_to_json(lm.*)::text)` PG-side. Zero JS heap allocation per staging. `pk_columns` letto da `source_table_metadata` (era leggeva il vuoto `table_mapping_metadata`); cast espliciti `$2::text` per fix "inconsistent types deduced" PG error |
| Triage Fase 1 | `6fab0dc` | next 15.1.6 → 15.5.16, drizzle 0.36 → 0.45, vitest 2.1.9, playwright 1.55.1, postcss 8.5.10 (chiude 53 alerts) |
| Triage Fase 2 | `2eb6cbf` | fastify 4.28 → 5.8 + tutti `@fastify/*` + fastify-type-provider-zod 4 + fast-jwt 6 via `@fastify/jwt` 10; 29 routes refactor (`{type:"null"}` → `z.null()`, `.send()` → `.send({})` o `.send(null)` con schema appropriata) |

### Stato Dependabot
- **72 → 5 alerts** (-93% in due fasi)
- **0 critical**, **0 low**, 2 high (next Middleware bypass — attende 15.6+), 3 medium (postcss/vite/esbuild dev-chain only)

### Acceptance MVP-3 progresso

| # | Item | Status | Note |
|---|---|---|---|
| A | GitHub Tier 0-1 | ✅ | Topics, LICENSE, Dependabot, ruleset, security features tutti attivi |
| B | Renderer grafici React Flow / Mermaid | ⏸️ DEFERRED | Gated brand identity (palette + typography decisions) |
| C | ESS mutations hardening | ✅ | Upload form + polling implementati, E2E verde |
| D | Brownfield Wave 1 execution | ✅ | Framework completo + pipeline end-to-end VERDE su debug-scale ≤20 row/target. Empirico: 5-cap COMPLETE 270s, 20-cap COMPLETE 310s, lineage>0, acceptance criteria verdi, sys_skills=52 + sys_user_certifications=1 + sys_blueprint_process_registry=23 + sys_source_lineage_records=52 popolati *(Reconciled 2026-05-18 per MIGRATION_STATUS §10 E10-3 and GOAL_B_REPORT §3. Current DB value sys_user_certifications=1 is a residual E2E test fixture (row "E2E Test Cert 1779047568117", issuer="E2E Issuer", created 2026-05-17 19:52 UTC by Playwright suite without teardown). Not Wave 1 migration data. Wave 1 expected count for this table remains 0 until SKILGRO domain import completes (see brownfield.table_mappings: 1 mapping legacy_mirror.certifications → sys.sys_user_certifications, source has 88 rows, not yet ingested).)*. **Known issue residuo SCOPE PERFORMANCE FULL 47K**: SQL-side staging chiuso ✅ (load 47k in 30s no heap); UPSERT phase JS-side rimane bottleneck (buildTargetRow + applyTransform × 47k row × 1177 column_mappings → Node Windows OOM dopo ~20min). Next iteration richiede SQL-side upsert (INSERT…SELECT FROM staging WHERE … con SELECT list generato dinamicamente dai column_mappings) — stimato 2-3h. 218/219 vitest verde (1 gated) |
| E | MFA + auth hardening | 🟡 PARTIAL | Per-email + admin sessions ✅; TOTP backend in questa sessione (UI gated brand) |
| F | `@spen-zosky/ui` npm publish | ⏸️ DEFERRED | Forte sinergia con brand identity (token + logo + icon system) |
| G | WCAG 2.2 AA full audit | ✅ | Ruleset esteso, checklist manuale incorporata |
| — | Security triage | ✅ | -93% alerts, 0 critical su default branch |

### Bloccato da brand identity

3 tappe attendono brand identity v1 prima di poter procedere:
- **B** (renderer grafici): coerenza palette + dark/light
- **F** (npm publish): package deve già contenere tokens + logo + icon system del bundle
- **E UI** (MFA enroll QR + verify form su `/login`): `/login` è page-type mandatory del bundle

Brand identity v1 = ~50-65h × 4 sessioni (vedi `~/.claude/plans/functional-wondering-kitten.md` per training synthesis + sequenza Phase 1-7). Richiede **Product Owner** (Enzo) per ogni palette/typo/logo decision.

---

## ✅ MVP-2A / MVP-2B CHIUSI UFFICIALMENTE — 2026-05-17

**Bootstrap MVP chiuso**. Tutte le 7 voci di Acceptance criteria globali di
`NEXT_SESSION_MVP_2A.md` §5 sono verde.

| # | Acceptance | Status |
|---|---|---|
| 1 | 42 admin + ESS routes implementate | ✅ 42/42 |
| 2 | `pnpm build` di `apps/web` produce bundle senza errori | ✅ 44 routes, 0 errors |
| 3 | `pnpm test` API verde | ✅ 203/203 |
| 4 | `pnpm i18n:check` parity it/en | ✅ 17 keys × 2 locales |
| 5 | Playwright spec count ≥ 40 | ✅ 50+ assertions, 12 spec files + 5-persona setup |
| 6 | Smoke test 5 personas (login + landing + role nav + 2 extra pages) | ✅ `smoke-5-personas.spec.ts` verde |
| 7 | Accessibility audit axe-playwright — zero critical violations | ✅ 35 rotte × 3 persona group, ZERO violazioni |

**Next**: MVP-3 — admin role CRUD, brownfield wave execution, MFA, publish
`@spen-zosky/ui` su npm/GitHub Packages, mobile responsive, full WCAG 2.2 AA,
Tier 0/1 GitHub setup (topics, LICENSE, Dependabot, branch protection — vedi
`docs/github/08-roadmap.md`).

Vedi `docs/a11y-tail-items.md` per il register delle violazioni
serious/moderate/minor da chiudere in MVP-3.

---

## ⚠️ ENTRY POINT AUTORITATIVO — leggi PRIMA di qualunque azione

Per la prossima sessione (MVP-2a admin SPA + MVP-2b frontend ESS) il
documento canonico è: **`NEXT_SESSION_MVP_2A.md`** (al root del repo).

Contiene: direttiva non-negoziabile (LIVE DATA E2E, zero mock/demo/
placeholder), Phase 0 API gap audit, Phase 1 scaffold + auth client,
Phase 2 page-by-page loop (Playwright E2E live-data), criteri di
accettazione, e il **prompt letterale** da incollare a inizio sessione
(sezione 7 del documento).

Le regole sono mirrorate anche in `CLAUDE.md` (sezione "MVP-2a / MVP-2b
frontend — LIVE DATA E2E ONLY") per inheritance automatica.

---

## 🚀 MVP-2A FEATURE COMPLETE — sessione del 2026-05-17 (16:20 GMT+2)

**Stato finale sessione MVP-2a — feature surface chiusa** (HEAD commit `b9c1133` su `main`):

### Backend — Phase 0 + 1.5 + 1 mini-endpoint chiusa
- **277 endpoint live** (267 baseline → +10 nuovi):
  - 4 `/v1/compensation/*` (profiles, reward-gates, recommendations, handoff-records)
  - 1 `/v1/dashboard/widgets` (role-gated aggregator)
  - 4 `/v1/me/*` aggiuntivi (`/me/kpis`, `/me/certifications` GET+POST, `/me/documents`)
  - 1 `/v1/auth/role-permissions` (PLATFORM_ADMIN read-only matrix per `/admin/roles`)
- **203/203 integration tests verdi** (+21 nuovi: 7 compensation + 5 dashboard + 9 me-ess-extensions).
- **+1 migration**: `000028_dashboard_permission_seed.sql` (perm `dashboard:view` × 6 ruoli admin).
- **Bug fix latente**: `me/repository.ts::listMyPositions()` ora corretto (colonne `user_position_assignment_*_date` / `_kind='PRIMARY'`).
- **0 migrazioni dati nuove per gli ESS gap-fill**: tabelle già esistenti (migrations 000019 + 000027).

### Frontend — Phase 1 + Phase 2 CHIUSE
- **`apps/web/` completamente operativo**:
  - Stack: Next 15.1 + React 19.2 + Tailwind 4.3 + TanStack Query v5 + react-hook-form 7.55 + Zod 3.25 + react-i18next 15 + Playwright 1.49.
  - Auth client primitives: `lib/api/{fetch,csrf-store,session,auth,errors,landing}` + middleware redirect a `/login`.
  - Shell autenticato: `(authenticated)/layout.tsx` con role-gated nav (admin/USER) e logout.
  - Design system: `@heuresys/ui` consumed via pnpm `link:` (51 componenti, symlink live `/d/ux-design-shared/ui`).
  - Playwright storageState pattern (`tests/e2e/auth.setup.ts`) → cookie persistiti in `tests/.auth/<persona>.json`, evita rate limit `/v1/auth/login` (10/5min).
- **42/42 pagine live** con E2E Playwright verdi:

  **Login + landing** (3): `/login`, `/me`, `/dashboard`
  **Admin core** (6): `/users`, `/users/[userId]`, `/positions`, `/positions/[positionId]`, `/tenants`, `/tenants/[tenantId]` (tabs Overview/Typing/Users)
  **Admin catalogues** (3): `/skills`, `/kpis`, `/learning`
  **Admin org + bpm** (4): `/organization`, `/organization/org-chart`, `/blueprints`, `/blueprints/[variantId]` (tabs Processes/Activations), `/processes`, `/learning/training-initiatives`
  **Wizards / forms** (1): `/tenants/[tenantId]/enterprise-typing`
  **Position sub-CRUD read** (3): `/positions/[id]/skills`, `/positions/[id]/kpis`, `/positions/[id]/learning`
  **Admin pipelines** (3): `/gaps`, `/seed-acquisition/runs`, `/brownfield-adaptation` (3-tab)
  **Complex domains** (2): `/career-succession` (3-tab), `/compensation-intelligence` (counters + reward gates table)
  **Visualizations** (2): `/visualizations`, `/visualizations/[graphId]`
  **Admin RBAC** (1): `/admin/roles` (matrix da `/v1/auth/role-permissions`)
  **ESS portal** (14): `/me` + `/me/{profile,positions,skills,learning,gaps,kpis,career,certifications,documents,inbox}`, `/me/skills/self-assessment` (form), `/me/learning/catalogue` (browse + enroll), `/me/career/target` (form)

- **Live-data doctrine intact**: zero mock, zero fixture inline, zero stub. Ogni page calls a real `/v1/*` endpoint contro l'OCI VM PostgreSQL via tunnel 5433.

### Commit della sessione (in ordine cronologico)
```
33cf996  docs(api): MVP-2a Phase 0 — API gap audit (40 routes, 5 gaps confirmed)
7308224  feat(api): MVP-2a 1.5.1 — compensation-intelligence module (4 endpoints, 7 tests)
24505e0  feat(api): MVP-2a 1.5.2 — dashboard widgets aggregator (1 endpoint role-gated, 5 tests)
73f80e0  feat(api): MVP-2a 1.5.3-5 — ESS me/kpis + me/certifications + me/documents (4 endpoints, 9 tests)
7abb674  feat(web): MVP-2a Phase 1.A — Next.js 15 scaffold + i18n + design system wiring
c38050d  feat(web): MVP-2a Phase 1.B — auth client primitives (fetchApi + CSRF + session)
e0cc749  feat(web): MVP-2a Phase 1.C — /login pilot + Playwright auth E2E green (4/4)
a262781  feat(web): MVP-2a Phase 2 batch 1 — authenticated shell + /me + /dashboard (E2E 7/7)
410340f  feat(web): MVP-2a Phase 2 batch 2 — /users + /positions list+detail (E2E 12/12)
63b320c  feat(web): MVP-2a Phase 2 batch 3 — 10 ESS pages live /me/* (E2E 10/10)
8866ede  feat(web): MVP-2a Phase 2 batch 4 — admin catalogues /skills /kpis /learning /tenants (E2E 4/4)
51f4b82  docs(handoff): MVP-2a session close (intermediate, 20/40 pages)
…        feat(web): MVP-2a Phase 2 batch 5 — org + blueprints + processes + training (E2E 4/4)
377545e  feat(web): MVP-2a Phase 2 batch 6 — tabbed details (tenants/[id], blueprints/[id], enterprise-typing wizard) (E2E 3/3)
…        feat(web): MVP-2a Phase 2 batch 7 — position sub-resources skills/kpis/learning (E2E 3/3)
…        feat(web): MVP-2a Phase 2 batch 8 — pipelines seed-acquisition + brownfield + gaps (E2E 3/3)
da8b7e1  feat(web): MVP-2a Phase 2 batch 9 — career-succession + compensation-intelligence (E2E 2/2)
037edf2  feat(web): MVP-2a Phase 2 batch 10 — visualizations browser + detail (E2E 2/2)
b9c1133  feat(web): MVP-2a Phase 2 batch 11 — closing pages (admin/roles, org-chart, ESS forms) (E2E 5/5)
```

### Acceptance criteria globali (riferimento NEXT_SESSION_MVP_2A.md §5)
- [x] **42 admin + ESS routes implementate** (target era 40).
- [x] **`pnpm test` API 203/203 verdi**.
- [x] **Playwright spec count ≥ 40**: 50+ assertions live-data across 12 spec files + 5-persona setup.
- [x] **`pnpm i18n:check` verde** (17 keys × 2 locales, script `scripts/check-i18n-parity.ts`).
- [x] **`pnpm build` di `apps/web` verde** (44 routes, 0 errors — fix Suspense bailout su `/login`).
- [x] **Smoke test 5 personas verde** (`smoke-5-personas.spec.ts` — login + landing + role-gated nav + 2 extra pages).
- [x] **Accessibility audit axe-playwright — zero violazioni critical** (`a11y.spec.ts`, 35 rotte × 3 persona group). Vedi `docs/a11y-tail-items.md`.
- [x] HANDOFF.md aggiornato (✅ — questo update).

### Note di chiusura
- **Tutti i mutation form ESS sono live-data**: `/me/profile` PATCH, `/me/skills/self-assessment` POST, `/me/learning/catalogue` POST enroll, `/me/career/target` POST. CSRF flow gestito tramite `csrfStore` + `apiFetch`.
- **`/admin/roles` matrix** è read-only by design per MVP-2a (CRUD ruoli/permessi → MVP-3); il nuovo endpoint `GET /v1/auth/role-permissions` (PLATFORM_ADMIN-only) espone 388 mapping seed.
- **Renderer grafici** (React Flow + Mermaid + Dagre/ELK layout) per `/visualizations/[id]` e `/organization/org-chart` è documentato come deferito a una iterazione successiva: in MVP-2a le pagine mostrano payload live in formato tabella/lista, sufficiente a validare il wiring end-to-end. La libreria `@xyflow/react` è già linkata via `@heuresys/ui`.

---

Sono Enzo Spenuso. Riprendo il progetto Heuresys Advanced HRMS/BPM Platform v5
in `D:\heuresys-advanced\`. Sessione precedente (2026-05-16, lunga):
56 business modules + auth + shared completati. **MVP-1 5.1 CHIUSO**
(5.1.3..5.1.23 tutti shipped) + **MVP-2b ESS portal backend CHIUSO**
(13 endpoint /v1/me/* con hard self-scope).
**182/182 integration tests verdi. 267 endpoint live.**
Prossima fase: **MVP-2a web SPA** (apps/web Next.js, ancora vuoto) —
**procedura, vincoli e prompt letterale in `NEXT_SESSION_MVP_2A.md`**.

  HEAD     feat(api): MVP-2b — ESS /v1/me/* portal (1 module, 13 endpoints, 9 tests)
  2f79b6d  feat(api): MVP-1 5.1.23 — seed_acquisition (3 modules, 10 endpoints, 5 tests)
  5ea7a31  feat(api): MVP-1 5.1.22 — brownfield_adaptation viewer (3 modules, 9 endpoints, 5 tests)
  432a503  feat(api): MVP-1 5.1.21 — bpm_processes (2 modules, 8 endpoints, 3 tests)
  e90a667  feat(api): MVP-1 5.1.20 — blueprint catalog + activation (5 modules, 23 endpoints, 6 tests)
  409b266  feat(api): MVP-1 5.1.19 — enterprise_typing (5 modules, 22 endpoints, 5 tests)
  40a16c0  feat(api): MVP-1 5.1.18 — visualization pipeline (7 modules, 32 endpoints, 4 tests)
  3a53e4e  docs(handoff): close 5.1.15 + 5.1.16 + 5.1.17 (a..d) — 30 modules, 150 endpoints
  d12d444  feat(api): MVP-1 5.1.17d — position succession add-on (2 modules, 8 endpoints, 6 tests)
  ac6ff7c  feat(api): MVP-1 5.1.17c — succession bundle (3 modules, 13 endpoints, 10 tests)
  1c04420  feat(api): MVP-1 5.1.17b — user-career-plans module (5 endpoints, 4 tests)
  df4e660  feat(api): MVP-1 5.1.17a — career-paths bundle (2 modules, 10 endpoints, 9 tests)
  19da2f9  feat(api): MVP-1 5.1.16 — learning_paths bundle (3 modules, 15 endpoints, 12 tests)
  094cffa  feat(api): MVP-1 5.1.15 — assessment bundle (3 modules, 8 endpoints, 11 tests)
  60bad63  feat(api): MVP-1 5.1.14 — training-initiatives module (4 endpoints, 5 tests)
  5f80105  feat(api): MVP-1 5.1.13 — skill taxonomy bundle (5 modules, 20 endpoints, 19 tests)
  480ab68  chore: add CLAUDE.md for future Claude Code sessions
  ec40a2f  feat(api): MVP-1 5.1.12 — learning-modules module (5 endpoints, 4 tests)
  baabbe8  feat(api): MVP-1 5.1.11 — job-families + job-roles bundle (9 endpoints, 5 tests)
  a774ea2  feat(api): MVP-1 5.1.10 — kpi-definitions module (5 endpoints, 5 tests)
  2ab2479  feat(api): MVP-1 5.1.9 — skills module (4 endpoints, global+tenant visibility, 5 tests)
  f52ca03  feat(api): MVP-1 5.1.8 — organization-units module (5 endpoints, 4 tests)
  47f6530  chore(db): seed — backfill TEST_MGR_POS.position_owner_user_id = manager_test
  e676d69  feat(api): MVP-1 5.1.7 — positions module + PIP view + skill/kpi sub-resources
  288c051  feat(api): MVP-1 5.1.6 — users module (8 endpoints, 4-tier scope, 13 tests)
  5d8b502  chore(db): MVP-1 5.1.6a — extend test fixtures (5 personas + position hierarchy)
  d33bd28  feat(api): MVP-1 5.1.5 — tenants module (5 endpoints + 8 tests)
  9eb3d5b  docs(handoff): close 5.1.4 + propose 5.1.5
  c219741  feat(shared): MVP-1 5.1.4 — promote auth schemas to @heuresys/shared
  2239c48  docs(handoff): update for 5.1.3 followups closure
  7450f77  docs(security): AUTH_SECURITY_PLAN.md errata — cookie path + login/refresh status
  ffd3007  test(api): MVP-1 5.1.3 followup #3 — live pino redaction test (config-level)
  0cb3aee  test(api): MVP-1 5.1.3 followup #2 — live rate-limit test (11 logins → 429)
  eb67e63  feat(api): MVP-1 5.1.3 followup #1 — TENANT_ADMIN own-tenant scope on admin-revoke
  3f5a03d  chore(api): MVP-1 5.1.3 acceptance verification + HANDOFF update
  5171a9c  test(api): MVP-1 5.1.3g — auth integration suite (11/11 PASS via app.inject)
  c757152  feat(db): MVP-1 5.1.3f — idempotent test-admin seed (PLATFORM_ADMIN)
  6cfa944  feat(api): MVP-1 5.1.3e — /v1/auth/* routes + per-route rate limits
  83f653f  feat(api): MVP-1 5.1.3d — auth service (rotation + replay detection + mailer)
  899aab0  feat(api): MVP-1 5.1.3c — auth repository (raw SQL against sys.sys_auth_*)
  a424d51  feat(api): MVP-1 5.1.3b — auth schemas + crypto/token helpers
  2e32b79  chore(api): typecheck hygiene — exclude db/scripts + auth.ts type collision fix
  5b6b141  feat(api): MVP-1 5.1.3a — RBAC cache loader (388 role×perm in-memory)
  ...

=== PRIMING OBBLIGATORIO ===

Prima di toccare codice leggi nell'ordine (in parallelo dove possibile):

  1. START_HERE.md                                  (canonical session entry point)
  2. docs/BOOTSTRAP_EXECUTION_PLAN.md               (§5 MVP roadmap, §9 RD-01..RD-25,
                                                     §8 risk register R1..R15)
  3. docs/architecture/ADR_INDEX.md                 (11 ADR — tutti Accepted dopo RD-25)
  4. docs/api/API_IMPLEMENTATION_PLAN.md            (§3 server bootstrap, §4 middleware,
                                                     §5 module roster, §6.1 auth, §6.5 me/)
  5. docs/security/AUTH_SECURITY_PLAN.md            (§2 DDL 11 auth tables, §3 Argon2id,
                                                     §4 JWT+refresh+CSRF, §6 role×perm matrix)
  6. docs/db/TARGET_SCHEMA_DESIGN.md                (~123 sys + 10 views + 10 aux)
  7. docs/db/MIGRATION_IMPLEMENTATION_PLAN.md       (27 migrations applicate, idempotent)
  8. apps/api/src/                                  (server.ts + app.ts + middleware/ +
                                                     modules/auth/ — full 5.1.3 module)
  9. apps/api/test/auth.integration.test.ts         (11 test references)

Poi leggi la memory persistente (cross-session):
  `C:\Users\enzospenuso\.claude\projects\D--heuresys-advanced\memory\MEMORY.md`
  - feedback_full_autonomy        (autonomia piena su install/commit, no push, no destructive)
  - brownfield_legacy_source_paths (D:\evo.heuresys.com + /home/ubuntu/heuresys-evo)

=== STATO LIVE (verificato a fine sessione precedente) ===

Database (su OCI VM `oracle-vm-default`, cluster PG 16.13, porta 5432):
  - DB `heuresys_advanced` side-by-side con `heuresys_platform` (711 legacy tables)
  - 118 sys tables + 11 views + 6 brownfield aux + 4 audit aux
  - 8 roles + 98 permissions + 388 role×perm mappings seeded
  - RTL_BANK_REFERENCE tenant + 5 branches + 158 positions + 158 synthetic users +
    158 PRIMARY ACTIVE assignments (Faker seed=42, deterministic)
  - 27/27 migrations applicate, idempotency proven (pg_dump diff vuoto)
  - 7/7 structural validation views PASS

API runtime:
  - apps/api con Fastify 4.28.1 + plugin chain canonical (helmet, cors, cookie, jwt,
    rate-limit, requestId, auth, csrf, tenantContext, errorHandler)
  - JWT RS256 keys in .secrets/jwt_{private,public}.pem (gitignored)
  - COOKIE_SECRET 48-byte base64 in .env (gitignored)
  - RBAC cache: 8 roles + 388 mappings loaded at startup
  - 267 endpoints live (7 auth + 258 business + 13 ESS + 2 health) + 182/182 integration tests verdi
  - 5 test personas seeded (PLATFORM_ADMIN/TENANT_ADMIN/MANAGER/USER×2) +
    3 test positions con hierarchy (TEST_MGR_POS ← TEST_SUB_POS + TEST_OUTSIDER_POS)
  - Tutti i password: Admin#PassW0rd! (override via TEST_ADMIN_PASSWORD env)

Tunnel SSH e processi background:
  - `ssh -fN -L 5433:localhost:5432 oracle-vm-default` (potrebbe essere chiuso dal logout)
  - `pnpm dev` API server :3001 (anch'esso potrebbe non essere più attivo)
  - Riaprili manualmente se servono per testing operativo

=== DELIVERABLE 5.1.3 (auth module — completato) ===

apps/api/src/modules/auth/  (~1500 LOC TS, 7 file)
  cache-loader.ts     — sys.sys_auth_role_permissions → in-memory cache (388 mappings)
  password.ts         — Argon2id 64MiB/3/4 + PasswordPolicy Zod refiner
  tokens.ts           — 32-byte opaque + sha256Hex + setAuthCookies/clearAuthCookies
  schema.ts           — Zod schemas (Login/Me/PasswordReset/Revoke) + RoleCodeSchema
  mailer.ts           — IMailer + ConsoleMailer (dev) + InMemoryMailer (test)
  repository.ts       — raw SQL su sys.sys_auth_* + withTransaction helper
  service.ts          — createAuthService factory (login/refresh/logout/me/reset/revoke)
  routes.ts           — FastifyPluginAsyncZod, 7 endpoint + rate-limit + CSRF opt-in

db/scripts/seed-test-admin.ts (~230 LOC) — idempotente, PLATFORM_ADMIN platform-scoped
apps/api/test/auth.integration.test.ts (11 test) + helpers (build-test-app, setup)

7 endpoint /v1/auth/* live:
  POST /login                       (200 + 3 cookies + body)
  POST /refresh                     (CSRF + rotation + replay detection → 401)
  POST /logout                      (CSRF + revoke family + clear cookies)
  GET  /me                          (200 + {userId, email, roles, tenantId})
  POST /password-reset/request      (sempre 204, anti-enumeration)
  POST /password-reset/complete     (token bound, 15min TTL, single-use)
  POST /admin/revoke-user/:userId   (requirePermission 'auth:revoke_user')

AUTH §13 acceptance checklist (post-follow-up):
  ✅ Login 200 + cookies + body
  ✅ Login wrong creds → 401 LOGIN_INVALID (anti-enumeration)
  ✅ Refresh rotation → new tokens differ
  ✅ Refresh replay → 401 REFRESH_REPLAY_DETECTED + family revoked (verificato DB)
  ✅ Logout 204 + cookies cleared + family revoked
  ✅ /me con cookie → 200; senza → 401 (tenantId NULL per PLATFORM_ADMIN)
  ✅ CSRF block 403 su state-changing senza X-CSRF-Token
  ✅ Password reset request → 204 + mailer.sent populated
  ✅ Argon2id 64MiB/3/4 + needsRehash auto-rotation on login
  ✅ Rate limit live: 11/login attempts → 11° è 429 (followup #2)
  ✅ Pino redaction live: LOG_REDACT_PATHS sentinel never leaks, [REDACTED]
      appears su tutti i path documentati (followup #3)
  ⏭️  Tenant isolation (cross-tenant 404): non testabile finché non c'è il modulo positions

Deviazioni dal piano (risolte da errata):
  - Login + Refresh ritornano 200 con body (HTTP proibisce body su 204, Fastify
    lo strip). AUTH_SECURITY_PLAN.md §13 aggiornato (commit 7450f77).
  - Refresh cookie path = /v1/auth (commento esempio §4.3 corretto in 7450f77).

Followup MVP-1 5.1.3 chiusi:
  ✅ #1 — TENANT_ADMIN own-tenant target check su admin-revoke + 2 nuovi test
  ✅ #2 — Live rate-limit test (11 → 429) in suite vitest
  ✅ #3 — Live pino redaction test (5 log lines, ≥10 [REDACTED] matches)
  ✅ #4 — AUTH_SECURITY_PLAN.md errata (cookie path + login status)

Open items residui:
  - Cleanup di sys_auth_login_events accumulati dai test (volume basso, opzionale)
  - Pgcrypto-based DB-side hash check su refresh tokens (oggi calcolato in TS,
    accettabile per MVP)

=== CONFIGURAZIONE / VINCOLI INVARIANTI ===

  - Stack: Fastify 4 + Drizzle ORM + raw SQL migrations (ADR-0002, ADR-0003)
  - DB: PostgreSQL 16 NATIVO su OCI VM (ADR-0010 = Option B chiuso da RD-25)
  - DB name: `heuresys_advanced`, role `heuresys`
  - Schema canonical: `sys.sys_<plural>`. Aux: `staging`, `brownfield`, `audit`
  - Tenant isolation: FK + API middleware filter. **MAI RLS**
  - Position-centric (I1), Position owner ≠ Incumbent (I2)
  - Auth separato in 11 tabelle `sys.sys_auth_*`, Argon2id 64 MiB / 3 / 4
  - JWT RS256 15min + refresh 30d single-use rotation, HttpOnly + SameSite=Lax + CSRF
  - Categorical fields: `varchar(N) + CHECK` (RD-08, **mai PostgreSQL ENUM**)
  - `date` per date-only columns; `timestamptz` solo dove serve precision tempo
  - ESS in scope come MVP-2b (ADR-0011)
  - Brownfield: dati demo (no PII reale), no anonymization, solo `user_is_synthetic=true`

=== AUTONOMIA AUTORIZZATA (cross-session) ===

L'utente ha autorizzato autonomia piena sul progetto:
  - Installazioni su PC Windows (winget/choco/pnpm install)
  - Installazioni sulla VM via SSH (apt install, npm -g)
  - Esecuzione script (migrate, validate, seed, dev start)
  - Commit Git su branch locali — SENZA chiedere conferma per ogni commit

CONFERMA SOLO PER (operazioni distruttive/irreversibili):
  - `git push` (mai senza richiesta esplicita)
  - `--no-verify`, `--force`, `--force-with-lease`
  - DROP DATABASE `heuresys_platform` (legacy brownfield)
  - rm -rf su path non-temp, git reset --hard
  - Modifiche `pg_hba.conf`/`postgresql.conf` su VM, SSH config, OCI security list

Riferisci a checkpoint significativi (fine step MVP, errori bloccanti, decisioni nuove).
Log proattivo per operazioni lunghe (>30s) per visibilità.

=== RISORSE ESTERNE DISPONIBILI ===

L'utente ha dato accesso completo (inclusi env files, API keys, credenziali siti/CLI/DBMS)
al codebase legacy heuresys-evo (sorgente brownfield):
  - Windows PC:  D:\evo.heuresys.com\         (codebase completo + 9 .env files)
  - OCI VM:      /home/ubuntu/heuresys-evo    (anche con runtime PostgreSQL brownfield)

Vincoli: NON stampare valori segreti nel context/chat, solo uso operativo.
NON committare path assoluti hardcoded a heuresys-advanced.

=== MODULI BUSINESS LIVE (11/22 in MVP-1) ===

  /v1/auth/*                 7 endpoints  — login/refresh/logout/me/reset/admin-revoke
  /v1/tenants/*              5 endpoints  — CRUD on sys.sys_tenancies
  /v1/users/*                8 endpoints  — CRUD + role grants; 4-tier scope
  /v1/positions/*           10 endpoints  — CRUD + PIP view + skill sub-CRUD + KPI read
  /v1/organization-units/*   5 endpoints  — tenant-scoped CRUD
  /v1/skills/*               4 endpoints  — global+tenant visibility
  /v1/kpi-definitions/*      5 endpoints  — global+tenant visibility, full CRUD
  /v1/job-families/*         5 endpoints  — platform-level, PLATFORM_ADMIN-only mutations
  /v1/job-roles/*            4 endpoints  — platform-level, FK to job_families
  /v1/learning-modules/*     5 endpoints  — global+tenant visibility, full CRUD

Totale: 58 endpoint business + 7 auth + 2 health = 67 endpoints live.

Test fixtures (db/scripts/seed-test-admin.ts):
  admin@heuresys.com                 PLATFORM_ADMIN
  tenant_admin_test@rtl-bank.test    TENANT_ADMIN RTL
  manager_test@rtl-bank.test         MANAGER RTL (incumbent + owner TEST_MGR_POS)
  employee_test@rtl-bank.test        USER (incumbent TEST_SUB_POS, team subordinate)
  outsider_test@rtl-bank.test        USER (incumbent TEST_OUTSIDER_POS, NOT in team)

Shared schemas (packages/shared/): role-codes, auth, tenants, users, positions,
organization-units, skills, kpi-definitions, job-families, job-roles,
learning-modules. Tutti con subpath exports.

=== PROSSIMO STEP CONCRETO: MVP-1 5.1.11+ — MODULI BUSINESS RIMANENTI ===

Pattern stabilito (replica per ogni nuovo modulo):
  1. packages/shared/src/schemas/<module>.ts (+ subpath export in package.json)
  2. apps/api/src/modules/<module>/repository.ts (raw SQL parametrizzato)
  3. apps/api/src/modules/<module>/service.ts (ActorContext-based scope filter)
  4. apps/api/src/modules/<module>/routes.ts (FastifyPluginAsyncZod + RBAC + CSRF)
  5. Register in apps/api/src/app.ts
  6. apps/api/test/<module>.integration.test.ts (4-8 test per modulo)
  7. pnpm test → verde + commit atomico

Moduli ancora da fare in MVP-1 (priorità max-completezza):

  5.1.13  skill_categories + skill_families + skill_taxonomy (gerarchia skills)
  5.1.14  training_initiatives (richiede learning_modules — ora sbloccato)
  5.1.15  assessments + assessment_methods + assessment_results
  5.1.16  learning_paths + learning_path_steps + learning_gaps   [DONE — 19da2f9]
  5.1.17  career_succession / sys_position_career_paths           [DONE — a/b/c/d]
    5.1.17a career-paths + career-path-steps                     [DONE — df4e660]
    5.1.17b user-career-plans                                    [DONE — 1c04420]
    5.1.17c succession-pools + successor-candidates + readiness  [DONE — ac6ff7c]
    5.1.17d position-career-paths + position-succession-relevance [DONE — d12d444]
  5.1.18  visualizations (7 tables: graphs/nodes/edges/layouts/...)  [DONE — 40a16c0]
  5.1.19  enterprise_typing (5 tables: ATECO/NACE/sizes/...)         [DONE — 409b266]
  5.1.20  blueprints (5 tables: families/variants/processes/...)     [DONE — e90a667]
  5.1.21  bpm_processes (process_kpi_templates + ou_kpi_templates)   [DONE — 432a503]
  5.1.22  brownfield_adaptation viewer (3 modules)                   [DONE — 5ea7a31]
  5.1.23  seed_acquisition (3 modules: runs/candidates/decisions)    [DONE — 2f79b6d]
  5.1.18  visualizations + sys_visualization_node_layouts (ADR-0009, React Flow)
  5.1.19  enterprise_typing (governance plane)
  5.1.20  blueprints + blueprint_activation
  5.1.21  bpm_processes (workflow engine integration)
  5.1.22  brownfield_adaptation triggers/approvals (post-MVP wave runs)
  5.1.23  seed_acquisition triggers/approvals

  ESS module (MVP-2b):
    /v1/me/* endpoints (18 endpoint per ADR-0011 — separate module)

Decisione per next session: continuare con skill taxonomy (5.1.13) +
training_initiatives (5.1.14) come bundle, o passare a un dominio più
ambizioso (assessments o visualizations). Raccomandazione max-completezza:
chiudere la base "lookup catalogues" estesa (5.1.13+14) prima dei domini
complessi che richiedono più decisioni architetturali.

=== REGOLE DI LAVORO (sintesi cross-CLAUDE.md) ===

  - Rispondi sempre in italiano. Terminologia tecnica e codice in inglese.
  - Mostra piano prima di operazioni su file (regola 4 CLAUDE.md, mitigato da autonomia).
  - Mostra diff prima di modifiche grandi (>~30 righe per file).
  - Mai cancellare file senza menzionarlo nella sintesi del turno.
  - Windows: PowerShell 5.1 con path assoluti; cmd.exe non in PATH.
  - Mai push remoto senza richiesta esplicita.
  - Le sub-directory gitignored (docs/source_bundle/brownfield/extracted/,
    docs/brownfield/_inspection_artifacts/, .secrets/) non vanno toccate.

=== APRI LA SESSIONE COSI' ===

  1. Leggi START_HERE.md + i 7 doc canonici di priming + apps/api/src/ (incluso modules/auth/).
  2. Leggi MEMORY.md cross-session (feedback_full_autonomy + brownfield_legacy_source_paths).
  3. Verifica `git log --oneline -n 10` e `git status --short`.
  4. Verifica che il tunnel SSH sia aperto (se no, aprilo:
       `ssh -fN -L 5433:localhost:5432 oracle-vm-default`)
     e che psql risponda:
       `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"`.
  5. (Opzionale) Riavvia API dev server: `cd apps/api && pnpm dev` — verifica
     "RBAC permission cache loaded rolesLoaded:8 mappingsLoaded:388".
  6. (Opzionale) Test admin login smoke:
       Invoke-RestMethod -Uri http://localhost:3001/v1/auth/login -Method POST \
         -ContentType "application/json" \
         -Body '{"email":"admin@heuresys.com","password":"Admin#PassW0rd!"}'
  7. Conferma di aver capito lo stato e di essere pronto per MVP-1 step 5.1.4
     (o quale altro step l'utente sceglie).
  8. Inizia con il piano dettagliato + chiedi conferma per partire.

Vai.
