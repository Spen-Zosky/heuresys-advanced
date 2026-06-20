# Goals/OKR Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Espongono come API `/v1/*` + UI le entità Goals e OKR già popolate live nello schema (`sys_goals` 1067 · `sys_okrs` 20 · `sys_okr_key_results` 20), oggi senza alcun modulo — capability dormiente identificata nel Functional Capability Ledger §10 (Tier A).

**Architecture:** Pattern 7-step canonico del repo (shared Zod → repository raw-SQL parametrico → service con scope tenant → routes Fastify con `requirePermission`+CSRF → integration test su DB reale → registrazione `app.ts` → commit atomico), più UI read-only Next.js (TanStack Query + `apiFetch` + `DataTablePanel` da `@heuresys/ui`/components) + E2E Playwright su dati reali. Nessuna nuova tabella: le tabelle esistono (mig `000037`); serve solo l'orchestration layer + RBAC.

**Tech Stack:** Fastify 5 + `fastify-type-provider-zod`, Zod v4, `pg` (raw SQL), PostgreSQL 16 (tunnel `:5433`), Next.js 15 App Router, TanStack Query, Playwright, vitest.

## Global Constraints

- **DoD live-data only** — ogni task chiude su dato reale (comando + output + path + timestamp). Mock = scaffold intermedio, mai chiusura.
- **Module pattern 7-step** — non deviare (vedi `CLAUDE.md` → "The module pattern").
- **Raw parameterized SQL** — sempre `$1,$2`, mai interpolazione. Tabelle `sys.sys_<plural>`.
- **Tenant isolation** = filtro SQL + middleware, **NEVER RLS** (I5). PLATFORM_ADMIN = unfiltered; altri = solo proprio tenant; righe non visibili → 404 (no leak).
- **Categorical fields** = i CHECK già esistono in `000037`; lato TS sono `z.enum` (RD-08, mai ENUM PG).
- **node-pg type quirk** — colonne `numeric` tornano come **string** → `Number(...)` nel mapper; colonne `date` → cast `::text AS col` nel SELECT (verbatim 'YYYY-MM-DD'); `integer` torna number; `timestamptz` → `.toISOString()`.
- **TS strict** — `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters` (prefissa `_`), `exactOptionalPropertyTypes` OFF.
- **RBAC cache** si ricarica a boot server / primo `buildTestApp()`: le permission goal/okr devono essere **applicate al DB reale** (`pnpm db:migrate:sh`) prima che i test passino.
- **Personas di test** (password `Admin#PassW0rd!`): `admin@heuresys.com` (PLATFORM_ADMIN), `federica.marchetti@rtl-bank.org` (TENANT_ADMIN), `tommaso.fiore@rtl-bank.org` (USER).
- **Commit prefix**: `feat(api): goals — ...`, `feat(web): goals — ...`, `feat(db): goals — ...`. Commit locali su `main`, **mai push** senza richiesta esplicita.
- **Run dei test web E2E su Windows Node ≥23**: usare `pnpm --filter @heuresys/web test:e2e:prod:node22` (D-36).

---

## File Structure

| File | Responsabilità |
|---|---|
| `packages/shared/src/schemas/goals.ts` (create) | Zod schemas + tipi Goals |
| `packages/shared/src/schemas/okrs.ts` (create) | Zod schemas + tipi OKR + key-results (read) |
| `packages/shared/src/index.ts` (modify) | re-export dei due schemi |
| `packages/shared/package.json` (modify) | subpath exports `./schemas/goals`, `./schemas/okrs` |
| `apps/api/src/modules/goals/repository.ts` (create) | raw SQL su `sys.sys_goals` |
| `apps/api/src/modules/goals/service.ts` (create) | scope tenant + business logic Goals |
| `apps/api/src/modules/goals/routes.ts` (create) | rotte `/v1/goals/*` |
| `apps/api/src/modules/okrs/repository.ts` (create) | raw SQL su `sys.sys_okrs` + `sys.sys_okr_key_results` |
| `apps/api/src/modules/okrs/service.ts` (create) | scope tenant + business logic OKR |
| `apps/api/src/modules/okrs/routes.ts` (create) | rotte `/v1/okrs/*` |
| `apps/api/src/app.ts` (modify) | import + register dei due moduli (step 13) |
| `db/migrations/000142_goals_okrs_permission_seed.sql` (create) | permission `goal:*` + `okr:*` + role maps |
| `apps/api/test/goals.integration.test.ts` (create) | integration test Goals |
| `apps/api/test/okrs.integration.test.ts` (create) | integration test OKR |
| `apps/web/src/app/(authenticated)/goals/page.tsx` (create) | UI lista Goals (read-only) |
| `apps/web/src/app/(authenticated)/okrs/page.tsx` (create) | UI lista OKR (read-only) |
| `apps/web/tests/e2e/goals.spec.ts` (create) | E2E Playwright Goals+OKR |
| web i18n `hr` namespace (modify) | chiavi `goals.*` e `okrs.*` |

---

## Task 1: Shared schemas — Goals

**Files:**
- Create: `packages/shared/src/schemas/goals.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/package.json`

**Interfaces:**
- Produces: `GoalSchema`, `Goal`, `GoalListQuerySchema`, `GoalListQuery`, `GoalListResponseSchema`, `CreateGoalBodySchema`, `CreateGoalBody`, `UpdateGoalBodySchema`, `UpdateGoalBody`, `GoalIdParamSchema`. Enum: `GoalTypeEnum`, `GoalPriorityEnum`, `GoalStatusEnum`.

- [ ] **Step 1: Create the schema file**

`packages/shared/src/schemas/goals.ts`:
```ts
/**
 * @heuresys/shared — Goals schemas. Backs /v1/goals/* over sys.sys_goals.
 * Visibility: tenant-scoped. Zod v4 API. CHECK enums mirror migration 000037.
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";

const META = z.record(z.string(), z.unknown());

export const GoalTypeEnum = z.enum([
  "OBJECTIVE","INDIVIDUAL","TECHNICAL","SALES","CUSTOMER","PERFORMANCE","PROJECT",
  "FINANCIAL","SECURITY","LEADERSHIP","DEVELOPMENT","EFFICIENCY","COMPLIANCE",
]);
export const GoalPriorityEnum = z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]);
export const GoalStatusEnum = z.enum([
  "NOT_STARTED","IN_PROGRESS","ON_TRACK","AT_RISK","BLOCKED","COMPLETED","CANCELLED",
]);

export const GoalSchema = z.object({
  goalId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  subjectUserId: z.uuid().nullable(),
  ownerUserId: z.uuid().nullable(),
  parentGoalId: z.uuid().nullable(),
  templateId: z.uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  type: GoalTypeEnum,
  category: z.string().nullable(),
  priority: GoalPriorityEnum,
  status: GoalStatusEnum,
  progressPercent: z.number().int().min(0).max(100),
  weight: z.number(),
  startDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  completedAt: z.iso.datetime().nullable(),
  tags: z.array(z.unknown()),
  metadata: META,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Goal = z.infer<typeof GoalSchema>;

export const GoalListQuerySchema = z.object({
  status: GoalStatusEnum.optional(),
  type: GoalTypeEnum.optional(),
  priority: GoalPriorityEnum.optional(),
  ownerUserId: z.uuid().optional(),
  subjectUserId: z.uuid().optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type GoalListQuery = z.infer<typeof GoalListQuerySchema>;

export const GoalListResponseSchema = z.object({
  items: z.array(GoalSchema),
  total: z.number().int().min(0),
});

export const CreateGoalBodySchema = z.object({
  tenantId: z.uuid().optional(),
  subjectUserId: z.uuid().nullable().optional(),
  ownerUserId: z.uuid().nullable().optional(),
  parentGoalId: z.uuid().nullable().optional(),
  templateId: z.uuid().nullable().optional(),
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  type: GoalTypeEnum.optional().default("OBJECTIVE"),
  category: z.string().max(100).nullable().optional(),
  priority: GoalPriorityEnum.optional().default("MEDIUM"),
  status: GoalStatusEnum.optional().default("NOT_STARTED"),
  progressPercent: z.number().int().min(0).max(100).optional().default(0),
  weight: z.number().optional().default(1),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  metadata: META.optional().default({}),
});
export type CreateGoalBody = z.infer<typeof CreateGoalBodySchema>;

export const UpdateGoalBodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  type: GoalTypeEnum.optional(),
  category: z.string().max(100).nullable().optional(),
  priority: GoalPriorityEnum.optional(),
  status: GoalStatusEnum.optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  weight: z.number().optional(),
  ownerUserId: z.uuid().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  completedAt: z.iso.datetime().nullable().optional(),
  metadata: META.optional(),
});
export type UpdateGoalBody = z.infer<typeof UpdateGoalBodySchema>;

export const GoalIdParamSchema = z.object({ id: z.uuid() });
```

