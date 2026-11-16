/**
 * apps/api/src/modules/tenant-consolidation/distanza-cli.ts — la misura della distanza da riga di comando
 * (voce A2 del piano di allineamento, ADR-0059 D7).
 *
 *   pnpm --filter @heuresys/api consolidation:distance -- --tenant RTL_BANK [--run p20261010010521tjb]
 *        [--version <uuid>] [--dettaglio] [--dominio unita]
 *
 * Sola lettura: tutte le query girano in una transazione `READ ONLY`, che il server rifiuta di far
 * scrivere, e la transazione si chiude con ROLLBACK. Il modello è la versione della corsa indicata (per
 * codice, dal registro `sys_blueprint_runs` del tenant) o la versione indicata; senza nessuno dei due, la
 * corsa più recente del registro. Stampa un JSON: i 24 domini con uguali, parziali, diversi, solo nel
 * modello, solo nel tenant e ricchezza persa; con `--dettaglio` anche le righe di ogni dominio.
 */
import { pool } from "../../db/client.js";
import { misuraDistanza, DOMINI_DISTANZA } from "./distanza.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function argomento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export async function runDistanceCli(): Promise<Record<string, unknown>> {
  const quale = argomento("tenant");
  if (!quale) throw new Error("manca --tenant <codice|uuid>");
  const dominio = argomento("dominio");
  if (dominio && !(DOMINI_DISTANZA as readonly string[]).includes(dominio)) throw new Error(`dominio sconosciuto: ${dominio}`);
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const t = await client.query<{ id: string }>(
      UUID.test(quale) ? `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_id = $1`
        : `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = $1`, [quale]);
    const tenantId = t.rows[0]?.id;
    if (!tenantId) throw new Error(`tenant non trovato: ${quale}`);
    let versione = argomento("version") ?? null;
    let corsa: string | null = null;
    if (!versione) {
      const codice = argomento("run");
      const r = await client.query<{ v: string | null; c: string }>(
        `SELECT blueprint_run_variant_version_id AS v, blueprint_run_code AS c FROM sys.sys_blueprint_runs
          WHERE blueprint_run_tenant_id = $1 AND ($2::text IS NULL OR blueprint_run_code = $2)
          ORDER BY blueprint_run_model_loaded_at DESC, blueprint_run_package_version DESC LIMIT 1`, [tenantId, codice ?? null]);
      versione = r.rows[0]?.v ?? null;
      corsa = r.rows[0]?.c ?? null;
      if (!versione) throw new Error(codice ? `corsa non trovata o senza versione: ${codice}` : "il tenant non ha corse nel registro");
    }
    const m = await misuraDistanza(client, tenantId, versione, { conDettaglio: process.argv.includes("--dettaglio") });
    const esito = {
      cli: "consolidation-distance",
      corsa,
      ...m,
      domini: dominio ? m.domini.filter((x) => x.dominio === dominio) : m.domini,
    };
    console.log(JSON.stringify(esito, null, 2));
    return esito;
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
}

const invoked = process.argv[1] ?? "";
if (invoked.endsWith("distanza-cli.ts") || invoked.endsWith("distanza-cli.js")) {
  runDistanceCli()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error("consolidation-distance CLI FAILED:", err instanceof Error ? err.message : err);
      void pool.end().finally(() => process.exit(1));
    });
}
