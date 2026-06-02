/**
 * apps/web/tests/e2e/rbac-route-matrix.spec.ts
 *
 * WS-4 V — exhaustive-by-sampling RBAC route × role matrix (default dark theme).
 *
 * The full 11-roles × ~65-routes × 2-themes matrix (~1400 scenarios) would blow the single
 * self-hosted runner's CI budget, so this SAMPLES the meaningful cells: each key role × the routes
 * it legitimately reaches (incl. the new /me/team across ALL roles), asserting the authenticated
 * shell renders (no /login bounce) under the dark canonical theme.
 *
 * Theme axis: the DARK default is asserted on every cell here; the LIGHT half of the "× 2 themes"
 * axis is covered (switch → reload → reset) by me-preferences.spec.ts (the canonical server-SoT
 * theme spec) and the dark token precision by theme-propagation.spec.ts — V does not duplicate
 * that shared-state mutation (it would only add flake, not coverage).
 *
 * Doctrine: live-data E2E, persisted storageState, no mock/fixture. Robust navigation
 * (gotoAuthenticated) absorbs `next dev` cold-compile.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor, gotoAuthenticated, type PersonaKey } from "./fixtures";

test.describe.configure({ retries: 1, timeout: 120_000 });

/** Sampled role × route matrix — each persona paired with routes it legitimately reaches. */
const MATRIX: Record<PersonaKey, string[]> = {
  platformAdmin: ["/dashboard", "/users", "/me/team"],
  tenantAdmin: ["/dashboard", "/positions", "/me/team"],
  manager: ["/dashboard", "/me", "/me/team"],
  employee: ["/me", "/me/skills", "/me/team"],
  outsider: ["/me", "/me/inbox", "/me/team"],
};

for (const persona of Object.keys(MATRIX) as PersonaKey[]) {
  test.describe(`route matrix — ${persona} (dark)`, () => {
    test.use({ storageState: storageStateFor(persona) });
    for (const route of MATRIX[persona]) {
      test(`${persona} renders ${route} in dark`, async ({ page }) => {
        await gotoAuthenticated(page, route); // throws if bounced to /login (no nav-me)
        expect(page.url(), `${route}: should not redirect to /login`).not.toContain("/login");
        // dark canonical theme propagated (the .dark class is set by the boot script — stable in
        // dev, unlike the post-compile computed bg which flickers; token precision = theme-propagation).
        const hasDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
        expect(hasDark, `${route}: <html> should carry .dark`).toBe(true);
      });
    }
  });
}
