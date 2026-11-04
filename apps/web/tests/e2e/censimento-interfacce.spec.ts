/**
 * apps/web/tests/e2e/censimento-interfacce.spec.ts
 *
 * Lotto L7 del piano interfacce (F-5, F-6, F-7): la MISURA che viene prima delle correzioni.
 *
 * Gira solo con `CENSIMENTO=1`: è uno strumento di misura, non un cancello, e la suite
 * ordinaria non deve pagarne il tempo. Il cancello resta `a11y.spec.ts`; questo censimento
 * dice quali pagine aggiungergli e che cosa correggere prima.
 *
 * Per ogni persona e per ogni pagina di prodotto (l'elenco si ricava dalle cartelle di
 * `src/app/(authenticated)`, non da una lista scritta a mano che invecchia):
 *   - se la persona non ha accesso, lo registra e passa oltre;
 *   - le rotte con un parametro si risolvono aprendo la pagina madre e seguendo il primo
 *     collegamento che corrisponde; se non ce n'è, lo registra come «non risolta»;
 *   - axe con WCAG 2.0/2.1/2.2 A e AA: tutte le violazioni, per gravità;
 *   - lo stato in cui la pagina si presenta (caricamento rimasto, vuoto, errore);
 *   - per le pagine `/me`, a 390 pixel di larghezza: scorrimento orizzontale e dati
 *     rimasti nel browser (localStorage, sessionStorage, Cache Storage) e intestazioni
 *     di cache delle risposte `/v1/me/*`.
 *
 * Esito: un file JSON per persona in `test-results/censimento-interfacce/`.
 */

import fs from "node:fs";
import path from "node:path";
import { test, type Page, type Browser } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { storageStateFor, type PersonaKey } from "./fixtures";

const ATTIVO = process.env.CENSIMENTO === "1";
const OUT_DIR = path.resolve(__dirname, "..", "..", "test-results", "censimento-interfacce");
const APP_DIR = path.resolve(__dirname, "..", "..", "src", "app", "(authenticated)");

const PERSONE: readonly PersonaKey[] = ["platformAdmin", "tenantAdmin", "manager", "employee", "outsider", "custodian"];

/** Le rotte di prodotto, dalle cartelle: ogni `page.tsx` sotto il layout autenticato. */
function rotteDiProdotto(): string[] {
  const out: string[] = [];
  const visita = (dir: string, rel: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        const seg = /^\(.*\)$/.test(e.name) ? "" : `/${e.name}`;
        visita(path.join(dir, e.name), rel + seg);
      } else if (e.name === "page.tsx") {
        out.push(rel === "" ? "/" : rel);
      }
    }
  };
  visita(APP_DIR, "");
  return out.sort();
}

interface Esito {
  rotta: string;
  aperta?: string;
  stato: "ok" | "negata" | "non-risolta" | "errore-navigazione";
  nota?: string;
  nodi?: number;
  violazioni?: Record<"critical" | "serious" | "moderate" | "minor", { id: string; nodi: number; aiuto: string; esempio?: string }[]>;
  aspetto?: { caricamentoRimasto: boolean; vuoto: boolean; errore: boolean; testoErrore?: string };
  telefono?: {
    larghezza: number;
    scrollWidth: number;
    scorreInOrizzontale: boolean;
    localStorage: string[];
    sessionStorage: string[];
    cacheStorage: string[];
    risposteMeSenzaNoStore: string[];
  };
}

const scappa = (x: string) => x.replace(/[\\^$.*+?()[\]{}|/-]/g, "\\$&");
const eParametro = (seg: string) => /^\[[^\]]+\]$/.test(seg);

/**
 * L'espressione che riconosce un indirizzo concreto della rotta: ogni segmento alla lettera
 * (scappando ciò che in un'espressione regolare ha un significato), i parametri `[x]` come
 * un segmento qualunque. `aperta` lascia libero ciò che segue (un livello più in giù).
 */
function espressione(segmenti: string[], aperta: boolean): RegExp {
  const corpo = segmenti.map((seg) => (eParametro(seg) ? "[^/?#]+" : scappa(seg))).join("\\/");
  return new RegExp(`^${corpo}${aperta ? "(?:[/?#].*)?" : "(?:[?#].*)?"}$`);
}

/**
 * Risolve una rotta con parametri seguendo i collegamenti, un livello alla volta: dalla pagina
 * madre al primo collegamento che corrisponde fino al primo parametro, poi da lì al secondo, e
 * così via (`/tenant-blueprints/[id]/versions/[n]/build` si trova solo sulla pagina del fascicolo).
 */
async function risolvi(page: Page, rotta: string): Promise<string | null> {
  const segmenti = rotta.split("/");
  const posizioni = segmenti.flatMap((seg, i) => (eParametro(seg) ? [i] : []));
  const finale = espressione(segmenti, false);
  const collegamenti = async (dove: string) => {
    await page.goto(dove);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    return page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
  };
  let dove = segmenti.slice(0, posizioni[0]).join("/") || "/";
  // Un passo per parametro: `/positions/[positionId]/kpis` si trova sulla pagina della
  // posizione, che a sua volta si trova sulla lista. A ogni passo vale prima l'indirizzo
  // finale; se non c'è, si scende di un livello fino al parametro successivo.
  for (const p of posizioni) {
    const hrefs = await collegamenti(dove);
    const diretto = hrefs.find((h) => finale.test(h));
    if (diretto) return diretto;
    const passo = espressione(segmenti.slice(0, p + 1), true);
    let avanti = hrefs.find((h) => passo.test(h) && h !== dove);
    if (!avanti) {
      // Righe cliccabili senza <a>: si prova il clic sulla prima riga di tabella.
      const riga = page.locator("table tbody tr").first();
      if (await riga.count()) {
        await riga.click().catch(() => {});
        await page.waitForTimeout(1500);
        const qui = new URL(page.url()).pathname;
        if (finale.test(qui)) return qui;
        if (passo.test(qui) && qui !== dove) avanti = qui;
      }
    }
    if (!avanti) return null;
    dove = avanti;
  }
  // Dopo l'ultimo parametro resta da trovare la sottopagina, se la rotta ne ha una.
  const hrefs = await collegamenti(dove);
  return finale.test(dove) ? dove : (hrefs.find((h) => finale.test(h)) ?? null);
}

