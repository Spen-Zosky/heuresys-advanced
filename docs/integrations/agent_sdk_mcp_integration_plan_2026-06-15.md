# PLAN — #9 Integrazione Agent SDK + layer MCP del plugin `human-resources-plus` (heuresys-side)

> 🔒 **DoD VINCOLANTE (§0, riconfermata 2026-06-15)**: nessuno step è *done* senza dimostrazione **live E2E su dati reali** (output reale allegato, R5); il mock è solo scaffold transitorio; secret/approval/migration-apply mancanti → `blocked-on-Enzo`. Persistita in `CLAUDE.md §Definition of Done` (commit `2f47ef2`) + §3.0. **Tenant di destinazione = RTL Bank** (`86ba7a65`) — tenant di produzione, non «di test» (ADR-0026/I15); scritture **mai** su HEURESYS proprietario (`8bc5bc59`). DB target = OCI VM reale via tunnel :5433 (NODE_ENV dev, DB prod-condiviso) → safety §0.5 verde 2026-06-15.

> **Tipo**: PLAN (governance Cowork↔CLI — step 2). **Stato**: prodotto dal CLI, **da approvare** prima dell'esecuzione.
> **Data**: 2026-06-15. **Riconcilia**: `docs/kb/COWORK_INBOX.md` entry `2026-06-14 | #9`.
> **Design di riferimento (read-only, prodotto da Cowork nel repo plugin `D:\enzospenuso\Documents\GitHub\human-resources-plus\`)**:
> `docs/PLATFORM_MAP.md` · `docs/MCP_TOOL_CATALOG.md` · `docs/AUTH_AND_COMPLIANCE_DESIGN.md` · `docs/BLUEPRINT_BUILDERS.md` · `docs/SDK_INTEGRATION_PLAN.md` · `reference-backend/` (pilota mock eseguibile + skeleton SDK/MCP).
> **Vincolo cardinale (aggiornato 2026-06-15)**: WI-A è in esecuzione **sotto il go esplicito di Enzo** ("procedi"). Le migration **000116** (esenzione MFA) + **000117** (M-8 eligibility) sono **CREATE e APPLICATE** al DB OCI (additive, idempotenti, **tabella vuota = login default-safe**, byte-identico a pre-000116). Tutto il resto (WI-B/C/D) resta **PROPOSED / DO-NOT-APPLY** fino al rispettivo go. Vedi §6.

---

## 0. Sintesi esecutiva

Il plugin `human-resources-plus` (48 skill + 6 agenti) deve diventare callable dalle webapp di heuresys-advanced via **Claude Agent SDK**, esponendo gli endpoint `/v1/*` come **tool MCP**, con compliance enforced a runtime (plan→diff→approve→apply; nessuna decisione consequenziale solely-automated). Pilota: il **blueprint-builder dell'archetipo banca retail** (generate→plan→apply, 8 step).

Cinque work-item heuresys-side: **(a)** service user PLATFORM_ADMIN + esenzione MFA per login headless · **(b)** backend Agent SDK + layer MCP (auth ibrido + CSRF + gate `canUseTool` sulle write) · **(c)** generatore di materializzazione per-tenant (Phase B) · **(d)** opzionali (bulk-apply, ranking KPI, recommender typing→variant) · **pilota** end-to-end.

**Tre scoperte design-changing confermate sul codice reale** (governano tutto il PLAN):
1. Un `sys_blueprint_variants` è un **header di catalogo processi** (`{family_id, code, name, size_band_id, metadata}`) — **non** contiene org-unit/ruoli/skill/KPI-tenant.
2. `POST /v1/blueprint-activations` scrive **una sola riga di link** tenant→variant (one-active-per-tenant) — **non istanzia nulla** nel tenant.
3. L'archetipo (org/persone) nasce da un **seed deterministico** (`db/scripts/seed-reference-bank.ts`), non dall'attivazione; e **non esiste** recommender typing→variant.

→ Conseguenza architetturale: si adotta il pattern **catalogo + generatore deterministico**. Il builder persiste l'archetipo al **piano catalogo/template (Phase A)**; un **nuovo generatore per-tenant (Phase B)** lo materializza in org-units/positions, imitando il seed.

---

## 1. Evidence base verificata (read-only su `D:\heuresys-advanced`)

Verifica forense indipendente (Explore agent + letture mirate, 2026-06-15). Conferma e **precisa** i finding di Cowork.

### 1.1 Auth / MFA (impatta WI-A, WI-B)
- Unico canale identità = JWT cookie `hrx_access` (RS256, 15m) via `POST /v1/auth/login`; **nessun service account / API-key / Bearer**. Tenant+roles nel claim; `null` tenant ammesso solo per `PLATFORM_ADMIN`. CSRF double-submit `hrx_csrf`==`x-csrf-token` su ogni write (`apps/api/src/middleware/{auth,csrf,tenantContext}.ts`).
- **Gate MFA §3b** (`apps/api/src/modules/auth/service.ts:344-422`), attivo quando `mfaEnforcement = deps.mfaEnforcement ?? env.MFA_ENFORCEMENT_ENABLED` (kill-switch S989, default **true** in PROD):
  - se l'utente **ha un fattore verificato** → `beginLoginChallenge` → ritorna `mfa_required` (serve TOTP step-2) — **blocca il login headless**;
  - se **non** ha fattore → consulta `findMfaPolicyForTenant(userTenantId)`: se la policy del **suo tenant** è `enabled` e i suoi ruoli sono in-scope (`role_codes` NULL = tutti) → `mfa_enrollment_required` (sessione ristretta, `enr:true`, roles `[]`) — **blocca**; altrimenti → login pieno.
- **Stato PROD live (S984)**: policy `RTL_BANK` ed `HEURESYS` entrambe `enabled=true, role_codes=NULL` (`sys.sys_auth_mfa_policies`, schema mig `000103`). Quindi un PLATFORM_ADMIN **dentro il tenant HEURESYS** sarebbe bloccato; un PLATFORM_ADMIN **platform-level (tenant null)** è fuori da ogni policy per-tenant → esenzione *naturale* ma **fragile** (si rompe se domani esiste una policy platform-wide o se gli si enrolla un fattore).

### 1.2 Blueprint engine + typing (impatta WI-B catalogo, WI-D3, pilota)
Endpoint reali (verbo · permission · CSRF):

| Modulo | Read | Write | Note |
|---|---|---|---|
| `blueprint-families` | GET `blueprint:read` | POST `blueprint:activate` · PATCH/DELETE `blueprint:override` · csrf | — |
| `blueprint-variants` | GET `blueprint:read` | POST `blueprint:activate` · PATCH/DELETE `blueprint:override` · csrf | header sottile (no payload org/role/skill/kpi) |
| `blueprint-processes` | GET `blueprint:read` | POST `blueprint:activate` · PATCH/DELETE `blueprint:override` · csrf | — |
| `blueprint-activations` | GET `blueprint:read` | POST/PATCH/DELETE **`blueprint:activate`** · csrf | 1 riga; one-active-per-tenant (service `ConflictError`) |
| `blueprint-overrides` | GET `blueprint:read` | **PUT-upsert** / DELETE `blueprint:override` · csrf | no POST |
| `process-kpi-templates` | GET `bpm_process:read` | **PUT-upsert** / DELETE **`bpm_process:update`** · csrf | no perm `kpi:*` qui |
| `organization-unit-kpi-templates` | GET `bpm_process:read` | **PUT-upsert** / DELETE **`bpm_process:update`** · csrf | dual-mode template/instance |
| `enterprise-typing-profiles` | GET `enterprise_typing:read` | **PUT-upsert** / DELETE `enterprise_typing:update` · csrf | 1:1 per tenant; **no `blueprint_variant_id`, no recommender**; solo `size_band_id` (FK `sys_enterprise_size_bands`, codici XS/S/M/L/XL seed mig `000021`) |

### 1.3 Write surface del pilota (impatta Phase A/B, pilota)

| Modulo | Write reali | Permission | Principal |
|---|---|---|---|
| `organization-units` | POST/PATCH/DELETE | `organization_unit:{create,update,delete}` | user **o** service |
| `positions` | POST/PATCH/DELETE · POST `/:id/skills` · DELETE `/:id/skills/:skillId` | `position:{create,update,delete}` (skills = `position:update`) | user o service |
| `positions /:id/kpis` | **— (READ-ONLY, no write API)** | `position:read` | — |
| `job-roles` | POST/PATCH (**no DELETE**) | `job_role:{create,update}` | user o service |
| `job-families` | POST/PATCH/DELETE | **nessun `requirePermission`** → `ensurePlatformAdmin` nel service | **service user** |
| `skills` | POST/PATCH (**no DELETE**) | `skill:{create,update}` | user o service |
| `skill-proficiency-levels` | **— (read-only catalog)** | — (solo auth) | — |
| `kpi-definitions` | POST/PATCH/DELETE | `kpi:{create,update,delete}` | user o service |
| `compensation` | POST `/compensation/recommendations` | `compensation_intelligence:update` | user — **decision-support only (I8)** |

### 1.4 KPI ↔ position + ranking (impatta WI-D2)
- `sys_position_kpi_requirements` (mig `000011`/`000015`) ha **`weight numeric(4,3) DEFAULT 1.000`** — **nessun** `rank`/`priority`/`ordinal`. Idem `sys_process_kpi_templates.default_weight` e `sys_organization_unit_kpi_templates.weight`.
- **Gap**: non c'è write API per le KPI per-position (`/:id/kpis` è read-only). Il builder "8 KPI ranked per ruolo" oggi può creare solo `kpi-definitions` (catalogo) + process/org-unit-kpi-templates; la **rank** e l'**associazione per-position** non sono esprimibili → WI-D2 (campo ranking) si lega a un eventuale write-endpoint position-KPI.

### 1.5 wave-executor (impatta WI-D1)
- `brownfield-wave-executor` = `POST /v1/brownfield/wave-executor/runs` (`brownfield_adaptation:trigger`, PLATFORM_ADMIN), input **solo** `wave ∈ [1,4]`, legge `legacy_mirror.*` + `brownfield.table_mappings`. **Non** è un bulk-apply generico a cui POSTare un payload.
- **È il modello da imitare**: natural-key resolution + content-hash propagato + `ON CONFLICT (...) DO UPDATE/NOTHING` + lineage in `sys.sys_source_lineage_records` (`upsert-sql.ts`).

### 1.6 seed-reference-bank.ts (impatta WI-C)
- `db/scripts/seed-reference-bank.ts` (440 righe, `pg` client, no Drizzle). FK order: `organization_units → branches → positions → users → user_position_assignments`. Idempotenza **ON CONFLICT DO NOTHING** su natural key `(tenant_id, code)` / `(tenant_id, lower(email))`; assignments con pre-SELECT guard. `faker.seed(42)` + ref-date fissa. `tenant_id` risolto da **lookup `tenant_code`** (il tenant è pre-seedato da mig `000021`). Counts dichiarati: ~5 branch + HQ; nota: il file ha un'incoerenza interna 55 vs 158 positions/users → da misurare sul run reale, non assumere.

### 1.7 Struttura monorepo + RBAC
- `apps/` = `api`, `web`, `showcase` → **nessun backend agent**: WI-B è net-new.
- RBAC reale: **11 ruoli / 586 mapping / 133 permessi** (`CLAUDE.md` stale "8/394" — doc-fix già tracciato A2/WS-H, non parte di #9).
- Permission codes confermati esatti (mig `000005`+): `organization_unit:{list,read,create,update,delete}`, `position:{list,read,create,update,delete}`, `job_role:{read,create,update}`, `skill:{read,create,update}`, `kpi:{read,create,update,delete}`, `bpm_process:{read,update}`, `blueprint:{read,activate,override}`, `enterprise_typing:{read,create,update}`, `compensation_intelligence:{read,update}`.

### 1.8 Discrepanze design ↔ codice (da incorporare)
1. `blueprint-activations` PATCH/DELETE = `blueprint:activate` (non `override`).
2. `blueprint-overrides` + i 2 kpi-templates = **PUT-upsert** (no POST).
3. kpi-templates gated da `bpm_process:update` (non `kpi:*`).
4. **Nessun** campo rank/priority nelle junction KPI (solo `weight`).
5. `job_role` e `skill` **senza** DELETE.
6. `job-families`/`skill-proficiency-levels` **senza** `requirePermission` (service-gate / read-only).
7. **Nessun** recommender typing→variant (link solo indiretto via `size_band_id`).
8. `positions/:id/kpis` read-only (no write per-position KPI).
9. wave-executor non è bulk-apply generico (solo `wave` int).
10. `seed-reference-bank.ts` counts internamente incoerenti → misurare.

---

## 2. Invarianti & governance — compliance check

| Invariante | Come il PLAN lo rispetta |
|---|---|
| **I3/I4** schema discipline | Zero nuovi schemi (no `sf_*`/`agent_*`). Phase B scrive solo in `sys.sys_*`; eventuali buffer in `staging.*`. WI-D1 lineage in `sys.sys_source_lineage_records` esistente. |
| **I5** tenant isolation = FK + middleware (NEVER RLS) | Ops user-scoped girano **come l'utente** → tenant dal claim, filtro middleware naturale. **⚠ M-1**: `tenant.materialize` (WI-C) gira come PLATFORM_ADMIN **tenant-null** → `tenantId` viene dall'**INPUT, non dal JWT** → obbligatori validazione tenant (esiste + ACTIVE), conferma tenant nell'approval, e test negativi cross-tenant. Il generatore applica `tenant_id` su ogni INSERT. Nessun RLS. |
| **I7** auth separato da `sys_users` (11 tabelle `sys_auth_*`) | **M-1/WI-A**: l'esenzione MFA del service user vive in **`sys.sys_auth_mfa_exemptions`** (tabella `sys_auth_*`), **mai** come colonna su `sys_users`. |
| **I8** out-of-scope HARD (payroll/T&A/benefits/recruiting/onboarding/IAM) | Il blueprint-builder genera **solo** org/processi/ruoli/skill/KPI/blueprint. Builder `compensation` resta **decision-support** (`/compensation/recommendations`), mai payroll. Builder `onboarding`/`recruit` del catalogo plugin = `doc`-only, **non** esposti come write-tool. |
| **R11** secret hygiene | Credenziali service user in secret store / `.env` per-host, **mai loggate**; secret-scan sullo staged diff pre-commit. |
| **ADR-0023** no-PII globale | Dati synthetic case-study; nessun gate privacy aggiuntivo. |
| **GDPR Art.22 / EU AI Act** | `canUseTool` = chokepoint human-in-the-loop su ogni write; `compliance-guard` upstream; audit ≥6 mesi di ogni tool-call. |

---

## 3.0 — Acceptance LIVE (DoD vincolante, recepita 2026-06-15)

Ogni WI sotto si chiude SOLO con una **dimostrazione live E2E su dati reali** (sul tenant di produzione RTL Bank, dati trattati come reali — ADR-0026), output reale allegato (R5) — il mock è solo scaffold transitorio, mai endpoint. Secret/approval/migration-apply mancanti → **`blocked-on-Enzo`**, mai "done". Ref: `CLAUDE.md §Definition of Done` + `docs/kb/COWORK_INBOX.md 2026-06-15` + repo plugin `docs/DEFINITION_OF_DONE.md`.

## 3. Work-item — dettaglio, sequenza, success criteria

> Ordine consigliato: **WI-A → WI-B (mock-first) → WI-C → pilota → WI-D**. Mock-first = il lifecycle (reference-backend `run-pilot.mjs`) gira contro la mock API prima del live.

### WI-A — Service user PLATFORM_ADMIN + esenzione MFA (login headless) ⚠ richiede conferma (security + migration)

**Obiettivo**: una identità di servizio capace di login headless (cookie-jar + refresh loop) per l'autoria catalogo (blueprint-*, job-families), senza essere bloccata dal gate MFA §3b.

**Meccanica di esenzione — 3 opzioni** (la scelta è una *security decision*, autorità Enzo):

| Opzione | Come | Migration | Robustezza | Rischio |
|---|---|---|---|---|
| **A1 — flag esplicito (raccomandata)** | colonna `user_mfa_exempt boolean DEFAULT false` su `sys_users` (o tabella `sys_auth_mfa_exemptions`), settata solo per il service user; guard `if (candidate.mfaExempt) skip gate` in `service.ts:§3b` **prima** di `beginLoginChallenge` | **Sì** (1 mig idempotente) | Alta (immune a future policy + a fattori) | tocca hot-path auth (~80 test sensibili) |
| **A2 — env allowlist (zero-migration)** | `MFA_EXEMPT_USER_EMAILS` / `_IDS` in `.env` per-host; il gate carica l'allowlist e salta | No | Media (config per-host, fuori DB) | drift `.env` cross-host (mitigato da `env-key-merge` denylist) |
| **A3 — esenzione naturale** | service user PLATFORM_ADMIN **tenant-null**, senza fattori | No | **Bassa/fragile** | si rompe con policy platform-wide o enrollment |

**Raccomandazione**: **A1** (flag esplicito + guard auditeable) — è ciò che il design chiama "exemption (config)" reso robusto. Difese compensative: password forte in secret store, scope minimo, audit `LOGIN_*` di ogni accesso, possibilità di disabilitare il flag.

**Sub-task** (su go): (1) mig flag/tabella esenzione (DO-NOT-APPLY ora); (2) guard nel gate §3b con DI seam (come `mfaEnforcement`); (3) seed service user (PLATFORM_ADMIN, credenziale ARGON2ID, flag esente) — analogo a `seed-test-admin.ts`, password da secret store; (4) integration test: login headless del service user = login pieno anche con policy enabled; un utente non-esente con policy enabled resta gated.
**Success criteria**: `POST /v1/auth/login` del service user → `status:"success"` + bundle (no `mfa_required`/`enrollment`), con `MFA_ENFORCEMENT_ENABLED=true` e una policy enabled in-scope; suite auth/mfa esistente verde (no regressione).

### WI-B — Backend Agent SDK + layer MCP (auth ibrido + CSRF + gate write)

**Collocazione (decisione tecnica)**: nuovo workspace **`apps/agent-gateway`** (TypeScript, allineato allo stack Node del monorepo; risponde all'open-point "TS vs Python" → **TS**). È un servizio a sé (Agent SDK runner + bridge HTTP/SSE), **non** un modulo Fastify `/v1/*` — non viola il module-pattern perché non aggiunge route `/v1`. Consuma l'API via HTTP come client.

**Componenti** (skeleton di riferimento già in `reference-backend/src/{mcp-tools.ts,sdk-agent.ts}` — da portare e *pinnare* ai simboli SDK installati):
- **MCP in-process** (`createSdkMcpServer`) che wrappa un client `/v1`: ogni write invia CSRF (`hrx_csrf` cookie + `x-csrf-token`); tenant **implicito dal JWT** (mai header tenant).
- **Auth ibrido**: ops user-scoped = cookie utente **forwarded** dalla webapp per request (RBAC/tenant naturali); autoria catalogo (`job-families` + `blueprint-*`) = sessione **service user** (login→cookie-jar→refresh<15m). Selezione principal **per-tool** (vedi mappa sotto).
- **Gate `canUseTool`** (chokepoint): reads → auto-allow; writes → `compliance-guard` (no solely-automated; PII redaction; named owner) + **approval round-trip** alla webapp (deny-by-default on timeout); bulk-apply blueprint = **un'unica** unità di approvazione plan/diff.
- **Audit** ≥6 mesi `{who, tenant, tool, args-hash, decision, ts}`.

**Mappa tool → permission → principal** (read auto / write gated):

| Tool (write) | VERB `/v1` | Permission | Principal |
|---|---|---|---|
| `hrx.org.units.{create,update,delete}` | POST/PATCH/DELETE `/organization-units` | `organization_unit:*` | user o service |
| `hrx.positions.{create,update,delete}` + `skills.{add,remove}` | `/positions*` | `position:*` | user o service |
| `hrx.jobRoles.{create,update}` | POST/PATCH `/job-roles` | `job_role:{create,update}` | user o service |
| `hrx.jobFamilies.{create,update,delete}` | `/job-families` | service-gate (no perm) | **service** |
| `hrx.skills.{create,update}` | POST/PATCH `/skills` | `skill:{create,update}` | user o service |
| `hrx.kpi.def.{create,update,delete}` | `/kpi-definitions` | `kpi:*` | user o service |
| `hrx.kpi.{process,orgUnit}Template.upsert` | **PUT** `/{process,organization-unit}-kpi-templates` | `bpm_process:update` | service |
| `hrx.blueprint.{family,variant,process}.*` | POST/PATCH/DELETE `/blueprint-*` | `blueprint:activate`/`:override` | **service** |
| `hrx.blueprint.activation.*` | POST/PATCH/DELETE `/blueprint-activations` | `blueprint:activate` | user (tenant-admin) |
| `hrx.blueprint.override.upsert` | **PUT** `/blueprint-overrides` | `blueprint:override` | user (tenant-admin) |
| `hrx.typing.profile.upsert` | **PUT** `/enterprise-typing-profiles` | `enterprise_typing:update` | user (tenant-admin) |
| `hrx.compensation.recommend` | POST `/compensation/recommendations` | `compensation_intelligence:update` | user (decision-support, I8) |
| `hrx.tenant.materialize` (**WI-C, Phase B**) | NEW endpoint | PLATFORM_ADMIN | service |

**Sub-task**: scaffolding `apps/agent-gateway` (package.json, tsconfig allineato a `tsconfig.base.json`); port mcp-tools/sdk-agent con pin SDK; client `/v1` con cookie-jar + refresh + CSRF; bridge HTTP/SSE + approval; integrazione `compliance-guard`/`hr-verifier`.
**Success criteria**: read-tool ritorna dati live come utente chiamante; write-tool **denied** senza approve, **applied** dopo approve; tenant mai spoofabile (deriva dal JWT); secret-scan pulito.

### WI-C — Generatore di materializzazione per-tenant (Phase B)

**Obiettivo**: trasformare un archetipo/variant attivato in **org-units + positions** (+ opz. users/assignments) dentro un tenant — l'endpoint mancante `hrx.tenant.materialize`.

**Forma (decisione)**: **modulo API** `tenant-materialization` (module-pattern a 7 step), `POST /v1/tenant-materialization` gated PLATFORM_ADMIN (service-gate come `job-families`) + `verifyCsrf`, **idempotente**, con **dry-run/plan** (ritorna il diff senza scrivere) e **apply**. Modella `seed-reference-bank.ts`: FK order `org-units → positions → (users → assignments)`, `ON CONFLICT (tenant_id, code) DO NOTHING/UPDATE`, `tenant_id` risolto/validato, lineage opzionale.

**Input**: `{ tenantId, source: variantId | archetypeKey, options }` → genera i record dall'archetipo (la struttura org/positions, **non** dal blueprint-variant che è solo header) e li applica al tenant.

**Sub-task**: schema shared Zod; repository raw SQL `withTransaction` + ON CONFLICT; service (resolve tenant, build records FK-order, dry-run/apply, scope PLATFORM_ADMIN); route; integration test (apply→re-apply idempotente, tenant isolation).
**Success criteria**: apply su un type-tenant crea org-units/positions; **re-apply = 0 scritture** (idempotente); righe taggate `tenant_id` corretto; dry-run = 0 scritture.

### WI-D — Opzionali (decide Enzo se/quali includere)

| # | Item | Cosa serve | Effort | Rischio | Dipendenza |
|---|---|---|---|---|---|
| **D1** | endpoint bulk-apply (lineage-imitating) | nuovo modulo `blueprint-apply` (o estensione) che accetta un payload generato e lo applica FK-order con il pattern wave-executor (NK+hash+ON CONFLICT+lineage). Il wave-executor **non** è riusabile (solo `wave` int) | M-L | MED | WI-B (il SDK può anche orchestrare le write una-a-una senza questo) |
| **D2** | campo ranking/priorità KPI | **schema addition**: `rank`/`priority smallint` su `sys_position_kpi_requirements` (+ eventualmente i 2 template) — oggi solo `weight`; + write-endpoint per-position KPI (oggi `/:id/kpis` è read-only) | S-M | MED (migration + API contract) | abilita il builder "8 KPI ranked" |
| **D3** | recommender typing→variant | net-new (non esiste): logica/endpoint che da `sys_enterprise_typing_profiles.size_band_id` (+ industry) suggerisce un `blueprint_variant` per banda | M | LOW-MED | `size_band_id` è l'unico hook |

---

## 4. Pilota — blueprint-builder archetipo banca retail (8 step)

Catena: `process-builder → orgunit-builder → orgchart-builder(+FTE) → area-grouping → [mermaid] → role-builder → skill-profile-builder → kpi-builder → blueprint-assembler`, attraverso il lifecycle **generate → verify(`hr-verifier`) → plan/diff → approve(`compliance-guard`+human) → apply → re-apply(idempotente)**.

**Separazione dei piani (chiave)**:
- **Phase A (catalogo, principal=service PLATFORM_ADMIN)**: `blueprint-families/variants/processes`, `process-kpi-templates`, `kpi-definitions`, `skills`, `job-families`, `job-roles`. PUT-upsert dove disponibile.
- **Phase B (istanza tenant, principal=user tenant-admin / generatore WI-C)**: `organization-units`, `positions`, `positions/:id/skills`, `enterprise-typing-profiles`, `blueprint-activations`, `blueprint-overrides`, `organization-unit-kpi-templates(instance)`.
- **Gap noto**: le "8 KPI ranked per il ruolo flagship" non sono scrivibili per-position oggi (read-only + no rank) → o restano a livello template (process/org-unit-kpi-templates con `weight`), o si abilita WI-D2.

**DoD pilota** (da `SDK_INTEGRATION_PLAN.md`): richiesta webapp *"genera e applica il blueprint banca-retail al tenant X"* → builders generate → diff mostrato → human approva → blueprint-variant persistito/attivato (Phase A) + org/positions materializzati (Phase B/WI-C) → audit loggato → reversibile. Reads come utente chiamante; writes solo dopo approve; nulla solely-automated.

---

## 5. Risk register (prob × impatto × mitigazione)

| Rischio | P | I | Mitigazione |
|---|---|---|---|
| Esenzione MFA indebolisce la postura auth | M | A | flag esplicito auditeable (A1), service user scope-minimo, audit login, kill-switch; **conferma Enzo** |
| Regressione hot-path auth (gate §3b, ~80 test) | M | A | DI seam come `mfaEnforcement`; full suite auth/mfa verde pre-commit |
| SDK symbol drift (`@anthropic-ai/claude-agent-sdk`) | M | M | pin alla versione installata; smoke `query()` minimale prima del pilota |
| Generatore Phase B non idempotente | B | A | ON CONFLICT + dry-run + test re-apply=0; backup pre-apply (op gated) |
| Scope creep opzionali D | M | M | D1/D2/D3 esplicitamente gated a decisione Enzo; non bloccano a/b/c |
| Tenant isolation bypass | B | A | tenant dal JWT (mai header); generatore applica `tenant_id`; test isolation |
| Secret leak (service user) | B | A | secret store/`.env` per-host, no-log, secret-scan pre-commit (R11) |
| Confusione Phase A vs B (variant≠archetipo) | M | M | separazione documentata §4; il variant resta header |

---

## 6. Migration inventory

**APPLICATE (su go "procedi" di Enzo, 2026-06-15)** — additive, idempotenti, default-safe:

| File | Work-item | Stato |
|---|---|---|
| `000116_mfa_exemptions.sql` | WI-A | **APPLICATA** (ledger id 6828, 2026-06-15 03:03) — `sys.sys_auth_mfa_exemptions` (auth-only I7) + registry D/EXCLUDE; **tabella vuota = login byte-identico a pre-000116** |
| `000117_mfa_exemption_eligibility.sql` | WI-A / M-8 | **APPLICATA** — trigger eligibilità (solo tenant-null OR PLATFORM_ADMIN) |

WI-A.2 (service user) = **0 migration** — script seed opt-in `db/scripts/seed-service-user.ts` (no-op senza `AGENT_SERVICE_USER_*`).

**PROPOSED / DA APPLICARE SOLO SU GO** (work-item successivi, numerazione dopo `000117`):

| # | Migration candidata | Work-item | Note |
|---|---|---|---|
| M4 | `rank` su `sys_position_kpi_requirements` + estensione VIEW PIP `sys_position_intelligence_profiles_v` (edge I9) + write-endpoint per-position KPI | WI-D2 | **abilitato** (decisione d) |
| M3 | (eventuale) tabella tracking/lineage del generatore Phase B | WI-C | spesso 0-migration (scrive su `sys_*` esistenti) |
| M0 | audit-sink del gateway (se persistito su DB) | WI-B / M-4 | registry row stessa migration (classe D-22) |
| M5 | recommender typing→variant | WI-D3 | **rinviato** |

---

## 7. Punti aperti — ✅ CHIUSI 2026-06-15 (delega Enzo, amendment Cowork — vedi §9)

> **Decisioni**: (1) esenzione MFA = **A1 flag-DB primario in `sys.sys_auth_mfa_exemptions`** (tabella `sys_auth_*` per **I7**, non colonna su `sys_users`) + **A3 tenant-null = difesa-in-profondità**; A2 scartata · (2) service user = **platform-level (tenant-null)** · (3) **`apps/agent-gateway` (TS) = SÌ** · (4) opzionali = **D2 abilitato; D1 e D3 rinviati** · (5) **KPI per-position con rank (= D2)** per il ruolo flagship (edge **I9**: estendere la VIEW PIP `sys_position_intelligence_profiles_v`, 000011:272-299). Dettaglio + 7 hardening M-1..M-7 in **§9**. Le voci sottostanti restano come storico della review.

*(storico — punti come presentati alla review)*:

1. **Meccanica esenzione MFA**: A1 (flag DB, raccomandata) vs A2 (env allowlist) vs A3 (naturale, sconsigliata). *Security call.*
2. **Tenant del service user**: platform-level (tenant-null) vs tenant HEURESYS. Raccomando platform-null + flag esplicito A1.
3. **Backend**: conferma `apps/agent-gateway` (TS) come collocazione.
4. **Opzionali D**: quali di D1/D2/D3 entrano nello scope (default: nessuno finché il pilota a/b/c non è verde).
5. **Pilota KPI per-position**: lasciare le KPI a livello template (no rank) o abilitare WI-D2 per le "8 KPI ranked".

---

## 8. Verifiche globali (gate di chiusura, in esecuzione futura)

`pnpm typecheck` 4/4 · `pnpm test` (API integration, incl. nuovi WI-A/WI-C) verde · pilota lifecycle `node reference-backend/run-pilot.mjs` (mock) verde → poi live · Playwright E2E del flusso webapp→approve→apply · secret-scan staged diff pulito · `db:validate` 7/7 + `migrate.sh` ×2 idempotente (se migration applicate).

---

## 9. AMENDMENT 2026-06-15 — review Cowork (GO-con-modifiche) + chiusura §7 (delega Enzo)

> Recepisce le entry `docs/kb/COWORK_INBOX.md` `2026-06-15 | REVIEW` + `2026-06-15 | AMENDMENT`. Verdetto **GO-con-modifiche** (PLAN nel "come"; invarianti I3/I4·I5·I8·ADR-0023·R11 coerenti; verifica forense §1 solida). §7 chiuso **su delega Enzo**; restano solo i **go operativi**. Nulla eseguito: DDL = PROPOSED.

### 9.1 — Chiusura §7 (5 decisioni)
- **(a) Esenzione MFA** = **A1 flag-DB CONTROLLO PRIMARIO** in nuova tabella **`sys.sys_auth_mfa_exemptions`** (tabella `sys_auth_*` — ancora **I7**, NON colonna su `sys_users`); **A3 tenant-null = difesa-in-profondità** (tensione A1↔A3 del §7.2 eliminata: A1 primario + A3 layer); **A2 (env) scartata**. Guard `auth/service.ts §3b` via DI seam (come `mfaEnforcement`, S989) + registry row nella stessa migration (classe D-22) + audit `LOGIN_*`.
- **(b) Tenant service user** = **platform-level (tenant-null)** (coerente §1.1 + catalogo globale: `job-families` `ensurePlatformAdmin`).
- **(c) `apps/agent-gateway` (TypeScript) = SÌ** (monorepo TS + skeleton reference TS + SDK TS-native; client HTTP di `/v1`, **non** modulo `/v1` → no violazione module-pattern; pin SDK).
- **(d) Opzionali**: **D2 ABILITATO; D1 e D3 RINVIATI.** D2 necessario (verificato: `positions/routes.ts:162 /:id/kpis` read-only + `sys_position_kpi_requirements` 000011:132 solo `weight`, no rank → "8 KPI ranked" non esprimibili). D1 coperto da SDK + WI-C; D3 = net-new senza precedente (no recommender, §1.8.7) → "cosa" separata (autorità Enzo).
- **(e) KPI per-position con rank (= D2)** per il ruolo flagship; i template (`*-kpi-templates`) restano per livelli aggregati. **Edge I9**: la PIP è una VIEW (`sys.sys_position_intelligence_profiles_v`, 000011:272-299, che già legge `sys_position_kpi_requirements`) → estenderla per esporre `rank`.

### 9.2 — 7 hardening pre-esecuzione (mappati al PLAN)

| # | Sev | Hardening | Dove |
|---|---|---|---|
| M-1 | HIGH | tenant isolation `tenant.materialize`: tenantId dall'input (gira PLATFORM_ADMIN tenant-null) → validazione esiste+ACTIVE + conferma tenant nell'approval + test negativi cross-tenant | §2 I5 (corretta) + WI-C |
| M-2 | HIGH | test adversarial `canUseTool`: replay token, timeout→deny-by-default, principal confusion user/service, write senza token | WI-B success criteria |
| M-3 | MED | I8 come **allowlist deny-by-default** esplicita del catalogo tool (non sola esclusione onboarding/recruit) | WI-B / §2 I8 |
| M-4 | MED | sink audit ≥6 mesi specificato; se tabella `sys_*` → registry row stessa migration (classe D-22) | WI-B + §6 |
| M-5 | MED | gateway→`/v1` rate-limit post-D-28 + CSRF lifecycle + mutex refresh proprio del service user | WI-A/WI-B |
| M-6 | LOW | idempotenza re-run pilota sull'attivazione (one-active-per-tenant → PATCH vs POST) | §4 pilota |
| M-7 | LOW | users materializzati Phase B = persone **credential-less**, non crosswalk `LEGACY_EMP::` (I14) | WI-C |

### 9.3 — Migration inventory (vedi §6 per lo stato applicazione)
- **000116** (`sys_auth_mfa_exemptions` + registry) + **000117** (M-8 eligibility trigger) = **APPLICATE** su go (WI-A).
- **M4 = D2**: colonna `rank` su `sys_position_kpi_requirements` + estensione VIEW PIP + write-endpoint per-position KPI (WI-D2, abilitato).
- **M5 = D3 NON creata** (rinviata).
- **+M0** audit-sink (solo se DB: tabella `sys_*` + registry row, classe D-22).
- Tutte idempotenti, numerazione dopo `000117`.

### 9.4bis — Re-review post-WI-A recepita (2026-06-15)
GO confermato. **M-8** implementato (trigger `000117` + test negativo/positivo). **V-1**: 000116/000117 APPLICATE su go (ledger confermato) → doc allineati (§6, header). **V-2**: path `exempt=true` testato (test "ACTIVE exemption"), negativo M-8 testato, seed service user = WI-A.2 scaffolding (opt-in); mutex refresh (M-5) → WI-B.

### 9.4 — Stato
Design **approvato (GO-con-modifiche)**, §7 chiuso. **Restano a Enzo solo i go operativi** (nessuna scelta §7 pendente). Ordine all'ok: **WI-A** (`sys_auth_mfa_exemptions` + guard §3b + service user) → WI-B (mock-first) → WI-C → pilota → WI-D2.

---

*Fine PLAN #9 (amendment 2026-06-15 incorporato). Prossimo passo: go operativo Enzo → esecuzione WI-A. Nessuna migration applicata.*
