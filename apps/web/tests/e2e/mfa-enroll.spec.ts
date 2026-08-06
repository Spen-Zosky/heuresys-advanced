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
 *   4. Cancel DELETES the pending factor server-side — nothing is left behind.
 *
 * S1047 (#152) — questo blocco diceva l'opposto: «cancel does NOT delete the
 * pending factor server-side — the backend leaves the unverified row until
 * either verify-setup succeeds or it ages out», e lo chiamava "by design".
 * Due parti su tre erano false, misurate:
 *   - l'age-out NON esiste. Nel codice auth non c'è alcuna scadenza dei
 *     FATTORI: `expires_at` e lo sweep vivono su `sys_auth_mfa_otp_challenges`,
 *     cioè sulle sfide OTP, non sulle righe di `sys_auth_mfa_factors`. Le righe
 *     restavano per sempre;
 *   - non era un design, era una perdita. Ogni corsa lasciava 2 fattori TOTP
 *     mai verificati in produzione: 26 accumulati fra il 22/07 e il 01/08.
 * Il difetto non era solo dei test: anche una persona reale che premeva
 * «annulla» si ritrovava in lista un fattore che credeva di non aver creato.
 * Corretto alla radice — il pulsante ora chiama DELETE /v1/auth/mfa/factors/:id
 * (l'endpoint esisteva già) — e le asserzioni qui sotto sono state ribaltate di
 * conseguenza: prima pretendevano che il residuo ci fosse.
 */

import { test, expect } from "@playwright/test";
import { API_BASE, storageStateFor } from "./fixtures";

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

    // Cancel restores the empty/initial state AND deletes the pending factor
    // server-side (#152). Prima il DELETE non partiva e la riga restava.
    const [deleteResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/v1\/auth\/mfa\/factors\/[0-9a-f-]+$/i.test(new URL(r.url()).pathname) &&
          r.request().method() === "DELETE",
      ),
      page.getByTestId("me-security-enroll-cancel").click(),
    ]);
    expect(deleteResp.status()).toBe(204);

    await expect(page.getByTestId("me-security-enroll-pending-card")).toHaveCount(0);
    await expect(page.getByTestId("me-security-enroll-button")).toBeVisible();

    // Il fattore annullato NON deve sopravvivere. Si asserisce sul factorId
    // creato DA QUESTO test, non sul totale dei TOTP non verificati dell'utente:
    // un conteggio globale mescolerebbe i residui lasciati da corse precedenti
    // (26 al 2026-08-06) e renderebbe questo test rosso per colpa d'altri —
    // oppure verde per caso, il giorno in cui qualcuno li ripulisce a mano.
    // L'elenco si chiede all'API con l'indirizzo ASSOLUTO (`API_BASE`): un path
    // relativo lo servirebbe il frontend, che per `/v1/*` risponde con l'HTML
    // del proprio 404 — e il test morirebbe con «Unexpected token '<'» invece
    // di dire la verità sul fattore. Preso sul fatto in S1047.
    const { factorId } = (await enrollResp.json()) as { factorId: string };
    await expect
      .poll(async () => {
        const res = await page.request.get(`${API_BASE}/v1/auth/mfa/factors`);
        const body = (await res.json()) as { items: { factorId: string }[] };
        return body.items.some((f) => f.factorId === factorId);
      })
      .toBe(false);
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
    // #8 WAIT-INPUT: without a production-capable mailer the API answers
    // 404 EMAIL_NOT_CONFIGURED by design — the flow is untestable on this
    // env until the SMTP app-password lands. Skip honestly, never fake it.
    if (enrollResp.status() === 404) {
      const body = (await enrollResp.json()) as { error?: { code?: string } };
      test.skip(
        body.error?.code === "EMAIL_NOT_CONFIGURED",
        "EMAIL transport non configurato (#8 WAIT-INPUT app-password Outlook)",
      );
    }
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
    // #68 F4: the kind renders as its translated label ("Codice via email").
    const rows = page.getByTestId("me-security-factor-row");
    await expect(
      rows.filter({ has: page.getByText("Codice via email") }).first(),
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

    // Cleanup: annullare ora cancella davvero il fattore sul server (#152),
    // quindi questa riga e' pulizia reale e non piu' solo apparente.
    await page.getByTestId("me-security-enroll-cancel").click();
  });
});
