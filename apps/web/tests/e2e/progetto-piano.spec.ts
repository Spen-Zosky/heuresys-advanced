/**
 * apps/web/tests/e2e/progetto-piano.spec.ts
 *
 * V7 del piano docs/piani/PIANO_processi-e-progetti-sistematici_20261118.md: il piano di un progetto
 * (fasi, Gantt, dipendenze) sulla pagina del progetto, su dati reali e con un login vero.
 *
 * ⚠ Gira sulla produzione: la prova LEGGE soltanto. Che le scritture funzionino lo dice
 * apps/api/test/project-plan.integration.test.ts, in una transazione che torna indietro. Qui si
 * guarda che la pagina mostri lo stesso numero di voci e di dipendenze che dà l'API, e che il
 * Gantt compaia se e solo se il piano ha delle date.
 */
import { test, expect } from "@playwright/test";

import { storageStateFor } from "./fixtures";

type Scheda = {
  phases: Array<{ plannedStart: string | null; plannedEnd: string | null; actualStart: string | null; actualEnd: string | null }>;
  dependencies: unknown[];
  canManage: boolean;
};

test.describe("V7 — il piano del progetto, dati live", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("la scheda Piano, il Gantt e le dipendenze dicono ciò che dice l'API", async ({ page }) => {
    await page.goto("/projects");
    await page.getByTestId("project-link").first().click();
    await page.waitForURL(/\/projects\/[0-9a-f-]+$/);
    const id = page.url().split("/").pop()!;

    const risposta = await page.request.get(`/api/v1/projects/${id}/scheda`);
    expect(risposta.ok()).toBeTruthy();
    const s = (await risposta.json()) as Scheda;

    await expect(page.getByTestId("project-plan")).toBeVisible();
    if (s.phases.length === 0) {
      await expect(page.getByTestId("project-plan-empty")).toBeVisible();
    } else {
      await expect(page.getByTestId("project-phase-row")).toHaveCount(s.phases.length);
    }
    // chi ha un mandato HR può pianificare: il comando c'è se e solo se l'API lo concede
    await expect(page.getByTestId("project-phase-add")).toHaveCount(s.canManage ? 1 : 0);

    await page.getByTestId("scheda-gantt").click();
    const conDate = s.phases.some((f) => f.plannedStart || f.plannedEnd || f.actualStart || f.actualEnd);
    if (conDate) {
      await expect(page.getByTestId("project-gantt")).toBeVisible();
    } else {
      await expect(page.getByTestId("project-gantt-empty")).toBeVisible();
    }

    await page.getByTestId("scheda-dipendenze").click();
    if (s.dependencies.length === 0) {
      await expect(page.getByTestId("project-dependencies-empty")).toBeVisible();
    } else {
      await expect(page.getByTestId("project-dependency-row")).toHaveCount(s.dependencies.length);
      await expect(page.getByTestId("project-dependency-graph")).toBeVisible();
    }
  });
});
