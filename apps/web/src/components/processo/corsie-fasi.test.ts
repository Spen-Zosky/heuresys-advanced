import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TenantProcessScheda } from "@heuresys/shared";
import { attivitaInOrdine, corsieFasi, dueRighe, etichettaAttivita, nomeAccessibile, propsApribili, unaRiga } from "./corsie-fasi";

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

/** K10 del controllo forense del 23/11/2026: gli oggetti dei disegni che si aprono avevano role="button" e nessun nome. */
describe("oggetti apribili dei disegni", () => {
  it("portano il nome che si legge, insieme al ruolo di pulsante", () => {
    const p = propsApribili("Filiale", () => {});
    expect(p.role).toBe("button");
    expect(p["aria-label"]).toBe("Filiale");
    expect(p.tabIndex).toBe(0);
  });
  it("il nome di un'attività dice numero, nome ed esecutore", () => {
    expect(etichettaAttivita({ ordinal: 3, name: "Apertura conto", executorName: "Operatore di sportello" })).toBe("3. Apertura conto — Operatore di sportello");
    expect(etichettaAttivita({ ordinal: 1, name: "Verifica", executorName: null })).toBe("1. Verifica");
  });
  it("Invio e spazio aprono, gli altri tasti no", () => {
    let aperto = 0;
    const p = propsApribili("x", () => { aperto++; });
    const tasto = (key: string) => p.onKeyDown({ key, preventDefault: () => {} });
    tasto("Enter"); tasto(" "); tasto("a");
    expect(aperto).toBe(2);
  });
  it("ogni uso nei disegni passa un nome", () => {
    const sorgente = readFileSync(join(__dirname, "diagrammi.tsx"), "utf8");
    const usi = [...sorgente.matchAll(/\baprendo\(/g)].length; // la definizione è «aprendo = (», non conta
    expect(usi).toBeGreaterThanOrEqual(5);
    expect(sorgente).not.toMatch(/aprendo\(\(\)\s*=>/);
  });
});

/** N1 e N4 del giro di verifica del 25/11/2026: testo dei riquadri e nome accessibile. */
describe("testo dei riquadri", () => {
  it("dueRighe non taglia a metà parola: la seconda riga si ferma a una parola intera e finisce con «…»", () => {
    const r = dueRighe("Adeguata verifica della clientela per i soggetti ad alto rischio", 20);
    expect(r).toHaveLength(2);
    expect(r[0]).toBe("Adeguata verifica");
    expect(r[1]!.endsWith("…")).toBe(true);
    expect(r[1]!.length).toBeLessThanOrEqual(20);
    expect("della clientela per i soggetti".startsWith(r[1]!.slice(0, -1))).toBe(true);
  });
  it("dueRighe lascia com'è un testo che sta", () => {
    expect(dueRighe("Apertura conto", 22)).toEqual(["Apertura conto"]);
    expect(dueRighe("Apertura del conto corrente", 14)).toEqual(["Apertura del", "conto corrente"]);
  });
  it("unaRiga mette «…» quando tronca il titolo della fascia, invece di tenere solo la prima riga", () => {
    expect(unaRiga("Erogazione del credito", 30)).toBe("Erogazione del credito");
    expect(unaRiga("Erogazione del credito ai privati", 18)).toBe("Erogazione del…");
    expect(unaRiga("Erogazione del credito ai privati", 18).length).toBeLessThanOrEqual(18);
  });
});

describe("nome accessibile degli oggetti dei disegni (label-content-name-mismatch)", () => {
  it("se il nome completo contiene già il testo visibile, resta il nome completo", () => {
    expect(nomeAccessibile(["3", "Apertura conto"], "3. Apertura conto — Operatore di sportello")).toBe("3. Apertura conto — Operatore di sportello");
    expect(nomeAccessibile(["Adeguata verifica", "della clientela…"], "Adeguata verifica della clientela per i soggetti a rischio"))
      .toBe("Adeguata verifica della clientela per i soggetti a rischio");
  });
  it("altrimenti comincia con il testo visibile e prosegue con il dettaglio", () => {
    expect(nomeAccessibile(["Responsabile", "Filiale"], "Filiale")).toBe("Responsabile Filiale — Filiale");
  });
  it("il ruolo della corsia prima del nome: il nome composto contiene il testo visibile", () => {
    expect(nomeAccessibile(["Contributor", "Back office"], "Contributor: Back office")).toBe("Contributor: Back office");
  });
});

describe("i disegni del processo nel sorgente (N1, N3)", () => {
  const sorgente = readFileSync(join(__dirname, "diagrammi.tsx"), "utf8");
  it("nessun testo sotto i 12 px, e si aprono alla scala di apertura dei processi", () => {
    const corpi = [...sorgente.matchAll(/fontSize=\{(\d+)\}/g)].map((m) => Number(m[1]));
    expect(corpi.length).toBeGreaterThan(5);
    expect(Math.min(...corpi)).toBeGreaterThanOrEqual(12);
    expect(sorgente).not.toMatch(/SCALA_MIN_LEGGIBILE/);
  });
  it("il ruolo della corsia non si scrive in maiuscolo", () => {
    expect(sorgente).not.toMatch(/toUpperCase\(\)/);
  });
});
