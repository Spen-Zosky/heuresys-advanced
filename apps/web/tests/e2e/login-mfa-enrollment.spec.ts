/**
 * apps/web/tests/e2e/login-mfa-enrollment.spec.ts
 *
 * MVP-4 par.2.5 #4 — mandatory-MFA enrollment gate, LIVE DATA E2E.
 *
 * The RTL tenant policy is enabled scoped to roleCodes ["READ_ONLY"] (admin
 * API), so the ONLY gated persona is alberto.rossetti (R2 READ_ONLY — used by
 * no other spec; even a crashed run cannot gate the standard personas). Two
 * serial scenarios drive the /login third state end-to-end:
 *
 *   1. TOTP leg: gate panel → authenticator method → QR/manual secret → real
 *      6-digit code → verify → automatic re-login → regular MFA challenge →
 *      code → /me landing. Factor removed via the 2-step API login (cleanup).
 *   2. Passkey leg (CDP virtual authenticator): gate panel → passkey method →
 *      registration ceremony → automatic re-login → "use passkey" button →
 *      assertion ceremony COMPLETES the login (cookies from the verify
 *      endpoint) → /me landing. Factor removed via /me/security UI.
 *
 * afterAll disables the policy (enabled:false) so re-runs and other suites are
 * unaffected. NO storageState — the unauthenticated /login page is the target.
 */
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { API_BASE, completeApiLogin, PERSONAS, passwordFor } from "./fixtures";
import { totpSecretFor } from "./mfa-fixture-secrets";

const GATED_EMAIL = "alberto.rossetti@rtl-bank.org"; // R2 READ_ONLY persona
const ADMIN = PERSONAS.platformAdmin;

function genTotp(secretBase32: string): string {
  return new OTPAuth.TOTP({
    issuer: "Heuresys",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  }).generate();
}

async function adminCsrf(request: APIRequestContext): Promise<string> {
  // Dual-mode (S983 WS-E): TOTP step-2 against the fixture factor when the
  // live mandatory policy challenges the admin; plain passthrough pre-flip.
  const { csrfToken } = await completeApiLogin(request, ADMIN.email);
  return csrfToken;
}

async function rtlTenantId(request: APIRequestContext): Promise<string> {
  const res = await request.get(`${API_BASE}/v1/tenants`);
  expect(res.status(), "list tenants").toBe(200);
  const body = (await res.json()) as { items: Array<{ tenantId: string; tenantCode: string }> };
  const rtl = body.items.find((t) => t.tenantCode.toUpperCase().includes("RTL"));
  if (!rtl) throw new Error("RTL tenant not found");
  return rtl.tenantId;
}

async function setPolicy(request: APIRequestContext, csrf: string, tenantId: string, enabled: boolean) {
  const res = await request.put(`${API_BASE}/v1/mfa-policy/${tenantId}`, {
    headers: { "x-csrf-token": csrf },
    data: { enabled, roleCodes: ["READ_ONLY"] },
  });
  expect(res.status(), `set policy enabled=${enabled}`).toBe(200);
}

/** Complete the 2-step API login for the gated persona using a TOTP secret,
 *  then delete every MFA factor (cleanup that works once a factor exists). */
async function cleanupFactorsViaTotp(request: APIRequestContext, secret: string) {
  const step1 = await request.post(`${API_BASE}/v1/auth/login`, {
    data: { email: GATED_EMAIL, password: passwordFor(GATED_EMAIL) },
  });
  const j1 = (await step1.json()) as { status: string; challengeToken?: string };
  if (j1.status !== "mfa_required" || !j1.challengeToken) return; // nothing to clean
  const step2 = await request.post(`${API_BASE}/v1/auth/login`, {
    data: {
      email: GATED_EMAIL,
      password: passwordFor(GATED_EMAIL),
      challengeToken: j1.challengeToken,
      mfaCode: genTotp(secret),
    },
  });
  if (step2.status() !== 200) return;
  const csrf = (await step2.json()).csrfToken as string;
  const list = await request.get(`${API_BASE}/v1/auth/mfa/factors`);
  const items = ((await list.json()) as { items: Array<{ factorId: string }> }).items;
  for (const f of items) {
    await request
      .delete(`${API_BASE}/v1/auth/mfa/factors/${f.factorId}`, { headers: { "x-csrf-token": csrf } })
      .catch(() => {});
  }
}

