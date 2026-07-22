/**
 * apps/web/tests/e2e/auth.setup.ts
 *
 * Playwright "setup" project — runs once before every spec to log in each
 * persona we use and persist their browser context (cookies, localStorage)
 * to a JSON file. Specs then load those state files via `storageState` so
 * they don't have to re-hit /v1/auth/login (which is rate-limited at 10 per
 * 5 minutes per IP, easily exhausted by repeated runs).
 *
 * Keeps the live-data E2E doctrine intact: every other spec still calls
 * real /v1/* endpoints with these cookies.
 */

import { test as setup } from "@playwright/test";
import { API_BASE, completeMfaIfChallenged, fillLoginForm, PERSONAS, TEST_PASSWORD } from "./fixtures";

const TARGET_PERSONAS = [
  "platformAdmin",
  "tenantAdmin",
  "manager",
  "employee",
  "outsider",
  "custodian",
] as const;

for (const key of TARGET_PERSONAS) {
  const persona = PERSONAS[key];
  setup(`authenticate as ${key}`, async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 60_000 });
    // Wait for hydration: the React submit handler must be bound before we click, otherwise the
    // native form GET submission fires and leaks credentials into the URL (observed when this wait
    // was shortened). networkidle (the idle HMR websocket does NOT count as in-flight) reliably
    // marks chunks-loaded + React-bound; a generous timeout absorbs cold dev compile.
    await page.waitForLoadState("networkidle", { timeout: 60_000 });
    await page.getByTestId("login-submit").waitFor({ state: "visible", timeout: 30_000 });
    await fillLoginForm(page, persona.email, TEST_PASSWORD);
    await page.getByTestId("login-submit").click();
    // S983 WS-E: under the live mandatory policy the submit lands on the TOTP
    // step — complete it with the fixture secret; pre-flip this is a no-op.
    await completeMfaIfChallenged(page, persona.email);
    await page.waitForURL(`**${persona.expectedLandingPath}`, { timeout: 45_000 });
    // D-25 pre-run baseline restore: a previous run that crashed mid-suite can
    // leave a stale server-side locale='en' (i18n-en / me-preferences restore
    // in-process — a worker kill skips it), failing every IT-asserting spec.
    // The setup project runs before every other project, so a locale-only
    // PATCH here re-baselines the whole suite. Partial update (COALESCE
    // server-side): theme/palette untouched. Reuses the session cookies just
    // obtained — zero extra login POSTs against the 10/5min rate limit.
    const csrf = (await page.context().cookies()).find((c) => c.name === "hrx_csrf")?.value;
    if (csrf) {
      try {
        const r = await page.request.patch(`${API_BASE}/v1/me/preferences`, {
          headers: { "x-csrf-token": csrf },
          data: { locale: "it" },
        });
        if (!r.ok()) {
          console.warn(`[auth.setup] locale baseline restore for ${key}: HTTP ${r.status()}`);
        }
      } catch (err) {
        console.warn(`[auth.setup] locale baseline restore skipped for ${key}: ${String(err)}`);
      }
    }
    await page.context().storageState({ path: `tests/.auth/${key}.json` });
  });
}
