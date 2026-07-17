/**
 * apps/web/tests/e2e/talent-review.spec.ts — A/L3 (#29).
 * Talent-review 9-box page live over /v1/talent-review/* (talent scores, fit,
 * readiness, succession, critical positions/coverage). SENSITIVE (EVALUATION) →
 * org-gated at the API level (proven by the integration suite); this asserts the
 * board-ready grid + panels render on a real login. PLATFORM_ADMIN (no self-view).
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("talent review 9-box page (#29 A/L3)", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("renders the 9-box grid + supporting talent panels over live scores", async ({ page }) => {
    await page.goto("/talent-review");
    await expect(page.getByTestId("talent-review-page")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("talent-review-title")).toBeVisible();
    // The board-ready 3×3 grid (154 live talent scores bucketed into 9 cells).
    await expect(page.getByTestId("talent-nine-box")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("talent-nine-box-cell").first()).toBeVisible();
    // A supporting live panel (readiness by horizon).
    await expect(page.getByTestId("talent-readiness-row").first()).toBeVisible({ timeout: 20_000 });
  });
});
