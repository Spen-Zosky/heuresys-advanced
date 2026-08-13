/**
 * apps/web/tests/e2e/global-setup.ts — il censimento di PARTENZA.
 *
 * Esiste solo per una ragione: senza una misura PRIMA della suite, il conteggio dopo la
 * pulizia non distingue «questa corsa non ha lasciato niente» da «c'erano gia' 4 righe di
 * qualcun altro». La differenza fra i due e' tutto: il primo e' un verde, il secondo un
 * rosso che punisce chi non ha colpa, e un rosso cosi' insegna a non guardare i rossi.
 *
 * La linea di partenza finisce in un file temporaneo perche' setup e teardown sono due
 * moduli distinti e non condividono memoria. Se il censimento non riesce (tunnel giu',
 * psql assente) il file NON viene scritto, e il teardown lo interpreta come «non
 * misurato» — che dichiara, invece di far finta di essere verde.
 *
 * `DRIFT_CHECK=0` lo salta, come sul lato API.
 */
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { censimento, colonneSorvegliate } from "./e2e-drift";

export const BASELINE_PATH = join(tmpdir(), "heuresys-e2e-drift-baseline.json");

export default async function globalSetup(): Promise<void> {
  if (process.env.DRIFT_CHECK === "0") {
    console.log("[e2e drift] DRIFT_CHECK=0 — censimento di partenza saltato.");
    return;
  }
  try {
    const colonne = colonneSorvegliate();
    const prima = censimento();
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify({ colonne, prima: [...prima.entries()] }),
      "utf8",
    );
    let tot = 0;
    for (const v of prima.values()) tot += v;
    console.log(`[e2e drift] partenza: ${colonne} colonne ispezionate, ${tot} righe residue pre-esistenti.`);
  } catch (err) {
    // Non si fallisce qui: un tunnel giu' non e' un difetto del codice sotto prova.
    // Il file assente fara' dire al teardown «non misurato», che e' la verita'.
    console.warn("[e2e drift] censimento di partenza NON riuscito:", (err as Error).message);
  }
}
