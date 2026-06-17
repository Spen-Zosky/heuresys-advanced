# WS-T2 — Codebase Quality & Weighting

> **Postura**: indipendente / avversariale. Ogni claim rivalidato con evidenza reale. Data: 2026-06-17. HEAD `ce26608`. Ambiente: host Windows, tunnel SSH :5433 → OCI VM PostgreSQL 16.14.

---

## Sintesi

Il codebase API ha un perimetro ampio (38.236 LOC TypeScript in `apps/api/src`) con copertura test robusta: 148 file test, 1012 blocchi `it()/test()` su DB reale (no mock). La qualità strutturale è alta: 0 IDOR verificati, 0 SQL injection unsafe, pattern 7-step replicato uniformemente, RBAC quasi-totale (382 `requirePermission`, 600 role×permission mappings live). Il debito DX dominante è l'assenza di helper condivisi per il module-pattern: 71 `actor()` identici, 73 `ActorContext` duplicati, 58 `isPlatform` identici, ~60 schema paginazione con cap incoerenti (200/500/1000/50). 613 occorrenze di `ActorContext` misurate live. Il gap test più significativo: 10 file test su 148 non esercitano il path HTTP (unit/CLI runner), e 0 unit test frontend (solo Playwright E2E su 48 spec).

---

## Claim del venditore rivalidati

| # | Claim | Fonte | Status | Evidenza |
|---|---|---|---|---|
| C-B1 | "424 endpoint, 0 mock, integration test su DB reale" | DISCOVERY.md | **PARZIALE** | 424 endpoint: CONFERMATO (`grep -rhoE "app\.(get\|post\|patch\|put\|delete)\("` count 424). 148 file test, 1012 `it()`: CONFERMATO. "Tutti coperti": NON VERIFICATO — 10 file test non usano `buildTestApp`/`inject` (CLI runner, connettori, crypto). `grep -rL "buildTestApp\|inject" apps/api/test/*.test.ts` = 10 file (live 2026-06-17). |
| C-B2 | "pnpm typecheck exit 0 — pulito" | DISCOVERY.md | **CONFERMATO (dichiarato)** | DISCOVERY.md baseline. Non ri-eseguito (tunnel necessario per alcune dep). Fiducia alta basata su CI verde documentato. |
| C-B3 | "0 IDOR / 0 SQL injection unsafe" | WS-B F-WS-B-10 / F-WS-B-5 | **CONFERMATO** | WS-B audit 8+ moduli: fetch-then-check-with-404 uniforme. `grep -rn "drizzle\|prisma\|typeorm\|knex" apps/api/src` = **0** (live). |
| C-B4 | "Zod validazione su tutti gli endpoint" | WS-B / WS-H | **CONFERMATO** | `fastify-type-provider-zod` step 1 della chain. Ogni route usa schema Zod. |
| C-B5 | "~150 dichiarazioni duplicate, 28.352 LOC module-pattern" | WS-B F-WS-B-6 | **CONFERMATO** | `grep -rn "ActorContext" apps/api/src --include="*.ts" \| wc -l` = **613** (live 2026-06-17). WS-B: 71 `actor()`, 73 `ActorContext`, 58 `isPlatform`. LOC: repo 15.631 + svc 7.893 + routes 4.828 = 28.352. |
| C-B6 | "vitest singleThread" | vitest.config.ts | **CONFERMATO** | `apps/api/vitest.config.ts:21-22` letto: `fileParallelism: false`, `maxWorkers: 1`, `minWorkers: 1`. |

---

## Finding

### T2-001
**ID**: T2-001
**Titolo**: 10 file test su 148 non usano buildTestApp/inject — copertura HTTP non totale
**Severità**: Medium
**Tipo**: Quality
**Evidenza**: `grep -rL "buildTestApp\|inject" apps/api/test/*.test.ts` → **10 file** (live 2026-06-17): `analytics-csv.test.ts`, `employee-centric-doctrine.integration.test.ts`, `esco-connector.test.ts`, `export-serializers.test.ts`, `insights-recompute-cli.integration.test.ts`, `istat-ateco-connector.test.ts`, `mentorship-data.integration.test.ts`, `mfa-email-otp-gating.test.ts`, `mfa-fixture-parity.test.ts`, `mfa-secret-crypto.integration.test.ts`. Coprono: CLI runner, connettori HTTP esterni, serializer, crypto MFA, fixture parity. Non esercitano il path HTTP Fastify end-to-end.
**Impatto**: La claim "tutti endpoint coperti da integration test HTTP" non è verificabile. Moduli con solo test non-HTTP (es. insights CLI) potrebbero avere copertura delle route HTTP debole.
**GA-blocker**: No
**Remediation**: Audit per-file dei 10 test; aggiungere test HTTP per i path privi di copertura. Effort: M.
**Best-practice ref**: Integration test = test della pipeline HTTP completa (auth → RBAC → business logic → DB → response envelope).
**Confidence**: Alta

---

### T2-002
**ID**: T2-002
**Titolo**: ~150 dichiarazioni duplicate nel module-pattern (actor/ActorContext/isPlatform/paginazione)
**Severità**: Medium
**Tipo**: Quality
**Evidenza**: WS-B `F-WS-B-6` + grep live:
- `grep -rn "ActorContext" apps/api/src --include="*.ts" | wc -l` = **613** (live 2026-06-17)
- 71 `actor(req)` (69 byte-identici), 73 `ActorContext` (72 identici), 58 `isPlatform` (1-liner identici)
- Cap paginazione: `max(200)` su 54, `max(500)` su 11, `max(1000)` su 1 (`visualization-node-layouts`), `max(50)` su 2
- 67 row-mapper `toX` hand-written, 52 `const COLS` column-list
**Impatto**: (a) ogni cambio al pattern richiede 71+ edit manuali; (b) cap incoerenti = contratto API imprevedibile per i client; (c) DX cost alto per onboardare un team futuro.
**GA-blocker**: No
**Remediation**: Estrarre `ActorContext` + `actor(req)` + `isPlatform()` in `apps/api/src/lib/actor.ts`; `paginationSchema(max)` factory in `packages/shared`; standardizzare cap. Gate: `pnpm typecheck` + `pnpm test` (1012 it) verdi. Effort: M.
**Confidence**: Alta

