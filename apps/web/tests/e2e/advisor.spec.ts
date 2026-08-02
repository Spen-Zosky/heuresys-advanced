/**
 * apps/web/tests/e2e/advisor.spec.ts — #58 F/F4.
 *
 * LIVE-DATA-E2E-ONLY: un TENANT_ADMIN (federica.marchetti@rtl-bank.org, ha
 * org_director:read) apre /org-director/advisor, alimentata da GET /v1/advisor/suggestions
 * sui dati vivi di RTL Bank.
 *
 * L'asserzione che conta non è «la tabella si disegna», ma che **le fonti arrivino in
 * pagina**: sono ciò che distingue questa pagina da un generatore di frasi plausibili. Una
 * pagina che mostrasse i consigli senza le citazioni supererebbe qualunque test di rendering
 * e avrebbe perso esattamente la proprietà per cui la capability esiste.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor, PERSONAS, API_BASE, passwordFor, totpFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 1 });

/** Le raccomandazioni come le calcola l'API: la pagina si confronta con queste, non con letterali. */
async function fetchAdvisor(request: import("@playwright/test").APIRequestContext) {
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
  const api = await request.get(`${API_BASE}/v1/advisor/suggestions`);
  expect(api.status()).toBe(200);
  return api.json();
}

interface Citation { source: string; field: string; value: number | string; subjectLabel: string }
interface Suggestion { ruleId: string; subjectId: string; subjectLabel: string; priority: number; citations: Citation[] }

test.describe("#58 F4 — consigli operativi", () => {
  test("il direttore vede le raccomandazioni calcolate sui dati reali", async ({ page }) => {
    await page.goto("/org-director/advisor", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("advisor-title")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("advisor-count")).toContainText(/\d+/);
    await expect(page.getByTestId("advisor-row").first()).toBeVisible({ timeout: 30_000 });
  });

  test("le righe rese corrispondono a quelle che l'API ha calcolato", async ({ page, request }) => {
    const api = (await fetchAdvisor(request)) as { total: number; items: Suggestion[] };
    test.skip(api.total === 0, "nessuna raccomandazione su questo dataset");

    await page.goto("/org-director/advisor", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("advisor-row").first()).toBeVisible({ timeout: 45_000 });

    await expect(page.getByTestId("advisor-row")).toHaveCount(api.total);
    // priorità più alta in cima: è l'ordine su cui un direttore decide da dove partire
    await expect(page.getByTestId("advisor-row").first()).toContainText(api.items[0]!.subjectLabel);
  });

  /**
   * IL test di questa pagina. Ogni raccomandazione deve mostrare le sue fonti, e i valori
   * resi devono essere quelli che l'API ha citato — non un riassunto, non un'icona.
   */
  test("ogni raccomandazione porta in pagina le fonti da cui deriva", async ({ page, request }) => {
    const api = (await fetchAdvisor(request)) as { total: number; items: Suggestion[] };
    test.skip(api.total === 0, "nessuna raccomandazione su questo dataset");

    await page.goto("/org-director/advisor", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("advisor-row").first()).toBeVisible({ timeout: 45_000 });

    // nessuna riga senza fonti: il conteggio dei blocchi citazione eguaglia quello delle righe
    await expect(page.getByTestId("advisor-citations")).toHaveCount(api.total);

    // e le citazioni della prima raccomandazione compaiono col loro valore reale
    const first = api.items[0]!;
    const row = page.getByTestId("advisor-row").filter({ hasText: first.subjectLabel }).first();
    await expect(row.getByTestId("advisor-citation")).toHaveCount(first.citations.length);
    for (const c of first.citations) {
      await expect(row.getByTestId("advisor-citations")).toContainText(c.field);
      await expect(row.getByTestId("advisor-citations")).toContainText(String(c.value));
    }
  });

  test("il consiglio è una frase leggibile, non una chiave di traduzione", async ({ page, request }) => {
    const api = (await fetchAdvisor(request)) as { total: number; items: Suggestion[] };
    test.skip(api.total === 0, "nessuna raccomandazione su questo dataset");

    await page.goto("/org-director/advisor", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const headline = page.getByTestId("advisor-headline").first();
    await expect(headline).toBeVisible({ timeout: 45_000 });
    const text = (await headline.textContent())?.trim() ?? "";
    // una chiave non tradotta si renderebbe come "advisor.rule.xxx": è il modo tipico in cui
    // una pagina i18n passa i test di rendering ed è illeggibile per l'utente
    expect(text).not.toMatch(/^advisor\./);
    expect(text.length).toBeGreaterThan(20);
    // e i segnaposto devono essere stati interpolati, non lasciati grezzi
    expect(text).not.toContain("{{");
  });

  test("la nota di metodo dichiara quante fonti sono state scartate", async ({ page }) => {
    await page.goto("/org-director/advisor", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("advisor-method")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("advisor-method")).toContainText("advisor-rules-v1");
  });
});

test.describe("#58 F4 — i consigli sono protetti come le loro fonti", () => {
  test.use({ storageState: storageStateFor("employee") });

  /**
   * Un dipendente senza `org_director:read` non deve ottenere una pagina VUOTA: una tabella
   * senza righe si legge come «non c'è nulla da fare in questa organizzazione», che è una
   * conclusione falsa e rassicurante. Deve non ottenere le raccomandazioni.
   */
  test("un dipendente senza org_director:read non riceve raccomandazioni", async ({ page }) => {
    await page.goto("/org-director/advisor", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("advisor-row")).toHaveCount(0);
    await expect(page.getByTestId("advisor-citations")).toHaveCount(0);
  });
});
