/**
 * apps/web/tests/e2e/a11y.spec.ts
 *
 * Acceptance MVP-2a #7 — accessibility audit con axe-core.
 *
 * Per ogni pagina autenticata di ogni persona group, esegue axe-core
 * filtrato sui ruleset WCAG 2.0 A/AA + WCAG 2.1 A/AA e asserisce ZERO
 * violazioni con impact "critical". Le altre (serious/moderate/minor)
 * vengono raccolte come tail-items per MVP-3 (vedi docs/a11y-tail-items.md).
 *
 * I tre persona group condividono storageState già preparato da auth.setup.ts:
 *   - platformAdmin: route admin scope PLATFORM (incl. /tenants, /admin/roles)
 *   - tenantAdmin:   route admin scope TENANT  (resto del set admin)
 *   - employee:      route ESS /me/*
 *
 * Live data: l'API gira contro DB OCI VM via tunnel :5433 (no mock).
 *
 * Note di esecuzione:
 *   - dev mode è compile-on-demand → prima request a una route è lenta.
 *     retries=1 assorbe la flake; ogni axe scan dura 2-6s a regime.
 *   - violazioni serious/moderate/minor sono loggate ma NON failano il test.
 *   - per scan dettagliato di una singola pagina: pnpm exec playwright test
 *     a11y.spec.ts -g "<route>"
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { storageStateFor } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

const AUDIT_OUT_DIR = path.resolve(__dirname, "..", "..", "test-results", "a11y-audit");

test.describe.configure({ retries: 1 });

type AxeImpact = "critical" | "serious" | "moderate" | "minor";

// #219 F5d-bis (2026-08-27) — LA SOGLIA DI NON-VACUITÀ, PER ROTTA.
//
// La guardia sotto distingue una pagina VIVA da un GUSCIO contando i nodi che axe esamina.
// Il default di 40 è tarato sulle pagine applicative, e per quelle è larghissimo: misurate,
// stanno fra 500 e 14.023 nodi. Ma `/privacy` è un'informativa statica — 11 sezioni di testo,
// niente tabelle, niente dati — e ne esamina **41**: passava per UN NODO, e nella corsa del
// 2026-08-26 ne aveva 40, cioè falliva per uno. Il verde e il rosso erano ugualmente casuali.
//
// La cura NON è alzare o abbassare il default: renderebbe cieca la guardia proprio dove serve.
// È dichiarare la soglia per la rotta che sta legittimamente in basso, con la sua ragione e i
// suoi numeri — che è ciò che il commento della guardia prescriveva già: «se una rotta legittima
// le sta sotto, il messaggio dice quale e quanti nodi ha, e la si valuta».
//
// Perché 25 discrimina ancora, invece di far tacere il rosso: un guscio misurato vale **17**
// nodi (`/admin/roles` in vista mobile, il caso H di #219 F4 — uno sfondo con «Caricamento…»),
// e `/privacy` renderizzata ne vale **41** (misurato oggi su entrambi i progetti Playwright,
// chromium e mobile-a11y). La soglia sta in mezzo: coglie il guscio, non il contenuto.
//
// Margini misurati il 2026-08-27 sulle altre pubbliche, che restano sul default:
//   /login 63 (+23) · / 130 (+90) · /demo 164 (+124) · /investors 169 (+129).
const SOGLIA_NODI_DEFAULT = 40;
const SOGLIA_NODI_PER_ROTTA: Readonly<Record<string, number>> = {
  "/privacy": 25,
};

const PAGES_PER_PERSONA = {
  platformAdmin: ["/dashboard", "/tenants", "/admin/roles", "/users", "/system-health"],
  tenantAdmin: [
    "/dashboard",
    "/users",
    "/positions",
    "/blueprints",
    "/skills",
    "/kpis",
    "/learning",
    "/gaps",
    "/career-succession",
    "/compensation-intelligence",
    "/organization",
    "/processes",
    "/seed-acquisition/runs",
    // ⚠ `/brownfield-adaptation` TOLTA il 2026-08-27 (#219 F5d-bis): il prodotto NON HA PIU'
    // quella pagina. `77b52e04` (#164 F3) ha fatto uscire la funzionalita' brownfield — 4 moduli
    // API, 4 schemi condivisi e la pagina — dopo aver misurato che le superfici ETL erano gia'
    // spente in produzione. Ri-misurato oggi: la directory non esiste in apps/web/src/app, e
    // `sys.sys_ui_interfaces` ha **0 righe** con route ilike '%brownfield%'.
    // Il ritiro era stato fatto a META': `admin-pipelines.spec.ts` aveva rimosso il proprio caso
    // con la motivazione scritta, ma questo elenco e quello di `f4-sweep.spec.ts` erano rimasti
    // indietro. Il rosso che ne usciva NON era un guasto di rendering: era la guardia
    // anti-vacuita' che faceva il suo mestiere su una 404 (21 nodi esaminati).
    // Se un giorno la pagina tornasse, tornera' col proprio caso: non si tiene in vita una riga
    // per tenere il posto.
    "/visualizations",
    "/learning/training-initiatives",
    "/organization/org-chart",
  ],
  employee: [
    "/me",
    "/me/profile",
    "/me/positions",
    "/me/skills",
    "/me/skills/self-assessment",
    "/me/learning",
    "/me/learning/catalogue",
    "/me/gaps",
    "/me/kpis",
    "/me/career",
    "/me/career/target",
    "/me/certifications",
    "/me/documents",
    "/me/inbox",
    "/me/security",
  ],
} as const satisfies Record<string, readonly string[]>;

async function runAxeOnRoute(page: Page, route: string, testInfo: TestInfo) {
  await page.goto(route);
  await page.waitForLoadState("networkidle").catch(() => {
    // networkidle may not settle on pages with long-poll websockets; ignore
  });

  // D-24 anti-vacuity guard: an expired session is redirected server-side to
  // /login BEFORE any client API call, and the login page audits clean — the
  // census would silently "pass" on the wrong page (97 vacuous passes, S984).
  // URL-based (not testid) so it holds on the Pixel 7 mobile-a11y project too.
  const audited = new URL(page.url()).pathname;
  expect(audited, `dead session: requested ${route}, audited ${audited}`).toBe(route);

  // Wait for the root layout to inject <html lang> before axe runs — ensures
  // the SSR lang attribute is present in the DOM (Next.js SPA transitions can
  // produce a brief window where lang is absent, causing spurious html-has-lang
  // violations). 3 s timeout is generous; in practice < 100 ms after networkidle.
  await page.waitForFunction(
    () => document.documentElement.getAttribute("lang") != null,
    undefined,
    { timeout: 3000 },
  ).catch(() => {
    // If the attribute still is not present after 3 s, let axe detect and report
    // the real violation (don't silently swallow it).
  });

  // #219 F4 — SI ASPETTA CHE LA PAGINA CI SIA, non che la rete taccia.
  // `networkidle` si risolve anche mentre la pagina mostra ancora «Caricamento…»: lo
  // screenshot del fallimento del 2026-08-23 è esattamente quello, uno sfondo vuoto con
  // quella parola al centro. Axe fotografava lo scheletro — 17 nodi — e non trovava
  // violazioni perché non c'era niente su cui trovarne.
  // L'attesa è sul CONTENUTO renderizzato, non su un testid: questa funzione gira su
  // decine di rotte diverse e non può conoscerli tutti. Se scade, non si interrompe qui:
  // si lascia parlare l'asserzione sotto, che dice quanti nodi ha visto e perché non basta.
  // La soglia è quella della rotta (vedi SOGLIA_NODI_PER_ROTTA): attendere `> 40` su una
  // pagina che ne ha 41 significava stare 30 s appesi a un'attesa che si risolveva per un
  // pelo — o non si risolveva affatto, lasciando che axe fotografasse un rendering parziale.
  const sogliaNodi = SOGLIA_NODI_PER_ROTTA[route] ?? SOGLIA_NODI_DEFAULT;
  await page.waitForFunction(
    (soglia) => document.querySelectorAll("main *, [role='main'] *").length > soglia,
    sogliaNodi,
    { timeout: 30_000 },
  ).catch(() => { /* diagnosi all'asserzione di non-vacuità, con il numero misurato */ });

  const results = await new AxeBuilder({ page })
    // WCAG 2.0 A/AA + 2.1 A/AA + 2.2 A/AA (Tappa G — extended ruleset).
    // The 2.2 additions cover: focus-not-obscured, focus-appearance (AAA),
    // target-size minimum (AA), dragging-movements, consistent-help,
    // redundant-entry, accessible-authentication.
    .withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "wcag22a",
      "wcag22aa",
    ])
    .analyze();

  // #219 F4 — LA SECONDA GUARDIA ANTI-VACUITÀ, e nasce da un sabotaggio riuscito.
  // La guardia sull'URL qui sopra intercetta la sessione morta (si finiva su /login, che
  // è pulito: 97 passaggi vacui, S984). NON intercetta una pagina che risponde sulla rotta
  // giusta senza renderizzare il contenuto — e lì axe non trova violazioni per la ragione
  // peggiore: non c'è niente da esaminare.
  //
  // Misurato il 2026-08-23 su `/admin/roles` in vista mobile, il caso `H` di #219: verde,
  // `critical=0 serious=0 moderate=0 minor=0`. Iniettata di proposito un'immagine SENZA
  // testo alternativo — che axe classifica `critical` — il caso è rimasto VERDE. Il motivo
  // lo dicono i numeri nuovi del referto: **17 nodi esaminati**, cioè un guscio. Una pagina
  // di amministrazione con tabelle e ruoli ne ha centinaia.
  //
  // La soglia è volutamente bassa: non misura la ricchezza di una pagina, distingue una
  // pagina VIVA da un guscio. Se una rotta legittima le sta sotto, il messaggio dice quale
  // e quanti nodi ha — e la si valuta, invece di alzare il numero per far tacere il rosso.
  const nodiEsaminati = results.passes.reduce((n, r) => n + r.nodes.length, 0);
  expect(
    nodiEsaminati,
    `pagina non renderizzata: ${route} ha esaminato solo ${nodiEsaminati} nodi (soglia ` +
      `${sogliaNodi}${sogliaNodi === SOGLIA_NODI_DEFAULT ? "" : ", dichiarata per questa rotta"}` +
      `) — «nessuna violazione» qui non vuol dire accessibile, vuol dire che non c'era ` +
      `niente da guardare`,
  ).toBeGreaterThan(sogliaNodi);

  const bySeverity = {
    critical: [] as typeof results.violations,
    serious: [] as typeof results.violations,
    moderate: [] as typeof results.violations,
    minor: [] as typeof results.violations,
  };
  for (const v of results.violations) {
    const impact = (v.impact ?? "minor") as AxeImpact;
    bySeverity[impact].push(v);
  }

  // Write a compact per-route audit summary to disk. Persistent across
  // pass/fail (unlike testInfo.attach, which Playwright drops for passing
  // tests when reporter "list" + no HTML report is configured). The aggregate
  // is consumed by docs/a11y-tail-items.md for MVP-3 prioritization.
  const summary = (Object.entries(bySeverity) as [AxeImpact, typeof results.violations][])
    .map(([k, arr]) => `${k}=${arr.length}`)
    .join(" ");
  // Namespace per Playwright project (chromium / mobile-a11y) so a mobile
  // run does not overwrite the desktop JSONs.
  const outDir = path.join(AUDIT_OUT_DIR, testInfo.project.name || "default");
  fs.mkdirSync(outDir, { recursive: true });
  const flatName = route.replace(/^\//, "").replace(/\//g, "__") || "root";
  fs.writeFileSync(
    path.join(outDir, `${flatName}.json`),
    JSON.stringify(
      {
        route,
        summary,
        // #219 F4 — QUANTO AXE HA DAVVERO GUARDATO. Senza questo numero, «zero violazioni»
        // non si distingue da «non c'era niente da controllare»: la guardia anti-vacuità
        // qui sopra intercetta la sessione morta (si finiva su /login, che è pulito), ma
        // NON una pagina che ha risposto sulla rotta giusta senza renderizzare il
        // contenuto. `passes` sono le regole superate su nodi reali: su una pagina viva
        // sono decine, su un guscio vuoto crollano — ed è l'unico modo per accorgersene
        // leggendo il referto invece di rifare la corsa.
        regoleSuperate: results.passes.length,
        nodiEsaminati: results.passes.reduce((n, r) => n + r.nodes.length, 0),
        timestamp: new Date().toISOString(),
        violations: results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
          help: v.help,
          helpUrl: v.helpUrl,
          // QUALI nodi, non solo quanti: senza selettore e motivo, ogni
          // violazione richiede una caccia manuale nel DOM — ed e' uno dei
          // motivi per cui #82 e' rimasta aperta a lungo.
          targets: v.nodes.map((n) => ({
            target: n.target,
            html: n.html.slice(0, 300),
            why: n.failureSummary ?? null,
          })),
        })),
      },
      null,
      2,
    ),
  );
  await testInfo.attach(`axe-${flatName}.json`, {
    path: path.join(outDir, `${flatName}.json`),
    contentType: "application/json",
  });

  // Hard gate: critical violations must be zero.
  if (bySeverity.critical.length > 0) {
    const details = bySeverity.critical
      .map((v) => `  - [${v.id}] ${v.help} (${v.nodes.length} nodes)`)
      .join("\n");
    expect(
      bySeverity.critical.length,
      `Critical a11y violations on ${route}:\n${details}`,
    ).toBe(0);
  }

  // Hard gate (raised S982, per docs/a11y-tail-items.md §3 once stable): the
  // serious tail is CLOSED — `list` fixed in S981, `color-contrast` retuned in
  // S982 (179 nodes → 0, app-level tokens). Keep it closed.
  if (bySeverity.serious.length > 0) {
    const details = bySeverity.serious
      .map((v) => `  - [${v.id}] ${v.help} (${v.nodes.length} nodes)`)
      .join("\n");
    expect(
      bySeverity.serious.length,
      `Serious a11y violations on ${route}:\n${details}`,
    ).toBe(0);
  }
}

