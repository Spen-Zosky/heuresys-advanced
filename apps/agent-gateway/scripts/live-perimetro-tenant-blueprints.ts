/**
 * ⚠ QUESTO SCRIPT NON CONTIENE PIÙ LA PROVA — la esegue `live-perimetro.ts`, che la fa per
 * un perimetro qualunque. Resta come nome, perché il piano di #214, il register e i
 * messaggi di commit lo citano: chi lo lancia deve ottenere la prova giusta, non un
 * «file non trovato».
 *
 * PERCHÉ È STATO SVUOTATO (S1078). Questo file era nato il 2026-08-19 copiando
 * `live-perimetro-positions.ts`, e in un punto il nome di una variabile non era stato
 * rinominato: alla riga 162 leggeva `opsPositions`, che qui non esisteva. Lo script moriva
 * con `ERRORE: opsPositions is not defined` PRIMA ancora del login — quindi la prova live
 * del terzo perimetro, che il registro dichiarava eseguita quel giorno, non era mai potuta
 * girare. Eseguita per la prima volta il 2026-08-23: VERDE.
 *
 * E la copia nascondeva un difetto peggiore del refuso, che riguardava ANCHE l'originale:
 * due dei criteri erano veri PER VUOTO — il filtro sulla mappa iterava le chiavi di radice
 * invece di scendere in `concepts`, e il controllo sul concetto sentinella cercava nel
 * diario una stringa che il diario non conteneva. Dettagli in `live-perimetro.ts`.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const qui = dirname(fileURLToPath(import.meta.url));
console.log("[rimando] la prova vive in live-perimetro.ts — eseguo `tenant-blueprints`\n");
const r = spawnSync(process.execPath, [
  join(qui, "..", "node_modules", "tsx", "dist", "cli.mjs"),
  join(qui, "live-perimetro.ts"),
  "tenant-blueprints",
], { stdio: "inherit" });
process.exit(r.status ?? 1);
