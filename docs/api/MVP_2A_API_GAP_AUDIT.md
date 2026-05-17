# MVP-2a API Gap Audit

> **Status**: Draft v1.0 — Phase 0 deliverable for MVP-2a frontend session.
> **Base commit**: `66b84f2` (MVP-2a doctrine locked) — backend HEAD `732e08b` (MVP-2b ESS closed, 267 endpoints, 182/182 tests green).
> **Scope**: 40 frontend routes (27 admin + 13 ESS) vs 267 live `/v1/*` endpoints across 56 modules.
> **Audit date**: 2026-05-17.
> **Successor**: gap-fill commits Phase 1.5.1..1.5.5 (compensation + dashboard + me/kpis + me/certifications + me/documents).

---

## A. Endpoint inventory snapshot (56 modules)

Modules registered in `apps/api/src/app.ts` (step 13 of plugin chain), grouped by domain:

| Domain | Modules | Module prefix examples |
|---|---|---|
| Auth | `auth` | `/v1/auth/*` (7 routes) |
| Core CRUD | `tenants`, `users` | `/v1/tenants`, `/v1/users` |
| Org + Position | `organization-units`, `positions`, `position-career-paths`, `position-succession-relevance` | `/v1/positions/*`, `/v1/organization-units` |
| Skill taxonomy | `skills`, `skill-families`, `skill-categories`, `skill-taxonomy-edges`, `skill-aliases`, `skill-proficiency-levels` | `/v1/skills/*`, `/v1/skill-*` |
| Job catalogue | `job-families`, `job-roles` | `/v1/job-families`, `/v1/job-roles` |
| KPI | `kpi-definitions`, `process-kpi-templates`, `organization-unit-kpi-templates` | `/v1/kpi-definitions`, `/v1/process-kpi-templates`, `/v1/organization-unit-kpi-templates` |
| Learning | `learning-modules`, `learning-paths`, `learning-path-steps`, `learning-gaps`, `training-initiatives` | `/v1/learning-*`, `/v1/training-initiatives` |
| Assessment | `assessment-methods`, `assessments`, `assessment-results` | `/v1/assessment-*` |
| Career & Succession | `career-paths`, `career-path-steps`, `user-career-plans`, `succession-pools`, `successor-candidates`, `successor-readiness` | `/v1/career-*`, `/v1/succession-*`, `/v1/successor-*`, `/v1/user-career-plans` |
| Visualizations | `visualization-graphs`, `visualization-nodes`, `visualization-edges`, `visualization-layouts`, `visualization-node-layouts`, `visualization-styles`, `visualization-exports` | `/v1/visualization-*` |
| Enterprise typing | `activity-classifications`, `activity-classification-mappings`, `enterprise-size-bands`, `operating-models`, `enterprise-typing-profiles` | `/v1/enterprise-*`, `/v1/activity-*`, `/v1/operating-models` |
| Blueprint | `blueprint-families`, `blueprint-variants`, `blueprint-processes`, `blueprint-activations`, `blueprint-overrides` | `/v1/blueprint-*` |
| BPM | (no dedicated module — uses `process-kpi-templates` + planned `blueprint-processes`) | `/v1/blueprint-processes`, `/v1/process-kpi-templates` |
| Brownfield | `brownfield-source-exports`, `brownfield-import-runs`, `brownfield-table-mappings` | `/v1/brownfield-*` |
| Seed acquisition | `seed-acquisition-runs`, `seed-candidate-records`, `seed-approval-decisions` | `/v1/seed-*` |
| ESS (MVP-2b) | `me` | `/v1/me/*` (13 routes) |
| Health | (system) | `/healthz`, `/readyz` |

**Totale endpoint live (verificato runtime 2026-05-17)**: **267** = 7 auth + 245 business + 13 ESS + 2 health.

---

## B. Admin routes audit (27 routes)

