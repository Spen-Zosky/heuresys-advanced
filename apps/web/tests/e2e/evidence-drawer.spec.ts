/**
 * apps/web/tests/e2e/evidence-drawer.spec.ts — #27 (S1018).
 * The explainability wedge: from a skill-gap score → the raw underlying
 * evidence with provenance. Live over /v1/evidence/subject/:userId. MANAGER.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("evidence drawer (#27)", () => {
  test.use({ storageState: storageStateFor("manager") });

  test("opens the underlying evidence of a skill-gap subject", async ({ page }) => {
    await page.goto("/insights/skill-gap");
    await expect(page.getByTestId("skillgap-page")).toBeVisible();
    const firstRow = page.getByTestId("skillgap-row-select").first();
    if (!(await firstRow.count())) test.skip(true, "no skill-gap scores in scope");
    await firstRow.click();
    await expect(page.getByTestId("skillgap-explain")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("skillgap-evidence-open").click();
    // Either grouped evidence or a real empty-state renders in the drawer.
    await expect(
      page.getByTestId("evidence-drawer").or(page.getByTestId("evidence-empty")),
    ).toBeVisible({ timeout: 20_000 });
  });
});
