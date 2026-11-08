/**
 * ADR-0056 D4 (T6c) — quale proposta la finestra riaperta offre, e quando un'attività è aperta.
 */
import { describe, it, expect } from "vitest";
import type { AgentProposal } from "@heuresys/shared/schemas/agent-conversations";
import { attivitaAperta, propostaDaDecidere, ultimaAttivita } from "./conversazioni";

const proposta = (id: string, status: AgentProposal["status"], createdAt: string): AgentProposal => ({
  id, activityId: "a", kind: "SCRITTURA", tool: "hrx_x", input: {}, actionClass: null, personsCount: null,
  status, rejectReason: null, createdAt, expiresAt: createdAt, decidedAt: null,
});

describe("propostaDaDecidere", () => {
  it("la più vecchia in attesa; scadute, approvate e scartate non si offrono", () => {
    const p = propostaDaDecidere([
      proposta("scaduta", "SCADUTA", "2026-11-08T09:00:00Z"),
      proposta("nuova", "IN_ATTESA", "2026-11-08T10:05:00Z"),
      proposta("vecchia", "IN_ATTESA", "2026-11-08T10:00:00Z"),
      proposta("fatta", "APPROVATA", "2026-11-08T08:00:00Z"),
    ]);
    expect(p?.id).toBe("vecchia");
  });

  it("niente in attesa, niente da offrire", () => {
    expect(propostaDaDecidere([proposta("s", "SCADUTA", "2026-11-08T09:00:00Z")])).toBeUndefined();
  });
});

describe("attività aperta e ultima", () => {
  it("aperte solo IN_CORSO e IN_ATTESA", () => {
    expect(["IN_CORSO", "IN_ATTESA", "FATTA", "FALLITA", "INTERROTTA"].map((s) => attivitaAperta({ status: s as never }))).toEqual([true, true, false, false, false]);
  });
  it("l'ultima è la più recente in ordine di inizio", () => {
    expect(ultimaAttivita({ activities: [{ id: "1" }, { id: "2" }] as never })?.id).toBe("2");
    expect(ultimaAttivita({ activities: [] })).toBeUndefined();
  });
});
