/**
 * apps/api/test/assessment-methods.integration.test.ts
 * Catalog endpoint — 5 seeded methods, requires assessment:read.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";

interface S { cookies: Map<string, string> }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

let suite: TestApp;
let tenantS: S;

describe("/v1/assessment-methods integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "tenant_admin_test@rtl-bank.test");
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("GET / returns the 5 seeded methods", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/assessment-methods",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<{ code: string }>; total: number };
    expect(body.total).toBe(5);
    const codes = body.items.map((m) => m.code).sort();
    expect(codes).toEqual(["EVIDENCE_BASED", "MANAGER_DIRECT", "NARRATIVE", "PEER_360", "RATING"]);
  });

  it("Unauthenticated GET / → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/assessment-methods" });
    expect(r.statusCode).toBe(401);
  });
});
