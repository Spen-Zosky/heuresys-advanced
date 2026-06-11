/**
 * apps/api/test/me-preferences.integration.test.ts
 * GET/PATCH /v1/me/preferences — per-user UI preferences (WS-4 P1 theme+palette + i18n Fase 0b
 * locale), server = source of truth.
 *
 * Asserts: default when no row (brand defaults dark/balanced/it), PATCH persists + survives a re-GET,
 * partial PATCH (theme-only never resets palette or locale; locale-only flips just the language),
 * self-scope (unauth GET 401), CSRF-missing PATCH 403, and validation (invalid theme/palette/locale → 400).
 *
 * Persona = the seed-test-admin employee (tommaso.fiore), login-capable in CI. Hits the real DB
 * through the tunnel (no mocks). The persona's preference row is reset before/after so the suite is
 * deterministic + leaves no residue (NEVER deletes other users' rows).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

async function getPrefs(t: TestApp, s: S) {
  return t.app.inject({ method: "GET", url: "/v1/me/preferences", headers: { cookie: ch(s.cookies) } });
}
async function patchPrefs(t: TestApp, s: S, payload: Record<string, unknown>, opts: { csrf?: boolean } = {}) {
  const headers: Record<string, string> = { cookie: ch(s.cookies), "content-type": "application/json" };
  if (opts.csrf !== false) headers["x-csrf-token"] = s.csrfToken;
  return t.app.inject({ method: "PATCH", url: "/v1/me/preferences", headers, payload });
}

let suite: TestApp;
let employeeS: S;

describe("/v1/me/preferences (WS-4 P1)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    employeeS = await login(suite, "tommaso.fiore@rtl-bank.org");
    // Clean slate: remove any pre-existing pref row so the "default when no row" assertion is real.
    await pool.query(`DELETE FROM sys.sys_user_preferences WHERE user_preference_user_id = $1`, [employeeS.userId]);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM sys.sys_user_preferences WHERE user_preference_user_id = $1`, [employeeS.userId]);
    await suite.app.close();
    await closePool();
  });

  it("GET returns the brand defaults when no row exists (dark / balanced / it)", async () => {
    const r = await getPrefs(suite, employeeS);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ theme: "dark", palette: "balanced", locale: "it" });
  });

  it("PATCH persists theme+palette; a fresh GET reflects it (server source-of-truth)", async () => {
    const p = await patchPrefs(suite, employeeS, { theme: "light", palette: "cool-ocean" });
    expect(p.statusCode).toBe(200);
    // locale stays the default 'it' (no row existed, INSERT fills the brand default).
    expect(p.json()).toEqual({ theme: "light", palette: "cool-ocean", locale: "it" });

    const r = await getPrefs(suite, employeeS);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ theme: "light", palette: "cool-ocean", locale: "it" });
  });

  it("partial PATCH (theme only) does NOT reset the stored palette", async () => {
    const p = await patchPrefs(suite, employeeS, { theme: "dark" });
    expect(p.statusCode).toBe(200);
    // palette stays cool-ocean + locale stays it from the previous test
    expect(p.json()).toEqual({ theme: "dark", palette: "cool-ocean", locale: "it" });

    const r = await getPrefs(suite, employeeS);
    expect(r.json()).toEqual({ theme: "dark", palette: "cool-ocean", locale: "it" });
  });

  it("PATCH persists locale (en); a fresh GET reflects it (i18n Fase 0b)", async () => {
    const p = await patchPrefs(suite, employeeS, { locale: "en" });
    expect(p.statusCode).toBe(200);
    // only locale flips; theme+palette keep the prior stored values (partial update).
    expect(p.json()).toEqual({ theme: "dark", palette: "cool-ocean", locale: "en" });

    const r = await getPrefs(suite, employeeS);
    expect(r.json()).toEqual({ theme: "dark", palette: "cool-ocean", locale: "en" });
  });

  it("partial PATCH (theme only) does NOT reset the stored locale", async () => {
    const p = await patchPrefs(suite, employeeS, { theme: "light" });
    expect(p.statusCode).toBe(200);
    // locale stays 'en' from the previous test
    expect(p.json()).toEqual({ theme: "light", palette: "cool-ocean", locale: "en" });
  });

  it("unauthenticated GET → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/preferences" });
    expect(r.statusCode).toBe(401);
  });

  it("PATCH without CSRF token → 403", async () => {
    const p = await patchPrefs(suite, employeeS, { theme: "light" }, { csrf: false });
    expect(p.statusCode).toBe(403);
  });

  it("PATCH with an invalid theme → 400 (Zod validation)", async () => {
    const p = await patchPrefs(suite, employeeS, { theme: "neon" });
    expect(p.statusCode).toBe(400);
  });

  it("PATCH with an invalid palette → 400 (Zod validation)", async () => {
    const p = await patchPrefs(suite, employeeS, { palette: "not-a-palette" });
    expect(p.statusCode).toBe(400);
  });

  it("PATCH with an invalid locale → 400 (Zod validation)", async () => {
    const p = await patchPrefs(suite, employeeS, { locale: "fr" });
    expect(p.statusCode).toBe(400);
  });

  it("PATCH with an empty body → 400 (at least one field required)", async () => {
    const p = await patchPrefs(suite, employeeS, {});
    expect(p.statusCode).toBe(400);
  });
});
