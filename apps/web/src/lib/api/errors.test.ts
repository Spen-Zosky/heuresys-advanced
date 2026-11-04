/**
 * apps/web/src/lib/api/errors.test.ts — S-12 e F-4 del piano interfacce (2026-11-04).
 *
 * L'errore che una pagina stampa deve essere una frase nella lingua della persona, con il
 * riferimento da citare: prima era il testo inglese del server («Missing permission: x»,
 * «Unexpected server error») o «HTTP 500».
 */
import { describe, it, expect, beforeAll } from "vitest";
import i18next from "i18next";
import commonIt from "../../locales/it/common.json";
import { ApiError, testoErrore } from "./errors";

beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.init({ lng: "it", resources: { it: { common: commonIt } }, interpolation: { escapeValue: false } });
  }
});

describe("S-12 — il testo dell'errore viene dal codice, poi dallo stato", () => {
  it("un 403 del server diventa una frase italiana con il riferimento", () => {
    const e = new ApiError(403, {
      error: { code: "FORBIDDEN", message: "Missing permission: user:read", requestId: "req-42" },
    });
    expect(e.message).toBe(
      "Il tuo profilo non permette questa operazione. Riferimento da citare: req-42",
    );
    expect(e.serverMessage).toBe("Missing permission: user:read");
    expect(e.requestId).toBe("req-42");
  });

  it("un codice senza testo proprio usa lo stato", () => {
    expect(testoErrore(409, "POSITION_CODE_CONFLICT")).toBe(
      "L'operazione è in conflitto con lo stato attuale dei dati: ricarica la pagina e riprova.",
    );
  });

  it("uno stato 5xx senza testo proprio usa quello del 500", () => {
    expect(testoErrore(503, "UPSTREAM_DOWN")).toBe("Si è verificato un errore del server.");
  });

  it("il tetto dei risultati spiega che cosa fare", () => {
    expect(testoErrore(422, "RESULT_LIMIT_EXCEEDED")).toMatch(/restringi con un filtro/);
  });

  it("nessun testo inglese del server arriva alla persona", () => {
    const e = new ApiError(500, { error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
    expect(e.message).not.toMatch(/Unexpected|server error/);
  });
});
