# heuresys-advanced — STATE

**Updated**: 2026-06-03 (S960). Baseline **v1.0.0 GA**. S960 = **ciclo reconciliation-closure CONCLUSO** (B-50). main synced, **57 migration** (`000001..000058`), API suite ~612 pass / 6 skip, CI verde.

## Last session brief (S960)

🏁 **Ciclo reconciliation-closure (B-50) CONCLUSO** — spec + F0 + F1 + F2 + F3 + F3b + chiusura:
- **F0** triage (workflow 22-agenti): 65 tabelle `sys.*` vuote classificate A5/B16/C23/D21. **F1** (mig `000058`): registry `sys.sys_reconciliation_registry` + vista **`sys.v_reconciliation_status`** (stato terminale live, 0 UNCLASSIFIED).
- **Import**: **11 tabelle, ~4947 righe** (seed `db/seeds/reconciliation/05-16`, staging-COPY-pipe, employee-centric, idempotenti). F2 5 bucket-A (1074) + F3 2 bridgeable (1831) + 4 PARTIAL subset (2042: career_path_steps 35, critical_positions 8, position_succession_relevance 9, user_learning_assignments 1990).
- **Pattern chiave**: bridge employee-centric (`legacy_employee_id`) funzionano; bridge su `job_templates` ESCO + `learning_modules` event-derived sono **dead-end** (disgiunti dai dati). 9 dead-end annotati (seed `16`). Dossier: `qa_artifacts/F0_reconciliation_triage.md`, `F3_bridge_discovery.md`, `F3b_walls_discovery.md`.
- **Stato finale**: **84/138 POPULATED**; il resto = **23 bucket-C derivazione** (l'unico vero residuo) + dead-end + no-source/exclude. Ogni tabella a stato terminale esplicito.

## Top priorities (next session)

1. **① BI Fase 1b frontend** (~M): pagine `/analytics/*` + chart `@heuresys/ui` + E2E. API verde.
2. **② AI semantic-matching** (~L): blocca su decisione Voyage API key / self-host pgvector.
3. **(opz.) Reconciliation F4** — popolare i **23 bucket-C** (succession/talent/readiness scores, gap-closure, comp-engine, kpi-measurement, behavioral): richiedono **tue regole di derivazione** (analytics derivate, non import). Solo se vuoi i dati derivati live.

## Open questions

- **Voyage API key** per embeddings ② AI, o self-host (sentence-transformers su VM)?
- **Bucket-C derivazione** (23 tabelle): vuoi popolarle con regole di derivazione autorate (milestone semantica), o restano vuote come analytics-on-demand?

## Stack snapshot

- API 61 moduli / ~281 endpoint; **57 migration** (`000058` reconciliation registry). Vista `sys.v_reconciliation_status` = strumento di stato. **84/138 sys POPULATED**.
- VM PROD invariata (api :8013 + web :3013). pgvector **NON** installato (serve per ② AI).

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT resolved_status,count(*) FROM sys.v_reconciliation_status GROUP BY 1"
cd apps/api && pnpm exec vitest run test/reconciliation-f3-imports.integration.test.ts
```
