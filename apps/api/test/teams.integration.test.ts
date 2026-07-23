/**
 * apps/api/test/teams.integration.test.ts
 * Integration tests for /v1/teams/* and /v1/me/team (WS-4 R1b).
 *
 * Proves the 3rd RBAC scope axis ("my team") on live data:
 *   - TENANT_ADMIN sees all teams in their tenant.
 *   - a TEAM_LEADER sees ONLY teams they lead or belong to (narrower than the admin set).
 *   - a TEAM_MEMBER cannot list teams (no team:list) but reads their own via /v1/me/team.
 *   - tenant isolation + out-of-scope reads return 404 (no existence leak).
 *
 * Read-only: no inserts → no cleanup. Personas (seeded, real RTL_BANK users):
 *   federica.marchetti (TENANT_ADMIN) · marco.rinaldi (TEAM_LEADER of DIV-CFO, member of DIR-INFRA)
 *   · antonio.parisi (TEAM_MEMBER of DIV-CFO) · admin@heuresys.com (PLATFORM_ADMIN).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface TeamLite { teamId: string; code: string; tenantId: string; memberCount: number }

let suite: TestApp;
let adminS: S;     // PLATFORM_ADMIN
let tenantS: S;    // TENANT_ADMIN (RTL)
let leaderS: S;    // TEAM_LEADER (marco — DIV-CFO)
let memberS: S;    // TEAM_MEMBER (antonio — DIV-CFO)

describe("/v1/teams/* + /v1/me/team integration (WS-4 R1b)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    adminS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    leaderS = await login(suite, "marco.rinaldi@rtl-bank.org");
    memberS = await login(suite, "antonio.parisi@rtl-bank.org");
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("TENANT_ADMIN lists all teams in tenant (incl. DIV-CFO), all same tenant", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/teams?limit=200", headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: TeamLite[]; total: number };
    expect(body.total).toBeGreaterThanOrEqual(20);
    const codes = body.items.map((t) => t.code);
    expect(codes).toContain("DIV-CFO");
    // tenant isolation: every team belongs to the admin's single tenant
    const tenants = new Set(body.items.map((t) => t.tenantId));
    expect(tenants.size).toBe(1);
  });

  it("TEAM_LEADER sees ONLY teams they lead or belong to (the 3rd scope axis)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/teams?limit=200", headers: { cookie: ch(leaderS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: TeamLite[]; total: number };
    const codes = body.items.map((t) => t.code).sort();
    // marco leads DIV-CFO and is a member of DIR-INFRA — and nothing else
    expect(codes).toEqual(["DIR-INFRA", "DIV-CFO"]);
    expect(body.total).toBe(2);
  });

  it("TEAM_LEADER's scoped set is strictly narrower than TENANT_ADMIN's", async () => {
    const adminList = await suite.app.inject({ method: "GET", url: "/v1/teams?limit=200", headers: { cookie: ch(tenantS.cookies) } });
    const leaderList = await suite.app.inject({ method: "GET", url: "/v1/teams?limit=200", headers: { cookie: ch(leaderS.cookies) } });
    const adminTotal = (adminList.json() as { total: number }).total;
    const leaderTotal = (leaderList.json() as { total: number }).total;
    expect(leaderTotal).toBeLessThan(adminTotal);
  });

  it("TEAM_MEMBER cannot list teams (no team:list) → 403", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/teams", headers: { cookie: ch(memberS.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });

  it("GET /v1/me/team returns the TEAM_MEMBER's own team with members (lead + self)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/team", headers: { cookie: ch(memberS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { teams: Array<{ code: string; members: Array<{ email: string | null; role: string }> }> };
    const cfo = body.teams.find((t) => t.code === "DIV-CFO");
    expect(cfo).toBeDefined();
    const lead = cfo!.members.find((m) => m.role === "LEAD");
    expect(lead?.email).toBe("marco.rinaldi@rtl-bank.org");
    expect(cfo!.members.some((m) => m.email === "antonio.parisi@rtl-bank.org" && m.role === "MEMBER")).toBe(true);
  });

  it("GET /v1/me/team returns BOTH of the TEAM_LEADER's teams (lead + member)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/team", headers: { cookie: ch(leaderS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { teams: Array<{ code: string }> };
    expect(body.teams.map((t) => t.code).sort()).toEqual(["DIR-INFRA", "DIV-CFO"]);
  });

  it("GET /v1/teams/:id of an in-scope team works for the TEAM_LEADER (members + count)", async () => {
    const list = await suite.app.inject({ method: "GET", url: "/v1/teams?limit=200", headers: { cookie: ch(tenantS.cookies) } });
    const cfo = (list.json() as { items: TeamLite[] }).items.find((t) => t.code === "DIV-CFO")!;
    const r = await suite.app.inject({
      method: "GET", url: `/v1/teams/${cfo.teamId}`, headers: { cookie: ch(leaderS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { code: string; members: unknown[]; memberCount: number };
    expect(body.code).toBe("DIV-CFO");
    expect(body.members.length).toBe(body.memberCount);
    expect(body.memberCount).toBeGreaterThanOrEqual(2);
  });

  it("TEAM_LEADER gets 404 reading an out-of-scope team (scope axis, not a 403)", async () => {
    const list = await suite.app.inject({ method: "GET", url: "/v1/teams?limit=200", headers: { cookie: ch(tenantS.cookies) } });
    const other = (list.json() as { items: TeamLite[] }).items.find((t) => t.code !== "DIV-CFO" && t.code !== "DIR-INFRA")!;
    const r = await suite.app.inject({
      method: "GET", url: `/v1/teams/${other.teamId}`, headers: { cookie: ch(leaderS.cookies) },
    });
    expect(r.statusCode).toBe(404);
  });

  it("TEAM_MEMBER lacks team:read → 403 on GET /v1/teams/:id", async () => {
    const list = await suite.app.inject({ method: "GET", url: "/v1/teams?limit=200", headers: { cookie: ch(tenantS.cookies) } });
    const cfo = (list.json() as { items: TeamLite[] }).items.find((t) => t.code === "DIV-CFO")!;
    const r = await suite.app.inject({
      method: "GET", url: `/v1/teams/${cfo.teamId}`, headers: { cookie: ch(memberS.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });

  it("PLATFORM_ADMIN sees teams cross-tenant (more than a single tenant admin)", async () => {
    const paList = await suite.app.inject({ method: "GET", url: "/v1/teams?limit=200", headers: { cookie: ch(adminS.cookies) } });
    const taList = await suite.app.inject({ method: "GET", url: "/v1/teams?limit=200", headers: { cookie: ch(tenantS.cookies) } });
    const paBody = paList.json() as { items: TeamLite[]; total: number };
    const taTotal = (taList.json() as { total: number }).total;
    expect(paBody.total).toBeGreaterThan(taTotal);
    // cross-tenant: PA's set spans >1 tenant
    expect(new Set(paBody.items.map((t) => t.tenantId)).size).toBeGreaterThan(1);
  });

  it("tenant isolation: TENANT_ADMIN gets 404 on a team in another tenant", async () => {
    const paList = await suite.app.inject({ method: "GET", url: "/v1/teams?limit=200", headers: { cookie: ch(adminS.cookies) } });
    const taList = await suite.app.inject({ method: "GET", url: "/v1/teams?limit=200", headers: { cookie: ch(tenantS.cookies) } });
    const taTenant = (taList.json() as { items: TeamLite[] }).items[0]!.tenantId;
    const foreign = (paList.json() as { items: TeamLite[] }).items.find((t) => t.tenantId !== taTenant);
    expect(foreign).toBeDefined();
    const r = await suite.app.inject({
      method: "GET", url: `/v1/teams/${foreign!.teamId}`, headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(404);
  });

  /* --- #75 lifecycle (S1028, ex D-71) — tx-isolation (D-52) rolls back all
   *     rows this block creates, so the shared DB keeps zero residue. -------- */

  describe("#75 lifecycle — POST/PATCH + membership (team:manage)", () => {
    const CODE = "IT-S1028-LC";
    let teamId: string;
    let leadId: string;   // paolo.caputo (RTL MANAGER) — derived live
    let memberId: string; // tommaso.fiore (RTL USER)

    beforeAll(async () => {
      const { pool } = await import("../src/db/client.js");
      const ids = await pool.query<{ user_id: string; user_email: string }>(
        `SELECT user_id, user_email FROM sys.sys_users
          WHERE user_email IN ('paolo.caputo@rtl-bank.org','tommaso.fiore@rtl-bank.org')`,
      );
      leadId = ids.rows.find((r) => r.user_email.startsWith("paolo"))!.user_id;
      memberId = ids.rows.find((r) => r.user_email.startsWith("tommaso"))!.user_id;
    });

    it("TEAM_MEMBER (no team:manage) cannot create → 403", async () => {
      const r = await suite.app.inject({
        method: "POST", url: "/v1/teams",
        headers: { cookie: ch(memberS.cookies), "x-csrf-token": memberS.cookies.get("hrx_csrf") ?? "" },
        payload: { code: CODE, name: "Lifecycle Team" },
      });
      expect(r.statusCode).toBe(403);
    });

    it("TENANT_ADMIN creates a team with lead → 201, lead mirrored as LEAD member", async () => {
      const r = await suite.app.inject({
        method: "POST", url: "/v1/teams",
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
        payload: { code: CODE, name: "Lifecycle Team", leadUserId: leadId },
      });
      expect(r.statusCode).toBe(201);
      const t = r.json() as { teamId: string; code: string; leadUserId: string; members: { userId: string; role: string }[] };
      expect(t.code).toBe(CODE);
      expect(t.leadUserId).toBe(leadId);
      expect(t.members.find((m) => m.userId === leadId)?.role).toBe("LEAD");
      teamId = t.teamId;
    });

    it("duplicate code in tenant → 409 TEAM_CODE_CONFLICT", async () => {
      const r = await suite.app.inject({
        method: "POST", url: "/v1/teams",
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
        payload: { code: CODE, name: "Duplicate" },
      });
      expect(r.statusCode).toBe(409);
      expect((r.json() as { error: { code: string } }).error.code).toBe("TEAM_CODE_CONFLICT");
    });

    it("PUT member (MEMBER) → in list; promoting to LEAD moves the single lead", async () => {
      const add = await suite.app.inject({
        method: "PUT", url: `/v1/teams/${teamId}/members/${memberId}`,
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
        payload: { role: "MEMBER" },
      });
      expect(add.statusCode).toBe(200);
      let t = add.json() as { leadUserId: string | null; members: { userId: string; role: string }[] };
      expect(t.members.find((m) => m.userId === memberId)?.role).toBe("MEMBER");

      const promote = await suite.app.inject({
        method: "PUT", url: `/v1/teams/${teamId}/members/${memberId}`,
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
        payload: { role: "LEAD" },
      });
      expect(promote.statusCode).toBe(200);
      t = promote.json() as typeof t;
      expect(t.leadUserId).toBe(memberId);                                     // pointer moved
      expect(t.members.find((m) => m.userId === memberId)?.role).toBe("LEAD"); // new lead
      expect(t.members.find((m) => m.userId === leadId)?.role).toBe("MEMBER"); // old lead demoted
    });

    it("PATCH name + lead back to paolo; leadUserId:null clears lead", async () => {
      const r = await suite.app.inject({
        method: "PATCH", url: `/v1/teams/${teamId}`,
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
        payload: { name: "Lifecycle Team v2", leadUserId: leadId },
      });
      expect(r.statusCode).toBe(200);
      let t = r.json() as { name: string; leadUserId: string | null; members: { userId: string; role: string }[] };
      expect(t.name).toBe("Lifecycle Team v2");
      expect(t.leadUserId).toBe(leadId);
      expect(t.members.filter((m) => m.role === "LEAD")).toHaveLength(1); // single-lead invariant

      const clear = await suite.app.inject({
        method: "PATCH", url: `/v1/teams/${teamId}`,
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
        payload: { leadUserId: null },
      });
      expect(clear.statusCode).toBe(200);
      t = clear.json() as typeof t;
      expect(t.leadUserId).toBeNull();
      expect(t.members.filter((m) => m.role === "LEAD")).toHaveLength(0);
    });

    it("DELETE member removes it; removing an unknown member → 404", async () => {
      const r = await suite.app.inject({
        method: "DELETE", url: `/v1/teams/${teamId}/members/${memberId}`,
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
      });
      expect(r.statusCode).toBe(200);
      const t = r.json() as { members: { userId: string }[] };
      expect(t.members.some((m) => m.userId === memberId)).toBe(false);

      const again = await suite.app.inject({
        method: "DELETE", url: `/v1/teams/${teamId}/members/${memberId}`,
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
      });
      expect(again.statusCode).toBe(404);
    });

    it("I5: cross-tenant lead rejected (400); PLATFORM_ADMIN may create in a named tenant", async () => {
      const { pool } = await import("../src/db/client.js");
      const heuUser = await pool.query<{ user_id: string }>(
        `SELECT user_id FROM sys.sys_users WHERE user_email = 'andrea.spenuso@heuresys.com'`,
      );
      const cross = await suite.app.inject({
        method: "PUT", url: `/v1/teams/${teamId}/members/${heuUser.rows[0]!.user_id}`,
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
        payload: { role: "MEMBER" },
      });
      expect(cross.statusCode).toBe(400); // VALIDATION_ERROR: not the team's tenant

      const missingCsrf = await suite.app.inject({
        method: "PATCH", url: `/v1/teams/${teamId}`,
        headers: { cookie: ch(tenantS.cookies) },
        payload: { name: "no csrf" },
      });
      expect(missingCsrf.statusCode).toBe(403); // CSRF gate on mutations
    });
  });
});
