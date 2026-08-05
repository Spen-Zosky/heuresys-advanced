/**
 * apps/web/tests/e2e/smoke-5-personas.spec.ts
 *
 * Acceptance MVP-2a #6 — smoke test 5 personas.
 *
 * Per ognuna delle 5 personas seedate da db/scripts/seed-test-admin.ts:
 *   1. login → landing redirect attesa (/dashboard o /me)
 *   2. nav role-gated rispettata (admin nav per i 3 admin, "My HR" sempre)
 *   3. naviga 2 pagine extra senza errore
 *
 * Tutte le rotte sono live: API reale, DB OCI VM via tunnel :5433. Le credenziali
 * vengono dai PERSONAS in fixtures.ts; lo storageState è generato da auth.setup.ts.
 */

import { test, expect, type Page } from "@playwright/test";
import { storageStateFor, type PersonaKey } from "./fixtures";

// Dev-mode runtime (Next.js compile-on-demand, Tailwind 4 JIT, no warm cache)
// can spike past the 30s default test timeout when the smoke walks through
// 3-4 cold routes in a row. Allow one retry per test (the second run hits
// warm chunks) and bump per-test timeout to 90s.
test.describe.configure({ retries: 1, timeout: 90_000 });

/**
 * [S1045] `expectAdminNav` era UN interruttore per TUTTE le voci riservate, e non
 * regge piu': dopo la ricostruzione dell'organigramma le voci rispondono a regole
 * DIVERSE, e `tommaso.fiore` — la persona che questo file chiama «impiegato» —
 * oggi dirige la Filiale di Varese.
 *
 * Misurato sul dato reale, non dedotto:
 *   · `dashboard` esige `dashboard:view`. Fino alla mig 000271 il menu lo offriva
 *     anche a chi non l'aveva — difetto chiuso. Dalla mig 000272 tommaso lo ha
 *     davvero, come `BRANCH_MANAGER`: regge la Filiale di Varese, cioe' un
 *     sotto-albero gerarchico. Chi guida solo una SQUADRA non lo prende: una
 *     squadra ha uno scopo funzionale e il suo capo puo' essere gerarchicamente
 *     sotto un membro. Il caso «cruscotto negato» resta coperto da `outsider`.
 *   · `users` esige `user:read`, che il ruolo `USER` concede a TUTTI, piu' un
 *     dominio attivo — e tommaso ne ha uno perche' guida una squadra -> la vede,
 *     ed e' la scelta di prodotto confermata da Enzo (2026-08-05): l'elenco dei
 *     colleghi e' una rubrica aziendale, non una pagina da amministratore.
 *   · `antonio.parisi` (outsider) ha `user:read` ma NESSUN dominio -> non vede
 *     ne' l'una ne' l'altra. E' il caso che tiene onesta la coppia sopra.
 *
 * Due elenchi per persona invece di un booleano: cosi' il test dice QUALE voce si
 * aspetta e perche', e un cambio di permesso rompe la riga giusta invece di
 * spostare un rosso da una voce all'altra.
 */
type Persona = {
  key: PersonaKey;
  landing: string;
  /** Voci che DEVONO comparire nel menu di questa persona. */
  navMustSee: string[];
  /** Voci che NON devono comparire: il menu non offre cio' che e' negato. */
  navMustNotSee: string[];
  extraPages: [string, string];
};

const PERSONAS: Persona[] = [
  {
    key: "platformAdmin",
    landing: "/dashboard",
    navMustSee: ["nav-dashboard"],
    navMustNotSee: [],
    extraPages: ["/tenants", "/admin/roles"],
  },
  {
    key: "tenantAdmin",
    landing: "/dashboard",
    navMustSee: ["nav-dashboard"],
    navMustNotSee: [],
    extraPages: ["/users", "/positions"],
  },
  {
    key: "manager",
    landing: "/dashboard",
    navMustSee: ["nav-dashboard"],
    navMustNotSee: [],
    extraPages: ["/gaps", "/me"],
  },
  {
    // tommaso.fiore — capo della Filiale di Varese. Dalla mig 000272 e' anche
    // BRANCH_MANAGER: regge un sotto-albero gerarchico vero, quindi il cruscotto
    // gli spetta. Chi guida solo una SQUADRA (uno scopo funzionale) non lo prende
    // — la distinzione e' protetta dalla guardia della migrazione, non da qui.
    key: "employee",
    landing: "/me",
    navMustSee: ["nav-users", "nav-dashboard"],
    navMustNotSee: [],
    extraPages: ["/me/profile", "/me/learning/catalogue"],
  },
  {
    // antonio.parisi — nessun dominio: niente voci riservate, `user:read` o meno.
    key: "outsider",
    landing: "/me",
    navMustSee: [],
    navMustNotSee: ["nav-dashboard", "nav-users"],
    extraPages: ["/me/inbox", "/me/career"],
  },
];

async function assertNoCrash(page: Page, route: string) {
  await page.goto(route);
  // page must not redirect to /login (lost-cookie or middleware failure)
  expect(page.url()).not.toContain("/login");
  // body must render — wait for body to have content
  await expect(page.locator("body")).not.toBeEmpty({ timeout: 10_000 });
}

for (const persona of PERSONAS) {
  test.describe(`smoke ${persona.key}`, () => {
    test.use({ storageState: storageStateFor(persona.key) });

    test(`landing on ${persona.landing} + nav + 2 extra pages`, async ({ page }) => {
      // 1. Landing
      await page.goto(persona.landing);
      await expect(page).toHaveURL(new RegExp(`${persona.landing}$`));

      // 2. Nav role-gated
      await expect(page.getByTestId("nav-me")).toBeVisible({ timeout: 15_000 });
      for (const testId of persona.navMustSee) {
        await expect(page.getByTestId(testId)).toBeVisible();
      }
      // Il menu non offre cio' che e' negato: e' l'asserzione che nel 2026-08-05
      // ha scoperto il cruscotto visibile a chi non puo' aprirlo (mig 000271).
      for (const testId of persona.navMustNotSee) {
        await expect(page.getByTestId(testId)).toHaveCount(0);
      }

      // 3. Extra pages
      for (const route of persona.extraPages) {
        await assertNoCrash(page, route);
      }
    });
  });
}
