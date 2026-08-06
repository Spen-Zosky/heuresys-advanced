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

  /**
   * Rete di sicurezza (#152). La pulizia qui sopra è l'ultima riga del test:
   * se il test fallisce PRIMA — e con `retries: 1` un tentativo fallito è
   * previsto — il passkey appena registrato resta in produzione. È così che si
   * erano accumulati 6 fattori WEBAUTHN verificati su `admin@heuresys.com`
   * fra il 22/07 e il 01/08, misurati in S1047.
   *
   * Questo gancio gira **anche quando il test fallisce**, e toglie il residuo.
   *
   * Cancella SOLO i fattori di tipo WEBAUTHN. Il vincolo non è cosmetico: lo
   * stesso utente possiede un TOTP `derived-access` da cui dipende ogni login
   * dei test (Z-262). Una pulizia "tutti i fattori dell'utente" spegnerebbe
   * l'intera suite, quindi il filtro sul tipo è la guardia.
   */
  test.afterEach(async ({ page }) => {
    const list = await page.request.get("/v1/auth/mfa/factors");
    if (!list.ok()) return;
    const { items } = (await list.json()) as {
      items: { factorId: string; kind: string }[];
    };
    for (const f of items.filter((i) => i.kind === "WEBAUTHN")) {
      await page.request.delete(`/v1/auth/mfa/factors/${f.factorId}`);
    }
  });
});
