/**
 * apps/web/tests/e2e/backstage.spec.ts — il Backstage, l'organizzazione ghost (ADR-0063 D2, G1).
 *
 * Dati vivi, login reale del Responsabile della direzione HR di RTL (HRMS_MANAGER): l'elenco ha lo stesso numero dell'API, l'albero
 * si apre adattato e il doppio clic su un riquadro apre la scheda a cascata, la deriva coincide con
 * l'API, e la guida (i) si apre con le sue infografiche disegnate.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("hrManager") });

interface G { ghostUnitId: string; sourceUnitId: string | null; name: string; level: number }

test.describe("Backstage — dati vivi", () => {
  test("elenco, albero con la scheda a cascata, deriva", async ({ page, request }) => {
    const api = await request.get("/api/v1/ghost-units");
    expect(api.ok()).toBeTruthy();
    const body = (await api.json()) as { items: G[]; total: number };
    const deriva = (await (await request.get("/api/v1/ghost-units/deriva")).json()) as { total: number };
    await page.goto("/organization/backstage");
    await expect(page.getByTestId("backstage-page")).toBeVisible();
    if (body.total === 0) {
      await expect(page.getByTestId("backstage-vuoto")).toBeVisible();
      return;
    }
    await expect(page.getByTestId("backstage")).toBeVisible();
    // La società è l'etichetta del disegno, non un riquadro (regola degli organigrammi): il primo
    // riquadro unisce il vertice e la Direzione Generale, e il doppio clic apre il vertice ghost.
    const riquadri = page.getByTestId("backstage-albero-area").locator("g[data-unita][role=button]");
    const vertice = body.items.find((g) => g.level === 0)!;
    await riquadri.first().dblclick();
    await expect(page.getByTestId("scheda-ghost").getByRole("heading", { name: vertice.name, exact: true })).toBeVisible();
    await page.getByTestId("scheda-ghost-chiudi").click();
    await expect(page.getByTestId("scheda-ghost")).toHaveCount(0);
    // Un riquadro sotto il vertice apre la sua unità del Backstage.
    const secondo = riquadri.nth(1);
    const id = await secondo.getAttribute("data-unita");
    const unita = body.items.find((g) => g.sourceUnitId === id);
    expect(unita, `il riquadro ${id} è un'unità del Backstage`).toBeTruthy();
    await secondo.dblclick();
    await expect(page.getByTestId("scheda-ghost").getByRole("heading", { name: unita!.name, exact: true })).toBeVisible();
    await page.getByTestId("scheda-ghost-chiudi").click();

    await page.getByTestId("scheda-elenco").click();
    await expect(page.getByTestId("backstage-riga")).toHaveCount(body.total);

    await page.getByTestId("scheda-deriva").click();
    if (deriva.total === 0) await expect(page.getByTestId("backstage-deriva-vuota")).toBeVisible();
    else await expect(page.getByTestId("backstage-deriva-riga")).toHaveCount(deriva.total);
  });

  test("la guida si apre dalla (i) con le infografiche", async ({ page }) => {
    await page.goto("/organization/backstage");
    await page.getByTestId("backstage-guida-apri").click();
    const guida = page.getByTestId("backstage-guida");
    await expect(guida).toBeVisible();
    await expect(guida.getByTestId("backstage-guida-diagramma")).toHaveCount(2);
    // Visibile non basta: un SVG non valido come XML resta un'icona rotta con il testo alternativo.
    // Ogni infografica deve essere davvero disegnata, cioè caricata con una larghezza propria.
    const immagini = guida.locator("[data-testid=backstage-guida-diagramma] img");
    await expect(immagini).toHaveCount(2, { timeout: 15_000 });
    for (let i = 0; i < 2; i++) {
      await expect
        .poll(() => immagini.nth(i).evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth), { timeout: 15_000 })
        .toBeGreaterThan(0);
      // Il disegno ha linee scure su fondo trasparente: il fondo dell'immagine stessa (non del
      // contenitore) deve essere bianco, altrimenti nel tema scuro le frecce spariscono.
      expect(await immagini.nth(i).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
    }
  });
});
