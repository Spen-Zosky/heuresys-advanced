/**
 * apps/web/tests/e2e/system-health.spec.ts
 *
 * X13 Block B — closes the single NONE route in the X13 coverage matrix.
 *
 * `/system-health` is the production PLATFORM_ADMIN-only dashboard that wraps
 * the canonical `SystemHealthDashboard` component (shared with /showcase/
 * system-health). Coverage matrix (qa_artifacts/x13_e2e_coverage_matrix.md
 * §1 row 22) flagged it as NONE prior to X13.
 *
 * Two scenarios:
 *   1. platformAdmin → dashboard renders heading + KPI labels (live data UI).
 *   2. tenantAdmin   → role gate redirects away from /system-health.
 *
 * Asserting on heading + visible KPI labels rather than data values keeps the
 * test stable across the canned demo content and any future live wiring.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("MVP-2a /system-health — live data + role gate", () => {
  test.describe("as platformAdmin", () => {
    test.use({ storageState: storageStateFor("platformAdmin") });

    test("/system-health renders the SUPERUSER dashboard", async ({ page }) => {
      await page.goto("/system-health");
      await page.waitForURL((url) => url.pathname === "/system-health", {
        timeout: 15_000,
      });

      await expect(
        page.getByRole("heading", { name: /System Health & Observability/i }),
      ).toBeVisible({ timeout: 15_000 });

      // KPIStrip surfaces 5 KPI labels — assert at least the first three to
      // confirm the component composed without a render-time crash. Using
      // first() defends against the showcase variant being rendered nearby
      // when both pages share the component.
      await expect(page.getByText("API uptime · 24h").first()).toBeVisible();
      await expect(page.getByText("DB pool · pg 16").first()).toBeVisible();
      await expect(page.getByText("RBAC cache").first()).toBeVisible();
    });
  });

  test.describe("as tenantAdmin (non-PLATFORM_ADMIN)", () => {
    test.use({ storageState: storageStateFor("tenantAdmin") });

    test("/system-health redirects non-superuser away", async ({ page }) => {
      await page.goto("/system-health");
      // Page.tsx replaces to "/" when the role check fails; the authenticated
      // layout then forwards based on the role. The only invariant we assert
      // is "no longer on /system-health".
      await page.waitForURL(
        (url) => url.pathname !== "/system-health",
        { timeout: 15_000 },
      );
      expect(page.url()).not.toContain("/system-health");
    });
  });
});
