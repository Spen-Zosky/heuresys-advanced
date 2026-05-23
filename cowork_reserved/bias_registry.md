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

---

## §3 — Next available

**Next available**: `CW-B52`

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

- **Total catalogati**: 51 bias (CW-B17 → CW-B51)
- **Mitigated**: 32 (+CW-B49 X10 engine patch, +CW-B51 X11 inline SKIPPED)
- **Reflexive (pattern memo only)**: 6 (B25, B30, B40, B42, B44, B47)
- **Standardized**: 2 (B29 migration convention, cross-OS pipeline B28)
- **Documented + partial mitigation**: 1 (B50 X11 reclass — correct target authoring deferred to C13)
- **Pending forensic / spec minor**: 3 (B39, B41 xos_lib update, B43 pattern note)
- **Pending engine improvement**: 1 (B45 source-vs-target CHECK delta into SDBI Phase 4)

---

*End bias_registry.md — SoT cross-batch*
