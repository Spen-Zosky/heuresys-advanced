/**
 * apps/api/test/recruiting-scope.integration.test.ts — mandato K, R-4 (D8=A, mig. 000428).
 *
 * RECRUITER (tutti e sei i permessi di R-10, perimetro TENANT) e HIRING_MANAGER
 * (requisition:read, candidate:read, interview:feedback — MAI offer:manage, perimetro =
 * sotto-albero organizzativo via `position_organization_unit_id`,
 * apps/api/src/lib/scope/recruiting.ts).
 *
 * Le tabelle del recruiting sono vuote in produzione (I12/ADR-0038: il dominio si popola
 * con l'uso). Il test costruisce due catene complete — DENTRO e FUORI dal perimetro di
 * HIRING_MANAGER — dentro la transazione del file (D-52): tutto rollbackato a fine file,
 * nessun residuo.
 *
 * Prove del mandato (passo 50): RECRUITER vede le offerte -> 200; HIRING_MANAGER sulle
 * offerte -> 403; HIRING_MANAGER su una requisizione fuori dal suo perimetro -> 404.
 * Controprova: HRMS_MANAGER sulle stesse -> 200.
 */
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";

const PREFIX = `IT_R4_${randomUUID().slice(0, 8).toUpperCase()}`;
const RECRUITER_EMAIL = "recruiter@collaudo.invalid";
const HIRING_MANAGER_EMAIL = "hiring-manager@collaudo.invalid";
const HRMS_MANAGER_EMAIL = "maria.colombo@rtl-bank.org"; // controprova del mandato

