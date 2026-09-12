/**
 * #205 F2 (S1097) — la fase «indirizzi» sa cercare: i candidati vengono dalle mappe dei siti.
 *
 * Ogni caso ha un verso opposto: una mappa che punta fuori dal suo host NON allarga il
 * perimetro; un indice che porta cento sotto-mappe ne apre poche; una fonte senza mappa si
 * registra come «assente» e non ferma le altre; l'ordine per attinenza mette prima cio' che
 * risponde alle domande e in coda cio' che non c'entra.
 */
import { describe, it, expect } from "vitest";
import {
  indirizziDaMappa, eIndiceDiMappe, paroleChiave, ordinaPerAttinenza, candidatiDalleMappe,
} from "../../src/modules/research/sorgenti/mappa-del-sito.js";

// Il lettore spoglia i tag: una mappa arriva come testo con gli indirizzi in fila.
const MAPPA_TESTO = [
  "https://www.assoconsult.org/ https://www.assoconsult.org/chi-siamo/",
  "https://www.assoconsult.org/osservatorio/organizzazione-societa-consulenza/",
  "https://www.assoconsult.org/news/2026/evento.html https://cdn.altrosito.it/x.pdf",
  "http://www.assoconsult.org/vecchio-http/",
].join("\n");

const INDICE_TESTO = [
  "https://www.istat.it/sitemap-imprese.xml https://www.istat.it/sitemap-lavoro.xml",
  "https://www.istat.it/sitemap-news.xml",
].join(" ");

describe("indirizziDaMappa", () => {
  it("estrae solo https, senza doppioni, e taglia la punteggiatura di coda", () => {
    const out = indirizziDaMappa(MAPPA_TESTO + " https://www.assoconsult.org/chi-siamo/.");
    expect(out).toContain("https://www.assoconsult.org/chi-siamo/");
    expect(out.filter((u) => u === "https://www.assoconsult.org/chi-siamo/")).toHaveLength(1);
    expect(out.some((u) => u.startsWith("http://"))).toBe(false);
  });
});

describe("eIndiceDiMappe", () => {
  it("un elenco di sole sotto-mappe e' un indice; una mappa di pagine no; vuoto no", () => {
    expect(eIndiceDiMappe(indirizziDaMappa(INDICE_TESTO))).toBe(true);
    expect(eIndiceDiMappe(indirizziDaMappa(MAPPA_TESTO))).toBe(false);
    expect(eIndiceDiMappe([])).toBe(false);
  });
});

describe("attinenza", () => {
  const domande = ["Come è organizzata una società di consulenza direzionale?", "Quali ruoli e funzioni esistono?"];
  it("le parole chiave tolgono articoli e parole di ogni domanda, e gli accenti", () => {
    const k = paroleChiave(domande);
    expect(k).toContain("organizzata");
    expect(k).toContain("consulenza");
    expect(k).not.toContain("come");
    expect(k).not.toContain("societa");
  });
  it("⭐ chi risponde alle domande va prima, chi non c'entra va in coda", () => {
    const out = ordinaPerAttinenza(indirizziDaMappa(MAPPA_TESTO), domande);
    expect(out[0]).toBe("https://www.assoconsult.org/osservatorio/organizzazione-societa-consulenza/");
    expect(out[out.length - 1]).toMatch(/news|altrosito/);
  });
});

describe("candidatiDalleMappe", () => {
  const domande = ["Come è organizzata una società di consulenza?"];
  const lettore = (mappe: Record<string, string>, viste: string[] = []) =>
    async (url: string) => {
      viste.push(url);
      const t = mappe[url];
      if (t === undefined) throw new Error(`404 ${url}`);
      return { testoNonFidato: t };
    };

  it("legge la mappa di ogni fonte ammessa e tiene SOLO gli indirizzi del suo host", async () => {
    const viste: string[] = [];
    const out = await candidatiDalleMappe(["assoconsult.org"], domande,
      lettore({ "https://assoconsult.org/sitemap.xml": MAPPA_TESTO }, viste));
    expect(out.fonti).toEqual([{ host: "assoconsult.org", mappe: 1, indirizzi: 4, esito: "letta" }]);
    expect(out.candidati.some((u) => u.includes("altrosito"))).toBe(false);
    expect(out.candidati[0]).toContain("organizzazione-societa-consulenza");
    expect(viste).toEqual(["https://assoconsult.org/sitemap.xml"]); // la prima che si apre basta
  });

  it("senza mappa la fonte e' «assente», non ferma le altre, e la corsa NON ha candidati da lei", async () => {
    const out = await candidatiDalleMappe(["senzamappa.example", "assoconsult.org"], domande,
      lettore({ "https://www.assoconsult.org/sitemap.xml": MAPPA_TESTO }));
    expect(out.fonti.map((f) => f.esito)).toEqual(["assente", "letta"]);
    expect(out.candidati.length).toBe(4);
  });

  it("un indice apre poche sotto-mappe (le piu' attinenti), e mai oltre il tetto delle mappe", async () => {
    const viste: string[] = [];
    const mappe: Record<string, string> = {
      "https://istat.it/sitemap.xml": INDICE_TESTO,
      "https://www.istat.it/sitemap-imprese.xml": "https://www.istat.it/imprese/organizzazione-consulenza/",
      "https://www.istat.it/sitemap-lavoro.xml": "https://www.istat.it/lavoro/occupati/",
      "https://www.istat.it/sitemap-news.xml": "https://www.istat.it/news/1/",
    };
    const out = await candidatiDalleMappe(["istat.it"], ["Come sono organizzate le imprese di consulenza?"],
      lettore(mappe, viste), { sottoMappeMassime: 1 });
    expect(out.fonti[0]!.mappe).toBe(2); // indice + 1 sotto-mappa
    expect(viste).toContain("https://www.istat.it/sitemap-imprese.xml"); // la piu' attinente («imprese»)
    expect(viste).not.toContain("https://www.istat.it/sitemap-news.xml"); // le altre restano chiuse
    expect(viste).not.toContain("https://www.istat.it/sitemap-lavoro.xml");
    expect(out.candidati[0]).toContain("organizzazione-consulenza");

    const poche = await candidatiDalleMappe(["istat.it"], domande, lettore(mappe), { mappeMassime: 1 });
    expect(poche.fonti[0]!.mappe).toBe(1); // solo l'indice: il tetto ferma le sotto-mappe
    expect(poche.candidati).toEqual([]);
  });

  it("il tetto dei candidati taglia, e taglia in coda (dopo l'ordine per attinenza)", async () => {
    const molti = Array.from({ length: 50 }, (_, i) => `https://a.example/p${i}/`).join(" ")
      + " https://a.example/consulenza-organizzata/";
    const out = await candidatiDalleMappe(["a.example"], domande,
      lettore({ "https://a.example/sitemap.xml": molti }), { tettoCandidati: 10 });
    expect(out.candidati).toHaveLength(10);
    expect(out.candidati[0]).toBe("https://a.example/consulenza-organizzata/");
  });
});
