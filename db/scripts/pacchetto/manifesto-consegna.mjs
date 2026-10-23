// Il manifesto di una consegna del datastore, letto dal lato di advanced (consolidamento C1; `.programmi/consolidamento/03_PIANO.md`).
// Una consegna è una cartella `<prototipo>/<versione>/` con `pacchetto.json` e `manifesto.json`, scritta dal verbo
// POST /v1/fascicoli/:prototipo/consegna del datastore. Qui si verifica senza toccare il database:
//  1. le copie dello schema del manifesto e del caso d'impronta hanno l'impronta dichiarata in `contratto/consegna/ORIGINE.json`;
//  2. il manifesto passa il suo schema (Ajv 8, dialetto 2020-12, lo stesso del datastore);
//  3. prototipo e contratto del manifesto coincidono con `meta` del pacchetto;
//  4. l'impronta ricalcolata qui (sha256-json-canonico) coincide con quella del manifesto;
//  5. il pacchetto passa `convalida` (schema della sua versione e limiti delle colonne).
// Limite dichiarato: l'impronta dice che il file non è cambiato dopo la consegna, non chi l'ha scritto. Non è una firma.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { convalida, trovaAjv } from "./convalida-pacchetto.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CONSEGNA = path.join(AQUI, "contratto", "consegna");
export const ALGORITMO = "sha256-json-canonico";

// La stessa forma canonica del datastore (src/contratto/impronta.ts): chiavi in ordine, chiavi con valore undefined tolte,
// elenchi nel loro ordine, scalari come li scrive JSON.stringify. Il caso condiviso la tiene allineata.
export function jsonCanonico(x) {
  if (Array.isArray(x)) return `[${x.map(jsonCanonico).join(",")}]`;
  if (typeof x === "object" && x !== null) {
    return `{${Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => `${JSON.stringify(k)}:${jsonCanonico(x[k])}`).join(",")}}`;
  }
  return JSON.stringify(x);
}
export const improntaJson = (x) => crypto.createHash("sha256").update(jsonCanonico(x)).digest("hex");

const shaFile = (p) => crypto.createHash("sha256").update(fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n")).digest("hex");
export function copieAllineate() {
  const origine = JSON.parse(fs.readFileSync(path.join(CONSEGNA, "ORIGINE.json"), "utf8"));
  return Object.entries(origine.impronte).flatMap(([nome, { sha256 }]) =>
    shaFile(path.join(CONSEGNA, nome)) === sha256 ? [] : [`${nome}: la copia non ha l'impronta dichiarata in ORIGINE.json, va ricopiata dal datastore`]);
}

let validatoreDelManifesto;
function validaManifesto(m) {
  validatoreDelManifesto ??= new (trovaAjv())({ allErrors: true, strict: false }).compile(JSON.parse(fs.readFileSync(path.join(CONSEGNA, "manifesto.schema.json"), "utf8")));
  return validatoreDelManifesto(m) ? [] : (validatoreDelManifesto.errors ?? []).map((e) => `manifesto${e.instancePath}: ${e.message}`);
}

// esito: { ok, errori, manifesto, pacchetto }. Mai un'eccezione per una consegna sbagliata: l'errore è il dato.
export function verificaManifesto(manifesto, pacchetto) {
  const copie = copieAllineate();
  if (copie.length > 0) return copie;
  const forma = validaManifesto(manifesto);
  if (forma.length > 0) return forma;
  const e = [];
  const meta = pacchetto?.meta ?? {};
  if (meta.prototipoId !== manifesto.prototipo) e.push(`il pacchetto è del prototipo ${meta.prototipoId}, il manifesto dice ${manifesto.prototipo}`);
  if (meta.schema !== manifesto.contratto) e.push(`il pacchetto è ${meta.schema}, il manifesto dice ${manifesto.contratto}`);
  const ricalcolata = improntaJson(pacchetto);
  if (ricalcolata !== manifesto.impronta.valore) e.push(`impronta diversa: il manifesto dice ${manifesto.impronta.valore}, il pacchetto ricalcolato dà ${ricalcolata}`);
  return e;
}

export function verificaConsegna(cartella) {
  const leggi = (nome) => { try { return JSON.parse(fs.readFileSync(path.join(cartella, nome), "utf8")); } catch (x) { return { _errore: `${nome}: ${x.message}` }; } };
  const manifesto = leggi("manifesto.json");
  if (manifesto._errore) return { ok: false, errori: [manifesto._errore] };
  const pacchetto = leggi(manifesto.file ?? "pacchetto.json");
  if (pacchetto._errore) return { ok: false, errori: [pacchetto._errore], manifesto };
  const errori = verificaManifesto(manifesto, pacchetto);
  if (errori.length === 0) errori.push(...convalida(pacchetto).errori);
  return { ok: errori.length === 0, errori, manifesto, pacchetto };
}

// Da terminale: node db/scripts/pacchetto/manifesto-consegna.mjs <cartella della consegna>
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cartella = process.argv[2];
  if (!cartella) { console.error("uso: node db/scripts/pacchetto/manifesto-consegna.mjs <cartella con manifesto.json e pacchetto.json>"); process.exit(2); }
  const r = verificaConsegna(cartella);
  console.log(JSON.stringify({ ok: r.ok, prototipo: r.manifesto?.prototipo, versione: r.manifesto?.versione, errori: r.errori }, null, 2));
  process.exit(r.ok ? 0 : 1);
}
