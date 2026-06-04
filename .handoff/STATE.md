# heuresys-advanced — STATE

**Updated**: 2026-06-04 (S961). Baseline **v1.0.0 GA**. main synced, **64 migration** (`000065`), API suite ~646 pass / 6 skip, CI test-integration **verde**.

## Last session brief (S961 — ultracode, multi-workflow, 14 commit)

🚀 **Tutte le decisioni del dossier `docs/kb/RECONCILIATION_WALLS_AND_AI_DECISION_DOSSIER.md` eseguite:**
- **① BI Fase 1b frontend** ✅ — pagine `/analytics/{workforce,kpi}` (live-data E2E verde) + nav mig `000059`.
- **D5/W3** learning re-home (mig `000061`+seed 37-39): steps 124 · evidence 1434 · skill 635. **D4/W2** org-unit template Option A (mig `000064`+seed 40): 225 templates + KPI-templates 0→100 (dual-mode XOR FK) + **fix wiring response-schema** (`be06e61`).
- **D6** SDBI: infra (mig `000063`: rule-code dict + 4 lineage cols + RUNBOOK + template) **+ Option-B** (mig `000065`: 4 tabelle PerfReviews/Feedback360 + `sys_nine_box_grid` VIEW, 1490 righe RTL).
- **D7-P0** pgvector substrate (mig `000060`): extension installata + 4 embedding tables (vuote) + HNSW + `matching:read/admin`. **F7** showcase (2 fix + re-sync mirror).
- **Reconciliation: POPULATED 103→112, 0 UNCLASSIFIED** (147 tabelle, ogni stato terminale).

## Top priorities (next session)

1. **② AI semantic-matching P1** (~L): backfill Voyage + 1ª match surface (person→ESCO occupation + skill→skill, voyage-3.5, USER-scope). **Gated su `VOYAGE_API_KEY` nel `.env`**. Substrate P0 già live. Piano: dossier §6.
2. **① BI Fase 2/3** (~M): skill-gap/attendance/comp + org-network. API verde, P1b fatto.
3. **6 proposte F7** (render-affecting, decisione Enzo): tokenize colori, extract DashboardShell, split SystemHealthDashboard, ecc. — vedi `docs/kb/D6/D4` design + commit `9020d15`.

## Open questions

- **`VOYAGE_API_KEY`**: mettila nel `.env` per sbloccare ② P1 (l'unico gate residuo). Costo backfill ~$0.05.
- Quali delle 6 proposte F7 applicare?

## Stack snapshot

- **64 migration** (`000065`). **pgvector INSTALLATO** (D7-P0) + 4 `sys_*_embeddings` (vuote, P1 le riempie). Reconciliation **112/147 POPULATED, 0 UNCLASSIFIED** (vista `sys.v_reconciliation_status`). ~40 seed `db/seeds/reconciliation/` + `db/seeds/brownfield/sdbi/perf_feedback/`.
- Nuove tabelle: `sys_organization_unit_templates` (225) · `sys_performance_reviews`+3 SDBI · `sys_nine_box_grid` VIEW · `audit.import_validation_rule_codes`. VM PROD invariata (api :8013 + web :3013).

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT resolved_status,count(*) FROM sys.v_reconciliation_status GROUP BY 1"  # POPULATED 112, 0 UNCLASSIFIED
cd apps/api && pnpm exec vitest run test/sdbi-perf-feedback test/reconciliation-org-unit-kpi-templates  # green
```