| # | Route | Ruolo min | Data richiesta | Endpoint(s) live | Status | Note |
|---|---|---|---|---|---|---|
| 1 | `/login` | (public) | login form | `POST /v1/auth/login` | ✅ | + 200 body con `{user, roles, csrfToken}` |
| 2 | `/dashboard` | USER+ landing per MANAGER+ | KPI tiles role-gated | `GET /v1/dashboard/widgets` | ❌ **GAP-1** | aggregator non implementato. Phase 1.5.2 lo aggiunge. |
| 3 | `/tenants` | PLATFORM_ADMIN | tenant registry | `GET /v1/tenants` (list) | ✅ | |
| 4 | `/tenants/[id]` | TENANT_ADMIN+ | tenant detail tabs | `GET /v1/tenants/:id` | ✅ | Tabs Overview/Enterprise Typing/Blueprints/Users/Settings composti client-side |
| 5 | `/tenants/[id]/enterprise-typing` | BLUEPRINT_MANAGER+ | ATECO/NACE wizard | `GET /v1/enterprise-typing-profiles`, `GET /v1/activity-classifications`, `GET /v1/operating-models`, `POST /v1/enterprise-typing-profiles` | ✅ | Composizione client-side dei 3 lookup + create profile |
| 6 | `/blueprints` | BLUEPRINT_MANAGER+ | blueprint registry | `GET /v1/blueprint-families`, `GET /v1/blueprint-variants` | ✅ | Filter industry client-side via `blueprint_family_industry_code` |
| 7 | `/blueprints/[variantId]` | BLUEPRINT_MANAGER+ | variant detail | `GET /v1/blueprint-variants/:id`, `GET /v1/blueprint-processes?variantId=...`, `GET /v1/blueprint-activations?variantId=...` | ✅ | Tabs Processes/KPIs/Activations |
| 8 | `/processes` | PROCESS_OWNER+ | BPM process registry | `GET /v1/blueprint-processes` + `GET /v1/process-kpi-templates` | ⚠️ | FE plan menziona `/bpm-processes` ma il modello è blueprint-anchored. Mapping da chiarire nei queries.ts; nessun nuovo endpoint API necessario. |
| 9 | `/organization` | MANAGER+ | OU hierarchy table | `GET /v1/organization-units` | ✅ | Composizione tree client-side |
| 10 | `/organization/org-chart` | MANAGER+ | org-chart graph | `GET /v1/visualization-graphs?graphKind=ORG_CHART`, `GET /v1/visualization-nodes?graphId=...`, `GET /v1/visualization-edges?graphId=...`, `GET /v1/visualization-layouts?graphId=...` | ✅ | React Flow consuma payload composto |
| 11 | `/users` | MANAGER+ | user list paginated | `GET /v1/users` | ✅ | scope filter automatico via tenantContext |
| 12 | `/users/[userId]` | MANAGER+ | user detail tabs | `GET /v1/users/:userId` + `GET /v1/user-position-assignments` (filtrato client-side) | ✅ | Tabs composti da sub-resources existing |
| 13 | `/users/[userId]/assignments` | HRMS_MANAGER+ | assignment history | `GET /v1/positions/:id/assignments` (verificare prefix esatto via positions routes) — fallback: `GET /v1/users/:userId` includes embed assignments | ⚠️ | Da confermare durante implementazione page; se sub-resource non esposta, comporre client-side da `/v1/positions?incumbentUserId=` |
| 14 | `/positions` | USER+ | position list + filtri | `GET /v1/positions` | ✅ | filtri: organizationUnitId, jobRoleId, criticality |
| 15 | `/positions/[positionId]` | USER+ | Position Intelligence Profile | `GET /v1/positions/:id` (esponi PIP view join via positions module) | ✅ | PIP è view `sys_position_intelligence_profiles_v` |
| 16 | `/positions/[positionId]/skills` | HRMS_MANAGER+ | required skills CRUD | `GET/POST/PATCH/DELETE /v1/positions/:id/skills` | ✅ | sub-CRUD già esiste (5.1.7) |
| 17 | `/positions/[positionId]/kpis` | HRMS_MANAGER+ | required KPI CRUD | `GET/POST/PATCH/DELETE /v1/positions/:id/kpis` | ✅ | sub-CRUD già esiste (5.1.7) |
| 18 | `/positions/[positionId]/learning` | HRMS_MANAGER+ | required learning CRUD | `GET /v1/learning-path-steps?positionId=...`, `POST /v1/learning-paths` con position binding | ⚠️ | Modulo dedicato position-learning sub-CRUD non esiste; il binding learning↔position avviene via `learning-paths` o `learning-gaps`. Da verificare e potenzialmente esporre nuovo endpoint `GET /v1/positions/:id/learning` come adapter. |
| 19 | `/skills` | USER+ | skill taxonomy tree | `GET /v1/skills`, `GET /v1/skill-families`, `GET /v1/skill-categories`, `GET /v1/skill-taxonomy-edges`, `GET /v1/skill-aliases`, `GET /v1/skill-proficiency-levels` | ✅ | Tree composto client-side da 6 GET |
| 20 | `/kpis` | USER+ | KPI catalogue | `GET /v1/kpi-definitions`, `GET /v1/process-kpi-templates`, `GET /v1/organization-unit-kpi-templates` | ✅ | Catalogue con tab per scope |
| 21 | `/learning` | USER+ | learning catalogue | `GET /v1/learning-modules`, `GET /v1/learning-paths`, `GET /v1/learning-path-steps` | ✅ | |
| 22 | `/learning/training-initiatives` | HRMS_MANAGER+ | training schedule | `GET /v1/training-initiatives`, `POST /v1/training-initiatives` | ✅ | Calendar component composto client-side |
| 23 | `/gaps` | HRMS_MANAGER+ | gap analysis admin | `GET /v1/learning-gaps`, composizione skill/KPI gap | ⚠️ | FE plan menziona `/gap-analysis` aggregator. Soluzione: composizione client-side da `/v1/learning-gaps` (esiste) + derivati skill/KPI. Non serve nuovo endpoint API. |
| 24 | `/career-succession` | HRMS_MANAGER+ | career + succession | `GET /v1/career-paths`, `GET /v1/career-path-steps`, `GET /v1/succession-pools`, `GET /v1/successor-candidates`, `GET /v1/successor-readiness`, `GET /v1/position-career-paths`, `GET /v1/position-succession-relevance` | ✅ | Tabs + React Flow graph composti |
| 25 | `/compensation-intelligence` | HRMS_MANAGER+ | reward gates + recommendations | `GET /v1/compensation/profiles/:positionId`, `GET /v1/compensation/reward-gates?period=...`, `POST /v1/compensation/recommendations`, `POST /v1/compensation/handoff-records` | ❌ **GAP-2** | modulo non implementato. Phase 1.5.1. Tabelle già esistono (migration 000019). |
| 26 | `/visualizations` | USER+ | visualization browser | `GET /v1/visualization-graphs?tenantId=...` | ✅ | Combobox per tenant + DataTable |
| 27 | `/visualizations/[graphId]` | USER+ | full-viewport renderer + edit | `GET /v1/visualization-graphs/:id`, `GET /v1/visualization-nodes?graphId=...`, `GET /v1/visualization-edges?graphId=...`, `GET /v1/visualization-layouts?graphId=...`, `POST /v1/visualization-node-layouts` (edit), `GET /v1/visualization-exports?graphId=...` | ✅ | Layout engines: Dagre/ELK/Tree client-side |
| 28 | `/seed-acquisition/runs` | TENANT_ADMIN+ | seed pipeline | `GET /v1/seed-acquisition-runs`, `POST /v1/seed-acquisition-runs`, `GET /v1/seed-candidate-records?runId=...`, `GET /v1/seed-approval-decisions` | ✅ | |
| 29 | `/brownfield-adaptation` | TENANT_ADMIN+ | brownfield import | `GET /v1/brownfield-source-exports`, `GET /v1/brownfield-import-runs`, `POST /v1/brownfield-import-runs`, `GET /v1/brownfield-table-mappings`, `POST /v1/brownfield-table-mappings` | ✅ | Tabs Inventory/Mapping/Runs/Approvals |
| 30 | `/admin/roles` | PLATFORM_ADMIN | role × permission editor | `GET /v1/auth/me` (role check), seed read-only via DB; no admin role CRUD endpoint | ⚠️ | Le 8 ruoli + 388 mapping vivono in `sys.sys_auth_role_permissions` e sono seedati staticamente. Per MVP-2a soluzione: pagina **read-only** che mostra la matrix. CRUD ruoli/permessi → MVP-3. Status ⚠️ ridotto a ✅ se accettiamo read-only. |

