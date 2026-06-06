import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";
import { toVectorLiteral } from "../src/modules/semantic-matching/repository.js";

// AI ② P1 — semantic-matching API (/v1/matching/*). Real login + live DB (SSH tunnel).
// Seeds its OWN deterministic vectors (no Voyage); cleans them up in afterAll.

const PWD = "Admin#PassW0rd!";
interface S { cookies: Map<string, string>; csrfToken: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

// 1024-dim unit vector with a 1 at index i (rest 0) — controls cosine ordering deterministically.
const unit = (i: number): number[] => { const v = new Array<number>(1024).fill(0); v[i] = 1; return v; };
const near = (i: number): number[] => { const v = unit(i); v[(i + 1) % 1024] = 0.05; return v; };

const URI_FIN = "http://test/esco/IT_MATCH_finance";
const URI_COOK = "http://test/esco/IT_MATCH_cooking";

let suite: TestApp;
let manager: S;          // paolo.caputo (RTL) — seeded profile near "finance"
let tenantAdmin: S;      // federica (RTL TENANT_ADMIN)
let menteeNoProfile: S;  // antonio (RTL) — no seeded profile → empty-state
let admin: S;            // admin@heuresys.com (PLATFORM_ADMIN) — sees across tenants
let paoloId: string, adminUserId: string, adminTenantId: string, rtlTenant: string;
let skillA: string, skillB: string, skillC: string; // A=input(RTL), B=RTL-visible, C=NULL-tenant(hidden)

beforeAll(async () => {
  suite = await buildTestApp();
  manager = await login(suite, "paolo.caputo@rtl-bank.org");
  tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  menteeNoProfile = await login(suite, "antonio.parisi@rtl-bank.org");
  admin = await login(suite, "admin@heuresys.com");

  const ids = await pool.query<{ user_id: string; user_tenant_id: string; user_email: string }>(
    `SELECT user_id, user_tenant_id, user_email FROM sys.sys_users
     WHERE user_email IN ('paolo.caputo@rtl-bank.org','admin@heuresys.com')`);
  const by = (e: string) => ids.rows.find((r) => r.user_email === e)!;
  paoloId = by("paolo.caputo@rtl-bank.org").user_id;
  rtlTenant = by("paolo.caputo@rtl-bank.org").user_tenant_id;
  const paoloTenant = rtlTenant;
  adminUserId = by("admin@heuresys.com").user_id;
  adminTenantId = by("admin@heuresys.com").user_tenant_id;

  // Skill-similar cross-tenant fixture: A(input,RTL) + B(RTL-visible) + C(NULL-tenant, hidden to RTL).
  const rtlSkills = await pool.query<{ skill_id: string }>(
    `SELECT skill_id FROM sys.sys_skills WHERE skill_tenant_id = $1 AND skill_is_global = false ORDER BY skill_id LIMIT 2`, [rtlTenant]);
  const hidden = await pool.query<{ skill_id: string }>(
    `SELECT skill_id FROM sys.sys_skills WHERE skill_tenant_id IS NULL AND skill_is_global = false ORDER BY skill_id LIMIT 1`);
  skillA = rtlSkills.rows[0]!.skill_id;
  skillB = rtlSkills.rows[1]!.skill_id;
  skillC = hidden.rows[0]!.skill_id;
  await pool.query(
    `INSERT INTO sys.sys_skill_embeddings (skill_id, embedding, model_id)
     VALUES ($1,$4::vector,'itmatch'),($2,$4::vector,'itmatch'),($3,$4::vector,'itmatch')
     ON CONFLICT (skill_id) DO UPDATE SET embedding=EXCLUDED.embedding`,
    [skillA, skillB, skillC, toVectorLiteral(unit(0))]);

  // Seed 2 occupation embeddings (finance @ dim 0, cooking @ dim 10).
  await pool.query(
    `INSERT INTO sys.sys_esco_occupation_embeddings (esco_uri, embedding, label_text, model_id)
     VALUES ($1,$2::vector,'Finance specialist','itmatch'),($3,$4::vector,'Cook','itmatch')
     ON CONFLICT (esco_uri) DO UPDATE SET embedding=EXCLUDED.embedding`,
    [URI_FIN, toVectorLiteral(unit(0)), URI_COOK, toVectorLiteral(unit(10))]);
  // Seed paolo's profile near finance; admin's profile near finance (HEURESYS tenant → cross-tenant scope test).
  await pool.query(
    `INSERT INTO sys.sys_user_profile_embeddings (user_id, tenant_id, embedding, derived_from_evidence_count, model_id)
     VALUES ($1,$2,$3::vector,4,'itmatch'),($4,$5,$6::vector,2,'itmatch')
     ON CONFLICT (user_id) DO UPDATE SET embedding=EXCLUDED.embedding, derived_from_evidence_count=EXCLUDED.derived_from_evidence_count`,
    [paoloId, paoloTenant, toVectorLiteral(near(0)), adminUserId, adminTenantId, toVectorLiteral(near(0))]);
});

afterAll(async () => {
  await pool.query(`DELETE FROM sys.sys_esco_occupation_embeddings WHERE esco_uri IN ($1,$2)`, [URI_FIN, URI_COOK]);
  await pool.query(`DELETE FROM sys.sys_user_profile_embeddings WHERE user_id IN ($1,$2)`, [paoloId, adminUserId]);
  await pool.query(`DELETE FROM sys.sys_skill_embeddings WHERE skill_id IN ($1,$2,$3)`, [skillA, skillB, skillC]);
  await suite.app.close();
});

describe("semantic-matching API", () => {
  it("GET /me/occupations — seeded profile ranks finance above cooking", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/matching/me/occupations?limit=10", headers: { cookie: ch(manager.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { escoUri: string; score: number }[]; evidenceCount: number };
    const fin = body.items.find((x) => x.escoUri === URI_FIN);
    const cook = body.items.find((x) => x.escoUri === URI_COOK);
    expect(fin).toBeDefined();
    expect(cook).toBeDefined();
    expect(fin!.score).toBeGreaterThan(cook!.score);
    expect(body.evidenceCount).toBe(4);
  });

  it("GET /me/occupations — user without a profile gets an honest empty-state", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/matching/me/occupations", headers: { cookie: ch(menteeNoProfile.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; evidenceCount: number };
    expect(body.items).toHaveLength(0);
    expect(body.evidenceCount).toBe(0);
  });

