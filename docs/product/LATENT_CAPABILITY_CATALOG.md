# Latent Capability Catalog — heuresys-advanced

> Funzionalità **concepite/progettate ma (probabilmente) non costruite**, più capability latenti implicite nel modello. Derivato dal `heuresys-wiki` (KB di prodotto/strategia).
> **⚠️ Disclaimer critico**: gli stati provengono dal **wiki**, non dal codice. Il wiki descrive in parte il **legacy `heuresys-evo`** (es. "106 pagine", embeddings 1536-dim, mig 202-203) che **non coincide** con il repo advanced (85 pagine, voyage 1024-dim). Pattern ricorrente del wiki: *"building-block dati presenti, manca solo l'orchestration/computation layer"* — **da ri-verificare sullo schema del repo advanced** prima di impegnarlo in roadmap.
> Tassonomia stato: *idea* = abbozzo · *design-pending* = pipeline+schema+KPI specificati, orchestration non implementata · *partial* = building-block a schema, modulo compositore mancante.

## Catalogo

| Feature | Cos'è | Stato (wiki) | Valore di mercato | File |
|---|---|---|---|---|
| **Capability Academy Autogen** | Genera learning-path personalizzati per tenant dal grafo org, closed-loop con skill validation | design-pending | L&D self-service senza config manuale; "Bersin Academy auto-generata" | capability-academy-autogen.md |
| **VRIO Scorecard** | Scora ogni capability su VRIO continuo 0-100% + azioni; alert "unused advantage" | design-pending | Output board-ready (CSO/CFO); Barney da statico a live | vrio-scorecard.md |
| **Essential Capability Ranker** | Auto-identifica le 3-5 capability essential vs good-enough (scoring 5-componenti) | design-pending | "Bain la predica, Heuresys la esegue"; budget L&D data-driven | essential-capability-ranker.md |
| **OHI Data-Driven Scorecard (OHS)** | Alternativa data-driven all'Organizational Health Index McKinsey, ~80% senza survey | design-pending | Board-grade continuo vs survey annuale; attenzione IP→rinominare OHS | ohi-data-driven-scorecard.md |
| **Dynamic Performance Index (DPI)** | Metrica della capacità di rinnovarsi di un'unità (operazionalizza Teece) | design-pending | "Prima metrica industrializzata di dynamic capability"; cite-power | dynamic-performance-index.md |
| **Routine Mutation Analytics (RMA)** | Tracking+classificazione mutazioni di routine (Nelson-Winter, process-mining esteso) | design-pending | "Prima implementazione operational di Nelson-Winter"; > Celonis/Signavio | routine-mutation-analytics.md |
| **AI Augmentation Score (AAS)** | KPI 0-100 di readiness Human+AI per unità org | design-pending | Strumenta il "89% Accenture" in KPI continuo; audience CIO/CDO | ai-augmentation-score.md |
| **GCC Multi-Tenant Orchestration** | Governance cross-tenant per Global Capability Center multi-nazionali | design-pending (F7+) | Apre enterprise multi-national (~1.700+ GCC); -50% TCO vs Accenture | gcc-multi-tenant-orchestration.md |
| **Regulatory Constraints Layer (RCL)** | Framework normativi (CCNL) come vincoli first-class sulla config tenant | design-pending (F8+) | Apre PA italiana (~5-10M dipendenti) + regolati; compliance-by-design | regulatory-constraints-layer.md |
| **Assignment Staffing Entity** | Da org-persistente ad "assignment-as-primary" (employee×project×role×period) | design-pending (F8+) | Apre project-based (consulting, SI, studi legali) | assignment-staffing-entity.md |
| **AI Advisor** | Agent always-on (Claude SDK) che osserva 24/7, produce digest/alert/PR draft | draft; Tier-1 ratificato, data-layer (legacy) implementato | Brain prescrittivo che attiva tutte le altre scorecard | ai-advisor.md |
| **Multi-Level Composition Engine (MLCE)** | *Calcola* (non solo rappresenta) il capability_score aggregato employee→role→unit→org con lineage | design-pending (Phase 1 spec, ADR-014) | Capability composta auditabile; dipendenza a monte di VRIO/OHI/Maturity | multi-level-composition-engine.md |
| **Capability Maturity Engine** | Deriva algoritmicamente maturity L0-L5 via query SQL auditable | rubric stabile; engine design-pending | Maturity senza intervista, benchmarkabile, trend QoQ | capability-maturity-scale.md |

## Raggruppamento

**(a) Differenziatori nascosti** (alto valore, "prima sul mercato"): VRIO Scorecard + Essential Capability Ranker (funnel C-suite board-ready); OHI Data-Driven (OHS); Dynamic Performance Index + Routine Mutation Analytics (cite-power Teece/Nelson-Winter, sfruttano event-sourcing); Performance↔Skill loop closure (moat dichiarato).

**(b) Scope-extender** (cambiano *a chi* vendi): Assignment Staffing Entity (project-based); Regulatory Constraints Layer (PA/regolati); GCC Orchestration (enterprise multi-nazionale); onboarding-light (startup, menzionato dentro Academy autogen).

**(c) Layer AI/advisor**: AI Advisor (il moltiplicatore che rende prescrittive le scorecard passive — condizione tecnica per la maturity L5); AI Advisor Architecture (7 ADR, 5 da ratificare).

## Le 3-5 latenti più trasformative (per impatto sul posizionamento)

1. **Porte 1+2 (Process Owner / Org Director) UI** — *non è "visione"*: è il differenziatore già rivendicato verso i VC ma con **zero pagine** (solo HR esiste). È il gap più critico tra narrativa e prodotto dimostrabile. Costruirle converte il claim "categoria/OI" da slide a demo. **(Confermato indipendentemente dalla cartografia del codice F0.)**
2. **AI Advisor (fase 1+) + closed-loop** — trasforma ogni scorecard latente da diagnostica passiva a sistema prescrittivo; massimo effetto-leva.
3. **VRIO Scorecard + Essential Capability Ranker** — spostano il buyer da HR a C-suite/board; pivot da HRMS a piattaforma strategica.
4. **Multi-Level Composition Engine** — abilitatore strutturale silenzioso: senza, VRIO/OHI/Maturity non hanno l'input numerico cross-livello. Dipendenza a monte.
5. **Regulatory Constraints Layer** *oppure* **Assignment Staffing Entity** — ciascuno apre un intero segmento precluso (PA vs project-based). Scelta GTM.

## Osservazione di sintesi
Il valore latente è quasi tutto **nell'orchestration/computation layer, non nei dati**: gli asset-grafo (ESCO, NACE crosswalk, event-sourcing, embeddings) sono dichiarati presenti e sotto-utilizzati ("consumati come tabelle SQL, non come grafo" — debt esplicito). La leva più alta non è raccogliere più dati ma **costruire i moduli che compongono i dati esistenti in scorecard prescrittive**, più le due Porte UI che rendono il differenziatore dimostrabile.

## Azione di verifica raccomandata (prima di impegnare in roadmap)
Ri-verificare sul **repo advanced** (non sul wiki legacy) quali "building-block" esistono davvero: schema migrazioni (`db/migrations`), presenza di `goal_alignments`/`alignment_weight`, event-sourcing/talent-signals, tabelle capability_score/maturity. Il wiki sovrastima la prontezza perché in parte parla del legacy.

*Fonte: 22 concept in `C:\Users\enzospenuso\wiki-space\heuresys-wiki\wiki\concepts\`. Stati = dichiarazioni wiki, non codice (R5/R10).*