/**
 * Ricalcola le query di ogni domanda e segnala le risposte attese diventate vecchie.
 *
 *   cd apps/agent-gateway && pnpm exec tsx scripts/batteria-verifica.ts [--domande <file>]
 *
 * Uscita 0 = tutte attuali; 1 = almeno una vecchia (si rigenera con batteria-genera.ts).
 */
import { readFileSync } from "node:fs";
import { attesoDaRighe } from "../test/batteria/genera.js";
import type { Batteria } from "../test/batteria/tipi.js";
import { BATTERIA, conSolaLettura } from "./batteria-db.js";

const i = process.argv.indexOf("--domande");
const file = i > 0 ? process.argv[i + 1]! : BATTERIA;
const b = JSON.parse(readFileSync(file, "utf8")) as Batteria;

const vecchie = await conSolaLettura(async (q, database) => {
  console.log(`verifico ${b.domande.length} domande su ${database} (misurate il ${b.generataIl} su ${b.database})`);
  const out: string[] = [];
  for (const d of b.domande) {
    const ora = attesoDaRighe(d.atteso.confronto, await q(d.query.sql, d.query.parametri), d.vocabolario);
    if (JSON.stringify(ora) !== JSON.stringify(d.atteso)) out.push(`${d.id} ${d.testo}\n    attesa salvata: ${JSON.stringify(d.atteso).slice(0, 200)}\n    attesa di oggi: ${JSON.stringify(ora).slice(0, 200)}`);
  }
  return out;
});

for (const v of vecchie) console.log(`VECCHIA ${v}`);
console.log(`${vecchie.length} risposte attese vecchie su ${b.domande.length} (${new Date().toISOString()})`);
process.exitCode = vecchie.length ? 1 : 0;
