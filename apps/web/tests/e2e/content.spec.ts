/**
 * apps/web/tests/e2e/content.spec.ts
 *
 * cap④ CMS · P1 frontend — LIVE DATA E2E.
 * A real TENANT_ADMIN (the canonical content author — has a concrete tenant +
 * content:create; a PLATFORM_ADMIN's JWT carries a null tenant and cannot author)
 * logs in, opens /content, authors a document (POST → DB on the OCI VM via the SSH
 * tunnel :5433), edits it (PATCH appends a new version), verifies the version
 * history reflects 2 versions, then hard-deletes the draft.
 * No mock / fixture / placeholder — every assertion is on data the API returned.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe.configure({ retries: 1 });

test.describe("cap④ CMS admin /content — live data", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("author can create, edit (version bump), and delete a document", async ({ page }) => {
    await page.goto("/content", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("content-page")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("content-create-form")).toBeVisible();

    const title = `E2E CMS Doc ${Date.now()}`;

    // --- create (kind defaults to article, format to markdown) ---
    await page.getByTestId("content-create-title").fill(title);
    await page.getByTestId("content-create-body").fill("# Hello\n\nFirst body.");

    const [createResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/content") && r.request().method() === "POST"),
      page.getByTestId("content-create-submit").click(),
    ]);
    expect(createResp.status()).toBe(200);
    await expect(page.getByTestId("content-create-success")).toBeVisible();

    // Filter the list to this exact doc so the row is deterministic regardless of
    // any accumulated content from prior runs.
    await page.getByTestId("content-filter-q").fill(title);
    const row = page.getByTestId("content-row").filter({ hasText: title });
    await expect(row).toHaveCount(1, { timeout: 5_000 });

    // --- open edit ---
    await row.getByTestId("content-row-link").click();
    await expect(page.getByTestId("content-edit-page")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("content-edit-status")).toHaveText(/Bozza|Draft/);

    // --- edit body → server appends a version ---
    await page.getByTestId("content-edit-body").fill("# Hello\n\nEdited body v2.");
    const [saveResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/content/") && r.request().method() === "PATCH"),
      page.getByTestId("content-edit-submit").click(),
    ]);
    expect(saveResp.status()).toBe(200);
    await expect(page.getByTestId("content-edit-success")).toBeVisible();

    // Version history now has 2 rows (v1 create + v2 edit), the latest marked current.
    await expect(page.getByTestId("content-version-row")).toHaveCount(2, { timeout: 5_000 });
    await expect(page.getByTestId("content-version-current")).toHaveCount(1);

    // --- delete the draft (hard delete) + redirect back to the list ---
    const [delResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/content/") && r.request().method() === "DELETE"),
      page.getByTestId("content-delete").click(),
    ]);
    expect(delResp.status()).toBe(200);
    await expect(page.getByTestId("content-page")).toBeVisible({ timeout: 30_000 });
  });
});
