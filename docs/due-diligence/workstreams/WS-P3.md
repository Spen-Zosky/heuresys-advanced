# WS-P3 — Business model & economics
Agente: Product/Market (avversariale) | Modello: Sonnet 5 | Data: 2026-09-28
HEAD: `5faa2bc2ca78c40bec603e77df9da176c6971337`

## Sintesi

**Il verdetto centrale di giugno regge: non esiste un business model implementato.** `grep` odierno su `apps/api/src`+`apps/web/src` per stripe/billing/subscription/pricing/checkout/invoice/payment dà zero riscontri funzionali (solo campi `payment_frequency`/`payment_date` dei cedolini e copy di showcase). Zero clienti paganti, zero piani tariffari, zero metering. Ma tre pezzi del percorso a GA-commerciale che a giugno erano *gap dichiarati* oggi sono **codice shippato e provato live**: il GDPR tooling (D-14, export/erasure reali su PROD), un motore di provisioning tenant transazionale (`POST /v1/tenants/provision`, D-14) e un secondo runner CI fuori dalla VM di produzione (D-08 F2-F5) con backup off-host. Questo sposta la lettura da "prodotto, non azienda" a "prodotto con alcuni prerequisiti di go-to-market già rimossi, ma senza ancora un solo meccanismo di ricavo". Contestualmente è emerso un rischio economico **nuovo**, non visto a giugno: l'intera capacità AI del prodotto (agent-gateway, ADR-0040) gira su un **abbonamento Claude Max personale** (`AGENT_GATEWAY_SUBSCRIPTION_AUTH=1`), condiviso da tutti i tenant, senza metering né attribuzione di costo per cliente — un'architettura di costo che non è pensata per scalare a clienti paganti multipli e che pone un tema di termini contrattuali quando l'uso diventa commerciale a terzi. Il Tenant Builder (le 4 parti che dovrebbero rendere ripetibile l'onboarding di un cliente reale) resta **provato solo su un'industria** (banking, RTL Bank): P1/P2a chiuse, P2b/2c/P3/P4 ancora ACTIVE/GATED — replicare l'onboarding su un settore diverso dal banking non è ancora dimostrato end-to-end.

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| "Nessun pricing/billing nel codice" | **CONFERMATO** | `grep -riE "stripe\|billing\|subscription\|pricing\|checkout\|invoice\|payment"` su `apps/api/src`+`apps/web/src` (2026-09-28): 0 match funzionali — solo `payment_frequency`/`payment_date` (campi cedolino, `apps/api/src/modules/me/repository.ts:359-409`), showcase copy (`apps/web/src/app/showcase/landing-page/page.tsx:44`), e `AGENT_GATEWAY_SUBSCRIPTION_AUTH` |
| "Gira su OCI free-tier ARM ≈ €0 infra" | **CONFERMATO (nessuna evidenza di cambiamento)** | Nessun riferimento nel repo a un upgrade di tier OCI o a hosting a pagamento; unico costo osservato è Voyage embeddings, ~$0 reale (SOT_STATE.md:3417: "Costo reale $0 (~1,2M token entro i 200M gratis)") |
| C10 "GDPR tooling gated al primo tenant" | **SMENTITO — ora SHIPPED** | `docs/kb/SOT_STATE.md` (delta S1023, 2026-07-21): mig `000186`, registry `sys_gdpr_data_map` (54 righe), `sys_user_consents`, `sys_gdpr_requests`; endpoint `/me/gdpr/export`+`/me/consents`; **demo LIVE PROD**: login reale federica → export tommaso "54 tabelle/37 con dati" + erasure E2E provata |
| "v1.0.0 = pronto a monetizzare" | **SMENTITO (invariato)** | Nessuno strato di monetizzazione esiste oggi; GA resta tecnica |
| (nuovo) "Onboarding di un nuovo tenant è possibile" | **PARZIALE** | `apps/api/src/modules/tenants/provisioning.ts` (D-14): `provisionTenant()` transazionale, admin-gated (`tenant:create`=PLATFORM_ADMIN), crea tenant+admin+ruoli+policy MFA in una tx, 409 idempotente su `tenantCode` duplicato. Ma resta **assisted, non self-service** (nessun signup pubblico, nessun collegamento a un pagamento), e il modello dati per un'azienda NON bancaria (Tenant Builder P2b/2c/P3/P4) non è ancora dimostrato end-to-end — `docs/kb/SOT_BACKLOG.md:150,187` (#206 P4 GATED, #198 P3 GATED) |

## Finding

**P3-001 · Zero infrastruttura di monetizzazione: non è un business, è un prodotto · High · functional-debt**
Evidenza: `grep -riE "stripe|billing|subscription|pricing|checkout|invoice|payment"` su `apps/api/src`+`apps/web/src` (2026-09-28) → 0 match funzionali. Nessuna tabella `sys_plan*`/`billing_plan*`/`pricing_tier*`/`subscription_plan*` nelle migrazioni (`grep -ril` su `db/migrations` → 0 risultati). 2 tenant ACTIVE in produzione (RTL Bank + Heuresys System stesso, ADR-0026/I15), invariato da giugno.
Impatto: identico a giugno — tra "prodotto demo-completo" e "prima fattura emessa" manca l'intero strato commerciale (piani, metering, dunning, supporto contrattuale). Il cost-to-revenue resta interamente futuro.
GA-blocker: **sì** (per GA commerciale).
Remediation: billing+subscription (Stripe/Paddle) + piano/metering. Effort **L-XL**. Confidence: Alta.

