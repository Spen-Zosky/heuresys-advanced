# BI Analytics — Phase 1 (API) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `analytics` API module with two live rollup endpoints — `GET /v1/analytics/workforce` and `GET /v1/analytics/kpi` — role/tenant-scoped, fully tested against the live seed.

**Architecture:** New module `apps/api/src/modules/analytics/` mirroring the `dashboard` module exactly (shared Zod schema → raw-SQL repository → service reusing dashboard's role→scope mapping → `FastifyPluginAsyncZod` routes with `requirePermission('analytics:view')` → register at app.ts step 13 → integration test via `buildTestApp()`). Aggregation is parameterized SQL with scope filters (tenant for non-platform; positions-owned for MANAGER). Descriptive analytics only; predictive is capability ③.

**Tech Stack:** Fastify 5 + fastify-type-provider-zod, Zod 4, `pg` raw SQL, vitest + supertest (`app.inject`), live OCI VM DB via tunnel :5433.

**Scope:** Phase 1 = workforce headcount distribution + KPI achievement rollup. Frontend pages = Phase 1b (separate plan). Phases 2/3 (skill-gap/attendance/comp/network) = later plans.

---

### Task 1: Shared Zod schemas for analytics

**Files:**
- Create: `packages/shared/src/schemas/analytics.ts`
- Modify: `packages/shared/src/index.ts` (add `export * from "./schemas/analytics.js"`)
- Modify: `packages/shared/package.json` (add subpath export `"./schemas/analytics"`)

- [ ] **Step 1: Write the schema file**

```typescript
// packages/shared/src/schemas/analytics.ts
import { z } from "zod";

export const AnalyticsScopeKindSchema = z.enum(["PLATFORM", "TENANT", "TEAM"]);

// --- Workforce ---
export const WorkforceByDimensionRowSchema = z.object({
  dimension: z.string(),        // OU name / role title / tenant code
  headcount: z.number().int(),
});
export const WorkforceAnalyticsResponseSchema = z.object({
  scope: z.object({ kind: AnalyticsScopeKindSchema, tenantId: z.string().uuid().nullable() }),
  totalHeadcount: z.number().int(),
  byOrgUnit: z.array(WorkforceByDimensionRowSchema),
  byJobRole: z.array(WorkforceByDimensionRowSchema),
  generatedAt: z.string(),
});
export type WorkforceAnalyticsResponse = z.infer<typeof WorkforceAnalyticsResponseSchema>;

// --- KPI ---
export const KpiAchievementRowSchema = z.object({
  kpiCode: z.string(),
  kpiName: z.string(),
  targetsCount: z.number().int(),
  avgAchievementPct: z.number().nullable(),  // mean(actual/target*100) where actual present
});
export const KpiAnalyticsResponseSchema = z.object({
  scope: z.object({ kind: AnalyticsScopeKindSchema, tenantId: z.string().uuid().nullable() }),
  totalTargets: z.number().int(),
  distinctKpis: z.number().int(),
  byKpi: z.array(KpiAchievementRowSchema),
  generatedAt: z.string(),
});
export type KpiAnalyticsResponse = z.infer<typeof KpiAnalyticsResponseSchema>;
```

- [ ] **Step 2: Wire exports** — add to `packages/shared/src/index.ts`:
```typescript
export * from "./schemas/analytics.js";
```
and in `packages/shared/package.json` `"exports"` map (mirror an existing entry like `./schemas/dashboard`):
```json
"./schemas/analytics": { "types": "./dist/schemas/analytics.d.ts", "import": "./dist/schemas/analytics.js" }
```

- [ ] **Step 3: Build shared + typecheck**

Run: `pnpm --filter @heuresys/shared build && pnpm --filter @heuresys/shared typecheck`
Expected: exit 0 (tsc reads `dist/*.d.ts` — the build is mandatory after editing shared src).

- [ ] **Step 4: Commit**
```bash
git add packages/shared/src/schemas/analytics.ts packages/shared/src/index.ts packages/shared/package.json
git commit -m "feat(shared): analytics Zod schemas (workforce + kpi)"
```

---

### Task 2: RBAC permission seed `analytics:view`

**Files:**
- Create: `db/migrations/000057_analytics_permission_seed.sql`

- [ ] **Step 1: Write the migration** (mirror `000028_dashboard_permission_seed.sql` exactly)

```sql
-- 000057_analytics_permission_seed.sql
-- analytics:view permission + role mappings (BI capability, Phase 1).
-- Idempotent: INSERT ... ON CONFLICT DO NOTHING. Recorded by migrate.{ps1,sh}.
INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES ('analytics:view', 'View analytics dashboards', 'analytics', 'view')
ON CONFLICT (auth_permission_code) DO NOTHING;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'analytics:view'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;
```

- [ ] **Step 2: Apply + verify idempotent**

Run: `pnpm db:migrate:sh` then re-run once.
Expected: `analytics:view` present; 2nd run no-op. Verify:
`psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT auth_permission_code FROM sys.sys_auth_permissions WHERE auth_permission_code='analytics:view';"` → 1 row.

- [ ] **Step 3: Commit**
```bash
git add db/migrations/000057_analytics_permission_seed.sql
git commit -m "feat(db): analytics:view permission seed (mig 000057)"
```

---

### Task 3: Repository — workforce + KPI rollups (raw SQL)

**Files:**
- Create: `apps/api/src/modules/analytics/repository.ts`

> The scope filter mirrors `dashboard/repository.ts` `ScopeFilter` (`{ tenantId, teamPositionIds, isPlatformScope }`). Headcount counts users via their PRIMARY position assignment → position → org_unit; non-platform scopes filter by `user_tenant_id`. **The exact column names are verified by the test in Task 5 against the live seed (headcount must total 161).**

- [ ] **Step 1: Write the repository**

```typescript
// apps/api/src/modules/analytics/repository.ts
import type { Pool } from "pg";

export interface ScopeFilter {
  tenantId: string | null;
  teamPositionIds: string[];
  isPlatformScope: boolean;
}

function tenantClause(scope: ScopeFilter, alias: string): { sql: string; params: unknown[] } {
  if (scope.isPlatformScope) return { sql: "TRUE", params: [] };
  return { sql: `${alias}.user_tenant_id = $1`, params: [scope.tenantId] };
}

export async function getWorkforceTotals(pool: Pool, scope: ScopeFilter) {
  const t = tenantClause(scope, "u");
  const total = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_users u WHERE ${t.sql}`, t.params,
  );
  const byOu = await pool.query<{ dimension: string; headcount: string }>(
    `SELECT COALESCE(ou.org_unit_name, '(unassigned)') AS dimension, count(DISTINCT u.user_id)::text AS headcount
       FROM sys.sys_users u
       LEFT JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = u.user_id AND a.user_position_assignment_is_primary = true
       LEFT JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
       LEFT JOIN sys.sys_organization_units ou ON ou.org_unit_id = p.position_org_unit_id
      WHERE ${t.sql}
      GROUP BY 1 ORDER BY 2 DESC`, t.params,
  );
  const byRole = await pool.query<{ dimension: string; headcount: string }>(
    `SELECT COALESCE(p.position_title, '(no position)') AS dimension, count(DISTINCT u.user_id)::text AS headcount
       FROM sys.sys_users u
       LEFT JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = u.user_id AND a.user_position_assignment_is_primary = true
       LEFT JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
      WHERE ${t.sql}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 50`, t.params,
  );
  return {
    total: Number(total.rows[0]?.n ?? 0),
    byOrgUnit: byOu.rows.map((r) => ({ dimension: r.dimension, headcount: Number(r.headcount) })),
    byJobRole: byRole.rows.map((r) => ({ dimension: r.dimension, headcount: Number(r.headcount) })),
  };
}

