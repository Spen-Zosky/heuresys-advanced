# Competitive Scorecard — heuresys-advanced vs alta fascia

> Benchmark investor-grade, postura avversariale. Ricerca **web live giugno 2026** (12 ricerche, 11+ competitor). Fonti in calce.
> Contesto che incornicia tutto: il **Forrester Skills Intelligence Solutions Landscape Q1 2026** censisce **27 vendor**. heuresys non entra in un vuoto di categoria — entra in un mercato affollato in consolidamento.

## 1. Matrice di copertura

Legenda: ● nativo/forte · ◐ parziale/via integrazione · ○ assente/marginale.

| Vendor | Process | Structure | Role | Competence | Performance | Ontologia | Approccio AI | Segmento |
|---|---|---|---|---|---|---|---|---|
| Workday Skills Cloud | ○ | ◐ | ● | ● (~73k) | ● | Proprietaria ("most open") | ML + graph | Enterprise |
| SAP SuccessFactors + Signavio | ● (Signavio) | ◐ | ● | ● | ● | Proprietaria multi-source | ML + process mining | Enterprise |
| Eightfold AI | ○ | ◐ | ● | ● (1.6M) | ◐ | Proprietaria deep-learning | Deep learning (1.6B carriere) | Mid-Enterprise |
| Beamery | ○ | ◐ | ● | ● (Talent Graph 17B) | ◐ | Proprietaria "strongly typed" | GenAI + KG | Enterprise |
| Visier | ○ | ◐ | ◐ | ◐ | ● | Data model proprietario | Analytics + GenAI | Enterprise |
| Gloat | ○ | ◐ | ● | ● (multi-ontology graph) | ◐ | Proprietaria + public | AI inference + graph | Enterprise |
| Lightcast | ○ | ○ | ● | ● (32k+) | ○ | **Aperta/trasparente** | Data mining bottom-up | Data layer B2B2X |
| Concentra/Orgvue | ◐ | ● (org design) | ● | ◐ | ◐ | Proprietaria | Predictive + scenario | Enterprise/consulting |
| Microsoft Viva (Glint/Skills) | ○ | ○ | ◐ | ◐ (LinkedIn) | ● | LinkedIn graph | Copilot GenAI | Enterprise (MS) |
| Cornerstone (Galaxy/SkyHive) | ○ | ◐ | ● | ● (53-55k) | ● | Proprietaria + 40TB | Inference + Galaxy AI | Enterprise |
| **365Talents** (EU) | ○ | ◐ | ● | ● (dynamic) | ◐ | **ESCO/O*NET/WEF-aligned** | AI enrichment | Mid-Enterprise EU |
| TechWolf (EU) | ○ | ○ | ● | ● (35k) | ○ | Proprietaria KG | 5-layer AI | Enterprise (infra) |
| **heuresys-advanced** | ● (BPM statico) | ● (position-centric) | ● (PIP) | ● (ESCO 21.9k) | ● | **ESCO-native aperta** | Euristiche deterministiche + kNN | (target) mid-market EU |

**Lettura**: heuresys è l'**unico** a marcare ● su tutte e 5 le dimensioni *insieme* a ontologia aperta. MA ogni singola dimensione è già coperta a ● da ≥1 incumbent con risorse 100-1000×. Copertura "full-spectrum" **ampia ma sottile** (euristiche, 0 dati clienti) vs incumbent profondi su 3-4 dimensioni con anni di dati reali. Nota: il ● Process di heuresys è *modeling statico*, non runtime.

## 2. Adjudicazione spietata dei 4 differenziatori dichiarati

