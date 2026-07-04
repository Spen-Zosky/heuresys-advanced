import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

// Goals API (/v1/goals/*). Real login + live DB (SSH tunnel). Reads need goal:read (6 roles);
// writes need goal:{create,update,delete}. Live baseline: sys_goals ~1067 (RTL tenant).

const PWD = TEST_PERSONA_PASSWORD;
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