async function aspetta(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .waitForFunction(() => document.querySelectorAll("main *").length > 40, undefined, { timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(800);
}

async function misura(page: Page, rotta: string, aperta: string, telefono: boolean): Promise<Esito> {
  const risposteMe: string[] = [];
  const ascolta = (r: import("@playwright/test").Response) => {
    const u = new URL(r.url());
    // Il browser chiama l'API attraverso il proxy del web (`/api/v1/...`).
    if (!u.pathname.replace(/^\/api(?=\/)/, "").startsWith("/v1/me")) return;
    const cc = r.headers()["cache-control"] ?? "";
    if (!/no-store/i.test(cc)) risposteMe.push(`${u.pathname} [${cc || "nessuna"}]`);
  };
  page.on("response", ascolta);
  try {
    await page.goto(aperta);
  } catch (e) {
    page.off("response", ascolta);
    return { rotta, aperta, stato: "errore-navigazione", nota: String(e).slice(0, 200) };
  }
  await aspetta(page);
  page.off("response", ascolta);

  if (await page.getByTestId("page-no-access").count()) return { rotta, aperta, stato: "negata" };

  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"])
    .analyze();
  const violazioni: NonNullable<Esito["violazioni"]> = { critical: [], serious: [], moderate: [], minor: [] };
  for (const v of r.violations) {
    const k = (v.impact ?? "minor") as keyof typeof violazioni;
    violazioni[k].push({
      id: v.id,
      nodi: v.nodes.length,
      aiuto: v.help,
      ...(v.nodes[0] ? { esempio: v.nodes[0].target.join(" ").slice(0, 160) } : {}),
    });
  }
  const nodi = r.passes.reduce((n, p) => n + p.nodes.length, 0);

  const aspetto = await page.evaluate(() => {
    const testo = (document.querySelector("main")?.textContent ?? "").replace(/\s+/g, " ");
    const errEl = document.querySelector("[role='alert'], [data-testid*='error']");
    return {
      caricamentoRimasto: /Caricamento|Loading/.test(testo) && testo.length < 400,
      vuoto: !!document.querySelector("[data-testid*='empty'], [data-testid='stato-vuoto']"),
      errore: !!errEl,
      ...(errEl ? { testoErrore: (errEl.textContent ?? "").slice(0, 160) } : {}),
    };
  });

  const esito: Esito = { rotta, aperta, stato: "ok", nodi, violazioni, aspetto };

  if (telefono) {
    esito.telefono = await page.evaluate(async () => {
      const el = document.scrollingElement ?? document.documentElement;
      const chiavi = (s: Storage) => Array.from({ length: s.length }, (_, i) => s.key(i) ?? "");
      let cache: string[] = [];
      try {
        cache = "caches" in window ? await caches.keys() : [];
      } catch {
        cache = ["(non leggibile)"];
      }
      return {
        larghezza: window.innerWidth,
        scrollWidth: el.scrollWidth,
        scorreInOrizzontale: el.scrollWidth > window.innerWidth + 1,
        localStorage: chiavi(localStorage),
        sessionStorage: chiavi(sessionStorage),
        cacheStorage: cache,
        risposteMeSenzaNoStore: [],
      };
    });
    esito.telefono.risposteMeSenzaNoStore = [...new Set(risposteMe)];
  }
  return esito;
}

async function censisci(browser: Browser, persona: PersonaKey, telefono: boolean) {
  const ctx = await browser.newContext({
    storageState: storageStateFor(persona),
    ...(telefono ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {}),
  });
  const page = await ctx.newPage();
  const esiti: Esito[] = [];
  const rotte = rotteDiProdotto().filter((r) => (telefono ? r === "/me" || r.startsWith("/me/") : true));
  for (const rotta of rotte) {
    let aperta: string | null = rotta;
    if (rotta.includes("[")) {
      aperta = await risolvi(page, rotta).catch(() => null);
      if (!aperta) {
        esiti.push({ rotta, stato: "non-risolta" });
        continue;
      }
    }
    esiti.push(await misura(page, rotta, aperta, telefono));
  }
  await ctx.close();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const nome = `${persona}${telefono ? "-390" : ""}.json`;
  fs.writeFileSync(path.join(OUT_DIR, nome), JSON.stringify({ persona, telefono, quando: new Date().toISOString(), esiti }, null, 2));
}

test.describe("censimento interfacce (L7: F-5, F-6, F-7)", () => {
  test.skip(!ATTIVO, "solo con CENSIMENTO=1");
  test.describe.configure({ mode: "parallel", timeout: 60 * 60_000 });

  for (const persona of PERSONE) {
    test(`desktop: ${persona}`, async ({ browser }) => {
      await censisci(browser, persona, false);
    });
  }
  for (const persona of ["employee", "outsider", "manager", "tenantAdmin", "custodian"] as const) {
    test(`telefono 390: ${persona}`, async ({ browser }) => {
      await censisci(browser, persona, true);
    });
  }
});