**P3-002 · Prerequisiti infra/compliance al go-live in parte RIMOSSI dal 17 giugno · Medium (era High) · risk (con componente strength)**
Evidenza: D-08 F2-F5 (SOT_STATE.md, delta S1023): secondo runner CI self-hosted `linux-pc-runner` off-prod, i 3 workflow pesanti (`test-integration`, `playwright-smoke`, `build-web`) retargati fuori dalla VM di produzione; deploy-gate `ci-gate.sh` fail-closed; backup con "archivio off-host su linux-pc" già presente da S1029. GDPR tooling SHIPPED (vedi claim sopra). Resta però: singola VM OCI, singolo DB Postgres nativo (I13, niente Docker/managed-DB), nessun multi-AZ — architettura ancora non ridondata per un SLA commerciale.
Impatto: il salto di stadio per servire un cliente pagante reale è oggi più piccolo di giugno (CI non è più sullo stesso host di prod, GDPR export/erasure funzionano) ma **l'infra di runtime resta una singola VM free-tier**: un solo punto di guasto per API+web+DB. Non è più "un giocattolo da demo" ma non è ancora "infrastruttura commerciale con SLA".
GA-blocker: no per demo; **sì** per un contratto con SLA/uptime.
Remediation: piano infra commerciale (managed DB o failover, runtime ridondato). Effort **L** (ridotto da giugno, parte del lavoro preparatorio è fatto). Confidence: Alta.

**P3-003 · Unit economics non calcolabili — qualunque cifra è speculativa · Medium · risk**
Evidenza: nessun pricing (P3-001), 0 clienti esterni paganti, 0 CAC osservato, 0 churn. Invariato rispetto a giugno.
Impatto: ARPA, LTV, CAC, payback, gross margin restano ipotetici. L'investitore non può sottoscrivere alcun modello finanziario.
GA-blocker: no.
Remediation: pilota a prezzo reale per generare i primi data-point (gated su P3-001/billing). Effort **M**. Confidence: Bassa (per assenza di dati).

**P3-004 · Costo AI per-tenant non misurato, e l'architettura di costo non scala a molti clienti paganti · High · risk (nuovo, non presente nel rapporto di giugno)**
Evidenza: `.env.example:284-292` e `apps/agent-gateway/src/subscription-auth.ts:6,33` — `AGENT_GATEWAY_SUBSCRIPTION_AUTH=1` fa girare l'intera capacità AI (agent-gateway, ricerca web, matching) su un **abbonamento Claude Max personale** invece che su una API key a consumo; `apps/agent-gateway/src/soglie-persone.ts` (ADR-0040) introduce soglie di conferma calibrate sul tenant più grande (RTL Bank, 25/40 misurati 2026-09-08) ma **non introduce metering né attribuzione di costo per tenant** — è un freno di sicurezza (quante persone tocca una conversazione), non uno strumento di costo.
Impatto: oggi, con 2 tenant di cui uno interno, il costo marginale dell'AI è ≈0 (positivo per il burn attuale). Ma è un'architettura a **capacità condivisa e non misurata**: (a) i rate-limit dell'abbonamento sono globali, non per-cliente — clienti paganti concorrenti si limiterebbero a vicenda senza che nessuno lo sappia; (b) non esiste un modo di sapere quanto costa l'AI per-cliente, quindi non è possibile né prezzare né includere l'AI in un piano tariffario con margine dimostrabile; (c) usare un abbonamento personale per servire terzi paganti è una questione di termini contrattuali da verificare con il fornitore prima di vendere, non solo tecnica.
GA-blocker: **sì**, per qualunque go-to-market che includa più di un cliente pagante concorrente sull'AI.
Remediation: introdurre metering per-tenant (anche solo un contatore di chiamate/token in audit log, che già esiste via `agent-audit.jsonl` per altri scopi) + valutare un piano a consumo/API key per il traffico commerciale, separato dall'abbonamento di sviluppo. Effort **M**. Confidence: Media (l'assenza di metering è verificata nel codice; l'impatto commerciale/contrattuale è una stima, non un fatto legale verificato).

