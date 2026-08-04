/**
 * apps/api/test/compensation-mask.integration.test.ts
 *
 * #124 — the fourth authorization state, proved on the wire.
 *
 * Enzo's decision of 2026-08-04: the technical administrator stops seeing
 * salaries, but still knows they exist. That is neither `read` nor `403`, and
 * until `apps/api/src/lib/scope/mask.ts` it had no implementation.
 *
 * The assertion that matters is NOT "the object has a `masked` field". It is
 * that the true amount is absent from the SERIALIZED RESPONSE — the raw body
 * string, read at the level the network sees. A mask that leaves the value in
 * a sibling field, in the narrative, or inside an untyped payload is cosmetic,
 * and a test that only inspects the parsed field it already knows about would
 * pass over exactly that failure.
 *
 * Every expected value is read from the live database, never written here.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { passwordFor } from "./helpers/personas.js";

const PLATFORM_EMAIL = "admin@heuresys.com";
const HR_MANDATE_EMAIL = "federica.marchetti@rtl-bank.org"; // TENANT_ADMIN — keeps access by I20

interface Session {
  cookies: Map<string, string>;
}

function cookieHeader(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function login(t: TestApp, email: string): Promise<Session> {
  const r = await loginRaw(t.app, email, passwordFor(email));
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

let t: TestApp;
let platform: Session;
let hrMandate: Session;

/** The true amounts, straight from the table — the values the mask must hide. */
let trueAmounts: string[] = [];

beforeAll(async () => {
  t = await buildTestApp();
  platform = await login(t, PLATFORM_EMAIL);
  hrMandate = await login(t, HR_MANDATE_EMAIL);
  const { rows } = await pool.query<{ amount: string }>(
    `SELECT DISTINCT compensation_recommendation_amount_eur AS amount
       FROM sys.sys_compensation_recommendations
      WHERE compensation_recommendation_amount_eur IS NOT NULL
        AND compensation_recommendation_amount_eur <> 0`,
  );
  trueAmounts = rows.map((r) => r.amount);
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

async function listAs(s: Session): Promise<{ raw: string; items: Record<string, unknown>[] }> {
  const res = await t.app.inject({
    method: "GET",
    url: "/v1/compensation/recommendations?limit=100",
    headers: { cookie: cookieHeader(s.cookies) },
  });
  expect(res.statusCode, `list failed: ${res.body.slice(0, 300)}`).toBe(200);
  return { raw: res.body, items: (res.json() as { items: Record<string, unknown>[] }).items };
}

describe("#124 — compensation is masked under the platform mandate", () => {
  /**
   * The guard on the guard. If the table were empty, or the HR mandate saw
   * nothing either, every assertion below would hold vacuously and this file
   * would certify nothing.
   */
  it("runs on a universe where it CAN fail", async () => {
    expect(trueAmounts.length, "no non-zero amounts in the table — nothing to hide").toBeGreaterThan(0);
    const { items } = await listAs(hrMandate);
    expect(items.length, "the HR mandate sees no rows — the mask cannot be shown to differ").toBeGreaterThan(0);
  });

  it("keeps the row and its period, and takes the money fields", async () => {
    const { items } = await listAs(platform);
    expect(items.length).toBeGreaterThan(0);

    for (const row of items) {
      // The administrator must still know the record exists, and for when.
      expect(row["compensationRecommendationId"]).toBeTruthy();
      expect(row["periodStart"]).toBeTruthy();
      expect(row["periodEnd"]).toBeTruthy();
      expect(row["signal"]).toBeTruthy();

      // ...and must be TOLD what was withheld, rather than shown a zero.
      expect(row["masked"]).toEqual(["amountEur", "narrative", "payload"]);
      expect(Object.hasOwn(row, "amountEur"), "amountEur must be ABSENT, not null").toBe(false);
      expect(Object.hasOwn(row, "narrative")).toBe(false);
      expect(Object.hasOwn(row, "payload")).toBe(false);
    }
  });

  /**
   * The falsifiable one. Reads the response as bytes, not as an object: if the
   * amount survives anywhere — another field, the narrative, a nested payload —
   * this fails, and that is precisely the cosmetic-mask failure mode.
   */
  it("leaves no true amount anywhere in the serialized response", async () => {
    const { raw } = await listAs(platform);
    const leaked = trueAmounts.filter((a) => raw.includes(a));
    expect(leaked, "these true amounts survived in the response body").toEqual([]);
    // ...and the percentage that the untyped payload carries alongside them.
    expect(raw.includes("increase_percent"), "the legacy payload leaked").toBe(false);
  });

  /**
   * I20 — an HR mandate keeps tenant-wide sensitive access. Without this the
   * suite could not distinguish "the mask works" from "the endpoint returns
   * nothing to anybody".
   */
  it("does not mask for an actor holding the HR mandate", async () => {
    const { raw, items } = await listAs(hrMandate);
    expect(items.length).toBeGreaterThan(0);
    for (const row of items) {
      expect(row["masked"], "an HR-mandated read must not be masked").toBeUndefined();
      expect(Object.hasOwn(row, "amountEur")).toBe(true);
    }
    expect(
      trueAmounts.some((a) => raw.includes(a)),
      "the HR mandate saw no real amount — the comparison with the masked read is meaningless",
    ).toBe(true);
  });
});
