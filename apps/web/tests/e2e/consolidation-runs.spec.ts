/**
 * apps/web/tests/e2e/consolidation-runs.spec.ts — il registro delle corse del modello (mig 000489).
 *
 * LIVE-DATA-E2E-ONLY e in SOLA LETTURA: non carica corse, non avvia consolidamenti, non rende
 * definitivo niente. Che cosa la pagina deve mostrare si legge da `/v1/consolidation-runs`, la
 * stessa rotta che la alimenta: la corsa scelta di partenza è la prima del registro (la caricata
 * più di recente), e una corsa mai consolidata si annuncia come tale.
 */

import { test, expect } from "@playwright/test";
import type { BlueprintRun } from "@heuresys/shared";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 1 });

test("la pagina parte dalla corsa più recente del registro e dice se è mai stata consolidata", async ({ page }) => {
  const res = await page.request.get("/api/v1/consolidation-runs");
  expect(res.status()).toBe(200);
  const { items } = (await res.json()) as { items: BlueprintRun[] };

  await page.goto("/consolidation", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByTestId("consolidation-runs")).toBeVisible({ timeout: 45_000 });
  if (items.length === 0) {
    await expect(page.getByTestId("consolidation-runs-empty")).toBeVisible();
    return;
  }
  const prima = items[0]!;
  await expect(page.getByTestId("consolidation-runs-select")).toHaveValue(prima.runId);
  await expect(page.getByTestId("consolidation-run-row")).toHaveCount(Math.min(items.length, 10));
  await expect(page.getByTestId("consolidation-run-never")).toHaveCount(prima.consolidations === 0 ? 1 : 0);
  if (prima.consolidations === 0) {
    await expect(page.getByTestId("consolidation-run-never")).toContainText(prima.modelLabel);
  }
});
