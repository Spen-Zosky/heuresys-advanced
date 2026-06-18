/**
 * apps/web/tests/e2e/surveys-m2.spec.ts — Surveys-M2 (admin read + ESS self-response).
 *
 * LIVE-DATA-E2E-ONLY. Admin (tenantAdmin) reads the live engagement read-model;
 * ESS (employee tommaso) answers an ASSIGNED active survey ("Q4 2025 Pulse Survey",
 * seeded assignment) and the completion is verified via re-fetch. The completed
 * assignment + ESS responses are reset by global-teardown so the spec is re-runnable.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor, gotoAuthenticated } from "./fixtures";

test.describe.configure({ retries: 1 });

test.describe("engagement admin (live)", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("surveys overview → per-survey results", async ({ page }) => {
    await gotoAuthenticated(page, "/engagement");
    await expect(page.getByTestId("engagement-page")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("engagement-row").first()).toBeVisible();
    // Open the Q4 Pulse survey (has questions + live responses).
    await page.getByTestId("engagement-row-link").filter({ hasText: "Q4" }).first().click();
    await expect(page.getByTestId("engagement-results-page")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("engagement-question-row").first()).toBeVisible();
  });
});

test.describe("ESS surveys (live)", () => {
  test.use({ storageState: storageStateFor("employee") });

  test("answer an assigned survey → completed (verified via re-fetch)", async ({ page }) => {
    await gotoAuthenticated(page, "/me/surveys");
    await expect(page.getByTestId("me-surveys-page")).toBeVisible({ timeout: 30_000 });

    // The seeded Q4 Pulse survey is assigned + pending → open it.
    const row = page.getByTestId("me-survey-row").filter({ hasText: "Q4" });
    await expect(row).toHaveCount(1);
    await row.getByTestId("me-survey-open").click();

    await expect(page.getByTestId("me-survey-answer-page")).toBeVisible({ timeout: 30_000 });
    // Wait for the detail query to resolve (the form replaces the "Caricamento…" state)
    // before counting inputs — the <main> is visible during loading too.
    await expect(page.getByTestId("me-survey-rating").first()).toBeVisible({ timeout: 15_000 });
    const ratings = page.getByTestId("me-survey-rating");
    const n = await ratings.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) await ratings.nth(i).fill("8");

    const [res] = await Promise.all([
      page.waitForResponse((r) => /\/v1\/me\/surveys\/.+\/responses/.test(r.url()) && r.request().method() === "POST"),
      page.getByTestId("me-survey-submit").click(),
    ]);
    expect([200, 201]).toContain(res.status());
    await expect(page.getByTestId("me-survey-success")).toBeVisible();

    // Re-fetch the list → the Q4 row now shows the completed badge (state from the real endpoint).
    await gotoAuthenticated(page, "/me/surveys");
    await expect(
      page.getByTestId("me-survey-row").filter({ hasText: "Q4" }).getByTestId("me-survey-completed"),
    ).toBeVisible({ timeout: 15_000 });
  });
});
