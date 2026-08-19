/**
 * apps/web/tests/e2e/org-health.spec.ts — #57 F/F3.
 *
 * LIVE-DATA-E2E-ONLY: a TENANT_ADMIN (federica.marchetti@rtl-bank.org, holds
 * org_director:read) opens /org-director/health, fed entirely by GET /v1/org-health over
 * live RTL Bank data — engagement, goals, flight risk, attendance, reviews, maturity.
 *
 * The assertion that matters is not "the table renders" but that BOTH readings reach the
 * page: the absolute band and the relative standing. On this dataset every unit is healthy
 * in absolute terms, so a page that dropped the standing would tell a director "nothing to
 * do anywhere" while the data clearly ranks one unit last.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor, PERSONAS, API_BASE, passwordFor, totpFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 1 });

/** The scorecard as the API computes it — the page is checked against this, not against literals. */
async function fetchHealth(request: import("@playwright/test").APIRequestContext) {
  const email = PERSONAS.tenantAdmin.email;
  let res = await request.post(`${API_BASE}/v1/auth/login`, {
    data: { email, password: passwordFor(email) },
  });
  let body = await res.json();
  if (body.status === "mfa_required") {
    res = await request.post(`${API_BASE}/v1/auth/login`, {
      data: { email, password: passwordFor(email), challengeToken: body.challengeToken, mfaCode: totpFor(email) },
    });
    body = await res.json();
  }
  expect(body.status).toBe("success");
  const api = await request.get(`${API_BASE}/v1/org-health`);
  expect(api.status()).toBe(200);
  return api.json();
}

test.describe("#57 F3 — organizational health", () => {
  test("TENANT_ADMIN sees every unit scored, with the organization index", async ({ page }) => {
    await page.goto("/org-director/health", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("org-health-title")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("org-health-count")).toContainText(/\d+/);
    await expect(page.getByTestId("org-health-org-index")).toContainText(/\d/);
    await expect(page.getByTestId("org-health-row").first()).toBeVisible({ timeout: 30_000 });
  });

  test("the rendered rows and counts match what the API computed", async ({ page, request }) => {
    const api = await fetchHealth(request);
    await page.goto("/org-director/health", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("org-health-row").first()).toBeVisible({ timeout: 45_000 });

    // ⚠ CORRETTO IL 2026-08-19 (#211 F3, famiglia ⑤ del triage). Diceva
    // `toHaveCount(api.total)`, e falliva con «expected 39, received 25». Non era un guasto
    // del prodotto e non era un dato cambiato: `DataTablePanel` **pagina a 25 righe** di
    // default, quindi l'asserzione era vera solo finche' le unita' misurate stavano sotto
    // quella soglia. Superata la soglia, il test accusava la pagina di non mostrare righe
    // che non deve mostrare.
    //
    // Ora il caso prova le DUE cose che contano davvero, e nessuna delle due scade con la
    // crescita del dato: la prima pagina e' piena fino alla soglia, e il conteggio dichiarato
    // riporta il totale VERO — che e' il modo in cui un lettore sa che ce ne sono altre.
    const PER_PAGINA = 25;
    await expect(page.getByTestId("org-health-row")).toHaveCount(Math.min(api.total, PER_PAGINA));
    await expect(page.getByTestId("org-health-count")).toContainText(String(api.total));
    for (const [status, count] of Object.entries(api.summary)) {
      await expect(page.getByTestId(`org-health-summary-${status}`)).toContainText(String(count));
    }
    // weakest first — the unit a director should look at opens the table
    await expect(page.getByTestId("org-health-row").first()).toContainText(api.units[0].orgUnitName);
  });

  test("BOTH readings reach the page: the absolute band and the relative standing", async ({ page, request }) => {
    const api = await fetchHealth(request);
    // ⚠ Stessa causa del caso sopra (#211 F3, famiglia ⑤): la pagina ne mostra 25, e cercare
    // una unita' che sta oltre la prima pagina significa cercarla dove non puo' essere. Le
    // due letture si verificano quindi su unita' VISIBILI — e l'ordine e' lo stesso dell'API
    // («weakest first»), quindi le prime 25 dell'una sono le prime 25 dell'altra.
    const visibili = api.units.slice(0, 25);
    const lagging = visibili.find((u: { standing: string }) => u.standing === "LAGGING");
    const leading = visibili.find((u: { standing: string }) => u.standing === "LEADING");
    test.skip(!lagging || !leading, "standings not populated on this dataset");

    await page.goto("/org-director/health", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("org-health-row").first()).toBeVisible({ timeout: 45_000 });

    // the lagging unit is marked as such even though its absolute band is healthy —
    // exactly the case the band alone cannot express
    const laggingRow = page.getByTestId("org-health-row").filter({ hasText: lagging.orgUnitName });
    await expect(laggingRow.getByTestId("org-health-standing-LAGGING")).toBeVisible();
    await expect(laggingRow.getByTestId(`org-health-status-${lagging.status}`)).toBeVisible();

    const leadingRow = page.getByTestId("org-health-row").filter({ hasText: leading.orgUnitName });
    await expect(leadingRow.getByTestId("org-health-standing-LEADING")).toBeVisible();

    // and the method note tells the reader the observed spread, so small gaps are not over-read
    await expect(page.getByTestId("org-health-method")).toContainText(/\d/);
  });

  test("a dimension without data shows as absent, not as a zero score", async ({ page, request }) => {
    const api = await fetchHealth(request);
    const withGap = api.units.find((u: { dimensions: Array<{ score: number | null }> }) =>
      u.dimensions.some((d) => d.score === null),
    );
    test.skip(!withGap, "every unit has every dimension on this dataset");
    // coverage must be below 100% for that unit — the page states the gap rather than hiding it
    expect(withGap.coverage).toBeLessThan(1);

    await page.goto("/org-director/health", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const row = page.getByTestId("org-health-row").filter({ hasText: withGap.orgUnitName });
    await expect(row).toBeVisible({ timeout: 45_000 });
    await expect(row).toContainText("—"); // the em-dash marks the missing dimension
    await expect(row).toContainText(`${Math.round(withGap.coverage * 100)}%`);
  });
});

test.describe("#57 F3 — organizational health is gated", () => {
  test.use({ storageState: storageStateFor("employee") });

  test("an employee without org_director:read cannot read the index", async ({ page }) => {
    await page.goto("/org-director/health", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("org-health-row")).toHaveCount(0);
    await expect(page.getByTestId("org-health-summary")).toHaveCount(0);
  });
});
