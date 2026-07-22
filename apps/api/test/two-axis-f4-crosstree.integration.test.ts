/**
 * apps/api/test/two-axis-f4-crosstree.integration.test.ts
 *
 * #24 ADR-0027 — the CROSS-TREE half of the F5 matrix (deferred to F4) + the
 * 000201 TEAM_LEADER grant, both proven end-to-end on real RTL relationships.
 *
 * The cross-tree case is the reason the model has two axes: paolo.caputo leads
 * teams whose members are NOT in his transitive org sub-tree. For every such
 * member the matrix demands BOTH halves at the HTTP surface:
 *   - ACTIVITY (approvals): visible to the leader (functional axis) ✅
 *   - SENSITIVE (goals = EVALUATION): denied to the leader (org axis) ❌
 *
 * 000201: TEAM_LEADER now holds `approval:read` — a pure functional leader
 * (marco.rinaldi: TEAM_LEADER+TEAM_MEMBER+USER, no MANAGER/PROCESS_OWNER) can
 * monitor the operational queue of HIS scope and nothing else.
 *
 * Every subject is DERIVED live from the DB (no hardcoded cross-tree emails):
 * the suite recomputes "in functional scope AND NOT in org sub-tree" at run
 * time, exactly like lib/scope does. Fixtures roll back with the file tx (D-52).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { functionalScopeUserIds, isInFunctionalScope } from "../src/lib/scope/functional.js";
import { isInOrgSubtree, orgSubtreeUserIds } from "../src/lib/scope/org.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const TAG = `F4XT-${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; userId: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

let suite: TestApp;
let paolo: S;
let marco: S; // pure TEAM_LEADER (000201 audience)
let rtlTenantId: string;
let crossTreeId: string; // derived: in paolo's functional scope, NOT in his org sub-tree

async function login(email: string): Promise<S> {
  const r = await loginRaw(suite.app, email, TEST_PERSONA_PASSWORD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, userId: (r.json() as { user: { userId: string } }).user.userId };
}

async function seedRequest(title: string, createdBy: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_approval_requests
       (approval_request_tenant_id, approval_request_title, approval_request_decision_policy,
        approval_request_priority, created_by)
     VALUES ($1, $2, 'ALL_OF', 'MEDIUM', $3)
     RETURNING approval_request_id AS id`,
    [rtlTenantId, title, createdBy],
  );
  return r.rows[0]!.id;
}

async function listTitles(s: S): Promise<string[]> {
  const r = await suite.app.inject({
    method: "GET", url: "/v1/approvals?limit=200", headers: { cookie: ch(s.cookies) },
  });
  expect(r.statusCode).toBe(200);
  return (r.json() as { items: { title: string }[] }).items.map((i) => i.title);
}

describe("ADR-0027 F4/F5 — cross-tree matrix + TEAM_LEADER operational queue (000201)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    paolo = await login("paolo.caputo@rtl-bank.org");
    marco = await login("marco.rinaldi@rtl-bank.org");
    const t = await pool.query<{ user_tenant_id: string }>(
      `SELECT user_tenant_id FROM sys.sys_users WHERE user_email = 'paolo.caputo@rtl-bank.org'`,
    );
    rtlTenantId = t.rows[0]!.user_tenant_id;

    // Derive a cross-tree subject the same way lib/scope defines the axes.
    const functional = await functionalScopeUserIds(pool, paolo.userId);
    const subtree = new Set(await orgSubtreeUserIds(pool, paolo.userId));
    const cross = functional.filter((u) => u !== paolo.userId && !subtree.has(u));
    // The RTL org measured 34 such users when F4 shipped; the suite only needs one,
    // but an empty set would make every assertion vacuous — fail loudly instead.
    expect(cross.length, "nessun utente cross-tree nello scope funzionale di paolo — dataset RTL cambiato?").toBeGreaterThan(0);
    crossTreeId = cross[0]!;
  }, 60_000);

  afterAll(async () => {
    await suite.app.close();
  });

  it("the derived subject really is cross-tree (functional yes, org no)", async () => {
    expect(await isInFunctionalScope(pool, paolo.userId, crossTreeId)).toBe(true);
    expect(await isInOrgSubtree(pool, paolo.userId, crossTreeId)).toBe(false);
  });

  it("ACTIVITY half — the leader SEES the cross-tree member's approval request", async () => {
    await seedRequest(`${TAG} cross-tree-activity`, crossTreeId);
    expect(await listTitles(paolo)).toContain(`${TAG} cross-tree-activity`);
  });

  it("SENSITIVE half — the same member's goals (EVALUATION) are INVISIBLE to the leader", async () => {
    // Seed a real goal for the cross-tree member (rolled back with the file tx).
    const g = await pool.query<{ goal_id: string }>(
      `INSERT INTO sys.sys_goals
         (goal_tenant_id, goal_natural_key, goal_subject_user_id, goal_title,
          goal_type, goal_priority, goal_status, goal_metadata)
       VALUES ($1, $2, $3, $4, 'OBJECTIVE', 'HIGH', 'IN_PROGRESS', '{}'::jsonb)
       RETURNING goal_id`,
      [rtlTenantId, `${TAG}::sensitive`, crossTreeId, `${TAG} sensitive-goal`],
    );
    const goalId = g.rows[0]!.goal_id;

    // List: the org allow-list filters the subject out — functional membership
    // must never unlock EVALUATION data (I18/I20, cardinal rule).
    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/goals?subjectUserId=${crossTreeId}&limit=200`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const titles = (list.json() as { items: { title: string }[] }).items.map((i) => i.title);
    expect(titles).not.toContain(`${TAG} sensitive-goal`);

    // By id: 404 (not 403) — no existence leak across the boundary.
    const byId = await suite.app.inject({
      method: "GET", url: `/v1/goals/${goalId}`, headers: { cookie: ch(paolo.cookies) },
    });
    expect(byId.statusCode).toBe(404);
  });

  it("000201 matrix — TEAM_LEADER holds approval:read (derived from the live grant table)", async () => {
    const r = await pool.query<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM sys.sys_auth_role_permissions rp
         JOIN sys.sys_auth_roles ro ON ro.auth_role_id = rp.auth_role_id
         JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
        WHERE ro.auth_role_code = 'TEAM_LEADER' AND p.auth_permission_code = 'approval:read'
       ) AS ok`,
    );
    expect(r.rows[0]!.ok).toBe(true);
  });

  it("000201 behaviour — a PURE team leader monitors HIS functional queue and nothing else", async () => {
    // marco.rinaldi is TEAM_LEADER+TEAM_MEMBER+USER only: before 000201 this
    // endpoint was a plain 403 for him. Now: 200, functional scope only.
    const marcoScope = new Set(await functionalScopeUserIds(pool, marco.userId));
    const inScope = [...marcoScope].find((u) => u !== marco.userId);
    expect(inScope, "marco non guida nessun team con membri — dataset RTL cambiato?").toBeDefined();
    // paolo is NOT in marco's functional scope (disjoint teams) — derived, then asserted.
    expect(marcoScope.has(paolo.userId)).toBe(false);

    await seedRequest(`${TAG} marco-in-scope`, inScope!);
    await seedRequest(`${TAG} marco-out-of-scope`, paolo.userId);

    const titles = await listTitles(marco);
    expect(titles).toContain(`${TAG} marco-in-scope`);
    expect(titles).not.toContain(`${TAG} marco-out-of-scope`);
  });
});
