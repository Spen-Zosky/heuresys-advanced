/**
 * apps/web/tests/e2e/investors.spec.ts — public investor one-pager (#4).
 * Anonymous: renders + live metrics from /v1/public/platform-stats + a real
 * INVESTOR lead submit. Leads purged by global-teardown (@leads-e2e.test).
 */
import { test, expect } from "@playwright/test";

const STAMP = process.env.E2E_RUN_ID ?? "run";
const email = `e2e+inv-${STAMP}@leads-e2e.test`;

test.describe("Investor one-pager (anonymous)", () => {
  test("renders hero, live metrics, wedges, PDF button", async ({ page }) => {
    await page.goto("/investors", { waitUntil: "networkidle", timeout: 60_000 });
    await expect(page.getByTestId("investors-hero")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("investors-proof")).toBeVisible();
    // live metric fetched from F2 → a real number renders (not the "—" placeholder)
    await expect(page.getByTestId("stat-skills")).toContainText(/[0-9]/, { timeout: 30_000 });
    await expect(page.getByTestId("wedge-esco")).toBeVisible();
    await expect(page.getByTestId("investors-download-pdf")).toBeVisible();
  });

  test("submitting the contact form stores an INVESTOR lead", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/investors", { waitUntil: "networkidle", timeout: 60_000 });
    await page.getByTestId("lead-name").fill("E2E Investor");
    await page.getByTestId("lead-company").fill("E2E Fund");
    await page.getByTestId("lead-email").fill(email);
    await page.getByTestId("lead-consent").check();
    await page.getByTestId("lead-submit").click();
    await expect(page.getByTestId("lead-form-success")).toBeVisible({ timeout: 30_000 });
  });
});
