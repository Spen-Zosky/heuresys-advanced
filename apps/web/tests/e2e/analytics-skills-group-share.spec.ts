/**
 * apps/web/tests/e2e/analytics-skills-group-share.spec.ts
 *
 * Live-data E2E for /analytics/skills-group-share (BI T3.8 chart + T2.6 clustering).
 *
 * Doctrine: LIVE DATA E2E ONLY — no mock, no fixture, no hardcoded number.
 * The grouped-skills count + the distinct-groups count + the scope badge are
 * asserted against the SAME live GET /v1/analytics/skills-group-share payload the
 * page fetches at runtime (the ESCO group distribution, backfilled live S990).
 *
 * Persona: platformAdmin (enzo.spenuso@heuresys.com → PLATFORM scope). `analytics:view`
 * is granted to the admin roles by migration 000057; the catalogue is global.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { storageStateFor } from "./fixtures";

import type { SkillsGroupShareAnalyticsResponse } from "@heuresys/shared";

test.use({ storageState: storageStateFor("platformAdmin") });

async function fetchGroupShare(
  request: APIRequestContext,
): Promise<SkillsGroupShareAnalyticsResponse> {
  const res = await request.get("/api/v1/analytics/skills-group-share");
  expect(res.ok(), `GET /api/v1/analytics/skills-group-share → HTTP ${res.status()}`).toBeTruthy();
  return (await res.json()) as SkillsGroupShareAnalyticsResponse;
}

test.describe("BI T3.8 /analytics/skills-group-share — live data (ESCO group share)", () => {
  test("renders catalogue stats + group bar chart + share table fed by the live API", async ({
    page,
    request,
  }) => {
    // 1. Learn the real numbers straight from the live API.
    const api = await fetchGroupShare(request);
    expect(api.totalGrouped).toBeGreaterThan(0);
    expect(api.distinctGroups).toBeGreaterThan(0);
    expect(api.groups.length).toBeGreaterThan(0);
    // The top-N groups + the "other" bucket reconcile to the grouped total.
    const topSum = api.groups.reduce((acc, g) => acc + g.skillCount, 0);
    expect(topSum + api.otherSkillCount).toBe(api.totalGrouped);

    // 2. Navigate to the page under test.
    await page.goto("/analytics/skills-group-share");
    await expect(page.getByTestId("analytics-skills-group-share-page")).toBeVisible({
      timeout: 30_000,
    });

    // 3. Scope badge reflects the scope the API returned.
    await expect(page.getByTestId("analytics-skills-group-share-scope")).toContainText(
      api.scope.kind,
    );

    // 4. LIVE-DATA assertions: the grouped-skills + distinct-groups counts the page
    //    renders MUST match the live API numbers (count-up + separators tolerated).
    const expectGrouped = String(api.totalGrouped);
    await expect(async () => {
      const txt = (await page.getByTestId("skills-group-share-total-grouped").innerText()).replace(/\D/g, "");
      expect(txt).toContain(expectGrouped);
    }).toPass({ timeout: 15_000 });

    const expectGroups = String(api.distinctGroups);
    await expect(async () => {
      const txt = (await page.getByTestId("skills-group-share-distinct-groups").innerText()).replace(/\D/g, "");
      expect(txt).toContain(expectGroups);
    }).toPass({ timeout: 15_000 });

    // 5. Group bar chart canvas renders.
    const chart = page.getByTestId("analytics-skills-group-share-chart");
    await expect(chart).toBeVisible({ timeout: 15_000 });
    await expect(chart.locator("canvas").first()).toBeVisible({ timeout: 15_000 });

    // 6. Share table renders the top group's real code + skill count (the largest group).
    const table = page.getByTestId("analytics-skills-group-share-table");
    await expect(table).toBeVisible({ timeout: 15_000 });
    const top = api.groups[0]!;
    await expect(table).toContainText(top.groupCode);
    await expect(table).toContainText(String(top.skillCount));
  });
});
