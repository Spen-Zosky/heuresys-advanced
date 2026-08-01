/**
 * apps/web/tests/e2e/learning-paths.spec.ts — percorsi formativi e loro passi (#43, linea C2).
 *
 * `learning-paths` (5 endpoint) e `learning-path-steps` (5) erano gli ultimi
 * due moduli del catalogo formativo senza interfaccia: comporre un percorso —
 * la sequenza ordinata di corsi che porta a un risultato — si faceva solo da
 * database.
 *
 * La prova compone un percorso VERO dall'interfaccia: crea due moduli, crea il
 * percorso, ci mette dentro i due moduli, ne inverte l'ordine e verifica ogni
 * passo sull'API. Poi smonta tutto dall'interfaccia, che è anche il modo di
 * provare le cancellazioni.
 */

import { test, expect, type Page } from "@playwright/test";
import { storageStateFor, gotoAuthenticated, API_BASE } from "./fixtures";

// Prova lunga per costruzione: crea due moduli, un percorso, due passi, li
// riordina e smonta tutto — ~15 chiamate reali. I 30s di default non bastano,
// e allungare qui e' onesto: il tempo lo consuma il lavoro, non un'attesa.
test.describe.configure({ retries: 1, timeout: 120_000 });

async function cookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function writeHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  return {
    cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    "x-csrf-token": cookies.find((c) => c.name === "hrx_csrf")?.value ?? "",
    "content-type": "application/json",
  };
}

async function deleteHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  return {
    cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    "x-csrf-token": cookies.find((c) => c.name === "hrx_csrf")?.value ?? "",
  };
}

