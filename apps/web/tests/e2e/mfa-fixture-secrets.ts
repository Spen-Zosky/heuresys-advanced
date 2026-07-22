/**
 * apps/web/tests/e2e/mfa-fixture-secrets.ts
 * S983 WS-E — web-side COPY of the fixture TOTP secrets (the API-side single
 * source is apps/api/test/helpers/mfa-fixture-secrets.ts; Playwright cannot
 * import across the workspace boundary cleanly). A parity test in the API
 * suite (mfa-fixture-parity.test.ts) asserts the two maps never drift.
 * Demo-grade TEST FIXTURES, not secrets — committed by design.
 */

export const E2E_FIXTURE_LABEL = "e2e-fixture";

export const FIXTURE_TOTP_SECRETS: Record<string, string> = {
  "admin@heuresys.com":               "E2EFIXADMIN2HEURESYS2TOTP2AAAAAA",
  "federica.marchetti@rtl-bank.org":  "E2EFIXFEDERICA2RTL2TOTP2BBBBBBBB",
  "paolo.caputo@rtl-bank.org":        "E2EFIXPAOLO2RTL2TOTP2CCCCCCCCCCC",
  "tommaso.fiore@rtl-bank.org":       "E2EFIXTOMMASO2RTL2TOTP2DDDDDDDDD",
  "antonio.parisi@rtl-bank.org":      "E2EFIXANTONIO2RTL2TOTP2EEEEEEEEE",
  "marco.rinaldi@rtl-bank.org":       "E2EFIXMARCO2RTL2TOTP2FFFFFFFFFFF",
  // #51 E1 (S1026): whistleblowing custodian (mig 000205), needed for the
  // whistleblowing-console E2E spec's "custodian" persona.
  "andrea.martino@rtl-bank.org":      "E2EFIXANDREA2RTL2TOTP2GGGGGGGGGG",
};
