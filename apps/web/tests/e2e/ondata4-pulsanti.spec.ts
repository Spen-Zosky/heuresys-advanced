/**
 * apps/web/tests/e2e/ondata4-pulsanti.spec.ts — ondata 4a degli endpoint senza consumatori
 * (piano docs/piani/PIANO_endpoint-orfani-ondate_20261117.md): attivazioni e scostamenti dei
 * blueprint, il fascicolo del cliente, le decisioni sulle proposte delle corse di ricerca.
 *
 * I giri che si disfano si fanno davvero e si rileggono dall'API (un fascicolo rinominato e rimesso
 * com'era, uno scostamento registrato su un processo che non ne aveva e poi tolto). I gesti che non si
 * disfano (lo stato di un'attivazione, la ricerca, una decisione) si provano fino al comando visibile.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe.configure({ retries: 1 });

async function leggi<T>(request: APIRequestContext, path: string): Promise<T> {
  const r = await request.get(`/api${path}`);
  expect(r.ok(), `GET ${path} → HTTP ${r.status()}`).toBeTruthy();
  return (await r.json()) as T;
}

test.describe("Amministrazione della piattaforma", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("blueprint: uno scostamento si registra su un processo libero e si toglie", async ({ page, request }) => {
    const att = await leggi<{ items: { blueprintActivationId: string; variantId: string }[] }>(request, "/v1/blueprint-activations?limit=50");
    test.skip(att.items.length === 0, "nessuna attivazione di blueprint");
    const a = att.items[0]!;
    await page.goto(`/blueprints/${a.variantId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByTestId("blueprint-tab-activations").click();
    const riga = page.getByTestId("blueprint-activation-row").first();
    await expect(riga).toBeVisible({ timeout: 45_000 });
    await expect(riga.getByTestId("activation-status-select")).toBeVisible();
    await riga.getByTestId("activation-overrides-toggle").click();
    await expect(page.getByTestId("activation-overrides")).toBeVisible({ timeout: 30_000 });

    // L'attivazione aperta la dice il pannello stesso.
    const attivazioneId = await page.getByTestId("activation-overrides").getAttribute("data-activation-id");
    const prima = await leggi<{ items: { processId: string }[] }>(request, `/v1/blueprint-overrides?activationId=${attivazioneId}&limit=500`);
    await expect(page.getByTestId("activation-overrides-count")).toContainText(String(prima.items.length), { timeout: 30_000 });
    const processi = await leggi<{ items: { blueprintProcessId: string }[] }>(request, `/v1/blueprint-processes?variantId=${a.variantId}&limit=500`);
    const libero = processi.items.find((p) => !prima.items.some((o) => o.processId === p.blueprintProcessId));
    test.skip(!libero, "ogni processo ha già uno scostamento");
    await page.getByTestId("activation-override-process").selectOption(libero!.blueprintProcessId);
    await page.getByTestId("activation-override-inclusion").selectOption("PARTIAL");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/blueprint-overrides") && r.request().method() === "PUT" && r.ok()),
      page.getByTestId("activation-override-save").click(),
    ]);
    // Si toglie SOLO lo scostamento appena registrato: il processo non ne aveva uno.
    const nostro = page.locator(`[data-testid="activation-override-row"][data-process-id="${libero!.blueprintProcessId}"]`);
    await expect(nostro).toHaveCount(1, { timeout: 30_000 });
    page.once("dialog", (d) => void d.accept());
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/blueprint-overrides/") && r.request().method() === "DELETE" && r.ok()),
      nostro.getByTestId("activation-override-remove").click(),
    ]);
    await expect(nostro).toHaveCount(0, { timeout: 30_000 });
    const dopo = await leggi<{ items: unknown[] }>(request, `/v1/blueprint-overrides?activationId=${attivazioneId}&limit=500`);
    expect(dopo.items.length).toBe(prima.items.length);
  });

  test("fascicolo: si rinomina e si rimette com'era", async ({ page, request }) => {
    const elenco = await leggi<{ items: { tenantBlueprintId: string; name: string }[] }>(request, "/v1/tenant-blueprints?limit=20");
    test.skip(elenco.items.length === 0, "nessun fascicolo");
    const f = elenco.items[0]!;
    await page.goto(`/tenant-blueprints/${f.tenantBlueprintId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("fascicolo-gestione")).toBeVisible({ timeout: 45_000 });
    const nome = page.getByTestId("fascicolo-nome");
    const nuovo = `${f.name} (prova)`.slice(0, 255);
    for (const valore of [nuovo, f.name]) {
      await nome.fill(valore);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/v1/tenant-blueprints/${f.tenantBlueprintId}`) && r.request().method() === "PATCH" && r.ok()),
        page.getByTestId("fascicolo-nome-salva").click(),
      ]);
      const riletto = await leggi<{ name: string }>(request, `/v1/tenant-blueprints/${f.tenantBlueprintId}`);
      expect(riletto.name).toBe(valore);
    }
    await expect(page.getByTestId("fascicolo-archivia")).toBeVisible();
  });

  test("corse di ricerca: le proposte di una corsa si aprono con i comandi di decisione", async ({ page, request }) => {
    const corse = await leggi<{ items: { seedAcquisitionRunId: string }[]; total: number }>(request, "/v1/seed-acquisition-runs?limit=50");
    test.skip(corse.items.length === 0, "nessuna corsa di ricerca");
    const proposte = await leggi<{ total: number }>(request, `/v1/seed-acquisition-runs/${corse.items[0]!.seedAcquisitionRunId}/candidates`);
    await page.goto("/seed-acquisition/runs", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByTestId("seed-run-proposals-toggle").first().click();
    await expect(page.getByTestId("seed-run-proposals")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("seed-run-proposals-count")).toContainText(String(proposte.total), { timeout: 30_000 });
  });
});
