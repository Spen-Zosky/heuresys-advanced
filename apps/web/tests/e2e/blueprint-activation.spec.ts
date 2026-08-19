/**
 * apps/web/tests/e2e/blueprint-activation.spec.ts — #45 C3.
 *
 * LIVE-DATA-E2E-ONLY: l'API di attivazione dei blueprint esisteva e nessuna pagina la
 * chiamava — proporre una variante per un'azienda voleva dire passare dal database.
 *
 * L'attivazione nasce PROPOSED, mai ACTIVE: rendere una variante il modello di
 * riferimento è una decisione, non l'effetto collaterale di un clic su un elenco. Il
 * test lo verifica, perché è la parte che un'implementazione frettolosa sbaglierebbe.
 *
 * Le righe create sono reali e restano: un'attivazione proposta è un fatto registrato,
 * e il teardown la rimuove come per gli altri artefatti di prova.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe.configure({ retries: 1 });

test.describe("#45 C3 — attivazione dei blueprint", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("il pannello è visibile e mostra le attivazioni registrate", async ({ page }) => {
    await page.goto("/blueprints", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("blueprint-activation-panel")).toBeVisible({ timeout: 45_000 });
    // La tabella c'è: o con righe reali, o con l'empty-state — mai un'area muta.
    const righe = page.getByTestId("blueprint-activation-row");
    const vuoto = page.getByTestId("blueprint-activation-empty");
    await expect(righe.first().or(vuoto)).toBeVisible({ timeout: 30_000 });
  });

  test("proporre una variante crea un'attivazione, e nasce PROPOSED", async ({ page }) => {
    await page.goto("/blueprints", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("blueprint-activation-panel")).toBeVisible({ timeout: 45_000 });

    const select = page.getByTestId("blueprint-activation-variant");
    const opzioni = await select.locator("option").count();
    test.skip(opzioni < 2, "nessuna variante disponibile su questo database");

    const prima = await page.getByTestId("blueprint-activation-row").count();
    await select.selectOption({ index: 1 });

    // #211 F3, famiglia ⑥ — LA CAUSA CHE IL TRIAGE AVEVA ESCLUSO, e che la misura ha
    // confermato: replicando la POST del browser, il servizio risponde
    // `403 TENANT_ID_REQUIRED — PLATFORM_ADMIN must supply body.tenantId`. Chi opera su piu'
    // aziende deve dire su quale sta attivando un modello, e la pagina non lo chiedeva: il
    // pulsante era inerte per un amministratore di piattaforma. Era l'UNICO guasto vero del
    // prodotto fra le sei famiglie — le altre cinque erano test rimasti indietro.
    const azienda = page.getByTestId("blueprint-activation-tenant");
    await expect(azienda, "la scelta dell'azienda deve esistere: e' cio' che mancava").toBeVisible();
    await azienda.selectOption({ index: 1 });

    await page.getByTestId("blueprint-activation-submit").click();
    // Se la proposta viene rifiutata, la pagina lo dice: leggerlo qui trasforma un timeout
    // muto di 30 secondi in un messaggio che nomina il problema.
    await expect(page.getByTestId("blueprint-activation-error")).toHaveCount(0);
    await expect(page.getByTestId("blueprint-activation-notice")).toBeVisible({ timeout: 30_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("blueprint-activation-panel")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("blueprint-activation-row")).toHaveCount(prima + 1, { timeout: 30_000 });

    // Il punto: l'attivazione NON è attiva. Una variante non diventa il modello di
    // riferimento perché qualcuno ha cliccato un pulsante in un elenco.
    // ⚠ Cercava `.last()`, e assumeva un ordinamento che l'elenco non garantisce: con
    // un'attivazione ACTIVE gia' presente, l'ultima riga era quella e il caso falliva
    // dicendo «expected PROPOSED, received …ACTIVE». Si cerca quindi la riga PER CIO' CHE
    // DEVE ESSERE, non per la posizione che si spera occupi.
    const proposta = page.getByTestId("blueprint-activation-row").filter({ hasText: "PROPOSED" });
    await expect(proposta).toHaveCount(1);
  });

  test("la variante è mostrata col suo nome, non con l'identificativo", async ({ page }) => {
    await page.goto("/blueprints", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const riga = page.getByTestId("blueprint-activation-row").first();
    const presente = await riga.count();
    test.skip(presente === 0, "nessuna attivazione da mostrare");
    // Un elenco di UUID non è consultabile da nessuno.
    await expect(riga).not.toContainText(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });
});

test.describe("#45 C3 — l'attivazione è riservata", () => {
  test.use({ storageState: storageStateFor("employee") });

  test("un dipendente non vede il pannello e non può attivare via API", async ({ page }) => {
    await page.goto("/blueprints", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("blueprint-activation-panel")).toHaveCount(0);

    // Nascondere il pannello non è la protezione: l'autorità è il service.
    const res = await page.request.post("/api/v1/blueprint-activations", {
      data: { variantId: "00000000-0000-4000-8000-000000000000", status: "PROPOSED" },
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(res.status());
  });
});
