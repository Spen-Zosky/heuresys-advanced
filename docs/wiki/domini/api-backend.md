---
dominio: api-backend
natura: riferimento
stato: vivo
aggiornato_il: 2026-11-25
sintesi: Moduli Fastify in sette passi, catena di plugin fissa, ESS in modulo dedicato
fonti: [.claude/rules/api-module-pattern.md, apps/api/src/app.ts, apps/api/src/modules]
concetti: [modulo-api, ess, contratto-zod]
---

# API e backend

## Com'è oggi

- L'API è Fastify su PostgreSQL; ogni modulo in `apps/api/src/modules/<nome>/` segue il pattern in sette passi con un commit atomico ([api-module-pattern](../../../.claude/rules/api-module-pattern.md)).
- La catena dei plugin in `apps/api/src/app.ts` è fissa e non si riordina.
- L'ESS (`/me/*`, `/v1/me/*`) vive in un modulo dedicato (ADR-0011).
- I contratti delle risposte sono Zod in `packages/shared`, condivisi con la SPA.
- Quanti moduli ed endpoint ci sono si legge in [SOT_STATE](../../kb/SOT_STATE.md) o si conta: `ls apps/api/src/modules | wc -l`.

## Decisioni in vigore

<!-- generato:decisioni -->
| ADR | Decisione | Status nel file |
|---|---|---|
| [0002](../../architecture/adr/0002_backend_framework_fastify.md) | Backend Framework: Fastify 4 | Accepted |
| [0003](../../architecture/adr/0003_db_access_drizzle_plus_raw_sql.md) | DB Access: Drizzle ORM + Raw SQL Migrations | Superseded in part |
| [0011](../../architecture/adr/0011_ess_scope_inclusion.md) | Employee Self-Service Portal Inclusion & `self`-Scope Enforcement | Accepted |
| [0031](../../architecture/adr/0031_ess_self_view_computed_intelligence.md) | Self-view ESS dell'intelligence calcolata (capability + flight-risk) | Accepted |
<!-- /generato -->

## Come si fa

| cosa | comando |
|---|---|
| un file di test | `cd apps/api && pnpm exec vitest run test/<name>.integration.test.ts` |
| test di integrazione sul gemello | `pnpm test:api:vm` |
| typecheck dei test | `cd apps/api && pnpm typecheck:test` |

## Storia

<!-- generato:storia -->
Il riordino del 2026-11-25 ha ritirato **5** documenti di questo dominio (lotti: B 5). Si recuperano con `git show <commit>:<percorso>` dai commit a1872a180, (il cestino del riordino è stato svuotato il 2026-11-26, voce R14); l'elenco completo è nel [registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv).

Da dove venivano: `docs/superpowers/plans` 3, `docs/superpowers/specs` 2.
<!-- /generato -->

## Vedi anche

[sicurezza-accessi](sicurezza-accessi.md), [qualita-verifica](qualita-verifica.md).
