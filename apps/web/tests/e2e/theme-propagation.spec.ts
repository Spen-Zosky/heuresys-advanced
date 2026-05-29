/**
 * apps/web/tests/e2e/theme-propagation.spec.ts
 *
 * Foundation A regression guard (brand-fidelity migration, S947).
 *
 * Asserts that EVERY authenticated route inherits the dark canonical theme:
 *   - document.documentElement carries the `dark` class (boot script + RootLayout)
 *   - the `--background` CSS custom property resolves to the dark token (#0D1017)
 *   - <body> background-color resolves to that token (rgb(13, 16, 23))
 *
 * Run against a PRODUCTION build (`next start`), not `next dev` — dev cold-compile
 * is a known false-signal for theme flicker. The /me-light vs /dashboard-dark
 * anomaly observed in dev (S946) is verified here in prod.
 *
 * Doctrine: live-data E2E. Uses real seeded personas via persisted storageState
 * (tests/.auth/*.json produced by auth.setup.ts).
 */

import { test, expect, type Page } from "@playwright/test";
import { storageStateFor } from "./fixtures";

const DARK_BACKGROUND_HEX = "#0d1017";
const DARK_BACKGROUND_RGB = "rgb(13, 16, 23)";

async function assertDarkCanonicalTheme(page: Page, route: string) {
  await page.goto(route);
  // Wait for the authenticated shell (or ESS page) to actually paint, not just
  // the redirect-to-login shell. Every authenticated page renders inside the
  // DashboardShell; body must have resolved its themed background.
  await page.waitForLoadState("networkidle");

  const snapshot = await page.evaluate(() => {
    const html = document.documentElement;
    const htmlStyles = getComputedStyle(html);
    return {
      url: location.pathname,
      hasDarkClass: html.classList.contains("dark"),
      backgroundToken: htmlStyles.getPropertyValue("--background").trim().toLowerCase(),
      cardToken: htmlStyles.getPropertyValue("--card").trim().toLowerCase(),
      bodyBackground: getComputedStyle(document.body).backgroundColor,
    };
  });

  expect(snapshot.hasDarkClass, `${route}: <html> should carry .dark`).toBe(true);
  expect(snapshot.backgroundToken, `${route}: --background should be the dark token`).toBe(DARK_BACKGROUND_HEX);
  expect(snapshot.cardToken, `${route}: --card should be the dark token`).toBe("#131720");
  expect(snapshot.bodyBackground, `${route}: <body> bg should resolve to the dark token`).toBe(DARK_BACKGROUND_RGB);
}

test.describe("theme propagation — admin routes (platformAdmin)", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  for (const route of ["/dashboard", "/positions", "/users", "/skills", "/tenants"]) {
    test(`dark canonical theme on ${route}`, async ({ page }) => {
      await assertDarkCanonicalTheme(page, route);
    });
  }
});

test.describe("theme propagation — ESS routes (employee)", () => {
  test.use({ storageState: storageStateFor("employee") });

  for (const route of ["/me", "/me/profile", "/me/skills"]) {
    test(`dark canonical theme on ${route}`, async ({ page }) => {
      await assertDarkCanonicalTheme(page, route);
    });
  }
});
