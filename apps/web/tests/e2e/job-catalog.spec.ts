/**
 * apps/web/tests/e2e/job-catalog.spec.ts — il catalogo mansioni esiste ed è raggiungibile (#43, linea C2).
 *
 * `job-families` e `job-roles` erano gli ultimi due moduli del catalogo con
 * API complete e NESSUNA pagina. Questa prova copre le due cose che rendono
 * quel lavoro reale:
 *
 *  1. il ciclo dei dati — creare una famiglia, creare un ruolo che vi
 *     appartiene, rinominarlo, rileggendo ogni volta dall'API;
 *  2. il **cancello di esposizione** — la voce deve comparire nel menù
 *     laterale, che su questo prodotto è guidato dal database (registro
 *     `sys_ui_interfaces` letto da `GET /v1/me/interfaces`). Una pagina che
 *     esiste ma non è nel registro non è raggiungibile da nessuno, quindi non
 *     è nel prodotto: senza questo controllo la migrazione `000219` potrebbe
 *     sparire e i test resterebbero verdi.
 *
 * Le righe create sono nominate `E2E-JOB…` e le rimuove il teardown comune,
 * nell'ordine ruoli-poi-famiglie: i ruoli non hanno una DELETE sull'API e una
 * famiglia non si cancella finché un ruolo la referenzia.
 */

import { test, expect, type Page } from "@playwright/test";
import { storageStateFor, gotoAuthenticated, API_BASE } from "./fixtures";

test.describe.configure({ retries: 1 });

async function cookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

test.describe("catalogo mansioni", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("la voce è nel registro del menù, non solo una rotta che esiste", async ({ page, request }) => {
    const cookie = await cookieHeader(page);

    // Il menù laterale nasce dal database: se la riga non c'è, la pagina è
    // irraggiungibile anche se la rotta risponde.
    const res = await request.get(`${API_BASE}/v1/me/interfaces`, { headers: { cookie } });
    expect(res.ok(), "registro interfacce non raggiungibile").toBeTruthy();
    const body = (await res.json()) as {
      perspectives: Array<{ code: string; interfaces: Array<{ route: string; label: string }> }>;
    };
    const voce = body.perspectives.flatMap((p) => p.interfaces).find((i) => i.route === "/job-catalog");
    expect(voce, "/job-catalog non è nel registro del menù: nessuno può raggiungerla").toBeTruthy();

    // e la pagina risponde davvero
    await gotoAuthenticated(page, "/job-catalog");
    await expect(page.getByTestId("job-catalog-page")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("job-families-panel")).toBeVisible();
    await expect(page.getByTestId("job-roles-panel")).toBeVisible();
  });

  test("crea una famiglia, un ruolo che vi appartiene, lo rinomina e ripulisce", async ({ page, request }) => {
    const cookie = await cookieHeader(page);
    const marca = Date.now();
    const codFamiglia = `E2E-JOBFAM-${marca}`;
    const codRuolo = `E2E-JOBROLE-${marca}`;
    let famigliaId: string | null = null;

    try {
      await gotoAuthenticated(page, "/job-catalog");
      await expect(page.getByTestId("job-catalog-page")).toBeVisible({ timeout: 45_000 });

      // --- famiglia ---
      await page.getByTestId("family-create-code").fill(codFamiglia);
      await page.getByTestId("family-create-name").fill(`Famiglia di collaudo ${marca}`);
      const [postFam] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/v1/job-families") && r.request().method() === "POST"),
        page.getByTestId("family-create-submit").click(),
      ]);
      expect(postFam.status(), "creazione famiglia non accettata").toBe(201);

      const famRes = await request.get(`${API_BASE}/v1/job-families?limit=200`, { headers: { cookie } });
      const famiglia = ((await famRes.json()).items as Array<{ jobFamilyId: string; code: string }>).find(
        (f) => f.code === codFamiglia,
      );
      expect(famiglia, "la famiglia creata non risulta sull'API").toBeTruthy();
      famigliaId = famiglia!.jobFamilyId;

      // --- ruolo dentro quella famiglia ---
      await expect(page.getByTestId("role-create-family")).toBeVisible();
      await page.getByTestId("role-create-code").fill(codRuolo);
      await page.getByTestId("role-create-name").fill(`Ruolo di collaudo ${marca}`);
      await page.getByTestId("role-create-family").selectOption(famigliaId);
      await page.getByTestId("role-create-seniority").selectOption("SENIOR");
      const [postRuolo] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/v1/job-roles") && r.request().method() === "POST"),
        page.getByTestId("role-create-submit").click(),
      ]);
      expect(postRuolo.status(), "creazione ruolo non accettata").toBe(201);

      // PROVA VERA: il ruolo è sull'API e punta alla famiglia giusta
      const ruoliRes = await request.get(`${API_BASE}/v1/job-roles?limit=200`, { headers: { cookie } });
      const ruolo = ((await ruoliRes.json()).items as Array<{
        jobRoleId: string; code: string; jobFamilyId: string | null; seniorityLevel: string | null;
      }>).find((r) => r.code === codRuolo);
      expect(ruolo, "il ruolo creato non risulta sull'API").toBeTruthy();
      expect(ruolo!.jobFamilyId, "il ruolo non è legato alla famiglia scelta").toBe(famigliaId);
      expect(ruolo!.seniorityLevel).toBe("SENIOR");

      // --- rinomina dall'interfaccia ---
      // 137 ruoli in catalogo: senza cercare, il nuovo finisce oltre la prima
      // pagina della tabella. La ricerca e' lato server (filtro dell'API).
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByTestId("role-search").fill(codRuolo);
      await expect(page.getByTestId(`role-edit-${codRuolo}`)).toBeVisible({ timeout: 30_000 });
      await page.getByTestId(`role-edit-${codRuolo}`).click();
      await expect(page.getByTestId("role-edit-form")).toBeVisible({ timeout: 30_000 });
      const nuovoNome = `Ruolo rinominato ${marca}`;
      await page.getByTestId("role-edit-name").fill(nuovoNome);
      const [patch] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes(`/v1/job-roles/${ruolo!.jobRoleId}`) && r.request().method() === "PATCH",
        ),
        page.getByTestId("role-edit-save").click(),
      ]);
      expect(patch.status(), "rinomina non accettata").toBe(200);

      const dopo = await request.get(`${API_BASE}/v1/job-roles/${ruolo!.jobRoleId}`, { headers: { cookie } });
      expect((await dopo.json()).name, "la rinomina non è arrivata al database").toBe(nuovoNome);
    } finally {
      // La pulizia la fa il teardown comune, per due ragioni MISURATE e non
      // aggirabili da qui: i ruoli professionali non hanno una DELETE sull'API
      // (4 endpoint: elenco/dettaglio/creazione/modifica), e la famiglia non
      // si può cancellare finché un ruolo la referenzia. Serve quindi l'ordine
      // ruoli-poi-famiglie, che il teardown esegue via SQL stampando i conteggi.
      void famigliaId;
    }
  });
});
