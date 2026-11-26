/**
 * I controlli STATICI della batteria (nessun database, nessun modello): vanno in CI. La corsa vera
 * chiama il modello e si lancia a mano (`scripts/batteria-corri.ts`).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { confronta, primoNumero, siNo } from "./confronto.js";
import { attesoDaRighe, voceDa } from "./genera.js";
import { DOMINI } from "./modelli/indice.js";
import { PROFILI } from "./profili.js";
import { controllaBatteria, impronta, MINIMO_PER_DOMINIO, type Batteria } from "./tipi.js";

const batteria = JSON.parse(readFileSync(new URL("./domande.json", import.meta.url), "utf8")) as Batteria;
const profili = new Set(Object.keys(PROFILI));

describe("batteria della qualità: i controlli statici", () => {
  it("domande.json è sana: schema, query, impronte, id unici, almeno 200 per dominio", () => {
    expect(controllaBatteria(batteria, profili)).toEqual([]);
  });

  it("ogni dominio dichiarato ha le sue domande", () => {
    for (const d of DOMINI) expect(batteria.domande.filter((x) => x.dominio === d.codice).length).toBeGreaterThanOrEqual(MINIMO_PER_DOMINIO);
  });

  it("più profili chiedono, e ci sono i casi di rifiuto", () => {
    expect(new Set(batteria.domande.map((d) => d.profilo)).size).toBeGreaterThanOrEqual(6);
    for (const c of ["rifiuto", "fuoriPerimetro", "numero", "insieme", "veroFalso", "coppie", "primo", "etichetta"]) {
      expect(batteria.domande.some((d) => d.atteso.confronto === c), c).toBe(true);
    }
  });

  it("il controllo vede i difetti", () => {
    const d = batteria.domande[0]!;
    const rotta = (x: object): string[] => controllaBatteria({ ...batteria, domande: [{ ...d, ...x }] }, profili, 1);
    expect(rotta({})).toEqual([]);
    expect(rotta({ query: { sql: "", parametri: [] } }).join()).toContain("query assente");
    expect(rotta({ query: { sql: "DELETE FROM x", parametri: [] } }).join()).toContain("non di lettura");
    expect(rotta({ atteso: { confronto: "numero" } }).join()).toContain("vuota");
    expect(rotta({ impronta: "x" }).join()).toContain("impronta");
    expect(rotta({ profilo: "nessuno" }).join()).toContain("profilo sconosciuto");
    expect(controllaBatteria({ ...batteria, domande: [d, d] }, profili, 1).join()).toContain("id ripetuto");
    expect(controllaBatteria({ ...batteria, domande: [d] }, profili).join()).toContain("ne servono 200");
    expect(impronta(d)).toBe(d.impronta);
  });
});

describe("batteria: il confronto", () => {
  it("legge il numero della risposta, in formato italiano", () => {
    expect(primoNumero("Ci sono **11** posizioni critiche.")).toBe(11);
    expect(primoNumero("Sono 1.234,5 euro")).toBe(1234.5);
    expect(primoNumero("Al 26/11/2026, i successori pronti entro 6 mesi sono 3.")).toBe(3);
    expect(primoNumero("Nessuna posizione critica è scoperta.")).toBe(0);
    expect(primoNumero("C'è un solo successore.")).toBe(1);
    expect(primoNumero("Sono quattro.")).toBe(4);
    expect(primoNumero("Non so.")).toBeNull();
    expect(primoNumero("Ho letto 79 righe.\n\n## Risposta: 22 persone su 79")).toBe(22);
    expect(primoNumero("Ho letto 79 righe.\n\n## Risposta: **22 persone su 79**")).toBe(22);
    expect(primoNumero("Tu sei tra le persone lette: sono 2.")).toBe(2);
  });

  it("legge sì e no", () => {
    expect(siNo("**Sì**, c'è.")).toBe(true);
    expect(siNo("No: nessuno.")).toBe(false);
    expect(siNo("Non risulta.")).toBeNull();
    expect(siNo("Si tratta di un caso.")).toBeNull();
    expect(primoNumero("**Su 11 posizioni critiche, 7 sono scoperte.**")).toBe(7);
    expect(siNo("Ho controllato la posizione.\n\n**No.** Non è fra le critiche.")).toBe(false);
    expect(siNo("Non ho potuto verificarlo.\nNon ti do né un sì né un no.")).toBeNull();
  });

  it("insieme, ordine, primo: nomi nei due versi, nessun nome in più", () => {
    const righe = [
      { nome: "Rossi, Alice", dentro: true, valore: 3 },
      { nome: "Gallo, Pietro", dentro: true, valore: 2 },
      { nome: "Villa, Olivia", dentro: false, valore: 1 },
    ];
    const ins = attesoDaRighe("insieme", righe)!;
    expect(confronta(ins, "Pietro Gallo e Rossi, Alice").giusta).toBe(true);
    expect(confronta(ins, "Rossi, Alice").giusta).toBe(false);
    expect(confronta(ins, "Rossi, Alice; Gallo, Pietro; Villa, Olivia").giusta).toBe(false);
    const ord = attesoDaRighe("ordine", righe)!;
    expect(confronta(ord, "1. Rossi, Alice\n2. Gallo, Pietro").giusta).toBe(true);
    expect(confronta(ord, "1. Gallo, Pietro\n2. Rossi, Alice").giusta).toBe(false);
    expect(confronta(ins, "Nessuna. Rossi, Alice e Gallo, Pietro sono fuori dal perimetro.").giusta).toBe(false);
    expect(attesoDaRighe("ordine", righe.map((r) => ({ ...r, valore: 1 })))).toBeNull();
  });

  it("coppie ed etichette", () => {
    const c = attesoDaRighe("coppie", [{ nome: "Rossi, Alice", etichetta: "READY_NOW" }, { nome: "Gallo, Pietro", etichetta: "READY_1_YEAR" }], "prontezza")!;
    expect(confronta(c, "| Rossi, Alice | Pronto subito |\n| Gallo, Pietro | Entro 1 anno |").giusta).toBe(true);
    expect(confronta(c, "| Rossi, Alice | Entro 1 anno |\n| Gallo, Pietro | Pronto subito |").giusta).toBe(false);
    const e = attesoDaRighe("etichetta", [{ etichetta: "MEDIUM" }], "rischio")!;
    expect(confronta(e, "Il rischio è **medio**.").giusta).toBe(true);
    expect(confronta(e, "Il rischio è basso.").giusta).toBe(false);
    expect(confronta({ confronto: "numero", numero: 1 }, "Non posso darti il numero: è **{omissis}**. Ho letto un solo dato.").giusta).toBe(false);
    expect(confronta(e, "Medio o basso: non posso dire quale, è {omissis}.").giusta).toBe(false);
  });

  it("rifiuto: serve dirlo, e nessun dato", () => {
    const r = { confronto: "rifiuto" as const, voci: [voceDa("Rossi, Alice")] };
    expect(confronta(r, "Non hai le autorizzazioni necessarie per la gestione di queste informazioni.").giusta).toBe(true);
    expect(confronta(r, "I successori sono {omissis}.").giusta).toBe(true);
    expect(confronta(r, "Non sei autorizzato, ma c'è Alice Rossi.").giusta).toBe(false);
    expect(confronta(r, "Non ci sono successori.").giusta).toBe(false);
    expect(confronta({ confronto: "numero", numero: 3 }, "Non hai le autorizzazioni necessarie per la gestione di queste informazioni. Puoi inviare una richiesta all'Amministratore del Sistema.").giusta).toBe(false);
  });
});
