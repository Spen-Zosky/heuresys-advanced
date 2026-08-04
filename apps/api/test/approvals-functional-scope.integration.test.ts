/**
 * apps/api/test/approvals-functional-scope.integration.test.ts
 *
 * #24 ADR-0027 **F4 part B** — `approval` is ACTIVITY-class, so the approvals READ surface is
 * gated by the FUNCTIONAL axis (teams/processes I lead), not by the org chart and no longer by
 * the tenant alone.
 *
 * Before F4 the list was tenant-wide: any holder of `approval:read` (BLUEPRINT_MANAGER,
 * HRMS_MANAGER, MANAGER, PROCESS_OWNER, …) saw EVERY approval request in the tenant, including
 * those of people they have nothing to do with. This suite pins the narrowed contract:
 *
 *   - a leader sees requests raised by the members of the teams they lead;
 *   - a leader does NOT see requests raised outside that scope;
 *   - EXCEPT when they are an approver on it — an item awaiting your own decision must never
 *     be hidden from you, whoever raised it. That is the one rule that keeps the narrowing
 *     from breaking the inbox, and it is asserted explicitly below;
 *   - HR-mandated roles (TENANT_ADMIN) keep the tenant-wide view.
 *
 * Enzo 2026-07-19: only approvals + team/process membership moved to the functional axis.
 * goal/okr/kpi stay EVALUATION (organizational axis) — moving them would have let a leader read
 * the performance records of the 34 RTL users who are in their functional scope but outside
 * their org sub-tree, reopening D-50 from the other side.
 *
 * Requests are inserted as fixtures (tommaso/antonio are plain USERs and hold no
 * `approval:create`), rolled back by the file transaction (D-52).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { idDi, unMembroDiSquadra, unFuoriSquadra } from "./helpers/org-actors.js";

const PWD = TEST_PERSONA_PASSWORD;
const TAG = `FXSCOPE-${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; userId: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, userId: (r.json() as { user: { userId: string } }).user.userId };
}

let suite: TestApp;
let paolo: S; // MANAGER + lead of DIV-COMM → functional scope
let federica: S; // TENANT_ADMIN → HR mandate
let tommasoId: string; // member of paolo's team → inside the functional scope
let antonioId: string; // member of another team → outside it
let rtlTenantId: string;

/** Insert a PENDING request authored by `createdBy`, optionally with an approver step. */
async function seedRequest(title: string, createdBy: string, approverUserId?: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_approval_requests
       (approval_request_tenant_id, approval_request_title, approval_request_decision_policy,
        approval_request_priority, created_by)
     VALUES ($1, $2, 'ALL_OF', 'MEDIUM', $3)
     RETURNING approval_request_id AS id`,
    [rtlTenantId, title, createdBy],
  );
  const id = r.rows[0]!.id;
  if (approverUserId) {
    await pool.query(
      `INSERT INTO sys.sys_approval_steps
         (approval_step_request_id, approval_step_tenant_id, approval_step_approver_user_id, approval_step_ordinal)
       VALUES ($1, $2, $3, 1)`,
      [id, rtlTenantId, approverUserId],
    );
  }
  return id;
}

async function listTitles(s: S): Promise<string[]> {
  const r = await suite.app.inject({
    method: "GET", url: "/v1/approvals?limit=200", headers: { cookie: ch(s.cookies) },
  });
  expect(r.statusCode).toBe(200);
  return (r.json() as { items: { title: string }[] }).items.map((i) => i.title);
}

describe("ADR-0027 F4 — approvals are gated by the FUNCTIONAL axis", () => {
  let inScope: string; // raised by tommaso (paolo's team member)
  let outOfScope: string; // raised by antonio (outside)
  let outOfScopeButMine: string; // raised by antonio, but paolo must approve it

  beforeAll(async () => {
    suite = await buildTestApp();
    paolo = await login(suite, "paolo.caputo@rtl-bank.org");
    federica = await login(suite, "federica.marchetti@rtl-bank.org");
    // [S1043] Sottoposto ed estraneo derivati dall'albero delle UNITA': la
    // ricostruzione dell'organigramma ha invertito i ruoli dei due indirizzi che
    // stavano qui. Vedi helpers/org-actors.ts.
    // ASSE FUNZIONALE, non organizzativo: qui «dentro» e «fuori» si misurano
    // sull'appartenenza a una SQUADRA guidata da paolo. Al primo tentativo avevo
    // usato l'asse gerarchico e il test falliva per la ragione sbagliata.
    const paoloOrg = await idDi(pool, "paolo.caputo@rtl-bank.org");
    const sottoposto = await unMembroDiSquadra(pool, paoloOrg);
    const estraneo = await unFuoriSquadra(pool, paoloOrg);
    tommasoId = sottoposto.userId;
    antonioId = estraneo.userId;
    const tt = await pool.query<{ user_tenant_id: string }>(
      `SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`, [tommasoId]);
    rtlTenantId = tt.rows[0]!.user_tenant_id;

    inScope = await seedRequest(`${TAG} in-scope`, tommasoId);
    outOfScope = await seedRequest(`${TAG} out-of-scope`, antonioId);
    outOfScopeButMine = await seedRequest(`${TAG} out-of-scope-but-mine`, antonioId, paolo.userId);
  }, 60_000);

  afterAll(async () => {
    await suite.app.close();
  });

  it("a leader sees requests raised inside their functional scope", async () => {
    expect(await listTitles(paolo)).toContain(`${TAG} in-scope`);
  });

  it("a leader does NOT see requests raised outside it (was tenant-wide before F4)", async () => {
    expect(await listTitles(paolo)).not.toContain(`${TAG} out-of-scope`);
  });

  it("…but an item awaiting THEIR decision is always visible, whoever raised it", async () => {
    expect(await listTitles(paolo)).toContain(`${TAG} out-of-scope-but-mine`);
  });

  it("an out-of-scope request cannot be fetched by id either (404, no existence leak)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/approvals/${outOfScope}`, headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(404);

    // …while the two visible ones do resolve, so the 404 above is the gate and not a broken id.
    for (const id of [inScope, outOfScopeButMine]) {
      const ok = await suite.app.inject({
        method: "GET", url: `/v1/approvals/${id}`, headers: { cookie: ch(paolo.cookies) },
      });
      expect(ok.statusCode).toBe(200);
    }
  });

  it("an HR-mandated role keeps the tenant-wide view", async () => {
    const titles = await listTitles(federica);
    expect(titles).toEqual(
      expect.arrayContaining([`${TAG} in-scope`, `${TAG} out-of-scope`, `${TAG} out-of-scope-but-mine`]),
    );
  });
});
