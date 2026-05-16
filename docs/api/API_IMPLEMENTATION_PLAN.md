# API Implementation Plan
## Heuresys Advanced — Fastify Backend (22 modules)

> **Status:** Planning deliverable #10 of 10.
> **Sources:** `BACKEND_API_STACK_SPEC.md`, `OPENAPI_BOOTSTRAP_SPEC.yaml`, `AUTH_STACK_SPEC.md`, `LEARNING_CATALOG_AND_GAP_CLOSURE_SPEC.md`, `GRAPH_VISUALIZATION_MODEL_SPEC.md`, ADR‑0002, ADR‑0003.
> **Scope:** the Fastify API server (`apps/api/`) for MVP‑1 + MVP‑2b. **23 functional modules** (22 main + `me` for ESS). Every endpoint tenant‑aware; ESS endpoints additionally `self`‑scope hard‑enforced. PostgreSQL native via Drizzle ORM. No Docker on canonical path; runtime per ADR‑0010.

---

## 1. Stack & Dependencies

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20 LTS (>= 20.11) | Runtime |
| TypeScript | 5.x | Project‑wide |
| Fastify | 4.x | HTTP framework (ADR‑0002) |
| `@fastify/jwt` | latest | JWT decode/sign |
| `@fastify/cookie` | latest | Cookie parsing/setting |
| `@fastify/helmet` | latest | Security headers |
| `@fastify/cors` | latest | Same‑site CORS |
| `@fastify/rate-limit` | latest | Login/refresh throttling |
| `fastify-type-provider-zod` | latest | Zod request/response validation |
| `pino` | 9.x (built into Fastify) | Structured JSON logging |
| `drizzle-orm` | latest | Type‑safe queries (ADR‑0003) |
| `drizzle-kit` | latest | Introspection (`drizzle-kit pull`) only — migrations stay raw SQL |
| `pg` | 8.x | PostgreSQL driver |
| `argon2` | 0.31+ | Password hashing (ADR‑0005) |
| `zod` | 3.x | Validation (shared with frontend via `packages/shared`) |
| `vitest` | latest | Unit tests |
| `supertest` | latest | Integration tests |
| `playwright` | latest | E2E smoke (shared with frontend) |

---

## 2. Directory Structure (`apps/api/`)

```
apps/api/
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts                       # entry point: builds Fastify instance + listens
│   ├── app.ts                          # creates Fastify app, registers plugins (testable)
│   ├── config/
│   │   ├── env.ts                      # Zod-validated env vars
│   │   └── constants.ts                # cookie names, header names, role codes
│   ├── db/
│   │   ├── client.ts                   # Drizzle + pg Pool init
│   │   └── schema/                     # Drizzle introspected schemas (pulled from raw SQL)
│   ├── middleware/
│   │   ├── requestId.ts                # request id, correlation
│   │   ├── auth.ts                     # JWT verify + req.user
│   │   ├── tenantContext.ts            # req.tenantId injection (post-auth)
│   │   ├── rbac.ts                     # requirePermission helper
│   │   ├── csrf.ts                     # double-submit cookie verification
│   │   └── errorHandler.ts             # error envelope serializer
│   ├── errors/
│   │   └── index.ts                    # typed error classes
│   ├── plugins/                        # custom Fastify plugins
│   └── modules/
│       ├── auth/                       # see §4
│       ├── tenants/
│       ├── users/
│       ├── user-profiles/
│       ├── user-position-assignments/
│       ├── enterprise-typing/
│       ├── blueprints/
│       ├── bpm-processes/
│       ├── organization-units/
│       ├── positions/
│       ├── job-roles/
│       ├── skills/
│       ├── kpis/
│       ├── learning/
│       ├── training-initiatives/
│       ├── assessments/
│       ├── gap-analysis/
│       ├── career-succession/
│       ├── compensation-intelligence/
│       ├── visualizations/
│       ├── seed-acquisition/
│       ├── brownfield-adaptation/
│       └── me/                            # Employee Self-Service Portal (MVP-2b)
│           ├── routes.ts                  # /v1/me/* — userId hard-coded from req.user
│           ├── service.ts
│           ├── repository.ts              # ESLint rule no-untenanted-or-cross-user-self-route
│           └── schema.ts
└── tests/
    ├── unit/
    ├── integration/                    # per-module supertest
    └── fixtures/
```

Each module has:

```
modules/<name>/
├── routes.ts          # Fastify route registration
├── service.ts         # business logic
├── repository.ts      # SQL via Drizzle, tenantId-first signature
├── schema.ts          # Zod request/response schemas (import from packages/shared)
└── __tests__/
    ├── service.test.ts
    └── routes.test.ts
```

---

## 3. Server Bootstrap

### 3.1 `src/server.ts`

```ts
import { buildApp } from "./app";
import { env } from "./config/env";

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ host: env.HOST, port: env.PORT });
    app.log.info({ port: env.PORT }, "API listening");
  } catch (err) {
    app.log.fatal({ err }, "API failed to start");
    process.exit(1);
  }
}

start();
```

### 3.2 `src/app.ts` — plugin registration order

The order is critical because each plugin may depend on previous ones.