test.describe("percorsi formativi", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("compone un percorso con due moduli, ne inverte l'ordine e lo smonta", async ({ page, request }) => {
    const cookie = await cookieHeader(page);
    const marca = Date.now();
    const codPercorso = `E2E-LP-${marca}`;
    const idModuli: string[] = [];
    let percorsoId: string | null = null;

    try {
      // preparazione: due moduli propri, per non dipendere dal catalogo altrui
      const headers = await writeHeaders(page);
      for (const n of [1, 2]) {
        const res = await request.post(`${API_BASE}/v1/learning-modules`, {
          headers,
          data: { code: `E2E-LM-STEP${n}-${marca}`, title: `Modulo ${n} del percorso ${marca}` },
        });
        expect(res.status(), `preparazione fallita (modulo ${n})`).toBe(201);
        idModuli.push(((await res.json()) as { learningModuleId: string }).learningModuleId);
      }

      await gotoAuthenticated(page, "/learning");
      await expect(page.getByTestId("learning-page")).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId("learning-paths-panel")).toBeVisible();

      // --- crea il percorso dall'interfaccia ---
      await page.getByTestId("path-create-toggle").click();
      await page.getByTestId("path-create-code").fill(codPercorso);
      await page.getByTestId("path-create-name").fill(`Percorso di collaudo ${marca}`);
      await page.getByTestId("path-create-outcome").fill("Risultato di collaudo");
      const [postPath] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/v1/learning-paths") && r.request().method() === "POST"),
        page.getByTestId("path-create-submit").click(),
      ]);
      expect(postPath.status(), "creazione percorso non accettata").toBe(201);
      const percorso = (await postPath.json()) as { learningPathId: string; targetOutcome: string | null };
      percorsoId = percorso.learningPathId;
      expect(percorso.targetOutcome, "il risultato atteso non è stato salvato").toBe("Risultato di collaudo");

      // --- lo apre e ci mette dentro i due moduli ---
      await page.getByTestId("path-search").fill(codPercorso);
      await expect(page.getByTestId(`path-open-${codPercorso}`)).toBeVisible({ timeout: 30_000 });
      await page.getByTestId(`path-open-${codPercorso}`).click();
      await expect(page.getByTestId("learning-path-steps-panel")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("learning-steps-empty")).toBeVisible();

      for (const [i, id] of idModuli.entries()) {
        // Oltre mille moduli in catalogo: il modulo si CERCA, non si scorre.
        await page.getByTestId("step-module-search").fill(`E2E-LM-STEP${i + 1}-${marca}`);
        await expect(
          page.getByTestId("step-module").locator(`option[value="${id}"]`),
          "la ricerca non ha trovato il modulo appena creato",
        ).toHaveCount(1, { timeout: 30_000 });
        await page.getByTestId("step-module").selectOption(id);
        const [postStep] = await Promise.all([
          page.waitForResponse((r) => r.url().includes("/v1/learning-path-steps") && r.request().method() === "POST"),
          page.getByTestId("step-add-submit").click(),
        ]);
        expect(postStep.status(), "aggiunta passo non accettata").toBe(201);
      }

      // PROVA VERA #1: il percorso ha due passi, in ordine crescente e distinti
      const stepRes = await request.get(
        `${API_BASE}/v1/learning-path-steps?pathId=${percorsoId}&limit=200`,
        { headers: { cookie } },
      );
      const passi = ((await stepRes.json()).items as Array<{ learningPathStepId: string; moduleId: string; ordinal: number }>)
        .sort((a, b) => a.ordinal - b.ordinal);
      expect(passi, "il percorso non ha i due passi attesi").toHaveLength(2);
      expect(passi[0]!.moduleId, "il primo passo non è il primo modulo").toBe(idModuli[0]);
      expect(passi[1]!.moduleId).toBe(idModuli[1]);
      expect(passi[1]!.ordinal, "i passi non hanno ordini distinti crescenti").toBeGreaterThan(passi[0]!.ordinal);

      // --- inverte l'ordine dall'interfaccia ---
      await expect(page.getByTestId("learning-step-row")).toHaveCount(2, { timeout: 15_000 });
      // Lo scambio richiede TRE chiamate: (percorso, ordine) e' unico sul
      // database, quindi il passo che sale parcheggia su un ordine libero
      // prima di prendere il posto dell'altro. Si attende l'ultima.
      await page.getByTestId(`step-up-${passi[1]!.ordinal}`).click();
      await expect
        .poll(
          async () => {
            const res = await request.get(
              `${API_BASE}/v1/learning-path-steps?pathId=${percorsoId}&limit=200`,
              { headers: { cookie } },
            );
            const righe = (await res.json()).items as Array<{ moduleId: string; ordinal: number }>;
            return righe.find((s) => s.moduleId === idModuli[1])?.ordinal;
          },
          { timeout: 30_000, message: "il riordino non e' arrivato al database" },
        )
        .toBe(passi[0]!.ordinal);

      // PROVA VERA #2: e il PRIMO modulo ha preso l'ordine del secondo — cioe'
      // si sono davvero scambiati, non e' solo sceso uno dei due.
      const dopoRes = await request.get(
        `${API_BASE}/v1/learning-path-steps?pathId=${percorsoId}&limit=200`,
        { headers: { cookie } },
      );
      const dopo = (await dopoRes.json()).items as Array<{ moduleId: string; ordinal: number }>;
      expect(
        dopo.find((s) => s.moduleId === idModuli[0])?.ordinal,
        "i due passi non si sono scambiati: il primo non ha preso l'ordine del secondo",
      ).toBe(passi[1]!.ordinal);
    } finally {
      // smontaggio: passi, poi percorso, poi moduli — l'ordine conta
      const dh = await deleteHeaders(page);
      if (percorsoId) {
        const stepRes = await request.get(
          `${API_BASE}/v1/learning-path-steps?pathId=${percorsoId}&limit=200`,
          { headers: { cookie } },
        );
        if (stepRes.ok()) {
          for (const s of (await stepRes.json()).items as Array<{ learningPathStepId: string }>) {
            const d = await request.delete(`${API_BASE}/v1/learning-path-steps/${s.learningPathStepId}`, { headers: dh });
            expect(d.status(), "pulizia passo non riuscita").toBe(204);
          }
        }
        const dp = await request.delete(`${API_BASE}/v1/learning-paths/${percorsoId}`, { headers: dh });
        expect(dp.status(), "pulizia percorso non riuscita").toBe(204);
      }
      for (const id of idModuli) {
        const dm = await request.delete(`${API_BASE}/v1/learning-modules/${id}`, { headers: dh });
        expect(dm.status(), "pulizia modulo non riuscita").toBe(204);
      }
    }
  });
});
