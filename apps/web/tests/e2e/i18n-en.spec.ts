/**
 * apps/web/tests/e2e/i18n-en.spec.ts
 *
 * i18n EN gate (milestone Fasi 0b–5 close). The UI language is a SERVER-stored
 * per-user preference (sys_user_preferences.locale, i18n Fase 0b): the authenticated
 * layout's <PreferencesApplier/> applies it on every session, overriding the cookie.
 * So to drive EN we set platformAdmin's stored locale to "en" via the real API, then
 * assert that one representative chrome string per namespace renders in English (a value
 * that DIFFERS from its Italian source — proving the locale actually switches, not just
 * that the EN keys exist). The original locale is restored in afterAll so the byte-identical
 * IT assertions in every other spec stay valid.
 *
 * Default locale is IT; this is the ONLY spec that drives EN.
 * Persona: platformAdmin (all permissions → every route reachable).
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { storageStateFor, PERSONAS, TEST_PASSWORD } from "./fixtures";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${process.env.PLAYWRIGHT_WEB_PORT ?? "3000"}`;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

async function loginCsrf(request: APIRequestContext): Promise<string> {
  const r = await request.post(`${API_BASE}/v1/auth/login`, {
    data: { email: PERSONAS.platformAdmin.email, password: TEST_PASSWORD },
  });
  expect(r.ok(), "API login platformAdmin").toBeTruthy();
  return (await r.json()).csrfToken as string;
}

async function setServerLocale(request: APIRequestContext, csrf: string, locale: string | null) {
  const r = await request.patch(`${API_BASE}/v1/me/preferences`, {
    headers: { "x-csrf-token": csrf },
    data: { locale },
  });
  expect(r.ok(), `PATCH locale=${String(locale)}`).toBeTruthy();
}

test.use({ storageState: storageStateFor("platformAdmin") });

let originalLocale: string | null = null;

test.beforeAll(async ({ request }) => {
  const csrf = await loginCsrf(request);
  const cur = await request.get(`${API_BASE}/v1/me/preferences`);
  if (cur.ok()) originalLocale = ((await cur.json()).locale as string | null) ?? null;
  await setServerLocale(request, csrf, "en");
});

test.afterAll(async ({ request }) => {
  const csrf = await loginCsrf(request);
  await setServerLocale(request, csrf, originalLocale);
});

test.beforeEach(async ({ context }) => {
  // First-paint EN (detectLocale reads NEXT_LOCALE); PreferencesApplier then confirms en from the server.
  await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: BASE_URL }]);
});

/** ns → representative page + an EN chrome string that is NOT equal to its IT source. */
const CASES = [
  { ns: "shell", path: "/dashboard", en: "Sign out" }, // IT: "Esci"
  { ns: "admin", path: "/users", en: "Tenant users with status and type." }, // IT differs
  {
    ns: "hr",
    path: "/skills",
    en: "Skills visible in the catalogue, both global and tenant-scoped.",
  },
  { ns: "blueprints", path: "/blueprints", en: "Blueprint variants with family and industry." },
  { ns: "ess", path: "/me", en: "My area" }, // IT: "Area personale"
  {
    ns: "analytics",
    path: "/analytics/workforce",
    en: "Headcount distribution by organizational unit and role within your scope.",
  },
] as const;

test.describe("i18n EN gate — server locale=en flips the chrome to English", () => {
  for (const c of CASES) {
    test(`${c.ns}: English chrome on ${c.path}`, async ({ page }) => {
      await page.goto(c.path, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await expect(page.getByText(c.en, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    });
  }

  // WCAG 3.1.1 (Language of Page): the SSR <html lang> must reflect the active locale
  // (NEXT_LOCALE cookie), not the hardcoded "it". With the en cookie set, lang must be "en".
  test("WCAG 3.1.1: <html lang> reflects the EN locale", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
