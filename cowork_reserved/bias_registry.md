# Bias Registry — Single Source of Truth (SoT)

**Owner**: Cowork batch C8.1
**Date created**: 2026-05-21
**Purpose**: Claim numerazione bias `CW-B<N>` PRE-emit per evitare race condition Cowork↔CLI parallel sessions.

---

## §1 — Protocollo claim numero

**Quando vuoi emettere un nuovo CW-B<N>**:
1. Leggi questo file
2. Trova `Next available: CW-B<N+1>`
3. Aggiungi la tua entry (anche stub minimo: nome + originator + date)
4. Aggiorna `Next available`
5. Commit (atomico, single-line se possibile)

**Conflitti**: se Cowork e CLI claim simultaneous, il primo commit wins. L'altro deve incrementare + re-emit. In pratica, Cowork batch è always-on durante CLI batch → Cowork claims, CLI vede.

**Race condition storica risolta** (REPORT 010 §5 / REPORT 011 §6):
- Pre-registry: CLI X5.B aveva nominato 3 nuovi candidate `CW-B35/B36/B37` mentre Cowork C7 li aveva già emessi per altri pattern (skill_taxonomy_edges / skill_categories / skill_learning_mappings)
- CLI X7 ha auto-riconciliato leggendo pattern memo §11 + spostando ai numeri `CW-B38/B39/B40`
- Resta da riconciliare i 2 unnamed candidate REPORT 010 §5.d/e → `CW-B44/CW-B45` (vedi §3)

---

## §2 — Registry cronologico

### Bias originali pre-C7 (numerati X1-X6 sessions)

| # | Nome breve | Originator | Status | Riferimento |
|---:|---|---|---|---|
| 17 | Silent skip audit blind spot | Cowork C1.5 | mitigated | `cowork_reserved/batch_c1/` |
| 18-21 | (vari, da archivio) | C1.x | mitigated | — |
| 22 | tenant_id COALESCE-sentinel NK helper | Cowork C2.1 | mitigated | engine.ts |
| 23 | required-col defaults for non-UUID | Cowork C2.1 | mitigated | engine.ts |
| 24 | lineage write self-conflict DISTINCT ON dedup | Cowork C2.1 | mitigated (X2) | upsert-sql.ts |
| 25 | Schema introspection LIVE pre-spec | Cowork C2.4 | ongoing | pattern memo |
| 26 | Semantic FK Phantom (sys_job_roles family_id) | Cowork C3.0 | mitigated via ADR-0015 | ADR-0015 |
| 27 | audit.source_table_id NOT NULL block | Cowork C3.1 | mitigated via migration 000039 | migration 000039 |
| 28 | Cross-OS pg_dump pipe (\restrict + vector + uuid_generate) | Cowork C4.5 | mitigated via xos_lib (file-based variant pending CW-B38 update) | `db/scripts/_lib/cross_os_pipeline.sh` |
| 29 | Migration convention drift (INSERT sys_schema_migrations) | Cowork C4.5 | standardized | — |
| 30 | packages/shared/dist build coupling | Cowork C4.5 | mitigated PROMPT pre-flight | — |
| 31 | Main INSERT cross-source dedup DISTINCT ON | Cowork C4.1 + CLI X4.A | mitigated (X4.A) | upsert-sql.ts |
| 32 | Integer-to-Enum CAST without value_map | Cowork C5.1 + CLI X5.A | mitigated CAST_ENUM transform | transform-compiler.ts |
| 33 | Spec-Implementation Coupling Gap (Dry-run EXPLAIN missing) | Cowork C5.0 | mitigated PROMPT pattern §8 | pattern memo §9 |
| 34 | Nullable FK vs NK UQ Semantic Divergence | Cowork C6.1 + CLI X6.A | mitigated engine patch (X6.A) | engine.ts + upsert-sql.ts |

### Bias surfaced post-X6.A (numerati Cowork C7 forensic)

