# SOT_BACKLOG — Azioni da riprendere (CLI-owned)

> Pendings + azioni nuove/programmate da cui il CLI riprende il consolidamento e lo sviluppo, in autonomia. Sintesi da: handover Cowork S937, `STATE.md`, `MVP_4_ROADMAP.md`, ricognizione forense S939. Debiti tecnici in `DEBT_REGISTER.md`; stato in `SOT_STATE.md`.
> **Aggiornato**: 2026-05-27 (S939; + verifica stato evidence-based pre-resolution).

## ✅ Verifica stato 2026-05-27 (evidence-based, pre-resolution)

> Accertamento reale di ogni item aperto (grep/read/DB/gh), per ripartire informati. Nessun fix applicato qui (solo D-12 migrate.sh chain + 000044 reclass eseguiti come task isolato approvato, vedi DEBT_REGISTER).

| Item | Stato verificato | Evidenza | Scope residuo reale |
|---|---|---|---|
| **B-01 / D-01** | ✅ **FATTO** 2026-05-28 | CLAUDE.md §"What this is"+architecture+migrations allineati a MVP-4 (Fastify 5, ~58 moduli, web shipped, 43 mig, +showcase, puntatore SoT viva); README header→state S940 + 43 mig. README NON era a MVP-1 (solo CLAUDE.md). | — |
| **B-02** | ✅ **RESOLVED** 2026-05-29 (decisione Enzo: tieni locale) | `docs/kb/tools/` (10 file: build_index/graph_hub/graph_mirror/linked_manifest + sync.sh/.ps1 + hooks) + `graphify-out/` presenti. **Repo GitHub `Spen-Zosky/heuresys-advanced-wiki` NON verrà creato** (decisione 2026-05-29). | Il vault resta **Obsidian locale** in `wiki-space` (fuori repo); i tool `docs/kb/tools/` restano per sync locale. Nessun repo esterno. — |
| **B-03 / D-08** | ✅ FATTO | `docs/kb/COWORK_ARCHIVE_NOTE.md` + SoT docs/kb completa (SOT_STATE/BACKLOG/DEBT_REGISTER/INDEX_PATHS/COWORK_INBOX/integrations/tools) | — |
| **B-10** | 🟡 APERTO (intatto) | ADR-0014 **PROPOSED**; `000036_temp_sdbi_schema.sql` presente; **source HR assente da legacy_mirror, platform 0-row** → i dati esistono nel dump `heuresys_platform_0507` (VM `/home/ubuntu/heuresys-evo/backups/local/`, ~367MB i primi maggio) | piano CLI-owned; per dati: restore dump→mirror legacy_mirror→SDBI; legato zod4 |
| **B-20** (#3) | ✅ **FATTO** 2026-05-28 | causa-radice delle 301/302 tc errors: `packages/shared` era rimasto zod **3.25.76** (lo spike aveva bumpato solo api/web) → gli schema erano istanze zod-3, che non fanno match `$ZodType` di `zod/v4/core` richiesto da ftpz6. Fix: bump `packages/shared` zod→**4.4.3** + `ZodError.errors`→`.issues` (errorHandler.ts:33). zod4 `z.uuid()` RFC-strict → 1 fix literal test mfa (404 boundary). Verifica: typecheck src+test 0, suite **345 pass / 5 skip / 0 fail**, web typecheck+build+i18n+Playwright verdi. Merged ff-only su main `17fad36`. | chiude PR #3 (defer-major superato) |
| **B-21** (#5) | ✅ **FATTO** 2026-05-28 | `fastify-type-provider-zod 4.0.2→6.1.0`. La "inference rotta" misurata nello spike era **conseguenza di B-20** (shared zod-3), non un break strutturale ftpz: **0** fix per-route sui 61 route file, **0** cambi error-structure (solo `.issues`), `app.ts` wiring invariato (`withTypeProvider<ZodTypeProvider>` + i 2 compiler). Peers ftpz6 (`@fastify/swagger` 9.7, `openapi-types` 12.1.3) già transitivi. Verifica completa verde (vedi B-20). | chiude PR #5 |
| **B-20b** | 🟢 **deferito** (hygiene, non correttezza) | deprecation sweep zod4 lasciato fuori scope per scelta del piano (Phase 3): `z.string().email()`→`z.email()` (8), `{message}`→`{error}` (3), `.strict()/.passthrough()`→`z.strictObject/looseObject` (2), `.datetime()`→`z.iso.datetime()` (145, alta churn / zero beneficio). Tutti compilano e girano su zod4. | sweep meccanico opzionale post-MVP-4 |
| **B-22** (#6) | ✅ **FATTO** 2026-05-28 | `react-i18next 15.4.0→17.0.8` + `i18next 23.16.8→26.3.0` (peer richiedeva i18next≥26.2). Uso basilare (init+Provider+useTranslation), 0 plural keys → smooth. typecheck+i18n parity+build web verdi. | chiude PR #6 |
| **B-23** (#1 next) | ⚪ **STALE/CHIUSO** | nessuna PR `next` aperta; `next@15.5.18` | **rimuovere dal backlog** |
| **B-24** | ✅ **FATTO** 2026-05-28 | `peaceiris/actions-gh-pages@v3→@v4` in showcase.yml; v4 = solo Node16→20 (verificato changelog), tutti gli input usati (github_token/publish_dir/publish_branch/force_orphan/commit_message) compatibili. YAML validato. | chiude PR #16; deploy gira al push |
| **B-25 / D-09** | ✅ **FATTO** 2026-05-28 | condition `if: !contains(...labels...'defer-major')` aggiunta ai 6 workflow `pull_request`; push a main non impattato; YAML validato | — |
| **B-30** | 🟢 aperto (infra) | solo OCI VM runner | backup runner Windows |
| **B-31** | 🟡 aperto (infra) | — | ssh-agent persistence cross-session |
| **B-40** (CW-B39) | ⚪ **rivalutato** | `sys.sys_learning_path_steps` **VUOTA (0 righe)**; le 688 righe null `learning_path_step_path_id` erano source/staging-side | forensic source-side solo se si persegue |
| **B-41** (CW-B45) | deferito | — | SDBI Phase 4 |
| **B-42** (CW-B50) | 🟢 **reclass FATTO** | 3 target = REFERENCE_ONLY (via 000044/D-12, 2026-05-27) | resta solo "correct target authoring" (deferito) |
| **B-43** (CW-B41) | ✅ **FATTO** 2026-05-28 (validazione funzionale gated a B-10) | `xos_restore_legacy_mirror` ora dump→tempfile→`psql -f` (no pipe) nei 2 step DDL+DATA; applica il workaround validato REPORT 010 §5.a. bash -n + smoke + mktemp cross-OS OK | run reale gated a B-10 (lib non esercitata da script attivi) |
| **B-44** | ✅ **FATTO** 2026-05-28 | cross-OS idempotent bootstrap: `scripts/vm-bootstrap.sh` (Linux server, systemd, public 8013/3013) + `scripts/dev-bootstrap.sh` (Mac/Linux-desktop) + `scripts/dev-bootstrap.ps1` (Windows) + `scripts/sync-gitignored-to-vm.sh` (mirror dati gitignorati non-rigenerabili PC→VM, tar-over-ssh, escl. node_modules/dist/.next/.env) + `deploy/README.md`; central VM DB via tunnel 5433. Spec/plan in `docs/superpowers/{specs,plans}/2026-05-28-cross-os-bootstrap*`. **Verificato live** su arm64 VM + Windows + **Mac Intel/Darwin 2026-05-29** (Node 22 v22.22.3 via nvm, pnpm 9.15.0, `--frozen-lockfile` ok, tunnel :5434→VM, `/readyz` DB ok, RBAC cache loaded, API listening :3001); amd64 by-construction (lockfile cross-platform). Side-fix: root scripts `--filter` single→double quote (Windows cmd) | ✅ Mac live-verify completato 2026-05-29 | 
| Dependabot **alerts** | ✅ 0 aperti | `gh api .../dependabot/alerts` | — |

**Sintesi per la fresh session**: realmente da fare = **B-10** (SDBI, intatto — ora **sbloccato da zod4**), **B-31** (infra ssh-agent), **B-42** (target authoring). **Chiusi/stale**: B-01/D-01 (fatto 2026-05-28), B-03/D-08 (fatto), **B-20+B-21 zod4+ftpz6 (fatti 2026-05-28, merged `17fad36`)**, B-22 (i18next), B-23 (stale), B-24→#16 (gh-pages), B-25/D-09 (defer-major CI skip), B-26 (risolto), B-43 (xos_lib), B-44 (cross-OS bootstrap, **Mac verify ✅ 2026-05-29**), D-04 (root cleanup), D-12 (risolto). **Deferiti**: B-20b (deprecation sweep zod4), B-41 (Phase 4). **Da chiarire**: B-40 (source-side). **B-02 RESOLVED 2026-05-29** (vault Obsidian locale, no repo esterno).

## P0 — Consolidamento immediato (questa fase, prima di nuovo sviluppo)

| ID | Azione | Effort | Note |
|---|---|---|---|
| **B-01** | Rimediare doc drift `CLAUDE.md` + `README.md` (stato MVP-1 → realtà MVP-4) | ~30-45min | Vedi `DEBT_REGISTER.md` D-01. Bloccante per onboarding corretto di sessioni future. |
| ~~**B-02**~~ | ✅ **RESOLVED 2026-05-29** — vault resta Obsidian locale (decisione Enzo); nessun repo GitHub esterno | — | Tool `docs/kb/tools/` + `graphify-out/` restano per uso locale. |
| **B-03** | Congelare archivio Cowork + pubblicare policy bias post-Cowork | ~15min | `COWORK_ARCHIVE_NOTE.md`; numerazione CW-B continua in `docs/kb/`. |

## P1 — Sviluppo programmato (deciso da Enzo)

| ID | Azione | Effort | Entry point |
|---|---|---|---|
| **B-10** | **MVP-4 stream 2.4 — SDBI Phase 2** (Semantic-Driven Brownfield Import, kickoff) | ~6-10h | `cowork_code_exchange/_01_PROMPT_027_s937_ck8_sdbi_phase2_kickoff.md` (archivio); contesto `_00_HANDOVER_CLI_2026-05-26_post_S937.md`. Migration base `000036_temp_sdbi_schema.sql`. **NB**: era legato a zod4 (B-20) → **ora sbloccato** (B-20 fatto 2026-05-28). Riformulare il PROMPT 027 come piano CLI-owned diretto (non più protocollo Cowork). |

### B-50 — Full reconciliation legacy→advanced (oltre ~49%) — umbrella ADR-0023

Apertura item (S951). La dottrina data-source (**ADR-0023**) conferma che il legacy heuresys-evo è la sorgente dati **autoritativa** e advanced (`sys.*`) lo schema target strutturale; lo stato reale di popolamento è **~49%** (65/134 tabelle `sys` con righe; **69.450** lineage rows). Portare la conciliazione verso il completo è lavoro vero, **multi-sessione, da greenlight esplicito** (NON eseguito in S951). Breakdown verificato (query live 2026-05-31):

| Sotto-item | Stato verificato | Aggancio |
|---|---|---|
| (a) ~69/134 tabelle `sys` a 0 righe | entità non ancora importate (Wave-2/3 non eseguite o senza sorgente legacy) | **B-10** (SDBI Phase 2), stream 2.1 Wave 2 |
| (b) 4-5 Wave-1 IMPORT target a zero | `process_kpi_templates`, `learning_path_steps`, `skill_categories`, `activity_classification_mappings`, `skill_learning_mappings` — mapping presente, upsert 0-righe (sorgente vuota / transform non supportato / silent-skip) | **B-40** (CW-B39), **B-42** (CW-B50) |
| (c) 2 import_run orfani | 1 FAILED + 1 RUNNING (su 21 COMPLETED) — chiudere/pulire | housekeeping engine brownfield |
| (d) nessun delta/watermark | ogni run è full re-stage idempotente; manca HWM incrementale | design `brownfield.source_watermarks` (rif. doc SF §3.2 net-new) |
| (e) **ingestion era user-centric** (ADR-0024) | le metodiche key-avano su legacy `users.id`; corretto a **employee-centric** (`employees.id`). Fase 1 (doc) ✅ S954; Fase 2 (seed re-key) + Fase 3 (re-key live bare-metal, gated) in corso | **ADR-0024**, `EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md`, D-13 |

**Effort**: multi-sessione (B-10 da solo ~6-10h). **Regola d'ingaggio**: esecuzione SOLO su greenlight esplicito di Enzo (scope-discipline cardinale, `memory/feedback_scope_discipline_no_cascade.md`). Questo item documenta lo scope; non autorizza un bulk-import autonomo. **Nota S954**: la conciliazione futura DEVE seguire la doctrine employee-centric (ADR-0024) — `sys_user*` ⟸ legacy `employee*`, key `LEGACY_EMP::<employees.id>`, MAI `users.id`.

**🔎 Aggiornamento S955 (2026-06-01, diagnosi live):**
- **(c) orphan runs → CHIUSO come "leave-as-is"**: i 2 run non-COMPLETED sono entrambi **terminali** (1 FAILED 2026-05-16 DEMO + 1 CANCELLED `8d237e28` finita 2026-06-01 02:16, ex-"RUNNING") con **0 ref downstream** (0 lineage / 0 table_mappings / 0 staging). Sono marker storici validi → nessuna mutazione. Il concern "1 RUNNING" del backlog è **risolto**.
- **(b) correzione conteggio**: i "4-5 zeri" sono in realtà **3 silent-skip veri** (`sys_skill_categories`, `sys_process_kpi_templates`, `sys_activity_classification_mappings`) + **2 REFERENCE_ONLY by-design** (`sys_learning_path_steps`, `sys_skill_learning_mappings`, reclass ADR-0020 — empty atteso, NON un difetto; vanno scorporati dal conteggio "69 vuote").
- **(b) root-cause pinpointed (NON ancora fixato)**: NON è sorgente-vuota (competencies 32 / process_kpis 81 / industry_ccnl_mapping 14 live su VM) e NON è lookup-target-vuoto (`sys_skills` 20073, `sys_activity_classifications` 3276, `sys_compensation_bands` 87 popolati). È un **fallimento di risoluzione natural-key dentro il transform LOOKUP_FK** = il noto **CW-B60-A/B61** (observability aggiunta in `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts:611+`, ma il fix non applicato; il commento cita "Goal 003 W1 retry: 24552/41285 = 59% lost"). **Unblock**: leggere il resolver LOOKUP_FK (`transform-compiler.ts` + `transforms.ts` + `brownfield.validate_lookup_fk_dispatch()` di `000033`/`000043`), campionare il mismatch natural-key per ciascuno dei 3 target, fixare il mapping/resolver, re-import gated dei 3 contro VM legacy, validare source-vs-target + sample 5 righe. **Effort ~40-60k token, regression risk MED-HIGH (zero integration-test su questi 3 import)** → sessione dedicata, NON tail-end. Sorgente VM via `ssh oracle-vm-default sudo -u postgres -d heuresys_platform` (Docker locale è giù).
- **(a)/(d)/(e-Ph3) restano multi-sessione/gated** (vedi sopra): SDBI Phase 2 (75-125h, mapping-card design umano + schema target mancante), watermark design, live re-key Ph2/Ph3.

**🔎 Aggiornamento S958 (2026-06-02, sweep autonomo backlog):**
- **`sys_activity_classification_mappings` → RISOLTO** (mig `000056`, ADR-0025 §5.4, commit `70a869d`): il card era *mis-authored* (target_id LOOKUP_FK→`sys_compensation_bands` vs FK+API che richiedono `sys_activity_classifications`, 0-overlap). Reclassify IMPORT→REFERENCE_ONLY (pattern 000044), zero schema/API change, reversibile. Tabella **empty-by-design** (il fatto industry→CCNL è già in `sys_compensation_bands`/`sys_position_compensation_profiles`; popolamento reale richiederebbe una sorgente ATECO↔NACE crosswalk — future). Scorporato dai "3 silent-skip" → ne restano 2 (`sys_skill_categories` già 0→6 in WS-3; `sys_process_kpi_templates` cross-wave, sblocca con kpi_definitions).
- **Data-reconciliation classificato + ready-to-run**: nuovo doc autoritativo **`docs/kb/DATA_RECONCILIATION_PLAN.md`** — 67 tabelle vuote in cat(i) ~15-20 deterministiche/eseguibili-per-card, cat(ii) ~20-25 derived/needs-decision, cat(iii) ~20-25 scaffold/no-source. **`sys_kpi_definitions` ✅ ESEGUITO** (S958, commit `ae34588`, supervised VM run, backup `pre-cat-i-reconcile`): 0→81 da `process_kpis` 1:1 (polarity value-map 43/36/2, idempotente, validato). **Triage cat(i) (match-rate misurato sui restanti)**: solo kpi_definitions era CLEAN — gli altri ~6-7 target = **NEEDS-DECISION**, NON import meccanici. **2 muri strutturali** (plan §7): (1) KPI catalog single-source — le altre 3 sorgenti KPI (org_unit_kpis/job_kpis/employee_kpi_targets) hanno namespace **disgiunti** (code-overlap 0) → kpi_id non risolve finché non si decide l'unificazione del catalogo KPI; (2) learning catalog event-sourced (`OLDDB::<event>::<id>`) → path/module FK risolvono 0; + career_paths parent vuoto + bridge job→position assente. Forzare avrebbe creato 6 target silent-skip/FK-violation. **Prosecuzione = milestone di modellazione con autorità semantica Enzo** (catalog unification KPI / re-import catalogo learning canonico / bridge job→position), non bulk-import autonomo.

### B-51 — Re-derive 162 RTL `position_title` + `position_job_role_id` (employee-centric, design from zero) — ✅ DONE 2026-06-01 (S955)

**✅ ESEGUITO (migration `000048`, S955).** Derivati i 162 `position_title` dalla professione reale legacy (`employees.job_title`) via join `position_metadata->>'legacy_employee_id'` = `employees.csv.id` (**162/162 esatto**); creati **25 job_roles puliti** `RTL-ROLE-<SLUG>` (global, `family_id`/`seniority` = NULL evidence-only), wired **162/162** `position_job_role_id`. I 7 bucket grezzi → 25 titoli fini (es. Security Specialist→Securities Dealer; Compliance Officer 29 → 19 Compliance Officer + 5 Back Office Specialist + 3 Payment Specialist + 1 CEO + 1 IT Director). Mappa baked come VALUES statici (no `\copy`, CI-reproducibile); generatore `db/seeds/rtl-rebuild/11_rederive_b51_titles_roles.py`. I 202 ruoli pre-esistenti (91 corrotti `OLDDB::`) NON toccati (scope P3). Idempotente (2° run 0 mutazioni), backup `pg_dump_snapshots/pre-b51-s955_*`, API 34/34 verde (7 suite positions/roles/career). **Sblocca R2.** ESCO enrichment resta opzionale (B-50/P3).

Apertura item (S954). Il problema: le 162 posizioni RTL/Heuresys hanno `position_title` derivati dallo scaffold e `position_job_role_id` non wired — vanno ricavati dalla professione reale legacy. **La P2 precedente (RTL_STABILIZATION_PLAN §P2) è stata INVALIDATA ed eliminata** 2026-06-01: la sua indagine + il CSV proposta giravano sul `user_external_code` user-centric (`LEGACY:<users.id>`) **prima** del re-key ADR-0024; dopo la migration `000046` quel grafo di provenienza non esiste più → ogni mapping prodotto sotto quella lente è compromesso (igiene: cancellato, non riparato).

**Da riprogettare da zero** sulla doctrine employee-centric (ADR-0024 / I14):
- Persona = legacy `employees` (NON `users`); link a v5 via email (`employees.email = sys_users.user_email`) o key `LEGACY_EMP::<employees.id>`.
- Sorgente professione: legacy ESCO occupation / `tenant_jobs` / hierarchy `reports_to` — **da ri-verificare ex-novo** sul DB post-re-key (i numeri di copertura della vecchia P2, es. "43/158 job assignments", non sono affidabili: erano misurati sul grafo sbagliato).
- Output atteso: UPDATE idempotente `sys_positions.position_title` + creazione job_roles puliti + wire `position_job_role_id`, gated (backup + dry-run + re-test), come ogni fase distruttiva.

**Blocca**: R2 (role assignment con titoli corretti, `RBAC_UIX_PERSPECTIVES_PLAN.md`). **Effort**: 1 sessione design + 1 esecuzione gated. **Regola d'ingaggio**: design evidence-based da zero (grep/query reali sul DB post-S954), SOLO su greenlight esplicito. Cross-ref: `RTL_STABILIZATION_PLAN.md §P2` (invalidata), ADR-0024, B-50(e).

## P2 — Dependabot / dipendenze (audit breaking-changes)

| ID | PR | Pacchetto | Rischio | Note |
|---|---|---|---|---|
| ~~**B-20**~~ | #3 | ~~zod 3→4~~ | alto | ✅ **FATTO 2026-05-28** (merged `17fad36`): bump `packages/shared`+api+web → zod 4.4.3. Causa-radice = shared rimasto su zod-3. Verifica completa verde. |
| ~~**B-21**~~ | #5 | ~~fastify-type-provider-zod 4→6~~ | alto | ✅ **FATTO 2026-05-28**: ftpz 4.0.2→6.1.0, accoppiato a B-20. 0 fix per-route, solo `ZodError.errors`→`.issues`. |
| ~~**B-22**~~ | #6 | ~~react-i18next 15→17~~ | medio | ✅ **FATTO 2026-05-28**: +i18next 23→26 (peer). 3 file consumatori, uso basilare, 0 plural keys. typecheck+parity+build web verdi. |
| **B-23** | #1 | next (major) | alto | conflicting + CVE-hold; verificare impatto RSC/showcase (CW-B59 area). |
| ~~**B-24**~~ | #14/#15/#16 | setup-node 6 / action-setup 6 / gh-pages 4 | basso | ✅ **FATTO 2026-05-28**: #14/#15 già chiuse; gh-pages 3→4 applicato in showcase.yml (v4 = Node16→20 only, input compatibili). Chiude #16. |
| ~~**B-25**~~ | — | ~~**Churn defer-major**~~ | basso | ✅ **FATTO 2026-05-28**: condition `if: !contains(github.event.pull_request.labels.*.name, 'defer-major')` sui 6 workflow `pull_request`. Le PR defer-major non triggerano più CI sul runner singolo; push a main intatto. |
| ~~**B-26**~~ | #78 | ~~`tmp` <0.2.6 path-traversal~~ | — | ✅ **RISOLTO S939** (`6aa0b79`): transitivo via exceljs → pnpm override `exceljs>tmp >=0.2.6` → 0.2.7. NON era un major deferito. |

## P3 — Infra / robustezza

| ID | Azione | Note |
|---|---|---|
| **B-30** | Backup runner Windows | ⚪ **WON'T-DO (su desktop) 2026-05-29** — analisi evidence-based: copre solo 4/6 gate (i 2 gate DB non possono girare comunque se la VM è giù, il DB è sulla VM); + rischio sicurezza alto (repo PUBBLICO → fork-PR code eseguibile sul PC primario). Non aumenta qualità funzionale/visuale MVP. Se mai si perseguisse: runner su VM/container **isolato**, non il desktop. |
| **B-31** | ssh-agent persistence cross-session (CW-B62) | Eliminare il manual-launch passphrase: service-account key dedicata CI no-passphrase (richiede ADR per security trade-off) OR documentare flusso stabile. |

## P4 — Bias residui ereditati (da bias_registry.md, ora archive)

| ID | Bias | Stato ereditato | Azione |
|---|---|---|---|
| **B-40** | CW-B39 | nk_missing learning_path_step path_id 688 rows — pending forensic | Valutare in SDBI Phase 2/Wave 2. |
| **B-41** | CW-B45 | source-vs-target CHECK delta — pending engine improvement | SDBI Phase 4. |
| **B-42** | CW-B50 | reclass IMPORT→REFERENCE_ONLY; correct target authoring deferred | Batch dedicato (era C13). |
| ~~**B-43**~~ | CW-B41 | ✅ **FATTO 2026-05-28**: xos_lib ora file-based (dump→tempfile→`psql -f`), no pipe. bash -n+smoke+mktemp cross-OS OK. Validazione funzionale gated a B-10 (lib non ancora esercitata). | `db/scripts/_lib/cross_os_pipeline.sh`. |

## Candidati MVP-4 futuri (da MVP_4_ROADMAP.md — decisione Enzo)

- stream 2.1 Brownfield Wave 2 · 2.5 MFA multi-kind · 2.7 Mobile + WCAG · visualization renderers (React Flow/Mermaid — gated brand, vedi memory `feedback_brand_before_graph_renderers`).

---

**Regola d'ingaggio CLI autonomo**: ogni azione P1+ parte da un mini-piano evidence-based (grep/read reali, non assunzioni) + atomic commit + test verde + aggiornamento di questo backlog e `SOT_STATE.md`. Nessun push senza ok Enzo. Conflitto con invarianti (§9 SOT_STATE) → fermarsi e chiedere.
