# MVP-4 Roadmap

## Heuresys Advanced — HRMS/BPM Platform v5

> **Status**: DRAFT — strategic planning deliverable, awaiting Enzo's review/approval before any P0 stream is opened.
> **Date emission**: 2026-05-26
> **Predecessors**: `BOOTSTRAP_EXECUTION_PLAN.md` (MVP-0..2 roadmap), `HANDOFF.md` (MVP-3 cronologia), `qa_artifacts/mvp3_full_release_notes_v0.3.2.md` (tag `v0.3.2-mvp3-full`).
> **Forensic baseline**: `sessioni/session_2026-05-26_forensic-state-of-the-art/FORENSIC_STATE_OF_ART_2026-05-26.md` §6 (MVP-4 candidates evidence-based).
> **Decision authority**: Enzo Spenuso (single decider for this private codebase).
> **Constraint envelope**: invariants I1..I14 + ADR set 0001..0018 (formal accepted). No code action taken from this document — it is plan, not build.

---

## §0 Executive summary

MVP-3 closed `2026-05-25` as tag `v0.3.2-mvp3-full` (7 Tappe shipped: A GitHub Tier 0/1, B Mermaid renderer, C ESS mutations, D Brownfield Wave 1 pragmatic 13/19 IMPORT, E MFA full login-gating TOTP, F `@heuresys/ui` npm publish with showcase deferred, G WCAG 2.2 AA). Three **P0 residuals** must close in a dedicated pre-MVP-4 session before any MVP-4 stream opens: **DEFER-F** (showcase RSC bundle-threshold), **CW-B60-A** (brownfield engine silent-filter on 3 AUTO_APPROVED + 0 upserted targets), **CW-B60-B** (Wave-2 scope-gap ADR on 3 IMPORT targets without staging source).

MVP-4 is **not a single linear milestone** like MVP-0..3. It is a **portfolio of 9 streams** loosely coupled by codebase area but largely parallelizable. Streams group around three axes: **brownfield maturity** (streams 2.1 Wave 2, 2.2 Wave 3, 2.3 Wave 4, 2.4 SDBI Phase 2), **security & operations** (streams 2.5 MFA multi-kind hardening, 2.8 OCI Managed migration prep), **UX/frontend completion** (streams 2.6 visualization renderers, 2.7 mobile + WCAG tail, 2.9 `@spen-zosky/ui` npm publish path).

**TL;DR effort envelope**: 9 streams × min-max effort = **~13-26 focused weeks** if executed sequentially; reducible to **~8-14 focused weeks** with rational parallelization (streams 2.6+2.7 vs 2.5 vs 2.1+2.4 can overlap; 2.8 must be late-MVP-4). **No fixed calendar date** is committed in this document — bus-factor 1 (R12) and the existing variance in single-contributor sessions make absolute dates unreliable. Effort is expressed in **focused-weeks** (one focused-week = ~25 productive hours).

**Acceptance criteria globali MVP-4**: (i) tutti i 9 stream chiusi al loro acceptance criterion locale OR esplicitamente deferred a MVP-5 con ADR di defer; (ii) test suite globale ≥ pari al baseline `341 PASS / 1 fail pre-esistente` (no regression introdotta); (iii) Playwright E2E ≥ baseline 61 test green + nuove pagine MVP-4 coperte da almeno 1 E2E ciascuna; (iv) `pnpm db:validate` twice-run idempotency proof remains green; (v) tag `v0.4.0-mvp4-complete` su HEAD, release notes `qa_artifacts/mvp4_release_notes_v0.4.0.md`; (vi) `HANDOFF.md` aggiornato a MVP-4 closure; (vii) nessun bias `CW-B*` aperto al merge finale.

**Out of scope MVP-4** (rimandato a MVP-5+ o defer permanente): payroll execution, T&A, benefits, IAM/SSO esterno (I8 invariant); migrazione produttiva multi-region OCI (cutover effettivo, non solo prep); rewrite engine SDBI in Python/Rust standalone; mobile native app; tenant onboarding self-service workflow esterno.

---

## §1 Context

### §1.1 Cosa è chiuso a MVP-3 (tag `v0.3.2-mvp3-full`)

| Stratum | Stato verificato @ HEAD post-tag |
|---|---|
| Backend Fastify 5 + RBAC | 58 moduli / 272 endpoint business / 388 role×permission mappings / 8 ruoli / 341 test PASS (1 fail pre-esistente skills:131) |
| Frontend Next.js 15 | 47 routes (1 root + 1 login + 30 admin + 14 ESS + 1 system-health) / 61 Playwright test / i18n it+en parity verde / live-data E2E doctrine 100% rispettata |
| Database PostgreSQL 16 | 42 migration idempotente (gap 000035 cosmetic) / 41 sys.* tables / 5 schemi (sys/brownfield/audit/staging/temp_sdbi) / OCI VM tunnel 5433 (RD-25) |
| Auth & MFA | Argon2id 64/3/4, JWT RS256 15min + refresh 30d single-use rotation, CSRF double-submit, TOTP full login-gating shipped Tappa E |
| Brownfield | Wave 1 pragmatic 13/19 IMPORT targets (~34k upserted), 1271 column_mappings, audit trail forensic-grade, ADR-0017 LOOKUP_FK_2HOP + ADR-0018 COALESCE-UQ class-of-bug accepted |
| Design system `@heuresys/ui` | npm-published `^0.1.1` post-migrazione X18, 51 components / 16 tier (sorgente repo `ux-design-shared`), workflow Storybook live |
| Security | Tutte CVE note chiuse via `pnpm.overrides` (uuid, qs, vite, postcss, esbuild); MFA `MFA_ENCRYPTION_KEY` mandatory; LOG_REDACT_PATHS attivo; secrets gitignored |
| Documentazione | 18 ADR formalmente accepted (gap registry: 0014..0018 non riflessi in ADR_INDEX, ADR-0017 file presente ma drift catalog) |

### §1.2 Perché MVP-4 ora

Tre forze convergenti rendono MVP-4 il prossimo milestone naturale:

