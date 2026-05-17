/**
 * apps/web/tests/e2e/a11y.spec.ts
 *
 * Acceptance MVP-2a #7 — accessibility audit con axe-core.
 *
 * Per ogni pagina autenticata di ogni persona group, esegue axe-core
 * filtrato sui ruleset WCAG 2.0 A/AA + WCAG 2.1 A/AA e asserisce ZERO
 * violazioni con impact "critical". Le altre (serious/moderate/minor)
 * vengono raccolte come tail-items per MVP-3 (vedi docs/a11y-tail-items.md).
 *
 * I tre persona group condividono storageState già preparato da auth.setup.ts:
 *   - platformAdmin: route admin scope PLATFORM (incl. /tenants, /admin/roles)
 *   - tenantAdmin:   route admin scope TENANT  (resto del set admin)
 *   - employee:      route ESS /me/*
 *
 * Live data: l'API gira contro DB OCI VM via tunnel :5433 (no mock).
 *
 * Note di esecuzione:
 *   - dev mode è compile-on-demand → prima request a una route è lenta.
 *     retries=1 assorbe la flake; ogni axe scan dura 2-6s a regime.
 *   - violazioni serious/moderate/minor sono loggate ma NON failano il test.
 *   - per scan dettagliato di una singola pagina: pnpm exec playwright test
 *     a11y.spec.ts -g "<route>"
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { storageStateFor } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

const AUDIT_OUT_DIR = path.resolve(__dirname, "..", "..", "test-results", "a11y-audit");

test.describe.configure({ retries: 1 });

type AxeImpact = "critical" | "serious" | "moderate" | "minor";

const PAGES_PER_PERSONA = {
  platformAdmin: ["/dashboard", "/tenants", "/admin/roles", "/users"],
  tenantAdmin: [
    "/dashboard",
    "/users",
    "/positions",
    "/blueprints",
    "/skills",
    "/kpis",
    "/learning",
    "/gaps",
    "/career-succession",
    "/compensation-intelligence",
    "/organization",
    "/processes",
    "/seed-acquisition/runs",
    "/brownfield-adaptation",
    "/visualizations",
    "/learning/training-initiatives",
    "/organization/org-chart",
  ],
  employee: [
    "/me",
    "/me/profile",
    "/me/positions",
    "/me/skills",
    "/me/skills/self-assessment",
    "/me/learning",
    "/me/learning/catalogue",
    "/me/gaps",
    "/me/kpis",
    "/me/career",
    "/me/career/target",
    "/me/certifications",
    "/me/documents",
    "/me/inbox",
  ],
} as const satisfies Record<string, readonly string[]>;

async function runAxeOnRoute(page: Page, route: string, testInfo: TestInfo) {
  await page.goto(route);
  await page.waitForLoadState("networkidle").catch(() => {
    // networkidle may not settle on pages with long-poll websockets; ignore
  });

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
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

  // Write a compact per-route audit summary to disk. Persistent across
  // pass/fail (unlike testInfo.attach, which Playwright drops for passing
  // tests when reporter "list" + no HTML report is configured). The aggregate
  // is consumed by docs/a11y-tail-items.md for MVP-3 prioritization.
  const summary = (Object.entries(bySeverity) as [AxeImpact, typeof results.violations][])
    .map(([k, arr]) => `${k}=${arr.length}`)
    .join(" ");
  fs.mkdirSync(AUDIT_OUT_DIR, { recursive: true });
  const flatName = route.replace(/^\//, "").replace(/\//g, "__") || "root";
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

  // Hard gate: critical violations must be zero.
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

for (const [persona, pages] of Object.entries(PAGES_PER_PERSONA)) {
  test.describe(`a11y as ${persona}`, () => {
    test.use({ storageState: storageStateFor(persona as keyof typeof PAGES_PER_PERSONA) });

    for (const route of pages) {
      test(`${route} has no critical a11y violations`, async ({ page }, testInfo) => {
        await runAxeOnRoute(page, route, testInfo);
      });
    }
  });
}
