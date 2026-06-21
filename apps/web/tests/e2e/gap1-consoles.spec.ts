/**
 * apps/web/tests/e2e/gap1-consoles.spec.ts — Gap#1 Porte (Step 2 + 5).
 *
 * LIVE-DATA-E2E-ONLY: a TENANT_ADMIN (federica.marchetti@rtl-bank.org) loads the
 * Org-Director console (/org-director, fed by /v1/capability/composition +
 * /v1/capability/maturity — the live MLCE + Maturity engines) and the Process-Owner
 * console (/process-owner, fed by /v1/blueprint-processes). Asserts the page titles
 * and at least one row rendered from the real API. federica holds capability:read,
 * org_director:read, process_owner:read and blueprint:read (mig 000145).
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 1 });

test.describe("Org-Director console — live capability/maturity", () => {
  test("TENANT_ADMIN sees org-units scored by the MLCE/Maturity engines", async ({ page }) => {
    await page.goto("/org-director", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("org-director-title")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("org-director-count")).toContainText(/\d+/);
    await expect(page.getByTestId("org-director-row").first()).toBeVisible();
  });
});

test.describe("Process-Owner console — live process catalog", () => {
  test("TENANT_ADMIN sees the blueprint process catalog populated from live data", async ({ page }) => {
    await page.goto("/process-owner", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("process-owner-title")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("process-owner-row").first()).toBeVisible();
  });

  // Gap#1 follow-up: the RACI drill-down (/v1/organization-unit-processes/by-process/:id).
  // "Human Capital Management" (process 17) has live OU↔process RACI assignments on the
  // rebuilt RTL_BANK reference tenant (2 OUs, OWNER + CONTRIBUTOR).
  test("RACI drill-down loads live org-unit assignments for a selected process", async ({ page }) => {
    await page.goto("/process-owner", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("process-owner-row").first()).toBeVisible({ timeout: 45_000 });
    // Idle state before any selection: the hint, not a table.
    await expect(page.getByTestId("raci-drill-hint")).toBeVisible();
    await page
      .getByTestId("process-owner-row")
      .filter({ hasText: "Human Capital Management" })
      .getByTestId("process-owner-raci-btn")
      .click();
    // Live data from the by-process endpoint: a non-empty count + at least one OU row.
    await expect(page.getByTestId("raci-drill-count")).toContainText(/\d+/, { timeout: 45_000 });
    await expect(page.getByTestId("raci-drill-row").first()).toBeVisible();
  });
});
