/**
 * apps/web/tests/e2e/ondata5a-cataloghi.spec.ts — ondata 5a degli endpoint senza consumatori
 * (piano docs/piani/PIANO_endpoint-orfani-ondate_20261117.md): le schermate dei cataloghi.
 *
 * Ogni pagina si apre con il numero vero dell'API. Le scritture si provano con un giro che non
 * cambia niente: si apre una voce, si salva con gli stessi valori e si rilegge dall'API che la voce
 * è com'era (la chiamata parte davvero e risponde 2xx). L'aggiornamento dalle fonti ufficiali non si
 * lancia: legge da Internet e scrive nel catalogo; si prova fino al comando visibile.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe.configure({ retries: 1 });

async function leggi<T>(request: APIRequestContext, path: string): Promise<T> {
  const r = await request.get(`/api${path}`);
  expect(r.ok(), `GET ${path} → HTTP ${r.status()}`).toBeTruthy();
  return (await r.json()) as T;
}

test.describe("Cataloghi della piattaforma", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("modelli dei KPI: il numero è quello dell'API e un peso si riscrive uguale", async ({ page, request }) => {
    const prima = await leggi<{ items: { processKpiTemplateId: string; processId: string; kpiId: string; defaultWeight: number }[]; total: number }>(request, "/v1/process-kpi-templates?limit=500");
    await page.goto("/admin/catalogo-kpi", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("kpi-templates-process-count")).toContainText(String(prima.total), { timeout: 45_000 });
    test.skip(prima.items.length === 0, "nessun abbinamento processo↔KPI");
    const r = prima.items[0]!;
    await page.getByTestId("kpi-template-process-process").selectOption(r.processId);
    await page.getByTestId("kpi-template-process-kpi").selectOption(r.kpiId);
    await page.getByTestId("kpi-template-process-weight").fill(String(r.defaultWeight));
    await Promise.all([
      page.waitForResponse((x) => x.url().includes("/v1/process-kpi-templates") && x.request().method() === "PUT" && x.ok()),
      page.getByTestId("kpi-template-process-save").click(),
    ]);
    const dopo = await leggi<{ items: { processKpiTemplateId: string; defaultWeight: number }[]; total: number }>(request, "/v1/process-kpi-templates?limit=500");
    expect(dopo.total).toBe(prima.total);
    expect(dopo.items.find((x) => x.processKpiTemplateId === r.processKpiTemplateId)?.defaultWeight).toBe(r.defaultWeight);
  });

  test("tassonomie: le professioni contano come l'API e una voce si salva com'era", async ({ page, request }) => {
    const isco = await leggi<{ items: { occupationClassificationId: string; name: string }[]; total: number }>(request, "/v1/occupation-classifications?scheme=ISCO_08&limit=1");
    await page.goto("/admin/tassonomie", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const prof = page.getByTestId("catalogo-professioni");
    await expect(prof.getByTestId("catalogo-professioni-count")).toContainText(String(isco.total), { timeout: 45_000 });
    const riga = prof.getByTestId("catalogo-professioni-row").first();
    const id = await riga.getAttribute("data-id");
    const nome = (await leggi<{ name: string }>(request, `/v1/occupation-classifications/${id}`)).name;
    await riga.getByTestId("tassonomia-edit").click();
    await Promise.all([
      page.waitForResponse((x) => x.url().includes(`/v1/occupation-classifications/${id}`) && x.request().method() === "PATCH" && x.ok()),
      prof.getByTestId("tassonomia-edit-save").click(),
    ]);
    expect((await leggi<{ name: string }>(request, `/v1/occupation-classifications/${id}`)).name).toBe(nome);
    // Le altre sezioni ci sono, con i dati vivi.
    const fasce = await leggi<{ items: unknown[] }>(request, "/v1/enterprise-size-bands?limit=200");
    await expect(page.getByTestId("fasce-dimensionali").getByTestId("fascia-row")).toHaveCount(fasce.items.length, { timeout: 30_000 });
    await expect(page.getByTestId("catalogo-attivita")).toBeVisible();
    await expect(page.getByTestId("modelli-operativi")).toBeVisible();
  });

  test("blueprint: una famiglia si salva com'era e il processo di una variante si apre in correzione", async ({ page, request }) => {
    const fam = await leggi<{ items: { blueprintFamilyId: string; name: string }[]; total: number }>(request, "/v1/blueprint-families?limit=200");
    await page.goto("/blueprints", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const pannello = page.getByTestId("blueprint-families-panel");
    await expect(pannello.getByTestId("blueprint-families-count")).toContainText(String(fam.total), { timeout: 45_000 });
    test.skip(fam.items.length === 0, "nessuna famiglia di blueprint");
    const f = fam.items[0]!;
    const riga = pannello.locator(`[data-testid="blueprint-family-row"][data-id="${f.blueprintFamilyId}"]`);
    await riga.getByTestId("blueprint-family-edit").click();
    await Promise.all([
      page.waitForResponse((x) => x.url().includes(`/v1/blueprint-families/${f.blueprintFamilyId}`) && x.request().method() === "PATCH" && x.ok()),
      riga.getByTestId("blueprint-family-edit-save").click(),
    ]);
    const dopo = await leggi<{ items: { blueprintFamilyId: string; name: string }[] }>(request, "/v1/blueprint-families?limit=200");
    expect(dopo.items.find((x) => x.blueprintFamilyId === f.blueprintFamilyId)?.name).toBe(f.name);

    const varianti = await leggi<{ items: { blueprintVariantId: string }[] }>(request, "/v1/blueprint-variants?limit=1");
    test.skip(varianti.items.length === 0, "nessuna variante");
    await page.goto(`/blueprints/${varianti.items[0]!.blueprintVariantId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("blueprint-variant-data")).toBeVisible({ timeout: 45_000 });
    const proc = page.getByTestId("blueprint-process-row").first();
    test.skip((await page.getByTestId("blueprint-process-row").count()) === 0, "la variante non ha processi");
    await proc.getByTestId("blueprint-process-edit").click();
    await expect(page.getByTestId("blueprint-process-editor")).toBeVisible();
  });

  test("fonti ufficiali: le fonti e lo storico vengono dall'API, il comando c'è", async ({ page, request }) => {
    const fonti = await leggi<{ items: unknown[] }>(request, "/v1/reference-sync/sources");
    const corse = await leggi<{ total: number }>(request, "/v1/reference-sync/runs");
    await page.goto("/admin/dati-di-riferimento", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("dati-riferimento-fonte")).toHaveCount(fonti.items.length, { timeout: 45_000 });
    await expect(page.getByTestId("dati-riferimento-corse-count")).toContainText(String(corse.total));
    await expect(page.getByTestId("dati-riferimento-lancia").first()).toBeEnabled();
  });
});