| # | Nome breve | Originator | Status | Riferimento |
|---:|---|---|---|---|
| 35 | Import Mapping Gap (skill_taxonomy_edges) | Cowork C7.1 | mitigated CLI X7 + scope ext kind_check | `forensic_cw_b35/` |
| 36 | Mapping Misclassification (skill_categories) | Cowork C7.2 | mitigated CLI X7 (REFERENCE_ONLY reclassify) | `forensic_cw_b36/` |
| 37 | LOOKUP_FK Payload Misconfigured (skill_learning_mappings) | Cowork C7.3 | mitigated CLI X7 (REFERENCE_ONLY job_title_courses); deep fix deferred X9 | `forensic_cw_b37/` |

### Bias surfaced post-X7 (numerati CLI X7 §6 — auto-riconciliati post-memo §11)

| # | Nome breve | Originator | Status | Riferimento |
|---:|---|---|---|---|
| **38** | Nullable FK + PG default NULLS DISTINCT UQ → cross-run duplicate emission | CLI X7 inline + Cowork C8.2 generalization | mitigated CLI X7 (migration 000042 sys_esco) + Cowork C8.2 generalization audit | REPORT 011 §6.a + `batch_c8/cw_b38_generalization/` |
| **39** | nk_missing_learning_path_step_path_id 688 rows | CLI X7 §6.b discovery | candidate Cowork C8.3 forensic | REPORT 011 §6.b + `batch_c8/cw_b39_forensic/` |
| **40** | Cowork spec assumed non-existent column (`table_mapping_rationale`) | CLI X7 §6.c | reflexive Cowork → pattern memo §12 | REPORT 011 §6.c + pattern memo |

### Bias surfaced post-X5.B (riconciliazione REPORT 010 §5)

CLI X5.B aveva inizialmente nominato i suoi 5 candidate come "CW-B35/B36/B37 + 2 unnamed". Race condition risolta retroattivamente — i 5 candidate corretti sono:

| # | Nome breve | Originator | Status | Riferimento |
|---:|---|---|---|---|
| **41** | xos_lib piped psql COPY drops sync on Win Git Bash | CLI X5.B §5.a | mitigated CLI inline (dump-to-file workaround); xos_lib library update P2 | REPORT 010 §5.a |
| **42** | SDBI spec column-name drift vs live source (CW-B25 column-level extension) | CLI X5.B §5.b | reflexive Cowork — CW-B25 extension into spec authoring | REPORT 010 §5.b |
| **43** | ON CONFLICT ON CONSTRAINT vs ON CONFLICT (expression-key) for UNIQUE INDEX | CLI X5.B §5.c | mitigated CLI inline (expression-key swap); pattern memo note | REPORT 010 §5.c |
| **44** | R-A2 spec used non-existent column (user_natural_key in sys_users) | CLI X5.B §5.d | mitigated CLI inline (email-list adapter); reflexive Cowork | REPORT 010 §5.d |
| **45** | Source data violates target CHECK constraints (5290 attendance/overtime rows) | CLI X5.B §5.e | mitigated CLI inline (pre-consolidate normalize); pattern Phase 4 source-vs-target CHECK delta | REPORT 010 §5.e |

---

### Bias surfaced post-X9 SKILGRO (REPORT 013 §7)