```ts
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { authPlugin } from "./middleware/auth";
import { tenantContextPlugin } from "./middleware/tenantContext";
import { csrfPlugin } from "./middleware/csrf";
import { requestIdPlugin } from "./middleware/requestId";

import { authRoutes } from "./modules/auth/routes";
import { tenantsRoutes } from "./modules/tenants/routes";
// ... import all 22 module routes

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          "req.headers.cookie",
          "req.headers.authorization",
          "req.body.password",
          "req.body.newPassword",
          "req.body.confirmPassword",
          "res.body.token",
          "res.body.refreshToken",
          "*.password",
          "*.hash",
          "*.secret",
        ],
        censor: "[REDACTED]",
      },
    },
    trustProxy: env.TRUST_PROXY,
    bodyLimit: 1024 * 1024,   // 1 MB default
  }).withTypeProvider<ZodTypeProvider>();

  // 1. Type provider compilers (must be first so subsequent routes can use Zod schemas)
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // 2. Request id + correlation
  await app.register(requestIdPlugin);

  // 3. Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", env.ADMIN_ORIGIN],
      },
    },
  });

  // 4. CORS for the admin SPA
  await app.register(cors, {
    origin: env.ADMIN_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  // 5. Cookies
  await app.register(cookie, {
    secret: env.COOKIE_SECRET,
    parseOptions: {},
  });

  // 6. JWT
  await app.register(jwt, {
    secret: { private: env.JWT_PRIVATE_KEY, public: env.JWT_PUBLIC_KEY },
    sign: { algorithm: "RS256", iss: "heuresys-advanced", aud: "heuresys-advanced-api", expiresIn: "15m" },
    verify: { allowedIss: "heuresys-advanced", allowedAud: "heuresys-advanced-api" },
    cookie: { cookieName: "hrx_access", signed: false },
  });

  // 7. Rate limit (defaults; per-route overrides set on /auth/*)
  await app.register(rateLimit, {
    max: 600,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.user?.userId ?? req.ip,
  });

  // 8. Auth plugin (decorates req.user from JWT cookie if present)
  await app.register(authPlugin);

  // 9. CSRF plugin (decorates with verifyCsrf helper)
  await app.register(csrfPlugin);

  // 10. Tenant context plugin
  await app.register(tenantContextPlugin);

  // 11. Error handler (single envelope for all errors)
  app.setErrorHandler(errorHandler);

  // 12. Health checks (no auth)
  app.get("/healthz", async () => ({ status: "ok" }));
  app.get("/readyz", async () => {
    // Could test DB connection here
    return { status: "ready" };
  });

  // 13. Module routes (all under /v1/ prefix; auth route is special)
  await app.register(authRoutes, { prefix: "/v1/auth" });
  await app.register(tenantsRoutes, { prefix: "/v1/tenants" });
  // ... register all 22 modules

  return app;
}
```

### 3.3 `src/config/env.ts`

```ts
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  TRUST_PROXY: z.coerce.boolean().default(false),

  // Database
  POSTGRES_HOST: z.string(),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_DB: z.string(),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_SCHEMA: z.string().default("sys"),
  POSTGRES_SSL: z.enum(["disable", "require"]).default("disable"),

  // Auth
  JWT_PRIVATE_KEY: z.string(),
  JWT_PUBLIC_KEY: z.string(),
  COOKIE_SECRET: z.string().min(32),
  ADMIN_ORIGIN: z.string().url().default("http://localhost:3000"),

  // Optional
  MFA_ENCRYPTION_KEY: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
```

---

## 4. Middleware Chain (request lifecycle)

```text
Incoming request
   │
   ▼
[1] requestId      — generate / propagate `x-request-id`; attach to logger ctx
   │
   ▼
[2] helmet         — security response headers
   │
   ▼
[3] cors           — pre-flight + actual cors check
   │
   ▼
[4] cookie         — parse cookies
   │
   ▼
[5] jwt+auth       — if `hrx_access` cookie present: verify, decorate `req.user`
   │
   ▼
[6] tenantContext  — if `req.user`: set `req.tenantId = req.user.tenantId` (or null for PLATFORM_ADMIN cross-tenant ops)
   │
   ▼
[7] rateLimit      — per-IP / per-user limits (per-route overrides apply)
   │
   ▼
[8] csrf           — verify X-CSRF-Token == hrx_csrf cookie on state-changing methods
   │
   ▼
[9] route handler  — Zod input validation → service → repository
   │
   ▼
[10] errorHandler  — typed errors → uniform envelope `{error: {code, message, details}}`
   │
   ▼
[11] logger        — request log entry (method, path, status, duration, tenantId, userId, requestId)
```

### 4.1 RBAC middleware (per‑route)

```ts
// modules/positions/routes.ts
import { requirePermission } from "../../middleware/rbac";

app.post("/", {
  preHandler: [requirePermission("position:create")],
  schema: { body: CreatePositionSchema, response: { 201: PositionSchema } },
}, async (req, reply) => {
  const created = await positionsService.create(req.tenantId, req.body, req.user.userId);
  reply.code(201).send(created);
});
```

`requirePermission` reads `req.user.roles`, looks up the cached role‑permission map (loaded at server startup from `sys.sys_auth_role_permissions`), and rejects with 403 if the permission is missing.

