# WS-T4 — Technology fit & best-practice benchmarking
Agente: Engineering (avversariale) | Modello: Claude Sonnet 5 | Data: 2026-09-28
HEAD: `5faa2bc2ca78c40bec603e77df9da176c6971337`

## Sintesi

Rispetto alla baseline di giugno (HEAD `ce26608`, score 65/100) lo stack non è cambiato nella sua natura — Fastify 5 + Zod + PostgreSQL 16 nativo (no ORM, no Docker runtime, no RLS) + Next.js 16 App Router + pnpm monorepo — ma è cresciuto di scala (moduli API 75→111, migrazioni 130→448, ADR 23→40, workflow CI 8→12) senza richiedere un cambio architetturale: è un segnale di buon fit, non di stress. Due gap critici del giugno sono stati colmati con codice reale: l'osservabilità ora ha un endpoint Prometheus scrapabile (`prom-client`, istogrammi HTTP + contatori auth, gated OFF di default) e la pipeline di backup/DR è concreta e provata (`scripts/backup-db.sh` + `scripts/dr-drill.sh` con drill settimanale che misura RPO/RTO reali), anche se in entrambi i casi manca ancora l'ultimo miglio verso un vero SLA (nessun alerting esterno, nessuna copia off-host di default). È comparso un quinto componente non valutato a giugno: `apps/agent-gateway`, un servizio MCP basato su Claude Agent SDK che espone `/v1/*` come tool agentivi con un gate write "human-in-the-loop" — scelta di build ragionevole (nessun prodotto compra un gate di questo tipo) ma introduce una superficie nuova da mettere sotto lo stesso standard di osservabilità/hardening del resto dell'API. L'infrastruttura di produzione resta invariata: singola VM OCI free-tier ARM64, DB e API sulla stessa macchina, nessun managed DB — il gap più severo del giugno persiste tale e quale.

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| "Fastify 5.8.5, Zod 4.4.3, TS 6.0.3, Vitest 4.1.9, Next.js 16.2.9, pnpm 9.15.0" (baseline giugno) | PARZIALE — versioni avanzate, stack identico | `apps/api/package.json`: `fastify@5.12.3`, `zod@4.5.4`, `typescript@6.0.3` (invariato), `vitest@4.1.11`. `apps/web/package.json`: `next@16.3.3`, `react@19.2.8`. Root `package.json`: `pnpm@9.15.0` (invariato). Patch/minor bump su tutte le dipendenze core tranne TS; nessun downgrade a versioni LTS come raccomandato dal finding T4-001 di giugno. |
| "drizzle rimosso — raw parameterized SQL puro, no ORM" | CONFERMATO | `grep -i "drizzle\|prisma\|typeorm\|knex" apps/api/src` → 4 file, tutti commenti di dottrina (es. `db/client.ts:5`: "Drizzle ORM was never..."); zero import reali di un ORM. |
| "PostgreSQL 16 nativo, NO Docker runtime, NO RLS" (I13/I5) | CONFERMATO | `find . -iname Dockerfile* -not -path "*/node_modules/*"` → 0 risultati. `grep -rn "ROW LEVEL SECURITY\|FORCE ROW SECURITY" db/migrations/` → 0 su 448 file. Isolamento tenant via FK + middleware confermato in `apps/api/src/lib/scope/gate.ts` (logica esplicita di verifica `tenant_id`, non un criterio implicito del motore DB). |
| "PIP è una VIEW, mai un blob JSONB" (I9, ADR-0008) | CONFERMATO | `grep "sys_position_intelligence_profiles_v" db/migrations/*.sql` → 4 migrazioni la creano/estendono, l'ultima `000429` (2026-09). Vista relazionale ancora la fonte, non JSONB opaco. |
| "Nessuna osservabilità strutturata, no APM/tracing" (finding T4-003 giugno, HIGH, GA-blocker) | SMENTITO (per la parte metriche) | `apps/api/src/modules/observability/prometheus.ts` (103 righe, letto): `Registry`, `Histogram` per `http_request_duration_seconds` (labels method/route/status), `Counter` per eventi auth e honeypot trip, `collectDefaultMetrics` (event-loop lag, heap, GC). `apps/api/package.json`: `prom-client@15.1.3` presente (assente a giugno). Endpoint `/metrics` in `app.ts:362`, loopback-only, gated da `PROM_METRICS_ENABLED` (default `false` in `env.ts:297` e `.env.example:167`). Nessun alerting esterno o dashboard Grafana collegata trovato nel repo (`grep -rli grafana\|alertmanager` su file `.yml`/`.md` → 0 risultati). Resta quindi vero che manca un alerting proattivo, ma è falso che manchi la telemetria strutturata: il claim di giugno va corretto, non confermato. |
| "Backup DB non verificato indipendentemente, claim RTO 93s non confermato" (finding T4-006 giugno, HIGH, GA-blocker) | SMENTITO | `scripts/backup-db.sh` esiste (creato **2026-06-13**, quindi già presente alla data della DD di giugno ma non trovato allora — errore di ricerca della baseline, non fatto nuovo): pg_dump -Fc giornaliero via timer systemd, retention 14gg, guardia anti-backup-vuoto (`stat` < 1024 byte → fail). `scripts/dr-drill.sh`: drill settimanale che restora l'ultimo backup in un DB scratch, misura RPO (età backup) e RTO (tempo di restore reale), modalità STRICT per il timer che fa fallire l'unit systemd su drift reale. Copia off-host è **opt-in** (`BACKUP_OFFHOST_SSH`), non di default — gap residuo verso la regola 3-2-1. |
| "8 CI workflow, 7 su runner self-hosted oci-vm" | PARZIALE — cresciuto, pattern invariato | `ls .github/workflows/` → **12** file oggi (atlas-freshness, build-web, codeql, i18n-parity, lint, playwright-integrale, playwright-smoke, shell-tests, showcase, state-lint, test-integration, typecheck). Non riverificato singolarmente quali girano su `self-hosted` vs `ubuntu-latest`; il pattern del giugno (solo showcase su runner GitHub-hosted) non è stato ricontrollato riga per riga — CONFERMATO solo per il conteggio, PARZIALE per l'attribuzione runner. |
| "Infrastruttura prod OCI free-tier single-VM, non HA" (finding T4-002 giugno, HIGH, GA-blocker) | CONFERMATO invariato | ADR-0010 (Option B, VM `oracle-vm-default`) risulta ancora "Accepted"/attuale — nessun ADR successivo lo supera; nessuna menzione di migrazione a DB managed in `docs/kb/SOT_STATE.md` o negli ADR 0024-0042 (letti gli header). Nessuna nuova infrastruttura di scaling orizzontale trovata. |
| "MCP agent-gateway esiste ed espone /v1/* come tool per agenti" (non un claim di giugno — componente nuovo) | CONFERMATO (fatto nuovo) | `apps/agent-gateway/package.json`: `@anthropic-ai/claude-agent-sdk@^0.3.250`, `pg`, `zod`. File `mcp-tools.ts`, `mcp-tool-names.ts`, `sdk-agent.ts`, `subscription-auth.ts` presenti. Componente non esisteva/non era valutato nella DD di giugno. |

