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
    const dati = (await org.json()) as {
      unita: Array<{ id: string; nome: string; padreId: string | null; tipo: string | null; persone: Array<{ id: string; etichetta: string }> }>;
    };
    const io = ((await profilo.json()) as { userId: string }).userId;
    const mia = dati.unita.find((u) => u.persone.some((p) => p.id === io));
    expect(mia, "la persona lavora in un'unità attiva").toBeTruthy();
    const etichetta = mia!.persone.find((p) => p.id === io)!.etichetta;
    await expect(vista.locator("svg text", { hasText: etichetta }).first()).toBeAttached();

    // Piano PIANO_organigrammi-navigazione_20261115.md: la società è un'etichetta, non un riquadro;
    // ogni organigramma sta in un'area navigabile; la rotella ingrandisce e il doppio clic sul
    // vuoto torna alla vista adattata.
    const area = vista.locator("[data-area-navigabile]").first();
    const scala = vista.locator("span.tabular-nums").first();
    const prima = await scala.innerText();
    const b = (await area.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, -300);
    await expect(scala).not.toHaveText(prima);
    await page.mouse.dblclick(b.x + b.width - 4, b.y + b.height - 4);
    await expect(scala).toHaveText(prima);

    // Doppio clic sul riquadro della propria unità → scheda; un'unità della catena → secondo livello.
    await vista.locator(`g[data-unita="${mia!.id}"][role=button]`).last().dblclick();
    const scheda = page.getByTestId("scheda-rapida");
    await expect(scheda).toBeVisible();
    // La scheda scorre e si ridimensiona.
    expect(await scheda.evaluate((e) => getComputedStyle(e).resize)).toBe("both");
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
    const nodi = page.getByTestId("me-org-chart-vista-nodi");
    await expect(nodi).toBeVisible();
    // Stessa struttura dei blocchi: un solo nodo al vertice, la società non è un nodo, tutti i rami
    // aperti (un nodo per ogni unità tranne la società).
    const radici = dati.unita.filter((u) => !u.padreId);
    const societaEtichetta = radici.length === 1 && dati.unita.filter((u) => u.padreId === radici[0]!.id && u.tipo === "GENERAL_MANAGEMENT").length === 1;
    await expect(nodi.locator("g[data-livello='0']")).toHaveCount(radici.length);
    expect(Number(await nodi.getAttribute("data-nodi"))).toBe(dati.unita.length - (societaEtichetta ? 1 : 0));
    if (societaEtichetta) await expect(nodi.locator(`g[data-nodo="${radici[0]!.id}"]`)).toHaveCount(0);

    // Aggiorna: la richiesta parte di nuovo e la pagina resta coerente.
    const ricalcolo = page.waitForResponse((r) => r.url().includes("/v1/me/organigramma") && r.ok());
    await page.getByTestId("me-org-chart-vista-aggiorna").click();
    await ricalcolo;
    await expect(page.getByTestId("me-org-chart-vista-calcolato")).toBeVisible();
  });
});
