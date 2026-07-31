/**
 * apps/web/tests/e2e/organization-editing.spec.ts — l'organigramma si ridisegna dall'interfaccia (#44, linea C1).
 *
 * `POST` e `PATCH /v1/organization-units` esistevano da MVP-1 senza che alcuna
 * pagina li chiamasse. Qui si prova il ciclo completo: creare un'unità,
 * spostarla sotto un'altra, e rileggere ogni volta dall'API.
 *
 * L'unità creata dalla prova viene DISATTIVATA alla fine (l'API espone una
 * cancellazione logica): non resta un ramo vivo appeso all'organigramma vero.
 *
 * Il secondo test è quello che conta davvero: l'API **non** protegge dai cicli
 * (nessun controllo in service, repository o database — misurato). La difesa
 * vive nel selettore, e questa prova la interroga direttamente: fra i genitori
 * proposti non devono comparire né l'unità stessa né una sua discendente.
 */

import { test, expect, type Page } from "@playwright/test";
import { storageStateFor, gotoAuthenticated, API_BASE } from "./fixtures";

test.describe.configure({ retries: 1 });

async function cookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** Cookie + token CSRF SENZA content-type: per DELETE, che non ha corpo.
 *  Dichiarare `application/json` su una richiesta senza corpo fa rispondere
 *  400 a Fastify ("body cannot be empty") — misurato, non supposto. */
async function deleteHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  return {
    cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    "x-csrf-token": cookies.find((c) => c.name === "hrx_csrf")?.value ?? "",
  };
}

