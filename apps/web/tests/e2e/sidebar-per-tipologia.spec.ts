/**
 * apps/web/tests/e2e/sidebar-per-tipologia.spec.ts
 *
 * #99 F8b — l'ultimo passo dell'epica dei domini, verificato DAL LATO DELL'UTENTE.
 *
 * F7 ha reso la sidebar una DERIVAZIONE: una tipologia vede una voce se e solo se esiste
 * almeno una cella non-`none` fra i suoi domini e le classi che quella pagina espone (M3).
 * Le prove di F7 girano contro la funzione e contro l'API. Qui si prova ciò che quelle non
 * possono: che **il browser mostri esattamente la risposta dell'API**, e che la derivazione
 * **discrimini davvero** fra tipologie diverse.
 *
 * ⚠ LA TRAPPOLA DA CUI QUESTO FILE SI DIFENDE — la tautologia. Confrontare la sidebar con
 * `GET /v1/me/interfaces` prova che l'interfaccia non aggiunge e non toglie, ma da sola
 * quella prova resterebbe verde anche se l'API rispondesse la STESSA cosa a tutti: un menu
 * uguale per chiunque soddisfa «DOM == API» alla perfezione. Perciò c'è un secondo blocco:
 * le tipologie devono vedere insiemi DIVERSI, e chi non ha alcun dominio deve vedere
 * strettamente MENO di chi ha un mandato. Senza quel blocco, questo file non misurerebbe
 * la derivazione — misurerebbe soltanto che due letture della stessa risposta coincidono.
 *
 * Nessuna rotta attesa è scritta a mano: l'attesa è la risposta dell'API per quella stessa
 * sessione, e i confronti fra tipologie sono relazioni (⊂, ≠), non elenchi.
 */

import { test, expect, type Page } from "@playwright/test";
import { API_BASE, storageStateFor, type PersonaKey } from "./fixtures";

// Come lo smoke delle personas: in dev il primo giro compila a richiesta.
test.describe.configure({ retries: 1, timeout: 90_000 });

/** Le rotte che la sidebar mostra DAVVERO nel browser. */
async function vociNelBrowser(page: Page): Promise<Set<string>> {
  await page.waitForSelector("aside a[href^='/']", { timeout: 45_000 });
  const href = await page.locator("aside a[href^='/']").evaluateAll(
    (nodi) => nodi.map((n) => (n as HTMLAnchorElement).getAttribute("href") ?? ""),
  );
  return new Set(href.filter(Boolean));
}

/** Le rotte che l'API dichiara per la stessa sessione. */
async function vociDallApi(page: Page): Promise<Set<string>> {
  const r = await page.request.get(`${API_BASE}/v1/me/interfaces`);
  expect(r.status(), "GET /v1/me/interfaces").toBe(200);
  const body = (await r.json()) as {
    perspectives: { interfaces: { route: string }[] }[];
  };
  const out = new Set<string>();
  for (const p of body.perspectives) for (const i of p.interfaces) out.add(i.route);
  return out;
}

/** Le voci raggruppate per prospettiva, come le dichiara l'API per questa sessione. */
async function perspettiveDallApi(page: Page): Promise<Map<string, string[]>> {
  const r = await page.request.get(`${API_BASE}/v1/me/interfaces`);
  expect(r.status(), "GET /v1/me/interfaces").toBe(200);
  const body = (await r.json()) as {
    perspectives: { code: string; interfaces: { route: string }[] }[];
  };
  return new Map(body.perspectives.map((p) => [p.code, p.interfaces.map((i) => i.route)]));
}

const TIPOLOGIE: { key: PersonaKey; landing: string }[] = [
  { key: "platformAdmin", landing: "/dashboard" },
  { key: "tenantAdmin", landing: "/dashboard" },
  { key: "manager", landing: "/dashboard" },
  { key: "employee", landing: "/dashboard" },
  { key: "outsider", landing: "/me" },
];

const raccolte = new Map<PersonaKey, Set<string>>();

