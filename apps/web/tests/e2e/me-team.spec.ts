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
import { storageStateFor, gotoAuthenticated } from "./fixtures";

test.describe.configure({ retries: 1, timeout: 120_000 });

test.describe("ESS /me/team — my team (TEAM_MEMBER persona)", () => {
  test.use({ storageState: storageStateFor("outsider") });

  test("renders the caller's real team with its lead + members (live data)", async ({ page }) => {
    await gotoAuthenticated(page, "/me/team");

    await expect(page.getByTestId("me-team-page")).toBeVisible({ timeout: 30_000 });
    // antonio.parisi belongs to exactly one team (DIV-CFO = "Divisione CFO").
    const card = page.getByTestId("me-team-card").first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("me-team-name").first()).toContainText("Divisione CFO");

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