### 4.2 Error handler (single envelope)

```ts
// middleware/errorHandler.ts
import { FastifyError } from "fastify";
import { ZodError } from "zod";
import { ApiError, UnauthorizedError, ForbiddenError, ValidationError, NotFoundError, ConflictError, TenantBoundaryViolation } from "../errors";

export async function errorHandler(err: FastifyError, req, reply) {
  if (err instanceof ZodError) {
    reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: err.errors } });
    return;
  }
  if (err instanceof UnauthorizedError) { reply.code(401).send({ error: { code: err.code, message: err.message } }); return; }
  if (err instanceof ForbiddenError)    { reply.code(403).send({ error: { code: err.code, message: err.message } }); return; }
  if (err instanceof NotFoundError)     { reply.code(404).send({ error: { code: err.code, message: err.message } }); return; }
  if (err instanceof ConflictError)     { reply.code(409).send({ error: { code: err.code, message: err.message } }); return; }
  if (err instanceof ValidationError)   { reply.code(400).send({ error: { code: err.code, message: err.message, details: err.details } }); return; }
  if (err instanceof TenantBoundaryViolation) {
    req.log.error({ userId: req.user?.userId, tenantId: req.tenantId, path: req.url }, "TENANT_BOUNDARY_VIOLATION");
    reply.code(404).send({ error: { code: "NOT_FOUND" } });   // do not reveal the boundary
    return;
  }
  // Unexpected
  req.log.error({ err }, "Unhandled error");
  reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
}
```

Note: `TenantBoundaryViolation` is surfaced as a 404 to prevent enumeration; logged internally as a serious event.

---

## 5. Module Roster (22 modules)

Each module's responsibilities:

| Module | Endpoints (typical) | Domain | Required perm prefix |
|--------|---------------------|--------|----------------------|
| `auth` | `POST /login`, `POST /logout`, `POST /refresh`, `GET /me`, `POST /password-reset/request`, `POST /password-reset/complete` | Auth foundation | — (public + self) |
| `tenants` | `GET`, `POST`, `GET /:id`, `PATCH /:id`, `DELETE /:id` | Tenancy | `tenant:*` |
| `users` | `GET`, `POST`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `POST /:id/roles`, `DELETE /:id/roles/:roleId` | Users | `user:*`, `role:assign` |
| `user-profiles` | `GET /:userId`, `PATCH /:userId`, sub‑resources for education/experience/certifications/documents | Profile/Evidence | `user_profile:*` |
| `user-position-assignments` | `GET /users/:userId/assignments`, `POST /users/:userId/assignments`, `PATCH /assignments/:id`, `DELETE /assignments/:id` | Assignment bridge | `user_position_assignment:*` |
| `enterprise-typing` | `GET /tenants/:id/typing`, `PUT /tenants/:id/typing` | Enterprise typing | `enterprise_typing:*` |
| `blueprints` | `GET`, `GET /:variantId`, `POST /:variantId/activate`, `DELETE /:variantId/activate/:activationId` | Blueprint catalog | `blueprint:*` |
| `bpm-processes` | `GET`, `GET /:code` | BPM processes (read‑mostly) | `bpm_process:*` |
| `organization-units` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id`, `GET /:id/children`, `GET /:id/ancestors` | Org structure | `organization_unit:*` |
| `positions` | `GET`, `POST`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `GET /:id/intelligence-profile`, `GET /:id/skills`, `POST /:id/skills`, `DELETE /:id/skills/:skillId`, …KPIs, learning, etc. | Position spine | `position:*` |
| `job-roles` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id` | Job role catalog | `job_role:*` |
| `skills` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id`, `GET /taxonomy/tree` | Skill taxonomy | `skill:*` |
| `kpis` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id`, `GET /:id/targets`, `POST /:id/targets`, `GET /:id/measurements` | KPI cascade | `kpi:*` |
| `learning` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id`, `GET /paths`, `POST /paths`, `GET /paths/:id/steps` | Learning catalog | `learning:*` |
| `training-initiatives` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id`, `POST /:id/enroll-user` | Training scheduling | `training_initiative:*` |
| `assessments` | `GET`, `POST`, `GET /:id`, `PATCH /:id`, `POST /:id/results` | Manager/360 assessments | `assessment:*` |
| `gap-analysis` | `GET /users/:userId/gaps`, `GET /positions/:positionId/gaps`, `POST /closure-plans`, `PATCH /closure-plans/:id` | Gap analysis + closure | `gap_analysis:*` |
| `career-succession` | `GET /career-paths`, `POST /career-paths`, `GET /succession-pools`, `POST /succession-pools`, …readiness, candidates | Career + succession | `career_succession:*` |
| `compensation-intelligence` | `GET /positions/:id/compensation-profile`, `GET /reward-gates/status?period=…`, `POST /recommendations`, `POST /handoff-records` | Compensation (decision support) | `compensation_intelligence:*` |
| `visualizations` | `GET`, `POST`, `GET /:graphId`, `GET /:graphId/layouts/:layoutId`, `POST /:graphId/layouts`, `PATCH /:graphId/layouts/:layoutId/nodes/:nodeId`, `GET /:graphId/exports?format=…` | Visualization graph | `visualization:*` |
| `seed-acquisition` | `GET /runs`, `POST /runs`, `GET /runs/:id`, `POST /runs/:id/validate`, `POST /runs/:id/approve`, `POST /runs/:id/apply` | Seed pipeline | `seed_acquisition:*` |
| `brownfield-adaptation` | `GET /inventory`, `GET /table-mappings`, `PATCH /table-mappings/:id`, `POST /runs`, `GET /runs`, `POST /runs/:id/approve`, `POST /runs/:id/apply` | Brownfield import | `brownfield_adaptation:*` |
| **`me` (ESS)** | **`GET /me/profile`, `PATCH /me/profile`, `GET /me/positions`, `GET /me/skills`, `POST /me/skills/self-assessments`, `GET /me/learning`, `POST /me/learning/enrollments`, `GET /me/kpis`, `GET /me/gaps`, `GET /me/career`, `POST /me/career/target-positions`, `GET /me/assessments`, `GET /me/certifications`, `POST /me/certifications`, `GET /me/documents`, `POST /me/documents`, `GET /me/inbox`, `PATCH /me/inbox/:id`** | **Employee Self‑Service Portal (MVP‑2b)** — every endpoint hard‑coded to `userId = req.user.userId`; URL never accepts a userId param | **`*:read:self`, `*:update:self`, `*:self_assess`, `*:enroll:self`, `*:request_target:self`, `*:upload:self`, `notification:mark_read:self`** (see `AUTH_SECURITY_PLAN.md` §6.1) |

