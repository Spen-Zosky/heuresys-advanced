/**
 * apps/api/test/dpo.integration.test.ts — mandato K, R-2 (D3=A, decisione C di Enzo).
 *
 * Nucleo GDPR: nasce il ruolo `DPO` (tenant-scoped, come TENANT_ADMIN/HRMS_MANAGER — non
 * entra in GDPR_MANDATE_ROLES) con i quattro permessi `gdpr:read`, `gdpr:export`,
 * `gdpr:erase`, `gdpr:retention`; la stessa migrazione (000423) ritira `gdpr:erase` a
 * HRMS_MANAGER (G-D2, unica eccezione ammessa a D2: HRMS_MANAGER resta plenipotenziario).
 *
 * La lettura MASCHERATA del dossier (I18/I20) NON è in questa voce: resta una voce D-nuova
 * separata, BLOCCATA(Enzo) — esiti/R-2_domanda_masking.md, esiti/RISPOSTE_ENZO.md.
 *
 * Il primo test (HRMS_MANAGER → 403 su erasure) è la prova di passo 40 del mandato: scritta
 * e vista ROSSA (oggi risponde 200) PRIMA della migrazione 000423 — evidenza in
 * evidenze/R-2_passo40_ROSSO_*.txt — poi verde dopo la migrazione (passo 44).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";

const HRMS_MANAGER = "maria.colombo@rtl-bank.org"; // RTL_BANK, ruolo HRMS_MANAGER (misurato sul vivo)
const EMPLOYEE = "tommaso.fiore@rtl-bank.org"; // soggetto già usato da gdpr.integration.test.ts
const DPO_EMAIL = "dpo@collaudo.invalid";

interface Auth {
  cookies: Map<string, string>;
  csrfToken: string;
}
function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string, password: string): Promise<Auth> {
  const r = await loginRaw(t.app, email, password);
  if (r.statusCode !== 200) {
    throw new Error(`login ${email} -> ${r.statusCode}: ${r.body}`);
  }
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
function headers(a: Auth) {
  return {
    cookie: cookieHeader(a.cookies),
    "x-csrf-token": a.csrfToken,
    "content-type": "application/json",
  };
}

describe("mandato K, R-2 — DPO (nucleo GDPR, D3=A)", () => {
  let suite: TestApp;
  let hrmsManager: Auth;
  let subjectId: string;

  beforeAll(async () => {
    suite = await buildTestApp();
    hrmsManager = await login(suite, HRMS_MANAGER, TEST_PERSONA_PASSWORD);
    const subj = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
      [EMPLOYEE],
    );
    subjectId = subj.rows[0]!.user_id;
  });
  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("D3=A — HRMS_MANAGER non ha più gdpr:erase (ritirato a favore di DPO, mig. 000423)", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: `/v1/gdpr/users/${subjectId}/erasure`,
      headers: headers(hrmsManager),
      payload: { dryRun: true },
    });
    expect(r.statusCode).toBe(403);
  });

  it("DPO su /v1/gdpr/* → 200 (data-map, export)", async () => {
    const key = readCollaudoKey();
    const dpo = await login(suite, DPO_EMAIL, deriveCollaudoPassword(key, DPO_EMAIL));

    const dataMap = await suite.app.inject({
      method: "GET",
      url: "/v1/gdpr/data-map",
      headers: headers(dpo),
    });
    expect(dataMap.statusCode).toBe(200);

    const exp = await suite.app.inject({
      method: "POST",
      url: `/v1/gdpr/users/${subjectId}/export`,
      headers: headers(dpo),
      payload: {},
    });
    expect(exp.statusCode).toBe(200);
  });

  it("DPO su /v1/gdpr/users/:id/erasure → 200 (il permesso che HRMS_MANAGER ha perso)", async () => {
    const key = readCollaudoKey();
    const dpo = await login(suite, DPO_EMAIL, deriveCollaudoPassword(key, DPO_EMAIL));
    const r = await suite.app.inject({
      method: "POST",
      url: `/v1/gdpr/users/${subjectId}/erasure`,
      headers: headers(dpo),
      payload: { dryRun: true },
    });
    // il soggetto è ATTIVO: il service risponde 409 (contract basis), non 403 — la porta
    // RBAC è passata, che è ciò che questo test verifica (il 409 di merito lo copre già
    // gdpr.integration.test.ts).
    expect(r.statusCode).toBe(409);
  });

  it("DPO fuori dal GDPR: /v1/compensation/bands → 403 (nessun mandato sensibile nuovo, I18/I20 intatti)", async () => {
    const key = readCollaudoKey();
    const dpo = await login(suite, DPO_EMAIL, deriveCollaudoPassword(key, DPO_EMAIL));
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/compensation/bands",
      headers: headers(dpo),
    });
    expect(r.statusCode).toBe(403);
  });

  it("controprova — HRMS_MANAGER su /v1/compensation/bands → 200 (I22 plenipotenziario, invariato)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/compensation/bands",
      headers: headers(hrmsManager),
    });
    expect(r.statusCode).toBe(200);
  });
});
