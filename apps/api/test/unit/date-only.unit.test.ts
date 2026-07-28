/**
 * test/unit/date-only.unit.test.ts
 *
 * Le colonne `date` (RD-09) tornano dal driver `pg` come `Date` a mezzanotte
 * LOCALE. Serializzarle con `toISOString()` le riporta a UTC e, a est di
 * Greenwich, le sposta al giorno prima: il DB dice 2026-07-01 e l'API risponde
 * 2026-06-30.
 *
 * Il difetto era sopravvissuto in 17 punti di 7 moduli perche' la CI e la VM di
 * produzione girano a UTC, dove le due letture COINCIDONO: un test scritto senza
 * forzare il fuso sarebbe passato con il difetto in piedi. Per questo qui il
 * fuso e' imposto, e la prima asserzione di ogni caso e' che la lettura sbagliata
 * e quella giusta DIVERGANO — se un giorno non divergessero piu', il test
 * fallirebbe segnalando che non sta piu' provando nulla.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { toDateOnly, todayDateOnly } from "../../src/lib/date-only.js";

const TZ_ORIGINALE = process.env.TZ;

/** Come il codice serializzava PRIMA della correzione. Serve al caso negativo. */
const letturaSbagliata = (d: Date): string => d.toISOString().slice(0, 10);

describe("date-only: una data senza orario e' un fatto del calendario, non un istante", () => {
  beforeAll(() => {
    // Roma e' UTC+2 in estate e UTC+1 in inverno: entrambi i casi sono coperti sotto.
    process.env.TZ = "Europe/Rome";
  });
  afterAll(() => {
    if (TZ_ORIGINALE === undefined) delete process.env.TZ;
    else process.env.TZ = TZ_ORIGINALE;
  });

  it("in ora legale (UTC+2) la lettura in UTC perde un giorno, quella di calendario no", () => {
    // il 1 luglio 2026 a mezzanotte: e' cosi' che `pg` consegna una colonna `date`
    const primoLuglio = new Date(2026, 6, 1, 0, 0, 0);

    // il caso negativo: se queste due coincidessero, il test non proverebbe nulla
    expect(letturaSbagliata(primoLuglio)).toBe("2026-06-30");
    expect(toDateOnly(primoLuglio)).toBe("2026-07-01");
    expect(toDateOnly(primoLuglio)).not.toBe(letturaSbagliata(primoLuglio));
  });

  it("in ora solare (UTC+1) il difetto si presenta uguale", () => {
    const primoGennaio = new Date(2026, 0, 1, 0, 0, 0);

    expect(letturaSbagliata(primoGennaio)).toBe("2025-12-31");
    expect(toDateOnly(primoGennaio)).toBe("2026-01-01");
  });

  it("un anno intero di date non ne perde nemmeno una", () => {
    const attese: string[] = [];
    const ottenute: string[] = [];
    for (let mese = 0; mese < 12; mese += 1) {
      for (const giorno of [1, 15, 28]) {
        const d = new Date(2026, mese, giorno, 0, 0, 0);
        attese.push(`2026-${String(mese + 1).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`);
        ottenute.push(toDateOnly(d)!);
      }
    }
    expect(ottenute).toEqual(attese);
    // e la lettura sbagliata ne avrebbe sbagliate 36 su 36
    const sbagliate = attese.filter(
      (atteso, i) => letturaSbagliata(new Date(2026, Math.floor(i / 3), [1, 15, 28][i % 3]!, 0, 0, 0)) !== atteso,
    );
    expect(sbagliate).toHaveLength(36);
  });

  it("passa attraverso null, undefined e stringhe gia' in forma di data", () => {
    expect(toDateOnly(null)).toBeNull();
    expect(toDateOnly(undefined)).toBeNull();
    // alcuni repository ricevono gia' una stringa dal driver: non va reinterpretata
    expect(toDateOnly("2026-07-01")).toBe("2026-07-01");
    expect(toDateOnly("2026-07-01T00:00:00.000Z")).toBe("2026-07-01");
  });

  it("«oggi» e' oggi qui, non a Greenwich", () => {
    const adesso = new Date();
    expect(todayDateOnly()).toBe(
      `${adesso.getFullYear()}-${String(adesso.getMonth() + 1).padStart(2, "0")}-${String(adesso.getDate()).padStart(2, "0")}`,
    );
  });
});
