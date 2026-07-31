/**
 * apps/web/tests/e2e/user-dossier.spec.ts — la scheda di una persona racconta la persona (#81).
 *
 * Regressione del rilievo aperto dalla dimostrazione del C12 (storia36):
 * `/users/[id]` — la pagina che chiunque apre per dire «fammi vedere una
 * persona», e che si apre davanti a un cliente — mostrava SOLO l'anagrafica
 * tecnica: identificativi UUID grezzi, fuso orario, una data in formato
 * macchina. Nulla dei 36 mesi presenti nel database.
 *
 * La prova non fotografa dei valori attesi: chiede all'API il dossier della
 * stessa persona e verifica che ciò che il dossier contiene sia ciò che la
 * pagina mostra. Se la storia cresce, il test resta valido; se la pagina torna
 * a mostrare solo l'anagrafica, diventa rosso.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor, gotoAuthenticated, API_BASE } from "./fixtures";

test.describe("scheda persona — il dossier", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("mostra le sezioni della vita lavorativa, non solo l'anagrafica", async ({ page, request }) => {
    // una persona qualunque del tenant, scelta dall'elenco vero
    const lista = await request.get(`${API_BASE}/v1/users?limit=1&search=tommaso.fiore`, {
      headers: { cookie: await cookieHeader(page) },
    });
    expect(lista.ok(), "elenco utenti non raggiungibile").toBeTruthy();
    const items = (await lista.json()).items as Array<{ userId: string; displayName: string }>;
    expect(items.length, "nessun utente trovato per il collaudo").toBeGreaterThan(0);
    const persona = items[0]!;

    const dossierRes = await request.get(`${API_BASE}/v1/users/${persona.userId}/dossier`, {
      headers: { cookie: await cookieHeader(page) },
    });
    expect(dossierRes.ok(), "dossier non raggiungibile").toBeTruthy();
    const dossier = await dossierRes.json();

    await gotoAuthenticated(page, `/users/${persona.userId}`);
    await expect(page.getByTestId("user-detail-page")).toBeVisible();

    // il titolo è il nome della persona, non un segnaposto tecnico
    await expect(page.getByTestId("user-display-name")).not.toContainText(/^IT_[A-Z]{2}_/);

    // ogni sezione del dossier ha il suo posto sulla pagina
    for (const sezione of [
      "positions", "contracts", "payslips", "performance",
      "attendance", "skills", "learning", "certifications", "goals", "career",
    ]) {
      await expect(
        page.getByTestId(`dossier-${sezione}`),
        `sezione assente dalla pagina: ${sezione}`,
      ).toBeVisible();
    }

    // e il contenuto è quello reale: il numero di buste mostrato viene dai dati
    const buste = dossier.paySlips.length as number;
    expect(buste, "il soggetto del collaudo non ha storia retributiva").toBeGreaterThan(0);
    await expect(page.getByTestId("dossier-payslips")).toContainText(String(buste));

    // nessuna data in formato macchina sulla scheda (era uno dei difetti censiti)
    const testo = await page.getByTestId("user-detail-page").innerText();
    expect(testo, "c'è ancora una data ISO non formattata").not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });
});

/** I cookie della sessione già autenticata, per interrogare l'API come la pagina. */
async function cookieHeader(page: import("@playwright/test").Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
