/**
 * apps/web/tests/e2e/skill-taxonomy.spec.ts — l'ossatura del catalogo competenze si governa dall'interfaccia (#43, linea C2).
 *
 * `skill-families`, `skill-categories` e `skill-proficiency-levels` avevano
 * endpoint completi e NESSUNA interfaccia: la struttura sotto le 14.000
 * competenze si cambiava solo da database.
 *
 * Due prove:
 *  1. **cancello di esposizione** — la voce dev'essere nel registro del menù
 *     (guidato dal database): una rotta che risponde ma non è nel registro non
 *     la raggiunge nessuno. Senza questo controllo la migrazione `000220`
 *     potrebbe sparire e i test resterebbero verdi;
 *  2. **ciclo dati** — crea una famiglia, ci crea dentro una categoria,
 *     rinomina la famiglia e verifica ogni passo sull'API.
 *
 * Pulizia nell'ordine imposto dai vincoli: prima la categoria, poi la famiglia
 * (una famiglia con categorie dentro non si cancella). Entrambe verificate.
 */

import { test, expect, type Page } from "@playwright/test";
import { storageStateFor, gotoAuthenticated, API_BASE } from "./fixtures";

test.describe.configure({ retries: 1 });

async function cookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** Cookie + CSRF senza content-type: la DELETE non ha corpo. */
async function deleteHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  return {
    cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    "x-csrf-token": cookies.find((c) => c.name === "hrx_csrf")?.value ?? "",
  };
}

test.describe("tassonomia competenze", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("la voce è nel registro del menù, non solo una rotta che esiste", async ({ page, request }) => {
    const cookie = await cookieHeader(page);

    const res = await request.get(`${API_BASE}/v1/me/interfaces`, { headers: { cookie } });
    expect(res.ok(), "registro interfacce non raggiungibile").toBeTruthy();
    const body = (await res.json()) as {
      perspectives: Array<{ interfaces: Array<{ route: string }> }>;
    };
    const voce = body.perspectives.flatMap((p) => p.interfaces).find((i) => i.route === "/skill-taxonomy");
    expect(voce, "/skill-taxonomy non è nel registro del menù: nessuno può raggiungerla").toBeTruthy();

    await gotoAuthenticated(page, "/skill-taxonomy");
    await expect(page.getByTestId("skill-taxonomy-page")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("skill-families-panel")).toBeVisible();
    await expect(page.getByTestId("skill-categories-panel")).toBeVisible();
    await expect(page.getByTestId("proficiency-levels-panel")).toBeVisible();

    // i livelli di padronanza sono un riferimento REALE, non una tabella vuota
    await expect(page.getByTestId("proficiency-level-row").first()).toBeVisible({ timeout: 20_000 });
  });

  test("crea una famiglia, una categoria dentro di essa, rinomina e ripulisce", async ({ page, request }) => {
    const cookie = await cookieHeader(page);
    const marca = Date.now();
    const codFam = `E2E-SF-${marca}`;
    const codCat = `E2E-SC-${marca}`;
    let famigliaId: string | null = null;
    let categoriaId: string | null = null;

    try {
      await gotoAuthenticated(page, "/skill-taxonomy");
      await expect(page.getByTestId("skill-taxonomy-page")).toBeVisible({ timeout: 45_000 });

      // --- famiglia ---
      await page.getByTestId("family-create-toggle").click();
      await page.getByTestId("family-create-code").fill(codFam);
      await page.getByTestId("family-create-name").fill(`Famiglia di collaudo ${marca}`);
      const [postFam] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/v1/skill-families") && r.request().method() === "POST"),
        page.getByTestId("family-create-submit").click(),
      ]);
      expect(postFam.status(), "creazione famiglia non accettata").toBe(201);
      famigliaId = ((await postFam.json()) as { skillFamilyId: string }).skillFamilyId;

      // --- categoria DENTRO quella famiglia ---
      await page.getByTestId("category-create-toggle").click();
      await page.getByTestId("category-create-code").fill(codCat);
      await page.getByTestId("category-create-name").fill(`Categoria di collaudo ${marca}`);
      // La famiglia appena creata deve comparire fra le opzioni del pannello
      // categorie: i due pannelli condividono l'elenco e si rinfrescano insieme.
      // E' un'attesa esplicita su una proprieta' vera, non un ritardo di comodo.
      await expect(
        page.getByTestId("category-create-family").locator(`option[value="${famigliaId}"]`),
        "la famiglia appena creata non compare fra le opzioni delle categorie",
      ).toHaveCount(1, { timeout: 30_000 });
      await page.getByTestId("category-create-family").selectOption(famigliaId);
      const [postCat] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/v1/skill-categories") && r.request().method() === "POST"),
        page.getByTestId("category-create-submit").click(),
      ]);
      expect(postCat.status(), "creazione categoria non accettata").toBe(201);
      const categoria = (await postCat.json()) as { skillCategoryId: string; familyId: string };
      categoriaId = categoria.skillCategoryId;

      // PROVA VERA #1: la categoria è legata alla famiglia scelta
      expect(categoria.familyId, "la categoria non è legata alla famiglia scelta").toBe(famigliaId);

      // --- rinomina della famiglia dall'interfaccia ---
      await page.reload({ waitUntil: "domcontentloaded" });
      // 77 famiglie impaginate a 25: senza cercare, quella appena creata non e'
      // sulla prima pagina. La ricerca e' lato server.
      await page.getByTestId("family-search").fill(codFam);
      await expect(page.getByTestId(`family-edit-${codFam}`)).toBeVisible({ timeout: 30_000 });
      await page.getByTestId(`family-edit-${codFam}`).click();
      await expect(page.getByTestId("family-edit-form")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("family-edit-code")).toBeDisabled();
      const nuovoNome = `Famiglia rinominata ${marca}`;
      await page.getByTestId("family-edit-name").fill(nuovoNome);
      const [patch] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes(`/v1/skill-families/${famigliaId}`) && r.request().method() === "PATCH",
        ),
        page.getByTestId("family-edit-save").click(),
      ]);
      expect(patch.status(), "rinomina non accettata").toBe(200);

      // PROVA VERA #2: il nome nuovo è nel database
      const dopo = await request.get(`${API_BASE}/v1/skill-families/${famigliaId}`, { headers: { cookie } });
      expect((await dopo.json()).name, "la rinomina non è arrivata al database").toBe(nuovoNome);
    } finally {
      // Ordine imposto dai vincoli: prima la categoria, poi la famiglia.
      if (categoriaId) {
        const delCat = await request.delete(`${API_BASE}/v1/skill-categories/${categoriaId}`, {
          headers: await deleteHeaders(page),
        });
        expect(delCat.status(), `pulizia categoria non riuscita (HTTP ${delCat.status()})`).toBe(204);
      }
      if (famigliaId) {
        const delFam = await request.delete(`${API_BASE}/v1/skill-families/${famigliaId}`, {
          headers: await deleteHeaders(page),
        });
        expect(delFam.status(), `pulizia famiglia non riuscita (HTTP ${delFam.status()})`).toBe(204);
      }
    }
  });
});
