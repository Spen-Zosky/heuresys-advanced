# WS-P3 — Business model & economics

> Pilastro P3 (peso 11). Analista: Product/Market (avversariale). HEAD `ce26608` (S994), 2026-06-17. Info finanziarie non-discoverable → assunzioni Q1-Q8 (01_DISCOVERY.md) dichiarate + domande founder.

## Sintesi

**Non esiste un business model implementato.** Verificato nel codice: zero billing, zero pricing, zero subscription management, zero metering, zero signup/provisioning self-service. heuresys è oggi un **prodotto, non un'azienda**: pre-revenue, 0 clienti paganti (assunzione Q1, coerente con 0 tenant reali), burn ≈ costo infra OCI free-tier ARM (~€0) + tempo del founder (Q2). Questo ha due letture opposte e bisogna tenerle entrambe. (1) **Positiva**: il rischio capitale bruciato è quasi nullo — è stato costruito un HRMS completo a costo infra ~€0, segnale di capital-efficiency estrema. (2) **Negativa e più pesante per l'investitore**: l'infra free-tier ARM è un **giocattolo da dimostrazione, non un'infrastruttura commerciale** — single-VM, single-DB, CI runner = la stessa VM di prod (SPOF confessato D-08/C6), nessun backup off-host fino a poco fa, nessuna isolation multi-tenant a livello infra, nessun SLA possibile. Il momento in cui arriva il primo cliente reale, *tutta* l'economia cambia: serve infra pagante, billing, provisioning, GDPR tooling, supporto. Il "cost-to-GA-commerciale" non è incrementale, è un nuovo stadio. Le unit economics sono **non calcolabili** (no pricing, no CAC, no clienti) → qualunque cifra è speculativa.

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| "Nessun pricing/billing nel codice" | **CONFERMATO** | `grep -riE "stripe|billing|subscription|pricing|checkout|invoice|payment"` su `apps/api/src`+`apps/web/src` → 0 match funzionali (solo `AGENT_GATEWAY_SUBSCRIPTION_AUTH` + showcase copy). PROD live: nessun CTA signup/pricing |
| "Gira su OCI free-tier ARM ≈ €0 infra" | **CONFERMATO** | 01_DISCOVERY + memoria progetto: OCI Free Tier ARM Ubuntu, api:8013/web:3013 systemd, DB nativo localhost:5432, CI self-hosted sulla stessa VM |
| C10 "GDPR tooling gated al primo tenant" | **CONFERMATO** | ADR-0023 no-PII by-design; GDPR/retention assenti by-design (roadmap 3.9 gated su 3.1) → prerequisito non-negoziabile al primo dato reale |
| "v1.0.0 = pronto a monetizzare" | **SMENTITO (implicito)** | nessuno strato di monetizzazione esiste; la GA è tecnica (vedi P1-001) |

## Finding

**P3-001 · Zero infrastruttura di monetizzazione: non è un business, è un prodotto · High · functional-debt**
Evidenza: 0 match billing/pricing/subscription/signup nel codice; PROD login-only; 0 clienti. Nessun tenant-lifecycle self-service, nessun metering uso/seat, nessun piano.
Impatto: tra "prodotto demo-completo" e "prima fattura emessa" c'è un intero stadio di costruzione (signup→provisioning→billing→dunning→supporto). Per l'investitore, il cost-to-revenue è interamente futuro e non stimato dal venditore.
GA-blocker: **sì** (per GA commerciale).
Remediation: billing+subscription (Stripe/Paddle) + self-service provisioning + plan/metering. Effort **L-XL**. Confidence: Alta.

**P3-002 · Infra free-tier ARM è capital-efficiency estrema MA non è infrastruttura commerciale · High · risk**
Evidenza: single OCI free-tier VM ospita API+web+DB+CI runner; CI SPOF e fork-PR ACE su host prod confessati (D-08/C6, peso T8). Nessuna ridondanza, nessun multi-AZ, nessun managed-DB, backup off-host solo recente (R5/QW-C3).
Impatto duplice: (+) costruire un HRMS completo a ~€0 infra è un segnale fortissimo di efficienza; (−) questa infra non regge un solo cliente con aspettative di SLA/uptime/DR. La migrazione a infra commerciale (managed Postgres, runtime ridondato, CI isolata) è un costo e un rischio reali al go-live.
GA-blocker: no per demo; **sì** per servire clienti.
Remediation: piano infra commerciale (managed DB, runtime HA, CI isolata da prod). Effort **L**. Confidence: Alta.

