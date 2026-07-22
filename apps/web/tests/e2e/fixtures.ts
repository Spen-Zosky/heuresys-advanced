/**
 * apps/web/tests/e2e/fixtures.ts
 *
 * Shared Playwright helpers + seeded persona credentials.
 * Personas come from db/scripts/seed-test-admin.ts.
 */

import path from "node:path";
import * as OTPAuth from "otpauth";
import type { APIRequestContext, Page } from "@playwright/test";
import { FIXTURE_TOTP_SECRETS } from "./mfa-fixture-secrets";

/**
 * API ORIGIN for direct (non-proxied) test requests. Every caller appends its own
 * `/v1/...` path, so this must NOT carry the version segment.
 *
 * `NEXT_PUBLIC_API_BASE_URL` is the WEB app's base and legitimately ends in `/v1`
 * (repo .env: http://localhost:3001/v1). playwright.config.ts hydrates the repo
 * .env into process.env, so locally that value lands here and produced
 * `.../v1/v1/auth/login` → 404. CI has no repo .env, so the fallback hid the bug.
 * Normalize by stripping a trailing `/v1`. Single definition — specs import this
 * instead of re-deriving it (four had drifted copies).
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(
  /\/v1\/?$/,
  "",
);

// F-001: the persona login password is environment-driven, not committed. playwright.config.ts
// loads the repo-root .env so TEST_ADMIN_PASSWORD is present here; fail closed if it is missing.
function requireTestPassword(): string {
  const v = process.env.TEST_ADMIN_PASSWORD;
  if (!v) {
    throw new Error(
      "TEST_ADMIN_PASSWORD is not set — add it to the repo-root .env (loaded by playwright.config.ts). F-001.",
    );
  }
  return v;
}

export const TEST_PASSWORD = requireTestPassword();

/** Current TOTP code for a fixture persona (S983 WS-E mandatory-MFA). */
export function totpFor(email: string): string {
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (!secret) throw new Error(`No fixture TOTP secret for ${email} — see mfa-fixture-secrets.ts`);
  return new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

/**
 * Complete the TOTP step when the login lands on the MFA challenge (live
 * mandatory policy); a no-op when the submit navigates straight to the app
 * (policy off / out-of-scope). Poll-based: deterministic against the
 * navigation-vs-challenge race. Falls through on timeout so the caller's
 * waitForURL fails loud with the real context.
 */
export async function completeMfaIfChallenged(page: Page, email: string): Promise<void> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (!page.url().includes("/login")) return; // navigated — no challenge
    const challenged = await page
      .getByTestId("login-mfa-code")
      .isVisible()
      .catch(() => false);
    if (challenged) {
      await page.getByTestId("login-mfa-code").fill(totpFor(email));
      await page.getByTestId("login-mfa-submit").click();
      return;
    }
    await page.waitForTimeout(250);
  }
}

/**
 * Resolves the persisted Playwright storageState file produced by
 * tests/e2e/auth.setup.ts. Use as `storageState: storageStateFor("employee")`
 * inside a test.use(...) block.
 */
export function storageStateFor(persona: PersonaKey): string {
  return path.join("tests", ".auth", `${persona}.json`);
}

export const PERSONAS = {
  platformAdmin: {
    email: "admin@heuresys.com",
    expectedLandingPath: "/dashboard",
  },
  tenantAdmin: {
    email: "federica.marchetti@rtl-bank.org",
    expectedLandingPath: "/dashboard",
  },
  manager: {
    email: "paolo.caputo@rtl-bank.org",
    expectedLandingPath: "/dashboard",
  },
  employee: {
    email: "tommaso.fiore@rtl-bank.org",
    expectedLandingPath: "/me",
  },
  outsider: {
    email: "antonio.parisi@rtl-bank.org",
    expectedLandingPath: "/me",
  },
  // #51 E1 (S1026): the WHISTLEBLOWING_CUSTODIAN (mig 000205) — her base roles
  // (USER, TEAM_MEMBER) are non-admin per lib/landing.ts, so she lands on /me
  // like any other pure USER; the custodian console is reached via its own URL.
  custodian: {
    email: "andrea.martino@rtl-bank.org",
    expectedLandingPath: "/me",
  },
} as const satisfies Record<string, { email: string; expectedLandingPath: string }>;

export type PersonaKey = keyof typeof PERSONAS;

export async function fillLoginForm(page: Page, email: string, password: string) {
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
}

export async function loginAs(page: Page, persona: PersonaKey) {
  const { email, expectedLandingPath } = PERSONAS[persona];
  await page.goto("/login");
  await fillLoginForm(page, email, TEST_PASSWORD);
  await page.getByTestId("login-submit").click();
  await completeMfaIfChallenged(page, email);
  await page.waitForURL(`**${expectedLandingPath}`);
}

/**
 * API-side dual-mode login (S983 WS-E): completes the TOTP step-2 with the
 * fixture secret when the mandatory policy challenges the persona; plain
 * passthrough pre-flip. Returns the FINAL success body (csrfToken, user) —
 * the request context keeps the session cookies for subsequent calls.
 */
export async function completeApiLogin(
  request: APIRequestContext,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<{ csrfToken: string; user: { userId: string } }> {
  const step1 = await request.post(`${API_BASE}/v1/auth/login`, { data: { email, password } });
  if (step1.status() !== 200) throw new Error(`API login ${email}: ${step1.status()}`);
  const b1 = (await step1.json()) as { status?: string; challengeToken?: string; csrfToken?: string; user?: { userId: string } };
  if (b1.status === "success" || b1.status === undefined) {
    return { csrfToken: b1.csrfToken ?? "", user: b1.user! };
  }
  if (b1.status === "mfa_required") {
    const step2 = await request.post(`${API_BASE}/v1/auth/login`, {
      data: { email, password, challengeToken: b1.challengeToken, mfaCode: totpFor(email) },
    });
    const b2 = (await step2.json()) as { status?: string; csrfToken?: string; user?: { userId: string } };
    if (step2.status() !== 200 || b2.status !== "success") {
      throw new Error(`API login ${email}: TOTP step-2 failed (${step2.status()})`);
    }
    return { csrfToken: b2.csrfToken ?? "", user: b2.user! };
  }
  throw new Error(
    `API login ${email}: unexpected status "${b1.status}" — fixture factor missing? run pnpm db:seed-test-admin`,
  );
}

/**
 * Robust navigation to an authenticated route. `next dev` compiles routes on first hit (cold
 * compile can exceed the default 30s) and its HMR websocket keeps the network busy so
 * `waitUntil:"load"` / `networkidle` are unreliable. Instead we wait for `domcontentloaded` with
 * head-room, then for the always-present ESS "My HR" nav link (proves the authenticated shell
 * actually rendered, not the /login redirect). Best-practice: wait for an element, not the network.
 */
export async function gotoAuthenticated(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByTestId("nav-me").waitFor({ state: "visible", timeout: 45_000 });
}