for (const [persona, pages] of Object.entries(PAGES_PER_PERSONA)) {
  test.describe(`a11y as ${persona}`, () => {
    test.use({ storageState: storageStateFor(persona as keyof typeof PAGES_PER_PERSONA) });

    for (const route of pages) {
      test(`${route} has no critical a11y violations`, async ({ page }, testInfo) => {
        await runAxeOnRoute(page, route, testInfo);
      });
    }
  });
}

/**
 * #4 GTM W4 — le pagine PUBBLICHE, sottoposte alla stessa asticella di quelle interne.
 *
 * Erano l'unica parte del sito senza controllo di accessibilità, ed è la parte che vede
 * chi non ci conosce ancora: un investitore, un potenziale cliente, chi arriva da una
 * ricerca. Sono anche le uniche pagine che si visitano SENZA sessione, quindi il blocco
 * gira con uno stato di autenticazione vuoto — con lo storageState di un'altra persona
 * si starebbe misurando la versione autenticata del sito.
 *
 * Il register chiedeva «Lighthouse ≥95». Qui si usa axe-core, che era già in casa e su
 * cui il punteggio di accessibilità di Lighthouse è in larga parte costruito: dà le
 * violazioni per nome invece di un numero, è deterministico e non aggiunge dipendenze.
 * L'asticella è più alta di ≥95, non più bassa: ZERO violazioni critical e serious.
 */
const PUBLIC_PAGES = ["/", "/investors", "/demo", "/login", "/privacy"] as const;

test.describe("a11y delle pagine pubbliche", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const route of PUBLIC_PAGES) {
    test(`${route} has no critical a11y violations`, async ({ page }, testInfo) => {
      await runAxeOnRoute(page, route, testInfo);
    });
  }
});
