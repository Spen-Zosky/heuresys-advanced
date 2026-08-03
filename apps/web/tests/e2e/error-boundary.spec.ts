/**
 * apps/web/tests/e2e/error-boundary.spec.ts — D-04.
 *
 * Misurato prima di intervenire: 113 pagine, **un solo** confine d'errore (alla radice) e
 * **zero** stati di caricamento. Il confine radice cattura tutto e proprio per questo
 * sostituisce l'intera applicazione: un guasto su una pagina faceva sparire barra laterale
 * e intestazione, lasciando l'utente su una schermata da cui l'unica uscita è il tasto
 * «indietro».
 *
 * Questi test verificano la proprietà che conta per chi usa il prodotto: **quando qualcosa
 * si rompe, la navigazione sopravvive**. È il comportamento che il confine dentro la shell
 * autenticata garantisce, e vale qualunque sia il livello che intercetta il guasto.
 *
 * Limite dichiarato: il confine di React scatta su errori di RENDER, che non so forzare
 * dall'esterno in modo affidabile senza piazzare codice di prova nel prodotto. Qui il
 * guasto è iniettato dove è realistico — l'API che risponde 500 — e si verifica l'effetto
 * osservabile. La posizione del file (`(authenticated)/error.tsx`) è ciò che garantisce il
 * resto, ed è deterministica: Next usa sempre il confine più vicino.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 1 });

test.describe("D-04 — un guasto non porta via la navigazione", () => {
  test("con l'API in errore la pagina segnala il guasto e la barra laterale resta", async ({ page }) => {
    // Guasto realistico: l'endpoint della pagina risponde 500. Le altre chiamate passano,
    // così si misura l'effetto sulla SINGOLA sezione e non un blackout generale.
    await page.route("**/api/v1/positions**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"error":{"code":"BOOM"}}' }),
    );

    await page.goto("/positions", { waitUntil: "domcontentloaded", timeout: 60_000 });

    // La navigazione è ancora lì: l'utente può andare altrove senza ricaricare.
    await expect(page.getByTestId("nav-dashboard")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("nav-users")).toBeVisible();

    // E il guasto è dichiarato, non nascosto dietro una pagina vuota che si legge
    // come «non ci sono posizioni».
    const guasto = page.getByTestId("section-error-boundary").or(page.getByRole("alert"));
    await expect(guasto.first()).toBeVisible({ timeout: 20_000 });
  });

  test("dalla pagina in errore si naviga altrove e l'applicazione funziona", async ({ page }) => {
    await page.route("**/api/v1/positions**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"error":{"code":"BOOM"}}' }),
    );
    await page.goto("/positions", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("nav-dashboard")).toBeVisible({ timeout: 45_000 });

    // La prova che il guasto è CONFINATO: si va altrove e quella pagina funziona.
    await page.getByTestId("nav-dashboard").click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page.getByTestId("nav-users")).toBeVisible();
  });
});
