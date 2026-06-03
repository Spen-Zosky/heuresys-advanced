# heuresys-advanced — STATE

**Updated**: 2026-06-03 (S960). Baseline **v1.0.0 GA**. S960 = ciclo **reconciliation-closure** (B-50): spec + F0 triage + F1 registry + F2/F3 import. main synced, **57 migration** (`000001..000058`), API suite **598 pass** / 6 skip, CI verde.

## Last session brief (S960)

Ciclo reconciliation-closure avviato e portato avanti (spec `docs/superpowers/specs/2026-06-03-reconciliation-closure-design.md`):
- **F0** (triage read-only, workflow 22-agenti): 65 tabelle `sys.*` vuote classificate **A5/B16/C23/D21** (report `qa_artifacts/F0_reconciliation_triage.md`).
- **F1** (mig `000058`): `sys.sys_reconciliation_registry` + vista **`sys.v_reconciliation_status`** (stato terminale live per ogni tabella sys, 0 UNCLASSIFIED).
- **F2** (5 bucket-A, **1074 righe**): career_paths 28 · user_career_plans 113 · user_documents 657 · gap_analysis_results 270 (kind=SKILL, decisione semantica) · bonus_pools 6. Seed `db/seeds/reconciliation/05-09`.
- **F3** (muro job→position, dossier `qa_artifacts/F3_bridge_discovery.md`): **pattern = bridge employee-centric funzionano, job-template ESCO dead-end**. Importate **2/3 bridgeable** (seed `10-11`, **1831 righe**): position_career_paths 40 + position_learning_requirements 1791 (1:N). **#3 successor_candidates BLOCCATO** (pool_id NOT NULL → succession_pools vuoto/dead-end).

## Top priorities (next session)

1. **Reconciliation F3 prosecuzione** (~M-L): i **5 PARTIAL** (subset risolvibile: critical_positions 50%, succession_candidates 58%, career_path_steps 47%) + 2 muri non affrontati (org-unit template↔instance, learning-catalog re-import) + **F4 dossier bucket-C** (23 derived → STOP). Stato in `sys.v_reconciliation_status` + `SOT_BACKLOG.md` B-50.
2. **① BI Fase 1b frontend** (~M): pagine `/analytics/*` + chart `@heuresys/ui` + E2E. API verde.
3. **② AI semantic-matching** (~L): blocca su decisione Voyage API key / self-host pgvector.

## Open questions

- I **5 PARTIAL** F3: importare il subset (es. >50%) o lasciare a NEEDS_DECISION? Decisione per-tabella.
- `succession_pools` è dead-end (talent_pools 0/24) → blocca successor_candidates: creare pool sintetici o accettare il blocco?
- **Voyage API key** per embeddings ② AI, o self-host (sentence-transformers su VM)?

## Stack snapshot

- API 61 moduli / ~281 endpoint; **57 migration** (`000058` reconciliation registry+view). 7 tabelle reconciliation popolate; vista `sys.v_reconciliation_status` = strumento di stato. DB: 78 POPULATED / 60 vuote (su 138 sys).
- VM PROD invariata (api :8013 + web :3013). pgvector **NON** installato (serve per ② AI).

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT resolved_status,count(*) FROM sys.v_reconciliation_status GROUP BY 1"
cd apps/api && pnpm exec vitest run test/reconciliation-f3-imports.integration.test.ts  # 4 pass
```
