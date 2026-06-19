# Product Domain — Source of Truth

Questa cartella è la **SoT del dominio prodotto** di heuresys-advanced (adottata S997). È disgiunta da `docs/kb/` (SoT tecnica) e `docs/due-diligence/` (SoT investor): i domini si **referenziano**, non si duplicano.

## Mappa dei documenti

| Documento | Ruolo | Quando leggerlo |
|---|---|---|
| **`FUNCTIONAL_CAPABILITY_LEDGER.md`** | **Il cuore.** Guida-alla-verifica: ogni funzionalità (implementata / latente / scoperta) con stato verificato live + evidenza `file:line` + count | per sapere *cosa esiste davvero* e *cosa è implementabile* — input del piano di sviluppo |
| `BUSINESS_SCOPE_AND_PRD.md` | Doc strategico: natura, ICP, posizionamento, moat, personas, gap G1-G6, roadmap, metriche, rischi, domande al founder | per la visione/strategia di prodotto |
| `COMPETITIVE_SCORECARD.md` | Benchmark vs 27-vendor (web live), adjudicazione dei differenziatori | per il posizionamento competitivo |
| `WORKITEM_GAP1_PERSPECTIVES_AND_SCORECARD.md` | Piano esecutivo del Gap #1 (2 Porte UI + MLCE + Maturity) | primo work-item derivato — esempio del metodo |
| `WORKITEM_GAP1_PHASE0_VERIFICATION.md` | Verifica live dei building-block del Gap #1 | esempio gold-standard del metodo di verifica |
| `LATENT_CAPABILITY_CATALOG.md` | **Stub-redirect** → assorbito nel Ledger §7 (ri-verificato live) | storico/compat |

## Come si legge la SoT prodotto

1. **Stato funzionale corrente** → `FUNCTIONAL_CAPABILITY_LEDGER.md` (cosa è ✅/🟡/🔵/⚪/🆕/❌, con evidenza).
2. **Perché/dove andare** → `BUSINESS_SCOPE_AND_PRD.md` (strategia) + `COMPETITIVE_SCORECARD.md` (mercato).
3. **Cosa costruire dopo** → §10 del Ledger ("Candidati di sviluppo") → alimenta il piano `writing-plans`.

## Regola anti-duplicazione (T2 — vincolante)

I **conteggi** (moduli / endpoint / migration / tabelle / RBAC mapping) vivono **solo** in `docs/kb/SOT_STATE.md` (ri-derivata ogni sessione). PRD e Ledger li **referenziano o ri-derivano live con timestamp**, mai li hardcodano come valori autoritativi — i numeri drift-ano se duplicati. I count nel Ledger sono *evidenza datata della verifica live*, non SoT dei conteggi.

## Provenienza

Origine: programma di Product Discovery 5-fasi (2026-06-17) + verifica live totale dell'inventario (2026-06-19). Design del consolidamento: `docs/superpowers/specs/2026-06-19-product-sot-consolidation-design.md`.
