/**
 * apps/web/tests/e2e/consolidation.spec.ts — AC-10, la pagina del consolidamento col prototipo.
 *
 * LIVE-DATA-E2E-ONLY, e in SOLA LETTURA: entra la persona `tenantAdmin` delle fixture, che ha
 * almeno `consolidation:read` (mig 000465). La prova non avvia giri e non decide: scrivere nel
 * registro è del Direttore HR, e una prova che lo facesse sporcherebbe il registro vero del
 * tenant.
 *
 * I bottoni attesi non sono scritti qui: si leggono da `/v1/tenant-consolidations/access`, la
 * stessa rotta che li governa nella pagina. Così la prova resta vera se i ruoli di RTL cambiano
 * (chi ha `tenantAdmin` può essere anche Direttore HR, o solo lettore).
 */

import { test, expect } from "@playwright/test";
import type { ConsolidationAccess } from "@heuresys/shared";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 1 });

test.describe("Consolidamento col prototipo — lettura", () => {
  test("la voce di menu porta alla pagina, che si legge dal registro vero", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator('a[href="/consolidation"]').first().click({ timeout: 45_000 });
    await expect(page).toHaveURL(/\/consolidation$/);
    await expect(page.getByTestId("consolidation-title")).toBeVisible({ timeout: 45_000 });
    // O non c'è una sessione aperta, o c'è: in entrambi i casi lo dice il registro, non la pagina.
    await expect(page.getByTestId("consolidation-empty").or(page.getByTestId("consolidation-session"))).toBeVisible();
  });

  test("i bottoni per avviare sono quelli che la rotta di accesso concede", async ({ page }) => {
    const res = await page.request.get("/api/v1/tenant-consolidations/access");
    expect(res.status()).toBe(200);
    const access = (await res.json()) as ConsolidationAccess;
    const sessioni = (await (await page.request.get("/api/v1/tenant-consolidations")).json()) as { items: { status: string }[] };
    const aperta = sessioni.items.some((s) => s.status === "GIRI" || s.status === "IN_CONFERMA");

    await page.goto("/consolidation", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("consolidation-title")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId(aperta ? "consolidation-session" : "consolidation-empty")).toBeVisible();
    if (!aperta) {
      await expect(page.getByTestId("consolidation-start")).toHaveCount(access.canRun ? 1 : 0);
    }
    if (access.decidesAs === null) {
      await expect(page.locator('[data-testid^="consolidation-decide-"]')).toHaveCount(0);
    }
  });
});
