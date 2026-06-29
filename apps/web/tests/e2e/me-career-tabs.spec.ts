/**
 * apps/web/tests/e2e/me-career-tabs.spec.ts
 *
 * Live-data E2E for /me/career sub-tab IA (S1011 F3b): Obiettivi | Percorsi |
 * Rischio & Successione. Employee persona (tommaso.fiore) has real seeded data
 * in all three: 4 goals (backfilled mig 000166), a PRIMARY position with career
 * paths, and a LOW flight-risk + succession-readiness scores.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("employee") });

test.describe("/me/career sub-tabs — live data (F3b)", () => {
  test("renders the 3 sub-tabs and real data in each", async ({ page }) => {
    await page.goto("/me/career");
    await expect(page.getByTestId("me-career-page")).toBeVisible();

    // the three tabs are present
    await expect(page.getByTestId("career-tab-obiettivi")).toBeVisible();
    await expect(page.getByTestId("career-tab-percorsi")).toBeVisible();
    await expect(page.getByTestId("career-tab-rischio")).toBeVisible();

    // Obiettivi (default) — tommaso has real goals
    await expect(page.getByTestId("career-goals")).toBeVisible();
    await expect(page.getByTestId("career-goal-primary")).toBeVisible();

    // Percorsi — derived from the PRIMARY position
    await page.getByTestId("career-tab-percorsi").click();
    await expect(page.getByTestId("career-paths")).toBeVisible();
    await expect(page.getByTestId("career-paths-from")).toBeVisible();

    // Rischio & Successione — own flight-risk band is LOW (real score)
    await page.getByTestId("career-tab-rischio").click();
    await expect(page.getByTestId("career-flight-risk")).toBeVisible();
    await expect(page.getByTestId("career-flight-band")).toContainText("LOW");
    await expect(page.getByTestId("career-succession")).toBeVisible();
  });
});