| # | Differenziatore | Verdetto | Perché |
|---|---|---|---|
| a | Ontologia ESCO aperta vs proprietaria | **Table-stakes → svantaggio** | Lightcast è aperta+trasparente e più grande (32k); 365Talents è già ESCO-aligned ed è EU. ESCO ~22k è **più piccola** di Workday 73k / Cornerstone 53k / Lightcast 32k. "Aperta ma piccola" è arma a doppio taglio. Margine reale solo in EU pubblico/regolato + anti-lock-in. |
| b | Grafo unificato a 5 dimensioni | **Genuinamente distintivo MA fragile** | È il claim più forte: nessun singolo vendor copre con eguale ampiezza in un solo grafo. Ma il KG è standard de facto (Beamery/Cornerstone/Gloat/Workday), esiste già un brevetto USPTO su "unified graph of skills and acumen", ed è realizzato con euristiche+kNN senza data moat → **demo architetturale, non vantaggio difendibile**. |
| c | 3 prospettive unificate | **Table-stakes** | Multi-persona sullo stesso modello è standard (Visier, SAP TIH, Gloat, Cornerstone). E heuresys ne ha implementata **solo 1 su 3** (HR). |
| d | Continuous platform vs consulting | **Table-stakes / nemico di paglia** | Tutti gli incumbent SaaS sono già "continuous". Il claim combatte le società di consulting org-design, non i veri competitor software. |

**Sintesi**: dei 4, **solo (b) è distintivo**, e solo come ampiezza-di-concept, non come vantaggio difendibile.

## 3. Top 5 minacce · Top 3 white-space

**Minacce**: (1) **365Talents** — EU, ESCO-aligned, Forrester-listed, clienti reali → annulla gran parte del diff. (a); (2) **SAP SuccessFactors+Signavio** — l'unico che unisce davvero process+skills+org su scala → attacca il diff. (b); (3) **Lightcast** — apertura ontologica maggiore, venduta come layer-dati sotto chiunque; (4) **Gloat/Beamery** — grafo+GenAI su dati reali, profondità che heuresys non eguaglia; (5) **TechWolf** — skills-infra leggera, GTM imitabile ma con prodotto+clienti+AI già pronti.

**White-space onesti**: (1) **mid-market EU regolato/pubblico** sensibile a sovranità dati + standard pubblici (ESCO) — il meno improbabile; (2) **process+org come grafo unico sotto-SAP** sfruttando la **position-centricity** (l'asset architetturale più sottovalutato); (3) **spiegabilità/anti-black-box come compliance play AI-Act** — l'unico contesto in cui "no real ML" si capovolge in feature.

## 4. Segmento con la chance meno improbabile

**Mid-market europeo (IT in primis), regolato/pubblico**, buyer sensibile a sovranità dati + standard aperti + spiegabilità algoritmica. Enterprise precluso (no data moat, 0 clienti, single dev). SMB sbagliato (niente complessità da risolvere). In quel segmento i tre asset reali convergono (ESCO rilevante, euristiche = AI-Act-compliant, position-centric serve org-design sotto-SAP) e il competitor diretto è essenzialmente **uno (365Talents)** invece di 27.

**Caveat non addolcito**: anche lì la chance resta *improbabile in assoluto* — pre-revenue + single dev + 0 clienti + no data moat + 27 vendor. La difendibilità non viene dal prodotto (replicabile, non brevettato) ma da GTM + dati accumulati + brand, oggi assenti. La tesi "Organizational Intelligence" come *nuova categoria* **non regge**: va riposizionata come *skills+org intelligence EU-native, ESCO-based, AI-Act-explainable per mid-market regolato*, 1-vs-1 vs 365Talents.

## Fonti (web, giugno 2026)
Forrester Skills Intelligence Solutions Landscape Q1 2026 (27 vendor); Workday Skills Cloud datasheet/blog; SAP SuccessFactors Talent Intelligence Hub + SAP Signavio; Eightfold (review/Gartner Peer Insights); Beamery (Knowledge Graphs blog, TalentGPT PR); Visier (Vee, 2026 Trends); Gloat (skills ontology framework); Lightcast Open Skills; Orgvue; Microsoft Viva Glint; Cornerstone Workforce AI / Skills Graph datasheet; 365Talents (skills interoperability, Forrester listing, 2026 roadmap); TechWolf Skill Intelligence Index; USPTO patent "unified graph representation of skills and acumen"; Workday/SAP/Oracle PEPM pricing. *(URL completi nel report integrale dell'analista competitivo, sessione 2026-06-17.)*