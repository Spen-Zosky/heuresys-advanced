/**
 * apps/web/tests/e2e/login-mfa.spec.ts
 *
 * MVP-3 Tappa E (batch X20) — MFA login-gating 2-step UI flow.
 *
 * Live-data E2E. A dedicated persona (outsider) is given a verified TOTP
 * factor via the real /v1/auth/mfa API (enroll + verify-setup with a real
 * generated code), then the /login UI 2-step flow is exercised end-to-end:
 *   step 1 (email+password) -> server returns mfa_required -> MFA code form
 *   step 2 (real TOTP code) -> success -> role landing redirect
 * plus the invalid-code error path. The factor is deleted in `finally` so the
 * persona's storageState / auth.setup is unaffected on subsequent runs.
 *
 * The login challenge is single-use (consumed on first verify attempt), so the
 * invalid and valid attempts each start a fresh login (fresh challenge).
 *
 * NO storageState — these tests drive the unauthenticated /login page directly.
 */
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { completeApiLogin, completeMfaIfChallenged, PERSONAS, TEST_PASSWORD } from "./fixtures";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const MFA_EMAIL = PERSONAS.outsider.email;
const NO_MFA = PERSONAS.manager; // lands on /dashboard, never MFA-enrolled

function genTotp(secretBase32: string): string {
  return new OTPAuth.TOTP({
    issuer: "Heuresys",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  }).generate();
}

/** Enroll + verify a TOTP factor on `email` via the real API. Returns the
 *  factorId + secret + an authenticated csrfToken for later cleanup. */
async function enrollVerifiedTotp(request: APIRequestContext, email: string) {
  // Dual-mode (S983 WS-E): under the live mandatory policy this API login is
  // a TOTP 2-step against the fixture factor; pre-flip a plain passthrough.
  const { csrfToken } = await completeApiLogin(request, email);

  const enrollRes = await request.post(`${API_BASE}/v1/auth/mfa/enroll`, {
    headers: { "x-csrf-token": csrfToken },
    data: {},
  });
  expect(enrollRes.status(), "enroll TOTP").toBe(201);
  const enroll = await enrollRes.json();
  const factorId = enroll.factorId as string;
  const secret = enroll.secret as string;

  const verifyRes = await request.post(`${API_BASE}/v1/auth/mfa/verify-setup`, {
    headers: { "x-csrf-token": csrfToken },
    data: { factorId, code: genTotp(secret) },
  });
  expect(verifyRes.status(), "verify-setup").toBe(200);

  return { factorId, secret, csrfToken };
}

async function deleteFactor(request: APIRequestContext, factorId: string, csrfToken: string) {
  await request
    .delete(`${API_BASE}/v1/auth/mfa/factors/${factorId}`, {
      headers: { "x-csrf-token": csrfToken },
    })
    .catch(() => {});
}

async function submitPassword(page: Page, email: string) {
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(TEST_PASSWORD);
  await page.getByTestId("login-submit").click();
}

test.describe.configure({ mode: "serial" });
// Heavy admin routes (/dashboard) cold-load through the SSH-tunnelled DB can
// take >30s on first hit; assert on the redirect URL (fires on router.replace)
// rather than full route render, and give the suite headroom.
test.setTimeout(90_000);

test.describe("MVP-3 Tappa E /login — MFA login-gating", () => {
  test("fixture persona completes a FULL login (direct pre-flip, TOTP 2-step under the live policy)", async ({ page }) => {
    // S983 WS-E: with mandatory MFA live there is no factor-less fixture
    // persona — the regression under test is that login always completes.
    await page.goto("/login");
    await submitPassword(page, NO_MFA.email);
    await completeMfaIfChallenged(page, NO_MFA.email);
    await expect(page).toHaveURL(new RegExp(`${NO_MFA.expectedLandingPath}`), { timeout: 60_000 });
  });

  test("MFA persona: step 1 -> mfa_required UI, invalid code errors, valid code succeeds", async ({
    page,
    request,
  }) => {
    const setup = await enrollVerifiedTotp(request, MFA_EMAIL);
    try {
      // --- Attempt 1: password step surfaces the MFA challenge UI ---
      await page.goto("/login");
      await submitPassword(page, MFA_EMAIL);
      await expect(page.getByTestId("login-mfa-form")).toBeVisible();
      await expect(page.getByTestId("login-mfa-code")).toBeVisible();
      // Wrong code -> error (also consumes this single-use challenge).
      await page.getByTestId("login-mfa-code").fill("000000");
      await page.getByTestId("login-mfa-submit").click();
      await expect(page.getByTestId("login-error")).toBeVisible();

      // --- Attempt 2: fresh challenge, real code -> success redirect ---
      await page.goto("/login");
      await submitPassword(page, MFA_EMAIL);
      await expect(page.getByTestId("login-mfa-code")).toBeVisible();
      await page.getByTestId("login-mfa-code").fill(genTotp(setup.secret));
      await page.getByTestId("login-mfa-submit").click();
      await expect(page).toHaveURL(new RegExp(`${PERSONAS.outsider.expectedLandingPath}`), {
        timeout: 60_000,
      });
    } finally {
      await deleteFactor(request, setup.factorId, setup.csrfToken);
    }
  });
});
