/**
 * apps/web/tests/e2e/capture-demo.gen.ts — guided-demo screenshot generator (#4).
 *
 * NOT a regression spec: it captures real screenshots of the live RTL_BANK
 * reference tenant for the public /demo tour, into apps/web/public/demo/*.png.
 * Named .gen.ts (not .spec.ts) so the default testMatch (/.*\.spec\.ts/) never
 * runs it in CI / the full suite; it runs ONLY via the `capture-demo` project
 * (playwright.config.ts), which depends on `setup` to mint fresh persona
 * storageState (post-MFA). Re-runnable: regenerate when the UI changes.
 *
 * Run on-demand (Windows → Node-22 wrapper, against a running web :3000 + API):
 *   node scripts/e2e-node22.mjs test --project=capture-demo
 *
 * Data is the synthetic RTL_BANK case study (no real PII — ADR-0023), so the
 * frozen PNGs are safe to publish.
 */
import { test } from "@playwright/test";
import path from "node:path";

const OUT = path.resolve(__dirname, "..", "..", "public", "demo");
const AUTH = path.resolve(__dirname, "..", ".auth");

type Step = { state: string | null; route: string; file: string; wait?: string };

const STEPS: Step[] = [
  { state: null, route: "/", file: "01-landing.png", wait: '[data-testid="landing-hero"]' },
  { state: "tenantAdmin", route: "/organization/org-chart", file: "02-org-chart.png" },
  { state: "tenantAdmin", route: "/positions", file: "03-positions.png" },
  { state: "tenantAdmin", route: "/analytics/skills", file: "04-skills.png" },
  { state: "tenantAdmin", route: "/insights/succession-readiness", file: "05-succession.png" },
  { state: "tenantAdmin", route: "/org-director", file: "06-maturity.png" },
  { state: "tenantAdmin", route: "/process-owner", file: "07-raci.png" },
  { state: "employee", route: "/me/matching", file: "08-matching.png" },
  { state: "manager", route: "/me/team", file: "09-team.png" },
  { state: "tenantAdmin", route: "/dashboard", file: "10-dashboard.png" },
];

test("capture demo screenshots", async ({ browser }) => {
  test.setTimeout(300_000);
  for (const s of STEPS) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ...(s.state ? { storageState: path.join(AUTH, `${s.state}.json`) } : {}),
    });
    const page = await ctx.newPage();
    try {
      await page.goto(s.route, { waitUntil: "networkidle", timeout: 60_000 });
      if (s.wait) await page.waitForSelector(s.wait, { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, s.file), fullPage: false });
      console.log(`[capture] ${s.file} ← ${s.route} (${s.state ?? "anon"})`);
    } finally {
      await ctx.close();
    }
  }
});