**P3-005 · Motore di provisioning tenant: da zero a un'API transazionale, ma resta assisted non self-service · Medium (miglioramento da giugno) · functional-debt**
Evidenza: `apps/api/src/modules/tenants/provisioning.ts` (D-14 FASE 1+2): `provisionTenant()` crea tenant+primo TENANT_ADMIN+ruoli+policy MFA in un'unica transazione, con rollback atomico su qualunque fallimento; gated dietro il permesso `tenant:create` (solo PLATFORM_ADMIN) e dietro il kill-switch `TENANT_PROVISION_ENABLED` (`apps/api/src/config/env.ts:301`). Tenant Builder (le 4 parti che generano il modello dati di un'azienda dalla ricerca web) è avanzato ma non chiuso: P1/P2a **DONE**, P2b/2c **ACTIVE** (#205), P3 **GATED** (#198, aspetta una decisione di Enzo sulle fonti approvate), P4 **GATED** (#206, aspetta che P3 T9 produca un'azienda reale non bancaria) — `docs/kb/SOT_BACKLOG.md:114-187`.
Impatto: onboardare un nuovo cliente **bancario** oggi richiede un'API interna (non un form self-service) più il fascicolo già costruito per RTL Bank come riferimento. Onboardare un cliente di un **altro settore** richiede completare P2b/2c/P3/P4, oggi non provato end-to-end su un'azienda reale non bancaria. Questo riduce ma non chiude il gap di "cost-to-onboard" segnalato a giugno.
GA-blocker: no per un secondo cliente bancario; **sì** per un cliente di settore diverso finché il Tenant Builder non è chiuso.
Remediation: completare #198 (decisione di Enzo sulle fonti approvate) e #206 T9. Effort **L** (dipendenze incrociate dichiarate nel backlog). Confidence: Alta (stato letto direttamente dal backlog e dal codice).

**P3-006 · Costo-a-GA-commerciale resta un programma multi-mese, ma più corto di giugno · Medium · risk**
Evidenza: rispetto a giugno, GDPR (P3-004 di giugno) e provisioning (parte di P3-001 di giugno) sono usciti dal residuo. Resta: billing (P3-001, non in alcuna roadmap concreta), metering AI (P3-004 nuovo), Tenant Builder multi-industry (P3-005), SLA/ridondanza infra (P3-002).
Impatto: il "use-of-funds" per un investitore resta sostanziale ma più preciso e più corto che a giugno: billing+metering+multi-industry+infra ridondata, non più "l'intero programma post-v1".
GA-blocker: n/a (è il cost-to-GA stesso).
Remediation: roadmap GTM finanziata, ora scriva-bile con voci più concrete (billing, metering AI, secondo settore). Effort **XL** (programma). Confidence: Media.

**P3-007 · Burn ~€0 + capital-efficiency confermata, nessuna evidenza di cambiamento · Medium · strength**
Evidenza: nessun segnale nel repo di un upgrade di tier infra o di spesa cloud a pagamento; unico costo di terze parti osservato (Voyage embeddings) è ~$0 reale entro il tier gratuito. `pnpm audit` non ri-eseguito in questa sessione (non nel perimetro di questo fork) — invariato per assunzione.
Impatto: il downside del capitale già speso resta ≈0; un investimento finanzierebbe crescita, non recupero perdite. Bus-factor 1 (sole coder) resta il rischio strutturale, fuori dal perimetro di questo pilastro.
GA-blocker: no (plus).
Remediation: n/a. Confidence: Media (finanziari assunti, non ri-verificati con Enzo in questa sessione).

## Assunzioni aperte (da confermare con Enzo — non derivabili dal repo)
- Revenue/ARR/clienti paganti reali (assunto: 0, invariato da giugno).
- Funding ask, runway, burn mensile reale (assunto: bootstrap, burn ≈ infra quasi-zero + tempo founder).
- Pricing/packaging previsto (assunto: non definito).
- Se e come l'abbonamento Claude Max personale (P3-004) possa/debba restare l'architettura di costo AI quando arriva un primo cliente pagante esterno — è una decisione di prodotto/contratto, non tecnica.

## Score del pilastro

**Score: 43 / 100 (Debole, limite basso) · Confidence: Media**

Motivazione: il verdetto di fondo di giugno non è cambiato — zero monetizzazione, zero clienti, unit economics non calcolabili (P3-001, P3-003) — quindi il pilastro resta debole per definizione: qui si misura un *business model*, e di business model in senso stretto (un meccanismo che trasforma uso in ricavo) non ce n'è ancora uno. Alzo il punteggio da 38 a 43, sopra la soglia "Critico", per un motivo puntuale e verificato nel codice, non per cortesia: due dei prerequisiti che a giugno erano gap dichiarati e bloccanti (GDPR tooling, provisioning tenant) sono oggi **shippati e provati live**, e l'infrastruttura CI/backup è meno fragile (D-08 F2-F5). Questo accorcia realmente il percorso a un go-to-market. Contro questo miglioramento pesa una scoperta nuova e non banale (P3-004): l'intera capacità AI del prodotto gira su un abbonamento personale condiviso, senza metering per-tenant — un'architettura di costo che introduce un rischio economico e potenzialmente contrattuale non presente nel rapporto di giugno, e che tocca anche il pilastro P4. Confidence Media: l'assenza di billing e la presenza di GDPR/provisioning sono verificate nel codice con alta confidenza; i numeri finanziari (burn, runway) restano assunti, non riconfermati con Enzo in questa sessione.
