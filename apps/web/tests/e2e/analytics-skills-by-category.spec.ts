/**
 * apps/web/tests/e2e/analytics-skills-by-category.spec.ts
 *
 * Live-data E2E for /analytics/skills-by-category (BI ①·#8b).
 *
 * Doctrine: LIVE DATA E2E ONLY — no mock, no fixture, no hardcoded number.
 * The headline evidence count + the scope badge are asserted against the SAME
 * live GET /v1/analytics/skills-by-category payload the page fetches at runtime.
 * Same COVERAGE distribution as /analytics/skills, re-pivoted on skill_category.
 *
 * Persona: platformAdmin (enzo.spenuso@heuresys.com → PLATFORM scope). `analytics:view`
 * is granted to the admin roles by migration 000057.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { storageStateFor } from "./fixtures";

import type { SkillsByCategoryAnalyticsResponse } from "@heuresys/shared";

test.use({ storageState: storageStateFor("platformAdmin") });

async function fetchSkillsByCategory(
  request: APIRequestContext,
): Promise<SkillsByCategoryAnalyticsResponse> {
  const res = await request.get("/api/v1/analytics/skills-by-category");
  expect(res.ok(), `GET /api/v1/analytics/skills-by-category → HTTP ${res.status()}`).toBeTruthy();
  return (await res.json()) as SkillsByCategoryAnalyticsResponse;
}

test.describe("BI ①·#8b /analytics/skills-by-category — live data (PLATFORM scope)", () => {
  test("renders coverage stats + category heatmap/bar charts fed by the live API", async ({
    page,
    request,
  }) => {
    // 1. Learn the real numbers straight from the live API.
    const api = await fetchSkillsByCategory(request);
    expect(api.totalEvidence).toBeGreaterThan(0);
    expect(api.cells.length).toBeGreaterThan(0);
    expect(api.categories.length).toBeGreaterThan(0);
    expect(api.proficiencyLevels.length).toBeGreaterThan(0);

    // 2. Navigate to the page under test.
    await page.goto("/analytics/skills-by-category");
    await expect(page.getByTestId("analytics-skills-by-category-page")).toBeVisible({
      timeout: 30_000,
    });

    // 3. Scope badge reflects the scope the API returned.
    await expect(page.getByTestId("analytics-skills-by-category-scope")).toContainText(
      api.scope.kind,
    );

    // 4. LIVE-DATA assertion: the total-evidence count the page renders MUST match
    //    the live API number (count-up animation + separators tolerated).
    const expectedEvidence = String(api.totalEvidence);
    await expect(async () => {
      const txt = (
        await page.getByTestId("skills-by-category-total-evidence").innerText()
      ).replace(/\D/g, "");
      expect(txt).toContain(expectedEvidence);
    }).toPass({ timeout: 15_000 });

    // 5. Both EChartsCard canvases render (category heatmap + category bar).
    const heatmap = page.getByTestId("analytics-skills-by-category-heatmap");
    await expect(heatmap).toBeVisible({ timeout: 15_000 });
    await expect(heatmap.locator("canvas").first()).toBeVisible({ timeout: 15_000 });

    const catChart = page.getByTestId("analytics-skills-by-category-category-chart");
    await expect(catChart).toBeVisible({ timeout: 15_000 });
    await expect(catChart.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  });
});
