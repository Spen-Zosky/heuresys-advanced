/**
 * apps/web/tests/e2e/landing-pages.spec.ts
 *
 * Live-data E2E for the post-login landing pages: /me (ESS) and /dashboard
 * (admin). Uses storageState produced by auth.setup.ts so individual tests
 * don't re-hit /v1/auth/login (rate-limited 10 per 5 min).
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("MVP-2a landing pages — live data", () => {
  // S1043: la persona `employee` e' oggi responsabile di filiale (TEAM_LEADER), quindi
  // ATTERRA sul cruscotto. Continua pero' a non vedere la navigazione di
  // amministrazione, perche' quella e' riservata a un insieme piu' stretto
  // (PLATFORM_ADMIN/TENANT_ADMIN/MANAGER/…), e TEAM_LEADER non vi appartiene. Le due
  // cose non coincidono, ed e' proprio questa distinzione che il test difende.
  test.describe("as employee (capo filiale: vede il cruscotto, non l'amministrazione)", () => {
    test.use({ storageState: storageStateFor("employee") });

    test("/me rende con ruolo, saluto e card; il governo di piattaforma resta chiuso", async ({ page }) => {
      await page.goto("/me");
      await expect(page).toHaveURL(/\/me$/);

      await expect(page.getByTestId("me-page")).toBeVisible();
      await expect(page.getByTestId("me-email")).toContainText("tommaso.fiore@rtl-bank.org");
      await expect(page.getByTestId("me-roles")).toContainText("USER");
      await expect(page.getByTestId("me-card-primary-position")).toBeVisible();
      await expect(page.getByTestId("me-card-learning")).toBeVisible();
      await expect(page.getByTestId("me-card-gaps")).toBeVisible();
      await expect(page.getByTestId("me-learning-count")).toContainText(/\d+\s+assegnati/);
      await expect(page.getByTestId("me-gaps-count")).toContainText(/\d+\s+aperti/);

      // ⚠ RIFORMULATO IL 2026-08-19 (#211 F3, famiglia ④ del triage), e la ragione e' piu'
      // interessante di una riga da aggiornare: **la premessa del caso era superata**.
      //
      // Pretendeva che un impiegato non vedesse `nav-dashboard` ne' `nav-users`. Misurato oggi
      // sulla mappa RBAC viva, nessuna delle due regge piu':
      //   · `tommaso.fiore` ha BRANCH_MANAGER (mig. `000272`) → ha `dashboard:view`, perche'
      //     regge una filiale, cioe' un sotto-albero gerarchico vero;
      //   · `USER` — il pavimento universale di I17, che TUTTI hanno — porta `user:read`,
      //     `position:read` e `tenant:read`. La rubrica aziendale e' di tutti (dottrina `#193`).
      //
      // Quindi le quattro voci con testid stabile (dashboard, me, positions, users) le vede
      // chiunque, e **l'assenza di una voce non e' piu' il modo in cui il modello separa**: a
      // separare sono lo SCOPE e la MASCHERATURA (ADR-0036, I16). Continuare ad asserire
      // un'assenza avrebbe difeso una regola che il prodotto non ha piu'.
      //
      // Cio' che resta vero, e che il caso ora difende, e' la distinzione autentica: una
      // superficie di GOVERNO della piattaforma non si apre a chi non ne ha il mandato.
      // `/provenance` chiede `provenance:read`, che nessuno dei quattro ruoli di tommaso ha.
      await expect(page.getByTestId("nav-me")).toBeVisible();
      await expect(page.getByTestId("nav-dashboard")).toBeVisible();

      // ⚠ QUESTA ASSERZIONE CHIEDEVA ALLA PAGINA DI ESSERE UN CONFINE DI SICUREZZA, e questo
      // progetto dichiara il contrario (corretto S1088). `generated-origins/page.tsx` lo scrive
      // per esteso — «l'isolamento NON e' qui: e' nel servizio. Una pagina non e' un confine di
      // sicurezza» — e `/provenance` rende infatti il proprio guscio a chiunque digiti l'URL: e'
      // l'API che nega i dati con 403. Pretendere `provenance-page` a zero era quindi chiedere
      // un comportamento che il prodotto non ha e non vuole avere.
      //
      // E il caso passava **per tempismo**, non perche' avesse ragione: `toHaveCount(0)` e' verde
      // nell'istante in cui l'elemento non e' ANCORA comparso. Da solo la pagina e' piu' lenta e
      // il caso passava; dentro la fase 3, a cache calda, l'elemento faceva in tempo a comparire
      // e il caso diventava rosso. Un'assenza misurata cosi' non prova un'assenza: prova un
      // ritardo — ed e' la stessa specie di difetto gia' corretta in `#219` F3/G.
      //
      // Cio' che separa davvero e' che **i dati di governo non arrivano**: si asserisce quello.
      const risposta = page.waitForResponse(
        (r) => r.url().includes("/v1/provenance/summary"),
        { timeout: 20_000 },
      );
      await page.goto("/provenance");
      expect((await risposta).status(), "senza provenance:read il sommario dev'essere negato").toBe(403);
      // Il guscio c'e' — ed e' corretto che ci sia: e' cio' che questo caso ora dichiara,
      // invece di negarlo. I dati no, e li' sta la separazione.
      await expect(page.getByTestId("provenance-title")).toBeVisible();
    });
  });

  test.describe("as tenantAdmin", () => {
    test.use({ storageState: storageStateFor("tenantAdmin") });

    test("/dashboard shows TENANT scope, counters, and admin nav", async ({ page }) => {
      await page.goto("/dashboard");

      await expect(page.getByTestId("nav-dashboard")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("nav-users")).toBeVisible();
      await expect(page.getByTestId("nav-positions")).toBeVisible();
      await expect(page.getByTestId("nav-me")).toBeVisible();

      await expect(page.getByTestId("dashboard-page")).toBeVisible();
      await expect(page.getByTestId("dashboard-title")).toBeVisible();
      await expect(page.getByTestId("dashboard-scope")).toContainText("TENANT");
      await expect(page.getByTestId("counter-users")).toBeVisible();
      await expect(page.getByTestId("counter-positions")).toBeVisible();
      await expect(page.getByTestId("counter-tenants")).toHaveCount(0);
    });
  });

  test.describe("as platformAdmin", () => {
    test.use({ storageState: storageStateFor("platformAdmin") });

    test("/dashboard shows PLATFORM scope + tenants counter", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page.getByTestId("dashboard-scope")).toContainText("PLATFORM");
      await expect(page.getByTestId("counter-tenants")).toBeVisible();
    });
  });
});
