/**
 * apps/web/tests/e2e/me-preferences.spec.ts
 *
 * WS-4 P1 — per-user theme + palette preferences, SERVER source of truth.
 * i18n Fase 0b — per-user UI locale (it/en), same server-source-of-truth contract.
 *
 * Live-data E2E: a real seeded employee logs in fresh (so the access cookie + csrf token are
 * current — avoids the storageState 15-min-access-token staleness that makes mutation specs flaky),
 * opens /me/profile, changes theme + palette through the real UI (each click PATCHes
 * /v1/me/preferences → DB on the OCI VM via the tunnel), then RELOADS the page. After reload the
 * values come back from the server (GET /v1/me/preferences) and are re-applied by the layout's
 * PreferencesApplier — proving the server is the source of truth, not localStorage.
 *
 * Cleanup: resets the persona to the brand defaults (dark / balanced / it) at the end so the suite
 * is deterministic and leaves no residue across runs.
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./fixtures";

test.describe.configure({ retries: 1 });
// Fresh login + dev-mode cold compile + several reloads exceed the 30s default. The flow is a
// sequence of fast steps; give it head-room rather than masking a real hang.
test.setTimeout(120_000);

const LIGHT_BACKGROUND_RGB = "rgb(250, 251, 253)"; // #FAFBFD (light --background)
const DARK_BACKGROUND_RGB = "rgb(13, 16, 23)"; // #0D1017 (dark --background)
const COOL_OCEAN_PALETTE_1 = "178 75% 42%"; // applyPalette(1) inline --palette-1 (light mode)

async function patchAndWait(page: Page, testId: string) {
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/v1/me/preferences") && r.request().method() === "PATCH",
    ),
    page.getByTestId(testId).click(),
  ]);
  expect(resp.status()).toBe(200);
}

async function bodyBackground(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}
async function paletteVar(page: Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--palette-1").trim(),
  );
}

async function openProfile(page: Page) {
  await page.goto("/me/profile");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("me-appearance")).toBeVisible({ timeout: 20_000 });
}

test.describe("ESS preferences — theme + palette server source-of-truth", () => {
  test("changing theme+palette persists across a full reload (server SoT)", async ({ page }) => {
    await loginAs(page, "employee");
    await openProfile(page);

    // Switch to light + cool-ocean via the real UI (each click PATCHes the API → DB).
    await patchAndWait(page, "pref-theme-light");
    await patchAndWait(page, "pref-palette-cool-ocean");

    // Applied live: light background + the cool-ocean --palette-1 value.
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect.poll(() => bodyBackground(page)).toBe(LIGHT_BACKGROUND_RGB);
    await expect.poll(() => paletteVar(page)).toBe(COOL_OCEAN_PALETTE_1);

    // The server is the authoritative store: a direct read reflects the change (any client cache
    // is irrelevant). Uses the page's authenticated context via the /api proxy.
    const apiResp = await page.request.get("/api/v1/me/preferences");
    expect(apiResp.status()).toBe(200);
    expect(await apiResp.json()).toMatchObject({ theme: "light", palette: "cool-ocean" });

    // RELOAD with localStorage cleared first → the re-applied value can ONLY come from the server
    // (GET /v1/me/preferences → PreferencesApplier), proving server source-of-truth over the cache.
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("me-appearance")).toBeVisible({ timeout: 20_000 });

    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect.poll(() => bodyBackground(page)).toBe(LIGHT_BACKGROUND_RGB);
    await expect.poll(() => paletteVar(page)).toBe(COOL_OCEAN_PALETTE_1);

    // Reset to brand defaults so the next run starts clean (dark canonical theme re-applied).
    await patchAndWait(page, "pref-theme-dark");
    await patchAndWait(page, "pref-palette-balanced");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect.poll(() => bodyBackground(page)).toBe(DARK_BACKGROUND_RGB);
  });
});

async function nextLocaleCookie(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === "NEXT_LOCALE")?.value;
}

test.describe("ESS preferences — UI locale server source-of-truth (i18n Fase 0b)", () => {
  test("changing language persists server-side across a cookie+cache-cleared reload", async ({ page }) => {
    await loginAs(page, "employee");
    await openProfile(page);

    // S1009: the language switch is a SINGLE header toggle (a button whose text is the
    // current locale, IT/EN), not the old 2-button language-it/en group with aria-pressed.
    // The aria-label is itself localized, so match it bilingually.
    const langToggle = page.getByRole("button", { name: /lingua|language/i });
    const waitPrefsPatch = () =>
      page.waitForResponse((r) => r.url().includes("/v1/me/preferences") && r.request().method() === "PATCH");

    // Default locale = IT.
    await expect(langToggle).toHaveText("IT");

    // Flip to EN via the real toggle — the click PATCHes /v1/me/preferences (locale) → DB.
    await Promise.all([waitPrefsPatch(), langToggle.click()]);
    await expect(langToggle).toHaveText("EN");
    // setLocale also writes the NEXT_LOCALE cookie (same-device first-paint cache).
    await expect.poll(() => nextLocaleCookie(page)).toBe("en");

    // Server is the authoritative store: a direct read reflects the locale.
    const apiResp = await page.request.get("/api/v1/me/preferences");
    expect(apiResp.status()).toBe(200);
    expect(await apiResp.json()).toMatchObject({ locale: "en" });

    // Clear the NEXT_LOCALE cookie (only) and localStorage, then reload: the re-applied locale
    // can ONLY come from the server (GET /v1/me/preferences → PreferencesApplier → setLocale, which
    // rewrites the cookie to 'en'). The auth cookie is preserved so the session survives.
    await page.context().clearCookies({ name: "NEXT_LOCALE" });
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("me-appearance")).toBeVisible({ timeout: 20_000 });

    // After reload the toggle shows EN again + the cookie was re-written from the server choice.
    await expect(langToggle).toHaveText("EN");
    await expect.poll(() => nextLocaleCookie(page)).toBe("en");

    // Reset to the IT default so the suite is deterministic and leaves no residue.
    await Promise.all([waitPrefsPatch(), langToggle.click()]);
    await expect(langToggle).toHaveText("IT");
  });
});
