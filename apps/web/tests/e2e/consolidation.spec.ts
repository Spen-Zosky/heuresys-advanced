/**
 * apps/web/tests/e2e/consolidation.spec.ts — AC-10, la pagina del consolidamento col prototipo.
 *
 * LIVE-DATA-E2E-ONLY, e in SOLA LETTURA: la TENANT_ADMIN di RTL (federica.marchetti) ha
 * `consolidation:read` e nient'altro (mig 000465), quindi vede la pagina, il menu la porta lì,
 * e non le compaiono i bottoni di chi avvia o decide. La prova non avvia giri e non decide:
 * scrivere nel registro è del Direttore HR, e una prova che lo facesse sporcherebbe il registro
 * vero del tenant.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 1 });

test.describe("Consolidamento col prototipo — chi legge soltanto", () => {
  test("la voce di menu porta alla pagina, che si legge dal registro vero", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator('a[href="/consolidation"]').first().click({ timeout: 45_000 });
    await expect(page).toHaveURL(/\/consolidation$/);
    await expect(page.getByTestId("consolidation-title")).toBeVisible({ timeout: 45_000 });
    // O non c'è una sessione aperta, o c'è: in entrambi i casi lo dice il registro, non la pagina.
    await expect(page.getByTestId("consolidation-empty").or(page.getByTestId("consolidation-session"))).toBeVisible();
  });

  test("chi ha solo la lettura non vede i bottoni per avviare o decidere", async ({ page }) => {
    await page.goto("/consolidation", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("consolidation-title")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("consolidation-empty").or(page.getByTestId("consolidation-session"))).toBeVisible();
    await expect(page.getByTestId("consolidation-start")).toHaveCount(0);
    await expect(page.getByTestId("consolidation-run")).toHaveCount(0);
    await expect(page.locator('[data-testid^="consolidation-decide-"]')).toHaveCount(0);
  });
});
