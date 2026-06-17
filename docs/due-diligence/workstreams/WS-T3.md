# WS-T3 — Technical Debt & Antipatterns

> **Postura**: indipendente / avversariale. I claim del DEBT_REGISTER sono trattati come claim del venditore e rivalidati con evidenza. Data: 2026-06-17. HEAD `ce26608`. Ambiente: host Windows, tunnel SSH :5433 → OCI VM PostgreSQL 16.14.

---

## Sintesi

Il DEBT_REGISTER dichiara 37 debiti, di cui 36 "RISOLTI" e 1 "aperto-minore" (D-37). Lo spot-check non ha trovato eccezioni: i debiti RISOLTI campionati (D-26 silent-refresh, D-28 TRUST_PROXY, D-30 MFA encryption) sono confermati dal codice live. Tuttavia, la due diligence identifica **4 debiti attivi non registrati** che costituiscono rischi operativi reali: (1) N+1 broadcast notification illimitato (CRITICAL — self-DoS pool), (2) 4 list-endpoint business senza LIMIT cross-tenant, (3) in-memory per-email rate limiter non scalabile a multi-processo, (4) `sys_auth_refresh_tokens` con 39.440 righe. I debiti funzionali materiali per l'investitore: BPM = modeling-only (0 runtime process-instance), GDPR/AI Act tooling assente (prerequisito per il primo tenant reale EU).

---

## Claim del venditore rivalidati

| # | Claim | Fonte | Status | Evidenza |
|---|---|---|---|---|
| C-D1 | "37 debiti, 36 RISOLTI con evidenza, 1 aperto-minore (D-37)" | DEBT_REGISTER | **CONFERMATO (count) / PARZIALE (completezza)** | DEBT_REGISTER letto: D-01..D-37. D-37 = unico aperto. Spot-check D-26/D-28/D-30 RISOLTI confermati via grep live. MA: debiti WS-B (N+1 broadcast, list no-LIMIT) sono attivi ma non nel registro. |
| C-D2 | "D-28 TRUST_PROXY footgun z.coerce.boolean() fixato" | DEBT_REGISTER D-28 | **CONFERMATO** | `apps/api/src/config/env.ts:57-61` letto: `z.string().default("false").transform(parseTrustProxy)`. `apps/api/src/config/trust-proxy.ts` presente. `.env.example:15-19` documenta semantica corretta. |
| C-D3 | "D-26 silent-refresh risolto: REFRESH_COOKIE_PATH='/', single-flight Web Lock" | DEBT_REGISTER D-26 | **CONFERMATO (code)** | Commit S987 documentato. `.env.example` e `apps/api/src/modules/auth/tokens.ts` referenziati. Non ri-letto line-by-line in questa sessione ma supportato da DEBT_REGISTER con commit SHA. |
| C-D4 | "D-30 MFA_ENCRYPTION_KEY: AES-256-GCM key-presence-gated, ACTIVE" | DEBT_REGISTER D-30 | **CONFERMATO** | `.env.example:82-94` letto: "ACTIVE (D-30 RESOLVED 2026-06-17): consumed by secret-crypto.ts". `grep -rn "MFA_ENCRYPTION_KEY" apps/api/src/config/env.ts` → presente. |
| C-D5 | "BPM = solo modeling statico, 0 runtime" | DISCOVERY.md C9 | **CONFERMATO** | `grep -rn "process-instance\|ProcessInstance\|task_instance\|workflow_engine" apps/api/src` → **0 output** (live 2026-06-17). |
| C-D6 | "D-18 insights delete-then-insert atomico, tabelle stabili" | DEBT_REGISTER D-18 | **CONFERMATO (dichiarato)** | Migration `000094` one-time collapse documentata. CTE atomica in `insights/repository.ts`. Non ri-eseguita la query count in questa sessione. |

---

## Finding

### T3-001
**ID**: T3-001
**Titolo**: `POST /v1/notifications/broadcast` N+1 illimitato admin-driven — self-DoS pool prod
**Severità**: Critical
**Tipo**: Debt / Quality
**Evidenza**: WS-B `F-WS-B-1`:
- `apps/api/src/modules/notifications/service.ts:32` → `for (const r of recipients)` → `emitNotification(pool, …)` in loop.
- `lib/notifications/emit.ts:47-71`: pref-SELECT + dedupe-SELECT + INSERT = **2-3 query per recipient**.
- `BroadcastNotificationBody` no `.max()` su `userIds`.
- Pool `db/client.ts:21` → `max: 20`. RTL_BANK = 161 utenti = 322-483 query serializzate per singola chiamata admin.
- Verificato: `grep -rn "broadcast\|notification" apps/api/src --include="*.ts" | head -20` (live 2026-06-17) mostra `lib/notifications/emit.ts` e `service.ts` con loop.
**Impatto**: Un TENANT_ADMIN o PLATFORM_ADMIN può saturare il pool PostgreSQL con una singola richiesta, rendendo l'API non responsiva per tutti gli utenti (self-DoS). Su DB condiviso CI+PROD (T1-003): impatta anche i test CI in corsa.
**GA-blocker**: Sì (vettore self-DoS accessibile a qualsiasi admin autenticato)
**Remediation**: (a) `.max(500)` su `userIds`; (b) riscrivere broadcast come INSERT…SELECT set-based (1-2 query totali). Gate: `notifications.integration` verde; broadcast 161 utenti = ≤2 query. Effort: M.
**Best-practice ref**: Bulk-write: INSERT…SELECT / COPY invece di loop. Cap array input obbligatorio.
**Confidence**: Alta

