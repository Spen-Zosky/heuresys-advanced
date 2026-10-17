// Convalida di un pacchetto del datastore PRIMA di toccare il database (O2-02).
//  1. lo schema: il pacchetto deve passare lo schema della sua versione (v0.3 o v0.2), con lo stesso validatore del datastore (Ajv 8, dialetto 2020-12);
//  2. i limiti delle colonne: dove il database e' piu' severo dello schema (esito O2-01, «dove il disegno e' piu' severo dello schema»), il pacchetto
//     si rifiuta qui con un errore che dice quale campo e perche', invece di lasciarlo al CHECK del database o a un arrotondamento silenzioso.
// Gli schemi stanno in `contratto/` (copia di heuresys-datastore/src/contratto/); l'impronta di ogni file si controlla contro VERSIONE.json.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { SCHEMA_V02, SCHEMA_V03 } from "./definizione-pacchetto.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(AQUI, "../../..");

// Ajv 8 non e' una dipendenza diretta di nessun pacchetto del monorepo: arriva dallo store pnpm (la versione e' quella del datastore, 8.20.0)
const trovaAjv = () => {
  const candidati = [() => createRequire(path.join(RADICE, "apps/api/package.json")).resolve("ajv/dist/2020.js")];
  const store = path.join(RADICE, "node_modules/.pnpm");
  candidati.push(() => {
    const v = fs.readdirSync(store).filter((d) => /^ajv@8\./.test(d)).sort().pop();
    if (!v) throw new Error("niente ajv@8 nello store pnpm");
    return path.join(store, v, "node_modules/ajv/dist/2020.js");
  });
  for (const c of candidati) { try { const p = c(); const m = createRequire(p)(p); return m.default ?? m; } catch { /* prossimo */ } }
  throw new Error("Ajv 8 non trovato (ne' da apps/api ne' nello store pnpm): senza, il caricatore non convalida e non carica");
};

const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n")).digest("hex");
const cache = {};
export function validatore(schema) {
  if (cache[schema]) return cache[schema];
  const cartella = schema === SCHEMA_V03 ? "v0.3" : schema === SCHEMA_V02 ? "v0.2" : null;
  if (!cartella) throw new Error(`schema sconosciuto: ${schema} (il caricatore conosce ${SCHEMA_V02} e ${SCHEMA_V03})`);
  const file = path.join(AQUI, "contratto", cartella, "prototipo-pacchetto.schema.json");
  if (cartella === "v0.3") { // l'impronta del contratto approvato: una copia che diverge non convalida niente
    const attesa = JSON.parse(fs.readFileSync(path.join(AQUI, "contratto/v0.3/VERSIONE.json"), "utf8")).impronte["prototipo-pacchetto.schema.json"];
    if (sha(file) !== attesa) throw new Error("lo schema v0.3 copiato non ha l'impronta dichiarata in VERSIONE.json: va ricopiato dal datastore");
    const voc = JSON.parse(fs.readFileSync(path.join(AQUI, "contratto/v0.3/VERSIONE.json"), "utf8")).impronte["vocabolari.json"];
    if (sha(path.join(AQUI, "contratto/v0.3/vocabolari.json")) !== voc) throw new Error("vocabolari.json copiato non ha l'impronta dichiarata in VERSIONE.json");
  }
  const Ajv = trovaAjv();
  const v = new Ajv({ allErrors: true, strict: false }).compile(JSON.parse(fs.readFileSync(file, "utf8")));
  return (cache[schema] = v);
}

const decimali = (n) => { const s = String(n); return s.includes("e") ? 99 : (s.split(".")[1] ?? "").length; };
const ISO = (s) => typeof s === "string" && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString() === s;

