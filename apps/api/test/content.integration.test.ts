import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

// Cap④ CMS — tenant-scoped content (/v1/content/*). Real login + live DB.
// content:read = 6 non-leaf roles; write (create/update/delete) = PLATFORM/TENANT_ADMIN/HRMS_MANAGER.
// Author = TENANT_ADMIN (federica) — definitely has a tenant + content:create. Test rows are
// prefixed ZZZCMSTEST and removed in afterAll (cascade drops versions).

const PWD = TEST_PERSONA_PASSWORD;
const PFX = "ZZZCMSTEST";
interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let admin: S;       // PLATFORM_ADMIN — sees all tenants
let author: S;      // TENANT_ADMIN (RTL) — content author
let manager: S;     // MANAGER — content:read yes, content:create NO
let plainUser: S;   // USER — no content perms

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  author = await login(suite, "federica.marchetti@rtl-bank.org");
  manager = await login(suite, "paolo.caputo@rtl-bank.org");
  plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");
});

afterAll(async () => {
  await pool.query("DELETE FROM sys.sys_content_documents WHERE document_title LIKE $1", [`${PFX}%`]);
  await pool.query("DELETE FROM sys.sys_content_categories WHERE category_name LIKE $1", [`${PFX}%`]);
  await suite.app.close();
});

