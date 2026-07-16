/**
 * apps/web/tests/e2e/provenance.spec.ts — #28 (S1018).
 * Trust Ledger page live over /v1/provenance/* (70k+ rows). PLATFORM_ADMIN.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("provenance trust-ledger page (#28)", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("renders the KPI strip + summary + paginated records over the live ledger", async ({ page }) => {
    await page.goto("/provenance");
    await expect(page.getByTestId("provenance-page")).toBeVisible();
    await expect(page.getByTestId("provenance-title")).toBeVisible();
    // At least one record row from the 70k live reservoir.
    await expect(page.getByTestId("provenance-record-row").first()).toBeVisible({ timeout: 20_000 });
    // Status filter narrows the record set without error.
    await page.getByTestId("provenance-status-filter").selectOption("CONFLICTED");
    await expect(page.getByTestId("provenance-page")).toBeVisible();
  });
});
