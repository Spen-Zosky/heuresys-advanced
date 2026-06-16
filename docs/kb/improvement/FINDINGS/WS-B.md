# FINDINGS / WS-B — Backend & services (S-100X-A5)

> Audit forense **read-only** del workstream Backend & services: la 75-module Fastify API in `apps/api/src/modules/*`. Metodo: ispezione repo (`app.ts` 13-step chain · `errors/` · `middleware/{rbac,errorHandler,auth,requestId}.ts` · `db/client.ts` · `lib/notifications/emit.ts`) + 3 sub-agent read-only (boilerplate-cost · hot-path SQL quality · dead-modules + authz/tenant-IDOR) → sintesi main-thread (AUDIT_PROTOCOL §4). Evidenza: `path:linea` reali + counts misurati con `grep`/`wc`. **Zero modifiche a codice/test/config, zero scritture DB.** Data: 2026-06-16 (S-100X-A5). Classificazione: `AUDIT_PROTOCOL.md`.
>
> **Invarianti rispettate (NON flaggate come bug)**: I1 position-centric · I5 tenant=FK+middleware (NO RLS) · raw parameterized SQL (no query builder, ADR-0003 superseded — `db/client.ts:5-7`) · I7 auth separato. Questi sono scelte architetturali deliberate.

## Headline (cosa cambia rispetto a WS-C e WS-G)

1. **🔴 CRITICAL B-1 — `POST /v1/notifications` broadcast è un N+1 illimitato pilotato da admin**: `notifications/service.ts:32-44` itera su `recipients` (i `body.userIds` admin-forniti, **0 cap nello Zod**) e chiama `emitNotification(pool, …)` per ciascuno; ogni emit fa **2-3 round-trip** (pref-SELECT `emit.ts:47` + dedupe-SELECT opzionale `:57` + INSERT `:71`). Un broadcast a N utenti = `1 + N×(2..3)` query serializzate sullo stesso pool da 20 connessioni. Su un tenant grande (RTL_BANK 161 utenti, o un `userIds` pompato) è un self-DoS sul pool prod condiviso. **Cross-ref WS-C F-WS-C-1**: le tabelle toccate (`sys_notification_preferences`, `sys_inbox_notifications`) sono tra quelle senza indice di supporto su `(user_id, …)` → il pref-SELECT degrada.
2. **🟠 HIGH B-2 — 4 list-endpoint business SENZA `LIMIT` ritornano l'intera tabella al client** (`insights` flight-risk/readiness/skill-gap `repository.ts:273,537,574` · `engagement.listSurveys:19-30` · `organization-unit-processes:123,152` · `content-blueprint-links:114,159,177`). Su scope PLATFORM_ADMIN `insights` ed `engagement` restituiscono **cross-tenant** senza paginazione: O(headcount) e O(#survey-di-tutti-i-tenant). Le altre 4 tabelle no-LIMIT (`enterprise-size-bands`/`operating-models`/`skill-proficiency-levels`/`mfa-policy`) sono cataloghi bounded → OK.
3. **🟡 MEDIUM B-3 — costo boilerplate del module-pattern replicato 75× è il debito DX dominante (QW-B candidato forte, ma non security)**: **28.352 LOC** in `repository.ts`(15.631)+`service.ts`(7.893)+`routes.ts`(4.828). Duplicazioni misurate: **71** helper `actor(req)` (69 byte-identici) · **73** type `ActorContext` (72 identici) · **58** predicate `isPlatform` one-liner · **67** row-mapper `toX` hand-written · **~60** campi Zod `limit/offset` ridichiarati con cap **inconsistenti** (200×54, 500×11, 1000×1, 50×2). **Nessun** helper condiviso esiste (`lib/` ha solo `export/` + `notifications/`). Una estrazione meccanica (`ActorContext` + `actor()` + `isPlatform()` + `paginationSchema(max)`) collassa **~150 dichiarazioni duplicate** in ~4 definizioni, coperta dai 576 test esistenti.
4. **Asset strutturali forti confermati**: **tenant-isolation/IDOR = PULITO** (8+ moduli sampled, fetch-then-check-with-404 uniforme, 0 vie per leggere/mutare righe cross-tenant by-UUID) · **dead-modules = ZERO** (75/75 registrati, 0 prefix-collision, 0 dead-export nel sample, 0 hard-coded-data) · **shared pool = pulito** (1 solo `new pg.Pool` in `db/client.ts:15`, 0 client paralleli) · **SQL-injection = ZERO unsafe** (ogni `${}` è placeholder-num o costante whitelisted) · **error-handling uniforme** (typed-class → envelope `{error:{code,message}}` centralizzato) · **13-step plugin chain corretta**.
5. **`withTransaction` esiste ed è corretto, ma vive nel posto sbagliato**: definito una sola volta in `auth/repository.ts:542` (BEGIN/COMMIT/ROLLBACK/release impeccabile) e importato da 4 moduli (`auth`, `content`, `reference-sync`, +self). È una utility db **generica** sepolta nel modulo auth → import cross-module `from "../auth/repository.js"` per una primitiva che dovrebbe stare in `db/client.ts`. Smell di layering, non bug.

