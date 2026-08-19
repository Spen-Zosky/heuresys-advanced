/**
 * apps/web/tests/e2e/compensation-read.spec.ts — A/L7 (#32).
 * The six comp & reward read panels added to /compensation-intelligence, live over
 * /v1/compensation/{variable-pay,recommendations,bonus-pools,objective-reward-rules,
 * position-economic-weight,handoff-records}. PLATFORM_ADMIN (holds compensation_intelligence:read).
 * Org-scoping is proven at the API level by the integration suite; this asserts live render.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("compensation intelligence — comp & reward read panels (#32 A/L7)", () => {
  // ⚠ ATTORE CAMBIATO IL 2026-08-19 (#211 F3, famiglia ② del triage), e non e' un aggiustamento
  // di comodo: era `platformAdmin`, e con lui questi casi NON POSSONO passare — ne' devono.
  //
  // ADR-0032 (Enzo, 2026-08-04) dice che `PLATFORM_ADMIN` e' un mandato **tecnico**, non HR:
  // `COMPENSATION` ed `EVALUATION` gli arrivano **mascherati**. Il pannello del calcolo resta
  // quindi su «Caricamento…» e i testid del conto non compaiono. I test erano rimasti indietro
  // rispetto a quella decisione di due settimane, e il loro rosso accusava il prodotto di un
  // difetto che era invece il rispetto di una regola.
  //
  // Chi prova il CONTENUTO di un calcolo economico deve avere il mandato per vederlo:
  // `tenantAdmin` (TENANT_ADMIN) e' HR-mandato per I20. Che al mandato tecnico i valori
  // restino trattenuti e' una prova a se', qui sotto — perche' quella e' la regola, non un
  // caso da evitare.
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("renders the six dormant-data read panels over the live compensation tables", async ({ page }) => {
    await page.goto("/compensation-intelligence");
    await expect(page.getByTestId("compensation-page")).toBeVisible({ timeout: 30_000 });

    for (const panel of [
      "comp-variable-pay-panel", "comp-recommendation-panel", "comp-bonus-pool-panel",
      "comp-objective-rule-panel", "comp-position-weight-panel", "comp-handoff-panel",
    ]) {
      await expect(page.getByTestId(panel)).toBeVisible({ timeout: 20_000 });
    }

    // Live rows from populated tables: variable-pay (121) + recommendations (116).
    await expect(page.getByTestId("comp-variable-pay-row").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("comp-recommendation-row").first()).toBeVisible({ timeout: 20_000 });
  });

  /**
   * #37 (B2) — il pannello che spiega come si arriva al premio.
   *
   * L'importo da solo non dice se il premio sia erogabile: la valutazione mostra
   * la curva applicata, i cancelli e il fattore finale. Tutto viene dall'API su
   * un calcolo REALE del tenant, non da un esempio costruito.
   */
  test("the evaluation panel explains a real calculation", async ({ page }) => {
    await page.goto("/compensation-intelligence");
    await expect(page.getByTestId("comp-variable-pay-row").first()).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("comp-evaluate-button").first().click();
    const panel = page.getByTestId("comp-evaluation-panel");
    await expect(panel).toBeVisible({ timeout: 20_000 });

    // Il periodo e l'importo in archivio arrivano dal calcolo vero.
    await expect(panel).toContainText(/\d{4}-\d{2}-\d{2}\s+→\s+\d{4}-\d{2}-\d{2}/);

    // Il verdetto sui cancelli c'e' sempre: o li elenca, o dice che non ce ne sono.
    await expect(page.getByTestId("comp-evaluation-gates")).toBeVisible();

    // Delle due l'una, e il pannello deve dire quale: o il calcolo dichiara una
    // curva e allora si vede la spiegazione del conto, o e' una riga importata
    // senza curva e allora il motivo va detto in chiaro. Un pannello che non
    // mostra ne' l'uno ne' l'altro fa fallire questa prova.
    const curva = page.getByTestId("comp-evaluation-curve");
    const nonValutabile = page.getByTestId("comp-evaluation-not-evaluable");
    const haCurva = await curva.count();
    if (haCurva > 0) {
      await expect(curva).toContainText(/Curva applicata:/);
      // la spiegazione del motore, non un'etichetta generica
      await expect(curva).toContainText(/raggiungimento/);
      await expect(page.getByTestId("comp-evaluation-final")).toContainText(/\d/);
    } else {
      await expect(nonValutabile).toBeVisible();
      await expect(nonValutabile).not.toBeEmpty();
    }

    await page.getByTestId("comp-evaluation-close").click();
    await expect(panel).toBeHidden();
  });


  /**
   * Il test precedente accetta entrambi i casi, perche' non decide l'ordine
   * delle righe. Questo invece CERCA un calcolo che dichiara una curva e
   * pretende di vederne il conto: se nessuna riga della prima pagina lo ha, il
   * test fallisce dicendo che la premessa non regge piu' — invece di passare
   * senza aver verificato nulla.
   */
  test("at least one real calculation shows the full payout reasoning", async ({ page }) => {
    await page.goto("/compensation-intelligence");
    await expect(page.getByTestId("comp-variable-pay-row").first()).toBeVisible({ timeout: 30_000 });

    const buttons = page.getByTestId("comp-evaluate-button");
    const n = await buttons.count();
    expect(n).toBeGreaterThan(0);

    let trovato = false;
    for (let i = 0; i < n && !trovato; i++) {
      await buttons.nth(i).click();
      await expect(page.getByTestId("comp-evaluation-panel")).toBeVisible({ timeout: 20_000 });
      // Il pannello e' visibile anche mentre carica: il verdetto sui cancelli
      // compare solo CON i dati, quindi e' il segnale che la risposta e'
      // arrivata. Senza questa attesa si leggerebbe un pannello vuoto e si
      // concluderebbe, a torto, che il calcolo non ha una curva.
      await expect(page.getByTestId("comp-evaluation-gates")).toBeVisible({ timeout: 20_000 });
      if ((await page.getByTestId("comp-evaluation-curve").count()) > 0) {
        const curva = page.getByTestId("comp-evaluation-curve");
        // La spiegazione del motore, con i parametri veri della curva.
        await expect(curva).toContainText(/Curva applicata:/);
        await expect(curva).toContainText(/raggiungimento\s+[\d.]+/);
        // e un fattore finale numerico
        await expect(page.getByTestId("comp-evaluation-final")).toContainText(/[\d.]+/);
        trovato = true;
      }
      await page.getByTestId("comp-evaluation-close").click();
    }
    expect(
      trovato,
      "Nessuno dei calcoli visibili dichiara una curva: la premessa del test non regge piu'",
    ).toBe(true);
  });

});

test.describe("ADR-0032 sul frontend: al mandato tecnico i valori economici non arrivano", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("il pannello del calcolo non espone il conto a chi ha un mandato solo tecnico", async ({
    page,
  }) => {
    // Il complemento del caso sopra, e la ragione per cui il cambio di attore non e' una
    // scorciatoia: la stessa pagina, con lo stesso percorso, non deve consegnare i valori a
    // `PLATFORM_ADMIN`. Se un giorno li consegnasse, questo caso diventa rosso — ed e'
    // esattamente il rosso che si vuole vedere.
    await page.goto("/compensation-intelligence");
    await expect(page.getByTestId("comp-variable-pay-row").first()).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("comp-evaluate-button").first().click();
    await expect(page.getByTestId("comp-evaluation-panel")).toBeVisible({ timeout: 20_000 });

    // Il pannello si apre — la riga, il soggetto e il periodo restano visibili (ADR-0032 non
    // nega la riga, trattiene i valori) — ma la spiegazione del conto non si materializza.
    await expect(page.getByTestId("comp-evaluation-gates")).toHaveCount(0);
  });
});
