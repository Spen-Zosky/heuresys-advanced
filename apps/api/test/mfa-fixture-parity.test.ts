/**
 * apps/api/test/mfa-fixture-parity.test.ts
 * S983 WS-E — guards the duplicated fixture-TOTP-secret maps against drift.
 * The API-side map (helpers/mfa-fixture-secrets.ts) is the single source; the
 * web E2E copy (apps/web/tests/e2e/mfa-fixture-secrets.ts) cannot import it
 * across the workspace boundary, so this test parses the web file from disk
 * and asserts byte-equal pairs. No DB, no HTTP.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURE_TOTP_SECRETS } from "./helpers/mfa-fixture-secrets.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_COPY = resolve(__dirname, "..", "..", "web", "tests", "e2e", "mfa-fixture-secrets.ts");

function parseSecretMap(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /"([^"]+@[^"]+)":\s*"([A-Z2-7]+)"/g;
  for (let m = re.exec(src); m; m = re.exec(src)) out[m[1]!] = m[2]!;
  return out;
}

describe("fixture TOTP secrets parity (api ↔ web)", () => {
  it("the web E2E copy matches the API single source exactly", () => {
    const webMap = parseSecretMap(readFileSync(WEB_COPY, "utf8"));
    expect(webMap).toEqual(FIXTURE_TOTP_SECRETS);
  });

  it("every secret is plausible base32 (RFC 4648 alphabet, ≥16 chars)", () => {
    for (const [email, secret] of Object.entries(FIXTURE_TOTP_SECRETS)) {
      expect(secret, email).toMatch(/^[A-Z2-7]{16,}$/);
    }
  });
});