| # | Nome breve | Originator | Status | Riferimento |
|---:|---|---|---|---|
| **46** | Migration dispatch signature mismatch (Cowork spec error — assumed validator signature `(jsonb,uuid)` vs actual `(varchar,varchar)→boolean`) | CLI X9 §7 CW-B46 | mitigated inline (dispatch function inlined LOOKUP_FK validation) | REPORT 013 §7 CW-B46 — pattern memo §16 |
| **47** | Inline mitigation cap when source schema lacks semantic relation (course_id ≠ module_id) | CLI X9 §7 CW-B47 | documented + residual finding pattern | REPORT 013 §7 CW-B47 |
| **48** | Background `&` PID detach false-positive (shell job status unreliable for long-running CLI) | CLI X9 §7 CW-B48 | mitigated (DB poll `brownfield.import_runs.import_run_status` instead of shell job) | REPORT 013 §7 CW-B48 |
| **49** | **IMPORT new table_mapping NON propagated to upsert step** (P0 BLOCKER) — staging+validation+approval succeed but engine upsert filter excludes new-on-this-run mappings | CLI X9 §7 CW-B49 | **PENDING C10 forensic engine.ts/upsert-sql.ts** → mitigated X10 (`upsert-sql.ts` split-on-COALESCE patch + 4 unit tests) | REPORT 013 §7 CW-B49 + REPORT 014 §1.A + `batch_c10/forensic_cw_b49/` |
| **50** | Brownfield-seeding source-target classification mismatch (heuristic auto-classifier assigned `sys_skills` as IMPORT target for `competency_review_ratings`+`ontology_feedback` — semantic ratings/feedback != skills) | CLI X11 §6 CW-B50 | reclass 2 mappings IMPORT → REFERENCE_ONLY with metadata residual; correct target (sys_assessment_results 2-stage SDBI) deferred to dedicated batch C13 | REPORT 015 §3 + §6 |
| **51** | PROMPT spec uses constraint-incompatible status literal (`REFERENCE_ONLY` not in `chk_validation_status` ANY of PENDING/PASSED/FAILED/SKIPPED) — Cowork cross-paste from `table_mappings.classification` vocabulary into `staging.*.validation_status` vocabulary | CLI X11 §6 CW-B51 | mitigated CLI inline (used SKIPPED + detailed `staging_validation_errors`); suggest pattern memo §19 note "staging vs registry classification vocabulary" | REPORT 015 §4 + §6 + §7.1 |
| **52** | PROMPT spec staleness against live execution state — Cowork-side internal model frozen at v1.0 snapshot, doesn't pre-flight `git ls-tree HEAD` before authoring scope. Symptom: PROMPT prescribes work already done (e.g. PROMPT 016 "Phase 0 API gap audit" against HEAD where MVP-2a 41/40 pages already shipped) | CLI X12 §8 CW-B52 | mitigated CLI inline (audit doc refreshed v1.0 → v2.0 post-execution validation; PROMPT bypassed for execution, produced state-validation deliverable instead); suggest pattern memo §20 update + project memory refresh discipline | REPORT 016 §8 + §9 + audit §0 + §J.4 |
| **53** | Acceptance criterion ambiguity — natural-language target "≥40 Playwright spec" can be read as (strict) "40 separate `.spec.ts` files" or (functional) "40 executable `test()` calls". Both readings appeared inside the same document chain (NEXT_SESSION_MVP_2A.md §5 + REPORT 016 §J.1 + PROMPT 017 §4). Pre-flight regex count `^test(\|^  test(` also surfaced a CW-B52 sub-pattern: indent-sensitive regex undercounts by ~40% when source uses `test.describe(...)`+ nested `test(...)`. | CLI X13 §6 CW-B53 | mitigated CLI inline (adopted functional reading documented in `qa_artifacts/x13_e2e_coverage_matrix.md §6`); preventive: PROMPT authoring should disambiguate measurement units up-front + use robust regex `^\s*test\(` (no col-0 anchor); pattern memo §20 candidate. | REPORT 017 §6 + matrix §6 |
| **54** | Playwright dev-mode JIT jitter under parallel-worker contention — `next dev` JIT-compiles each route on first GET; 4 workers in parallel saturate the JIT pipeline → cascading `page.goto` 30s + `toBeVisible` 5s timeouts. 100%-fail rate on spec files using `employee`/`manager` storageState (their `auth.setup` is also flaky, front-loading delay). ZERO structural failures. Build PASS + axe critical=0 + warm-retry PASS all confirm code is correct — pattern is environmental. | CLI X14 §5 CW-B54 | **mitigated (X15 EVIDENCE)** — CLI X15 ran same suite vs `pnpm start` (warm prod build): effective PASS **118/125 in 5.3m** (vs 73/125 in 1.0h dev mode = +45 PASS, −54.7m duration). All dev-mode JIT timeouts eliminated. 7 residual fails are env-gate by-design (showcase pages `NEXT_PUBLIC_ENABLE_SHOWCASE=1` burn-at-build, not jitter). CW-B54 hypothesis MASSIVELY CONFIRMED. Mitigation enforced in `NEXT_SESSION_MVP_2A.md §5` via E2E run cadence specification. | REPORT 018 §2 + §5; REPORT 019 §2 + §3; `qa_artifacts/x15_playwright_prod.txt` |
| **55** | npm-publish-migration spec gap — exports map stripping a single `.` entry sembra clean/minimal in fase PROMPT authoring ma omette i subpath che i consumer reali (apps/web, apps/showcase) usano via `import "@pkg/sub"` o `@import "@pkg/sub"`. Conseguenza: il pacchetto pubblicato funziona standalone ma BLOCCA tutti i consumer downstream al primo build post-`link:`→`^version` migration. Failure mode amplificato dall'irreversibilità di `npm publish` su scoped public (fix richiede 0.1.1 rapido o `npm unpublish` proibito sopra 72h o se altri pacchetti dipendono). Caso concreto X18: PROMPT 022 §A.1 ha clausola condizionale singolare per `./styles.css` (preserve if built) ma 3 subpath reali in uso (`./styles`, `./brand/candidates`, `./assets/brand/*`) ignorati. Categoria: estensione CW-B33 (Spec-Implementation Coupling Gap) dalla DB layer al npm/registry layer. | CLI X18 §6 + REPORT 022 §6 + halt notify | **mitigated (Cowork C18.1 EVIDENCE)** — PROMPT 022.1 amendment §A.1 ribadito con exports map full-preservation (3 subpath + `.`) + `files` array esteso (`src/styles`, `src/components/brand/candidates`, `src/assets/brand`). Pre-flight check obbligatorio aggiunto a PROMPT 022.1 §1: `grep -rn '@<pkgname>/' apps/ --include='*.{ts,tsx,css}' \| grep -E '^[^:]+:[0-9]+:(import \|@import )' \| sort -u` → ogni subpath risultante DEVE essere esplicitato in exports diff. Pattern memo `COWORK_CLI_PROMPT_PATTERN.md` aggiornamento §"npm-publish-migration checklist" pending C19. Halt fail-early del CLI ha azzerato il danno (repo + registry INTOCCATI). | REPORT 022 §0bis + §6; halt notify `2026-05-24T14-43-30Z__022__halt_exports_map_subpath_gap.md`; PROMPT 022.1 §A.1 |
| **56** | npm publish pre-flight gap — PROMPT authoring 022 §1 elencava solo `npm whoami` come verifica auth ma omette 3 ulteriori check critici per scoped public publish: (a) `npm org ls <scope>` per verificare org esistenza + user membership, (b) `npm profile get tfa` per leggere 2FA mode dell'account (auth-only vs auth-and-writes vs disabled), (c) presenza `~/.npmrc` `_authToken` per scoped writes GAT-bypass. Caso concreto X18: org `@heuresys` non esisteva al primo Block C attempt (404 silent), 2FA in `auth-and-writes` mode ha rifiutato `npm publish --otp=` via CLI (npm CLI v10+ non accetta più `--otp=` per scoped org publish con `auth-and-writes`), GAT con "Bypass 2FA when publishing" necessario per unblock. Combo cause-effetto: 3 round-trip Cowork↔Enzo prima di Block C success (org creation + GAT setup + retry publish). | CLI X18.1 halt_publish_2fa_required + Cowork C18.1 missed pre-flight scope | **mitigated (Cowork C18.2 EVIDENCE)** — PROMPT 022.2 amendment §1 pre-flight check #A/B/C aggiunge: (a) `npm view <pkg>@<version>` registry state per detect publish-already-done + cache propagation note, (b) `cat ~/.npmrc \| grep _authToken` GAT presence check, (c) `npm org ls <scope>` org existence + member verification. Pattern memo `COWORK_CLI_PROMPT_PATTERN.md` aggiornamento §"npm-publish-migration end-to-end checklist" pending C19 (include GAT bypass-2fa setup procedure + lifecycle policy). | REPORT 022 §10-RESUMED; halt notify `2026-05-24T15-50-39Z__022__halt_publish_2fa_required.md`; PROMPT 022.2 §1 |
| ~~57~~ | ~~tsup `external` minimal default + subpath exports source-direct = dual-package hazard~~ | ~~CLI X18 halt_dual_package_hazard §1-§5~~ | **WITHDRAWN 2026-05-24 Cowork C18.3 (CLI counter-evidence)** — CLI halt_cw_b57_misdiagnosis §2 verified by `head -30 dist/index.mjs` mostra 44 import statements ESTERNI preservati (Radix, framer, dnd-kit, lottie, echarts, cytoscape, tanstack, ecc.) — NULLA bundled inline. tsup 8.x **auto-externalizza tutte le `dependencies` del package.json by default**, indipendentemente dall'external list esplicita. Pre/post amendment 022.2 bundle byte-identical (388,138 bytes exact match). External aggressive prescription era REDUNDANT (harmless ma non causa-fix). Vera causa del build fail apps/web: **CW-B58** (outExtension config gap, vedi sotto). CW-B57 era misdiagnosis da bundle-size assumption. | halt notify `2026-05-24T17-05-00Z__022__halt_cw_b57_misdiagnosis.md`; PROMPT 022.3 §0bis |
| **58** | **Misdiagnosis via assumption gap (meta-bias) + outExtension config gap (concrete)**. Two-layer bias: (concrete) tsup default per package con `"type": "module"` produce `dist/index.js` per ESM format, ma exports map manifest può referenziare `./dist/index.mjs` — file NON ESISTENTE finché tsup non ha `outExtension({format}) => js: format === "esm" ? ".mjs" : ".cjs"` config. Conseguenza: Webpack consumer ricevе file-not-found → fallback su source files (via transpilePackages) → re-import context libs da node_modules → 2 React contexts in process → `Class extends value undefined`. Manifestation X18 commit `ef46668` (0.1.0): manifest aveva `.mjs` exports ma dist aveva `.js` only. (Meta) Cowork ha prescribed external aggressive list senza verificare baseline bundle behavior via `head -30 dist/index.mjs | grep '^import'` — assunzione "bundle large = bundled deps" senza verifica empirica. CLI ha correttamente overridden con evidenza concreta. **RECURRENCE in X18.3 + X18.4**: outExtension fix da solo NON ha risolto il build fail (HALT-022-05: 3 config tested all FAIL). Vera causa NON era outExtension (anche se outExtension fix era comunque necessario per file presence), ma un'altra issue architetturale Next 15 RSC bundle threshold (vedi CW-B59 per pattern bisect contamination + esito final HALT-022-06). | CLI X18.2 halt_cw_b57_misdiagnosis §3 Hypothesis A + §5 self-correction + 3 verified-by test | **mitigated (Cowork C18.3 EVIDENCE + reinforced cross-batch X18.4/X18.5)** — PROMPT 022.3 amendment §2 tsup.config.ts `outExtension` block ripristinato. External aggressive list mantenuta harmless. Pattern memo C19 task: pre-prescription bundle inspection mandatory + meta-rule "CLI critical thinking overrides Cowork theoretical model when evidence concreta contraddice". CW-B58 ha avuto **3 recurrences cross-batch** (HALT-022-03 tsup bundle wrong → HALT-022-04 extension fix insufficient → HALT-022-05 + HALT-022-06 architectural threshold). Lesson finalizzata: empirical test matrix > narrative diagnosis, time-box max 60-90 min OR 8-10 iterations bisect prima di scope reassessment. | REPORT 022 §0bis-RESUMED-X18.2 + halt notify cascade `2026-05-24T17-05-00Z__022__halt_cw_b57_misdiagnosis.md` + `2026-05-24T17-25-00Z__022__halt_persistent_build_fail.md` + `2026-05-24T18-32-00Z__022__halt_bisect_inconclusive.md`; PROMPT 022.3/022.4/022.5 |
| **59** | **Bisect methodology contamination + Next 15 RSC bundle threshold (architectural)**. Two-layer bias: (a) bisect via `export removal` in src/index.ts contamina apps/web typecheck (consumer imports collettivi blocked), (b) stub replacement con `const X = null` cambia module structure (was pure re-exports, became mixed) → dist output diverso, webpack chunking differs, fail behavior changes, bisect convergence fallisce; (c) link: vs versioned hanno fail modes diversi (link: webpack parse error on `useEffect`, versioned `d.createContext undefined`) — bisect via link: ABANDONED. (Architectural) Next.js 15.5.18 ha bundle complexity threshold per RSC server bundle: quando `@heuresys/ui` exports >50 components, page-data collection di `/showcase/*` routes trippa `d.createContext is not a function` (React minified a `d` undefined in chunk evaluation context). Threshold reproducible: iter 6 (3 of 7 obs widgets) PASS, iter 7 (full 7) FAIL. Individual components hanno minimal-imports — issue è emergent chunk topology + bundle size, NOT singolo culprit. **Manifestation X18.4**: 12 bisect iterations CLI, NO single-component culprit identifiable, REAL cause = architecturale Next 15 RSC non risolvibile in X18 scope. | CLI X18.4 halt_bisect_inconclusive §2-§5 + 12 iter empirical evidence + methodology contamination findings | **mitigated (Cowork C18.5 PRAGMATIC EVIDENCE)** — PROMPT 022.5 amendment Path B (force-dynamic on /showcase/layout.tsx) + Path C fallback (skip /showcase from build via next.config). MVP-3 Tappa F SHIPPED con caveat documentato in commit message + tag annotated + REPORT §6-RESUMED-X18.5. Proper architectural fix DEFERRED to dedicated session: Path A git bisect ux-design-shared commits OR Path F split @heuresys/ui in subpackages (@heuresys/ui-core + @heuresys/ui-dashboard + @heuresys/ui-brand). Pattern memo C19 tasks: (1) bisect methodology canonical = source-file impl replacement (stub IMPL, keep export signature) NOT export-list manipulation, (2) bisect time-box max 8-10 iter OR 60-90 min budget — beyond escalate scope reassessment, (3) Next 15 RSC bundle threshold workaround pattern (force-dynamic + scope reduction). | REPORT 022 §6-RESUMED-X18.5; halt notify `2026-05-24T18-32-00Z__022__halt_bisect_inconclusive.md`; PROMPT 022.5 §0+§7 |

