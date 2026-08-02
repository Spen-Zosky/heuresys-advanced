/**
 * apps/web/tests/e2e/visualizations.spec.ts
 *
 * Live-data E2E for /visualizations and /visualizations/[id]. Seed contains
 * zero visualization graphs by default — both pages exercise the empty-state
 * paths which are still live-API-backed.
 */

import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });

test.describe("MVP-2a visualizations — live data", () => {
  test("/visualizations browser renders (empty state OK)", async ({ page }) => {
    await page.goto("/visualizations");
    await expect(page.getByTestId("visualizations-page")).toBeVisible();
    await expect(page.getByTestId("visualizations-count")).toContainText(/\d+\s+grafici/);
    // F4.3: graph-type distribution chart panel (renders empty-state when no graphs)
    await expect(page.getByTestId("visualizations-type-chart")).toBeVisible();
  });

  test("/visualizations/[graphId] handles 404 for non-existent graph", async ({ page }) => {
    await page.goto("/visualizations/00000000-0000-0000-0000-000000000000");
    await expect(page.getByTestId("visualization-error")).toBeVisible({ timeout: 15_000 });
  });

  /**
   * #36 (B5) — versionamento ed export dall'interfaccia.
   *
   * Il grafo su cui si lavora è quello REALE del tenant (l'organigramma RTL):
   * si arriva cliccando la prima riga della lista, non con un id incollato.
   */
  test.describe("versioning and export (#36)", () => {
    test("the version selector lists the graph versions", async ({ page }) => {
      await page.goto("/visualizations");
      await expect(page.getByTestId("visualizations-page")).toBeVisible();
      await page.getByTestId("visualization-link").first().click();

      await expect(page.getByTestId("visualization-detail-page")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("visualization-version")).toContainText(/versione\s+\d+/);

      const select = page.getByTestId("visualization-version-select");
      await expect(select).toBeVisible();
      // Ogni opzione è una versione vera letta da /versions.
      const options = select.locator("option");
      expect(await options.count()).toBeGreaterThanOrEqual(1);
      await expect(options.first()).toContainText(/^v\d+ — /);
    });

    test("generating an export downloads a real document", async ({ page }) => {
      await page.goto("/visualizations");
      await page.getByTestId("visualization-link").first().click();
      await expect(page.getByTestId("visualization-export-card")).toBeVisible({ timeout: 15_000 });

      await page.getByTestId("visualization-export-format").selectOption("SVG");

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30_000 }),
        page.getByTestId("visualization-export-run").click(),
      ]);

      // Il file arriva davvero, col nome scelto dal server, e contiene il disegno.
      expect(download.suggestedFilename()).toMatch(/\.svg$/);
      const path = await download.path();
      const content = await readFile(path, "utf8");
      expect(content).toContain("<svg");
      expect(content).toContain("</svg>");
      expect(content.length).toBeGreaterThan(200);

      // L'export compare nell'elenco della pagina con un peso reale, non "senza contenuto".
      await expect(page.getByTestId("visualization-export-list")).toBeVisible();
      await expect(page.getByTestId("visualization-export-list")).toContainText(/\d+\s+byte/);
    });

    test("the generated exports are listed on /visualizations", async ({ page }) => {
      await page.goto("/visualizations");
      await expect(page.getByTestId("visualizations-exports-section")).toBeVisible();
      // Dopo il test precedente esiste almeno un export con contenuto.
      await expect(page.getByTestId("visualizations-exports-list")).toContainText(/\d+\s+byte/);
    });
  });
});
