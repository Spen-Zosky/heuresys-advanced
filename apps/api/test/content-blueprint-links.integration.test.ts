import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

// cap④ CMS P3 — content↔blueprint cross-link (/v1/content-blueprint-links/*). Real
// login + live DB. Writes = content:update (PLATFORM/TENANT_ADMIN/HRMS_MANAGER);
// doc-side read = content:read; blueprint-side reads = blueprint:read. The link is
// owned by the document's tenant (I5). Test docs are ZZZCBLTEST-prefixed; deleting
// them CASCADEs the links (FK ON DELETE CASCADE), so afterAll cleans the docs.

const PWD = TEST_PERSONA_PASSWORD;
const PFX = "ZZZCBLTEST";
const ZERO = "00000000-0000-0000-0000-000000000000";

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
function jhdr(s: S) { return { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" }; }
function chdr(s: S) { return { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken }; }

let suite: TestApp;
let admin: S;     // PLATFORM_ADMIN — cross-tenant
let author: S;    // TENANT_ADMIN (RTL) — content:update
let manager: S;   // MANAGER — content:read yes, content:update NO
let plainUser: S; // USER — no content perms
let proc0: string; // a real blueprint process step
let proc1: string; // a second one (isolation)
let variantId: string;

async function createDoc(title: string): Promise<string> {
  const r = await suite.app.inject({ method: "POST", url: "/v1/content", headers: jhdr(author), payload: { title: `${PFX} ${title}`, body: "body" } });
  if (r.statusCode !== 200) throw new Error(`createDoc: ${r.statusCode} ${r.body}`);
  return (r.json() as { documentId: string }).documentId;
}
async function link(docId: string, processId: string): Promise<{ linkId: string; role: string }> {
  const r = await suite.app.inject({ method: "POST", url: "/v1/content-blueprint-links", headers: jhdr(author), payload: { documentId: docId, blueprintProcessId: processId } });
  if (r.statusCode !== 200) throw new Error(`link: ${r.statusCode} ${r.body}`);
  return r.json() as { linkId: string; role: string };
}

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  author = await login(suite, "federica.marchetti@rtl-bank.org");
  manager = await login(suite, "paolo.caputo@rtl-bank.org");
  plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");
  const pr = await pool.query<{ blueprint_process_id: string; blueprint_process_variant_id: string }>(
    `SELECT blueprint_process_id, blueprint_process_variant_id FROM sys.sys_blueprint_process_registry ORDER BY blueprint_process_ordinal LIMIT 2`,
  );
  if (pr.rows.length < 2) throw new Error("need ≥2 blueprint processes");
  proc0 = pr.rows[0]!.blueprint_process_id;
  proc1 = pr.rows[1]!.blueprint_process_id;
  variantId = pr.rows[0]!.blueprint_process_variant_id;
});

afterAll(async () => {
  await pool.query("DELETE FROM sys.sys_content_documents WHERE document_title LIKE $1", [`${PFX}%`]);
  await suite.app.close();
});

