/**
 * apps/web/tests/e2e/goals.spec.ts — modulo Goals/OKR Tasks 7 + 12.
 *
 * LIVE-DATA-E2E-ONLY: a TENANT_ADMIN (federica.marchetti@rtl-bank.org) loads
 * /goals and /okrs; tables are fed by GET /v1/goals and GET /v1/okrs
 * (live sys.sys_goals / sys.sys_okrs rows). Asserts page titles visible and
 * at least one row rendered.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 1 });

test.describe("Goals page — live data", () => {
  test("TENANT_ADMIN sees the goals list populated from live data", async ({ page }) => {
    await page.goto("/goals", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("goals-title")).toBeVisible({ timeout: 45_000 });
    // count badge reflects the live total (non-empty)
    await expect(page.getByTestId("goals-count")).toContainText(/\d+/);
    // at least one row rendered from the real API
    await expect(page.getByTestId("goals-row").first()).toBeVisible();
  });
});

test.describe("OKRs page — live data", () => {
  test("TENANT_ADMIN sees the OKR list populated from live data", async ({ page }) => {
    // storageState (tenantAdmin) is already applied at file level — just navigate
    await page.goto("/okrs", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("okrs-title")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("okrs-row").first()).toBeVisible();
  });
});
