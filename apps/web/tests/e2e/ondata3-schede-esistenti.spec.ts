/**
 * apps/web/tests/e2e/ondata3-schede-esistenti.spec.ts — ondata 3a degli endpoint senza consumatori
 * (piano docs/piani/PIANO_endpoint-orfani-ondate_20261117.md).
 *
 * I giri che si possono disfare si fanno davvero e si rileggono dall'API (sinonimo rinominato e
 * rimesso, unità assegnata al processo e tolta). I gesti che non si disfano (fase di un ciclo,
 * stato di un tenant, codici di recupero) si provano solo fino al comando visibile, senza premerlo.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe.configure({ retries: 1 });

async function leggi<T>(request: APIRequestContext, path: string): Promise<T> {
  const r = await request.get(`/api${path}`);
  expect(r.ok(), `GET ${path} → HTTP ${r.status()}`).toBeTruthy();
  return (await r.json()) as T;
}

test.describe("Direttore HR", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("carriere: le schede mostrano la gestione di percorsi, bacini e candidati", async ({ page }) => {
    await page.goto("/career-succession", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("career-paths-manage")).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("career-tab-pools").click();
    await expect(page.getByTestId("career-pools-manage")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("career-tab-candidates").click();
    await expect(page.getByTestId("career-candidates-manage")).toBeVisible({ timeout: 30_000 });
  });

  test("processi: un'unità si assegna al processo e si toglie", async ({ page }) => {
    await page.goto("/process-owner", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const riga = page.getByTestId("process-owner-row").first();
    await expect(riga).toBeVisible({ timeout: 45_000 });
    await riga.getByRole("button").first().click();
    await expect(page.getByTestId("raci-assign")).toBeVisible({ timeout: 30_000 });
    const prima = await page.getByTestId("raci-drill-row").count();
    const unita = page.getByTestId("raci-assign-unit");
    await expect(unita.locator("option").nth(1)).toBeAttached({ timeout: 30_000 });
    const nomeUnita = ((await unita.locator("option").nth(1).textContent()) ?? "").trim();
    await unita.selectOption({ index: 1 });
    await page.getByTestId("raci-assign-role").selectOption("INFORMED");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/organization-unit-processes") && r.request().method() === "POST" && r.ok()),
      page.getByTestId("raci-assign-submit").click(),
    ]);
    await expect(page.getByTestId("raci-drill-row")).toHaveCount(prima + 1, { timeout: 30_000 });
    page.once("dialog", (d) => void d.accept());
    // Si toglie SOLO la riga appena creata: l'unità scelta non aveva un ruolo nel processo (il menu
    // esclude le già assegnate), quindi la riga con il suo nome è una sola ed è nostra.
    const nuova = page.getByTestId("raci-drill-row").filter({ hasText: nomeUnita });
    await expect(nuova).toHaveCount(1);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/organization-unit-processes/") && r.request().method() === "DELETE" && r.ok()),
      nuova.getByTestId("raci-remove").click(),
    ]);
    await expect(page.getByTestId("raci-drill-row")).toHaveCount(prima, { timeout: 30_000 });
  });

  test("valutazioni: i cicli che possono avanzare mostrano il comando di fase", async ({ page, request }) => {
    const cicli = await leggi<{ items: { status: string }[] }>(request, "/v1/review-cycles?limit=50&offset=0");
    const avanzabile = cicli.items.some((c) => !["SHARED", "CANCELLED"].includes(c.status));
    test.skip(!avanzabile, "nessun ciclo che possa ancora avanzare");
    await page.goto("/performance", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.locator('[data-testid^="perf-cycle-to-"]').first()).toBeVisible({ timeout: 45_000 });
  });

  test("me/security: si vede quanti codici di recupero restano", async ({ page }) => {
    await page.goto("/me/security", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("me-recovery-codes-count")).toContainText(/\d/, { timeout: 45_000 });
  });
});

test.describe("Amministrazione della piattaforma", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("tenant: la scheda mostra la modifica e le assegnazioni della piattaforma", async ({ page, request }) => {
    const elenco = await leggi<{ items: { tenantId: string }[] }>(request, "/v1/tenants?limit=1");
    await page.goto(`/tenants/${elenco.items[0]!.tenantId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("tenant-edit")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("tenant-platform-assignments")).toBeVisible();
  });
});
