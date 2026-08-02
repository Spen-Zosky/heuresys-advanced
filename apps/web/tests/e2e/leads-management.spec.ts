/**
 * apps/web/tests/e2e/leads-management.spec.ts — #4 GTM W4.
 *
 * LIVE-DATA-E2E-ONLY: il PLATFORM_ADMIN apre `/leads` e lavora le richieste di contatto
 * arrivate davvero dal sito pubblico (`sys_leads`).
 *
 * La prova che conta non è «la tabella si disegna» ma che il cambio di stato **persista**:
 * una `select` che aggiorna solo lo stato del componente e non il database è indistinguibile
 * da una che funziona, finché qualcuno non ricarica la pagina. Qui si ricarica.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor, PERSONAS, API_BASE, passwordFor, totpFor } from "./fixtures";

test.use({ storageState: storageStateFor("platformAdmin") });
test.describe.configure({ retries: 1 });

interface Lead { leadId: string; name: string; status: string }

/** Le richieste come le vede l'API: la pagina si confronta con queste, non con letterali. */
async function fetchLeads(request: import("@playwright/test").APIRequestContext, status?: string) {
  const email = PERSONAS.platformAdmin.email;
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
  const api = await request.get(`${API_BASE}/v1/leads${status ? `?status=${status}` : ""}`);
  expect(api.status()).toBe(200);
  return (await api.json()) as { items: Lead[]; total: number };
}

test.describe("#4 W4 — gestione delle richieste di contatto", () => {
  test("l'amministratore vede le richieste realmente arrivate", async ({ page, request }) => {
    const api = await fetchLeads(request);
    test.skip(api.total === 0, "nessuna richiesta di contatto nel database");

    await page.goto("/leads", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("leads-title")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("leads-count")).toContainText(String(api.total));
    await expect(page.getByTestId("lead-row")).toHaveCount(api.total);
  });

  test("il filtro per stato restringe l'elenco a quello che l'API conta", async ({ page, request }) => {
    const all = await fetchLeads(request);
    test.skip(all.total === 0, "nessuna richiesta di contatto nel database");
    // Lo stato su cui filtrare si sceglie dai dati veri, non si scrive nel test.
    const target = all.items[0]!.status;
    const filtered = await fetchLeads(request, target);

    await page.goto("/leads", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("lead-row").first()).toBeVisible({ timeout: 45_000 });

    await page.getByTestId("leads-filter").selectOption(target);
    await expect(page.getByTestId("lead-row")).toHaveCount(filtered.total, { timeout: 20_000 });
    expect(filtered.total).toBeLessThanOrEqual(all.total);
  });

  test("il cambio di stato persiste: sopravvive a un ricaricamento", async ({ page, request }) => {
    const api = await fetchLeads(request);
    test.skip(api.total === 0, "nessuna richiesta di contatto nel database");

    const lead = api.items[0]!;
    const ORDER = ["NEW", "CONTACTED", "QUALIFIED", "CLOSED"];
    const next = ORDER.find((s) => s !== lead.status)!;

    await page.goto("/leads", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const row = page.getByTestId("lead-row").filter({ hasText: lead.name }).first();
    await expect(row).toBeVisible({ timeout: 45_000 });
    await row.getByTestId("lead-status-select").selectOption(next);

    // Ricarica: se la select avesse cambiato solo lo stato del componente, qui tornerebbe
    // il valore di prima — è esattamente il difetto che questo test esiste per prendere.
    await page.reload({ waitUntil: "domcontentloaded" });
    const reloaded = page.getByTestId("lead-row").filter({ hasText: lead.name }).first();
    await expect(reloaded).toBeVisible({ timeout: 45_000 });
    await expect(reloaded.getByTestId(`lead-status-${next}`)).toBeVisible({ timeout: 20_000 });

    // E l'API — la fonte, non la pagina — riporta il nuovo stato.
    const after = await fetchLeads(request);
    expect(after.items.find((l) => l.leadId === lead.leadId)?.status).toBe(next);

    // Ripristino: la richiesta di contatto è un dato reale, non una fixture di prova.
    await page.getByTestId("lead-row").filter({ hasText: lead.name }).first()
      .getByTestId("lead-status-select").selectOption(lead.status);
    await expect
      .poll(async () => (await fetchLeads(request)).items.find((l) => l.leadId === lead.leadId)?.status, {
        timeout: 20_000,
      })
      .toBe(lead.status);
  });
});

test.describe("#4 W4 — le richieste di contatto sono riservate", () => {
  test.use({ storageState: storageStateFor("employee") });

  test("un dipendente non vede le richieste di contatto", async ({ page }) => {
    await page.goto("/leads", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("lead-row")).toHaveCount(0);
  });
});