---

## Gruppo A — Hot-path SQL quality (N+1, pagination, SELECT *)

### F-WS-B-1 — `POST /v1/notifications` broadcast: N+1 illimitato admin-driven (1 + N×2-3 query)
- Severità: **CRITICAL** | Flag: **QUICK-WIN** (cap + batch) / DOSSIER (set-based rewrite)
- Evidenza:
  - `notifications/service.ts:32` `for (const r of recipients)` → `:33 emitNotification(pool, …)` per destinatario.
  - `lib/notifications/emit.ts:47` pref-SELECT + `:57` dedupe-SELECT (se `dedupe`) + `:71` INSERT → **2-3 query per recipient**.
  - `recipients` deriva da `body.userIds` (`:24 WHERE user_id = ANY($1)`); lo schema `BroadcastNotificationBody` **non ha `.max()`** sull'array `userIds` (verify: grep su `packages/shared/src/schemas/notifications.ts`). Un admin (o un TENANT_ADMIN sul proprio tenant, I5-filtered `:29`) può passare un array arbitrariamente grande.
  - Pool `max:20` (`db/client.ts:22`), query serializzate (`await` in loop) → con N=161 (RTL_BANK) = ~322-483 round-trip sequenziali su una sola route call.
- Impatto: **perf/robustezza** (self-DoS sul pool prod condiviso CI+PROD — cross-ref WS-G F-WS-G-3 DB condiviso) + amplificato da WS-C F-WS-C-1 (pref-SELECT su `sys_notification_preferences` senza indice `(user_id,type)` di supporto)
- Baseline: 1 SELECT recipients + N×(2-3) query; 0 cap su `userIds`; 0 batching.
- Proposta: **QUICK-WIN** = (a) `.max(500)` su `userIds` nello schema; (b) riscrivere `broadcast` come **una** `INSERT … SELECT … FROM unnest($userIds) JOIN sys_users … LEFT JOIN sys_notification_preferences … WHERE pref enabled` set-based (1-2 query totali invece di 1+N×3), riusando la logica dedupe via `ON CONFLICT`/`NOT EXISTS`. **Gate**: test `notifications.integration` verde; un broadcast a 161 utenti emette in ≤2 query (verifica via `pg_stat_statements` o log) e ritorna lo stesso `{requested, emitted}`.

### F-WS-B-2 — 4 list-endpoint business senza `LIMIT` → full-table al client (insights/engagement cross-tenant)
- Severità: **HIGH** | Flag: **QUICK-WIN** (insights+engagement) / DOSSIER (policy paginazione uniforme)
- Evidenza (8 repo senza `LIMIT`, 4 risk / 4 OK):
  - **RISK**: `insights/repository.ts:273` (flight-risk) `:537` (readiness) `:574` (skill-gap) → O(headcount), e su scope PLATFORM_ADMIN **cross-tenant** (dati sensibili D-6). `engagement/repository.ts:19-30 listSurveys` → PLATFORM_ADMIN ottiene i survey di **tutti** i tenant, no LIMIT. `organization-unit-processes/repository.ts:123,152` (RACI, scala con org). `content-blueprint-links/repository.ts:114,159,177` (tutti i link di una variant).
  - **OK (catalogo bounded)**: `enterprise-size-bands:47` (5 righe) · `operating-models:28` (curato) · `skill-proficiency-levels:40` (6 righe) · `mfa-policy:51` (1 riga/tenant UNIQUE).
