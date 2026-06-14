/**
 * apps/web/tests/e2e/ess-certifications-upload.spec.ts
 *
 * Acceptance MVP-3 Tappa C — ESS certifications form binding.
 *
 * Live-data E2E: a real seeded employee logs in, opens /me/certifications,
 * submits the form. The POST hits the live API → DB on the OCI VM via the
 * SSH tunnel on :5433. The new row must appear in the table after the
 * TanStack Query invalidate.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe.configure({ retries: 1 });

test.describe("ESS certifications upload form — live data", () => {
  test.use({ storageState: storageStateFor("employee") });

  test("can add a new certification and see it in the list", async ({ page }) => {
    await page.goto("/me/certifications");
    await expect(page.getByTestId("me-certifications-page")).toBeVisible();
    await expect(page.getByTestId("me-certification-form")).toBeVisible();

    // Use a unique name per run so the row is identifiable even if the
    // seed already has certifications. Date is ISO so the input type="date"
    // accepts it.
    // Unique name per run so the row is identifiable. The ESS cert surface is
    // create+list only (no DELETE endpoint), so the `E2E Test Cert <ts>` rows are
    // cleaned after the suite by the Playwright global teardown via psql (D-29,
    // global-teardown.ts). a11y-neutral regardless (D-27 / @heuresys/ui@0.1.6).
    const uniqueName = `E2E Test Cert ${Date.now()}`;

    await page.getByTestId("me-cert-name").fill(uniqueName);
    await page.getByTestId("me-cert-issuer").fill("E2E Issuer");
    await page.getByTestId("me-cert-issued").fill("2026-01-15");
    await page.getByTestId("me-cert-credential").fill(`E2E-${Date.now()}`);

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/v1/me/certifications") && r.request().method() === "POST",
      ),
      page.getByTestId("me-cert-submit").click(),
    ]);
    expect(resp.status()).toBe(201);

    // Success feedback rendered
    await expect(page.getByTestId("me-cert-success")).toBeVisible();

    // Table now contains the new row
    const rows = page.getByTestId("me-certification-row");
    await expect(rows.filter({ hasText: uniqueName })).toHaveCount(1, { timeout: 5_000 });
  });

  test("rejects invalid documentUri client-side without hitting the API", async ({ page }) => {
    await page.goto("/me/certifications");
    await expect(page.getByTestId("me-certification-form")).toBeVisible();

    await page.getByTestId("me-cert-name").fill("Bad URL Cert");
    await page.getByTestId("me-cert-issuer").fill("E2E Issuer");
    await page.getByTestId("me-cert-doc-uri").fill("not-a-url");

    // No request should be sent: zodResolver blocks on submit. Watch for any
    // POST attempt — if one slips through we fail loudly.
    const sawPost = page
      .waitForRequest(
        (r) => r.url().includes("/v1/me/certifications") && r.method() === "POST",
        { timeout: 1500 },
      )
      .then(() => true)
      .catch(() => false);

    await page.getByTestId("me-cert-submit").click();
    expect(await sawPost).toBe(false);
  });
});
