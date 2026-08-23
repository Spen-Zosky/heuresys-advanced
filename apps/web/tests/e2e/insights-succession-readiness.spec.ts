/**
 * apps/web/tests/e2e/insights-succession-readiness.spec.ts
 *
 * cap③ data-mining · P2 slice B — LIVE DATA E2E for /insights/succession-readiness.
 * A PLATFORM_ADMIN loads the page; the table is fed by GET /v1/insights/succession-readiness
 * (live sys_succession_readiness_scores, already populated). Asserts the page count matches
 * the live API total, rows render, and the per-feature explainability panel opens.
 * The recompute button (insights:admin) is asserted present but NOT clicked — it would
 * re-score the whole tenant (covered by the API integration test instead).
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe.configure({ retries: 1 });

test.describe("cap③ insights /insights/succession-readiness — live data", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("renders live succession-readiness scores + per-feature explainability", async ({ page }) => {
    const resp = await page.request.get("/api/v1/insights/succession-readiness");
    expect(resp.ok()).toBeTruthy();
    const body = (await resp.json()) as { items: unknown[]; total: number };
    expect(body.items.length).toBeGreaterThan(0);

    await page.goto("/insights/succession-readiness", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("readiness-page")).toBeVisible({ timeout: 45_000 });

    // the page count reflects the live API total
    await expect(page.getByTestId("readiness-count")).toContainText(String(body.total));

    // rows render; admin recompute control present (not clicked — it re-scores everyone)
    await expect(page.getByTestId("readiness-row").first()).toBeVisible();
    await expect(page.getByTestId("readiness-recompute")).toBeVisible();

    // ⚠ #219 F2/B — il caso si rovescia, ed è il gemello di quello su `/insights/skill-gap`:
    // una firma sola, due sintomi. ADR-0032 / #124 D4 mascherano `features` sotto il solo
    // mandato di piattaforma (il modello è deterministico, e `features[].raw` porta
    // `compBandPct`: la spiegazione di un punteggio EVALUATION farebbe passare dati
    // COMPENSATION dalla porta di servizio). Misurato il 2026-08-23 sugli stessi 468
    // punteggi: piattaforma → 0 con features, 468 dichiarate `masked`; mandato HR → 468
    // con features, 3 fattori sul primo. Rovesciato, è il PRESIDIO del mask.
    await page.getByTestId("readiness-row-select").first().click();
    await expect(page.getByTestId("readiness-explain")).toBeVisible();
    expect(await page.getByTestId("readiness-feature").count()).toBe(0);
  });
});

/** #219 F2/B — la spiegazione provata da chi ha il diritto di vederla (I20: TENANT_ADMIN
 *  è un mandato HR). Senza, rovesciare il caso sopra lascerebbe un buco: «non rende» e
 *  «rende solo a chi deve» resterebbero indistinguibili. */
test.describe("cap③ insights /insights/succession-readiness — la spiegazione, a chi la può vedere", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("il mandato HR vede i contributi per-feature", async ({ page }) => {
    await page.goto("/insights/succession-readiness", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("readiness-page")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("readiness-row").first()).toBeVisible();

    await page.getByTestId("readiness-row-select").first().click();
    await expect(page.getByTestId("readiness-explain")).toBeVisible();
    await expect(page.getByTestId("readiness-feature").first()).toBeVisible();
    expect(await page.getByTestId("readiness-feature").count()).toBeGreaterThan(1);
  });
});
