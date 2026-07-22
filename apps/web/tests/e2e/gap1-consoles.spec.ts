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

  // Gap#1 follow-up: the CapabilityRadar (@heuresys/ui) drill-down of an org-unit's
  // live Maturity dimensions (composite / skill / KPI / readiness / gap-freeness,
  // from the Maturity engine criteria). 20 RTL_BANK OUs carry maturity scores.
  test("maturity radar drill-down renders for a scored org-unit", async ({ page }) => {
    await page.goto("/org-director", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("org-director-row").first()).toBeVisible({ timeout: 45_000 });
    // Idle state before any selection: the hint, not a chart.
    await expect(page.getByTestId("org-director-radar-hint")).toBeVisible();
    // Pick the first OU that actually has maturity criteria (enabled button).
    await page.locator('[data-testid="org-director-radar-btn"]:not([disabled])').first().click();
    await expect(page.getByTestId("org-director-radar-chart")).toBeVisible({ timeout: 30_000 });
    // CapabilityRadar renders an SVG from the live maturity dimensions.
    await expect(page.getByTestId("org-director-radar-chart").locator("svg")).toBeVisible();
  });

  // #55 F1 — Essential Capability Ranker: declared-formula ranking rendered live
  // (weights surfaced in the subtitle, every component drillable per row).
  test("essential-capability ranking renders live with drillable components", async ({ page }) => {
    await page.goto("/org-director", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("org-director-essential-title")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("org-director-essential-row").first()).toBeVisible({ timeout: 30_000 });
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
      // ADR-0029 (S1024) localized the catalog in-row: the process is named in
      // Italian on the default locale ("Human Capital Management" pre-dated it).
      .filter({ hasText: "Gestione del capitale umano" })
      .getByTestId("process-owner-raci-btn")
      .click();
    // Live data from the by-process endpoint: a non-empty count + at least one OU row.
    await expect(page.getByTestId("raci-drill-count")).toContainText(/\d+/, { timeout: 45_000 });
    await expect(page.getByTestId("raci-drill-row").first()).toBeVisible();
  });
});
