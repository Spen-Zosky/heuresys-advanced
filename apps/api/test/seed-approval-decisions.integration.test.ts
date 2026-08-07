/**
 * apps/api/test/seed-approval-decisions.integration.test.ts
 *
 * Integration tests for the seed-approval-decisions module (append-only
 * approval ledger). 3 endpoints:
 *   GET  /v1/seed-approval-decisions        requirePermission('seed_acquisition:read')
 *   GET  /v1/seed-approval-decisions/:id     requirePermission('seed_acquisition:read')
 *   POST /v1/seed-approval-decisions         verifyCsrf + requirePermission('seed_acquisition:approve')
 *
 * Visibility: PLATFORM_ADMIN sees all tenants; non-platform actors are scoped
 * to the tenant of the referenced seed candidate record (the only typed error
 * the service throws is NotFoundError → code "NOT_FOUND").
 *
 * Fixtures (a seed acquisition run + one candidate record) are created directly
 * via the pool in beforeAll because there is no public create endpoint for runs
 * /candidates; they are removed in afterAll. The create-happy-path runs as
 * PLATFORM_ADMIN, which bypasses tenant scoping, so the chosen tenant is
 * irrelevant beyond satisfying the FK.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_SAD_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface DecisionShape {
  seedApprovalDecisionId: string;
  candidateId: string;
  approverUserId: string | null;
  status: string;
  rationale: string | null;
  decidedAt: string;
  createdAt: string;
}

let suite: TestApp;
let platformS: S;
let managerS: S;

let tenantId: string;
let runId: string;
let candidateId: string;
const createdDecisionIds: string[] = [];

describe("/v1/seed-approval-decisions/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "enzo.spenuso@heuresys.com");
    managerS = await login(suite, "paolo.caputo@rtl-bank.org");

    // Pick any existing tenant to satisfy the FK chain (PLATFORM_ADMIN bypasses scoping on create).
    const tr = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM sys.sys_tenancies ORDER BY created_at ASC LIMIT 1`,
    );
    const t = tr.rows[0];
    if (!t) throw new Error("no tenancy available to seed fixtures");
    tenantId = t.tenant_id;

    const runRes = await pool.query<{ seed_acquisition_run_id: string }>(
      `INSERT INTO sys.sys_seed_acquisition_runs
         (seed_acquisition_run_tenant_id, seed_acquisition_run_code, seed_acquisition_run_status)
       VALUES ($1, $2, 'COMPLETED')
       RETURNING seed_acquisition_run_id`,
      [tenantId, `${SUITE_PREFIX}_RUN`],
    );
    const run = runRes.rows[0];
    if (!run) throw new Error("failed to seed acquisition run");
    runId = run.seed_acquisition_run_id;

    const candRes = await pool.query<{ seed_candidate_record_id: string }>(
      `INSERT INTO sys.sys_seed_candidate_records
         (seed_candidate_record_run_id, seed_candidate_record_tenant_id,
          seed_candidate_record_domain, seed_candidate_record_natural_key,
          seed_candidate_record_validation_status)
       VALUES ($1, $2, 'TEST_DOMAIN', $3, 'PASSED')
       RETURNING seed_candidate_record_id`,
      [runId, tenantId, `${SUITE_PREFIX}_CAND`],
    );
    const cand = candRes.rows[0];
    if (!cand) throw new Error("failed to seed candidate record");
    candidateId = cand.seed_candidate_record_id;
  });

  afterAll(async () => {
    for (const id of createdDecisionIds) {
      try { await pool.query(`DELETE FROM sys.sys_seed_approval_decisions WHERE seed_approval_decision_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    // Defensive: remove any decision still attached to the seeded candidate.
    if (candidateId) {
      try { await pool.query(`DELETE FROM sys.sys_seed_approval_decisions WHERE seed_approval_decision_candidate_id = $1`, [candidateId]); }
      catch { /* ignore */ }
    }
    if (candidateId) {
      try { await pool.query(`DELETE FROM sys.sys_seed_candidate_records WHERE seed_candidate_record_id = $1`, [candidateId]); }
      catch { /* ignore */ }
    }
    if (runId) {
      try { await pool.query(`DELETE FROM sys.sys_seed_acquisition_runs WHERE seed_acquisition_run_id = $1`, [runId]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated LIST → 401 UNAUTHORIZED", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/seed-approval-decisions" });
    expect(r.statusCode).toBe(401);
    expect((r.json() as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
  });

  it("MANAGER lacking seed_acquisition:read cannot LIST → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/seed-approval-decisions",
      headers: { cookie: ch(managerS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("PLATFORM_ADMIN LIST happy path → 200 + { items[], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/seed-approval-decisions",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown; total: unknown };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("PLATFORM_ADMIN CREATE → 201, then GET /:id readback → 200", async () => {
    const created = await suite.app.inject({
      method: "POST", url: "/v1/seed-approval-decisions",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { candidateId, status: "APPROVED", rationale: `${SUITE_PREFIX} approved` },
    });
    expect(created.statusCode).toBe(201);
    const dec = created.json() as DecisionShape;
    expect(typeof dec.seedApprovalDecisionId).toBe("string");
    expect(dec.candidateId).toBe(candidateId);
    expect(dec.status).toBe("APPROVED");
    createdDecisionIds.push(dec.seedApprovalDecisionId);

    const readback = await suite.app.inject({
      method: "GET", url: `/v1/seed-approval-decisions/${dec.seedApprovalDecisionId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(readback.statusCode).toBe(200);
    const rb = readback.json() as DecisionShape;
    expect(rb.seedApprovalDecisionId).toBe(dec.seedApprovalDecisionId);
    expect(rb.candidateId).toBe(candidateId);
  });

  it("GET /:id for a random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/seed-approval-decisions/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("CREATE referencing a non-existent candidate → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/seed-approval-decisions",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { candidateId: randomUUID(), status: "REJECTED", rationale: null },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("CREATE without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/seed-approval-decisions",
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { candidateId, status: "NEEDS_CHANGES", rationale: null },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });
});
