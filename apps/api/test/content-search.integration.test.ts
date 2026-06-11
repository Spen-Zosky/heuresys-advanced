import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";

// cap④ CMS P3 — full-text search (/v1/content/search). Real login + live DB. A real document
// is created (no fixtures), searched, then cleaned up — live-data E2E doctrine.

const PWD = "Admin#PassW0rd!";
const TOKEN = "quokkasearchtoken9173"; // unique nonsense term → deterministic match
const PFX = "[SRCH-TEST]";
interface S { cookies: Map<string, string>; csrfToken: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

let suite: TestApp;
let author: S;     // TENANT_ADMIN (RTL) — content:create + content:read
let plainUser: S;  // USER — no content:read → 403
let docId = "";

async function login(email: string): Promise<S> {
  const r = await loginRaw(suite.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
const jhdr = (s: S) => ({ cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" });
const search = (q: string, s: S) =>
  suite.app.inject({ method: "GET", url: `/v1/content/search?q=${encodeURIComponent(q)}`, headers: { cookie: ch(s.cookies) } });

beforeAll(async () => {
  suite = await buildTestApp();
  author = await login("federica.marchetti@rtl-bank.org");
  plainUser = await login("tommaso.fiore@rtl-bank.org");
  const r = await suite.app.inject({
    method: "POST", url: "/v1/content", headers: jhdr(author),
    payload: { title: `${PFX} Onboarding Procedure`, body: `This handbook page mentions the ${TOKEN} term for indexing.` },
  });
  if (r.statusCode !== 200) throw new Error(`create doc: ${r.statusCode} ${r.body}`);
  docId = (r.json() as { documentId: string }).documentId;
});

afterAll(async () => {
  if (docId) {
    await suite.app.inject({ method: "DELETE", url: `/v1/content/${docId}`, headers: { cookie: ch(author.cookies), "x-csrf-token": author.csrfToken } });
  }
  await suite.app.close();
});

describe("cap④ CMS P3 — content full-text search", () => {
  it("RBAC: a USER lacking content:read is denied (403)", async () => {
    expect((await search(TOKEN, plainUser)).statusCode).toBe(403);
  });

  it("finds the document by a body term, ranked, with a highlighted snippet", async () => {
    const r = await search(TOKEN, author);
    expect(r.statusCode).toBe(200);
    const b = r.json() as { query: string; total: number; items: { documentId: string; rank: number; snippet: string }[] };
    expect(b.total).toBeGreaterThanOrEqual(1);
    const hit = b.items.find((x) => x.documentId === docId);
    expect(hit).toBeDefined();
    expect(hit!.rank).toBeGreaterThan(0);
    expect(hit!.snippet).toContain("<<"); // ts_headline marker around the matched term
  });

  it("matches a title term too (title weighted higher)", async () => {
    const b = (await search("Onboarding", author)).json() as { items: { documentId: string }[] };
    expect(b.items.some((x) => x.documentId === docId)).toBe(true);
  });

  it("a term that does not occur returns zero hits", async () => {
    const b = (await search("xqzzznomatchterm", author)).json() as { total: number };
    expect(b.total).toBe(0);
  });

  it("supports websearch quoted-phrase syntax", async () => {
    const b = (await search(`"${TOKEN} term"`, author)).json() as { items: { documentId: string }[] };
    expect(b.items.some((x) => x.documentId === docId)).toBe(true);
  });
});
