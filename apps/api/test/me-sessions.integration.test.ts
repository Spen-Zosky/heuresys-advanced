import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";

// MVP-4 §2.5 — ESS self-service session management (/v1/me/security/sessions + the
// /v1/auth/sessions/current helper). Real login + live DB. A login creates a refresh-
// token family; the helper resolves the current family from the refresh cookie (which
// is path-scoped to /v1/auth and not sent to /v1/me/*). me:sessions:manage = all roles.

const PWD = "Admin#PassW0rd!";
interface S { cookies: Map<string, string>; csrf: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrf: (r.json() as { csrfToken: string }).csrfToken };
}
async function currentFamily(t: TestApp, s: S): Promise<string> {
  const r = await t.app.inject({ method: "GET", url: "/v1/auth/sessions/current", headers: { cookie: ch(s.cookies) } });
  const f = (r.json() as { familyId: string | null }).familyId;
  if (!f) throw new Error("no current family");
  return f;
}
function jhdr(s: S) { return { cookie: ch(s.cookies), "x-csrf-token": s.csrf, "content-type": "application/json" }; }
function chdr(s: S) { return { cookie: ch(s.cookies), "x-csrf-token": s.csrf }; }
function ids(r: { json: () => unknown }) { return (r.json() as { items: { familyId: string }[] }).items.map((i) => i.familyId); }

let suite: TestApp;
let u1a: S; let u1b: S; let u2: S;
let fa: string; let fb: string; let fc: string;

beforeAll(async () => {
  suite = await buildTestApp();
  u1a = await login(suite, "tommaso.fiore@rtl-bank.org"); // USER — session 1
  u1b = await login(suite, "tommaso.fiore@rtl-bank.org"); // USER — session 2 (new family)
  u2 = await login(suite, "paolo.caputo@rtl-bank.org");   // a DIFFERENT user
  fa = await currentFamily(suite, u1a);
  fb = await currentFamily(suite, u1b);
  fc = await currentFamily(suite, u2);
});

afterAll(async () => { await suite.app.close(); });

describe("ESS session management (/v1/me/security/sessions)", () => {
  it("(f) /auth/sessions/current resolves the family from the access JWT `fam` claim", async () => {
    expect(fa).toMatch(/^[0-9a-f-]{36}$/);
    expect(fa).not.toBe(fb); // two logins = two distinct families
    // the access cookie alone (path "/", reaches /api/* via the web proxy) carries the
    // `fam` claim → resolves the current family without the refresh cookie.
    const access = u1a.cookies.get("hrx_access");
    const r = await suite.app.inject({ method: "GET", url: "/v1/auth/sessions/current", headers: { cookie: `hrx_access=${access}` } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { familyId: string | null }).familyId).toBe(fa);
    // no cookie at all → unauthenticated
    expect((await suite.app.inject({ method: "GET", url: "/v1/auth/sessions/current" })).statusCode).toBe(401);
  });

  it("(a) list returns the caller's own families (both current ones), never another user's", async () => {
    const list = await suite.app.inject({ method: "GET", url: "/v1/me/security/sessions", headers: { cookie: ch(u1a.cookies) } });
    expect(list.statusCode).toBe(200);
    const got = ids(list);
    expect(got).toContain(fa);
    expect(got).toContain(fb);
    expect(got).not.toContain(fc); // paolo's family is never visible to tommaso
  });

  it("(e) CSRF: revoke without x-csrf-token → 403", async () => {
    expect((await suite.app.inject({ method: "DELETE", url: `/v1/me/security/sessions/${fb}`, headers: { cookie: ch(u1a.cookies) } })).statusCode).toBe(403);
    expect((await suite.app.inject({ method: "POST", url: "/v1/me/security/sessions/revoke-others", headers: { cookie: ch(u1a.cookies), "content-type": "application/json" }, payload: { currentFamilyId: fa } })).statusCode).toBe(403);
  });

  it("(c) cross-user revoke is a no-op 404; the target family stays active", async () => {
    const r = await suite.app.inject({ method: "DELETE", url: `/v1/me/security/sessions/${fc}`, headers: chdr(u1a) });
    expect(r.statusCode).toBe(404);
    const paolo = await suite.app.inject({ method: "GET", url: "/v1/me/security/sessions", headers: { cookie: ch(u2.cookies) } });
    expect(ids(paolo)).toContain(fc); // not revoked
  });

  it("(b) revoke one own family → it disappears from the list (current preserved)", async () => {
    const del = await suite.app.inject({ method: "DELETE", url: `/v1/me/security/sessions/${fb}`, headers: chdr(u1a) });
    expect(del.statusCode).toBe(200);
    expect((del.json() as { revoked: boolean }).revoked).toBe(true);
    const got = ids(await suite.app.inject({ method: "GET", url: "/v1/me/security/sessions", headers: { cookie: ch(u1a.cookies) } }));
    expect(got).toContain(fa);
    expect(got).not.toContain(fb);
  });

  it("(d) revoke-others keeps the current family, revokes the rest", async () => {
    const extra = await login(suite, "tommaso.fiore@rtl-bank.org");
    const fe = await currentFamily(suite, extra);
    const r = await suite.app.inject({ method: "POST", url: "/v1/me/security/sessions/revoke-others", headers: jhdr(u1a), payload: { currentFamilyId: fa } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { revokedFamilies: number }).revokedFamilies).toBeGreaterThanOrEqual(1); // at least fe
    const got = ids(await suite.app.inject({ method: "GET", url: "/v1/me/security/sessions", headers: { cookie: ch(u1a.cookies) } }));
    expect(got).toContain(fa);     // current preserved
    expect(got).not.toContain(fe); // the other revoked
  });
});
