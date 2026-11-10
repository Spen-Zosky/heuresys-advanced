import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { applicaVista, eseguiComando, testoDi, trovaColonna, vistaAttiva, type StatoVistaTabella } from "./vista-tabella";

type Riga = { nome: string; sede: string; persone: string };
const RIGHE: Riga[] = [
  { nome: "Risorse umane", sede: "Milano", persone: "1.250" },
  { nome: "Crediti", sede: "Roma", persone: "80" },
  { nome: "Audit", sede: "Milano", persone: "" },
  { nome: "Àrea estero", sede: "Torino", persone: "300" },
];
const celle = (r: Riga) => [r.nome, r.sede, r.persone];
const COLONNE = ["Nome", "Sede", "Persone", ""];
const CTX = { colonne: COLONNE, paginaServer: false, totale: RIGHE.length };

describe("testoDi: ciò che la persona vede in una cella", () => {
  it("testo, numeri, elementi annidati, attributi", () => {
    expect(testoDi("ciao")).toBe("ciao");
    expect(testoDi(42)).toBe("42");
    expect(testoDi(createElement("span", null, "Rossi, ", createElement("b", null, "Mario")))).toBe("Rossi,  Mario");
    expect(testoDi(createElement("span", { "aria-label": "Attivo" }))).toBe("Attivo");
    expect(testoDi(null)).toBe("");
  });
});

describe("trovaColonna", () => {
  it("uguale prima, poi contenuta, senza accenti e maiuscole", () => {
    expect(trovaColonna(COLONNE, "sede")).toBe(1);
    expect(trovaColonna(COLONNE, "numero di persone")).toBe(2);
    expect(trovaColonna(COLONNE, "stipendio")).toBeUndefined();
    expect(trovaColonna(COLONNE, "")).toBeUndefined();
  });
});

describe("applicaVista", () => {
  it("cerca in ogni colonna, senza accenti", () => {
    expect(applicaVista(RIGHE, celle, { testo: "area" }).map((r) => r.nome)).toEqual(["Àrea estero"]);
  });
  it("filtra su una colonna", () => {
    expect(applicaVista(RIGHE, celle, { filtro: { colonna: 1, valore: "milano" } }).map((r) => r.nome)).toEqual(["Risorse umane", "Audit"]);
  });
  it("ordina i numeri come numeri (migliaia all'italiana) e lascia in fondo ciò che manca", () => {
    const giu = applicaVista(RIGHE, celle, { ordine: { colonna: 2, verso: "decrescente" } }).map((r) => r.nome);
    expect(giu).toEqual(["Risorse umane", "Àrea estero", "Crediti", "Audit"]);
    const su = applicaVista(RIGHE, celle, { ordine: { colonna: 2, verso: "crescente" } }).map((r) => r.nome);
    expect(su).toEqual(["Crediti", "Àrea estero", "Risorse umane", "Audit"]);
  });
  it("non cambia le righe ricevute", () => {
    const copia = [...RIGHE];
    applicaVista(RIGHE, celle, { ordine: { colonna: 0, verso: "decrescente" } });
    expect(RIGHE).toEqual(copia);
  });
});

describe("eseguiComando: l'esito è quello vero", () => {
  const vuoto: StatoVistaTabella = {};
  it("cerca e ordina danno ok su un elenco intero", () => {
    expect(eseguiComando(vuoto, "tabella.cerca", { testo: "Roma" }, CTX).esito.stato).toBe("ok");
    const o = eseguiComando(vuoto, "tabella.ordina", { colonna: "Persone", verso: "decrescente" }, CTX);
    expect(o.stato.ordine).toEqual({ colonna: 2, verso: "decrescente" });
  });
  it("con la paginazione del server l'esito è parziale e dice il totale", () => {
    const e = eseguiComando(vuoto, "tabella.cerca", { testo: "Roma" }, { ...CTX, paginaServer: true, totale: 158 }).esito;
    expect(e.stato).toBe("parziale");
    expect(e.dettaglio).toContain("158");
  });
  it("una colonna che non c'è è rifiutata, con l'elenco delle colonne", () => {
    const r = eseguiComando(vuoto, "tabella.filtra", { colonna: "Stipendio", valore: "x" }, CTX);
    expect(r.esito.stato).toBe("rifiutata");
    expect(r.esito.dettaglio).toContain("Nome, Sede, Persone");
    expect(r.stato).toBe(vuoto);
  });
  it("un comando sconosciuto è rifiutato", () => {
    expect(eseguiComando(vuoto, "tabella.cancella", {}, CTX).esito.stato).toBe("rifiutata");
  });
  it("azzera torna alla tabella com'era", () => {
    const s = eseguiComando({ testo: "x", ordine: { colonna: 0, verso: "crescente" } }, "tabella.azzera", {}, CTX).stato;
    expect(vistaAttiva(s)).toBe(false);
  });
});
