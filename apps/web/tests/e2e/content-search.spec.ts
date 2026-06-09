/**
 * apps/web/tests/e2e/content-search.spec.ts
 *
 * cap④ CMS · P3 frontend — full-text search box, LIVE DATA E2E.
 * A real TENANT_ADMIN (the canonical content author; a PLATFORM_ADMIN JWT carries a
 * null tenant and cannot author) logs in, self-seeds a document whose BODY carries a
 * unique token (the CMS corpus is empty), then exercises the FTS box on /content:
 *   - the ranked hit comes back from GET /v1/content/search with a << >>-highlighted
 *     snippet (proves body-aware FTS, not the list's title-substring filter),
 *   - a guaranteed-miss token renders the real empty-state,
 *   - the seeded draft is hard-deleted so the run is idempotent.
 * No mock / fixture — every assertion is on data the live API returned via the tunnel.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe.configure({ retries: 1 });

test.describe("cap④ CMS /content full-text search — live data", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("search box returns ranked live hits with snippet highlight + empty state", async ({ page }) => {
    const token = `zqxsearch${Date.now()}`;
    const title = `E2E Search ${token}`;

    await page.goto("/content", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("content-page")).toBeVisible({ timeout: 45_000 });

    // --- self-seed a document whose BODY carries the unique FTS token ---
    await page.getByTestId("content-create-title").fill(title);
    await page.getByTestId("content-create-body").fill(`# Heading\n\nThe magic token is ${token} inside the body.`);
    const [createResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/content") && r.request().method() === "POST"),
      page.getByTestId("content-create-submit").click(),
    ]);
    expect(createResp.status()).toBe(200);
    const created = (await createResp.json()) as { documentId: string };

    // --- full-text search finds it (ranked, with a <mark> snippet) ---
    const [searchResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/content/search") && r.request().method() === "GET"),
      page.getByTestId("content-search-input").fill(token),
    ]);
    expect(searchResp.status()).toBe(200);
    const results = page.getByTestId("content-search-result");
    await expect(results).toHaveCount(1, { timeout: 5_000 });
    await expect(results.first()).toContainText(title);
    await expect(results.first().locator("mark").first()).toBeVisible();

    // --- guaranteed miss → real empty-state ---
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/content/search") && r.request().method() === "GET"),
      page.getByTestId("content-search-input").fill(`nohit${Date.now()}`),
    ]);
    await expect(page.getByTestId("content-search-empty")).toBeVisible({ timeout: 5_000 });

    // --- cleanup: hard-delete the seeded draft ---
    await page.goto(`/content/${created.documentId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("content-edit-page")).toBeVisible({ timeout: 30_000 });
    const [delResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/content/") && r.request().method() === "DELETE"),
      page.getByTestId("content-delete").click(),
    ]);
    expect(delResp.status()).toBe(200);
  });
});