1. **Plateau brownfield rigido**: 6 IMPORT residual classificati `CW-B60` non chiudibili con paradigma deterministico — evidenza empirica che il rigid mapping ha raggiunto un limite di copertura. SDBI Phase 2 pilot (Goals/OKRs + Time/Leave già shipped) prova che paradigma complementare AI-led scala. Wave 2/3/4 + SDBI Phase 2 sono ora il path naturale.
2. **MFA single-kind shipped + multi-kind preparato**: `sys.sys_auth_mfa_factors` ha schema multi-kind (`mfa_factor_kind` varchar CHECK), ma solo TOTP è implementato. WEBAUTHN/EMAIL_OTP/SMS_OTP + recovery codes + session enumeration UI sono la naturale maturità security post-MVP-3 E.
3. **Frontend completion debt**: 30 admin route + 14 ESS sono live ma alcune (visualizations, compensation write, file upload reali) sono read-only o stub. Tappa F MVP-3 si è chiusa parziale (DEFER-F showcase). Mobile responsive + a11y tail items documentati ma non chiusi.

### §1.3 Pre-MVP-4 P0 closure session

**Vincolo bloccante**: i 3 P0 residuali devono chiudersi PRIMA di aprire qualsiasi stream MVP-4 — sono debiti operativi che inquinano la baseline:

