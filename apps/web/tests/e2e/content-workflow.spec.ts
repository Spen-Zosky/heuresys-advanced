/**
 * apps/web/tests/e2e/content-workflow.spec.ts
 *
 * cap④ CMS P2 — LIVE DATA E2E for the publish workflow (in_review chain) + the ESS
 * knowledge base. A TENANT_ADMIN authors a document, submits it for review, publishes
 * it; an employee (same tenant) then reads it in /me/handbook. Drafts never appear in
 * the handbook. Two real browser contexts (author + reader); all data is live.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe.configure({ retries: 1 });

test("admin submits → publishes; employee reads it in the handbook; draft stays hidden", async ({ browser }) => {
  const adminCtx = await browser.newContext({ storageState: storageStateFor("tenantAdmin") });
  const admin = await adminCtx.newPage();
  const empCtx = await browser.newContext({ storageState: storageStateFor("employee") });
  const emp = await empCtx.newPage();

  const title = `E2E Handbook ${Date.now()}`;
  const draftTitle = `E2E Draft ${Date.now()}`;

  try {
    // --- admin authors a document + a draft ---
    await admin.goto("/content", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(admin.getByTestId("content-page")).toBeVisible({ timeout: 45_000 });

    await admin.getByTestId("content-create-title").fill(draftTitle);
    await admin.getByTestId("content-create-body").fill("# Secret\n\nNot for ESS.");
    await Promise.all([
      admin.waitForResponse((r) => r.url().includes("/v1/content") && r.request().method() === "POST"),
      admin.getByTestId("content-create-submit").click(),
    ]);

    await admin.getByTestId("content-create-title").fill(title);
    await admin.getByTestId("content-create-body").fill("# Policy\n\nRead me in the handbook.");
    await Promise.all([
      admin.waitForResponse((r) => r.url().includes("/v1/content") && r.request().method() === "POST"),
      admin.getByTestId("content-create-submit").click(),
    ]);

    // --- open it + run the workflow: draft → submit → in_review → publish ---
    await admin.getByTestId("content-filter-q").fill(title);
    const row = admin.getByTestId("content-row").filter({ hasText: title });
    await expect(row).toHaveCount(1, { timeout: 5_000 });
    await row.getByTestId("content-row-link").click();
    await expect(admin.getByTestId("content-workflow")).toBeVisible({ timeout: 30_000 });

    await Promise.all([
      admin.waitForResponse((r) => r.url().endsWith("/submit-for-review") && r.request().method() === "POST"),
      admin.getByTestId("content-submit-review").click(),
    ]);
    await expect(admin.getByTestId("content-workflow-status")).toHaveText(/In revisione|In review/);

    await Promise.all([
      admin.waitForResponse((r) => r.url().endsWith("/publish") && r.request().method() === "POST"),
      admin.getByTestId("content-publish").click(),
    ]);
    await expect(admin.getByTestId("content-workflow-status")).toHaveText(/Pubblicato|Published/);

    // --- employee reads the published doc in /me/handbook; the draft is NOT there ---
    await emp.goto("/me/handbook", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(emp.getByTestId("handbook-page")).toBeVisible({ timeout: 45_000 });
    await emp.getByTestId("handbook-search").fill(title);
    const hrow = emp.getByTestId("handbook-row").filter({ hasText: title });
    await expect(hrow).toHaveCount(1, { timeout: 5_000 });

    await emp.getByTestId("handbook-search").fill(draftTitle);
    await expect(emp.getByTestId("handbook-row").filter({ hasText: draftTitle })).toHaveCount(0);

    // open the published doc → body visible
    await emp.getByTestId("handbook-search").fill(title);
    await emp.getByTestId("handbook-row").filter({ hasText: title }).getByTestId("handbook-row-link").click();
    await expect(emp.getByTestId("handbook-detail-page")).toBeVisible({ timeout: 30_000 });
    await expect(emp.getByTestId("handbook-body")).toContainText("Read me in the handbook.");

    // --- cleanup: unpublish → draft → hard-delete both docs ---
    await Promise.all([
      admin.waitForResponse((r) => r.url().endsWith("/unpublish") && r.request().method() === "POST"),
      admin.getByTestId("content-unpublish").click(),
    ]);
    await Promise.all([
      admin.waitForResponse((r) => r.url().includes("/v1/content/") && r.request().method() === "DELETE"),
      admin.getByTestId("content-delete").click(),
    ]);
    // delete the draft too
    await expect(admin.getByTestId("content-page")).toBeVisible({ timeout: 30_000 });
    await admin.getByTestId("content-filter-q").fill(draftTitle);
    const drow = admin.getByTestId("content-row").filter({ hasText: draftTitle });
    await expect(drow).toHaveCount(1, { timeout: 5_000 });
    await drow.getByTestId("content-row-link").click();
    await expect(admin.getByTestId("content-edit-page")).toBeVisible({ timeout: 30_000 });
    await Promise.all([
      admin.waitForResponse((r) => r.url().includes("/v1/content/") && r.request().method() === "DELETE"),
      admin.getByTestId("content-delete").click(),
    ]);
  } finally {
    await adminCtx.close();
    await empCtx.close();
  }
});
