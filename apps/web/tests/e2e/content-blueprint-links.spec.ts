/**
 * apps/web/tests/e2e/content-blueprint-links.spec.ts
 *
 * cap④ CMS P3 — content↔blueprint cross-link, LIVE DATA E2E. A real TENANT_ADMIN
 * self-seeds a content document (corpus is empty), attaches it to a real blueprint
 * process step on the content detail page, confirms the link surfaces on the
 * blueprint variant's "documentation" tab (the bidirectional view), then detaches
 * and hard-deletes the doc. Every assertion is on data round-tripped through /v1/*.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe.configure({ retries: 1 });

test.describe("cap④ CMS P3 content↔blueprint cross-link — live data", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("attach a blueprint to a doc, see it on the blueprint's documentation tab, detach", async ({ page }) => {
    const title = `ZZZ Link E2E ${Date.now()}`;

    // --- self-seed a content document ---
    await page.goto("/content", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("content-page")).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("content-create-title").fill(title);
    await page.getByTestId("content-create-body").fill("body for linking");
    const [createResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/content") && r.request().method() === "POST"),
      page.getByTestId("content-create-submit").click(),
    ]);
    expect(createResp.status()).toBe(200);
    const docId = ((await createResp.json()) as { documentId: string }).documentId;

    // --- open the doc, capture the blueprint process catalog (for the attach select) ---
    const [procResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/blueprint-processes?limit=500")),
      page.goto(`/content/${docId}`, { waitUntil: "domcontentloaded", timeout: 60_000 }),
    ]);
    const procs = (await procResp.json()) as { items: { blueprintProcessId: string; variantId: string; name: string }[] };
    const proc = procs.items[0]!;
    expect(proc.blueprintProcessId).toBeTruthy();
    await expect(page.getByTestId("content-links")).toBeVisible({ timeout: 30_000 });

    // --- attach the process (role defaults to documentation) ---
    await page.getByTestId("content-link-process").selectOption(proc.blueprintProcessId);
    const [attachResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/content-blueprint-links") && r.request().method() === "POST"),
      page.getByTestId("content-link-attach").click(),
    ]);
    expect(attachResp.status()).toBe(200);
    await expect(page.getByTestId("content-link-row")).toHaveCount(1, { timeout: 5_000 });
    await expect(page.getByTestId("content-link-row").first()).toContainText(proc.name);

    // --- blueprint side: the variant's documentation tab shows the doc ---
    await page.goto(`/blueprints/${proc.variantId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("blueprint-detail-page")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("blueprint-tab-documentation").click();
    await expect(page.getByTestId("blueprint-doc-link").filter({ hasText: title })).toHaveCount(1, { timeout: 5_000 });

    // --- detach on the content side ---
    await page.goto(`/content/${docId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("content-link-row")).toHaveCount(1, { timeout: 30_000 });
    const [delResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/content-blueprint-links/") && r.request().method() === "DELETE"),
      page.getByTestId("content-link-detach").click(),
    ]);
    expect(delResp.status()).toBe(200);
    await expect(page.getByTestId("content-links-empty")).toBeVisible({ timeout: 5_000 });

    // --- cleanup: hard-delete the seeded draft ---
    const [docDel] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/content/") && r.request().method() === "DELETE"),
      page.getByTestId("content-delete").click(),
    ]);
    expect(docDel.status()).toBe(200);
  });
});
