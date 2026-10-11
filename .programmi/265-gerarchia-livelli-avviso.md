# 265 — Principio gerarchia-livelli: avviso con motivazione scritta

> **item**: #265 · **priorità**: P2 · **stima**: ~0,5 sessione (due moduli, risposta con l'elenco degli avvisi)
> **stato**: IN CORSO
> **nasce-da**: decisione di Enzo dell'11 ottobre 2026 (avviso, non blocco; l'ordine dei livelli QD viene dal contratto caricato). Esito del mandato W0-A1: `.programmi/esiti-onda0/W0-A1.md`.

## Fasi

- [x] **F1 — Logica pura e test (`apps/api/src/modules/hierarchy-levels/logic.ts`)** — FATTO 2026-10-11 · 10 test unitari verdi; una mutazione della regola ne fa fallire 2
- [x] **F2 — Rotta di sola lettura `GET /v1/hierarchy-levels/check` e avvisi in `BuildPlanPreview.warnings`** — FATTO 2026-10-11 · 4 test di integrazione verdi sul gemello contro la copia migrata
- [ ] **F3 — Agganciare l'avviso alle risposte di modifica di unità (riporto, responsabile) e assegnazioni (posto)** — da fare, non in questo ciclo; test a esiti opposti
- [ ] **F4 — Cambio di livello contrattuale con avviso** — SOSPESA 2026-10-12, in attesa di decisione di Enzo. Costruita e provata (ramo `f4-livello-contrattuale`, rotta `PATCH /v1/users/:id/contract-level`, 6 prove di integrazione verdi sul gemello, una mutazione ne fa fallire 2) ma tolta da `main`: `sys_user_contracts` è classificata «importato» (X-1, mig. 000429) e la prova DIF-4 di `data-steward.integration.test.ts` vieta ogni rotta di scrittura su una tabella importata. Serve la scelta: riclassificarla «ibrido» (come fece 000448 per `sys_user_position_assignments`; bozza di migrazione in `claude_service_workspace\[Plans]\proposta-000456-riclassifica-user-contracts-ibrido.sql`, provata VERDE con `ci-rehearsal.sh`) oppure tenere il livello solo da importazione. Dettagli in `.programmi/esiti-onda0/W0-D.md`
- [ ] **F5 — Rilascio** — di Enzo, deploy armato