function jhdr(s: S) { return { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" }; }
// bodyless write (DELETE): no content-type → no empty-JSON-body parse error; CSRF header still present.
function chdr(s: S) { return { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken }; }

describe("content API (cap④ CMS)", () => {
  it("RBAC: plain USER lacks content:read → 403", async () => {
    expect((await suite.app.inject({ method: "GET", url: "/v1/content", headers: { cookie: ch(plainUser.cookies) } })).statusCode).toBe(403);
  });

  it("RBAC: MANAGER can read but NOT create", async () => {
    expect((await suite.app.inject({ method: "GET", url: "/v1/content", headers: { cookie: ch(manager.cookies) } })).statusCode).toBe(200);
    const r = await suite.app.inject({ method: "POST", url: "/v1/content", headers: jhdr(manager), payload: { title: `${PFX} nope`, body: "x" } });
    expect(r.statusCode).toBe(403);
  });

  it("CSRF: create without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/content",
      headers: { cookie: ch(author.cookies), "content-type": "application/json" },
      payload: { title: `${PFX} csrf`, body: "x" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });

  it("create → draft + version 1 + author stamped", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/content", headers: jhdr(author),
      payload: { title: `${PFX} Onboarding Guide`, kind: "article", body: "# Welcome\nfirst body" },
    });
    expect(r.statusCode).toBe(200);
    const d = r.json() as { documentId: string; status: string; kind: string; currentVersionId: string | null; authorUserId: string | null; tenantId: string; body: string };
    expect(d.status).toBe("draft");
    expect(d.kind).toBe("article");
    expect(d.currentVersionId).not.toBeNull();
    expect(d.authorUserId).not.toBeNull();
    expect(d.tenantId).toBeTruthy();
    expect(d.body).toContain("first body");

    // detail = head + current version (v1)
    const det = await suite.app.inject({ method: "GET", url: `/v1/content/${d.documentId}`, headers: { cookie: ch(author.cookies) } });
    expect(det.statusCode).toBe(200);
    const detail = det.json() as { document: { documentId: string }; currentVersion: { versionNumber: number; body: string } | null };
    expect(detail.document.documentId).toBe(d.documentId);
    expect(detail.currentVersion?.versionNumber).toBe(1);
    expect(detail.currentVersion?.body).toContain("first body");
  });

  it("PLATFORM_ADMIN without a tenant context → 403 TENANT_ID_REQUIRED (never a 500)", async () => {
    // admin@heuresys.com is PLATFORM_ADMIN: its JWT carries a NULL tenant (cross-tenant
    // read scope). Content is tenant-scoped (I5) so an admin author has no tenant to
    // write into → a clean 403, NEVER an unhandled not-null 500. Regression guard for the
    // missing resolveWriteTenant (the create path used to insert NULL tenant → 500).
    const r = await suite.app.inject({
      method: "POST", url: "/v1/content", headers: jhdr(admin),
      payload: { title: `${PFX} platform nope`, kind: "article", body: "x" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("TENANT_ID_REQUIRED");
  });

  it("edit appends a new version + repoints the head", async () => {
    const created = (await suite.app.inject({
      method: "POST", url: "/v1/content", headers: jhdr(author),
      payload: { title: `${PFX} Policy v1`, kind: "policy", body: "v1 body" },
    })).json() as { documentId: string; currentVersionId: string };
    const id = created.documentId;

    const upd = await suite.app.inject({
      method: "PATCH", url: `/v1/content/${id}`, headers: jhdr(author),
      payload: { title: `${PFX} Policy v2`, body: "v2 body", changeNote: "rev" },
    });
    expect(upd.statusCode).toBe(200);
    const after = upd.json() as { title: string; body: string; currentVersionId: string };
    expect(after.title).toBe(`${PFX} Policy v2`);
    expect(after.body).toBe("v2 body");
    expect(after.currentVersionId).not.toBe(created.currentVersionId); // repointed

    const vers = await suite.app.inject({ method: "GET", url: `/v1/content/${id}/versions`, headers: { cookie: ch(author.cookies) } });
    const vb = vers.json() as { items: { versionNumber: number }[]; total: number };
    expect(vb.total).toBe(2);
    expect(vb.items.map((v) => v.versionNumber).sort()).toEqual([1, 2]);
  });

  it("category CRUD", async () => {
    const c = await suite.app.inject({ method: "POST", url: "/v1/content/categories", headers: jhdr(author), payload: { name: `${PFX} HR Policies` } });
    expect(c.statusCode).toBe(200);
    const cat = c.json() as { categoryId: string; name: string; slug: string | null };
    expect(cat.name).toBe(`${PFX} HR Policies`);
    expect(cat.slug).toBeTruthy();

    const list = await suite.app.inject({ method: "GET", url: "/v1/content/categories", headers: { cookie: ch(author.cookies) } });
    expect((list.json() as { items: { categoryId: string }[] }).items.some((x) => x.categoryId === cat.categoryId)).toBe(true);

    const upd = await suite.app.inject({ method: "PATCH", url: `/v1/content/categories/${cat.categoryId}`, headers: jhdr(author), payload: { description: "hr" } });
    expect(upd.statusCode).toBe(200);
    expect((upd.json() as { description: string }).description).toBe("hr");

    const del = await suite.app.inject({ method: "DELETE", url: `/v1/content/categories/${cat.categoryId}`, headers: chdr(author) });
    expect(del.statusCode).toBe(200);
    expect((del.json() as { deleted: boolean }).deleted).toBe(true);
  });

  it("I5: TENANT_ADMIN list is single-tenant; PLATFORM_ADMIN is a superset; cross-tenant get → 404", async () => {
    // ensure at least one author doc exists
    await suite.app.inject({ method: "POST", url: "/v1/content", headers: jhdr(author), payload: { title: `${PFX} scope`, body: "x" } });
    const mine = (await suite.app.inject({ method: "GET", url: "/v1/content?limit=200", headers: { cookie: ch(author.cookies) } })).json() as { items: { tenantId: string }[]; total: number };
    expect(mine.items.length).toBeGreaterThan(0);
    expect(new Set(mine.items.map((i) => i.tenantId)).size).toBe(1); // own tenant only
    const all = (await suite.app.inject({ method: "GET", url: "/v1/content?limit=200", headers: { cookie: ch(admin.cookies) } })).json() as { total: number };
    expect(all.total).toBeGreaterThanOrEqual(mine.total);
    // a random uuid (not in tenant) → 404
    const r404 = await suite.app.inject({ method: "GET", url: "/v1/content/00000000-0000-0000-0000-000000000000", headers: { cookie: ch(author.cookies) } });
    expect(r404.statusCode).toBe(404);
  });

  it("D-5: a draft is hard-deleted (outcome 'deleted')", async () => {
    const created = (await suite.app.inject({ method: "POST", url: "/v1/content", headers: jhdr(author), payload: { title: `${PFX} draft del`, body: "x" } })).json() as { documentId: string };
    const del = await suite.app.inject({ method: "DELETE", url: `/v1/content/${created.documentId}`, headers: chdr(author) });
    expect(del.statusCode).toBe(200);
    expect((del.json() as { outcome: string }).outcome).toBe("deleted");
    // gone
    expect((await suite.app.inject({ method: "GET", url: `/v1/content/${created.documentId}`, headers: { cookie: ch(author.cookies) } })).statusCode).toBe(404);
  });

  /* --- P2: restore + publish-workflow + ESS read --- */

  it("P2 restore: restoring an old version appends a copy + repoints the head (history immutable)", async () => {
    const created = (await suite.app.inject({
      method: "POST", url: "/v1/content", headers: jhdr(author),
      payload: { title: `${PFX} Restorable`, body: "v1 body" },
    })).json() as { documentId: string; currentVersionId: string };
    const id = created.documentId;
    const v1Id = created.currentVersionId;
    await suite.app.inject({ method: "PATCH", url: `/v1/content/${id}`, headers: jhdr(author), payload: { body: "v2 body" } });

    const r = await suite.app.inject({ method: "POST", url: `/v1/content/${id}/versions/${v1Id}/restore`, headers: chdr(author) });
    expect(r.statusCode).toBe(200);
    const after = r.json() as { body: string; currentVersionId: string };
    expect(after.body).toBe("v1 body");             // head content matches the restored version
    expect(after.currentVersionId).not.toBe(v1Id);  // a NEW version, history not mutated

    const vers = (await suite.app.inject({ method: "GET", url: `/v1/content/${id}/versions`, headers: { cookie: ch(author.cookies) } })).json() as { total: number };
    expect(vers.total).toBe(3);                      // v1 + v2 + restored v3
  });

  it("P2 publish-workflow: publish → published, unpublish → draft, double-publish/unpublish → 409", async () => {
    const id = ((await suite.app.inject({ method: "POST", url: "/v1/content", headers: jhdr(author), payload: { title: `${PFX} Publishable`, body: "x" } })).json() as { documentId: string }).documentId;

    const pub = await suite.app.inject({ method: "POST", url: `/v1/content/${id}/publish`, headers: chdr(author) });
    expect(pub.statusCode).toBe(200);
    const pd = pub.json() as { status: string; publishedAt: string | null; publishedByUserId: string | null };
    expect(pd.status).toBe("published");
    expect(pd.publishedAt).not.toBeNull();
    expect(pd.publishedByUserId).not.toBeNull();

    const again = await suite.app.inject({ method: "POST", url: `/v1/content/${id}/publish`, headers: chdr(author) });
    expect(again.statusCode).toBe(409);
    expect((again.json() as { error: { code: string } }).error.code).toBe("ALREADY_PUBLISHED");

    const unp = await suite.app.inject({ method: "POST", url: `/v1/content/${id}/unpublish`, headers: chdr(author) });
    expect(unp.statusCode).toBe(200);
    const ud = unp.json() as { status: string; publishedAt: string | null };
    expect(ud.status).toBe("draft");
    expect(ud.publishedAt).toBeNull();

    const unp2 = await suite.app.inject({ method: "POST", url: `/v1/content/${id}/unpublish`, headers: chdr(author) });
    expect(unp2.statusCode).toBe(409);
    expect((unp2.json() as { error: { code: string } }).error.code).toBe("NOT_PUBLISHED");
  });

  it("P2 publish RBAC: content:publish required — MANAGER (read-only) → 403", async () => {
    const id = ((await suite.app.inject({ method: "POST", url: "/v1/content", headers: jhdr(author), payload: { title: `${PFX} MgrPub`, body: "x" } })).json() as { documentId: string }).documentId;
    expect((await suite.app.inject({ method: "POST", url: `/v1/content/${id}/publish`, headers: chdr(manager) })).statusCode).toBe(403);
  });

  it("P2 in_review chain: draft → submit → in_review → publish; reviewer can return-to-draft", async () => {
    const id = ((await suite.app.inject({ method: "POST", url: "/v1/content", headers: jhdr(author), payload: { title: `${PFX} ReviewFlow`, body: "x" } })).json() as { documentId: string }).documentId;

    const sub = await suite.app.inject({ method: "POST", url: `/v1/content/${id}/submit-for-review`, headers: chdr(author) });
    expect(sub.statusCode).toBe(200);
    expect((sub.json() as { status: string }).status).toBe("in_review");
    // submit again (not a draft) → 409
    expect((await suite.app.inject({ method: "POST", url: `/v1/content/${id}/submit-for-review`, headers: chdr(author) })).statusCode).toBe(409);

    const ret = await suite.app.inject({ method: "POST", url: `/v1/content/${id}/return-to-draft`, headers: chdr(author) });
    expect(ret.statusCode).toBe(200);
    expect((ret.json() as { status: string }).status).toBe("draft");
    // return-to-draft when already a draft → 409
    expect((await suite.app.inject({ method: "POST", url: `/v1/content/${id}/return-to-draft`, headers: chdr(author) })).statusCode).toBe(409);

    // resubmit then publish from in_review
    await suite.app.inject({ method: "POST", url: `/v1/content/${id}/submit-for-review`, headers: chdr(author) });
    const pub = await suite.app.inject({ method: "POST", url: `/v1/content/${id}/publish`, headers: chdr(author) });
    expect(pub.statusCode).toBe(200);
    expect((pub.json() as { status: string }).status).toBe("published");
  });

  it("P2 workflow RBAC: submit needs content:update, return needs content:publish — MANAGER lacks both → 403", async () => {
    const id = ((await suite.app.inject({ method: "POST", url: "/v1/content", headers: jhdr(author), payload: { title: `${PFX} SoD`, body: "x" } })).json() as { documentId: string }).documentId;
    expect((await suite.app.inject({ method: "POST", url: `/v1/content/${id}/submit-for-review`, headers: chdr(manager) })).statusCode).toBe(403);
    expect((await suite.app.inject({ method: "POST", url: `/v1/content/${id}/return-to-draft`, headers: chdr(manager) })).statusCode).toBe(403);
  });

  it("P2 ESS: /v1/me/content shows the tenant's PUBLISHED docs, never drafts (no leak)", async () => {
    const pubId = ((await suite.app.inject({ method: "POST", url: "/v1/content", headers: jhdr(author), payload: { title: `${PFX} ESS Published`, body: "visible" } })).json() as { documentId: string }).documentId;
    await suite.app.inject({ method: "POST", url: `/v1/content/${pubId}/publish`, headers: chdr(author) });
    const draftId = ((await suite.app.inject({ method: "POST", url: "/v1/content", headers: jhdr(author), payload: { title: `${PFX} ESS Draft`, body: "hidden" } })).json() as { documentId: string }).documentId;

    // plainUser (USER, same RTL tenant as the author) reads the ESS knowledge base.
    const list = await suite.app.inject({ method: "GET", url: "/v1/me/content?limit=200", headers: { cookie: ch(plainUser.cookies) } });
    expect(list.statusCode).toBe(200);
    const items = (list.json() as { items: { documentId: string; status: string }[] }).items;
    expect(items.some((d) => d.documentId === pubId)).toBe(true);      // published visible
    expect(items.some((d) => d.documentId === draftId)).toBe(false);   // draft hidden
    expect(items.every((d) => d.status === "published")).toBe(true);   // only ever published

    // ESS detail: a draft → 404 (no leak), the published one → 200
    expect((await suite.app.inject({ method: "GET", url: `/v1/me/content/${draftId}`, headers: { cookie: ch(plainUser.cookies) } })).statusCode).toBe(404);
    expect((await suite.app.inject({ method: "GET", url: `/v1/me/content/${pubId}`, headers: { cookie: ch(plainUser.cookies) } })).statusCode).toBe(200);
  });
});
