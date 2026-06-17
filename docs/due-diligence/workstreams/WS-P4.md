# WS-P4 — AI/LLM business value

> Pilastro P4 (peso 5). Analista: Product/Market (avversariale). HEAD `ce26608` (S994), 2026-06-17. Coordinato concettualmente con T7 (robustezza/eval tecnica). Postura: separare l'AI vera dal marketing "AI/ML".

## Sintesi

La narrativa "AI/ML predictions" del prodotto va smontata in due parti, perché sono molto diverse per difendibilità e valore. **(1) Gli "insights predittivi" (flight-risk, succession-readiness, skill-gap) NON sono machine learning.** Il codice lo dichiara esplicitamente: "DETERMINISTIC, documented weighted-linear rule (NO ML, NO external service)" — sono punteggi a regole con pesi firmati a mano dal PM e soglie hardcoded. **(2) Il semantic-matching (occupazioni/posizioni/job-role/skill/people) è AI genuina**: embeddings vettoriali via **Voyage (API esterna)** + kNN su **pgvector**, con scoping RBAC/tenant corretto. L'asset dati è ESCO (21.939 skill, 126.051 occupation-skill reqs) — reale ma **pubblico**. Il valore di business è concreto e ben ingegnerizzato (spiegabilità, scope, idempotenza), ma la **difendibilità è bassa**: gli embeddings sono di un fornitore terzo, i dati ESCO sono pubblici, e le regole di scoring sono replicabili da un competente in pochi giorni. Niente modello proprietario addestrato, nessun dato proprietario di training, nessun feedback-loop di apprendimento. L'`agent-gateway` (Claude Agent SDK su abbonamento MAX) è un layer LLM aggiuntivo, ma gira su abbonamento personale → non è un'infrastruttura AI serving-ready per clienti.

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| C11 "AI/ML: flight-risk/skill-gap/matching/succession" | **PARZIALE → fuorviante su 'ML'** | `insights/service.ts:5-7`: "DETERMINISTIC weighted-linear rule (NO ML, NO external service)"; pesi `FLIGHT_RISK_WEIGHTS` firmati a mano, soglie `normTenure`/`normKpi`/`bandOf` hardcoded. Matching invece è AI vera (embeddings+kNN) |
| "pgvector embeddings, voyage-client" | **CONFERMATO** | `semantic-matching/voyage-client.ts`, `repository.ts` (kNN pgvector `<=>`), `makeEmbedder()` reale Voyage in prod / Fake in test |
| "ESCO 21.939 skill + 126.051 reqs = asset dati" | **CONFERMATO ma pubblico** | baseline live; ESCO è dataset open EU (riusabile da chiunque) → asset di copertura, non di proprietà |
| "predictions module = ML" | **SMENTITO** | `predictions` (4 endpoint) serve gli score deterministici degli insights; nessun modello addestrato nel repo |
| "agent-gateway = capacità AI di prodotto" | **PARZIALE** | `apps/agent-gateway` (Claude Agent SDK) gira su `AGENT_GATEWAY_SUBSCRIPTION_AUTH` (abbonamento MAX personale) — fuori da CI build/lint, non serving customer-facing (scope futuro per dichiarazione interna) |

## Finding

**P4-001 · "AI/ML predictions" è scoring euristico a regole, non machine learning · High · risk (claim overreach)**
Evidenza: `insights/service.ts` flight-risk = `Σ wᵢ·normᵢ(featureᵢ)` con pesi `{tenure .15, attendance .20, kpi .25, engagement .25, comp .10, promo .05}` firmati dal PM; soglie come `normTenure(y<1)→85`, `bandOf(≥85)→CRITICAL` hardcoded. Stesso pattern per succession-readiness e skill-gap. Header del file: "NO ML".
Impatto: il differenziatore "AI/ML" non regge a una due-diligence tecnica seria di un investitore AI-literate. È un sistema esperto, non un modello appreso. Rischio di percezione di overclaim se venduto come "predictive ML".
GA-blocker: no.
Remediation: (a) ri-posizionare onestamente come "explainable rule-based scoring" — che è un PLUS per AI Act (vedi P4-004); oppure (b) introdurre un modello addestrato reale con feature store + eval. Effort (b) **XL**. Confidence: Alta.

