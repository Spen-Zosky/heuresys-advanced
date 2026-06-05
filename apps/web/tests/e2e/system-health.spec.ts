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
 *   2. tenantAdmin   → role gate redirects away from /system-health.
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

      await expect(
        page.getByRole("heading", { name: /System Health & Observability/i }),
      ).toBeVisible({ timeout: 15_000 });

      // KPIStrip — live point-in-time labels (sparklines dropped: no history endpoint).
      await expect(page.getByText("API uptime · 24h").first()).toBeVisible();
      await expect(page.getByText("DB pool · pg 16").first()).toBeVisible();
      await expect(page.getByText("RBAC cache").first()).toBeVisible();

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

    test("/system-health redirects non-superuser away", async ({ page }) => {
      await page.goto("/system-health");
      // page.tsx replaces to "/" when the role check fails; the authenticated
      // layout then forwards based on the role. The only invariant we assert is
      // "no longer on /system-health".
      await page.waitForURL((url) => url.pathname !== "/system-health", {
        timeout: 15_000,
      });
      expect(page.url()).not.toContain("/system-health");
    });
  });
});
