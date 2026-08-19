/**
 * apps/api/test/whistleblowing.integration.test.ts — #51 E/E1 (D.Lgs 24/2023).
 *
 * The two legal requirements are the two things this suite must prove on live data:
 *
 *  1. ANONYMOUS PUBLIC CHANNEL — submit with no auth, get a tracking code, follow the case
 *     by that code alone. No reporter identity is stored.
 *
 *  2. CUSTODIAN ISOLATION (derogation from ADR-0027) — the reports are readable ONLY by the
 *     WHISTLEBLOWING_CUSTODIAN role. Not by a MANAGER, not by TENANT_ADMIN, and — the part
 *     that matters most — NOT by PLATFORM_ADMIN, despite its blanket grant. This is the
 *     whole compliance point, so it is asserted explicitly against the two admin roles.
 *
 * The custodian role is granted to a persona in beforeAll and rolled back by the file
 * transaction (D-52). Every expectation is derived from the live responses.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

import { senzaCacheDiSessione } from "./helpers/session-cache.js";

// Z-251 F2 — fuori dalla cache delle sessioni. Questo file o ragiona sulla SESSIONE stessa
// (elenco/revoca delle famiglie), oppure MUTA i ruoli dell'attore: in entrambi i casi una
// sessione presa da un altro file risponderebbe con un assetto che non e' quello che il
// test ha appena costruito. Misurato: senza questa riga, 6 file rossi in corsa integrale.
senzaCacheDiSessione();

const PWD = TEST_PERSONA_PASSWORD;
interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const b = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: b.csrfToken, userId: b.user.userId };
}

let suite: TestApp;
let custodian: S; // antonio.parisi, granted WHISTLEBLOWING_CUSTODIAN in beforeAll
let platformAdmin: S; // enzo.spenuso@heuresys.com — must NOT see reports
let tenantAdmin: S; // federica — must NOT see reports

describe("#51 E1 — whistleblowing (D.Lgs 24/2023)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    // Grant the custodian role to antonio BEFORE he logs in, so his JWT carries it.
    const antonio = await pool.query<{ id: string; tenant: string }>(
      `SELECT user_id AS id, user_tenant_id AS tenant FROM sys.sys_users WHERE user_email = $1`,
      ["antonio.parisi@rtl-bank.org"],
    );
    const role = await pool.query<{ id: string }>(
      `SELECT auth_role_id AS id FROM sys.sys_auth_roles WHERE auth_role_code = 'WHISTLEBLOWING_CUSTODIAN'`,
    );
    await pool.query(
      `INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [antonio.rows[0]!.id, role.rows[0]!.id, antonio.rows[0]!.tenant],
    );

    custodian = await login(suite, "antonio.parisi@rtl-bank.org");
    platformAdmin = await login(suite, "enzo.spenuso@heuresys.com");
    tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  }, 60_000);

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  async function submit(payload: Record<string, unknown>) {
    return suite.app.inject({
      method: "POST", url: "/v1/whistleblowing",
      headers: { "content-type": "application/json" }, // NO auth — public channel
      payload,
    });
  }

  it("anonymous submit returns a tracking code and stores no reporter identity", async () => {
    const r = await submit({ category: "HARASSMENT", subject: "Test report subject", body: "A detailed description of the concern being raised for the test." });
    expect(r.statusCode).toBe(200);
    const code = (r.json() as { trackingCode: string }).trackingCode;
    expect(code).toMatch(/^WB-/);

    // Stored row carries no user id (anonymity is structural).
    const row = await pool.query<{ contact: string | null; assignee: string | null }>(
      `SELECT whistleblowing_report_contact AS contact, whistleblowing_report_assignee_user_id AS assignee
         FROM sys.sys_whistleblowing_reports WHERE whistleblowing_report_tracking_code = $1`,
      [code],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]!.contact).toBeNull();
    expect(row.rows[0]!.assignee).toBeNull();
  });

  it("the reporter follows the case by code — public, and public-safe fields only", async () => {
    const code = (await submit({ category: "FRAUD", subject: "Another concern", body: "Body text long enough to pass validation for this case." }).then((r) => r.json())) as { trackingCode: string };
    const r = await suite.app.inject({ method: "GET", url: `/v1/whistleblowing/status/${code.trackingCode}` }); // no auth
    expect(r.statusCode).toBe(200);
    const b = r.json() as Record<string, unknown>;
    expect(b.status).toBe("NEW");
    // the public projection must NOT leak the body / internal notes / contact
    expect(b).not.toHaveProperty("body");
    expect(b).not.toHaveProperty("internalNotes");
    expect(b).not.toHaveProperty("contact");
  });

  it("an unknown tracking code is a 404, not an enumeration hint", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/whistleblowing/status/WB-NOSUCHCODE99" });
    expect(r.statusCode).toBe(404);
  });

  it("honeypot submissions are accepted but NOT stored", async () => {
    const before = (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM sys.sys_whistleblowing_reports`)).rows[0]!.n;
    const r = await submit({ category: "OTHER", subject: "bot subject", body: "bot body long enough to validate.", website: "http://spam.example" });
    expect(r.statusCode).toBe(200); // don't tip off the bot
    const after = (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM sys.sys_whistleblowing_reports`)).rows[0]!.n;
    expect(after).toBe(before); // nothing persisted
  });

  it("the CUSTODIAN can read the console", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/whistleblowing/reports", headers: { cookie: ch(custodian.cookies) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBeGreaterThan(0);
  });

  it("ISOLATION: PLATFORM_ADMIN is denied the console (blanket grant notwithstanding)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/whistleblowing/reports", headers: { cookie: ch(platformAdmin.cookies) } });
    expect(r.statusCode).toBe(403);
  });

  it("ISOLATION: TENANT_ADMIN is denied the console", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/whistleblowing/reports", headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(r.statusCode).toBe(403);
  });

  it("the custodian manages a report (status + public message); the code lookup reflects it", async () => {
    const code = ((await submit({ category: "SAFETY", subject: "Manage me", body: "Body long enough to validate the manage flow." }).then((r) => r.json())) as { trackingCode: string }).trackingCode;
    const list = (await suite.app.inject({ method: "GET", url: "/v1/whistleblowing/reports", headers: { cookie: ch(custodian.cookies) } }).then((r) => r.json())) as { items: { reportId: string; trackingCode: string }[] };
    const target = list.items.find((i) => i.trackingCode === code)!;
    expect(target).toBeDefined();

    const upd = await suite.app.inject({
      method: "PATCH", url: `/v1/whistleblowing/reports/${target.reportId}`,
      headers: { cookie: ch(custodian.cookies), "x-csrf-token": custodian.csrfToken, "content-type": "application/json" },
      payload: { status: "UNDER_REVIEW", publicMessage: "We have received your report and are reviewing it." },
    });
    expect(upd.statusCode).toBe(200);

    const pub = (await suite.app.inject({ method: "GET", url: `/v1/whistleblowing/status/${code}` }).then((r) => r.json())) as Record<string, unknown>;
    expect(pub.status).toBe("UNDER_REVIEW");
    expect(pub.publicMessage).toBe("We have received your report and are reviewing it.");
  });
});