export async function getKpiAchievement(pool: Pool, scope: ScopeFilter) {
  // kpi_targets carry tenant on the row; actual is in metadata.legacy.actual_value (seed 03).
  const params: unknown[] = [];
  let where = "TRUE";
  if (!scope.isPlatformScope) { params.push(scope.tenantId); where = `t.kpi_target_tenant_id = $1`; }
  const rows = await pool.query<{ kpicode: string; kpiname: string; cnt: string; avgpct: string | null }>(
    `SELECT k.kpi_definition_code AS kpicode, k.kpi_definition_name AS kpiname,
            count(*)::text AS cnt,
            avg(NULLIF((t.kpi_target_metadata #>> '{legacy,actual_value}')::numeric, NULL)
                / NULLIF(t.kpi_target_target_value, 0) * 100)::text AS avgpct
       FROM sys.sys_kpi_targets t
       JOIN sys.sys_kpi_definitions k ON k.kpi_definition_id = t.kpi_target_kpi_id
      WHERE ${where}
      GROUP BY 1, 2 ORDER BY 3 DESC`, params,
  );
  const totals = await pool.query<{ total: string; distinct: string }>(
    `SELECT count(*)::text AS total, count(DISTINCT kpi_target_kpi_id)::text AS distinct
       FROM sys.sys_kpi_targets t WHERE ${where}`, params,
  );
  return {
    totalTargets: Number(totals.rows[0]?.total ?? 0),
    distinctKpis: Number(totals.rows[0]?.distinct ?? 0),
    byKpi: rows.rows.map((r) => ({
      kpiCode: r.kpicode, kpiName: r.kpiname, targetsCount: Number(r.cnt),
      avgAchievementPct: r.avgpct === null ? null : Number(r.avgpct),
    })),
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && pnpm typecheck`
Expected: exit 0. (Fix any column-name mismatch surfaced — verify against `\d sys.sys_user_position_assignments` / `\d sys.sys_positions`; adjust `*_is_primary` / `position_org_unit_id` / `position_title` to the real column names.)

- [ ] **Step 3: Commit**
```bash
git add apps/api/src/modules/analytics/repository.ts
git commit -m "feat(api): analytics repository — workforce + kpi rollups"
```

---

### Task 4: Service — role→scope mapping (reuse dashboard's)

**Files:**
- Create: `apps/api/src/modules/analytics/service.ts`

- [ ] **Step 1: Write the service** (scope logic copied from `dashboard/service.ts` lines 21-40,59-79)

```typescript
// apps/api/src/modules/analytics/service.ts
import { pool } from "../../db/client.js";
import type { RoleCode } from "../../config/constants.js";
import type { WorkforceAnalyticsResponse, KpiAnalyticsResponse } from "@heuresys/shared";
import * as repo from "./repository.js";
import { findOwnedPositionIds } from "../dashboard/repository.js";

export interface ActorContext { userId: string; tenantId: string | null; roles: RoleCode[]; }

const PLATFORM_ROLES: RoleCode[] = ["PLATFORM_ADMIN"];
const TEAM_ROLES: RoleCode[] = ["MANAGER"];
type ScopeKind = "PLATFORM" | "TENANT" | "TEAM";

function scopeKind(a: ActorContext): ScopeKind {
  if (a.roles.some((r) => PLATFORM_ROLES.includes(r))) return "PLATFORM";
  if (a.roles.some((r) => TEAM_ROLES.includes(r)) && !a.roles.some((r)=>r==="TENANT_ADMIN")) return "TEAM";
  return "TENANT";
}

async function buildScope(a: ActorContext): Promise<{ kind: ScopeKind; filter: repo.ScopeFilter; tenantId: string | null }> {
  const kind = scopeKind(a);
  const isPlatform = kind === "PLATFORM";
  const teamPositionIds = kind === "TEAM" ? await findOwnedPositionIds(pool, a.userId) : [];
  const tenantId = isPlatform ? null : a.tenantId;
  return { kind, tenantId, filter: { tenantId, teamPositionIds, isPlatformScope: isPlatform } };
}

export const analyticsService = {
  async workforce(a: ActorContext): Promise<WorkforceAnalyticsResponse> {
    const s = await buildScope(a);
    const w = await repo.getWorkforceTotals(pool, s.filter);
    return { scope: { kind: s.kind, tenantId: s.tenantId }, totalHeadcount: w.total,
      byOrgUnit: w.byOrgUnit, byJobRole: w.byJobRole, generatedAt: new Date().toISOString() };
  },
  async kpi(a: ActorContext): Promise<KpiAnalyticsResponse> {
    const s = await buildScope(a);
    const k = await repo.getKpiAchievement(pool, s.filter);
    return { scope: { kind: s.kind, tenantId: s.tenantId }, totalTargets: k.totalTargets,
      distinctKpis: k.distinctKpis, byKpi: k.byKpi, generatedAt: new Date().toISOString() };
  },
};
```

- [ ] **Step 2: Typecheck** — `cd apps/api && pnpm typecheck` → exit 0. (If `findOwnedPositionIds` is not exported from `dashboard/repository.ts`, add `export` to it there.)

- [ ] **Step 3: Commit**
```bash
git add apps/api/src/modules/analytics/service.ts
git commit -m "feat(api): analytics service — role-scoped workforce + kpi"
```

---

### Task 5: Routes + register

**Files:**
- Create: `apps/api/src/modules/analytics/routes.ts`
- Modify: `apps/api/src/app.ts` (import + register at step 13, next to dashboard)

- [ ] **Step 1: Write routes** (mirror `dashboard/routes.ts`)

```typescript
// apps/api/src/modules/analytics/routes.ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import { WorkforceAnalyticsResponseSchema, KpiAnalyticsResponseSchema } from "@heuresys/shared";
import { analyticsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const analyticsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/workforce", { preHandler: [requirePermission("analytics:view")],
    schema: { response: { 200: WorkforceAnalyticsResponseSchema } } },
    async (req) => analyticsService.workforce(actor(req)));
  app.get("/kpi", { preHandler: [requirePermission("analytics:view")],
    schema: { response: { 200: KpiAnalyticsResponseSchema } } },
    async (req) => analyticsService.kpi(actor(req)));
};
```

- [ ] **Step 2: Register in app.ts** — next to the dashboard registration:
```typescript
import { analyticsRoutes } from "./modules/analytics/routes.js";
// ... in the step-13 block:
await app.register(analyticsRoutes, { prefix: "/v1/analytics" });
```

- [ ] **Step 3: Typecheck** — `cd apps/api && pnpm typecheck` → exit 0.

- [ ] **Step 4: Commit**
```bash
git add apps/api/src/modules/analytics/routes.ts apps/api/src/app.ts
git commit -m "feat(api): analytics routes + register (/v1/analytics/{workforce,kpi})"
```

---

### Task 6: Integration test (live seed)

**Files:**
- Create: `apps/api/test/analytics.integration.test.ts`

- [ ] **Step 1: Write the failing test** (mirror an existing `*.integration.test.ts` using `buildTestApp` + admin login helper)

```typescript
// apps/api/test/analytics.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, loginAs } from "./helpers/build-test-app.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); });

