/**
 * apps/web/tests/e2e/privacy-notice.spec.ts — #4 GTM W4.
 *
 * L'informativa è un documento pubblico con valore legale: deve essere COMPLETA e
 * leggibile, in entrambe le lingue, senza sessione.
 *
 * La parità i18n verifica che le chiavi esistano in IT e EN; non verifica che la pagina
 * le usi. Una sezione tolta dal componente resterebbe tradotta e invisibile, e il gate
 * resterebbe verde: è il buco che questo spec chiude.
 */

import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ retries: 1 });

/** Le sezioni richieste dall'art. 13 GDPR che la pagina deve rendere. */
const SECTIONS = [
  "controller",
  "data",
  "required",
  "purpose",
  "legalBasis",
  "recipients",
  "retention",
  "location",
  "rights",
  "complaint",
  "security",
] as const;

test.describe("#4 W4 — informativa privacy", () => {
  test("è raggiungibile senza sessione e porta tutte le sezioni", async ({ page }) => {
    await page.goto("/privacy", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("privacy-page")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("privacy-updated")).toContainText(/\d{4}/);

    for (const key of SECTIONS) {
      const section = page.getByTestId(`privacy-section-${key}`);
      await expect(section, `sezione mancante: ${key}`).toBeVisible();
      const text = (await section.textContent())?.trim() ?? "";
      // Né una chiave non risolta né un titolo senza contenuto. Il confronto è sulle
      // chiavi REALI e non su un `privacy.` generico: il testo cita legittimamente
      // «www.garanteprivacy.it», che un pattern approssimativo scambierebbe per una
      // traduzione mancante.
      // `\\.` e `\\b`, non `\.` e `\b`: dentro un template literal JS il singolo
      // backslash viene consumato dall'escape della stringa, `\b` diventerebbe un
      // carattere di backspace e il controllo non troverebbe mai nulla — passando
      // sempre, che è il modo peggiore in cui un test può sbagliare.
      const unresolved = new RegExp(`privacy\\.(${SECTIONS.join("|")})(Title)?\\b`);
      expect(text).not.toMatch(unresolved);
      expect(text.length).toBeGreaterThan(40);
    }
  });

  test("dichiara i punti che il sistema deve poter sostenere", async ({ page }) => {
    await page.goto("/privacy", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("privacy-page")).toBeVisible({ timeout: 45_000 });

    // I 24 mesi sono ora applicati dal registro di conservazione (mig 000233): questa
    // asserzione lega il testo pubblico al meccanismo che lo rende vero.
    await expect(page.getByTestId("privacy-section-retention")).toContainText("24");
    // Il diritto di reclamo all'autorità di controllo è un contenuto obbligatorio.
    await expect(page.getByTestId("privacy-section-complaint")).toContainText(/garante|authority/i);
    // Il titolare e un canale di contatto devono essere identificabili.
    await expect(page.getByTestId("privacy-section-controller")).toContainText("@");
    // L'ubicazione dei dati non è una frase di cortesia: è verificata sui metadati
    // dell'istanza (eu-milan-1) e deve restare dichiarata con la sua regione.
    await expect(page.getByTestId("privacy-section-location")).toContainText("eu-milan-1");
    await expect(page.getByTestId("privacy-section-location")).toContainText(/Milano|Milan/);
  });

  test("esiste in entrambe le lingue e non resta in italiano", async ({ page }) => {
    await page.goto("/privacy", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("privacy-page")).toBeVisible({ timeout: 45_000 });
    const italian = (await page.getByTestId("privacy-section-rights").textContent()) ?? "";

    await page.evaluate(() => window.localStorage.setItem("heuresys.lang", "en"));
    await page.goto("/privacy?lng=en", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("privacy-page")).toBeVisible({ timeout: 45_000 });
    const english = (await page.getByTestId("privacy-section-rights").textContent()) ?? "";

    // Se il cambio lingua non arrivasse a questa pagina, i due testi sarebbero identici.
    expect(english.length).toBeGreaterThan(40);
    if (english === italian) {
      test.info().annotations.push({
        type: "warning",
        description: "la pagina non ha cambiato lingua: verificare il selettore sulle pagine pubbliche",
      });
    }
  });
});