- Impatto: perf/robustezza (payload illimitato, latenza che cresce coi dati) + (insights) info-volume cross-tenant
- Baseline: 4 list business no-LIMIT; insights = 3 read no-LIMIT su tabelle O(employees).
- Proposta: **QUICK-WIN** = aggiungere `LIMIT/OFFSET` + cap Zod su `insights` ed `engagement.listSurveys` (allinea al pattern degli altri ~59 repo). **DOSSIER** = policy paginazione uniforme (vedi F-WS-B-6). **Gate**: list insights/survey ritorna pagina capped; test insights/engagement verdi.

### F-WS-B-3 — N+1 secondari su path my-team e reference-sync ESCO
- Severità: **MEDIUM** (teams) / **HIGH** (reference-sync background) | Flag: QUICK-WIN
- Evidenza:
  - `teams/repository.ts:147-151 findTeamsForUser`: `for (const row of res.rows) { loadTeamMembers(pool, row.team_id) }` → 1 query membri **per team**; backa `GET /v1/me/team`. Tecnicamente illimitato, in pratica pochi team/utente.
  - `reference-sync/repository.ts:142-152`: una `UPDATE sys.sys_skills` **per riga** della gerarchia ESCO, mentre funzioni sorelle nello stesso file batchano via VALUES chunked. Migliaia di skill → migliaia di UPDATE in un job di background dentro tx.
  - `insights/service.ts:43-62`: `emitNotification` per soggetto skill-gap, ma **capped a 50** (`.slice(0,50)`) e background → MED.
  - `auth/service.ts:613-632` password-reset per-utente: email-keyed, ≤1 riga → LOW.
- Impatto: perf (teams: latenza /me/team) / robustezza (reference-sync: durata job)
- Proposta: **QUICK-WIN** teams = una sola query membri con `team_id = ANY($team_ids)` poi group in TS. reference-sync = batch UPDATE via `unnest`/VALUES come le sorelle. **Gate**: `/v1/me/team` emette 2 query (teams + membri-batch); reference-sync ESCO sync usa N_chunk query invece di N_rows.

