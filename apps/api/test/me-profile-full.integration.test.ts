/**
 * apps/api/test/me-profile-full.integration.test.ts
 * GET /v1/me/profile/full — aggregate anagraphic/employment profile (mig 000164),
 * fed by REAL legacy-imported data (seed 14_user_anagraphic_satellites). LIVE data
 * assertions against the rebuilt RTL_BANK tenant — no mocks, no fixtures.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { MeProfileFull } from "@heuresys/shared";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool, pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
interface S { cookies: Map<string, string>; userId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { user: { userId: string } };
  return { cookies, userId: body.user.userId };
}

let suite: TestApp;
let tommaso: S;

describe("GET /v1/me/profile/full", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tommaso = await login(suite, "tommaso.fiore@rtl-bank.org");
  });
  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("returns the caller's aggregate profile with real imported anagraphic data", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/profile/full", headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as MeProfileFull;

    // self-scope: the payload is the caller's own
    expect(b.userId).toBe(tommaso.userId);
    expect(b.identity.firstName).toBe("Tommaso");
    expect(b.identity.lastName).toBe("Fiore");

    // Livello 3a — real imported anagraphic identity (no-PII abandoned)
    expect(b.identity.taxId).toBe("FRITMS89A26F205S");
    expect(b.identity.birthPlace).toBe("Como");
    expect(b.identity.gender).toBe("MALE");
    expect(b.identity.maritalStatus).toBe("SINGLE");

    // identity documents + addresses populated from the import
    expect(Array.isArray(b.documents)).toBe(true);
    expect(b.documents.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(b.addresses)).toBe(true);
    expect(b.addresses.length).toBeGreaterThanOrEqual(1);
    expect(b.addresses.some((a) => a.kind === "PERMANENT")).toBe(true);

    // employment (compensation + SAP) imported, salary coerced to number.
    // payScaleLevel derived live (it legitimately changes with CCNL re-leveling
    // seeds — S1024/S1025); pernr is the stable SAP identity.
    expect(b.employment).not.toBeNull();
    const emp = b.employment!;
    expect(typeof emp.salary).toBe("number");
    const { rows: lvlRows } = await pool.query<{ lvl: string | null }>(
      `SELECT e.user_employment_pay_scale_level AS lvl
         FROM sys.sys_user_employment e
         JOIN sys.sys_users u ON u.user_id = e.user_employment_user_id
        WHERE u.user_email = 'tommaso.fiore@rtl-bank.org'`,
    );
    expect(emp.payScaleLevel).toBe(lvlRows[0]?.lvl ?? null);
    expect(emp.pernr).toBe("00000390");

    // banking imported
    expect(b.banking?.bankName).toBe("Banca Generali");

    // auth summary present
    expect(b.auth.roles.length).toBeGreaterThan(0);
  });

  it("returns the caller's contracts from the imported legacy history (mig 000165)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/contracts", headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { items: Array<{ ccnlType: string | null; grossAnnualSalary: number | null }>; total: number };
    expect(b.total).toBeGreaterThanOrEqual(1);
    expect(b.items.length).toBe(b.total);
    const c = b.items[0]!;
    expect(c.ccnlType).toBe("CCNL Credito 2024");
    expect(typeof c.grossAnnualSalary).toBe("number");
  });

  it("returns the caller's performance reviews (F3a, read-only)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/performance", headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { items: Array<{ overallRating: number | null }>; total: number };
    expect(b.total).toBeGreaterThanOrEqual(1);
    expect(typeof b.items[0]!.overallRating).toBe("number");
  });

  it("returns the caller's attendance/leave consultation (F3a)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/attendance", headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { recent: unknown[]; overtime: unknown[]; leaveBalances: unknown[] };
    expect(Array.isArray(b.recent)).toBe(true);
    expect(Array.isArray(b.overtime)).toBe(true);
    expect(b.leaveBalances.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects an unauthenticated request", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/profile/full" });
    expect(r.statusCode).toBe(401);
  });
});
