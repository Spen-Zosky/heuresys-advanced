/**
 * apps/web/tests/e2e/analytics-skills.spec.ts
 *
 * Live-data E2E for /analytics/skills (BI analytics P2, capability #1).
 *
 * Doctrine: LIVE DATA E2E ONLY — no mock, no fixture, no hardcoded number.
 * The headline evidence count + the scope badge are asserted against the SAME
 * live GET /v1/analytics/skills payload the page fetches at runtime. This is a
 * COVERAGE view (evidence distribution), not a held-vs-required gap.
 *
 * Persona: platformAdmin (admin@heuresys.com → PLATFORM scope). `analytics:view`
 * is granted to the admin roles by migration 000057.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { storageStateFor } from "./fixtures";

import type { SkillsCoverageAnalyticsResponse } from "@heuresys/shared";

test.use({ storageState: storageStateFor("platformAdmin") });

async function fetchSkills(request: APIRequestContext): Promise<SkillsCoverageAnalyticsResponse> {
  const res = await request.get("/api/v1/analytics/skills");
  expect(res.ok(), `GET /api/v1/analytics/skills → HTTP ${res.status()}`).toBeTruthy();
  return (await res.json()) as SkillsCoverageAnalyticsResponse;
}

test.describe("BI P2 /analytics/skills — live data (PLATFORM scope)", () => {
  test("renders coverage stats + heatmap/proficiency charts fed by the live API", async ({
    page,
    request,
  }) => {
    // 1. Learn the real numbers straight from the live API.
    const api = await fetchSkills(request);
    expect(api.totalEvidence).toBeGreaterThan(0);
    expect(api.cells.length).toBeGreaterThan(0);
    expect(api.proficiencyLevels.length).toBeGreaterThan(0);

    // 2. Navigate to the page under test.
    await page.goto("/analytics/skills");
    await expect(page.getByTestId("analytics-skills-page")).toBeVisible({ timeout: 30_000 });

    // 3. Scope badge reflects the scope the API returned.
    await expect(page.getByTestId("analytics-skills-scope")).toContainText(api.scope.kind);

    // 4. LIVE-DATA assertion: the total-evidence count the page renders MUST match
    //    the live API number (count-up animation + separators tolerated).
    const expectedEvidence = String(api.totalEvidence);
    await expect(async () => {
      const txt = (await page.getByTestId("skills-total-evidence").innerText()).replace(/\D/g, "");
      expect(txt).toContain(expectedEvidence);
    }).toPass({ timeout: 15_000 });

    // 5. Both EChartsCard canvases render (coverage heatmap + proficiency bar).
    const heatmap = page.getByTestId("analytics-skills-heatmap");
    await expect(heatmap).toBeVisible({ timeout: 15_000 });
    await expect(heatmap.locator("canvas").first()).toBeVisible({ timeout: 15_000 });

    const profChart = page.getByTestId("analytics-skills-proficiency-chart");
    await expect(profChart).toBeVisible({ timeout: 15_000 });
    await expect(profChart.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  });
});