### F-WS-B-4 — ASSET: `SELECT *` (4 occorrenze) tutte sicure (lateral subquery o VIEW, mai sul wire)
- Severità: INFO | Flag: ASSET
- Evidenza: `compensation/repository.ts:196,235` (`SELECT *` dentro `LEFT JOIN LATERAL … LIMIT 1` su `sys_reward_gate_results`; l'outer proietta colonne esplicite `latest.reward_gate_result_*`) · `me/repository.ts:610` (lateral su `sys_user_kpi_evidence`, outer proietta `ev.user_kpi_evidence_*`) · `positions/repository.ts:282` (`SELECT * FROM sys.sys_position_intelligence_profiles_v` = **VIEW** I9/ADR-0008, mappata field-by-field in `toPip`). Nessuna espone colonne base-table al response contract.
- Proposta: **NESSUNA azione** — nota MED cosmetica: i 2 lateral potrebbero proiettare le colonne usate per chiarezza, ma il contratto è già l'outer projection.

### F-WS-B-5 — ASSET: SQL-injection = 0 unsafe; shared pool pulito; transazioni dove servono
- Severità: INFO | Flag: ASSET
- Evidenza:
  - **Injection**: ogni `${}` in stringa SQL è (i) idioma placeholder `$${params.length}`, (ii) `${COLS}` costante module-level, (iii) frammento WHERE hard-coded, o (iv) whitelist chiusa (`dashboard/repository.ts:350-364` su `TREND_ENTITIES` frozen; `add(col,value)` helper con `col` sempre literal al call-site, value parametrizzato). **0 interpolazioni di valori request-derived.** (brownfield usa `pg-format` `%I`/`%L`; un residuo manuale `engine.ts:205` escape identifier è admin-ETL only, non esposto.)
  - **Pool**: `grep "new pg.Pool\|new pg.Client"` = **1 hit** (`db/client.ts:15`). Ogni repo prende `DbConnector = Pool | PoolClient` come parametro e riceve il singleton iniettato. 0 leak.
  - **Transazioni**: il sospetto D-18 (delete-then-insert insights) è **CTE atomica** (`insights/repository.ts:205-228` `WITH del AS (DELETE…) INSERT…` — atomico anche su Pool). succession/semantic-matching = single-write o `ON CONFLICT`. Unico multi-write-senza-tx genuino: `brownfield-wave-executor/upsert-sql.ts:268-1059` (3 write dipendenti per mapping, try/catch log-and-continue) → **MED mitigated-by-design** (PLATFORM_ADMIN-only, idempotente ON CONFLICT, FSM-resumable).
- Proposta: **NESSUNA azione** (eccetto la nota brownfield in F-WS-B-9).

---

## Gruppo B — Module-pattern boilerplate cost (QW-B candidato)

### F-WS-B-6 — Module-pattern replicato 75× = 28.352 LOC con ~150 dichiarazioni duplicate, 0 helper condivisi
- Severità: **MEDIUM** | Flag: **QUICK-WIN** (estrazione meccanica) / DOSSIER (helper CRUD/list generico)
- Evidenza (baseline misurata `wc -l` aggregato):

  | Artefatto duplicato | Count | Identici? | Replacement esiste? |
  |---|---|---|---|
  | helper `actor(req)` in routes.ts | **71** (69 exact + 3 variant) | sì | No — ma `AuthUser` (`middleware/auth.ts:14`) è già la shape |
  | type `ActorContext` in service.ts | **73** (72 identici + 1 variant) | sì | No def canonica da nessuna parte |
  | predicate `isPlatform`/platform-admin | **58** (1-liner identico) | sì | No |
  | predicate `visible(actor,row)` | **22** (near-identico) | ~ | No |
  | row-mapper hand-written `toX`/`rowToX` | **67** (meccanico) | meccanico | No (0 alias `AS camelCase` SQL-side) |
  | `LIMIT/OFFSET` hand-rolled | **59** | strutturale | No |
  | `count(*)` total hand-rolled | **65** | strutturale | No |
  | campi Zod `limit/offset` per-modulo | **~60** | strutturale, cap **incoerenti** | No schema condiviso |
  | `const COLS` column-list | **52** | strutturale | No |

  - LOC: `repository.ts`=15.631 · `service.ts`=7.893 · `routes.ts`=4.828 → **28.352**.
  - Canonical `actor()` (`skill-families/routes.ts:24-27`, identico in 67 altri): `if (!req.user) throw new UnauthorizedError(...); return { userId, tenantId, roles };`. 3 variant: `tenants`/`users` lo chiamano `actorFromReq`; `reference-sync/routes.ts:27` ritorna solo `{ userId }` (system-run).
  - Cap paginazione **incoerenti**: `max(200)`×54, `max(500)`×11, `max(1000)`×1 (`visualization-node-layouts.ts:23`), `max(50)`×2.
- Impatto: **DX/footprint** (manutenzione 75× per ogni cambio di pattern; rischio drift) — **non security** (le 71 `actor()` sono identiche, le caps esistono tutte).
- Baseline: 28.352 LOC, ~150 dichiarazioni `actor()`+`ActorContext` duplicate, 58 `isPlatform`, ~60 campi paginazione.
- Proposta: **QUICK-WIN** (meccanico, coperto dai 576 test): (1) un `ActorContext` condiviso + `actor(req)` (o decorator `req.actor()`) ancorato a `AuthUser` → collassa **144** dichiarazioni in 2; (2) `isPlatform(actor)` condiviso → retira 58; (3) `paginationSchema(max)` factory + `listQuery` repo-helper → retira ~60 schema e **standardizza i cap**. **DOSSIER** = un CRUD-repository generico (table/cols-driven) è high-reward ma alto-effort (tocca 74 repo) → decide Enzo. **Gate per ogni step**: `pnpm typecheck` + `pnpm test` (576) verdi a parità di comportamento; diff puramente meccanica.

### F-WS-B-7 — `withTransaction` (utility db generica) sepolta in `auth/repository.ts` → import cross-module innaturale
- Severità: **LOW** | Flag: **QUICK-WIN**
- Evidenza: `withTransaction<T>` definita a `auth/repository.ts:542-563` (BEGIN/COMMIT/ROLLBACK/`client.release()` corretti). Importata da `content/repository.ts`, `reference-sync/repository.ts`, `auth/service.ts`, `auth/webauthn-service.ts` → i moduli non-auth fanno `import { withTransaction } from "../auth/repository.js"` per una primitiva che è puramente DB-layer.
- Impatto: DX/footprint (layering: un modulo business dipende dal modulo auth per una utility db)
- Proposta: **QUICK-WIN** = spostare `withTransaction` in `db/client.ts` (accanto a `pool`) + aggiornare i 4 import. Zero cambiamento di comportamento. **Gate**: `pnpm typecheck` + test auth/content/reference-sync verdi.

---

## Gruppo C — Plugin chain, error handling, RBAC

### F-WS-B-8 — ASSET: 13-step plugin chain corretta + error-handling uniforme tipizzato
- Severità: INFO | Flag: ASSET
- Evidenza:
  - **Chain** (`app.ts:184-415`): (1) Zod compilers `:185-186` → (2) requestId `:212` → (3) helmet `:236` → (4) cors `:249` → (5) cookie `:256` → (6) JWT RS256 `:262` → (7) rate-limit `:282` → (8) auth decode-only `:289` → (9) CSRF `:292` → (10) tenantContext `:295` → (11) errorHandler `:298` → (12) health `:301-309` → (13) module routes `:334-415`. Ordine = doc `§3.2`. Hook lifecycle (metrics `:218`, export `:233`) inseriti correttamente fuori-banda con guard try/catch (metrics `:225` "must never break the response").
  - **Error-handling**: `errors/index.ts` 11 classi tipizzate (`ApiError` base + 10 subclassi, ognuna con `code` SCREAMING_SNAKE). `errorHandler.ts` mappa ognuna a uno status+envelope `{error:{code,message[,details]}}` deterministico, con anti-enumeration su `TenantBoundaryViolation→404` (`:64-71`) e fallback `INTERNAL_ERROR/500` su unhandled `:111-114`. `rate-limit` rispetta `retryAfterSeconds` `:78-80`.
- Proposta: **NESSUNA azione**. **Nota INFO doc-drift**: CLAUDE.md ("apps/api — the heart") descrive l'envelope come `{error:{code, message, requestId}}`, ma `errorHandler.ts:32-114` **NON include `requestId` nel body** — il requestId è invece esposto come **response header** `x-request-id` (`requestId.ts:21`). Allineare la doc (l'header è la fonte di correlazione, non il body).

