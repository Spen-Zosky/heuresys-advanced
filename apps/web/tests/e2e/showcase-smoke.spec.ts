/**
 * apps/web/tests/e2e/showcase-smoke.spec.ts
 *
 * Brand identity v1 smoke — verifies the /showcase route group renders without
 * console errors and passes axe-core baseline (zero critical violations) on
 * every scaffolded route.
 *
 * Differs from the rest of the e2e suite: showcase routes are PUBLIC (or
 * env-gated public) and must not require authentication. Each test runs with
 * an empty storageState so the auth setup project is bypassed.
 *
 * Routes covered (scaffold status as of Session 1):
 *   /showcase            index
 *   /showcase/shell      UXIX-0001 — expanded/collapsed shell demo
 *   /showcase/palettes   UXIX-0005 — 2 palette candidates
 *   /showcase/typography UXIX-0006 — 2 typography candidates
 *   /showcase/logo       UXIX-0007 — 3 logo candidates
 *
 * Pending routes (header/sidebar/footer/icons/page-types/dashboard-cards/
 * forms/tables/charts/landing-page/login-page/primary-initial-page) are
 * deliberately skipped — they will be added to ROUTES as each ships.
 *
 * Requirement: NEXT_PUBLIC_ENABLE_SHOWCASE=1 in the dev server env, OR
 * NODE_ENV !== "production" (default for `pnpm dev`).
 *
 * Execution (after pnpm install in this worktree):
 *   pnpm exec playwright test showcase-smoke.spec.ts
 * Or a single route:
 *   pnpm exec playwright test showcase-smoke.spec.ts -g "/showcase/logo"
 */

import { test, expect, type ConsoleMessage } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SHOWCASE_ROUTES = [
  { path: "/showcase", label: "index" },
  { path: "/showcase/shell", label: "shell" },
  { path: "/showcase/palettes", label: "palettes" },
  { path: "/showcase/typography", label: "typography" },
  { path: "/showcase/logo", label: "logo" },
] as const;

// Bypass the auth setup project — showcase is unauthenticated.
test.use({ storageState: { cookies: [], origins: [] } });

for (const route of SHOWCASE_ROUTES) {
  test.describe(`Showcase route ${route.path}`, () => {
    test(`renders without console errors (${route.label})`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg: ConsoleMessage) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => {
        consoleErrors.push(`PAGE ERROR: ${err.message}`);
      });

      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response, `no response for ${route.path}`).not.toBeNull();
      expect(response!.status(), `bad status on ${route.path}`).toBeLessThan(400);

      // Showcase pages share a layout header announcing the section.
      await expect(page.getByText("Heuresys / Brand Identity Showcase")).toBeVisible();

      // Quiet pause for late-bound hydration warnings.
      await page.waitForLoadState("networkidle");

      // Filter Next.js / React dev-mode noise that is informational, not real
      // errors (hydration suppression, Fast Refresh, font preload warnings).
      const realErrors = consoleErrors.filter((e) =>
        !/Fast Refresh|preload|hydration|suppressHydrationWarning|Download the React DevTools/i.test(e),
      );
      expect(realErrors, `console errors on ${route.path}:\n${realErrors.join("\n")}`).toEqual([]);
    });

    test(`a11y axe-core baseline (${route.label})`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const critical = results.violations.filter((v) => v.impact === "critical");
      expect(critical, `${route.path} critical a11y violations:\n${critical
        .map((v) => `  - ${v.id}: ${v.help}`)
        .join("\n")}`).toEqual([]);
    });
  });
}

test.describe("Shell route contract (UXIX-0001)", () => {
  test("shell architecture page renders live dashboard demo with KPI fixtures", async ({ page }) => {
    await page.goto("/showcase/shell", { waitUntil: "domcontentloaded" });

    // Page header + live demo section render.
    await expect(page.getByRole("heading", { name: "Shell architecture" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workforce dashboard" })).toBeVisible();

    // The KPI fixtures should be present, demonstrating realistic Heuresys
    // content (no placeholder boxes per SHOWCASE_GENERATION_PROMPT).
    await expect(page.getByText("Active positions").first()).toBeVisible();
    await expect(page.getByText("Open skill gaps").first()).toBeVisible();
    await expect(page.getByText("Learning completions YTD").first()).toBeVisible();
  });
});

test.describe("Decision Register linkage", () => {
  test("index lists scaffold + pending routes with their UXIX-NNNN ids", async ({ page }) => {
    await page.goto("/showcase", { waitUntil: "domcontentloaded" });
    // At least the 5 scaffolded routes must surface their Decision Register tie.
    for (const id of ["UXIX-0001", "UXIX-0005", "UXIX-0006", "UXIX-0007"]) {
      await expect(page.getByText(id, { exact: false }).first()).toBeVisible();
    }
  });
});
