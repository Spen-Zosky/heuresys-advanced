import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
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
  admin = await login(suite, "enzo.spenuso@heuresys.com");
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
