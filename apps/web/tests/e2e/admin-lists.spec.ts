/**
 * apps/web/tests/e2e/admin-lists.spec.ts
 *
 * Live-data E2E for /users, /users/[id], /positions, /positions/[id]
 * against the RTL_BANK tenant (158 real rtl-bank.org users + their positions).
 * Uses storageState (auth.setup.ts) to avoid /v1/auth/login rate limit.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

// Repertorio interfacce: la persona con il mandato HR del tenant (vedi fixtures.ts, hrManager).
test.use({ storageState: storageStateFor("hrManager") });

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
    await expect(page.getByTestId("field-userId")).toBeVisible();
    await expect(page.getByTestId("user-email-detail")).toBeVisible();
  });

  test("/positions lists tenant positions and clickable PIP detail", async ({ page }) => {
    await page.goto("/positions");

    await expect(page.getByTestId("positions-page")).toBeVisible();
    // R5: per default si contano le posizioni attive, e il numero è quello della tabella.
    await expect(page.getByTestId("positions-count")).toContainText(/\d+\s+posizioni attive/);
    const rows = page.getByTestId("positions-row");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(5);
    // R2/R3: il titolo prima del codice (che non c'è più), titolare, unità e sede, lo stato in coda.
    const heads = (await page.locator("main table thead th").allTextContents()).map((h) => h.trim().toLowerCase());
    expect(heads).toEqual(["posizione", "titolare", "unità", "sede", "criticità", "stato"]);
    // L'ordine è per titolo, fatto dal server.
    const titoli = (await page.getByTestId("position-link").allTextContents()).map((s) => s.trim().toLowerCase().charAt(0));
    expect(titoli).toEqual([...titoli].sort());

    await page.getByTestId("position-link").first().click();
    await page.waitForURL(/\/positions\/[0-9a-f-]+$/);
    await expect(page.getByTestId("position-detail-page")).toBeVisible();
    await expect(page.getByTestId("position-title")).toBeVisible();
    await expect(page.getByTestId("position-code")).toBeVisible();
  });
});