**P3-003 · Unit economics non calcolabili — qualunque cifra è speculativa · Medium · risk**
Evidenza: no pricing (P3-001), 0 clienti, 0 CAC osservato, 0 churn. Benchmark di mercato (P2): €7.60-20/dip/mese.
Impatto: ARPA, LTV, CAC, payback, gross margin sono tutti ipotetici. Il gross margin *teorico* di un SaaS HRMS è alto (>70%) ma non dimostrato. L'investitore non può sottoscrivere alcun modello finanziario; deve trattarlo come scommessa pre-seed.
GA-blocker: no.
Remediation: pilota a prezzo reale per generare i primi data-point. Effort **M** (gated su P1-001). Confidence: Bassa (per assenza di dati, non per incertezza di analisi).

**P3-004 · Costo-a-GA-commerciale ≈ programma post-v1 completo, non incrementale · Medium · risk**
Evidenza: POST_V1_ROADMAP §1-3 — provisioning (3.1, L), GDPR tooling (3.9, M), billing (non in roadmap, L-XL), BPM runtime se si vende "BPM" (3.3, L), notification email (3.4, S), security audit/pentest (3.2, M). Sommando le fasi additive dichiarate + il billing mancante, il cammino a un'azienda vendibile è multi-mese full-time.
Impatto: l'investitore finanzia *il percorso a revenue*, non *il completamento del prodotto* (che è già avanzato). Il use-of-funds è chiaro (team + GTM + infra + compliance), ma sostanziale.
GA-blocker: n/a (è il cost-to-GA stesso).
Remediation: roadmap GTM finanziata. Effort **XL** (programma). Confidence: Media.

**P3-005 · Burn ~€0 + IP 100% founder = rischio capitale minimo finora · Medium · strength**
Evidenza: infra free-tier ~€0 (Q2); sole-coder, repo proprio, IP 100% founder (Q5, da confermare); deps OSS prevalentemente MIT/Apache (X2). `pnpm audit --prod` = 0 vulnerabilità.
Impatto: ciò che esiste è stato creato con capitale quasi nullo → l'investimento non sana perdite pregresse, finanzia crescita. Downside del capitale già speso ≈ 0. Bus-factor 1 resta il rischio chiave (X3).
GA-blocker: no (plus).
Remediation: n/a; de-risk via assunzioni post-funding (use-of-funds). Confidence: Media (finanziari assunti, non documentati — domande Q1/Q2/Q5/Q7 al founder).

## Domande al founder (P3-critiche)
- Q1 Revenue/ARR/clienti paganti reali? (assunto: 0)
- Q2 Funding ask, runway, burn mensile? (assunto: bootstrap, burn ≈ infra €0 + tempo)
- Q3 Pricing/packaging previsto? (assunto: non definito)
- Q7 Piano di hiring post-funding (chi possiede HOW se il founder esce)?

## Score del pilastro

**Score: 38 / 100 (Critico, limite alto) · Confidence: Media**

Motivazione: questo è il pilastro più debole della mia direttrice, e a ragione. Il business model non esiste come implementazione (P3-001): zero monetizzazione, zero clienti, unit economics non calcolabili (P3-003). L'infra a ~€0 è un'arma a doppio taglio che, per il *business*, pesa più sul lato negativo: è una demo, non un'infrastruttura commerciale, e il go-live impone un cambio di stadio costoso (P3-002, P3-004). Tengo il punteggio al limite alto del "Critico" (38, non sotto 30) per un motivo sostanziale e non di cortesia: la capital-efficiency dimostrata è genuina (P3-005) — un HRMS completo costruito a capitale quasi nullo significa che il downside del capitale già impiegato è ~0 e che l'eventuale investimento finanzia crescita, non recupero perdite. Ma il pilastro misura *business model & economics*, e di business model non ce n'è. Non posso assegnare "Debole" (≥40) a un'entità che non ha alcun meccanismo di ricavo né un solo data-point economico reale. Confidence Media: l'assenza degli strati di monetizzazione è verificata nel codice (Alta su quello), ma i numeri finanziari sono assunti (Bassa su quelli) → media.
