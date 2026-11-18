/**
 * apps/web/tests/e2e/tassonomie.spec.ts — il navigatore dei cataloghi (settori, professioni, competenze).
 *
 * Pagina additiva: legge endpoint già esistenti. La prova apre la pagina con una persona vera,
 * verifica le quattro schede e che la scheda dei settori mostri voci del catalogo (o dica
 * esplicitamente che il catalogo è vuoto), e che aprire una voce mostri la finestra a cascata.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor, gotoAuthenticated } from "./fixtures";

test.describe("navigatore dei cataloghi", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("la pagina mostra le schede e apre la scheda di una voce", async ({ page }) => {
    await gotoAuthenticated(page, "/tassonomie");
    await expect(page.getByTestId("tassonomie-page")).toBeVisible();
    for (const id of ["settori", "professioni", "competenze", "significato"]) {
      await expect(page.getByTestId(`scheda-${id}`)).toBeVisible();
    }
    const elenco = page.getByTestId("tassonomie-attivita").locator("li button").first();
    await expect(elenco.or(page.getByText("Questo catalogo non contiene voci."))).toBeVisible({ timeout: 30_000 });
    if (await elenco.isVisible()) {
      await elenco.click();
      await expect(page.getByTestId("tassonomie-finestra")).toBeVisible();
    }
  });
});
