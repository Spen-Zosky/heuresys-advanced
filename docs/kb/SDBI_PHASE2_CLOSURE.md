# SDBI Phase 2 (B-10) — CLOSURE DOC (umbrella terminale)

> **Ruolo**: documento di **chiusura terminale** di B-10 / SDBI Phase 2. Porta ogni macro-area HRMS dello scope originale a **uno stato terminale esplicito** (sul modello del reconciliation registry — "0 UNCLASSIFIED"), così che B-10 cessi di essere un pending vago. Il lavoro genuinamente residuo è scorporato in **una entry roadmap esplicita (B-10b)** con effort e sorgenti misurate, non lasciato dentro l'umbrella.
> **Creato**: 2026-06-05 (S968), evidence-based su query live del registry + row-count reali + F0 triage.
> **SoT**: lo stato vivo resta `docs/kb/SOT_STATE.md` §4 + `sys.v_reconciliation_status`; questo doc è la **mappa terminale** di SDBI. Backlog → `SOT_BACKLOG.md` (B-10 / B-10b). Doctrine → `docs/architecture/adr/0014_*.md` (ACCEPTED).

## TL;DR — verdetto di chiusura

SDBI Phase 2 (scope originale **7-8 macro-aree HRMS** con target schema MISSING, PROMPT 027 / ADR-0014, stima 75-125h) è **chiuso come umbrella**:

- **5 macro-aree = già TERMINALI** (POPULATED o già classificate nel registry): PerformanceReviews, Feedback360, Documents, Compensation-history (assorbita), TalentPool.
- **3 macro-aree = schema target genuinamente MANCANTE** → milestone di modellazione reali, **scorporate in B-10b** (deferred roadmap P3, ~22-27h / ~3 sessioni dedicate): Surveys/Engagement, Mentorship, PredictionsML.
- **ADR-0014 = ACCEPTED** (doctrine, S951); il gate §5 "pilot Goals/OKRs via SDBI" è **moot** (Goals/OKRs popolati via brownfield deterministico, non via pilot SDBI).
- **Infra SDBI shipped**: `db/migrations/000063_sdbi_infra.sql` (audit rule_code dictionary + 4 lineage cols + RUNBOOK/template) + `db/migrations/000065_sdbi_perf_feedback_schema.sql` (slice perf/feedback). La base storica `000036_temp_sdbi_schema.sql` citata da B-10 è **superata**.

Nessuna macro-area resta in stato "pending non etichettato": le 5 fatte sono citate al registry, le 3 reali sono esplicitamente schedulate.

## Mappa terminale delle 8 macro-aree

| # | Macro-area | Stato terminale | Target sys.* + evidenza (live count 2026-06-05) | Note |
|---|---|---|---|---|
| 1 | **PerformanceReviews** | ✅ TERMINALE / POPULATED | `sys_performance_reviews`=161 · `sys_performance_review_competency_ratings` POPULATED · `sys_nine_box_grid`=159 | shipped via slice `000065` |
| 3 | **Feedback360** | ✅ TERMINALE / POPULATED | `sys_feedback_360_responses`=390 · `sys_continuous_feedback`=474 | shipped via slice `000065` (legacy_source feedback_360 / continuous_feedback) |
| 7 | **Documents** | ✅ TERMINALE / POPULATED | `sys_user_documents`=657 (registry POPULATED, legacy_source employee_documents) | metadata-only (no binari), via brownfield path |
| 6 | **Compensation-history** | ✅ TERMINALE / assorbita | `sys_compensation_recommendations`=116 · `sys_variable_pay_calculations`=121 POPULATED; legacy `salary_history`(317)/`salary_bands`(41)/`salary_band_assignments`(264) → `sys_compensation_bands` | **terminale-by-absorption**: nessun target `*_history` dedicato per design; la storia comp è folded nei bands + comp targets. Nessun nuovo schema giustificato. |
| 8 | **TalentPool** | ✅ TERMINALE / registry | `sys_talent_scores`=154 · `sys_succession_scores`=90 · `sys_readiness_scores`=90 POPULATED; `sys_succession_pools`=0 + `sys_successor_candidates`=0 = **NEEDS_DECISION** (registry, muro `job_to_position_bridge`) | NON è nuovo lavoro SDBI: già terminale nel reconciliation registry. Source esiste (talent_pools 24 / succession_candidates 206 / talent_pool_members 40); person-FK risolve 100% via crosswalk `LEGACY_EMP::`, ma la FK posizione NOT NULL non ha crosswalk legacy deterministico (stesso muro `job_to_position_bridge` del ciclo reconciliation). Citato al registry, **non riaperto** qui. |
| 2 | **Surveys/Engagement** | 🟡 DEFERRED-MODELING-STREAM → **B-10b** | 0 tabelle `sys.*` (survey/engagement/pulse/enps) — schema MISSING. Legacy: `engagement_action_plans`=6 + cluster PULSAR (ADR-0014 §1 / PROMPT 027 §1) | nuove `sys.sys_*` (survey defs/responses/eNPS) + Zod + repo/service/route + test + mapping card. ~7-9h. |
| 4 | **Mentorship** | 🟡 DEFERRED-MODELING-STREAM → **B-10b** | 0 tabelle `sys.*` (mentor*) — schema MISSING. Legacy: `mentorship_sessions`=355 + `mentor_match_scores`=30 (F0 triage) | nuove `sys.sys_mentorship_*` (pairings + sessions evidence) + module wiring + test. ~7-8h. |
| 5 | **PredictionsML** | 🟡 DEFERRED-MODELING-STREAM → **B-10b** | 0 tabelle `sys.*` (prediction/churn/ml) — schema MISSING. Legacy: `model_predictions`/`performance_predictions`=267 + `turnover_risk_scores`=267 + `mv_talent_signals`=270 (DERIVED-ANALYTICS) | oltre allo schema, richiede **decisione di derivazione/semantica** (score derivati). Il più alto-giudizio dei tre. ~8-10h. |
| 9 | RecruitingHiring | ⚪ OUT-of-scope (I8) | — | marker-only nello scope originale |
| 10 | Onboarding | ⚪ OUT-of-scope (I8) | — | marker-only nello scope originale |

