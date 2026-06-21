/**
 * apps/web/tests/e2e/landing.spec.ts — public GTM front door (#4).
 * Anonymous (no storageState): the landing renders + a real lead submit hits the
 * live /v1/leads endpoint and stores a row. Teardown deletes the E2E leads.
 */
import { test, expect } from "@playwright/test";

const STAMP = process.env.E2E_RUN_ID ?? "run";
const email = `e2e+${STAMP}@leads-e2e.test`;

test.describe("GTM front-door landing (anonymous)", () => {
  test("renders the positioning + 3 wedges", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("landing-hero")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("wedge-esco")).toBeVisible();
    await expect(page.getByTestId("wedge-explain")).toBeVisible();
    await expect(page.getByTestId("wedge-position")).toBeVisible();
    await expect(page.getByTestId("landing-login")).toBeVisible();
  });

  test("submitting the lead form stores a real lead", async ({ page }) => {
    // 90 s budget: networkidle on a dev server (HMR WebSocket) + API round-trip.
    test.setTimeout(90_000);
    // networkidle ensures the "use client" LeadForm is hydrated before we interact.
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
    await page.getByTestId("lead-name").fill("E2E Prospect");
    await page.getByTestId("lead-company").fill("E2E Bank");
    await page.getByTestId("lead-email").fill(email);
    await page.getByTestId("lead-consent").check();
    await page.getByTestId("lead-submit").click();
    await expect(page.getByTestId("lead-form-success")).toBeVisible({ timeout: 30_000 });
  });
});
