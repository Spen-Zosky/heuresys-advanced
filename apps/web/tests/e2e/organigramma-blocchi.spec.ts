/**
 * apps/web/tests/e2e/organigramma-blocchi.spec.ts — piano
 * docs/piani/PIANO_organigrammi-a-blocchi_20261114.md (V3-V6).
 *
 * Con una persona vera del cliente (il capo filiale della persona `employee`):
 *  - /me/org-chart mostra l'organigramma a blocchi calcolato dai dati vivi, con il suo nome
 *    «Cognome, Nome» dentro un riquadro e la sua unità in risalto;
 *  - un clic su un riquadro apre la scheda dell'unità; un secondo livello aggiunge «Indietro» e
 *    «Chiudi cascata», come nel banco del datastore;
 *  - la scheda «Nodi» disegna l'albero delle unità;
 *  - «Aggiorna» ricalcola e rinnova l'ora del calcolo.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("employee") });

test.describe("organigramma a blocchi — dati vivi", () => {
  test("blocchi con i nomi, scheda a cascata, nodi e Aggiorna", async ({ page }) => {
    await page.goto("/me/org-chart");
    const vista = page.getByTestId("me-org-chart-vista");
    await expect(vista.getByTestId("me-org-chart-vista-blocchi")).toBeVisible({ timeout: 20_000 });

    // Il proprio nome compare in un riquadro, scritto «Cognome, Nome».
    const profilo = await page.request.get("/api/v1/me/profile");
    expect(profilo.ok()).toBeTruthy();
    const org = await page.request.get("/api/v1/me/organigramma");
    expect(org.ok()).toBeTruthy();
    const dati = (await org.json()) as { unita: Array<{ id: string; nome: string; persone: Array<{ id: string; etichetta: string }> }> };
    const io = ((await profilo.json()) as { userId: string }).userId;
    const mia = dati.unita.find((u) => u.persone.some((p) => p.id === io));
    expect(mia, "la persona lavora in un'unità attiva").toBeTruthy();
    const etichetta = mia!.persone.find((p) => p.id === io)!.etichetta;
    await expect(vista.locator("svg text", { hasText: etichetta }).first()).toBeAttached();

    // Clic sul riquadro della propria unità → scheda; un'unità della catena → secondo livello.
    await vista.locator(`g[data-unita="${mia!.id}"][role=button]`).last().click();
    const scheda = page.getByTestId("scheda-rapida");
    await expect(scheda).toBeVisible();
    await expect(scheda.getByText(mia!.nome).first()).toBeVisible();
    const sopra = scheda.locator("[data-riferimento=unita]").first();
    if (await sopra.count()) {
      await sopra.click();
      await expect(page.getByTestId("scheda-indietro")).toBeVisible();
      await expect(page.getByTestId("scheda-chiudi")).toHaveText(/Chiudi cascata|Close all/);
      await page.getByTestId("scheda-indietro").click();
      await expect(page.getByTestId("scheda-indietro")).toHaveCount(0);
    }
    await page.getByTestId("scheda-chiudi").click();
    await expect(scheda).toHaveCount(0);

    // Vista a nodi.
    await page.getByRole("tab", { name: /Nodi|Nodes/ }).click();
    await expect(page.getByTestId("me-org-chart-vista-nodi")).toBeVisible();

    // Aggiorna: la richiesta parte di nuovo e la pagina resta coerente.
    const ricalcolo = page.waitForResponse((r) => r.url().includes("/v1/me/organigramma") && r.ok());
    await page.getByTestId("me-org-chart-vista-aggiorna").click();
    await ricalcolo;
    await expect(page.getByTestId("me-org-chart-vista-calcolato")).toBeVisible();
  });
});