## Evidenza — registry live (psql `sys.v_reconciliation_status`, 2026-06-05)

```
POPULATED 113 · NO_SOURCE 17 · NEEDS_DECISION 8 · EXCLUDE 5 · REFERENCE_ONLY 3 · IMPORT 1   (0 UNCLASSIFIED)
```

Il registry è il **template zero-residuo** che questa chiusura rispecchia: ogni target SDBI è in uno stato esplicito. Le 5 macro-aree "fatte" sono POPULATED/registry-classified; le 3 reali hanno 0 tabelle `sys.*` (verificato via `information_schema` su pattern survey|engagement|pulse|enps|mentor|prediction|churn|ml_|model_pred = 0 match) → genuinamente MISSING.

## Lavoro residuo reale → B-10b (deferred modeling stream)

Le 3 macro-aree con schema MANCANTE sono **lavoro di modellazione vero**, non doc:

| Area | Sorgente legacy misurata | Effort | Rischio |
|---|---|---|---|
| Surveys/Engagement | `engagement_action_plans`=6 + PULSAR | ~7-9h | MED (schema+module nuovi, 0 test esistenti) |
| Mentorship | `mentorship_sessions`=355 + `mentor_match_scores`=30 | ~7-8h | MED |
| PredictionsML | `model_predictions`/`performance_predictions`=267 + `turnover_risk_scores`=267 + `mv_talent_signals`=270 | ~8-10h | MED-HIGH (derived-analytics → serve regola di derivazione human-authored) |

**Totale**: ~22-27h su ~3 sessioni dedicate. Regola d'ingaggio: ciascuna è una milestone `design→spec→ok→piano→implementa` con checkpoint di modellazione (autorità semantica Enzo), pattern modulo a 7 step + atomic commit + test verde. **NON è bulk-import autonomo.** Tracciata in `SOT_BACKLOG.md` come **B-10b** (P3). Selezionabile come una qualsiasi capability dal menu di session-start.

## ADR-0014 — riconciliazione

- **Status doctrine**: `ACCEPTED` (S951, §3/§7) — invariato. SDBI = meccanismo di estensione schema per sorgenti FUTURE con entità senza target; NON per il legacy esistente (coperto dal brownfield deterministico ADR-0012).
- **§5 acceptance criteria** (pilot Goals/OKRs via SDBI): **moot/superseded** — Goals/OKRs sono POPULATED via il normale brownfield path, non via un pilot SDBI. La via SDBI-pilot non è stata quella presa; il gate §5 non è una precondizione aperta.
- **Implementazione**: slice `000065` ha shippato 4 aree (perf/feedback); il resto è assorbito dal brownfield o scorporato in B-10b. Footnote aggiunto in ADR-0014 §7.

## Cross-ref

ADR-0014 (doctrine) · `SOT_BACKLOG.md` B-10 (umbrella closed) + B-10b (deferred) · `SOT_STATE.md` §4 · `sys.v_reconciliation_status` (registry live) · `db/migrations/000063,000065` · `apps/api/test/sdbi-perf-feedback.integration.test.ts` · F0 triage `qa_artifacts/F0_reconciliation_triage.md`.