> **Conteggio admin gap reale**: 2 gap ❌ (dashboard widgets + compensation) + 4 ⚠️ risolvibili senza nuovi endpoint.

---

## C. ESS routes audit (13 routes)

Riferimento ADR-0011 hard self-scope: tutti gli endpoint sotto `/v1/me/*`, nessun `:userId` param, `selfActor()` extraction da `req.user.userId`.

| # | Route | Ruolo min | Data richiesta | Endpoint(s) live | Status | Note |
|---|---|---|---|---|---|---|
| ESS-1 | `/me` | USER | landing: profile + positions + learning + gaps | `GET /v1/auth/me`, `GET /v1/me/profile`, `GET /v1/me/positions`, `GET /v1/me/learning`, `GET /v1/me/gaps`, `GET /v1/me/inbox` | ✅ | Composizione client-side di 5 chiamate parallele |
| ESS-2 | `/me/profile` | USER | profile read/update | `GET /v1/me/profile`, `PATCH /v1/me/profile` | ✅ | |
| ESS-3 | `/me/positions` | USER | own assignments | `GET /v1/me/positions` | ✅ | |
| ESS-4 | `/me/skills` | USER | own skill matrix | `GET /v1/me/skills` | ✅ | |
| ESS-5 | `/me/skills/self-assessment` | USER | submit self-assessment | `GET /v1/me/skills`, `POST /v1/me/skills/self-assessments` | ✅ | Form + CSRF |
| ESS-6 | `/me/learning` | USER | own learning assignments | `GET /v1/me/learning` | ✅ | |
| ESS-7 | `/me/learning/catalogue` | USER | browse + self-enroll | `GET /v1/learning-modules`, `GET /v1/learning-paths`, `POST /v1/me/learning/enrollments` | ✅ | |
| ESS-8 | `/me/kpis` | USER | own KPI targets + measurements | `GET /v1/me/kpis` | ❌ **GAP-3** | Endpoint manca. Phase 1.5.3 lo aggiunge (perm `kpi:read:self` già seedato). |
| ESS-9 | `/me/gaps` | USER | own skill/KPI/learning gaps | `GET /v1/me/gaps` | ✅ | |
| ESS-10 | `/me/career` | USER | available paths + targets | `GET /v1/me/career`, `GET /v1/career-paths`, `POST /v1/me/career/target-positions` | ✅ | |
| ESS-11 | `/me/certifications` | USER | view + upload metadata | `GET /v1/me/certifications`, `POST /v1/me/certifications` | ❌ **GAP-4** | Endpoint mancano. Phase 1.5.4 li aggiunge (tabella `sys_user_certifications` esiste, perms `certification:read:self` + `certification:upload:self` già seedati). |
| ESS-12 | `/me/documents` | USER | view URI metadata | `GET /v1/me/documents` | ❌ **GAP-5** | Endpoint manca. Phase 1.5.5 lo aggiunge (tabella `sys_user_documents` esiste, perm `document:read:self` già seedato). |
| ESS-13 | `/me/inbox` | USER | notifications | `GET /v1/me/inbox`, `PATCH /v1/me/inbox/:notificationId` | ✅ | |