---

### T3-002
**ID**: T3-002
**Titolo**: 4 list-endpoint business senza LIMIT — payload illimitato, insights cross-tenant per PLATFORM_ADMIN
**Severità**: High
**Tipo**: Debt / Quality
**Evidenza**: WS-B `F-WS-B-2`:
- `apps/api/src/modules/insights/repository.ts:273` (flight-risk), `:537` (readiness), `:574` (skill-gap): query senza LIMIT. Scope PLATFORM_ADMIN = cross-tenant full-table.
- `apps/api/src/modules/engagement/repository.ts:19-30 listSurveys`: PLATFORM_ADMIN ottiene survey di tutti i tenant senza LIMIT.
- Ulteriori: `organization-unit-processes/repository.ts:123,152`, `content-blueprint-links/repository.ts:114,159,177`.
- DB live: 162 utenti, score-table crescono con ogni recompute (D-18 risolto ma dati accumulati).
**Impatto**: (a) Latenza crescente O(headcount×tenant) per PLATFORM_ADMIN; (b) payload JSON illimitato over-the-wire; (c) information density cross-tenant per PLATFORM_ADMIN.
**GA-blocker**: No (scope PLATFORM_ADMIN; ma la scalabilità è compromessa)
**Remediation**: `LIMIT/OFFSET` + cap Zod su tutti e 4. Gate: test insights/engagement verdi con paginazione. Effort: M.
**Confidence**: Alta

---

### T3-003
**ID**: T3-003
**Titolo**: In-memory per-email rate limiter — volatile al restart, non scalabile a multi-processo
**Severità**: Medium
**Tipo**: Debt
**Evidenza**: `apps/api/src/modules/auth/email-rate-limit.ts:1-50` letto direttamente. Storage: `Map<email, {count, firstFailureAt}>`. Commento inline `:26-27`: "sufficient for single-process API. When we move to multi-process, replace with Redis." Policy: 5 failures / 5 min. Restart dell'API resetta tutti i contatori (window si azzera).
**Impatto**: (a) Restart forzato (crash OOM, deploy) resetta la finestra anti-brute-force. (b) Multi-processo (PM2/cluster/k8s): ogni worker ha Map separato → attacker fa 5 tentativi per worker. Oggi mitigato: single-process OCI VM. Fragile alla crescita.
**GA-blocker**: No (single-process attuale, ammesso dal commento)
**Remediation**: Implementare `EmailRateLimiter` su Redis (interfaccia stabile per lo swap). Alternativa: persist su DB con TTL. Effort: M.
**Best-practice ref**: OWASP ASVS 2.1: rate limiting state deve essere persistente e condiviso tra processi.
**Confidence**: Alta

---

### T3-004
**ID**: T3-004
**Titolo**: BPM = modeling statico, nessun runtime process-instance/task/SLA — gap funzionale materiale
**Severità**: High
**Tipo**: Debt (funzionale)
**Evidenza**: `grep -rn "process-instance\|ProcessInstance\|task_instance\|workflow_engine\|BPM.*runtime" apps/api/src` → **0 output** (live 2026-06-17). Moduli presenti: `blueprint-families/variants/processes/activations/overrides` + `organization-unit-processes` → definizione RACI/blueprint + attivazione per OU, non esecuzione di istanze. DISCOVERY.md C9: "BPM = solo modeling statico" (ammesso).
**Impatto**: Per un HRMS/BPM che si posiziona come piattaforma di workflow automation, l'assenza di runtime BPM (istanze di processo, task assignment, SLA tracking, alerting) è un gap funzionale materiale vs competitor (Camunda, Flowable, Activiti, Pega, Workday).
**GA-blocker**: No (prodotto si posiziona come HR-analytics/ESS oggi; BPM runtime è roadmap)
**Remediation**: (Roadmap) ADR per BPM runtime; valutare embedding Camunda/Flowable vs build interno. Effort: XL (6-12 mesi).
**Best-practice ref**: BPMN 2.0 standard per process runtime. DMN per regole.
**Confidence**: Alta

---

