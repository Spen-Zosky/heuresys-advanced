/**
 * apps/web/tests/e2e/skills-editing.spec.ts — il catalogo competenze si corregge dall'interfaccia (#43, linea C2).
 *
 * `POST` e `PATCH /v1/skills` esistevano da MVP-1 senza che alcuna pagina li
 * chiamasse: su un catalogo di ~14.000 voci, creare o correggere una
 * competenza voleva dire aprire il database.
 *
 * Il percorso è tutto dall'INTERFACCIA — creare, cercare, aprire il pannello,
 * rinominare — e la verifica è sull'API, che è l'unica autorità. Una prima
 * stesura rinominava via API "per comodità": non avrebbe provato nulla della
 * pagina, ed è stata rifatta.
 *
 * La riga di collaudo la rimuove il teardown comune: le competenze NON hanno
 * una DELETE sull'API (4 endpoint: elenco/dettaglio/creazione/modifica —
 * verificato sulle routes), quindi la pulizia non può stare qui.
 */

import { test, expect, type Page } from "@playwright/test";
import { storageStateFor, gotoAuthenticated, API_BASE } from "./fixtures";

test.describe.configure({ retries: 1 });

async function cookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

test.describe("catalogo competenze — creazione e correzione", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("crea una competenza, la ritrova cercandola, la rinomina e rilegge dal database", async ({ page, request }) => {
    const cookie = await cookieHeader(page);
    const marca = Date.now();
    const codice = `E2E-SKILL-${marca}`;

    await gotoAuthenticated(page, "/skills");
    await expect(page.getByTestId("skills-page")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("skill-creator")).toBeVisible();

    // --- creazione dall'interfaccia ---
    await page.getByTestId("skill-create-code").fill(codice);
    await page.getByTestId("skill-create-name").fill(`Competenza di collaudo ${marca}`);
    const [post] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/skills") && r.request().method() === "POST"),
      page.getByTestId("skill-create-submit").click(),
    ]);
    expect(post.status(), "creazione competenza non accettata").toBe(201);
    const creata = (await post.json()) as { skillId: string; code: string };
    expect(creata.code).toBe(codice);

    // --- la si ritrova cercandola: senza filtro sarebbe sepolta fra 14.000 voci ---
    await page.getByTestId("skills-search").fill(codice);
    const pulsante = page.getByTestId(`skill-edit-${codice}`);
    await expect(pulsante, "la ricerca non ha trovato la competenza appena creata").toBeVisible({
      timeout: 30_000,
    });

    // --- modifica dall'interfaccia ---
    await pulsante.click();
    await expect(page.getByTestId("skill-editor")).toBeVisible({ timeout: 30_000 });
    // il codice si vede ma non si tocca: l'API non lo accetta in modifica
    await expect(page.getByTestId("skill-edit-code")).toBeDisabled();
    // e il pannello porta il dato VERO, non un form vuoto
    await expect(page.getByTestId("skill-edit-name")).toHaveValue(`Competenza di collaudo ${marca}`);

    const nuovoNome = `Competenza rinominata ${marca}`;
    await page.getByTestId("skill-edit-name").fill(nuovoNome);
    const [patch] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/v1/skills/${creata.skillId}`) && r.request().method() === "PATCH",
      ),
      page.getByTestId("skill-edit-save").click(),
    ]);
    expect(patch.status(), "la modifica non è stata accettata dall'API").toBe(200);
    await expect(page.getByTestId("skill-edit-saved")).toBeVisible({ timeout: 15_000 });

    // PROVA VERA: il nome nuovo è nel database, non solo nel form
    const dopo = await request.get(`${API_BASE}/v1/skills/${creata.skillId}`, { headers: { cookie } });
    expect((await dopo.json()).name, "la rinomina non è arrivata al database").toBe(nuovoNome);
  });
});
