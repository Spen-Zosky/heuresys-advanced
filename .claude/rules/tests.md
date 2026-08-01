---
paths:
  - "apps/api/test/**"
  - "apps/web/tests/**"
  - "**/*.test.ts"
  - "**/*.spec.ts"
---

# Test — Vitest, isolamento transazionale, Playwright

## Vitest (apps/api)

`apps/api/vitest.config.ts` gira in **singleThread** per evitare race condition sulla rotazione dei refresh token, e condivide un solo pool DB su tutta la suite. L'helper `apps/api/test/helpers/build-test-app.ts` avvia un'istanza Fastify isolata per test, carica la cache RBAC una volta, e inietta un `InMemoryMailer` così le asserzioni sull'auth possono ispezionare la posta in uscita senza I/O.

**I test colpiscono il DB live sulla VM OCI: il tunnel SSH dev'essere su.** Non esiste oggi una separazione unit/integration — tutti i test in `apps/api/test/*.test.ts` sono di livello integrazione.

## Isolamento transazionale (D-52, S1015)

Ogni **file** di test gira dentro **una** transazione reale, rollbackata a fine file (`test/helpers/setup.ts` → `test/helpers/tx-isolation.ts`): zero residuo sul DB condiviso, nessun accoppiamento fra file. Le vecchie pulizie `afterAll` con DELETE sono ora ridondanti ma innocue.

Le statement di **scrittura** dirette via `pool.query` (INSERT/UPDATE/DELETE/MERGE, CTE di scrittura incluse) girano in savepoint serializzati per statement, così i test che provocano errori DB di proposito mantengono la semantica autocommit; le letture passano dritte; il `withTransaction` dell'app mappa BEGIN/COMMIT/ROLLBACK su savepoint.

**Delta da conoscere**: `now()` è congelato per file (transaction_timestamp); le fixture create in `beforeAll` vengono rollbackate anche loro; una SELECT che fallisse di proposito abortirebbe la transazione del file (oggi non ne esistono — se ne comparisse una, estendi il write-detector).

Via di fuga: `TEST_TX_ISOLATION=0` torna all'autocommit legacy.

## Comandi

```bash
cd apps/api && pnpm exec vitest run test/<name>.integration.test.ts   # singolo file
cd apps/api && pnpm exec vitest run -t "<pattern>"                    # singolo test per nome
cd apps/api && pnpm typecheck:test                                    # usa tsconfig.test.json
```

## Playwright (apps/web)

**`pnpm test:e2e:prod` è l'unico modo supportato per il run completo** (D-24). La config dev (`test:e2e`) serve solo all'iterazione per-spec: le sessioni auth durano 15 minuti.

⚠️ **Su host con Node ≥23** (es. Windows con Node 24) Playwright 1.61 crasha all'import (D-36). Usa `pnpm test:e2e:prod:node22` / `test:e2e:node22`: il wrapper esegue Playwright sotto un Node 22 portable ed è passthrough su Node ≤22, quindi CI, Mac e VM non sono toccati.

Gli E2E fanno **login reale** (persona seminata o `admin@heuresys.com` con la password dalla env `TEST_ADMIN_PASSWORD`), navigano e asseriscono su dati seminati; le mutazioni si verificano con un re-fetch.
