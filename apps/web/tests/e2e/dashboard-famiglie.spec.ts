/**
 * apps/web/tests/e2e/dashboard-famiglie.spec.ts — #142 F4: le otto famiglie di cruscotto.
 *
 * La chiusura dichiarata di `#142` chiede «un login reale PER OGNI tipologia, non una a
 * campione». Qui non c'è però una lista di coppie persona→famiglia scritta a mano: sarebbe
 * una seconda verità accanto a `sys_dashboards`, e invecchierebbe al primo cruscotto nuovo.
 * Ogni persona interroga il PROPRIO catalogo e la specifica verifica che:
 *
 *  · ogni famiglia che il catalogo le offre sia davvero raggiungibile e disegni le viste;
 *  · una famiglia che il catalogo NON le offre risponda «non disponibile», senza rivelare
 *    se non esiste o se non è sua (nessuna enumerazione);
 *  · le viste mascherate compaiano CON il loro motivo — ADR-0032 vuole che la vista resti
 *    visibile mentre i valori sono trattenuti.
 *
 * Le personas coprono tutte le tipologie che il modello prevede: amministratore di
 * piattaforma (mandato tecnico), amministratore di azienda, manager di linea, capo filiale,
 * persona senza deleghe, custode. Se un giorno una famiglia non fosse raggiungibile da
 * nessuna di loro, l'ultimo caso lo dice.
 */

import { expect, test, type APIRequestContext } from "@playwright/test";
import { API_BASE, storageStateFor, type PersonaKey } from "./fixtures";

interface VocaCatalogo {
  code: string;
  name: string;
  route: string;
  blockCount: number;
  maskedBlockCount: number;
}

/** Il catalogo COME LO VEDE questa persona: la sola fonte di ciò che deve funzionare. */
async function catalogoDi(request: APIRequestContext): Promise<VocaCatalogo[]> {
  const r = await request.get(`${API_BASE}/v1/dashboard/catalog`);
  expect(r.status(), "il catalogo deve rispondere a ogni utente autenticato (I17)").toBe(200);
  return ((await r.json()) as { dashboards: VocaCatalogo[] }).dashboards;
}

/** Le famiglie con una pagina propria: `self` punta a `/me`, che è il portale ESS. */
const conPaginaPropria = (c: VocaCatalogo[]) => c.filter((d) => d.route.startsWith("/dashboard/"));

const PERSONE: PersonaKey[] = [
  "platformAdmin",
  "tenantAdmin",
  "manager",
  "employee",
  "outsider",
  "custodian",
];

/** Raccoglie, fra tutte le personas, quali famiglie sono risultate raggiungibili. */
const raggiunte = new Set<string>();

for (const persona of PERSONE) {
  test.describe(`cruscotti per tipologia — ${persona}`, () => {
    test.use({ storageState: storageStateFor(persona) });

    test(`ogni famiglia offerta a ${persona} è raggiungibile e disegna le sue viste`, async ({
      page,
      request,
    }) => {
      const catalogo = await catalogoDi(request);
      const famiglie = conPaginaPropria(catalogo);

      // Una persona senza alcuna famiglia con pagina propria è un caso legittimo
      // (`outsider` ha solo il Self-Service): si dichiara invece di saltare in silenzio.
      test.info().annotations.push({
        type: "famiglie",
        description: `${persona}: ${famiglie.map((f) => f.code).join(", ") || "(solo Self-Service)"}`,
      });

      for (const f of famiglie) {
        await page.goto(f.route);
        const radice = page.getByTestId(`cruscotto-${f.code}`);
        await expect(radice, `${persona} non vede ${f.code} su ${f.route}`).toBeVisible();

        // Le viste ci sono TUTTE, comprese le mascherate: il conteggio viene dal catalogo,
        // non da un numero scritto qui — sarebbe una SoT duplicata.
        const viste = page.locator('[data-testid^="vista-"]');
        await expect(viste).toHaveCount(f.blockCount);

        // Ogni vista senza valori deve dire perché. È il caso che deve poter fallire: una
        // vista mascherata muta è indistinguibile da una che non è mai esistita.
        const trattenute = page.locator('[data-access="masked"], [data-access="denied"]');
        const quante = await trattenute.count();
        for (let i = 0; i < quante; i++) {
          const motivo = trattenute.nth(i).locator('[data-testid^="motivo-"]');
          await expect(motivo).toBeVisible();
          await expect(motivo).not.toHaveText("");
        }

        raggiunte.add(f.code);
      }
    });

    test(`una famiglia non offerta a ${persona} risponde «non disponibile»`, async ({
      page,
      request,
    }) => {
      const catalogo = await catalogoDi(request);
      const offerte = new Set(conPaginaPropria(catalogo).map((d) => d.route));
      // Tutte le route che ESISTONO nel prodotto, meno quelle che questa persona ha.
      const TUTTE = [
        "/dashboard/azienda",
        "/dashboard/processi",
        "/dashboard/organizzazione",
        "/dashboard/filiale",
        "/dashboard/hr",
        "/dashboard/platform",
        "/dashboard/tenant",
      ];
      const negata = TUTTE.find((r) => !offerte.has(r));
      test.skip(negata === undefined, `${persona} le vede tutte: nessun caso negativo da provare`);

      await page.goto(negata as string);
      await expect(page.getByTestId("cruscotto-non-disponibile")).toBeVisible();
    });
  });
}

test.describe("il mandato tecnico vede la vista, non i valori", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("su HR la vista economica è presente e dichiara perché è trattenuta (ADR-0032)", async ({
    page,
    request,
  }) => {
    const catalogo = await catalogoDi(request);
    const hr = catalogo.find((d) => d.code === "hr");
    expect(hr, "il mandato tecnico deve vedere la famiglia HR nel catalogo").toBeTruthy();
    expect(
      hr?.maskedBlockCount ?? 0,
      "ADR-0032: al mandato TECNICO la retribuzione esce mascherata, non aperta",
    ).toBeGreaterThan(0);

    await page.goto("/dashboard/hr");
    const mascherate = page.locator('[data-access="masked"]');
    await expect(mascherate.first()).toBeVisible();
    // Il valore non c'è, ma la vista sì — ed è esattamente ciò che ADR-0032 chiede.
    await expect(mascherate.first().locator('[data-testid^="motivo-"]')).toContainText(
      /trattenut/i,
    );
  });
});

test.describe("copertura", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("nessuna famiglia con pagina propria resta irraggiungibile da tutte le tipologie", async ({
    request,
  }) => {
    // `platformAdmin` le vede tutte per il tappeto di `000005`, quindi questo caso è la
    // rete di sicurezza: se una famiglia esiste, ha una pagina e nessuno la raggiunge,
    // il catalogo starebbe promettendo una pagina che non si apre.
    const catalogo = await catalogoDi(request);
    const attese = conPaginaPropria(catalogo).map((d) => d.code);
    expect(attese.length, "il mandato tecnico deve vedere tutte le famiglie con pagina").toBe(7);
    for (const code of attese) {
      expect(raggiunte.has(code), `famiglia mai raggiunta da nessuna tipologia: ${code}`).toBe(true);
    }
  });
});
