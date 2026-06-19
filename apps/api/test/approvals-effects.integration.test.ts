import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";

// 3.3 slice-3a — approval apply-effect wiring (/v1/approvals/:id/apply dispatches a
// registered handler that MUTATES the real subject, atomically with markApplied).
// The first real handler is TENANT_ACTIVATION: it flips the subject tenant
// sys_tenancies.tenant_status PENDING_ACTIVATION → ACTIVE (a real, pre-existing schema
// transition). Real login (admin@heuresys.com, PLATFORM_ADMIN) + live DB. Every write
// touches only throwaway [TEST] FX tenants; afterAll purges all of them. NEVER touches
// the real RTL_BANK / HEURESYS tenants.

const PWD = "Admin#PassW0rd!";
const TITLE_PREFIX = "TEST-APVFX";

interface S { cookies: Map<string, string>; csrfToken: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
const jhdr = (s: S) => ({ cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" });
// CSRF + cookie WITHOUT content-type — for the bodyless apply POST.
const chdr = (s: S) => ({ cookie: ch(s.cookies), "x-csrf-token": s.csrfToken });

interface ReqRow { approvalRequestId: string; status: string; tenantId: string; resourceType: string | null; resourceId: string | null }
interface StepDetail { approvalStepId: string; approverUserId: string; status: string }
interface Detail extends ReqRow { steps: StepDetail[] }

let suite: TestApp;
let admin: S;
let adminId: string;
let fxCounter = 0;

async function createReq(
  s: S,
  approverUserIds: string[],
  opts: { title: string; resourceType?: string; resourceId?: string },
): Promise<ReqRow> {
  const r = await suite.app.inject({
    method: "POST", url: "/v1/approvals", headers: jhdr(s),
    payload: { title: opts.title, approverUserIds, resourceType: opts.resourceType, resourceId: opts.resourceId },
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
function apply(s: S, reqId: string) {
  return suite.app.inject({ method: "POST", url: `/v1/approvals/${reqId}/apply`, headers: chdr(s) });
}
/** Seed a throwaway tenant with a given status; returns its id. Codes are TEST-FX-* (purged). */
async function seedTenant(status: string): Promise<string> {
  fxCounter += 1;
  const code = `TEST-FX-${status}-${fxCounter}`;
  const r = await pool.query<{ tenant_id: string }>(
    `INSERT INTO sys.sys_tenancies (tenant_code, tenant_name, tenant_status)
     VALUES ($1, $2, $3) RETURNING tenant_id`,
    [code, `[TEST] FX ${status} ${fxCounter}`, status],
  );
  return r.rows[0]!.tenant_id;
}
async function tenantStatus(tenantId: string): Promise<string> {
  const r = await pool.query<{ tenant_status: string }>(`SELECT tenant_status FROM sys.sys_tenancies WHERE tenant_id = $1`, [tenantId]);
  return r.rows[0]!.tenant_status;
}

/** Create a single-approver request whose step admin owns, then approve it → APPROVED. */
async function createAndApprove(opts: { title: string; resourceType?: string; resourceId?: string }): Promise<string> {
  const req = await createReq(admin, [adminId], opts);
  expect(req.status).toBe("PENDING");
  const detail = await getDetail(admin, req.approvalRequestId);
  const step = detail.steps.find((s) => s.approverUserId === adminId)!;
  expect((await decide(admin, req.approvalRequestId, step.approvalStepId, "APPROVE")).statusCode).toBe(200);
  expect((await getDetail(admin, req.approvalRequestId)).status).toBe("APPROVED");
  return req.approvalRequestId;
}

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  const ids = await pool.query<{ user_id: string }>(`SELECT user_id FROM sys.sys_users WHERE user_email = $1`, ["admin@heuresys.com"]);
  adminId = ids.rows[0]!.user_id;
  // Clean any leftovers from a crashed prior run (TEST-FX-* codes are deterministic per run → would collide).
  await pool.query(`DELETE FROM sys.sys_approval_requests WHERE approval_request_title LIKE $1`, [`${TITLE_PREFIX}%`]);
  await pool.query(`DELETE FROM sys.sys_tenancies WHERE tenant_code LIKE 'TEST-FX-%'`);
}, 60_000); // Argon2id login + cleanup; absorbs OCI free-tier jitter.

afterAll(async () => {
  await pool.query(`DELETE FROM sys.sys_inbox_notifications WHERE notification_subject LIKE $1`, [`${TITLE_PREFIX}%`]);
  await pool.query(`DELETE FROM sys.sys_approval_requests WHERE approval_request_title LIKE $1`, [`${TITLE_PREFIX}%`]);
  await pool.query(`DELETE FROM sys.sys_tenancies WHERE tenant_code LIKE 'TEST-FX-%'`);
  await suite.app.close();
});

describe("approval apply-effect wiring (3.3 slice-3a)", () => {
  it("TENANT_ACTIVATION: approve + apply flips the subject tenant PENDING_ACTIVATION → ACTIVE (real subject mutated E2E)", async () => {
    const subjectId = await seedTenant("PENDING_ACTIVATION");
    expect(await tenantStatus(subjectId)).toBe("PENDING_ACTIVATION");

    const reqId = await createAndApprove({ title: `${TITLE_PREFIX} activate-happy`, resourceType: "TENANT_ACTIVATION", resourceId: subjectId });

    const applied = await apply(admin, reqId);
    expect(applied.statusCode).toBe(200);
    expect((applied.json() as ReqRow).status).toBe("APPLIED");

    // The effect actually ran: the subject tenant is now ACTIVE.
    expect(await tenantStatus(subjectId)).toBe("ACTIVE");
  });

  it("apply-effect failure (subject not PENDING_ACTIVATION) → 409 APPLY_EFFECT_FAILED and the apply rolls back (stays APPROVED)", async () => {
    // Subject is already ACTIVE → the guarded flip matches 0 rows → handler throws → tx rolls back.
    const subjectId = await seedTenant("ACTIVE");
    const reqId = await createAndApprove({ title: `${TITLE_PREFIX} activate-fail`, resourceType: "TENANT_ACTIVATION", resourceId: subjectId });

    const r = await apply(admin, reqId);
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("APPLY_EFFECT_FAILED");

    // markApplied was rolled back together with the failed effect: request is still APPROVED, not APPLIED.
    expect((await getDetail(admin, reqId)).status).toBe("APPROVED");
    expect(await tenantStatus(subjectId)).toBe("ACTIVE");
  });

  it("backward-compat: an unknown resource_type applies as a pure marker (no handler) → APPLIED, no error", async () => {
    const reqId = await createAndApprove({ title: `${TITLE_PREFIX} unknown-type`, resourceType: "SOME_UNREGISTERED_TYPE" });
    const applied = await apply(admin, reqId);
    expect(applied.statusCode).toBe(200);
    expect((applied.json() as ReqRow).status).toBe("APPLIED");
  });
});
