import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";
import { toVectorLiteral } from "../src/modules/semantic-matching/repository.js";

// AI ② P1 — semantic-matching API (/v1/matching/*). Real login + live DB (SSH tunnel).
// DATA-CONTENT assertions run on THROWAWAY entities (users/occupations/skills created here and
// deleted in afterAll, cascading their embeddings) so the suite is robust whether the embedding
// tables are EMPTY (normal CI) or POPULATED (after an operator backfill). Persona logins are used
// only for auth/scope status assertions, never for content that a backfill would change.

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
const SYNTH = ["it.match.uhas@test.invalid", "it.match.unone@test.invalid", "it.match.uother@test.invalid"];

let suite: TestApp;
let admin: S;        // admin@heuresys.com (PLATFORM_ADMIN) — sees all
let tenantAdmin: S;  // federica (RTL TENANT_ADMIN) — elevated, RTL scope
let manager: S;      // paolo.caputo (RTL MANAGER) — elevated
let plainUser: S;    // antonio.parisi (RTL TEAM_MEMBER+USER) — self-only
let antonioId: string;
let uHas: string, uNone: string, uOther: string;   // throwaway users
let skillA: string, skillB: string, skillC: string; // throwaway skills: A=input(RTL), B=RTL-visible, C=NULL-tenant(hidden)
let jrNear: string;                                  // throwaway job_role w/ embedding @ dim0 (near uHas)
let posRtl: string, posHeu: string;                  // throwaway positions: RTL (visible) + Heuresys (cross-tenant)
const POS_CODES = ["IT_MATCH_POS_RTL", "IT_MATCH_POS_HEU"];
const JR_CODE = "IT_MATCH_JR_NEAR";

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  manager = await login(suite, "paolo.caputo@rtl-bank.org");
  plainUser = await login(suite, "antonio.parisi@rtl-bank.org");

  const ids = await pool.query<{ user_id: string; user_tenant_id: string; user_email: string }>(
    `SELECT user_id, user_tenant_id, user_email FROM sys.sys_users
     WHERE user_email IN ('paolo.caputo@rtl-bank.org','antonio.parisi@rtl-bank.org','admin@heuresys.com')`);
  const by = (e: string) => ids.rows.find((r) => r.user_email === e)!;
  antonioId = by("antonio.parisi@rtl-bank.org").user_id;
  const rtlTenant = by("paolo.caputo@rtl-bank.org").user_tenant_id;
  const heuTenant = by("admin@heuresys.com").user_tenant_id;

  // Defensive pre-clean (in case a prior run crashed before afterAll).
  await pool.query(`DELETE FROM sys.sys_users WHERE user_email = ANY($1)`, [SYNTH]);
  await pool.query(`DELETE FROM sys.sys_skills WHERE skill_code IN ('IT_MATCH_A','IT_MATCH_B','IT_MATCH_C')`);
  await pool.query(`DELETE FROM sys.sys_esco_occupation_embeddings WHERE esco_uri IN ($1,$2)`, [URI_FIN, URI_COOK]);
  await pool.query(`DELETE FROM sys.sys_positions WHERE position_code = ANY($1)`, [POS_CODES]);
  await pool.query(`DELETE FROM sys.sys_job_roles WHERE job_role_code = $1`, [JR_CODE]); // cascades its embedding

  // Throwaway users (no auth identity → cannot log in; pure /users/:id query targets).
  const mkUser = async (email: string, tenant: string): Promise<string> => {
    const r = await pool.query<{ user_id: string }>(
      `INSERT INTO sys.sys_users (user_tenant_id, user_email, user_display_name)
       VALUES ($1, $2, $2) RETURNING user_id`, [tenant, email]);
    return r.rows[0]!.user_id;
  };
  uHas = await mkUser(SYNTH[0]!, rtlTenant);
  uNone = await mkUser(SYNTH[1]!, rtlTenant);
  uOther = await mkUser(SYNTH[2]!, heuTenant);

  // Throwaway skills (A,B RTL-owned; C NULL-tenant → hidden to an RTL actor).
  const mkSkill = async (code: string, tenant: string | null): Promise<string> => {
    const r = await pool.query<{ skill_id: string }>(
      `INSERT INTO sys.sys_skills (skill_code, skill_name, skill_tenant_id, skill_is_global)
       VALUES ($1, $1, $2, false) RETURNING skill_id`, [code, tenant]);
    return r.rows[0]!.skill_id;
  };
  skillA = await mkSkill("IT_MATCH_A", rtlTenant);
  skillB = await mkSkill("IT_MATCH_B", rtlTenant);
  skillC = await mkSkill("IT_MATCH_C", null);

  // Embeddings: 2 occupations (finance @ dim0, cooking @ dim10); uHas profile near finance; 3 skills @ dim0.
  await pool.query(
    `INSERT INTO sys.sys_esco_occupation_embeddings (esco_uri, embedding, label_text, model_id)
     VALUES ($1,$2::vector,'Finance specialist','itmatch'),($3,$4::vector,'Cook','itmatch')`,
    [URI_FIN, toVectorLiteral(unit(0)), URI_COOK, toVectorLiteral(unit(10))]);
  await pool.query(
    `INSERT INTO sys.sys_user_profile_embeddings (user_id, tenant_id, embedding, derived_from_evidence_count, model_id)
     VALUES ($1,$2,$3::vector,4,'itmatch')`,
    [uHas, rtlTenant, toVectorLiteral(near(0))]);
  await pool.query(
    `INSERT INTO sys.sys_skill_embeddings (skill_id, embedding, model_id)
     VALUES ($1,$4::vector,'itmatch'),($2,$4::vector,'itmatch'),($3,$4::vector,'itmatch')`,
    [skillA, skillB, skillC, toVectorLiteral(unit(0))]);

  // ── AI ②·Fase 3: throwaway job_role @ dim0 (near uHas profile) + its embedding, then two
  // positions pointing to it — one RTL (in-tenant), one Heuresys (cross-tenant). Positions are
  // not embedded; they inherit the role's match score via position_job_role_id (option C).
  const jr = await pool.query<{ job_role_id: string }>(
    `INSERT INTO sys.sys_job_roles (job_role_code, job_role_name) VALUES ($1,$1) RETURNING job_role_id`, [JR_CODE]);
  jrNear = jr.rows[0]!.job_role_id;
  await pool.query(
    `INSERT INTO sys.sys_job_role_embeddings (job_role_id, embedding, model_id)
     VALUES ($1,$2::vector,'itmatch')`, [jrNear, toVectorLiteral(unit(0))]); // unit(0) vs near(0) ≈ 0.999
  const mkPos = async (code: string, tenant: string): Promise<string> => {
    const r = await pool.query<{ position_id: string }>(
      `INSERT INTO sys.sys_positions (position_tenant_id, position_code, position_title, position_job_role_id)
       VALUES ($1,$2,$2,$3) RETURNING position_id`, [tenant, code, jrNear]);
    return r.rows[0]!.position_id;
  };
  posRtl = await mkPos(POS_CODES[0]!, rtlTenant);
  posHeu = await mkPos(POS_CODES[1]!, heuTenant);
});

