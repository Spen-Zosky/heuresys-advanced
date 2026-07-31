/**
 * apps/web/tests/e2e/positions-editing.spec.ts — una posizione si ridisegna dall'interfaccia (#44, linea C1).
 *
 * `PATCH /v1/positions/:id` esisteva da MVP-1 senza che alcuna pagina lo
 * chiamasse. Questa prova percorre il ciclo vero: apre una posizione scelta
 * dall'elenco reale, ne cambia la criticità dal menù, e NON si dichiara verde
 * finché non ha riletto il valore dall'API e ricaricato la pagina.
 *
 * Verifica anche la promessa d'uso che distingue una console da un editor di
 * righe: i legami si scelgono PER NOME. Il menù delle unità organizzative deve
 * contenere il nome di un'unità vera — se tornasse a mostrare identificativi,
 * il confronto col nome preso dall'API fallisce.
 *
 * Scrittura reversibile: la criticità originale viene ripristinata in `finally`.
 */

import { test, expect, type Page } from "@playwright/test";
import { storageStateFor, gotoAuthenticated, API_BASE } from "./fixtures";

test.describe.configure({ retries: 1 });

async function cookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** Cookie + token CSRF: le rotte di mutazione montano `verifyCsrf`. */
async function writeHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  return {
    cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    "x-csrf-token": cookies.find((c) => c.name === "hrx_csrf")?.value ?? "",
    "content-type": "application/json",
  };
}

test.describe("posizione — si modifica dall'interfaccia", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("cambia la criticità, la rilegge dal database e la ripristina", async ({ page, request }) => {
    const cookie = await cookieHeader(page);

    // La posizione la sceglie l'elenco vero (regola no-hardcoded-test-data).
    const lista = await request.get(`${API_BASE}/v1/positions?limit=1`, { headers: { cookie } });
    expect(lista.ok(), "elenco posizioni non raggiungibile").toBeTruthy();
    const items = (await lista.json()).items as Array<{ positionId: string }>;
    expect(items.length, "nessuna posizione nel tenant").toBeGreaterThan(0);
    const positionId = items[0]!.positionId;

    const prima = await request.get(`${API_BASE}/v1/positions/${positionId}`, { headers: { cookie } });
    expect(prima.ok(), "posizione non leggibile").toBeTruthy();
    const originale = (await prima.json()) as { criticality: string | null };
    const nuova = originale.criticality === "MEDIUM" ? "LOW" : "MEDIUM";

    try {
      await gotoAuthenticated(page, `/positions/${positionId}`);
      await expect(page.getByTestId("position-detail-page")).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId("position-editor")).toBeVisible();
      await expect(page.getByTestId("position-edit-form")).toBeVisible();

      // il form arriva precompilato col valore reale
      await expect(page.getByTestId("position-edit-criticality")).toHaveValue(originale.criticality ?? "");

      await page.getByTestId("position-edit-criticality").selectOption(nuova);
      const [patch] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes(`/v1/positions/${positionId}`) && r.request().method() === "PATCH",
        ),
        page.getByTestId("position-edit-save").click(),
      ]);
      expect(patch.status(), "il salvataggio non è stato accettato dall'API").toBe(200);
      await expect(page.getByTestId("position-edit-saved")).toBeVisible({ timeout: 15_000 });

      // PROVA VERA #1: il database ha il valore nuovo
      const dopo = await request.get(`${API_BASE}/v1/positions/${positionId}`, { headers: { cookie } });
      expect((await dopo.json()).criticality, "la criticità non è stata scritta sul database").toBe(nuova);

      // PROVA VERA #2: ricaricando, la pagina mostra il valore nuovo
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("position-edit-criticality")).toHaveValue(nuova, { timeout: 30_000 });
    } finally {
      const ripristino = await request.patch(`${API_BASE}/v1/positions/${positionId}`, {
        headers: await writeHeaders(page),
        data: { criticality: originale.criticality },
      });
      expect(ripristino.ok(), "ripristino della criticità non riuscito").toBeTruthy();
    }
  });

  test("i legami si scelgono per nome, non per identificativo", async ({ page, request }) => {
    const cookie = await cookieHeader(page);

    const posRes = await request.get(`${API_BASE}/v1/positions?limit=1`, { headers: { cookie } });
    const positionId = ((await posRes.json()).items as Array<{ positionId: string }>)[0]!.positionId;

    // Il nome atteso viene dall'API, non da una costante: se il tenant cambia,
    // la prova resta valida.
    const ouRes = await request.get(`${API_BASE}/v1/organization-units?limit=1`, { headers: { cookie } });
    expect(ouRes.ok(), "elenco unità organizzative non raggiungibile").toBeTruthy();
    const ou = ((await ouRes.json()).items as Array<{ organizationUnitId: string; name: string }>)[0];
    expect(ou, "nessuna unità organizzativa nel tenant").toBeTruthy();

    await gotoAuthenticated(page, `/positions/${positionId}`);
    await expect(page.getByTestId("position-edit-orgunit")).toBeVisible({ timeout: 45_000 });

    // il menù porta il NOME dell'unità e non il suo identificativo
    const menu = page.getByTestId("position-edit-orgunit");
    await expect(menu.locator(`option[value="${ou!.organizationUnitId}"]`)).toHaveText(ou!.name);
    const testoMenu = await menu.innerText();
    expect(testoMenu, "il menù mostra ancora identificativi grezzi").not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    );

    // e lo stesso vale per il riporto, che non deve proporre la posizione stessa
    await expect(
      page.getByTestId("position-edit-reportsto").locator(`option[value="${positionId}"]`),
      "il menù 'riporta a' propone la posizione stessa: creerebbe un ciclo",
    ).toHaveCount(0);
  });
});
