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

/**
 * #219 F2/C — LA TABELLA È PAGINATA, e questi due casi non se n'erano accorti.
 *
 * La firma registrata dal triage di `#211` F4 diceva «`orgunit-editor` non visibile (30 s)»,
 * cioè: l'editor non si apre. **Non era quello.** Riprodotto il 2026-08-23, l'errore vero è
 * un altro e cade prima:
 *
 *     TimeoutError: locator.click: Timeout 10000ms exceeded.
 *       waiting for getByTestId('organization-edit-E2E-OU-1787516057234')
 *
 * Il click fallisce perché il PULSANTE non c'è — l'unità appena creata, che la riga sopra ha
 * appena verificato esistere sull'API, non è nel DOM. L'editor non c'entra: non ci si arriva.
 * È il motivo per cui il piano di questa voce prescrive di riprodurre prima di correggere —
 * «sono FIRME, non cause», e questa ne nascondeva una diversa.
 *
 * LA CAUSA, e ha un numero: `page.tsx` porta il commento `C4 (#42): server-side pagination
 * (was ?limit=200)`. La pagina carica **25 righe per volta** (`initialPageSize = 25` in
 * `use-paginated-list.ts`) e l'API ordina per `organization_unit_code` — con 42 unità
 * misurate, un codice `E2E-OU-…` finisce in **pagina 2**, dove il test non ha mai guardato.
 * Il caso era stantio rispetto a un cambiamento di prodotto successivo, esattamente come i
 * due di `insights-*` lo erano rispetto ad ADR-0032.
 *
 * IL RIMEDIO NON È ALZARE UN LIMITE: si sfoglia, che è ciò che farebbe una persona davanti
 * a quella tabella. Alzare le righe per pagina renderebbe verde il caso e lo rifarebbe
 * cieco al giorno in cui le unità superano il nuovo numero.
 */
async function vaiAllaRigaDi(page: Page, testId: string): Promise<void> {
  const bersaglio = page.getByTestId(testId);
  const barra = page.getByTestId("table-pagination");
  await expect(barra).toBeVisible({ timeout: 30_000 });
  for (let giro = 0; giro < 20; giro += 1) {
    if (await bersaglio.count() > 0) return;
    const avanti = page.getByTestId("pagination-next");
    // Ultima pagina: il pulsante c'è ma è disabilitato. Fermarsi qui e lasciare che sia
    // l'asserzione del chiamante a fallire dà un errore che dice cosa manca — continuare
    // a cliccare un pulsante spento darebbe un timeout muto.
    if (await avanti.count() === 0 || await avanti.isDisabled()) return;
    // ⚠ SI ASPETTA CHE L'INTERVALLO CAMBI, non che la barra sia visibile: la barra è
    // visibile sempre, anche mentre la pagina nuova sta ancora arrivando. La prima
    // stesura di questo helper aspettava lei, quindi non aspettava NIENTE — e con due
    // sole pagine il ciclo usciva subito perché al secondo giro «Successivo» era già
    // disabilitato, mentre le righe nuove non erano ancora nel DOM. Verde in teoria,
    // rosso identico a prima nei fatti.
    const prima = (await barra.textContent()) ?? "";
    await avanti.click();
    await expect(barra).not.toHaveText(prima, { timeout: 15_000 });
  }
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
      await vaiAllaRigaDi(page, `organization-edit-${codice}`);   // #219 F2/C: la tabella è paginata
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
    await vaiAllaRigaDi(page, `organization-edit-${padre.code}`);   // #219 F2/C: la tabella è paginata
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
