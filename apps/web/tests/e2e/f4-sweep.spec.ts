/**
 * apps/web/tests/e2e/f4-sweep.spec.ts — Fase 4 forense per-superficie (S1025).
 *
 * CENSUS run, non-regression: visita ogni route statica per persona e raccoglie
 * i segnali MECCANICI del kickoff (docs/kb/NEXT_SESSION_DB_FRONTEND_FORENSICS_KICKOFF.md §4):
 *   - errori console + richieste /v1 fallite (>=400)
 *   - leakage di codici: UUID e SCREAMING_SNAKE renderizzati nel testo visibile
 *   - artefatti "undefined"/"NaN"/"[object Object]"
 *   - mix IT/EN euristico (parole EN comuni su locale it)
 *   - pagine scarne (innerText corto = dataset povero/empty-state sospetto)
 * Ogni pagina produce una riga nel report JSON (qa_artifacts/runs/f4-sweep/):
 * l'analisi semantica (leggibilità, formati, realismo) resta manuale sulle schede.
 *
 * NON fa parte della suite di regressione: si attiva SOLO con F4_SWEEP=1, es.
 *   F4_SWEEP=1 pnpm test:e2e:node22 f4-sweep
 */

import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { storageStateFor } from "./fixtures";

const SWEEP_ON = process.env.F4_SWEEP === "1";

const PAGES_PER_PERSONA = {
  platformAdmin: [
    "/dashboard", "/tenants", "/admin/roles", "/admin/mfa-policy", "/users",
    "/system-health", "/provenance", "/seed-acquisition/runs", "/brownfield-adaptation",
    "/insights", "/insights/skill-gap", "/insights/succession-readiness",
    "/org-director", "/process-owner", "/content", "/visualizations",
    "/analytics/workforce", "/analytics/kpi", "/analytics/attendance",
    "/analytics/compensation", "/analytics/skills", "/analytics/skills-by-category",
    "/analytics/skills-group-share", "/analytics/org-network", "/analytics/overtime",
    "/approvals", "/engagement", "/goals", "/okrs", "/talent-review", "/time-off",
  ],
  tenantAdmin: [
    "/dashboard", "/users", "/positions", "/blueprints", "/skills", "/kpis",
    "/learning", "/learning/training-initiatives", "/gaps", "/career-succession",
    "/compensation-intelligence", "/organization", "/organization/org-chart",
    "/processes", "/visualizations",
  ],
  employee: [
    "/me", "/me/profile", "/me/positions", "/me/skills", "/me/skills/self-assessment",
    "/me/learning", "/me/learning/catalogue", "/me/gaps", "/me/kpis", "/me/career",
    "/me/career/target", "/me/certifications", "/me/documents", "/me/inbox",
    "/me/security", "/me/analytics", "/me/approvals", "/me/handbook", "/me/matching",
    "/me/org-chart", "/me/surveys", "/me/team",
  ],
} as const satisfies Record<string, readonly string[]>;

// EN words that should not appear as UI labels on an it-IT locale page.
// Conservative list: business/domain anglicisms accepted in Italian banking UI
// (dashboard, skill, team, feedback, board, badge...) are NOT flagged.
const EN_LABELS = [
  "Loading", "Submit", "Save changes", "Search…", "No data", "Rows per page",
  "Previous", "Next page", "Show more", "Read more", "Sign in", "Sign out",
  "Welcome back", "Required field", "Please ", "Failed to", "Error loading",
  "Not found", "Access denied", "Coming soon",
] as const;

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
// SCREAMING_SNAKE with >=2 segments (renders like PERMISSION_DENIED / LEGACY_EMP)
const SNAKE_RE = /\b[A-Z][A-Z0-9]{1,}(?:_[A-Z0-9]{2,}){1,}\b/g;
const ARTIFACT_RE = /\bundefined\b|\bNaN\b|\[object Object\]/g;

