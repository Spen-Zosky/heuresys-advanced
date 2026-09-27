# WS-T3 — Technical debt & antipatterns
Agente: Engineering (avversariale) | Modello: Claude Sonnet 5 | Data: 2026-09-28
HEAD: `5faa2bc2ca78c40bec603e77df9da176c6971337`

## Sintesi

Rivalidazione rispetto alla baseline di giugno (HEAD `ce26608`, score 62/100 Debole). Il quadro è cambiato in meglio in modo sostanziale: il self-DoS Critical (`broadcast` N+1) è risolto con evidenza in codice, il gap GDPR/AI-Act (all'epoca GA-blocker dichiarato per il go-to-market EU) è oggi coperto da un modulo `gdpr/*` completo (export Art.15/20, erasure Art.17, retention sweep schedulato) più consent self-service in `me/*` e un ledger di provenance per l'AI Act — nessuna delle due criticità di giugno regge più come Critical/GA-blocker. Restano debiti reali ma di severità inferiore: 2 dei 4 list-endpoint senza LIMIT di giugno sono ancora senza cap, il rate limiter email resta in-memory single-process (invariato, auto-documentato come tale), il BPM resta modeling-only (0 runtime, invariato). `DEBT_REGISTER.md` è cresciuto da 37 a 93 righe, quasi tutte chiuse con evidenza file:riga/comando, e ha raggiunto un livello di auto-critica raro (documenta i propri bug di tooling di verifica, es. D-88) — ma il suo stesso header è stale di due mesi e ~21 righe, un difetto minore ma ironico per un registro il cui scopo è tracciare il drift.

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| (DEBT_REGISTER, giugno) "37 debiti, 36 RISOLTI, 1 aperto-minore (D-37)" | CONFERMATO (per l'epoca) / SUPERATO oggi | `docs/kb/DEBT_REGISTER.md` oggi conta 93 righe `**D-NN**` (grep pattern `\*\*D-\d+\*\*` → 93 occorrenze); 86 righe portano un marcatore di chiusura (RISOLTO/WON'T-DO/gestito/non-issue). Gli 8 debiti storicamente 🔴 alta (D-01,13,26,28,50,53,83,88) sono TUTTI chiusi con evidenza (commit SHA, query live, o test). D-37 (l'unico aperto a giugno) risulta RISOLTO 2026-06-18 (S996, commit `bd1d5eb`), quindi la baseline di giugno era già corretta al momento della sua stesura. |
| (T3-001, giugno) "`POST /v1/notifications/broadcast` N+1 illimitato — self-DoS Critical" | SMENTITO oggi | `apps/api/src/modules/notifications/service.ts:36-50`: commento "QW-B1 (WS-B F-WS-B-1): set-based bulk emit — opt-out lookup + one unnest INSERT, a fixed 3 queries total... instead of the prior N×emitNotification N+1", usa `emitNotificationsBulk`. Cap: `packages/shared/src/schemas/notifications.ts:60` → `userIds: z.array(z.uuid()).min(1).max(500)`. Il finding di giugno cita esplicitamente questo fix nel suo stesso commento sorgente, quindi non è un caso di remediation coincidentale non collegata. |
| (T3-002, giugno) "4 list-endpoint business senza LIMIT: insights×3, engagement, organization-unit-processes×2, content-blueprint-links×3" | PARZIALE | `insights/repository.ts:360,652,694` e `engagement/repository.ts:32,61` ora usano `LIMIT ${ANALYTICS_ROW_CAP + 1}` con `guardResultCap` (`lib/result-cap.ts`) — risolti. `organization-unit-processes/repository.ts` e `content-blueprint-links/repository.ts`: grep `LIMIT\|ROW_CAP` → **0 match** in entrambi — ancora senza cap, invariati da giugno. |
| (T3-003, giugno) "rate limiter per-email in-memory, non scalabile multi-processo" | CONFERMATO — invariato | `apps/api/src/modules/auth/email-rate-limit.ts:23-25` letto oggi: stesso commento "Plain Map<email, {count, firstFailureAt}>; sufficient for single-process ... replace with Redis." Nessun cambiamento rispetto a giugno. |
| (T3-004, giugno) "BPM = modeling statico, 0 runtime process-instance" | CONFERMATO — invariato | `grep -rn "process-instance\|ProcessInstance\|task_instance\|workflow_engine" apps/api/src` → 0 output (oggi, come a giugno). Nessun modulo runtime BPM aggiunto in 3 mesi. |
| (T3-005, giugno) "GDPR/AI Act tooling assente, GA-blocker per l'EU" | SMENTITO oggi (per il codice) | `apps/api/src/modules/gdpr/routes.ts`: `GET /data-map`, `GET /requests`, `POST /users/:userId/export` (Art.15/20), `POST /users/:userId/erasure` (Art.17, dryRun default true), `POST /retention/run`. Consent self-service: `apps/api/src/modules/me/routes.ts` + `service.ts` (grep "consent" → 2 file). AI Act transparency: `apps/api/src/modules/provenance/routes.ts` — header dichiara esplicitamente "AI-Act / GDPR art.22 audit surface". Retention schedulata: `scripts/gdpr-retention-sweep.sh` presente (systemd timer 03:00, da DEBT_REGISTER D-63). Non verificato in questa sessione: se la superficie copre TUTTI gli obblighi contrattuali (DPA, informativa) — quello resta un tema legale/business, non di codice. |
| (T3-006, giugno) "N+1 teams/findTeamsForUser + reference-sync UPDATE per-riga" | PARZIALE | Teams: RISOLTO — `apps/api/src/modules/teams/repository.ts:153-161` commento "Batched member load (was N+1...)" + `loadTeamMembersBatch` con una query su `team_id = ANY(...)`. Reference-sync: ANCORA presente — `reference-sync/repository.ts:153` mostra `UPDATE sys.sys_skills` non-batchato (stesso pattern di giugno). |
| (T3-007, giugno) "`sys_auth_refresh_tokens` 39.440 righe, crescita non bounded" | NON VERIFICABILE dal vivo in questa sessione | Tentata query live via tunnel :5433 (`psql ... SELECT count(*) FROM sys.sys_auth_refresh_tokens`): connessione non completata in timeout 20s (auth/credenziali non risolvibili in modalità sola-lettura senza intervento di Enzo). Evidenza indiretta di remediation: `scripts/auth-housekeeping.sh` esiste nel repo (citato da DEBT_REGISTER D-59 come meccanismo di pruning già in produzione dal 2026-07). Non riclassifico lo score su questa voce senza numero fresco. |
| (T3-008, giugno) "DEBT_REGISTER: asset, metodologia rigorosa" | CONFERMATO e rinforzato | Il registro oggi (93 righe) include auto-critiche profonde: D-88 documenta 3 bug distinti nel proprio tool di verifica (`verify_gate.py`) scoperti mentre se ne correggeva uno; D-79/D-80 correggono falsi allarmi CI attribuiti erroneamente a "instabilità di rete"; D-86 documenta un secondo difetto più grave trovato mentre si correggeva il primo. Livello di rigore raro per un progetto single-developer. **Ma**: l'header del file (riga 7) dichiara "Aggiornato 2026-07-21 ... Tabella aggiornata fino a D-71" mentre il contenuto reale arriva a D-92 con voci datate fino al 2026-09-12 (S1096) — l'header è stale di ~2 mesi e ~21 righe. Vedi Finding T3-009. |

## Finding

### T3-101
**Titolo**: Self-DoS su `POST /v1/notifications/broadcast` — RISOLTO, non più un rischio attivo
**Severità**: N/A (storico, chiuso)
**Tipo**: strength
**Evidenza**: `apps/api/src/modules/notifications/service.ts:22-52`, `packages/shared/src/schemas/notifications.ts:60`
**Impatto**: nessuno residuo; l'endpoint ora esegue un numero di query costante (3) indipendentemente dal numero di destinatari, con cap Zod a 500.
**GA-blocker**: No (chiuso)
**Remediation**: n/a
**Confidence**: Alta

---

### T3-102
**Titolo**: 2 list-endpoint business restano senza LIMIT/cap — payload illimitato
**Severità**: Medium
**Tipo**: tech-debt
**Evidenza**: `apps/api/src/modules/organization-unit-processes/repository.ts` (grep `LIMIT|ROW_CAP` → 0 match); `apps/api/src/modules/content-blueprint-links/repository.ts` (idem, 0 match). Confrontare con il pattern già applicato a `insights/repository.ts:360,652,694` e `engagement/repository.ts:32,61` (`LIMIT ${ANALYTICS_ROW_CAP + 1}` + `guardResultCap`).
**Impatto**: payload JSON illimitato over-the-wire su 2 endpoint; latenza crescente con il numero di righe della tabella; nessun segnale di cross-tenant leak aggiuntivo osservato (le altre due liste erano il problema principale di giugno per lo scope PLATFORM_ADMIN).
**GA-blocker**: No
**Remediation**: applicare lo stesso pattern `ANALYTICS_ROW_CAP`/`guardResultCap` già in uso altrove nel repo — è un refactor meccanico con precedente diretto nello stesso codebase. Effort: S.
**Best-practice ref**: paginazione/cap obbligatorio su ogni endpoint di lista (OWASP ASVS 4.3, API3:2023 OWASP API Security Top 10 — Broken Object Property Level/Excessive Data Exposure via unbounded response).
**Confidence**: Alta

---

### T3-103
**Titolo**: Rate limiter email in-memory — invariato da giugno, rischio noto e accettato ma non registrato in DEBT_REGISTER
**Severità**: Medium
**Tipo**: tech-debt / risk
**Evidenza**: `apps/api/src/modules/auth/email-rate-limit.ts:23-25` — `Map<email, {count, firstFailureAt}>`, commento inline che dichiara il limite ("sufficient for single-process API. When we move to multi-process, replace with Redis"). Nessuna riga dedicata in `DEBT_REGISTER.md` (verificato: nessun D-NN cita `email-rate-limit.ts`).
**Impatto**: (a) un restart (crash OOM, deploy) azzera la finestra anti-brute-force; (b) se il deployment diventasse multi-processo, ogni worker avrebbe un contatore separato — oggi mitigato dal fatto che la VM gira single-process, ma è un'assunzione architetturale non testata né presidiata da un cancello automatico.
**GA-blocker**: No (assunzione single-process vera oggi e ammessa nel codice)
**Remediation**: (a) registrare esplicitamente la voce in DEBT_REGISTER con owner/trigger di riapertura (es. "riaprire se si valuta multi-processo/PM2/k8s"); (b) implementazione reale su Redis o persistenza DB con TTL, dietro l'interfaccia `EmailRateLimiter` già stabile. Effort: S (registrazione) + M (fix reale).
**Best-practice ref**: OWASP ASVS 2.1 — stato di rate-limiting persistente e condiviso tra processi.
**Confidence**: Alta

---

### T3-104
**Titolo**: BPM resta modeling-only, 0 runtime di processo — gap funzionale invariato
**Severità**: High
**Tipo**: functional-debt
**Evidenza**: `grep -rn "process-instance|ProcessInstance|task_instance|workflow_engine" apps/api/src` → 0 output (identico a giugno). Moduli presenti: blueprint-families/variants/processes/activations/overrides + organization-unit-processes = definizione, non esecuzione.
**Impatto**: per un prodotto che si presenta come "HRMS/BPM Platform" (vedi intestazione CLAUDE.md), l'assenza di runtime BPM (istanze, task assignment, SLA, alerting) resta un gap materiale verso i competitor BPM (Camunda, Flowable, Pega). Non è peggiorato né migliorato in 3 mesi — nessun lavoro allocato in questa finestra.
**GA-blocker**: No (il prodotto oggi si vende come HR-analytics/ESS; il "BPM" nel nome resta aspirazionale)
**Remediation**: (Roadmap) decisione ADR su build-vs-embed di un runtime BPM. Effort: XL.
**Best-practice ref**: BPMN 2.0 / DMN.
**Confidence**: Alta

---

### T3-105
**Titolo**: `reference-sync` UPDATE per-riga sulla gerarchia ESCO — invariato
**Severità**: Low
**Tipo**: tech-debt
**Evidenza**: `apps/api/src/modules/reference-sync/repository.ts:153` — `UPDATE sys.sys_skills` non-batchato dentro un loop, mentre le funzioni sorelle nello stesso file (righe 48, 87) già usano `VALUES` multi-tupla.
**Impatto**: job batch ESCO più lento del necessario su migliaia di righe; nessun impatto su richieste utente sincrone (è un job di sync, non un endpoint).
**GA-blocker**: No
**Remediation**: batch UPDATE via `unnest`/VALUES, stesso pattern già presente nello stesso file per le insert. Effort: S.
**Confidence**: Alta

---

### T3-106
**Titolo**: GDPR/AI-Act tooling costruito — da GA-blocker a debito residuo di completezza
**Severità**: Low (era High/GA-blocker a giugno)
**Tipo**: strength / functional-debt residuo
**Evidenza**: `apps/api/src/modules/gdpr/routes.ts` (data-map, requests, export Art.15/20, erasure Art.17 con dryRun, retention/run); `scripts/gdpr-retention-sweep.sh`; consent in `apps/api/src/modules/me/{routes,service}.ts`; `apps/api/src/modules/provenance/routes.ts` come "AI-Act / GDPR art.22 audit surface" letto testualmente nell'header del file.
**Impatto**: il prerequisito TECNICO per un tenant EU reale è oggi in gran parte coperto lato codice. Residuo non verificato in questa sessione: se l'informativa AI Act (trasparenza verso l'interessato sulle decisioni automatizzate di insights/predictions) sia esposta anche lato UI/contrattuale, non solo come audit trail interno — questo è un controllo di prodotto/legale, fuori dallo scope di questa rilettura di codice.
**GA-blocker**: No (per il codice; il go-to-market EU resta comunque soggetto a DPA/contrattualistica, fuori scope tecnico)
**Remediation**: verifica di prodotto/legale sulla copertura end-to-end (non di codice). Effort: valutazione S, eventuale lavoro conseguente da definire.
**Best-practice ref**: GDPR Art.12-22, EU AI Act Art.9-13.
**Confidence**: Media (il codice è verificato; la copertura contrattuale/legale non è verificabile da questa sessione)

---

### T3-107
**Titolo**: DEBT_REGISTER — l'header del registro è stale, sottostima il proprio contenuto di ~21 righe e 2 mesi
**Severità**: Low
**Tipo**: antipattern (documentale)
**Evidenza**: `docs/kb/DEBT_REGISTER.md:7` — "Aggiornato: 2026-07-21 ... Tabella aggiornata fino a D-71". Il contenuto reale del file arriva a **D-92**, con voci datate fino al 2026-09-12 (D-91, sessione S1096) e 2026-08-23 (D-86, S1078). Il file viene mantenuto (86/93 righe chiuse con evidenza fresca) ma la riga di intestazione non è stata ri-scritta a ogni sessione che ha aggiunto righe.
**Impatto**: minimo operativamente (il contenuto è corretto, solo il riepilogo in testa è disallineato), ma è esattamente la classe di difetto ("un fatto che non si misura più, letto come ancora vero") che il resto del progetto tratta con grande rigore altrove (vedi D-88, D-91 sullo stesso tema per altri file). Un investitore che legga solo l'header sottostima l'attività di manutenzione reale del debito tecnico.
**GA-blocker**: No
**Remediation**: aggiornare la riga 7 ad ogni sessione che aggiunge righe (o derivarla automaticamente, come già fatto per `docs/kb/SOT_STATE.md`, invece di scriverla a mano). Effort: S (banale, ma nessuna guardia automatica lo impone oggi).
**Confidence**: Alta

---

### T3-108
**Titolo**: `apps/api/src/modules/me/repository.ts` — file da 2165 righe / 54 funzioni, quasi il doppio del secondo file più grande del repo
**Severità**: Low
**Tipo**: tech-debt (manutenibilità)
**Evidenza**: `find apps/api/src -name "*.ts" | xargs wc -l | sort -rn` → `me/repository.ts` 2165 righe, contro 1177 di `analytics/repository.ts` (secondo posto). 54 dichiarazioni di funzione nel file (grep `^export (async )?function|^async function`).
**Impatto**: il modulo ESS (`/me/*`, ADR-0011) aggrega deliberatamente molte funzionalità self-service in un unico modulo per dottrina architetturale (I: "l'ESS vive in un modulo dedicato") — quindi la dimensione è in parte una conseguenza voluta della segregazione ESS/HR-admin, non necessariamente un god-object nel senso classico. Resta comunque il file più difficile da navigare/revisionare del repo.
**GA-blocker**: No
**Remediation**: se cresce ulteriormente, valutare uno split per sotto-dominio (es. `me/repository/{profile,gdpr,notifications}.ts`) mantenendo un unico modulo pubblico. Non urgente. Effort: M se intrapreso.
**Best-practice ref**: soglia convenzionale single-responsibility per repository file (~500-800 righe); qui il fattore ADR-0011 attenua il giudizio.
**Confidence**: Media (dimensione misurata; se sia "troppo grande" dipende da un giudizio di soglia, non da un difetto dimostrato)

---

### T3-109
**Titolo**: Assenza di code smell classici — asset confermato
**Severità**: N/A
**Tipo**: strength
**Evidenza**: `grep -rEn "TODO|FIXME|HACK" apps/api/src apps/web/src --include="*.ts" --include="*.tsx"` → 0 occorrenze. `grep -rn "@ts-ignore|@ts-expect-error"` → 0 occorrenze. `grep -rn ": any\b" apps/api/src` → 7 occorrenze, tutte falsi positivi verificati manualmente (la parola "any" dentro commenti in inglese, non l'annotazione di tipo TypeScript). Nessuna `CREATE TYPE ... AS ENUM` nelle migration (RD-08 rispettato), nessun `ROW LEVEL SECURITY`/`ENABLE ROW SECURITY` (I5 rispettato).
**Impatto**: positivo — disciplina di tipizzazione e igiene del codice sorgente superiore alla media per un progetto di queste dimensioni.
**GA-blocker**: N/A
**Confidence**: Alta

## Score del pilastro
Score: 76 | Confidence: Alta
Motivazione: A giugno lo score (62, Debole) era trascinato da un self-DoS Critical accessibile a qualsiasi admin e da un gap GDPR/AI-Act dichiarato GA-blocker per l'EU. Entrambi risultano oggi chiusi con evidenza diretta in codice (T3-101, T3-106): non c'è più nessun finding Critical né alcun GA-blocker attivo in questo pilastro. Restano debiti reali ma minori — 2 endpoint ancora senza cap (T3-102, Medium), rate limiter in-memory invariato e non registrato (T3-103, Medium), BPM ancora 0-runtime (T3-104, High ma esplicitamente roadmap/posizionamento, non un difetto che si "corregge" a breve), un loop non batchato (T3-105, Low), un file monolitico ESS (T3-108, Low) e un'ironia documentale nel registro dei debiti stesso (T3-107, Low). Il DEBT_REGISTER resta l'asset più forte del pilastro: 93 righe, 86 chiuse con evidenza verificabile file:riga o comando, e un livello di auto-critica (D-88, D-79/80, D-86) che rende il processo di tracciamento del debito credibile per un investitore anche in assenza di un secondo revisore umano indipendente — la banda "Forte" (75-89) riflette che il debito tecnico attivo oggi è quasi tutto Low/Medium non-bloccante, con un solo High funzionale già esplicitamente derisked come scelta di posizionamento e non come sorpresa.
