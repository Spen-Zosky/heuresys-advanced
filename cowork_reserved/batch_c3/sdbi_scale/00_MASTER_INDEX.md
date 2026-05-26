# SDBI Scale Plan — 11 macro-aree TRUE GAP — MASTER INDEX

**Doc ID**: `00_MASTER_INDEX`
**Batch**: C3.5
**Author**: Cowork (Claude Opus 4.7)
**Created**: 2026-05-21
**Schema introspection**: LIVE via SSH (sudo -u postgres psql) on heuresys_platform + heuresys_advanced
**Status**: SCALE PLAN — mini-spec format. Full per-area authoring deferred to C4/C5/C6 batches.

---

## §1 — Scope

Le 11 macro-aree elencate sono tutte classificate **Tier D — TRUE GAP** per `cowork_reserved/10_GAPS_ANALYSIS.md` (rich data in `heuresys_platform.public`, ZERO mirror in `legacy_mirror.*`, ZERO target sys.* schemas adeguati). Sono il workload più voluminoso del SDBI scale pipeline post Goals/OKRs pilot.

**Volume aggregato live (2026-05-21)**: ~26k+ rows totali da importare nel SDBI scale (subset).

**Caratteristica TRUE GAP critical**:
1. Nessuna delle 11 macro-aree ha tabelle in `legacy_mirror.*` (verified live).
2. Le source tables esistono ricche in `heuresys_platform.public` (verified live row counts).
3. La pipeline `extract-wave1-legacy.sh` deve essere ESTESA prima di ogni transform.

**Effort assumption**: per ogni macro-area, l'effort tipico è 4-8h pilot completo (analogous to Goals/OKRs which took ~6h cumulative through 4 batches).

---

## §2 — Live row counts (heuresys_platform.public) — 2026-05-21

| # | Macro-area | Lexicon | Top-5 source tables (rows) | Total ~rows |
|---|---|---|---|---|
| 1 | Performance Reviews + Calibration | GOKMER | performance_reviews 292 · performance_predictions 267 · performance_trends 202 · calibration_sessions 86 · calibration_discussions 60 (+ calibration_results 50) | ~957 |
| 2 | Recruiting + Hiring | H2R | applications 150 · interviews 120 · candidates 100 · recruiting_candidates 96 · requisitions 50 (+ recruiting_offers 30) | ~546 |
| 3 | Onboarding + Preboarding | H2R | preboarding_tasks 180 · onboarding_tasks 153 (+ onboarding_plans 0 source-empty + onboarding_buddy_assignments 0 + onboarding_feedback 0) | ~333 |
| 4 | Surveys + Engagement + Wellbeing | PULSAR | survey_responses 4482 · engagement_survey_responses 1327 · pulse_checks 1145 · wellbeing_checkins 1142 · engagement_surveys 18 (+ surveys 11 + survey_questions 31) | ~8156 |
| 5 | Time + Leave + Attendance | ITLAB | employee_attendance 5237 · employee_overtime 383 · employee_time_off_balances 501 · employee_time_off_requests 99 | ~6220 |
| 6 | Feedback systems | PULSAR | continuous_feedback 729 · feedback_360 714 · engagement_feedback 685 · recognition 485 · feedback_requests 246 | ~2859 |
| 7 | Mentorship | TALPIPE | mentorship_sessions 355 · mentorships 124 · mentor_match_scores 30 | ~509 |
| 8 | Predictions + ML | EPRA | model_predictions 267 · turnover_risk_scores 267 · predictive_models 16 | ~550 |
| 9 | Compensation extension | SMERTO | salary_history 317 · bonus_allocations 244 · merit_recommendations 208 · equity_grants 12 | ~781 |
| 10 | Documents + Signatures | DGOV | employee_documents 1089 · document_acknowledgments 250 · signature_requests 24 | ~1363 |
| 11 | Talent Pool ext | TALPIPE | career_recommendations 192 · talent_pool_members 40 · succession_plans 31 · career_paths 32 · talent_pools 24 | ~319 |

**Grand total**: ~22.6k rows (drift ↑ from 11_STRATEGIC_REFORMULATION estimate ~26k — likely due to recount of feedback_responses 0 + onboarding subset NULLs).

---

## §3 — Priority ranking (HRMS criticality × effort × dependencies)

### Tier 1 — High HRMS value + manageable scope (3 picks)

