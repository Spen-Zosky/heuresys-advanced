/**
 * apps/web/tests/e2e/me-profile-tabs.spec.ts
 *
 * S1010 F1 — the /me/profile navtab (Panoramica + Organizzazione) fed by the
 * anagraphic satellites (mig 000164) imported from the legacy DB. LIVE data:
 * asserts the real imported values for the employee persona (tommaso.fiore,
 * USER, RTL_BANK) — no mocks. Verifies tab switching + ?tab= deep-link.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("employee") });

test.describe("/me/profile navtab — live anagraphic data", () => {
  test("Panoramica shows real imported identity + banking", async ({ page }) => {
    await page.goto("/me/profile");
    await expect(page.getByTestId("me-profile-page")).toBeVisible();
    // the navtab itself is present
    await expect(page.getByTestId("profile-tabs")).toBeVisible();
    // default tab = Panoramica, rendered with real imported data
    await expect(page.getByTestId("profile-overview")).toBeVisible();
    await expect(page.getByTestId("section-identity")).toBeVisible();
    await expect(page.getByTestId("ov-taxId")).toContainText("FRITMS89A26F205S");
    // banking section imported (IBAN present)
    await expect(page.getByTestId("section-banking")).toBeVisible();
    await expect(page.getByTestId("ov-iban")).not.toBeEmpty();
  });

  test("switching to Organizzazione shows org + compensation + SAP", async ({ page }) => {
    await page.goto("/me/profile");
    await page.getByTestId("profile-tab-organizzazione").click();

    await expect(page.getByTestId("profile-organization")).toBeVisible();
    // SAP key + compensation imported from legacy
    await expect(page.getByTestId("org-pernr")).toContainText("00000390");
    await expect(page.getByTestId("org-salary")).toContainText("€");
    // deep-link param reflects the active tab
    await expect(page).toHaveURL(/[?&]tab=organizzazione/);
  });

  test("?tab=organizzazione deep-links straight to Organizzazione", async ({ page }) => {
    await page.goto("/me/profile?tab=organizzazione");
    await expect(page.getByTestId("profile-organization")).toBeVisible();
    await expect(page.getByTestId("org-jobTitle")).toBeVisible();
    // the Panoramica panel is present but hidden
    await expect(page.getByTestId("profile-panel-panoramica")).toBeHidden();
  });

  test("the editable Settings section stays available below the tabs", async ({ page }) => {
    await page.goto("/me/profile");
    await expect(page.getByTestId("me-profile-settings")).toBeVisible();
    await expect(page.getByTestId("profile-displayName")).toBeVisible();
    await expect(page.getByTestId("me-appearance")).toBeVisible();
  });
});
