/**
 * apps/web/tests/e2e/approvals.spec.ts — 3.3 slice-D generic approval runtime.
 *
 * LIVE-DATA-E2E-ONLY: real login (tenantAdmin federica), real /v1/approvals calls,
 * state verified via re-fetch (never the DOM alone). federica names HERSELF as the
 * sole approver, then approves her own step and applies the request — the full
 * create → APPROVED → APPLIED lifecycle on the live RTL_BANK tenant. (The cross-user
 * inbox-delivery path is covered by the 10 API integration tests.) Rows are purged
 * by global-teardown (title LIKE 'E2E Approval%').
 */
import { test, expect } from "@playwright/test";
import { storageStateFor, completeApiLogin, gotoAuthenticated, PERSONAS } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 1 });

test.describe("approvals lifecycle (live)", () => {
  test("create naming self → approve → APPROVED → apply → APPLIED", async ({ page, request }) => {
    const { user } = await completeApiLogin(request, PERSONAS.tenantAdmin.email);
    const federicaId = user.userId;
    const title = `E2E Approval ${Date.now()}`;

    await gotoAuthenticated(page, "/approvals");
    await expect(page.getByTestId("approvals-page")).toBeVisible();

    // Create a request with federica as the sole approver.
    await page.getByTestId("approval-create-title").fill(title);
    await page.getByTestId("approval-create-approvers").selectOption([federicaId]);
    const [createRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/approvals") && r.request().method() === "POST"),
      page.getByTestId("approval-create-submit").click(),
    ]);
    expect(createRes.status()).toBe(200);
    await expect(page.getByTestId("approval-create-success")).toBeVisible();

    // Re-fetch proof: the new request shows in the live list → open it.
    const link = page.getByTestId("approval-row-link").filter({ hasText: title });
    await expect(link).toHaveCount(1);
    await link.click();

    // The [id] route compiles on first hit under `next dev` — give the cold
    // compile head-room (prod build has none; CI is unaffected).
    await expect(page.getByTestId("approval-detail-page")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("approval-my-action")).toBeVisible({ timeout: 10_000 });

    // Approve my own pending step → request flips APPROVED (verified via re-fetch).
    const [decideRes] = await Promise.all([
      page.waitForResponse((r) => /\/v1\/approvals\/.+\/steps\/.+\/decide/.test(r.url()) && r.request().method() === "POST"),
      page.getByTestId("approval-decide-approve").click(),
    ]);
    expect(decideRes.status()).toBe(200);
    await expect(page.getByTestId("approval-detail-status")).toHaveText(/Approvata|Approved/);

    // Apply → APPLIED (terminal).
    const [applyRes] = await Promise.all([
      page.waitForResponse((r) => /\/v1\/approvals\/.+\/apply/.test(r.url()) && r.request().method() === "POST"),
      page.getByTestId("approval-apply").click(),
    ]);
    expect(applyRes.status()).toBe(200);
    await expect(page.getByTestId("approval-detail-status")).toHaveText(/Applicata|Applied/);
  });
});
