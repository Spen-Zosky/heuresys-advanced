/**
 * apps/web/tests/e2e/admin-tabs.spec.ts
 *
 * Live-data E2E for tabbed detail pages:
 *   /tenants/[id]                        (platformAdmin)
 *   /tenants/[id]/enterprise-typing      (platformAdmin)
 *   /blueprints/[variantId]              (tenantAdmin)
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("MVP-2a admin tabbed pages — live data", () => {
  test.describe("as platformAdmin", () => {
    test.use({ storageState: storageStateFor("platformAdmin") });

    test("/tenants/[id] renders overview tab and switches to typing", async ({ page }) => {
      // Resolve the RTL tenant ID via the API list (live data).
      await page.goto("/tenants");
      await expect(page.getByTestId("tenants-page")).toBeVisible();
      const firstLink = page.getByTestId("tenant-link").first();
      const href = await firstLink.getAttribute("href");
      expect(href).toMatch(/^\/tenants\/[0-9a-f-]+$/);
      await firstLink.click();
      await page.waitForURL(/\/tenants\/[0-9a-f-]+$/);

      await expect(page.getByTestId("tenant-detail-page")).toBeVisible();
      await expect(page.getByTestId("tenant-name")).toBeVisible();
      await expect(page.getByTestId("tenant-tab-overview")).toBeVisible();
      await expect(page.getByTestId("tenant-tab-content-overview")).toBeVisible();

      await page.getByTestId("tenant-tab-typing").click();
      await expect(page.getByTestId("tenant-tab-content-typing")).toBeVisible();

      await page.getByTestId("tenant-tab-users").click();
      await expect(page.getByTestId("tenant-tab-content-users")).toBeVisible();
      await expect(page.getByTestId("tenant-users-link")).toBeVisible();
    });

    test("/tenants/[id]/enterprise-typing wizard renders all 4 selects", async ({ page }) => {
      await page.goto("/tenants");
      const firstLink = page.getByTestId("tenant-link").first();
      const href = await firstLink.getAttribute("href");
      const tenantId = href?.replace("/tenants/", "");
      expect(tenantId).toBeTruthy();

      await page.goto(`/tenants/${tenantId}/enterprise-typing`);
      await expect(page.getByTestId("enterprise-typing-page")).toBeVisible();
      await expect(page.getByTestId("typing-family")).toBeVisible();
      await expect(page.getByTestId("typing-variant")).toBeVisible();
      await expect(page.getByTestId("typing-model")).toBeVisible();
      await expect(page.getByTestId("typing-sizeband")).toBeVisible();
      await expect(page.getByTestId("typing-submit")).toBeVisible();
    });
  });

  test.describe("as tenantAdmin", () => {
    test.use({ storageState: storageStateFor("tenantAdmin") });

    test("/blueprints/[variantId] shows processes tab → activations tab", async ({ page }) => {
      await page.goto("/blueprints");
      await expect(page.getByTestId("blueprints-page")).toBeVisible();
      const firstLink = page.getByTestId("blueprint-link").first();
      await firstLink.click();
      await page.waitForURL(/\/blueprints\/[0-9a-f-]+$/);

      await expect(page.getByTestId("blueprint-detail-page")).toBeVisible();
      await expect(page.getByTestId("blueprint-tab-processes")).toBeVisible();

      // Default tab is processes — table or empty present.
      await expect(page.getByTestId("blueprint-tab-content-processes")).toBeVisible();

      await page.getByTestId("blueprint-tab-activations").click();
      await expect(page.getByTestId("blueprint-tab-content-activations")).toBeVisible();
    });
  });
});