| Rank | Macro-area | HRMS value | Volume | Dep blocking | Effort estimate |
|---|---|---|---|---|---|
| 1 | **#5 Time + Leave + Attendance** | CRITICAL (payroll dependency, ITLAB CCNL) | LARGE 6220 | BLOCKED by lm.employees_core (already extracted C3.2) + lm.users | 8-12h pilot |
| 2 | **#1 Performance Reviews + Calibration** | HIGH (talent dev, GOKMER cycle) | MEDIUM 957 | BLOCKED by lm.users + lm.employees_core (C3.2 ok) | 6-10h pilot |
| 3 | **#9 Compensation extension** | HIGH (SMERTO completion, ties to existing sys_compensation_bands 75 rows) | LOW 781 | BLOCKED by lm.employees + sys_compensation_bands (already 75) | 4-6h pilot |

### Tier 2 — High HRMS value + medium scope (4 picks)

| Rank | Macro-area | HRMS value | Volume | Dep | Effort |
|---|---|---|---|---|---|
| 4 | **#4 Surveys + Engagement + Wellbeing** | HIGH (PULSAR core) | LARGE 8156 | BLOCKED by lm.employees + tenant_id | 8-12h pilot |
| 5 | **#2 Recruiting + Hiring** | MEDIUM-HIGH (H2R pipeline) | MEDIUM 546 | INDEPENDENT (candidates table is greenfield) | 6-10h pilot |
| 6 | **#3 Onboarding + Preboarding** | MEDIUM-HIGH (H2R closure) | LOW 333 | DEPENDS on Recruiting (#2) for FK candidate_id → application_id | 4-6h pilot (post-#2) |
| 7 | **#6 Feedback systems** | MEDIUM (PULSAR cluster) | MEDIUM 2859 | BLOCKED by lm.users + lm.employees | 6-8h pilot |

### Tier 3 — Lower HRMS criticality OR specialized (4 picks)

| Rank | Macro-area | HRMS value | Volume | Dep | Effort |
|---|---|---|---|---|---|
| 8 | **#11 Talent Pool ext** | MEDIUM (TALPIPE) | LOW 319 | BLOCKED by lm.users + lm.employees | 4-6h pilot |
| 9 | **#7 Mentorship** | MEDIUM (TALPIPE) | LOW 509 | BLOCKED by lm.users | 4-6h pilot |
| 10 | **#10 Documents + Signatures** | MEDIUM (DGOV) | MEDIUM 1363 | BLOCKED by lm.users + lm.employees + filesystem refs deferred | 6-8h pilot |
| 11 | **#8 Predictions + ML** | LOW (EPRA, post-MVP) | LOW 550 | DEPENDS on all other features as input | 4-6h pilot (LAST) |

---

## §4 — Recommended order for C4/C5/C6 execution

### Wave 2 (C4 batch — Tier 1, 3 macro-aree)

1. **#5 Time/Leave/Attendance** (CCNL critical, ITLAB lexicon foundational)
2. **#1 Performance Reviews + Calibration** (GOKMER cycle completion)
3. **#9 Compensation extension** (SMERTO, builds on existing sys_compensation_bands)

Rationale: each independently pilotable post C3.2 users+employees extraction. Total ~18-28h effort. Establishes 3 lexicon domains (ITLAB+GOKMER+SMERTO).

### Wave 3 (C5 batch — Tier 2, 4 macro-aree)

4. **#4 Surveys/Engagement/Wellbeing** (PULSAR foundation)
5. **#2 Recruiting/Hiring** (H2R foundation)
6. **#3 Onboarding/Preboarding** (H2R closure, depends on #2)
7. **#6 Feedback systems** (PULSAR cluster)

Rationale: 4 + 6 same lexicon (PULSAR), grouped for synergy. 2 + 3 sequential (H2R chain). Total ~24-36h.

### Wave 4 (C6 batch — Tier 3, 4 macro-aree)

8. **#11 Talent Pool ext** (TALPIPE)
9. **#7 Mentorship** (TALPIPE)
10. **#10 Documents/Signatures** (DGOV)
11. **#8 Predictions/ML** (EPRA, LAST after all features exist)

Rationale: 8 + 9 same lexicon (TALPIPE). 11 last (uses outputs of all prior). Total ~18-26h.

**Grand total scale**: ~60-90h cumulative across 3 waves (vs 11_STRATEGIC_REFORMULATION §1.3 D Tier estimate 100-140h Opt1 — consistent with optimization via reusable Goals/OKRs pilot pattern).

---

## §5 — Cross-cutting dependencies

