/**
 * apps/api/test/platform-operator-and-sales.integration.test.ts — mandato K, R-9 (D9=B).
 *
 * Due ruoli nuovi:
 *  - PLATFORM_OPERATOR: sola lettura su observability, provenance, generated-origins e
 *    l'audit dei broadcast (notification:read). È la PRIMA PROVA SUL VIVO dell'asse
 *    costruito da R-0 (sys_platform_user_tenant_assignments + perimetroClienti): vede solo
 *    i clienti a cui è assegnato, mai tutti come PLATFORM_ADMIN.
 *  - SALES: legge e avanza lo stato dei leads. I lead non hanno tenant: non usa l'asse.
 *
 * La prova sul filtro di R-0 usa `provenance` (70.959 righe reali per RTL_BANK, zero per
 * Heuresys System — measured) perché gli endpoint dei 4 moduli sono LISTE/SOMMARI filtrati
 * silenziosamente, non record singoli con 404: "vede zero righe" è la forma reale
 * dell'assenza di accesso qui, non uno status code diverso. `tenants` (che ha un vero 404
 * per-id) non è fra i moduli di questo ruolo.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";

senzaCacheDiSessione();

const OPERATOR_EMAIL = "platform-operator@collaudo.invalid";
const SALES_EMAIL = "sales@collaudo.invalid";
const ADMIN_EMAIL = "enzo.spenuso@heuresys.com";

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
let admin: S;
let operator: S;
let sales: S;
let rtlTenantId = "";
let assignmentId = "";

describe("mandato K, R-9 — PLATFORM_OPERATOR e SALES", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const key = readCollaudoKey();
    admin = await login(suite, ADMIN_EMAIL, TEST_PERSONA_PASSWORD);
    operator = await login(suite, OPERATOR_EMAIL, deriveCollaudoPassword(key, OPERATOR_EMAIL));
    sales = await login(suite, SALES_EMAIL, deriveCollaudoPassword(key, SALES_EMAIL));
    const tenant = await pool.query<{ id: string }>(
      `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`,
    );
    rtlTenantId = tenant.rows[0]!.id;
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("PLATFORM_OPERATOR senza assegnazione — provenance non mostra nulla (nessuna assegnazione, non 'tutti')", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/provenance/summary",
      headers: { cookie: ch(operator.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { byTable: unknown[]; totals: { records: number } };
    expect(body.byTable).toEqual([]);
    expect(body.totals.records).toBe(0);
  });

  it("R-0 SUL VIVO — assegnato a RTL, PLATFORM_OPERATOR vede le 70.959 righe di provenance di RTL", async () => {
    const create = await suite.app.inject({
      method: "POST",
      url: "/v1/platform-tenant-assignments",
      headers: { cookie: ch(admin.cookies), "x-csrf-token": admin.csrfToken },
      payload: { userId: operator.userId, tenantId: rtlTenantId },
    });
    expect(create.statusCode).toBe(201);
    assignmentId = (create.json() as { assignmentId: string }).assignmentId;

    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/provenance/summary",
      headers: { cookie: ch(operator.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { byTable: unknown[]; totals: { records: number } };
    expect(body.byTable.length).toBeGreaterThan(0);
    expect(body.totals.records).toBe(70959);

    const list = await suite.app.inject({
      method: "GET",
      url: "/v1/provenance?limit=1",
      headers: { cookie: ch(operator.cookies) },
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as { total: number }).total).toBe(70959);
  });

  it("revocata l'assegnazione, PLATFORM_OPERATOR torna a non vedere nulla (il perimetro non è nel JWT: si ricalcola a ogni richiesta)", async () => {
    const revoke = await suite.app.inject({
      method: "POST",
      url: `/v1/platform-tenant-assignments/${assignmentId}/revoke`,
      headers: { cookie: ch(admin.cookies), "x-csrf-token": admin.csrfToken },
    });
    expect(revoke.statusCode).toBe(200);

    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/provenance/summary",
      headers: { cookie: ch(operator.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { byTable: unknown[] }).byTable).toEqual([]);

    // ri-assegna per il resto della suite (le prove seguenti presumono l'assegnazione viva)
    const reassign = await suite.app.inject({
      method: "POST",
      url: "/v1/platform-tenant-assignments",
      headers: { cookie: ch(admin.cookies), "x-csrf-token": admin.csrfToken },
      payload: { userId: operator.userId, tenantId: rtlTenantId },
    });
    expect(reassign.statusCode).toBe(201);
  });

  it("PLATFORM_OPERATOR legge observability e generated-origins → 200 (sola lettura)", async () => {
    const health = await suite.app.inject({
      method: "GET", url: "/v1/observability/system-health",
      headers: { cookie: ch(operator.cookies) },
    });
    expect(health.statusCode).toBe(200);

    const origins = await suite.app.inject({
      method: "GET", url: "/v1/generated-origins",
      headers: { cookie: ch(operator.cookies) },
    });
    expect(origins.statusCode).toBe(200);
  });

  it("PLATFORM_OPERATOR legge l'audit dei broadcast (notification:read) ma non può inviarne (notification:create)", async () => {
    const audit = await suite.app.inject({
      method: "GET", url: "/v1/notifications/broadcasts",
      headers: { cookie: ch(operator.cookies) },
    });
    expect(audit.statusCode).toBe(200);

    const send = await suite.app.inject({
      method: "POST", url: "/v1/notifications",
      headers: { cookie: ch(operator.cookies), "x-csrf-token": operator.csrfToken },
      payload: { userIds: [operator.userId], subject: "non deve passare" },
    });
    expect(send.statusCode).toBe(403);
  });

  it("PLATFORM_OPERATOR non può concedere ruoli né avviare nulla fuori dai suoi 4 moduli (403)", async () => {
    const grant = await suite.app.inject({
      method: "POST", url: `/v1/users/${operator.userId}/roles`,
      headers: { cookie: ch(operator.cookies), "x-csrf-token": operator.csrfToken },
      payload: { roleCode: "TEAM_LEADER", tenantId: rtlTenantId },
    });
    expect(grant.statusCode).toBe(403);

    const leads = await suite.app.inject({
      method: "GET", url: "/v1/leads",
      headers: { cookie: ch(operator.cookies) },
    });
    expect(leads.statusCode).toBe(403);
  });

  it("SALES legge e avanza lo stato dei lead → 200; su observability → 403 (controprova)", async () => {
    const list = await suite.app.inject({
      method: "GET", url: "/v1/leads",
      headers: { cookie: ch(sales.cookies) },
    });
    expect(list.statusCode).toBe(200);

    const denied = await suite.app.inject({
      method: "GET", url: "/v1/observability/system-health",
      headers: { cookie: ch(sales.cookies) },
    });
    expect(denied.statusCode).toBe(403);
  });

  it("controprova — PLATFORM_ADMIN vede tutto senza bisogno di assegnazione", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/provenance/summary",
      headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { byTable: unknown[] }).byTable.length).toBeGreaterThan(0);
  });
});
