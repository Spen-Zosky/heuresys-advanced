/**
 * apps/web/tests/e2e/learning-editing.spec.ts — il catalogo formativo si compila dall'interfaccia (#43, linea C2).
 *
 * `POST`/`PATCH`/`DELETE /v1/learning-modules` esistevano da MVP-1 senza che
 * alcuna pagina li chiamasse: inserire un corso a catalogo voleva dire aprire
 * il database.
 *
 * Tutto il percorso passa dall'INTERFACCIA e ogni verifica interroga l'API.
 * I moduli hanno una DELETE, quindi la prova ripulisce da sé e lo verifica.
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

test.describe("catalogo formativo — inserimento e correzione", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("inserisce un modulo, lo ritrova cercandolo, lo corregge e lo rimuove", async ({
    page,
    request,
  }) => {
    const cookie = await cookieHeader(page);
    const marca = Date.now();
    const codice = `E2E-LM-${marca}`;
    let moduleId: string | null = null;

    try {
      await gotoAuthenticated(page, "/learning");
      await expect(page.getByTestId("learning-page")).toBeVisible({
        timeout: 45_000,
      });
      await expect(page.getByTestId("learning-creator")).toBeVisible();

      // --- inserimento dall'interfaccia ---
      await page.getByTestId("learning-create-toggle").click();
      await page.getByTestId("learning-create-code").fill(codice);
      await page
        .getByTestId("learning-create-title")
        .fill(`Corso di collaudo ${marca}`);
      await page.getByTestId("learning-create-duration").fill("90");
      await page.getByTestId("learning-create-kind").selectOption("WORKSHOP");
      await page
        .getByTestId("learning-create-delivery")
        .selectOption("INSTRUCTOR_LED");
      const [post] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes("/v1/learning-modules") &&
            r.request().method() === "POST",
        ),
        page.getByTestId("learning-create-submit").click(),
      ]);
      expect(post.status(), "inserimento modulo non accettato").toBe(201);
      const creato = (await post.json()) as {
        learningModuleId: string;
        kind: string;
        delivery: string;
        durationMinutes: number | null;
      };
      moduleId = creato.learningModuleId;
      // i valori scelti sono arrivati davvero, non i predefiniti…
      expect(creato.kind, "il tipo scelto non è stato salvato").toBe(
        "WORKSHOP",
      );
      expect(creato.delivery, "l'erogazione scelta non è stata salvata").toBe(
        "INSTRUCTOR_LED",
      );
      // …e la durata è un NUMERO, non la stringa del campo
      expect(
        creato.durationMinutes,
        "la durata non è arrivata come numero",
      ).toBe(90);

      // --- lo si ritrova cercandolo ---
      await page.getByTestId("learning-search").fill(codice);
      const pulsante = page.getByTestId(`learning-edit-${codice}`);
      await expect(
        pulsante,
        "la ricerca non ha trovato il modulo appena inserito",
      ).toBeVisible({
        timeout: 30_000,
      });

      // --- correzione dall'interfaccia ---
      await pulsante.click();
      await expect(page.getByTestId("learning-editor")).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByTestId("learning-edit-code")).toBeDisabled();
      await expect(page.getByTestId("learning-edit-kind")).toHaveValue(
        "WORKSHOP",
      );
      await expect(page.getByTestId("learning-edit-duration")).toHaveValue(
        "90",
      );

      const nuovoTitolo = `Corso corretto ${marca}`;
      await page.getByTestId("learning-edit-title").fill(nuovoTitolo);
      await page.getByTestId("learning-edit-duration").fill("120");
      const [patch] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes(`/v1/learning-modules/${moduleId}`) &&
            r.request().method() === "PATCH",
        ),
        page.getByTestId("learning-edit-save").click(),
      ]);
      expect(
        patch.status(),
        "la correzione non è stata accettata dall'API",
      ).toBe(200);

      // PROVA VERA: titolo e durata nuovi sono nel database
      const dopo = await request.get(
        `${API_BASE}/v1/learning-modules/${moduleId}`,
        { headers: { cookie } },
      );
      const letto = (await dopo.json()) as {
        title: string;
        durationMinutes: number | null;
      };
      expect(
        letto.title,
        "la correzione del titolo non è arrivata al database",
      ).toBe(nuovoTitolo);
      expect(
        letto.durationMinutes,
        "la correzione della durata non è arrivata al database",
      ).toBe(120);
    } finally {
      if (moduleId) {
        const del = await request.delete(
          `${API_BASE}/v1/learning-modules/${moduleId}`,
          {
            headers: await deleteHeaders(page),
          },
        );
        expect(
          del.status(),
          `pulizia non riuscita (HTTP ${del.status()})`,
        ).toBe(204);
      }
    }
  });
});
