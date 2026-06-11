/**
 * apps/api/test/content-media.integration.test.ts
 *
 * cap④ CMS P3 — media attachments (object store, mig 000105). Live DB through
 * the tunnel; blobs land in the local-disk store (default MEDIA_STORAGE_DIR =
 * .data/media relative to apps/api — gitignored). A throwaway draft document
 * is created by federica (TENANT_ADMIN) and hard-deleted in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const AUTHOR = "federica.marchetti@rtl-bank.org"; // TENANT_ADMIN — content:update
const READER = "paolo.caputo@rtl-bank.org"; // MANAGER — content:read only
const PFX = "[media-it]";

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("media-it test payload"),
]);

function multipartBody(boundary: string, filename: string, mime: string, data: Buffer): Buffer {
  const head = Buffer.from(
    `--${boundary}\r\ncontent-disposition: form-data; name="file"; filename="${filename}"\r\ncontent-type: ${mime}\r\n\r\n`,
  );
  return Buffer.concat([head, data, Buffer.from(`\r\n--${boundary}--\r\n`)]);
}

describe("content media (cap4 CMS P3, object store)", () => {
  let suite: TestApp;
  let authorCookie = "";
  let authorCsrf = "";
  let readerCookie = "";
  let documentId = "";

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
    readerCookie = (await login(READER)).cookie;

    const doc = await suite.app.inject({
      method: "POST",
      url: "/v1/content",
      headers: { cookie: authorCookie, "x-csrf-token": authorCsrf, "content-type": "application/json" },
      payload: { title: `${PFX} media host`, body: "host doc" },
    });
    expect(doc.statusCode).toBe(200);
    documentId = (doc.json() as { documentId: string }).documentId;
  });

  afterAll(async () => {
    if (documentId) {
      await suite.app.inject({
        method: "DELETE",
        url: `/v1/content/${documentId}`,
        headers: { cookie: authorCookie, "x-csrf-token": authorCsrf },
      });
    }
    await suite.app.close();
  });

  async function upload(
    headers: Record<string, string>,
    data: Buffer,
    mime = "image/png",
    filename = "shot.png",
  ) {
    const boundary = "----mediaIT9f2c";
    return suite.app.inject({
      method: "POST",
      url: `/v1/content/${documentId}/media`,
      headers: { ...headers, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: multipartBody(boundary, filename, mime, data),
    });
  }

  let mediaId = "";
  let storagePath = "";

  it("upload (multipart) → 201 with integrity metadata; blob lands in the store", async () => {
    const r = await upload({ cookie: authorCookie, "x-csrf-token": authorCsrf }, PNG);
    expect(r.statusCode).toBe(201);
    const j = r.json() as {
      mediaId: string;
      documentId: string;
      filename: string;
      mime: string;
      sizeBytes: number;
      sha256: string;
    };
    expect(j.documentId).toBe(documentId);
    expect(j.filename).toBe("shot.png");
    expect(j.mime).toBe("image/png");
    expect(j.sizeBytes).toBe(PNG.length);
    expect(j.sha256).toMatch(/^[0-9a-f]{64}$/);
    mediaId = j.mediaId;

    // LocalDiskStore default root is .data/media relative to apps/api (cwd);
    // the row's storage_key is the driver-relative path.
    const sk = await pool.query<{ k: string }>(
      `SELECT media_storage_key AS k FROM sys.sys_content_media WHERE media_id = $1`,
      [mediaId],
    );
    storagePath = resolve(".data/media", sk.rows[0]!.k);
    expect(existsSync(storagePath)).toBe(true);
  });

  it("CSRF: upload without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await upload({ cookie: authorCookie }, PNG);
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });

  it("RBAC: MANAGER (content:read only) cannot upload, CAN list + download", async () => {
    const up = await upload({ cookie: readerCookie, "x-csrf-token": "irrelevant" }, PNG);
    expect([401, 403]).toContain(up.statusCode);

    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/content/${documentId}/media`,
      headers: { cookie: readerCookie },
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as { total: number }).total).toBe(1);

    const dl = await suite.app.inject({
      method: "GET",
      url: `/v1/content/media/${mediaId}`,
      headers: { cookie: readerCookie },
    });
    expect(dl.statusCode).toBe(200);
    expect(dl.headers["content-type"]).toBe("image/png");
    expect(dl.headers["content-disposition"]).toContain("attachment");
    expect(dl.rawPayload.equals(PNG)).toBe(true);
  });

  it("unsupported mime → 400 (allowlist)", async () => {
    const r = await upload(
      { cookie: authorCookie, "x-csrf-token": authorCsrf },
      Buffer.from("#!/bin/sh"),
      "application/x-sh",
      "evil.sh",
    );
    expect(r.statusCode).toBe(400);
  });

  it("delete removes the row AND the blob; download then 404", async () => {
    const del = await suite.app.inject({
      method: "DELETE",
      url: `/v1/content/media/${mediaId}`,
      headers: { cookie: authorCookie, "x-csrf-token": authorCsrf },
    });
    expect(del.statusCode).toBe(200);
    expect(existsSync(storagePath)).toBe(false);

    const dl = await suite.app.inject({
      method: "GET",
      url: `/v1/content/media/${mediaId}`,
      headers: { cookie: authorCookie },
    });
    expect(dl.statusCode).toBe(404);

    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/content/${documentId}/media`,
      headers: { cookie: authorCookie },
    });
    expect((list.json() as { total: number }).total).toBe(0);
  });

  it("unknown document → 404 on upload and list", async () => {
    const ghost = "00000000-0000-4000-8000-000000000000";
    const boundary = "----mediaIT9f2c";
    const up = await suite.app.inject({
      method: "POST",
      url: `/v1/content/${ghost}/media`,
      headers: {
        cookie: authorCookie,
        "x-csrf-token": authorCsrf,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartBody(boundary, "x.png", "image/png", PNG),
    });
    expect(up.statusCode).toBe(404);
    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/content/${ghost}/media`,
      headers: { cookie: authorCookie },
    });
    expect(list.statusCode).toBe(404);
  });
});