Total endpoints: ≈ 148 (130 main + 18 ESS).

---

## 6. Per‑Module Endpoint Detail (representative — full per‑module spec lives inside each module's `schema.ts`)

### 6.1 `auth` module

Already detailed in `AUTH_SECURITY_PLAN.md`. Endpoints:

```text
POST   /v1/auth/login                       — public, rate‑limited
POST   /v1/auth/logout                      — CSRF protected
POST   /v1/auth/refresh                     — CSRF protected
GET    /v1/auth/me                          — authenticated
POST   /v1/auth/password-reset/request      — public, rate‑limited
POST   /v1/auth/password-reset/complete     — public, rate‑limited (token-bound)
POST   /v1/auth/admin/revoke-user/:userId   — requires `auth:revoke_user` permission (PLATFORM_ADMIN, or TENANT_ADMIN for own-tenant users — see AUTH_SECURITY_PLAN.md §6 matrix)
```

### 6.2 `tenants` module

```text
GET    /v1/tenants                  — PLATFORM_ADMIN cross-tenant; others see own tenant only
GET    /v1/tenants/:id
POST   /v1/tenants                  — PLATFORM_ADMIN
PATCH  /v1/tenants/:id              — TENANT_ADMIN (own tenant) | PLATFORM_ADMIN
DELETE /v1/tenants/:id              — PLATFORM_ADMIN
```

### 6.3 `positions` module (representative full)

```ts
// modules/positions/routes.ts
import type { FastifyPluginAsync } from "fastify";
import {
  CreatePositionSchema, UpdatePositionSchema, PositionSchema, PositionListSchema,
  PositionIntelligenceProfileSchema, PositionSkillRequirementSchema, AddPositionSkillSchema,
} from "@heuresys/shared/schemas/positions";
import { requirePermission } from "../../middleware/rbac";

export const positionsRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/positions  (list, filterable)
  app.get("/", {
    preHandler: [requirePermission("position:list")],
    schema: { querystring: PositionListQuerySchema, response: { 200: PositionListSchema } },
  }, async (req) => positionsService.list(req.tenantId, req.query));

  // GET /v1/positions/:id
  app.get("/:id", {
    preHandler: [requirePermission("position:read")],
    schema: { params: IdParamSchema, response: { 200: PositionSchema } },
  }, async (req) => positionsService.getById(req.tenantId, req.params.id));

  // POST /v1/positions
  app.post("/", {
    preHandler: [requirePermission("position:create")],
    schema: { body: CreatePositionSchema, response: { 201: PositionSchema } },
  }, async (req, reply) => {
    const created = await positionsService.create(req.tenantId, req.body, req.user.userId);
    reply.code(201).send(created);
  });

  // PATCH /v1/positions/:id
  app.patch("/:id", {
    preHandler: [requirePermission("position:update")],
    schema: { params: IdParamSchema, body: UpdatePositionSchema, response: { 200: PositionSchema } },
  }, async (req) => positionsService.update(req.tenantId, req.params.id, req.body, req.user.userId));

  // DELETE /v1/positions/:id
  app.delete("/:id", {
    preHandler: [requirePermission("position:delete")],
    schema: { params: IdParamSchema, response: { 204: z.void() } },
  }, async (req, reply) => {
    await positionsService.softDelete(req.tenantId, req.params.id);
    reply.code(204).send();
  });

  // GET /v1/positions/:id/intelligence-profile
  app.get("/:id/intelligence-profile", {
    preHandler: [requirePermission("position:read")],
    schema: { params: IdParamSchema, response: { 200: PositionIntelligenceProfileSchema } },
  }, async (req) => positionsService.getIntelligenceProfile(req.tenantId, req.params.id));

  // Sub-resource: required skills
  app.get("/:id/skills", { preHandler: [requirePermission("skill:read")] }, /* ... */);
  app.post("/:id/skills", { preHandler: [requirePermission("position:update")] }, /* ... */);
  app.delete("/:id/skills/:skillId", { preHandler: [requirePermission("position:update")] }, /* ... */);

  // Same pattern for /kpis, /learning, /career-paths, /compensation-profile
};
```

