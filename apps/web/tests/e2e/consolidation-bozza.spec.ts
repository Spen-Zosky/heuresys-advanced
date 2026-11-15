/**
 * apps/web/tests/e2e/consolidation-bozza.spec.ts — la bozza del consolidamento (Enzo, 2026-11-14).
 *
 * LIVE-DATA-E2E-ONLY e in SOLA LETTURA: la prova non decide e non approva, perché scrivere nella
 * bozza o nei dati di RTL è del Direttore HR. Controlla che ciò che si vede venga dalle rotte vere:
 *   · l'avviso arancione nell'intestazione c'è se e solo se /pending-approval conta modifiche;
 *   · il pulsante rosso «Approva definitivamente» compare solo al Direttore HR con una bozza non vuota;
 *   · la finestra della decisione, aperta e chiusa senza confermare, mostra la cascata dal modello.
 */

import { test, expect } from "@playwright/test";
import type { ConsolidationAccess, PendingApproval } from "@heuresys/shared";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 1 });

test.describe("Consolidamento — bozza e approvazione (lettura)", () => {
  test("l'avviso nell'intestazione e il pulsante rosso seguono la bozza vera", async ({ page }) => {
    const access = (await (await page.request.get("/api/v1/tenant-consolidations/access")).json()) as ConsolidationAccess;
    const r = await page.request.get("/api/v1/tenant-consolidations/pending-approval");
    expect(r.status()).toBe(200);
    const bozza = (await r.json()) as PendingApproval;

    await page.goto("/consolidation", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("consolidation-title")).toBeVisible({ timeout: 45_000 });
    const avviso = page.getByTestId("consolidation-pending-approval");
    if (bozza.pending > 0) {
      await expect(avviso).toBeVisible();
      await expect(avviso).toHaveAttribute("href", "/consolidation");
    } else {
      await expect(avviso).toHaveCount(0);
    }
    const rosso = access.decidesAs === "DIRETTORE" && bozza.pending > 0 ? 1 : 0;
    await expect(page.getByTestId("consolidation-approve")).toHaveCount(rosso);
  });

  test("la finestra della decisione mostra la cascata, e chiuderla non decide", async ({ page }) => {
    await page.goto("/consolidation", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("consolidation-title")).toBeVisible({ timeout: 45_000 });
    const apri = page.getByTestId("consolidation-decide-open");
    test.skip((await apri.count()) === 0, "nessuna proposta decidibile da questa persona nel registro di oggi");
    const prima = (await (await page.request.get("/api/v1/tenant-consolidations/pending-approval")).json()) as PendingApproval;
    await apri.first().click();
    const finestra = page.getByTestId("consolidation-decision-dialog");
    await expect(finestra).toBeVisible();
    await expect(finestra.getByTestId("consolidation-cascade")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(finestra).toHaveCount(0);
    const dopo = (await (await page.request.get("/api/v1/tenant-consolidations/pending-approval")).json()) as PendingApproval;
    expect(dopo.pending).toBe(prima.pending);
  });
});
