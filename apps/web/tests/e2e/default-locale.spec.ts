/**
 * apps/web/tests/e2e/default-locale.spec.ts — regressione lingua di DEFAULT (S1025).
 *
 * Requisito Enzo (F4 P2): per default l'applicazione DEVE essere in italiano —
 * un visitatore nuovo (nessun cookie NEXT_LOCALE, nessuna preferenza server)
 * vede l'italiano su pubbliche e login, e nessun fallback EN deve trapelare.
 * La scelta EN resta disponibile SOLO come toggle esplicito (header, S1009).
 *
 * Gira nella suite normale (nessun gate env): è una rete di regressione, non
 * un census. Contesto VERGINE per test (niente storageState).
 */

import { test, expect } from "@playwright/test";

// contesto pulito: nessuna sessione, nessun cookie di locale
test.use({ storageState: { cookies: [], origins: [] } });

const PUBLIC_ROUTES = ["/", "/login", "/demo", "/investors", "/privacy"];

for (const route of PUBLIC_ROUTES) {
  test(`default IT: ${route} serve lang="it" a un visitatore senza cookie`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page
      .waitForFunction(() => document.documentElement.getAttribute("lang") != null, undefined, { timeout: 10_000 })
      .catch(() => {});
    expect(await page.evaluate(() => document.documentElement.getAttribute("lang"))).toBe("it");
  });
}

test('default IT: /login mostra copy italiana (non il fallback EN)', async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const text = await page.evaluate(() => document.body?.innerText ?? "");
  // parole-sentinella della copy IT del form di login; il gemello EN ("Sign in",
  // "Password required", …) non deve comparire su un contesto vergine.
  expect(text.length).toBeGreaterThan(50);
  expect(/Accedi|Email|Password/.test(text)).toBe(true);
  expect(text.includes("Sign in")).toBe(false);
});
