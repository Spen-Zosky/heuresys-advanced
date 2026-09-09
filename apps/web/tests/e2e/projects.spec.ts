/**
 * apps/web/tests/e2e/projects.spec.ts
 *
 * `#143` F5 — la dimostrazione live di «una squadra e' un progetto», su dati reali del
 * tenant RTL_BANK e con login veri (storageState da auth.setup.ts).
 *
 * ⭐ IL CASO CHE IL MODELLO DOVEVA RENDERE POSSIBILE. `paolo.caputo` guida il progetto
 * `TM-COMM` senza avere un mandato HR: vede i propri progetti e li governa, e la sua
 * autorita' si ferma al LAVORO. Non vede i dati sensibili di chi ci lavora — nemmeno di
 * un membro che nell'organigramma gli sta SOPRA. E' il confine I18, e qui si guarda.
 *
 * ⚠ Niente e' cablato: i codici e i conteggi si leggono dalla pagina, che li prende
 * dall'API, che li prende dal database. Se il dataset cambia, il test misura il dataset
 * nuovo invece di cadere su un nome.
 */
import { test, expect } from "@playwright/test";

import { storageStateFor } from "./fixtures";

test.describe("#143 F5 — progetti, dati live", () => {
  test.describe("con un mandato HR", () => {
    test.use({ storageState: storageStateFor("tenantAdmin") });

    test("/projects elenca i progetti del tenant e apre il dettaglio", async ({ page }) => {
      await page.goto("/projects");

      await expect(page.getByTestId("projects-page")).toBeVisible();
      await expect(page.getByTestId("projects-count")).toContainText(/\d+/);

      const righe = page.getByTestId("projects-row");
      await expect(righe.first()).toBeVisible();
      expect(await righe.count()).toBeGreaterThanOrEqual(5);

      await page.getByTestId("project-link").first().click();
      await page.waitForURL(/\/projects\/[0-9a-f-]+$/);
      await expect(page.getByTestId("project-detail-page")).toBeVisible();
      await expect(page.getByTestId("field-status")).toBeVisible();

      // chi ci lavora, con il ruolo: e' cio' che l'asse funzionale concede
      const membri = page.getByTestId("project-member-row");
      await expect(membri.first()).toBeVisible();
      await expect(page.getByTestId("member-role").first()).toBeVisible();
    });
  });

  test.describe("come capo progetto senza mandato", () => {
    test.use({ storageState: storageStateFor("manager") });

    test("vede i propri progetti, e sono meno di tutti quelli del tenant", async ({ page }) => {
      await page.goto("/projects");
      await expect(page.getByTestId("projects-page")).toBeVisible();

      const righe = page.getByTestId("projects-row");
      await expect(righe.first()).toBeVisible();
      const suoi = await righe.count();
      expect(suoi).toBeGreaterThan(0);

      // Il confronto col totale del tenant sta nel test di integrazione, dove si possono
      // interrogare due attori nella stessa corsa. Qui si verifica cio' che solo il
      // browser puo' dire: che la pagina mostri qualcosa di suo e sia navigabile.
      await page.getByTestId("project-link").first().click();
      await page.waitForURL(/\/projects\/[0-9a-f-]+$/);
      await expect(page.getByTestId("project-detail-page")).toBeVisible();
    });

    test("⭐ I18 — nel dettaglio non compare NULLA di sensibile sui membri", async ({ page }) => {
      await page.goto("/projects");
      await page.getByTestId("project-link").first().click();
      await page.waitForURL(/\/projects\/[0-9a-f-]+$/);
      await expect(page.getByTestId("project-detail-page")).toBeVisible();

      const membri = page.getByTestId("project-member-row");
      await expect(membri.first()).toBeVisible();

      // Il testo della pagina non deve contenere le parole delle quattro classi
      // sensibili. E' una rete grossolana di proposito: se un giorno qualcuno
      // aggiungesse la retribuzione a questa pagina, questo test lo direbbe.
      const testo = (await page.getByTestId("project-detail-page").innerText()).toLowerCase();
      for (const vietata of ["retribuzione", "stipendio", "ral", "iban", "valutazione",
                             "salary", "compensation", "evaluation"]) {
        expect(testo).not.toContain(vietata);
      }

      // e nessun collegamento che porti al dossier di una persona
      const linkDossier = page.locator('a[href*="/users/"]');
      expect(await linkDossier.count()).toBe(0);
    });
  });
});
