/**
 * apps/api/test/unit/session-cache.unit.test.ts — Z-251 F2, le prove della cache di sessioni.
 *
 * Che aspetto avrebbe questa evidenza se il lavoro fosse sbagliato? Una cache che
 * "funziona" perché non scade mai, o che serve un token di due ore fa, sarebbe verde a
 * ogni corsa e produrrebbe 401 sparsi dentro la suite integration — cioè esattamente il
 * rosso-che-non-è-un-difetto che Z-251 combatte. Quindi qui si provano i RIFIUTI, non gli
 * accessi: ogni caso in cui la cache deve dire di no.
 *
 * Le tre guardie dichiarate in `session-cache.ts` hanno una prova ciascuna, e ognuna è
 * stata vista fallire sabotando il codice che protegge (annotato caso per caso).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync } from "node:fs";

import {
  MARGINE_SCADENZA_S,
  PERCORSO_CACHE,
  ancoraValida,
  azzeraCache,
  azzeraContatore,
  cacheAttiva,
  contaLoginVero,
  leggiSessione,
  loginVeri,
  salvaSessione,
  scadenzaDaJwt,
  senzaCacheDiSessione,
  ripristinaCacheDiSessione,
} from "../helpers/session-cache.js";

/** Un JWT finto: solo la forma conta, la firma qui non viene mai verificata. */
function jwtConExp(exp: number | null): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "RS256" })}.${b64(exp === null ? { sub: "x" } : { sub: "x", exp })}.firma`;
}

function risposta(exp: number | null, statusCode = 200) {
  return {
    statusCode,
    body: JSON.stringify({ status: "success", user: { email: "tizio@rtl-bank.org" } }),
    cookies: [
      { name: "hrx_access", value: jwtConExp(exp) },
      { name: "hrx_csrf", value: "csrf-abc" },
    ],
    headers: { "x-request-id": "req-1" },
  };
}

const ORA = Math.floor(Date.now() / 1000);

describe("Z-251 F2 — cache delle sessioni di test", () => {
  beforeEach(() => {
    delete process.env.TEST_SESSION_CACHE;
    // La dichiarazione di file è irreversibile per costruzione: qui si riparte accesi a
    // ogni caso, o il primo che spegne renderebbe ciechi tutti i successivi.
    ripristinaCacheDiSessione();
    azzeraCache();
    azzeraContatore();
  });
  afterEach(() => {
    azzeraCache();
    azzeraContatore();
    rmSync(`${PERCORSO_CACHE}.contatore.json`, { force: true });
  });

  describe("scadenza — la guardia n.1", () => {
    it("legge l'exp REALE dal token, non lo inventa", () => {
      expect(scadenzaDaJwt(jwtConExp(1234567890))).toBe(1234567890);
    });

    it("un token senza exp non è riusabile (null, mai 'per sempre')", () => {
      expect(scadenzaDaJwt(jwtConExp(null))).toBeNull();
    });

    it("una stringa che non è un JWT non è riusabile", () => {
      expect(scadenzaDaJwt("non-un-token")).toBeNull();
      expect(scadenzaDaJwt("")).toBeNull();
      expect(scadenzaDaJwt("a.b")).toBeNull();
    });

    it("un payload non decodificabile non è riusabile", () => {
      expect(scadenzaDaJwt("testa.@@@non-base64@@@.firma")).toBeNull();
    });

    // Sabotaggio provato: togliendo `- MARGINE_SCADENZA_S` da `ancoraValida`, questi due
    // casi diventano rossi — è il modo in cui un token che scade a metà file passerebbe.
    it("un token dentro il margine è RIFIUTATO anche se non ancora scaduto", () => {
      const fraPoco = ORA + MARGINE_SCADENZA_S - 1;
      expect(ancoraValida(fraPoco, ORA)).toBe(false);
    });

    it("un token oltre il margine è accettato", () => {
      expect(ancoraValida(ORA + MARGINE_SCADENZA_S + 1, ORA)).toBe(true);
    });

    it("un token già scaduto è rifiutato", () => {
      expect(ancoraValida(ORA - 1, ORA)).toBe(false);
    });

    it("una sessione salvata con exp dentro il margine non viene servita", () => {
      salvaSessione("tizio@rtl-bank.org", risposta(ORA + 10));
      expect(leggiSessione("tizio@rtl-bank.org")).toBeNull();
    });

    it("una sessione salvata con exp ampio viene servita identica", () => {
      const r = risposta(ORA + 3600);
      salvaSessione("tizio@rtl-bank.org", r);
      const letta = leggiSessione("tizio@rtl-bank.org");
      expect(letta).not.toBeNull();
      expect(letta?.statusCode).toBe(200);
      expect(letta?.body).toBe(r.body);
      expect(letta?.cookies.find((c) => c.name === "hrx_csrf")?.value).toBe("csrf-abc");
    });
  });

  describe("cosa NON entra in cache", () => {
    it("una risposta che non è 200", () => {
      salvaSessione("tizio@rtl-bank.org", risposta(ORA + 3600, 401));
      expect(leggiSessione("tizio@rtl-bank.org")).toBeNull();
    });

    it("una risposta senza cookie di access", () => {
      const senzaAccess = { ...risposta(ORA + 3600), cookies: [{ name: "hrx_csrf", value: "x" }] };
      salvaSessione("tizio@rtl-bank.org", senzaAccess);
      expect(leggiSessione("tizio@rtl-bank.org")).toBeNull();
    });

    it("una risposta il cui token non porta una scadenza leggibile", () => {
      salvaSessione("tizio@rtl-bank.org", risposta(null));
      expect(leggiSessione("tizio@rtl-bank.org")).toBeNull();
    });
  });

  describe("gli interruttori — la guardia n.3", () => {
    it("TEST_SESSION_CACHE=0 spegne lettura e scrittura", () => {
      process.env.TEST_SESSION_CACHE = "0";
      expect(cacheAttiva()).toBe(false);
      salvaSessione("tizio@rtl-bank.org", risposta(ORA + 3600));
      delete process.env.TEST_SESSION_CACHE;
      expect(leggiSessione("tizio@rtl-bank.org")).toBeNull();
    });

    it("senzaCacheDiSessione() spegne la cache per il file che la dichiara", () => {
      salvaSessione("tizio@rtl-bank.org", risposta(ORA + 3600));
      expect(leggiSessione("tizio@rtl-bank.org")).not.toBeNull();
      senzaCacheDiSessione();
      expect(cacheAttiva()).toBe(false);
      expect(leggiSessione("tizio@rtl-bank.org")).toBeNull();
    });
  });

  describe("il contatore dei login veri — è ciò che rende la cura misurabile", () => {
    it("conta per email e si azzera", () => {
      // Il contatore è volutamente indipendente dagli interruttori: deve poter misurare
      // anche una corsa con la cache spenta, che è il termine di paragone.
      contaLoginVero("tizio@rtl-bank.org");
      contaLoginVero("TIZIO@rtl-bank.org");
      contaLoginVero("caio@rtl-bank.org");
      expect(loginVeri()).toEqual({ "tizio@rtl-bank.org": 2, "caio@rtl-bank.org": 1 });
      azzeraContatore();
      expect(loginVeri()).toEqual({});
    });
  });

  describe("l'email non è sensibile al maiuscolo", () => {
    // Due file che scrivono la stessa persona con maiuscole diverse devono condividere
    // la sessione, non averne due — altrimenti la cura dimezza il risparmio in silenzio.
    it("salvata in un caso, letta nell'altro — attraverso il file di cache", () => {
      salvaSessione("TIZIO@RTL-BANK.ORG", risposta(ORA + 3600));
      expect(leggiSessione("tizio@rtl-bank.org")).not.toBeNull();
      expect(leggiSessione("Tizio@Rtl-Bank.Org")).not.toBeNull();
    });
  });
});
