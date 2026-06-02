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
import { fillLoginForm, PERSONAS } from "./fixtures";

const TARGET_PERSONAS = [
  "platformAdmin",
  "tenantAdmin",
  "manager",
  "employee",
  "outsider",
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
    await fillLoginForm(page, persona.email, "Admin#PassW0rd!");
    await page.getByTestId("login-submit").click();
    await page.waitForURL(`**${persona.expectedLandingPath}`, { timeout: 45_000 });
    await page.context().storageState({ path: `tests/.auth/${key}.json` });
  });
}
