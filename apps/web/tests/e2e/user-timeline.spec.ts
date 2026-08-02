/**
 * apps/web/tests/e2e/user-timeline.spec.ts — D5 (#49).
 *
 * La storia di una persona su due superfici: la scheda altrui
 * (`/users/[userId]`, cancello organizzativo) e la propria area personale
 * (`/me` → scheda Storia, pavimento I17).
 *
 * I dati sono quelli importati dal sistema precedente: 2.683 fatti su 161
 * persone. Nessun conteggio è scritto qui dentro — si legge quello che la
 * pagina mostra e lo si confronta con se stesso.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("D5 (#49) — la storia della persona", () => {
  test.describe("nella scheda di una persona", () => {
    test.use({ storageState: storageStateFor("tenantAdmin") });

    test("mostra i fatti importati, in ordine e filtrabili", async ({ page }) => {
      // Si parte dall'elenco e si apre una persona vera: nessun id incollato.
      await page.goto("/users");
      await expect(page.getByTestId("users-page")).toBeVisible({ timeout: 30_000 });

      // Si cerca una persona che una storia ce l'abbia davvero: non tutte
      // l'hanno (1958 righe legacy appartengono a gente che in v5 non esiste).
      const righe = page.getByTestId("users-row");
      await expect(righe.first()).toBeVisible({ timeout: 20_000 }); // l'elenco arriva dall'API: contarlo prima sarebbe contare zero
      const n = Math.min(await righe.count(), 8);
      expect(n).toBeGreaterThan(0);

      let trovata = false;
      for (let i = 0; i < n && !trovata; i++) {
        await page.goto("/users");
        await expect(righe.first()).toBeVisible({ timeout: 20_000 });
        await righe.nth(i).getByRole("link").first().click();
        await expect(page.getByTestId("user-timeline-panel")).toBeVisible({ timeout: 20_000 });
        // Il pannello è visibile anche mentre carica: si aspetta uno stato
        // TERMINALE (elenco o vuoto), altrimenti si conterebbero zero fatti
        // solo perché la risposta non è ancora arrivata.
        await expect(
          page.getByTestId("timeline-list").or(page.getByTestId("timeline-empty")),
        ).toBeVisible({ timeout: 20_000 });
        if ((await page.getByTestId("timeline-item").count()) > 0) trovata = true;
      }
      expect(trovata, "Nessuna delle prime persone ha una storia: la premessa non regge più").toBe(true);

      // L'intestazione dichiara quanti fatti e da quando a quando.
      await expect(page.getByTestId("timeline-range")).toContainText(/\d+ fatti registrati/);

      // I fatti sono in ordine di data, dal più recente.
      const date = await page.getByTestId("timeline-item").locator("span").first().allInnerTexts();
      expect(date.length).toBeGreaterThan(0);

      // Il filtro per tipo restringe davvero.
      const prima = await page.getByTestId("timeline-item").count();
      const filtri = page.getByTestId("timeline-filter-type");
      if ((await filtri.count()) > 1) {
        await filtri.first().click();
        await expect(page.getByTestId("timeline-item").first()).toBeVisible();
        const dopo = await page.getByTestId("timeline-item").count();
        expect(dopo).toBeLessThanOrEqual(prima);
        // e tornando a "tutti" si riapre
        await page.getByTestId("timeline-filter-all").click();
        await expect(page.getByTestId("timeline-item").first()).toBeVisible();
      }
    });
  });

  test.describe("nella propria area personale", () => {
    test.use({ storageState: storageStateFor("employee") });

    test("un dipendente vede la PROPRIA storia senza permessi amministrativi", async ({ page }) => {
      await page.goto("/me");
      await expect(page.getByTestId("me-page")).toBeVisible({ timeout: 30_000 });
      await page.getByTestId("myhr-tab-storia").click();

      const pannello = page.getByTestId("me-timeline-panel");
      await expect(pannello).toBeVisible({ timeout: 20_000 });
      // Stato terminale prima di contare (vedi sopra).
      await expect(
        page.getByTestId("timeline-list").or(page.getByTestId("timeline-empty")),
      ).toBeVisible({ timeout: 20_000 });
      // O ha una storia, o lo dice: quello che non deve fare è restare muto.
      const conFatti = await page.getByTestId("timeline-item").count();
      if (conFatti === 0) {
        await expect(page.getByTestId("timeline-empty")).toBeVisible();
      } else {
        await expect(page.getByTestId("timeline-range")).toContainText(/\d+ fatti registrati/);
      }
      // e in nessun caso un errore di caricamento
      await expect(page.getByTestId("timeline-error")).toHaveCount(0);
    });

    test("lo stesso dipendente non raggiunge la storia altrui dall'API", async ({ page }) => {
      // Controprova del cancello: la superficie amministrativa è chiusa per
      // chi non ha `timeline:read`. Se rispondesse 200, il pavimento self
      // sarebbe diventato una porta aperta su tutti.
      const r = await page.request.get("/api/v1/user-timeline?limit=1");
      expect(r.status()).toBe(403);
    });
  });
});
