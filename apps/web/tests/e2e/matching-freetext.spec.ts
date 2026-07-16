/**
 * apps/web/tests/e2e/matching-freetext.spec.ts
 *
 * #40 (S1018) — free-text semantic search LIVE: the query is embedded at request
 * time (Voyage, flag MATCHING_FREETEXT_ENABLED=true in PROD) and ranked against
 * the live pgvector index. Two surfaces: /me/matching (ESS) and /skills (admin
 * catalog). Each search is a billable call — the spec fires exactly one per
 * surface, on explicit submit (the panel never searches on keystroke).
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("free-text semantic search (#40)", () => {
  test.describe("employee on /me/matching", () => {
    test.use({ storageState: storageStateFor("employee") });

    test("submits a query and gets ranked skills + occupations from the live index", async ({ page }) => {
      await page.goto("/me/matching");
      await expect(page.getByTestId("semantic-search")).toBeVisible();

      await page.getByTestId("semantic-search-input").fill("gestione del rischio bancario");
      await page.getByTestId("semantic-search-submit").click();

      // Query-time embedding + kNN over 25k live embeddings — allow network time.
      await expect(page.getByTestId("semantic-search-skill-row").first()).toBeVisible({ timeout: 20_000 });
      expect(await page.getByTestId("semantic-search-skill-row").count()).toBeGreaterThan(0);
      expect(await page.getByTestId("semantic-search-occ-row").count()).toBeGreaterThan(0);
    });
  });

  test.describe("tenant admin on /skills", () => {
    test.use({ storageState: storageStateFor("tenantAdmin") });

    test("semantic catalog search returns results on the skills page", async ({ page }) => {
      await page.goto("/skills");
      await expect(page.getByTestId("semantic-search")).toBeVisible();

      await page.getByTestId("semantic-search-input").fill("credit risk");
      await page.getByTestId("semantic-search-submit").click();

      await expect(page.getByTestId("semantic-search-occ-row").first()).toBeVisible({ timeout: 20_000 });
    });
  });
});
