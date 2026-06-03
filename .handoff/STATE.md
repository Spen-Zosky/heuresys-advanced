# heuresys-advanced — STATE

**Updated**: 2026-06-03 (S960). Baseline **v1.0.0 GA**. S960 = **ciclo reconciliation-closure COMPLETO** (B-50, incl. F4). main synced, **57 migration** (`000058`), API suite ~607 pass / 6 skip, CI verde.

## Last session brief (S960)

🏁 **Ciclo reconciliation-closure (B-50) COMPLETO** — spec + F0 + F1 + F2 + F3 + F3b + F4:
- **F0** triage (workflow): 65 vuote → A5/B16/C23/D21. **F1** (mig `000058`): registry `sys.sys_reconciliation_registry` + vista **`sys.v_reconciliation_status`** (stato terminale live).
- **Import: ~30 tabelle, ~9000 righe** (seed `db/seeds/reconciliation/05-35`, staging-COPY-pipe, employee-centric, idempotenti). F2 5 bucket-A + F3 6 muri-bridgeable + **F4 19 bucket-C** (re-misurati: i "derived" erano 22/23 con source reale — F0 li aveva mis-classificati senza misurarli).
- **Pattern**: bridge employee-centric (`legacy_employee_id`/`LEGACY_EMP::`) funzionano; `job_templates` ESCO + `learning_modules` event-derived + parent-vuoti = dead-end. Dossier: `qa_artifacts/F0_*`, `F3_*`, `F3b_*`.
- **Stato finale: 103/138 POPULATED, 0 UNCLASSIFIED**. I 35 residui = 18 NO_SOURCE (app-generated/scaffold) + 10 NEEDS_DECISION (dead-end misurati: job_kpis, talent_pools, pool/gate cascade, learning-module gap, ecc.) + 5 REFERENCE_ONLY + 1 EXCLUDE + 1 IMPORT. **Ogni tabella a stato terminale esplicito.**

## Top priorities (next session)

1. **① BI Fase 1b frontend** (~M): pagine `/analytics/*` + chart `@heuresys/ui` + E2E. API verde. I dati reconciliation (scores/gap/succession/kpi) ora sono live → alimentano le analytics.
2. **② AI semantic-matching** (~L): blocca su decisione Voyage API key / self-host pgvector.
3. Sequenza capability: ③ data-mining, ④ CMS, ⑤ scraping (design→spec→ok→piano→impl).

## Open questions

- **Voyage API key** per embeddings ② AI, o self-host (sentence-transformers su VM)?
- I 35 residui reconciliation sono terminali by-design (no-source/dead-end misurati); riaprirli richiederebbe nuove sorgenti legacy o schema change — non backlog attivo.

## Stack snapshot

- API 61 moduli / ~281 endpoint; **57 migration**. Vista `sys.v_reconciliation_status` = stato reconciliation. **103/138 sys POPULATED**. ~31 seed in `db/seeds/reconciliation/`.
- VM PROD invariata (api :8013 + web :3013). pgvector **NON** installato (serve per ② AI).

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT resolved_status,count(*) FROM sys.v_reconciliation_status GROUP BY 1"  # POPULATED 103
cd apps/api && pnpm exec vitest run test/reconciliation-f4-bucketc.integration.test.ts  # 3 pass
```
