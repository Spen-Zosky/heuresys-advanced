/**
 * ADR-0056, piano dei principi agentici voce T3: il modello per nome e i limiti della conversazione.
 */
import { describe, it, expect } from "vitest";
import {
  ConversazioniAperte,
  LIMITI_DEFAULT,
  MODELLO_DEFAULT,
  ModelloNonValido,
  leggiLimiti,
  modelloAgenti,
} from "../src/limiti.js";

describe("modelloAgenti: il modello è fissato per nome", () => {
  it("senza ambiente usa il default, che è un identificativo completo", () => {
    expect(modelloAgenti({})).toBe(MODELLO_DEFAULT);
    expect(MODELLO_DEFAULT).toMatch(/^claude-[a-z]+-\d+/);
  });

  it("accetta un identificativo completo", () => {
    expect(modelloAgenti({ AGENT_GATEWAY_MODEL: "claude-opus-5-5" })).toBe("claude-opus-5-5");
    expect(modelloAgenti({ AGENT_GATEWAY_MODEL: "claude-haiku-4-5-20251001" })).toBe("claude-haiku-4-5-20251001");
  });

  it.each(["sonnet", "opus", "default", "claude-sonnet", "claude-sonnet-latest", "Claude-Opus-5-5", "claude-opus-5-5 "])(
    "rifiuta «%s», che non è un identificativo completo",
    (nome) => {
      // lo spazio finale si toglie: «claude-opus-5-5 » diventa valido, gli altri alzano
      if (nome.trim() === "claude-opus-5-5") {
        expect(modelloAgenti({ AGENT_GATEWAY_MODEL: nome })).toBe("claude-opus-5-5");
        return;
      }
      expect(() => modelloAgenti({ AGENT_GATEWAY_MODEL: nome })).toThrow(ModelloNonValido);
    },
  );
});

describe("leggiLimiti", () => {
  it("senza ambiente restituisce i default", () => {
    expect(leggiLimiti({})).toEqual(LIMITI_DEFAULT);
  });

  it("un valore illeggibile, zero o negativo torna al default e non diventa «senza limite»", () => {
    const l = leggiLimiti({
      AGENT_GATEWAY_MAX_CONVERSAZIONI_PERSONA: "abc",
      AGENT_GATEWAY_MAX_CONVERSAZIONI: "0",
      AGENT_GATEWAY_MAX_GIRI: "-3",
      AGENT_GATEWAY_MAX_DURATA_MS: "1.5",
    });
    expect(l).toEqual(LIMITI_DEFAULT);
  });

  it("legge i valori validi", () => {
    expect(
      leggiLimiti({
        AGENT_GATEWAY_MAX_CONVERSAZIONI_PERSONA: "1",
        AGENT_GATEWAY_MAX_CONVERSAZIONI: "3",
        AGENT_GATEWAY_MAX_GIRI: "12",
        AGENT_GATEWAY_MAX_DURATA_MS: "60000",
      }),
    ).toEqual({ perPersona: 1, totali: 3, giri: 12, durataMs: 60_000 });
  });
});

describe("ConversazioniAperte", () => {
  it("ferma la stessa persona oltre il suo limite, e lascia entrare le altre", () => {
    const c = new ConversazioniAperte({ perPersona: 2, totali: 10 });
    expect(c.entra("anna").ok).toBe(true);
    expect(c.entra("anna").ok).toBe(true);
    expect(c.entra("anna")).toEqual({ ok: false, motivo: "PERSONA" });
    expect(c.entra("bruno").ok).toBe(true);
    expect(c.aperte).toBe(3);
  });

  it("ferma tutti oltre il limite del servizio", () => {
    const c = new ConversazioniAperte({ perPersona: 5, totali: 2 });
    expect(c.entra("anna").ok).toBe(true);
    expect(c.entra("bruno").ok).toBe(true);
    expect(c.entra("carla")).toEqual({ ok: false, motivo: "SERVIZIO" });
  });

  it("esci libera il posto una volta sola", () => {
    const c = new ConversazioniAperte({ perPersona: 1, totali: 2 });
    const a = c.entra("anna");
    const b = c.entra("bruno");
    if (!a.ok || !b.ok) throw new Error("dovevano entrare");
    a.esci();
    a.esci(); // la seconda non deve liberare il posto di bruno
    expect(c.aperte).toBe(1);
    expect(c.entra("bruno")).toEqual({ ok: false, motivo: "PERSONA" });
    expect(c.entra("anna").ok).toBe(true);
  });
});
