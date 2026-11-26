/**
 * apps/api/scripts/ruoli-dei-test.mjs — legge e controlla db/scripts/ruoli-dei-test.json, le
 * concessioni di ruolo su persone di RTL che i test di integrazione danno per scontate.
 *
 * Modulo puro come collaudo-access.mjs, e per la stessa ragione: una sola implementazione,
 * importata dallo script che porta il database allo stato dichiarato
 * (db/scripts/ruoli-dei-test.ts) e dalla prova della dichiarazione
 * (test/unit/ruoli-dei-test.unit.test.ts). Una forma sbagliata ferma tutto prima del database.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO } from "./derive-access.mjs";
import { isCollaudoIdentity } from "./collaudo-access.mjs";

export const RUOLI_DEI_TEST_PATH = join(REPO, "db", "scripts", "ruoli-dei-test.json");

export function leggiDichiarazione(percorso = RUOLI_DEI_TEST_PATH) {
  const grezzo = JSON.parse(readFileSync(percorso, "utf8"));
  if (!Array.isArray(grezzo.concessioni) || grezzo.concessioni.length === 0) {
    throw new Error(`${percorso}: manca l'elenco "concessioni"`);
  }
  const viste = new Set();
  return grezzo.concessioni.map((r, i) => {
    const dove = `${percorso}, concessione ${i + 1}`;
    if (typeof r?.email !== "string" || !/^[a-z0-9.-]+@[a-z0-9.-]+$/.test(r.email)) throw new Error(`${dove}: email non valida`);
    if (typeof r.ruolo !== "string" || !/^[A-Z_]+$/.test(r.ruolo)) throw new Error(`${dove}: ruolo non valido`);
    if (typeof r.motivo !== "string" || r.motivo.trim().length < 10) throw new Error(`${dove}: il motivo è obbligatorio`);
    if (!Array.isArray(r.test) || r.test.length === 0) throw new Error(`${dove}: manca l'elenco dei test che la usano`);
    if (isCollaudoIdentity(r.email)) {
      throw new Error(`${dove}: ${r.email} è un'utenza di collaudo, il suo ruolo sta in collaudo-access.mjs`);
    }
    const chiave = `${r.email}|${r.ruolo}`;
    if (viste.has(chiave)) throw new Error(`${dove}: concessione ripetuta (${chiave})`);
    viste.add(chiave);
    return { email: r.email, ruolo: r.ruolo, motivo: r.motivo.trim(), test: r.test.map(String) };
  });
}
