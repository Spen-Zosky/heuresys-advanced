/**
 * apps/web/tests/e2e/showcase-a11y.spec.ts
 *
 * Tier 7 — accessibility audit per `docs/A11Y_AUDIT_TIER7_2026-05-20.md`.
 *
 * Companion to `a11y.spec.ts` (business routes). This spec covers the 18
 * showcase routes that are gated by `NEXT_PUBLIC_ENABLE_SHOWCASE=1` and don't
 * require auth. Same axe-core ruleset (WCAG 2.0/2.1/2.2 A+AA), same
 * zero-critical gate, same per-route JSON persistence.
 *
 * Running:
 *   pnpm --filter @heuresys/web exec playwright test showcase-a11y.spec.ts
 *
 * Required env: NEXT_PUBLIC_ENABLE_SHOWCASE=1 (so the showcase layout doesn't
 * redirect to notFound()). The dev server's `.env.local` or `.env` should set
 * this; if not, prefix the command:
 *   NEXT_PUBLIC_ENABLE_SHOWCASE=1 pnpm --filter @heuresys/web exec playwright test showcase-a11y.spec.ts
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const AUDIT_OUT_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "test-results",
  "showcase-a11y-audit",
);

test.describe.configure({ retries: 1 });

type AxeImpact = "critical" | "serious" | "moderate" | "minor";

const SHOWCASE_ROUTES = [
  "/showcase",
  "/showcase/system-health",
  "/showcase/shell",
  "/showcase/header",
  "/showcase/footer",
  "/showcase/sidebar",
  "/showcase/palettes",
  "/showcase/typography",
  "/showcase/logo",
  "/showcase/icons",
  "/showcase/page-types",
  "/showcase/dashboard-cards",
  "/showcase/forms",
  "/showcase/tables",
  "/showcase/charts",
  "/showcase/landing-page",
  "/showcase/login-page",
  "/showcase/primary-initial-page",
] as const;

async function runAxeOnRoute(page: Page, route: string, testInfo: TestInfo) {
  await page.goto(route);
  await page.waitForLoadState("networkidle").catch(() => {
    // networkidle may not settle on pages with long-poll websockets; ignore
  });

  const results = await new AxeBuilder({ page })
    .withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "wcag22a",
      "wcag22aa",
    ])
    .analyze();

  const bySeverity = {
    critical: [] as typeof results.violations,
    serious: [] as typeof results.violations,
    moderate: [] as typeof results.violations,
    minor: [] as typeof results.violations,
  };
  for (const v of results.violations) {
    const impact = (v.impact ?? "minor") as AxeImpact;
    bySeverity[impact].push(v);
  }

  const summary = (
    Object.entries(bySeverity) as [AxeImpact, typeof results.violations][]
  )
    .map(([k, arr]) => `${k}=${arr.length}`)
    .join(" ");

  fs.mkdirSync(AUDIT_OUT_DIR, { recursive: true });
  const flatName =
    route.replace(/^\//, "").replace(/\//g, "__") || "root";
  fs.writeFileSync(
    path.join(AUDIT_OUT_DIR, `${flatName}.json`),
    JSON.stringify(
      {
        route,
        summary,
        timestamp: new Date().toISOString(),
        violations: results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
          help: v.help,
          helpUrl: v.helpUrl,
        })),
      },
      null,
      2,
    ),
  );
  await testInfo.attach(`axe-${flatName}.json`, {
    path: path.join(AUDIT_OUT_DIR, `${flatName}.json`),
    contentType: "application/json",
  });

  if (bySeverity.critical.length > 0) {
    const details = bySeverity.critical
      .map((v) => `  - [${v.id}] ${v.help} (${v.nodes.length} nodes)`)
      .join("\n");
    expect(
      bySeverity.critical.length,
      `Critical a11y violations on ${route}:\n${details}`,
    ).toBe(0);
  }
}

test.describe("a11y showcase (anonymous)", () => {
  for (const route of SHOWCASE_ROUTES) {
    test(`${route} has no critical a11y violations`, async ({ page }, testInfo) => {
      await runAxeOnRoute(page, route, testInfo);
    });
  }
});
