# ADR‑0002 — Backend Framework: Fastify 4

- **Status:** Accepted (overridable in user review)
- **Date:** 2026‑05‑16
- **Deciders:** Development Team (subject to user confirmation)

## Context

`BACKEND_API_STACK_SPEC.md` permits either **Express** or **Fastify**. We need:

1. First‑class TypeScript ergonomics.
2. Built‑in async error handling and validation hooks.
3. Plugin ecosystem covering JWT, cookies, helmet, rate limiting, OpenAPI.
4. Performance headroom for tenant‑aware filtering on every query.
5. Zod integration without writing custom adapters.

## Decision

Use **Fastify 4** (latest stable in the 4.x line, Node 20 compatible).

Core plugins:

- `@fastify/jwt` — JWT decode + sign for access tokens.
- `@fastify/cookie` — refresh token cookie + CSRF cookie.
- `@fastify/helmet` — security headers.
- `@fastify/cors` — same‑site CORS for `apps/web`.
- `fastify-type-provider-zod` — Zod schemas for request validation (no duplicate types).
- `@fastify/rate-limit` — login/refresh endpoints throttling.
- `pino` (default Fastify logger) — structured JSON logs.

Module structure per `API_IMPLEMENTATION_PLAN.md`: each module has `{routes.ts, service.ts, repository.ts, schema.ts}`.

## Alternatives Considered

| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| **Express 5** | Familiar, vast middleware ecosystem | Slower; weaker TS support; manual async error wiring; Zod integration requires extra glue | Friction with shared Zod schemas; performance overhead on every tenant‑aware query |
| **Hono** | Modern, lightweight, multi‑runtime | Smaller plugin ecosystem; newer | Risk for an admin platform that may need niche plugins later |
| **NestJS** | Opinionated, batteries included | Heavy DI, decorators, slower startup, more boilerplate | Over‑engineering for an admin API with 22 modules |

## Consequences

**Positive:**

- Schema‑first request validation via Zod with zero duplication.
- Built‑in async error path; cleaner code than Express middleware chains.
- Production‑grade JSON logging via pino is the default, no extra config.
- Better performance under load (relevant when every endpoint filters by `tenant_id`).

**Negative:**

- Smaller mindshare than Express; developers new to Fastify need a short ramp.
- Plugin order matters (`register` ordering) — we document it explicitly in `API_IMPLEMENTATION_PLAN.md`.

**Neutral:**

- Migration path to Express remains feasible at MVP‑1 if the user reverses this decision: only `server.ts` + middleware layer change; modules use Fastify‑agnostic services and repositories.

## References

- Consumed by: `API_IMPLEMENTATION_PLAN.md`, `AUTH_SECURITY_PLAN.md`.
- See also: ADR‑0006 (auth strategy).
