/**
 * apps/api/src/modules/agent-signals/signals-cli.ts — ADR-0063, voce F4a (E6).
 *
 *   pnpm --filter @heuresys/api agents:signals          # il giro vero
 *   pnpm --filter @heuresys/api agents:signals --prova  # stesso giro, nessuna scrittura
 *
 * Ogni notte (heuresys-advanced-agent-signals.timer) i segnalatori leggono tutti i tenant e
 * mettono le segnalazioni nella casella di chi le ha nel perimetro. Rieseguito, non ripete: una
 * segnalazione aperta per la stessa persona e lo stesso soggetto si rivede, non si duplica.
 * Esce con 1 se la sentinella del perimetro non è vuota.
 */
import { pool } from "../../db/client.js";
import { giro } from "./service.js";

export async function runAgentSignalsCli(prova: boolean): Promise<number> {
  const esito = await giro({ prova });
  console.log(JSON.stringify({ cli: "agent-signals", prova, ...esito }));
  return esito.outOfScope === 0 ? 0 : 1;
}

const invoked = process.argv[1] ?? "";
if (invoked.endsWith("signals-cli.ts") || invoked.endsWith("signals-cli.js")) {
  runAgentSignalsCli(process.argv.includes("--prova"))
    .then(async (code) => { await pool.end(); process.exit(code); })
    .catch((err: unknown) => {
      console.error("agent-signals CLI FAILED:", err);
      void pool.end().finally(() => process.exit(1));
    });
}
