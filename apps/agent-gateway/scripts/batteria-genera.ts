/**
 * Genera `test/batteria/domande.json` dai modelli, eseguendo le query in sola lettura.
 *
 *   cd apps/agent-gateway && pnpm exec tsx scripts/batteria-genera.ts [--esci <file>]
 *
 * Rilanciato sugli stessi dati dà le stesse domande (cambia solo la data della misura).
 */
import { writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { genera } from "../test/batteria/genera.js";
import { DOMINI } from "../test/batteria/modelli/indice.js";
import { PROFILI } from "../test/batteria/profili.js";
import { controllaBatteria, type Batteria, type Domanda } from "../test/batteria/tipi.js";
import { BATTERIA, conSolaLettura } from "./batteria-db.js";

const i = process.argv.indexOf("--esci");
const uscita = i > 0 ? process.argv[i + 1]! : BATTERIA;
const adesso = new Date().toISOString();

const b: Batteria = await conSolaLettura(async (q, database) => {
  const domande: Domanda[] = [];
  for (const d of DOMINI) {
    const r = await genera(d, q, adesso);
    domande.push(...r.domande);
    console.log(`${d.codice}: ${r.domande.length} domande, ${r.scartate.length} scartate (senza risposta univoca)`);
    for (const s of r.scartate) console.log(`  scartata ${s}`);
  }
  return { versione: 1, generataIl: adesso, database: `${database}@${hostname()}`, domande };
});

const difetti = controllaBatteria(b, new Set(Object.keys(PROFILI)));
// Una batteria difettosa non si scrive: al rilancio verrebbe riusata senza controlli.
if (difetti.length === 0) writeFileSync(uscita, `${JSON.stringify(b, null, 1)}\n`);
console.log(`${difetti.length ? "NON scritte" : "scritte"} ${b.domande.length} domande in ${uscita} (database ${b.database}, ${adesso})`);
for (const d of difetti) console.error(`DIFETTO ${d}`);
process.exitCode = difetti.length ? 1 : 0;