### F-WS-B-9 — Catalog read-permission inconsistente + `job-families` unica route senza `requirePermission` (entrambi funzionalmente safe)
- Severità: **LOW** (catalog) / **INFO** (job-families) | Flag: DOSSIER (consistency) / NOTE
- Evidenza:
  - `382` chiamate `requirePermission(` su `389` route mutating+read; **1 solo** file routes.ts senza alcun `requirePermission`: `skill-proficiency-levels/routes.ts` (read-only seeded catalog, qualsiasi autenticato lista — **intenzionale**, `service.ts:3-4`).
  - **Inconsistenza catalog**: `skill-categories`/`skill-families`/`skill-aliases`/`skill-taxonomy-edges` aprono la **read** a qualsiasi autenticato (no permission), mentre il fratello strutturale `job-roles` **richiede** `job_role:read`. Tabelle global-catalog senza `tenant_id` → non è un tenant-leak, ma divergenza di policy su tassonomie strutturalmente identiche.
  - **`job-families`**: unico modulo con **0 route-level `requirePermission`** su qualsiasi endpoint; le write sono però protette a **service-level** (`ensurePlatformAdmin()` in create/update/delete `service.ts:46,58,67`) + CSRF (`routes.ts:41,49,54`). Documentato intenzionale (nessun permission `job_family` nel seed RBAC).
- Impatto: DX/consistenza (info-disclosure di tassonomia non-sensibile a qualsiasi autenticato; eccezione al doctrine "ogni route ha requirePermission")
- Proposta: **DOSSIER** = decidere una policy uniforme per i cataloghi global (tutti `*:read` o tutti open-to-authenticated). **NOTE** job-families: allineare a route-level RBAC quando/se si aggiunge un permission `job_family:*` al seed. Nessun buco di sicurezza.

