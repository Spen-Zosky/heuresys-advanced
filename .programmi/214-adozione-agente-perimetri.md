# 214 — Adozione dell'agente sui perimetri in coda, in ordine di rischio crescente

> **item**: #214
> **stato**: IN CORSO

Seconda metà della dottrina di Enzo del 2026-08-16 — *«l'agente va su qualunque perimetro dove
porta valore aggiunto»*. **La domanda è l'ORDINE, non quale.** Per natura non si chiude in una
sessione: è una coda che si consuma, un perimetro per volta.

```bash
python docs/kb/tools/check_concetti_agente.py     # la coda, ri-derivata · --riservati
python docs/kb/tools/build_agent_operations.py    # rigenera la mappa dopo un'apertura
```

## Decisioni vincolanti

1. **Aprire un perimetro è una decisione di esposizione di dati, e la prende Enzo.** Il criterio
   meccanico **ordina** la coda; non fornisce la motivazione di prodotto. La prima apertura
   (`organization-units`) l'ha decisa Enzo con una ragione scritta e datata: l'organigramma è
   rubrica aziendale (`#193`). La seconda (`positions`) idem, il 2026-08-17.
2. **Il costo di un'apertura è una riga** in `agent-perimetri.json` — fonte unica, letta dal
   generatore **e** dallo strumento — con `decisione` + `data`, e senza le rifiuta: un'apertura
   senza autore non è verificabile.
3. **Un perimetro escluso lo è uno per uno, col motivo**: 12 esclusi come presidio/isolamento.
   «Senza pagina che lo mostri» **non è un divieto**: cambia quando la pagina nasce.

## Fasi

- [x] **F1 Primo perimetro: `organization-units`** — FATTO 2026-08-16 (`#193`) · decisione di Enzo con motivazione di prodotto scritta: l'organigramma è rubrica aziendale
- [x] **F2 Secondo perimetro: `positions`, e il buco del criterio** — FATTO 2026-08-17 · `d26c20fb` · sola lettura, 8 operazioni derivate; prova live `live-perimetro-positions.ts` con login reale e secondo fattore. **Il buco era più largo di come l'avevo descritto**: tre falle della stessa forma — *assenza di misura letta come assenza di rischio* — e la coda «neutra» è passata da **31 a 16**, con 14 dichiarati NON MISURABILI
- [ ] **F3 Il terzo perimetro** — budget ~60k · ⏳ **la decisione è di Enzo**
      I primi della coda per ampiezza di lettura: `analytics` (10 letture · 9 pagine) ·
      `content` (7 · 3) · `tenant-blueprints` (6 · 3) · `visualization-graphs` (5 · 4).
      ⚠ `analytics` è **multiclasse** e dichiara di esporre anche competenze e retribuzioni: è
      il primo per ampiezza, non il primo per rischio.
- [ ] **F4 I 14 NON MISURABILI diventano misurabili** — budget ~50k
      Oggi si presentano come «non so», e prima della correzione si presentavano come «sicuro».
      Finché restano tali, quella parte della coda non è ordinabile.
- [ ] **F5 Le classi di una resource multiclasse smettono di essere prosa** — budget ~40k
      Il valore in `RESOURCE_MULTICLASSE` è **prosa**, non un elenco, e cambiarne la forma tocca
      l'asserzione di boot del gate in `apps/api`. È il lavoro che rende meccanico il giudizio su
      `analytics` e `dashboard`, e va fatto **prima** di aprirli.

## Stato misurato (2026-08-17, dopo l'apertura e la correzione del criterio)

97 moduli · **2 aperti** · **46 in coda** = 16 neutri + 14 NON MISURABILI + 16 riservati ·
12 esclusi come presidio/isolamento · 37 senza pagina che li mostri.

## Cosa la prova live NON misura (dichiarato, non lasciato credere)

`hrx_positions_upsert`/`_delete` **esistono e sono montati** da prima dell'apertura, dietro
approvazione umana (`canUseTool` → HITL), e `write-gate.test.ts` lo misura: con `approve` finto a
`true` la scrittura **passa**. L'apertura di lettura non è ciò che le tiene chiuse.

## Chiuso quando

Non si chiude — **si misura**. Ogni sessione che apre un perimetro lo dichiara qui con data e
ragione.
