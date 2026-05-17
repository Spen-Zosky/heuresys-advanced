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
    await page.goto("/login");
    // Wait for hydration: the React submit handler must be bound before we click,
    // otherwise the native form GET submission fires and leaks credentials into
    // the URL. waitForLoadState("networkidle") gives Next.js time to load chunks
    // and React time to attach event handlers.
    await page.waitForLoadState("networkidle");
    await page.getByTestId("login-submit").waitFor({ state: "visible" });
    await fillLoginForm(page, persona.email, "Admin#PassW0rd!");
    await page.getByTestId("login-submit").click();
    await page.waitForURL(`**${persona.expectedLandingPath}`);
    await page.context().storageState({ path: `tests/.auth/${key}.json` });
  });
}
