/**
 * apps/web/tests/e2e/handbook-media.spec.ts
 * ESS media serve (cap④ CMS P3 close, S982): an admin-authored PUBLISHED doc
 * with an embedded image (admin media URL in the markdown) renders the image
 * INLINE for the employee on /me/handbook/[id] (URL rewritten client-side to
 * the published-only ESS endpoint) + the attachment list shows the file.
 * Setup/teardown via API (two personas), UI assertions as the employee.
 */
import { test, expect, request as pwRequest } from "@playwright/test";
import { storageStateFor, completeApiLogin, API_BASE } from "./fixtures";



const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("handbook-media e2e payload"),
]);

test.use({ storageState: storageStateFor("employee") });

test("employee sees the embedded image inline + the attachment list on the handbook detail", async ({ page }) => {
  // --- API setup as the author (TENANT_ADMIN) -------------------------
  const ctx = await pwRequest.newContext({ baseURL: API_BASE });
  // Dual-mode (S983 WS-E): completes the TOTP step-2 under the live policy.
  const { csrfToken } = await completeApiLogin(ctx, "federica.marchetti@rtl-bank.org");
  const csrf = { "x-csrf-token": csrfToken };

  let documentId = "";
  let mediaId = "";
  try {
    const doc = await ctx.post("/v1/content", {
      headers: csrf,
      data: { title: "[hb-media-e2e] Manuale con immagine", body: "placeholder" },
    });
    expect(doc.ok()).toBeTruthy();
    documentId = ((await doc.json()) as { documentId: string }).documentId;

    const up = await ctx.post(`/v1/content/${documentId}/media`, {
      headers: csrf,
      multipart: { file: { name: "photo.png", mimeType: "image/png", buffer: PNG } },
    });
    expect(up.status()).toBe(201);
    mediaId = ((await up.json()) as { mediaId: string }).mediaId;

    // Embed with the ADMIN url (the copy-markdown convention) + publish.
    const patch = await ctx.patch(`/v1/content/${documentId}`, {
      headers: csrf,
      data: { body: `Benvenuto.\n\n![photo](/api/v1/content/media/${mediaId})\n` },
    });
    expect(patch.ok()).toBeTruthy();
    const pub = await ctx.post(`/v1/content/${documentId}/publish`, { headers: csrf });
    expect(pub.ok()).toBeTruthy();

    // --- UI as the employee -------------------------------------------
    await page.goto(`/me/handbook/${documentId}`);
    await expect(page.getByTestId("handbook-body")).toBeVisible();
    const img = page.getByTestId("handbook-media-img");
    await expect(img).toBeVisible();
    // The rewritten ESS url actually loaded bytes (naturalWidth>0 = decoded...
    // our fixture is not a real PNG, so assert the RESPONSE instead: the
    // same-origin ESS endpoint returns 200 inline for this employee.
    await expect(img).toHaveAttribute("src", `/api/v1/me/content/media/${mediaId}`);
    const essResp = await page.request.get(`/api/v1/me/content/media/${mediaId}`);
    expect(essResp.status()).toBe(200);
    expect(essResp.headers()["content-disposition"]).toContain("inline");
    expect(Buffer.from(await essResp.body()).equals(PNG)).toBeTruthy();

    // Attachment list shows the file with the ESS link.
    await expect(page.getByTestId("handbook-attachments")).toBeVisible();
    await expect(page.getByTestId("handbook-attachment-link")).toHaveAttribute(
      "href",
      `/api/v1/me/content/media/${mediaId}`,
    );
  } finally {
    if (mediaId) await ctx.delete(`/v1/content/media/${mediaId}`, { headers: csrf });
    if (documentId) await ctx.delete(`/v1/content/${documentId}`, { headers: csrf });
    await ctx.dispose();
  }
});
