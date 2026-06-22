/**
 * apps/web/tests/e2e/demo.spec.ts — public guided demo (#4).
 * Anonymous: renders the tour + a real DEMO lead submit. Leads purged by
 * global-teardown (@leads-e2e.test).
 */
import { test, expect } from "@playwright/test";

const STAMP = process.env.E2E_RUN_ID ?? "run";
const email = `e2e+demo-${STAMP}@leads-e2e.test`;

test.describe("Guided demo (anonymous)", () => {
  test("renders hero + tour steps", async ({ page }) => {
    await page.goto("/demo", { waitUntil: "networkidle", timeout: 60_000 });
    await expect(page.getByTestId("demo-hero")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("demo-step-02")).toBeVisible();
    await expect(page.getByTestId("demo-step-06")).toBeVisible(); // the maturity wow-step
    await expect(page.getByTestId("demo-cta")).toBeVisible();
  });

  test("submitting the CTA stores a DEMO lead", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/demo", { waitUntil: "networkidle", timeout: 60_000 });
    await page.getByTestId("lead-name").fill("E2E Demo Prospect");
    await page.getByTestId("lead-company").fill("E2E Bank");
    await page.getByTestId("lead-email").fill(email);
    await page.getByTestId("lead-consent").check();
    await page.getByTestId("lead-submit").click();
    await expect(page.getByTestId("lead-form-success")).toBeVisible({ timeout: 30_000 });
  });
});
