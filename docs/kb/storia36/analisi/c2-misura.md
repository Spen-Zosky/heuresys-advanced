# C2 storia36 — Misura dello stato esistente del ciclo performance (RTL Bank)

- **Data misura**: 2026-07-28 · DB `heuresys_advanced` via tunnel :5433 (READ-ONLY, solo SELECT/`\d`)
- **Tenant RTL**: `86ba7a65-217f-48ba-8ce5-5c09b40a66b0` · **Finestra C2**: 2023-08-01 .. 2026-07-26
- **Baseline utenti**: RTL_BANK = **158 utenti, tutti ACTIVE/STANDARD** (non 161: HEURESYS tenant ha 4 ACTIVE + 1 DEACTIVATED; totale piattaforma 163). Le % di copertura sotto sono su 158.
- Comandi sorgente: `scratchpad/c2_measure.sql` + `c2_followup.sql` (sessione a9179f79); output integrale in `c2_measure_out.txt`.

## 0. Convenzioni trasversali (verificate su tutte le righe)

- **Natural key** = `<ENTITY>::<tenant_uuid>::<legacy_id>` dove `legacy_id` = id della riga nella tabella legacy (`metadata->>'legacy_id'`, es. `legacy_table: public.goals` / `public.performance_reviews`). Verificato 1067/1067 goals, 1000/1000 check-ins, 161/161 reviews. Il suffisso NON è il PK della riga advanced (0/N match con l'id): è provenienza brownfield.
  - Prefissi osservati: `GOAL::`, `GOAL_CHECK_IN::`, `MILESTONE::`, `GOAL_UPDATE::`, `GOAL_COMMENT::`, `GOAL_TEMPLATE::` (variante `::<nome>::<uuid>`), `GOAL_ALIGNMENT::`, `PERF_REVIEW::`, `FEEDBACK_360::`, `CONTINUOUS_FEEDBACK::`.
  - Unique index sempre su `(tenant_id, natural_key)`.
- **PK**: uuid `gen_random_uuid()` su ogni tabella; FK tenant → `sys_tenancies` ON DELETE RESTRICT (CASCADE su assessments/behavioral/kpi).
- **Metadata jsonb** porta la provenienza: `{legacy_id, legacy_table, legacy_owner_id/legacy_employee_id, ...}`.
- Tabelle SENZA natural key (solo PK uuid): `sys_assessments`, `sys_assessment_results`, `sys_behavioral_assessments`, `sys_kpi_assessment_results` (idempotenza da gestire diversamente per il C2, es. metadata o chiave logica subject+periodo+dimensione).
- Tutto il ciclo vive nel solo tenant RTL (eccezione: 4 assessments nel tenant Heuresys System).

## 1. sys_goals — 1.067 righe (attese 1.067 ✓)

| Misura | Valore |
|---|---|
| Stati | IN_PROGRESS 653 · ON_TRACK 212 · COMPLETED 100 · NOT_STARTED 84 · AT_RISK 18 (CHECK ammette anche BLOCKED/CANCELLED, assenti) |
| Tipi | INDIVIDUAL 264 · OBJECTIVE 248 · PERFORMANCE 102 · DEVELOPMENT 89 · CUSTOMER 63 · COMPLIANCE 60 · EFFICIENCY 59 · SECURITY 38 · LEADERSHIP 32 · FINANCIAL 32 · PROJECT 29 · TECHNICAL 28 · SALES 23 |
| Priorità | MEDIUM 650 · HIGH 357 · LOW 60 (CRITICAL assente) |
| Range date | start 2025-01-01..2026-09-03 · due 2025-03-31..2026-12-02 · created_at 2025-06-05..2026-04-11 (154 giorni distinti → inserimento organico/simulato, non one-shot) |
| Subject | 159 distinti (157 RTL + 2 cross-tenant); **435 goal SENZA subject** (goal aziendali/org: 314 nel 2025, 121 nel 2026; tipi OBJECTIVE 246, INDIVIDUAL 108, ...) |
| Owner | `goal_owner_user_id` NULL su TUTTE le 1067 righe |
| Per anno | 2025: 944 goal / 158 subject (≈4 a testa: 155 utenti×4, 1×5, 2×3, 1×1) · 2026: 123 goal ma **solo 2 subject individuali** (maria.colombo 1, pietro.barbieri 1; gli altri 121 sono null-subject) |
| Template/parent | `goal_template_id` 0 · `goal_parent_goal_id` 0 · `goal_completed_at` 0 (anche sui 100 COMPLETED!) |
| Sample | "Migliorare performance team del 15%" (PERFORMANCE, IN_PROGRESS, 29%, 2025-01-01→2025-06-30, weight 0.35) · "Implementare nuovo processo operativo" (PROJECT, LOW, weight 0.25) — titoli italiani, weight frazionari |

**Buco C2**: zero goal 2023H2 e 2024; il ciclo 2026 individuale è vuoto (2/158 utenti = 1,3%).

## 2. sys_goal_check_ins — 1.000 righe (attese 1.000 ✓) — DEGENERE

- Date 2026-01-02..2026-05-06, su 314 goal; created_at in SOLI 2 giorni (2026-02-28, 2026-05-13) → 2 batch di backfill.
- **`check_in_subject_user_id` = `admin@heuresys.com` su TUTTE le 1.000 righe** (cross-tenant! subject = creatore, non il subject del goal). I goal sottostanti appartengono a 151 subject reali: 0/1000 righe con subject coerente col goal.
- Stati: ON_TRACK 717 · AT_RISK 140 · AHEAD 75 · BLOCKED 57 · COMPLETED 11. Confidence 3 tipico. Note template ("Aggiornamento periodico: attività in corso...").
- Distribuzione per goal: 1..6 check-in (94 goal ne hanno 2, 56 ne hanno 4, 55×1, 55×5, 32×6, 22×3).
- **Buco C2**: nessun check-in 2023H2/2024/2025; copertura utenti reale 2026 = 0,6% (1 solo subject, sbagliato). Il C2 NON deve replicare il pattern subject=admin.

## 3. Satelliti goal — milestones 1.000 · updates 1.811 · comments 856 · templates 40 · alignments 100

| Tabella | Misure chiave |
|---|---|
| sys_goal_milestones | 1.000 su 400 goal; PENDING 782 / COMPLETED 218; target_date SOLO 2026-03-15..2026-07-26 (nessuna milestone storica) |
| sys_goal_updates | 1.811 su 1.065 goal; tipi PROGRESS 519 / STATUS_CHANGE 325 / NOTE 323 / MILESTONE 322 / BLOCKER 322; created 2025-03-04..2026-04-16; **author_user_id NULL su tutte** |
| sys_goal_comments | 856 su 820 goal; 165 private; created 2025-03-03..2026-03-03; **author NULL su tutte** |
| sys_goal_templates | 40, tutti RTL, attivi, goal_type OBJECTIVE; NK variante `GOAL_TEMPLATE::<tenant>::<nome lower>::<uuid>` (es. "achieve revenue target" ×4 con uuid diversi → 10 nomi × ~4 copie, 40 NK distinti); **mai referenziati dai goal** (usage_count non verificato ma goal_template_id=0) |
| sys_goal_alignments | 100, tutti SUPPORTS (altri 3 tipi CHECK assenti) |

## 4. sys_performance_reviews — 161 righe (attese 161 ✓)

| Misura | Valore |
|---|---|
| Tipi×stati | ANNUAL/COMPLETED 157 · ANNUAL/IN_PROGRESS 2 · MID_YEAR/COMPLETED 2 (QUARTERLY/PROBATION/PROJECT assenti) |
| Periodi | **2024-01-01..2024-12-31: 155 review/155 subject** (il ciclo annuale 2024 è l'unico completo) · 2024H1 MID_YEAR 2 (1 subject + 1 null) · 2024H2 ANNUAL 2 (1 subject + 1 null) · 2025 ANNUAL 1 · 2026 ANNUAL 1 |
| Rating (scala CHECK 1.00-5.00) | overall: min 1.96 / max 5.00 / avg 3.48 (161/161 valorizzati) · goal_achievement avg 3.46 (159) · competency avg 3.48 (159) · **self_rating 0** · **calibrated_rating 0** |
| Flusso timestamps | submitted_at 155 · acknowledged_at 155 · **self_submitted / manager_submitted / calibrated / finalized / self_completed / shared / calibrated_by / finalized_by: TUTTI 0** · self_assessment_status = NOT_STARTED su 161/161 |
| 9-box | potential_rating (LOW/MED/HIGH) 161 · performance_box 161 · potential_box 161 (tutti popolati) |
| Testi | strengths 159 · manager_comments 159 · employee_comments 0 |
| Attori | 156 subject distinti (2 review null-subject: la MID_YEAR 2024H1 e la ANNUAL 2024H2 IN_PROGRESS) · 27 reviewer distinti (max 7 review a testa: sara.greco, gabriele.colombo, paolo.castaldi, ... = popolazione manager) · 4 review senza reviewer |
| **Reviewer = manager reale?** | Catena `assignment ACTIVE → position → position_reports_to → assignment ACTIVE`: **142/161 (88%) il reviewer È il manager di linea**; 15 mismatch; 2 senza catena; ~2 con reviewer null ma catena presente |
| Cicli per subject | 154 utenti×1 · 1×2 · 1×3 |
| Provenienza | metadata `legacy_table: public.performance_reviews`, NK = legacy_id; created_at in 3 soli giorni (2025-01-10..2026-04-11) |
| Child | sys_performance_review_competency_ratings = 465 righe (=155×3? coincide con behavioral 465) |

**Buco C2**: esiste SOLO il ciclo annuale 2024. Mancano interamente: 2023H2 (ciclo 2023), ciclo 2025 (1 review su 158 = 0,6%), ciclo 2026 in corso (1 review). Il flusso self-assessment/calibration/finalization non è mai stato esercitato (colonne a 0) — la macchina a stati C2.2 dovrà popolarlo.

## 5. sys_assessments (611 RTL + 4 system) + results 1.560 + methods 5

- **Semantica reale: skill assessment (ESCO), NON performance assessment.**
- Kind: **SELF 312** (156 subject ×2, metadata `esco_uri`, nessun periodo, COMPLETED) · **MANAGER 299** (115 subject, metadata `{skill_name, assessed_level, required_level, gap, method: test|peer|manager}`, COMPLETED).
- **Enigma period_start 0 vs period_end 303 SPIEGATO**: `assessment_period_start` è NULL su tutte; `assessment_period_end` è valorizzato SOLO sui MANAGER: 299 RTL + 4 tenant system = 303. Range 2025-06-06..2025-12-02.
- `assessment_method_id` NULL su 611/611 — **il catalogo methods (5 righe: RATING, NARRATIVE, EVIDENCE_BASED, PEER_360, MANAGER_DIRECT; descrizioni vuote) non è mai collegato**; il "method" vive nel metadata dei MANAGER.
- Nessun legame con reviews (nessuna FK, nessun campo); il legame col mondo review è solo temporale (H2-2025).
- Results: 1.560 = **312 SELF × 5 dimensioni fisse** (ABILITY, ATTITUDE, KNOWLEDGE, BEHAVIOR, SKILL — una ciascuna); score 2.00-5.00 avg 4.73; narrative vuote; assessor NULL; recorded_at tutto 2026-05-30 (bulk). I 299 MANAGER non hanno results.
- created_at: tutto 2026-05-30 (1 giorno → seed bulk).
- **Buco C2**: nessun assessment con period 2023/2024/2026; copertura 2025 = 115/158 (72,8%) solo MANAGER-kind.

## 6. sys_feedback_360_responses — 390 righe

- Relationship×status: MANAGER/COMPLETED 155 · SELF/COMPLETED 155 · PEER/COMPLETED 80 (DIRECT_REPORT/SKIP_LEVEL/EXTERNAL assenti; PENDING/IN_PROGRESS/DECLINED assenti).
- 155 target distinti (1 MANAGER + 1 SELF a testa; PEER su ~80), 156 reviewer, anonimato true, rating 390/390 avg 3.45 (1-5).
- **`response_review_id` NULL su 390/390** — il 360 esiste ma NON è agganciato ad alcuna review (FK disponibile, mai usata).
- completed_at 2025-10-03..2025-12-02; created_at 2025-09-03..2025-12-01 (89 giorni → distribuzione organica simulata). Un solo ciclo: H2-2025.
- **Buco C2**: nessun ciclo 360 per 2023H2, 2024, 2026; quello 2025 è orfano dalle review.

## 7. sys_behavioral_assessments 465 · sys_continuous_feedback 474 · sys_kpi_assessment_results 248

| Tabella | Misure |
|---|---|
| behavioral | 465 = **155 utenti × 3 competenze fisse** (Professional Conduct, Technical Execution, Domain Knowledge); score avg 69.50 (**scala 0-100**, non 1-5); recorded_at TUTTO 2026-06-03 (snapshot un-giorno, no storia); no NK |
| continuous_feedback | 474; tipi CONSTRUCTIVE 138 / SUGGESTION 117 / COACHING 104 / RECOGNITION 58 / PRAISE 57; 156 sender → 149 receiver; 146 legati a un goal; created 2025-08-04..2026-04-05 (121 giorni, organico); 2026 = 1 sola riga |
| kpi_assessment_results | 248; 138 utenti; 9 KPI; **periodi solo annuali interi**: 2024 (142 righe/97 utenti) + 2025 (106/106); score avg 89.79 (percent-like); position_id NULL su tutte; method NULL; computed_at 2026-06-03 (bulk); no NK |

## 8. MAPPA DEI BUCHI (distinct subject / 158 attivi, per bucket finestra C2)

| Tabella (data guida) | 2023H2 | 2024 | 2025 | 2026 (→07-26) |
|---|---|---|---|---|
| goals (start_date) | **0%** | **0%** | **100%** (158) | 1,3% (2) |
| check_ins (date) | **0%** | **0%** | **0%** | 0,6% (1, e sbagliato: admin) |
| reviews (period_end) | **0%** | **98,7%** (156) | **0,6%** (1) | 0% (1 aperta) |
| assessments (period_end) | **0%** | **0%** | 72,8% (115) | **0%** |
| f360 (completed) | **0%** | **0%** | 98,1% (155) | **0%** |
| behavioral (recorded) | **0%** | **0%** | **0%** | 98,1% (155, snapshot 1 giorno) |
| cont_feedback (created) | **0%** | **0%** | 94,3% (149) | 0,6% (1) |
| kpi_results (period_end) | **0%** | 61,4% (97) | 67,1% (106) | **0%** |

Lettura per ciclo annuale che il C2 (backfill 2023H2 + 2024 + 2025 + 2026 in corso) deve riempire:
- **Ciclo 2023 (H2)**: NIENTE esiste in nessuna tabella. Da creare da zero: goal, check-in, review ANNUAL 2023, eventuale 360/KPI.
- **Ciclo 2024**: esistono SOLO review annuali (155) + KPI (97 utenti). Mancano: goal 2024, check-in, 360, assessments, continuous feedback → le review 2024 con `review_goal_achievement_rating` valorizzato non hanno alcun goal sottostante.
- **Ciclo 2025**: esistono goal (100%), 360 (155), skill-assessment MANAGER (115), cont. feedback (149), KPI (106) — **manca la review annuale 2025** (1/158) e i check-in: il ciclo è ricco a monte ma senza chiusura.
- **Ciclo 2026 in corso**: quasi vuoto — 2 goal individuali, check-in degeneri (subject=admin), 1 review aperta, behavioral snapshot 2026-06-03. Da costruire: goal 2026 per tutti, check-in corretti, review IN_PROGRESS/self-assessment avviate.
- **Trasversale**: il flusso di stato reviews (self→manager→calibration→finalization→shared) non è MAI stato percorso (tutte le colonne a 0); nessuna tabella collega 360→review (FK vuota) né assessments→methods (FK vuota).

## 9. Sorprese / difetti dell'esistente (da NON replicare nel C2)

1. **check_in_subject_user_id = admin@heuresys.com (cross-tenant) su 1000/1000**, in contrasto con i 151 subject reali dei goal.
2. **Utenti RTL attivi = 158, non 161/162** come da doc di progetto (drift da segnalare a SOT_STATE).
3. `goal_owner_user_id`, `update_author_user_id`, `comment_author_user_id`, `assessment_result_assessor_user_id` NULL al 100% — l'attribuzione degli attori manca ovunque tranne reviews/f360/cont_feedback.
4. I 100 goal COMPLETED hanno `goal_completed_at` NULL (incoerenza stato/timestamp).
5. sys_assessments = skill-assessment ESCO, non performance: il naming inganna; il periodo esiste solo come period_end sui MANAGER (303 totali = 299 RTL + 4 system).
6. Reviews 2024: rating goal_achievement presente ma zero goal 2024 nel DB (rating senza substrato).
7. f360 mai linkato a reviews; methods catalogo mai linkato ad assessments; templates mai linkati ai goal — tre FK progettate e mai usate.
8. Reviewer = manager di linea nell'88% (142/161) via `position_reports_to`; 15 eccezioni + 4 review senza reviewer.
9. Scale eterogenee: reviews/f360/assessment_results 1-5 · behavioral 0-100 · kpi score percent-like (avg 89.79).
10. Milestone target_date confinate a 2026-03-15..2026-07-26 (997 su 1000 goal senza storia milestone reale); alignments monotono SUPPORTS.
