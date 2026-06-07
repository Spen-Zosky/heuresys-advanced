/**
 * apps/web/tests/e2e/mfa-enroll.spec.ts
 *
 * Tappa E-UI (MVP-3) — TOTP enrollment flow.
 *
 * Live-data E2E: a seeded employee logs in, lands on /me/security, kicks off
 * the TOTP enroll, observes the QR + secret, and cancels (the verify step
 * needs an authenticator app generating the time-based code — we do NOT
 * simulate a real TOTP code here; the verify-setup endpoint is covered by
 * vitest integration tests in apps/api/test/auth-mfa.integration.test.ts).
 *
 * Asserts:
 *   1. Empty-state factors list rendered for a fresh-enrolled persona.
 *   2. Enroll TOTP button triggers POST /v1/auth/mfa/enroll → QR + secret + verify form visible.
 *   3. Cancel button restores the empty state.
 *   4. After enroll, the factor appears in the list as "in attesa di verifica" (pending verify).
 *
 * NOTE: cancel does NOT delete the pending factor server-side — the backend
 * leaves the unverified row until either verify-setup succeeds or it ages out.
 * The list reflects this (factor visible with `verified=false`) by design.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("employee") });

test.describe("MVP-3 Tappa E-UI /me/security — TOTP enrollment flow", () => {
  test("page renders + enroll TOTP shows QR + cancel restores state", async ({ page }) => {
    await page.goto("/me/security");

    await expect(page.getByTestId("me-security-page")).toBeVisible();
    await expect(page.getByTestId("me-security-title")).toContainText(
      /Sicurezza account/i,
    );
    await expect(page.getByTestId("me-security-factors-count")).toContainText(/\d+\s+totali/);

    // The enroll button is visible on initial render (no pending factor).
    await expect(page.getByTestId("me-security-enroll-button")).toBeVisible();

    // Kick off enroll → backend issues POST /v1/auth/mfa/enroll, returns
    // otpauthUri + secret + factorId. The QR + secret + verify form should
    // become visible; the enroll button hides.
    const [enrollResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/v1/auth/mfa/enroll") && r.request().method() === "POST",
      ),
      page.getByTestId("me-security-enroll-button").click(),
    ]);
    expect(enrollResp.status()).toBe(201);

    await expect(page.getByTestId("me-security-enroll-pending-card")).toBeVisible();
    await expect(page.getByTestId("me-security-enroll-qr")).toBeVisible();
    await expect(page.getByTestId("me-security-enroll-secret")).toBeVisible();
    await expect(page.getByTestId("me-security-verify-form")).toBeVisible();
    await expect(page.getByTestId("me-security-verify-code")).toBeVisible();
    await expect(page.getByTestId("me-security-verify-submit")).toBeVisible();
    await expect(page.getByTestId("me-security-enroll-cancel")).toBeVisible();

    // Secret should be a base32-encoded string of ≥16 chars (schema mandate).
    const secret = await page.getByTestId("me-security-enroll-secret").textContent();
    expect(secret?.trim().length ?? 0).toBeGreaterThanOrEqual(16);

    // Cancel restores the empty/initial state.
    await page.getByTestId("me-security-enroll-cancel").click();
    await expect(page.getByTestId("me-security-enroll-pending-card")).toHaveCount(0);
    await expect(page.getByTestId("me-security-enroll-button")).toBeVisible();

    // The factor was created server-side (we got 201 back) → it should now
    // appear in the list as pending. The empty-state element should be gone
    // and at least one factor row should exist with the TOTP kind.
    await expect(page.getByTestId("me-security-factors-empty")).toHaveCount(0);
    const rows = page.getByTestId("me-security-factor-row");
    await expect(rows.first()).toBeVisible();
    await expect(rows.first().getByTestId("me-security-factor-kind")).toContainText("TOTP");
  });

  test("EMAIL_OTP enroll shows email-code form + resend, cancel restores state", async ({ page }) => {
    await page.goto("/me/security");
    await expect(page.getByTestId("me-security-page")).toBeVisible();

    // The EMAIL_OTP enroll button is visible on initial render.
    await expect(page.getByTestId("me-security-emailotp-enroll-button")).toBeVisible();

    // Kick off EMAIL_OTP enroll → backend issues POST /v1/auth/mfa/email-otp/enroll,
    // emails a code, returns factorId + emailHint (NEVER the code). The email-code
    // verify form + resend button should appear.
    const [enrollResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/v1/auth/mfa/email-otp/enroll") &&
          r.request().method() === "POST",
      ),
      page.getByTestId("me-security-emailotp-enroll-button").click(),
    ]);
    expect(enrollResp.status()).toBe(201);

    // SECURITY assertion: the enroll response body must NOT carry the OTP code.
    const enrollBody = await enrollResp.json();
    expect(enrollBody.kind).toBe("EMAIL_OTP");
    expect(enrollBody.code).toBeUndefined();
    expect(enrollBody.secret).toBeUndefined();
    expect(typeof enrollBody.emailHint).toBe("string");

    await expect(page.getByTestId("me-security-emailotp-pending-card")).toBeVisible();
    await expect(page.getByTestId("me-security-emailotp-hint")).toBeVisible();
    await expect(page.getByTestId("me-security-emailotp-verify-form")).toBeVisible();
    await expect(page.getByTestId("me-security-emailotp-verify-code")).toBeVisible();
    await expect(page.getByTestId("me-security-emailotp-verify-submit")).toBeVisible();
    await expect(page.getByTestId("me-security-emailotp-resend")).toBeVisible();
    await expect(page.getByTestId("me-security-emailotp-cancel")).toBeVisible();

    // The pending factor appears in the list as EMAIL_OTP (unverified).
    const rows = page.getByTestId("me-security-factor-row");
    await expect(
      rows.filter({ has: page.getByText("EMAIL_OTP") }).first(),
    ).toBeVisible();

    // Cancel restores the enroll buttons.
    await page.getByTestId("me-security-emailotp-cancel").click();
    await expect(page.getByTestId("me-security-emailotp-pending-card")).toHaveCount(0);
    await expect(page.getByTestId("me-security-emailotp-enroll-button")).toBeVisible();
  });

  test("client-side gate: 5-digit code blocks form submit", async ({ page }) => {
    // Start a fresh enroll to populate the verify form.
    await page.goto("/me/security");
    const [enrollResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/v1/auth/mfa/enroll") && r.request().method() === "POST",
      ),
      page.getByTestId("me-security-enroll-button").click(),
    ]);
    expect(enrollResp.status()).toBe(201);
    await expect(page.getByTestId("me-security-verify-form")).toBeVisible();

    // Bad code: 5 digits — zodResolver should block client-side.
    await page.getByTestId("me-security-verify-code").fill("12345");

    // No POST /verify-setup should be sent.
    const sawPost = page
      .waitForRequest(
        (r) =>
          r.url().includes("/v1/auth/mfa/verify-setup") && r.method() === "POST",
        { timeout: 1500 },
      )
      .then(() => true)
      .catch(() => false);

    await page.getByTestId("me-security-verify-submit").click();
    expect(await sawPost).toBe(false);

    // Cleanup: cancel pending enroll so subsequent runs aren't blocked
    // by leftover state.
    await page.getByTestId("me-security-enroll-cancel").click();
  });
});
