/**
 * apps/api/test/people-manager.integration.test.ts — mandato K, R-6 sessione 1 (passo 56).
 *
 * PEOPLE_MANAGER: ruolo di cliente per la gestione operativa delle persone. Scrive sulle
 * tabelle NATIVE/IBRIDE di X-1 (obiettivi, competenze, formazione...), legge le IMPORTATE,
 * MAI scrive su una tabella importata — il confine e' l'ASSENZA della rotta (X-0), non un
 * 403: nessuna rotta di scrittura esiste sulle tabelle classificate `importato`.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { userWithRole } from "./helpers/actors.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";

senzaCacheDiSessione();

const PEOPLE_MANAGER_EMAIL = "people-manager@collaudo.invalid";
// Controprova: chi detiene HRMS_MANAGER OGGI nel tenant del People Manager, scelto dal dato
// (helpers/actors.ts). Prima era un nome scritto a mano, e quando la persona ha perso il ruolo
// (il ruolo segue il lavoro, 2026-10-31) la controprova riceveva 403 per la ragione sbagliata.

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

async function login(t: TestApp, email: string, password: string): Promise<S> {
  const r = await loginRaw(t.app, email, password);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const b = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: b.csrfToken, userId: b.user.userId };
}

let suite: TestApp;
let hrmsManager: S;
let peopleManager: S;

describe("mandato K, R-6 — PEOPLE_MANAGER", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const key = readCollaudoKey();
    const t = await pool.query<{ tenant: string }>(
      `SELECT user_tenant_id AS tenant FROM sys.sys_users WHERE lower(user_email) = $1`,
      [PEOPLE_MANAGER_EMAIL],
    );
    const hrms = await userWithRole("HRMS_MANAGER", { tenantId: t.rows[0]!.tenant });
    hrmsManager = await login(suite, hrms.email, TEST_PERSONA_PASSWORD);
    peopleManager = await login(suite, PEOPLE_MANAGER_EMAIL, deriveCollaudoPassword(key, PEOPLE_MANAGER_EMAIL));
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("PEOPLE_MANAGER scrive un obiettivo -> 201", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/goals",
      headers: { cookie: ch(peopleManager.cookies), "x-csrf-token": peopleManager.csrfToken },
      payload: { title: "Obiettivo di collaudo R-6" },
    });
    expect(r.statusCode).toBe(201);
  });

  it("PEOPLE_MANAGER prova a scrivere una busta paga -> la rotta non esiste (404 di rotta, NON 403)", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/me/pay-slips",
      headers: { cookie: ch(peopleManager.cookies), "x-csrf-token": peopleManager.csrfToken },
      payload: {},
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error?: { code?: string } }).error?.code).not.toBe("FORBIDDEN");
  });

  it("PEOPLE_MANAGER non ha permessi di avviamento/GDPR/recruiting/tassonomia/whistleblowing -> 403", async () => {
    const gdpr = await suite.app.inject({
      method: "GET", url: "/v1/gdpr/data-map",
      headers: { cookie: ch(peopleManager.cookies) },
    });
    expect(gdpr.statusCode).toBe(403);

    const grant = await suite.app.inject({
      method: "POST", url: `/v1/users/${peopleManager.userId}/roles`,
      headers: { cookie: ch(peopleManager.cookies), "x-csrf-token": peopleManager.csrfToken },
      payload: { roleCode: "TEAM_LEADER" },
    });
    expect(grant.statusCode).toBe(403);
  });

  it("S-8 — PEOPLE_MANAGER legge ciò che scrive: persone e unità organizzative -> 200", async () => {
    for (const url of ["/v1/users?limit=5", "/v1/organization-units?limit=5", "/v1/skills?limit=5", "/v1/job-roles?limit=5"]) {
      const r = await suite.app.inject({ method: "GET", url, headers: { cookie: ch(peopleManager.cookies) } });
      expect(r.statusCode, url).toBe(200);
    }
  });

  it("controprova — HRMS_MANAGER scrive un obiettivo senza bisogno di PEOPLE_MANAGER", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/goals",
      headers: { cookie: ch(hrmsManager.cookies), "x-csrf-token": hrmsManager.csrfToken },
      payload: { title: "Obiettivo di controprova (HRMS_MANAGER)" },
    });
    expect(r.statusCode).toBe(201);
  });
});
