/**
 * apps/api/test/positions-learning.integration.test.ts
 * Integration tests for the #25 A/L5 learning bridge (read-only sub-resources):
 *   GET /v1/positions/:id/learning-requirements
 *   GET /v1/positions/:id/learning-modules
 * Expectations are DERIVED LIVE from the DB (no hardcoded ids/counts — S1012 rule):
 * the richest position is picked by SQL and the response is asserted against the
 * same source the endpoint reads.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { SKILL_PROFICIENCY_VALUES } from "@heuresys/shared";

const PWD = TEST_PERSONA_PASSWORD;
const TENANT_ADMIN_EMAIL = "federica.marchetti@rtl-bank.org";

interface Session {
  cookies: Map<string, string>;
}
function cookieHeader(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<Session> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

let suite: TestApp;
let tenantS: Session;
let richReqPositionId: string;
let richReqCount: number;
let richCovPositionId: string;
let richCovCount: number;
let bareReqPositionId: string | null;

describe("/v1/positions/:id/learning-* integration (#25)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, TENANT_ADMIN_EMAIL);

    // richest RTL position by learning requirements (derived live)
    const req = await pool.query<{ position_id: string; n: string }>(
      `SELECT plr.position_id, count(*) AS n
         FROM sys.sys_position_learning_requirements plr
         JOIN sys.sys_tenancies t ON t.tenant_id = plr.position_learning_requirement_tenant_id
        WHERE t.tenant_code = 'RTL_BANK'
        GROUP BY plr.position_id ORDER BY count(*) DESC LIMIT 1`,
    );
    expect(req.rows.length, "seeded position_learning_requirements expected").toBeGreaterThan(0);
    richReqPositionId = req.rows[0]!.position_id;
    richReqCount = Number(req.rows[0]!.n);

    // richest RTL position by skill->module coverage (same join the endpoint runs)
    const cov = await pool.query<{ position_id: string; n: string }>(
      `SELECT psr.position_id, count(*) AS n
         FROM sys.sys_position_skill_requirements psr
         JOIN sys.sys_skill_learning_mappings slm
           ON slm.skill_learning_mapping_skill_id = psr.skill_id
         JOIN sys.sys_positions p ON p.position_id = psr.position_id
         JOIN sys.sys_tenancies t ON t.tenant_id = p.position_tenant_id
        WHERE t.tenant_code = 'RTL_BANK'
        GROUP BY psr.position_id ORDER BY count(*) DESC LIMIT 1`,
    );
    expect(cov.rows.length, "seeded skill_learning_mappings coverage expected").toBeGreaterThan(0);
    richCovPositionId = cov.rows[0]!.position_id;
    richCovCount = Number(cov.rows[0]!.n);

    // an RTL position with NO learning requirements (real empty state), if any
    const bare = await pool.query<{ position_id: string }>(
      `SELECT p.position_id
         FROM sys.sys_positions p
         JOIN sys.sys_tenancies t ON t.tenant_id = p.position_tenant_id
        WHERE t.tenant_code = 'RTL_BANK'
          AND NOT EXISTS (SELECT 1 FROM sys.sys_position_learning_requirements plr
                           WHERE plr.position_id = p.position_id)
        LIMIT 1`,
    );
    bareReqPositionId = bare.rows[0]?.position_id ?? null;
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("rejects unauthenticated access on both endpoints", async () => {
    for (const sub of ["learning-requirements", "learning-modules"]) {
      const r = await suite.app.inject({
        method: "GET",
        url: `/v1/positions/${richReqPositionId}/${sub}`,
      });
      expect(r.statusCode).toBe(401);
    }
  });

  it("lists learning requirements with resolved path names, count = live source", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/positions/${richReqPositionId}/learning-requirements`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<Record<string, unknown>> };
    expect(body.items.length).toBe(richReqCount);
    const first = body.items[0]!;
    expect(first.positionId).toBe(richReqPositionId);
    expect(typeof first.learningPathId).toBe("string");
    expect(typeof first.isMandatory).toBe("boolean");
    // LEFT JOIN resolution: every FK points at a real path, so names resolve
    expect(body.items.every((i) => i.learningPathName !== null)).toBe(true);
    // mandatory-first ordering contract
    const mandatoryFlags = body.items.map((i) => i.isMandatory as boolean);
    const firstOptional = mandatoryFlags.indexOf(false);
    if (firstOptional !== -1) {
      expect(mandatoryFlags.slice(firstOptional).every((m) => m === false)).toBe(true);
    }
  });

  it("lists learning-module coverage for required skills, count = live join", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/positions/${richCovPositionId}/learning-modules`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<Record<string, unknown>> };
    expect(body.items.length).toBe(richCovCount);
    const first = body.items[0]!;
    expect(typeof first.learningModuleId).toBe("string");
    expect(first.learningModuleTitle).not.toBeNull();
    // invariant, not enumerated values: proficiency levels come from the shared contract
    const levels = new Set<string>(SKILL_PROFICIENCY_VALUES);
    expect(body.items.every((i) => levels.has(i.targetProficiency as string))).toBe(true);
    expect(body.items.every((i) => levels.has(i.requiredProficiency as string))).toBe(true);
  });

  it("returns a real empty list for a position without requirements", async () => {
    if (!bareReqPositionId) return; // dataset fully covered — nothing to assert
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/positions/${bareReqPositionId}/learning-requirements`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { items: unknown[] }).items).toEqual([]);
  });

  it("404s on an unknown position id", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/positions/00000000-0000-4000-8000-000000000000/learning-requirements`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(404);
  });
});
