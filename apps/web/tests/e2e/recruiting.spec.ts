/**
 * apps/web/tests/e2e/recruiting.spec.ts
 *
 * `#54` F4 — il ciclo di selezione dal browser, con login reale (federica.marchetti,
 * mandato HR su RTL Bank) e dati che NASCONO durante la corsa attraverso le stesse API che
 * la pagina usa: richiesta → annuncio → vetrina pubblica → candidato → candidatura →
 * pipeline (Kanban) → colloquio → valutazione → offerta. Ogni mutazione si verifica con
 * cio' che la pagina mostra DOPO il re-fetch, mai con lo stato locale di un form.
 *
 * ⭐ Due controlli negativi, senza i quali il resto proverebbe solo che «qualcosa si vede»:
 *   · una persona SENZA il permesso (`paolo.caputo`) non ha la voce nel menu e la pagina le
 *     risponde con l'errore, non con una pipeline vuota;
 *   · portare una candidatura a REJECTED senza motivo viene rifiutato dal server (409) e la
 *     pagina lo dice, restando sullo stadio di prima.
 *
 * I codici sono unici per corsa (`E2E<base36>`): il dataset non e' cablato, e a fine
 * corsa richiesta e annuncio si portano a CANCELLED/CLOSED perche' la vetrina pubblica non
 * mostri un annuncio di prova. Non esiste una DELETE, per scelta del modulo: le righe le
 * toglie `global-teardown.ts` (prefissi `E2E%-REQ` e `candidato.e2e-%@example.org`).
 */
import { test, expect, type Page } from "@playwright/test";

import { storageStateFor } from "./fixtures";

const SIGLA = `E2E${Date.now().toString(36).toUpperCase()}`;
const REQ_CODE = `${SIGLA}-REQ`;
const POST_CODE = `${SIGLA}-JOB`;
const POST_TITLE = `Analista di prova ${SIGLA}`;
const CAND_EMAIL = `candidato.e2e-${SIGLA.toLowerCase()}@example.org`;
const CAND_LAST = `Prova${SIGLA}`;

async function attendiFeedbackOk(page: Page, testid: string): Promise<void> {
  const fb = page.getByTestId(testid);
  await expect(fb).toBeVisible();
  await expect(fb).not.toHaveClass(/text-danger/);
}

