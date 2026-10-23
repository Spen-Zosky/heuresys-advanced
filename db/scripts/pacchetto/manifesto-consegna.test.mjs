// Prova del manifesto di consegna dal lato di advanced (consolidamento C1). Senza database.
//   node --test db/scripts/pacchetto/manifesto-consegna.test.mjs
// Il caso d'impronta è condiviso con il datastore (tests/dati/consegna/caso_impronta.json): se una delle due parti cambia la forma
// canonica, diventa rosso da quella parte. Il pacchetto di prova è il «pieno» delle prove del datastore (tests/_aiuto_v03.ts), con
// convertitoIl in forma canonica: è un pacchetto di prova, non il caso banca.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALGORITMO, copieAllineate, improntaJson, jsonCanonico, verificaConsegna, verificaManifesto } from "./manifesto-consegna.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const leggi = (n) => JSON.parse(fs.readFileSync(path.join(AQUI, "contratto", "consegna", n), "utf8"));
const CASO = leggi("caso_impronta.json");
const P = () => leggi("pacchetto_di_prova_v03.json");
const manifesto = (p) => ({
  schema: "heuresys.fascicolo.consegna/1", prototipo: p.meta.prototipoId, versione: 1, contratto: p.meta.schema,
  impronta: { algoritmo: ALGORITMO, valore: improntaJson(p) }, fascicoloVersione: p.perimetro?.fascicoloVersione ?? null,
  edizioni: [{ schema: "ESCO_OCC", edizione: "1.2.1" }], correlazione: "0b5a3c1e-7d2f-4a8b-9c3d-2e1f0a9b8c7d",
  consegnatoIl: "2026-10-23T03:00:00.000Z", consegnatoDa: "Amministratore di Sistema", file: "pacchetto.json",
});
const cartelle = [];
after(() => cartelle.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
const inCartella = (m, p) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "consegna-"));
  cartelle.push(d);
  fs.writeFileSync(path.join(d, "manifesto.json"), JSON.stringify(m));
  fs.writeFileSync(path.join(d, "pacchetto.json"), JSON.stringify(p));
  return d;
};

test("il caso d'impronta condiviso dà la stessa forma canonica e la stessa impronta del datastore", () => {
  assert.equal(CASO.algoritmo, ALGORITMO);
  assert.equal(jsonCanonico(CASO.oggetto), CASO.canonico);
  assert.equal(improntaJson(CASO.oggetto), CASO.impronta);
});

test("le copie dello schema e del caso hanno l'impronta dichiarata", () => {
  assert.deepEqual(copieAllineate(), []);
});

test("VERDE: una consegna intatta si verifica e il pacchetto passa la convalida", () => {
  const p = P();
  const r = verificaConsegna(inCartella(manifesto(p), p));
  assert.deepEqual(r.errori, []);
  assert.equal(r.ok, true);
});

test("ROSSO: un pacchetto cambiato dopo la consegna ha un'impronta diversa", () => {
  const p = P();
  const m = manifesto(p);
  p.contesto.descrizione.it = "altro";
  const r = verificaConsegna(inCartella(m, p));
  assert.equal(r.ok, false);
  assert.match(r.errori.join(" "), /impronta diversa/);
});

test("ROSSO: un manifesto fuori forma o di un altro prototipo è rifiutato", () => {
  const p = P();
  assert.match(verificaManifesto({ ...manifesto(p), extra: 1 }, p).join(" "), /manifesto/);
  assert.match(verificaManifesto({ ...manifesto(p), prototipo: "paltro000001" }, p).join(" "), /prototipo/);
});

test("ROSSO, R-54: un istante senza millisecondi passa lo schema del datastore ma non i limiti di advanced, e la consegna intatta è rifiutata", () => {
  const p = P();
  p.meta.origine.convertitoIl = "2026-10-17T00:00:00Z";
  const r = verificaConsegna(inCartella(manifesto(p), p));
  assert.equal(r.ok, false);
  assert.match(r.errori.join(" "), /convertitoIl/);
});
