/**
 * ADR-0063 D4, piano «Heuresys AI-driven» voce F0b: il modo LIBERA resta spento.
 *
 * Anche se il registro delle capacità dichiarasse LIBERA un'operazione per RTL (un'attivazione
 * finta, il caso che il database con la migrazione 000518 non accetta più), il cancello non la
 * esegue da sola: la porta davanti alla persona e scrive nel diario `LIBERA_SPENTA`. E il
 * servizio non accende mai il meccanismo: la sola via per farlo (`liberaAccesa`) non compare né
 * in `server.ts` né in `sdk-agent.ts`.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeCanUseTool } from "../src/write-gate.js";
import { MemoryAuditSink } from "../src/audit-sink.js";
import type { CapacitaLibera, RegistroCapacita } from "../src/capacita.js";

const FINTA: CapacitaLibera = { code: "struttura.unita", version: 1, volumeCap: 100 };

/** Un registro con un'attivazione LIBERA finta per RTL su ogni operazione. */
const registroFinto: RegistroCapacita = {
  async liberaPer(_agentCode, tenantCode) {
    return tenantCode === "RTL_BANK" ? FINTA : undefined;
  },
};

type Capacita = NonNullable<NonNullable<Parameters<typeof makeCanUseTool>[1]>["capacita"]>;

function gate(approva: boolean, capacita: Capacita) {
  const audit = new MemoryAuditSink();
  const approve = vi.fn(async () => approva);
  const canUseTool = makeCanUseTool(approve, {
    audit,
    persone: { conta: () => 0, livello: () => "silenzioso" },
    principal: { principal: "user", subject: "u-1", tenant: "RTL_BANK", conversationId: "c-1" },
    capacita,
  });
  return { canUseTool, approve, audit };
}

describe("il modo LIBERA è spento (ADR-0063 D4)", () => {
  it("un'attivazione LIBERA finta per RTL non scrive da sola: chiede alla persona, e il diario lo dice", async () => {
    const { canUseTool, approve, audit } = gate(false, { registro: registroFinto, agentCode: "assistente-hr" });
    const d = await canUseTool("hrx_org_units_upsert", { payload: { name: "x" } });
    expect(d.behavior).toBe("deny"); // la persona (finta) non conferma
    expect(approve).toHaveBeenCalledTimes(1);
    expect(audit.entries.map((e) => e.reason)).toEqual(["WRITE_DENIED_OR_TIMEOUT LIBERA_SPENTA struttura.unita@1"]);
    expect(audit.entries.some((e) => e.outcome === "allow-write-autonomous")).toBe(false);
  });

  it("se la persona conferma, la scrittura passa come scrittura approvata, non autonoma", async () => {
    const { canUseTool, approve, audit } = gate(true, { registro: registroFinto, agentCode: "assistente-hr" });
    for (let i = 0; i < 5; i++) {
      const d = await canUseTool("hrx_org_units_upsert", { payload: { name: `x${i}` } });
      expect(d.behavior).toBe("allow");
    }
    expect(approve).toHaveBeenCalledTimes(5);
    expect(audit.entries.every((e) => e.outcome === "allow-write")).toBe(true);
    expect(audit.entries[0]!.reason).toBe("WRITE_HUMAN_APPROVED LIBERA_SPENTA struttura.unita@1");
  });

  it("il controllo è rosso con il meccanismo acceso: la stessa attivazione finta scrive da sola", async () => {
    const { canUseTool, approve, audit } = gate(false, { registro: registroFinto, agentCode: "assistente-hr", liberaAccesa: true });
    const d = await canUseTool("hrx_org_units_upsert", { payload: { name: "x" } });
    expect(d.behavior).toBe("allow");
    expect(approve).not.toHaveBeenCalled();
    expect(audit.entries[0]!.outcome).toBe("allow-write-autonomous");
  });

  it("il servizio non accende mai il meccanismo", () => {
    for (const f of ["../src/server.ts", "../src/sdk-agent.ts"]) {
      const testo = readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8");
      expect(testo, f).not.toMatch(/liberaAccesa/);
    }
  });
});
