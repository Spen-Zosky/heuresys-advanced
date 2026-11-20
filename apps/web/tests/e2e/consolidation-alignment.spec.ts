/**
 * apps/web/tests/e2e/consolidation-alignment.spec.ts — la scheda «Allineamento» della pagina del consolidamento
 * (piano docs/piani/PIANO_scheda-allineamento_20261118.md).
 *
 * LIVE-DATA-E2E-ONLY e in SOLA LETTURA: non salva e non approva decisioni. Che cosa la scheda deve mostrare si
 * legge dalle stesse rotte che la alimentano: la corsa di partenza (la definitiva, altrimenti la più recente con un
 * modello) e la sua misura. Si prova che la scheda Consolidamento resta quella di sempre, che il quadro porta i 24
 * domini con gli stessi numeri dell'API e che un dominio aperto mostra le sue voci non uguali.
 */

import { test, expect } from "@playwright/test";
import type { AlignmentResponse, BlueprintRun } from "@heuresys/shared";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 1 });

test("la scheda Allineamento mostra i 24 domini della corsa con i numeri dell'API", async ({ page }) => {
  test.setTimeout(180_000);
  const res = await page.request.get("/api/v1/consolidation-runs");
  expect(res.status()).toBe(200);
  const { items } = (await res.json()) as { items: BlueprintRun[] };
  const conModello = items.filter((r) => r.variantVersionId);

  await page.goto("/consolidation", { waitUntil: "domcontentloaded", timeout: 60_000 });
  // La scheda di sempre resta la prima e mostra il registro delle corse.
  await expect(page.getByTestId("consolidation-runs")).toBeVisible({ timeout: 45_000 });
  await page.getByTestId("consolidation-tab-alignment").click();
  if (conModello.length === 0) {
    await expect(page.getByTestId("alignment-no-runs")).toBeVisible({ timeout: 45_000 });
    return;
  }
  const corsa = conModello.find((r) => r.status === "DEFINITIVA") ?? conModello[0]!;
  await expect(page.getByTestId("alignment-run-select")).toHaveValue(corsa.runId, { timeout: 45_000 });

  const m = await page.request.get(`/api/v1/consolidation-runs/${corsa.runId}/alignment`, { timeout: 120_000 });
  expect(m.status()).toBe(200);
  const dati = (await m.json()) as AlignmentResponse;
  expect(dati.domini).toHaveLength(24);

  await expect(page.getByTestId("alignment-overview")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("alignment-overview-row")).toHaveCount(24);

  const unita = dati.domini.find((d) => d.dominio === "unita")!;
  const aperte = unita.righe_voci.filter((r) => r.esito !== "uguale").length;
  await page.getByTestId("alignment-nav-unita").click();
  await expect(page.getByTestId("alignment-section-title")).toBeVisible();
  if (aperte === 0) await expect(page.getByTestId("alignment-empty")).toBeVisible();
  else await expect(page.getByTestId("alignment-row")).toHaveCount(aperte);
});
