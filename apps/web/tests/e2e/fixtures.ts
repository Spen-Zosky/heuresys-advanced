/**
 * apps/web/tests/e2e/fixtures.ts
 *
 * Shared Playwright helpers + seeded persona credentials.
 * Personas come from db/scripts/seed-test-admin.ts.
 */

import path from "node:path";
import type { Page } from "@playwright/test";

export const TEST_PASSWORD = "Admin#PassW0rd!";

/**
 * Resolves the persisted Playwright storageState file produced by
 * tests/e2e/auth.setup.ts. Use as `storageState: storageStateFor("employee")`
 * inside a test.use(...) block.
 */
export function storageStateFor(persona: PersonaKey): string {
  return path.join("tests", ".auth", `${persona}.json`);
}

export const PERSONAS = {
  platformAdmin: {
    email: "admin@heuresys.com",
    expectedLandingPath: "/dashboard",
  },
  tenantAdmin: {
    email: "federica.marchetti@rtl-bank.org",
    expectedLandingPath: "/dashboard",
  },
  manager: {
    email: "paolo.caputo@rtl-bank.org",
    expectedLandingPath: "/dashboard",
  },
  employee: {
    email: "tommaso.fiore@rtl-bank.org",
    expectedLandingPath: "/me",
  },
  outsider: {
    email: "antonio.parisi@rtl-bank.org",
    expectedLandingPath: "/me",
  },
} as const satisfies Record<string, { email: string; expectedLandingPath: string }>;

export type PersonaKey = keyof typeof PERSONAS;

export async function fillLoginForm(page: Page, email: string, password: string) {
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
}

export async function loginAs(page: Page, persona: PersonaKey) {
  const { email, expectedLandingPath } = PERSONAS[persona];
  await page.goto("/login");
  await fillLoginForm(page, email, TEST_PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(`**${expectedLandingPath}`);
}

/**
 * Robust navigation to an authenticated route. `next dev` compiles routes on first hit (cold
 * compile can exceed the default 30s) and its HMR websocket keeps the network busy so
 * `waitUntil:"load"` / `networkidle` are unreliable. Instead we wait for `domcontentloaded` with
 * head-room, then for the always-present ESS "My HR" nav link (proves the authenticated shell
 * actually rendered, not the /login redirect). Best-practice: wait for an element, not the network.
 */
export async function gotoAuthenticated(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByTestId("nav-me").waitFor({ state: "visible", timeout: 45_000 });
}
