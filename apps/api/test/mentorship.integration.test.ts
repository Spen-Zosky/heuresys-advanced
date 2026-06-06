import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";

// S970 #2·m1 — mentorship API module (/v1/mentorship/*). Real login + live DB (SSH tunnel).
// Reads need mentorship:read (6 HRMS roles); writes need mentorship:{create,update,delete} (admins+HR).

const PWD = "Admin#PassW0rd!";
interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let admin: S;        // PLATFORM_ADMIN — sees all
let tenantAdmin: S;  // TENANT_ADMIN RTL — read + write in tenant
let plainUser: S;    // USER — no mentorship perms
const createdProgramIds: string[] = [];

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");
});

afterAll(async () => {
  for (const id of createdProgramIds) {
    try { await pool.query("DELETE FROM sys.sys_mentorship_programs WHERE program_id = $1", [id]); } catch { /* ignore */ }
  }
  await suite.app.close();
});

describe("mentorship API", () => {
  it("GET /pairings — admin lists the imported RTL pairings", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/mentorship/pairings?limit=200", headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(body.total).toBe(63);
    expect(body.items.length).toBe(63);
  });

  it("GET /pairings — TENANT_ADMIN sees only its own tenant (also 63, single-tenant RTL)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/mentorship/pairings?limit=200", headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(63);
  });

  it("GET /pairings — plain USER lacks mentorship:read -> 403", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/mentorship/pairings", headers: { cookie: ch(plainUser.cookies) } });
    expect(r.statusCode).toBe(403);
  });

  it("GET /programs and /match-scores return data", async () => {
    const p = await suite.app.inject({ method: "GET", url: "/v1/mentorship/programs", headers: { cookie: ch(admin.cookies) } });
    expect(p.statusCode).toBe(200);
    expect((p.json() as { total: number }).total).toBe(5);
    const m = await suite.app.inject({ method: "GET", url: "/v1/mentorship/match-scores", headers: { cookie: ch(admin.cookies) } });
    expect(m.statusCode).toBe(200);
    expect((m.json() as { total: number }).total).toBe(30);
  });

  it("POST /programs without CSRF token -> rejected; with token -> 201", async () => {
    const payload = { name: "IT_MENT_TestProgram", type: "TECHNICAL", status: "ACTIVE" };
    const noCsrf = await suite.app.inject({ method: "POST", url: "/v1/mentorship/programs",
      headers: { cookie: ch(tenantAdmin.cookies), "content-type": "application/json" }, payload });
    expect(noCsrf.statusCode).toBeGreaterThanOrEqual(400);
    const ok = await suite.app.inject({ method: "POST", url: "/v1/mentorship/programs",
      headers: { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken, "content-type": "application/json" }, payload });
    expect(ok.statusCode).toBe(201);
    const created = ok.json() as { programId: string; name: string; type: string };
    createdProgramIds.push(created.programId);
    expect(created.name).toBe("IT_MENT_TestProgram");
    expect(created.type).toBe("TECHNICAL");
  });

  it("full CRUD round-trip on a program (create -> get -> patch -> delete)", async () => {
    const hdrW = { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken, "content-type": "application/json" };
    const c = await suite.app.inject({ method: "POST", url: "/v1/mentorship/programs", headers: hdrW, payload: { name: "IT_MENT_Crud", type: "GENERAL", status: "DRAFT" } });
    expect(c.statusCode).toBe(201);
    const id = (c.json() as { programId: string }).programId;
    createdProgramIds.push(id);
    const g = await suite.app.inject({ method: "GET", url: `/v1/mentorship/programs/${id}`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(g.statusCode).toBe(200);
    const patch = await suite.app.inject({ method: "PATCH", url: `/v1/mentorship/programs/${id}`, headers: hdrW, payload: { status: "ACTIVE" } });
    expect(patch.statusCode).toBe(200);
    expect((patch.json() as { status: string }).status).toBe("ACTIVE");
    const del = await suite.app.inject({ method: "DELETE", url: `/v1/mentorship/programs/${id}`, headers: { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken } });
    expect(del.statusCode).toBe(204);
    const gone = await suite.app.inject({ method: "GET", url: `/v1/mentorship/programs/${id}`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(gone.statusCode).toBe(404);
  });

  it("USER cannot create (no mentorship:create) -> 403", async () => {
    const r = await suite.app.inject({ method: "POST", url: "/v1/mentorship/programs",
      headers: { cookie: ch(plainUser.cookies), "x-csrf-token": plainUser.csrfToken, "content-type": "application/json" },
      payload: { name: "IT_MENT_Nope" } });
    expect(r.statusCode).toBe(403);
  });

  it("create pairing rejects identical mentor/mentee (validation)", async () => {
    const sameUser = "00000000-0000-0000-0000-0000000000aa";
    const r = await suite.app.inject({ method: "POST", url: "/v1/mentorship/pairings",
      headers: { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken, "content-type": "application/json" },
      payload: { mentorUserId: sameUser, menteeUserId: sameUser } });
    expect(r.statusCode).toBeGreaterThanOrEqual(400);
  });
});