### Bias surfaced post-X19 Brownfield Wave 1 re-run (REPORT 023 §6 — empirical HALT-X19-01)

| # | Nome breve | Originator | Status | Riferimento |
|---:|---|---|---|---|
| **60** | **Engine silent-filter on approved+validated IMPORT mappings (upsert yields 0 rows, no WARNING log) + Wave-1 scope gap (IMPORT targets without staging source)**. Two-part residual surfaced when the post-CW-B49 engine (HEAD `b01c331`, commit `7ea09f0`) was run end-to-end on Wave 1 for the first time (run `6f531559`, COMPLETED 47min, 34509 upserted, 0 failed). (A) 3 targets `sys_skill_categories` (32 staging), `sys_activity_classification_mappings` (14), `sys_process_kpi_templates` (81) were AUTO_APPROVED + 0 validation failures, yet `executeUpsert` produced **0 target rows with zero WARNING/ERROR logs** → silent row-drop (NK/required/FK filter or SKIPPED_UNSUPPORTED_TRANSFORM, beyond CW-B49 conflict-inference). (B) 3 targets `sys_blueprint_overrides`, `sys_position_learning_requirements`, `sys_position_skill_requirements` have NO `staging.wave1_*` source → `stagingTableFor`→null → silent skip (no Wave-1 source export; derived/computed or Wave 2 scope). META: PROMPT 023 acceptance `≥75/134 populated` was unreachable — only 19 distinct IMPORT targets exist in Wave 1 (CW-B52 spec staleness; reality 59/134 pre+post, 13/19 IMPORT targets populated). | CLI X19 §6 empirical (post-patch full run) | **PENDING Cowork forensic** — engine fix (silent-filter root cause + observability log) = halt+escalate per Inline Mitigation Scope §1.4 (engine transform / SUPPORTED_TRANSFORMS); scope decision for the 3 no-source targets (Wave 2 / exclude / derive). NOT fixed inline (CW-B58 discipline: empirical test matrix done, narrative "re-run→≥75/134" refuted). | REPORT 023 §6 + halt notify `__023__halt_engine_residual_6_targets.md`; run `6f531559` |