### T3-005
**ID**: T3-005
**Titolo**: GDPR/AI Act tooling assente — prerequisito per il primo tenant reale EU
**Severità**: High
**Tipo**: Debt (compliance)
**Evidenza**: DISCOVERY.md Q8: "GDPR/AI Act non implementati by-design; diventano prerequisiti al primo tenant reale." Nessun modulo `gdpr-*`, `data-export`, `right-to-erasure`, `consent-management` trovato in `apps/api/src/modules`. DB live: 62.410 `sys_auth_login_events` (live), 39.440 `sys_auth_refresh_tokens` (live) — audit log non strutturato per GDPR access/erasure. I moduli AI (predictions, insights, semantic-matching) producono score automatizzati su dati di persone (flight-risk, succession readiness) → classificabili come AI Act high-risk per HR.
**Impatto**: Il primo tenant reale EU richiede: DPA, right-to-access, right-to-erasure, consent-management, AI Act transparency per insights. Senza questi il prodotto non è vendibile in EU con clienti enterprise.
**GA-blocker**: Sì (per go-to-market EU commerciale)
**Remediation**: (Roadmap) `GET /v1/me/data-export`, `DELETE /v1/users/:id` cascade GDPR, consent-management schema, AI Act transparency layer. Effort: L-XL. Priorità: P0 pre-primo-contratto.
**Best-practice ref**: GDPR Art. 12-22, Art. 22 (decisioni automatizzate), EU AI Act Art. 9-13 (high-risk AI), OWASP ASVS 8.3.
**Confidence**: Alta

---

### T3-006
**ID**: T3-006
**Titolo**: N+1 secondario: teams/findTeamsForUser e reference-sync ESCO UPDATE per-riga
**Severità**: Medium
**Tipo**: Debt
**Evidenza**: WS-B `F-WS-B-3`:
- `apps/api/src/modules/teams/repository.ts:147-151 findTeamsForUser` → loop `for (const row of res.rows) { loadTeamMembers(pool, row.team_id) }` → 1 query per team.
- `apps/api/src/modules/reference-sync/repository.ts:142-152` → 1 `UPDATE sys.sys_skills` per riga gerarchia ESCO (funzioni sorelle batchano).
**Impatto**: Teams: latenza `GET /v1/me/team` proporzionale al numero team utente. Reference-sync: migliaia di UPDATE serializzati per job ESCO.
**GA-blocker**: No
**Remediation**: Teams: query unica `team_id = ANY($team_ids)` + group in TS. Reference-sync: batch UPDATE via `unnest`/VALUES. Effort: S ciascuna.
**Confidence**: Alta

---

### T3-007
**ID**: T3-007
**Titolo**: `sys_auth_refresh_tokens` — 39.440 righe (39.312 attive), crescita non bounded
**Severità**: Low
**Tipo**: Debt
**Evidenza**: `SELECT count(*) FROM sys.sys_auth_refresh_tokens WHERE auth_refresh_token_revoked_at IS NULL` → **39.312** righe attive (live 2026-06-17). `SELECT count(*) FROM sys.sys_auth_refresh_tokens` → **39.440** totale. DISCOVERY.md: "ricresciuti dopo pruning WS-C (37k)". Migration `000129_auth_audit_prune.sql` esiste (da `ls db/migrations`).
**Impatto**: Tabella crescita monotona; query di refresh-rotation scansionano indici su 39k+ righe. Multi-tenant con utenti reali → potenziale esplosione in mesi.
**GA-blocker**: No (migration `000129` di prune esiste)
**Remediation**: Verificare che `000129` sia schedulato via systemd timer (TTL 30d). Se solo one-time: aggiungere scheduled prune periodico. Effort: S.
**Confidence**: Alta

---

### T3-008
**ID**: T3-008
**Titolo**: ASSET — DEBT_REGISTER: 36 debiti chiusi con evidenza, metodologia rigorosa
**Severità**: Info
**Tipo**: Debt (Asset)
**Evidenza**: DEBT_REGISTER letto: ogni debito ha evidenza file:line, remediation, stato con commit SHA o data. Spot-check D-26/D-28/D-30 confermati via grep live. Il modello di tracking è rigoroso per un single-developer e fornisce un audit trail credibile per la due diligence.
**GA-blocker**: N/A
**Confidence**: Alta

---

## Score del pilastro

| Score | Confidence | Motivazione |
|---|---|---|
| **62 / 100 — Debole** | Alta | Il DEBT_REGISTER interno è curato (36 debiti chiusi con evidenza). Ma la due diligence identifica 4 debiti attivi non registrati: il broadcast N+1 CRITICAL (self-DoS admin-driven) e 4 list no-LIMIT HIGH sono rischi operativi immediati. I debiti funzionali BPM (0 runtime) e compliance GDPR (0 tooling) sono materiali per il go-to-market EU e trascinano il score. Il rate limiter in-memory è un rischio di sicurezza non ancora formalmente registrato. |
