/**
 * apps/api/test/skill-proficiency-levels.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let userS: S;

describe("/v1/skill-proficiency-levels/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("LIST returns 6 levels in rank order (NOVICE..MASTER)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/skill-proficiency-levels",
      headers: { cookie: ch(userS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      items: Array<{ code: string; rank: number; name: string }>;
      total: number;
    };
    expect(body.total).toBe(6);
    expect(body.items.map((i) => i.code)).toEqual([
      "NOVICE", "BASIC", "COMPETENT", "PROFICIENT", "EXPERT", "MASTER",
    ]);
    expect(body.items.map((i) => i.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("Unauthenticated → 401", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/skill-proficiency-levels",
    });
    expect(r.statusCode).toBe(401);
  });
});