- [ ] **Step 2: Re-export from index**

In `packages/shared/src/index.ts` add (following the existing `export * from "./schemas/<x>.js"` style):
```ts
export * from "./schemas/goals.js";
```

- [ ] **Step 3: Add subpath export**

In `packages/shared/package.json`, inside `"exports"`, add (mirror the `./schemas/engagement-feedback` block at lines 306-309):
```json
    "./schemas/goals": {
      "types": "./dist/schemas/goals.d.ts",
      "default": "./src/schemas/goals.ts"
    },
```

- [ ] **Step 4: Typecheck the shared package**

Run: `pnpm --filter @heuresys/shared typecheck`
Expected: PASS (no errors).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/goals.ts packages/shared/src/index.ts packages/shared/package.json
git commit -m "feat(shared): goals — Zod schemas + subpath export"
```

---

## Task 2: Goals repository (raw SQL)

**Files:**
- Create: `apps/api/src/modules/goals/repository.ts`

**Interfaces:**
- Consumes: `Goal`, `GoalListQuery`, `CreateGoalBody`, `UpdateGoalBody` from `@heuresys/shared`.
- Produces: `listGoals(q, tenantId, query) → {items, total}`, `findGoalById(q, id) → Goal|null`, `insertGoal(q, tenantId, body) → Goal`, `updateGoalPartial(q, id, patch) → Goal|null`, `deleteGoal(q, id) → boolean`, type `DbConnector`.

- [ ] **Step 1: Create the repository**

`apps/api/src/modules/goals/repository.ts`:
```ts
/**
 * apps/api/src/modules/goals/repository.ts
 * Raw parameterized SQL for sys.sys_goals. Tenant filter at SQL level.
 * numeric(goal_weight) -> string from pg => Number(); date columns cast ::text.
 * Mirrors modules/engagement-feedback/repository.ts.
 */
