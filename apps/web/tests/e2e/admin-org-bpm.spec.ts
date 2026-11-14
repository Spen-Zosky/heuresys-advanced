/**
 * apps/web/tests/e2e/admin-org-bpm.spec.ts
 *
 * Live-data E2E for /organization, /blueprints, /processes,
 * /learning/training-initiatives — all consumed by tenantAdmin.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });

test.describe("MVP-2a admin org + bpm — live data", () => {
  test("/organization shows the OU registry", async ({ page }) => {
    await page.goto("/organization");
    await expect(page.getByTestId("organization-page")).toBeVisible();
    await expect(page.getByTestId("organization-count")).toContainText(/\d+\s+unità/);
    await expect(page.getByTestId("organization-row").first()).toBeVisible();
    // Repertorio interfacce (B2): il nome apre la riga, niente codice, lo stato in coda (R2, R3, R4).
    const heads = (await page.locator("main table thead th").allTextContents()).map((h) => h.trim().toLowerCase());
    expect(heads.slice(0, 4)).toEqual(["nome", "tipo", "unità superiore", "stato"]);
    // L'ordine per nome lo fa il server.
    const nomi = (await page.getByTestId("organization-name").allTextContents()).map((s) => s.trim().toLowerCase().charAt(0));
    expect(nomi).toEqual([...nomi].sort());
  });

  test("/blueprints lists variants with family info", async ({ page }) => {
    await page.goto("/blueprints");
    await expect(page.getByTestId("blueprints-page")).toBeVisible();
    await expect(page.getByTestId("blueprints-count")).toContainText(/\d+\s+varianti/);
    await expect(page.getByTestId("blueprints-row").first()).toBeVisible();
  });

  test("/processes lists blueprint-anchored BPM processes", async ({ page }) => {
    await page.goto("/processes");
    await expect(page.getByTestId("processes-page")).toBeVisible();
    await expect(page.getByTestId("processes-count")).toContainText(/\d+\s+processi/);
    await expect(page.getByTestId("processes-row").first()).toBeVisible();
    // Repertorio interfacce (B3): niente colonna del codice, il tipo in parole (R2, R4, R7).
    const heads = (await page.locator("main table thead th").allTextContents()).map((h) => h.trim().toLowerCase());
    expect(heads).toEqual(["n.", "processo", "tipo"]);
    await expect(page.locator("main table tbody").getByText(/^(Essenziale|Facoltativo)$/).first()).toBeVisible();
  });

  test("/learning/training-initiatives lists scheduled sessions", async ({ page }) => {
    await page.goto("/learning/training-initiatives");
    await expect(page.getByTestId("training-page")).toBeVisible();
    await expect(page.getByTestId("training-count")).toContainText(/\d+\s+pianificate/);
  });
});
