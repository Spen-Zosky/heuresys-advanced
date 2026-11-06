# Product Domain — Source of Truth

Questa cartella è la **SoT del dominio prodotto** di heuresys-advanced (adottata S997). È disgiunta da `docs/kb/` (SoT tecnica) e `docs/due-diligence/` (SoT investor): i domini si **referenziano**, non si duplicano.

## Il posizionamento, in breve

Dal 2026-11-03 il posizionamento di Heuresys è fissato da **ADR-0054** (`docs/architecture/adr/0054_heuresys_piattaforma_del_cambiamento_organizzativo.md`), che sostituisce quello del PRD di giugno:

- **Che cos'è**: la piattaforma con cui un'impresa governa il proprio **cambiamento organizzativo**: conosce lo stato attuale (struttura, posizioni, processi, competenze, persone), descrive lo stato futuro, calcola chi e che cosa tocca il passaggio, lo accompagna e ne misura l'adozione.
- **Per chi**: **qualunque tipo di impresa**. La specialità è la modellazione organizzativa, non un settore; i prototipi di settore del datastore sono acceleratori di partenza.
- **Primi clienti**: un fornitore di software gestionale e HR come SAP o Zucchetti, che affianca Heuresys ai suoi prodotti; poi un'impresa manifatturiera di medie dimensioni. RTL Bank resta il tenant modello.
- **Tre persone**: il Direttore HR, che governa il capitale umano; il capo di unità, con il cockpit del suo presidio; il dipendente, che conosce l'azienda e il proprio ruolo senza chiedere.
- **Confini**: niente paghe, presenze, firma elettronica, benefit, dati medici, app mobile nativa; i dati contrattuali importati non si modificano (ADR-0045).
- **Modo di lavorare**: agentico e guidato dall'IA (regola di Enzo del 2026-10-31); quanto l'IA scrive da sola lo decide ADR-0053.
- **Misura del valore**: il «test del valore», reso metrica dal mandato F0-3 del programma esecutivo.

Il contesto della decisione è in `VISIONE_INTEGRATA_HEURESYS_20261103.md` (in questa cartella) e il programma che la attua in `docs/piani/PROGRAMMA_change_management_20261103.md`.

## Mappa dei documenti

| Documento | Ruolo | Quando leggerlo |
|---|---|---|
| **`FUNCTIONAL_CAPABILITY_LEDGER.md`** | **Il cuore.** Guida-alla-verifica: ogni funzionalità (implementata / latente / scoperta) con stato verificato live + evidenza `file:line` + count | per sapere *cosa esiste davvero* e *cosa è implementabile* — input del piano di sviluppo |
| `BUSINESS_SCOPE_AND_PRD.md` | **Storico** (17 giugno 2026): natura, ICP, posizionamento, moat, personas, gap G1-G6, roadmap, metriche, rischi. Posizionamento e ICP superati da ADR-0054; restano utili il «test del valore» (§1.2, §2.8) e l'analisi competitiva | per la storia delle scelte di prodotto, non per la strategia di oggi |
| `COMPETITIVE_SCORECARD.md` | Benchmark vs 27-vendor (web live), adjudicazione dei differenziatori | per il posizionamento competitivo |
| `WORKITEM_GAP1_PERSPECTIVES_AND_SCORECARD.md` | Piano esecutivo del Gap #1 (2 Porte UI + MLCE + Maturity) | primo work-item derivato — esempio del metodo |
| `WORKITEM_GAP1_DESIGN_SPEC.md` | Blueprint esecutivo del Gap #1: data-model, algoritmi, endpoint, migration, 9 decisioni di scope (RE-ALIGNED vs Ledger) | prima di costruire Gap #1 |
| `WORKITEM_GAP1_PHASE0_VERIFICATION.md` | Verifica live dei building-block del Gap #1 | esempio gold-standard del metodo di verifica |
| `LATENT_CAPABILITY_CATALOG.md` | **Stub-redirect** → assorbito nel Ledger §7 (ri-verificato live) | storico/compat |
| **`DEVELOPMENT_LINES_{A..G}_*.md`** | Portafoglio linee di sviluppo evidence-based (S1016, da atlas+full-sweep): A esporre dati dormienti · B attivare codice dormiente · C admin editing UI · D Wave-2 legacy · E verticali evo · F intelligence prescrittiva · G piattaforma/igiene. Ogni linea con webapp impattate/nuove, effort, sequenza | quando si seleziona la roadmap: la scelta (quali/quando) = Enzo → Action register |

## Come si legge la SoT prodotto

1. **Stato funzionale corrente** → `FUNCTIONAL_CAPABILITY_LEDGER.md` (cosa è ✅/🟡/🔵/⚪/🆕/❌, con evidenza).
2. **Perché/dove andare** → ADR-0054 (posizionamento) + `VISIONE_INTEGRATA_HEURESYS_20261103.md` (visione) + `COMPETITIVE_SCORECARD.md` (mercato).
3. **Cosa costruire dopo** → §10 del Ledger ("Candidati di sviluppo") → alimenta il piano `writing-plans`.

## Regola anti-duplicazione (T2 — vincolante)

I **conteggi** (moduli / endpoint / migration / tabelle / RBAC mapping) vivono **solo** in `docs/kb/SOT_STATE.md` (ri-derivata ogni sessione). PRD e Ledger li **referenziano o ri-derivano live con timestamp**, mai li hardcodano come valori autoritativi — i numeri drift-ano se duplicati. I count nel Ledger sono *evidenza datata della verifica live*, non SoT dei conteggi.

## Provenienza

Origine: programma di Product Discovery 5-fasi (2026-06-17) + verifica live totale dell'inventario (2026-06-19). Design del consolidamento: `docs/superpowers/specs/2026-06-19-product-sot-consolidation-design.md`.