> **Conteggio ESS gap reale**: 3 ❌ (me/kpis, me/certifications GET+POST, me/documents GET) = 4 endpoint da aggiungere.

---

## D. Confirmed gap list

### GAP-1 — Dashboard widgets aggregator (admin /dashboard)

- **Endpoint**: `GET /v1/dashboard/widgets`
- **Permission**: `dashboard:view` (**non esiste ancora** — va seedato via migration 000028)
- **Risposta**: role-gated payload
  - `PLATFORM_ADMIN`: cross-tenant counters (tenants, users, positions, blueprints) + recent activity
  - `TENANT_ADMIN`/`HRMS_MANAGER`: own-tenant counters (users, positions, learning paths, KPI gaps) + recent deadlines
  - `MANAGER`: own-team counters (direct reports, team learning, team KPI gaps) + own deadlines
- **Tabelle coinvolte (read-only)**: `sys_tenancies`, `sys_users`, `sys_positions`, `sys_user_position_assignments`, `sys_learning_paths`, `sys_learning_gaps`, `sys_inbox_notifications`
- **Tests**: 5 (uno per ruolo PLATFORM_ADMIN/TENANT_ADMIN/HRMS_MANAGER/MANAGER + 1 RBAC denial per USER)

### GAP-2 — compensation-intelligence module (admin /compensation-intelligence)

- **Endpoint** (4):
  - `GET /v1/compensation/profiles/:positionId` → `sys_compensation_bands` + `sys_position_compensation_profiles` (FK già installata)
  - `GET /v1/compensation/reward-gates?period=YYYY-MM-DD..YYYY-MM-DD&userId=&positionId=` → `sys_reward_gates` + `sys_reward_gate_results`
  - `POST /v1/compensation/recommendations` → `sys_compensation_recommendations` (signal: PROPOSED/APPROVED/SUPPRESSED_BY_GATE/ADJUSTED/REJECTED)
  - `POST /v1/compensation/handoff-records` → `sys_payroll_handoff_records`
