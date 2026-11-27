/**
 * E12 (F6b) — il controllo di equità sulle proposte che riguardano persone.
 * La prova costruisce apposta una proposta sbilanciata (le donne proposte molto meno degli
 * uomini) e la vede bocciata; una proposta equilibrata passa; i gruppi piccoli non rivelano
 * il tratto di nessuno; un tratto protetto fra gli ingressi rende la proposta non raccomandabile.
 */
import { describe, expect, it } from "vitest";
import { EquitaDichiarazioneSchema } from "@heuresys/shared";
import { fasciaEta, valutaEquita, type PersonaInProposta } from "../../src/lib/equita/valuta.js";

const OGGI = new Date("2026-11-26T12:00:00Z");

function persone(genere: string, quante: number, favorevoli: number, nascita = "1985-06-01"): PersonaInProposta[] {
  return Array.from({ length: quante }, (_, i) => ({
    userId: `${genere}-${nascita}-${i}`,
    favorevole: i < favorevoli,
    tratti: { genere, nascita, nazionalita: "IT", statoCivile: "MARRIED" },
  }));
}

const opz = { esitoFavorevole: "PRONTO_ENTRO_6_MESI", ingressi: ["position_fit", "kpi", "tenure"], oggi: OGGI };

describe("controllo di equità (E12)", () => {
  it("boccia una proposta sbilanciata per genere e non la presenta come raccomandazione", () => {
    const d = valutaEquita([...persone("MALE", 10, 8), ...persone("FEMALE", 10, 2)], opz);
    expect(EquitaDichiarazioneSchema.parse(d)).toBeTruthy();
    const genere = d.tratti.find((t) => t.tratto === "GENERE")!;
    expect(genere.esito).toBe("NON_SUPERATO");
    expect(genere.rapporto).toBe(0.25);
    expect(genere.gruppoMenoFavorito).toBe("FEMALE");
    expect(genere.gruppoPiuFavorito).toBe("MALE");
    expect(d.esito).toBe("NON_SUPERATO");
    expect(d.raccomandabile).toBe(false);
  });

  it("fa passare una proposta equilibrata e la dichiara", () => {
    const d = valutaEquita([...persone("MALE", 10, 5), ...persone("FEMALE", 10, 5)], opz);
    expect(d.tratti.find((t) => t.tratto === "GENERE")!.esito).toBe("SUPERATO");
    expect(d.esito).toBe("SUPERATO");
    expect(d.raccomandabile).toBe(true);
    expect(d.metodo).toBe("equita-quattro-quinti@1.0.0");
    expect(d.ingressiVicini).toEqual([{ ingresso: "tenure", tratto: "ETA" }]);
  });

  it("vede lo svantaggio per età, con le fasce e non le date", () => {
    const giovani = persone("MALE", 6, 5, "1998-01-01").concat(persone("FEMALE", 6, 5, "1998-01-01"));
    const anziani = persone("MALE", 6, 1, "1966-01-01").concat(persone("FEMALE", 6, 1, "1966-01-01"));
    const d = valutaEquita([...giovani, ...anziani], opz);
    const eta = d.tratti.find((t) => t.tratto === "ETA")!;
    expect(eta.esito).toBe("NON_SUPERATO");
    expect(eta.gruppoMenoFavorito).toBe("DA_50_IN_SU");
    expect(JSON.stringify(d)).not.toContain("1966");
    expect(d.raccomandabile).toBe(false);
  });

  it("riunisce i gruppi piccoli senza favorevoli né quota (null, non zero)", () => {
    const d = valutaEquita([...persone("MALE", 10, 5), ...persone("FEMALE", 10, 5), ...persone("OTHER", 1, 0)], opz);
    const genere = d.tratti.find((t) => t.tratto === "GENERE")!;
    expect(genere.gruppi.map((g) => g.gruppo)).not.toContain("OTHER");
    const piccoli = genere.gruppi.find((g) => g.gruppo === "GRUPPI_PICCOLI")!;
    expect(piccoli).toMatchObject({ persone: 1, favorevoli: null, quota: null, confrontato: false });
    expect(EquitaDichiarazioneSchema.parse(d)).toBeTruthy();
    expect(genere.esito).toBe("SUPERATO");
  });

  it("dichiara i dati insufficienti invece di inventare un rapporto", () => {
    const d = valutaEquita(persone("MALE", 3, 1).map((p) => ({ ...p, tratti: undefined })), opz);
    expect(d.esito).toBe("DATI_INSUFFICIENTI");
    expect(d.tratti.every((t) => t.rapporto === null)).toBe(true);
    expect(d.raccomandabile).toBe(true);
  });

  it("un tratto protetto fra gli ingressi rende la proposta non raccomandabile", () => {
    const d = valutaEquita([...persone("MALE", 10, 5), ...persone("FEMALE", 10, 5)], { ...opz, ingressi: ["kpi", "gender"] });
    expect(d.ingressiProtetti).toEqual(["gender"]);
    expect(d.raccomandabile).toBe(false);
    // «engagement» contiene «age» ma non è l'età.
    expect(valutaEquita([], { ...opz, ingressi: ["engagement", "average_kpi"] }).ingressiProtetti).toEqual([]);
  });

  it("calcola la fascia d'età al compleanno", () => {
    expect(fasciaEta("1996-11-27", OGGI)).toBe("MENO_DI_30");
    expect(fasciaEta("1996-11-26", OGGI)).toBe("DA_30_A_39");
    expect(fasciaEta(null, OGGI)).toBeNull();
  });
});