---

## §3 — Next available

**Next available**: `CW-B61`

When emitting, increment this counter atomically + add entry to §2.

---

## §4 — Race condition pattern (lessons learned)

**Trigger condition**: Cowork batch + CLI session parallel + entrambi surfacing new bias candidates.

**Symptom**: stesso numero usato per pattern diversi (es. REPORT 010 + C7 forensic = doppio CW-B35/36/37).

**Mitigazione strutturale (questo file)**:
1. Bias registry centralizzato + atomic claim
2. Pre-emit verification: read registry, increment Next available, commit
3. Both Cowork and CLI must consult registry before emitting new CW-B<N>

**Mitigazione comportamentale**:
- Cowork batch standing during CLI session deve verificare CLI REPORT just-shipped prima di emit nuovi numbers
- CLI fresh session deve grep registry prima di proposing new CW-B<N>
- Pattern memo §10 + §12 vincenti reference questo file

---

## §5 — Total tally

- **Total catalogati**: 58 actively catalogued (CW-B17 → CW-B59, **CW-B57 WITHDRAWN 2026-05-24 per misdiagnosis**, CW-B58 + CW-B59 claimed). Effective valid bias = 58 (B17→B56 + B58 + B59).
- **Mitigated**: 39 (+CW-B49 X10 engine patch, +CW-B51 X11 inline SKIPPED, +CW-B52 X12 inline audit-refresh, +CW-B53 X13 inline functional-reading adoption, +CW-B54 X14 inline verdict-separation, +CW-B55 C18.1 PROMPT amendment + pre-flight grep mandatory, +CW-B56 C18.2 PROMPT amendment + npm pre-flight extended (org/2FA/GAT), +CW-B58 C18.3 PROMPT amendment + outExtension fix + pre-prescription bundle inspection mandatory (reinforced cross-batch X18.4/X18.5), +CW-B59 C18.5 pragmatic Path B+C workaround + bisect methodology canonical + Next 15 RSC bundle threshold deferral)
- **Withdrawn**: 1 (CW-B57 misdiagnosis — CLI counter-evidence via bundle head inspection; CW-B58 covers the real bias both concrete + meta-layers)
- **Deferred proper fix**: 1 (CW-B59 architectural Next 15 RSC bundle threshold — workaround applied, proper fix Path A bisect commits OR Path F split package deferred to dedicated session)
- **Reflexive (pattern memo only)**: 6 (B25, B30, B40, B42, B44, B47)
- **Standardized**: 2 (B29 migration convention, cross-OS pipeline B28)
- **Documented + partial mitigation**: 1 (B50 X11 reclass — correct target authoring deferred to C13)
- **Pending forensic / spec minor**: 3 (B39, B41 xos_lib update, B43 pattern note)
- **Pending engine improvement**: 1 (B45 source-vs-target CHECK delta into SDBI Phase 4)

---

*End bias_registry.md — SoT cross-batch*
