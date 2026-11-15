/**
 * apps/api/scripts/sql-sola-lettura.mts
 * Esegue una query sul database dell'API dentro una transazione READ ONLY e stampa le righe in JSON.
 * Le credenziali arrivano dalla configurazione dell'API (src/config/env.ts) e non vengono mai stampate.
 * Serve al controllo forense del frontend: rifare dal database i numeri che una pagina mostra.
 *
 *   cd apps/api && npx tsx scripts/sql-sola-lettura.mts "select ..."      (oppure la query su stdin)
 */
import { pool } from "../src/db/client.ts";

let sql = process.argv[2];
if (!sql) {
  const parti: Buffer[] = [];
  for await (const p of process.stdin) parti.push(p as Buffer);
  sql = Buffer.concat(parti).toString("utf8");
}
if (!sql?.trim()) {
  console.error('uso: npx tsx scripts/sql-sola-lettura.mts "select ..."');
  process.exit(1);
}
const c = await pool.connect();
try {
  await c.query("BEGIN READ ONLY");
  const r = await c.query(sql);
  const righe = Array.isArray(r) ? r.flatMap((x) => x.rows ?? []) : r.rows;
  console.log(JSON.stringify(righe, null, 1));
  await c.query("ROLLBACK");
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  console.error(`errore: ${(e as Error).message}`);
  process.exitCode = 2;
} finally {
  c.release();
  await pool.end();
}