describe("GET /v1/analytics/workforce", () => {
  it("401 without auth", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/analytics/workforce" });
    expect(res.statusCode).toBe(401);
  });
  it("platform admin sees full headcount (161)", async () => {
    const cookie = await loginAs(app, "admin@heuresys.com");
    const res = await app.inject({ method: "GET", url: "/v1/analytics/workforce", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalHeadcount).toBe(161);
    expect(body.byOrgUnit.length).toBeGreaterThan(0);
  });
});

describe("GET /v1/analytics/kpi", () => {
  it("platform admin sees the kpi rollup (248 targets)", async () => {
    const cookie = await loginAs(app, "admin@heuresys.com");
    const res = await app.inject({ method: "GET", url: "/v1/analytics/kpi", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalTargets).toBe(248);
    expect(body.byKpi.length).toBeGreaterThan(0);
  });
});
```

> Adapt `loginAs`/helper names to the real `build-test-app.ts` exports (check an existing test). The numbers 161/248 are the live seed (verified S958).

- [ ] **Step 2: Run — expect FAIL** (routes not yet green / column mismatches)

Run: `cd apps/api && pnpm exec vitest run test/analytics.integration.test.ts`
Expected: initially FAIL → iterate on the repository SQL column names until headcount=161 and totalTargets=248.

- [ ] **Step 3: Fix repository column names** against live `\d` until the test passes (the TDD loop — adjust `position_org_unit_id`, `position_title`, `user_position_assignment_is_primary` to the real names).

- [ ] **Step 4: Run — expect PASS**

Run: `cd apps/api && pnpm exec vitest run test/analytics.integration.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Full suite regression** — `cd apps/api && pnpm exec vitest run` → all green (no regression from the new module/permission).

- [ ] **Step 6: Commit**
```bash
git add apps/api/test/analytics.integration.test.ts apps/api/src/modules/analytics/repository.ts
git commit -m "test(api): analytics integration (workforce 161 + kpi 248, live seed)"
```

---

## Self-review

- **Spec coverage:** §2 foundation (analytics module + scope reuse) → Tasks 3-5; §3 P1 workforce → Task 3/5/6; §3 P1 KPI → Task 3/5/6; §4 scope reuse → Task 4; §6 testing → Task 6. P2/P3 views + frontend are explicitly out of this plan (Phase 1b/2/3).
- **Placeholder scan:** SQL column names are flagged as TDD-verified against live `\d` in Tasks 3/6 (not a placeholder — the test pins the expected aggregate; the loop fixes the SQL). Permission grant, schemas, routes, register are concrete.
- **Type consistency:** `ScopeFilter` shape consistent across repository/service; `WorkforceAnalyticsResponse`/`KpiAnalyticsResponse` defined in Task 1, consumed in Tasks 4-6; `analyticsService.{workforce,kpi}` names consistent in service + routes.
- **Frontend (Phase 1b):** `/analytics/workforce` + `/analytics/kpi` pages composing `@heuresys/ui` charts + TanStack hooks + Playwright E2E — separate plan once these endpoints are green.
