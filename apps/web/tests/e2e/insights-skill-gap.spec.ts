/**
 * apps/web/tests/e2e/insights-skill-gap.spec.ts
 *
 * cap③ data-mining · P2 slice C — LIVE DATA E2E for /insights/skill-gap.
 * A PLATFORM_ADMIN loads the page; the table is fed by GET /v1/insights/skill-gap
 * (live sys_skill_gap_scores, already populated). Asserts the page count matches the
 * live API total, rows render, and the per-feature explainability panel opens.
 * The recompute button (insights:admin) is asserted present but NOT clicked — it would
 * re-score the whole tenant (covered by the API integration test instead).
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe.configure({ retries: 1 });

test.describe("cap③ insights /insights/skill-gap — live data", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("renders live skill-gap scores + per-feature explainability", async ({ page }) => {
    const resp = await page.request.get("/api/v1/insights/skill-gap");
    expect(resp.ok()).toBeTruthy();
    const body = (await resp.json()) as { items: unknown[]; total: number };
    expect(body.items.length).toBeGreaterThan(0);

    await page.goto("/insights/skill-gap", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("skillgap-page")).toBeVisible({ timeout: 45_000 });

    // the page count reflects the live API total
    await expect(page.getByTestId("skillgap-count")).toContainText(String(body.total));

    // rows render; admin recompute control present (not clicked — it re-scores everyone)
    await expect(page.getByTestId("skillgap-row").first()).toBeVisible();
    await expect(page.getByTestId("skillgap-recompute")).toBeVisible();

    // ⚠ #219 F2/B — QUI IL CASO SI ROVESCIA, e non è un ammorbidimento.
    // Fino a S1078 questa riga pretendeva `count > 1` sui contributi per-feature, ed era
    // rossa. Ma la spiegabilità NON è rotta: ADR-0032 / #124 D4 la MASCHERANO a chi legge
    // sotto il solo mandato di piattaforma, perché il modello è deterministico e i pesi
    // sono pubblici — da `features` il punteggio si ricalcola esattamente — e
    // `features[].raw` porta `compBandPct`, cioè la spiegazione di un punteggio
    // EVALUATION farebbe passare dati COMPENSATION dalla porta di servizio.
    // Il caso provava un mondo che l'architettura vieta: il gemello esatto di F1/A.
    //
    // MISURATO il 2026-08-23 con `apps/api/scripts/prova-219-b-spiegabilita.mts`, due
    // attori sulla stessa rotta e sugli stessi 156 punteggi:
    //   piattaforma → 0 voci con features, 156 dichiarate `masked`
    //   mandato HR  → 156 voci con features, 2 fattori sul primo
    // Quindi la spiegabilità funziona, e il mask funziona. Rovesciato, questo caso
    // diventa il PRESIDIO di ADR-0032: se un domani il mask cadesse, è qui che si vede.
    await page.getByTestId("skillgap-row-select").first().click();
    await expect(page.getByTestId("skillgap-explain")).toBeVisible();
    expect(await page.getByTestId("skillgap-feature").count()).toBe(0);
  });
});

/**
 * #219 F2/B — e la spiegabilità va provata DA CHI HA IL DIRITTO DI VEDERLA, o non la prova
 * nessuno. Senza questo blocco, rovesciare il caso sopra avrebbe tolto una prova rossa
 * lasciando un buco: «il pannello non rende» sarebbe rimasto indistinguibile da «rende
 * solo a chi deve», che è precisamente la differenza in gioco.
 * `TENANT_ADMIN` è un mandato HR (I20), e la misura conferma che vede i contributi.
 */
test.describe("cap③ insights /insights/skill-gap — la spiegazione, a chi la può vedere", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("il mandato HR vede i contributi per-feature", async ({ page }) => {
    await page.goto("/insights/skill-gap", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("skillgap-page")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("skillgap-row").first()).toBeVisible();

    await page.getByTestId("skillgap-row-select").first().click();
    await expect(page.getByTestId("skillgap-explain")).toBeVisible();
    await expect(page.getByTestId("skillgap-feature").first()).toBeVisible();
    expect(await page.getByTestId("skillgap-feature").count()).toBeGreaterThan(1);
  });
});