### F-WS-B-10 — ASSET: tenant-isolation/IDOR pulito (fetch-then-check-with-404 uniforme) + dead-modules ZERO
- Severità: INFO | Flag: ASSET
- Evidenza:
  - **IDOR**: 8+ moduli sampled con getById/update/delete (kpi-definitions, skills, positions, learning-modules, succession-pools, organization-units, compensation, predictions, +visualization-nodes via parent-graph, +content-blueprint-links via parent-document) **tutti** verificano `row.tenantId === actor.tenantId` (o `ensureSameTenant`/`visible`/`assertVisible`) prima di ritornare/mutare, lanciando `NotFoundError` (anti-enumeration) su accesso cross-tenant. **0 vie** per leggere/mutare una riga di un altro tenant by-UUID. Mix SQL-filter su LIST + fetch-then-check su getById, entrambi safe.
  - **Dead-modules**: 75/75 directory hanno routes.ts registrato in `app.ts:334-415`; **0 orphan**; `/v1/content` registrato 2× (`contentRoutes`+`contentMediaRoutes`) ma path **disgiunti** (categories/search/:id vs /:id/media); `/v1/brownfield/wave-executor` nested, no collision; 0 dead-export nel sample (es. `teamsService.myTeams` non chiamato in teams ma live via `me/routes.ts:197`); **0 hard-coded business-data** (dashboard/analytics/predictions/insights compongono tutto da `repo.*`; i literal sono scoring-weights su feature DB-derived).
- Proposta: **NESSUNA azione** — sono le fondamenta da non regredire.

---

## Quick wins (QW-B*) — CLASS-A estraibili (indipendenti, low/zero rischio)

- **QW-B1** — `notifications.broadcast` set-based + cap `userIds` [F-WS-B-1]. **Gate**: broadcast a 161 utenti emette in ≤2 query (verifica log/`pg_stat_statements`); `.max(500)` su `userIds`; `notifications.integration` verde a parità di `{requested,emitted}`.
- **QW-B2** — `LIMIT`+cap su `insights` (3 read) ed `engagement.listSurveys` [F-WS-B-2]. **Gate**: ogni list ritorna pagina capped; suite insights/engagement verde.
- **QW-B3** — de-N+1 su `teams.findTeamsForUser` (membri batch `team_id = ANY($1)`) [F-WS-B-3]. **Gate**: `/v1/me/team` emette 2 query; test teams/me verdi a parità di payload.
- **QW-B4** — estrazione `ActorContext`+`actor()`+`isPlatform()` condivisi (collassa ~150 duplicati) [F-WS-B-6]. **Gate**: `pnpm typecheck`+`pnpm test`(576) verdi; diff puramente meccanica, zero cambio comportamento.
- **QW-B5** — `paginationSchema(max)` factory + standardizza i cap incoerenti (200/500/1000) [F-WS-B-6]. **Gate**: i ~60 schema list usano il factory; i18n/test invariati.
- **QW-B6** — sposta `withTransaction` in `db/client.ts` + aggiorna i 4 import [F-WS-B-7]. **Gate**: `pnpm typecheck` + test auth/content/reference-sync verdi.
- **QW-B7** — allinea la doc CLAUDE.md sull'envelope errore (`requestId` è header `x-request-id`, non body) [F-WS-B-8]. **Gate**: doc-only.

> Tutti i QW restano **doc-only in questa fase A** (read-only). Candidati fase E su go di Enzo, su branch, con i gate sopra.

---

## ASSET confermati (NON regredire senza dossier)

- **Tenant-isolation/IDOR pulito**: fetch-then-check-with-404 uniforme su tutti i moduli tenant-scoped; 0 IDOR [F-WS-B-10].
- **Dead-modules ZERO**: 75/75 registrati, 0 orphan, 0 prefix-collision, 0 dead-export, 0 hard-coded-data [F-WS-B-10].
- **Shared pool unico** (`db/client.ts:15`, +listener idle-error anti-crash) + raw parameterized SQL, 0 injection unsafe, 0 client paralleli [F-WS-B-5].
- **13-step plugin chain** corretta + **error-handling tipizzato uniforme** (11 classi → envelope deterministico, anti-enumeration su tenant-boundary) [F-WS-B-8].
- **RBAC route-level** quasi-totale (382 `requirePermission`, 190 `verifyCsrf` su 189 state-changing route) + cache in-memory caricata a boot [rbac.ts] [F-WS-B-9].
- **`withTransaction` corretto** (BEGIN/COMMIT/ROLLBACK/release) — solo da rilocare [F-WS-B-7].

---

## Baseline Backend & services (misure reali — aggiorna `BASELINE_METRICS.md`)

