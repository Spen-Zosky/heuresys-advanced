/**
 * apps/api/test/me-ess-extensions.integration.test.ts
 * Integration tests for the Phase 1.5.3-5 additions:
 *   GET /v1/me/kpis
 *   GET/POST /v1/me/certifications
 *   GET /v1/me/documents
 *
 * Self-scope inherited from the existing me module: route always uses
 * req.user.userId; no :userId param.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_MEEXT_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

let suite: TestApp;
let employeeS: S;
let outsiderS: S;
let employeeTenantId: string;

const createdCertIds: string[] = [];
const insertedDocIds: string[] = [];
let insertedKpiId: string | null = null;
let insertedKpiRequirementId: string | null = null;
let insertedKpiEvidenceId: string | null = null;

describe("/v1/me/{kpis,certifications,documents} ESS extensions", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    employeeS = await login(suite, "employee_test@rtl-bank.test");
    outsiderS = await login(suite, "outsider_test@rtl-bank.test");

    const t = await pool.query<{ user_tenant_id: string }>(
      `SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`,
      [employeeS.userId],
    );
    employeeTenantId = t.rows[0]!.user_tenant_id;

    // Seed: KPI definition + position requirement on employee's PRIMARY position + evidence row.
    const primary = await pool.query<{ user_position_assignment_position_id: string }>(
      `SELECT user_position_assignment_position_id
         FROM sys.sys_user_position_assignments
        WHERE user_position_assignment_user_id = $1
          AND user_position_assignment_status = 'ACTIVE'
          AND user_position_assignment_kind = 'PRIMARY'
        LIMIT 1`,
      [employeeS.userId],
    );
    const positionId = primary.rows[0]?.user_position_assignment_position_id;
    if (positionId) {
      const kdef = await pool.query<{ kpi_definition_id: string }>(
        `INSERT INTO sys.sys_kpi_definitions (
           kpi_definition_tenant_id, kpi_definition_code, kpi_definition_name,
           kpi_definition_polarity, kpi_definition_is_global, kpi_definition_unit
         ) VALUES ($1, $2, $3, 'HIGHER_IS_BETTER', false, '%')
         RETURNING kpi_definition_id`,
        [employeeTenantId, `${SUITE_PREFIX}_KPI`, `${SUITE_PREFIX} KPI`],
      );
      insertedKpiId = kdef.rows[0]!.kpi_definition_id;

      const req = await pool.query<{ position_kpi_requirement_id: string }>(
        `INSERT INTO sys.sys_position_kpi_requirements (
            position_id, position_kpi_requirement_tenant_id, kpi_definition_id, target_template, weight
          ) VALUES ($1, $2, $3, '{"target": 85}'::jsonb, 0.5)
          ON CONFLICT (position_id, kpi_definition_id) DO UPDATE SET weight = EXCLUDED.weight
          RETURNING position_kpi_requirement_id`,
        [positionId, employeeTenantId, insertedKpiId],
      );
      insertedKpiRequirementId = req.rows[0]!.position_kpi_requirement_id;

      const ev = await pool.query<{ user_kpi_evidence_id: string }>(
        `INSERT INTO sys.sys_user_kpi_evidence (
            user_kpi_evidence_user_id, user_kpi_evidence_tenant_id, user_kpi_evidence_kpi_id,
            user_kpi_evidence_period_start, user_kpi_evidence_period_end,
            user_kpi_evidence_measured_value, user_kpi_evidence_target_value, user_kpi_evidence_unit
          ) VALUES ($1, $2, $3, '2026-01-01', '2026-03-31', 92.5, 85.0, '%')
          RETURNING user_kpi_evidence_id`,
        [employeeS.userId, employeeTenantId, insertedKpiId],
      );
      insertedKpiEvidenceId = ev.rows[0]!.user_kpi_evidence_id;
    }

    // Seed: 1 user document for employee (so /me/documents has at least one row).
    const d = await pool.query<{ user_document_id: string }>(
      `INSERT INTO sys.sys_user_documents (
         user_document_user_id, user_document_tenant_id, user_document_kind,
         user_document_title, user_document_uri, user_document_mime_type
       ) VALUES ($1, $2, 'CV', $3, 'https://example.com/doc.pdf', 'application/pdf')
       RETURNING user_document_id`,
      [employeeS.userId, employeeTenantId, `${SUITE_PREFIX} CV`],
    );
    insertedDocIds.push(d.rows[0]!.user_document_id);
  });

  afterAll(async () => {
    if (insertedKpiEvidenceId) {
      await pool.query(`DELETE FROM sys.sys_user_kpi_evidence WHERE user_kpi_evidence_id = $1`, [insertedKpiEvidenceId]);
    }
    if (insertedKpiRequirementId) {
      await pool.query(`DELETE FROM sys.sys_position_kpi_requirements WHERE position_kpi_requirement_id = $1`, [insertedKpiRequirementId]);
    }
    if (insertedKpiId) {
      await pool.query(`DELETE FROM sys.sys_kpi_definitions WHERE kpi_definition_id = $1`, [insertedKpiId]);
    }
    for (const id of createdCertIds) {
      await pool.query(`DELETE FROM sys.sys_user_certifications WHERE user_certification_id = $1`, [id]);
    }
    for (const id of insertedDocIds) {
      await pool.query(`DELETE FROM sys.sys_user_documents WHERE user_document_id = $1`, [id]);
    }
    await suite.app.close();
    await closePool();
  });

  /* ---------------- /me/kpis ---------------- */

  it("GET /v1/me/kpis returns seeded KPI with latest evidence", async () => {
    if (!insertedKpiId) return; // no primary position → skip (defensive)
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/kpis",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      total: number;
      items: Array<{
        kpiDefinitionId: string;
        kpiCode: string;
        latestMeasuredValue: string | null;
        latestTargetValue: string | null;
      }>;
    };
    const ours = body.items.find((k) => k.kpiDefinitionId === insertedKpiId);
    expect(ours).toBeDefined();
    expect(ours!.kpiCode).toBe(`${SUITE_PREFIX}_KPI`);
    expect(ours!.latestMeasuredValue).toBe("92.5000");
    expect(ours!.latestTargetValue).toBe("85.0000");
  });

  it("GET /v1/me/kpis as a different user does not leak", async () => {
    if (!insertedKpiId) return;
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/kpis",
      headers: { cookie: ch(outsiderS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<{ kpiDefinitionId: string }> };
    const leaked = body.items.find((k) => k.kpiDefinitionId === insertedKpiId);
    // outsider doesn't share the same PRIMARY position so should not see ours.
    expect(leaked).toBeUndefined();
  });

  it("GET /v1/me/kpis without auth → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/kpis" });
    expect(r.statusCode).toBe(401);
  });

  /* ---------------- /me/certifications ---------------- */

  it("GET /v1/me/certifications empty → 200, POST creates, GET shows it", async () => {
    // Initial state — record current count for delta check.
    const before = await suite.app.inject({
      method: "GET", url: "/v1/me/certifications",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(before.statusCode).toBe(200);
    const beforeBody = before.json() as { total: number };
    const initialCount = beforeBody.total;

    const created = await suite.app.inject({
      method: "POST", url: "/v1/me/certifications",
      headers: {
        cookie: ch(employeeS.cookies),
        "x-csrf-token": employeeS.csrfToken,
        "content-type": "application/json",
      },
      payload: {
        name: `${SUITE_PREFIX} AWS Solutions Architect`,
        issuer: "Amazon Web Services",
        issuedDate: "2026-02-15",
        expiresDate: "2029-02-15",
        credentialId: `CRED-${SUITE_PREFIX}`,
        documentUri: "https://aws.amazon.com/cert/example",
      },
    });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json() as { userCertificationId: string; name: string };
    expect(createdBody.name).toBe(`${SUITE_PREFIX} AWS Solutions Architect`);
    createdCertIds.push(createdBody.userCertificationId);

    const after = await suite.app.inject({
      method: "GET", url: "/v1/me/certifications",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(after.statusCode).toBe(200);
    const afterBody = after.json() as {
      total: number;
      items: Array<{ userCertificationId: string; name: string }>;
    };
    expect(afterBody.total).toBe(initialCount + 1);
    const ours = afterBody.items.find((c) => c.userCertificationId === createdBody.userCertificationId);
    expect(ours).toBeDefined();
  });

  it("POST /v1/me/certifications without CSRF → 403", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/me/certifications",
      headers: {
        cookie: ch(employeeS.cookies),
        "content-type": "application/json",
      },
      payload: { name: "No CSRF Cert", issuer: "Test" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("GET /v1/me/certifications as outsider does NOT leak employee's certs", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/certifications",
      headers: { cookie: ch(outsiderS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<{ userCertificationId: string }> };
    for (const cid of createdCertIds) {
      expect(body.items.find((c) => c.userCertificationId === cid)).toBeUndefined();
    }
  });

  /* ---------------- /me/documents ---------------- */

  it("GET /v1/me/documents returns the seeded document", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/documents",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      total: number;
      items: Array<{ userDocumentId: string; kind: string; title: string }>;
    };
    const ours = body.items.find((d) => d.userDocumentId === insertedDocIds[0]);
    expect(ours).toBeDefined();
    expect(ours!.kind).toBe("CV");
  });

  it("GET /v1/me/documents as outsider does NOT leak employee's docs", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/documents",
      headers: { cookie: ch(outsiderS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<{ userDocumentId: string }> };
    for (const id of insertedDocIds) {
      expect(body.items.find((d) => d.userDocumentId === id)).toBeUndefined();
    }
  });

  it("GET /v1/me/documents without auth → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/documents" });
    expect(r.statusCode).toBe(401);
  });
});
