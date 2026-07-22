/**
 * apps/web/scripts/axe-orgchart.mjs — one-off F4: diagnosi NODO-SPECIFICA della
 * violazione color-contrast su /organization/org-chart (la a11y.spec salva solo
 * il summary). Riusa la sessione tenantAdmin di tests/.auth (rigenerata dal
 * setup della sweep) contro il server dev già attivo su :3000.
 * Run (Node 22): ../../.cache/node22/node-v22.23.0-win-x64/node.exe scripts/axe-orgchart.mjs
 */
import { chromium } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const BASE = process.env.WEB_BASE_URL ?? "http://localhost:3000";
const STATE = new URL("../tests/.auth/tenantAdmin.json", import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, "$1"); // win path fix

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/organization/org-chart`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
const landed = new URL(page.url()).pathname;
if (landed !== "/organization/org-chart") {
  console.error(`dead session: landed on ${landed}`);
  process.exit(2);
}
// stessa attesa della a11y.spec: lang idratato prima di axe (evita falsi
// document-title/html-has-lang da cattura mid-hydration)
await page.waitForFunction(() => document.documentElement.getAttribute("lang") != null, undefined, { timeout: 5000 }).catch(() => {});
await page.waitForFunction(() => document.title.length > 0, undefined, { timeout: 5000 }).catch(() => {});
const res = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"])
  .analyze();
for (const v of res.violations) {
  console.log(`\nRULE ${v.id} [${v.impact}] — ${v.help}`);
  for (const n of v.nodes) {
    console.log("  target:", JSON.stringify(n.target));
    console.log("  html  :", n.html.slice(0, 300));
    for (const c of n.any.concat(n.all)) {
      console.log("  check :", c.id, "-", c.message);
      if (c.data) console.log("  data  :", JSON.stringify(c.data).slice(0, 300));
    }
  }
}
if (res.violations.length === 0) console.log("0 violazioni (potrebbe essere data/viewport-dipendente)");
await browser.close();