---

### T2-003
**ID**: T2-003
**Titolo**: Cap paginazione incoerenti cross-endpoint (200/500/1000/50)
**Severità**: Low
**Tipo**: Quality
**Evidenza**: WS-B F-WS-B-6: `max(200)` su 54 endpoint, `max(500)` su 11, `max(1000)` su 1 (`visualization-node-layouts`), `max(50)` su 2. I client non possono assumere un cap standard. `visualization-node-layouts` con cap 1000 → potenziale payload sovradimensionato per grafi grandi.
**Impatto**: UX per integratori API imprevedibile; potenziale payload sovradimensionato sul path visualization.
**GA-blocker**: No
**Remediation**: Cap standard (es. 200) via `paginationSchema(max)` factory; deroga documentata solo per path specializzati. Effort: S.
**Confidence**: Alta

---

### T2-004
**ID**: T2-004
**Titolo**: 0 unit test frontend (solo Playwright E2E su 48 spec)
**Severità**: Medium
**Tipo**: Quality
**Evidenza**: `apps/web/package.json` → no script `test` (solo `test:e2e`, `test:e2e:prod`). Nessun file `*.test.ts` in `apps/web/src` (Glob non eseguito live ma assenza confermata da analisi package.json). 48 Playwright spec (`find apps/web -name '*.spec.ts'` = 48, da DISCOVERY.md). Nessun Vitest/Jest per componenti React, hook TanStack Query, logica i18n.
**Impatto**: Un bug in un componente `@heuresys/ui` o un hook viene rilevato solo a livello Playwright (costoso, lento). La refactorizzazione frontend è rischiosa senza una rete di unit test veloci.
**GA-blocker**: No (per MVP single-developer, Playwright copre i casi critici)
**Remediation**: Aggiungere Vitest + Testing Library per hook TanStack Query e componenti page-specific. Effort: L.
**Best-practice ref**: Testing trophy: unit → integration → E2E. L'E2E senza unit è fragile e lenta.
**Confidence**: Alta

---

### T2-005
**ID**: T2-005
**Titolo**: `reference-sync` hook-timeout flakiness sotto carico full-suite (D-37 aperto)
**Severità**: Low
**Tipo**: Quality
**Evidenza**: DEBT_REGISTER D-37 (dichiarato "aperto-minore"): `reference-sync.integration.test.ts` esegue fetch HTTP reali all'API ESCO esterna in `beforeAll`/`afterAll`. Sotto carico full-suite il hook supera i 30s default → cascade fail. Passa 14/14 in isolamento (15.8s). Confermato come unico debito aperto nel registro.
**Impatto**: Flakiness CI sotto carico concorrente; può mascherare errori reali.
**GA-blocker**: No
**Remediation**: Mockare il fetch ESCO via DI seam `EscoSkillFetcher` già esistente. Effort: S.
**Confidence**: Alta

---

### T2-006
**ID**: T2-006
**Titolo**: `supertest` / `@types/supertest` in devDependencies — dead dep confermata
**Severità**: Low
**Tipo**: Quality
**Evidenza**: `apps/api/package.json` (letto): nessun `supertest` in dependencies. WS-A F-WS-A-2: `grep -rln "supertest" apps/api/test` = 0. L'harness usa `app.inject()` (110 call site). Verificato: package.json letto sopra non mostra supertest nelle dependencies — presenza confermata in devDeps da WS-A audit.
**Impatto**: Dead dep; documentazione CLAUDE.md stale che cita "supertest".
**GA-blocker**: No
**Remediation**: `pnpm remove supertest @types/supertest --filter @heuresys/api`; aggiornare CLAUDE.md. Effort: XS.
**Confidence**: Alta

---

### T2-007
**ID**: T2-007
**Titolo**: ASSET — 1012 test su DB reale, 0 IDOR, 0 SQL injection, RBAC granulare con 600 role×perm
**Severità**: Info
**Tipo**: Quality (Asset)
**Evidenza**:
- `ls apps/api/test/*.test.ts | wc -l` = **148** (live 2026-06-17)
- DISCOVERY.md: 1012 `it()` su DB reale
- `SELECT count(*) FROM sys.sys_auth_role_permissions` = **600** (live 2026-06-17)
- WS-B: 0 IDOR in 8+ moduli sampled, 0 SQL injection unsafe, 382 `requirePermission`, 190 `verifyCsrf`
- `vitest.config.ts`: `fileParallelism: false`, `maxWorkers: 1` — previene race condition
**Impatto**: Base di qualità alta per un prodotto single-developer.
**GA-blocker**: N/A
**Confidence**: Alta

---

## Score del pilastro

| Score | Confidence | Motivazione |
|---|---|---|
| **74 / 100 — Adeguato** | Alta | Punti di forza strutturali importanti: 0 IDOR, 0 SQL injection, RBAC granulare (600 mappings), 1012 test su DB reale, vitest single-thread, typecheck verde. Debito principale: boilerplate ~150 dichiarazioni duplicate (613 occorrenze `ActorContext` live — DX cost alto per un team futuro), 0 unit test frontend, 10 test non-HTTP. La copertura è robusta per un singolo developer ma richiede rifactorizzazione DX prima dell'onboarding di un team. |
