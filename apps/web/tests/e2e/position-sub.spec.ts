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

  test("/positions/[id]/learning shows required paths + module coverage (#25, live data)", async ({
    page,
  }) => {
    // pick — LIVE, no hardcoded ids — a position that actually has learning
    // requirements, walking the real list through the real API.
    const list = await page.request.get("/api/v1/positions?limit=50");
    expect(list.ok()).toBeTruthy();
    const { items } = (await list.json()) as { items: Array<{ positionId: string }> };
    let positionId = "";
    for (const p of items) {
      const r = await page.request.get(`/api/v1/positions/${p.positionId}/learning-requirements`);
      if (r.ok() && ((await r.json()) as { items: unknown[] }).items.length > 0) {
        positionId = p.positionId;
        break;
      }
    }
    expect(positionId, "a position with learning requirements exists in the live dataset").not.toBe("");

    await page.goto(`/positions/${positionId}/learning`);
    await expect(page.getByTestId("position-learning-page")).toBeVisible();
    await expect(page.getByTestId("position-learning-count")).toContainText(/\d+\s+percorsi/);
    // real rows rendered from the live endpoint (not an empty proxy anymore)
    await expect(page.getByTestId("position-learning-req-row").first()).toBeVisible();
    // module coverage table renders (rows or real empty state)
    const moduleRows = page.getByTestId("position-learning-module-row");
    const moduleEmpty = page.getByTestId("position-learning-module-empty");
    await expect(moduleRows.first().or(moduleEmpty)).toBeVisible();
  });
});
