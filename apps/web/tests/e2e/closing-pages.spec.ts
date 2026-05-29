/**
 * apps/web/tests/e2e/closing-pages.spec.ts
 *
 * Live-data E2E for the final batch: /admin/roles, /organization/org-chart,
 * /me/skills/self-assessment, /me/learning/catalogue, /me/career/target.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("MVP-2a closing pages — live data", () => {
  test.describe("as platformAdmin", () => {
    test.use({ storageState: storageStateFor("platformAdmin") });

    test("/admin/roles renders the role × permission matrix from live API", async ({ page }) => {
      await page.goto("/admin/roles");
      await expect(page.getByTestId("admin-roles-page")).toBeVisible();
      await expect(page.getByTestId("admin-roles-count")).toContainText(/\d+\s+ruoli/, { timeout: 15_000 });
      // Seed has 8 roles.
      const roleCols = page.getByTestId("admin-roles-role-col");
      const rolesCount = await roleCols.count();
      expect(rolesCount).toBeGreaterThanOrEqual(7);
      // At least one row of permissions exists.
      const permRows = page.getByTestId("admin-roles-perm-row");
      expect(await permRows.count()).toBeGreaterThan(10);
    });
  });

  test.describe("as tenantAdmin", () => {
    test.use({ storageState: storageStateFor("tenantAdmin") });

    test("/organization/org-chart renders the seeded ORG_CHART force graph", async ({ page }) => {
      await page.goto("/organization/org-chart");
      await expect(page.getByTestId("org-chart-page")).toBeVisible();
      await expect(page.getByTestId("org-chart-count")).toContainText(/\d+\s+grafici/);
      // F4.4: RTL_ORG_CHART is seeded (db/seeds/org_chart_rtl_demo.sql) → the
      // interactive echarts force graph renders, not the empty-state.
      await expect(page.getByTestId("org-chart-graph")).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe("as employee", () => {
    test.use({ storageState: storageStateFor("employee") });

    test("/me/skills/self-assessment renders form with selects", async ({ page }) => {
      await page.goto("/me/skills/self-assessment");
      await expect(page.getByTestId("self-assessment-page")).toBeVisible();
      await expect(page.getByTestId("self-assessment-filter")).toBeVisible();
      await expect(page.getByTestId("self-assessment-skill")).toBeVisible();
      await expect(page.getByTestId("self-assessment-proficiency")).toBeVisible();
      await expect(page.getByTestId("self-assessment-submit")).toBeVisible();
    });

    test("/me/learning/catalogue renders the path catalogue with filter", async ({ page }) => {
      await page.goto("/me/learning/catalogue");
      await expect(page.getByTestId("learning-catalogue-page")).toBeVisible();
      await expect(page.getByTestId("learning-catalogue-count")).toContainText(/\d+\s+percorsi/);
      await expect(page.getByTestId("learning-catalogue-filter")).toBeVisible();
    });

    test("/me/career/target renders position picker form", async ({ page }) => {
      await page.goto("/me/career/target");
      await expect(page.getByTestId("career-target-page")).toBeVisible();
      await expect(page.getByTestId("career-target-filter")).toBeVisible();
      await expect(page.getByTestId("career-target-position")).toBeVisible();
      await expect(page.getByTestId("career-target-date")).toBeVisible();
      await expect(page.getByTestId("career-target-submit")).toBeVisible();
    });
  });
});