interface PageFinding {
  persona: string;
  route: string;
  finalUrl: string;
  consoleErrors: string[];
  failedApi: Array<{ url: string; status: number }>;
  uuidLeaks: string[];
  snakeLeaks: string[];
  artifacts: string[];
  enLabels: string[];
  textLength: number;
  h1: string | null;
}

const findings: PageFinding[] = [];

async function sweepRoute(page: Page, persona: string, route: string): Promise<void> {
  const consoleErrors: string[] = [];
  const failedApi: Array<{ url: string; status: number }> = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && res.url().includes("/v1/")) {
      failedApi.push({ url: new URL(res.url()).pathname, status: res.status() });
    }
  });

  await page.goto(route);
  await page.waitForLoadState("networkidle").catch(() => {
    /* long-poll/websocket pages may not settle */
  });

  // dead-session guard (same doctrine as a11y.spec D-24): a redirect to /login
  // would make every metric vacuous.
  const landed = new URL(page.url()).pathname;
  expect(landed, `dead session: requested ${route}, landed ${landed}`).toBe(route);

  // hydration wait (same doctrine as a11y.spec) + anti-vacuity: a blank body
  // (dev-server 500 / not hydrated) must FAIL the census, not record 0-metrics.
  await page
    .waitForFunction(() => document.documentElement.getAttribute("lang") != null, undefined, { timeout: 5000 })
    .catch(() => {});
  await page
    .waitForFunction(() => (document.body?.innerText ?? "").length > 50, undefined, { timeout: 15_000 })
    .catch(() => {});
  // settle: il testo deve STABILIZZARSI (2 letture uguali a 700ms) — la sola
  // soglia >50ch fotografa la shell prima che i dati TanStack arrivino e
  // marca "scarna" ogni pagina ESS (falso positivo del primo run S1025).
  let prev = -1;
  for (let i = 0; i < 12; i++) {
    const len = await page.evaluate(() => (document.body?.innerText ?? "").length);
    if (len === prev && len > 50) break;
    prev = len;
    await page.waitForTimeout(700);
  }

  const text = await page.evaluate(() => document.body?.innerText ?? "");
  expect(text.length, `blank page on ${route} (server error o mancata idratazione)`).toBeGreaterThan(50);
  const h1 = await page.locator("h1").first().textContent().catch(() => null);

  const uniq = (xs: RegExpMatchArray | string[] | null): string[] =>
    [...new Set(xs ?? [])].slice(0, 12);

  findings.push({
    persona,
    route,
    finalUrl: landed,
    consoleErrors: consoleErrors.slice(0, 8),
    failedApi: failedApi.slice(0, 8),
    uuidLeaks: uniq(text.match(UUID_RE)),
    snakeLeaks: uniq(text.match(SNAKE_RE)),
    artifacts: uniq(text.match(ARTIFACT_RE)),
    enLabels: EN_LABELS.filter((w) => text.includes(w)),
    textLength: text.length,
    h1: h1?.trim() ?? null,
  });
}

for (const [persona, pages] of Object.entries(PAGES_PER_PERSONA)) {
  test.describe(`f4-sweep as ${persona}`, () => {
    test.skip(!SWEEP_ON, "census run only — set F4_SWEEP=1");
    test.use({ storageState: storageStateFor(persona as keyof typeof PAGES_PER_PERSONA) });

    for (const route of pages) {
      test(`census ${route}`, async ({ page }) => {
        await sweepRoute(page, persona, route);
      });
    }
  });
}

test.afterAll(() => {
  if (!SWEEP_ON || findings.length === 0) return;
  const outDir = join(process.cwd(), "..", "..", "qa_artifacts", "runs", "f4-sweep");
  mkdirSync(outDir, { recursive: true });
  // one file per worker-chunk; the analyzer merges all report-*.json
  const out = join(outDir, `report-${process.pid}.json`);
  writeFileSync(out, JSON.stringify(findings, null, 2));
  console.log(`[f4-sweep] ${findings.length} pagine censite → ${out}`);
});
