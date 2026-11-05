/**
 * apps/web/tests/e2e/system-health.spec.ts
 *
 * `/system-health` is the production PLATFORM_ADMIN-only observability dashboard.
 * After F7 it renders `SystemHealthLive` — 100% live data from GET
 * /v1/observability/system-health + GET /v1/auth/role-permissions (no mock).
 * The brand-showcase mock (`SystemHealthDashboard`) is now confined to
 * /showcase/system-health.
 *
 * Scenarios:
 *   1. platformAdmin → live dashboard renders heading + live KPI labels + the
 *      real tenant fleet (the old mock's fabricated tenants must be ABSENT) + the
 *      live RBAC matrix.
 *   2. tenantAdmin   → the page guard (L1, S-1) shows the no-access screen and the
 *      dashboard never renders.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("MVP-2a /system-health — live data + role gate", () => {
  test.describe("as platformAdmin", () => {
    test.use({ storageState: storageStateFor("platformAdmin") });

    test("/system-health renders the live observability dashboard", async ({ page }) => {
      await page.goto("/system-health");
      await page.waitForURL((url) => url.pathname === "/system-health", {
        timeout: 15_000,
      });

      // Labels in the person's language (lotto L6, F-2): the suite runs in Italian.
      await expect(
        page.getByRole("heading", { name: /Stato della piattaforma/i }),
      ).toBeVisible({ timeout: 15_000 });

      // KPIStrip — live point-in-time labels.
      await expect(page.getByText("Disponibilità dell'API · 24 h").first()).toBeVisible();
      await expect(page.getByText("Connessioni al database").first()).toBeVisible();
      await expect(page.getByText("Permessi in memoria").first()).toBeVisible();

      // LIVE DATA: the tenant fleet comes from GET /v1/observability/system-health
      // (the real RTL_BANK + HEURESYS tenants). The former mock's fabricated tenants
      // must be GONE — this is the assertion that proves the page is live, not mock.
      await expect(page.getByTestId("system-health-tenant-fleet")).toBeVisible();
      await expect(page.getByText("GENESIS_DEMO")).toHaveCount(0);
      await expect(page.getByText("ACME_CORP")).toHaveCount(0);

      // RBAC matrix is pivoted from GET /v1/auth/role-permissions (live).
      await expect(page.getByText("RBAC permissions matrix")).toBeVisible();
    });
  });

  test.describe("as tenantAdmin (non-PLATFORM_ADMIN)", () => {
    test.use({ storageState: storageStateFor("tenantAdmin") });

    test("/system-health is closed to a non-superuser", async ({ page }) => {
      await page.goto("/system-health");
      // Since lotto L1 (S-1) the page guard answers before the page asks for data: the
      // no-access screen replaces the dashboard, on the same address.
      await expect(page.getByTestId("page-no-access")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("system-health-page")).toHaveCount(0);
      await expect(page.getByTestId("system-health-tenant-fleet")).toHaveCount(0);
    });
  });
});
