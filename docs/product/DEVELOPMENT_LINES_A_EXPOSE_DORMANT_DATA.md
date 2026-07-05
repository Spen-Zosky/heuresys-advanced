# Development Lines — Serie A: esporre i dati dormienti (dossier di brainstorming)

> **Stato**: PROPOSTO — selezione e priorità = Enzo (PM owns WHAT). Le scelte tecniche di realizzazione = Claude.
> **Provenienza**: atlas S1016 (2026-07-05) — incrocio deterministico `build_atlas.py` (162 tabelle `sys.*` popolate × tabelle referenziate dagli 83 moduli API) + full-sweep 19 agenti (`docs/kb/atlas/ATLAS_CURATED.md`). Ogni numero è **evidenza datata 2026-07-05**, ri-derivabile — non SoT dei conteggi (regola T2).
> **Perimetro**: SOLO esposizione read di dati già presenti (pattern 7-step su tabelle esistenti, zero migration di schema salvo grant permission). Engine nuovi (reward-gate, recompute) e write-path = semi B/C dell'ATLAS_CURATED, fuori da questo dossier.

## 1. La tesi

**41 tabelle `sys.*` popolate non sono referenziate da NESSUN modulo API** (15.051 righe); col secondo anello (toccate ma non esposte: `sys_source_lineage_records` 70.972, `sys_payroll_handoff_records` write-only, `sys_compensation_recommendations` count-only) i dati non raggiungibili da alcun utente superano le **86.000 righe**. La north-star del PRD è "% di entità mappate che generano una decisione tracciabile": ogni riga non esposta è per definizione fuori da quella metrica. Tre giacimenti (evidence, lineage, talent scores) alimentano direttamente il **wedge explainability/AI-Act**, l'unico white-space che la scorecard competitiva giudica difendibile.

## 2. Le linee (tutte componibili e indipendenti — nessuna esclude le altre)

Formato: dati (righe live 2026-07-05) → cosa costruire → vincoli → effort stimato (sessioni CLI; base = modulo read-only 7-step ≈ 0,5 sessione, storico su 83 repliche).

### L1 — La vita dei goal (goals/OKR da testata a storia)
- **Dati**: goal_updates 1.811 · goal_check_ins 1.000 · goal_milestones 1.000 · goal_comments 856 · goal_alignments 100 · goal_templates 40 · okr_check_ins 25 (≈4.8k righe). Oggi il modulo `goals` tocca SOLO `sys_goals` e `okrs` solo okrs+key_results (verificato atlas).
- **Costruire**: sub-risorse read `/v1/goals/:id/{updates,check-ins,milestones,comments}` + `/v1/okrs/:id/check-ins` + alignments/templates list; ESS: timeline del goal in `/me/career` (tab Obiettivi già esistente). UI admin: drill-down su "Analisi Obiettivi".
- **Vincoli**: data-class EVALUATION → `orgGate` (il boot-gate D-51 lo impone da solo); `goal:read:self` già seedato per l'ESS.
- **Effort**: ~1-1,5 (API) + 0,5-1 (UI). **Valore**: trasforma goals/OKR da lista statica a processo vivo.

### L2 — Il layer delle prove (evidence & assessment) ⭐ strategica
- **Dati**: user_assessment_evidence 1.560 · user_learning_evidence 1.434 · continuous_feedback 474 · behavioral_assessments 465 · performance_review_competency_ratings 465 · feedback_360_responses 390 · person_evidence_records 237 · kpi_assessment_results 248 (≈5.3k righe).
- **Costruire**: modulo `evidence` (o estensioni per-modulo) con read per-soggetto e per-score: "perché questo rating/gap/insight" → drill-down dalle pagine insights/gaps/reviews; ESS self-scope ("le mie evidenze").
- **Vincoli**: SENSITIVE (EVALUATION/SKILL) → orgGate `service`, self-scope ESS, peer-isolation I19 già garantita dal resolver.
- **Effort**: ~2-3 (API+UI). **Valore**: è la SOSTANZA del claim "spiegabilità prima dell'accuratezza" (PRD §2.4) — oggi dichiarato, non dimostrabile.

### L0 — Trust Ledger / provenance (secondo anello, si sposa con L2) ⭐ strategica
- **Dati**: `sys_source_lineage_records` **70.972** (mapping_confidence, sdbi_ai_model_id, sdbi_human_approver, content_hash) — oggi toccata solo dal wave-executor in scrittura.
- **Costruire**: read-API `/v1/provenance` (per-record e aggregata per tabella/run) + pannello "Data provenance" (admin) — il tile per `/investors` esiste già come pattern.
- **Vincoli**: PLATFORM/TENANT_ADMIN; nessun dato personale nuovo esposto (metadati di mapping).
- **Effort**: ~1. **Valore**: audit AI-mapping EU AI-Act/GDPR art.22 — deliverable citabile nel GTM.

### L3 — Talent intelligence scores (la 9-box che già esiste)
- **Dati**: talent_scores 154 (potential+performance+band = il substrato 9-box; **NB: `sys_nine_box_grid` NON esiste nel DB — drift del Ledger S-LAT2**) · employee_position_fit_scores 146 · readiness_scores 90 (orizzonte now/1y/2y) · succession_scores 90 · critical_positions 8 · critical_role_coverage_status 8.
- **Costruire**: modulo `talent-review`: matrice 9-box derivata da talent_scores, fit dimensionale, readiness per orizzonte; UI board-ready. Componenti `@heuresys/ui` GIÀ PUBBLICATI e mai usati: SuccessionCard, SkillHeatmap, CareerArc, KgMiniGraph (tier17).
- **Vincoli**: SENSITIVE → orgGate + HR-mandated roles; NO self-view di default (coerenza con D-6 flight-risk — riaprirla è decisione prodotto separata).
- **Effort**: ~1,5-2. **Valore**: talent-review da comitato, feature da demo commerciale.

