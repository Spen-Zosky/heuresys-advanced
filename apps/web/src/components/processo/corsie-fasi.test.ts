import { describe, expect, it } from "vitest";
import type { TenantProcessScheda } from "@heuresys/shared";
import { attivitaInOrdine, corsieFasi } from "./corsie-fasi";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const att = (n: number, unitId: string, unitName: string) =>
  ({ activityId: id(100 + n), processId: id(1), ordinal: n, code: `A${n}`, name: `Attività ${n}`, unitId, unitName, executorName: null, typicalHoursPerCycle: null });

/** Cinque unità dichiarate dal processo, ma solo tre eseguono attività. */
const scheda = {
  process: { processId: id(1), name: "Operatività di filiale" },
  subprocesses: [],
  activities: [att(1, id(11), "Filiale"), att(2, id(12), "Back office"), att(3, id(11), "Filiale"), att(4, id(13), "Tesoreria")],
  units: [
    { unitId: id(11), unitName: "Filiale", role: "RESPONSIBLE", participants: [] },
    { unitId: id(12), unitName: "Back office", role: "ACCOUNTABLE", participants: [] },
    { unitId: id(13), unitName: "Tesoreria", role: "RESPONSIBLE", participants: [] },
    { unitId: id(14), unitName: "Compliance", role: "CONSULTED", participants: [] },
    { unitId: id(15), unitName: "Direzione", role: "INFORMED", participants: [] },
  ],
} as unknown as TenantProcessScheda;

describe("corsieFasi", () => {
  it("dà 5 corsie: le 3 di chi esegue e le 2 delle unità consultate e informate, in coda", () => {
    const { corsie, indice } = corsieFasi(scheda, attivitaInOrdine(scheda), "Senza unità");
    expect(corsie.map((c) => c.nome)).toEqual(["Filiale", "Back office", "Tesoreria", "Compliance", "Direzione"]);
    expect(indice.get(id(14))).toBe(3);
    expect(indice.get(id(15))).toBe(4);
  });
  it("non duplica un'unità che esegue e compare anche fra le unità del processo", () => {
    const { corsie } = corsieFasi(scheda, attivitaInOrdine(scheda), "Senza unità");
    expect(corsie.filter((c) => c.id === id(11))).toHaveLength(1);
  });
});
