# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-05 (S968).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Lo **snapshot granulare del sistema** (versioni, DB/API/web/CI counts, architettura, migration) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Entrambe le viste (rapida + granulare) sono governate dalla skill `handoff` — **domini disgiunti, nessun numero duplicato qui**.

## Last session brief (S968 — ultracode)

Chiusura **terminale** di 4 item del menu (B-31, SDBI Phase 2, visualization renderers, F7), ciascuno portato a stato definitivo **zero-residui** (modello reconciliation registry), + rimozione del dead-weight `reactflow`. **B-31** era già risolto da ADR-0021 (solo doc allineata). **SDBI Phase 2 (B-10)** → **chiuso-as-umbrella**: 5/8 macro-aree terminali, 3 reali (Surveys/Mentorship/PredictionsML) scorporate in **B-10b** (deferred modeling stream) — mappa `docs/kb/SDBI_PHASE2_CLOSURE.md`. **Viz renderers (tappa B)** → **chiuso**: subsystem già completo (Mermaid + ECharts force-graph + Cytoscape), 9 `graph_type` a stato terminale, brand-gate sollevato, `reactflow` dead-weight rimosso → **`@heuresys/ui@0.1.4`** — mappa `docs/kb/VISUALIZATION_RENDERERS_CLOSURE.md`. **F7** = vero sviluppo: `/system-health` produzione **wire-to-live** (mock eliminato; dati 100% `/v1/observability` + `/v1/auth/role-permissions`; 4 sezioni senza backend droppate con rationale; showcase mock invariato); typecheck/lint/E2E locali + **CI 5/5 verde**. Tutto pushato (`main` synced; sibling ux-design-shared `047d6b9`).

## Top priorities (next session)

1. **vm-deploy F7 → PROD** — `/system-health` live è su `main` ma PROD (`heuresys.com`) non è ancora ridistribuita: `bash scripts/vm-deploy.sh`. ~15min.
2. **② AI P1 backfill** — gated su `VOYAGE_API_KEY` nel `.env` VM (azione Enzo); poi voyage-3.5 person→occupation + skill→skill. ~3-4h.
3. **B-10b — SDBI deferred modeling stream** — Surveys/Engagement + Mentorship + PredictionsML (schema target mancante), ~22-27h / ~3 sessioni dedicate. Dettaglio `docs/kb/SDBI_PHASE2_CLOSURE.md`.

## Open questions

- vm-deploy per portare F7 (`/system-health` live) in PROD: procedere?
- `VOYAGE_API_KEY` nel `.env` VM → sblocca ② AI P1 (azione Enzo).
- next 16 (B-23): quale driver per uscire da STAND-BY?

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 6                                        # main CI verde
cd apps/web && pnpm typecheck                                # verde
```
