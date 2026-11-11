/**
 * apps/web/tests/e2e/admin-lists.spec.ts
 *
 * Live-data E2E for /users, /users/[id], /positions, /positions/[id]
 * against the RTL_BANK tenant (158 real rtl-bank.org users + their positions).
 * Uses storageState (auth.setup.ts) to avoid /v1/auth/login rate limit.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });

test.describe("MVP-2a admin lists — live data", () => {
  test("/users lists tenant users with real count > 0 and clickable detail", async ({ page }) => {
    await page.goto("/users");

    await expect(page.getByTestId("users-page")).toBeVisible();
    await expect(page.getByTestId("users-title")).toBeVisible();
    // R5 del repertorio interfacce: un solo numero, che dice che cosa conta.
    await expect(page.getByTestId("users-count")).toContainText(/\d+\s+persone/);
    const rows = page.getByTestId("users-row");
    await expect(rows.first()).toBeVisible();
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(5);

    // R2 e R3: le colonne sono quelle del contesto, e lo stato chiude la riga.
    const headers = (await page.locator('[data-testid="users-page"] thead th').allInnerTexts()).map((h) => h.trim().toLowerCase());
    expect(headers).toEqual(["cognome, nome", "ruolo nell'organizzazione", "sede", "stato"]);

    // R1: «Cognome, Nome», in ordine di cognome.
    const nomi = await page.getByTestId("user-link").allInnerTexts();
    for (const n of nomi) expect(n).toMatch(/^[^,]+, .+$/);
    // L'iniziale del cognome non torna mai indietro (la collazione fine la decide il DB).
    const iniziali = nomi.map((n) => n.trim().charAt(0).toLowerCase());
    expect(iniziali).toEqual([...iniziali].sort());

    const firstLink = page.getByTestId("user-link").first();
    await firstLink.click();
    await page.waitForURL(/\/users\/[0-9a-f-]+$/);
    await expect(page.getByTestId("user-detail-page")).toBeVisible();
    // C2: l'identificativo tecnico non è più a video; l'anagrafica resta, nella scheda Gestione (C5)
    await page.getByTestId("scheda-gestione").click();
    await expect(page.getByTestId("user-fields")).toBeVisible();
    await expect(page.getByTestId("user-email-detail")).toBeVisible();
  });

  test("/positions lists tenant positions and clickable PIP detail", async ({ page }) => {
    await page.goto("/positions");

    await expect(page.getByTestId("positions-page")).toBeVisible();
    await expect(page.getByTestId("positions-count")).toContainText(/\d+\s+totali/);
    const rows = page.getByTestId("positions-row");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(5);

    await page.getByTestId("position-link").first().click();
    await page.waitForURL(/\/positions\/[0-9a-f-]+$/);
    await expect(page.getByTestId("position-detail-page")).toBeVisible();
    await expect(page.getByTestId("position-title")).toBeVisible();
    await expect(page.getByTestId("position-code")).toBeVisible();
  });
});
