/**
 * apps/web/tests/e2e/tenants-editing.spec.ts — #45 C3.
 *
 * LIVE-DATA-E2E-ONLY: le API di scrittura sulle aziende clienti esistevano da MVP-1 e
 * nessuna pagina le chiamava — aprire o archiviare un'azienda voleva dire passare dal
 * database. Qui si verifica che dall'interfaccia si possa fare davvero.
 *
 * Le scritture sono REALI su un ambiente di produzione: l'azienda creata dal test ha un
 * codice riconoscibile, viene archiviata dal test stesso e la riga è rimossa dal teardown
 * globale. La cancellazione dal prodotto è volutamente soft (ARCHIVED), quindi il residuo
 * non sparirebbe da solo.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe.configure({ retries: 1 });

const CODE = `E2E_TENANT_${Date.now().toString(36).toUpperCase()}`;
const NAME = `Azienda di prova ${CODE}`;

test.describe("#45 C3 — creare e archiviare un'azienda cliente", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("il pannello di creazione è visibile a chi ha il permesso", async ({ page }) => {
    await page.goto("/tenants", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("tenants-page")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("tenant-create-panel")).toBeVisible();
  });

  test("una nuova azienda creata dall'interfaccia compare nell'elenco e sopravvive al ricaricamento", async ({ page }) => {
    await page.goto("/tenants", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("tenant-create-panel")).toBeVisible({ timeout: 45_000 });

    await page.getByTestId("tenant-field-tenantCode").fill(CODE);
    await page.getByTestId("tenant-field-tenantName").fill(NAME);
    await page.getByTestId("tenant-field-tenantCountryCode").fill("IT");

    // #219 F3/D — IL CAMPO CHE IL CASO NON SAPEVA DI DOVER COMPILARE.
    // `tenantIndustryCode` è obbligatorio dalla mig. `000305` (D-83) ed è un `<select
    // required>`: senza, il BROWSER blocca l'invio: nessuna chiamata parte, nessun avviso
    // compare, e la firma registrata («`tenant-notice` non compare dopo la creazione»)
    // descriveva il sintomo di questo. È lo stesso campo che in F1/E faceva rispondere 400
    // al caso lato API — lì fu corretta la richiesta, qui era rimasto il form.
    // Il valore si prende dal catalogo che la pagina ha caricato, non si scrive a mano:
    // un codice cablato qui invecchierebbe come il nome di squadra di F3/F.
    const industria = page.getByTestId("tenant-field-tenantIndustryCode");
    await expect(industria).toBeVisible();
    // `option:not([value=""])` salta il segnaposto. Se il catalogo fosse vuoto il caso
    // fallisce QUI, dicendo che manca il catalogo — invece di fallire più avanti su un
    // avviso mancante, che è la diagnosi sbagliata da cui siamo partiti.
    const opzioni = industria.locator('option:not([value=""])');
    await expect(opzioni.first()).toBeAttached({ timeout: 15_000 });
    const codiceIndustria = await opzioni.first().getAttribute("value");
    await industria.selectOption(codiceIndustria!);

    await page.getByTestId("tenant-create-submit").click();

    await expect(page.getByTestId("tenant-notice")).toBeVisible({ timeout: 30_000 });

    // Il ricaricamento è il punto: un form che aggiorna solo lo stato del componente
    // sembra funzionare finché nessuno ricarica la pagina.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("tenants-row").filter({ hasText: CODE }).first()).toBeVisible({ timeout: 45_000 });
  });

  test("archiviare l'azienda la porta in stato ARCHIVED, e resta tale dopo il ricaricamento", async ({ page }) => {
    await page.goto("/tenants", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const riga = page.getByTestId("tenants-row").filter({ hasText: CODE }).first();
    await expect(riga).toBeVisible({ timeout: 45_000 });

    // La conferma del browser è parte del flusso: archiviare toglie un'azienda
    // dall'operatività e un clic per sbaglio non deve poterlo fare.
    page.once("dialog", (d) => void d.accept());
    await riga.getByTestId("tenant-archive").click();
    await expect(page.getByTestId("tenant-notice")).toBeVisible({ timeout: 30_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    const dopo = page.getByTestId("tenants-row").filter({ hasText: CODE }).first();
    await expect(dopo).toBeVisible({ timeout: 45_000 });
    await expect(dopo).toContainText(/ARCHIVED|Archiviat/i);
  });
});

test.describe("#45 C3 — il cancello vale anche quando il pulsante non si vede", () => {
  test.use({ storageState: storageStateFor("employee") });

  test("un dipendente non vede né il pannello né il comando di archiviazione", async ({ page }) => {
    await page.goto("/tenants", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("tenant-create-panel")).toHaveCount(0);
    await expect(page.getByTestId("tenant-archive")).toHaveCount(0);
  });

  test("e non può crearla nemmeno chiamando l'API direttamente", async ({ page }) => {
    // Nascondere un pulsante non è una protezione: l'autorità è il service, e questo
    // test lo dimostra invece di darlo per scontato.
    //
    // ⚠ PERCHE' LA RICHIESTA E' COMPLETA (#219 F1, firma E). Prima di S1077 questo
    // caso mandava solo `tenantCode` e `tenantName` e riceveva **400**: lo schema
    // pretende anche `tenantIndustryCode` (obbligatorio dalla 000305, D-83), quindi
    // la validazione scattava PRIMA del controllo di permesso. Il test era rosso —
    // ma soprattutto non provava ciò che dichiara: se domani il permesso sparisse,
    // resterebbe rosso lo stesso, e non rileverebbe il buco.
    //
    // Stessa ragione per il token CSRF: senza, a rispondere sarebbe il presidio
    // anti-CSRF e non il controllo di permesso. Due modi diversi di ricevere la
    // risposta giusta per il motivo sbagliato.
    const csrf = (await page.context().cookies()).find((c) => c.name === "hrx_csrf")?.value ?? "";
    const res = await page.request.post("/api/v1/tenants", {
      headers: { "x-csrf-token": csrf },
      data: {
        tenantCode: `${CODE}_FORBIDDEN`,
        tenantName: "non deve nascere",
        tenantIndustryCode: "FIN_BANKING",
      },
      failOnStatusCode: false,
    });
    // 400 qui NON e' un successo: significherebbe che la richiesta e' stata respinta
    // dalla validazione, cioe' che il caso e' tornato a misurare la cosa sbagliata.
    expect(res.status(), "deve rispondere l'autorizzazione, non la validazione").not.toBe(400);
    expect([401, 403]).toContain(res.status());
  });
});