| Dependency | Status | Resolution |
|---|---|---|
| `legacy_mirror.users` (auth resolution) | ✅ extracted C3.2 (CW-B27 mitigation) | Available for all 11 macro-aree |
| `legacy_mirror.employees_core` (HR identity) | ✅ extracted C3.2 | Available for all 11 macro-aree |
| `legacy_mirror.tenants` (multi-tenant FK) | UNKNOWN — verify before each wave | Add to `extract-wave1-legacy.sh` if missing (likely already there since Wave 1) |
| `brownfield.tenant_id_mappings` | ✅ exists (migration 000033) | Reuse pattern, extend if needed for new tenants |
| `extract-wave1-legacy.sh` extension | REQUIRED before each macro-area | Each wave adds 3-7 new source tables to dump+restore |
| Target sys.* schema design | NEW migrations 000040+ | 11 macro-aree × ~3-8 tables each = ~50-80 new sys.* tables to design |
| SDBI engine performance | OK at 5k rows (Goals scale), unverified at 25k+ | Survey_responses 4482 will stress test; benchmark in #4 wave |
| `update_at` auto-managed trigger | Apply per migration consistency | Each new table includes `BEFORE UPDATE ... sys_set_updated_at()` trigger |

---

## §6 — Risks (cross-macro-area)

| Risk | Macro-areas affected | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Tenant FK resolution gaps for legacy rows lacking tenant_id | All 11 | MEDIUM | HIGH | Pre-flight tenant audit per wave, use brownfield.tenant_id_mappings fallback |
| Survey_responses 4482 rows performance bottleneck | #4 | LOW | MEDIUM | Batch the load (chunks 500), monitor sys.sys_source_lineage_records UQ index pressure |
| Documents + Signatures — file references not portable to advanced | #10 | HIGH | LOW (metadata only) | Skip blob refs, embed paths in jsonb metadata only |
| ML predictions are time-bound — stale model_predictions 267 might be re-generated post-MVP | #8 | HIGH | LOW (data is enrichment, not core) | Defer to last wave + flag as "snapshot at import time" |
| H2R pipeline FK chain Recruiting→Onboarding requires sequential execution | #2 → #3 | HIGH | MEDIUM | Wave 3 explicit order: #2 first, then #3 within same batch C5 |
| Mentorship + Talent Pool overlap in TALPIPE lexicon | #7 + #11 | MEDIUM | LOW | Group in same batch C6, share lexicon migration |
| pgvector embedding columns (perf reviews, employees) | #1, #2 | LOW | LOW | SKIP transform (already pattern in existing batches) |
| 50-80 new sys.* tables = migration sequence inflation | All | MEDIUM | MEDIUM | Group multiple sys.* per migration where lexicon-coherent (1 per macro-area average) |

---

## §7 — Pilot pattern reusable from Goals/OKRs

For each macro-area, the C4/C5/C6 batch deliverable mirrors Goals/OKRs C1.8 structure:

```
batch_c<N>/macro_area_<NN>_<name>/
├── 00_README.md
├── 01_SOURCE_DISCOVERY.md         (LIVE introspect platform tables)
├── 02_TARGET_SCHEMA_PROPOSAL.md   (sys.* tables + FK chain)
├── 03_migrations_000XXX.sql       (1-2 new migrations for sys schema + extract sh extension)
├── 04_PHASE3_TEMP_SDBI_DDL.md     (staging during transform)
├── 05_PHASE5_CONSOLIDATION_PLAN.md
└── 10_mapping_cards/
    └── *.md (1 per source-target pair, ~5-10 per macro-area)
```

**Confidence**: HIGH — pattern proven through 4 batches (C1.8 Goals/OKRs + C1.4 MIRROR GAP + C2.2 cascade + C3 SDBI lineage).

---

## §8 — Files in this directory

| File | Purpose |
|---|---|
| `00_MASTER_INDEX.md` | This file. Ranking + dependencies + risks. |
| `01_PerformanceReviews.md` | Mini-spec macro-area #1 (Tier 1 / Rank 2) |
| `02_RecruitingHiring.md` | Mini-spec macro-area #2 (Tier 2 / Rank 5) |
| `03_OnboardingPreboarding.md` | Mini-spec macro-area #3 (Tier 2 / Rank 6) |
| `04_SurveysEngagementWellbeing.md` | Mini-spec macro-area #4 (Tier 2 / Rank 4) |
| `05_TimeLeaveAttendance.md` | Mini-spec macro-area #5 (Tier 1 / Rank 1) |
| `06_FeedbackSystems.md` | Mini-spec macro-area #6 (Tier 2 / Rank 7) |
| `07_Mentorship.md` | Mini-spec macro-area #7 (Tier 3 / Rank 9) |
| `08_PredictionsML.md` | Mini-spec macro-area #8 (Tier 3 / Rank 11, LAST) |
| `09_CompensationExt.md` | Mini-spec macro-area #9 (Tier 1 / Rank 3) |
| `10_DocumentsSignatures.md` | Mini-spec macro-area #10 (Tier 3 / Rank 10) |
| `11_TalentPoolExt.md` | Mini-spec macro-area #11 (Tier 3 / Rank 8) |
