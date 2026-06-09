/**
 * apps/web/tests/e2e/me-sessions.spec.ts
 *
 * MVP-4 §2.5 — ESS self-service session management, LIVE DATA E2E. A real employee
 * opens /me/security, sees their active sessions (refresh-token families) with the
 * current device flagged (resolved via GET /v1/auth/sessions/current), then "logs out
 * everywhere else" and confirms the current session survives while the rest collapse.
 * Every assertion is on data round-tripped through /v1/* (no mocks).
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

// /me/security is a heavy route (MFA enroll + QR + sessions); allow for the dev-mode
// cold-compile on first hit, which can exceed the default 30s test budget.
test.describe.configure({ retries: 1, timeout: 120_000 });

test.describe("MVP-4 §2.5 ESS session management — live data", () => {
  test.use({ storageState: storageStateFor("employee") });

  test("lists own sessions, flags the current device, logs out everywhere else", async ({ page }) => {
    await page.goto("/me/security", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("me-security-page")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("me-security-sessions-card")).toBeVisible({ timeout: 30_000 });

    // live list: at least one session; exactly one "this device" badge (the fresh login).
    await expect(page.getByTestId("me-security-session-row").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("me-security-session-current-badge")).toHaveCount(1);

    // log out everywhere else → the current session survives, the list collapses to it.
    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/v1/me/security/sessions/revoke-others") && r.request().method() === "POST",
        { timeout: 60_000 },
      ),
      page.getByTestId("me-security-sessions-revoke-others").click(),
    ]);
    expect(resp.status()).toBe(200);
    await expect(page.getByTestId("me-security-session-row")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByTestId("me-security-session-current-badge")).toHaveCount(1);
  });
});
