/**
 * apps/api/test/unit/mfa-crypto-fault-status.unit.test.ts — S1033.
 *
 * Un segreto MFA che non si decifra è un GUASTO DEL SERVER (chiave di cifratura
 * sbagliata o assente, dato corrotto), non una richiesta malformata del client.
 * Fino a S1033 le due classi di secret-crypto estendevano `ApiError` generico e
 * l'errorHandler le declassava a 400 «Invalid request payload»: al chiamante —
 * e a chi legge i log della CI — un guasto di configurazione appariva come
 * colpa sua.
 *
 * Costo misurato del sintomo travestito: la CI rossa di S1032 (158 file su 218)
 * si presentava come `login <persona>: 400`, e la chiave di cifratura divergente
 * sul runner è stata trovata solo riproducendo il login contro il DB della CI.
 *
 * Qui si fissa il contratto: status 500, codice specifico conservato (serve a
 * chi diagnostica), messaggio pubblico generico (il dettaglio di configurazione
 * vive nel log, non nella risposta a un endpoint non autenticato).
 */

import { describe, it, expect } from "vitest";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import {
  MfaEncryptionKeyMissingError,
  MfaCiphertextMalformedError,
  decryptSecret,
  ENC_PREFIX,
} from "../../src/modules/auth/secret-crypto.js";
import type { FastifyReply, FastifyRequest } from "fastify";

interface Captured {
  status?: number;
  body?: { error?: { code?: string; message?: string } };
  logged: boolean;
}

function makeCtx(): { req: FastifyRequest; reply: FastifyReply; out: Captured } {
  const out: Captured = { logged: false };
  const reply = {
    code(c: number) {
      out.status = c;
      return reply;
    },
    send(b: unknown) {
      out.body = b as Captured["body"];
      return reply;
    },
    header() {
      return reply;
    },
  } as unknown as FastifyReply;
  const req = {
    url: "/v1/auth/login",
    log: {
      error: () => {
        out.logged = true;
      },
    },
  } as unknown as FastifyRequest;
  return { req, reply, out };
}

describe("guasto di cifratura MFA → 500, non 400 (unit)", () => {
  it("ciphertext malformato: 500 + codice conservato", async () => {
    const { req, reply, out } = makeCtx();
    await errorHandler(new MfaCiphertextMalformedError(), req, reply);
    expect(out.status).toBe(500);
    expect(out.body?.error?.code).toBe("MFA_CIPHERTEXT_MALFORMED");
  });

  it("chiave di cifratura assente: 500 + codice conservato", async () => {
    const { req, reply, out } = makeCtx();
    await errorHandler(new MfaEncryptionKeyMissingError(), req, reply);
    expect(out.status).toBe(500);
    expect(out.body?.error?.code).toBe("MFA_ENCRYPTION_KEY_MISSING");
  });

  it("il guasto viene LOGGATO (un 500 silenzioso non è diagnosticabile)", async () => {
    const { req, reply, out } = makeCtx();
    await errorHandler(new MfaCiphertextMalformedError(), req, reply);
    expect(out.logged).toBe(true);
  });

  it("la risposta non rivela il dettaglio di configurazione interno", async () => {
    const { req, reply, out } = makeCtx();
    await errorHandler(new MfaEncryptionKeyMissingError(), req, reply);
    // Il messaggio interno nomina la variabile d'ambiente; quello pubblico no.
    expect(new MfaEncryptionKeyMissingError().message).toContain("MFA_ENCRYPTION_KEY");
    expect(out.body?.error?.message ?? "").not.toContain("MFA_ENCRYPTION_KEY");
  });

  it("un ciphertext reale illeggibile produce quella classe (non un errore generico)", () => {
    expect(() => decryptSecret(`${ENC_PREFIX}non-e-un-ciphertext`)).toThrow(
      MfaCiphertextMalformedError,
    );
  });
});
