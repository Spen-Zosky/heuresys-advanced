/**
 * apps/web/tests/e2e/me-team.spec.ts
 *
 * WS-4 R1b — the "Il mio team" ESS page (/me/team), live data.
 *
 * The teams are derived from the real org (db/seeds/rtl-rebuild/13_teams_from_org.sql). The
 * "outsider" persona (antonio.parisi) is a real MEMBER of the DIV-CFO team, whose LEAD is
 * marco.rinaldi — so this asserts on data that came straight from the seed via GET /v1/me/team.
 *
 * Doctrine: live-data E2E, persisted storageState (no mock, no fixture). Robust navigation
 * (gotoAuthenticated) absorbs `next dev` cold-compile; the dark canonical theme is also asserted.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor, gotoAuthenticated, API_BASE } from "./fixtures";

test.describe.configure({ retries: 1, timeout: 120_000 });

test.describe("ESS /me/team — my team (TEAM_MEMBER persona)", () => {
  test.use({ storageState: storageStateFor("outsider") });

  test("renders the caller's real team with its lead + members (live data)", async ({ page }) => {
    await gotoAuthenticated(page, "/me/team");

    await expect(page.getByTestId("me-team-page")).toBeVisible({ timeout: 30_000 });

    // #219 F3/F — L'ATTESO SI DERIVA DALLA FONTE, NON SI RISCRIVE A MANO.
    // Il caso pretendeva il testo "Divisione CFO", che è il nome dell'UNITÀ ORGANIZZATIVA
    // da cui la squadra è derivata (`metadata.ou_code: DIV-CFO`), non della squadra: quella
    // si chiama "Squadra CFO", codice `TM-CFO`. Misurato il 2026-08-23 con
    // `apps/api/scripts/prova-219-f-mie-squadre.mts`: `GET /v1/me/team` risponde 200 con
    // ESATTAMENTE una squadra per questa persona — l'API è corretta, ed è il nome atteso
    // che era stantio. Scriverne un altro a mano ricreerebbe lo stesso difetto fra sei mesi:
    // si legge dalla stessa rotta che alimenta la pagina, e si confronta.
    // `API_BASE` + cookie espliciti: è la convenzione degli spec che interrogano l'API
    // (organization-editing fa così). Passare dal proxy della pagina (`/api/v1/...`) qui
    // non risponde, e un test che sbaglia il modo di chiedere accusa il prodotto al posto
    // proprio — misurato: la stessa rotta su `:3001` risponde 200 con una squadra.
    const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    const risposta = await page.request.get(`${API_BASE}/v1/me/team`, { headers: { cookie } });
    // Il messaggio porta STATO e CORPO: «non risponde» da solo costringe a un'altra corsa
    // di quattro minuti per sapere se era 401, 404 o un host sbagliato.
    expect(
      risposta.ok(),
      `GET ${API_BASE}/v1/me/team → HTTP ${risposta.status()} · ${(await risposta.text()).slice(0, 200)}`,
    ).toBeTruthy();
    const mie = (await risposta.json()) as { teams: Array<{ name: string; code: string }> };
    // Una prova che non misura niente sarebbe verde su zero squadre: qui la persona ne ha una.
    expect(mie.teams.length, "il chiamante deve avere esattamente una squadra").toBe(1);

    const card = page.getByTestId("me-team-card").first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    // ...e le card devono essere tante quante le squadre sue: è il PERIMETRO di una pagina
    // `/me/*`, e la firma del triage («il locator risolve a 14 elementi») descriveva proprio
    // questo conteggio, non un testid ripetuto — `me-team-name` sta dentro un `.map()`.
    expect(await page.getByTestId("me-team-card").count()).toBe(mie.teams.length);
    await expect(page.getByTestId("me-team-name").first()).toContainText(mie.teams[0]!.name);

    // The team's real lead (marco.rinaldi) and the caller (antonio.parisi) both appear as members.
    await expect(card).toContainText("marco.rinaldi@rtl-bank.org");
    await expect(card).toContainText("antonio.parisi@rtl-bank.org");

    // At least 2 member rows (lead + self), all sourced from the live API.
    const rows = page.getByTestId("me-team-member-row");
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
  });

  test("the 'Il mio team' nav item is present in the DB-driven sidebar", async ({ page }) => {
    await gotoAuthenticated(page, "/me");
    await expect(page.getByRole("link", { name: "Il mio team" })).toBeVisible({ timeout: 30_000 });
  });

  test("dark-canonical theme applies on /me/team", async ({ page }) => {
    await gotoAuthenticated(page, "/me/team");
    await expect(page.getByTestId("me-team-page")).toBeVisible({ timeout: 30_000 });
    const hasDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    expect(hasDark).toBe(true);
  });
});
