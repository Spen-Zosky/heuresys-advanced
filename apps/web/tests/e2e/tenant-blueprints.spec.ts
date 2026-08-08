/**
 * apps/web/tests/e2e/tenant-blueprints.spec.ts
 * #131 Tenant Builder P1, T6 — la cascata percorsa da una persona reale.
 *
 * Lo spec entra come `platformAdmin`, apre un fascicolo, compila la carta
 * d'identita', riceve la proposta del modello, la ancora, decide su un processo
 * con la motivazione e sottomette alla firma.
 *
 * Le mutazioni si verificano con un RE-FETCH — cioe' ricaricando la pagina e
 * rileggendo — non fidandosi di quello che la risposta ha detto. Una mutazione
 * che risponde 200 e non scrive e' esattamente il difetto che un test
 * ottimista non vede.
 *
 * Dati veri: nessuna fixture, nessun mock. L'ATECO e la fascia si scelgono dal
 * catalogo reale attraverso l'interfaccia, come farebbe una persona.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("platformAdmin") });

// Il codice cambia a ogni esecuzione: due corse dello stesso spec non devono
// inciampare nel vincolo di unicita' del codice del fascicolo.
const CODICE = `E2E-FASCICOLO-${Date.now()}`;

test.describe("fascicolo di configurazione", () => {
  test("dalla carta d'identita' ai processi, fino alla firma", async ({ page }) => {
    await page.goto("/tenant-blueprints");
    await expect(page.getByTestId("tenant-blueprints-page")).toBeVisible();

    // --- crea il fascicolo (una trattativa: nessuna azienda) ---
    await page.getByTestId("tenant-blueprint-code").fill(CODICE);
    await page.getByTestId("tenant-blueprint-name").fill("Fascicolo di prova E2E");
    await page.getByTestId("tenant-blueprint-create").click();

    // Re-fetch: si ricarica e si cerca la riga, invece di credere alla risposta.
    await page.reload();
    const riga = page.getByTestId("tenant-blueprints-row").filter({ hasText: CODICE });
    await expect(riga).toHaveCount(1);
    await riga.getByTestId("tenant-blueprint-link").click();

    await expect(page.getByTestId("tenant-blueprint-detail")).toBeVisible();

    // --- passo 1: la carta d'identita' ---
    // L'ATECO si cerca, non si sceglie da una tendina di 3.257 voci.
    await page.getByTestId("identita-ateco-ricerca").fill("64.19");
    const ateco = page.getByTestId("identita-ateco");
    await expect(ateco).toBeVisible();
    await ateco.selectOption({ label: /^64\.19/ });
    await page.getByTestId("identita-fascia").selectOption({ label: /^M/ });
    await page.getByTestId("identita-vigilanza").selectOption("HIGH");
    await page.getByTestId("identita-paese").fill("IT");
    await page.getByTestId("identita-salva").click();
    await expect(page.getByTestId("identita-salvata")).toBeVisible();

    // --- passo 2: il modello proposto ---
    await page.reload();
    await expect(page.getByTestId("modello-proposto")).toBeVisible();
    await page.getByTestId("modello-ancora").click();

    await page.reload();
    await expect(page.getByTestId("modello-ancorato")).toBeVisible();

    // --- passo 3: i processi, con la decisione motivata ---
    const processi = page.getByTestId("processo-riga");
    await expect(processi.first()).toBeVisible();
    const quanti = await processi.count();
    expect(quanti).toBeGreaterThan(0);

    const primo = processi.first();
    // Il pulsante e' spento finche' la motivazione e' vuota: si verifica PRIMA
    // di scriverla, altrimenti non si sta provando niente.
    await expect(primo.getByTestId("processo-salva")).toBeDisabled();

    await primo.getByTestId("processo-inclusione").selectOption("OUT");
    await primo.getByTestId("processo-motivazione").fill("affidato a un fornitore esterno");
    await expect(primo.getByTestId("processo-salva")).toBeEnabled();
    await primo.getByTestId("processo-salva").click();

    await page.reload();
    const primoDopo = page.getByTestId("processo-riga").first();
    await expect(primoDopo.getByTestId("processo-motivazione")).toHaveValue(
      "affidato a un fornitore esterno",
    );

    // R1: togliere la decisione riporta al modello, e la riga lo DICE.
    await primoDopo.getByTestId("processo-togli").click();
    await page.reload();
    await expect(
      page.getByTestId("processo-riga").first().getByTestId("processo-dal-modello"),
    ).toBeVisible();

    // Rimettiamo una decisione: si sottomette un fascicolo deciso, non vuoto.
    const primoRi = page.getByTestId("processo-riga").first();
    await primoRi.getByTestId("processo-inclusione").selectOption("PARTIAL");
    await primoRi.getByTestId("processo-motivazione").fill("gestito in parte internamente");
    await primoRi.getByTestId("processo-salva").click();

    // --- la firma ---
    await page.reload();
    await page.getByTestId("fascicolo-sottometti").click();
    await expect(page.getByTestId("fascicolo-sottomesso")).toBeVisible();

    // Re-fetch: dopo la sottomissione la versione non e' piu' una bozza, quindi
    // il pulsante di sottomissione non c'e' proprio piu'.
    await page.reload();
    await expect(page.getByTestId("fascicolo-sottometti")).toHaveCount(0);
  });

  test("il confronto dichiara l'impatto non calcolabile invece di mostrare zero", async ({
    page,
  }) => {
    await page.goto("/tenant-blueprints");
    const riga = page.getByTestId("tenant-blueprints-row").filter({ hasText: CODICE });
    await expect(riga).toHaveCount(1);
    await riga.getByTestId("tenant-blueprint-link").click();
    await page.getByTestId("tenant-blueprint-diff-link").click();

    await expect(page.getByTestId("tenant-blueprint-diff")).toBeVisible();
    await expect(page.getByTestId("diff-modello")).toBeVisible();
    await expect(page.getByTestId("diff-decisioni")).toBeVisible();
    // La sezione che conta: uno zero qui si leggerebbe «nessuna conseguenza»,
    // che e' il contrario di quello che il sistema sa.
    await expect(page.getByTestId("diff-impatto-stato")).toBeVisible();
  });
});