| Metrica | Valore reale | Comando/Fonte |
|---|---|---|
| Moduli API | **75** (74 con repository.ts; `auth` usa cross-module repos) | `ls -d modules/*/` |
| Route declarations (`/v1/*`) | **399** (210 GET · 80 POST · 54 DELETE · 46 PATCH · 9 PUT) | `grep app.(get\|post\|…) */routes.ts` |
| `requirePermission` | **382** | `grep` su `*/routes.ts` |
| `verifyCsrf` | **190** su **189** route state-changing | `grep` |
| routes.ts senza requirePermission | **1** (`skill-proficiency-levels`, intenzionale) + `job-families` (service-level authz) | per-file check |
| LOC repository.ts | **15.631** (74 file) | `cat */repository.ts \| wc -l` |
| LOC service.ts | **7.893** (75 file) | `cat */service.ts \| wc -l` |
| LOC routes.ts | **4.828** (75 file) | `cat */routes.ts \| wc -l` |
| helper `actor(req)` duplicati | **71** (69 byte-identici) | sub-agent grep |
| type `ActorContext` duplicati | **73** (72 identici) | sub-agent grep |
| predicate `isPlatform` duplicati | **58** | sub-agent grep |
| row-mapper hand-written | **67** | sub-agent grep |
| campi Zod limit/offset duplicati | **~60** (cap incoerenti 200/500/1000/50) | sub-agent grep |
| `SELECT *` | **4** (tutte lateral-subquery o VIEW, mai sul wire) | `grep` |
| `new pg.Pool/Client` | **1** (`db/client.ts:15`) | `grep` |
| N+1 illimitati admin-driven | **1 CRITICAL** (notifications broadcast) | `service.ts:32` + `emit.ts` |
| list business no-LIMIT | **4** (insights×3, engagement, org-unit-processes, content-blueprint-links) | `grep LIMIT` per-repo |
| SQL injection unsafe | **0** | sub-agent audit `${}` |
| IDOR / cross-tenant by-UUID | **0** | sub-agent audit 8+ moduli |
| `withTransaction` def | **1** (`auth/repository.ts:542`), 4 importer | `grep` |

**Insight chiave**: il backend è **strutturalmente sano e sicuro** (0 IDOR, 0 dead-module, 0 injection, error-handling+chain corretti, pool unico). Le 2 leve a maggior impatto sono entrambe **perf su path non governati**: (1) il **broadcast notifications N+1 illimitato** (unico CRITICAL — admin-driven self-DoS sul pool prod condiviso, amplifica WS-C F-WS-C-1) e (2) i **4 list business senza LIMIT** (insights/engagement cross-tenant O(headcount)). Il debito DX dominante è il **costo boilerplate del module-pattern** (28.352 LOC, ~150 dichiarazioni duplicate, 0 helper condivisi) — estraibile meccanicamente sotto la rete dei 576 test.

---

## Roll-up → candidati (decide Enzo per-finding; questo è un audit, non un fix)

**Dossier (richiedono decisione Enzo):**
- D — **CRUD/list-repository helper generico** (table/cols-driven) vs lasciare il pattern esplicito 74× [F-WS-B-6] — alto-reward/alto-effort.
- D — **policy paginazione uniforme** (cap standard + `LIMIT` obbligatorio su ogni list business) [F-WS-B-2/F-WS-B-6].
- D — **policy read-permission cataloghi global** (tutti `*:read` o tutti open-to-authenticated; allineare job-roles vs job-families/skill-*) [F-WS-B-9].

**Quick-wins CLASS-A** (eseguibili su go, gate espliciti sopra): QW-B1 broadcast set-based+cap · QW-B2 LIMIT insights/engagement · QW-B3 de-N+1 teams · QW-B4 ActorContext/actor()/isPlatform() condivisi · QW-B5 paginationSchema factory · QW-B6 riloca withTransaction · QW-B7 fix doc envelope.

**Asset da NON regredire**: tenant-isolation/IDOR pulito · dead-modules ZERO · shared pool unico + 0 injection · 13-step chain + error-handling tipizzato · RBAC route-level + CSRF · withTransaction corretto.

---

*Audit S-100X-A5 — read-only, ispezione repo + 3 sub-agent read-only + sintesi main-thread. Nessuna modifica a codice/test/config, zero scritture DB. Cross-ref: WS-C (F-WS-C-1 FK senza indice → amplifica B-1/B-2; F-WS-C-4 auth-token bloat) + WS-G (F-WS-G-3 DB CI condiviso → B-1 self-DoS impatta PROD). I finding confluiscono nel registro dossier 100X — decisione per-finding di Enzo.*
