/**
 * apps/web/tests/e2e/admin-catalogues.spec.ts
 *
 * Live-data E2E for admin catalogue pages: /skills, /kpis, /learning, /tenants.
 * Uses storageState — tenantAdmin for skills/kpis/learning (visible via
 * global+tenant filter), platformAdmin for /tenants (PLATFORM_ADMIN-only).
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("MVP-2a admin catalogues — live data", () => {
  test.describe("as tenantAdmin", () => {
    test.use({ storageState: storageStateFor("tenantAdmin") });

    test("/skills shows catalogue with rows", async ({ page }) => {
      await page.goto("/skills");
      await expect(page.getByTestId("skills-page")).toBeVisible();
      await expect(page.getByTestId("skills-count")).toContainText(/\d+\s+skill/);
    });

    /**
     * C4 (#42): the catalogue is served page-by-page — the rendered rows are ONE
     * server page, not a client slice of a `?limit=200` bulk fetch. Asserting
     * rows == pageSize < total AND that page 2 carries different rows proves the
     * slice comes from the server.
     *
     * The visible total is tenant-scoped (global + own tenant). Since migration
     * 000175 the ESCO reference taxonomy is global, so a tenant sees the whole
     * catalogue — which is exactly the case the old `?limit=200` could not serve.
     * The total is read from the live range indicator, never hardcoded.
     */
    test("/skills paginates server-side across the full catalogue", async ({ page }) => {
      await page.goto("/skills");
      await expect(page.getByTestId("skills-page")).toBeVisible();

      const rows = page.getByTestId("skills-row");
      await expect(rows).toHaveCount(25); // one page, not the whole catalogue

      const pagination = page.getByTestId("table-pagination");
      await expect(pagination).toContainText("1–25 di ");

      const total = Number(
        (/di\s+([\d.,\s]+)/.exec(await pagination.innerText())?.[1] ?? "0").replace(/[.,\s]/g, ""),
      );
      expect(total).toBeGreaterThan(200); // beyond the reach of the old `?limit=200`

      const firstBefore = await rows.first().innerText();
      await page.getByTestId("pagination-next").click();
      await expect(pagination).toContainText("26–50 di ");
      await expect(rows.first()).not.toHaveText(firstBefore);
    });

    test("/kpis shows KPI definitions", async ({ page }) => {
      await page.goto("/kpis");
      await expect(page.getByTestId("kpis-page")).toBeVisible();
      // #196 / E22 — il conteggio deve dire DI CHE COSA parla: un indicatore è di
      // piattaforma (catalogo comune) o dell'azienda, e un numero unico somma due
      // specie senza dichiararlo. Il vecchio /\d+\s+KPI/ resterebbe verde anche
      // dopo un ritorno indietro, perché quella parte della frase non cambia.
      await expect(page.getByTestId("kpis-count")).toContainText(
        /\d+\s+KPIs?\s+(definiti|defined)\s+—\s+\d+\s+(di piattaforma|platform),\s+\d+\s+(dell'azienda|company)/,
      );
    });

    test("/learning shows learning modules catalogue", async ({ page }) => {
      await page.goto("/learning");
      await expect(page.getByTestId("learning-page")).toBeVisible();
      // #210 — qui le due specie NON sono un'ipotesi sul futuro come su /kpis: convivono
      // adesso (misurato 2026-08-17: 92 moduli = 77 di piattaforma + 15 dell'azienda), e
      // il vecchio asserto /\d+\s+moduli/ restava verde proprio sul numero misto.
      await expect(page.getByTestId("learning-count")).toContainText(
        /\d+\s+(moduli|modules)\s+—\s+\d+\s+(di piattaforma|platform),\s+\d+\s+(dell'azienda|company)/,
      );
      // e il pannello dei percorsi, che mostrava un numero nudo accanto al titolo
      await expect(page.getByTestId("learning-paths-panel")).toBeVisible();
      await expect(page.getByTestId("learning-paths-count")).toContainText(
        /\d+\s+—\s+\d+\s+(di piattaforma|platform),\s+\d+\s+(dell'azienda|company)/,
      );
    });
  });

  test.describe("as platformAdmin", () => {
    test.use({ storageState: storageStateFor("platformAdmin") });

    test("/tenants shows the tenant registry", async ({ page }) => {
      await page.goto("/tenants");
      await expect(page.getByTestId("tenants-page")).toBeVisible();
      await expect(page.getByTestId("tenants-count")).toContainText(/\d+\s+totali/);
    });
  });
});
