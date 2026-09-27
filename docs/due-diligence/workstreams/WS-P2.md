# WS-P2 — Market & competitive positioning
Agente: Product/Market (avversariale) | Modello: Sonnet 5 | Data: 2026-09-28
HEAD: `5faa2bc2ca78c40bec603e77df9da176c6971337`

## Sintesi

Rispetto alla baseline di giugno (HEAD `ce26608`, S994) il quadro di mercato non migliora, e su un punto peggiora concretamente: **365Talents — l'unico competitor diretto che la ricerca di giugno indicava come "la battaglia 1-vs-1 possibile" nel wedge EU/ESCO-regolato — è stata acquisita da Docebo per ~$55M** (verificato via web, settembre 2026), portando in dote a un player di skills-intelligence indipendente la distribuzione LMS di un vendor quotato e clienti bancari europei (Crédit Agricole, Société Générale) che si sovrappongono esattamente all'ICP dichiarato di heuresys (banking mid-market EU, caso di riferimento RTL Bank). Sul fronte prodotto c'è invece un miglioramento reale e verificato nel codice: il **Gap#1** che la baseline indicava come "il gap di credibilità" davanti a un investitore (nessuna UI per le persone Process Owner/Org Director) **è stato chiuso** — esistono oggi 4 pagine Org Director (overview, health, VRIO, advisor) e 1 pagina Process Owner, con un motore MLCE (`capability-composition`) e un motore di maturità L0-L5 (`capability-maturity`) lato API. Ma questo migliora la *dimostrabilità del prodotto* (pertinente a P1), non la *difendibilità di mercato*: zero clienti paganti, zero pricing pubblico, zero moat tecnico e zero team restano tutti invariati da giugno. Il Tenant Builder (nuova epica multi-fase, P1-P3 DONE, P4 consegnato) è un asset GTM reale ma copre oggi solo l'11/144 tabelle (7,6%) e 29/329 relazioni (8,8%) del fascicolo di un'azienda — non risolve il collo di bottiglia dell'onboarding-dati che genera il rischio shelfware. Il mercato resta ampio e in crescita (dato confermato, fonti multiple), ma la posizione competitiva di heuresys nel suo wedge più credibile si è indebolita, non rafforzata.

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| "HRMS/BPM per mercato EU/IT (CCNL, ATECO, ESCO)" | **CONFERMATO (capability) / NON DIMOSTRATO (mercato)** | reference-sync ESCO+ISTAT/ATECO tuttora live (`docs/kb/SOT_STATE.md` L7: RBAC/moduli invariati su questo fronte); 0 clienti paganti reali oggi (2 tenant ACTIVE = RTL Bank caso-di-riferimento + Heuresys System, invariato da giugno, ADR-0026) |
| "3 prospettive unificate (Process/Org/HR)" | **PARZIALE, MIGLIORATO da giugno** | Baseline (`docs/product/BUSINESS_SCOPE_AND_PRD.md:98-99`, 2026-06-17): "Org Director / Process Owner — UI assente". Verificato oggi nel codice: `apps/web/src/app/(authenticated)/org-director/{page,health,vrio,advisor}.tsx` (4 pagine) + `apps/web/src/app/(authenticated)/process-owner/page.tsx` (1 pagina) + API `apps/api/src/modules/capability-composition/` (535 righe service) e `capability-maturity/` (169 righe service) esistono davvero. Asimmetria residua: Org Director è sostanziale, Process Owner è 1 sola pagina — "3 prospettive alla pari" resta un'esagerazione, ma "Process/Org non hanno UI" è oggi FALSO |
| "BPM come differenziatore / runtime di processo" | **SMENTITO, invariato** | Nessun hit per "process-instance", "approval-flow runtime", "task-inbox" in `docs/kb/SOT_STATE.md`/`SOT_BACKLOG.md` da giugno a oggi; G2 (BPM runtime) non risulta chiuso in nessun delta S994→S1115. Resta catalogo statico (blueprint) + link di attivazione |
| "AI talent-intelligence differenziante" | **INDEBOLITO** | Il competitor più vicino al wedge (365Talents) è stato acquisito da Docebo (~$55M, con ~$9M di revenue attesa, ricerca web live) — un vendor indipendente sotto-scala è diventato un prodotto in un LMS con distribuzione e capitale; heuresys resta single-dev, pre-revenue, 0 clienti, nessun modello proprietario (l'agente gira su abbonamento Claude MAX condiviso, non un modello dedicato) |
| "Posizionamento IT-nativo / EU-regolato come wedge" | **CONFERMATO come tesi, NON TESTATO come esecuzione** | Nessun refresh della ricerca competitiva (`docs/product/COMPETITIVE_SCORECARD.md` resta datato "giugno 2026", nessuna menzione dell'acquisizione Docebo/365Talents); nessuna pagina prezzi (`docs/kb/SOT_BACKLOG.md:455-464`, status HOLD, "bloccato su Enzo" da >64 giorni); nessun pilota commerciale firmato (SOT_BACKLOG L1177: "go-to-market=IBRIDO, no pilota" — decisione esplicita di non perseguire un pilota reale) |

## Finding

**P2-001 · TAM ampio e crescente, confermato da fonti multiple con range ampio · Medium · risk**
Evidenza (web, settembre 2026): global HR-tech ~$36.5B (2026) → ~$77.7B (2031), CAGR ~10.35% (Technavio); Europe HR-tech $11.8B (2026) → $26.49B (2035), CAGR ~9.4% (MarkWide) — vs la stima di giugno (~€4.8B 2025 Europa, altra metodologia/fonte). Sotto-segmento AI-in-HR: $6.03B (2026) → $17.58B (2034), CAGR 14.2%. La variabilità fra fonti (2-3× a seconda del perimetro di mercato incluso) è tipica di questi report; il segnale direzionale — mercato grande e in crescita a doppia cifra nel sotto-segmento AI — è comunque robusto su fonti indipendenti.
Impatto: la dimensione del mercato non è mai stata il vincolo per heuresys; resta un dato "stima da fonte terza, variabilità nota", non un fatto misurabile dal repo.
GA-blocker: no.
Remediation: n/a (dato di contesto). Effort n/a. Confidence: Media (fonti terze con metodologie divergenti, direzione concorde).

**P2-002 · Nessun moat difendibile per un prodotto single-developer pre-revenue — invariato da giugno · High · risk**
Evidenza: nessun cliente pagante nuovo (2 tenant ACTIVE invariati, ADR-0026); nessun funding, nessun team oltre il singolo sviluppatore (bus-factor 1, invariato — nessuna menzione di assunzioni in `docs/kb/SOT_STATE.md`); l'agente AI gira su un abbonamento Claude MAX condiviso (`AGENT_GATEWAY_SUBSCRIPTION_AUTH=1`, vedi P4), non un modello proprietario o fine-tuned; BPM ancora senza runtime. Nel frattempo il concorrente più vicino al wedge scelto ha appena acquisito distribuzione e capitale (365Talents→Docebo).
Impatto: la tesi "nessun moat" della baseline non solo regge, ma il divario si allarga: mentre heuresys resta strutturalmente ferma su questi assi, il concorrente di riferimento si è mosso.
GA-blocker: no.
Remediation: invariata — moat va costruito su dati proprietari + integrazioni verticali profonde + switching cost, tutto gated su clienti reali che non esistono. Effort **XL**. Confidence: Alta.

**P2-003 · Gap#1 (Process/Org Director UI) chiuso nel codice — rafforza la dimostrabilità del prodotto, non la posizione di mercato · Medium · strength**
Evidenza: `apps/web/src/app/(authenticated)/org-director/{page,health,vrio,advisor}.tsx` (4 pagine) + `apps/web/src/app/(authenticated)/process-owner/page.tsx` + `apps/api/src/modules/capability-composition/{service,repository,routes}.ts` (535 righe) + `apps/api/src/modules/capability-maturity/{service,repository,routes}.ts` (169 righe) + `apps/api/src/modules/advisor/service.ts`. La baseline di giugno (`BUSINESS_SCOPE_AND_PRD.md:98-99,133`) indicava esplicitamente questo come "il gap di credibilità" #1 per un investitore ("mostrami un Process Owner che usa la piattaforma" = silenzio).
Impatto: la domanda dell'investitore oggi ha una risposta parziale (Org Director sostanziale, Process Owner ancora 1 pagina sola) — non è più "silenzio", ma non è ancora "parità fra le 3 prospettive". Questo migliora la tesi di *prodotto* (P1) più che la tesi di *mercato*: non cambia clienti, moat, o pricing.
GA-blocker: no.
Remediation: completare Process Owner UI a parità con Org Director (Effort M) e usare questa dimostrazione nel materiale investitori/demo, oggi non aggiornato per riflettere il cambiamento (`/demo` risale a S1003, giugno). Confidence: Alta (verificato su file reali).

**P2-004 · Rischio shelfware: il valore AI dipende da dati cliente reali — persiste, mitigazione solo parziale (Tenant Builder) · High · risk**
Evidenza: pattern di fallimento delle talent-intelligence platform confermato dalla letteratura di settore citata a giugno (non ri-cercata stavolta, nessun segnale di smentita). Il Tenant Builder (`#131`/`#132`/`#198`/`#205`/`#206`, `docs/kb/SOT_BACKLOG.md`) automatizza la costruzione del *fascicolo di configurazione* di un'azienda (blueprint processi/ruoli), ma la sua stessa metrica dichiarata è "copertura del metro 11/144 tabelle (7,6%) e 29/329 relazioni (8,8%)" (`SOT_BACKLOG.md:204`) — quindi copre una frazione piccola anche del solo *setup* aziendale, non l'importazione di dati HR reali dei dipendenti (retribuzioni, storico, valutazioni) che è il vero collo di bottiglia citato dalla letteratura shelfware.
Impatto: il rischio "il cliente firma ma non riesce a portare dati puliti" non è stato ridotto in modo sostanziale dall'ultimo trimestre di lavoro, nonostante un investimento ingegneristico reale nel problema adiacente (config del tenant, non dati persona).
GA-blocker: no.
Remediation: instradare il prossimo investimento del Tenant Builder (epiche 2b/2c/P4 ancora ACTIVE/GATED) esplicitamente sull'onboarding di dati-persona reali, non solo di configurazione aziendale. Effort **L**. Confidence: Media.

**P2-005 · Consolidamento competitivo: il concorrente diretto scelto come wedge è stato acquisito, con distribuzione già nel settore bancario target · High · risk**
Evidenza (web, verificato in questa sessione): Docebo ha acquisito 365Talents per ~$54.6M cash + fino a $5.1M earn-out; 365Talents genera clienti come Crédit Agricole, Société Générale, Veolia, Allianz — banche europee, lo stesso segmento (banking mid-market/enterprise EU) su cui heuresys costruisce il suo caso di riferimento (RTL Bank). `docs/product/COMPETITIVE_SCORECARD.md` (datato "ricerca web live giugno 2026") non menziona questo evento e non è stato aggiornato in 3+ mesi nonostante sia il cambiamento di mercato più rilevante per la tesi "1-vs-1 contro 365Talents" del documento stesso.
Impatto: il "white-space" più credibile identificato a giugno (mid-market EU regolato, competitor diretto essenzialmente unico) si restringe — 365Talents ora ha capitale, un canale LMS con base clienti ampia, e presenza già consolidata in banche europee. Il piano di posizionamento raccomandato in `BUSINESS_SCOPE_AND_PRD.md §1.5` va ri-validato: la "battaglia 1-vs-1" non è più contro un pari (startup indipendente), ma contro una business unit di un vendor quotato.
GA-blocker: no.
Remediation: aggiornare `COMPETITIVE_SCORECARD.md` con l'evento Docebo/365Talents e ridefinire il wedge (possibile: segmenti dove Docebo-365Talents non ha ancora presenza, es. banche italiane specificamente, vs le francesi già clienti). Effort **M** (analisi, non codice). Confidence: Alta (fatto verificabile pubblicamente, fonte primaria del deal).

**P2-006 · Confronto competitivo aggiornato: parità funzionale ampliata, inferiorità di go-to-market invariata · Medium · risk**

| Dimensione | heuresys-advanced (oggi) | Personio/Factorial/HiBob | Workday/SAP SF | 365Talents (ora Docebo) |
|---|---|---|---|---|
| Copertura HRMS | Ampia | Ampia + payroll/time maturi | Completa enterprise | Layer skills, non HRMS |
| Process/Org UI | **Parziale (nuovo)**: Org Director 4 pagine, Process Owner 1 | Workflow base | Workflow completi | n/a |
| BPM runtime | **Assente (invariato)** | Workflow base | Workflow completi | n/a |
| AI matching | Embeddings+kNN (commodity) | Add-on | Folded-in | Core, ora con distribuzione LMS Docebo |
| Localizz. IT/EU | Nativa (CCNL/ATECO/ESCO) | Pan-EU | Globale | ESCO/O*NET-aligned, EU |
| Clienti/brand | **0 / nessuno (invariato)** | Migliaia / forte | Enterprise / dominante | Crédit Agricole, Société Générale, Veolia, Allianz |
| Capitale/distribuzione | **Nessuno (invariato)** | Finanziati | Public/enterprise | **Acquisita da Docebo (~$55M), canale LMS** |
| Pricing pubblico | **Nessuno (invariato, `#4` HOLD)** | €7.60-8/dip/mese | Custom enterprise | Custom |

Evidenza: inventario codice (questa sessione) + ricerca web (questa sessione) + `docs/kb/SOT_BACKLOG.md:455-464`.
Impatto: l'unica riga che migliora per heuresys da giugno è "Process/Org UI"; ogni altra riga o è invariata o peggiora relativamente (365Talents più forte, non più debole).
GA-blocker: no.
Remediation: invariata rispetto a giugno — scegliere un wedge più stretto del banking-EU-generico, dato che quel segmento ha ora un incumbent consolidato con clienti reali. Confidence: Alta.

## Score del pilastro

Score: 41 / 100 (Debole) | Confidence: Media

Motivazione: rispetto al 44/100 di giugno il punteggio scende leggermente, non sale, perché il pilastro misura *posizione competitiva e difendibilità di mercato*, non maturità di prodotto. Il miglioramento reale e verificato (P2-003, Gap#1 chiuso) rafforza la dimostrabilità del prodotto ma non tocca nessuna delle determinanti di mercato: zero clienti paganti, zero pricing pubblico, zero capitale, bus-factor 1, nessun moat tecnico (P2-002, invariato). Nel frattempo l'unico sviluppo di mercato verificato in questo trimestre è negativo per la tesi: il competitor scelto come wedge più credibile (365Talents) è stato acquisito da un vendor quotato con distribuzione e clienti bancari europei già in essere (P2-005) — esattamente il segmento su cui heuresys costruisce il proprio caso di riferimento. Il Tenant Builder è un investimento ingegneristico reale ma copre oggi una frazione piccola del problema di onboarding-dati che genera il rischio shelfware (P2-004), quindi non compensa. Resto nella banda Debole (40-59) e non scendo sotto 40 perché il TAM ampio e in crescita è confermato da fonti multiple indipendenti (P2-001) e il wedge di localizzazione IT/EU resta concettualmente valido, anche se va ridefinito. Confidence Media: i dati di mercato restano stime di terzi con metodologie divergenti, ma il fatto competitivo chiave di questo aggiornamento (acquisizione Docebo/365Talents) è verificato da fonte primaria, non stimato.

## Assunzioni aperte (richiedono conferma/decisione di Enzo)
- Dati finanziari (funding ask, runway, budget marketing) non sono discoverable dal repo: trattati come "da confermare", non stimati qui.
- Se e quando riprendere l'idea di un pilota commerciale reale (`SOT_BACKLOG.md:1177` registra la decisione esplicita "no pilota" nel go-to-market ibrido) è una scelta di business, non tecnica — non assunta né contestata in questo WS.
- La ridefinizione del wedge competitivo dopo l'acquisizione Docebo/365Talents (es. restringere a un sotto-segmento geografico o normativo italiano dove Docebo-365Talents non ha ancora clienti) è una decisione strategica che spetta a Enzo, qui solo segnalata come necessaria (P2-005).

## Fonti
- [Docebo Acquires 365Talents for $55M to Add AI Skills Intelligence — Reworked](https://www.reworked.co/learning-development/docebo-acquires-365talents-for-55m-to-add-ai-skills-intelligence/)
- [365Talents Customers](https://365talents.com/en/customers/)
- [365Talents — Skills Intelligence Platform 2026 Buyer's Guide](https://365talents.com/en/resources/skills-intelligence-platform-buyers-guide/)
- [Technavio — HR Technology Market Growth Analysis 2025-2029](https://www.technavio.com/report/human-resource-hr-technology-market-industry-analysis)
- [MarkWide Research — Europe HR Technology Market Forecast 2026-2036](https://markwideresearch.com/europe-human-resource-hr-technology-market)
- [IntelMarketResearch — AI Human Resource Technology Market Outlook 2026-2034](https://www.intelmarketresearch.com/ai-human-resource-technology-market-46899)
- Fonti giugno 2026 (invariate, riportate nella baseline): imarcgroup, marketdataforecast, Personio/Factorial pricing, harmonyhr, knowlee, hiretruffle — vedi versione precedente di questo file in git history.