| P0 | Item | Effort | Rationale dipendenza |
|---|---|---|---|
| P0-1 | DEFER-F `/showcase` RSC bundle-threshold proper fix (PROMPT 025 nell'inbox CLI dal 2026-05-25) | 2-3h HIGH-RISK | Blocca stream 2.9 `@spen-zosky/ui` publish path (Tappa F closure prerequisite) |
| P0-2 | CW-B60-A forensic engine silent-filter (3 target AUTO_APPROVED + 0 upserted) | 2-3h | Blocca stream 2.1 Wave 2 (stesso engine path) — engine deve essere ASCOLTABILE prima di scalare |
| P0-3 | CW-B60-B Wave 2 / computed views ADR (3 target IMPORT senza staging source) | 2-3h | Blocca stream 2.1 Wave 2 (chiarisce semantica `IMPORT` vs `COMPUTED` su 3 target) |

Effort totale P0 closure session: **6-9h**, ipotizzabile in una singola sessione lunga. Deliverable: REPORT closure + test green + ADR (per CW-B60-B) + bias_registry update `CW-B60 → MITIGATED`.

### §1.4 Decision authority

Single contributor (Enzo). Tutte le decisioni MVP-4 sono autorità Enzo; questa roadmap è proposta strategica, non commitment. Bus factor 1 (R12) rimane mitigation principale: ADR + handoff doc + commits con co-author.

---

## §2 Scope streams (9 streams)

Ogni stream è auto-contenuto: scope / effort min-max in focused-weeks / dependencies / acceptance criteria locali. Effort min-max riflette incertezza (lo span è 1.5x..2.5x per stream stimato realisticamente).

### §2.1 Stream — Brownfield Wave 2 (RTL_BANK_REFERENCE operating model)

**Scope**: esecuzione Wave 2 per il tenant `RTL_BANK_REFERENCE` — operating model deep import. Source ~94 source tables / target ~31 `sys.*` canonical tables (organization-units, branches, blueprint-activations, KPI definitions, process roles, position requirements). Riferimento `BROWNFIELD_IMPORT_PLAN.md` §4 + runner doc `docs/brownfield/wave_runners/wave_2_runner.md` (deliverable parallelo a questa roadmap).

**Effort**: **1.5 — 3.0 focused-weeks** (37-75h). Range ampio: dipende dalla data-quality discovery (validation failures attesi su FK resolution dell'operating model). Wave 1 ha richiesto 13/19 targets via 5 iterazioni; Wave 2 ha più cross-table FK ⇒ stima maggiore.

**Dependencies**:
- P0-2 (CW-B60-A engine silent-filter) closure — engine deve essere observable.
- P0-3 (CW-B60-B Wave 2 scope ADR) closure — ambiguità `IMPORT` vs `COMPUTED` su 3 target chiusa.
- Wave 1 stable baseline (esistente, 1271 mappings).

**Acceptance criteria**:
1. ≥ 85% dei ~94 source tables Wave 2 con `import_run_state = COMPLETE` (consistente con pragmatismo Wave 1).
2. ≥ 1 lineage row per ogni canonical record upserted (`sys.sys_source_lineage_records.import_run_id` matches Wave 2 runs).
3. `sys.v_tenant_boundary_violations` returns 0 (no cross-tenant FK leak).
4. Twice-run idempotency proof verde (re-execute Wave 2 → 0 nuove rows, 0 errori, 0 audit delta su non-evolving fields).
5. Runner doc `wave_2_runner.md` chiusa con `executed-at: <timestamp>` + acceptance log linked.

**Risks specifici** (vedi §4 R-MVP4-01..05): operating model ha cascade FK chains (tenant→branch→org_unit→position) — un FK resolution failure può cascadare. Mitigation: pre-flight script (analogo a `brownfield-wave-1-preflight.{ps1,sh}`) deve esistere PRIMA di trigger run.

---

### §2.2 Stream — Brownfield Wave 3 (sensitive tenant data + human approval gates)

**Scope**: esecuzione Wave 3 per i 4 tenant legacy (RTL_BANK 158, SmartFood 82, EcoNova 26, Heuresys System 4 = 270 employees / 274 users). Source ~31 source tables / target ~15 `sys.*`. Riferimento `BROWNFIELD_IMPORT_PLAN.md` §5 + runner doc `docs/brownfield/wave_runners/wave_3_runner.md`. Pattern **demo data** (no real PII, owner-generated, RD-02) ma con human approval workflow esteso a sensibilità futura.

**Effort**: **2.0 — 3.5 focused-weeks** (50-87h). Include sviluppo UI human approval gate (oggi assente — brownfield page è read-only viewer) + audit trail UI per visualizzare decisions + workflow di re-trigger su rejected.

**Dependencies**:
- Stream 2.1 (Wave 2 chiuso) — i tenant operating model devono esistere prima dei users del tenant.
- ADR pre-requisite (vedi §2.2 runner doc §11): per ogni macro-categoria sensitive (compensation_amount, performance_review_text, talent_score_freeform) un ADR formale che definisce semantica + retention + audit.
- Backend extension: `POST /v1/brownfield/import-runs/:id/decisions` endpoint con `verifyCsrf` + `requirePermission('brownfield:approve')`.
- Frontend: nuove route `/brownfield-adaptation/[runId]/decisions` con UI approve/reject + comment.

**Acceptance criteria**:
1. 270 users imported con `user_is_synthetic = true` (verified via `sys.v_synthetic_user_flag_consistency` = 0).
2. Auto-approval funziona per confidence ≥ 0.80 + PASSED + 0 PII-pattern hit; human gate funziona per resto.
3. 0 password hash legacy importati (tutti `must_rotate = true`, placeholder hash flagged).
4. Audit trail `audit.import_approval_decisions` ha 1 row per ogni decision (auto o human).
5. Runner doc `wave_3_runner.md` chiusa.

**Risks specifici**: human approval gate UX può rivelarsi sotto-utilizzato se workflow è cumbersome. Mitigation: batch-approve UI + filter "needs review only" per ridurre cognitive load.

---

### §2.3 Stream — Brownfield Wave 4 (advanced intelligence + cross-tenant aggregation)

**Scope**: esecuzione Wave 4 — career paths, succession pools, talent scores, compensation band assignments, engagement evidence. Source ~55 source tables (TALPIPE 27 + PULSAR 29 + SMERTO 1 + EPRA AI config subset) / target ~20 `sys.*`. Riferimento `BROWNFIELD_IMPORT_PLAN.md` §6 + runner doc `docs/brownfield/wave_runners/wave_4_runner.md`.

**Effort**: **2.0 — 3.0 focused-weeks** (50-75h). Wave 4 ha mandatory human gate (PI sign-off), confidence threshold più basso (≥ 0.75) → più validation failures attese. Cross-tenant aggregation (engagement metrics aggregati) introduce vincolo I5 (no RLS) + necessità di materialized views per perf.

**Dependencies**:
- Stream 2.3 (Wave 3 chiuso) — career paths e talent scores referenziano users importati Wave 3.
- ADR per cross-tenant boundary aggregation strategy (proposta: vista `sys.v_cross_tenant_engagement_summary` con filter API-level invece di RLS).
- Decisione su MV vs application-side rollup (vedi §2.4 perf review post-MVP-4 alla luce di RD-15).

**Acceptance criteria**:
1. ≥ 80% target tables Wave 4 con `state = COMPLETE`.
2. Career paths importati hanno tutti `career_path_steps` (no orphan paths).
3. Talent scores in [0..1] normalized (validation rule §6.2 Wave 4).
4. Compensation band assignments **non** memorizzano amounts (only band_id ref a `sys.sys_compensation_bands`).
5. Cross-tenant view governance: nessun user TENANT_ADMIN può leggere data di altri tenants (test E2E cross-tenant attempt → 403/404).
6. Runner doc `wave_4_runner.md` chiusa + human approval log linked.

---

### §2.4 Stream — SDBI Phase 2 (ADR-0014 PROPOSED → ACCEPTED, scaling)

**Scope**: formal acceptance di ADR-0014 SDBI (Semantic-Driven Brownfield Import) e scaling del paradigma alle 11 macro-aree HRMS **TRUE GAP** (target schema MISSING in `sys.*`):
- PerformanceReviews (4-tier multi-rater)
- RecruitingHiring (out-of-scope I8 → marker only)
- Onboarding (out-of-scope I8 → marker only)
- Surveys/Engagement (PULSAR cluster mid-overlap con Wave 4)
- Feedback (peer 360, mentorship feedback loops)
- Mentorship (pairing + sessions evidence)
- PredictionsML (churn / promotion-readiness scores)
- Compensation (bands già coperti, manca history)
- Documents (metadata only, URI ref no binaries)
- TalentPool (cross-tenant succession candidates pool)
- Goals/OKRs **già shipped** in Phase 1 pilot — referenza pattern
- Time/Leave **già shipped** in Phase 1 pilot — referenza pattern

**Effort**: **3.0 — 5.0 focused-weeks** (75-125h) per le 7-9 macro-aree realmente IN scope (escludendo I8 hard out-of-scope: RecruitingHiring + Onboarding, con marker only). Per ogni macro-area: 7-10h come da ADR-0014 §4.2 stima. Include: AI confidence calibration empirica, mapping_card storage workflow, temp_sdbi schema management.

**Dependencies**:
- ADR-0014 formally ACCEPTED (transizione da PROPOSED) — Enzo decision atomica.
- Migration 000034 (temp_sdbi schema) + 000035 (lineage SDBI columns extension) già drafted nell'ADR — applicare.
- Audit rule_codes SDBI extension (CW-B17 patch family + SDBI family) shipped in `apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts`.
- Cowork ↔ CLI protocol v2.2 per workflow mapping_card author (Cowork) + executor (CLI).

**Acceptance criteria**:
1. ADR-0014 status moved to `ACCEPTED` with date + Enzo sign-off note.
2. 7-9 macro-aree TRUE GAP shipped via SDBI workflow (target sys.* tables created via new migrations + populated via SDBI consolidation).
3. Per ogni macro-area: mapping_card.md committed in `cowork_reserved/sdbi_mapping_cards/`, audit rule_codes populated, `temp_sdbi.*` cleaned post Phase 6.
4. SDBI runbook `docs/sdbi/RUNBOOK.md` published.
5. Lineage continuity: `sys.sys_source_lineage_records` ha NULL SDBI columns per brownfield-path rows + populated SDBI columns per SDBI-path rows (cross-check).

**Risks specifici**: AI confidence calibration può richiedere iteration empirica più lunga del previsto. Mitigation: pilot 1-2 macro-aree → tune threshold → replicare pattern. Bias `CW-B16..B21` lessons già embedded in ADR-0014 §3.8.

---

### §2.5 Stream — MFA multi-kind hardening completo

**Scope**: estendere MFA single-kind TOTP (shipped Tappa E MVP-3) a multi-kind:
- **WEBAUTHN** (FIDO2 hardware keys, biometric on mobile/laptop) — schema `sys.sys_auth_mfa_factors.mfa_factor_kind = 'WEBAUTHN'` già presente.
- **EMAIL_OTP** (one-time code via email, fallback per utenti senza app TOTP).
- **SMS_OTP** (one-time code via SMS, fallback più costoso — valutare se includere o defer).
- **Recovery codes** (10 codici single-use stampabili, generati al primo enroll).
- **Session enumeration UI** (`/me/security/sessions` lista sessioni attive con device fingerprint, last seen, IP geolocation) + revoke per device.
- **MFA enforcement policy** (opt-in mandatory per `PLATFORM_ADMIN` + `TENANT_ADMIN`, opt-in voluntary per altri).

**Effort**: **2.5 — 4.0 focused-weeks** (62-100h). WEBAUTHN richiede library `@simplewebauthn/server` + `@simplewebauthn/browser` + ceremony attestation/assertion. Email OTP riusa transport mailer esistente (InMemoryMailer + production SMTP via env). SMS OTP richiede provider (Twilio/Vonage) → cost decision.

**Dependencies**:
- ADR per ogni kind addition (WEBAUTHN, EMAIL_OTP, SMS_OTP se incluso) — pattern delegation degli "MFA factor kind" semantica.
- Decisione SMS provider + cost (Enzo): include o defer SMS_OTP.
- Migration extension `sys.sys_auth_mfa_factors` (eventualmente nuovi campi per WebAuthn credential storage).

**Acceptance criteria**:
1. Almeno **WEBAUTHN + EMAIL_OTP + recovery codes** shipped (SMS_OTP optional).
2. UI `/me/security` mostra factor list + add/delete + verify per kind.
3. UI `/me/security/sessions` lista sessions + revoke.
4. Mandatory MFA enforcement policy attiva per `PLATFORM_ADMIN` + `TENANT_ADMIN` (config-driven via env `MFA_MANDATORY_ROLES`).
5. E2E Playwright: enroll-webauthn (mock authenticator), verify-login-webauthn, enroll-email-otp, use-recovery-code, revoke-session.
6. Audit: ogni MFA event → row in `audit.mfa_events` (esistente, da extension con nuovi event_type).

**Risks**: WebAuthn cross-browser compatibility quirks (Safari su iOS, Chrome desktop, Firefox). Mitigation: testare con almeno 2 browser + 1 hardware key fisica (YubiKey o equivalente).

---

### §2.6 Stream — Visualization renderers (React Flow + Mermaid completo)

**Scope**: trasformare 7 moduli visualization da read-only list views (oggi) a renderers interattivi:
- **`/visualizations/[graphId]`**: React Flow + Dagre/ELK layout engine per org chart, process flow, career path, learning path, skill gap map, succession map. Coordinate sync con `sys.sys_visualization_node_layouts` (ADR-0009 — layout edits = update coordinates only, never mutate semantic hierarchy I10).
- **`/organization/org-chart`**: org chart dedicated React Flow renderer con drill-down (click position → detail).
- **KPI cascade Mermaid renderer**: chiude Tappa B MVP-3 (renderer parziale shipped) con cascade rendering completo (KPI → sub-KPI → owner positions).
- **Edit mode**: drag-and-drop riposiziona nodes → autosave layout via `PATCH /v1/visualizations/node-layouts/:id`.
- **Export**: PNG/SVG export via `qa_artifacts/diagrams/` pattern (esistente per Mermaid bootstrap diagram).

**Effort**: **2.0 — 3.0 focused-weeks** (50-75h). React Flow è già dep di `@heuresys/ui` (v12+). Dagre/ELK layout engines: `@dagrejs/dagre` (semplice) o `elkjs` (più potente, async). Decisione runtime.

**Dependencies**:
- `@heuresys/ui` esposes React Flow primitives (verificare API surface).
- ADR-0009 invariant: coordinates table editing strategy già definita.
- React Flow Pro license decision (RD-13 — ADR pending) — necessario PRIMA di production commerciale, ma per development OK con `hideAttribution: true`.

**Acceptance criteria**:
1. `/visualizations/[graphId]` renderizza graph reale da `sys.sys_visualization_graphs` con nodes/edges da `sys.sys_visualization_nodes`/`sys.sys_visualization_edges`.
2. Layout engine selezionabile (dagre default, ELK opt-in via query param o user setting).
3. Edit mode: drag node → `PATCH` layout coordinates → reload renders new position.
4. Export PNG funziona da UI button.
5. E2E Playwright: view-org-chart, drag-node-save, export-png.
6. ADR React Flow Pro license decision opened (anche se decision = "defer to production cutover").

---

### §2.7 Stream — Mobile responsive audit + WCAG 2.2 AA tail items closure

**Scope**:
- **Mobile responsive audit**: Tailwind 4 breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) sono presenti nel design system `@heuresys/ui` ma non auditati cross-device. Audit copertura: 47 routes × 4 viewport (375px iPhone SE, 768px tablet, 1024px laptop, 1440px desktop). Fix layout breakage per page con prio alta (`/login`, `/me`, `/dashboard`).
- **WCAG 2.2 AA tail items closure**: chiusura backlog `docs/a11y-tail-items.md` (serious/moderate/minor items documented). axe-playwright suite oggi è critical=0 (Tappa G MVP-3); tail items sono livelli inferiori non bloccanti per AA ma da chiudere.
- **Touch targets**: minimum 44×44px (WCAG 2.5.5 AAA, ma AA-friendly best practice).
- **Focus visible**: ring outline su tutti gli interactive elements (button, link, input).
- **Color contrast**: ratio ≥ 4.5:1 per text, ≥ 3:1 per large text + UI components.

**Effort**: **1.5 — 2.5 focused-weeks** (37-62h). 47 routes × audit ≈ 4-6h discovery + 25-50h fix iteration.

**Dependencies**:
- axe-playwright suite estesa per scan tail items (serious + moderate, non solo critical).
- Tool BrowserStack o equivalente per real-device test (opzionale, viewport responsive in DevTools sufficiente per audit initial).

**Acceptance criteria**:
1. Tutte le 47 routes renderizzano correttamente su 4 viewport target (no horizontal scroll, no overlapping elements, no text truncation < 50%).
2. axe-playwright extended scan: 0 serious, ≤ N moderate (target empirico post-discovery), tail minor documented.
3. `docs/a11y-tail-items.md` aggiornato con status `CLOSED` o `DEFERRED-TO-MVP5` per ogni item.
4. Touch target audit: 0 interactive elements < 44×44px (button, link, input control).
5. Focus visible: tutti i 47 routes hanno ring outline visibile via keyboard navigation Tab.

---

### §2.8 Stream — OCI Managed migration prep

**Scope**: **PREP**, non cutover effettivo. ADR-0010 ha selezionato Option B (OCI VM self-managed) per MVP-0..3; questo stream prepara il path verso Option C (OCI Database with PostgreSQL managed instance). Cutover effettivo a production resta out-of-scope MVP-4 (richiede production deployment decision separata).

**Deliverable**:
- **ADR-0010 revisit**: nuova section "future migration to Option C" con criteria, cost analysis aggiornato (2026 pricing), perf baseline (latency 20-40ms → managed possibly direct connection if same region).
- **Migration plan doc**: `docs/architecture/OCI_MANAGED_MIGRATION_PLAN.md` con sequence steps (export pg_dump → restore on managed → connection string switch → smoke test → cutover).
- **`.env.example` block C activated**: oggi commented fallback, post-stream è documented config-ready (mancano solo credentials).
- **Perf benchmark suite**: misurare query latency baseline su Option B (oggi) + dry-run su Option C (staging instance se Enzo provisiona) → comparison report.
- **SSL/TLS cert handling**: managed PG richiede SSL (vs Option B tunnel SSH); aggiornare `pg` client config in `apps/api/src/db/client.ts` per supportare entrambi (autoselect via DATABASE_URL `sslmode=`).
- **Backup/restore procedure**: managed PG ha autovacuum + automated backup; documentare integration con `qa_artifacts/db_snapshots/` esistente.

**Effort**: **1.5 — 3.0 focused-weeks** (37-75h). Cost decision OCI Managed (potenziale uscita da Free Tier) è dipendenza esterna che può rallentare.

**Dependencies**:
- Enzo decision su provisioning instance managed per dry-run (cost may be non-zero).
- ADR-0010 revisit decision: "ready to switch" vs "deferred to production deployment" (questo stream prepara la prima opzione).

**Acceptance criteria**:
1. ADR-0010 con nuova section + decision matrix Option B vs C aggiornata.
2. `docs/architecture/OCI_MANAGED_MIGRATION_PLAN.md` published with step-by-step procedure.
3. `apps/api/src/db/client.ts` supporta SSL connection (testato con `sslmode=require` su connection string).
4. `.env.example` block C uncommented + complete + documented.
5. Perf benchmark report con baseline + (se possible) dry-run comparison.
6. (Optional) Successful pg_dump + pg_restore proof-of-concept su instance managed staging.

**Risks**: cost imprevisto OCI Managed (no Free Tier confermato as of 2026-05). Mitigation: dry-run su instance temporanea low-spec + immediate teardown post-test.

---

### §2.9 Stream — `@spen-zosky/ui` npm publish (Tappa F MVP-3 closure)

**Scope**: chiudere Tappa F MVP-3 deferred — pubblicazione `@heuresys/ui` (oggi npm-published v0.1.1) come `@spen-zosky/ui` scoped a Enzo's npm org. Path decision: A (rename + republish standalone), B (split per use-case), o E (continue current `@heuresys/ui`). Riferimento `NEXT_SESSION_MVP_CLOSURE.md` + workflow X18.

**Effort**: **0.5 — 1.5 focused-weeks** (12-37h). Variabile in base a Path:
- Path A (rename): ~12h (republish + bump consumer deps).
- Path B (split): ~25-37h (extract per-domain bundles, dual publish).
- Path E (status quo continue): ~5h (just close Tappa F formally, no action).

**Dependencies**:
- P0-1 DEFER-F closure — showcase deve funzionare prima di publish (validation che lib funziona end-to-end).
- Enzo decision su Path A/B/E.
- npm org `@spen-zosky` ownership confirmed.

**Acceptance criteria**:
1. Path scelto e documentato in ADR (nuovo, ADR-0019 ipotesi).
2. (Se A o B): pacchetto pubblicato su npm registry, `pnpm install @spen-zosky/ui` works.
3. (Se A o B): consumer apps/web + apps/showcase + repo root bumpati a nuova dep.
4. Tappa F MVP-3 status moved da "deferred" a "closed" in `HANDOFF.md`.

---

## §3 Effort + timeline

### §3.1 Matrice effort stream × range

| Stream | Min focused-weeks | Max focused-weeks | Risk-adjusted (avg + 20%) | Hours (avg × 25h/wk) |
|---|---:|---:|---:|---:|
| 2.1 Brownfield Wave 2 | 1.5 | 3.0 | 2.7 | ~67h |
| 2.2 Brownfield Wave 3 | 2.0 | 3.5 | 3.3 | ~82h |
| 2.3 Brownfield Wave 4 | 2.0 | 3.0 | 3.0 | ~75h |
| 2.4 SDBI Phase 2 | 3.0 | 5.0 | 4.8 | ~120h |
| 2.5 MFA multi-kind | 2.5 | 4.0 | 3.9 | ~97h |
| 2.6 Visualization renderers | 2.0 | 3.0 | 3.0 | ~75h |
| 2.7 Mobile + WCAG tail | 1.5 | 2.5 | 2.4 | ~60h |
| 2.8 OCI Managed prep | 1.5 | 3.0 | 2.7 | ~67h |
| 2.9 `@spen-zosky/ui` publish | 0.5 | 1.5 | 1.2 | ~30h |
| **TOTAL sequential** | **16.5** | **28.5** | **27.0** | **~675h** |

**Note**: 27.0 risk-adjusted focused-weeks ≠ 27 calendar weeks. Single-contributor con context-switching + cowork↔cli overhead + bias mitigations applies factor ~1.5x → ~40 calendar weeks ≈ 10 mesi se 100% dedicato. Più realistico con part-time effort: ~12-15 mesi calendar.

### §3.2 Suggested ordering (executable in waves)

```
T+0  ┌──── P0 closure session (DEFER-F + CW-B60-A + CW-B60-B) ─── 6-9h, blocking
     │
T+1d ├─── WAVE A (parallel) ───────────────────────────────────────
     │    • Stream 2.1 Brownfield Wave 2 (engine path, blocked by P0-2/P0-3)
     │    • Stream 2.5 MFA multi-kind hardening (auth path, independent)
     │    • Stream 2.7 Mobile + WCAG tail (frontend audit path, independent)
     │
T+~5wk ├─── WAVE B (parallel, post Wave A streams complete) ───────
     │    • Stream 2.2 Brownfield Wave 3 (depends 2.1 done)
     │    • Stream 2.4 SDBI Phase 2 (depends ADR-0014 accepted)
     │    • Stream 2.6 Visualization renderers (depends nothing strict; UI capacity)
     │    • Stream 2.9 `@spen-zosky/ui` publish (depends P0-1 done + Enzo Path decision)
     │
T+~10wk├─── WAVE C (sequential or parallel late) ──────────────────
     │    • Stream 2.3 Brownfield Wave 4 (depends 2.2 done)
     │    • Stream 2.8 OCI Managed migration prep (late-MVP-4, can overlap)
     │
T+~14wk└─── MVP-4 closure session ──────────────────────────────────
          • Test suite green + tag `v0.4.0-mvp4-complete` + release notes
          • HANDOFF.md update + forensic refresh
```

**Ordering rationale**: Wave A streams sono parallel-safe (3 path indipendenti: brownfield engine, auth, frontend audit). Wave B introduce dipendenze (Wave 3 → Wave 2 closure). Wave C è late-MVP-4 perché Wave 4 ha rischio policy + OCI prep ha rischio cost discovery.

### §3.3 Dependency graph

```
P0-1 DEFER-F ────────────────────► Stream 2.9 publish
P0-2 CW-B60-A ─────┐
P0-3 CW-B60-B ─────┴────────────► Stream 2.1 Wave 2 ──► Stream 2.2 Wave 3 ──► Stream 2.3 Wave 4
                                                  │
                                                  └──► Stream 2.4 SDBI Phase 2 (parallel)
ADR-0014 ACCEPTED ──────────────► Stream 2.4 SDBI Phase 2
(independent) ──────────────────► Stream 2.5 MFA multi-kind
(independent) ──────────────────► Stream 2.6 Visualization renderers
(independent) ──────────────────► Stream 2.7 Mobile + WCAG tail
(late-MVP-4) ───────────────────► Stream 2.8 OCI Managed prep
```

Critical path: P0 closure → 2.1 → 2.2 → 2.3 (sequential brownfield chain) ≈ 8.5 risk-adjusted weeks. Tutti gli altri stream possono parallelizzarsi sulla critical path.

---

## §4 Risk register (R-MVP4-01..R-MVP4-15)

| ID | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R-MVP4-01 | P0 closure session sfora (>9h) → MVP-4 start ritardo | M (40%) | M | Time-box rigido 9h, se sfora → schedule second session, NON aprire MVP-4 streams in parallel |
| R-MVP4-02 | Wave 2 FK cascade failure cascada (engine impatta tutti i target) | M (35%) | H | P0-2 closure + pre-flight script + dry-run mode `EXECUTE` → `DRY_RUN` toggle |
| R-MVP4-03 | SDBI AI confidence threshold mis-calibrated | M (30%) | M | Pilot 1-2 macro-aree before scaling, threshold tuning empirical |
| R-MVP4-04 | WebAuthn cross-browser quirks → MFA UX broken su 1+ browser | M (25%) | H | Multi-browser Playwright + 1 hardware key fisica test |
| R-MVP4-05 | OCI Managed cost discovery oltre budget → block stream 2.8 | L (20%) | M | Dry-run su istanza low-spec + immediate teardown, defer cutover se cost prohibitive |
| R-MVP4-06 | Stream 2.4 SDBI Phase 2 effort blow-up oltre 5wk | M (35%) | M | Per-macro-area gate: dopo 2 macro-aree, reassess delta + decide continue/defer |
| R-MVP4-07 | Wave 3 human approval UI sotto-utilizzata (cognitive load) | M (30%) | L | Batch-approve + filter "needs review only" + audit usage post 2 settimane |
| R-MVP4-08 | Stream 2.6 React Flow Pro license blocker per production | L (15%) | M | Decision deferred via `hideAttribution: true` per dev, ADR open per production cutover |
| R-MVP4-09 | Mobile audit reveals architectural debt (e.g., DataTable not responsive) | M (25%) | M | Fix in `@heuresys/ui` upstream → bump + retest; defer to MVP-5 se architettonico |
| R-MVP4-10 | Bus factor 1 interruption (Enzo) durante MVP-4 multi-month span | L (10%) | H | ADR + handoff doc + commit co-author trailers; mitigation already inherited from BOOTSTRAP §8 R12 |
| R-MVP4-11 | OCI ARM64 native deps regression con upgrade dependencies | L (15%) | M | Lock exact patch in `package.json`; verify `pnpm install` su VM dopo ogni dependency bump major |
| R-MVP4-12 | Stream 2.7 a11y tail items reveal serious-level finding (regression critical=0 baseline) | L (15%) | H | axe-playwright scan in CI gate pre-merge; fail-fast su nuovo serious |
| R-MVP4-13 | Stream 2.5 SMS_OTP cost decision sfora MVP-4 deadline | M (30%) | L | Defer SMS_OTP a MVP-5, ship MVP-4 con WEBAUTHN+EMAIL_OTP+recovery codes solo |
| R-MVP4-14 | SDBI lineage extension migration 000035 conflict con esistente | L (10%) | M | Migration peer-review pre-apply; idempotent ADD COLUMN IF NOT EXISTS pattern |
| R-MVP4-15 | Test suite regression introdotta da MVP-4 streams (baseline 341 PASS scivola) | M (30%) | H | CI workflow obbligatorio per pre-merge gate (vedi SEC-5 forensic) — propedeutico a MVP-4 stable |

**Aggregate risk score**: 6 H-impact risks, 7 M-impact, 2 L-impact. Risk register è da rivisitare post-P0 closure session (alcuni potrebbero downgradare).

---

## §5 Decision log MVP-4 (RD-26..RD-N, attese)

Le decisioni MVP-4 che attendono Enzo sign-off:

| RD attesa | Topic | Default se non risposto |
|---|---|---|
| **RD-26** | ADR-0014 SDBI formal acceptance | Accept (PROPOSED → ACCEPTED) — già pilot Goals/OKRs + Time/Leave shipped |
| **RD-27** | Stream 2.5 SMS_OTP include o defer a MVP-5? | Defer (cost decision separata) |
| **RD-28** | Stream 2.9 `@spen-zosky/ui` Path A/B/E | Path E (status quo, just close Tappa F formally) |
| **RD-29** | Stream 2.8 OCI Managed dry-run instance provisioning | Defer dry-run, ship only ADR revisit + plan doc + `.env` block C (no instance cost) |
| **RD-30** | Wave 4 human approver: PI sign-off vs PLATFORM_ADMIN sign-off | PLATFORM_ADMIN (Enzo) — bus factor 1 = stesso decisor |
| **RD-31** | MFA mandatory enforcement policy: PLATFORM_ADMIN + TENANT_ADMIN o solo PLATFORM_ADMIN | Both (più stringente, allinea best practice) |
| **RD-32** | Stream 2.6 React Flow Pro license: acquire o defer | Defer (development OK con `hideAttribution: true`, ADR per production cutover) |
| **RD-33** | Wave 2 acceptance % threshold (85% vs 100%) | 85% (consistente con pragmatismo Wave 1 13/19) |
| **RD-34** | SDBI Phase 2 scope: 7-9 macro-aree o subset prioritized | Subset prioritized (Goals/Time/Performance/Surveys/Feedback first; defer TalentPool/PredictionsML a MVP-5) |
| **RD-35** | CI workflow attivazione prima o durante MVP-4 | Prima (propedeutico, evita regression cascade — vedi R-MVP4-15) |

**Note**: la decision log si arricchisce iterativamente durante esecuzione streams. Pattern: ogni stream apre 1-3 nuove RD specifiche; MVP-4 closure consolida tutte in BOOTSTRAP §9 successor doc.

---

## §6 Acceptance criteria globali MVP-4

Già anticipati in §0. Espliciti come checklist verificabile alla closure session:

- [ ] **AC-MVP4-01**: Tutti i 9 streams chiusi al loro acceptance criterion locale (vedi §2) OR esplicitamente deferred a MVP-5 con ADR di defer.
- [ ] **AC-MVP4-02**: Test suite globale `pnpm test` ≥ baseline `341 PASS / 1 fail pre-esistente` (no regression). Nuovi test per nuovi streams added (target +30-50 nuovi test).
- [ ] **AC-MVP4-03**: Playwright E2E `pnpm exec playwright test` ≥ baseline 61 test green. Nuove pagine MVP-4 (visualizations interattive, ESS security, brownfield approval workflow) coperte da almeno 1 E2E ciascuna.
- [ ] **AC-MVP4-04**: `pnpm db:validate` twice-run idempotency proof green su HEAD MVP-4.
- [ ] **AC-MVP4-05**: Migration count incrementato (~+5-10 attese: 000044 temp_sdbi, 000045 lineage SDBI ext, 000046 MFA factor ext, 000047 visualization layouts ext, 000048 cross-tenant view, ecc.).
- [ ] **AC-MVP4-06**: `qa_artifacts/mvp4_release_notes_v0.4.0.md` published.
- [ ] **AC-MVP4-07**: Tag annotato `v0.4.0-mvp4-complete` su HEAD post-closure.
- [ ] **AC-MVP4-08**: `HANDOFF.md` aggiornato con MVP-4 chronology + closure marker.
- [ ] **AC-MVP4-09**: Forensic refresh (`sessioni/session_<closure>_forensic-state-of-art-mvp4-closure/`) con state attualizzato.
- [ ] **AC-MVP4-10**: Bias registry: nessun `CW-B*` aperto al merge finale (tutti `MITIGATED` o `DEFERRED-TO-MVP5`).
- [ ] **AC-MVP4-11**: ADR set aggiornato: ADR-0014 ACCEPTED + nuove ADR per stream-level decisions (range ADR-0019..0025 attese).
- [ ] **AC-MVP4-12**: 0 segreti committed (grep su staged diff pre-merge); `.env.example` non contiene valori reali.

---

## §7 Mid-tier checkpoints (suggested mini-milestones)

Per evitare cascade-failure visibility late, ogni stream definisce 1-3 mid-tier checkpoints intra-stream. Riassunto strategico:

| Stream | Checkpoint 1 | Checkpoint 2 | Checkpoint 3 |
|---|---|---|---|
| 2.1 Wave 2 | Pre-flight script green | First 5 target COMPLETE | 80% target COMPLETE |
| 2.2 Wave 3 | Human approval UI live (read-only viewer ok) | 100 users imported | Audit decisions UI green |
| 2.3 Wave 4 | Career paths imported | Talent scores normalized | Cross-tenant view 0 leaks |
| 2.4 SDBI Phase 2 | ADR-0014 ACCEPTED | Pilot macro-area #3 shipped | 5+ macro-aree shipped |
| 2.5 MFA multi-kind | WEBAUTHN enroll works | EMAIL_OTP verify-login works | Session UI live |
| 2.6 Visualization renderers | React Flow page renders graph reale | Drag-and-drop saves coords | Export PNG works |
| 2.7 Mobile + WCAG | 4 viewport audit done | Critical fix pages shipped | a11y tail register updated |
| 2.8 OCI Managed prep | ADR-0010 section appended | Migration plan doc published | `.env` block C documented |
| 2.9 `@spen-zosky/ui` | Path decision recorded | (Se A/B) Lib pubblicata su npm | Consumer apps bumpati |

Checkpoint cadence: ogni 5-10 giorni intra-stream — utile per detect derail early.

---

## §8 Out-of-scope esplicito (cosa NON è MVP-4)

**Funzionali** (rimangono out per invariant I8 + scope strategico):

- Payroll execution / processing.
- Time & Attendance management (only Time/Leave evidence via SDBI Phase 2 marker).
- Benefits management.
- Procurement / vendor management.
- IAM esterno (SSO via SAML/OIDC con IdP esterno) — local credentials only.
- Facilities / badge management.
- Medical / anamnestic data.
- Real PII handling (only synthetic / demo data per RD-02).
- Raw SAP HR import (referenza catalog only).

**Tecnici** (rimandati a MVP-5+):

- Migrazione produttiva multi-region OCI (solo PREP in stream 2.8; cutover effettivo è production deployment decision separata).
- Rewrite engine SDBI in Python/Rust standalone (oggi TypeScript embedded in apps/api, scalabile per MVP-4 scope).
- Mobile native app (iOS/Android) — solo web responsive in stream 2.7.
- Tenant onboarding self-service workflow (tenant signup, billing, provisioning) — Heuresys è internal platform, no self-service onboarding.
- Marketplace / app store integrations.
- Real-time collaboration (websocket, presence, co-editing) — async workflow only.
- AI-powered features beyond SDBI (NLP query, conversational HR assistant, predictive analytics serving) — defer.

**Documentali** (utilità futura, non MVP-4):

- Onboarding guide pubblica per contributor esterni.
- Public API documentation (oggi OpenAPI esiste ma è internal-only).
- Marketing / sales material (battle cards, demo scripts).

---

## §9 References + bibliografia

### §9.1 Documenti planning canonici (read prima di apertura stream)

| Path | Sezione rilevante | Use case |
|---|---|---|
| `docs/BOOTSTRAP_EXECUTION_PLAN.md` | §2 invariants, §5 MVP-0..2 roadmap, §8 risk register, §9 decision log RD-01..25 | Baseline architectural |
| `docs/architecture/ADR_INDEX.md` | full ADR registry (drift: 0014..0018 missing in index) | ADR navigation |
| `docs/architecture/adr/0010_postgresql_runtime_location.md` | Option B accepted, Option C deferred | Stream 2.8 context |
| `docs/architecture/adr/0011_ess_scope_inclusion.md` | self-scope hard enforcement | Stream 2.5 reference (`/me/security`) |
| `docs/architecture/adr/0012_brownfield_table_mapping_wave_column.md` | `table_mapping_wave smallint` | Stream 2.1/2.2/2.3 base |
| `docs/architecture/adr/0014_sdbi_semantic_driven_brownfield_import.md` | PROPOSED — 6-phase workflow | Stream 2.4 base |
| `docs/architecture/adr/0017_lookup_fk_2hop_transform.md` | brownfield FK 2-hop transform | Stream 2.1 engine reference |
| `docs/architecture/adr/0018_coalesce_uq_class_of_bug.md` | 10 sys.* tables affected + helper | Stream 2.1/2.2 mitigation |
| `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md` | §3 Wave 1, §4 Wave 2, §5 Wave 3, §6 Wave 4, §9 implementation roadmap | Streams 2.1/2.2/2.3 |
| `docs/brownfield/WAVE_1_EXECUTION_RUNBOOK.md` | template runner | Streams 2.1/2.2/2.3 runner doc reference |
| `docs/brownfield/wave_runners/wave_2_runner.md` | (nuovo, deliverable parallelo) | Stream 2.1 |
| `docs/brownfield/wave_runners/wave_3_runner.md` | (nuovo, deliverable parallelo) | Stream 2.2 |
| `docs/brownfield/wave_runners/wave_4_runner.md` | (nuovo, deliverable parallelo) | Stream 2.3 |
| `docs/a11y-tail-items.md` | WCAG 2.2 AA tail register | Stream 2.7 |
| `docs/api/MVP_2A_API_GAP_AUDIT.md` v2.0 | gap status zero | Backend baseline |

### §9.2 Forensic baseline

| Path | Use |
|---|---|
| `sessioni/session_2026-05-26_forensic-state-of-the-art/FORENSIC_STATE_OF_ART_2026-05-26.md` §6 | MVP-4 candidates list source |
| `qa_artifacts/mvp3_full_release_notes_v0.3.2.md` | release notes tag corrente |
| `.handoff/STATE.md` | SoT operativa cross-session |
| `cowork_reserved/bias_registry.md` | CW-B17..B60 catalog |
| `cowork_reserved/HANDOFF_FRESH_SESSION.md` | handoff Cowork-side |

### §9.3 Codice di riferimento

| Path | Use |
|---|---|
| `apps/api/src/app.ts` | plugin chain canonical, LOG_REDACT_PATHS |
| `apps/api/src/modules/auth/mfa-service.ts` | MFA TOTP shipped — base per stream 2.5 |
| `apps/api/src/modules/brownfield-wave-executor/engine.ts` | wave engine — target stream 2.1+P0-2 |
| `apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts` | audit rule codes — extend per stream 2.4 SDBI |
| `apps/web/src/app/(authenticated)/visualizations/[graphId]/page.tsx` | renderer placeholder — target stream 2.6 |
| `apps/web/src/app/(authenticated)/me/security/page.tsx` | (da creare) — target stream 2.5 |
| `packages/shared/src/schemas/` | Zod schemas — estendere per nuove ESS routes |

### §9.4 External references

- React Flow docs https://reactflow.dev (rendering engine stream 2.6).
- SimpleWebAuthn https://simplewebauthn.dev (WEBAUTHN library stream 2.5).
- OWASP MFA Cheat Sheet (stream 2.5 security review).
- WCAG 2.2 AA spec https://www.w3.org/TR/WCAG22/ (stream 2.7).
- OCI Database with PostgreSQL pricing & docs (stream 2.8 cost analysis).

---

## §10 Open questions for Enzo review

| # | Question | Default if not answered |
|---|---|---|
| Q-MVP4-01 | Confermare scope 9 streams o riduzione? (es. defer 2.8 OCI Managed prep a MVP-5) | Confermare 9 streams (default) |
| Q-MVP4-02 | Confermare ordering Wave A/B/C (§3.2) o ottimizzazione diversa? | Confermare default |
| Q-MVP4-03 | Confermare P0 closure session prima di MVP-4 streams (no overlap)? | Confermare default |
| Q-MVP4-04 | Confermare SDBI Phase 2 subset prioritized (§5 RD-34 default)? | Subset prioritized |
| Q-MVP4-05 | Confermare MFA multi-kind scope (WEBAUTHN + EMAIL_OTP + recovery codes, SMS_OTP optional)? | Confermare default |
| Q-MVP4-06 | Confermare Acceptance Criteria globali §6 (threshold test suite, Playwright count, idempotency proof)? | Confermare default |
| Q-MVP4-07 | Confermare CI workflow propedeutico (RD-35 default)? | Sì, prima di MVP-4 stream apertura |
| Q-MVP4-08 | Confermare effort envelope ~27 risk-adjusted weeks o re-sizing? | Re-discuss post P0 closure (più informato) |
| Q-MVP4-09 | Confermare nessuna deadline calendar fissa (effort-based timeline only)? | Confermare default |
| Q-MVP4-10 | Confermare tag pattern `v0.4.0-mvp4-complete` o variante? | Confermare default |

---

## §11 Verification checklist (prima di MVP-4 streams opening)

- [ ] Roadmap MVP-4 reviewed da Enzo + sign-off acquisito
- [ ] P0 closure session pianificata + scheduled (effort 6-9h)
- [ ] CI workflow `pnpm test + typecheck + lint + playwright` shipped (R-MVP4-15 mitigation, RD-35)
- [ ] Branch protection rules attive su `main` (security baseline)
- [ ] Wave runner docs (`wave_2_runner.md`, `wave_3_runner.md`, `wave_4_runner.md`) reviewed + signed-off
- [ ] ADR-0014 SDBI status moved to ACCEPTED post Enzo sign-off (RD-26)
- [ ] Forensic refresh post-P0 closure (per validare nessun nuovo bias introdotto)
- [ ] HANDOFF.md aggiornato con MVP-4 kick-off marker
- [ ] Bias registry cleared (CW-B60 → MITIGATED post P0 closure)

---

**Fine MVP_4_ROADMAP.md** — strategic plan, not commitment. Awaiting Enzo review.