### 6.4 `visualizations` module

```text
GET    /v1/visualizations                                              — list per tenant (graph_type filter)
POST   /v1/visualizations                                              — generate a new graph (graph_type + source_query)
GET    /v1/visualizations/:graphId                                     — graph metadata + default layout
GET    /v1/visualizations/:graphId/layouts                             — list layouts
POST   /v1/visualizations/:graphId/layouts                             — create new layout (engine: DAGRE | ELK | TREE | MANUAL | ...)
GET    /v1/visualizations/:graphId/layouts/:layoutId                   — graph + nodes + edges + per-node coordinates
PATCH  /v1/visualizations/:graphId/layouts/:layoutId/nodes/:nodeId     — update SINGLE node coordinate (per ADR-0009)
GET    /v1/visualizations/:graphId/exports?format=svg|pdf|mermaid|react_flow_json|generic_json
```

Critical: `PATCH /nodes/:nodeId` updates only `sys.sys_visualization_node_layouts` — repository explicitly enforces.

### 6.5 `me` module (Employee Self‑Service Portal — ADR‑0011)

**Hard rule**: every route under `/v1/me/*` derives the target user from `req.user.userId` extracted from the JWT. **No `:userId` URL param** is declared. The combination `requireSelfScope()` preHandler + ESLint rule + repository pattern ensures cross‑user access is structurally impossible.

```text
GET    /v1/me/profile                                — read own profile
PATCH  /v1/me/profile                                — update display_name / locale / timezone / contact prefs
GET    /v1/me/positions                              — current + history assignments
GET    /v1/me/skills                                 — own skills with proficiency + last assessment
POST   /v1/me/skills/self-assessments                — submit self-assessment → sys.sys_user_skill_evidence (source=SELF_ASSESSMENT)
GET    /v1/me/learning                               — own assignments + completion
POST   /v1/me/learning/enrollments                   — self-enroll (non-mandatory only)
GET    /v1/me/kpis                                   — own targets + measurements
GET    /v1/me/gaps                                   — own gap analysis + closure plan
GET    /v1/me/career                                 — career paths + readiness
POST   /v1/me/career/target-positions                — request career target → sys.sys_user_target_positions
GET    /v1/me/assessments                            — own received assessments
GET    /v1/me/certifications                         — own certs
POST   /v1/me/certifications                         — add certification URI metadata (no binary)
GET    /v1/me/documents                              — own document metadata
POST   /v1/me/documents                              — upload document URI metadata (no binary)
GET    /v1/me/inbox                                  — own inbox notifications
PATCH  /v1/me/inbox/:notificationId                  — mark read / dismiss
```

#### 6.5.1 `requireSelfScope()` preHandler

```ts
// apps/api/src/middleware/selfScope.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import { UnauthorizedError } from "../errors";

export async function requireSelfScope(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user?.userId) {
    throw new UnauthorizedError("ESS route requires authenticated user");
  }
  // Defensive: routes under /v1/me/* MUST NOT declare a :userId URL param.
  // If they did (lint failure should have caught this), this guard rejects.
  const params = req.params as Record<string, unknown>;
  if ("userId" in params) {
    req.log.error({ path: req.url, params }, "ESS route declares :userId param — anti-pattern");
    throw new UnauthorizedError("ESS routes cannot accept :userId URL param");
  }
  // The downstream handler always calls repository methods with req.user.userId; never with params.userId.
}
```

#### 6.5.2 Representative endpoint: `POST /v1/me/skills/self-assessments`

```ts
// apps/api/src/modules/me/routes.ts (excerpt)
import type { FastifyPluginAsync } from "fastify";
import {
  SubmitSelfAssessmentSchema,
  UserSkillEvidenceSchema,
} from "@heuresys/shared/schemas/me";
import { requireSelfScope } from "../../middleware/selfScope";
import { meService } from "./service";

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireSelfScope);   // applied to every /v1/me/* route

  app.post("/skills/self-assessments", {
    schema: {
      body: SubmitSelfAssessmentSchema,
      response: { 201: UserSkillEvidenceSchema },
    },
  }, async (req, reply) => {
    const created = await meService.submitSelfAssessment(
      req.tenantId,
      req.user.userId,           // <-- hard-coded, never from URL or body
      req.body,                  // { skill_id, declared_proficiency, comment? }
    );
    await audit.logSelfServiceAction({
      action_user_id: req.user.userId,
      action_tenant_id: req.tenantId,
      action_type: "SKILL_SELF_ASSESS",
      action_resource_type: "SKILL",
      action_resource_id: req.body.skill_id,
      action_payload_summary: { declared_proficiency: req.body.declared_proficiency },
      action_ip: req.ip,
      action_user_agent: req.headers["user-agent"],
    });
    reply.code(201).send(created);
  });

  // ... 17 other /v1/me/* routes follow the same shape
};
```

