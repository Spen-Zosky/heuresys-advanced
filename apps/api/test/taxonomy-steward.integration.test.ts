/**
 * apps/api/test/taxonomy-steward.integration.test.ts — mandato K, R-3 (D1=B, mig. 000426).
 *
 * TAXONOMY_STEWARD: ruolo di cliente (tenant-scoped) per il governo lato cliente della
 * tassonomia — competenze e ruoli professionali del proprio tenant (skill:create/update,
 * job_role:create/update — GIA' tenant-scoped a livello di service, misurato prima di
 * scrivere la migrazione: esiti/R-3_permessi_dichiarati.txt), piu' i sinonimi
 * (skill_alias:manage, D1=B: "i sinonimi li governa chi governa le competenze").
 *
 * Isolamento transazionale per file (D-52): tutto cio' che nasce qui viene rollbackato.
 */
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";

const PREFIX = `IT_R3_${randomUUID().slice(0, 8).toUpperCase()}`;
const STEWARD_EMAIL = "taxonomy-steward@collaudo.invalid";
// PLATFORM_ADMIN reale (non l'identita' di collaudo `piattaforma@collaudo.invalid`, la
// cui credenziale su heuresys_ci puo' essere stata provisionata con una chiave diversa
// dalla propria sessione: stesso attore usato dalla controprova di R-9, gia' provato).
const PLATFORM_ADMIN_EMAIL = "enzo.spenuso@heuresys.com";
const USER_RTL = "paolo.caputo@rtl-bank.org"; // TEAM_LEADER+TEAM_MEMBER+MANAGER+USER, mai TAXONOMY_STEWARD

