/**
 * apps/web/tests/e2e/backstage.spec.ts — il Backstage, l'organizzazione ghost (ADR-0063 D2, G1).
 *
 * Dati vivi, login reale del TENANT_ADMIN di RTL: l'elenco ha lo stesso numero dell'API, l'albero
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
    const vertice = body.items.find((g) => g.level === 0)!;
    await page.locator(`[data-unita="${vertice.sourceUnitId}"]`).dblclick();
    await expect(page.getByTestId("scheda-ghost")).toBeVisible();
    await expect(page.getByTestId("scheda-ghost").getByRole("heading", { name: vertice.name })).toBeVisible();
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
    await expect(guida.locator("[data-testid=backstage-guida-diagramma] img").first()).toBeVisible({ timeout: 15_000 });
  });
});