#### 6.5.3 Repository pattern for `me` module

```ts
// apps/api/src/modules/me/repository.ts (excerpt)
export const meRepository = {
  async getMyProfile(tenantId: string, userId: string) {
    // Both tenantId AND userId are required — userId can never be a URL param
    return db.select().from(userProfiles)
      .where(and(
        eq(userProfiles.user_profile_user_id, userId),
        eq(userProfiles.user_profile_tenant_id, tenantId),
      ))
      .limit(1)
      .then(r => r[0] ?? null);
  },

  async submitSelfAssessment(tenantId: string, userId: string, input: SelfAssessmentInput) {
    const [row] = await db.insert(userSkillEvidence).values({
      user_skill_evidence_tenant_id: tenantId,
      user_skill_evidence_user_id: userId,                  // <-- always from caller's req.user
      user_skill_evidence_skill_id: input.skill_id,
      user_skill_evidence_declared_proficiency: input.declared_proficiency,
      user_skill_evidence_source: "SELF_ASSESSMENT",        // <-- pinned for ESS
      user_skill_evidence_comment: input.comment ?? null,
      created_by: userId,
    }).returning();
    return row;
  },

  // ... other self-scoped repository methods
};
```

#### 6.5.4 ESLint custom rule: `no-untenanted-or-cross-user-self-route`

```js
// eslint-rules/no-untenanted-or-cross-user-self-route.js
// Flags any file under apps/api/src/modules/me/ that:
//  (a) declares a URL param named :userId
//  (b) reads userId from req.params or req.body when constructing a repository call
//  (c) calls a repository method whose first userId-like arg is NOT `req.user.userId`
module.exports = {
  meta: { type: "problem", docs: { description: "Enforce hard self-scope in /v1/me/* routes" } },
  create(context) {
    const filename = context.getFilename();
    if (!filename.includes("/modules/me/")) return {};
    return {
      // 1. Reject any route definition with `:userId` in the path
      CallExpression(node) {
        const callee = node.callee;
        if (callee?.type === "MemberExpression" &&
            ["get","post","patch","delete","put"].includes(callee.property?.name)) {
          const pathArg = node.arguments[0];
          if (pathArg?.type === "Literal" && typeof pathArg.value === "string" &&
              /:userId\b/.test(pathArg.value)) {
            context.report({ node: pathArg, message: ":userId URL param forbidden under /v1/me/*" });
          }
        }
      },
      // 2. Reject MemberExpression `params.userId` or `body.userId` inside me/ handlers
      MemberExpression(node) {
        if (node.property?.name === "userId" &&
            node.object?.type === "MemberExpression" &&
            ["params", "body"].includes(node.object.property?.name)) {
          context.report({ node, message: "Read userId from req.user.userId, not req.params/body in /v1/me/*" });
        }
      },
    };
  },
};
```

#### 6.5.5 ESS audit trail

Every ESS mutation writes to `audit.user_self_service_actions` via `audit.logSelfServiceAction(...)` helper. Reads are not audited (volume too high). The audit row's `action_payload_summary` carries only a curated subset of the input (e.g. `skill_id` + `declared_proficiency`, never free‑text comment in plain).

---

## 7. OpenAPI Gap Remediation

The v5 OpenAPI contract (`OPENAPI_BOOTSTRAP_SPEC.yaml`) is read‑only for several resources. The frontend implies CRUD. We extend the contract during MVP‑1 implementation by adding missing endpoints (no breaking change, just additions):

| Resource | Missing in v5 contract | Added |
|----------|------------------------|-------|
| `positions` | POST/PATCH/DELETE | yes (POST → 201, PATCH → 200, DELETE → 204) |
| `skills` | POST/PATCH/DELETE | yes |
| `kpis` | POST/PATCH/DELETE + sub‑resources (`targets`, `measurements`) | yes |
| `learning` | POST/PATCH/DELETE + `training-initiatives` sub‑module | yes |
| `gaps` | gap closure plan CRUD | yes |
| `career-succession` | career path + succession pool CRUD | yes |
| `compensation-intelligence` | reward gates, handoff records | yes |
| `visualizations` | layouts sub‑resources + per‑node PATCH | yes |
| `seed-acquisition` | runs CRUD + validate/approve/apply | yes |
| `brownfield-adaptation` | inventory, table-mappings, runs CRUD + approve/apply | yes |
| `auth` | `securitySchemes` not explicit in v5 → add `cookieAuth` (cookie `hrx_access`) + `csrfHeader` | yes |

The remediated contract lives at `apps/api/openapi.yaml`. It is generated from the Zod schemas via `zod-to-openapi` during a `pnpm api:openapi` build step. Single source of truth: the Zod schemas.

---

## 8. Error Model — Typed Errors