import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import type { Goal, GoalListQuery, CreateGoalBody, UpdateGoalBody } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface GoalRow {
  goal_id: string; goal_tenant_id: string; goal_natural_key: string;
  goal_subject_user_id: string | null; goal_owner_user_id: string | null;
  goal_parent_goal_id: string | null; goal_template_id: string | null;
  goal_title: string; goal_description: string | null; goal_type: string;
  goal_category: string | null; goal_priority: string; goal_status: string;
  goal_progress_percent: number; goal_weight: string;
  goal_start_date: string | null; goal_due_date: string | null;
  goal_completed_at: Date | null; goal_tags: unknown[]; goal_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const GOAL_COLS = `goal_id, goal_tenant_id, goal_natural_key, goal_subject_user_id, goal_owner_user_id,
  goal_parent_goal_id, goal_template_id, goal_title, goal_description, goal_type, goal_category,
  goal_priority, goal_status, goal_progress_percent, goal_weight,
  goal_start_date::text AS goal_start_date, goal_due_date::text AS goal_due_date, goal_completed_at,
  goal_tags, goal_metadata, created_at, updated_at`;

function toGoal(r: GoalRow): Goal {
  return {
    goalId: r.goal_id, tenantId: r.goal_tenant_id, naturalKey: r.goal_natural_key,
    subjectUserId: r.goal_subject_user_id, ownerUserId: r.goal_owner_user_id,
    parentGoalId: r.goal_parent_goal_id, templateId: r.goal_template_id,
    title: r.goal_title, description: r.goal_description,
    type: r.goal_type as Goal["type"], category: r.goal_category,
    priority: r.goal_priority as Goal["priority"], status: r.goal_status as Goal["status"],
    progressPercent: r.goal_progress_percent, weight: Number(r.goal_weight),
    startDate: r.goal_start_date, dueDate: r.goal_due_date,
    completedAt: r.goal_completed_at ? r.goal_completed_at.toISOString() : null,
    tags: r.goal_tags ?? [], metadata: r.goal_metadata,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listGoals(
  q: DbConnector, tenantId: string | undefined, query: GoalListQuery,
): Promise<{ items: Goal[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`goal_tenant_id = $${params.length}`); }
  if (query.status) { params.push(query.status); where.push(`goal_status = $${params.length}`); }
  if (query.type) { params.push(query.type); where.push(`goal_type = $${params.length}`); }
  if (query.priority) { params.push(query.priority); where.push(`goal_priority = $${params.length}`); }
  if (query.ownerUserId) { params.push(query.ownerUserId); where.push(`goal_owner_user_id = $${params.length}`); }
  if (query.subjectUserId) { params.push(query.subjectUserId); where.push(`goal_subject_user_id = $${params.length}`); }
  if (query.search) { params.push(`%${query.search}%`); where.push(`goal_title ILIKE $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_goals ${wc}`, params);
  const total = Number(totalRow.rows[0]?.total ?? 0);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<GoalRow>(`SELECT ${GOAL_COLS} FROM sys.sys_goals ${wc} ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`, params);
  return { items: res.rows.map(toGoal), total };
}

export async function findGoalById(q: DbConnector, id: string): Promise<Goal | null> {
  const res = await q.query<GoalRow>(`SELECT ${GOAL_COLS} FROM sys.sys_goals WHERE goal_id = $1`, [id]);
  return res.rows[0] ? toGoal(res.rows[0]) : null;
}

export async function insertGoal(q: DbConnector, tenantId: string, body: CreateGoalBody): Promise<Goal> {
  const res = await q.query<GoalRow>(
    `INSERT INTO sys.sys_goals (goal_tenant_id, goal_natural_key, goal_subject_user_id, goal_owner_user_id,
       goal_parent_goal_id, goal_template_id, goal_title, goal_description, goal_type, goal_category,
       goal_priority, goal_status, goal_progress_percent, goal_weight, goal_start_date, goal_due_date, goal_metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::date,$16::date,$17::jsonb)
     RETURNING ${GOAL_COLS}`,
    [tenantId, `API::${randomUUID()}`, body.subjectUserId ?? null, body.ownerUserId ?? null,
     body.parentGoalId ?? null, body.templateId ?? null, body.title, body.description ?? null,
     body.type ?? "OBJECTIVE", body.category ?? null, body.priority ?? "MEDIUM", body.status ?? "NOT_STARTED",
     body.progressPercent ?? 0, body.weight ?? 1, body.startDate ?? null, body.dueDate ?? null,
     JSON.stringify(body.metadata ?? {})],
  );
  return toGoal(res.rows[0]!);
}

export async function updateGoalPartial(q: DbConnector, id: string, patch: UpdateGoalBody): Promise<Goal | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.title !== undefined) add("goal_title", patch.title);
  if (patch.description !== undefined) add("goal_description", patch.description);
  if (patch.type !== undefined) add("goal_type", patch.type);
  if (patch.category !== undefined) add("goal_category", patch.category);
  if (patch.priority !== undefined) add("goal_priority", patch.priority);
  if (patch.status !== undefined) add("goal_status", patch.status);
  if (patch.progressPercent !== undefined) add("goal_progress_percent", patch.progressPercent);
  if (patch.weight !== undefined) add("goal_weight", patch.weight);
  if (patch.ownerUserId !== undefined) add("goal_owner_user_id", patch.ownerUserId);
  if (patch.startDate !== undefined) { params.push(patch.startDate); sets.push(`goal_start_date = $${params.length}::date`); }
  if (patch.dueDate !== undefined) { params.push(patch.dueDate); sets.push(`goal_due_date = $${params.length}::date`); }
  if (patch.completedAt !== undefined) add("goal_completed_at", patch.completedAt);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`goal_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findGoalById(q, id);
  params.push(id);
  const res = await q.query<GoalRow>(`UPDATE sys.sys_goals SET ${sets.join(", ")} WHERE goal_id = $${params.length} RETURNING ${GOAL_COLS}`, params);
  return res.rows[0] ? toGoal(res.rows[0]) : null;
}

export async function deleteGoal(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_goals WHERE goal_id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @heuresys/api typecheck`
Expected: PASS (the service/routes don't exist yet but this file is self-contained against `@heuresys/shared`).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/goals/repository.ts
git commit -m "feat(api): goals — repository (raw SQL on sys_goals)"
```

---

## Task 3: Goals service + routes + registration

**Files:**
- Create: `apps/api/src/modules/goals/service.ts`
- Create: `apps/api/src/modules/goals/routes.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Consumes: repository functions from Task 2; `actorFromRequest`, `isPlatform`, `ActorContext` from `../../lib/actor.js`; `NotFoundError`, `ForbiddenError` from `../../errors/index.js`.
- Produces: `goalsService` (listGoals/getGoal/createGoal/updateGoal/deleteGoal), `goalsRoutes` plugin. Permission codes used: `goal:read`, `goal:create`, `goal:update`, `goal:delete`.

- [ ] **Step 1: Create the service**

`apps/api/src/modules/goals/service.ts`:
```ts
/**
 * apps/api/src/modules/goals/service.ts
 * Goals CRUD with tenant-only visibility. PLATFORM_ADMIN unfiltered; others own tenant;
 * not-visible -> 404 (no leak). Mirrors modules/engagement-feedback/service.ts.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type { GoalListQuery, CreateGoalBody, UpdateGoalBody } from "@heuresys/shared";
import * as repo from "./repository.js";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

function listTenantFilter(a: ActorContext): string | undefined {
  if (isPlatform(a)) return undefined;
  return a.tenantId ?? ZERO_UUID;
}
function assertVisible(a: ActorContext, rowTenantId: string, resource: string): void {
  if (isPlatform(a)) return;
  if (a.tenantId === null || rowTenantId !== a.tenantId) throw new NotFoundError(resource);
}
function resolveWriteTenant(a: ActorContext, bodyTenantId?: string): string {
  if (isPlatform(a)) {
    const t = bodyTenantId ?? a.tenantId;
    if (!t) throw new ForbiddenError("PLATFORM_ADMIN must supply tenantId", "TENANT_ID_REQUIRED");
    return t;
  }
  if (!a.tenantId) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
  return a.tenantId;
}

export const goalsService = {
  async listGoals(a: ActorContext, query: GoalListQuery) {
    return repo.listGoals(pool, listTenantFilter(a), query);
  },
  async getGoal(a: ActorContext, id: string) {
    const g = await repo.findGoalById(pool, id);
    if (!g) throw new NotFoundError("Goal");
    assertVisible(a, g.tenantId, "Goal");
    return g;
  },
  async createGoal(a: ActorContext, body: CreateGoalBody) {
    const tenantId = resolveWriteTenant(a, body.tenantId);
    return repo.insertGoal(pool, tenantId, body);
  },
  async updateGoal(a: ActorContext, id: string, patch: UpdateGoalBody) {
    const g = await repo.findGoalById(pool, id);
    if (!g) throw new NotFoundError("Goal");
    assertVisible(a, g.tenantId, "Goal");
    const updated = await repo.updateGoalPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("Goal");
    return updated;
  },
  async deleteGoal(a: ActorContext, id: string): Promise<void> {
    const g = await repo.findGoalById(pool, id);
    if (!g) throw new NotFoundError("Goal");
    assertVisible(a, g.tenantId, "Goal");
    await repo.deleteGoal(pool, id);
  },
};
```

- [ ] **Step 2: Create the routes**

`apps/api/src/modules/goals/routes.ts`:
```ts
/**
 * apps/api/src/modules/goals/routes.ts — /v1/goals/*
 * Reads: requirePermission("goal:read"). Writes: app.verifyCsrf + goal:{create,update,delete}.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  GoalSchema, GoalListQuerySchema, GoalListResponseSchema,
  CreateGoalBodySchema, UpdateGoalBodySchema, GoalIdParamSchema,
} from "@heuresys/shared";
import { goalsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const goalsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("goal:read")],
    schema: { querystring: GoalListQuerySchema, response: { 200: GoalListResponseSchema } },
  }, async (req) => goalsService.listGoals(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("goal:read")],
    schema: { params: GoalIdParamSchema, response: { 200: GoalSchema } },
  }, async (req) => goalsService.getGoal(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("goal:create")],
    schema: { body: CreateGoalBodySchema, response: { 201: GoalSchema } },
  }, async (req, reply) => { reply.code(201).send(await goalsService.createGoal(actor(req), req.body)); });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("goal:update")],
    schema: { params: GoalIdParamSchema, body: UpdateGoalBodySchema, response: { 200: GoalSchema } },
  }, async (req) => goalsService.updateGoal(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("goal:delete")],
    schema: { params: GoalIdParamSchema },
  }, async (req, reply) => { await goalsService.deleteGoal(actor(req), req.params.id); reply.code(204).send(); });
};
```

- [ ] **Step 3: Register in app.ts**

In `apps/api/src/app.ts`, add the import alongside the other module imports (near line 104):
```ts
import { goalsRoutes } from "./modules/goals/routes.js";
```
And the registration alongside the other `app.register(... /v1/...)` calls (step 13, near line 409):
```ts
  await app.register(goalsRoutes, { prefix: "/v1/goals" });
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @heuresys/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/goals/service.ts apps/api/src/modules/goals/routes.ts apps/api/src/app.ts
git commit -m "feat(api): goals — service + routes + app registration"
```

---

## Task 4: RBAC migration — goal + okr permissions

**Files:**
- Create: `db/migrations/000142_goals_okrs_permission_seed.sql`

**Interfaces:**
- Produces in DB: permission codes `goal:{read,create,update,delete}` and `okr:{read,create,update,delete}` + role maps. (OKR perms seeded now so Task 10 reuses them without a second migration.)

> NB: the highest existing migration is `000141`; use `000142`. Verify before writing: `ls db/migrations/*.sql | tail -1`.

- [ ] **Step 1: Create the migration**

`db/migrations/000142_goals_okrs_permission_seed.sql`:
```sql
-- ============================================================================
-- 000142_goals_okrs_permission_seed.sql — goal/okr RBAC perms + role maps.
-- Mirrors 000114_engagement_feedback_permission_seed.sql. Idempotent (ON CONFLICT DO NOTHING).
-- read  -> 6 HRMS-read roles (incl. PLATFORM_ADMIN explicitly). write -> admins + HR.
-- Authored: 2026-06-20.
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('goal:read',   'Read goals',   'goal', 'read'),
  ('goal:create', 'Create goals', 'goal', 'create'),
  ('goal:update', 'Update goals', 'goal', 'update'),
  ('goal:delete', 'Delete goals', 'goal', 'delete'),
  ('okr:read',    'Read OKRs',    'okr',  'read'),
  ('okr:create',  'Create OKRs',  'okr',  'create'),
  ('okr:update',  'Update OKRs',  'okr',  'update'),
  ('okr:delete',  'Delete OKRs',  'okr',  'delete')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- read audience (6 non-leaf roles; excludes USER/READ_ONLY)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code IN ('goal:read','okr:read')
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- write audience (admins + HR managers)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code IN ('goal:create','goal:update','goal:delete','okr:create','okr:update','okr:delete')
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','HRMS_MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$ DECLARE v int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_auth_permissions WHERE auth_permission_resource IN ('goal','okr');
  RAISE NOTICE '000142: goal/okr permissions present: % (expect 8)', v;
  IF v <> 8 THEN RAISE EXCEPTION '000142: expected 8 goal/okr permissions, found %', v; END IF;
END $$;
```

- [ ] **Step 2: Apply to the real DB (tunnel up)**

Run: `pnpm db:migrate:sh`
Expected: idempotent run completes; NOTICE `000142: goal/okr permissions present: 8 (expect 8)`.

- [ ] **Step 3: Verify live**

Run: `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tA -c "SELECT count(*) FROM sys.sys_auth_permissions WHERE auth_permission_resource IN ('goal','okr')"`
Expected: `8`

- [ ] **Step 4: Commit**

```bash
git add db/migrations/000142_goals_okrs_permission_seed.sql
git commit -m "feat(db): goals — RBAC permission seed for goal:* + okr:* (mig 000142)"
```

---

## Task 5: Goals integration test

**Files:**
- Create: `apps/api/test/goals.integration.test.ts`

**Interfaces:**
- Consumes: `buildTestApp`, `TestApp` from `./helpers/build-test-app.js`; `loginRaw` from `./helpers/login.js`; live `pool`. Personas + permissions from Task 4. Live data baseline: `sys_goals` has 1067 rows (RTL tenant). Confirm the live tenant total before asserting (the test reads it dynamically to stay drift-proof).

- [ ] **Step 1: Write the failing test**

`apps/api/test/goals.integration.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";

// Goals API (/v1/goals/*). Real login + live DB (SSH tunnel). Reads need goal:read (6 roles);
// writes need goal:{create,update,delete}. Live baseline: sys_goals ~1067 (RTL tenant).

const PWD = "Admin#PassW0rd!";
interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let admin: S; let tenantAdmin: S; let plainUser: S;
let rtlTenantId: string; let rtlGoalTotal: number;
const createdGoalIds: string[] = [];

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");
  const t = await pool.query<{ id: string }>("SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'");
  rtlTenantId = t.rows[0]!.id;
  const c = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM sys.sys_goals WHERE goal_tenant_id = $1", [rtlTenantId]);
  rtlGoalTotal = Number(c.rows[0]!.n);
});

afterAll(async () => {
  for (const id of createdGoalIds) {
    try { await pool.query("DELETE FROM sys.sys_goals WHERE goal_id = $1", [id]); } catch { /* ignore */ }
  }
  await suite.app.close();
});

describe("goals API", () => {
  it("GET / — TENANT_ADMIN lists the RTL goals (live total)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/goals?limit=1", headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(rtlGoalTotal);
  });

  it("GET / — plain USER lacks goal:read -> 403", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/goals", headers: { cookie: ch(plainUser.cookies) } });
    expect(r.statusCode).toBe(403);
  });

  it("GET / — items carry typed shape (status enum, numeric weight)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/goals?limit=5", headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const items = (r.json() as { items: { status: string; weight: number }[] }).items;
    expect(items.length).toBeGreaterThan(0);
    expect(typeof items[0]!.weight).toBe("number");
  });

  it("full CRUD round-trip (create -> get -> patch status -> delete -> 404)", async () => {
    const hdrW = { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken, "content-type": "application/json" };
    const c = await suite.app.inject({ method: "POST", url: "/v1/goals", headers: hdrW,
      payload: { title: "IT_GOAL_Crud", type: "OBJECTIVE", priority: "HIGH", dueDate: "2026-12-31" } });
    expect(c.statusCode).toBe(201);
    const created = c.json() as { goalId: string; priority: string; dueDate: string | null; status: string };
    createdGoalIds.push(created.goalId);
    expect(created.priority).toBe("HIGH");
    expect(created.dueDate).toBe("2026-12-31");
    expect(created.status).toBe("NOT_STARTED");
    const g = await suite.app.inject({ method: "GET", url: `/v1/goals/${created.goalId}`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(g.statusCode).toBe(200);
    const patch = await suite.app.inject({ method: "PATCH", url: `/v1/goals/${created.goalId}`, headers: hdrW, payload: { status: "IN_PROGRESS", progressPercent: 25 } });
    expect(patch.statusCode).toBe(200);
    expect((patch.json() as { status: string; progressPercent: number }).status).toBe("IN_PROGRESS");
    const del = await suite.app.inject({ method: "DELETE", url: `/v1/goals/${created.goalId}`, headers: { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken } });
    expect(del.statusCode).toBe(204);
    const gone = await suite.app.inject({ method: "GET", url: `/v1/goals/${created.goalId}`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(gone.statusCode).toBe(404);
  });

  it("POST / without CSRF -> rejected", async () => {
    const r = await suite.app.inject({ method: "POST", url: "/v1/goals",
      headers: { cookie: ch(tenantAdmin.cookies), "content-type": "application/json" }, payload: { title: "IT_GOAL_NoCsrf" } });
    expect(r.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("USER cannot create (no goal:create) -> 403", async () => {
    const r = await suite.app.inject({ method: "POST", url: "/v1/goals",
      headers: { cookie: ch(plainUser.cookies), "x-csrf-token": plainUser.csrfToken, "content-type": "application/json" },
      payload: { title: "IT_GOAL_Nope" } });
    expect(r.statusCode).toBe(403);
  });
});
```

- [ ] **Step 2: Run to verify it fails (then passes)**

Run: `cd apps/api && pnpm exec vitest run test/goals.integration.test.ts`
Expected: with Tasks 1-4 done, this should PASS. If `goal:read` 403 appears for tenantAdmin, the migration (Task 4) was not applied to the live DB — re-run `pnpm db:migrate:sh`. (The RBAC cache is loaded once per `buildTestApp()` from the live DB.)

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/goals.integration.test.ts
git commit -m "test(api): goals — integration suite (live DB, CRUD + RBAC + scope)"
```

---

## Task 6: Goals web UI (read-only list) + i18n + nav

**Files:**
- Create: `apps/web/src/app/(authenticated)/goals/page.tsx`
- Modify: web i18n `hr` namespace files (add `goals.*` keys)

**Interfaces:**
- Consumes: `apiFetch` from `@/lib/api/fetch`; `DataTablePanel`, `DataColumn` from `@/components/data-table-panel`; `StatusPill` from `@/components/status-pill`. Endpoint `/v1/goals` from Task 3.

- [ ] **Step 1: Create the page**

`apps/web/src/app/(authenticated)/goals/page.tsx`:
```tsx
"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

interface GoalRow {
  goalId: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  progressPercent: number;
  dueDate: string | null;
}
interface GoalList { items: GoalRow[]; total: number }

function toneForStatus(s: string): "info" | "success" | "warning" | "danger" | "neutral" {
  if (s === "COMPLETED" || s === "ON_TRACK") return "success";
  if (s === "AT_RISK") return "warning";
  if (s === "BLOCKED" || s === "CANCELLED") return "danger";
  if (s === "IN_PROGRESS") return "info";
  return "neutral";
}

function buildColumns(t: TFunction): DataColumn<GoalRow>[] {
  return [
    { header: t("shared.name"), cell: (g) => <span className="font-medium text-foreground">{g.title}</span> },
    { header: t("goals.cols.type"), cell: (g) => <span className="text-xs text-muted-foreground">{g.type}</span> },
    { header: t("goals.cols.priority"), cell: (g) => <span className="text-xs text-muted-foreground">{g.priority}</span> },
    { header: t("goals.cols.progress"), cell: (g) => <span className="text-xs text-muted-foreground">{g.progressPercent}%</span> },
    { header: t("goals.cols.due"), cell: (g) => <span className="text-xs text-muted-foreground">{g.dueDate ?? "—"}</span> },
    { header: t("shared.status"), cell: (g) => <StatusPill tone={toneForStatus(g.status)}>{g.status}</StatusPill> },
  ];
}

export default function GoalsPage() {
  const { t } = useTranslation("hr");
  const columns = useMemo(() => buildColumns(t), [t]);
  const goals = useQuery({
    queryKey: ["goals", "list"],
    queryFn: () => apiFetch<GoalList>("/v1/goals?limit=200"),
  });

  return (
    <DataTablePanel<GoalRow>
      pageTestId="goals-page"
      titleTestId="goals-title"
      countTestId="goals-count"
      title={t("goals.title")}
      description={t("goals.description")}
      count={goals.data ? t("goals.count", { count: goals.data.total }) : undefined}
      isLoading={goals.isLoading}
      isError={goals.isError}
      errorMessage={t("goals.errorMessage")}
      rows={goals.data?.items ?? []}
      rowKey={(g) => g.goalId}
      rowTestId="goals-row"
      columns={columns}
      emptyTestId="goals-empty"
      emptyTitle={t("goals.emptyTitle")}
      emptyDescription={t("goals.emptyDescription")}
      caption={t("goals.caption")}
    />
  );
}
```

- [ ] **Step 2: Add i18n keys**

Find the `hr` namespace locale files (the ones containing the `"kpis"` block):
Run: `grep -rl '"kpis"' apps/web/src --include=*.json`
In each (en + it), add a sibling `"goals"` block:
```json
  "goals": {
    "title": "Goals",
    "description": "Objectives and goals across the tenant",
    "count": "{{count}} goals",
    "errorMessage": "Failed to load goals",
    "emptyTitle": "No goals",
    "emptyDescription": "No goals found for this tenant",
    "caption": "Goals",
    "cols": { "type": "Type", "priority": "Priority", "progress": "Progress", "due": "Due date" }
  },
```
(Use Italian copy in the `it` file: "Obiettivi", "Priorità", "Avanzamento", "Scadenza", etc.)

- [ ] **Step 3: Verify i18n parity**

Run: `pnpm --filter @heuresys/web i18n:check`
Expected: PASS (en/it keys in parity).

- [ ] **Step 4: Typecheck + build the web app**

Run: `pnpm --filter @heuresys/web typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(authenticated)/goals/page.tsx" apps/web/src/**/locales/**
git commit -m "feat(web): goals — read-only list page + i18n"
```

> Nav note: if the sidebar is DB-driven (`sys_ui_interfaces` + `GET /v1/me/interfaces`, see `CLAUDE.md` U1/U2), the `/goals` route needs a `sys_ui_interfaces` row to appear in the sidebar. If so, add an idempotent INSERT for the goals interface to migration `000142` (or a sibling) and re-run `db:migrate:sh`. Verify by grepping an existing route's interface seed: `grep -rl "sys_ui_interfaces" db/migrations`. If the sidebar is static, add the link following the existing pattern in `apps/web/src/app/(authenticated)/layout.tsx`.

---

## Task 7: E2E Playwright — Goals (real login, live data)

**Files:**
- Create: `apps/web/tests/e2e/goals.spec.ts`

> Confirm the e2e dir/config: `ls apps/web/tests/e2e/ 2>/dev/null || ls apps/web/e2e/`. Mirror the structure/imports of an existing spec (`grep -l "test.describe" apps/web/**/e2e/*.spec.ts`). The spec below uses the data-testids set by `DataTablePanel` in Task 6.

**Interfaces:**
- Consumes: the `/goals` page (Task 6) + live `/v1/goals` (Task 3). Login persona `federica.marchetti@rtl-bank.org` / `Admin#PassW0rd!`.

- [ ] **Step 1: Write the E2E spec**

`apps/web/tests/e2e/goals.spec.ts` (adapt the login helper import to the existing specs' helper):
```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/login"; // adapt to the actual helper used by sibling specs

test.describe("Goals page", () => {
  test("TENANT_ADMIN sees the goals list populated from live data", async ({ page }) => {
    await loginAs(page, "federica.marchetti@rtl-bank.org", "Admin#PassW0rd!");
    await page.goto("/goals");
    await expect(page.getByTestId("goals-title")).toBeVisible();
    // count badge reflects the live total (non-empty)
    await expect(page.getByTestId("goals-count")).toContainText(/\d+/);
    // at least one row rendered from the real API
    await expect(page.getByTestId("goals-row").first()).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E (prod build, Node 22 wrapper on Windows ≥23)**

Run: `pnpm --filter @heuresys/web test:e2e:prod:node22 -- goals.spec.ts`
Expected: PASS (login real, `/goals` renders rows from live `/v1/goals`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/e2e/goals.spec.ts
git commit -m "test(web): goals — E2E (real login + live data)"
```

---

## Task 8: Shared schemas — OKR (+ key results read)

**Files:**
- Create: `packages/shared/src/schemas/okrs.ts`
- Modify: `packages/shared/src/index.ts`, `packages/shared/package.json`

**Interfaces:**
- Produces: `OkrSchema`, `Okr`, `OkrListQuerySchema`, `OkrListQuery`, `OkrListResponseSchema`, `CreateOkrBodySchema`, `CreateOkrBody`, `UpdateOkrBodySchema`, `UpdateOkrBody`, `OkrIdParamSchema`, `OkrKeyResultSchema`, `OkrKeyResult`, `OkrKeyResultListResponseSchema`. Enums: `OkrTypeEnum`, `OkrPeriodTypeEnum`, `OkrStatusEnum`, `KeyResultMetricTypeEnum`, `KeyResultStatusEnum`.

- [ ] **Step 1: Create the schema file**

`packages/shared/src/schemas/okrs.ts`:
```ts
/**
 * @heuresys/shared — OKR schemas (+ key results read). Backs /v1/okrs/* over
 * sys.sys_okrs + sys.sys_okr_key_results. Tenant-scoped. Zod v4. CHECK enums mirror 000037.
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";

const META = z.record(z.string(), z.unknown());

export const OkrTypeEnum = z.enum(["COMPANY","DEPARTMENT","TEAM","INDIVIDUAL"]);
export const OkrPeriodTypeEnum = z.enum(["QUARTERLY","MONTHLY","YEARLY","CUSTOM"]);
export const OkrStatusEnum = z.enum(["DRAFT","ACTIVE","ACHIEVED","MISSED","CANCELLED","ARCHIVED"]);
export const KeyResultMetricTypeEnum = z.enum(["PERCENTAGE","NUMBER","CURRENCY","BOOLEAN","MILESTONE"]);
export const KeyResultStatusEnum = z.enum(["ON_TRACK","AT_RISK","BEHIND","COMPLETED","ABANDONED"]);

export const OkrSchema = z.object({
  okrId: z.uuid(),
  tenantId: z.uuid(),
  ownerUserId: z.uuid().nullable(),
  createdByUserId: z.uuid().nullable(),
  parentOkrId: z.uuid().nullable(),
  naturalKey: z.string(),
  objective: z.string(),
  description: z.string().nullable(),
  okrType: OkrTypeEnum,
  department: z.string().nullable(),
  periodType: OkrPeriodTypeEnum,
  periodStart: z.string(),
  periodEnd: z.string(),
  fiscalYear: z.number().int().nullable(),
  fiscalQuarter: z.number().int().nullable(),
  status: OkrStatusEnum,
  overallProgress: z.number(),
  confidenceLevel: z.number().nullable(),
  tags: z.array(z.unknown()),
  metadata: META,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Okr = z.infer<typeof OkrSchema>;

export const OkrListQuerySchema = z.object({
  status: OkrStatusEnum.optional(),
  okrType: OkrTypeEnum.optional(),
  ownerUserId: z.uuid().optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type OkrListQuery = z.infer<typeof OkrListQuerySchema>;

export const OkrListResponseSchema = z.object({ items: z.array(OkrSchema), total: z.number().int().min(0) });

export const CreateOkrBodySchema = z.object({
  tenantId: z.uuid().optional(),
  ownerUserId: z.uuid().nullable().optional(),
  parentOkrId: z.uuid().nullable().optional(),
  objective: z.string().min(1),
  description: z.string().nullable().optional(),
  okrType: OkrTypeEnum.optional().default("COMPANY"),
  department: z.string().max(100).nullable().optional(),
  periodType: OkrPeriodTypeEnum.optional().default("QUARTERLY"),
  periodStart: z.string(),
  periodEnd: z.string(),
  fiscalYear: z.number().int().nullable().optional(),
  fiscalQuarter: z.number().int().min(1).max(4).nullable().optional(),
  status: OkrStatusEnum.optional().default("ACTIVE"),
  metadata: META.optional().default({}),
});
export type CreateOkrBody = z.infer<typeof CreateOkrBodySchema>;

export const UpdateOkrBodySchema = z.object({
  objective: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  okrType: OkrTypeEnum.optional(),
  department: z.string().max(100).nullable().optional(),
  periodType: OkrPeriodTypeEnum.optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  status: OkrStatusEnum.optional(),
  overallProgress: z.number().optional(),
  ownerUserId: z.uuid().nullable().optional(),
  metadata: META.optional(),
});
export type UpdateOkrBody = z.infer<typeof UpdateOkrBodySchema>;

export const OkrIdParamSchema = z.object({ id: z.uuid() });

export const OkrKeyResultSchema = z.object({
  keyResultId: z.uuid(),
  tenantId: z.uuid(),
  okrId: z.uuid(),
  ownerUserId: z.uuid().nullable(),
  naturalKey: z.string(),
  description: z.string(),
  metricType: KeyResultMetricTypeEnum,
  startValue: z.number(),
  targetValue: z.number(),
  currentValue: z.number(),
  unit: z.string().nullable(),
  progressPercent: z.number(),
  status: KeyResultStatusEnum,
  weight: z.number(),
  confidenceLevel: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type OkrKeyResult = z.infer<typeof OkrKeyResultSchema>;
export const OkrKeyResultListResponseSchema = z.object({ items: z.array(OkrKeyResultSchema), total: z.number().int().min(0) });
```

- [ ] **Step 2: Re-export + subpath**

`packages/shared/src/index.ts`: add `export * from "./schemas/okrs.js";`
`packages/shared/package.json` exports: add
```json
    "./schemas/okrs": {
      "types": "./dist/schemas/okrs.d.ts",
      "default": "./src/schemas/okrs.ts"
    },
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm --filter @heuresys/shared typecheck` → PASS
```bash
git add packages/shared/src/schemas/okrs.ts packages/shared/src/index.ts packages/shared/package.json
git commit -m "feat(shared): okrs — Zod schemas (+ key results) + subpath export"
```

---

## Task 9: OKR repository

**Files:**
- Create: `apps/api/src/modules/okrs/repository.ts`

**Interfaces:**
- Produces: `listOkrs`, `findOkrById`, `insertOkr`, `updateOkrPartial`, `deleteOkr`, `listKeyResultsByOkr(q, okrId) → {items,total}`, type `DbConnector`.

- [ ] **Step 1: Create the repository**

`apps/api/src/modules/okrs/repository.ts`:
```ts
/**
 * apps/api/src/modules/okrs/repository.ts
 * Raw SQL on sys.sys_okrs + sys.sys_okr_key_results (read). numeric -> Number(); date -> ::text.
 */
import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import type { Okr, OkrListQuery, CreateOkrBody, UpdateOkrBody, OkrKeyResult } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface OkrRow {
  okr_id: string; okr_tenant_id: string; okr_owner_user_id: string | null;
  okr_created_by_user_id: string | null; okr_parent_okr_id: string | null; okr_natural_key: string;
  okr_objective: string; okr_description: string | null; okr_okr_type: string;
  okr_department: string | null; okr_period_type: string;
  okr_period_start: string; okr_period_end: string;
  okr_fiscal_year: number | null; okr_fiscal_quarter: number | null; okr_status: string;
  okr_overall_progress: string; okr_confidence_level: string | null;
  okr_tags: unknown[]; okr_metadata: Record<string, unknown>; created_at: Date; updated_at: Date;
}
const OKR_COLS = `okr_id, okr_tenant_id, okr_owner_user_id, okr_created_by_user_id, okr_parent_okr_id,
  okr_natural_key, okr_objective, okr_description, okr_okr_type, okr_department, okr_period_type,
  okr_period_start::text AS okr_period_start, okr_period_end::text AS okr_period_end,
  okr_fiscal_year, okr_fiscal_quarter, okr_status, okr_overall_progress, okr_confidence_level,
  okr_tags, okr_metadata, created_at, updated_at`;

function toOkr(r: OkrRow): Okr {
  return {
    okrId: r.okr_id, tenantId: r.okr_tenant_id, ownerUserId: r.okr_owner_user_id,
    createdByUserId: r.okr_created_by_user_id, parentOkrId: r.okr_parent_okr_id, naturalKey: r.okr_natural_key,
    objective: r.okr_objective, description: r.okr_description, okrType: r.okr_okr_type as Okr["okrType"],
    department: r.okr_department, periodType: r.okr_period_type as Okr["periodType"],
    periodStart: r.okr_period_start, periodEnd: r.okr_period_end,
    fiscalYear: r.okr_fiscal_year, fiscalQuarter: r.okr_fiscal_quarter, status: r.okr_status as Okr["status"],
    overallProgress: Number(r.okr_overall_progress),
    confidenceLevel: r.okr_confidence_level === null ? null : Number(r.okr_confidence_level),
    tags: r.okr_tags ?? [], metadata: r.okr_metadata,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listOkrs(
  q: DbConnector, tenantId: string | undefined, query: OkrListQuery,
): Promise<{ items: Okr[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`okr_tenant_id = $${params.length}`); }
  if (query.status) { params.push(query.status); where.push(`okr_status = $${params.length}`); }
  if (query.okrType) { params.push(query.okrType); where.push(`okr_okr_type = $${params.length}`); }
  if (query.ownerUserId) { params.push(query.ownerUserId); where.push(`okr_owner_user_id = $${params.length}`); }
  if (query.search) { params.push(`%${query.search}%`); where.push(`okr_objective ILIKE $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_okrs ${wc}`, params);
  const total = Number(totalRow.rows[0]?.total ?? 0);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<OkrRow>(`SELECT ${OKR_COLS} FROM sys.sys_okrs ${wc} ORDER BY okr_period_start DESC LIMIT $${lim} OFFSET $${off}`, params);
  return { items: res.rows.map(toOkr), total };
}

export async function findOkrById(q: DbConnector, id: string): Promise<Okr | null> {
  const res = await q.query<OkrRow>(`SELECT ${OKR_COLS} FROM sys.sys_okrs WHERE okr_id = $1`, [id]);
  return res.rows[0] ? toOkr(res.rows[0]) : null;
}

export async function insertOkr(q: DbConnector, tenantId: string, body: CreateOkrBody): Promise<Okr> {
  const res = await q.query<OkrRow>(
    `INSERT INTO sys.sys_okrs (okr_tenant_id, okr_natural_key, okr_owner_user_id, okr_parent_okr_id,
       okr_objective, okr_description, okr_okr_type, okr_department, okr_period_type, okr_period_start,
       okr_period_end, okr_fiscal_year, okr_fiscal_quarter, okr_status, okr_metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11::date,$12,$13,$14,$15::jsonb)
     RETURNING ${OKR_COLS}`,
    [tenantId, `API::${randomUUID()}`, body.ownerUserId ?? null, body.parentOkrId ?? null,
     body.objective, body.description ?? null, body.okrType ?? "COMPANY", body.department ?? null,
     body.periodType ?? "QUARTERLY", body.periodStart, body.periodEnd, body.fiscalYear ?? null,
     body.fiscalQuarter ?? null, body.status ?? "ACTIVE", JSON.stringify(body.metadata ?? {})],
  );
  return toOkr(res.rows[0]!);
}

export async function updateOkrPartial(q: DbConnector, id: string, patch: UpdateOkrBody): Promise<Okr | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.objective !== undefined) add("okr_objective", patch.objective);
  if (patch.description !== undefined) add("okr_description", patch.description);
  if (patch.okrType !== undefined) add("okr_okr_type", patch.okrType);
  if (patch.department !== undefined) add("okr_department", patch.department);
  if (patch.periodType !== undefined) add("okr_period_type", patch.periodType);
  if (patch.periodStart !== undefined) { params.push(patch.periodStart); sets.push(`okr_period_start = $${params.length}::date`); }
  if (patch.periodEnd !== undefined) { params.push(patch.periodEnd); sets.push(`okr_period_end = $${params.length}::date`); }
  if (patch.status !== undefined) add("okr_status", patch.status);
  if (patch.overallProgress !== undefined) add("okr_overall_progress", patch.overallProgress);
  if (patch.ownerUserId !== undefined) add("okr_owner_user_id", patch.ownerUserId);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`okr_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findOkrById(q, id);
  params.push(id);
  const res = await q.query<OkrRow>(`UPDATE sys.sys_okrs SET ${sets.join(", ")} WHERE okr_id = $${params.length} RETURNING ${OKR_COLS}`, params);
  return res.rows[0] ? toOkr(res.rows[0]) : null;
}

export async function deleteOkr(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_okrs WHERE okr_id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

interface KrRow {
  key_result_id: string; key_result_tenant_id: string; key_result_okr_id: string;
  key_result_owner_user_id: string | null; key_result_natural_key: string; key_result_description: string;
  key_result_metric_type: string; key_result_start_value: string; key_result_target_value: string;
  key_result_current_value: string; key_result_unit: string | null; key_result_progress_percent: string;
  key_result_status: string; key_result_weight: string; key_result_confidence_level: number;
  created_at: Date; updated_at: Date;
}
const KR_COLS = `key_result_id, key_result_tenant_id, key_result_okr_id, key_result_owner_user_id,
  key_result_natural_key, key_result_description, key_result_metric_type, key_result_start_value,
  key_result_target_value, key_result_current_value, key_result_unit, key_result_progress_percent,
  key_result_status, key_result_weight, key_result_confidence_level, created_at, updated_at`;
function toKr(r: KrRow): OkrKeyResult {
  return {
    keyResultId: r.key_result_id, tenantId: r.key_result_tenant_id, okrId: r.key_result_okr_id,
    ownerUserId: r.key_result_owner_user_id, naturalKey: r.key_result_natural_key, description: r.key_result_description,
    metricType: r.key_result_metric_type as OkrKeyResult["metricType"],
    startValue: Number(r.key_result_start_value), targetValue: Number(r.key_result_target_value),
    currentValue: Number(r.key_result_current_value), unit: r.key_result_unit,
    progressPercent: Number(r.key_result_progress_percent), status: r.key_result_status as OkrKeyResult["status"],
    weight: Number(r.key_result_weight), confidenceLevel: r.key_result_confidence_level,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}
export async function listKeyResultsByOkr(q: DbConnector, okrId: string): Promise<{ items: OkrKeyResult[]; total: number }> {
  const res = await q.query<KrRow>(`SELECT ${KR_COLS} FROM sys.sys_okr_key_results WHERE key_result_okr_id = $1 ORDER BY created_at ASC`, [okrId]);
  return { items: res.rows.map(toKr), total: res.rows.length };
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm --filter @heuresys/api typecheck` → PASS
```bash
git add apps/api/src/modules/okrs/repository.ts
git commit -m "feat(api): okrs — repository (sys_okrs + key_results read)"
```

---

## Task 10: OKR service + routes + registration

**Files:**
- Create: `apps/api/src/modules/okrs/service.ts`
- Create: `apps/api/src/modules/okrs/routes.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Consumes: Task 9 repository; same actor/errors helpers as Task 3. Permissions `okr:{read,create,update,delete}` (seeded in Task 4).
- Produces: `okrsService`, `okrsRoutes`. Routes: `GET /`, `GET /:id`, `GET /:id/key-results`, `POST /`, `PATCH /:id`, `DELETE /:id`.

- [ ] **Step 1: Create the service**

`apps/api/src/modules/okrs/service.ts`:
```ts
/**
 * apps/api/src/modules/okrs/service.ts — OKR CRUD + key-results read. Tenant-only visibility.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type { OkrListQuery, CreateOkrBody, UpdateOkrBody } from "@heuresys/shared";
import * as repo from "./repository.js";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
function listTenantFilter(a: ActorContext): string | undefined { return isPlatform(a) ? undefined : (a.tenantId ?? ZERO_UUID); }
function assertVisible(a: ActorContext, rowTenantId: string, resource: string): void {
  if (isPlatform(a)) return;
  if (a.tenantId === null || rowTenantId !== a.tenantId) throw new NotFoundError(resource);
}
function resolveWriteTenant(a: ActorContext, bodyTenantId?: string): string {
  if (isPlatform(a)) { const t = bodyTenantId ?? a.tenantId; if (!t) throw new ForbiddenError("PLATFORM_ADMIN must supply tenantId", "TENANT_ID_REQUIRED"); return t; }
  if (!a.tenantId) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
  return a.tenantId;
}

export const okrsService = {
  async listOkrs(a: ActorContext, query: OkrListQuery) { return repo.listOkrs(pool, listTenantFilter(a), query); },
  async getOkr(a: ActorContext, id: string) {
    const o = await repo.findOkrById(pool, id); if (!o) throw new NotFoundError("OKR");
    assertVisible(a, o.tenantId, "OKR"); return o;
  },
  async listKeyResults(a: ActorContext, okrId: string) {
    const o = await repo.findOkrById(pool, okrId); if (!o) throw new NotFoundError("OKR");
    assertVisible(a, o.tenantId, "OKR");
    return repo.listKeyResultsByOkr(pool, okrId);
  },
  async createOkr(a: ActorContext, body: CreateOkrBody) { return repo.insertOkr(pool, resolveWriteTenant(a, body.tenantId), body); },
  async updateOkr(a: ActorContext, id: string, patch: UpdateOkrBody) {
    const o = await repo.findOkrById(pool, id); if (!o) throw new NotFoundError("OKR");
    assertVisible(a, o.tenantId, "OKR");
    const u = await repo.updateOkrPartial(pool, id, patch); if (!u) throw new NotFoundError("OKR"); return u;
  },
  async deleteOkr(a: ActorContext, id: string): Promise<void> {
    const o = await repo.findOkrById(pool, id); if (!o) throw new NotFoundError("OKR");
    assertVisible(a, o.tenantId, "OKR"); await repo.deleteOkr(pool, id);
  },
};
```

- [ ] **Step 2: Create the routes**

`apps/api/src/modules/okrs/routes.ts`:
```ts
/**
 * apps/api/src/modules/okrs/routes.ts — /v1/okrs/*
 * Reads: okr:read. Writes: app.verifyCsrf + okr:{create,update,delete}.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  OkrSchema, OkrListQuerySchema, OkrListResponseSchema,
  CreateOkrBodySchema, UpdateOkrBodySchema, OkrIdParamSchema, OkrKeyResultListResponseSchema,
} from "@heuresys/shared";
import { okrsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const okrsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("okr:read")],
    schema: { querystring: OkrListQuerySchema, response: { 200: OkrListResponseSchema } },
  }, async (req) => okrsService.listOkrs(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("okr:read")],
    schema: { params: OkrIdParamSchema, response: { 200: OkrSchema } },
  }, async (req) => okrsService.getOkr(actor(req), req.params.id));

  app.get("/:id/key-results", {
    preHandler: [requirePermission("okr:read")],
    schema: { params: OkrIdParamSchema, response: { 200: OkrKeyResultListResponseSchema } },
  }, async (req) => okrsService.listKeyResults(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("okr:create")],
    schema: { body: CreateOkrBodySchema, response: { 201: OkrSchema } },
  }, async (req, reply) => { reply.code(201).send(await okrsService.createOkr(actor(req), req.body)); });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("okr:update")],
    schema: { params: OkrIdParamSchema, body: UpdateOkrBodySchema, response: { 200: OkrSchema } },
  }, async (req) => okrsService.updateOkr(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("okr:delete")],
    schema: { params: OkrIdParamSchema },
  }, async (req, reply) => { await okrsService.deleteOkr(actor(req), req.params.id); reply.code(204).send(); });
};
```

- [ ] **Step 3: Register in app.ts**

Import (near line 104): `import { okrsRoutes } from "./modules/okrs/routes.js";`
Register (step 13): `await app.register(okrsRoutes, { prefix: "/v1/okrs" });`

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm --filter @heuresys/api typecheck` → PASS
```bash
git add apps/api/src/modules/okrs/service.ts apps/api/src/modules/okrs/routes.ts apps/api/src/app.ts
git commit -m "feat(api): okrs — service + routes + app registration"
```

---

## Task 11: OKR integration test

**Files:**
- Create: `apps/api/test/okrs.integration.test.ts`

- [ ] **Step 1: Write the test**

`apps/api/test/okrs.integration.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>(); for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp; let admin: S; let tenantAdmin: S; let plainUser: S;
let rtlTenantId: string; let rtlOkrTotal: number;
const createdOkrIds: string[] = [];

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");
  const t = await pool.query<{ id: string }>("SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'");
  rtlTenantId = t.rows[0]!.id;
  const c = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM sys.sys_okrs WHERE okr_tenant_id = $1", [rtlTenantId]);
  rtlOkrTotal = Number(c.rows[0]!.n);
});
afterAll(async () => {
  for (const id of createdOkrIds) { try { await pool.query("DELETE FROM sys.sys_okrs WHERE okr_id = $1", [id]); } catch { /* ignore */ } }
  await suite.app.close();
});

