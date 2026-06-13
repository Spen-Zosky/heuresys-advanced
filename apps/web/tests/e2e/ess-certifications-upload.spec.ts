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
    // NB (D-27): there is intentionally no teardown — the ESS cert surface is
    // create+list only (no DELETE endpoint) and Playwright has no DB access here,
    // so each run leaves one `E2E Test Cert <ts>` row (slow ~1/run drift, cleaned
    // by ops when needed). This is a11y-NEUTRAL since @heuresys/ui@0.1.6 made the
    // scrollable table region keyboard-focusable regardless of row count (the
    // D-27 fix); the residue no longer drives the mobile axe violation.
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
