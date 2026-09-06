/**
 * apps/web/tests/e2e/matching-freetext.spec.ts
 *
 * #40 (S1018) — free-text semantic search LIVE: the query is embedded at request
 * time (Voyage, flag MATCHING_FREETEXT_ENABLED=true in PROD) and ranked against
 * the live pgvector index. Two surfaces: /me/matching (ESS) and /skills (admin
 * catalog). Each search is a billable call — the spec fires exactly one per
 * surface, on explicit submit (the panel never searches on keystroke).
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

// ⚠ QUANDO QUESTI DUE CASI NON VANNO ESEGUITI, E PERCHE' SI DICHIARA INVECE DI FALLIRE.
// `MATCHING_FREETEXT_ENABLED` e' spenta per default e ogni ricerca e' una chiamata a
// PAGAMENTO al fornitore di embedding: accenderla in un ambiente e' una decisione di
// costo, non una scelta tecnica. Dove e' spenta, `GET /v1/matching/search` risponde
// 404 `MATCHING_FREETEXT_DISABLED` e la pagina non mostra righe — e questi due casi
// fallivano come se il prodotto fosse rotto (misurato in CI, giro 34050172629).
//
// ⚠ La condizione e' una VARIABILE DICHIARATA, non una sonda: interrogare l'API per
// sapere se il flag e' acceso costerebbe una chiamata a pagamento in piu' proprio
// dove e' acceso, cioe' raddoppierebbe il costo che questo spec dichiara di avere
// («exactly one per surface»). Chi spegne la ricerca in un ambiente lo dice, e la
// dichiarazione finisce nel referto fra i «non eseguiti» con la sua ragione.
const RICERCA_SPENTA = process.env.E2E_RICERCA_SEMANTICA === "0";
const PERCHE_SALTATO =
  "ricerca semantica dichiarata spenta in questo ambiente (E2E_RICERCA_SEMANTICA=0): " +
  "ogni ricerca e' una chiamata a pagamento al fornitore di embedding. Accenderla e' una " +
  "decisione di costo — vedi le domande aperte in .handoff/STATE.md";

test.describe("free-text semantic search (#40)", () => {
  test.describe("employee on /me/matching", () => {
    test.use({ storageState: storageStateFor("employee") });

    test("submits a query and gets ranked skills + occupations from the live index", async ({ page }) => {
      test.skip(RICERCA_SPENTA, PERCHE_SALTATO);
      await page.goto("/me/matching");
      await expect(page.getByTestId("semantic-search")).toBeVisible();

      await page.getByTestId("semantic-search-input").fill("gestione del rischio bancario");
      await page.getByTestId("semantic-search-submit").click();

      // Query-time embedding + kNN over 25k live embeddings — allow network time.
      await expect(page.getByTestId("semantic-search-skill-row").first()).toBeVisible({ timeout: 20_000 });
      expect(await page.getByTestId("semantic-search-skill-row").count()).toBeGreaterThan(0);
      expect(await page.getByTestId("semantic-search-occ-row").count()).toBeGreaterThan(0);
    });
  });

  test.describe("tenant admin on /skills", () => {
    test.use({ storageState: storageStateFor("tenantAdmin") });

    test("semantic catalog search returns results on the skills page", async ({ page }) => {
      test.skip(RICERCA_SPENTA, PERCHE_SALTATO);
      await page.goto("/skills");
      await expect(page.getByTestId("semantic-search")).toBeVisible();

      await page.getByTestId("semantic-search-input").fill("credit risk");
      await page.getByTestId("semantic-search-submit").click();

      await expect(page.getByTestId("semantic-search-occ-row").first()).toBeVisible({ timeout: 20_000 });
    });
  });
});