**P4-002 · Semantic-matching è AI genuina e ben ingegnerizzata · Medium · strength**
Evidenza: `semantic-matching/service.ts` — kNN su embeddings per occupazioni/posizioni/job-role/skill/people, con scope RBAC corretto (self-only vs elevated, tenant-isolation I5, ZERO_UUID per no-tenant), free-text dietro feature-flag, reindex idempotente hash-skip. `repository.ts` usa pgvector.
Impatto: è il pezzo AI realmente vendibile (talent-matching, skill discovery, succession candidate-fit). Architettura pulita e sicura.
GA-blocker: no (plus).
Remediation: n/a — preservare; aggiungere timer reindex (roadmap R7). Confidence: Media (codice verificato; qualità dei risultati kNN non misurata con eval — coordinare con T7).

**P4-003 · Difendibilità AI bassa: embeddings di terzi + dati pubblici + regole replicabili · High · risk**
Evidenza: embeddings = Voyage (fornitore esterno, sostituibile/commodity); dati = ESCO/ATECO pubblici; scoring = regole documentate replicabili. Nessun dato proprietario di training, nessun feedback-loop, nessun modello fine-tuned proprietario.
Impatto: non c'è moat AI. Un competente replica lo stack (pgvector + un provider di embeddings + ESCO + regole) in settimane. Il valore difendibile è nell'*integrazione* (pipeline ESCO/ATECO live, scope RBAC), non nell'AI in sé. Per un investitore che paga un premio "AI", il premio non è giustificato dalla difendibilità.
GA-blocker: no.
Remediation: costruire dati proprietari (outcome reali di retention/promozione da tenant reali → fine-tuning/calibrazione) — ma dipende da P1-001 (zero tenant reali). Effort **XL**, gated su go-to-market. Confidence: Alta.

**P4-004 · Spiegabilità deterministica = asset di compliance (AI Act) · Medium · strength**
Evidenza: ogni score insights produce `features[]` con raw/normalized/weight/contribution + `rule_id` + `model_version` (`insights/service.ts` payload.derivation); decisioni HR sensibili (flight-risk) sono admin-only (D-6, RBAC `insights:view`).
Impatto: per EU AI Act (HR = high-risk), un sistema *spiegabile e deterministico* è molto più difendibile di un black-box ML. Il "non-ML" diventa un PLUS regolatorio se posizionato correttamente. Per l'investitore EU, riduce il rischio di compliance.
GA-blocker: no (plus).
Remediation: documentare come feature di compliance; aggiungere human-in-the-loop esplicito sui consequential output. Effort **S**. Confidence: Media.

**P4-005 · LLM-assisted features (narrativa/career-coach/JD) sono roadmap, non shipped · Low · risk**
Evidenza: 3.8 "AI deepening su pgvector esistente" è in roadmap (⛔ LLM spend gated); `agent-gateway` esiste ma su abbonamento personale, fuori CI, non serving clienti. Le feature LLM-generative visibili all'utente finale non sono in produzione.
Impatto: il valore AI "vendibile" più alto (narrativa skill-gap, career coaching, JD generation) non è ancora prodotto. La capacità c'è, l'offerta no.
GA-blocker: no.
Remediation: costruire le feature 3.8 con budget LLM dichiarato. Effort **M**, gated su spend. Confidence: Media.

## Score del pilastro

**Score: 52 / 100 (Debole) · Confidence: Media**

Motivazione: c'è AI reale e ben fatta (P4-002 semantic-matching: embeddings+kNN sicuri e scoped) e un asset di spiegabilità che diventa un PLUS regolatorio EU (P4-004) — questi tengono il punteggio sopra la fascia critica. Ma il pilastro misura *AI/LLM business value difendibile*, e qui i due finding negativi dominano: il marketing "AI/ML predictions" è in realtà scoring euristico a regole (P4-001), e — più importante per un investitore — non esiste alcun moat AI (P4-003): embeddings di terzi, dati pubblici ESCO, regole replicabili, zero dati proprietari di training, zero feedback-loop. Le feature LLM ad alto valore percepito sono roadmap, non prodotto (P4-005). Resto in fascia "Debole" (non "Adeguato") perché il valore AS-IS è un buon sistema di ricerca semantica + un sistema esperto onesto, non un differenziatore difendibile che giustifichi un premio AI. Confidence Media: codice verificato in profondità, ma la qualità/eval dei risultati AI non misurata (coordinare con T7).