describe("okrs API", () => {
  it("GET / — TENANT_ADMIN lists RTL OKRs (live total)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/okrs?limit=1", headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(rtlOkrTotal);
  });

  it("GET / — plain USER lacks okr:read -> 403", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/okrs", headers: { cookie: ch(plainUser.cookies) } });
    expect(r.statusCode).toBe(403);
  });

  it("GET /:id/key-results returns the OKR's key results (typed numerics)", async () => {
    const list = await suite.app.inject({ method: "GET", url: "/v1/okrs?limit=1", headers: { cookie: ch(admin.cookies) } });
    const okr = (list.json() as { items: { okrId: string }[] }).items[0];
    expect(okr).toBeTruthy();
    const kr = await suite.app.inject({ method: "GET", url: `/v1/okrs/${okr!.okrId}/key-results`, headers: { cookie: ch(admin.cookies) } });
    expect(kr.statusCode).toBe(200);
    const body = kr.json() as { items: { targetValue: number }[]; total: number };
    if (body.total > 0) expect(typeof body.items[0]!.targetValue).toBe("number");
  });

  it("full CRUD round-trip (create -> patch -> delete -> 404)", async () => {
    const hdrW = { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken, "content-type": "application/json" };
    const c = await suite.app.inject({ method: "POST", url: "/v1/okrs", headers: hdrW,
      payload: { objective: "IT_OKR_Crud", okrType: "TEAM", periodType: "QUARTERLY", periodStart: "2026-01-01", periodEnd: "2026-03-31" } });
    expect(c.statusCode).toBe(201);
    const created = c.json() as { okrId: string; okrType: string };
    createdOkrIds.push(created.okrId);
    expect(created.okrType).toBe("TEAM");
    const patch = await suite.app.inject({ method: "PATCH", url: `/v1/okrs/${created.okrId}`, headers: hdrW, payload: { status: "ACHIEVED", overallProgress: 100 } });
    expect(patch.statusCode).toBe(200);
    expect((patch.json() as { status: string }).status).toBe("ACHIEVED");
    const del = await suite.app.inject({ method: "DELETE", url: `/v1/okrs/${created.okrId}`, headers: { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken } });
    expect(del.statusCode).toBe(204);
    const gone = await suite.app.inject({ method: "GET", url: `/v1/okrs/${created.okrId}`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(gone.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd apps/api && pnpm exec vitest run test/okrs.integration.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/okrs.integration.test.ts
git commit -m "test(api): okrs — integration suite (live DB, CRUD + key-results + RBAC)"
```

---

## Task 12: OKR web UI + E2E + full green gate

**Files:**
- Create: `apps/web/src/app/(authenticated)/okrs/page.tsx`
- Modify: web i18n `hr` namespace (add `okrs.*`)
- Create: append OKR assertion to `apps/web/tests/e2e/goals.spec.ts` (or sibling `okrs.spec.ts`)

- [ ] **Step 1: Create the OKR page**

`apps/web/src/app/(authenticated)/okrs/page.tsx` (mirror Task 6 structure):
```tsx
"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

interface OkrRow { okrId: string; objective: string; okrType: string; status: string; overallProgress: number; periodStart: string; periodEnd: string }
interface OkrList { items: OkrRow[]; total: number }

function toneForStatus(s: string): "info" | "success" | "warning" | "danger" | "neutral" {
  if (s === "ACHIEVED") return "success";
  if (s === "MISSED" || s === "CANCELLED") return "danger";
  if (s === "ACTIVE") return "info";
  return "neutral";
}
function buildColumns(t: TFunction): DataColumn<OkrRow>[] {
  return [
    { header: t("okrs.cols.objective"), cell: (o) => <span className="font-medium text-foreground">{o.objective}</span> },
    { header: t("okrs.cols.type"), cell: (o) => <span className="text-xs text-muted-foreground">{o.okrType}</span> },
    { header: t("okrs.cols.period"), cell: (o) => <span className="text-xs text-muted-foreground">{o.periodStart} → {o.periodEnd}</span> },
    { header: t("okrs.cols.progress"), cell: (o) => <span className="text-xs text-muted-foreground">{o.overallProgress}%</span> },
    { header: t("shared.status"), cell: (o) => <StatusPill tone={toneForStatus(o.status)}>{o.status}</StatusPill> },
  ];
}
export default function OkrsPage() {
  const { t } = useTranslation("hr");
  const columns = useMemo(() => buildColumns(t), [t]);
  const okrs = useQuery({ queryKey: ["okrs", "list"], queryFn: () => apiFetch<OkrList>("/v1/okrs?limit=200") });
  return (
    <DataTablePanel<OkrRow>
      pageTestId="okrs-page" titleTestId="okrs-title" countTestId="okrs-count"
      title={t("okrs.title")} description={t("okrs.description")}
      count={okrs.data ? t("okrs.count", { count: okrs.data.total }) : undefined}
      isLoading={okrs.isLoading} isError={okrs.isError} errorMessage={t("okrs.errorMessage")}
      rows={okrs.data?.items ?? []} rowKey={(o) => o.okrId} rowTestId="okrs-row" columns={columns}
      emptyTestId="okrs-empty" emptyTitle={t("okrs.emptyTitle")} emptyDescription={t("okrs.emptyDescription")} caption={t("okrs.caption")}
    />
  );
}
```

- [ ] **Step 2: Add `okrs.*` i18n keys** (en + it), mirroring the `goals` block from Task 6 (keys: `title`, `description`, `count`, `errorMessage`, `emptyTitle`, `emptyDescription`, `caption`, `cols.objective`, `cols.type`, `cols.period`, `cols.progress`). Run `pnpm --filter @heuresys/web i18n:check` → PASS.

- [ ] **Step 3: Append OKR E2E assertion** to `apps/web/tests/e2e/goals.spec.ts`:
```ts
  test("TENANT_ADMIN sees the OKR list populated from live data", async ({ page }) => {
    await loginAs(page, "federica.marchetti@rtl-bank.org", "Admin#PassW0rd!");
    await page.goto("/okrs");
    await expect(page.getByTestId("okrs-title")).toBeVisible();
    await expect(page.getByTestId("okrs-row").first()).toBeVisible();
  });
```

- [ ] **Step 4: Full green gate (the whole module)**

Run each and confirm PASS:
```bash
pnpm typecheck
pnpm --filter @heuresys/api exec vitest run test/goals.integration.test.ts test/okrs.integration.test.ts
pnpm --filter @heuresys/web i18n:check
pnpm --filter @heuresys/web test:e2e:prod:node22 -- goals.spec.ts
pnpm lint
```
Expected: all PASS. Fix any regression before committing (no "TODO: fix later").

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(authenticated)/okrs/page.tsx" apps/web/src/**/locales/** apps/web/tests/e2e/goals.spec.ts
git commit -m "feat(web): okrs — read-only list page + i18n + E2E; goals/okr module green"
```

---

## Self-Review

- **Spec coverage:** the plan delivers the Ledger §10 Tier-A "Goals/OKR module" first slice (Goals + OKR core, API+test+UI+E2E) over the live tables — ✅. Sub-resources explicitly deferred (see Next plans) — not a gap, a scope decision.
- **Placeholder scan:** every code step has complete code; commands have expected output; no TBD/TODO shipped.
- **Type consistency:** `Goal`/`Okr`/`OkrKeyResult` field names match between shared schema (Tasks 1/8), repository mappers (Tasks 2/9), and tests (Tasks 5/11). Permission codes `goal:*`/`okr:*` are seeded (Task 4) before tests run (Tasks 5/11). numeric→`Number()` and date→`::text` applied consistently.
- **Two real unknowns to confirm at execution start (cheap):** (a) the exact path of the web `hr` i18n files — resolved via `grep -rl '"kpis"'` in Task 6; (b) the e2e helper/dir + login helper — resolved by mirroring a sibling spec in Task 7. Both are located, not invented.

## Next plans (decomposition of the remaining Goals/OKR subsystem)

1. **Goals/OKR timeline & sub-resources** — milestones, check-ins, updates, comments, alignments, okr-check-ins (read + append), goal templates. (7 tables already populated.)
2. **Goals/OKR mutation UI** — create/edit forms + detail drill-down + alignment graph (reuses the CRUD endpoints already shipped here).
3. Then the next Ledger §10 Tier-A item (Performance-review / 9-box) as its own plan.