test.describe.serial("#54 F4 — recruiting, ciclo intero con login reale", () => {
  test.describe("con un mandato HR (federica.marchetti)", () => {
    test.use({ storageState: storageStateFor("tenantAdmin") });

    test("la voce di menu esiste e la pipeline si apre vuota o piena, mai rotta", async ({ page }) => {
      await page.goto("/recruiting");
      await expect(page.getByTestId("recruiting-page")).toBeVisible();
      await expect(page.getByTestId("section-tabs")).toBeVisible();
      await expect(page.getByTestId("summary-applications")).toContainText(/\d+/);
      await expect(page.getByTestId("recruiting-error")).toHaveCount(0);
      // la porta: la voce in sidebar (mig 000406) — si cerca per rotta, non per etichetta
      await expect(page.locator('a[href="/recruiting"]').first()).toBeVisible();
    });

    test("una richiesta nasce DRAFT su una posizione vera, e si porta a OPEN", async ({ page }) => {
      await page.goto("/recruiting/requisitions");
      await expect(page.getByTestId("requisitions-page")).toBeVisible();

      await page.getByTestId("requisition-code").fill(REQ_CODE);
      const posizioni = page.getByTestId("requisition-position");
      await expect(posizioni.locator("option")).not.toHaveCount(1); // le posizioni sono arrivate
      await posizioni.selectOption({ index: 1 });
      await page.getByTestId("requisition-reason").selectOption("GROWTH");
      await page.getByTestId("requisition-submit").click();
      await attendiFeedbackOk(page, "requisition-feedback");

      const riga = page.getByTestId("requisition-row").filter({ hasText: REQ_CODE });
      await expect(riga).toHaveCount(1);
      await expect(riga.getByTestId("requisition-row-status")).toHaveText(/Bozza|Draft/);

      await riga.getByTestId("requisition-row-status-select").selectOption("OPEN");
      await expect(riga.getByTestId("requisition-row-status")).toHaveText(/Aperta|Open/);
    });

    test("un annuncio PUBLIC nasce dalla richiesta e si pubblica", async ({ page }) => {
      await page.goto("/recruiting/postings");
      await expect(page.getByTestId("postings-page")).toBeVisible();

      const richieste = page.getByTestId("posting-requisition");
      await expect(richieste.locator("option", { hasText: REQ_CODE })).toHaveCount(1);
      await richieste.selectOption({ label: await richieste.locator("option", { hasText: REQ_CODE }).textContent() ?? "" });
      await page.getByTestId("posting-code").fill(POST_CODE);
      await page.getByTestId("posting-title").fill(POST_TITLE);
      await page.getByTestId("posting-visibility").selectOption("PUBLIC");
      await page.getByTestId("posting-location").fill("Milano");
      await page.getByTestId("posting-description").fill("Annuncio creato dalla suite E2E.");
      await page.getByTestId("posting-submit").click();
      await attendiFeedbackOk(page, "posting-feedback");

      const riga = page.getByTestId("posting-row").filter({ hasText: POST_CODE });
      await expect(riga).toHaveCount(1);
      await expect(riga.getByTestId("posting-row-visibility")).toHaveText(/Pubblico|Public/);
      await riga.getByTestId("posting-row-status-select").selectOption("PUBLISHED");
      await expect(riga.getByTestId("posting-row-status")).toHaveText(/Pubblicato|Published/);
    });

    test("un candidato si registra e si candida all'annuncio", async ({ page }) => {
      await page.goto("/recruiting/candidates");
      await expect(page.getByTestId("candidates-page")).toBeVisible();

      await page.getByTestId("candidate-first-name").fill("Chiara");
      await page.getByTestId("candidate-last-name").fill(CAND_LAST);
      await page.getByTestId("candidate-email").fill(CAND_EMAIL);
      await page.getByTestId("candidate-source").selectOption("JOB_BOARD");
      await page.getByTestId("candidate-submit").click();
      await attendiFeedbackOk(page, "candidate-feedback");

      const scheda = page.getByTestId("candidate-row").filter({ hasText: CAND_LAST });
      await expect(scheda).toHaveCount(1);
      await expect(scheda.getByTestId("candidate-row-status")).toHaveText(/Attivo|Active/);

      const annunci = scheda.getByTestId("candidate-apply-posting");
      await expect(annunci.locator("option", { hasText: POST_CODE })).toHaveCount(1);
      await annunci.selectOption({ label: await annunci.locator("option", { hasText: POST_CODE }).textContent() ?? "" });
      await scheda.getByTestId("candidate-apply").click();
      await attendiFeedbackOk(page, "candidate-feedback");
      await expect(scheda.getByTestId("candidate-application-link")).toHaveCount(1);
      await expect(scheda.getByTestId("candidate-application-link")).toHaveText(/Candidato|Applied/);
    });

    test("la pipeline mostra la carta e la candidatura si apre dal Kanban", async ({ page }) => {
      await page.goto("/recruiting");
      await expect(page.getByTestId("pipeline-board")).toBeVisible();
      const carta = page.getByTestId("pipeline-board").locator("text=Chiara " + CAND_LAST);
      await expect(carta.first()).toBeVisible();
      // il conteggio viene dall'API, non dalla tavola
      const n = Number(await page.getByTestId("summary-applications").innerText());
      expect(n).toBeGreaterThanOrEqual(1);
    });

    test("dettaglio: stadio, colloquio, valutazione, offerta — e il rifiuto senza motivo", async ({ page }) => {
      await page.goto("/recruiting/candidates");
      const scheda = page.getByTestId("candidate-row").filter({ hasText: CAND_LAST });
      await scheda.getByTestId("candidate-application-link").click();
      await page.waitForURL(/\/recruiting\/applications\/[0-9a-f-]+$/);
      await expect(page.getByTestId("application-page")).toBeVisible();
      await expect(page.getByTestId("application-stage")).toHaveText(/Candidato|Applied/);

      // ⭐ negativo: REJECTED senza motivo → il server rifiuta, la pagina lo dice, lo stadio resta
      await page.getByTestId("application-stage-select").selectOption("REJECTED");
      await expect(page.getByTestId("application-feedback")).toHaveClass(/text-danger/);
      await expect(page.getByTestId("application-stage")).toHaveText(/Candidato|Applied/);

      await page.getByTestId("application-stage-select").selectOption("SCREENING");
      await expect(page.getByTestId("application-stage")).toHaveText(/Screening/);

      // colloquio
      await page.getByTestId("interview-kind").selectOption("TECHNICAL");
      // ⚠ un colloquio SENZA data non puo' dirsi svolto: il server risponde 409
      // (INTERVIEW_COMPLETED_WITHOUT_DATE) — misurato alla prima corsa di questa spec
      await page.getByTestId("interview-scheduled-at").fill("2026-09-11T10:00");
      await page.getByTestId("interview-location").fill("Sala 2");
      await page.getByTestId("interview-submit").click();
      const colloquio = page.getByTestId("interview-row").first();
      await expect(colloquio).toBeVisible();
      await expect(colloquio.getByTestId("interview-row-status")).toHaveText(/Programmato|Scheduled/);
      await colloquio.getByTestId("interview-row-status-select").selectOption("COMPLETED");
      await expect(colloquio.getByTestId("interview-row-status")).toHaveText(/Svolto|Completed/);
      await expect(page.getByTestId("application-feedback")).not.toHaveClass(/text-danger/);

      // valutazione, firmata da una persona vera del tenant
      const intervistatori = colloquio.getByTestId("feedback-interviewer");
      await expect(intervistatori.locator("option")).not.toHaveCount(1);
      await intervistatori.selectOption({ index: 1 });
      await colloquio.getByTestId("feedback-recommendation").selectOption("STRONG_YES");
      await colloquio.getByTestId("feedback-score").fill("8.5");
      await colloquio.getByTestId("feedback-submit").click();
      await expect(colloquio.getByTestId("feedback-row")).toHaveCount(1);
      await expect(colloquio.getByTestId("feedback-row-recommendation")).toHaveText(/convinto|Strong yes/);

      // offerta: il mandato HR vede l'importo
      await page.getByTestId("application-stage-select").selectOption("OFFER");
      await expect(page.getByTestId("application-stage")).toHaveText(/Offerta|Offer/);
      await page.getByTestId("offer-salary").fill("42000");
      await page.getByTestId("offer-start-date").fill("2026-11-02");
      await page.getByTestId("offer-submit").click();
      const offerta = page.getByTestId("offer-row").first();
      await expect(offerta).toBeVisible();
      await expect(offerta.getByTestId("offer-row-salary")).toContainText("42");
      await expect(offerta.getByTestId("offer-salary-masked")).toHaveCount(0);
      await offerta.getByTestId("offer-row-status-select").selectOption("SENT");
      await expect(offerta.getByTestId("offer-row-status")).toHaveText(/Inviata|Sent/);
    });

    test("la vetrina pubblica /jobs mostra l'annuncio con il nome dell'azienda — SENZA login", async ({ browser }) => {
      // un contesto NUOVO e senza cookie: e' il percorso del prospect (ADR-0026)
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const pub = await ctx.newPage();
      try {
        await pub.goto("/jobs");
        await expect(pub.getByTestId("jobs-page")).toBeVisible();
        await expect(pub.getByTestId("jobs-login")).toBeVisible();
        await expect(pub.getByTestId("jobs-error")).toHaveCount(0);
        const mio = pub.getByTestId("jobs-row").filter({ hasText: POST_TITLE });
        await expect(mio).toHaveCount(1);
        await expect(mio.getByTestId("jobs-row-company")).toHaveText("RTL Bank");
        // niente identificativi interni sulla vetrina
        expect(await mio.innerText()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
      } finally {
        await ctx.close();
      }
    });

    test("chiusura: annuncio CLOSED e richiesta CANCELLED, cosi' la vetrina non li mostra piu'", async ({ page }) => {
      await page.goto("/recruiting/postings");
      const annuncio = page.getByTestId("posting-row").filter({ hasText: POST_CODE });
      await annuncio.getByTestId("posting-row-status-select").selectOption("CLOSED");
      await expect(annuncio.getByTestId("posting-row-status")).toHaveText(/Chiuso|Closed/);

      await page.goto("/recruiting/requisitions");
      const richiesta = page.getByTestId("requisition-row").filter({ hasText: REQ_CODE });
      await richiesta.getByTestId("requisition-row-status-select").selectOption("CANCELLED");
      await expect(richiesta.getByTestId("requisition-row-status")).toHaveText(/Annullata|Cancelled/);
    });

    test("dopo la chiusura la vetrina non mostra piu' l'annuncio", async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const pub = await ctx.newPage();
      try {
        await pub.goto("/jobs");
        await expect(pub.getByTestId("jobs-page")).toBeVisible();
        await expect(pub.getByTestId("jobs-row").or(pub.getByTestId("jobs-empty")).first()).toBeVisible();
        await expect(pub.getByTestId("jobs-row").filter({ hasText: POST_TITLE })).toHaveCount(0);
      } finally {
        await ctx.close();
      }
    });
  });

  test.describe("⭐ senza il permesso (paolo.caputo)", () => {
    test.use({ storageState: storageStateFor("employee") });

    test("la voce di menu non c'e' e la pagina risponde con l'errore, non con una pipeline vuota", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page.locator('a[href="/recruiting"]')).toHaveCount(0);

      await page.goto("/recruiting");
      await expect(page.getByTestId("recruiting-page")).toBeVisible();
      await expect(page.getByTestId("recruiting-error")).toBeVisible();
      await expect(page.getByTestId("pipeline-board")).toHaveCount(0);
      await expect(page.getByTestId("pipeline-empty")).toHaveCount(0);
    });
  });
});