```ts
// errors/index.ts
export class ApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") { super("UNAUTHORIZED", message); }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden", public code = "FORBIDDEN") { super(code, message); }
}

export class ValidationError extends ApiError {
  constructor(public details: unknown, message = "Validation failed") { super("VALIDATION_ERROR", message); }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) { super("NOT_FOUND", `${resource} not found`); }
}

export class ConflictError extends ApiError {
  constructor(message: string, public code = "CONFLICT") { super(code, message); }
}

export class TenantBoundaryViolation extends ApiError {
  constructor(public attemptedTenant: string, public actualTenant: string) {
    super("TENANT_BOUNDARY_VIOLATION", "Tenant boundary violation");
  }
}

export class RefreshReplayDetected extends ApiError {
  constructor() { super("REFRESH_REPLAY_DETECTED", "Refresh token replay detected"); }
}
```

The error handler (§4.2) maps these to HTTP codes and serializes a uniform envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "details": [...] } }
```

---

## 9. Structured Logging (pino)

Every log entry carries:

```json
{
  "level": "info",
  "time": "2026-05-16T03:30:00.000Z",
  "requestId": "req-01HXXY...",
  "tenantId": "...uuid...",
  "userId": "...uuid...",
  "module": "positions",
  "method": "POST",
  "path": "/v1/positions",
  "statusCode": 201,
  "durationMs": 42,
  "msg": "request completed"
}
```

Per‑request logger derived from the root via `req.log.child({ tenantId, userId, module })`. Pino redaction (§3.2) hides sensitive headers and body fields.

Log level controlled by `LOG_LEVEL` env var (default `info`; `debug` for dev).

---

## 10. Tenant‑Aware Repository Pattern

```ts
// modules/positions/repository.ts
import { eq, and } from "drizzle-orm";
import { db } from "../../db/client";
import { positions } from "../../db/schema/positions";
import { TenantBoundaryViolation, NotFoundError } from "../../errors";

export const positionsRepository = {
  async list(tenantId: string, filters: PositionFilters) {
    return db.select().from(positions)
      .where(and(
        eq(positions.position_tenant_id, tenantId),
        filters.criticality ? eq(positions.position_criticality, filters.criticality) : undefined,
        filters.orgUnit ? eq(positions.position_organization_unit_id, filters.orgUnit) : undefined,
      ));
  },

  async getById(tenantId: string, positionId: string) {
    const rows = await db.select().from(positions)
      .where(and(eq(positions.position_id, positionId), eq(positions.position_tenant_id, tenantId)))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("Position");
    return rows[0];
  },

  async create(tenantId: string, input: CreatePositionInput, createdBy: string) {
    const [row] = await db.insert(positions).values({
      ...input,
      position_tenant_id: tenantId,
      created_by: createdBy,
      updated_by: createdBy,
    }).returning();
    return row;
  },

  async update(tenantId: string, positionId: string, input: UpdatePositionInput, updatedBy: string) {
    // Defensive check — ensures we don't accidentally update a row from another tenant
    const [row] = await db.update(positions)
      .set({ ...input, updated_by: updatedBy, updated_at: new Date() })
      .where(and(eq(positions.position_id, positionId), eq(positions.position_tenant_id, tenantId)))
      .returning();
    if (!row) throw new NotFoundError("Position");
    return row;
  },

  async softDelete(tenantId: string, positionId: string) {
    const [row] = await db.update(positions)
      .set({ position_is_active: false, updated_at: new Date() })
      .where(and(eq(positions.position_id, positionId), eq(positions.position_tenant_id, tenantId)))
      .returning();
    if (!row) throw new NotFoundError("Position");
  },
};
```

**Rules enforced:**

- Every repository method takes `tenantId` as the **first** argument.
- Every SQL query carries an `eq(positions.position_tenant_id, tenantId)` clause.
- ESLint custom rule `no-untenanted-query` flags any direct `db.select().from(<table>)` not followed by a tenant filter (unless the table is global, marked with `@global` comment).
- A `TenantBoundaryViolation` error class signals attempted cross‑tenant access; the error handler maps it to 404 (never reveals the boundary).

---

## 11. Database Client (Drizzle + pg Pool)

```ts
// db/client.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env";

export const pool = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  ssl: env.POSTGRES_SSL === "require" ? { rejectUnauthorized: true } : false,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool);
```

Connection pool sized to 20 (tunable). Idle connections recycled after 30s. On shutdown, `pool.end()` is awaited in a `SIGINT`/`SIGTERM` handler.

---

## 12. Tests Strategy

### 12.1 Unit (vitest)

- Each service has a `service.test.ts` with mocked repository.
- Pure functions (e.g. permission resolver, CSRF helper) tested in isolation.

### 12.2 Integration (supertest)

- Each module has a `routes.test.ts` that:
  1. Builds the Fastify app via `buildApp()`.
  2. Authenticates via `POST /v1/auth/login` with a seed user.
  3. Hits the module's routes with `supertest`.
  4. Asserts on response code, body shape, and side effects (DB rows).
- DB integration tests run against a dedicated test database (`heuresys_advanced_test`) — same setup scripts as dev (PowerShell/Bash).
- Each test suite uses `BEGIN; ... ROLLBACK;` to isolate DB state.

### 12.3 E2E smoke (playwright)

Shared with frontend (`tests/e2e/` at repo root): login → tenant list → position detail → gap dashboard → logout.

### 12.4 Coverage targets

- Service layer: ≥ 85%.
- Repository layer: ≥ 75%.
- Routes (via supertest): every endpoint hit at least once with success + one error path.

---

## 13. OpenAPI Generation

The Zod schemas are the source of truth. `zod-to-openapi` generates `apps/api/openapi.yaml`:

```ts
// scripts/generate-openapi.ts
import { OpenApiGeneratorV3, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { PositionSchema, CreatePositionSchema, /* … */ } from "@heuresys/shared/schemas/positions";

const registry = new OpenAPIRegistry();
registry.register("Position", PositionSchema);
registry.register("CreatePosition", CreatePositionSchema);
// … register all schemas

registry.registerPath({
  method: "get",
  path: "/v1/positions/{id}",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: "OK", content: { "application/json": { schema: PositionSchema } } } },
});
// … register all 130 endpoints

