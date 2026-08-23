/**
 * ⚠ QUESTO SCRIPT NON CONTIENE PIÙ LA PROVA — la esegue `live-perimetro.ts`, che la fa per
 * un perimetro qualunque. Resta come nome, perché il piano di #214, il register e i
 * messaggi di commit lo citano: chi lo lancia deve ottenere la prova giusta.
 *
 * PERCHÉ È STATO SVUOTATO (S1078). Era l'originale, e il 2026-08-19 è stato copiato per
 * fare quello di `tenant-blueprints`: la copia ha portato con sé un refuso che la rendeva
 * incapace di partire, e — cosa peggiore — DUE CRITERI VERI PER VUOTO che erano già qui:
 *
 *   · «la MAPPA del perimetro non dichiara nessuna scrittura» — il filtro iterava le chiavi
 *     di RADICE di agent-operations.json (`_fonti`, `_generato_da`, `concepts`) cercandovi
 *     il nome del perimetro. Nessuna lo contiene, quindi trovava sempre ZERO operazioni, e
 *     «zero scritture» era vero perché non aveva guardato niente. Proprio il criterio che
 *     il commento definiva «quello che non dipende da cosa il modello ha tentato».
 *   · «nessuna lettura consentita su `users`» — cercava `"concept":"users"` nel diario, che
 *     quel campo non aveva: il diario registrava solo un `argsHash`. Sempre verde.
 *
 * Il primo criterio qui passava anche per un secondo motivo che non si generalizza: gli
 * strumenti di dominio si chiamano `hrx_positions_list`/`_get`, quindi il nome del
 * perimetro finiva nel campo `tool`. Per i perimetri serviti dai soli strumenti generici
 * (`content`, `tenant-blueprints`) era invece IMPOSSIBILE da soddisfare — ed è così che
 * il difetto si è scoperto. Il diario ora registra concetto e operazione (audit-sink.ts).
 *
 * Rifatta con i criteri corretti il 2026-08-23: VERDE.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const qui = dirname(fileURLToPath(import.meta.url));
console.log("[rimando] la prova vive in live-perimetro.ts — eseguo `positions`\n");
const r = spawnSync(process.execPath, [
  join(qui, "..", "node_modules", "tsx", "dist", "cli.mjs"),
  join(qui, "live-perimetro.ts"),
  "positions",
], { stdio: "inherit" });
process.exit(r.status ?? 1);
