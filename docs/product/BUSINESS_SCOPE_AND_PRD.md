# Business Scope & PRD — heuresys-advanced

> **Documento di prodotto** (mancante prima d'ora). Prodotto da un programma di Product Discovery a 5 fasi (2026-06-17), partendo dal presupposto di *scoprire* ciò che non era esplicito.
> **Basi**: la due-diligence forense (`docs/due-diligence/`), i tre store di conoscenza (`heuresys-advanced-wiki` ingegneristico, `heuresys-advanced-graph` codice, **`heuresys-wiki`** prodotto/strategia — mai entrato nella DD), una cartografia funzionale del codice (F0), una ricerca competitiva web live (F2) e una caccia alle funzionalità latenti (F3).
> **Postura**: la visione di prodotto è stata trattata come **da sfidare**, non come verità; l'ICP come **finding da derivare**.
> **Ground-truth**: dove wiki e codice divergono, vince il codice (`docs/kb/SOT_STATE.md` + cartografia F0). Il `heuresys-wiki` descrive in parte il **legacy** `heuresys-evo`, non l'advanced.

---

# PARTE 1 — BUSINESS SCOPE

## 1.1 Cos'è davvero (natura, evidence-based)

heuresys-advanced **è oggi**: una piattaforma **HRMS multi-tenant** con un modello dati insolitamente profondo e pulito, **position-centric** (la posizione è entità prima, non l'impiegato — I1) e **ESCO-native** (21.939 skill, 126.051 requisiti occupation-skill, embeddings pgvector). Su questo poggiano 75 moduli API che coprono: organizzazione/posizioni, ruoli/carriere/successione, skill/learning/assessment, KPI/compensation/engagement, matching semantico + insight (skill-gap, flight-risk, succession-readiness), visualizzazione, export CSV/XLSX/PDF, notification center in-app, una admin SPA e un portale Employee Self-Service. Auth self-built solida, RBAC a 11 ruoli, AI-Act-friendly (euristiche deterministiche, non ML black-box).

heuresys-advanced **NON è (ancora)**, malgrado il nome e la narrativa:
- **un BPM**: non esiste alcun runtime di processo (zero process-instance, task-inbox, approvazioni, SLA). Il lato "process" è solo *catalogo statico* (blueprint) + un link di attivazione. Esiste una *spec* di approval-flow, non il codice.
- **una piattaforma di "Organizational Intelligence"** nel senso pieno rivendicato: il layer prescrittivo (scorecard capability, VRIO, maturity engine, advisor) è **progettato, non costruito**; e delle 3 prospettive d'accesso promesse (Process Owner / Org Director / HR) **solo quella HR ha UI** — Process e Org hanno ~zero pagine.
- **un business**: zero monetizzazione, zero clienti reali, dati sintetici (vedi DD).

> **Il gap centrale del prodotto** non è qualità: è la **distanza tra l'ambizione dichiarata** ("governare la capability organizzativa su 5 dimensioni come grafo, 3 prospettive, BPM+HRMS") **e la realtà spedita** (un ottimo HRMS+skills con 1 prospettiva su 3, nessun runtime di processo, nessun layer prescrittivo).

## 1.2 Lo scopo (north-star)

Dal `heuresys-wiki`, lo scopo è genuino e ben formulato — il **"test del valore"**:

> *Il sistema crea valore se e solo se il dato inserito genera **decisioni diverse** da quelle che l'organizzazione prenderebbe senza il sistema.* Se il mapping skill viene compilato ma nessuno lo usa per staffare, se la review è compilata ma il rating era già deciso — allora è **compliance**, non governance, e il cliente smette di alimentarlo.

È un north-star raro perché è simultaneamente criterio di valore (per heuresys) e criterio di successo (per il cliente). **Lo teniamo.** Ma va reso *operativo come metrica* (vedi §2.8) — oggi è una frase, non uno strumento.

## 1.3 La tesi di categoria — "Organizational Intelligence" — SFIDATA

**La visione** (wiki): creare una nuova categoria enterprise, sopra ERP/HR/BI, che *governa* la capability organizzativa. Slogan: *"SAP manages how the company runs. Heuresys manages the company's ability to run."*

**La sfida** (ricerca competitiva live + ground-truth codice):

1. **La "nuova categoria" non esiste come mercato.** Volume di ricerca ~zero; nessun analista la riconosce come segmento. Esiste invece una categoria **affollata e già nominata**: il *Forrester Skills Intelligence Solutions Landscape Q1 2026* censisce **27 vendor**. Creare categoria = costo di educazione mercato altissimo, sostenibile solo da chi ha capitale e brand — heuresys non li ha.
2. **I differenziatori dichiarati non reggono** (dettaglio in `COMPETITIVE_SCORECARD.md`): ontologia ESCO aperta = *table-stakes* con svantaggio dimensionale (ESCO ~22k skill vs Workday 73k, Cornerstone 53k, Lightcast 32k aperta); 3 prospettive unificate = table-stakes; "continuous vs consulting" = combatte un nemico di paglia. **Solo l'ampiezza a 5 dimensioni è genuinamente distintiva** — ma è fragile: realizzata con euristiche+kNN (non ML), replicabile, non brevettata (esiste già un brevetto USPTO su "unified graph of skills and acumen"), e priva di *data moat* (0 clienti).
3. **Il prodotto che giustificherebbe la categoria non è costruito**: Process+Org perspectives e layer prescrittivo sono latenti.

> **Verdetto sulla tesi**: "Organizational Intelligence" come *nuova categoria* **non sopravvive al contatto col mercato 2026**. Va **riposizionata**, non difesa. Il riposizionamento raccomandato è in §1.5.

## 1.4 ICP — risoluzione del finding (tensione PMI vs Enterprise)

La tensione "PMI 50-250 vs Enterprise 1000+" era esplicitamente aperta nel wiki. La risolviamo incrociando boundary-conditions (wiki) + realtà competitiva (F2):

- **Escludere** (boundary conditions, confermate): startup <25 (framework prematuro, L1≈L0), holding finanziarie pure (niente da governare), org flat-radicali (rifiuto culturale della gerarchia), SMB <50 (non hanno la complessità che il prodotto risolve).
- **Enterprise 1000+ è precluso oggi**: nessun data moat, 0 clienti, single dev, nessun ML, nessun brand — contro Workday/SAP/Eightfold/Cornerstone (1B+ profili, funding a 9 cifre) è una battaglia persa.
- **Project-based e PA** richiedono *scope-extender non ancora costruiti* (Assignment entity, Regulatory Constraints Layer) → mercati futuri, non attuali.

> **ICP risolto (primario)**: **mid-market europeo, 250–2000 dipendenti, in settori strutturati/regolati** — banking (il tenant di riferimento RTL_BANK è una banca), assicurazioni, sanità, utility — dove convergono i 3 asset reali di heuresys: ESCO-native (standard pubblico EU, anti-lock-in), spiegabilità deterministica (compliance **AI Act**), e modello position-centric (org-design che SAP serve a costi proibitivi). In quel segmento il competitor diretto è essenzialmente **uno** (365Talents, EU, ESCO-aligned), non 27.
>
> **ICP secondario / più avanti**: enterprise multi-nazionale via estensione GCC; PA via Regulatory Constraints Layer.
> **Esplicitamente NON-target**: SMB, startup early-stage, holding pure, flat-radicali.

**Caveat onesto**: "EU regolato" è in parte *gated* su una feature non costruita (Regulatory Constraints Layer per la PA). Il segmento **immediatamente** aggredibile è il **banking/finance mid-market** tipo RTL — già il caso di riferimento — dove non servono extender normativi PA.

## 1.5 Posizionamento raccomandato (riframing)

Da: *"Organizational Intelligence — nuova categoria, governa la capability, sopra SAP"* (ambizioso, indifendibile, 1-vs-27).

A: **"La piattaforma Skills & Org Intelligence EU-native, ESCO-based e spiegabile (AI-Act) per il mid-market regolato"** — battaglia 1-vs-1 contro 365Talents, su asset reali e difendibili, in un segmento dove gli incumbent US-enterprise sono deboli (sovranità dati, localizzazione, lock-in proprietario).

I tre cunei reali su cui costruire il posizionamento:
1. **ESCO-native aperta** → interoperabilità con standard pubblici EU, niente lock-in, cross-country benchmarking. Rilevante *solo* in EU/regolato (altrove è svantaggio dimensionale).
2. **Spiegabilità deterministica = compliance AI Act** → ogni raccomandazione (succession, flight-risk) è auditabile e difendibile davanti a un regolatore. Capovolge "no real ML" da debolezza a feature. **È il wedge più sottovalutato.**
3. **Modello position-centric (I1)** → org-design e legame struttura↔processo↔competenza che SAP serve a costi proibitivi; quasi nessuno modella la posizione come entità prima.

## 1.6 Il moat reale (onesto)

| Asset | È un moat? | Nota |
|---|---|---|
| ESCO-native + crosswalk NACE pubblico | **Sì, di nicchia** | Difendibile in EU/regolato; altrove table-stakes |
| Position-centric model (I1) | **Sì, architetturale** | Genuinamente raro; abilita org-design sotto-SAP |
| Spiegabilità AI-Act | **Sì, regolatorio** | Diventa moat con l'AI Act in vigore |
| Ampiezza pulita 5-dim + suite testata | **Parziale** | Reale come prodotto, replicabile come concept |
| "Nuova categoria OI" | **No** | Non esiste come mercato; costo educazione proibitivo |
| Grafo / knowledge-graph architecture | **No** | Standard de facto (Workday/Beamery/Cornerstone/Gloat) + già brevettato |
| Data network effects | **No (oggi)** | Richiede clienti; oggi 0 |

---

# PARTE 2 — PRD (Product Requirements Document)

## 2.1 Vision & problem statement

**Problema**: le organizzazioni mid-market regolate EU devono governare la propria *capability* (chi sa fare cosa, dove sono i gap, chi succede a chi, come si allinea a struttura e obiettivi) ma gli strumenti disponibili sono o suite enterprise US costose, lock-in e black-box (Workday/SAP), o consulenza project-based non continua, o punti-soluzione (solo org-design, solo skills, solo analytics). Nessuno offre, a costo mid-market, un modello **continuo, spiegabile, basato su standard aperti** che colleghi struttura, ruoli, competenze e performance.

**Vision di prodotto (riframe)**: la piattaforma EU-native che rende la capability organizzativa **misurabile, spiegabile e azionabile** per il mid-market regolato — con la posizione come unità di governance e ESCO come linguaggio comune.

## 2.2 Personas / utenti target

| Persona | Bisogno primario | Stato UI oggi |
|---|---|---|
| **HR / CHRO** (Porta 3) | mappare skill, gap, learning, performance, comp | ✅ admin SPA completa |
| **Manager** | il proprio team: skill, gap, succession, KPI | ✅ "my team" axis |
| **Employee** | profilo, skill, carriera, learning, inbox (ESS) | ✅ portale `/me/*` |
| **Org Director** (Porta 2) | disegnare struttura/posizioni e vederne capability | ⚠️ **UI assente** — gap #1 |
| **Process Owner** (Porta 1) | processi e loro legame a ruoli/skill/KPI | ⚠️ **UI assente** — gap #1 |
| **C-suite / Board** | scorecard strategiche (VRIO, essential capability, maturity) | ⚠️ **non costruite** — gap #3 |

## 2.3 Jobs-to-be-done (mid-market regolato)
- "Mappa le competenze reali della mia popolazione contro uno standard pubblico (ESCO), non contro un catalogo proprietario."
- "Dimmi i gap di competenza per posizione/unità e come chiuderli (learning)."
- "Chi è pronto a succedere in una posizione critica, e perché — in modo che possa difenderlo davanti a un audit."
- "Chi è a rischio di abbandono, con motivazione spiegabile (non un punteggio black-box)."
- "Allinea ruoli, struttura e obiettivi e mostrami dove la capacità organizzativa è sotto la soglia."

## 2.4 Principi di prodotto (non-negoziabili)
- **Live-data only** (no mock in produzione — già dottrina del repo).
- **Spiegabilità prima dell'accuratezza**: ogni raccomandazione deve essere auditabile (AI-Act). Niente deep-learning black-box sul percorso decisionale HR.
- **ESCO/standard pubblici come linguaggio**, overlay tenant sopra — mai ontologia proprietaria lock-in.
- **Position-centric (I1)** e gli altri invarianti architetturali restano.
- **No-PII finché non c'è un tenant reale**; al primo tenant, GDPR/AI-Act diventano prerequisiti (DD).

## 2.5 Inventario funzionale attuale (sintesi — dettaglio in cartografia F0)

> I **conteggi** (moduli / endpoint / migration / tabelle) vivono nella SoT tecnica `docs/kb/SOT_STATE.md` (ri-derivata ogni sessione) e l'inventario funzionale verificato voce-per-voce nel `FUNCTIONAL_CAPABILITY_LEDGER.md` — non ripetuti qui per evitare drift (regola anti-duplicazione T2, design SoT prodotto 2026-06-19).

| Dimensione | Shipped (estratto) | Parziale / assente |
|---|---|---|
| **Process** | blueprint families/variants/processes, activation (linking), RACI OU↔processo | ⚠️ KPI-template processo (stub); ❌ **runtime di processo** |
| **Structure** | org-units (albero), positions, **PIP (VIEW)**, tenants + enterprise-typing, teams | closure-table non usata (by-design) |
| **Role** | job-families/roles (ESCO-mapped), career-paths, succession pools/candidates/readiness | — |
| **Competence** | skill taxonomy ESCO (21.9k), 126k occupation-skill, learning, assessment, gap+closure, mentorship | layer hard/soft skill deferred |
| **Performance** | KPI completo, compensation intelligence, engagement/surveys, predictions (read), flight-risk, reviews, attendance | goals/OKR a livello schema |
| **Platform** | auth+MFA, RBAC, multi-tenant (no-RLS), audit/lineage, **export CSV/XLSX/PDF**, **inbox**, **semantic matching kNN**, agent-gateway, visualization, analytics (9 viste), a11y CI | digest email dormiente (no SMTP) |

**Implementato-ma-sotto-comunicato** (da valorizzare nel pitch): export universale, inbox, a11y in CI, PIP, embeddings/semantic-matching live, insight succession/flight-risk/skill-gap, agent-gateway MCP, visualization completa.

## 2.6 I gap che definiscono la roadmap

- **G1 — Porte 1+2 (Process Owner / Org Director) UI.** È il gap di **credibilità**: senza, la risposta alla domanda VC "mostrami un Process Owner che usa la piattaforma" è silenzio. Converte il claim di categoria da slide a demo. *(Confermato da F0 codice + F3 wiki, indipendentemente.)*
- **G2 — BPM runtime** (process-instance/task/approval/SLA). Serve per onorare il nome "BPM". Esiste già una *spec* approval-flow (`docs/superpowers/specs/2026-06-17-bpm-approval-flow-design.md`) che riusa il notification center.
- **G3 — Layer prescrittivo di capability**: MLCE (motore di composizione multi-livello) + almeno una scorecard (Maturity engine o VRIO). È ciò che trasforma "HRMS+skills" in "intelligence". I building-block dati esistono (da ri-verificare sul repo advanced, non sul wiki legacy).
- **G4 — Layer commerciale** (signup/provisioning multi-tenant + billing + onboarding). Da DD. Senza, non è vendibile.
- **G5 — Compliance + infra de-risk**: dossier AI-Act (formalizzare l'high-risk + spiegabilità), GDPR tooling al primo tenant; managed-DB/HA, CI≠PROD, observability, rollback (da DD).
- **G6 — Scope-extender** (apertura mercati): Regulatory Constraints Layer (PA), Assignment entity (project-based), GCC (enterprise multi-nazionale), Capability Academy autogen.

## 2.7 Roadmap — Now / Next / Later

**NOW (provare il claim + rendere vendibile, allineato all'ICP banking mid-market)**
1. G1 — Porte 1+2 UI (Org Director + Process Owner) sul grafo esistente.
2. G3 (slice) — MLCE Phase-1 + **1 scorecard** (raccomandato: Capability **Maturity engine** L0-L5, già con rubrica) per dimostrare "intelligence".
3. G4 (MVP) — provisioning multi-tenant + pricing/billing minimo.
4. G5 (infra) — de-personalizzare infra + AI-Act explainability dossier (basso costo, alto valore vendita regolato).
5. **Pilota reale**: 1 cliente banking/finance mid-market firmato (kill-criterion della DD: C6).

**NEXT (dopo il primo pilota)**
6. G2 — BPM approval-flow runtime (slice-D già specificato).
7. AI Advisor fase 1 (suggerimenti contestuali) — moltiplica le scorecard da passive a prescrittive.
8. Altre scorecard prescrittive (VRIO + Essential Capability Ranker = funnel board-ready C-suite).
9. GDPR tooling completo (gate primo tenant EU con PII reale).

**LATER (apertura nuovi segmenti — scelta GTM)**
10. Regulatory Constraints Layer → PA italiana/EU.
11. Assignment Staffing Entity → consulting/project-based.
12. GCC Multi-Tenant Orchestration → enterprise multi-nazionale.
13. Capability Academy autogen, DPI, Routine Mutation Analytics, OHS (differenziatori "cite-power", una volta che c'è trazione).

## 2.8 Metriche di successo

**North-star** (operazionalizzare il "test del valore"): **% di entità mappate che generano una decisione tracciabile** (uno staffing, una promozione, un piano di chiusura gap, una mossa di successione) entro N giorni dall'inserimento. Se il dato non muove decisioni, il prodotto sta fallendo per definizione.

Metriche di supporto:
- **Activation**: % tenant che attivano ≥2 delle 3 Porte (oggi strutturalmente impossibile → vincolata a G1).
- **Time-to-value**: giorni da onboarding a primo insight azionato.
- **Capability coverage**: % posizioni con PIP completo e gap calcolati.
- **Pilot/commercial**: 1° pilota firmato (NOW), conversione pilota→pagante, ARPA.
- **Explainability/compliance**: % raccomandazioni con traccia auditabile (target 100% — è il wedge).

## 2.9 Non-goals (esplicitati per disciplina)
- Payroll, attendance transazionale, moduli ERP, workflow operativi → diluirebbero il differenziale (guardrail wiki).
- Sostituire un HCM completo (Workday/SAP) → coexistence, non replacement.
- SMB / startup early-stage / holding pure / flat-radicali → fuori ICP.
- Gara di "skill inference ML" su miliardi di profili → non vincibile e contraddice il wedge spiegabilità.
- "Nuova categoria OI" come strategia GTM primaria → troppo costosa da educare per lo stadio.

## 2.10 Rischi
- **Key-person / bus factor 1** (DD X3) — esistenziale; precede tutto.
- **Nessun data moat** — il differenziatore 5-dim è replicabile; la difesa deve venire da GTM + dati accumulati + brand.
- **ICP gated** — "EU regolato" pieno dipende dal Regulatory Constraints Layer (non costruito); mitigazione: partire dal banking mid-market che non lo richiede.
- **Costo educazione categoria** — mitigato dal riposizionamento in una categoria esistente (Skills/Org Intelligence) vs crearne una nuova.
- **365Talents** — competitor EU diretto già nel Forrester Landscape; serve un wedge netto (spiegabilità + position-centric + process).
- **Drift wiki↔codice** — la visione di prodotto è ancorata in parte al legacy; ogni claim "building-block presente" va ri-verificato sul repo advanced prima di impegnarlo in roadmap.

## 2.11 Domande aperte al founder (bloccanti per finalizzare scope/PRD)
- Pricing/packaging previsto? (assente nel codice)
- Titolarità IP del legacy `heuresys-evo` e di `@heuresys/ui`? (assunta, non verificata — vedi DD)
- Impegno full-time del founder + piano hiring 2° dev?
- Quale verticale per primo: banking mid-market (immediato) vs PA (richiede RCL)?
- La tesi "Organizational Intelligence" è negoziabile? (questo doc raccomanda di riposizionarla)

---

## Allegati / deliverable collegati
- `COMPETITIVE_SCORECARD.md` — benchmark vs alta fascia (web live), matrice di copertura, adjudicazione differenziatori.
- `LATENT_CAPABILITY_CATALOG.md` — funzionalità progettate-ma-non-costruite + latenti, con valore di mercato ed effort.
- Cartografia funzionale completa (F0): vedi sintesi §2.5 + `docs/kb/SOT_STATE.md`.

*Limiti dichiarati: gli stati funzionali sono "codice + test presenti", non ri-eseguiti live in questa sessione (no tunnel). Gli stati delle funzionalità latenti vengono dal wiki (in parte legacy) e vanno ri-verificati sul repo advanced. Le claim competitive sono web-sourced (giugno 2026, fonti in COMPETITIVE_SCORECARD.md).*