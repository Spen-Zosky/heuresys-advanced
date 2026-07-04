/**
 * apps/api/test/seed-acquisition.integration.test.ts
 * Tests the seed_acquisition pipeline: trigger run, transition to COMPLETED.
 * Candidate + decision flows are smoke-tested via direct DB seed since the
 * AI-driven candidate generation runs out-of-band.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_SEED_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

let suite: TestApp;
let tenantS: S;
let runId: string | null = null;
let candidateId: string | null = null;
let decisionId: string | null = null;
let tenantId: string;

describe("/v1/seed-acquisition-* pipeline", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    const tr = await pool.query<{ user_tenant_id: string }>(
      `SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`, [tenantS.userId],
    );
    tenantId = tr.rows[0]!.user_tenant_id;
  });

  afterAll(async () => {
    if (decisionId) { try { await pool.query(`DELETE FROM sys.sys_seed_approval_decisions WHERE seed_approval_decision_id = $1`, [decisionId]); } catch { /* ignore */ } }
    if (candidateId) { try { await pool.query(`DELETE FROM sys.sys_seed_candidate_records WHERE seed_candidate_record_id = $1`, [candidateId]); } catch { /* ignore */ } }
    if (runId) { try { await pool.query(`DELETE FROM sys.sys_seed_acquisition_runs WHERE seed_acquisition_run_id = $1`, [runId]); } catch { /* ignore */ } }
    await suite.app.close();
    await closePool();
  });

  it("TENANT_ADMIN triggers a seed acquisition run", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/seed-acquisition-runs",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_RUN`, sourceRegistryPayload: [{ src: "test" }] },
    });
    expect(r.statusCode).toBe(201);
    const b = r.json() as { seedAcquisitionRunId: string; status: string };
    expect(b.status).toBe("RUNNING");
    runId = b.seedAcquisitionRunId;
  });

  it("PATCH run to COMPLETED stamps finished_at", async () => {
    if (!runId) throw new Error("setup failure");
    const r = await suite.app.inject({
      method: "PATCH", url: `/v1/seed-acquisition-runs/${runId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { status: "COMPLETED" },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { status: string; finishedAt: string | null };
    expect(b.status).toBe("COMPLETED");
    expect(b.finishedAt).not.toBeNull();
  });

  it("Seed candidate directly via DB then LIST via API", async () => {
    if (!runId) throw new Error("setup failure");
    const ins = await pool.query<{ seed_candidate_record_id: string }>(
      `INSERT INTO sys.sys_seed_candidate_records (
          seed_candidate_record_run_id, seed_candidate_record_tenant_id,
          seed_candidate_record_domain, seed_candidate_record_natural_key,
          seed_candidate_record_payload, seed_candidate_record_validation_status
        ) VALUES ($1, $2, 'TEST_DOMAIN', $3, '{"k":"v"}'::jsonb, 'PENDING')
        RETURNING seed_candidate_record_id`,
      [runId, tenantId, `${SUITE_PREFIX}-natural-key`],
    );
    candidateId = ins.rows[0]!.seed_candidate_record_id;

    const list = await suite.app.inject({
      method: "GET", url: `/v1/seed-candidate-records?runId=${runId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const b = list.json() as { items: Array<{ seedCandidateRecordId: string }>; total: number };
    expect(b.items.some((i) => i.seedCandidateRecordId === candidateId)).toBe(true);
  });

  it("Approval decision against the candidate", async () => {
    if (!candidateId) throw new Error("setup failure");
    const r = await suite.app.inject({
      method: "POST", url: "/v1/seed-approval-decisions",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { candidateId, status: "APPROVED", rationale: "ok" },
    });
    expect(r.statusCode).toBe(201);
    const b = r.json() as { seedApprovalDecisionId: string; status: string };
    expect(b.status).toBe("APPROVED");
    decisionId = b.seedApprovalDecisionId;
  });

  it("Decision against non-existent candidate → 404", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/seed-approval-decisions",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { candidateId: randomUUID(), status: "REJECTED" },
    });
    expect(r.statusCode).toBe(404);
  });
});