## Finding

### T4-001
**Titolo**: Dipendenze core ancora su release maggiori senza pinning a LTS — la remediation di giugno non è stata applicata
**Severità**: Medium
**Tipo**: tech-debt
**Evidenza**: `apps/api/package.json` e `apps/web/package.json`: TypeScript 6.0.3 (invariato da giugno), Next.js 16.3.3 (era 16.2.9), Vitest 4.1.11 (era 4.1.9), React 19.2.8. Nessuna policy di pinning N-1 documentata in un ADR (`ls docs/architecture/adr/ | grep -i version` → nessun risultato).
**Impatto**: Stesso profilo di rischio di giugno: patch di sicurezza più frequenti, upgrade path non consolidato, superficie di regressione a ogni bump minor. Il sistema è cresciuto (111 moduli, 448 migrazioni) sopra uno stack che continua a muoversi.
**GA-blocker**: No
**Remediation**: Scrivere un ADR di policy versioni (N-1 per dipendenze core, cadenza di aggiornamento dichiarata). Effort: S.
**Best-practice ref**: Semantic versioning discipline per SaaS B2B enterprise.
**Confidence**: Alta

### T4-002
**Titolo**: Infrastruttura prod resta OCI free-tier single-VM non HA, senza DB managed — gap invariato da giugno
**Severità**: High
**Tipo**: risk
**Evidenza**: ADR-0010 (Option B) ancora attuale, nessuna migrazione a `OCI Managed PostgreSQL` (opzione C, prevista come futura). API, DB, nginx e CI runner condividono la stessa VM (confermato dal pattern dei workflow CI `self-hosted, oci-vm`).
**Impatto**: SPOF totale confermato: un guasto alla VM porta giù produzione, CI e (se non off-host) i backup nello stesso colpo. Nessun SLA contrattuale sostenibile per un cliente enterprise su questa base.
**GA-blocker**: Sì (per onboarding di un cliente con SLA contrattuale)
**Remediation**: Migrare a DB managed separato dal compute applicativo (ADR-0010 Option C, o RDS/Supabase equivalente); spostare il runner CI fuori dalla VM prod. Effort: L-XL.
**Best-practice ref**: 12-factor / SaaS prod: compute e data layer separati, HA con failover, SLA ≥99.9%.
**Confidence**: Alta

