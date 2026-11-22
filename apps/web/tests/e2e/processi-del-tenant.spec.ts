/**
 * apps/web/tests/e2e/processi-del-tenant.spec.ts — V5 del piano processi e progetti
 * (docs/piani/PIANO_processi-e-progetti-sistematici_20261118.md).
 *
 * Dati vivi, login reale del TENANT_ADMIN di RTL: l'elenco dei processi del tenant mostra lo stesso
 * numero dell'API (R5), la scheda di un processo apre le sue schede, il flusso a corsie e il grafo
 * si disegnano con un riquadro per attività, e il doppio clic su un'attività apre la sua finestra.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });

interface Sintesi { processId: string; name: string; subprocessCount: number; activityCount: number }

test.describe("Processi del tenant — dati vivi", () => {
  test("l'elenco ha un solo numero, uguale a quello dell'API", async ({ page, request }) => {
    const api = await request.get("/api/v1/processes?level=1");
    expect(api.ok()).toBeTruthy();
    const body = (await api.json()) as { items: Sintesi[]; total: number };
    await page.goto("/tenant-processes");
    await expect(page.getByTestId("tenant-processes-page")).toBeVisible();
    await expect(page.getByTestId("tenant-processes-count")).toContainText(new RegExp(`\\b${body.total}\\s+process`));
    // Il database della CI può non avere processi del tenant: allora la pagina dice che non ce ne
    // sono, e la tabella non c'è.
    if (body.total === 0) {
      await expect(page.getByTestId("tenant-processes-empty")).toBeVisible();
      return;
    }
    const heads = (await page.locator("main table thead th").allTextContents()).map((h) => h.trim().toLowerCase());
    expect(heads.slice(0, 5)).toEqual(["processo", "responsabile", "sottoprocessi", "attività", "unità"]);
    await expect(page.getByTestId("tenant-process-link").first()).toHaveText(body.items[0]!.name);
  });

  test("la scheda del processo: attività, flusso a corsie, grafo e finestra dell'attività", async ({ page, request }) => {
    const body = (await (await request.get("/api/v1/processes?level=1")).json()) as { items: Sintesi[] };
    const p = body.items.find((x) => x.subprocessCount > 0 && x.activityCount + x.subprocessCount > 0) ?? body.items[0];
    test.skip(!p, "RTL non ha processi attivi");
    const scheda = (await (await request.get(`/api/v1/processes/${p!.processId}/scheda`)).json()) as { activities: unknown[] };
    await page.goto(`/tenant-processes/${p!.processId}`);
    await expect(page.getByTestId("tenant-process-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: p!.name })).toBeVisible();

    await page.getByRole("tab", { name: /Attività/ }).click();
    if (scheda.activities.length === 0) {
      await expect(page.getByTestId("tenant-process-attivita-vuoto")).toBeVisible();
      return;
    }
    await expect(page.getByTestId("tenant-process-attivita-riga")).toHaveCount(scheda.activities.length);

    await page.getByRole("tab", { name: /Flusso a corsie/ }).click();
    await expect(page.getByTestId("flusso-attivita")).toHaveCount(scheda.activities.length);
    await page.getByTestId("flusso-attivita").first().dblclick();
    await expect(page.getByTestId("tenant-process-attivita-finestra")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("tab", { name: /Grafo/ }).click();
    await expect(page.getByTestId("grafo-attivita")).toHaveCount(scheda.activities.length);
    await expect(page.getByTestId("grafo-processo")).toHaveCount(1);
  });

  test("ADR-0061, passo 1: ogni pagina dei processi dice quale oggetto conta e spiega i cinque sensi", async ({ page }) => {
    for (const [url, oggetto, nome] of [
      ["/tenant-processes", "configurazione", "Processo del tenant"],
      ["/processes", "blueprint", "Processo del modello"],
    ] as const) {
      await page.goto(url);
      const riga = page.getByTestId("oggetto-contato");
      await expect(riga).toHaveAttribute("data-oggetto", oggetto);
      await expect(page.getByTestId("oggetto-contato-nome")).toHaveText(nome);
      await page.getByTestId("oggetto-contato-apri").click();
      const finestra = page.getByTestId("sensi-del-processo");
      await expect(finestra).toBeVisible();
      await expect(finestra.locator("[data-testid^=sensi-oggetto-]")).toHaveCount(5);
      await expect(page.getByTestId(`sensi-oggetto-${oggetto}`)).toHaveAttribute("data-qui", "si");
      await expect(page.getByTestId("sensi-del-processo-livelli").locator("tbody tr")).toHaveCount(5);
      await page.keyboard.press("Escape");
    }
  });
});