test.describe("organigramma — unità create, modificate e spostate dall'interfaccia", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("crea un'unità, la sposta sotto un'altra e verifica ogni passo sull'API", async ({ page, request }) => {
    const cookie = await cookieHeader(page);
    const codice = `E2E-OU-${Date.now()}`;
    let creataId: string | null = null;

    // Spazzata iniziale: se una corsa precedente ha lasciato un'unità di
    // collaudo attiva (è successo), la si disattiva prima di cominciare. Così
    // la prova è idempotente e non accumula rami finti nell'organigramma.
    const residui = await request.get(`${API_BASE}/v1/organization-units?limit=200`, { headers: { cookie } });
    for (const o of (await residui.json()).items as Array<{ organizationUnitId: string; code: string; isActive: boolean }>) {
      if (o.code.startsWith("E2E-OU-") && o.isActive) {
        await request.delete(`${API_BASE}/v1/organization-units/${o.organizationUnitId}`, {
          headers: await deleteHeaders(page),
        });
      }
    }

    try {
      await gotoAuthenticated(page, "/organization");
      await expect(page.getByTestId("organization-page")).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId("orgunit-creator")).toBeVisible();

      // --- creazione dall'interfaccia ---
      await page.getByTestId("orgunit-create-code").fill(codice);
      await page.getByTestId("orgunit-create-name").fill(`Unità di collaudo ${codice}`);
      await page.getByTestId("orgunit-create-type").selectOption("TEAM");
      const [post] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes("/v1/organization-units") && r.request().method() === "POST",
        ),
        page.getByTestId("orgunit-create-submit").click(),
      ]);
      expect(post.status(), "creazione non accettata dall'API").toBe(201);

      // PROVA VERA #1: l'unità esiste sull'API, non solo nel form
      const cercata = await request.get(
        `${API_BASE}/v1/organization-units?limit=200`,
        { headers: { cookie } },
      );
      const tutte = (await cercata.json()).items as Array<{
        organizationUnitId: string; code: string; parentId: string | null;
      }>;
      const creata = tutte.find((o) => o.code === codice);
      expect(creata, "l'unità creata non risulta sull'API").toBeTruthy();
      creataId = creata!.organizationUnitId;

      // --- spostamento: le si assegna un genitore vero ---
      const genitore = tutte.find((o) => o.organizationUnitId !== creataId && o.parentId === null)
        ?? tutte.find((o) => o.organizationUnitId !== creataId);
      expect(genitore, "nessuna unità disponibile come genitore").toBeTruthy();

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByTestId(`organization-edit-${codice}`).click();
      await expect(page.getByTestId("orgunit-editor")).toBeVisible({ timeout: 30_000 });

      await page.getByTestId("orgunit-edit-parent").selectOption(genitore!.organizationUnitId);
      const [patch] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes(`/v1/organization-units/${creataId}`) && r.request().method() === "PATCH",
        ),
        page.getByTestId("orgunit-edit-save").click(),
      ]);
      expect(patch.status(), "spostamento non accettato dall'API").toBe(200);

      // PROVA VERA #2: il genitore è cambiato nel database
      const dopo = await request.get(`${API_BASE}/v1/organization-units/${creataId}`, { headers: { cookie } });
      expect((await dopo.json()).parentId, "lo spostamento non è arrivato al database").toBe(
        genitore!.organizationUnitId,
      );
    } finally {
      // L'unità di collaudo non resta viva nell'organigramma reale — e la
      // pulizia si VERIFICA: la prima stesura non lo faceva e la
      // disattivazione fallì in silenzio, lasciando un residuo attivo.
      if (creataId) {
        const cancellata = await request.delete(`${API_BASE}/v1/organization-units/${creataId}`, {
          headers: await deleteHeaders(page),
        });
        expect(
          cancellata.status(),
          `pulizia non riuscita (HTTP ${cancellata.status()}): l'unità di collaudo resta attiva`,
        ).toBe(204);
        const verifica = await request.get(`${API_BASE}/v1/organization-units/${creataId}`, { headers: { cookie } });
        expect((await verifica.json()).isActive, "l'unità di collaudo risulta ancora attiva").toBe(false);
      }
    }
  });

  test("il selettore del genitore non permette di creare un ciclo", async ({ page, request }) => {
    const cookie = await cookieHeader(page);

    // Serve un'unità che ABBIA almeno una discendente: altrimenti la prova
    // non distingue "esclude la discendenza" da "non esclude nulla".
    const res = await request.get(`${API_BASE}/v1/organization-units?limit=200`, { headers: { cookie } });
    expect(res.ok(), "elenco unità non raggiungibile").toBeTruthy();
    const tutte = (await res.json()).items as Array<{
      organizationUnitId: string; code: string; name: string; parentId: string | null;
    }>;

    const figlio = tutte.find((o) => o.parentId !== null && tutte.some((p) => p.organizationUnitId === o.parentId));
    expect(figlio, "nessuna gerarchia a due livelli su cui provare il ciclo").toBeTruthy();
    const padre = tutte.find((o) => o.organizationUnitId === figlio!.parentId)!;

    await gotoAuthenticated(page, "/organization?limit=200");
    await expect(page.getByTestId("organization-page")).toBeVisible({ timeout: 45_000 });

    // apre il PADRE: fra i suoi genitori possibili non deve comparire né lui
    // stesso né il figlio (lo metterebbe sotto un proprio discendente).
    await page.getByTestId(`organization-edit-${padre.code}`).click();
    await expect(page.getByTestId("orgunit-editor")).toBeVisible({ timeout: 30_000 });

    const menu = page.getByTestId("orgunit-edit-parent");
    await expect(
      menu.locator(`option[value="${padre.organizationUnitId}"]`),
      "il menù propone l'unità come genitore di sé stessa",
    ).toHaveCount(0);
    await expect(
      menu.locator(`option[value="${figlio!.organizationUnitId}"]`),
      "il menù propone una discendente come genitore: creerebbe un ciclo",
    ).toHaveCount(0);

    // controprova: un'unità NON imparentata resta selezionabile, altrimenti
    // il test passerebbe anche con un menù vuoto.
    const estranea = tutte.find(
      (o) =>
        o.organizationUnitId !== padre.organizationUnitId &&
        o.organizationUnitId !== figlio!.organizationUnitId &&
        o.parentId !== padre.organizationUnitId,
    );
    expect(estranea, "nessuna unità estranea per la controprova").toBeTruthy();
    await expect(
      menu.locator(`option[value="${estranea!.organizationUnitId}"]`),
      "il menù è vuoto: la prova sui cicli non proverebbe nulla",
    ).toHaveCount(1);
  });
});