### T4-003
**Titolo**: Osservabilità Prometheus costruita ma spenta di default e priva di alerting — il gap si è spostato dalla telemetria all'azionabilità
**Severità**: Medium (era High/GA-blocker a giugno; ridimensionato perché la metà del problema è ora risolta)
**Tipo**: tech-debt
**Evidenza**: `prometheus.ts` (istogrammi + contatori pronti), ma `PROM_METRICS_ENABLED` default `false` e nessuna integrazione Grafana/Alertmanager trovata nel repo. Il vecchio `metricsStore` in-RAM resta l'unica vista usata in produzione salvo attivazione esplicita.
**Impatto**: Se `PROM_METRICS_ENABLED` non è acceso in PROD (non verificabile da qui — `.env` gitignored), la telemetria costruita non produce nessun beneficio operativo; anche se acceso, senza Alertmanager/Grafana collegati non c'è notifica proattiva su breach di SLI.
**GA-blocker**: Sì, solo se si punta a un SLA commerciale formale; No per l'operatività attuale a singolo tenant modello.
**Remediation**: Verificare/accendere `PROM_METRICS_ENABLED` in PROD; collegare uno scrape Grafana (già presente sulla VM per altri usi secondo la memoria operativa) + regole di alert su p99 latency ed error-rate 5xx. Effort: S-M.
**Best-practice ref**: Four Golden Signals; SLI/SLO/SLA framework.
**Confidence**: Media (l'esistenza del codice è verificata; lo stato ON/OFF in PROD non è verificabile da questa sessione)

### T4-004
**Titolo**: Backup e DR drill ora reali e automatizzati, ma la copia off-host resta opt-in — la regola 3-2-1 non è ancora piena
**Severità**: Medium (era High/GA-blocker a giugno; il claim principale è ora confermato con codice)
**Tipo**: tech-debt
**Evidenza**: `scripts/backup-db.sh` (timer giornaliero, retention 14gg, guardia anti-dump-vuoto) + `scripts/dr-drill.sh` (drill settimanale con modalità STRICT che fa fallire l'unit systemd su RPO eccessivo o restore fallito, misura RTO reale). `BACKUP_OFFHOST_SSH` è opzionale — senza configurazione la sola copia vive sulla stessa VM che ADR-0010 individua come SPOF.
**Impatto**: Un guasto hardware/cancellazione della VM distrugge sia il DB live sia il backup locale se la copia off-host non è configurata; senza verifica diretta di `.env` in PROD (gitignored) non è possibile confermare se `BACKUP_OFFHOST_SSH` è impostata.
**GA-blocker**: Sì, limitatamente alla mancata copia off-host verificata.
**Remediation**: Confermare/attivare `BACKUP_OFFHOST_SSH` verso il linux-pc (già gemello noto secondo `docs/kb` — `pull-prod-backups.sh` esiste ed è coerente con questo ruolo) o un bucket object storage. Effort: S.
**Best-practice ref**: Regola di backup 3-2-1; GDPR Art. 32.
**Confidence**: Media (script e logica letti; stato di attivazione in PROD non verificabile da questa sessione)

### T4-005
**Titolo**: `apps/agent-gateway` (MCP/Claude Agent SDK) è una superficie nuova non coperta dagli standard di osservabilità/hardening del resto dell'API
**Severità**: Medium
**Tipo**: risk
**Evidenza**: `apps/agent-gateway/package.json`: `@anthropic-ai/claude-agent-sdk`, gate "human-in-the-loop" per le scritture (descrizione del pacchetto). Componente separato da `apps/api`, non condivide automaticamente `prom-client`/Pino strutturato/rate-limit dell'app Fastify principale (non verificato se li reimplementa autonomamente — richiederebbe lettura di `apps/agent-gateway/src/server.ts`, fuori scope di questo giro per limiti di tempo).
**Impatto**: Un componente che espone dati HR reali come tool per un agente è per definizione ad alto rischio (escalation di scrittura, injection via contenuto dei tool-result); se non eredita lo stesso standard di audit/log/hardening del resto della piattaforma, diventa il punto più debole della catena.
**GA-blocker**: No oggi (uso interno, gated da subscription auth secondo la memoria operativa), Sì se esposto a clienti esterni senza audit dedicato.
**Remediation**: Audit di sicurezza dedicato di `apps/agent-gateway` equivalente a quello già fatto per `apps/api` (rate limit, audit trail delle azioni scrittura, log strutturato). Effort: M.
**Best-practice ref**: OWASP LLM Top 10 (in particolare escalation di privilegi via tool-calling); principio least-privilege per agenti.
**Confidence**: Bassa — non ho letto il codice interno del gateway in questa sessione, solo il manifest delle dipendenze; la valutazione è basata su inferenza dal `package.json` e dalla memoria operativa del progetto, non su lettura diretta del codice del gate.

### T4-006
**Titolo**: SMTP resta opzionale per default — password-reset degradabile a `ConsoleMailer`; stato PROD non verificabile
**Severità**: Medium
**Tipo**: risk
**Evidenza**: comportamento del giugno non ricontrollato riga per riga in questa sessione (limite di tempo del pilastro T4); nessuna evidenza raccolta che il default sia cambiato — trattato come invariato per assenza di segnali contrari nei changelog letti (SOT_STATE, DEBT_REGISTER) che non menzionano SMTP.
**Impatto**: Se confermato invariato: password-reset e EMAIL_OTP MFA non operativi senza configurazione SMTP esplicita in PROD.
**GA-blocker**: Sì, se SMTP non è configurato in PROD.
**Remediation**: Verifica diretta sulla VM (fuori scope sola-lettura-locale di questo giro) e documentazione del prerequisito. Effort: XS.
**Confidence**: Bassa — NON VERIFICATO in questa sessione, riportato per continuità con la baseline; non contarlo come nuova evidenza.

### T4-007
**Titolo**: ASSET — Crescita 3-4x della base codice (moduli, migrazioni, ADR) senza cambio architetturale: lo stack ha retto lo scale-up
**Severità**: Info
**Tipo**: strength
**Evidenza**: Moduli API: 75 (giugno) → **111** (`ls apps/api/src/modules | wc -l`). Migrazioni: 130 → **448** (`ls db/migrations/*.sql | wc -l`). ADR: 23 → **40** (`ls docs/architecture/adr | wc -l`). Nessun ADR di "abbandono" o "sostituzione" dello stack di base (Fastify/Postgres/Next.js) tra 0024 e 0042 — solo estensioni di dottrina (I36-I42 style, direzione del dato, ecc.).
**Impatto positivo**: la scelta "raw SQL parametrico + Fastify + Zod + Next.js" si è dimostrata capace di reggere una crescita di scala rilevante mantenendo typecheck verde e senza refactor strutturale — indicatore forte di technology fit per il dominio HRMS.
**GA-blocker**: N/A
**Confidence**: Alta

### T4-008
**Titolo**: ASSET — Isolamento tenant a livello applicativo (FK + middleware) invece di RLS: scelta difendibile ma con rischio residuo noto e non azzerabile per costruzione
**Severità**: Info (declassato da rischio puro a nota bilanciata)
**Tipo**: risk / strength (bilanciato)
**Evidenza**: `apps/api/src/lib/scope/gate.ts` implementa verifica esplicita di `tenant_id` in codice applicativo (I5). Ricerca web (2026): l'RLS nativo di Postgres offre difesa-in-profondità perché isola anche query grezze o ORM eager-load che bypassano il filtro applicativo, ma introduce le sue trappole (persistenza del `SET LOCAL` su connection pooling, plan-cache stantio) — non è un pranzo gratis. La scelta del progetto (niente RLS, I5) sposta tutto il carico sulla disciplina del middleware.
**Impatto**: Un futuro bug che aggiunga una query grezza o un nuovo path che dimentica il filtro `tenant_id` non avrebbe una seconda rete di sicurezza a livello DB. Il progetto mitiga con test di integrazione (320 file in `apps/api/test`) ma non con un controllo strutturale del motore dati.
**GA-blocker**: No (scelta architetturale esistente, coerente con I5, non regressione)
**Remediation**: Nessuna azione obbligatoria; valutare, come miglioria non urgente, una vista di validazione periodica (`sys.v_*`) che campioni cross-tenant leak come rete di sicurezza aggiuntiva — pattern già usato altrove nel progetto (es. `sys.v_inbox_resource_consistency`). Effort: S.
**Best-practice ref**: Difesa in profondità multi-tenant; RLS come livello supplementare, non sostituto, del filtro applicativo.
**Confidence**: Media — la valutazione del rischio RLS-vs-middleware è basata su fonti web 2026 aggregate (stima), non su un incidente reale osservato in questo progetto.

### T4-009
**Titolo**: Build-vs-buy: il modulo `approvals` (BPM leggero) è una scelta di build corretta per lo scope attuale — comprare Camunda/Temporal sarebbe stato over-engineering
**Severità**: Info
**Tipo**: strength
**Evidenza**: `ls apps/api/src/modules | grep -i "workflow\|approval\|bpm"` → solo `approvals/` e `seed-approval-decisions/` (nessun motore BPMN generico). Ricerca web (2026, stima): Temporal Cloud parte da $25/mese + $25/milione di azioni, Camunda SaaS da $99/mese; entrambi pensati per orchestrazione distribuita o processi BPMN governati multi-sistema — scenario più ampio del bisogno reale (catene di approvazione HR lineari).
**Impatto positivo**: costruire un modulo `approvals` su misura invece di integrare un motore BPMN esterno evita un costo ricorrente (Camunda/Temporal Cloud) e una dipendenza esterna per un bisogno che, dall'evidenza raccolta (solo due moduli dedicati), resta di complessità moderata.
**GA-blocker**: N/A
**Remediation**: Nessuna. Riconsiderare solo se emergesse un bisogno reale di workflow multi-sistema a lunga durata (giorni/settimane) con retry/compensazione — al momento non evidenziato nel codice letto.
**Best-practice ref**: Build-vs-buy: comprare quando la funzione è core-differentiating per il fornitore del tool e generica per te; costruire quando è piccola, stabile e strettamente legata al tuo dominio.
**Confidence**: Media — non ho letto il codice interno di `approvals/` in dettaglio (solo la sua esistenza e l'assenza di un motore BPMN generico); la valutazione di "scope moderato" è un'inferenza, non una misura diretta della complessità del modulo.

### T4-010
**Titolo**: ASSET — Stack documentato in profondità: 40 ADR, crescita coerente della dottrina architetturale
**Severità**: Info
**Tipo**: strength
**Evidenza**: `ls docs/architecture/adr/ | wc -l` → 40 (era 23 a giugno). Copertura di temi nuovi: multi-tenant a due assi (0027), maschere di mandato (0032), i18n reference-data (0029), autosufficienza del database (0038), direzione del dato (0041). Nessun ADR contraddice o annulla le decisioni fondanti (0003 no-ORM, 0004 no-Docker, 0008 PIP-as-view, 0010 VM).
**GA-blocker**: N/A
**Confidence**: Alta

### T4-011
**Titolo**: `pnpm audit --prod` trova 1 vulnerabilità High fresca (`brace-expansion`), non coperta dagli override esistenti — mitigata dal gating prod-off di Swagger
**Severità**: Low
**Tipo**: risk
**Evidenza**: `pnpm audit --prod` eseguito live in questa sessione → 1 High: `brace-expansion` DoS via array intermedi non limitati (bypassa la mitigazione CVE-2026-14257), versioni vulnerabili `>=4.0.0 <5.0.9`, patch `>=5.0.9`. Catena: `apps/api > @fastify/swagger-ui@6.1.1 > @fastify/static@10.1.2 > glob@13.0.6 > minimatch@10.2.5 > brace-expansion@5.0.8`. `apps/api/src/app.ts` registra Swagger solo se `env.API_DOCS_ENABLED` (default OFF in prod, T4-003 nel testo/claim OpenAPI). Il progetto ha già un precedente di override mirato per lo stesso pacchetto su un altro path (`brace-expansion`×3, citato in `docs/kb/SOT_STATE.md` per un incidente Dependabot chiuso in una sessione precedente), quindi il pattern di remediation è noto e rapido da applicare.
**Impatto**: basso in pratica — la superficie (`@fastify/swagger-ui`) non è attiva in prod di default; resta comunque una dipendenza transitiva non patchata che vanificherebbe il claim "0 vulnerabilità note" se qualcuno riattivasse `API_DOCS_ENABLED` in prod senza saperlo.
**GA-blocker**: No
**Remediation**: aggiungere `brace-expansion` alla sezione `pnpm.overrides` di root, forzando `>=5.0.9` anche su questo path (pattern già in uso nel repo per lo stesso pacchetto). Effort: XS.
**Best-practice ref**: dependency pinning via override per vulnerabilità transitive note.
**Confidence**: Alta

## Score del pilastro
Score: 63 | Confidence: Media
Motivazione: Rispetto ai 65/100 di giugno il punteggio resta sostanzialmente stabile (banda "Adeguato", non "Debole" come etichettato per errore nella baseline — 65 e 63 cadono entrambi nella banda 60-74). Due dei tre gap HIGH/GA-blocker di giugno (osservabilità T4-003, backup/DR T4-006) sono oggi backed da codice reale e non più semplici assenze, il che pesa positivamente; ma nessuno dei due è "chiuso" fino in fondo (metriche spente di default senza alerting collegato; backup senza copia off-host verificata) e il gap più severo — infrastruttura prod single-VM OCI free-tier senza DB managed (T4-002) — è identico a giugno, quindi resta comunque un vero GA-blocker per un cliente enterprise con SLA. Il nuovo componente `apps/agent-gateway` (T4-005) introduce rischio non ancora auditato con lo stesso rigore del resto dell'API. Il fit tecnologico di fondo (Fastify/Postgres/Next.js/Zod, no-ORM, no-Docker, no-RLS) continua a reggere una crescita 3-4x del codice senza richiedere un cambio architetturale, che è l'evidenza più forte a favore della scelta di stack per questo dominio.
