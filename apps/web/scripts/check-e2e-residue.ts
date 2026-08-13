/**
 * apps/web/scripts/check-e2e-residue.ts — «il database e' pulito?», senza far girare la suite.
 *
 * Lo stesso censimento che l'assert di drift usa a fine suite, lanciabile da solo:
 *
 *     cd apps/web && pnpm e2e:residue-check
 *
 * Serve in due momenti in cui la suite non e' l'attrezzo giusto: prima di fidarsi di una
 * corsa (partire da un database gia' sporco confonde il verdetto) e dopo una corsa
 * interrotta a meta', quando il teardown non e' mai arrivato in fondo.
 *
 * A differenza dell'assert, qui NON esiste una linea di partenza con cui confrontarsi:
 * il verdetto e' quindi sul TOTALE, e la sua lettura e' diversa — non «questa corsa ha
 * sporcato» ma «sul database ci sono N righe di prova, ecco dove». Esce 1 se ce n'e'
 * almeno una, cosi' e' usabile come cancello; esce 2 se non ha potuto misurare, che non
 * e' la stessa cosa di pulito.
 */
import { censimento, colonneSorvegliate, PREFISSI } from "../tests/e2e/e2e-drift";

function main(): number {
  let colonne: number;
  let trovati: Map<string, number>;
  try {
    colonne = colonneSorvegliate();
    trovati = censimento();
  } catch (err) {
    console.error("[residue-check] NON MISURATO:", (err as Error).message);
    console.error("                Non e' 'pulito': e' 'non ho potuto guardare'.");
    return 2;
  }

  if (colonne === 0) {
    console.error("[residue-check] ZERO COLONNE ISPEZIONATE — grant, database o schema "
      + "sbagliati. Un 'nessun residuo' qui sarebbe un verde muto.");
    return 2;
  }

  let totale = 0;
  for (const n of trovati.values()) totale += n;

  console.log(`[residue-check] ${colonne} colonne testuali di 'sys' ispezionate`);
  console.log(`[residue-check] prefissi: ${PREFISSI.join("  ")}`);
  if (totale === 0) {
    console.log("[residue-check] 0 righe di prova sul database.");
    return 0;
  }
  console.log(`[residue-check] ${totale} righe di prova, in ${trovati.size} colonne:`);
  for (const [loc, n] of [...trovati.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`                ${String(n).padStart(6)}  ${loc}`);
  }
  return 1;
}

process.exit(main());
