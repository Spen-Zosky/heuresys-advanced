/**
 * apps/web/src/lib/attivita-processo.test.ts — classe K24 del controllo forense del 23/11/2026:
 * «attività dei processi senza ingresso, uscita, esecutore e ore».
 *
 * Decisione di Enzo del 24/11/2026: nella scheda Attività di /tenant-processes/<id> le colonne vuote
 * in tutte le righe escono, e una riga dice che i dati non sono ancora compilati; una colonna con
 * almeno un valore resta. Tre parti: la regola pura, il punto della pagina che la usa (letto dal
 * sorgente: l'ambiente di prova non monta React) e la frase nelle due lingue.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { TenantProcessActivity } from "@heuresys/shared";
import { colonneAttivitaVuote } from "./attivita-processo";

const SRC = path.resolve(__dirname, "..");
const leggi = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

const vuota: TenantProcessActivity = {
  activityId: "00000000-0000-4000-8000-000000000001",
  processId: "00000000-0000-4000-8000-000000000002",
  ordinal: 1,
  code: "A1",
  name: "Analizzare il merito creditizio",
  input: null,
  output: null,
  unitId: null,
  unitName: "Divisione Crediti",
  executorKind: null,
  executorName: null,
  executorPositionId: null,
  executorJobRoleId: null,
  workNature: null,
  deliveryModel: null,
  typicalHoursPerCycle: null,
  apqcCode: "5.4.4.1",
  apqcMatch: null,
};

describe("K24 — regola pura", () => {
  it("le sei colonne vuote in ogni riga escono; APQC con una voce resta", () => {
    const v = colonneAttivitaVuote([vuota, { ...vuota, ordinal: 2 }]);
    expect([...v].sort()).toEqual(["delivery", "executor", "hours", "input", "nature", "output"]);
  });

  it("APQC esce solo se nessuna riga ha una voce", () => {
    expect(colonneAttivitaVuote([{ ...vuota, apqcCode: null }]).has("apqc")).toBe(true);
    expect(colonneAttivitaVuote([{ ...vuota, apqcCode: null }, vuota]).has("apqc")).toBe(false);
  });

  it("una colonna con almeno un valore resta visibile", () => {
    const v = colonneAttivitaVuote([vuota, { ...vuota, input: "Domanda di fido", executorName: "Analista crediti", typicalHoursPerCycle: 0, workNature: "COGNITIVO", deliveryModel: " " }]);
    expect(v.has("input")).toBe(false);
    expect(v.has("executor")).toBe(false);
    // zero ore è un valore, non un vuoto
    expect(v.has("hours")).toBe(false);
    expect(v.has("nature")).toBe(false);
    // uno spazio non è un valore
    expect(v.has("delivery")).toBe(true);
    expect(v.has("output")).toBe(true);
  });

  it("chi esegue con la sola posizione è un valore", () => {
    expect(colonneAttivitaVuote([{ ...vuota, executorPositionId: "00000000-0000-4000-8000-000000000003" }]).has("executor")).toBe(false);
  });

  it("senza attività non si toglie niente (la tabella dice già che non ce ne sono)", () => {
    expect(colonneAttivitaVuote([]).size).toBe(0);
  });
});

describe("K24 — la pagina usa la regola e dice perché mancano le colonne", () => {
  it("la scheda Attività filtra le colonne con colonneAttivitaVuote e mostra la riga dei dati non compilati", () => {
    const s = leggi("app/(authenticated)/tenant-processes/[id]/page.tsx");
    expect(s).toContain("colonneAttivitaVuote(att)");
    expect(s).toContain('data-testid="tenant-process-attivita-non-compilate"');
    expect(s).toContain('t("processiDelTenant.scheda.attivitaNonCompilate")');
  });

  it("la frase c'è in italiano e in inglese", () => {
    const it_ = JSON.parse(leggi("locales/it/blueprints.json"));
    const en = JSON.parse(leggi("locales/en/blueprints.json"));
    expect(it_.processiDelTenant.scheda.attivitaNonCompilate).toBe("Dati dell'attività non ancora compilati");
    expect(en.processiDelTenant.scheda.attivitaNonCompilate).toBe("Activity data not yet filled in");
  });
});
