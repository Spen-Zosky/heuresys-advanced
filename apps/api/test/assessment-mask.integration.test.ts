/**
 * apps/api/test/assessment-mask.integration.test.ts
 *
 * #124 / ADR-0032, second half — Enzo's decision named "stipendi **e
 * valutazioni**". The pay half is covered by compensation-mask; this is the
 * judgment half.
 *
 * The assertion is again made on the SERIALIZED BODY rather than the parsed
 * object, but the leak-detection is shaped differently on purpose. Measured on
 * the live table (2026-08-04): `narrative` is NULL on all 1560 rows and
 * `metadata` is `{}` on all of them, so the entire judgment sits in `score` —
 * and `score` holds only 4 distinct small numbers, which would match half the
 * ids and dates in the payload if searched as a substring. So the body check
 * looks for the KEY: `"score":` must not occur at all. A mask that nulled the
 * field instead of removing it would emit `"score":null` and fail here, which
 * is exactly the "declared, not lied about" constraint.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { passwordFor } from "./helpers/personas.js";

const PLATFORM_EMAIL = "enzo.spenuso@heuresys.com";
const HR_MANDATE_EMAIL = "federica.marchetti@rtl-bank.org"; // TENANT_ADMIN — keeps access by I20

function cookieHeader(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function login(t: TestApp, email: string): Promise<Map<string, string>> {
  const r = await loginRaw(t.app, email, passwordFor(email));
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return cookies;
}

let t: TestApp;
let platform: Map<string, string>;
let hrMandate: Map<string, string>;
let scoredRows = 0;

beforeAll(async () => {
  t = await buildTestApp();
  platform = await login(t, PLATFORM_EMAIL);
  hrMandate = await login(t, HR_MANDATE_EMAIL);
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_assessment_results
      WHERE assessment_result_score IS NOT NULL`,
  );
  scoredRows = Number(rows[0]?.n ?? 0);
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

async function listAs(c: Map<string, string>) {
  const res = await t.app.inject({
    method: "GET",
    url: "/v1/assessment-results?limit=100",
    headers: { cookie: cookieHeader(c) },
  });
  expect(res.statusCode, `list failed: ${res.body.slice(0, 300)}`).toBe(200);
  return { raw: res.body, items: (res.json() as { items: Record<string, unknown>[] }).items };
}

describe("#124 — evaluations are masked under the platform mandate", () => {
  it("runs on a universe where it CAN fail", async () => {
    expect(scoredRows, "no scored evaluation in the table — nothing to withhold").toBeGreaterThan(0);
    const { items } = await listAs(hrMandate);
    expect(items.length, "the HR mandate sees no evaluation — the mask cannot be shown to differ")
      .toBeGreaterThan(0);
  });

  it("keeps the dimension, the assessor and the date, and takes the judgment", async () => {
    const { items } = await listAs(platform);
    expect(items.length).toBeGreaterThan(0);
    for (const row of items) {
      expect(row["dimension"]).toBeTruthy();
      expect(row["recordedAt"]).toBeTruthy();
      expect(row["masked"]).toEqual(["metadata", "narrative", "score"]);
      expect(Object.hasOwn(row, "score"), "score must be ABSENT, not null").toBe(false);
      expect(Object.hasOwn(row, "narrative")).toBe(false);
      expect(Object.hasOwn(row, "metadata")).toBe(false);
    }
  });

  it("emits no score key at all in the serialized response", async () => {
    const { raw } = await listAs(platform);
    // `"score":` — the KEY with its colon, not the bare word: the word occurs
    // legitimately inside the `masked` array, which is the DECLARATION that the
    // field was withheld. (First written as a bare-word search, which flagged
    // its own declaration as a leak.)
    expect(raw.includes('"score":'), "the score key survived in the response body").toBe(false);
    expect(raw.includes('"narrative":')).toBe(false);
    expect(raw.includes('"metadata":')).toBe(false);
  });

  it("does not mask for an actor holding the HR mandate", async () => {
    const { raw, items } = await listAs(hrMandate);
    expect(items.length).toBeGreaterThan(0);
    for (const row of items) expect(row["masked"]).toBeUndefined();
    expect(raw.includes('"score":'),
      "the HR mandate saw no score — the comparison with the masked read is meaningless",
    ).toBe(true);
  });
});
