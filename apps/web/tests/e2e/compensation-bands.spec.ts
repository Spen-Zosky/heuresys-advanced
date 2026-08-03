/**
 * apps/web/tests/e2e/compensation-bands.spec.ts — #53 E4.
 *
 * LIVE-DATA-E2E-ONLY: le fasce retributive del tenant, lette da
 * `GET /v1/compensation/bands` sul database vivo.
 *
 * La prova che conta non è che la tabella si disegni: è che **nessuna fascia priva di
 * importi entri nel catalogo**. La tabella ne contiene 75, arrivate da un import che
 * portò le chiavi e non i dati; una riga così, in un catalogo retributivo, si legge come
 * «questa fascia esiste ma non so quanto vale» — peggio che non mostrarla.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor, PERSONAS, API_BASE, passwordFor, totpFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 1 });

interface Band { compensationBandId: string; name: string; code: string; minEur: string | null; midEur: string | null; maxEur: string | null }

async function fetchBands(request: import("@playwright/test").APIRequestContext) {
  const email = PERSONAS.tenantAdmin.email;
  let res = await request.post(`${API_BASE}/v1/auth/login`, { data: { email, password: passwordFor(email) } });
  let body = await res.json();
  if (body.status === "mfa_required") {
    res = await request.post(`${API_BASE}/v1/auth/login`, {
      data: { email, password: passwordFor(email), challengeToken: body.challengeToken, mfaCode: totpFor(email) },
    });
    body = await res.json();
  }
  expect(body.status).toBe("success");
  const api = await request.get(`${API_BASE}/v1/compensation/bands?limit=200`);
  expect(api.status()).toBe(200);
  return (await api.json()) as { items: Band[]; total: number; totalIncludingValueless: number };
}

test.describe("#53 E4 — catalogo delle fasce retributive", () => {
  test("la pagina mostra le fasce che l'API calcola", async ({ page, request }) => {
    const api = await fetchBands(request);
    test.skip(api.total === 0, "nessuna fascia con importi su questo tenant");

    await page.goto("/compensation-intelligence", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("compensation-bands")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("comp-band-row")).toHaveCount(api.total, { timeout: 30_000 });
  });

  test("nessuna riga senza importi entra nel catalogo", async ({ page, request }) => {
    const api = await fetchBands(request);
    test.skip(api.total === 0, "nessuna fascia con importi su questo tenant");

    // L'API non deve nemmeno proporle…
    for (const b of api.items) expect(b.midEur).not.toBeNull();

    // …e la pagina non deve mostrare il segnaposto al posto di un importo.
    await page.goto("/compensation-intelligence", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const prima = page.getByTestId("comp-band-row").first();
    await expect(prima).toBeVisible({ timeout: 45_000 });
    await expect(prima).not.toContainText("—");
  });

  test("le fasce importate dal legacy hanno nome leggibile, non il codice", async ({ page, request }) => {
    const api = await fetchBands(request);
    const legacy = api.items.filter((b) => b.code.startsWith("LEGACY_BAND::"));
    test.skip(legacy.length === 0, "nessuna fascia importata dal legacy su questo tenant");

    await page.goto("/compensation-intelligence", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("comp-band-row").first()).toBeVisible({ timeout: 45_000 });

    // Il difetto delle 87 righe preesistenti era esattamente questo: il nome ERA il
    // codice, e in pagina si sarebbe letto «OLDDB::ccnl_levels::<uuid>».
    const uno = legacy[0]!;
    expect(uno.name).not.toBe(uno.code);
    await expect(page.getByTestId("comp-band-row").filter({ hasText: uno.name }).first()).toBeVisible();
    await expect(page.getByTestId("compensation-bands")).not.toContainText("LEGACY_BAND::");
    await expect(page.getByTestId("compensation-bands")).not.toContainText("OLDDB::");
  });
});

test.describe("#53 E4 — le fasce sono un dato riservato", () => {
  test.use({ storageState: storageStateFor("employee") });

  test("un dipendente non vede il catalogo delle fasce", async ({ page }) => {
    await page.goto("/compensation-intelligence", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("comp-band-row")).toHaveCount(0);
  });
});
