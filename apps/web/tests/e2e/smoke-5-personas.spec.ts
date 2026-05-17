/**
 * apps/web/tests/e2e/smoke-5-personas.spec.ts
 *
 * Acceptance MVP-2a #6 — smoke test 5 personas.
 *
 * Per ognuna delle 5 personas seedate da db/scripts/seed-test-admin.ts:
 *   1. login → landing redirect attesa (/dashboard o /me)
 *   2. nav role-gated rispettata (admin nav per i 3 admin, "My HR" sempre)
 *   3. naviga 2 pagine extra senza errore
 *
 * Tutte le rotte sono live: API reale, DB OCI VM via tunnel :5433. Le credenziali
 * vengono dai PERSONAS in fixtures.ts; lo storageState è generato da auth.setup.ts.
 */

import { test, expect, type Page } from "@playwright/test";
import { storageStateFor, type PersonaKey } from "./fixtures";

// Dev-mode runtime (Next.js compile-on-demand, Tailwind 4 JIT, no warm cache)
// can spike past the 30s default test timeout when the smoke walks through
// 3-4 cold routes in a row. Allow one retry per test (the second run hits
// warm chunks) and bump per-test timeout to 90s.
test.describe.configure({ retries: 1, timeout: 90_000 });

type Persona = {
  key: PersonaKey;
  landing: string;
  expectAdminNav: boolean;
  extraPages: [string, string];
};

const PERSONAS: Persona[] = [
  {
    key: "platformAdmin",
    landing: "/dashboard",
    expectAdminNav: true,
    extraPages: ["/tenants", "/admin/roles"],
  },
  {
    key: "tenantAdmin",
    landing: "/dashboard",
    expectAdminNav: true,
    extraPages: ["/users", "/positions"],
  },
  {
    key: "manager",
    landing: "/dashboard",
    expectAdminNav: true,
    extraPages: ["/gaps", "/me"],
  },
  {
    key: "employee",
    landing: "/me",
    expectAdminNav: false,
    extraPages: ["/me/profile", "/me/learning/catalogue"],
  },
  {
    key: "outsider",
    landing: "/me",
    expectAdminNav: false,
    extraPages: ["/me/inbox", "/me/career"],
  },
];

async function assertNoCrash(page: Page, route: string) {
  await page.goto(route);
  // page must not redirect to /login (lost-cookie or middleware failure)
  expect(page.url()).not.toContain("/login");
  // body must render — wait for body to have content
  await expect(page.locator("body")).not.toBeEmpty({ timeout: 10_000 });
}

for (const persona of PERSONAS) {
  test.describe(`smoke ${persona.key}`, () => {
    test.use({ storageState: storageStateFor(persona.key) });

    test(`landing on ${persona.landing} + nav + 2 extra pages`, async ({ page }) => {
      // 1. Landing
      await page.goto(persona.landing);
      await expect(page).toHaveURL(new RegExp(`${persona.landing}$`));

      // 2. Nav role-gated
      await expect(page.getByTestId("nav-me")).toBeVisible({ timeout: 15_000 });
      if (persona.expectAdminNav) {
        await expect(page.getByTestId("nav-dashboard")).toBeVisible();
      } else {
        // Pure USER must NOT see admin links.
        await expect(page.getByTestId("nav-dashboard")).toHaveCount(0);
        await expect(page.getByTestId("nav-users")).toHaveCount(0);
      }

      // 3. Extra pages
      for (const route of persona.extraPages) {
        await assertNoCrash(page, route);
      }
    });
  });
}
