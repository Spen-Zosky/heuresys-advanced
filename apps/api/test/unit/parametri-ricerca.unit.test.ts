/**
 * #132 F0 — i sei parametri della ricerca, e la distinzione fra firmare e cercare.
 *
 * Ogni caso qui ha la sua CONTROPROVA: il caso che deve dare esito opposto. Una batteria
 * che verifica solo «con tutto pieno passa» resterebbe verde anche se la funzione
 * rispondesse sempre «nessun parametro manca» — cioe' se il contratto fosse decorativo.
 *
 * La proprieta' che conta di piu' non e' «i sei ci sono», e' che siano SEI e non quattro:
 * i requisiti della FIRMA (`IDENTITA_OBBLIGATORIA`, quattro campi) e quelli della
 * RICERCA sono insiemi diversi, e confonderli e' il difetto che questo test previene.
 */
import { describe, it, expect } from "vitest";
import {
  PARAMETRI_RICERCA,
  parametriRicercaMancanti,
  type BlueprintIdentity,
} from "@heuresys/shared";

/** Un'identita' completa e coerente: la fascia M copre 50-249, e 158 ci sta dentro. */
const COMPLETA: BlueprintIdentity = {
  industryClassId: "11111111-1111-1111-1111-111111111111",
  sizeBandId: "22222222-2222-2222-2222-222222222222",
  operatingModelId: "33333333-3333-3333-3333-333333333333",
  regulatoryIntensity: "HIGH",
  countryCode: "IT",
  employeeCount: 158,
  revenueEur: 1_000_000,
};

describe("#132 F0 — i sei parametri che una ricerca pretende", () => {
  it("sono SEI, e includono i due che la firma NON pretende", () => {
    expect(PARAMETRI_RICERCA).toHaveLength(6);
    const campi = PARAMETRI_RICERCA.map((p) => p.campo);
    // I quattro della firma
    expect(campi).toContain("industryClassId");
    expect(campi).toContain("sizeBandId");
    expect(campi).toContain("countryCode");
    expect(campi).toContain("regulatoryIntensity");
    // I DUE in piu', che sono la ragione per cui questo elenco esiste
    expect(campi).toContain("employeeCount");
    expect(campi).toContain("operatingModelId");
    // E i ricavi NON servono a cercare: descrivono l'azienda, non la indirizzano.
    expect(campi).not.toContain("revenueEur");
  });

  it("un'identita' completa non ha parametri mancanti", () => {
    expect(parametriRicercaMancanti(COMPLETA)).toEqual([]);
  });

  it("CONTROPROVA — ognuno dei sei, se manca, viene nominato", () => {
    for (const p of PARAMETRI_RICERCA) {
      const bucata = { ...COMPLETA, [p.campo]: null } as BlueprintIdentity;
      const mancanti = parametriRicercaMancanti(bucata);
      expect(
        mancanti.map((m) => m.campo),
        `togliendo ${p.campo} la funzione deve dirlo`,
      ).toEqual([p.campo]);
      // L'etichetta e' leggibile, non il nome del campo: chi compila legge quella.
      expect(mancanti[0]?.etichetta).toBe(p.etichetta);
    }
  });

  it("li nomina TUTTI in un colpo, non uno per volta", () => {
    const vuota = {} as BlueprintIdentity;
    expect(parametriRicercaMancanti(vuota)).toHaveLength(6);
  });

  it("un'identita' con i soli quattro campi della FIRMA non basta a cercare", () => {
    // E' il caso reale: un fascicolo firmabile oggi, che non e' cercabile. Se questo
    // caso passasse, i due insiemi sarebbero stati confusi.
    const firmabile = {
      ...COMPLETA,
      employeeCount: null,
      operatingModelId: null,
    } as BlueprintIdentity;
    const mancanti = parametriRicercaMancanti(firmabile).map((m) => m.campo);
    expect(mancanti.sort()).toEqual(["employeeCount", "operatingModelId"]);
  });

  it("zero addetti conta come MANCANTE, e non e' pignoleria", () => {
    // Lo schema ammette `0` (descrive cio' che il database accetta); una ricerca no —
    // un'azienda con zero addetti non e' cercabile ed e' fuori da ogni fascia, perche'
    // la piu' bassa parte da 1.
    const zero = { ...COMPLETA, employeeCount: 0 } as BlueprintIdentity;
    expect(parametriRicercaMancanti(zero).map((m) => m.campo)).toEqual(["employeeCount"]);
    // CONTROPROVA: uno basta.
    const uno = { ...COMPLETA, employeeCount: 1 } as BlueprintIdentity;
    expect(parametriRicercaMancanti(uno)).toEqual([]);
  });

  it("un'identita' assente non fa eccezione: dichiara sei mancanti", () => {
    expect(parametriRicercaMancanti(null)).toHaveLength(6);
    expect(parametriRicercaMancanti(undefined)).toHaveLength(6);
  });
});