// i limiti del database piu' stretti dello schema, solo per i campi che la v0.3 aggiunge
export function limiti(P) {
  const e = []; const dice = (campo, perche) => e.push(`${campo}: ${perche}`);
  const o = P.meta?.origine;
  if (o) {
    if (o.impronta !== undefined && !/^[0-9a-f]{64}$/.test(o.impronta)) dice("meta.origine.impronta", "deve essere un SHA-256 esadecimale minuscolo di 64 caratteri (la colonna source_hash e' char(64) con CHECK)");
    if (!ISO(o.convertitoIl)) dice("meta.origine.convertitoIl", "deve essere un istante ISO 8601 UTC in forma canonica (AAAA-MM-GGThh:mm:ss.sssZ): la colonna e' un timestamptz e la rilettura lo restituisce cosi'");
    if (o.convertitore.length > 80) dice("meta.origine.convertitore", "al piu' 80 caratteri");
    if (o.schema.length > 48) dice("meta.origine.schema", "al piu' 48 caratteri");
  }
  (P.posizioni ?? []).forEach((x, i) => {
    const visti = new Set();
    for (const h of x.oreProcessi ?? []) {
      if (h.oreSettimanali > 168) dice(`posizioni[${i}].oreProcessi`, `${h.oreSettimanali} ore settimanali: il database ammette 0-168`);
      if (decimali(h.oreSettimanali) > 2) dice(`posizioni[${i}].oreProcessi`, `${h.oreSettimanali}: al piu' 2 decimali (numeric(5,2))`);
      if (visti.has(h.processoCodice)) dice(`posizioni[${i}].oreProcessi`, `il processo ${h.processoCodice} compare due volte`);
      visti.add(h.processoCodice);
    }
  });
  (P.processi ?? []).forEach((x, i) => (x.fasi ?? []).forEach((f, j) => {
    const h = f.oreTipichePerCiclo;
    if (typeof h === "number" && (decimali(h) > 2 || h >= 1e6)) dice(`processi[${i}].fasi[${j}].oreTipichePerCiclo`, `${h}: al piu' 2 decimali e sotto un milione (numeric(8,2))`);
  }));
  (P.commesse ?? []).forEach((x, i) => {
    const visti = new Set();
    for (const c of x.composizione ?? []) {
      if (decimali(c.quotaCapacita) > 3) dice(`commesse[${i}].composizione`, `quota ${c.quotaCapacita}: al piu' 3 decimali (numeric(4,3))`);
      const k = `${c.attore.tipo}|${c.attore.codice}`;
      if (visti.has(k)) dice(`commesse[${i}].composizione`, `l'attore ${k} compare due volte`);
      visti.add(k);
    }
  });
  (P.ruoli ?? []).forEach((r, i) => {
    if (r.nome.it.length > 255) dice(`ruoli[${i}].nome`, "al piu' 255 caratteri");
    if ((r.famigliaProfessionale?.it.length ?? 0) > 128) dice(`ruoli[${i}].famigliaProfessionale`, "al piu' 128 caratteri");
    if ((r.professioneCp2021?.length ?? 0) > 16) dice(`ruoli[${i}].professioneCp2021`, "al piu' 16 caratteri");
  });
  (P.unita ?? []).forEach((u, i) => { if ((u.budget?.voce?.it.length ?? 0) > 128) dice(`unita[${i}].budget.voce`, "al piu' 128 caratteri"); });
  (P.entita ?? []).forEach((x, i) => { if ((x.formaGiuridica?.length ?? 0) > 64) dice(`entita[${i}].formaGiuridica`, "al piu' 64 caratteri"); });
  // una sede appartiene a una sola entita' (la colonna e' sulla sede)
  const di = new Map();
  (P.entita ?? []).forEach((x, i) => { for (const c of x.sediCodici) { if (di.has(c) && di.get(c) !== x.codice) dice(`entita[${i}].sediCodici`, `la sede ${c} e' gia' dell'entita' ${di.get(c)}: una sede appartiene a una sola entita'`); di.set(c, x.codice); } });
  // il perimetro: una voce di catalogo (schema, codice) compare una volta sola per versione
  const voci = new Set();
  for (const [g, lista] of Object.entries(P.perimetro?.voci ?? {})) for (const v of lista) { const k = `${v.schema}|${v.codice}`; if (voci.has(k)) dice(`perimetro.voci.${g}`, `la voce ${k} compare due volte`); voci.add(k); }
  return e;
}

// esito: { ok, schema, errori: [..] }. Mai un'eccezione per un pacchetto sbagliato: l'errore e' il dato.
export function convalida(P) {
  const schema = P?.meta?.schema;
  let v; try { v = validatore(schema); } catch (x) { return { ok: false, schema, errori: [x.message] }; }
  if (!v(P)) return { ok: false, schema, errori: (v.errors ?? []).slice(0, 20).map((x) => `${x.instancePath || "/"} ${x.message}${x.params && Object.keys(x.params).length ? " " + JSON.stringify(x.params) : ""}`) };
  const l = schema === SCHEMA_V03 ? limiti(P) : [];
  return { ok: l.length === 0, schema, errori: l };
}