afterAll(async () => {
  await pool.query(`DELETE FROM sys.sys_esco_occupation_embeddings WHERE esco_uri IN ($1,$2)`, [URI_FIN, URI_COOK]);
  await pool.query(`DELETE FROM sys.sys_skills WHERE skill_id IN ($1,$2,$3)`, [skillA, skillB, skillC]);    // cascades skill embeddings
  await pool.query(`DELETE FROM sys.sys_positions WHERE position_id IN ($1,$2)`, [posRtl, posHeu]);
  await pool.query(`DELETE FROM sys.sys_job_roles WHERE job_role_id = $1`, [jrNear]);                        // cascades job_role embedding
  await pool.query(`DELETE FROM sys.sys_users WHERE user_id IN ($1,$2,$3)`, [uHas, uNone, uOther]);          // cascades profile embeddings
  await suite.app.close();
});

describe("semantic-matching API", () => {
  // ── kNN content (throwaway entities; robust to a populated table) ──
  it("ranks the most-similar occupation first for a user's profile", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${uHas}/occupations?limit=10`, headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { escoUri: string; score: number }[]; evidenceCount: number };
    expect(body.items[0]?.escoUri).toBe(URI_FIN); // unit(0) vs near(0) ≈ 0.999 → always rank 1
    expect(body.items[0]!.score).toBeGreaterThan(0.9);
    expect(body.evidenceCount).toBe(4);
  });

  it("returns an honest empty-state for a user with no profile", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${uNone}/occupations`, headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; evidenceCount: number };
    expect(body.items).toHaveLength(0);
    expect(body.evidenceCount).toBe(0);
  });

  // ── scope (status only) ──
  it("TENANT_ADMIN sees an in-tenant user but is blocked cross-tenant (404, no enumeration)", async () => {
    const inT = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${uHas}/occupations`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(inT.statusCode).toBe(200);
    const xT = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${uOther}/occupations`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(xT.statusCode).toBe(404);
  });

  it("a plain USER may only target itself (peer → 404, self → 200) [option b]", async () => {
    const peer = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${uHas}/occupations`, headers: { cookie: ch(plainUser.cookies) } });
    expect(peer.statusCode).toBe(404);
    const self = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${antonioId}/occupations`, headers: { cookie: ch(plainUser.cookies) } });
    expect(self.statusCode).toBe(200);
  });

  it("GET /me/occupations — wired + authed, returns the response shape", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/matching/me/occupations", headers: { cookie: ch(manager.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number; evidenceCount: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.evidenceCount).toBe("number");
  });

  it("unauthenticated request → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/matching/me/occupations" });
    expect(r.statusCode).toBe(401);
  });

  // ── skill-similar tenant isolation (I5) ──
  it("GET /skills/:id/similar — RTL user is NOT shown a non-visible (NULL-tenant) skill (I5)", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/matching/skills/${skillA}/similar?limit=20`, headers: { cookie: ch(manager.cookies) } });
    expect(r.statusCode).toBe(200);
    const ids = (r.json() as { items: { skillId: string }[] }).items.map((x) => x.skillId);
    expect(ids).toContain(skillB);      // RTL-owned → visible (cosine 1.0 → present even among real skills)
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

  // ── person → positions (AI ②·Fase 3, "option C"): role-match score via position_job_role_id ──
  it("ranks the near-role position first for a user's profile + carries the role score", async () => {
    // Query as the RTL manager → only the RTL throwaway position is visible among our synthetic
    // ones (the Heuresys one is cross-tenant). unit(0) role vs near(0) profile ≈ 0.999, far above
    // any real position's score (max ≈0.62 observed), so it always ranks first.
    const r = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${uHas}/positions?limit=50`, headers: { cookie: ch(manager.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { positionId: string; positionCode: string; jobRoleId: string | null; score: number }[]; evidenceCount: number };
    expect(body.items[0]?.positionCode).toBe("IT_MATCH_POS_RTL");
    expect(body.items[0]!.score).toBeGreaterThan(0.9);
    expect(body.items[0]!.jobRoleId).toBe(jrNear);
    expect(body.evidenceCount).toBe(4);
  });

  it("returns an honest empty-state (positions) for a user with no profile", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${uNone}/positions`, headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; evidenceCount: number };
    expect(body.items).toHaveLength(0);
    expect(body.evidenceCount).toBe(0);
  });

  it("positions are tenant-scoped (I5): a manager sees the in-tenant position but NOT the cross-tenant one", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${uHas}/positions?limit=50`, headers: { cookie: ch(manager.cookies) } });
    expect(r.statusCode).toBe(200);
    const codes = (r.json() as { items: { positionCode: string }[] }).items.map((x) => x.positionCode);
    expect(codes).toContain("IT_MATCH_POS_RTL");      // RTL-owned → visible to the RTL manager
    expect(codes).not.toContain("IT_MATCH_POS_HEU");  // Heuresys-owned → hidden cross-tenant
  });

  it("PLATFORM_ADMIN sees positions across tenants (both throwaway positions)", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${uHas}/positions?limit=50`, headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const codes = (r.json() as { items: { positionCode: string }[] }).items.map((x) => x.positionCode);
    expect(codes).toContain("IT_MATCH_POS_RTL");
    expect(codes).toContain("IT_MATCH_POS_HEU");
  });

  it("TENANT_ADMIN positions: in-tenant 200, cross-tenant user 404 (no enumeration)", async () => {
    const inT = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${uHas}/positions`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(inT.statusCode).toBe(200);
    const xT = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${uOther}/positions`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(xT.statusCode).toBe(404);
  });

  it("a plain USER may only target its own positions (peer → 404, self → 200) [option b]", async () => {
    const peer = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${uHas}/positions`, headers: { cookie: ch(plainUser.cookies) } });
    expect(peer.statusCode).toBe(404);
    const self = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${antonioId}/positions`, headers: { cookie: ch(plainUser.cookies) } });
    expect(self.statusCode).toBe(200);
  });

  it("GET /me/positions — wired + authed, returns the response shape", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/matching/me/positions", headers: { cookie: ch(manager.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number; evidenceCount: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.evidenceCount).toBe("number");
  });

  it("unauthenticated request to /me/positions → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/matching/me/positions" });
    expect(r.statusCode).toBe(401);
  });
});
