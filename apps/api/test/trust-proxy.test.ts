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

  // #242 F3 (2026-09-05): la forma a conteggio di salti si RESPINGE, non si accetta.
  // Da fastify 5.12 significa «non fidarti di niente», e in silenzio: req.ip diventa
  // l'indirizzo del proxy e il rate limiting per IP finisce in un secchio solo, senza
  // errore, senza log e senza un test rosso. Un valore diventato pericoloso deve far
  // fallire l'avvio, non degradare in un default sbagliato.
  it("numeric string → REJECTED, with a message that says what to use instead", () => {
    for (const v of ["1", "2", " 1 ", "0", "10"]) {
      expect(() => parseTrustProxy(v), `TRUST_PROXY="${v}" deve essere respinto`).toThrow(
        /hop-count/i,
      );
    }
    // il messaggio non si limita a dire di no: dice cosa mettere
    expect(() => parseTrustProxy("1")).toThrow(/TRUST_PROXY=127\.0\.0\.1,::1/);
    expect(() => parseTrustProxy("1")).toThrow(/TRUST_PROXY=false/);
  });

  it("la forma per indirizzo che ha SOSTITUITO l'1 in produzione resta valida", () => {
    // #242 F2: misurato sulla produzione il 2026-09-05, questo valore preserva
    // entrambe le proprietà che l'1 garantiva — req.ip e' l'IP reale del client, e
    // un X-Forwarded-For forgiato a sinistra non riesce a farsi passare per un altro IP.
    expect(parseTrustProxy("127.0.0.1,::1")).toBe("127.0.0.1,::1");
  });

  it("IP / CIDR / comma-list → trust-list string (verbatim, trimmed)", () => {
    expect(parseTrustProxy("127.0.0.1")).toBe("127.0.0.1");
    expect(parseTrustProxy("10.0.0.0/8")).toBe("10.0.0.0/8");
    expect(parseTrustProxy("127.0.0.1,10.0.0.0/8")).toBe("127.0.0.1,10.0.0.0/8");
  });
});
