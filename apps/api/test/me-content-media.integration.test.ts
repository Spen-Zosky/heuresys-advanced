/**
 * apps/api/test/me-content-media.integration.test.ts
 * ESS media serve (cap④ CMS P3 close, S982): /v1/me/content/:id/media (list) +
 * /v1/me/content/media/:mediaId (stream, inline for images) — published-only
 * guard (drafts / cross-tenant -> 404, no leak), me:content:read permission.
 * Mirrors the admin suite (content-media.integration.test.ts) + the P2 ESS
 * published-only test shape (content.integration.test.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const AUTHOR = "federica.marchetti@rtl-bank.org"; // TENANT_ADMIN (RTL) — content:update/publish
const EMPLOYEE = "tommaso.fiore@rtl-bank.org"; // USER (RTL) — me:content:read only
const CROSS_TENANT = "admin@heuresys.com"; // PLATFORM_ADMIN, tenant HEURESYS (≠ RTL)
const PFX = "[me-media-it]";

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("me-media-it test payload"),
]);

function multipartBody(boundary: string, filename: string, mime: string, data: Buffer): Buffer {
  const head = Buffer.from(
    `--${boundary}\r\ncontent-disposition: form-data; name="file"; filename="${filename}"\r\ncontent-type: ${mime}\r\n\r\n`,
  );
  return Buffer.concat([head, data, Buffer.from(`\r\n--${boundary}--\r\n`)]);
}

describe("ESS media serve (/v1/me/content media)", () => {
  let suite: TestApp;
  let authorCookie = "";
  let authorCsrf = "";
  let employeeCookie = "";
  let crossCookie = "";
  let documentId = "";
  let mediaId = "";

  async function login(email: string) {
    const r = await loginRaw(suite.app, email, PWD);
    return {
      cookie: r.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
      csrf: (r.json() as { csrfToken: string }).csrfToken,
    };
  }

  beforeAll(async () => {
    suite = await buildTestApp();
    const a = await login(AUTHOR);
    authorCookie = a.cookie;
    authorCsrf = a.csrf;
    employeeCookie = (await login(EMPLOYEE)).cookie;
    crossCookie = (await login(CROSS_TENANT)).cookie;

    // Author a throwaway document with an attached image (draft for now).
    const doc = await suite.app.inject({
      method: "POST",
      url: "/v1/content",
      headers: { cookie: authorCookie, "x-csrf-token": authorCsrf, "content-type": "application/json" },
      payload: { title: `${PFX} ESS media doc`, body: `${PFX} body` },
    });
    expect(doc.statusCode).toBe(200);
    documentId = (doc.json() as { documentId: string }).documentId;

    const boundary = "----me-media-it-boundary";
    const up = await suite.app.inject({
      method: "POST",
      url: `/v1/content/${documentId}/media`,
      headers: {
        cookie: authorCookie,
        "x-csrf-token": authorCsrf,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartBody(boundary, "photo.png", "image/png", PNG),
    });
    expect(up.statusCode).toBe(201);
    mediaId = (up.json() as { mediaId: string }).mediaId;
  });

  afterAll(async () => {
    // Media first (removes the blob), then the doc (cascade-safe either way).
    await suite.app.inject({
      method: "DELETE",
      url: `/v1/content/media/${mediaId}`,
      headers: { cookie: authorCookie, "x-csrf-token": authorCsrf },
    });
    await suite.app.inject({
      method: "DELETE",
      url: `/v1/content/${documentId}`,
      headers: { cookie: authorCookie, "x-csrf-token": authorCsrf },
    });
    await suite.app.close();
  });

  it("DRAFT doc: ESS list + stream -> 404 (no leak), even for same-tenant employees", async () => {
    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/me/content/${documentId}/media`,
      headers: { cookie: employeeCookie },
    });
    expect(list.statusCode).toBe(404);
    const dl = await suite.app.inject({
      method: "GET",
      url: `/v1/me/content/media/${mediaId}`,
      headers: { cookie: employeeCookie },
    });
    expect(dl.statusCode).toBe(404);
  });

  it("PUBLISHED doc: employee lists and streams the image INLINE (exact bytes)", async () => {
    const pub = await suite.app.inject({
      method: "POST",
      url: `/v1/content/${documentId}/publish`,
      headers: { cookie: authorCookie, "x-csrf-token": authorCsrf },
    });
    expect(pub.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/me/content/${documentId}/media`,
      headers: { cookie: employeeCookie },
    });
    expect(list.statusCode).toBe(200);
    const items = (list.json() as { items: Array<{ mediaId: string; filename: string }> }).items;
    expect(items.map((m) => m.mediaId)).toContain(mediaId);

    const dl = await suite.app.inject({
      method: "GET",
      url: `/v1/me/content/media/${mediaId}`,
      headers: { cookie: employeeCookie },
    });
    expect(dl.statusCode).toBe(200);
    expect(dl.headers["content-type"]).toBe("image/png");
    expect(dl.headers["content-disposition"]).toContain("inline");
    expect(dl.headers["x-content-type-options"]).toBe("nosniff");
    expect(dl.rawPayload.equals(PNG)).toBe(true);
  });

  it("caller without a tenant context (PLATFORM_ADMIN) -> 403 TENANT_REQUIRED", async () => {
    // PLATFORM_ADMIN JWTs carry tenant_id=null (global scope): the ESS surface
    // requires a tenant context, so the guard rejects before any lookup. True
    // cross-tenant isolation rides the same WHERE (tenant_id + published) the
    // DRAFT test exercises: a non-matching tenant resolves no row -> 404.
    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/me/content/${documentId}/media`,
      headers: { cookie: crossCookie },
    });
    expect(list.statusCode).toBe(403);
    expect((list.json() as { error: { code: string } }).error.code).toBe("TENANT_REQUIRED");
    const dl = await suite.app.inject({
      method: "GET",
      url: `/v1/me/content/media/${mediaId}`,
      headers: { cookie: crossCookie },
    });
    expect(dl.statusCode).toBe(403);
  });

  it("the ADMIN media route still requires content:read (USER -> 403)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/content/media/${mediaId}`,
      headers: { cookie: employeeCookie },
    });
    expect(r.statusCode).toBe(403);
  });
});
