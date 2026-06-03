# heuresys-advanced — STATE

**Updated**: 2026-06-03 (S959). Baseline **v1.0.0 GA**. S959 = sessione tooling (Apify + graphify), **backlog di progetto invariato**. main synced, 56 migration (`000001..000057`), API suite 582 pass / 6 skip. Le priorità sotto sono quelle ancora aperte da S958.

## Last session brief (S959)

Sessione tooling/esplorazione, nessun cambio a codice/migration/backlog:
- **Apify MCP** installato (user scope, HTTP, `mcp.apify.com`) + smoke-test 2 Actor FREE (rag-web-browser, website-content-crawler). Convenzione: ogni run Apify → `.apify/<YYYY-MM-DD>/` (`.meta.json`+`.content.md`), **gitignored** (commit `4e27f18`).
- **graphify su DB** (prova): export DB→markdown in `graphify-db-input/{schema,data}/` poi 2 grafi distinti. **Schema** 149n/309e/28c; **Dati** 236n/505e/12c — il clustering ricostruisce le divisioni RTL Bank e separa i 2 tenant. Output in `graphify-db-input/<taglio>/graphify-out/graph.html`. Dir esclusa via **`.git/info/exclude`** (NON `.gitignore`: graphify salta i path gitignored). Rigenerabile: `graphify-db-input/_export.sql`.
- Commit pushati: `4e27f18` (apify gitignore), `0a84640` (settings allowlist).

## Top priorities (next session)

1. **① BI Fase 1b — frontend** (~M): pagine `/analytics/{workforce,kpi}` + chart `@heuresys/ui` + hook TanStack + E2E Playwright. API già verde; piano `docs/superpowers/plans/2026-06-03-bi-analytics-phase1.md` (estendere a P1b). +test analytics tenant-scoped.
2. **② AI semantic-matching** (~L): piano + impl. Spec `docs/superpowers/specs/2026-06-03-ai-semantic-matching-design.md`. **Blocca su decisione Voyage API key** (o self-host pgvector).
3. **Sequenza capability**: poi P2/P3 BI, ③ data-mining, ④ CMS, ⑤ scraping. Tutte design→spec→ok→piano→impl.

## Open questions

- **Voyage API key** per gli embeddings AI, o self-host (sentence-transformers su VM)? → sblocca ② AI.
- Data-reconciliation oltre KPI: milestone org_unit-template-vs-instance + bridge job→position richiedono tua decisione di modellazione (`docs/kb/DATA_RECONCILIATION_PLAN.md` §7).

## Stack snapshot

- API **61 moduli** (`analytics`), **~281 endpoint**; **56 migration** (000057 `analytics:view`); DB: kpi_definitions **243** + kpi_targets **248** (+ 161 users / 162 pos / 2 tenant / 24 team).
- VM PROD invariata (api tsup :8013 + web next start :3013). pgvector **NON** installato (serve per ② AI).
- Tooling: **Apify MCP** attivo (`~/.claude.json`, account spen-zosky FREE); **graphify** usabile su export DB (`graphify-db-input/_export.sql`).

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT count(*) FROM sys.sys_kpi_definitions;"  # 243
cd apps/api && pnpm exec vitest run test/analytics.integration.test.ts  # 6 pass
```
