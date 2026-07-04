import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

// 3.3 slice-D — generic approval runtime (/v1/approvals/*). Real login + live DB.
// Writes = approval:create (admin/TENANT_ADMIN/HRMS/PROCESS_OWNER/MANAGER) +
// approval:decide (broad). Reads = approval:read (6 HRMS roles). A request belongs to
// ONE tenant derived from its approvers (I5). Decision is doubly gated: the perm +
// the data-layer "own step only" check. Tests pin to real RTL_BANK personas; writes
// touch the RTL test tenant only (NEVER HEURESYS). afterAll purges every TEST- row.

const PWD = TEST_PERSONA_PASSWORD;
const RTL = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0";
const TITLE_PREFIX = "TEST-APPROVAL";

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
function jhdr(s: S) { return { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" }; }
// CSRF + cookie WITHOUT content-type — for state-changing POSTs that carry no body
// (an application/json content-type with an empty body is a 400 in Fastify).
function chdr(s: S) { return { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken }; }

interface ReqRow { approvalRequestId: string; status: string; tenantId: string }
interface StepDetail { approvalStepId: string; approverUserId: string; status: string; approverEmail: string | null }
interface Detail extends ReqRow { steps: StepDetail[]; createdByEmail: string | null }

let suite: TestApp;
let admin: S, federica: S, paolo: S, tommaso: S;
let federicaId: string, paoloId: string, adminId: string;
let heuTenant: string;
let crossTenantReqId: string, crossTenantStepId: string;

async function createReq(
  s: S,
  approverUserIds: string[],
  opts: { policy?: "ALL_OF" | "ANY_OF"; title?: string } = {},
): Promise<ReqRow> {
  const r = await suite.app.inject({
    method: "POST", url: "/v1/approvals", headers: jhdr(s),
    payload: { title: opts.title ?? `${TITLE_PREFIX} ${opts.policy ?? "ALL_OF"}`, decisionPolicy: opts.policy, approverUserIds },
  });
  if (r.statusCode !== 200) throw new Error(`createReq: ${r.statusCode} ${r.body}`);
  return r.json() as ReqRow;
}
async function getDetail(s: S, id: string): Promise<Detail> {
  const r = await suite.app.inject({ method: "GET", url: `/v1/approvals/${id}`, headers: { cookie: ch(s.cookies) } });
  if (r.statusCode !== 200) throw new Error(`getDetail: ${r.statusCode} ${r.body}`);
  return r.json() as Detail;
}
function decide(s: S, reqId: string, stepId: string, decision: "APPROVE" | "REJECT") {
  return suite.app.inject({
    method: "POST", url: `/v1/approvals/${reqId}/steps/${stepId}/decide`, headers: jhdr(s), payload: { decision },
  });
}
const stepOf = (d: Detail, userId: string) => d.steps.find((s) => s.approverUserId === userId)!;

// slice-2: create an ordered multi-level chain.
async function createChain(
  s: S,
  levels: { approverUserIds: string[]; policy?: "ALL_OF" | "ANY_OF" }[],
  title?: string,
): Promise<ReqRow> {
  const r = await suite.app.inject({
    method: "POST", url: "/v1/approvals", headers: jhdr(s),
    payload: { title: title ?? `${TITLE_PREFIX} chain`, levels },
  });
  if (r.statusCode !== 200) throw new Error(`createChain: ${r.statusCode} ${r.body}`);
  return r.json() as ReqRow;
}
async function inboxCount(stepId: string): Promise<number> {
  const r = await pool.query<{ c: string }>(
    `SELECT count(*) AS c FROM sys.sys_inbox_notifications
      WHERE notification_resource_id = $1 AND notification_resource_type = 'APPROVAL_STEP'`,
    [stepId],
  );
  return Number(r.rows[0]!.c);
}

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  federica = await login(suite, "federica.marchetti@rtl-bank.org");
  paolo = await login(suite, "paolo.caputo@rtl-bank.org");
  tommaso = await login(suite, "tommaso.fiore@rtl-bank.org");

  const ids = await pool.query<{ user_id: string; user_email: string }>(
    `SELECT user_id, user_email FROM sys.sys_users WHERE user_email = ANY($1)`,
    [["federica.marchetti@rtl-bank.org", "paolo.caputo@rtl-bank.org", "tommaso.fiore@rtl-bank.org", "admin@heuresys.com"]],
  );
  const byEmail = new Map(ids.rows.map((r) => [r.user_email, r.user_id]));
  federicaId = byEmail.get("federica.marchetti@rtl-bank.org")!;
  paoloId = byEmail.get("paolo.caputo@rtl-bank.org")!;
  adminId = byEmail.get("admin@heuresys.com")!;

  // A tenant that is NOT RTL (for the I5 no-leak proof). admin (HEURESYS) belongs to it.
  const heu = await pool.query<{ user_tenant_id: string }>(`SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`, [adminId]);
  heuTenant = heu.rows[0]!.user_tenant_id;

  // Seed ONE cross-tenant (non-RTL) request directly, so an RTL reader proves no-leak.
  const cr = await pool.query<{ approval_request_id: string }>(
    `INSERT INTO sys.sys_approval_requests (approval_request_tenant_id, approval_request_title, created_by)
     VALUES ($1, $2, $3) RETURNING approval_request_id`,
    [heuTenant, `${TITLE_PREFIX} cross-tenant`, adminId],
  );
  crossTenantReqId = cr.rows[0]!.approval_request_id;
  const cs = await pool.query<{ approval_step_id: string }>(
    `INSERT INTO sys.sys_approval_steps (approval_step_request_id, approval_step_tenant_id, approval_step_approver_user_id)
     VALUES ($1, $2, $3) RETURNING approval_step_id`,
    [crossTenantReqId, heuTenant, adminId],
  );
  crossTenantStepId = cs.rows[0]!.approval_step_id;
}, 90_000); // 4 Argon2id logins + cross-tenant seed; absorbs OCI free-tier jitter.

