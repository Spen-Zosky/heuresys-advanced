/**
 * apps/web/tests/e2e/analytics-compensation.spec.ts
 *
 * Live-data E2E for /analytics/compensation (BI analytics P2, capability #1).
 *
 * Doctrine: LIVE DATA E2E ONLY — no mock, no fixture, no hardcoded number.
 * The headline profile count + the scope badge are asserted against the SAME
 * live GET /v1/analytics/compensation payload the page fetches at runtime.
 *
 * Persona: **tenantAdmin**, non platformAdmin. Da #124 (S1055) il mandato di
 * piattaforma e' TECNICO e non apre COMPENSATION (ADR-0032): su questa pagina
 * l'API non serve piu' scatter, boxplot e mediane, perche' 280 posizioni su 299
 * hanno un solo titolare e ogni punto sarebbe la retribuzione di una persona.
 * Con quel profilo i due grafici non esistono, ed e' l'esito CORRETTO — il caso
 * mascherato ha la sua prova in `apps/api/test/analytics-aggregate-mask.integration.test.ts`.
 * `analytics:view` e' concesso a entrambi i ruoli dalla migrazione 000057.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { storageStateFor } from "./fixtures";

import type { CompensationAnalyticsResponse } from "@heuresys/shared";

test.use({ storageState: storageStateFor("tenantAdmin") });

async function fetchCompensation(request: APIRequestContext): Promise<CompensationAnalyticsResponse> {
  const res = await request.get("/api/v1/analytics/compensation");
  expect(res.ok(), `GET /api/v1/analytics/compensation → HTTP ${res.status()}`).toBeTruthy();
  return (await res.json()) as CompensationAnalyticsResponse;
}

test.describe("BI P2 /analytics/compensation — live data (PLATFORM scope)", () => {
  test("renders banding stats + boxplot/scatter charts fed by the live API", async ({
    page,
    request,
  }) => {
    // 1. Learn the real numbers straight from the live API.
    const api = await fetchCompensation(request);
    expect(api.totalProfiles).toBeGreaterThan(0);
    expect(api.bandingByOu.length).toBeGreaterThan(0);
    expect(api.scatter.length).toBeGreaterThan(0);

    // 2. Navigate to the page under test.
    await page.goto("/analytics/compensation");
    await expect(page.getByTestId("analytics-compensation-page")).toBeVisible({ timeout: 30_000 });

    // 3. Scope badge reflects the scope the API returned.
    await expect(page.getByTestId("analytics-compensation-scope")).toContainText(api.scope.kind);

    // 4. LIVE-DATA assertion: the banded-profile count the page renders MUST match
    //    the live API number (count-up animation + separators tolerated).
    const expectedProfiles = String(api.totalProfiles);
    await expect(async () => {
      const txt = (await page.getByTestId("compensation-total-profiles").innerText()).replace(/\D/g, "");
      expect(txt).toContain(expectedProfiles);
    }).toPass({ timeout: 15_000 });

    // 5. Both EChartsCard canvases render (boxplot + scatter).
    const boxplot = page.getByTestId("analytics-banding-boxplot");
    await expect(boxplot).toBeVisible({ timeout: 15_000 });
    await expect(boxplot.locator("canvas").first()).toBeVisible({ timeout: 15_000 });

    const scatter = page.getByTestId("analytics-equity-scatter");
    await expect(scatter).toBeVisible({ timeout: 15_000 });
    await expect(scatter.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  });
});