describe("content↔blueprint cross-link API (cap④ CMS P3)", () => {
  it("create → 200 (role defaults to 'documentation') + by-document returns denormalized process", async () => {
    const docId = await createDoc("Linkable");
    const r = await suite.app.inject({ method: "POST", url: "/v1/content-blueprint-links", headers: jhdr(author), payload: { documentId: docId, blueprintProcessId: proc0 } });
    expect(r.statusCode).toBe(200);
    const created = r.json() as { linkId: string; role: string; tenantId: string; documentId: string };
    expect(created.role).toBe("documentation");
    expect(created.tenantId).toBeTruthy();

    const byDoc = await suite.app.inject({ method: "GET", url: `/v1/content-blueprint-links/by-document?documentId=${docId}`, headers: { cookie: ch(author.cookies) } });
    expect(byDoc.statusCode).toBe(200);
    const items = (byDoc.json() as { items: { linkId: string; blueprintProcessId: string; blueprintProcessName: string; blueprintVariantName: string }[]; total: number }).items;
    expect(items).toHaveLength(1);
    expect(items[0]!.blueprintProcessId).toBe(proc0);
    expect(items[0]!.blueprintProcessName).toBeTruthy();
    expect(items[0]!.blueprintVariantName).toBeTruthy();
  });

  it("dup-prevent: re-linking the same (document, process) → 409 DUPLICATE_LINK", async () => {
    const docId = await createDoc("Dup");
    await link(docId, proc0);
    const dup = await suite.app.inject({ method: "POST", url: "/v1/content-blueprint-links", headers: jhdr(author), payload: { documentId: docId, blueprintProcessId: proc0 } });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("DUPLICATE_LINK");
  });

  it("RBAC: plain USER cannot create (no content:update → 403); MANAGER can read but not create", async () => {
    const docId = await createDoc("RBAC");
    expect((await suite.app.inject({ method: "POST", url: "/v1/content-blueprint-links", headers: jhdr(plainUser), payload: { documentId: docId, blueprintProcessId: proc0 } })).statusCode).toBe(403);
    expect((await suite.app.inject({ method: "GET", url: `/v1/content-blueprint-links/by-document?documentId=${docId}`, headers: { cookie: ch(manager.cookies) } })).statusCode).toBe(200);
    expect((await suite.app.inject({ method: "POST", url: "/v1/content-blueprint-links", headers: jhdr(manager), payload: { documentId: docId, blueprintProcessId: proc0 } })).statusCode).toBe(403);
  });

  it("CSRF: create without x-csrf-token → 403 CSRF_FAIL", async () => {
    const docId = await createDoc("Csrf");
    const r = await suite.app.inject({
      method: "POST", url: "/v1/content-blueprint-links",
      headers: { cookie: ch(author.cookies), "content-type": "application/json" },
      payload: { documentId: docId, blueprintProcessId: proc0 },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });

  it("404: link to a non-existent process or a non-existent/out-of-scope document", async () => {
    const docId = await createDoc("NotFound");
    expect((await suite.app.inject({ method: "POST", url: "/v1/content-blueprint-links", headers: jhdr(author), payload: { documentId: docId, blueprintProcessId: ZERO } })).statusCode).toBe(404);
    expect((await suite.app.inject({ method: "POST", url: "/v1/content-blueprint-links", headers: jhdr(author), payload: { documentId: ZERO, blueprintProcessId: proc0 } })).statusCode).toBe(404);
  });

  it("I5: by-document for an out-of-scope doc → 404 (no leak); PLATFORM_ADMIN sees across tenants", async () => {
    const docId = await createDoc("Scope");
    await link(docId, proc0);
    // author querying a non-existent/out-of-scope doc → 404 (parent scope-check)
    expect((await suite.app.inject({ method: "GET", url: `/v1/content-blueprint-links/by-document?documentId=${ZERO}`, headers: { cookie: ch(author.cookies) } })).statusCode).toBe(404);
    // PLATFORM_ADMIN (cross-tenant) sees the RTL doc's links
    const adminView = await suite.app.inject({ method: "GET", url: `/v1/content-blueprint-links/by-document?documentId=${docId}`, headers: { cookie: ch(admin.cookies) } });
    expect(adminView.statusCode).toBe(200);
    expect((adminView.json() as { total: number }).total).toBeGreaterThanOrEqual(1);
  });

  it("reverse lookup (by-process + by-variant) + cascade on document delete", async () => {
    const docId = await createDoc("Reverse");
    await link(docId, proc1);
    const byProc = await suite.app.inject({ method: "GET", url: `/v1/content-blueprint-links/by-process?blueprintProcessId=${proc1}`, headers: { cookie: ch(author.cookies) } });
    expect(byProc.statusCode).toBe(200);
    expect((byProc.json() as { items: { documentId: string; documentTitle: string }[] }).items.some((i) => i.documentId === docId)).toBe(true);

    const byVar = await suite.app.inject({ method: "GET", url: `/v1/content-blueprint-links/by-variant?variantId=${variantId}`, headers: { cookie: ch(author.cookies) } });
    expect(byVar.statusCode).toBe(200);
    expect((byVar.json() as { items: { documentId: string }[] }).items.some((i) => i.documentId === docId)).toBe(true);

    // deleting the (draft) document hard-deletes it → link cascades away
    expect((await suite.app.inject({ method: "DELETE", url: `/v1/content/${docId}`, headers: chdr(author) })).statusCode).toBe(200);
    const after = await suite.app.inject({ method: "GET", url: `/v1/content-blueprint-links/by-process?blueprintProcessId=${proc1}`, headers: { cookie: ch(author.cookies) } });
    expect((after.json() as { items: { documentId: string }[] }).items.some((i) => i.documentId === docId)).toBe(false);
  });

  it("DELETE link → 200 then by-document is empty", async () => {
    const docId = await createDoc("DelLink");
    const { linkId } = await link(docId, proc0);
    const del = await suite.app.inject({ method: "DELETE", url: `/v1/content-blueprint-links/${linkId}`, headers: chdr(author) });
    expect(del.statusCode).toBe(200);
    expect((del.json() as { deleted: boolean }).deleted).toBe(true);
    const empty = await suite.app.inject({ method: "GET", url: `/v1/content-blueprint-links/by-document?documentId=${docId}`, headers: { cookie: ch(author.cookies) } });
    expect((empty.json() as { total: number }).total).toBe(0);
  });
});
