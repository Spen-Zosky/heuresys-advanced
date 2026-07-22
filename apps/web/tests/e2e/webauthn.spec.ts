/**
 * apps/web/tests/e2e/webauthn.spec.ts
 *
 * MVP-4 §2.5 — WebAuthn passkey enrollment, LIVE DATA E2E. A real user opens
 * /me/security and registers a passkey against a CDP **virtual authenticator**
 * (so the ceremony runs without physical hardware); the full register ceremony
 * (POST /webauthn/registration/options → navigator.credentials.create →
 * /webauthn/registration/verify) round-trips through the live API + DB, and a
 * verified WEBAUTHN factor appears in the list. Then it is deleted (cleanup).
 *
 * The login authentication ceremony is exercised by login-mfa-enrollment.spec.ts
 * (mandatory-MFA #4): the "use passkey" login leg completes the session there.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

// /me/security is a heavy route (MFA + QR + passkey + sessions); allow for the
// dev-mode cold-compile on first hit.
test.describe.configure({ retries: 1, timeout: 120_000 });

test.describe("MVP-4 §2.5 WebAuthn passkey enroll — live data", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("registers a passkey via a virtual authenticator and lists it", async ({ page }) => {
    // CDP virtual authenticator: a software CTAP2 internal authenticator that
    // auto-satisfies user presence + verification (no UI prompt).
    const client = await page.context().newCDPSession(page);
    await client.send("WebAuthn.enable");
    await client.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });

    await page.goto("/me/security", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("me-security-page")).toBeVisible({ timeout: 45_000 });
    // localhost is a secure context → the passkey button (not the unsupported note) renders.
    await expect(page.getByTestId("me-security-passkey-enroll-button")).toBeVisible({ timeout: 15_000 });

    // register: options → virtual authenticator creates the credential → verify.
    const [verifyResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/v1/auth/mfa/webauthn/registration/verify") && r.request().method() === "POST",
        { timeout: 30_000 },
      ),
      page.getByTestId("me-security-passkey-enroll-button").click(),
    ]);
    expect(verifyResp.status()).toBe(200);

    // a verified WEBAUTHN factor now shows in the list.
    const passkeyRow = page.getByTestId("me-security-factor-row").filter({ hasText: "Passkey" });
    await expect(passkeyRow.first()).toBeVisible({ timeout: 10_000 });

    // cleanup: delete the passkey factor (the row's delete uses a confirm dialog).
    page.on("dialog", (d) => void d.accept());
    const [delResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/auth/mfa/factors/") && r.request().method() === "DELETE"),
      passkeyRow.first().getByTestId("me-security-factor-delete").click(),
    ]);
    expect(delResp.status()).toBe(204);
  });
});
