/**
 * apps/web/tests/e2e/ondata3-pagine-nuove.spec.ts — ondata 3b degli endpoint senza consumatori
 * (piano docs/piani/PIANO_endpoint-orfani-ondate_20261117.md): mentoring, valutazioni delle persone,
 * riscontri sul clima, dati personali (GDPR) e capacità dell'agente.
 *
 * Le pagine si aprono dalla loro scheda e mostrano i dati vivi contati dall'API. Del GDPR si prova
 * solo la PROVA della corsa di conservazione (`dryRun`), che non tocca i dati: la corsa vera non si
 * preme mai da un test.
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

  test("mentoring: la scheda di Carriera apre programmi e coppie", async ({ page, request }) => {
    const programmi = await leggi<{ total: number }>(request, "/v1/mentorship/programs?limit=1");
    await page.goto("/career-succession", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("link", { name: /Mentoring/ }).click();
    await expect(page.getByTestId("mentorship-page")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("mentorship-program-row")).toHaveCount(Math.min(programmi.total, 100), { timeout: 30_000 });
  });

  test("valutazioni delle persone: la scheda di /performance apre l'elenco", async ({ page, request }) => {
    const v = await leggi<{ total: number }>(request, "/v1/assessments?limit=1");
    await page.goto("/assessments", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("assessments-page")).toBeVisible({ timeout: 45_000 });
    if (v.total > 0) await expect(page.getByTestId("assessment-row").first()).toBeVisible({ timeout: 30_000 });
  });

  test("clima: i riscontri e i piani d'azione stanno in /engagement", async ({ page }) => {
    await page.goto("/engagement", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("engagement-feedback")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("engagement-feedback-count")).toContainText(/\d/, { timeout: 30_000 });
  });
});

test.describe("Amministrazione della piattaforma", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("GDPR: la prova di conservazione conta le righe senza toccarle", async ({ page }) => {
    await page.goto("/admin/gdpr", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("gdpr-admin-page")).toBeVisible({ timeout: 45_000 });
    test.skip(!(await page.getByTestId("gdpr-retention").isVisible()), "la persona non ha gdpr:retention");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/gdpr/retention/run") && r.request().method() === "POST" && r.ok()),
      page.getByTestId("gdpr-retention-dry").click(),
    ]);
    await expect(page.getByTestId("gdpr-retention-report")).toBeVisible({ timeout: 60_000 });
  });

  test("capacità dell'agente: l'elenco viene dal registro", async ({ page, request }) => {
    const c = await leggi<{ items: unknown[] }>(request, "/v1/agent-capabilities");
    await page.goto("/admin/agent-capabilities", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("agent-capabilities-page")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("agent-capability-row")).toHaveCount(c.items.length, { timeout: 30_000 });
  });
});
