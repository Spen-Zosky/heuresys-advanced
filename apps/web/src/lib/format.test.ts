/**
 * apps/web/src/lib/format.test.ts — F-1 e F-8 del piano interfacce (2026-11-04).
 */
import { describe, it, expect } from "vitest";
import { formati, localeDi, VUOTO } from "./format";

const it_ = formati("it");
const en = formati("en");

describe("F-1 — un solo modo di mettere in forma", () => {
  it("la lingua del portale sceglie le impostazioni regionali", () => {
    expect(localeDi("it")).toBe("it-IT");
    expect(localeDi("en")).toBe("en-GB");
    expect(localeDi(undefined)).toBe("it-IT");
  });

  it("una data senza ora non si sposta di fuso e ha il giorno prima del mese", () => {
    expect(it_.data("2026-01-01")).toBe("01/01/2026");
    expect(en.data("2026-12-31")).toBe("31/12/2026");
  });

  it("valori assenti o illeggibili diventano il trattino, mai NaN o Invalid Date", () => {
    for (const v of [null, undefined, "", "non-una-data"]) {
      expect(it_.data(v)).toBe(VUOTO);
      expect(it_.dataOra(v)).toBe(VUOTO);
    }
    expect(it_.numero(null)).toBe(VUOTO);
    expect(it_.numero("abc")).toBe(VUOTO);
    expect(it_.importo(undefined, "EUR")).toBe(VUOTO);
    expect(it_.percento(null, "0-1")).toBe(VUOTO);
    expect(it_.durata(null)).toBe(VUOTO);
  });

  it("i numeri hanno il separatore delle migliaia e la virgola della lingua", () => {
    expect(it_.numero(1234567)).toBe("1.234.567");
    expect(it_.numero(1234.56, 1)).toBe("1.234,6");
    expect(en.numero(1234.56, 1)).toBe("1,234.6");
    expect(it_.numero("741")).toBe("741");
    expect(it_.numeroFisso(3, 1)).toBe("3,0");
    expect(en.numeroFisso(0.5, 2)).toBe("0.50");
  });

  it("l'importo usa la valuta del dato, e senza valuta non inventa l'euro", () => {
    expect(it_.importo(368734.11, "EUR")).toMatch(/^368\.734,11\s€$/);
    expect(it_.importo(1000, "USD")).toMatch(/1\.000,00\sUSD|1\.000,00\s\$|USD\s1\.000,00/);
    expect(it_.importo(1000, null)).toBe("1.000");
    expect(it_.importo(1000, "XYZ1")).toBe("1.000 XYZ1");
  });

  it("F-8: la percentuale ha una sola forma, qualunque sia la scala del dato", () => {
    expect(it_.percento(42, "0-100")).toBe(it_.percento(0.42, "0-1"));
    expect(it_.percento(42, "0-100")).toMatch(/^42\s?%$/);
    expect(en.percento(0.425, "0-1", 1)).toBe("42.5%");
  });

  it("le durate si leggono", () => {
    expect(it_.durata(350)).toBe("350 ms");
    expect(it_.durata(4200)).toBe("4,2 s");
    expect(it_.durata(65_000)).toBe("1 min 5 s");
    expect(it_.durata(3_900_000)).toBe("1 h 5 min");
    expect(it_.durata(3 * 86_400_000)).toBe("3 giorni 0 h");
  });

  it("le dimensioni dei file", () => {
    expect(it_.dimensione(512)).toBe("512 B");
    expect(it_.dimensione(34 * 1024)).toBe("34 KB");
    expect(it_.dimensione(1.25 * 1024 * 1024)).toBe("1,3 MB");
  });

  it("il tempo relativo è nella lingua del portale", () => {
    const adesso = Date.UTC(2026, 10, 4, 12, 0, 0);
    expect(it_.relativo(new Date(adesso - 3 * 86_400_000), adesso)).toBe("3 giorni fa");
    expect(en.relativo(new Date(adesso - 2 * 3_600_000), adesso)).toBe("2 hours ago");
  });
});