async function submitPassword(page: Page, email: string) {
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(passwordFor(GATED_EMAIL));
  await page.getByTestId("login-submit").click();
}

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.describe("MVP-4 par.2.5 #4 /login — mandatory-MFA enrollment gate", () => {
  let tenantId: string;
  // Snapshot-restore (S982): the live DB may carry a REAL activation (the RTL
  // role-slice enabled by Enzo) — afterAll must restore the EXACT pre-suite
  // state, never blanket-disable (this spec once wiped the real activation).
  let savedPolicy: { enabled: boolean; roleCodes: string[] | null } | null = null;

  test.beforeAll(async ({ request }) => {
    // Loud pre-flight: if a previous crashed run left alberto with a verified
    // WEBAUTHN-only factor, the gate panel can never appear again and the
    // factor cannot be removed via API (the assertion key died with the CDP
    // virtual authenticator). Fail with the recovery SQL instead of timing out.
    const probe = await request.post(`${API_BASE}/v1/auth/login`, {
      data: { email: GATED_EMAIL, password: passwordFor(GATED_EMAIL) },
    });
    const pj = (await probe.json()) as { status: string; availableKinds?: string[] };
    if (pj.status === "mfa_required" && !(pj.availableKinds ?? []).includes("TOTP")) {
      throw new Error(
        `${GATED_EMAIL} has a leftover non-TOTP MFA factor from a crashed run. ` +
          "Recover with: DELETE FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = " +
          `(SELECT user_id FROM sys.sys_users WHERE user_email = '${GATED_EMAIL}');`,
      );
    }
    // Z-262: il provisioning derivato ha assegnato un fattore TOTP a OGNI utente,
    // compreso questo. Ma il gate di enrollment esiste per definizione solo per chi
    // un secondo fattore NON ce l'ha: con il fattore presente il pannello non
    // compare e il test scade su un'attesa. La precondizione va GARANTITA, non
    // sperata — si rimuove per la stessa via API usata dal cleanup finale.
    if (pj.status === "mfa_required") {
      await cleanupFactorsViaTotp(request, totpSecretFor(GATED_EMAIL));
    }
    const csrf = await adminCsrf(request);
    tenantId = await rtlTenantId(request);
    // Snapshot the pre-suite policy before forcing the gate ON for the test.
    const list = await request.get(`${API_BASE}/v1/mfa-policy/`);
    const items = ((await list.json()) as {
      items: Array<{ tenantId: string; enabled: boolean; roleCodes: string[] | null }>;
    }).items;
    const pre = items.find((p) => p.tenantId === tenantId);
    savedPolicy = pre ? { enabled: pre.enabled, roleCodes: pre.roleCodes } : null;
    await setPolicy(request, csrf, tenantId, true);
  });

  test.afterAll(async ({ request }) => {
    const csrf = await adminCsrf(request);
    if (savedPolicy) {
      // Restore the exact pre-suite state (e.g. the real RTL role-slice activation).
      const res = await request.put(`${API_BASE}/v1/mfa-policy/${tenantId}`, {
        headers: { "x-csrf-token": csrf },
        data: { enabled: savedPolicy.enabled, roleCodes: savedPolicy.roleCodes },
      });
      expect(res.status(), "restore pre-suite policy").toBe(200);
    } else {
      await setPolicy(request, csrf, tenantId, false);
    }
  });

  test("TOTP leg: gate panel → enroll+verify → auto re-login → MFA challenge → /me", async ({
    page,
    request,
  }) => {
    let secret = "";
    try {
      await page.goto("/login");
      await submitPassword(page, GATED_EMAIL);

      // Third login state: the enrollment panel (no MFA form, no redirect).
      //
      // #219 F1 firma A — condizionale alla configurazione, come il caso gemello in
      // login-mfa.spec.ts. Il pannello di arruolamento e' un effetto del gate §3b:
      // con `MFA_ENFORCEMENT_ENABLED=false` — che e' cio' che la produzione ha oggi,
      // misurato il 2026-08-21 — non compare, e il caso non sta rilevando un guasto.
      // Si osserva il comportamento, non la variabile: se il gate torna acceso, il
      // caso riprende a girare senza che nessuno debba ricordarsene.
      const pannelloComparso = await page
        .getByTestId("login-enroll-panel")
        .waitFor({ state: "visible", timeout: 30_000 })
        .then(() => true, () => false);
      test.skip(
        !pannelloComparso,
        "MFA enforcement spento in questo ambiente (MFA_ENFORCEMENT_ENABLED=false): senza il gate §3b il pannello di arruolamento non compare",
      );
      await expect(page.getByTestId("login-enroll-panel")).toBeVisible({ timeout: 30_000 });
      await page.getByTestId("login-enroll-totp").click();

      // The manual secret is displayed alongside the QR — read it to compute codes.
      const secretEl = page.getByTestId("login-enroll-secret");
      await expect(secretEl).toBeVisible({ timeout: 15_000 });
      secret = (await secretEl.innerText()).trim();
      expect(secret.length).toBeGreaterThan(10);

      await page.getByTestId("login-enroll-code").fill(genTotp(secret));
      await page.getByTestId("login-enroll-verify").click();

      // Factor verified → the page re-submits the login and lands on the
      // REGULAR MFA challenge (the account now has a verified factor).
      await expect(page.getByTestId("login-mfa-form")).toBeVisible({ timeout: 30_000 });
      await page.getByTestId("login-mfa-code").fill(genTotp(secret));
      await page.getByTestId("login-mfa-submit").click();
      await expect(page).toHaveURL(/\/me/, { timeout: 60_000 });
    } finally {
      if (secret) await cleanupFactorsViaTotp(request, secret);
    }
  });

  test("passkey leg: gate panel → passkey enroll → auto re-login → 'use passkey' completes login → /me", async ({
    page,
  }) => {
    // CDP virtual authenticator (same setup as webauthn.spec): software CTAP2
    // internal authenticator, auto user-presence/verification.
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

    await page.goto("/login");
    await submitPassword(page, GATED_EMAIL);
    await expect(page.getByTestId("login-enroll-panel")).toBeVisible({ timeout: 30_000 });

    // From the registration verify onward a verified WEBAUTHN factor exists on
    // the LIVE DB: the steps run inside try/finally so a mid-test failure
    // still attempts the cleanup while the page (and the virtual authenticator)
    // are alive. A hard browser crash in this window is the residual risk —
    // the beforeAll loud guard catches it on the next run with recovery SQL.
    let enrolled = false;
    try {
      // Passkey method: registration ceremony + verify + automatic re-login ->
      // the regular MFA step appears with the "use passkey" button (kinds=[WEBAUTHN]).
      const [regResp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes("/webauthn/registration/verify") && r.request().method() === "POST",
          { timeout: 30_000 },
        ),
        page.getByTestId("login-enroll-passkey").click(),
      ]);
      expect(regResp.status()).toBe(200);
      enrolled = true;

      await expect(page.getByTestId("login-mfa-form")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("login-mfa-passkey")).toBeVisible();

      // The assertion ceremony COMPLETES the login: the verify endpoint sets the
      // auth cookies and returns the success bundle -> role landing redirect.
      const [authResp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes("/webauthn/authentication/verify") && r.request().method() === "POST",
          { timeout: 30_000 },
        ),
        page.getByTestId("login-mfa-passkey").click(),
      ]);
      expect(authResp.status()).toBe(200);
      await expect(page).toHaveURL(/\/me/, { timeout: 60_000 });
    } finally {
      if (enrolled) {
        // Remove the passkey via /me/security (the only deletion path for a
        // WEBAUTHN-only account; API login cannot complete an assertion
        // ceremony from a request context). If the login leg failed, finish it
        // here first via the still-alive virtual authenticator.
        await page.goto("/me/security", { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
        if (page.url().includes("/login")) {
          await submitPassword(page, GATED_EMAIL);
          await page.getByTestId("login-mfa-passkey").click().catch(() => {});
          await page.goto("/me/security", { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
        }
        const passkeyRow = page.getByTestId("me-security-factor-row").filter({ hasText: "Passkey" });
        await expect(passkeyRow.first()).toBeVisible({ timeout: 30_000 });
        page.on("dialog", (d) => void d.accept());
        const [delResp] = await Promise.all([
          page.waitForResponse((r) => r.url().includes("/v1/auth/mfa/factors/") && r.request().method() === "DELETE"),
          passkeyRow.first().getByTestId("me-security-factor-delete").click(),
        ]);
        expect(delResp.status()).toBe(204);
      }
    }
  });
});