- **Permissions**: `compensation_intelligence:read` (HRMS_MANAGER+, già seedato), `compensation_intelligence:update` (HRMS_MANAGER+, già seedato)
- **Tables**: già esistono (migration 000019).
- **Tests**: 6 (CRUD happy path × 4 + RBAC denial + cross-tenant 404)

### GAP-3 — ESS GET /v1/me/kpis

- **Endpoint**: `GET /v1/me/kpis`
- **Permission**: `kpi:read:self` (già seedato)
- **Risposta**: array di `MeKpiTarget` con `kpiDefinitionId`, `kpiCode`, `kpiName`, `targetValue`, `targetUnit`, `latestMeasurementValue?`, `latestMeasurementAt?`, `assessmentResultsCount`
- **Tabelle**: join di `sys_user_position_assignments` (PRIMARY ACTIVE) → `sys_position_kpi_requirements` → `sys_kpi_definitions` + LEFT JOIN `sys_user_kpi_evidence` per latest measurement
- **Tests**: 3 (happy path con kpi assegnati, empty, RBAC denial)

### GAP-4 — ESS GET+POST /v1/me/certifications

- **Endpoint**: `GET /v1/me/certifications`, `POST /v1/me/certifications`
- **Permissions**: `certification:read:self`, `certification:upload:self` (già seedati)
- **Tabella**: `sys_user_certifications` (esiste)
- **Body POST**: `{ certificationName, issuerName, issuedAt, expiresAt?, certificationUri, metadata? }`
- **CSRF**: POST → `app.verifyCsrf`
- **Tests**: 4 (read empty, create, read after create, RBAC denial)

### GAP-5 — ESS GET /v1/me/documents

- **Endpoint**: `GET /v1/me/documents`
- **Permission**: `document:read:self` (già seedato)
- **Tabella**: `sys_user_documents` (esiste, URI metadata only — no binary BLOB)
- **Tests**: 2 (happy path, empty)

> **POST/PATCH documents**: descopato — FE plan ESS-12 specifica "URI metadata only, no binaries". L'upload reale rimane fuori scope MVP-2b (file-storage system non in scope). Solo lettura.

---

## E. Endpoint name reconciliation (FE plan ↔ live API)

Il piano FE in molti punti usa nomi senza `/v1` prefix o naming legacy. Mapping autoritativo:

| Nome FE plan | Live endpoint | Note |
|---|---|---|
| `GET /auth/me` | `GET /v1/auth/me` | prefix |
| `POST /auth/login` | `POST /v1/auth/login` | prefix |
| `GET /dashboard/widgets` | `GET /v1/dashboard/widgets` | da implementare (GAP-1) |
| `GET /tenants` | `GET /v1/tenants` | |
| `GET /bpm-processes` | `GET /v1/blueprint-processes` | rinominato (anchor blueprint) |
| `GET /users/{userId}/dashboard` | `/me/dashboard` composto client-side da `/v1/me/profile` + altre | no endpoint dedicato — composizione FE |
| `GET /users/{userId}/skills` | `GET /v1/me/skills` (per self) o `GET /v1/positions/:id/skills` (per admin view) | hard self-scope vs admin view |
| `GET /users/{userId}/skill-evidence` | `POST /v1/me/skills/self-assessments` | naming finale ESS |
| `GET /users/{userId}/learning-assignments` | `GET /v1/me/learning` | |
| `POST /users/{userId}/learning-enrollments` | `POST /v1/me/learning/enrollments` | |
| `GET /users/{userId}/kpis` | `GET /v1/me/kpis` | GAP-3 |
| `GET /users/{userId}/gap-analysis` | `GET /v1/me/gaps` | |
| `POST /users/{userId}/target-positions` | `POST /v1/me/career/target-positions` | |
| `GET /users/{userId}/certifications` | `GET /v1/me/certifications` | GAP-4 |
| `POST /users/{userId}/certifications` | `POST /v1/me/certifications` | GAP-4 |
| `GET /users/{userId}/documents` | `GET /v1/me/documents` | GAP-5 |
| `GET /users/{userId}/notifications` | `GET /v1/me/inbox` | rinominato `inbox` |
| `GET /gap-analysis` (admin /gaps) | composizione client-side da `/v1/learning-gaps` + derivati | no endpoint aggregator dedicato |
| `GET /compensation-profiles` | `GET /v1/compensation/profiles/:positionId` | GAP-2 |
| `GET /reward-gates/status` | `GET /v1/compensation/reward-gates` | GAP-2 |
| `POST /recommendations` | `POST /v1/compensation/recommendations` | GAP-2 |
| `POST /handoff-records` | `POST /v1/compensation/handoff-records` | GAP-2 |

