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

  // #242 F3 (2026-09-05): la forma a conteggio di salti si RESPINGE. Da fastify 5.12
  // significa «non fidarti di niente», e in silenzio: req.ip diventerebbe l'indirizzo del
  // proxy e il rate limiting per IP finirebbe in un secchio solo, senza errore ne' log.
  // ⚠ Questo file e' la SECONDA copia dei casi di parseTrustProxy (l'altra e'
  // test/trust-proxy.test.ts): aggiornandone una sola, la CI resta rossa — e cosi' e'
  // stato, misurato oggi sulla corsa di `4cebad1a`.
  it('"<n>" → RESPINTO, con un messaggio che dice cosa usare al suo posto', () => {
    for (const v of ["1", "2", " 0 ", "10"]) {
      expect(() => parseTrustProxy(v), `TRUST_PROXY="${v}" deve essere respinto`).toThrow(
        /hop-count/i,
      );
    }
    expect(() => parseTrustProxy("1")).toThrow(/TRUST_PROXY=127\.0\.0\.1,::1/);
  });

  it("la forma per indirizzo che ha sostituito l'1 in produzione resta valida", () => {
    expect(parseTrustProxy("127.0.0.1,::1")).toBe("127.0.0.1,::1");
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
