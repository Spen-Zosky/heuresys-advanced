# TASK B — Analisi CODICE cluster C4 (learning / training / certifications)

Data analisi: 2026-07-28 · DB live via tunnel :5433 (sola lettura) · repo `D:\heuresys-advanced` @ main (222f5203)

---

## 1. Moduli API coinvolti (apps/api/src/modules/)

| Modulo | Tabelle toccate (repository.ts) | Prefix | Scrive? |
|---|---|---|---|
| `learning-modules` | `sys.sys_learning_modules` | `/v1/learning-modules` | CRUD completo |
| `learning-paths` | `sys.sys_learning_paths` (+ EXISTS su `sys_learning_path_steps`) | `/v1/learning-paths` | CRUD completo |
| `learning-path-steps` | `sys.sys_learning_path_steps` (+ JOIN paths, EXISTS modules) | `/v1/learning-path-steps` | CRUD completo |
| `learning-gaps` | `sys.sys_learning_gaps` + read `sys_gap_closure_actions`/`sys_gap_closure_plans`/`sys_gap_analysis_results` (#30 S1018) | `/v1/learning-gaps` | CRUD sui gap; SOLO READ su closure/analysis |
| `training-initiatives` | `sys.sys_training_initiatives` (+ scope check su `sys_learning_modules`, `sys_users`) | `/v1/training-initiatives` | Create/Update. **NO DELETE by design** (ritiro = status CANCELLED) |
| `me` (ESS) | `sys.sys_user_learning_assignments` (list+insert), `sys.sys_user_certifications` (list+insert), `sys.sys_learning_gaps` (read self) | `/v1/me/learning`, `/v1/me/learning/enrollments`, `/v1/me/certifications`, `/v1/me/gaps` | INSERT-only (enrollment self, certification self). **Nessun UPDATE/DELETE self** |
| `evidence` (#27 S1018) | `sys.sys_user_learning_evidence` (branch LEARNING della UNION a 9 rami) + `sys_learning_gaps` come score-source `LEARNING_GAP` | `/v1/evidence/subject/:userId`, `/v1/evidence/for-score` | **READ-ONLY** |
| `positions` (#25 A/L5) | read `sys_position_learning_requirements` (+nome path) e coverage moduli via `sys_skill_learning_mappings` | `/v1/positions/:id/learning-requirements`, `/v1/positions/:id/learning-modules` | **READ-ONLY** |
| `dashboard` | count su `sys_learning_paths`, `sys_learning_gaps` (widget + trend `learningGaps` su `learning_gap_detected_at`) | `/v1/dashboard/widgets` | READ-ONLY |
| `brownfield-wave-executor` | engine/transform-compiler referenzia `sys_learning_modules/paths/path_steps/user_certifications` (pipeline ingestion storica OLDDB) | n/a | writer storico (import event-sourced) |

### Tabelle DB del cluster (11) e loro writer effettivi

| Tabella | Righe live | Writer API | Writer seed |
|---|---|---|---|
| `sys_learning_modules` | 987 (845 `OLDDB::course_modules::*`, 60 `CRS-*`, ~82 banking/nativi) | learning-modules CRUD | mig 000061 (rehome), seed 37, `seed_banking_learning_catalog.sql` (BANK-LM, uuid v5) |
| `sys_learning_paths` | 4667 | learning-paths CRUD | wave executor (import storico, created_at legacy 2025-12→2026-04) |
| `sys_learning_path_steps` | 124 (20 path) | learning-path-steps CRUD | seed 37 |
| `sys_training_initiatives` | **0** | training-initiatives Create/Update | nessuno |
| `sys_learning_gaps` | 270 | learning-gaps CRUD + | seed 20 (F4) |
| `sys_user_learning_assignments` | 1990 | me `insertEnrollment` (self) | seed 15 (F3) |
| `sys_user_learning_evidence` | 1434 | **NESSUNO** (evidence è read-only) | seed 38 (unico writer) |
| `sys_skill_learning_mappings` | 662 | **NESSUNO** | seed 39 + seed banking (uuid v5 `bank-slm:`) |
| `sys_position_learning_requirements` | 1791 | **NESSUNO** (positions bridge read-only) | seed 11 |
| `sys_user_certifications` | 477 (154 utenti) | me `insertMyCertification` (self, ESS-11) | rtl-rebuild 06 (420 righe, 2026-05-30) + `seed_comp_dates.sql` (57 righe IVASS/EFPA/OCF, 2026-07-21) |
| (satellite gap: `sys_gap_closure_actions/plans`, `sys_gap_analysis_results`) | — | read-only #30 | — |

---

## 2. Route e permessi (RBAC live, `sys_auth_role_permissions`)

### Admin CRUD
| Endpoint | Verbo | Permesso | Ruoli titolari (live DB) |
|---|---|---|---|
| `/v1/learning-modules`, `/v1/learning-paths`, `/v1/learning-path-steps` GET | GET | `learning:read` | BLUEPRINT_MANAGER, CEO, HRMS_MANAGER, MANAGER, PLATFORM_ADMIN, PROCESS_OWNER, READ_ONLY, TENANT_ADMIN, USER |
| idem POST / PATCH / DELETE | write | `learning:create/update/delete` | HRMS_MANAGER, PLATFORM_ADMIN, TENANT_ADMIN |
| `/v1/training-initiatives` GET/GET:id | GET | `training_initiative:list` / `:read` | 9 ruoli (come learning:read) |
| `/v1/training-initiatives` POST/PATCH | write | `training_initiative:create/update` | HRMS_MANAGER, PLATFORM_ADMIN, TENANT_ADMIN. **Nessuna route DELETE** |
| `/v1/learning-gaps` GET (+ `/summary`, `/closure-plans`, `/analysis-results`, `/:id/closure-actions`) | GET | `gap_analysis:read` | CEO, HRMS_MANAGER, MANAGER, PLATFORM_ADMIN, TENANT_ADMIN — con **allow-list org ADR-0027 F3** per MANAGER (test `learning-gaps-scope`) |
| `/v1/learning-gaps` POST/PATCH/DELETE | write | `gap_analysis:create/update/delete` | HRMS_MANAGER, PLATFORM_ADMIN, TENANT_ADMIN |
| `/v1/evidence/*` | GET | `evidence:read` | BLUEPRINT_MANAGER, HRMS_MANAGER, MANAGER, PLATFORM_ADMIN, PROCESS_OWNER, TENANT_ADMIN |
| `/v1/positions/:id/learning-*` | GET | `position:read` | (bridge #25, read-only) |

### ESS self (modulo `me`, I17 floor)
| Endpoint | Permesso | Ruoli |
|---|---|---|
| GET `/v1/me/learning` | `learning:read:self` | PLATFORM_ADMIN, READ_ONLY, TENANT_ADMIN, USER |
| POST `/v1/me/learning/enrollments` | `learning:enroll:self` | PLATFORM_ADMIN, TENANT_ADMIN, USER (no READ_ONLY) |
| GET `/v1/me/certifications` | `certification:read:self` | PLATFORM_ADMIN, READ_ONLY, TENANT_ADMIN, USER |
| POST `/v1/me/certifications` | `certification:upload:self` | PLATFORM_ADMIN, TENANT_ADMIN, USER |
| GET `/v1/me/gaps` (+ `/gaps/closure`) | `gap_analysis:read:self` | PLATFORM_ADMIN, READ_ONLY, TENANT_ADMIN, USER |

Tutte le route write hanno `app.verifyCsrf` + `requirePermission` (pattern standard 13-step chain).

### Scope/visibilità nei service
- **learning-modules / learning-paths**: modello global+tenant. `isGlobal=true` creabile SOLO da PLATFORM (`ForbiddenError GLOBAL_LEARNING_*`); non-platform pinned a `isGlobal=false` + proprio tenant. Edit di riga GLOBAL vietato ai non-platform (`GLOBAL_LEARNING_EDIT_FORBIDDEN`).
- **learning-path-steps**: visibilità derivata dal path padre via JOIN.
- **training-initiatives**: sempre tenant-scoped (NOT NULL); PLATFORM deve passare `body.tenantId`; `ensureModuleUsable` (modulo global o stesso tenant), `ensureFacilitatorInTenant` (facilitator stesso tenant, PLATFORM user con tenant NULL rifiutato); dup-code → 409 `TRAINING_INITIATIVE_CODE_CONFLICT`.
- **learning-gaps**: tenant-scoped + `userIdAllowList` org-axis (ADR-0027 F3): lista vuota ⇒ short-circuit a `{items:[],total:0}`; `/summary` (severity distribution, C4 #42) usa lo STESSO filtro scope — mai descrive gap non listabili.
- **me**: self-scope duro (`selfActor(req)`), `requireTenant` per enrollment/cert.

---

## 3. Macchine a stati (enrollment→progress→completion?)

**NON esiste una macchina a stati implementata. Solo domini CHECK + insert.**

- `sys_user_learning_assignments.user_learning_assignment_status` — CHECK a 6 valori: `ASSIGNED | IN_PROGRESS | COMPLETED | OVERDUE | WAIVED | CANCELLED`. **Nel codice non esiste NESSUN UPDATE di questa tabella** (grep `UPDATE sys.sys_user_learning_assignments` = 0 hit in apps/ e db/). L'API ESS inserisce sempre `'ASSIGNED'` hardcoded (`insertEnrollment`, me/repository.ts:1043) con `assigned_by = self`. Le transizioni ASSIGNED→IN_PROGRESS→COMPLETED **non hanno alcun endpoint**: gli stati avanzati esistono solo perché il seed 15 li importa dal legacy (`completed→COMPLETED, in_progress→IN_PROGRESS, enrolled→ASSIGNED`, most-advanced-wins per (user,path)). `OVERDUE`/`WAIVED`/`CANCELLED`: 0 occorrenze nei dati, 0 writer. Distribuzione live: COMPLETED 1525 · IN_PROGRESS 299 · ASSIGNED 166.
- `sys_training_initiatives.training_initiative_status` — CHECK `PLANNED | OPEN | IN_PROGRESS | COMPLETED | CANCELLED`, default PLANNED. Il PATCH accetta **qualunque salto** (nessuna validazione di transizione: COMPLETED→PLANNED passa). Doctrine "no DELETE, retire via CANCELLED" è solo commento/schema, non enforcement.
- Completion "vera" = riga in `sys_user_learning_evidence` (completed_at + score + certificate_uri) — ma è **scrivibile solo da seed**, nessuna API la produce. Il ciclo enrollment(ULA) → evidence(completamento) non è collegato da codice: sono due popolazioni indipendenti (ULA da `course_enrollments`+`learning_path_enrollments` path-centric; evidence da completamenti course-centric).
- `sys_learning_gaps.learning_gap_severity` — CHECK `LOW|MEDIUM|HIGH|CRITICAL` default MEDIUM; nel seed derivata dal match%: `<50 CRITICAL, <70 HIGH, <85 MEDIUM, else LOW`. Nessuna transizione, PATCH libero.

## 4. Shape Zod (packages/shared/src/schemas/)

- `learning-modules.ts`: `kind` enum (`COURSE|MICRO_LESSON|LAB|WORKSHOP|CERTIFICATION_PREP|COACHING`, default COURSE), `delivery` (`SELF_PACED|INSTRUCTOR_LED|BLENDED|ON_THE_JOB`, default SELF_PACED), `durationMinutes` 0..100000 nullable, `isGlobal` default false, `metadata` record default {}. Update: NO code (immutabile), NO isGlobal.
- `learning-paths.ts`: code/name/description/targetOutcome/isGlobal/metadata. Update senza code/isGlobal.
- `learning-path-steps.ts`: pathId+moduleId+`ordinal` (smallint), `isPrerequisiteFor: uuid[]` (jsonb), unico modulo per step.
- `training-initiatives.ts`: `DateOnlySchema` regex `YYYY-MM-DD` per start/end; capacity 0..10000 nullable; `tenantId` opzionale (solo PLATFORM).
- `learning-gaps.ts` (via repo): required/currentProficiency varchar liberi (nessun CHECK DB su proficiency del gap!), `score numeric(5,2)` → Number, severity enum, `detectedAt` ISO datetime. La list arricchisce `userName/positionTitle/skillName` via subselect (G-02).
- `me.ts`: `MeLearningAssignmentSchema` = `{userLearningAssignmentId, moduleId|null, initiativeId|null, pathId|null, isMandatory, status: z.string() (NON enum!), deadline|null}`. `CreateMeEnrollmentBodySchema` = almeno uno di moduleId/pathId/initiativeId (`.refine`) — speculare al CHECK `sys_ula_scope_check`. `MeCertificationSchema` + `CreateMeCertificationBodySchema` (name/issuer obbligatori, date `YYYY-MM-DD`, credentialId/documentUri/metadata opzionali).
- **Il body di enrollment NON valida che moduleId/pathId/initiativeId esistano o siano visibili al tenant**: FK a DB fa da rete (500 su uuid inesistente ben formato? no: FK violation → error handler; nessun test copre questo caso).

## 5. Pagine web che leggono formazione (apps/web/src/app)

| Pagina | Endpoint | Note |
|---|---|---|
| `(authenticated)/learning/page.tsx` | GET `/v1/learning-modules` (paginato server-side) | catalogo admin, sola lettura (nessuna useMutation) |
| `(authenticated)/learning/training-initiatives/page.tsx` | GET `/v1/training-initiatives` | lista; **tabella vuota in PROD (0 righe)** — mostra empty-state reale |
| `(authenticated)/gaps/page.tsx` | GET `/v1/learning-gaps` + `/v1/learning-gaps/summary` | KPI strip severità server-side (C4 #42) |
| `(authenticated)/positions/[positionId]/learning/page.tsx` | GET `/:id/learning-requirements`, `/:id/learning-modules`, `/v1/learning-gaps?positionId=` | bridge #25 |
| `(authenticated)/dashboard/page.tsx` | GET `/v1/dashboard/widgets` | count learningPaths/learningGaps + trend |
| `(authenticated)/me/learning/page.tsx` | GET `/v1/me/learning` | ⚠️ vedi DIFETTO sotto |
| `(authenticated)/me/learning/catalogue/page.tsx` | GET `/v1/learning-paths` + POST `/v1/me/learning/enrollments` | self-enrollment (unico write formativo dal web) |
| `(authenticated)/me/gaps/page.tsx` | GET `/v1/me/gaps` | self |
| `(authenticated)/me/certifications/page.tsx` | GET+POST `/v1/me/certifications` | self-upload cert (secondo write) |
| `(authenticated)/me/_components/summary-tab.tsx` | GET `/v1/me/learning` (solo total) | StatsCard conteggio |

### ⚠️ DIFETTO REALE trovato — shape mismatch su `/me/learning`
`me/learning/page.tsx` (righe 11-23) definisce un'interfaccia **locale** `MeLearningAssignment {learningPathId, learningPathName, status, mandatory, enrolledAt, completedAt}` che **non corrisponde** alla risposta API (`MeLearningResponseSchema`: `userLearningAssignmentId, moduleId, initiativeId, pathId, isMandatory, status, deadline`). Effetto a runtime: colonna "percorso" **vuota** (`learningPathName` undefined), "mandatory" sempre No (`mandatory` vs `isMandatory`), enrolled/completed sempre "—", `rowKey={l.learningPathId}` undefined (key React duplicate). Solo `status` combacia. L'E2E (`me-pages.spec.ts:58`) asserisce solo visibilità pagina + count `\d+ percorsi` → non lo cattura. **Qualsiasi backfill che voglia "vedersi" in `/me/learning` deve prima sanare questa pagina** (o l'endpoint va arricchito con il nome del path — la pagina fu evidentemente scritta contro una shape arricchita mai shippata).

## 6. Test esistenti (apps/api/test/)

| File | # test | Cosa asserisce |
|---|---|---|
| `learning-modules.integration.test.ts` | 4 | CRUD, 201/200/403/400; global-scope 403 per tenant-admin su isGlobal |
| `learning-paths.integration.test.ts` | 4 | idem pattern |
| `learning-path-steps.integration.test.ts` | 5 | idem + vincolo (path, ordinal) |
| `learning-gaps.integration.test.ts` | 4 | CRUD tenant-scoped |
| `learning-gaps-scope.integration.test.ts` | 8 | ADR-0027 F3: MANAGER vede il report (paolo→tommaso), NON l'outsider (antonio) — GET-by-id 404, list filtrata/unfiltered senza leak; USER 403; TENANT_ADMIN/PLATFORM_ADMIN pass. Usa persone reali RTL |
| `training-initiatives.integration.test.ts` | 5 | 201/200, dup-code 409, modulo altrui 404, facilitator cross-tenant, capacity |
| `positions-learning.integration.test.ts` | 5 | **derive-live (regola S1012)**: sceglie la posizione più ricca via query e confronta `items.length` col count sorgente; nomi path risolti non-null; ordering mandatory-first; 401; 404 |
| `reconciliation-learning-rehome.integration.test.ts` | 9 | **⚠️ CONTEGGI FOTOGRAFATI** — vedi sotto |

### Conteggi fotografati da sistemare in caso di backfill
`reconciliation-learning-rehome.integration.test.ts` (D5/W3) contiene le uniche asserzioni "fotografia":
- riga 55: `count(sys_learning_path_steps) toBe(124)` — **HARD**: qualunque backfill/aggiunta di step la rompe.
- riga 56: `count(DISTINCT path_id) toBe(20)` — **HARD**.
- riga 129: `v_reconciliation_status` 3 tabelle `POPULATED` `toBe(3)` — regge finché restano popolate.
- Le altre sono floor `>= 60/127` o invarianti (`toBe(0)` su FK orfane, ordinal dup, OLDDB refs, tenant-coherence evidence, `LEGACY_EMP::` I14) — **backfill-safe se il backfill rispetta le stesse invarianti**, e anzi sono l'harness gratuito di verifica.
- NOTA drift storico nel commento del test: parla di "~7299 OLDDB rows left untouched", ma la mig **000197** (S1025, #71) ha purgato 6454 righe junk (`module_completions/recommendations/ratings/bookmarks/providers`) → oggi restano 845 `OLDDB::course_modules::*`. Nessuna assertion rotta, ma il commento è stantio.
- `positions-learning` è il modello giusto (deriva l'atteso live); gli altri CRUD test creano+puliscono i propri dati (tx-isolation D-52 rollback per file) e non fotografano conteggi.

## 7. Trappole per un backfill indistinguibile

### 7a. Natural key per tabella (per idempotenza/anti-dup)
| Tabella | NK / vincolo | Trappola |
|---|---|---|
| `sys_learning_modules` | UNIQUE `(COALESCE(tenant_id, uuid-zero), code)` (indice a espressione) | ON CONFLICT deve replicare l'espressione COALESCE; convivono 3 famiglie di code: `OLDDB::course_modules::<uuid>`, `CRS-*`, banking (`BANK-LM-*`, `ISO*`, `FT*`, …) |
| `sys_learning_paths` | UNIQUE `(COALESCE(tenant_id, uuid-zero), code)` | **dual-home doctrine (000061)**: le 60 righe `CRS-*` in paths sono SHIM load-bearing (junction 11/15 le referenziano) — NON de-duplicarle contro i moduli omonimi |
| `sys_learning_path_steps` | UNIQUE `(path_id, ordinal)` | ordinal è `smallint`; `is_prerequisite_for` è jsonb array di uuid **non validato da FK** |
| `sys_training_initiatives` | UNIQUE `(tenant_id, code)` | tabella oggi VUOTA — un backfill qui è tutto verde-campo |
| `sys_user_learning_assignments` | **NESSUN UNIQUE** (solo PK) | seed idempotente via anti-join `(user_id, path_id)`; **l'API self-enroll NON de-duplica** (doppio POST = doppia riga legale). Un backfill deve scegliersi la NK e verificarla con anti-join, non ON CONFLICT |
| `sys_user_learning_evidence` | **NESSUN UNIQUE** | NK convenzionale del seed 38: `(user_id, module_id, completed_at)` con DISTINCT ON + anti-join |
| `sys_skill_learning_mappings` | UNIQUE `(skill_id, module_id)` | banking seed usa uuid v5 `uuid_generate_v5(uuid_ns_url(), 'bank-slm:skill:module')` — pattern RFC-4122 obbligatorio per id deterministici (mai `md5()::uuid`, memoria progetto) |
| `sys_position_learning_requirements` | UNIQUE `(position_id, learning_path_id)` | — |
| `sys_user_certifications` | UNIQUE espressione `(tenant, user, name, issuer, COALESCE(issued_date,'0001-01-01'))` | ON CONFLICT deve citare l'espressione COALESCE esattamente (fatto in rtl-rebuild 06); `seed_comp_dates` usa invece anti-join più lasco `(user, name, issuer)` |
| `sys_learning_gaps` | **NESSUN UNIQUE** | idempotenza seed 20 via **provenance-key**: anti-join su `metadata->'legacy'->>'source_id'` — il backfill DEVE portare una provenance in metadata o non è re-runnable |

### 7b. Colonne morte / semantiche divergenti (fingerprint dei dati attuali)
- `sys_user_learning_assignments`: **1990/1990 righe path-leg**; `module_id` = 0, `initiative_id` = 0 (gambe FK esistono ma mai usate nei dati), `assigned_by` = 0 non-null, `deadline` = 0 non-null. Un backfill che popoli la gamba module o initiative sarebbe il PRIMO a farlo → immediatamente distinguibile; idem un enrollment con assigned_by ≠ NULL non-self. Il codice ESS invece scrive `assigned_by = userId` e `is_mandatory=false`: le righe API-native sono riconoscibili dai seed (is_mandatory=true, assigned_by NULL, metadata.legacy presente).
- `sys_learning_gaps`: 270/270 con `skill_id NULL` e `position_id NULL` (gap aggregati a livello analisi; dettaglio skill in `metadata.legacy.skill_gaps`); `required/current_proficiency` NULL. Un gap con skill_id valorizzato non ha precedenti nei dati.
- `sys_user_certifications`: metadata a due dialetti — 420 righe con chiavi legacy flat (`legacy_employee_certification_id`, `status`, `verification_status`, `validity_months`, `is_internal`) e 57 con `{}` vuoto; `created_by/updated_by` **sempre NULL** (nessuna riga è mai passata dall'API, che invece li setta = userId). `credential_id` banking = derivato deterministico dall'user_id (`'RUI-E-'||upper(substr(replace(user_id...` ecc.).
- `sys_learning_modules`: le righe OLDDB hanno code=title identici (`OLDDB::course_modules::<uuid>`) — illeggibili, superstiti legittimi post-purge 000197.
- `metadata.legacy.{source_table, source_id, ...}` (jsonb_strip_nulls) è la convenzione di provenance dei seed reconciliation (ula/evidence/gaps 100% coperti); rtl-rebuild e banking usano dialetti diversi (chiavi flat / vuoto). Un backfill "indistinguibile" deve dichiarare il proprio dialetto e restare coerente col canale che imita.

### 7c. Convenzioni timestamp (il fingerprint più tradivo)
- `created_at/updated_at timestamptz NOT NULL DEFAULT now()`; trigger `sys_set_updated_at` BEFORE UPDATE presente su modules/paths/TI/ULA/certs/evidence/PLR ma **ASSENTE su `sys_learning_path_steps` e `sys_learning_gaps`** (lì i repository settano `updated_at = now()` a mano nell'UPDATE — un UPDATE SQL diretto su quelle 2 tabelle NON aggiorna updated_at).
- **Cluster created_at esistenti** (bursts a giornata singola — qualunque backfill crea un nuovo cluster datato oggi):
  - modules: 2025-12-03 (845 OLDDB, created_at legacy preservato dal wave executor — date PRE-bootstrap del repo), 2026-06-03 (127 rehome), 2026-07-22 (15 banking)
  - paths: 2025-12-03/12-19/2026-02-28/04-15 (import waves, created_at legacy)
  - ULA + evidence + gaps: **2026-06-03** (seed run, created_at = now() del run — il legacy timestamp NON fu preservato)
  - certs: 2026-05-30 (420) + 2026-07-21 (57)
  - Quindi: due dottrine convivono — wave executor preservò i timestamp sorgente, i seed reconciliation no. Un backfill "indistinguibile" deve decidere quale imitare; per essere onesto (regola evidenze falsificabili) meglio NON simulare created_at retrodatati e portare provenance esplicita.
- Colonne `date` (RD-09): TI start/end, ULA deadline, cert issued/expires. I repository le serializzano con `toISOString().slice(0,10)` — commento in TI repo avverte del TZ-drift (pg restituisce Date a mezzanotte locale); `me` assessments usa invece getFullYear/getMonth locali (due dialetti di serializzazione date-only nel codebase).
- `learning_gap_detected_at` = `analysis_date` legacy quando presente, else now() — è il timestamp "business", mentre created_at è il timestamp "import". `user_learning_evidence_completed_at` = timestamptz business (default now(), nel seed = completed_at legacy reale). L'evidence layer (#27) ordina su `coalesce(completed_at, created_at)`.
- Congelamento `now()` per file nei test (tx-isolation D-52): i test che inseriscono e confrontano timestamp vedono transaction_timestamp fisso.

### 7d. Altre trappole operative
1. **Il rehome è DUAL-HOME, non MOVE** (000061): non "pulire" i CRS-* da sys_learning_paths — spaccherebbe l'idempotent re-run dei seed 11/15 e le 1990 ULA + 1791 PLR che puntano ai path.
2. `training_initiatives` vuota + ULA.initiative_id FK ON DELETE SET NULL: se un backfill crea iniziative e le aggancia, ricordare che non esiste DELETE API — solo CANCELLED.
3. FK `ON DELETE SET NULL` su ULA (module/path/initiative/assigned_by): cancellare un path NON cancella gli enrollment, li orfanizza silenziosamente (riga con tutte e 3 le gambe NULL violerebbe il CHECK? No: il CHECK richiede almeno una NOT NULL → **il SET NULL dell'ultima gamba fallirebbe il CHECK** ⇒ delete del path con ULA single-leg = errore runtime. Il deletePath API non lo pre-verifica: `pathHasSteps` guarda solo gli step).
4. `learning:read` è largo (9 ruoli incl. USER/READ_ONLY) mentre `evidence:read` esclude USER — il completamento (evidence) di un collega non è mai self-readable se non via `evidence:read:self`.
5. La lista gap admin arricchisce i nomi via subselect su `sys_users/sys_positions/sys_skills` — un backfill con user_id validi ma display_name NULL produce `userName: null` in UI.
6. Zod 4: `z.uuid()` rifiuta uuid non-RFC-4122 → id deterministici SOLO `uuid_generate_v5` (memoria progetto: `md5()::uuid` causa 500 sul read).
7. `MeLearningAssignmentSchema.status` è `z.string()` libero — il client EnumStatusBadge ha un domain `learningAssignStatus`: valori fuori dai 6 CHECK non arrivano (CHECK DB), ma il contratto non li vincola.
8. Il difetto shape-mismatch di `/me/learning` (sez. 5) rende oggi la pagina cieca a nome-path/date: un backfill di enrollment è visibile solo come count e status.

---
File sorgente chiave: `apps/api/src/modules/{learning-modules,learning-paths,learning-path-steps,learning-gaps,training-initiatives,me,evidence,positions}/`, `packages/shared/src/schemas/{learning-*,training-initiatives,me}.ts`, `db/migrations/{000006,000016,000031,000061,000197}*.sql`, `db/seeds/reconciliation/{11,15,20,37,38,39}*.sql`, `db/seeds/rtl-rebuild/06_skills_certs.sql`, `db/seeds/rtl-banking-skills/{seed_banking_learning_catalog,seed_comp_dates}.sql`, `apps/api/test/{learning-*,training-initiatives,positions-learning,reconciliation-learning-rehome}*.test.ts`, `apps/web/src/app/(authenticated)/{learning,gaps,me}/**`.
