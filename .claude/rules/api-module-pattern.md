---
paths:
  - "apps/api/**"
  - "packages/shared/**"
---

# apps/api — struttura e pattern dei moduli

## Layout del workspace

```
apps/api/       Fastify 5 + Zod + Argon2id + RS256 JWT — moduli business + auth (v1.0.0)
apps/web/       Next.js 15 App Router — admin SPA + ESS portal
apps/showcase/  Next.js 15 static export — brand identity, deploy GitHub Pages
packages/shared/  @heuresys/shared — schemi Zod + tipi TS, subpath export per modulo
db/migrations/  SQL numerati e idempotenti · db/seeds/ · db/scripts/ (coppie PS1+SH)
```

Import con `@heuresys/api`, `@heuresys/web`, `@heuresys/shared` e subpath tipo `@heuresys/shared/schemas/users`. Conteggi live in `docs/kb/SOT_STATE.md`.

## Entry point

`src/server.ts` è il binding di rete più la validazione env; `src/app.ts` esporta `buildApp()` così i test (e qualunque uso embedded futuro) possono avviare un'istanza Fastify isolata senza porta. Il pool pg singleton sta in `src/db/client.ts` (`isDatabaseReady()` è la readiness probe usata da `/readyz`). L'union `RoleCode` e le costanti `COOKIES` stanno in `src/config/constants.ts` — importale da lì, non ridefinirle.

## La catena di 13 plugin — non riordinare

`apps/api/src/app.ts` costruisce Fastify con una catena **fissa** (dettaglio: `docs/api/API_IMPLEMENTATION_PLAN.md` §3.2):

```
1. Zod type-provider compilers → 2. requestId → 3. helmet → 4. cors
5. cookie → 6. JWT (RS256) → 7. rate-limit → 8. auth (decode-only, non-enforcing)
9. CSRF (double-submit, opt-in per route) → 10. tenantContext → 11. errorHandler
12. /healthz + /readyz → 13. module routes (/v1/<module>)
```

**L'auth non è enforcing a livello di plugin**: `auth.ts` decodifica il cookie JWT in `req.user` se presente; l'enforcement per rotta si fa con `requirePermission('perm:code')` da `middleware/rbac.ts`. La mappa RBAC (ruolo×permesso su 11 ruoli — conteggi in `SOT_STATE.md`, verifica con `SELECT count(*) FROM sys.sys_auth_role_permissions`) è **caricata una volta all'avvio** da `sys.sys_auth_role_permissions`: `requirePermission` lancia `RBAC_NOT_LOADED` se usata prima che la cache sia popolata.

Il logger redige i segreti tramite la costante esportata `LOG_REDACT_PATHS` in `app.ts` (cookie, Authorization, campi password, refresh token, `*.password`, `*.hash`, `*.secret`). I test verificano che sia attiva.

## Il pattern dei moduli — obbligatorio per ogni nuovo modulo API

Replicato su ogni modulo business esistente. **Non deviare.**

1. **`packages/shared/src/schemas/<module>.ts`** — schemi Zod (Create/Update/Filter/Response). Esporta da `packages/shared/src/index.ts` **e** aggiungi il subpath export in `packages/shared/package.json` → `./schemas/<module>`.
2. **`apps/api/src/modules/<module>/repository.ts`** — **SQL parametrizzato grezzo** contro `sys.sys_<plural>`. Niente query builder Drizzle per select/insert (Drizzle si usa solo come wrapper del pool pg). Sempre `$1, $2`, **mai** interpolazione di stringhe. Per operazioni atomiche multi-statement (rotazione token, insert gerarchici) usa `withTransaction(pool, async (client) => { ... })` come in `modules/auth/repository.ts`, non acquisire un client a mano.
3. **`apps/api/src/modules/<module>/service.ts`** — logica di business più autorizzazione di scope basata su un `ActorContext` costruito da `req.user`. Il modello di visibilità è specifico del modulo (solo-tenant, globale+tenant, solo-platform): guarda i moduli esistenti.
4. **`apps/api/src/modules/<module>/routes.ts`** — `FastifyPluginAsyncZod` con `requirePermission('<resource>:<verb>')` su ogni rotta più `app.verifyCsrf` su POST/PATCH/DELETE. Gli errori lanciati da service/repository usano le classi tipizzate in `src/errors/index.ts` (`UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ValidationError`, `ConflictError`) con un codice `SCREAMING_SNAKE` come secondo argomento — es. `throw new ForbiddenError('Missing permission: skills:write', 'PERMISSION_DENIED')`. L'error handler lo trasforma in un body stabile `{error:{code, message}}` (`details?` per gli errori di validazione); il request id torna nell'header di risposta `x-request-id`, non nel body. Codici esistenti da imitare: `LOGIN_INVALID`, `REFRESH_REPLAY_DETECTED`, `RBAC_NOT_LOADED`, `PERMISSION_DENIED`.
5. **Registra** in `apps/api/src/app.ts` allo step 13: `app.register(<module>Routes, { prefix: '/v1/<module>' })`.
6. **`apps/api/test/<module>.integration.test.ts`** — via l'helper `buildTestApp()` (`app.inject()`, 4-8 test per modulo). I test colpiscono il **DB reale** attraverso il tunnel; non ci sono mock.
7. **`pnpm test` dev'essere verde al 100%.** Poi **commit atomico**: `feat(api): MVP-1 5.1.X — <module> module (N endpoints, M tests)`.