afterAll(async () => {
  await pool.query(`DELETE FROM sys.sys_inbox_notifications WHERE notification_subject LIKE $1`, [`${TITLE_PREFIX}%`]);
  await pool.query(`DELETE FROM sys.sys_approval_requests WHERE approval_request_title LIKE $1`, [`${TITLE_PREFIX}%`]);
  await suite.app.close();
});

describe("generic approval runtime API (3.3 slice-D)", () => {
  it("happy ALL_OF: create → 2 steps + 2 inbox tasks → both approve → APPROVED → apply → APPLIED", async () => {
    const req = await createReq(paolo, [federicaId, paoloId], { policy: "ALL_OF" });
    expect(req.status).toBe("PENDING");
    expect(req.tenantId).toBe(RTL);

    const detail = await getDetail(paolo, req.approvalRequestId);
    expect(detail.steps).toHaveLength(2);
    expect(detail.createdByEmail).toBe("paolo.caputo@rtl-bank.org");
    expect(stepOf(detail, federicaId).approverEmail).toBe("federica.marchetti@rtl-bank.org");

    // Both approvers got an actionable inbox task for THEIR step (the reuse seam).
    const inbox = await pool.query<{ c: string }>(
      `SELECT count(*) AS c FROM sys.sys_inbox_notifications
        WHERE notification_resource_type = 'APPROVAL_STEP' AND notification_type = 'APPROVAL_REQUEST'
          AND notification_resource_id = ANY($1::uuid[])`,
      [detail.steps.map((s) => s.approvalStepId)],
    );
    expect(Number(inbox.rows[0]!.c)).toBe(2);

    expect((await decide(federica, req.approvalRequestId, stepOf(detail, federicaId).approvalStepId, "APPROVE")).statusCode).toBe(200);
    // After 1/2 approvals, request still PENDING.
    expect((await getDetail(paolo, req.approvalRequestId)).status).toBe("PENDING");
    expect((await decide(paolo, req.approvalRequestId, stepOf(detail, paoloId).approvalStepId, "APPROVE")).statusCode).toBe(200);

    const approved = await getDetail(paolo, req.approvalRequestId);
    expect(approved.status).toBe("APPROVED");

    // The approver's inbox task flips to READ once their step is decided.
    const unread = await pool.query<{ c: string }>(
      `SELECT count(*) AS c FROM sys.sys_inbox_notifications
        WHERE notification_resource_id = $1 AND notification_status = 'UNREAD'`,
      [stepOf(detail, federicaId).approvalStepId],
    );
    expect(Number(unread.rows[0]!.c)).toBe(0);

    const applied = await suite.app.inject({ method: "POST", url: `/v1/approvals/${req.approvalRequestId}/apply`, headers: chdr(paolo) });
    expect(applied.statusCode).toBe(200);
    expect((applied.json() as ReqRow).status).toBe("APPLIED");
  });

  it("reject short-circuit: one REJECT → request REJECTED (sibling not required)", async () => {
    const req = await createReq(federica, [federicaId, paoloId], { policy: "ALL_OF" });
    const detail = await getDetail(federica, req.approvalRequestId);
    expect((await decide(federica, req.approvalRequestId, stepOf(detail, federicaId).approvalStepId, "REJECT")).statusCode).toBe(200);
    expect((await getDetail(federica, req.approvalRequestId)).status).toBe("REJECTED");
    // A late decide on the already-resolved request → 409 REQUEST_RESOLVED.
    const late = await decide(paolo, req.approvalRequestId, stepOf(detail, paoloId).approvalStepId, "APPROVE");
    expect(late.statusCode).toBe(409);
    expect((late.json() as { error: { code: string } }).error.code).toBe("REQUEST_RESOLVED");
  });

  it("ANY_OF quorum: one APPROVE → request APPROVED, pending sibling → SKIPPED", async () => {
    const req = await createReq(federica, [federicaId, paoloId], { policy: "ANY_OF" });
    const detail = await getDetail(federica, req.approvalRequestId);
    expect((await decide(federica, req.approvalRequestId, stepOf(detail, federicaId).approvalStepId, "APPROVE")).statusCode).toBe(200);
    const after = await getDetail(federica, req.approvalRequestId);
    expect(after.status).toBe("APPROVED");
    expect(stepOf(after, paoloId).status).toBe("SKIPPED");
  });

  it("I5: an RTL reader cannot see/decide a non-RTL request (404 no-leak); PLATFORM_ADMIN can", async () => {
    expect((await suite.app.inject({ method: "GET", url: `/v1/approvals/${crossTenantReqId}`, headers: { cookie: ch(federica.cookies) } })).statusCode).toBe(404);
    expect((await decide(federica, crossTenantReqId, crossTenantStepId, "APPROVE")).statusCode).toBe(404);
    expect((await suite.app.inject({ method: "GET", url: `/v1/approvals/${crossTenantReqId}`, headers: { cookie: ch(admin.cookies) } })).statusCode).toBe(200);
  });

  it("decide-not-your-step → 403 PERMISSION_DENIED (data-layer authority)", async () => {
    const req = await createReq(federica, [federicaId], { title: `${TITLE_PREFIX} not-your-step` });
    const detail = await getDetail(federica, req.approvalRequestId);
    // paolo HAS approval:decide but the step is federica's.
    const r = await decide(paolo, req.approvalRequestId, stepOf(detail, federicaId).approvalStepId, "APPROVE");
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("PERMISSION_DENIED");
  });

  it("double-decide on the same step → 409 ALREADY_DECIDED", async () => {
    const req = await createReq(federica, [federicaId, paoloId], { policy: "ALL_OF" });
    const detail = await getDetail(federica, req.approvalRequestId);
    const stepId = stepOf(detail, federicaId).approvalStepId;
    expect((await decide(federica, req.approvalRequestId, stepId, "APPROVE")).statusCode).toBe(200);
    const again = await decide(federica, req.approvalRequestId, stepId, "APPROVE");
    expect(again.statusCode).toBe(409);
    expect((again.json() as { error: { code: string } }).error.code).toBe("ALREADY_DECIDED");
  });

  it("RBAC: a plain USER (tommaso) cannot create (403) nor decide (403)", async () => {
    expect((await suite.app.inject({
      method: "POST", url: "/v1/approvals", headers: jhdr(tommaso),
      payload: { title: `${TITLE_PREFIX} denied`, approverUserIds: [federicaId] },
    })).statusCode).toBe(403);
    // tommaso lacks approval:decide → 403 at the RBAC gate (before data-layer).
    const req = await createReq(federica, [federicaId], { title: `${TITLE_PREFIX} rbac` });
    const detail = await getDetail(federica, req.approvalRequestId);
    expect((await decide(tommaso, req.approvalRequestId, stepOf(detail, federicaId).approvalStepId, "APPROVE")).statusCode).toBe(403);
  });

  it("CSRF: create without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/approvals",
      headers: { cookie: ch(federica.cookies), "content-type": "application/json" },
      payload: { title: `${TITLE_PREFIX} csrf`, approverUserIds: [federicaId] },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });

  it("apply a non-APPROVED (PENDING) request → 409 NOT_APPROVED", async () => {
    const req = await createReq(federica, [federicaId], { title: `${TITLE_PREFIX} apply-guard` });
    const r = await suite.app.inject({ method: "POST", url: `/v1/approvals/${req.approvalRequestId}/apply`, headers: chdr(federica) });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_APPROVED");
  });

  it("validation: cross-tenant approver set for a non-platform actor → 403 CROSS_TENANT_APPROVER", async () => {
    // federica (RTL) naming admin (HEURESYS) as approver → approvers not in her tenant.
    const r = await suite.app.inject({
      method: "POST", url: "/v1/approvals", headers: jhdr(federica),
      payload: { title: `${TITLE_PREFIX} xtenant`, approverUserIds: [adminId] },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CROSS_TENANT_APPROVER");
  });
});

describe("approval ordered multi-level chains (3.3 slice-2)", () => {
  it("chain happy: only L1 opens at creation; approve L1 → L2 opens (inbox) → approve L2 → APPROVED", async () => {
    const req = await createChain(
      paolo,
      [{ approverUserIds: [federicaId] }, { approverUserIds: [paoloId] }],
      `${TITLE_PREFIX} chain-happy`,
    );
    expect(req.status).toBe("PENDING");
    const d0 = await getDetail(paolo, req.approvalRequestId);
    expect(d0.steps).toHaveLength(2);
    const fStep = stepOf(d0, federicaId);
    const pStep = stepOf(d0, paoloId);

    // At creation ONLY level 1 (federica) is delivered to the inbox; level 2 (paolo) is not yet open.
    expect(await inboxCount(fStep.approvalStepId)).toBe(1);
    expect(await inboxCount(pStep.approvalStepId)).toBe(0);

    // Approve L1 → request still PENDING, and level 2 just opened (paolo now has an inbox task).
    expect((await decide(federica, req.approvalRequestId, fStep.approvalStepId, "APPROVE")).statusCode).toBe(200);
    expect((await getDetail(paolo, req.approvalRequestId)).status).toBe("PENDING");
    expect(await inboxCount(pStep.approvalStepId)).toBe(1);

    // Approve L2 → terminal APPROVED.
    expect((await decide(paolo, req.approvalRequestId, pStep.approvalStepId, "APPROVE")).statusCode).toBe(200);
    expect((await getDetail(paolo, req.approvalRequestId)).status).toBe("APPROVED");
  });

  it("level-not-active: deciding L2 before L1 resolves → 409 LEVEL_NOT_ACTIVE", async () => {
    const req = await createChain(
      paolo,
      [{ approverUserIds: [federicaId] }, { approverUserIds: [paoloId] }],
      `${TITLE_PREFIX} chain-guard`,
    );
    const d = await getDetail(paolo, req.approvalRequestId);
    const r = await decide(paolo, req.approvalRequestId, stepOf(d, paoloId).approvalStepId, "APPROVE");
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("LEVEL_NOT_ACTIVE");
  });

  it("reject cascade: reject L1 → request REJECTED + the L2 step → SKIPPED (never opened)", async () => {
    const req = await createChain(
      paolo,
      [{ approverUserIds: [federicaId] }, { approverUserIds: [paoloId] }],
      `${TITLE_PREFIX} chain-reject`,
    );
    const d = await getDetail(paolo, req.approvalRequestId);
    expect((await decide(federica, req.approvalRequestId, stepOf(d, federicaId).approvalStepId, "REJECT")).statusCode).toBe(200);
    const after = await getDetail(paolo, req.approvalRequestId);
    expect(after.status).toBe("REJECTED");
    expect(stepOf(after, paoloId).status).toBe("SKIPPED");
  });

  it("validation: the same approver in two levels → 400 (an approver may appear in only one level)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/approvals", headers: jhdr(paolo),
      payload: {
        title: `${TITLE_PREFIX} chain-dup`,
        levels: [{ approverUserIds: [federicaId] }, { approverUserIds: [federicaId] }],
      },
    });
    expect(r.statusCode).toBe(400);
    expect((r.json() as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
  });
});
