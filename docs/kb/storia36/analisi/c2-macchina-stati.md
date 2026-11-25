# C2 — Macchina a stati del ciclo performance (dal CODICE)

> Derivato da `apps/api/src/modules/{goals,okrs,assessments,assessment-methods,assessment-results,me,evidence,talent-review}`,
> `packages/shared/src/schemas/{goals,okrs,assessments,assessment-results}.ts`,
> migrazioni `000017`, `000037`, `000065`, seed SDBI `db/seeds/brownfield/sdbi/{perf_feedback,goals_pilot}/03_phase5_consolidation.sql`,
> e DB live (tunnel :5433, sola lettura). Data analisi: 2026-07-28.

---

## 0. Mappa entita' → modulo → tabella

| Entita' | Tabella | Modulo API | Write path API? |
|---|---|---|---|
| Performance review | `sys.sys_performance_reviews` | **NESSUN modulo CRUD** — solo read in `me` (F3a) | **NO** (solo pipeline SDBI) |
| Competency rating (child review) | `sys.sys_performance_review_competency_ratings` | read via `evidence` (kind COMPETENCY_RATING) | NO |
| Feedback 360 | `sys.sys_feedback_360_responses` | read via `evidence` (kind FEEDBACK_360) | NO |
| Continuous feedback | `sys.sys_continuous_feedback` | read via `evidence` (kind CONTINUOUS_FEEDBACK) | NO |
| Nine-box | `sys.sys_nine_box_grid` (**VIEW** su reviews, I9) + `sys.sys_talent_scores` (talent-review) | `talent-review` (`talent:read`) | NO (VIEW; talent_scores da seed reconciliation) |
| Assessment run | `sys.sys_assessments` | `assessments` | SI (POST/PATCH, **no DELETE**) |
| Assessment result | `sys.sys_assessment_results` | `assessment-results` | SI (POST only, **append-only immutabile**) |
| Assessment method | `sys.sys_assessment_methods` | `assessment-methods` | NO (catalogo 5 metodi seed 000017) |
| Goal | `sys.sys_goals` | `goals` | SI (CRUD completo) |
| Goal updates/check-ins/milestones/comments/alignments/templates | `sys.sys_goal_*` (000037) | `goals` sub-route **READ-only** (#26 S1018) | **NO** (solo seed) |
| OKR | `sys.sys_okrs` | `okrs` | SI (CRUD) |
| OKR key results / check-ins | `sys.sys_okr_key_results`, `sys.sys_okr_check_ins` | `okrs` **READ-only** | NO |

NB: il modulo `engagement-feedback` serve `sys.sys_engagement_feedback` (voce dell'engagement/clima, NON il feedback di performance) — fuori dal ciclo performance.

---

## 1. sys_performance_reviews — stati, transizioni, timestamp

### 1.1 Stati (solo CHECK a DB — `sys_pr_status_check`, mig 000065)
`DRAFT → IN_PROGRESS → SUBMITTED → CALIBRATED → FINALIZED → COMPLETED | CANCELLED` — **sequenza NON enforced da nessun codice**: non esiste service/route che scriva la tabella. L'unico enforcement e' il CHECK sull'insieme dei valori. Default `'DRAFT'`. Secondo status: `review_self_assessment_status` CHECK `NOT_STARTED|IN_PROGRESS|COMPLETED` (default NOT_STARTED).

`review_type` CHECK: `ANNUAL|MID_YEAR|QUARTERLY|PROBATION|PROJECT` (default ANNUAL).

### 1.2 Timestamp di lifecycle (8 colonne — chi le scrive)
Colonne: `review_self_submitted_at, review_manager_submitted_at, review_calibrated_at, review_finalized_at, review_self_review_completed_at, review_shared_at, review_submitted_at, review_acknowledged_at` (tutte timestamptz nullable).
**Nessuna route le scrive.** L'unico writer e' il seed SDBI (`perf_feedback/03_phase5_consolidation.sql` righe 67-90) che le copia 1:1 dal legacy. Popolazione live (161 righe):

| status | n | self_sub | mgr_sub | calib | fin | shared | ack | submitted | self_done |
|---|---|---|---|---|---|---|---|---|---|
| COMPLETED | 159 | 0 | 0 | 0 | 0 | 0 | **155** | **155** | 0 |
| IN_PROGRESS | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

⇒ Il pattern osservato "indistinguibile" e': **COMPLETED ⇒ `review_submitted_at` + `review_acknowledged_at` valorizzati (non tutti: 155/159), gli altri 6 timestamp NULL**. `review_calibrated_by_user_id` e `review_finalized_by_user_id` = NULL su tutte le righe; `review_reviewer_user_id` valorizzato su 157/161; `review_self_rating` sempre NULL.

### 1.3 Rating e box (CHECK a DB)
- `review_overall_rating`, `review_goal_achievement_rating`, `review_competency_rating`, `review_self_rating`, `review_calibrated_rating` → numeric(3,2) CHECK **1.00–5.00** (o NULL). `review_pre_calibration_rating` numeric(3,1) stesso range.
- `review_performance_box`, `review_potential_box` → int CHECK **1..3**; `review_potential_rating` CHECK `LOW|MEDIUM|HIGH`.
- `sys_pr_period_ordered`: `review_period_end >= review_period_start` (entrambe NOT NULL, `date`).
- `sys_pr_updated_after`: `updated_at >= created_at`. Trigger `sys_set_updated_at` BEFORE UPDATE (solo se qualcuno la aggiornasse).

### 1.4 Read path (chi la vede)
- `/v1/me/performance` (`me/repository.loadPerformance`) — self, ordina `review_period_end DESC`, espone type/status/period/ratings/box. Perm `assessment:read:self`? no — e' sotto il gruppo `/me` (self floor I17).
- `/v1/me/analytics` — `latestPerformanceRating` = overall dell'ultima review per period_end.
- `sys.sys_nine_box_grid` VIEW: SOLO righe `review_status='COMPLETED'` AND entrambi i box NOT NULL; proietta `review_metadata->>'legacy_review_cycle_id'` come `review_cycle_id` (oggi **NULL su tutte le righe** — jsonb_strip_nulls l'ha rimosso al seed).
- `evidence` (kind COMPETENCY_RATING) legge i child ratings.

### 1.5 Child: sys_performance_review_competency_ratings
- FK `rating_review_id → review_id ON DELETE CASCADE`; UQ **(rating_review_id, rating_competency_name)** oltre a UQ (tenant, natural_key).
- `rating_ksaba_dimension` CHECK `KNOWLEDGE|SKILL|BEHAVIOR|ATTITUDE` (nullable); self/manager rating 1.00–5.00; `rating_weight` default 1.0. Mutabile (trigger updated_at) ma nessun write path API. 465 righe live (~3 per review, tutte created_at 2026-02-28 = data seed).

---

## 2. sys_assessments / sys_assessment_results — l'unica macchina a stati SCRITTA dal codice

### 2.1 Stati e transizioni
- `assessment_status` CHECK (000017): `OPEN | IN_PROGRESS | COMPLETED | CANCELLED`. Default `OPEN`. Zod `AssessmentStatusSchema` identico.
- `assessment_kind` CHECK: `MANAGER | THREE_SIXTY | PEER | SELF | EXTERNAL`. Default `MANAGER`.
- **Il service NON enforca alcun ordine di transizione**: `PATCH /v1/assessments/:id` accetta qualunque status→status (anche COMPLETED→OPEN). Unico vincolo di ritiro: **niente DELETE — si chiude con `status='CANCELLED'`** (commento esplicito in service.ts).
- FK validation nel service: `subjectUserId` deve esistere e appartenere al tenant risolto (`404` user mancante / `403 USER_NOT_IN_TENANT`); `methodId` se fornito deve esistere (404).
- **Nessun gate org-axis in scrittura**: un MANAGER puo' creare un assessment su QUALUNQUE utente del proprio tenant (il gate ADR-0027 F3 e' solo in lettura).

### 2.2 Timestamp scritti da ogni transizione
- INSERT: `created_at=now()` (default), `created_by=<actor.userId>` (parametro esplicito), `updated_at=now()` default.
- UPDATE: il repository imposta **esplicitamente** `updated_at=now()` e `updated_by=<actor.userId>` (in piu' c'e' il trigger `sys_assessments_set_updated_at`). **Non esistono colonne di lifecycle per-stato** (nessun completed_at): la storia degli stati NON e' registrata.
- Notifiche best-effort: create → `ASSESSMENT_REQUEST` al subject (actionUrl `/me/assessments`); insert result → `MANAGER_FEEDBACK_READY` al subject.

### 2.3 sys_assessment_results (append-only)
- Solo `POST /v1/assessment-results` (+list/get). **Nessun UPDATE/DELETE — audit trail immutabile** (commento service). Una riga per dimensione valutata.
- Tenant propagato dal parent assessment (mai dal body). `assessorUserId` opzionale, validato in-tenant (`403 ASSESSOR_NOT_IN_TENANT`).
- `recorded_at` default now() (non impostabile dal body!). `score numeric(5,2)` **senza CHECK a DB**; Zod al POST: `z.number().min(0).max(100)`. **Dato live: min 2.00 / max 5.00 / avg 4.73 → la scala usata in pratica e' 1–5** nonostante lo Zod ammetta 0–100 (trappola: un backfill a scala 0-100 sarebbe legale ma statisticamente alieno).

### 2.4 Dato live (per riconoscere il pattern del seed esistente)
615 assessments, tutti `COMPLETED`, tutti created_at 2026-05-30, `created_by` NULL, `method_id` NULL, `period_start` NULL, period_end ≤ 2025-12-02. Metadata: `assessment_subtype` = `SKILL_PROFILE` (312, kind SELF, con esco_uri/composite_score/legacy_profile_id) oppure skill-assessment legacy (303, kind MANAGER, con legacy_assessment_id/method/required_level/assessed_level/gap/skill_name). 1560 results (tutti stesso giorno). **`sys_assessments` NON ha natural key** → nessuna idempotenza a DB: un backfill deve auto-garantirla (es. via metadata key).

### 2.5 Catalogo metodi
`sys_assessment_methods` read-only: codici CHECK `RATING|NARRATIVE|EVIDENCE_BASED|PEER_360|MANAGER_DIRECT` (5 righe seed 000017, UQ su code).

---

## 3. sys_goals — stati, progress, check-in flow

### 3.1 Stati (CHECK `sys_goals_status_check`, 000037 — Zod identico)
`NOT_STARTED | IN_PROGRESS | ON_TRACK | AT_RISK | BLOCKED | COMPLETED | CANCELLED` — default NOT_STARTED. **Nessun enforcement di transizione nel service** (PATCH libero). `goal_type` CHECK 13 valori (`OBJECTIVE` default, `INDIVIDUAL`,`TECHNICAL`,`SALES`,`CUSTOMER`,`PERFORMANCE`,`PROJECT`,`FINANCIAL`,`SECURITY`,`LEADERSHIP`,`DEVELOPMENT`,`EFFICIENCY`,`COMPLIANCE`); `goal_priority` CHECK `LOW|MEDIUM|HIGH|CRITICAL` (default MEDIUM).

### 3.2 Progress e completamento
- `goal_progress_percent` int CHECK 0–100 (default 0), Zod `.int().min(0).max(100)`.
- **`goal_completed_at` e' scritto SOLO se il PATCH passa esplicitamente `completedAt`** — nessun automatismo su status→COMPLETED. Dato live coerente: **0/100 goal COMPLETED hanno completed_at** (colonna di fatto morta). `startDate`/`dueDate` `::date`, CHECK `sys_goals_dates_ordered`.
- updated_at: gestito SOLO dal trigger `sys_goals_set_updated_at` (il repo non lo setta).
- INSERT API: `goal_natural_key = 'API::' || randomUUID()`. Le righe brownfield usano `GOAL::<canonical_tenant_id>::<legacy_id>`.

### 3.3 Check-in flow (e satelliti) — **READ-only via API**
Route GET `/v1/goals/:id/{updates,check-ins,milestones,comments,alignments,timeline}` + `/v1/goals/templates` (#26 S1018) e self `/v1/me/goals/:goalId/timeline`. **Nessuna route POST**: i check-in/updates/milestones nascono solo dal seed SDBI (`goals_pilot`). Vincoli DB per un backfill:
- `sys_goal_check_ins` (immutabile, no updated_at): `check_in_date` date default CURRENT_DATE; `check_in_new_progress` NOT NULL CHECK 0-100; `check_in_previous_progress` NULL o 0-100; `check_in_status_update` CHECK `ON_TRACK|AHEAD|AT_RISK|BLOCKED|COMPLETED` (≠ enum stati goal!); `check_in_confidence_level` NULL o CHECK 1-5; `check_in_subject_user_id` NOT NULL; natural key `GOAL_CHECK_IN::<tenant>::<id>` UQ per tenant.
- `sys_goal_updates` (immutabile): `update_type` CHECK `PROGRESS|STATUS_CHANGE|MILESTONE|BLOCKER|NOTE` (default PROGRESS); coppie previous/new per progress e status; `update_attachments` jsonb `[]`.
- `sys_goal_milestones` (mutabile, trigger): status CHECK `PENDING|IN_PROGRESS|COMPLETED|MISSED|CANCELLED`, weight default 0, target_date nullable.
- `sys_goal_comments` (mutabile): `comment_is_private` default false — la lettura dei privati e' **author-only** salvo scope org `all|tenant` (HR mandate/platform); i manager subtree NON li vedono.
- `sys_goal_alignments`: CHECK `SUPPORTS|CONTRIBUTES_TO|DERIVED_FROM|DEPENDS_ON`, `sys_ga_no_self`, **UQ (source_goal_id, aligned_goal_id)**, weight default 100.
- `sys_goal_templates`: soft-delete (`template_deleted_at IS NULL` filtrato in lista), i18n overlay ADR-0029 su name/description.
- Tutti i satelliti portano `*_tenant_id` denormalizzato: deve combaciare col tenant del goal padre.

### 3.4 Autorizzazione lettura (ADR-0027 F3 — helper unico `loadReadableGoal`)
- Lista: filtro `goal_subject_user_id = ANY(allowlist) OR goal_subject_user_id IS NULL` per scope subtree/self (i goal senza subject sono tenant-visible).
- Get/sub-risorse: `canReadGoal` — tenant match + se subject-bound `canReadOrgTarget` (classe EVALUATION, catena org transitiva); fallimento = **404 no-leak**.
- Org-axis = catena posizioni: `sys_user_position_assignments` + `sys_positions.position_reports_to_position_id` (lib/scope/org.ts). Solo ruoli manageriali espliciti hanno subtree (F1); HR-mandate (TENANT_ADMIN/HRMS_MANAGER) tenant-wide; PLATFORM all.

### 3.5 Incoerenze del dato live (NON pattern da imitare ciecamente)
- 84 goal NOT_STARTED con progress fino a 74; 18 AT_RISK con progress 100.
- Solo **110/314** goal con check-in hanno `goal_progress_percent` = new_progress dell'ultimo check-in.
- COMPLETED ⇒ progress=100 (coerente, 100/100).
- goal_updates min created_at 2025-03-04 ma goals min 2025-06-05 (updates precedenti al goal!).

---

## 4. sys_okrs — stati e check-in

- `okr_status` CHECK `DRAFT|ACTIVE|ACHIEVED|MISSED|CANCELLED|ARCHIVED` (default ACTIVE — insert API default `ACTIVE`, non DRAFT). Nessun enforcement transizioni. `okr_okr_type` CHECK `COMPANY|DEPARTMENT|TEAM|INDIVIDUAL`; `okr_period_type` CHECK `QUARTERLY|MONTHLY|YEARLY|CUSTOM`; `okr_period_start/end` NOT NULL CHECK ordinati; `okr_fiscal_quarter` 1-4.
- `okr_overall_progress` numeric default 0, scrivibile via PATCH. `confidenceLevel` NON scrivibile via API (mai in insert/update) — morta lato API.
- `sys_okr_key_results` e `sys_okr_check_ins` **READ-only**: KR status CHECK `ON_TRACK|...` (default ON_TRACK), confidence 1-5 default 3; check-in `check_in_scope` CHECK `KEY_RESULT|OKR_AGGREGATE` + CHECK di coerenza scope↔key_result_id (`sys_okr_ci_scope_kr_coherent`).
- Fiscal year/quarter settabili solo alla create (non nel PATCH — `fiscalYear/fiscalQuarter` assenti da UpdateOkrBody): semi-morte.
- Lista filtrata per org-scope su `okr_owner_user_id` (NB: qui i NULL-owner NON passano il filtro allowlist, a differenza dei goals — `okr_owner_user_id = ANY(...)` senza ramo IS NULL).
- Dato live: 20 OKR tutti ACTIVE, 25 check-in.

---

## 5. Feedback-360 e continuous feedback (nessun modulo — solo evidence)

- `sys_feedback_360_responses` (immutabile): `response_status` CHECK `PENDING|IN_PROGRESS|COMPLETED|DECLINED|EXPIRED` (default PENDING); `response_relationship_type` CHECK `SELF|PEER|MANAGER|DIRECT_REPORT|SKIP_LEVEL|EXTERNAL`; rating 1.00-5.00; `response_is_anonymous` default true; FK opzionale `response_review_id → sys_performance_reviews` (**oggi tutte NULL? non verificato il join, ma la FK esiste ON DELETE SET NULL**). Live: 390 righe tutte COMPLETED con completed_at; mix SELF 155 / MANAGER 155 / PEER 80 (≈ 1 self + 1 manager per target + peer sparsi).
- Lettura: solo `evidence` module — se `response_is_anonymous` l'assessor e' oscurato (`CASE WHEN ... THEN NULL`). `recorded_at` = coalesce(completed_at, created_at).
- `sys_continuous_feedback` (immutabile): `feedback_type` CHECK `PRAISE|CONSTRUCTIVE|SUGGESTION|COACHING|RECOGNITION` (default PRAISE); `feedback_visibility` CHECK `PRIVATE|MANAGER|TEAM|PUBLIC` (default PRIVATE — live: 100% PRIVATE); `feedback_message` NOT NULL; FK `feedback_related_goal_id → sys_goals`. **Colonne morte: `feedback_acknowledged` (tutte false) + `feedback_acknowledged_at`** — nessun path di ack. Lettura evidence: filtro `feedback_is_private = false` se non includePrivate.

---

## 6. Chi PUO' scrivere cosa (RBAC live, `sys_auth_role_permissions`)

| Permesso | Ruoli (live DB) | Route |
|---|---|---|
| `assessment:create` | HRMS_MANAGER, **MANAGER**, PLATFORM_ADMIN, TENANT_ADMIN | POST /v1/assessments, **POST /v1/assessment-results** (stesso permesso!) |
| `assessment:update` | HRMS_MANAGER, PLATFORM_ADMIN, TENANT_ADMIN (MANAGER escluso) | PATCH /v1/assessments/:id |
| `assessment:read` | CEO, HRMS_MANAGER, MANAGER, PLATFORM_ADMIN, TENANT_ADMIN | GET (org-gated F3) |
| `assessment:read:self` | PLATFORM_ADMIN, READ_ONLY, TENANT_ADMIN, USER | GET /v1/me/assessments |
| `goal:create/update/delete` | HRMS_MANAGER, PLATFORM_ADMIN, TENANT_ADMIN | POST/PATCH/DELETE /v1/goals |
| `goal:read` | BLUEPRINT_MANAGER, HRMS_MANAGER, MANAGER, PLATFORM_ADMIN, PROCESS_OWNER, TENANT_ADMIN | GET /v1/goals* |
| `goal:read:self` | PLATFORM_ADMIN, READ_ONLY, TENANT_ADMIN, USER | GET /v1/me/goals(+timeline) |
| `okr:create/update/delete` | HRMS_MANAGER, PLATFORM_ADMIN, TENANT_ADMIN | POST/PATCH/DELETE /v1/okrs |
| `okr:read` | BLUEPRINT_MANAGER, HRMS_MANAGER, MANAGER, PLATFORM_ADMIN, PROCESS_OWNER, TENANT_ADMIN | GET /v1/okrs* |
| `talent:read` | (nine-box, fit, readiness, succession — read-only) | GET /v1/talent-review/* |

**Reviewer legittimo**: per gli assessment e' l'attore con `assessment:create` (il MANAGER e' incluso; `created_by` lo registra; `assessorUserId` sul result e' libero purche' in-tenant). Per le performance review (senza write path) il dato importato dice: `review_reviewer_user_id` = **manager di linea via catena posizioni in 146/157 casi** (93%) — invariante da rispettare in un backfill. Self floor (I17): l'utente vede le proprie review/assessments/goals via `/me`, ma **non scrive nulla** del ciclo performance (l'unico self-write e' `POST /me/skills/self-assessments`, che pero' scrive `sys_user_assessment_evidence` — dominio skill, non questo).

Tutte le route di scrittura hanno `app.verifyCsrf`. HRMS_MANAGER = plenipotenziario dati (memoria di progetto): e' l'unico ruolo non-admin che scrive goals/okrs.

---

## 7. Colonne MORTE (mai scritte dal codice) e CALCOLATE

**Mai scritte da nessuna route API** (scritte solo dal seed SDBI, o mai):
- `sys_performance_reviews`: TUTTE (nessun write path). In particolare mai valorizzate nemmeno dal seed nel dato live: `review_self_submitted_at`, `review_manager_submitted_at`, `review_calibrated_at`, `review_finalized_at`, `review_self_review_completed_at`, `review_shared_at`, `review_calibrated_by_user_id`, `review_finalized_by_user_id`, `review_self_rating`, `review_calibrated_rating` (0/161), `review_pre_calibration_rating`.
- `sys_goals`: `goal_completed_at` (0 righe anche su COMPLETED), `goal_tags` (insert API non li passa → default `[]`), `goal_custom_fields` (non esposta a Zod), `goal_template_id` scrivibile solo alla create.
- `sys_okrs`: `okr_confidence_level`, `okr_created_by_user_id` (insert API non lo passa!), `okr_tags`; `okr_fiscal_year/quarter` solo alla create.
- Satelliti goal/okr + f360 + continuous_feedback + competency_ratings: intere tabelle senza write path.
- `sys_continuous_feedback.feedback_acknowledged{,_at}`: morte anche nel dato.
- `sys_assessments.assessment_method_id`: scrivibile ma NULL su 615/615 righe live.

**Calcolate / derivate (mai da scrivere in un backfill)**:
- `sys.sys_nine_box_grid` = VIEW su reviews (`COMPLETED` + entrambi i box) con etichette Star/High Performer/.../Risk da CASE su (performance_box, potential_box).
- `updated_at` via trigger `sys.sys_set_updated_at` su tabelle mutabili (reviews, ratings, goals, milestones, comments, templates, okrs, key_results, assessments).
- `/me/analytics.latestPerformanceRating` = overall dell'ultima review per period_end.

---

## 8. Vincoli impliciti per un backfill SQL "indistinguibile"

1. **Natural key**: pattern seed = `<PREFIX>::<canonical_tenant_id>::<legacy_id>` con UQ (tenant_id, natural_key). Prefissi osservati: `PERF_REVIEW`, `PERF_COMP_RATING`, `FEEDBACK_360`, `CONTINUOUS_FEEDBACK`, `GOAL`, `GOAL_CHECK_IN`, `GOAL_UPDATE` (+ milestones/comments/alignments analoghi). Le righe create dall'API usano invece `API::<uuid4>` (solo goals/okrs). Tenant canonico RTL live: `86ba7a65-217f-48ba-8ce5-5c09b40a66b0`. Un backfill "da import" deve usare il pattern `<PREFIX>::<tenant>::<uuid>`; id deterministici → `uuid_generate_v5` (RFC-4122, MAI `md5()::uuid` — memoria di progetto).
2. **`sys_assessments` non ha natural key** → idempotenza da costruire in proprio (es. `WHERE NOT EXISTS` su metadata key), e nessun vincolo UQ subject/period da rispettare.
3. **Scale rating**: reviews/f360/competency = numeric(3,2) CHECK **1.00–5.00**; box 1..3; `assessment_result_score` senza CHECK ma **in pratica 1–5** (Zod della route ammette 0–100 — non usare 0–100 se si vuole essere indistinguibili); goal progress int 0–100; confidence 1–5.
4. **CHECK temporali**: `updated_at >= created_at` (reviews, ratings, goals, milestones, comments, templates, okrs, KR); `period_end >= period_start` (reviews, okrs); `goal_due_date >= goal_start_date`. Con created_at storici, settare updated_at ≥ created_at (il seed usa `COALESCE(t.updated_at, t.created_at, now())`).
5. **Event log immutabili** (f360, continuous_feedback, goal_check_ins, goal_updates, goal_alignments, okr_check_ins, assessment_results): niente updated_at — non aggiungere ne' aspettarsi trigger.
6. **Pattern di stato osservato per le review**: COMPLETED ⇒ `submitted_at`+`acknowledged_at` valorizzati (155/159; 4-6 righe senza = tolleranza dell'import per reviewer/employee non risolti), altri 6 timestamp NULL, calibrated_by/finalized_by NULL, self_rating NULL, `review_self_assessment_status` (COMPLETED per la maggioranza — verificare distribuzione prima del seed). ANNUAL su anno solare (01-01→12-31), MID_YEAR su semestre. **Max 1 review per (subject, period)** — non enforced a DB ma vero nel dato.
7. **Reviewer** = manager di linea (catena `sys_user_position_assignments` → `sys_positions.position_reports_to_position_id`) nel 93% dei casi; metadata con `legacy_id`, `legacy_table`, `legacy_employee_id`, `legacy_reviewer_id` (jsonb_strip_nulls). Un backfill che vuole mimetizzarsi con l'import DEVE popolare metadata di provenienza analoghi; uno che simula scritture API su assessments deve invece settare `created_by`/`updated_by`.
8. **FK utente ON DELETE SET NULL** ovunque (I14): subject/reviewer nullable sulle reviews; su `sys_assessments` invece subject NOT NULL ON DELETE CASCADE.
9. **Notifiche**: le scritture API su assessments/results emettono notifiche (`ASSESSMENT_REQUEST`, `MANAGER_FEEDBACK_READY`); un backfill SQL non le emette → per essere indistinguibile da righe "da import" va bene, da righe "da API" servirebbero anche le righe notifica.
10. **UQ child**: una sola competency rating per (review, competency_name); un solo alignment per coppia goal.
11. **Coerenza catena check-in**: il dato esistente e' lasco (solo 110/314 goal allineati all'ultimo check-in; NOT_STARTED con progress>0). Decidere policy: replicare la lassita' o essere coerenti (raccomandato: coerenti — la lassita' esistente e' un difetto del seed pilota, non una convenzione).
12. **Tenant denormalizzato sui satelliti** (check_in_tenant_id, update_tenant_id, ...) = tenant del padre.
13. `sys_goal_check_ins.check_in_subject_user_id` NOT NULL → per goal senza subject usare l'owner o il soggetto reale del check-in.

---

## 9. Ciclo / campagna

**Non esiste una tabella ciclo** (nessuna `sys_review_cycles`; zero occorrenze di `review_cycle` nel codice app). La "campagna" e' una **convenzione di periodo**: `(review_period_start, review_period_end)` NOT NULL — anno solare per ANNUAL (155×2024, 1×2025, 1×2026), semestri per MID_YEAR. L'unico vestigio di ciclo e' `review_metadata->>'legacy_review_cycle_id'`, proiettato dalla VIEW nine-box come `review_cycle_id`, ma **NULL su tutte le 161 righe live** (il legacy non lo valorizzava / strip_nulls). Anche assessments e OKR usano periodi espliciti (`assessment_period_start/end` nullable; `okr_period_type` + `okr_fiscal_year/quarter`).

**La UI non raggruppa per anno**: `/me` → `performance-tab.tsx` mostra una lista piatta di card ordinate per `review_period_end DESC` (ordinamento fatto dalla query in `me/repository.loadPerformance`), titolo = tipo review + data periodEnd. Un backfill multi-anno appare quindi come card successive in ordine cronologico inverso — il "raggruppamento per anno" emerge solo dal fatto che i periodi sono anni solari.

---

## 10. Sintesi macchine a stati (quadro)

```
PERFORMANCE REVIEW (solo dati, nessun codice di transizione):
  DRAFT → IN_PROGRESS → SUBMITTED → CALIBRATED → FINALIZED → COMPLETED   (CHECK only)
                                                          ↘ CANCELLED
  timestamp REALI usati dall'import: submitted_at, acknowledged_at (solo su COMPLETED)
  nine-box: visibile solo se COMPLETED + performance_box + potential_box

ASSESSMENT (API-driven, transizioni libere):
  OPEN → IN_PROGRESS → COMPLETED     PATCH senza vincoli d'ordine
      ↘ CANCELLED (unico "delete")   results append-only (immutabili) sul parent

GOAL (API-driven, transizioni libere):
  NOT_STARTED → IN_PROGRESS → ON_TRACK/AT_RISK/BLOCKED → COMPLETED (progress=100)
             ↘ CANCELLED            completed_at solo se passato esplicitamente (di fatto mai)
  check-ins/updates/milestones: read-only via API, popolati solo da seed

OKR (API-driven):
  DRAFT → ACTIVE → ACHIEVED/MISSED → ARCHIVED | CANCELLED   (insert API default ACTIVE)
  KR e check-ins read-only

FEEDBACK 360 (solo dati): PENDING → IN_PROGRESS → COMPLETED | DECLINED | EXPIRED
CONTINUOUS FEEDBACK (solo dati): nessuno stato; ack morto
```
