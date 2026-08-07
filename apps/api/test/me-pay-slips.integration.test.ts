/**
 * apps/api/test/me-pay-slips.integration.test.ts
 * S1011 F4 — GET /v1/me/pay-slips (Cedolini tab, mig 000167 + seed 16).
 * Self-scoped (user_profile:read:self). antonio.parisi has real pay-slips;
 * the platform technical account has none (honest empty-state) — derived, since
 * S1024 gave slips to every RTL employee.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool, pool } from "../src/db/client.js";
import type { MePaySlipsResponse } from "@heuresys/shared";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

async function cookie(t: TestApp, email: string): Promise<string> {
  const r = await loginRaw(t.app, email, PWD);
  return r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
function get(t: TestApp, c: string, url: string) {
  return t.app.inject({ method: "GET", url, headers: { cookie: c } });
}

let suite: TestApp;
let withSlips: string;    // antonio.parisi — imported pay-slips
let noSlips: string;      // enzo.spenuso@heuresys.com — platform account, never has slips

describe("/v1/me/pay-slips — F4 cedolini", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    withSlips = await cookie(suite, "antonio.parisi@rtl-bank.org");
    // empty-state persona must be derived, not assumed: since S1024 every RTL
    // employee has slips — the platform technical account is the slip-less one.
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_user_pay_slips s
        JOIN sys.sys_users u ON u.user_id = s.user_pay_slip_user_id
       WHERE u.user_email = 'enzo.spenuso@heuresys.com'`,
    );
    expect(Number(rows[0]?.n ?? -1), "enzo.spenuso@heuresys.com deve essere senza cedolini").toBe(0);
    noSlips = await cookie(suite, "enzo.spenuso@heuresys.com");
  });
  afterAll(async () => { await suite.app.close(); await closePool(); });

  it("returns the caller's own pay-slips (real imported data)", async () => {
    const r = await get(suite, withSlips, "/v1/me/pay-slips");
    expect(r.statusCode).toBe(200);
    const body = r.json() as MePaySlipsResponse;
    expect(body.total).toBe(body.items.length);
    // expected count derived from the live table (no pinned slip count)
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_user_pay_slips s
        JOIN sys.sys_users u ON u.user_id = s.user_pay_slip_user_id
       WHERE u.user_email = 'antonio.parisi@rtl-bank.org'`,
    );
    expect(body.total).toBe(Number(rows[0]?.n ?? -1));
    expect(body.total).toBeGreaterThan(0);
    const first = body.items[0]!;
    expect(first).toHaveProperty("period");
    expect(typeof first.grossPay).toBe("number");
    expect(typeof first.netPay).toBe("number");
    expect(first.deductions).toBeTypeOf("object"); // {INPS, IRPEF, total}
  });

  it("returns an honest empty-state for a user with no slips", async () => {
    const r = await get(suite, noSlips, "/v1/me/pay-slips");
    expect(r.statusCode).toBe(200);
    const body = r.json() as MePaySlipsResponse;
    expect(body.total).toBe(0);
    expect(body.items).toEqual([]);
  });

  it("rejects unauthenticated access", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/pay-slips" });
    expect([401, 403]).toContain(r.statusCode);
  });
});
