# 265 — Principio gerarchia-livelli: avviso con motivazione scritta

> **item**: #265 · **priorità**: P2 · **stima**: ~0,5 sessione (due moduli, risposta con l'elenco degli avvisi)
> **stato**: IN CORSO
> **nasce-da**: decisione di Enzo dell'11 ottobre 2026 (avviso, non blocco; l'ordine dei livelli QD viene dal contratto caricato). Esito del mandato W0-A1: `.programmi/esiti-onda0/W0-A1.md`.

## Fasi

- [x] **F1 — Logica pura e test (`apps/api/src/modules/hierarchy-levels/logic.ts`)** — FATTO 2026-10-11 · 10 test unitari verdi; una mutazione della regola ne fa fallire 2
- [x] **F2 — Rotta di sola lettura `GET /v1/hierarchy-levels/check` e avvisi in `BuildPlanPreview.warnings`** — FATTO 2026-10-11 · 4 test di integrazione verdi sul gemello contro la copia migrata
- [ ] **F3 — Agganciare l'avviso alle risposte di modifica di unità (riporto, responsabile) e assegnazioni (posto)** — da fare, non in questo ciclo; test a esiti opposti
- [ ] **F4 — Avviso di rinvio al sistema esterno** — RIDEFINITA 2026-10-12 per decisione di Enzo (03:09, ADR-0045). `sys_user_contracts` resta «importato»: i dati contrattuali si variano in Zucchetti/SAP, non in Heuresys. Heuresys deve solo mostrare un avviso che chiede la variazione nel sistema esterno, poi si aggiorna con importazioni periodiche e/o su richiesta (da progettare nel progetto di integrazione Zucchetti/SAP). Il lavoro sospeso sul ramo `f4-livello-contrattuale` (rotta `PATCH /v1/users/:id/contract-level`) non va usato così com'è; niente riclassificazione «ibrido». Dettagli in `.programmi/esiti-onda0/W0-D.md`
- [ ] **F5 — Rilascio** — di Enzo, deploy armato
