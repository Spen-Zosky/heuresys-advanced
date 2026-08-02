/**
 * apps/web/tests/e2e/vrio-scorecard.spec.ts — #56 F/F2.
 *
 * LIVE-DATA-E2E-ONLY: a TENANT_ADMIN (federica.marchetti@rtl-bank.org, holds
 * capability:read) opens /org-director/vrio, fed entirely by
 * GET /v1/capability/composition/vrio over the live RTL Bank data.
 *
 * The interesting assertion is not "the page renders" — it is that the page renders the
 * SAME classification the API computed, including the control case: the capability RTL
 * demands most widely and holds least (nobody at all) must appear as a gap, never as a
 * rare advantage. A page that quietly dressed absence as scarcity would pass a
 * "does it load" test and fail this one.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor, PERSONAS, API_BASE, passwordFor, totpFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 1 });

/** The scorecard as the API computes it — the page is checked against this, not against literals. */
async function fetchScorecard(request: import("@playwright/test").APIRequestContext) {
  const email = PERSONAS.tenantAdmin.email;
  let res = await request.post(`${API_BASE}/v1/auth/login`, {
    data: { email, password: passwordFor(email) },
  });
  let body = await res.json();
  if (body.status === "mfa_required") {
    res = await request.post(`${API_BASE}/v1/auth/login`, {
      data: { email, password: passwordFor(email), challengeToken: body.challengeToken, mfaCode: totpFor(email) },
    });
    body = await res.json();
  }
  expect(body.status).toBe("success");
  const api = await request.get(`${API_BASE}/v1/capability/composition/vrio`);
  expect(api.status()).toBe(200);
  return api.json();
}

test.describe("#56 F2 — VRIO scorecard", () => {
  test("TENANT_ADMIN sees every capability classified, with the board summary", async ({ page }) => {
    await page.goto("/org-director/vrio", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("vrio-title")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("vrio-count")).toContainText(/\d+/);
    await expect(page.getByTestId("vrio-summary")).toBeVisible();
    await expect(page.getByTestId("vrio-row").first()).toBeVisible({ timeout: 30_000 });
    // the method note must be on the page: the reader is told the rule that was applied
    await expect(page.getByTestId("vrio-method")).toContainText(/percentil/i);
  });

  test("the rendered rows and counts match what the API computed", async ({ page, request }) => {
    const api = await fetchScorecard(request);
    await page.goto("/org-director/vrio", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("vrio-row").first()).toBeVisible({ timeout: 45_000 });

    // one row per classified capability
    await expect(page.getByTestId("vrio-row")).toHaveCount(api.total);

    // every summary tile shows the count the engine reported
    for (const [verdict, count] of Object.entries(api.summary)) {
      await expect(page.getByTestId(`vrio-summary-${verdict}`)).toContainText(String(count));
    }

    // the strongest capability the engine found leads the table
    const first = api.items[0];
    await expect(page.getByTestId("vrio-row").first()).toContainText(first.skillGroupName);
  });

  test("CONTROL CASE: a capability nobody holds shows as a gap, not as a rare advantage", async ({ page, request }) => {
    const api = await fetchScorecard(request);
    const gap = api.items.find((i: { verdict: string }) => i.verdict === "CAPABILITY_GAP");
    test.skip(!gap, "no capability gap in the current data — nothing to prove here");

    // Its raw rarity reads 1.0 precisely because nobody holds it: that is the trap.
    expect(gap.evidence.rarityRaw).toBe(1);
    expect(gap.evidence.holders).toBe(0);
    expect(gap.evidence.positionsRequiring).toBeGreaterThan(0);

    await page.goto("/org-director/vrio", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const row = page.getByTestId("vrio-row").filter({ hasText: gap.skillGroupName });
    await expect(row).toBeVisible({ timeout: 45_000 });
    // rendered as the gap it is — and the row carries the demand it fails to meet
    await expect(row.getByTestId("vrio-verdict-CAPABILITY_GAP")).toBeVisible();
    await expect(row).toContainText(`${gap.evidence.positionsRequiring}`);
  });
});

test.describe("#56 F2 — VRIO scorecard is gated", () => {
  test.use({ storageState: storageStateFor("employee") });

  test("an employee without capability:read cannot read the scorecard", async ({ page }) => {
    await page.goto("/org-director/vrio", { waitUntil: "domcontentloaded", timeout: 60_000 });
    // The API denies it; the page must surface the error state, never an empty scorecard
    // that would read as "this organization has no capabilities".
    await expect(page.getByTestId("vrio-row")).toHaveCount(0);
    await expect(page.getByTestId("vrio-summary")).toHaveCount(0);
  });
});
