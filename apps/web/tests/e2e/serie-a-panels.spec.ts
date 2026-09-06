/**
 * apps/web/tests/e2e/serie-a-panels.spec.ts — #30 + #31 (S1018).
 * KPI metrology panel (/kpis) + gap-closure panel (/gaps), live over the
 * 000015/000016/000017 satellites. TENANT_ADMIN.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("Serie-A panels (#30, #31)", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("#31 KPI metrology panel shows the assessment-method + weighting-rule catalogs", async ({ page }) => {
    await page.goto("/kpis");
    await expect(page.getByTestId("kpis-page")).toBeVisible();
    await expect(page.getByTestId("kpi-metrology")).toBeVisible({ timeout: 15_000 });
    // The 5 methods + 3 rules are seeded global catalogs → at least one row each.
    await expect(page.getByTestId("kpi-method-row").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("kpi-rule-row").first()).toBeVisible({ timeout: 15_000 });
  });

  test("#30 gap-closure panel renders plans + analysis results", async ({ page }) => {
    // ⚠ QUESTO CASO ERA VACUO, E DIVENTAVA ROSSO QUANDO IL DATO MIGLIORAVA (corretto S1088).
    // Asseriva `gap-plan-row.first().or(gap-closure)` — ma `gap-closure` è il CONTENITORE,
    // già asserito la riga prima: l'`or` lo rendeva verde sempre, con o senza righe. E
    // `.first()` cadeva sul solo primo termine, quindi appena i piani sono comparsi davvero
    // il locator ha risolto a DUE elementi e ha violato lo strict mode: un caso che passava
    // finché la tabella era vuota e falliva quando si riempiva.
    //
    // Inoltre il commento cablava «36 plans + 270 results»: un conteggio vivo scritto dentro
    // un test invecchia in silenzio (⭐ IL PUNTO FISSO). L'atteso si deriva ora dalle DUE
    // risposte che alimentano le due tabelle, così il caso prova il wiring — «ciò che l'API
    // consegna, la pagina lo rende» — e resta vero qualunque sia il numero.
    const attesaPiani = page.waitForResponse((r) => r.url().includes("/v1/learning-gaps/closure-plans"));
    const attesaEsiti = page.waitForResponse((r) => r.url().includes("/v1/learning-gaps/analysis-results"));

    await page.goto("/gaps");
    await expect(page.getByTestId("gaps-page")).toBeVisible();
    await expect(page.getByTestId("gap-closure")).toBeVisible({ timeout: 15_000 });

    const piani = (await (await attesaPiani).json()) as { items: unknown[] };
    const esiti = (await (await attesaEsiti).json()) as { items: unknown[] };

    // ⚠ E QUI LA PRIMA STESURA HA SBAGLIATO, misurando: chiedeva l'uguaglianza esatta e ha
    // trovato «atteso 35, ricevuti 25». Non è un guasto — la tabella **pagina** (lo stesso
    // `initialPageSize` che in `#219` F2/C teneva fuori un'unità appena creata). Cablare 25
    // rimetterebbe un numero magico destinato a invecchiare, quindi si asserisce la
    // proprietà che regge a qualunque dimensione di pagina.
    const atteso = async (testid: string, quanti: number) => {
      const righe = page.getByTestId(testid);
      if (quanti === 0) {
        // Zero è un esito legittimo — è l'empty-state — ma dev'essere lo ZERO DELL'API.
        await expect(righe).toHaveCount(0, { timeout: 15_000 });
        return;
      }
      // `toHaveCount` non serve qui perché il numero dipende dalla pagina: si attende che
      // almeno una riga sia resa (con auto-retry, non uno scatto istantaneo — F3/G), e si
      // verifica che la pagina non inventi righe che l'API non ha dato.
      await expect(righe.first()).toBeVisible({ timeout: 15_000 });
      expect(await righe.count()).toBeLessThanOrEqual(quanti);
    };
    await atteso("gap-plan-row", piani.items.length);
    await atteso("gap-result-row", esiti.items.length);
  });
});
