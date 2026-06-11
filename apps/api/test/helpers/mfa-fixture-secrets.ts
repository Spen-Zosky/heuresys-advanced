/**
 * apps/api/test/helpers/mfa-fixture-secrets.ts
 * S983 WS-E — SINGLE SOURCE of the demo-grade TOTP secrets for the 6 seeded
 * test personas (mandatory-MFA total coverage). These are TEST FIXTURES, not
 * secrets: they gate only the case-study personas (same trust level as the
 * shared fixture password) and are deliberately committed so every machine,
 * CI and PROD smoke can complete the TOTP step-2 deterministically.
 *
 * The factor rows seeded from these secrets carry metadata.label =
 * E2E_FIXTURE_LABEL — the discriminator that (a) makes the seeding idempotent
 * (check-before-insert: there is NO unique on (user,kind)), and (b) protects
 * the fixture factors from the scoped DELETEs the MFA suites run in cleanup.
 *
 * apps/web/tests/e2e duplicates this map (Playwright cannot import across the
 * workspace boundary cleanly) — a parity check in the API suite asserts the
 * two copies never drift.
 */

export const E2E_FIXTURE_LABEL = "e2e-fixture";

/** Base32 (RFC 4648 alphabet A-Z 2-7), 32 chars = 160-bit standard TOTP seed. */
export const FIXTURE_TOTP_SECRETS: Record<string, string> = {
  "admin@heuresys.com":               "E2EFIXADMIN2HEURESYS2TOTP2AAAAAA",
  "federica.marchetti@rtl-bank.org":  "E2EFIXFEDERICA2RTL2TOTP2BBBBBBBB",
  "paolo.caputo@rtl-bank.org":        "E2EFIXPAOLO2RTL2TOTP2CCCCCCCCCCC",
  "tommaso.fiore@rtl-bank.org":       "E2EFIXTOMMASO2RTL2TOTP2DDDDDDDDD",
  "antonio.parisi@rtl-bank.org":      "E2EFIXANTONIO2RTL2TOTP2EEEEEEEEE",
  "marco.rinaldi@rtl-bank.org":       "E2EFIXMARCO2RTL2TOTP2FFFFFFFFFFF",
};

export const FIXTURE_PERSONA_EMAILS = Object.keys(FIXTURE_TOTP_SECRETS);
