---
dominio: architettura
natura: riferimento
stato: vivo
aggiornato_il: 2026-11-25
sintesi: Monorepo pnpm, API Fastify su PostgreSQL 16, SPA Next.js, separazione dal datastore
fonti: [CLAUDE.md, package.json, apps/api/package.json, apps/web/package.json, packages/shared]
concetti: [monorepo, contratto-zod, datastore]
---

# Architettura

## Com'è oggi

- Monorepo pnpm (ADR-0001): `apps/api` (Fastify, ADR-0002), `apps/web` (Next.js App Router, ADR-0007), `apps/agent-gateway`, `packages/shared` con i contratti Zod condivisi fra API e SPA.
- Le versioni si leggono dai `package.json` e non dai titoli degli ADR di maggio: `grep -E '"(fastify|next)"' apps/*/package.json`.
- PostgreSQL 16 nativo, niente Docker nel runtime (ADR-0004, I13); il database di produzione è sulla VM Oracle (ADR-0010).
- La piattaforma tiene i cataloghi e genera i modelli nel datastore; advanced tiene il tenant (ADR-0043). Il datastore è il repo `heuresys-datastore`.
- In produzione la VM gira da una copia rilasciata (`~/heuresys-servizio/advanced-produzione`), non dalla cartella del repo.
- I componenti UI riutilizzabili vivono in `@heuresys/ui` (repo `ux-design-shared`), non qui.

## Decisioni in vigore

<!-- generato:decisioni -->
| ADR | Decisione | Status nel file |
|---|---|---|
| [0001](../../architecture/adr/0001_monorepo_tool_pnpm.md) | Monorepo Manager: pnpm Workspaces | Accepted |
| [0002](../../architecture/adr/0002_backend_framework_fastify.md) | Backend Framework: Fastify 4 | Accepted |
| [0004](../../architecture/adr/0004_no_docker_native_postgresql.md) | Runtime: Native PostgreSQL Only, No Docker | Accepted |
| [0007](../../architecture/adr/0007_frontend_next15_app_router.md) | Frontend: Next.js 15 App Router + React 19 + Tailwind 4 + shadcn/ui | Accepted |
| [0010](../../architecture/adr/0010_postgresql_runtime_location.md) | PostgreSQL Runtime Location: OCI VM `oracle-vm-default` (Option B) | Accepted |
| [0013](../../architecture/adr/0013_showcase_sot_policy.md) | Showcase SoT Policy: 4-Level Source-of-Truth Layering | Accepted |
| [0034](../../architecture/adr/0034_migration_chain_is_schema_over_a_data_baseline.md) | La catena di migrazioni è uno strato di schema e controlli sopra una base di dati, non un ricostruttore | Accepted |
| [0043](../../architecture/adr/0043_separazione_dal_datastore.md) | La separazione dal datastore: la piattaforma tiene i cataloghi e genera i modelli, advanced tiene il tenant | ACCETTATO il 2026-10-12 da Enzo Spenuso |
<!-- /generato -->

## Come si fa

| cosa | comando |
|---|---|
| typecheck | `pnpm -r typecheck` |
| atlante del codice | `python docs/kb/tools/build_atlas.py` |
| cruscotto completo | `pnpm status` |

## Storia

<!-- generato:storia -->
Il riordino del 2026-11-25 ha ritirato **24** documenti di questo dominio (lotti: B 24). Si recuperano con `git show <commit>:<percorso>` dai commit a1872a180, oppure dalla copia nel cestino della cartella del progetto; l'elenco completo è nel [registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv).

Da dove venivano: `docs/kb/improvement/DOSSIERS` 15, `docs/source_bundle/extracted_bootstrap/bootstrap_agent` 3, `docs/source_bundle/extracted_bootstrap/universal_hrms_framework` 3, `docs/source_bundle/extracted_bootstrap/bootstrap_agent/checklists` 1, `docs/source_bundle/extracted_bootstrap/bootstrap_agent/specs` 1, `docs/source_bundle/extracted_bootstrap/bootstrap_agent/templates` 1.
<!-- /generato -->

## Vedi anche

[dati-db](dati-db.md), [api-backend](api-backend.md), [frontend-ux](frontend-ux.md), [operazioni-infra](operazioni-infra.md).