for (const t of TIPOLOGIE) {
  test.describe(`sidebar — ${t.key}`, () => {
    test.use({ storageState: storageStateFor(t.key) });

    test(`mostra esattamente ciò che l'API dichiara`, async ({ page }) => {
      await page.goto(t.landing);
      const dom = await vociNelBrowser(page);
      const api = await vociDallApi(page);

      // L'interfaccia non INVENTA: ogni voce mostrata è dichiarata dall'API. È la
      // direzione che conta di più — una voce in più è un menu che mente.
      for (const rotta of dom) {
        expect(api.has(rotta), `la sidebar mostra ${rotta}, che l'API non dichiara`).toBe(true);
      }
      // ...e non NASCONDE: ogni voce dichiarata è raggiungibile. Le voci assorbite come
      // schede (S1009) non stanno nel registro, quindi il confronto regge nei due versi.
      for (const rotta of api) {
        expect(dom.has(rotta), `l'API dichiara ${rotta}, che la sidebar non mostra`).toBe(true);
      }
      expect(dom.size, "una sidebar vuota non prova niente").toBeGreaterThan(0);
      raccolte.set(t.key, dom);
    });
  });
}

test.describe("la derivazione discrimina — il blocco anti-tautologia", () => {
  test.use({ storageState: storageStateFor("outsider") });

  test("chi non ha alcun dominio vede STRETTAMENTE MENO di chi ha un mandato", async ({ page }) => {
    // Si ri-raccoglie qui invece di fidarsi dell'ordine dei test: un file che dipende
    // dall'ordine di esecuzione è verde per caso, non per costruzione.
    await page.goto("/me");
    const outsider = await vociNelBrowser(page);

    const ctx = await page.context().browser()!.newContext({
      storageState: storageStateFor("platformAdmin"),
      baseURL: page.url().replace(/\/me.*$/, ""),
    });
    const p2 = await ctx.newPage();
    await p2.goto("/dashboard");
    const admin = await vociNelBrowser(p2);
    await ctx.close();

    // Sottoinsieme PROPRIO: l'area personale è il pavimento universale (I17) e la vedono
    // entrambi; tutto il resto no. Se i due insiemi coincidessero, la derivazione non
    // starebbe derivando niente — ed è esattamente il caso che le prove sull'API, da sole,
    // non potrebbero distinguere.
    expect(admin.size, "l'amministratore deve vedere più voci dell'estraneo").toBeGreaterThan(
      outsider.size,
    );
    for (const rotta of outsider) {
      expect(admin.has(rotta), `l'estraneo vede ${rotta}, l'amministratore no`).toBe(true);
    }
    // E il verso che conta: nessuna superficie di GOVERNO all'estraneo.
    //
    // ⚠ La prima stesura chiedeva «l'estraneo vede solo `/me/*`» ed è andata ROSSA su un caso
    // vero: `antonio.parisi` vede `/organization/org-chart`, che è WORKFORCE. Misurato prima
    // di cambiare qualunque cosa: quella voce **non dichiara alcuna classe di dato**, e per M3
    // ciò significa «non espone dati di persona» — affermazione falsa per un organigramma, ed
    // è la stessa famiglia del difetto corretto su `dashboard` nella mig. 000315. Ma
    // dichiararle `PERSONAL` toglierebbe l'organigramma a **117 persone su 161** (quelle senza
    // alcun dominio, misurate il 2026-08-16): è una decisione di PRODOTTO, non una bonifica, e
    // sta a Enzo — registrata come voce a sé. Qui si asserisce quindi la regola che vale oggi
    // e che discrimina davvero: le prospettive amministrative restano vuote.
    const perGruppo = await perspettiveDallApi(page);
    for (const codice of ["GOVERNANCE", "INTELLIGENCE"]) {
      expect(
        perGruppo.get(codice) ?? [],
        `l'estraneo vede voci ${codice}, che esigono un dominio`,
      ).toEqual([]);
    }
  });
});
