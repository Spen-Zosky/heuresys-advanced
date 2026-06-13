import { describe, it, expect } from "vitest";
import { parseTrustProxy } from "../src/config/trust-proxy.js";

// D-28 / S-100X-A2 F-WS-H-1 (S988): TRUST_PROXY must parse like a proxy-trust spec, NOT via
// z.coerce.boolean (Boolean("false") === true — the footgun that left PROD effectively
// trustProxy=true/spoofable behind nginx). Pure unit, no DB / no env / no JWT load.
describe("parseTrustProxy (D-28)", () => {
  it('"false" / "" / whitespace / case → false (the value z.coerce.boolean got WRONG)', () => {
    expect(parseTrustProxy("false")).toBe(false);
    expect(parseTrustProxy("FALSE")).toBe(false);
    expect(parseTrustProxy("")).toBe(false);
    expect(parseTrustProxy("  false  ")).toBe(false);
  });

  it('"true" → true (legacy trust-all)', () => {
    expect(parseTrustProxy("true")).toBe(true);
    expect(parseTrustProxy("TRUE")).toBe(true);
  });

  it("numeric string → hop-count number (PROD behind nginx = 1)", () => {
    expect(parseTrustProxy("1")).toBe(1);
    expect(parseTrustProxy("2")).toBe(2);
    expect(parseTrustProxy(" 1 ")).toBe(1);
  });

  it("IP / CIDR / comma-list → trust-list string (verbatim, trimmed)", () => {
    expect(parseTrustProxy("127.0.0.1")).toBe("127.0.0.1");
    expect(parseTrustProxy("10.0.0.0/8")).toBe("10.0.0.0/8");
    expect(parseTrustProxy("127.0.0.1,10.0.0.0/8")).toBe("127.0.0.1,10.0.0.0/8");
  });
});