interface Auth {
  cookies: Map<string, string>;
  csrfToken: string;
}
const cookieHeader = (c: Map<string, string>) =>
  [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
async function login(t: TestApp, email: string, password: string): Promise<Auth> {
  const r = await loginRaw(t.app, email, password);
  if (r.statusCode !== 200) throw new Error(`login ${email} -> ${r.statusCode}: ${r.body}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
const headers = (a: Auth) => ({ cookie: cookieHeader(a.cookies) });

describe("mandato K, R-4 — RECRUITER e HIRING_MANAGER", () => {
  let suite: TestApp;
  let recruiter: Auth;
  let hiringManager: Auth;
  let hrmsManager: Auth;
  let reqDentro: string;
  let reqFuori: string;
  let candidatoDentro: string;
  let candidatoFuori: string;

  beforeAll(async () => {
    suite = await buildTestApp();
    const key = readCollaudoKey();
    recruiter = await login(suite, RECRUITER_EMAIL, deriveCollaudoPassword(key, RECRUITER_EMAIL));
    hiringManager = await login(
      suite,
      HIRING_MANAGER_EMAIL,
      deriveCollaudoPassword(key, HIRING_MANAGER_EMAIL),
    );
    hrmsManager = await login(suite, HRMS_MANAGER_EMAIL, TEST_PERSONA_PASSWORD);

    const rtl = await pool.query<{ id: string }>(
      `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`,
    );
    const rtlTenantId = rtl.rows[0]!.id;
    const hm = await pool.query<{ id: string }>(
      `SELECT user_id AS id FROM sys.sys_users WHERE user_email = $1`,
      [HIRING_MANAGER_EMAIL],
    );
    const hmUserId = hm.rows[0]!.id;

    // Due unita' organizzative: SOLO "unitDentro" e' diretta da HIRING_MANAGER.
    const unitDentro = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_organization_units
         (organization_unit_tenant_id, organization_unit_code, organization_unit_name,
          organization_unit_type, organization_unit_manager_user_id)
       VALUES ($1, $2, 'Unita di prova DENTRO (R-4)', 'TEAM', $3)
       RETURNING organization_unit_id AS id`,
      [rtlTenantId, `${PREFIX}_UD`, hmUserId],
    );
    const unitFuori = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_organization_units
         (organization_unit_tenant_id, organization_unit_code, organization_unit_name,
          organization_unit_type)
       VALUES ($1, $2, 'Unita di prova FUORI (R-4)', 'TEAM')
       RETURNING organization_unit_id AS id`,
      [rtlTenantId, `${PREFIX}_UF`],
    );

    async function catenaCompleta(unitId: string, tag: string) {
      const pos = await pool.query<{ id: string }>(
        `INSERT INTO sys.sys_positions
           (position_tenant_id, position_code, position_title, position_organization_unit_id)
         VALUES ($1, $2, $3, $4) RETURNING position_id AS id`,
        [rtlTenantId, `${PREFIX}_POS_${tag}`, `Posizione di prova ${tag} (R-4)`, unitId],
      );
      const req = await pool.query<{ id: string }>(
        `INSERT INTO sys.sys_job_requisitions
           (requisition_tenant_id, requisition_code, requisition_position_id, requisition_status)
         VALUES ($1, $2, $3, 'OPEN') RETURNING requisition_id AS id`,
        [rtlTenantId, `${PREFIX}_REQ_${tag}`, pos.rows[0]!.id],
      );
      const posting = await pool.query<{ id: string }>(
        `INSERT INTO sys.sys_job_postings
           (posting_tenant_id, posting_requisition_id, posting_code, posting_title, posting_status)
         VALUES ($1, $2, $3, $4, 'PUBLISHED') RETURNING posting_id AS id`,
        [rtlTenantId, req.rows[0]!.id, `${PREFIX}_POST_${tag}`, `Annuncio di prova ${tag} (R-4)`],
      );
      const cand = await pool.query<{ id: string }>(
        `INSERT INTO sys.sys_candidates
           (candidate_tenant_id, candidate_first_name, candidate_last_name, candidate_email, candidate_source)
         VALUES ($1, 'Prova', $2, $3, 'REFERRAL') RETURNING candidate_id AS id`,
        [rtlTenantId, `Candidato${tag}`, `${PREFIX.toLowerCase()}_${tag.toLowerCase()}@collaudo.invalid`],
      );
      const app = await pool.query<{ id: string }>(
        `INSERT INTO sys.sys_candidate_applications
           (application_tenant_id, application_candidate_id, application_posting_id)
         VALUES ($1, $2, $3) RETURNING application_id AS id`,
        [rtlTenantId, cand.rows[0]!.id, posting.rows[0]!.id],
      );
      await pool.query(
        `INSERT INTO sys.sys_interviews (interview_tenant_id, interview_application_id, interview_kind)
         VALUES ($1, $2, 'SCREENING')`,
        [rtlTenantId, app.rows[0]!.id],
      );
      return { requisitionId: req.rows[0]!.id, candidateId: cand.rows[0]!.id };
    }

    const dentro = await catenaCompleta(unitDentro.rows[0]!.id, "D");
    const fuori = await catenaCompleta(unitFuori.rows[0]!.id, "F");
    reqDentro = dentro.requisitionId;
    reqFuori = fuori.requisitionId;
    candidatoDentro = dentro.candidateId;
    candidatoFuori = fuori.candidateId;
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("RECRUITER vede le offerte -> 200 (mandato, passo 50)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/job-offers",
      headers: headers(recruiter),
    });
    expect(r.statusCode).toBe(200);
  });

  it("HIRING_MANAGER sulle offerte -> 403 FORBIDDEN (niente offer:manage, mandato passo 50)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/job-offers",
      headers: headers(hiringManager),
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("HIRING_MANAGER su una richiesta DENTRO il suo perimetro -> 200", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/job-requisitions/${reqDentro}`,
      headers: headers(hiringManager),
    });
    expect(r.statusCode).toBe(200);
  });

  it("HIRING_MANAGER su una richiesta FUORI dal suo perimetro -> 404 (mandato, passo 50)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/job-requisitions/${reqFuori}`,
      headers: headers(hiringManager),
    });
    expect(r.statusCode).toBe(404);
  });

  it("Controprova: HRMS_MANAGER vede la richiesta FUORI dal perimetro di HIRING_MANAGER -> 200 (mandato, passo 50)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/job-requisitions/${reqFuori}`,
      headers: headers(hrmsManager),
    });
    expect(r.statusCode).toBe(200);
  });

  it("HIRING_MANAGER vede il candidato DENTRO il suo perimetro -> 200", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/candidates/${candidatoDentro}`,
      headers: headers(hiringManager),
    });
    expect(r.statusCode).toBe(200);
  });

  it("HIRING_MANAGER su un candidato FUORI dal suo perimetro -> 404", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/candidates/${candidatoFuori}`,
      headers: headers(hiringManager),
    });
    expect(r.statusCode).toBe(404);
  });

  it("RECRUITER vede entrambe le richieste (perimetro tenant, non organizzativo) -> 200/200", async () => {
    const a = await suite.app.inject({
      method: "GET",
      url: `/v1/job-requisitions/${reqDentro}`,
      headers: headers(recruiter),
    });
    const b = await suite.app.inject({
      method: "GET",
      url: `/v1/job-requisitions/${reqFuori}`,
      headers: headers(recruiter),
    });
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
  });

  it("HIRING_MANAGER non ha requisition:manage -> POST /v1/job-requisitions 403", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/job-requisitions",
      headers: { ...headers(hiringManager), "x-csrf-token": hiringManager.csrfToken },
      payload: { code: `${PREFIX}_VIETATO`, positionId: randomUUID() },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });
});
