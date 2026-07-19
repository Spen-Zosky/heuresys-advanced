/**
 * apps/web/tests/e2e/content-media.spec.ts
 *
 * cap④ CMS P3 — media attachments, LIVE DATA E2E. A throwaway draft document
 * is created via the real API (federica TENANT_ADMIN, content:update), then
 * the /content/[id] attachments panel is exercised end-to-end: upload a real
 * PNG through the file input → row appears (filename + size from the live
 * row) → the download link streams the bytes back (attachment disposition) →
 * delete removes the row. The document is deleted in `finally` (cascade).
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { API_BASE, PERSONAS, storageStateFor, completeApiLogin } from "./fixtures";

const AUTHOR = PERSONAS.tenantAdmin;

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("e2e media payload"),
]);

async function authorCsrf(request: APIRequestContext): Promise<string> {
  // Dual-mode (S983 WS-E): completes the TOTP step-2 under the live policy.
  const { csrfToken } = await completeApiLogin(request, AUTHOR.email);
  return csrfToken;
}

test.describe("cap4 CMS P3 /content/[id] — media attachments (live)", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });
  test.setTimeout(120_000);

  test("upload → list → download → delete, full live loop", async ({ page, request }) => {
    const csrf = await authorCsrf(request);
    const created = await request.post(`${API_BASE}/v1/content`, {
      headers: { "x-csrf-token": csrf },
      data: { title: "[e2e-media] host doc", body: "host" },
    });
    expect(created.status()).toBe(200);
    const documentId = (await created.json()).documentId as string;

    try {
      await page.goto(`/content/${documentId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await expect(page.getByTestId("content-media-panel")).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId("content-media-empty")).toBeVisible({ timeout: 15_000 });

      // Upload through the hidden file input (panel button proxies to it).
      const [uploadResp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes(`/v1/content/${documentId}/media`) && r.request().method() === "POST",
          { timeout: 30_000 },
        ),
        page.getByTestId("content-media-file").setInputFiles({
          name: "e2e-shot.png",
          mimeType: "image/png",
          buffer: PNG,
        }),
      ]);
      expect(uploadResp.status()).toBe(201);

      const row = page.getByTestId("content-media-row");
      await expect(row).toHaveCount(1, { timeout: 15_000 });
      await expect(row.first()).toContainText("e2e-shot.png");

      // The download link streams the same bytes back, as an attachment.
      const href = await page.getByTestId("content-media-download").getAttribute("href");
      expect(href).toBeTruthy();
      const mediaId = href!.split("/").pop()!;
      const dl = await request.get(`${API_BASE}/v1/content/media/${mediaId}`);
      expect(dl.status()).toBe(200);
      expect(dl.headers()["content-disposition"]).toContain("attachment");
      expect(Buffer.from(await dl.body()).equals(PNG)).toBe(true);

      // Delete from the panel → empty state returns.
      const [delResp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes("/v1/content/media/") && r.request().method() === "DELETE",
          { timeout: 30_000 },
        ),
        page.getByTestId("content-media-delete").click(),
      ]);
      expect(delResp.status()).toBe(200);
      await expect(page.getByTestId("content-media-empty")).toBeVisible({ timeout: 15_000 });
    } finally {
      await request
        .delete(`${API_BASE}/v1/content/${documentId}`, { headers: { "x-csrf-token": csrf } })
        .catch(() => {});
    }
  });
});
