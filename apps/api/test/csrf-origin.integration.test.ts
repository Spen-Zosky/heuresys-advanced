/**
 * apps/api/test/csrf-origin.integration.test.ts
 * F-007/F-010: the CSRF Origin/Referer defence-in-depth check compares the PARSED origin for
 * EXACT equality. A startsWith prefix match previously let look-alike hosts through
 * (ADMIN_ORIGIN "http://localhost:3000" vs "http://localhost:30000", or "<origin>.evil.com").
 * Exercises a CSRF-protected mutation (PATCH /v1/me/preferences) with crafted Origin headers.
 * Origins are DERIVED from env.ADMIN_ORIGIN (no hardcoded host — self-consistent with the app).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { env } from "../src/config/env.js";
import { pool, closePool } from "../src/db/client.js";

const ALLOWED = new URL(env.ADMIN_ORIGIN).origin;
// "<allowed>0" is a universally-valid look-alike that PASSES the old startsWith check but has a
// different origin: "http://localhost:3000" -> "http://localhost:30000", "https://x.com" -> "https://x.com0".
const LOOKALIKE = `${ALLOWED}0`;

interface S {
  cookies: Map<string, string>;
  csrfToken: string;
  userId: string;
}
function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

let suite: TestApp;
let s: S;

async function patchPrefs(origin: string | undefined, opts: { csrf?: boolean } = {}) {
  const headers: Record<string, string> = { cookie: ch(s.cookies), "content-type": "application/json" };
  if (opts.csrf !== false) headers["x-csrf-token"] = s.csrfToken;
  if (origin !== undefined) headers["origin"] = origin;
  return suite.app.inject({ method: "PATCH", url: "/v1/me/preferences", headers, payload: { locale: "it" } });
}

describe("CSRF Origin/Referer exact-match (F-007/F-010)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const r = await loginRaw(suite.app, "tommaso.fiore@rtl-bank.org", TEST_PERSONA_PASSWORD);
    const cookies = new Map<string, string>();
    for (const c of r.cookies) cookies.set(c.name, c.value);
    const body = r.json() as { csrfToken: string; user: { userId: string } };
    s = { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM sys.sys_user_preferences WHERE user_preference_user_id = $1`, [s.userId]);
    await suite.app.close();
    await closePool();
  });

  it("accepts a mutation from the exact allowed origin", async () => {
    const r = await patchPrefs(ALLOWED);
    expect(r.statusCode).toBe(200);
  });

  it("rejects a prefix look-alike origin (old startsWith would have allowed it)", async () => {
    const r = await patchPrefs(LOOKALIKE);
    expect(r.statusCode).toBe(403);
    expect(r.json()).toMatchObject({ error: { code: "ORIGIN_MISMATCH" } });
  });

  it("rejects a foreign origin", async () => {
    const r = await patchPrefs("https://evil.example");
    expect(r.statusCode).toBe(403);
    expect(r.json()).toMatchObject({ error: { code: "ORIGIN_MISMATCH" } });
  });

  it("rejects a malformed origin header", async () => {
    const r = await patchPrefs("not-a-valid-url");
    expect(r.statusCode).toBe(403);
  });

  it("allows a request with no Origin/Referer (defence-in-depth; the CSRF token is the primary gate)", async () => {
    const r = await patchPrefs(undefined);
    expect(r.statusCode).toBe(200);
  });
});