const generator = new OpenApiGeneratorV3(registry.definitions);
const doc = generator.generateDocument({ openapi: "3.0.3", info: { title: "Heuresys Advanced API", version: "0.1.0" } });
fs.writeFileSync("apps/api/openapi.yaml", yaml.dump(doc));
```

Run via `pnpm --filter api openapi:generate`. CI verifies the committed `openapi.yaml` matches what `generate-openapi.ts` would produce (drift guard).

---

## 14. Plugin Order Rationale

Why the specific order in §3.2:

1. Type provider compilers **first** — subsequent route definitions reference Zod schemas; without compilers, schemas would be uninterpreted.
2. `requestId` early — so every log line, error, and downstream plugin can carry the id.
3. `helmet` and `cors` early — response headers must be set before any handler writes a response.
4. `cookie` before `jwt` — JWT plugin reads JWT from cookies.
5. `jwt` before `auth` decoration — `req.user` is built from JWT payload.
6. `rateLimit` before per‑route handlers — but after `auth` so per‑user limits resolve `req.user.userId` correctly.
7. `csrf` after `cookie` — CSRF reads cookies.
8. `tenantContext` after `auth` — depends on `req.user`.
9. Error handler **last** — catches all unhandled errors from above plugins and routes.

---

## 15. Per‑Endpoint Acceptance (Bootstrap MVP‑1)

Minimum acceptance per acceptance test in `ACCEPTANCE_TESTS.md`:

| Test | Endpoint | Acceptance |
|------|----------|------------|
| A16 | API starts | `pnpm --filter api dev` reaches "API listening" log |
| A18 | `/auth/me` works | After login, returns `{userId, email, roles, tenantId}` (no hash, no secrets) |
| A19 | `/tenants` works | After login as PLATFORM_ADMIN, returns array of tenants; non‑PLATFORM_ADMIN returns own tenant only |
| A20 | `/users` works | Returns users scoped by tenant + role permissions |
| A21 | `/positions` works | Returns positions; `/positions/:id/intelligence-profile` returns PIP view payload |
| A22 | `/visualizations` works | Returns graphs; `/visualizations/:id/layouts/:layoutId` returns nodes + edges + coords |

CI gate: all 6 supertest specs above must be green for MVP‑1 sign‑off.

---

## 16. Performance Budget

- Cold start: < 1500 ms.
- P50 simple endpoint (`GET /v1/positions/:id`): < 30 ms.
- P95 list endpoint with filters (`GET /v1/positions?...`): < 150 ms.
- P99 PIP view (`GET /v1/positions/:id/intelligence-profile`): **< 600 ms** as plain `VIEW` (conservative budget: the view does several joins; for positions with many skill/KPI/learning requirements P99 may reach this threshold). **MV fallback rule**: if P99 exceeds 600 ms on the seeded `RTL_BANK_REFERENCE` tenant after MVP‑1, promote `sys.sys_position_intelligence_profiles_v` to `MATERIALIZED VIEW` per ADR‑0008 and add concurrent refresh on relevant write triggers.

---

## 17. Open Items (post‑MVP)

- WebSocket / SSE for real‑time graph updates (visualization editing).
- Background job queue (e.g. for brownfield wave runs, seed acquisition jobs).
- Multi‑region read replicas (DB ADR‑0010 closure).
- API rate limit per‑tenant (currently per‑IP / per‑user only).
- Distributed tracing (OpenTelemetry) — pino is already structured; OTel exporter added later.

---

## 18. Verification Checklist (planning deliverable)

- [x] Stack + dependencies (§1)
- [x] Directory structure (§2)
- [x] Server bootstrap with explicit plugin order (§3, §14)
- [x] Middleware chain documented (§4)
- [x] 22 modules roster with endpoints + required permissions (§5)
- [x] Per‑module endpoint detail for representative modules (§6)
- [x] OpenAPI gap remediation plan (§7)
- [x] Typed error model + envelope (§8)
- [x] Structured logging with redaction (§9)
- [x] Tenant‑aware repository pattern (§10)
- [x] Database client + pool (§11)
- [x] Tests strategy (§12)
- [x] OpenAPI generation from Zod (§13)
- [x] Per‑endpoint acceptance cross‑ref (§15)
- [x] Aligned with ADR‑0002 (Fastify), ADR‑0003 (Drizzle + raw SQL), ADR‑0006 (auth strategy)