> **Regola permanente**: i frontend hooks (`apps/web/src/lib/api/queries.ts`) usano i nomi **live** dell'API. I nomi FE-plan sono storici e vanno tradotti durante implementazione.

---

## F. Acceptance criteria Phase 0

- [x] Inventory 56 modules registrati documentato.
- [x] 27 admin route mappate vs endpoint live (2 ❌ critical, 4 ⚠️ risolvibili senza nuovi endpoint).
- [x] 13 ESS route mappate vs `/v1/me/*` (3 ❌ critical = 4 endpoint).
- [x] 5 gap critici identificati e classificati (GAP-1..GAP-5).
- [x] Reconciliation FE-plan ↔ live API completata.
- [x] Tutte le tabelle DB necessarie ai gap-fill **già esistono** (verificato via `pg_tables`): no migrazioni dati richieste.
- [x] Solo 1 migration da scrivere: **000028 — dashboard:view permission seed** (GAP-1).

---

## G. Phase 1.5 roadmap (gap-fill milestones)

Esecuzione in ordine sequenziale, 7-step pattern per ogni milestone (shared schema → repo → service → routes → integration test → register app.ts → atomic commit).

| Milestone | Deliverable | Endpoint Δ | Tests Δ | Migration | Commit message |
|---|---|---|---|---|---|
| 1.5.0 | Migration `000028_dashboard_permission_seed.sql` — INSERT `dashboard:view` + map a PLATFORM_ADMIN/TENANT_ADMIN/BLUEPRINT_MANAGER/HRMS_MANAGER/PROCESS_OWNER/MANAGER | 0 | 0 | yes | `feat(db): MVP-2a 1.5.0 — dashboard:view permission + role mappings` |
| 1.5.1 | `compensation-intelligence` module (4 endpoint, 5 file) | +4 | +6 | no | `feat(api): MVP-2a 1.5.1 — compensation-intelligence module (4 endpoints, 6 tests)` |
| 1.5.2 | `dashboard` module (1 endpoint role-gated) | +1 | +5 | no | `feat(api): MVP-2a 1.5.2 — dashboard widgets aggregator (1 endpoint role-gated, 5 tests)` |
| 1.5.3 | Estensione `me/` module: `GET /v1/me/kpis` | +1 | +3 | no | `feat(api): MVP-2a 1.5.3 — ESS /v1/me/kpis (1 endpoint, 3 tests)` |
| 1.5.4 | Estensione `me/`: `GET+POST /v1/me/certifications` | +2 | +4 | no | `feat(api): MVP-2a 1.5.4 — ESS /v1/me/certifications GET+POST (2 endpoints, 4 tests)` |
| 1.5.5 | Estensione `me/`: `GET /v1/me/documents` | +1 | +2 | no | `feat(api): MVP-2a 1.5.5 — ESS /v1/me/documents (1 endpoint, 2 tests)` |

**Totale Δ**: +9 endpoint (267 → 276), +20 test (182 → 202), +1 migration (27 → 28).

**Acceptance Phase 1.5 chiusura**:
- `pnpm test` (apps/api) = 202/202 verdi.
- 0 righe ⚠️/❌ residue in tabelle B + C (eccetto i ⚠️ noti che sono risolti via composizione client-side, non con nuovi endpoint).
- `HANDOFF.md` (o questo file) aggiornato con conteggi finali.

---

## H. Out-of-scope per MVP-2a (esplicito)

Lasciati fuori dal gap-fill perché non bloccanti per le 40 route, da rivedere in MVP-3:

- `/admin/roles` CRUD vero (oggi: pagina read-only sulla matrix seedata).
- File upload reale per certifications/documents (oggi: solo URI metadata).
- ATS/recruiting/payroll execution/benefits/T&A (esplicitamente out-of-scope per tutta la piattaforma).
- Mobile responsive optimization granulare (oggi: responsive base via `@heuresys/ui` primitives).
- A11y audit completo (oggi: livello "axe-playwright zero critical" come acceptance globale; full WCAG 2.2 AA → MVP-3).

---

**End of audit. Phase 1.5 gap-fill commits authorized to start.**
