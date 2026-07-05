# Development Lines — Serie F: intelligence prescrittiva (il layer sopra MLCE, ora sbloccato)

> **Stato**: PROPOSTO — selezione = Enzo. **Provenienza**: atlas + sweep S1016. Regola T2.
> **Il fatto nuovo**: il Ledger (2026-06-19) dichiarava VRIO/OHI/Essential-Ranker «bloccati da MLCE assente» — ma **MLCE e Maturity engine esistono dal Gap#1 (S999)**: `capability-composition` (317 score live) + `capability-maturity` (L0-L5, 20 OU) + Porte UI `/org-director` e `/process-owner`. Il collo di bottiglia dichiarato NON esiste più: il layer prescrittivo è costruibile ADESSO.
> Coerenza PRD: è la roadmap NEXT §2.7 (scorecard prescrittive = funnel board-ready C-suite); principio non negoziabile: spiegabilità prima dell'accuratezza (euristiche deterministiche, niente black-box — il wedge AI-Act).

## Le linee

### F1 — Essential Capability Ranker (la più pronta)
- **Input GIÀ live**: capability score MLCE (317) · `position_kpi.rank/weight` (mig 000137) · `sys_position_economic_weight` 24 · `sys_kpi_weighting_rules` 3 · PIP view.
- **Costruire**: scoring multi-componente delle capability essenziali (valore economico × criticità × scarsità skill × maturità) con formula dichiarata e drill-down sugli input (spiegabilità).
- **Webapp**: `/org-director` (sezione "Capability essenziali" — la Porta-2 esiste già) · drill su `/positions/[positionId]`.
- **Effort**: ~1,5-2. **Valore**: budget L&D data-driven; risposta alla domanda CFO "dove investo".

### F2 — VRIO Scorecard
- **Input**: capability entity MLCE (esiste) · economic_weight (Value) · rarità/imitabilità = giudizi strutturati da raccogliere (form) + segnali derivati (scarsità skill sul mercato ESCO, concentrazione interna).
- **Costruire**: scheda VRIO per capability (Value/Rarity/Imitability/Organization) con evidenze collegate; export print-PDF (pattern `/investors` riusabile).
- **Webapp**: **NUOVA** `/org-director/vrio` (o tab nella Porta-2) — board-ready CSO/CFO.
- **Effort**: ~2-2,5. **Nota**: parte dei giudizi è input umano → include un mini-flusso di assessment (riusa il pattern assessments).

### F3 — OHI / Organizational Health Scorecard
- **Input**: engagement (che si arricchisce con D2), attendance, turnover/flight-risk (159 score), goals, maturity per OU.
- **Costruire**: indice di salute per OU (formula composita dichiarata, no ML) con trend; NON richiede event-sourcing (quello serve a DPI/RMA, che restano Later).
- **Webapp**: `/org-director` (pannello Health per OU) · `/organization` (badge health sull'albero) · **eventuale NUOVA** `/org-health` se il pannello cresce.
- **Effort**: ~2-2,5. **Dipendenza consigliata**: D2 (engagement storico) per non calcolare su gamba muta.

### F4 — AI Advisor prescrittivo (fase 1)
- **Input**: agent-gateway GIÀ live su abbonamento MAX (memoria: stabile, non gated) · MCP tool `hrx_tenant_materialize` come precedente · le scorecard F1-F3 come contesto.
- **Costruire**: suggerimenti contestuali nelle pagine scorecard ("questa capability è sotto maturità L2 e ha 3 posizioni scoperte → azioni candidate"), con trace auditabile (ogni suggerimento cita gli score sorgente — coerente con explainability).
- **Webapp**: pannelli advisor dentro `/org-director`, `/process-owner`, `/insights` · console `/dev/agent` esiste già (feature-flagged) come banco di prova.
- **Effort**: ~2-3 (fase 1 read-only suggestions). **Valore**: trasforma le scorecard da passive a prescrittive — il claim "intelligence" del brand.

### F5 — Self-service intelligence ESS (decisione prodotto)
- **Fatto**: flight-risk e capability score ESCLUDONO deliberatamente il self-view (D-6; `capability-composition/routes.ts:8`).
- **Proposta**: riaprire in forma "coach" (il MIO percorso capability, il MIO sviluppo — framing costruttivo, non "rischio fuga") — decisione di prodotto esplicita per Enzo, qui solo censita.
- **Webapp**: `/me/analytics` (estensione) · `/me/career`.
- **Effort**: ~1 (se deciso).

## Webapp impattate (riepilogo serie)

| Pagina | Linee | Nuova? |
|---|---|---|
| /org-director (Porta-2) | F1, F2, F3, F4 | no (si arricchisce molto) |
| **/org-director/vrio** (o tab) | F2 | **SÌ** (tab/pagina) |
| /process-owner, /insights | F4 | no |
| /organization | F3 | no |
| /positions/[positionId] | F1 | no |
| /me/analytics, /me/career | F5 | no (se deciso) |

## Sequenza raccomandata

F1 (input tutti live) → F3 (dopo/insieme a D2) → F2 → F4 (corona il layer) → F5 (decisione). Totale ~8-11 sessioni se tutto. Ogni scorecard è demo-able da sola — valore GTM incrementale a ogni step.
