/**
 * apps/web/tests/e2e/goals-life.spec.ts — #26 (S1018).
 * Goal activity timeline + OKR check-ins UI, live over the 000037 satellites.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("goal/OKR life UI (#26)", () => {
  test.describe("admin", () => {
    test.use({ storageState: storageStateFor("tenantAdmin") });

    test("goals page: opening a row shows the activity timeline", async ({ page }) => {
      await page.goto("/goals");
      await expect(page.getByTestId("goals-page")).toBeVisible();
      const open = page.getByTestId("goals-timeline-open").first();
      await expect(open).toBeVisible({ timeout: 15_000 });
      await open.click();
      await expect(page.getByTestId("goal-timeline")).toBeVisible({ timeout: 15_000 });
    });

    test("okrs page: opening a row shows the check-in history dialog", async ({ page }) => {
      await page.goto("/okrs");
      await expect(page.getByTestId("okrs-page")).toBeVisible();
      const open = page.getByTestId("okrs-checkins-open").first();
      await expect(open).toBeVisible({ timeout: 15_000 });
      await open.click();
      // Either check-in items or a real empty state renders inside the dialog.
      await expect(
        page.getByTestId("okr-checkins").or(page.getByTestId("okr-checkins-empty")),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe("employee self-view", () => {
    test.use({ storageState: storageStateFor("employee") });

    test("me/career Obiettivi: opening a goal shows the self timeline", async ({ page }) => {
      await page.goto("/me/career");
      // Activate the Obiettivi sub-tab (career page uses TabNav; the goals tab renders career-goals).
      const obiettivi = page.getByRole("tab", { name: /obiettivi|goals/i });
      if (await obiettivi.count()) await obiettivi.first().click();
      const open = page.getByTestId("me-goal-timeline-open").first();
      if (!(await open.count())) test.skip(true, "employee has no goals rendered");
      await open.click();
      await expect(page.getByTestId("goal-timeline")).toBeVisible({ timeout: 15_000 });
    });
  });
});
