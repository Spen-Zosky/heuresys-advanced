// Guasta un pacchetto v0.3 in un modo noto, per provare che il caricatore lo rifiuta (O2-02). Uso: node guasta-pacchetto.mjs <in.json> <out.json> <guasto>
//   leva-fuori-vocabolario | sezione-mancante | ore-oltre-168 | impronta-non-esadecimale | schema-sconosciuto | due-sedi-due-entita | valore-fuori-vocabolario-fase
import fs from "node:fs";
const [IN, OUT, G] = process.argv.slice(2);
const P = JSON.parse(fs.readFileSync(IN, "utf8"));
const GUASTI = {
  "leva-fuori-vocabolario": (p) => { p.strategia.leva.prevalente = "FOO"; },
  "sezione-mancante": (p) => { Reflect.deleteProperty(p, "principi"); },
  "ore-oltre-168": (p) => { p.posizioni.find((x) => x.oreProcessi?.length).oreProcessi[0].oreSettimanali = 200; },
  "impronta-non-esadecimale": (p) => { p.meta.origine.impronta = "xyz"; },
  "schema-sconosciuto": (p) => { p.meta.schema = "heuresys.prototipo.pacchetto/0.9"; },
  "due-sedi-due-entita": (p) => { p.entita[1].sediCodici = [p.entita[0].sediCodici[0]]; },
  "valore-fuori-vocabolario-fase": (p) => { p.processi.find((x) => x.fasi?.length).fasi[0].naturaLavoro = "ROBOT"; },
};
if (!GUASTI[G]) throw new Error("guasto sconosciuto: " + G);
GUASTI[G](P);
fs.writeFileSync(OUT, JSON.stringify(P));
console.log(JSON.stringify({ uscita: OUT, guasto: G }));
