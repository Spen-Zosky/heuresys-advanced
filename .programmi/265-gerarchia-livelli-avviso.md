# #265 — Principio gerarchia-livelli: avviso con motivazione scritta (piano, W0-A1)

Origine: decisione di Enzo dell'11 ottobre 2026 (avviso, non blocco; l'ordine dei livelli QD viene dal contratto caricato). Esito del mandato W0-A1: `.programmi/esiti-onda0/W0-A1.md`.

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| 265.1 | logica pura + test (`apps/api/src/modules/hierarchy-levels/logic.ts`) | Claude | 10 test unitari verdi, mutazione che li fa fallire | fatta (2026-10-11) |
| 265.2 | rotta di sola lettura `GET /v1/hierarchy-levels/check` e avvisi in `BuildPlanPreview.warnings` | Claude | 4 test di integrazione verdi sul gemello | fatta (2026-10-11) |
| 265.3 | aggancio dell'avviso alle risposte di modifica di unita' (riporto, responsabile) e assegnazioni (posto) | Claude | risposta con l'elenco degli avvisi; test a esiti opposti | da fare, non in questo ciclo |
| 265.4 | cambio di livello contrattuale: oggi non esiste una rotta che lo scriva | Enzo (scelta di prodotto) | decidere se serve una rotta di scrittura | da proporre |
| 265.5 | rilascio | Enzo | deploy armato | in attesa di Enzo |
