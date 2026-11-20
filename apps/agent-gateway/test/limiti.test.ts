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
  personeAmmesse,
  ammessoAllAssistente,
  tenantAmmessi,
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

  it("prova del 2026-11-20: due giri che aspettano la conferma non bloccano una conversazione nuova", () => {
    const c = new ConversazioniAperte({ perPersona: 2, totali: 10 });
    const a = c.entra("valentina");
    const b = c.entra("valentina");
    if (!a.ok || !b.ok) throw new Error("dovevano entrare");
    expect(c.entra("valentina")).toEqual({ ok: false, motivo: "PERSONA" });
    a.sospendi();
    b.sospendi();
    const terza = c.entra("valentina");
    expect(terza.ok).toBe(true);
    // Alla decisione i due giri riprendono anche oltre il limite: erano già ammessi.
    a.riprendi();
    b.riprendi();
    expect(c.entra("valentina")).toEqual({ ok: false, motivo: "PERSONA" });
    // Sospendere e riprendere due volte non sposta i conti; esci da sospeso non toglie due volte.
    a.sospendi();
    a.sospendi();
    a.esci();
    b.esci();
    if (terza.ok) terza.esci();
    expect(c.aperte).toBe(0);
    expect(c.entra("valentina").ok).toBe(true);
    expect(c.entra("valentina").ok).toBe(true);
    expect(c.entra("valentina")).toEqual({ ok: false, motivo: "PERSONA" });
  });

  it("le sospese hanno un tetto: una persona non riempie il servizio di giri in attesa", () => {
    const c = new ConversazioniAperte({ perPersona: 2, totali: 100 });
    const aperte: Array<{ sospendi: () => void }> = [];
    for (let i = 0; i < 10; i++) {
      const g = c.entra("valentina");
      if (!g.ok) break;
      g.sospendi();
      aperte.push(g);
    }
    // 2 sospese + 2 attive (le ultime due non si sospendono più): mai oltre 2 × perPersona.
    expect(aperte.length).toBe(4);
    expect(c.aperte).toBe(4);
    expect(c.entra("valentina")).toEqual({ ok: false, motivo: "PERSONA" });
  });
});

describe("personeAmmesse: solo chi è nominato (ADR-0056 D3)", () => {
  it("senza elenco non ammette nessuno", () => {
    expect(personeAmmesse({}).size).toBe(0);
    expect(personeAmmesse({ AGENT_GATEWAY_ALLOWED_USER_IDS: " , " }).size).toBe(0);
  });

  it("legge un elenco separato da virgole, senza spazi", () => {
    const e = personeAmmesse({ AGENT_GATEWAY_ALLOWED_USER_IDS: "a1, b2 ,c3" });
    expect([...e]).toEqual(["a1", "b2", "c3"]);
    expect(e.has("d4")).toBe(false);
  });
});

describe("strumenti integrati: l'assistente non ha gli strumenti di sviluppo", () => {
  it("restano solo ToolSearch e Skill, nessuno che scriva o lanci comandi", async () => {
    const { STRUMENTI_INTEGRATI } = await import("../src/sdk-agent.js");
    expect([...STRUMENTI_INTEGRATI].sort()).toEqual(["Skill", "ToolSearch"]);
    for (const vietato of ["Bash", "Write", "Edit", "WebSearch", "Workflow", "CronCreate", "NotebookEdit"]) {
      expect(STRUMENTI_INTEGRATI as readonly string[]).not.toContain(vietato);
    }
  });
});

describe("connettori dell'abbonamento: l'assistente non li vede", () => {
  it("accetta solo gli MCP passati dal gateway e spegne i connettori claude.ai", async () => {
    const { ISOLAMENTO_MCP } = await import("../src/sdk-agent.js");
    expect(ISOLAMENTO_MCP.strictMcpConfig).toBe(true);
    expect(ISOLAMENTO_MCP.env.ENABLE_CLAUDEAI_MCP_SERVERS).toBe("false");
  });
});

describe("ammessoAllAssistente: persona nominata o tenant nominato (ADR-0056 D3)", () => {
  const env = { AGENT_GATEWAY_ALLOWED_USER_IDS: "enzo", AGENT_GATEWAY_ALLOWED_TENANT_IDS: "rtl, sys " };

  it("senza elenchi non ammette nessuno", () => {
    expect(tenantAmmessi({}).size).toBe(0);
    expect(ammessoAllAssistente({ userId: "x", tenantId: "rtl" }, {})).toBe(false);
  });

  it("ammette la persona nominata anche senza tenant (mandato di piattaforma)", () => {
    expect(ammessoAllAssistente({ userId: "enzo", tenantId: null }, env)).toBe(true);
  });

  it("ammette una persona di un tenant nominato: Enzo con l'utenza di una persona del tenant", () => {
    expect(ammessoAllAssistente({ userId: "valentina", tenantId: "rtl" }, env)).toBe(true);
    expect(ammessoAllAssistente({ userId: "admin", tenantId: "sys" }, env)).toBe(true);
  });

  it("rifiuta una persona di un tenant non nominato, e chi non ha tenant e non è nominato", () => {
    expect(ammessoAllAssistente({ userId: "altro", tenantId: "cliente-nuovo" }, env)).toBe(false);
    expect(ammessoAllAssistente({ userId: "altro", tenantId: null }, env)).toBe(false);
  });
});
