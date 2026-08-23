/**
 * apps/web/tests/e2e/performance-cycle.spec.ts — #92 F7.
 *
 * Le due pagine di F6 provate dal vivo, con **login reale**, sui due rami che il programma
 * prescrive: chi conduce la valutazione, e una persona **senza deleghe**.
 *
 * ⚠ Nessun numero atteso è cablato. Ogni asserzione confronta ciò che la pagina MOSTRA con
 * ciò che l'API RISPONDE nella stessa navigazione: un atteso scritto a mano qui duplicherebbe
 * una fonte di verità e mentirebbe il giorno che i dati cambiano — e i dati di questo
 * progetto cambiano da soli, perché la storia RTL avanza nel tempo.
 *
 * ⚠ La sezione dei cicli è un **empty-state reale** (`sys_review_cycles` è vuota finché Enzo
 * non apre un ciclo). Il test asserisce l'empty-state *derivandolo dalla risposta*, non
 * dandolo per scontato: il giorno che un ciclo esiste, l'asserzione segue da sé invece di
 * diventare rossa per il motivo sbagliato.
 */

import { test, expect, type Page } from "@playwright/test";
import { API_BASE, storageStateFor } from "./fixtures";

test.describe.configure({ retries: 1 });

/**
 * Il `total` che l'API risponde a QUESTA sessione, chiesto direttamente.
 *
 * La prima stesura intercettava la risposta con `waitForResponse` durante la navigazione, ed
 * era **flaky**: alla prima visita `next dev` compila la pagina su richiesta e la chiamata
 * arriva oltre i 10 secondi di attesa. Il test diventava rosso per la compilazione, non per
 * un difetto del prodotto — e un test che sbaglia bersaglio è peggio di uno assente, perché
 * insegna a rilanciare invece che a guardare.
 */
async function totale(page: Page, percorso: string): Promise<number> {
  const r = await page.request.get(`${API_BASE}${percorso}`);
  expect(r.status(), `${percorso} ha risposto ${r.status()}`).toBe(200);
  const body = (await r.json()) as { total?: number };
  return Number(body.total ?? 0);
}

test.describe("#92 F7 — il ciclo di valutazione, lato di chi lo conduce", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("le tre sezioni mostrano esattamente ciò che l'API risponde", async ({ page }) => {
    const totaleValutazioni = await totale(page, "/v1/performance-reviews?limit=1&offset=0");

    await page.goto("/performance");
    await expect(page.getByTestId("perf-reviews-section")).toBeVisible();
    await expect(page.getByTestId("perf-kpi-reviews")).toHaveText(String(totaleValutazioni));

    // La lista è paginata lato server: le righe VISIBILI sono una pagina, non il totale.
    // Asserire l'uguaglianza qui sarebbe sbagliato — si asserisce che ce ne sia almeno una
    // e che non superino il totale.
    const righe = page.getByTestId("perf-reviews-row");
    const n = await righe.count();
    expect(n, "nessuna valutazione a schermo: la pagina non sta mostrando i dati").toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(totaleValutazioni);

    // Le sessioni di calibrazione: qui il totale non è paginato lato server.
    await expect(page.getByTestId("perf-calib-section")).toBeVisible();
    // Stessa fragilità del caso sui cicli (#219 F3/G): oggi questo passa, ma per tempismo —
    // `count()` non ritenta, quindi è verde finché la tabella è già pronta. Con l'auto-retry
    // resta verde per la ragione giusta invece che per fortuna.
    await expect(page.getByTestId("perf-calib-row"), "nessuna sessione di calibrazione a schermo")
      .not.toHaveCount(0);
  });

  test("i cicli: la pagina dice la verità sul vuoto, invece di tacere", async ({ page }) => {
    const totaleCicli = await totale(page, "/v1/review-cycles?limit=50&offset=0");

    await page.goto("/performance");
    await expect(page.getByTestId("perf-cycles-section")).toBeVisible();
    if (totaleCicli === 0) {
      // Empty-state REALE: non un difetto, e la pagina deve dichiararlo — non lasciare
      // un'area bianca in cui non si capisce se il dato manchi o stia caricando.
      await expect(page.getByTestId("perf-cycles-empty")).toBeVisible();
    } else {
      // #219 F3/G — `expect(await locator.count())` è uno SCATTO ISTANTANEO: non ritenta.
      // La sezione diventa visibile subito (è l'involucro), ma la tabella dentro può essere
      // ancora in caricamento — e il conteggio cadeva lì, restituendo 0 mentre il ciclo
      // c'era. Misurato: nel database esiste **un** ciclo (RTL_BANK, stato DRAFT), il
      // repository usa la STESSA clausola per contare e per elencare (quindi `total` e
      // `items` non possono divergere), e il numero in cima alla pagina lo mostrava già.
      // `toHaveCount` ha l'auto-retry, quindi aspetta che la tabella abbia finito.
      await expect(page.getByTestId("perf-cycles-row")).not.toHaveCount(0);
    }
    // In entrambi i casi il numero in cima deve coincidere con la risposta.
    await expect(page.getByTestId("perf-kpi-cycles")).toHaveText(String(totaleCicli));
  });
});

test.describe("#92 F7 — le proprie valutazioni, per chi non ha deleghe", () => {
  // `outsider` è la persona senza alcun mandato: è il caso che il programma chiede, perché
  // il pavimento ESS (I17) deve valere per chi NON dirige nessuno.
  test.use({ storageState: storageStateFor("outsider") });

  test("vede le proprie valutazioni comunicate, e tante quante l'API ne restituisce", async ({ page }) => {
    const attese = await totale(page, "/v1/me/performance");

    await page.goto("/me/performance");
    await expect(page.getByTestId("me-performance-page")).toBeVisible();
    await expect(page.getByTestId("me-performance-row")).toHaveCount(attese);
    expect(attese, "questa persona non ha valutazioni comunicate: la prova sarebbe cieca").toBeGreaterThan(0);
  });

  test("la pagina manageriale resta chiusa a chi non ha il mandato", async ({ page }) => {
    // Il rovescio della stessa medaglia: `performance-review:read` non è di tutti, e una
    // pagina che si apre a chi non deve vederla è il difetto che i test di perimetro
    // esistono per intercettare. Non si asserisce un codice HTTP — la sidebar e il
    // routing possono reindirizzare — ma che il CONTENUTO non compaia.
    await page.goto("/performance");
    await expect(page.getByTestId("perf-reviews-row").first()).toBeHidden({ timeout: 15_000 });
  });
});
