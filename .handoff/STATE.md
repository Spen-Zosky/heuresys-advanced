# heuresys-advanced — STATE

**Updated**: 2026-06-03 (S958). Baseline **v1.0.0 GA** + S958 backlog sweep & capabilities program. main HEAD `b892462`, synced, **11 commit S958 tutti CI-verdi**. **56 migration** (`000001..000057`), db:validate 7/7. Full API suite **582 pass / 6 skip**.

## Last session brief (S958)

Mandato "tutto il backlog escluso SuccessFactors" + remote-control. Shipped (11 commit):
- **Doc-drift v1.0.0** allineato (SOT/README/CLAUDE/DEBT) · **WS-3 blocker** risolto: reclassify `activity_classification_mappings` card → REFERENCE_ONLY (mig 000056, ADR-0025 §5.4).
- **Cluster KPI reconciled** (supervised VM run, backup): `sys_kpi_definitions` 0→**243** (catalogo 4 livelli: process/job/org_unit/employee, seed `db/seeds/reconciliation/01-02`) + `sys_kpi_targets` 0→**248** (seed 03). Triage misurato: resto data-reconciliation = NEEDS-DECISION (`docs/kb/DATA_RECONCILIATION_PLAN.md`).
- **Programma capability** approvato (5: BI/AI/data-mining/CMS/scraping, `docs/superpowers/specs/2026-06-03-platform-capabilities-roadmap.md`). **① BI Fase 1 API shipped**: modulo `analytics` (`/v1/analytics/{workforce,kpi}`, mig 000057, 6/6 test). **② AI** design+spec pronti.

## Top priorities (next session)

1. **① BI Fase 1b — frontend** (~M): pagine `/analytics/{workforce,kpi}` + chart `@heuresys/ui` + hook TanStack + E2E Playwright. API già verde; piano base `docs/superpowers/plans/2026-06-03-bi-analytics-phase1.md` (estendere a P1b). +consigliato test analytics tenant-scoped.
2. **② AI semantic-matching** (~L): piano + impl. Spec `docs/superpowers/specs/2026-06-03-ai-semantic-matching-design.md`. **Blocca su decisione Voyage API key** (o self-host pgvector).
3. **Sequenza capability**: poi P2/P3 BI, ③ data-mining, ④ CMS, ⑤ scraping (fonti ufficiali). Tutte design→spec→ok→piano→impl.

## Open questions

- **Voyage API key** per gli embeddings AI, o self-host (sentence-transformers su VM)? → sblocca ② AI.
- Data-reconciliation oltre KPI: i milestone org_unit-template-vs-instance + bridge job→position richiedono tua decisione di modellazione (plan §7).

## Stack snapshot

- API **61 moduli** (+`analytics`), **~281 endpoint**; **56 migration** (000057 `analytics:view`); DB: kpi_definitions **243** + kpi_targets **248** (+ 161 users / 162 pos / 2 tenant / 24 team).
- VM PROD invariata (api tsup :8013 + web next start :3013). pgvector **NON** installato (serve per ② AI).

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT count(*) FROM sys.sys_kpi_definitions;"  # 243
cd apps/api && pnpm exec vitest run test/analytics.integration.test.ts  # 6 pass
```
