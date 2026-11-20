/**
 * apps/web/tests/e2e/faldone.spec.ts — la pagina individuale del Faldone dell'Utente, su dati vivi.
 *
 * La persona apre il proprio faldone dal Profilo; il mandato HR apre quello di un'altra persona dalla
 * sua scheda. In entrambi i casi la pagina mostra i totali della mega API, le schede per capitolo e,
 * aperta una sezione, le sue righe. Nessuna valutazione non comunicata e nessun autore di 360 sono
 * affari della pagina: li toglie l'API, e lo provano le prove di integrazione del modulo.
 */
import { test, expect, type Page } from "@playwright/test";
import { storageStateFor } from "./fixtures";

async function apriUnaSezione(page: Page): Promise<void> {
  await expect(page.getByTestId("faldone-pagina")).toBeVisible();
  await expect(page.getByTestId("faldone-totale-righe")).not.toHaveText("0");
  await expect(page.getByTestId("schede-pagina")).toBeVisible();
  // La sezione più piccola fra quelle in chiaro: si misura la pagina, non la velocità di una tabella enorme.
  const apribili = page.locator('[data-testid="faldone-sezione"][data-visibilita="piena"]').filter({ has: page.getByTestId("faldone-apri") });
  const n = await apribili.count();
  const scelta = n > 0 ? apribili.nth(n - 1) : page.getByTestId("faldone-sezione").filter({ has: page.getByTestId("faldone-apri") }).last();
  // Il pulsante sparisce dopo il clic: la sezione si ritrova per identificativo, non per il pulsante.
  const id = await scelta.getAttribute("data-sezione");
  expect(id).toBeTruthy();
  const sezione = page.locator(`[data-testid="faldone-sezione"][data-sezione="${id}"]`);
  await sezione.getByTestId("faldone-apri").click();
  const esito = sezione.getByTestId("faldone-riga").or(sezione.getByTestId("stato-errore")).first();
  await expect(esito).toBeVisible({ timeout: 30_000 });
  await expect(sezione.getByTestId("stato-errore"), await sezione.innerText()).toHaveCount(0);
}

test.describe("faldone — la propria pagina", () => {
  test.use({ storageState: storageStateFor("employee") });

  test("dal Profilo al proprio faldone, con righe vive", async ({ page }) => {
    await page.goto("/me/profile");
    await page.getByTestId("me-profile-faldone").click();
    await expect(page).toHaveURL(/\/me\/faldone$/);
    await apriUnaSezione(page);
  });
});

test.describe("faldone — un'altra persona, con il mandato HR", () => {
  test.use({ storageState: storageStateFor("hrManager") });

  test("dalla scheda della persona al suo faldone", async ({ page, browser, baseURL }) => {
    const altro = await browser.newContext({ ...(baseURL ? { baseURL } : {}), storageState: storageStateFor("employee") });
    const r = await altro.request.get("/api/v1/me/faldone");
    expect(r.status()).toBe(200);
    const { persona } = (await r.json()) as { persona: { userId: string } };
    await altro.close();

    await page.goto(`/users/${persona.userId}`);
    await page.getByTestId("user-faldone").click();
    await expect(page).toHaveURL(new RegExp(`/users/${persona.userId}/faldone$`));
    await apriUnaSezione(page);
  });
});