interface Auth { cookies: Map<string, string>; csrfToken: string }
const cookieHeader = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
async function login(t: TestApp, email: string, password: string): Promise<Auth> {
  const r = await loginRaw(t.app, email, password);
  if (r.statusCode !== 200) throw new Error(`login ${email} -> ${r.statusCode}: ${r.body}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
const headers = (a: Auth) => ({
  cookie: cookieHeader(a.cookies),
  "x-csrf-token": a.csrfToken,
  "content-type": "application/json",
});

describe("mandato K, R-3 — TAXONOMY_STEWARD", () => {
  let suite: TestApp;
  let steward: Auth;
  let platformAdmin: Auth;
  let user: Auth;
  let skillDiRtl: string;
  let skillGlobale: string;
  let skillDiHeuresys: string;

  beforeAll(async () => {
    suite = await buildTestApp();
    const key = readCollaudoKey();
    steward = await login(suite, STEWARD_EMAIL, deriveCollaudoPassword(key, STEWARD_EMAIL));
    platformAdmin = await login(suite, PLATFORM_ADMIN_EMAIL, TEST_PERSONA_PASSWORD);
    user = await login(suite, USER_RTL, TEST_PERSONA_PASSWORD);

    const rtl = await pool.query<{ id: string }>(
      `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`,
    );
    const rtlTenantId = rtl.rows[0]!.id;
    const heu = await pool.query<{ id: string }>(
      `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'HEURESYS'`,
    );
    const heuTenantId = heu.rows[0]!.id;

    const a = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_skills (skill_tenant_id, skill_code, skill_name, skill_is_global)
       VALUES ($1, $2, 'Competenza RTL (prova R-3)', false) RETURNING skill_id AS id`,
      [rtlTenantId, `${PREFIX}_RTL`],
    );
    skillDiRtl = a.rows[0]!.id;
    const g = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_skills (skill_tenant_id, skill_code, skill_name, skill_is_global)
       VALUES (NULL, $1, 'Competenza globale (prova R-3)', true) RETURNING skill_id AS id`,
      [`${PREFIX}_G`],
    );
    skillGlobale = g.rows[0]!.id;
    const h = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_skills (skill_tenant_id, skill_code, skill_name, skill_is_global)
       VALUES ($1, $2, 'Competenza Heuresys (prova R-3)', false) RETURNING skill_id AS id`,
      [heuTenantId, `${PREFIX}_HEU`],
    );
    skillDiHeuresys = h.rows[0]!.id;
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("TAXONOMY_STEWARD modifica una competenza del proprio tenant → 200", async () => {
    const r = await suite.app.inject({
      method: "PATCH", url: `/v1/skills/${skillDiRtl}`, headers: headers(steward),
      payload: { name: `${PREFIX} RTL rinominata` },
    });
    expect(r.statusCode, r.body).toBe(200);
  });

  it("TAXONOMY_STEWARD su una competenza GLOBALE → 403 GLOBAL_SKILL_EDIT_FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "PATCH", url: `/v1/skills/${skillGlobale}`, headers: headers(steward),
      payload: { name: `${PREFIX} globale rinominata` },
    });
    expect(r.statusCode, r.body).toBe(403);
  });

  it("TAXONOMY_STEWARD su una competenza di un altro tenant → 404 (anti-enumerazione)", async () => {
    const r = await suite.app.inject({
      method: "PATCH", url: `/v1/skills/${skillDiHeuresys}`, headers: headers(steward),
      payload: { name: `${PREFIX} heuresys rinominata` },
    });
    expect(r.statusCode, r.body).toBe(404);
  });

  it("TAXONOMY_STEWARD crea un alias sulla propria competenza → 201", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/skill-aliases", headers: headers(steward),
      payload: { skillId: skillDiRtl, label: `${PREFIX} alias steward`, locale: "it" },
    });
    expect(r.statusCode, r.body).toBe(201);
  });

  it("TAXONOMY_STEWARD crea un alias su una competenza GLOBALE → 403 GLOBAL_SKILL_ALIAS_ADMIN_ONLY", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/skill-aliases", headers: headers(steward),
      payload: { skillId: skillGlobale, label: `${PREFIX} alias su globale`, locale: "it" },
    });
    expect(r.statusCode, r.body).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("GLOBAL_SKILL_ALIAS_ADMIN_ONLY");
  });

  it("TAXONOMY_STEWARD crea un ruolo professionale nel proprio tenant → 201", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/job-roles", headers: headers(steward),
      payload: { code: `${PREFIX}_JOBROLE`, name: `${PREFIX} ruolo professionale` },
    });
    expect(r.statusCode, r.body).toBe(201);
  });

  it("USER non ha skill_alias:manage → 403 sulla stessa creazione di alias", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/skill-aliases", headers: headers(user),
      payload: { skillId: skillDiRtl, label: `${PREFIX} alias da USER`, locale: "it" },
    });
    expect(r.statusCode, r.body).toBe(403);
  });

  it("USER non ha skill:update → 403 sulla stessa modifica di competenza", async () => {
    const r = await suite.app.inject({
      method: "PATCH", url: `/v1/skills/${skillDiRtl}`, headers: headers(user),
      payload: { name: `${PREFIX} tentativo USER` },
    });
    expect(r.statusCode, r.body).toBe(403);
  });

  it("TAXONOMY_STEWARD fuori dal proprio mandato: /v1/compensation/bands → 403", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/bands", headers: headers(steward),
    });
    expect(r.statusCode, r.body).toBe(403);
  });

  it("controprova — PLATFORM_ADMIN → 200 su tutte le operazioni concesse a TAXONOMY_STEWARD", async () => {
    const patch = await suite.app.inject({
      method: "PATCH", url: `/v1/skills/${skillDiRtl}`, headers: headers(platformAdmin),
      payload: { name: `${PREFIX} RTL rinominata da PLATFORM_ADMIN` },
    });
    expect(patch.statusCode, patch.body).toBe(200);

    const alias = await suite.app.inject({
      method: "POST", url: "/v1/skill-aliases", headers: headers(platformAdmin),
      payload: { skillId: skillGlobale, label: `${PREFIX} alias da PLATFORM_ADMIN`, locale: "it" },
    });
    expect(alias.statusCode, alias.body).toBe(201);
  });
});
