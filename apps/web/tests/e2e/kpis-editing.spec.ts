/**
 * apps/web/tests/e2e/kpis-editing.spec.ts — il catalogo KPI si definisce e si corregge dall'interfaccia (#43, linea C2).
 *
 * `POST`/`PATCH`/`DELETE /v1/kpi-definitions` esistevano da MVP-1 senza che
 * alcuna pagina li chiamasse: un indicatore si definiva solo da database.
 *
 * Tutto il percorso passa dall'INTERFACCIA — definire, cercare, aprire il
 * pannello, correggere — e ogni verifica interroga l'API, che è l'autorità.
 *
 * A differenza di competenze e ruoli, i KPI HANNO una cancellazione sull'API:
 * la prova ripulisce da sé e lo verifica.
 */

import { test, expect, type Page } from "@playwright/test";
import { storageStateFor, gotoAuthenticated, API_BASE } from "./fixtures";

test.describe.configure({ retries: 1 });

async function cookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** Cookie + CSRF senza content-type: la DELETE non ha corpo (una content-type
 *  JSON su richiesta vuota fa rispondere 400 a Fastify — misurato). */
async function deleteHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  return {
    cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    "x-csrf-token": cookies.find((c) => c.name === "hrx_csrf")?.value ?? "",
  };
}

test.describe("catalogo KPI — definizione e correzione", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("definisce un indicatore, lo ritrova cercandolo, lo corregge e lo rimuove", async ({
    page,
    request,
  }) => {
    const cookie = await cookieHeader(page);
    const marca = Date.now();
    const codice = `E2E-KPI-${marca}`;
    let kpiId: string | null = null;

    try {
      await gotoAuthenticated(page, "/kpis");
      await expect(page.getByTestId("kpis-page")).toBeVisible({
        timeout: 45_000,
      });
      await expect(page.getByTestId("kpi-creator")).toBeVisible();

      // --- definizione dall'interfaccia ---
      await page.getByTestId("kpi-create-toggle").click();
      await page.getByTestId("kpi-create-code").fill(codice);
      await page
        .getByTestId("kpi-create-name")
        .fill(`Indicatore di collaudo ${marca}`);
      await page.getByTestId("kpi-create-unit").fill("%");
      await page
        .getByTestId("kpi-create-polarity")
        .selectOption("LOWER_IS_BETTER");
      const [post] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes("/v1/kpi-definitions") &&
            r.request().method() === "POST",
        ),
        page.getByTestId("kpi-create-submit").click(),
      ]);
      expect(post.status(), "definizione indicatore non accettata").toBe(201);
      const creato = (await post.json()) as {
        kpiDefinitionId: string;
        polarity: string;
        unit: string | null;
      };
      kpiId = creato.kpiDefinitionId;
      // i valori scelti nei menù sono arrivati davvero, non i predefiniti
      expect(creato.polarity, "la polarità scelta non è stata salvata").toBe(
        "LOWER_IS_BETTER",
      );
      expect(creato.unit).toBe("%");

      // --- lo si ritrova cercandolo ---
      await page.getByTestId("kpis-search").fill(codice);
      const pulsante = page.getByTestId(`kpi-edit-${codice}`);
      await expect(
        pulsante,
        "la ricerca non ha trovato l'indicatore appena definito",
      ).toBeVisible({
        timeout: 30_000,
      });

      // --- correzione dall'interfaccia ---
      await pulsante.click();
      await expect(page.getByTestId("kpi-editor")).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByTestId("kpi-edit-code")).toBeDisabled();
      await expect(page.getByTestId("kpi-edit-polarity")).toHaveValue(
        "LOWER_IS_BETTER",
      );

      const nuovoNome = `Indicatore corretto ${marca}`;
      await page.getByTestId("kpi-edit-name").fill(nuovoNome);
      await page.getByTestId("kpi-edit-unit").fill("giorni");
      const [patch] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes(`/v1/kpi-definitions/${kpiId}`) &&
            r.request().method() === "PATCH",
        ),
        page.getByTestId("kpi-edit-save").click(),
      ]);
      expect(
        patch.status(),
        "la correzione non è stata accettata dall'API",
      ).toBe(200);

      // PROVA VERA: nome e unità nuovi sono nel database
      const dopo = await request.get(
        `${API_BASE}/v1/kpi-definitions/${kpiId}`,
        { headers: { cookie } },
      );
      const letto = (await dopo.json()) as {
        name: string;
        unit: string | null;
      };
      expect(
        letto.name,
        "la correzione del nome non è arrivata al database",
      ).toBe(nuovoNome);
      expect(
        letto.unit,
        "la correzione dell'unità non è arrivata al database",
      ).toBe("giorni");
    } finally {
      // i KPI hanno una DELETE sull'API: la prova ripulisce e lo VERIFICA
      if (kpiId) {
        const del = await request.delete(
          `${API_BASE}/v1/kpi-definitions/${kpiId}`,
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