  it("GET /users/:id/occupations — TENANT_ADMIN blocked cross-tenant (404, no enumeration)", async () => {
    // federica (RTL TENANT_ADMIN) querying the HEURESYS admin user → 404.
    const r = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${adminUserId}/occupations`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(r.statusCode).toBe(404);
  });

  it("GET /users/:id/occupations — TENANT_ADMIN sees an in-tenant user's matches", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${paoloId}/occupations`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { evidenceCount: number }).evidenceCount).toBe(4);
  });

  it("unauthenticated request → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/matching/me/occupations" });
    expect(r.statusCode).toBe(401);
  });

  it("GET /skills/:id/similar — RTL user is NOT shown a non-visible (NULL-tenant) skill (I5)", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/matching/skills/${skillA}/similar?limit=20`, headers: { cookie: ch(manager.cookies) } });
    expect(r.statusCode).toBe(200);
    const ids = (r.json() as { items: { skillId: string }[] }).items.map((x) => x.skillId);
    expect(ids).toContain(skillB);      // RTL-owned → visible
    expect(ids).not.toContain(skillC);  // NULL-tenant non-global → hidden cross-tenant
    expect(ids).not.toContain(skillA);  // self excluded
  });

  it("GET /skills/:id/similar — PLATFORM_ADMIN sees across tenants (incl. the NULL-tenant skill)", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/matching/skills/${skillA}/similar?limit=20`, headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const ids = (r.json() as { items: { skillId: string }[] }).items.map((x) => x.skillId);
    expect(ids).toContain(skillB);
    expect(ids).toContain(skillC);
  });
});
