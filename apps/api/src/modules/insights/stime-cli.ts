/**
 * apps/api/src/modules/insights/stime-cli.ts
 * F3c — stampa le stime dalla storia di un tenant e la prova sul periodo tenuto da parte.
 * Solo letture: non scrive niente, in nessun database.
 *
 *   pnpm --filter @heuresys/api insights:stime -- <tenant_code>
 */
import { pool } from "../../db/client.js";
import { stimeDallaStoria } from "./stime.js";

export async function runStimeCli(tenantCode: string): Promise<void> {
  const { rows } = await pool.query<{ tenant_id: string }>(
    "SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = $1",
    [tenantCode],
  );
  const tenantId = rows[0]?.tenant_id;
  if (!tenantId) throw new Error(`tenant non trovato: ${tenantCode}`);
  const out = await stimeDallaStoria(pool, tenantId);
  console.log(JSON.stringify({ cli: "insights-stime", tenantCode, ...out }, null, 2));
}

const invoked = process.argv[1] ?? "";
if (invoked.endsWith("stime-cli.ts") || invoked.endsWith("stime-cli.js")) {
  const code = process.argv.slice(2).find((a) => a !== "--");
  if (!code) {
    console.error("uso: insights:stime -- <tenant_code>");
    process.exit(2);
  }
  runStimeCli(code)
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error("insights-stime CLI FAILED:", err);
      void pool.end().finally(() => process.exit(1));
    });
}
