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
  test("ADR-0061, passo 2: la scheda del processo ha la classificazione per faccette", async ({ page, request }) => {
    const body = (await (await request.get("/api/v1/processes?level=1")).json()) as { items: Sintesi[] };
    const p = body.items[0];
    test.skip(!p, "RTL non ha processi attivi");
    const f = await request.get(`/api/v1/tenant-processes/${p!.processId}/faccette`);
    expect(f.ok()).toBeTruthy();
    const faccette = (await f.json()) as { canEdit: boolean; items: Array<{ facet: string; status: string }> };
    await page.goto(`/tenant-processes/${p!.processId}`);
    await page.getByRole("tab", { name: /Classificazione/ }).click();
    await expect(page.getByTestId("classificazione-riga")).toHaveCount(7);
    await expect(page.getByTestId("classificazione-valore")).toHaveCount(faccette.items.length);
    // Le proposte dell'agente si approvano anche in blocco: il pulsante c'è solo se ce ne sono.
    const conProposte = faccette.canEdit && faccette.items.some((x) => x.status === "PROPOSTA");
    await expect(page.getByTestId("classificazione-approva-tutte")).toHaveCount(conProposte ? 1 : 0);
  });
  test("ADR-0061, passo 3: il catalogo del modello dice quanti criteri di pubblicazione soddisfa ogni processo", async ({ page }) => {
    await page.goto("/processes");
    await expect(page.getByTestId("processes-page")).toBeVisible();
    const righe = page.getByTestId("processes-row");
    test.skip((await righe.count()) === 0, "nessun processo del modello in elenco");
    const apri = page.getByTestId("pubblicabilita-apri").first();
    await expect(apri).toBeVisible();
    await apri.click();
    await expect(page.getByTestId("pubblicabilita-finestra")).toBeVisible();
    await expect(page.getByTestId("pubblicabilita-criterio")).toHaveCount(8);
    await expect(page.getByTestId("pubblicabilita-criterio").nth(1)).toHaveAttribute("data-soddisfatto", "no");
  });

  test("ADR-0061, passo 4: le attività dicono la voce APQC e il tipo di corrispondenza", async ({ page, request }) => {
    const body = (await (await request.get("/api/v1/processes?level=1")).json()) as { items: Sintesi[] };
    let trovato: { pid: string; n: number } | null = null;
    for (const x of body.items.slice(0, 25)) {
      const sc = (await (await request.get(`/api/v1/processes/${x.processId}/scheda`)).json()) as { activities: { apqcCode: string | null }[] };
      const n = sc.activities.filter((a) => a.apqcCode).length;
      if (n > 0) { trovato = { pid: x.processId, n }; break; }
    }
    test.skip(!trovato, "nessuna attività con voce APQC");
    await page.goto(`/tenant-processes/${trovato!.pid}`);
    await page.getByRole("tab", { name: /attivit/i }).first().click();
    await expect(page.getByTestId("apqc-cella")).toHaveCount(trovato!.n);
    const modifica = page.getByTestId("apqc-modifica").first();
    await expect(modifica).toBeVisible();
    await modifica.click();
    await expect(page.getByTestId("apqc-finestra")).toBeVisible();
    await expect(page.getByTestId("apqc-scelta")).toHaveCount(4);
  });
});
