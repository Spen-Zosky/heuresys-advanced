/**
 * apps/web/tests/e2e/position-sub.spec.ts
 *
 * Live-data E2E for /positions/[id]/{skills,kpis,learning}.
 * Uses tenantAdmin storage and picks the first position from the live list.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });

async function getFirstPositionId(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/positions");
  const link = page.getByTestId("position-link").first();
  const href = await link.getAttribute("href");
  const id = href?.replace("/positions/", "") ?? "";
  expect(id).toMatch(/^[0-9a-f-]+$/);
  return id;
}

test.describe("MVP-2a position sub-resources — live data", () => {
  test("/positions/[id]/skills renders requirements list (empty state OK)", async ({ page }) => {
    const positionId = await getFirstPositionId(page);
    await page.goto(`/positions/${positionId}/skills`);
    await expect(page.getByTestId("position-skills-page")).toBeVisible();
    await expect(page.getByTestId("position-skills-count")).toContainText(/\d+\s+skill/);
    await expect(page.getByTestId("position-skills-back")).toBeVisible();
  });

  test("/positions/[id]/kpis renders requirements list (empty state OK)", async ({ page }) => {
    const positionId = await getFirstPositionId(page);
    await page.goto(`/positions/${positionId}/kpis`);
    await expect(page.getByTestId("position-kpis-page")).toBeVisible();
    await expect(page.getByTestId("position-kpis-count")).toContainText(/\d+\s+KPI/);
  });

  test("/positions/[id]/learning composes gaps for the position", async ({ page }) => {
    const positionId = await getFirstPositionId(page);
    await page.goto(`/positions/${positionId}/learning`);
    await expect(page.getByTestId("position-learning-page")).toBeVisible();
    await expect(page.getByTestId("position-learning-count")).toContainText(/\d+\s+gap/);
  });
});