### L4 — Gap closure (il ciclo che si chiude)
- **Dati**: gap_closure_actions 440 · gap_analysis_results 270 · gap_closure_plans 36.
- **Costruire**: read su plans/actions/results collegate a `/skills` (admin) e `/me/gaps` (ESS self) — oggi il gap è visibile ma il piano di chiusura no.
- **Vincoli**: SKILL data-class → orgGate; self-scope ESS.
- **Effort**: ~1. **Valore**: completa il candidato Tier A del Ledger; time-to-value L&D.

### L5 — Il ponte posizione→learning (quick-win che ripara un buco noto)
- **Dati**: position_learning_requirements 1.791 · skill_learning_mappings 635.
- **Costruire**: `/v1/positions/:id/learning-requirements` + mapping skill→moduli; la pagina **`positions/[id]/learning` è già wired ma vuota** (gap-DATI censito nel health-check S1004) → questa linea la accende.
- **Vincoli**: catalog data-class (orgGate `catalog`).
- **Effort**: ~0,5-1. **Valore**: chiude un finding esistente + input per Capability Academy (seme F).

### L6 — Metrologia KPI
- **Dati**: kpi_measurements 248 · kpi_metric_definitions 243 · kpi_assessment_methods 5 · kpi_weighting_rules 3.
- **Costruire**: sub-read sotto `kpi-definitions` (come si misura, con che pesi, misurazioni storiche).
- **Effort**: ~0,5-1. **Valore**: profondità del dominio KPI già esposto in superficie.

### L7 — Comp & reward in lettura
- **Dati**: variable_pay_calculations 121 · bonus_pools 6 · objective_reward_rules 6 · position_economic_weight 24 · + secondo anello: payroll_handoff_records (write-only oggi!) · compensation_recommendations (solo count).
- **Costruire**: read su calcoli/pool/regole + `/v1/compensation/handoff-records` (audit del ledger scritto e mai letto) + list delle recommendations.
- **Vincoli**: COMPENSATION = la data-class più sensibile → orgGate + I21 (HRMS_MANAGER plenipotenziario).
- **Effort**: ~1. **Valore**: prepara il terreno al reward-gate engine (seme B) e chiude un'anomalia (ledger cieco).

### L8 — Time-off/leave consultivo
- **Dati**: time_off_requests 69 (mai referenziata) · leave_accrual_rules 20 · leave_balance_transactions 20 (nota: time_off_balances 494 è GIÀ letta dal modulo `me`).
- **Costruire**: read admin+ESS di richieste/regole/transazioni — consultazione, NON submission (la submission ferie resta decisione prodotto, cfr. register #23 residuo).
- **Effort**: ~0,5-1. **Valore**: embrione del verticale Time&Attendance (il cantiere evo lo ha completo; advanced ha i dati e zero feature).

## 3. Vincoli trasversali (non negoziabili, già impianti)

- **DoD live E2E** (ADR-0026): ogni linea si chiude con login reale + dato reale a schermo; niente mock.
- **Boot-gate D-51**: ogni read su risorsa sensibile DEVE dichiarare `config.orgGate` o il server non parte — la tassonomia `lib/scope/data-classes.ts` va estesa alle nuove risorse sensibili (evidence, talent, comp).
- Pattern modulo 7-step + atomic commit; permission NUOVE dedicate (`talent:read`, `evidence:read`, …) invece del riuso improprio censito in ATLAS_CURATED §10.
- UI: solo composizione di primitive `@heuresys/ui` (i tier17/tier6 inutilizzati sono il serbatoio naturale); i18n parity; paginazione vera dove le righe superano il limit hardcoded attuale.

## 4. Sequenza raccomandata (raccomandazione Claude — ordinabile a piacere, le linee sono indipendenti)

| Ondata | Linee | Perché prima | Effort cumulato |
|---|---|---|---|
| **W1** | L5 + L1 | quick-win che ripara un gap censito + estensione naturale di moduli esistenti | ~2-3 sessioni |
| **W2** | L2 + L0 | il wedge explainability/AI-Act diventa dimostrabile (GTM/investors) | ~3-4 |
| **W3** | L3 + L4 | talent-review board-ready + ciclo gap chiuso | ~2,5-3 |
| **W4** | L6 + L7 + L8 | completamento profondità dominio | ~2-3 |

Totale se tutto: **~9-13 sessioni CLI**. Ogni ondata è shippabile e dimostrabile da sola.

## 5. Correzioni SoT emerse scrivendo questo dossier (da recepire al prossimo riallineamento Ledger)

1. `sys_nine_box_grid` non esiste nel DB live → S-LAT2 del Ledger va riformulato su `sys_talent_scores`.
2. `sys_time_off_balances` è già esposta via modulo `me` — il gap è solo su requests/rules/transactions.
3. MLCE + Maturity engine esistono da S999 → §7 del Ledger (VRIO/OHI/Ranker "bloccati da MLCE") è superato.

## 6. Prossimo passo

Enzo seleziona le linee/ondate (anche tutte, anche in ordine diverso) → ogni linea scelta diventa un item strutturato nell'Action register di `SOT_BACKLOG.md` (status ACTIVE, priority, effort, doc=questo dossier §Lx) e si parte col pattern 7-step.
