import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const E2E_DOMAIN = "@leads-it.test";

function cookieHeader(cookies: { name: string; value: string }[]) {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

let suite: TestApp;
let adminCookies: string;
let adminCsrf: string;

beforeAll(async () => {
  suite = await buildTestApp();
  const r = await loginRaw(suite.app, "admin@heuresys.com", PWD);
  adminCookies = cookieHeader(r.cookies);
  adminCsrf = (r.json() as { csrfToken: string }).csrfToken;
  await pool.query(`DELETE FROM sys.sys_leads WHERE lead_email LIKE $1`, [`%${E2E_DOMAIN}`]);
});

afterAll(async () => {
  await pool.query(`DELETE FROM sys.sys_leads WHERE lead_email LIKE $1`, [`%${E2E_DOMAIN}`]);
  await suite.app.close();
});

describe("/v1/leads (GTM lead capture)", () => {
  it("public POST stores a lead (no auth, no CSRF)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/leads",
      payload: { name: "Mario Rossi", company: "Banca X", email: `mario${E2E_DOMAIN}`, companySize: "250_2000", consent: true },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
    const { rows } = await pool.query(`SELECT lead_consent_version FROM sys.sys_leads WHERE lead_email=$1`, [`mario${E2E_DOMAIN}`]);
    expect(rows.length).toBe(1);
    expect(rows[0].lead_consent_version).toBe("2026-06-21-v1");
  });

  it("honeypot-filled POST returns ok but stores nothing", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/leads",
      payload: { name: "Bot", company: "Spam", email: `bot${E2E_DOMAIN}`, consent: true, website: "http://spam" },
    });
    expect(r.statusCode).toBe(200);
    const { rows } = await pool.query(`SELECT 1 FROM sys.sys_leads WHERE lead_email=$1`, [`bot${E2E_DOMAIN}`]);
    expect(rows.length).toBe(0);
  });

  it("missing consent → 400", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/leads",
      payload: { name: "No Consent", company: "X", email: `nc${E2E_DOMAIN}` },
    });
    expect(r.statusCode).toBe(400);
  });

  it("GET as PLATFORM_ADMIN lists leads", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/leads", headers: { cookie: adminCookies, "x-csrf-token": adminCsrf } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { email: string }[]; total: number };
    expect(body.items.some((x) => x.email === `mario${E2E_DOMAIN}`)).toBe(true);
  });

  it("GET without auth → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/leads" });
    expect(r.statusCode).toBe(401);
  });

  it("GET as a non-admin (MANAGER) → 403", async () => {
    const m = await loginRaw(suite.app, "paolo.caputo@rtl-bank.org", PWD);
    const managerCookies = cookieHeader(m.cookies);
    const managerCsrf = (m.json() as { csrfToken: string }).csrfToken;
    const r = await suite.app.inject({
      method: "GET", url: "/v1/leads",
      headers: { cookie: managerCookies, "x-csrf-token": managerCsrf },
    });
    expect(r.statusCode).toBe(403);
  });
});
