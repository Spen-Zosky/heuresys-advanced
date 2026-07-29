/**
 * apps/web/tests/e2e/storia36-demo.spec.ts — storia36 C12, Step 12.4.
 *
 * IL PERCORSO CHE SI MOSTRA A UN CLIENTE O A UN INVESTITORE, eseguito dal vivo
 * e catturato schermata per schermata. Non e' un test di regressione: e' la
 * DIMOSTRAZIONE che la storia a 36 mesi si vede nel prodotto, e non solo nel
 * database.
 *
 * Perche' come spec Playwright e non a mano: il login vero passa dal secondo
 * fattore, il percorso tocca sei superfici e va rifatto ogni volta che i dati
 * cambiano. Un giro manuale non e' ripetibile e non lascia prove; questo si
 * rilancia con un comando e riscrive le schermate.
 *
 * NON fa parte della suite di regressione (che deve restare deterministica):
 * si attiva SOLO con STORIA36_DEMO=1, es.
 *   STORIA36_DEMO=1 pnpm exec node scripts/e2e-node22.mjs test \
 *     --config=playwright.prod.config.ts storia36-demo
 *
 * Le schermate finiscono in `qa_artifacts/storia36/demo/`.
 */

import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { storageStateFor, gotoAuthenticated } from "./fixtures";

const DEMO_ON = process.env.STORIA36_DEMO === "1";
const OUT = join(process.cwd(), "..", "..", "qa_artifacts", "storia36", "demo");

let passo = 0;

/**
 * Scatta SOLO quando la pagina ha finito di muoversi.
 *
 * Il primo giro di catture ha prodotto un cruscotto con «48,25 utenti» e «7,63
 * unita' organizzative»: sembrava un difetto grave del prodotto, ed era invece
 * l'ANIMAZIONE dei contatori colta a un terzo del percorso (48,25/163 = 29,6%;
 * 54,05/181 = 29,9%; 7,63/28 = 27% — tutti fermi allo stesso punto). Una
 * schermata scattata troppo presto non e' una prova: e' un falso indizio, e in
 * una dimostrazione sarebbe finita davanti a un cliente.
 *
 * Quindi: si attende la quiete di rete, poi che due letture successive del
 * testo della pagina coincidano — cioe' che nessun numero stia ancora salendo.
 */
async function scatta(page: Page, nome: string) {
  await page.waitForLoadState("networkidle");
  let precedente = "";
  for (let i = 0; i < 40; i++) {
    const attuale = await page.locator("main").innerText().catch(() => "");
    // «stabile» non basta: anche «Caricamento…» e' stabile finche' i dati non
    // arrivano, e la prima cattura della scheda persona ha fotografato
    // esattamente quello — una schermata vuota che sembrava una pagina rotta.
    const inCaricamento = /caricamento|loading/i.test(attuale) || attuale.trim().length < 40;
    if (attuale && attuale === precedente && !inCaricamento) break;
    precedente = attuale;
    await page.waitForTimeout(300);
  }
  passo += 1;
  const file = join(OUT, `${String(passo).padStart(2, "0")}-${nome}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

test.describe("storia36 — percorso dimostrativo su dati reali", () => {
  test.skip(!DEMO_ON, "cattura on-demand: STORIA36_DEMO=1");
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test.beforeAll(() => {
    mkdirSync(OUT, { recursive: true });
  });

  test("1 — la direzione vede l'azienda: cruscotto e andamento", async ({ page }) => {
    await gotoAuthenticated(page, "/dashboard");
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 30_000 });
    await scatta(page, "cruscotto");

    // L'andamento presenze copre l'intera finestra della storia: e' il segno
    // che il sistema "ha dati da tempo", non da ieri.
    await gotoAuthenticated(page, "/analytics/attendance");
    await expect(page.getByTestId("analytics-attendance-page")).toBeVisible({ timeout: 30_000 });
    await scatta(page, "andamento-presenze-36-mesi");
  });

  test("2 — una persona con una storia completa", async ({ page }) => {
    await gotoAuthenticated(page, "/users");
    await expect(page.getByTestId("users-page")).toBeVisible({ timeout: 30_000 });
    await scatta(page, "elenco-persone");

    // La scheda si apre dal collegamento sul nome (la riga da sola seleziona e
    // basta: la prima cattura mostrava ancora l'elenco).
    const collegamento = page.getByTestId("user-link").first();
    await expect(collegamento).toBeVisible({ timeout: 15_000 });
    await collegamento.click();
    await page.waitForURL(/\/users\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await scatta(page, "scheda-persona");
  });

  test("3 — la coda delle approvazioni, lavorata davvero", async ({ page }) => {
    await gotoAuthenticated(page, "/approvals");
    await page.waitForLoadState("networkidle");
    await scatta(page, "approvazioni");
  });

  test("4 — il clima aziendale nel tempo", async ({ page }) => {
    await gotoAuthenticated(page, "/engagement");
    await page.waitForLoadState("networkidle");
    await scatta(page, "clima-aziendale");
  });

  test("5 — retribuzioni e premio variabile", async ({ page }) => {
    await gotoAuthenticated(page, "/compensation-intelligence");
    await page.waitForLoadState("networkidle");
    await scatta(page, "retribuzioni");
  });
});

test.describe("storia36 — il portale della persona", () => {
  test.skip(!DEMO_ON, "cattura on-demand: STORIA36_DEMO=1");
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: storageStateFor("employee") });

  test("6 — la propria area: dati, formazione, obiettivi", async ({ page }) => {
    await gotoAuthenticated(page, "/me");
    await page.waitForLoadState("networkidle");
    await scatta(page, "portale-persona");

    await gotoAuthenticated(page, "/me/analytics");
    await page.waitForLoadState("networkidle");
    await scatta(page, "portale-andamento-personale");
  });
});
