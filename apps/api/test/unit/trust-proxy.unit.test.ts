/**
 * apps/api/test/unit/trust-proxy.unit.test.ts — D-64 unit layer.
 * parseTrustProxy (D-28): il parse esplicito che evita il footgun
 * Boolean("false") === true. Le forme accettate sono contratto di sicurezza
 * (rate-limit per-IP dietro nginx) — ogni ramo va inchiodato.
 */

import { describe, it, expect } from "vitest";
import { parseTrustProxy } from "../../src/config/trust-proxy.js";

describe("parseTrustProxy (unit)", () => {
  it('"" e "false" (case/spazi-insensitive) → false', () => {
    expect(parseTrustProxy("")).toBe(false);
    expect(parseTrustProxy("false")).toBe(false);
    expect(parseTrustProxy(" FALSE ")).toBe(false);
  });

  it('"true" → true (fidati dell\'intera catena XFF — spoofabile, mai in prod)', () => {
    expect(parseTrustProxy("true")).toBe(true);
    expect(parseTrustProxy(" True ")).toBe(true);
  });

  it('"<n>" → number (hop count; PROD dietro nginx singolo = 1)', () => {
    expect(parseTrustProxy("1")).toBe(1);
    expect(parseTrustProxy("2")).toBe(2);
    expect(parseTrustProxy(" 0 ")).toBe(0);
  });

  it("IP / CIDR / lista → string passthrough (trust-list proxy-addr)", () => {
    expect(parseTrustProxy("10.0.0.1")).toBe("10.0.0.1");
    expect(parseTrustProxy("127.0.0.1/8")).toBe("127.0.0.1/8");
    expect(parseTrustProxy("10.0.0.1, 172.16.0.0/12")).toBe("10.0.0.1, 172.16.0.0/12");
  });

  it('il footgun storico: "false" NON è truthy (contratto COOKIE_SECURE/SMTP_SECURE)', () => {
    // Boolean("false") === true — il motivo per cui questo parser esiste.
    expect(parseTrustProxy("false")).not.toBe(true);
  });
});
